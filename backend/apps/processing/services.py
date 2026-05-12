from __future__ import annotations

from collections import defaultdict
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.auditing.services import register_audit_event
from apps.core.utils import generate_folio
from apps.inventory.models import InventoryMovement
from apps.inventory.services import create_inventory_movement, get_available_stock

from .models import MaterialProcess, MaterialProcessInput, MaterialProcessOutput, MaterialProcessWaste, ProcessType


@transaction.atomic
def create_process_type(*, code: str, name: str, description: str = "", active: bool = True, created_by=None) -> ProcessType:
    process_type = ProcessType.objects.create(code=code, name=name, description=description, active=active)
    register_audit_event(actor=created_by, action="create_process_type", entity=process_type, details={"code": code, "name": name})
    return process_type


@transaction.atomic
def create_material_process(
    *,
    process_type,
    collection_center,
    process_date=None,
    notes: str = "",
    created_by,
) -> MaterialProcess:
    process = MaterialProcess.objects.create(
        folio=generate_folio("PR"),
        process_type=process_type,
        collection_center=collection_center,
        process_date=process_date or timezone.now(),
        notes=notes,
        created_by=created_by,
        status=MaterialProcess.Status.DRAFT,
    )
    register_audit_event(actor=created_by, action="create_material_process", entity=process, details={"folio": process.folio})
    return process


def _assert_draft(process: MaterialProcess) -> None:
    if process.status != MaterialProcess.Status.DRAFT:
        raise ValidationError("Solo se puede modificar un proceso en borrador.")


def _assert_positive(quantity) -> Decimal:
    quantity_value = Decimal(quantity)
    if quantity_value <= 0:
        raise ValidationError("La cantidad debe ser mayor a cero.")
    return quantity_value


@transaction.atomic
def add_process_input(*, process: MaterialProcess, material, quantity, unit: str = "kg", source_inventory_reference: str = "", user=None) -> MaterialProcessInput:
    _assert_draft(process)
    quantity_value = _assert_positive(quantity)
    process_input = MaterialProcessInput.objects.create(
        process=process,
        material=material,
        quantity=quantity_value,
        unit=unit,
        source_inventory_reference=source_inventory_reference,
    )
    register_audit_event(
        actor=user,
        action="add_process_input",
        entity=process_input,
        details={"process_folio": process.folio, "material": str(material.pk), "quantity": str(quantity_value)},
    )
    return process_input


@transaction.atomic
def add_process_output(*, process: MaterialProcess, material, quantity, unit: str = "kg", lot_code: str = "", user=None) -> MaterialProcessOutput:
    _assert_draft(process)
    quantity_value = _assert_positive(quantity)
    lot_code = lot_code.strip() or generate_folio("LT")
    process_output = MaterialProcessOutput.objects.create(process=process, material=material, quantity=quantity_value, unit=unit, lot_code=lot_code)
    register_audit_event(
        actor=user,
        action="add_process_output",
        entity=process_output,
        details={"process_folio": process.folio, "material": str(material.pk), "quantity": str(quantity_value), "lot_code": lot_code},
    )
    return process_output


@transaction.atomic
def add_process_waste(
    *,
    process: MaterialProcess,
    material=None,
    waste_type: str = MaterialProcessWaste.WasteType.MERMA,
    quantity,
    unit: str = "kg",
    notes: str = "",
    user=None,
) -> MaterialProcessWaste:
    _assert_draft(process)
    quantity_value = _assert_positive(quantity)
    process_waste = MaterialProcessWaste.objects.create(
        process=process,
        material=material,
        waste_type=waste_type,
        quantity=quantity_value,
        unit=unit,
        notes=notes,
    )
    register_audit_event(
        actor=user,
        action="add_process_waste",
        entity=process_waste,
        details={"process_folio": process.folio, "waste_type": waste_type, "quantity": str(quantity_value)},
    )
    return process_waste


def validate_process_inventory(*, process: MaterialProcess) -> None:
    required: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    materials: dict[str, object] = {}
    for row in process.inputs.select_related("material"):
        required[str(row.material_id)] += Decimal(row.quantity)
        materials[str(row.material_id)] = row.material

    shortages: list[str] = []
    for material_id, required_qty in required.items():
        material = materials[material_id]
        available = get_available_stock(material=material, collection_center=process.collection_center)
        if available < required_qty:
            shortages.append(f"{material.name}: disponible {available}, requerido {required_qty}")

    if shortages:
        raise ValidationError("No hay inventario suficiente para procesar: " + "; ".join(shortages))


def _existing_output_weight(process: MaterialProcess) -> Decimal:
    return sum((Decimal(output.quantity) for output in process.outputs.all()), Decimal("0"))


def _existing_waste_weight(process: MaterialProcess) -> Decimal:
    return sum((Decimal(waste.quantity) for waste in process.wastes.all()), Decimal("0"))


