from __future__ import annotations

from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.auditing.services import register_audit_event
from apps.core.utils import generate_folio
from apps.devices.models import Device
from apps.inventory.models import InventoryMovement
from apps.payments.services import calculate_paid_amount, sync_payment_status
from apps.weighing.models import WeighingSession

from .models import PurchaseOperation, TicketItem


def apply_tare_or_merma(weight_kg: Decimal, merma_kg: Decimal) -> Decimal:
    net_weight = Decimal(weight_kg) - Decimal(merma_kg)
    if net_weight < 0:
        raise ValidationError("El peso neto no puede ser negativo.")
    return net_weight


def calculate_ticket_item_amount(ticket_item: TicketItem) -> Decimal:
    net_weight = Decimal(ticket_item.net_weight_kg or 0)
    price = Decimal(ticket_item.unit_price or 0)
    amount = (net_weight * price).quantize(Decimal("0.01"))
    ticket_item.amount = amount
    ticket_item.save(update_fields=["amount", "updated_at"])
    return amount


def recalculate_operation_total(operation: PurchaseOperation) -> PurchaseOperation:
    items = operation.items.exclude(status=TicketItem.Status.VOID)
    operation.total_weight_kg = sum((item.net_weight_kg for item in items), Decimal("0"))
    operation.total_merma_kg = sum((item.merma_kg for item in items), Decimal("0"))
    operation.total_amount = sum((item.amount for item in items), Decimal("0")).quantize(Decimal("0.01"))
    operation.save(update_fields=["total_weight_kg", "total_merma_kg", "total_amount", "updated_at"])
    return operation


def calculate_operation_balance(operation: PurchaseOperation) -> tuple[Decimal, Decimal]:
    paid_amount = calculate_paid_amount(operation)
    pending_amount = max(Decimal(operation.total_amount) - paid_amount, Decimal("0"))
    return paid_amount, pending_amount


@transaction.atomic
def open_purchase_operation(*, collection_center, customer, opened_by, route=None, vehicle=None, driver=None, source="purchase", notes="") -> PurchaseOperation:
    operation = PurchaseOperation.objects.create(
        folio=generate_folio("OP"),
        collection_center=collection_center,
        customer=customer,
        route=route,
        vehicle=vehicle,
        driver=driver,
        opened_by=opened_by,
        source=source,
        notes=notes,
        status=PurchaseOperation.Status.OPEN,
    )
    if vehicle:
        scale_device = Device.objects.filter(
            collection_center=collection_center,
            kind=Device.Kind.VEHICLE_SCALE,
        ).first()
        if scale_device:
            WeighingSession.objects.create(
                collection_center=collection_center,
                operation=operation,
                device=scale_device,
                vehicle=vehicle,
                kind=WeighingSession.Kind.VEHICLE,
            )
    register_audit_event(actor=opened_by, action="open_purchase_operation", entity=operation, details={"source": source})
    return operation


