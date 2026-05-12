from __future__ import annotations

from decimal import Decimal

from django.db import transaction

from apps.auditing.services import register_audit_event
from apps.operations.models import PurchaseOperation

from .models import InventoryMovement


INBOUND_TYPES = {
    InventoryMovement.MovementType.INBOUND,
    InventoryMovement.MovementType.PURCHASE_IN,
    InventoryMovement.MovementType.PROCESS_OUTPUT_IN,
    InventoryMovement.MovementType.MANUAL_ADJUSTMENT_IN,
    InventoryMovement.MovementType.TRANSFER_IN,
}

OUTBOUND_TYPES = {
    InventoryMovement.MovementType.OUTBOUND,
    InventoryMovement.MovementType.SALE_OUT,
    InventoryMovement.MovementType.PROCESS_INPUT_OUT,
    InventoryMovement.MovementType.PROCESS_WASTE_OUT,
    InventoryMovement.MovementType.MANUAL_ADJUSTMENT_OUT,
    InventoryMovement.MovementType.TRANSFER_OUT,
}

ADJUSTMENT_TYPES = {
    InventoryMovement.MovementType.ADJUSTMENT,
}


def get_available_stock(*, material, collection_center) -> Decimal:
    movements = InventoryMovement.objects.filter(material=material, collection_center=collection_center)
    total = Decimal("0")
    for movement in movements:
        quantity = Decimal(movement.quantity_kg or 0)
        if movement.movement_type in INBOUND_TYPES:
            total += quantity
        elif movement.movement_type in OUTBOUND_TYPES:
            total -= quantity
        elif movement.movement_type in ADJUSTMENT_TYPES:
            total += quantity
        else:
            total += quantity
    return total


@transaction.atomic
def create_inventory_movement(
    *,
    ticket_item=None,
    user=None,
    movement_type=InventoryMovement.MovementType.INBOUND,
    operation=None,
    sale_order=None,
    sale_item=None,
    process=None,
    process_input=None,
    process_output=None,
    process_waste=None,
    lot_code="",
    material=None,
    collection_center=None,
    quantity_kg=None,
    unit_price=None,
    amount=None,
    notes="",
    source_reference="",
) -> InventoryMovement:
    if ticket_item is not None:
        operation = operation or ticket_item.operation
        material = material or ticket_item.material
        collection_center = collection_center or ticket_item.operation.collection_center
        quantity_kg = ticket_item.net_weight_kg if quantity_kg is None else quantity_kg
        unit_price = ticket_item.unit_price if unit_price is None else unit_price
        amount = ticket_item.amount if amount is None else amount
        notes = notes or ticket_item.notes
        source_reference = source_reference or ticket_item.operation.folio
    if sale_order is not None and not source_reference:
        source_reference = sale_order.folio
    if operation is not None and not source_reference:
        source_reference = operation.folio
    if process_output is not None and not lot_code:
        lot_code = getattr(process_output, "lot_code", "")
        if not lot_code and process is not None:
            lot_code = process.folio
    if sale_item is not None and not lot_code:
        lot_code = getattr(sale_item, "lot_code", "") or source_reference

    movement = InventoryMovement.objects.create(
        operation=operation,
        ticket_item=ticket_item,
        sale_order=sale_order,
        sale_item=sale_item,
        process=process,
        process_input=process_input,
        process_output=process_output,
        process_waste=process_waste,
        lot_code=lot_code,
        material=material,
        collection_center=collection_center,
        movement_type=movement_type,
        quantity_kg=quantity_kg,
        unit_price=unit_price,
        amount=amount,
        source_reference=source_reference,
        created_by=user,
        notes=notes,
    )
    register_audit_event(actor=user, action="create_inventory_movement", entity=movement, details={"movement_type": movement_type, "quantity_kg": str(quantity_kg)})
    return movement


@transaction.atomic
def post_operation_inventory(*, operation, user=None) -> list[InventoryMovement]:
    """
    Materializa el inventario de una compra ya pagada.
    Si la operación no está pagada, no registra nada.
    """
    from apps.operations.models import TicketItem

    if operation.payment_status != PurchaseOperation.PaymentStatus.PAID:
        return []

    created_movements: list[InventoryMovement] = []
    confirmed_items = operation.items.filter(status=TicketItem.Status.CONFIRMED).select_related("material")
    for item in confirmed_items:
        movement = item.inventory_movements.order_by("occurred_at").first()
        if movement:
            movement.material = item.material
            movement.collection_center = operation.collection_center
            movement.movement_type = InventoryMovement.MovementType.PURCHASE_IN
            movement.quantity_kg = item.net_weight_kg
            movement.unit_price = item.unit_price
            movement.amount = item.amount
            movement.notes = item.notes
            movement.lot_code = movement.lot_code or item.operation.folio
            movement.save(update_fields=["material", "collection_center", "movement_type", "quantity_kg", "unit_price", "amount", "notes", "lot_code", "updated_at"])
            continue
        created_movements.append(
            create_inventory_movement(
                ticket_item=item,
                user=user,
                movement_type=InventoryMovement.MovementType.PURCHASE_IN,
                source_reference=operation.folio,
            )
        )

    register_audit_event(
        actor=user,
        action="post_operation_inventory",
        entity=operation,
        details={"operation_folio": operation.folio, "items_count": confirmed_items.count(), "movements_created": len(created_movements)},
    )
    return created_movements


@transaction.atomic
def retract_operation_inventory(*, operation, user=None, reason: str = "") -> int:
    """
    Elimina movimientos de inventario asociados a una compra que dejó de estar pagada.
    """
    movements = list(InventoryMovement.objects.filter(operation=operation).select_related("material", "collection_center"))
    for movement in movements:
        register_audit_event(
            actor=user,
            action="delete_inventory_movement",
            entity=movement,
            details={
                "reason": reason or "operation_no_longer_paid",
                "operation_folio": operation.folio,
                "movement_type": movement.movement_type,
                "quantity_kg": str(movement.quantity_kg),
            },
        )
        movement.delete()

    if movements:
        register_audit_event(
            actor=user,
            action="retract_operation_inventory",
            entity=operation,
            details={"operation_folio": operation.folio, "movements_deleted": len(movements), "reason": reason},
        )
    return len(movements)
