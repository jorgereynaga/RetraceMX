from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.db import models

from apps.core.models import UUIDTimeStampedModel


class SaleOrder(UUIDTimeStampedModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        CONFIRMED = "confirmed", "Confirmed"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    folio = models.CharField(max_length=50, unique=True, db_index=True)
    collection_center = models.ForeignKey("parties.CollectionCenter", on_delete=models.PROTECT, related_name="sale_orders")
    buyer = models.ForeignKey("parties.PersonOrCompany", on_delete=models.PROTECT, related_name="sale_orders")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    total_weight_kg = models.DecimalField(max_digits=12, decimal_places=3, default=Decimal("0"))
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    total_cost = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    total_profit = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    notes = models.TextField(blank=True)
    sold_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="sale_orders")

    def __str__(self) -> str:
        return self.folio


class SaleItem(UUIDTimeStampedModel):
    sale_order = models.ForeignKey(SaleOrder, on_delete=models.CASCADE, related_name="items")
    material = models.ForeignKey("materials.Material", on_delete=models.PROTECT, related_name="sale_items")
    quantity_kg = models.DecimalField(max_digits=12, decimal_places=3)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    estimated_cost = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    profit = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    notes = models.TextField(blank=True)
    inventory_movement = models.OneToOneField("inventory.InventoryMovement", on_delete=models.SET_NULL, null=True, blank=True, related_name="sale_item_link")

    def __str__(self) -> str:
        return f"{self.sale_order.folio} - {self.material}"