@transaction.atomic
def change_operation_status(
    operation: PurchaseOperation,
    new_status: str,
    user=None,
    reason: str = "",
    close_reason: str = "",
    close_notes: str = "",
    close_authorized_by=None,
    close_recognized_pending_amount: Decimal | None = None,
) -> PurchaseOperation:
    valid_transitions = {
        PurchaseOperation.Status.DRAFT: {PurchaseOperation.Status.OPEN, PurchaseOperation.Status.CANCELLED},
        PurchaseOperation.Status.OPEN: {PurchaseOperation.Status.REGISTERED, PurchaseOperation.Status.CONFIRMED, PurchaseOperation.Status.CANCELLED},
        PurchaseOperation.Status.REGISTERED: {PurchaseOperation.Status.CONFIRMED, PurchaseOperation.Status.COMPLETED, PurchaseOperation.Status.CANCELLED},
        PurchaseOperation.Status.CONFIRMED: {PurchaseOperation.Status.COMPLETED, PurchaseOperation.Status.CANCELLED},
        PurchaseOperation.Status.COMPLETED: set(),
        PurchaseOperation.Status.CANCELLED: set(),
    }
    if new_status not in valid_transitions.get(operation.status, set()):
        raise ValidationError(f"No es posible cambiar de {operation.status} a {new_status}.")
    if new_status == PurchaseOperation.Status.CONFIRMED and operation.payment_status != PurchaseOperation.PaymentStatus.PAID:
        raise ValidationError("La compra solo puede confirmarse cuando esta pagada por completo.")
    if new_status == PurchaseOperation.Status.CANCELLED:
        active_payments = operation.payments.exclude(status__exact="cancelled").exists()
        if operation.payment_status != PurchaseOperation.PaymentStatus.PENDING or active_payments:
            raise ValidationError("No se puede cancelar una compra con pago registrado.")
    if new_status == PurchaseOperation.Status.COMPLETED and operation.payment_status != PurchaseOperation.PaymentStatus.PAID:
        if not getattr(user, "is_staff", False) and not getattr(user, "is_superuser", False):
            raise ValidationError("La operacion no puede cerrarse sin estar pagada por completo.")
    operation.status = new_status
    now = timezone.now()
    if new_status == PurchaseOperation.Status.CONFIRMED:
        operation.confirmed_at = now
    elif new_status == PurchaseOperation.Status.COMPLETED:
        operation.completed_at = now
        operation.closed_by = user
        paid_amount, pending_amount = calculate_operation_balance(operation)
        if operation.payment_status != PurchaseOperation.PaymentStatus.PAID:
            operation.close_authorized_by = close_authorized_by or user
            operation.close_authorized_at = now
            operation.close_authorization_reason = close_reason or reason
            operation.close_authorization_notes = close_notes
            operation.close_recognized_pending_amount = close_recognized_pending_amount if close_recognized_pending_amount is not None else pending_amount
        else:
            operation.close_authorized_by = None
            operation.close_authorized_at = None
            operation.close_authorization_reason = ""
            operation.close_authorization_notes = ""
            operation.close_recognized_pending_amount = Decimal("0")
    elif new_status == PurchaseOperation.Status.CANCELLED:
        operation.cancelled_at = now
        operation.closed_by = user
    operation.save(
        update_fields=[
            "status",
            "confirmed_at",
            "completed_at",
            "cancelled_at",
            "closed_by",
            "close_authorized_by",
            "close_authorized_at",
            "close_authorization_reason",
            "close_authorization_notes",
            "close_recognized_pending_amount",
            "updated_at",
        ]
    )
    closing_statuses = {PurchaseOperation.Status.CONFIRMED, PurchaseOperation.Status.COMPLETED, PurchaseOperation.Status.CANCELLED}
    if new_status in closing_statuses:
        operation.weighing_sessions.filter(status=WeighingSession.Status.OPEN).update(status=WeighingSession.Status.CLOSED, ended_at=now)
    register_audit_event(
        actor=user,
        action="change_operation_status",
        entity=operation,
        details={
            "status": new_status,
            "reason": reason,
            "close_reason": close_reason,
            "close_notes": close_notes,
            "close_authorized_by": str(close_authorized_by) if close_authorized_by else None,
            "close_recognized_pending_amount": str(close_recognized_pending_amount) if close_recognized_pending_amount is not None else None,
        },
    )
    return operation


@transaction.atomic
def register_ticket_item(*, operation: PurchaseOperation, material, method: str, unit_price, gross_weight_kg, tare_weight_kg=0, merma_kg=0, net_weight_kg=None, weighing_session=None, scale_reading=None, user=None, notes="") -> TicketItem:
    if net_weight_kg is None:
        if method == TicketItem.Method.VEHICLE_DIFFERENTIAL:
            from apps.weighing.services import calculate_differential_weight

            net_weight_kg = calculate_differential_weight(Decimal(gross_weight_kg), Decimal(tare_weight_kg))
        else:
            net_weight_kg = Decimal(gross_weight_kg)
    net_weight_kg = apply_tare_or_merma(Decimal(net_weight_kg), Decimal(merma_kg))
    item = TicketItem.objects.create(
        operation=operation,
        material=material,
        method=method,
        unit_price=unit_price,
        gross_weight_kg=gross_weight_kg,
        tare_weight_kg=tare_weight_kg,
        net_weight_kg=net_weight_kg,
        merma_kg=merma_kg,
        weighing_session=weighing_session,
        scale_reading=scale_reading,
        notes=notes,
        status=TicketItem.Status.CONFIRMED,
        confirmed_by=user,
        confirmed_at=timezone.now(),
    )
    calculate_ticket_item_amount(item)
    recalculate_operation_total(operation)
    register_audit_event(actor=user, action="confirm_ticket_item", entity=item, details={"method": method, "net_weight_kg": str(net_weight_kg)})
    return item


def _ticket_item_snapshot(item: TicketItem) -> dict:
    return {
        "material_id": str(item.material_id),
        "material_name": str(item.material),
        "method": item.method,
        "gross_weight_kg": str(item.gross_weight_kg),
        "tare_weight_kg": str(item.tare_weight_kg),
        "net_weight_kg": str(item.net_weight_kg),
        "merma_kg": str(item.merma_kg),
        "unit_price": str(item.unit_price),
        "amount": str(item.amount),
        "notes": item.notes,
    }


