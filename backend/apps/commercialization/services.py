from __future__ import annotations

from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from apps.auditing.services import register_audit_event
from apps.core.utils import generate_folio
from apps.inventory.models import InventoryMovement
from apps.inventory.services import create_inventory_movement

from .models import SaleItem, SaleOrder, SalePayment


def get_available_stock(*, material, collection_center) -> Decimal:
    inbound = InventoryMovement.objects.filter(material=material, collection_center=collection_center, movement_type=InventoryMovement.MovementType.INBOUND).aggregate(total=Sum("quantity_kg"))["total"] or Decimal("0")
    adjustments = InventoryMovement.objects.filter(material=material, collection_center=collection_center, movement_type=InventoryMovement.MovementType.ADJUSTMENT).aggregate(total=Sum("quantity_kg"))["total"] or Decimal("0")
    outbound = InventoryMovement.objects.filter(material=material, collection_center=collection_center, movement_type=InventoryMovement.MovementType.OUTBOUND).aggregate(total=Sum("quantity_kg"))["total"] or Decimal("0")
    return Decimal(inbound) + Decimal(adjustments) - Decimal(outbound)


def estimate_material_cost(*, material, collection_center, quantity_kg: Decimal) -> Decimal:
    inbound_movements = InventoryMovement.objects.filter(
        material=material,
        collection_center=collection_center,
        movement_type__in=[InventoryMovement.MovementType.INBOUND, InventoryMovement.MovementType.ADJUSTMENT],
    )
    total_inbound_qty = sum((movement.quantity_kg for movement in inbound_movements), Decimal("0"))
    total_inbound_amount = sum((movement.amount for movement in inbound_movements), Decimal("0"))
    if total_inbound_qty <= 0:
        return Decimal("0")
    avg_cost = total_inbound_amount / total_inbound_qty
    return (Decimal(quantity_kg) * avg_cost).quantize(Decimal("0.01"))


def _buyer_type_snapshot(buyer) -> str:
    role_names = [role.name for role in buyer.commercial_roles.all()]
    if role_names:
        return ", ".join(role_names[:3])
    return buyer.get_kind_display() if hasattr(buyer, "get_kind_display") else ""


@transaction.atomic
def register_sale_order(
    *,
    collection_center,
    buyer,
    created_by,
    notes="",
    sale_type=SaleOrder.SaleType.DIRECT_WEIGHT,
    payment_terms=SaleOrder.PaymentTerms.CASH,
    destination_name="",
    transport_mode="",
    transport_operator="",
    transport_plates="",
    contract_reference="",
    negotiated_price_note="",
) -> SaleOrder:
    sale_order = SaleOrder.objects.create(
        folio=generate_folio("SV"),
        collection_center=collection_center,
        buyer=buyer,
        created_by=created_by,
        notes=notes,
        sale_type=sale_type,
        payment_terms=payment_terms,
        destination_name=destination_name,
        transport_mode=transport_mode,
        transport_operator=transport_operator,
        transport_plates=transport_plates,
        contract_reference=contract_reference,
        negotiated_price_note=negotiated_price_note,
        buyer_type_snapshot=_buyer_type_snapshot(buyer),
        status=SaleOrder.Status.DRAFT,
    )
    register_audit_event(actor=created_by, action="open_sale_order", entity=sale_order, details={"buyer": str(buyer.pk)})
    return sale_order


@transaction.atomic
def add_sale_item(
    *,
    sale_order: SaleOrder,
    material,
    quantity_kg,
    unit_price,
    notes="",
    user=None,
    presentation="",
    quality="",
    lot_code="",
    list_unit_price=None,
    price_override_reason="",
) -> SaleItem:
    if sale_order.status != SaleOrder.Status.DRAFT:
        raise ValidationError("Solo se pueden agregar partidas a una orden de venta en borrador.")
    quantity_kg = Decimal(quantity_kg)
    unit_price = Decimal(unit_price)
    available_stock = get_available_stock(material=material, collection_center=sale_order.collection_center)
    if quantity_kg <= 0:
        raise ValidationError("La cantidad vendida debe ser mayor a cero.")

    amount = (quantity_kg * unit_price).quantize(Decimal("0.01"))
    estimated_cost = estimate_material_cost(material=material, collection_center=sale_order.collection_center, quantity_kg=quantity_kg)
    profit = (amount - estimated_cost).quantize(Decimal("0.01"))

    sale_item = SaleItem.objects.create(
        sale_order=sale_order,
        material=material,
        presentation=presentation,
        quality=quality,
        lot_code=lot_code,
        quantity_kg=quantity_kg,
        list_unit_price=Decimal(list_unit_price if list_unit_price is not None else unit_price),
        unit_price=unit_price,
        amount=amount,
        estimated_cost=estimated_cost,
        profit=profit,
        price_override_reason=price_override_reason,
        notes=notes,
    )
    movement = create_inventory_movement(
        user=user,
        movement_type=InventoryMovement.MovementType.OUTBOUND,
        sale_order=sale_order,
        sale_item=sale_item,
        material=material,
        collection_center=sale_order.collection_center,
        quantity_kg=quantity_kg,
        unit_price=unit_price,
        amount=amount,
        notes=notes,
    )
    sale_item.inventory_movement = movement
    sale_item.save(update_fields=["inventory_movement", "updated_at"])
    register_audit_event(
        actor=user,
        action="add_sale_item",
        entity=sale_item,
        details={
            "quantity_kg": str(quantity_kg),
            "amount": str(amount),
            "available_stock_before": str(available_stock),
            "available_stock_after": str(available_stock - quantity_kg),
        },
    )
    recalculate_sale_order_total(sale_order)
    return sale_item


