from __future__ import annotations

from django.db import transaction
from decimal import Decimal

from apps.auditing.services import register_audit_event

from .models import InventoryMovement


@transaction.atomic
def create_inventory_movement(
    *,
    ticket_item=None,
    user=None,
    movement_type=InventoryMovement.MovementType.INBOUND,
    operation=None,
    sale_order=None,
    sale_item=None,
    material=None,
    collection_center=None,
    quantity_kg=None,
    unit_price=None,
    amount=None,
    notes="",
) -> InventoryMovement:
    if ticket_item is not None:
        operation = operation or ticket_item.operation
        material = material or ticket_item.material
        collection_center = collection_center or ticket_item.operation.collection_center
        quantity_kg = ticket_item.net_weight_kg if quantity_kg is None else quantity_kg
        unit_price = ticket_item.unit_price if unit_price is None else unit_price
        amount = ticket_item.amount if amount is None else amount
        notes = notes or ticket_item.notes

    movement = InventoryMovement.objects.create(
        operation=operation,
        ticket_item=ticket_item,
        sale_order=sale_order,
        sale_item=sale_item,
        material=material,
        collection_center=collection_center,
        movement_type=movement_type,
        quantity_kg=quantity_kg,
        unit_price=unit_price,
        amount=amount,
        created_by=user,
        notes=notes,
    )
    register_audit_event(actor=user, action="create_inventory_movement", entity=movement, details={"movement_type": movement_type, "quantity_kg": str(quantity_kg)})
    return movement