@transaction.atomic
def confirm_material_process(*, process: MaterialProcess, user) -> MaterialProcess:
    process = MaterialProcess.objects.select_for_update().get(pk=process.pk)
    if process.status == MaterialProcess.Status.CONFIRMED:
        raise ValidationError("El proceso ya fue confirmado.")
    if process.status == MaterialProcess.Status.CANCELLED:
        raise ValidationError("No se puede confirmar un proceso cancelado.")
    if not process.inputs.exists():
        raise ValidationError("El proceso debe tener al menos una entrada.")
    if not process.outputs.exists() and not process.wastes.exists():
        raise ValidationError("El proceso debe generar salidas o merma.")

    validate_process_inventory(process=process)

    from apps.commercialization.services import estimate_material_cost

    input_costs: list[Decimal] = []
    for process_input in process.inputs.select_related("material"):
        input_costs.append(
            estimate_material_cost(
                material=process_input.material,
                collection_center=process.collection_center,
                quantity_kg=Decimal(process_input.quantity),
            )
        )
    total_input_cost = sum(input_costs, Decimal("0")).quantize(Decimal("0.01"))
    total_output_weight = _existing_output_weight(process)
    output_unit_cost = (total_input_cost / total_output_weight).quantize(Decimal("0.00001")) if total_output_weight > 0 else Decimal("0")

    input_movements = []
    for process_input, input_cost in zip(process.inputs.select_related("material"), input_costs):
        unit_cost = (input_cost / Decimal(process_input.quantity)).quantize(Decimal("0.00001")) if Decimal(process_input.quantity) > 0 else Decimal("0")
        movement = create_inventory_movement(
            user=user,
            movement_type=InventoryMovement.MovementType.PROCESS_INPUT_OUT,
            process=process,
            process_input=process_input,
            material=process_input.material,
            collection_center=process.collection_center,
            quantity_kg=process_input.quantity,
            unit_price=unit_cost,
            amount=input_cost,
            notes=process.notes or f"Consumo por proceso {process.folio}",
            source_reference=process_input.source_inventory_reference,
        )
        input_movements.append(movement)

    output_movements = []
    for index, process_output in enumerate(process.outputs.select_related("material"), start=1):
        lot_code = process_output.lot_code or f"{process.folio}-{index:02d}"
        if process_output.lot_code != lot_code:
            process_output.lot_code = lot_code
            process_output.save(update_fields=["lot_code", "updated_at"])
        movement = create_inventory_movement(
            user=user,
            movement_type=InventoryMovement.MovementType.PROCESS_OUTPUT_IN,
            process=process,
            process_output=process_output,
            material=process_output.material,
            collection_center=process.collection_center,
            quantity_kg=process_output.quantity,
            unit_price=output_unit_cost,
            amount=(Decimal(process_output.quantity) * output_unit_cost).quantize(Decimal("0.01")),
            notes=process.notes or f"Salida procesada {process.folio}",
            source_reference=process.folio,
            lot_code=lot_code,
        )
        output_movements.append(movement)

    waste_movements = []
    for process_waste in process.wastes.select_related("material"):
        movement = create_inventory_movement(
            user=user,
            movement_type=InventoryMovement.MovementType.PROCESS_WASTE_OUT,
            process=process,
            process_waste=process_waste,
            material=process_waste.material or process.inputs.first().material,
            collection_center=process.collection_center,
            quantity_kg=process_waste.quantity,
            unit_price=Decimal("0"),
            amount=Decimal("0"),
            notes=process_waste.notes or process.notes or f"Merma de proceso {process.folio}",
            source_reference=process.folio,
        )
        waste_movements.append(movement)

    process.status = MaterialProcess.Status.CONFIRMED
    process.confirmed_by = user
    process.confirmed_at = timezone.now()
    process.save(update_fields=["status", "confirmed_by", "confirmed_at", "updated_at"])
    register_audit_event(
        actor=user,
        action="confirm_material_process",
        entity=process,
        details={
            "process_folio": process.folio,
            "inputs": len(input_movements),
            "outputs": len(output_movements),
            "wastes": len(waste_movements),
            "input_weight": str(sum((Decimal(m.quantity_kg) for m in input_movements), Decimal("0"))),
            "output_weight": str(sum((Decimal(m.quantity_kg) for m in output_movements), Decimal("0"))),
            "waste_weight": str(sum((Decimal(m.quantity_kg) for m in waste_movements), Decimal("0"))),
        },
    )
    return process


@transaction.atomic
def cancel_material_process(*, process: MaterialProcess, user, reason: str = "") -> MaterialProcess:
    process = MaterialProcess.objects.select_for_update().get(pk=process.pk)
    was_confirmed = process.status == MaterialProcess.Status.CONFIRMED
    if process.status == MaterialProcess.Status.CANCELLED:
        return process
    if was_confirmed and not (getattr(user, "is_staff", False) or getattr(user, "is_superuser", False)):
        raise ValidationError("Solo un usuario con permisos especiales puede cancelar un proceso confirmado.")

    if was_confirmed:
        original_movements = list(process.inventory_movements.select_related("material"))
        for movement in original_movements:
            inverse_type = InventoryMovement.MovementType.MANUAL_ADJUSTMENT_IN
            if movement.movement_type in {
                InventoryMovement.MovementType.INBOUND,
                InventoryMovement.MovementType.PURCHASE_IN,
                InventoryMovement.MovementType.PROCESS_OUTPUT_IN,
                InventoryMovement.MovementType.MANUAL_ADJUSTMENT_IN,
                InventoryMovement.MovementType.TRANSFER_IN,
            }:
                inverse_type = InventoryMovement.MovementType.MANUAL_ADJUSTMENT_OUT
            create_inventory_movement(
                user=user,
                movement_type=inverse_type,
                process=process,
                material=movement.material,
                collection_center=process.collection_center,
                quantity_kg=movement.quantity_kg,
                unit_price=movement.unit_price,
                amount=movement.amount,
                notes=f"Reversa por cancelacion de proceso {process.folio}. {reason}".strip(),
                source_reference=movement.source_reference,
                lot_code=movement.lot_code,
            )

    process.status = MaterialProcess.Status.CANCELLED
    process.canceled_by = user
    process.canceled_at = timezone.now()
    process.cancellation_reason = reason
    process.save(update_fields=["status", "canceled_by", "canceled_at", "cancellation_reason", "updated_at"])
    register_audit_event(
        actor=user,
        action="cancel_material_process",
        entity=process,
        details={"process_folio": process.folio, "reason": reason, "confirmed": was_confirmed},
    )
    return process