@transaction.atomic
def update_ticket_item(
    *,
    ticket_item: TicketItem,
    user=None,
    material=None,
    method: str | None = None,
    unit_price=None,
    gross_weight_kg=None,
    tare_weight_kg=None,
    merma_kg=None,
    notes: str | None = None,
    reason: str = "",
    after_print: bool = False,
) -> TicketItem:
    operation = ticket_item.operation
    if operation.status in {PurchaseOperation.Status.COMPLETED, PurchaseOperation.Status.CANCELLED}:
        raise ValidationError("No se puede modificar una partida de una operacion cerrada o cancelada.")
    if operation.print_status != PurchaseOperation.PrintStatus.PENDING and not after_print:
        raise ValidationError("La partida ya fue impresa. Usa el ajuste posterior.")
    before = _ticket_item_snapshot(ticket_item)
    previous_quantity = Decimal(ticket_item.net_weight_kg or 0)
    previous_amount = Decimal(ticket_item.amount or 0)

    if material is not None:
        ticket_item.material = material
    if method is not None:
        ticket_item.method = method
    if gross_weight_kg is not None:
        ticket_item.gross_weight_kg = gross_weight_kg
    if tare_weight_kg is not None:
        ticket_item.tare_weight_kg = tare_weight_kg
    if merma_kg is not None:
        ticket_item.merma_kg = merma_kg
    if unit_price is not None:
        ticket_item.unit_price = unit_price
    if notes is not None:
        ticket_item.notes = notes

    if ticket_item.method == TicketItem.Method.VEHICLE_DIFFERENTIAL:
        base_weight = Decimal(ticket_item.gross_weight_kg) - Decimal(ticket_item.tare_weight_kg)
    else:
        base_weight = Decimal(ticket_item.gross_weight_kg)
    ticket_item.net_weight_kg = apply_tare_or_merma(base_weight, Decimal(ticket_item.merma_kg))
    calculate_ticket_item_amount(ticket_item)
    ticket_item.save(
        update_fields=[
            "material",
            "method",
            "gross_weight_kg",
            "tare_weight_kg",
            "net_weight_kg",
            "merma_kg",
            "unit_price",
            "amount",
            "notes",
            "updated_at",
        ]
    )

    movement = ticket_item.inventory_movements.order_by("occurred_at").first()
    operation_paid = operation.payment_status == PurchaseOperation.PaymentStatus.PAID
    if operation_paid:
        if movement and not after_print:
            movement.material = ticket_item.material
            movement.collection_center = operation.collection_center
            movement.quantity_kg = ticket_item.net_weight_kg
            movement.unit_price = ticket_item.unit_price
            movement.amount = ticket_item.amount
            movement.notes = ticket_item.notes
            movement.save(update_fields=["material", "collection_center", "quantity_kg", "unit_price", "amount", "notes", "updated_at"])
        else:
            delta_quantity = ticket_item.net_weight_kg - previous_quantity if movement else ticket_item.net_weight_kg
            delta_amount = ticket_item.amount - previous_amount if movement else ticket_item.amount
            from apps.inventory.services import create_inventory_movement

            create_inventory_movement(
                ticket_item=ticket_item,
                user=user,
                movement_type=InventoryMovement.MovementType.ADJUSTMENT if after_print else InventoryMovement.MovementType.INBOUND,
                material=ticket_item.material,
                collection_center=operation.collection_center,
                quantity_kg=delta_quantity,
                unit_price=ticket_item.unit_price,
                amount=delta_amount,
                notes=reason or ticket_item.notes,
            )

    recalculate_operation_total(operation)
    sync_payment_status(operation)
    if after_print:
        operation.print_status = PurchaseOperation.PrintStatus.REPRINTED
        operation.save(update_fields=["print_status", "updated_at"])

    register_audit_event(
        actor=user,
        action="adjust_ticket_item_after_print" if after_print else "edit_ticket_item_before_print",
        entity=ticket_item,
        details={"reason": reason, "before": before, "after": _ticket_item_snapshot(ticket_item), "after_print": after_print},
    )
    return ticket_item


def calculate_total_paid(operation: PurchaseOperation):
    return sum((payment.amount for payment in operation.payments.all()), Decimal("0"))


@transaction.atomic
def sync_operation_payment_status(operation: PurchaseOperation) -> PurchaseOperation:
    sync_payment_status(operation)
    return operation