def recalculate_sale_order_total(sale_order: SaleOrder) -> SaleOrder:
    sale_items = sale_order.items.all()
    sale_order.total_weight_kg = sum((item.quantity_kg for item in sale_items), Decimal("0"))
    sale_order.total_amount = sum((item.amount for item in sale_items), Decimal("0")).quantize(Decimal("0.01"))
    sale_order.total_cost = sum((item.estimated_cost for item in sale_items), Decimal("0")).quantize(Decimal("0.01"))
    sale_order.total_profit = (sale_order.total_amount - sale_order.total_cost).quantize(Decimal("0.01"))
    sale_order.save(update_fields=["total_weight_kg", "total_amount", "total_cost", "total_profit", "updated_at"])
    return sale_order


@transaction.atomic
def close_sale_order(sale_order: SaleOrder, user=None) -> SaleOrder:
    if sale_order.status == SaleOrder.Status.CANCELLED:
        raise ValidationError("No se puede cerrar una venta cancelada.")
    if not sale_order.items.exists():
        raise ValidationError("No se puede cerrar una venta sin partidas.")
    pending_deliveries = sale_order.deliveries.exclude(status__in=["delivered", "cancelled"]).count()
    if pending_deliveries:
        raise ValidationError("No se puede cerrar una venta con entregas pendientes o rutas activas.")
    if sale_order.payment_terms == SaleOrder.PaymentTerms.CREDIT:
        sale_order.status = SaleOrder.Status.CREDIT
    else:
        sale_order.status = SaleOrder.Status.COMPLETED
    sale_order.sold_at = timezone.now()
    sale_order.save(update_fields=["status", "sold_at", "updated_at"])
    register_audit_event(actor=user, action="close_sale_order", entity=sale_order, details={"total_amount": str(sale_order.total_amount)})
    return sale_order


def calculate_sale_paid_amount(sale_order) -> Decimal:
    active_payments = sale_order.payments.exclude(status=SalePayment.Status.CANCELLED)
    return sum((payment.amount for payment in active_payments), Decimal("0"))


@transaction.atomic
def register_sale_payment(
    *,
    sale_order,
    amount=None,
    method,
    received_by,
    reference="",
    notes="",
    received_amount=None,
    applied_amount=None,
) -> SalePayment:
    if sale_order.status == SaleOrder.Status.CANCELLED:
        raise ValidationError("No se puede registrar un pago en una venta cancelada.")
    if not sale_order.items.exists():
        raise ValidationError("No se puede registrar un pago sin partidas.")

    current_paid = calculate_sale_paid_amount(sale_order)
    pending_before = max(Decimal(sale_order.total_amount) - current_paid, Decimal("0"))
    if pending_before <= 0:
        raise ValidationError("La venta ya no tiene saldo pendiente.")

    method_value = str(method)
    allowed_methods = {choice[0] for choice in SalePayment.Method.choices}
    if method_value not in allowed_methods:
        raise ValidationError("Metodo de pago invalido.")

    cash_method = method_value == SalePayment.Method.CASH
    reference_required_methods = {SalePayment.Method.TRANSFER, SalePayment.Method.CARD, SalePayment.Method.CHEQUE, SalePayment.Method.VOUCHER}
    if method_value in reference_required_methods and not str(reference).strip():
        raise ValidationError("Este metodo de pago requiere una referencia.")

    if amount is not None:
        if cash_method and received_amount is None:
            received_amount = amount
        elif applied_amount is None:
            applied_amount = amount

    if cash_method:
        if received_amount is None:
            raise ValidationError("El monto recibido es obligatorio para pagos en efectivo.")
        received = Decimal(received_amount)
        if received <= 0:
            raise ValidationError("El monto recibido debe ser mayor a cero.")
        applied = min(received, pending_before)
        change = max(received - pending_before, Decimal("0")) if received >= pending_before else Decimal("0")
    else:
        if applied_amount is None:
            raise ValidationError("El monto aplicado es obligatorio para este metodo de pago.")
        applied = Decimal(applied_amount)
        if applied <= 0:
            raise ValidationError("El monto aplicado debe ser mayor a cero.")
        if applied > pending_before:
            raise ValidationError("El monto aplicado no puede exceder el saldo pendiente.")
        received = applied
        change = Decimal("0")

    payment = SalePayment.objects.create(
        folio=generate_folio("SP"),
        sale_order=sale_order,
        amount=applied,
        received_amount=received,
        change_amount=change,
        method=method_value,
        received_by=received_by,
        reference=reference,
        notes=notes,
    )
    register_audit_event(
        actor=received_by,
        action="register_sale_payment",
        entity=payment,
        details={
            "amount": str(applied),
            "received_amount": str(received),
            "change_amount": str(change),
            "method": method_value,
            "reference": reference,
            "sale_folio": sale_order.folio,
        },
    )
    return payment


@transaction.atomic
def cancel_sale_payment(*, payment: SalePayment, user, reason: str = "") -> SalePayment:
    if payment.status == SalePayment.Status.CANCELLED:
        return payment
    payment.status = SalePayment.Status.CANCELLED
    payment.cancelled_at = timezone.now()
    payment.cancelled_by = user
    payment.cancel_reason = reason
    payment.save(update_fields=["status", "cancelled_at", "cancelled_by", "cancel_reason", "updated_at"])
    register_audit_event(
        actor=user,
        action="cancel_sale_payment",
        entity=payment,
        details={"reason": reason, "payment_folio": payment.folio, "sale_folio": payment.sale_order.folio},
    )
    return payment
