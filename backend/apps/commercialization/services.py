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

from .models import SaleItem, SaleOrder


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


@transaction.atomic
def register_sale_order(*, collection_center, buyer, created_by, notes="") -> SaleOrder:
    sale_order = SaleOrder.objects.create(
        folio=generate_folio("SV"),
        collection_center=collection_center,
        buyer=buyer,
        created_by=created_by,
        notes=notes,
        status=SaleOrder.Status.DRAFT,
    )
    register_audit_event(actor=created_by, action="open_sale_order", entity=sale_order, details={"buyer": str(buyer.pk)})
    return sale_order


@transaction.atomic
def add_sale_item(*, sale_order: SaleOrder, material, quantity_kg, unit_price, notes="", user=None) -> SaleItem:
    if sale_order.status != SaleOrder.Status.DRAFT:
        raise ValidationError("Solo se pueden agregar partidas a una orden de venta en borrador.")
    quantity_kg = Decimal(quantity_kg)
    unit_price = Decimal(unit_price)
    available_stock = get_available_stock(material=material, collection_center=sale_order.collection_center)
    if quantity_kg <= 0:
        raise ValidationError("La cantidad vendida debe ser mayor a cero.")
    if quantity_kg > available_stock:
        raise ValidationError("No hay suficiente inventario disponible para esta venta.")

    amount = (quantity_kg * unit_price).quantize(Decimal("0.01"))
    estimated_cost = estimate_material_cost(material=material, collection_center=sale_order.collection_center, quantity_kg=quantity_kg)
    profit = (amount - estimated_cost).quantize(Decimal("0.01"))

    sale_item = SaleItem.objects.create(
        sale_order=sale_order,
        material=material,
        quantity_kg=quantity_kg,
        unit_price=unit_price,
        amount=amount,
        estimated_cost=estimated_cost,
        profit=profit,
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
    register_audit_event(actor=user, action="add_sale_item", entity=sale_item, details={"quantity_kg": str(quantity_kg), "amount": str(amount)})
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
    sale_order.status = SaleOrder.Status.COMPLETED
    sale_order.sold_at = timezone.now()
    sale_order.save(update_fields=["status", "sold_at", "updated_at"])
    register_audit_event(actor=user, action="close_sale_order", entity=sale_order, details={"total_amount": str(sale_order.total_amount)})
    return sale_order
