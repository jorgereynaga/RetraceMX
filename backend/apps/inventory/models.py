from __future__ import annotations

from django.conf import settings
from django.db import models

from apps.core.models import UUIDTimeStampedModel


class InventoryMovement(UUIDTimeStampedModel):
    class MovementType(models.TextChoices):
        INBOUND = "inbound", "Inbound"
        OUTBOUND = "outbound", "Outbound"
        ADJUSTMENT = "adjustment", "Adjustment"

    operation = models.ForeignKey("operations.PurchaseOperation", on_delete=models.SET_NULL, null=True, blank=True, related_name="inventory_movements")
    ticket_item = models.ForeignKey("operations.TicketItem", on_delete=models.SET_NULL, null=True, blank=True, related_name="inventory_movements")
    sale_order = models.ForeignKey("commercialization.SaleOrder", on_delete=models.SET_NULL, null=True, blank=True, related_name="inventory_movements")
    sale_item = models.ForeignKey("commercialization.SaleItem", on_delete=models.SET_NULL, null=True, blank=True, related_name="inventory_movements")
    material = models.ForeignKey("materials.Material", on_delete=models.PROTECT, related_name="inventory_movements")
    collection_center = models.ForeignKey("parties.CollectionCenter", on_delete=models.PROTECT, related_name="inventory_movements")
    movement_type = models.CharField(max_length=20, choices=MovementType.choices, default=MovementType.INBOUND)
    quantity_kg = models.DecimalField(max_digits=12, decimal_places=3)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="inventory_movements")
    occurred_at = models.DateTimeField(auto_now_add=True)
