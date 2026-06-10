from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.db import models

from apps.core.models import UUIDTimeStampedModel


class PurchaseOperation(UUIDTimeStampedModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        OPEN = "open", "Open"
        REGISTERED = "registered", "Registered"
        CONFIRMED = "confirmed", "Confirmed"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    class PaymentStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        PARTIAL = "partial", "Partial"
        PAID = "paid", "Paid"

    class PrintStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        PRINTED = "printed", "Printed"
        REPRINTED = "reprinted", "Reprinted"

    folio = models.CharField(max_length=50, unique=True, db_index=True)
    collection_center = models.ForeignKey("parties.CollectionCenter", on_delete=models.PROTECT, related_name="purchase_operations")
    customer = models.ForeignKey("parties.PersonOrCompany", on_delete=models.PROTECT, related_name="purchase_operations")
    route = models.ForeignKey("logistics.Route", on_delete=models.SET_NULL, null=True, blank=True, related_name="purchase_operations")
    vehicle = models.ForeignKey("parties.Vehicle", on_delete=models.SET_NULL, null=True, blank=True, related_name="purchase_operations")
    driver = models.ForeignKey("parties.Driver", on_delete=models.SET_NULL, null=True, blank=True, related_name="purchase_operations")
    opened_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="opened_operations")
    closed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="closed_operations", null=True, blank=True)
    close_authorized_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="authorized_closures",
        null=True,
        blank=True,
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    payment_status = models.CharField(max_length=20, choices=PaymentStatus.choices, default=PaymentStatus.PENDING)
    print_status = models.CharField(max_length=20, choices=PrintStatus.choices, default=PrintStatus.PENDING)
    source = models.CharField(max_length=60, default="purchase")
    notes = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    total_weight_kg = models.DecimalField(max_digits=12, decimal_places=3, default=Decimal("0"))
    total_merma_kg = models.DecimalField(max_digits=12, decimal_places=3, default=Decimal("0"))
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    close_authorized_at = models.DateTimeField(null=True, blank=True)
    close_authorization_reason = models.TextField(blank=True)
    close_authorization_notes = models.TextField(blank=True)
    close_recognized_pending_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    confirmed_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)

    def __str__(self) -> str:
        return self.folio


class TicketItem(UUIDTimeStampedModel):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        CONFIRMED = "confirmed", "Confirmed"
        VOID = "void", "Void"

    class Method(models.TextChoices):
        VEHICLE_DIFFERENTIAL = "vehicle_differential", "Vehicle Differential"
        SECONDARY_DIRECT = "secondary_direct", "Secondary Direct"
        MANUAL_CONTINGENCY = "manual_contingency", "Manual Contingency"

    operation = models.ForeignKey(PurchaseOperation, on_delete=models.CASCADE, related_name="items")
    material = models.ForeignKey("materials.Material", on_delete=models.PROTECT, related_name="ticket_items")
    weighing_session = models.ForeignKey("weighing.WeighingSession", on_delete=models.SET_NULL, null=True, blank=True, related_name="ticket_items")
    scale_reading = models.ForeignKey("weighing.ScaleReading", on_delete=models.SET_NULL, null=True, blank=True, related_name="ticket_items")
    method = models.CharField(max_length=40, choices=Method.choices)
    gross_weight_kg = models.DecimalField(max_digits=12, decimal_places=3, default=Decimal("0"))
    tare_weight_kg = models.DecimalField(max_digits=12, decimal_places=3, default=Decimal("0"))
    net_weight_kg = models.DecimalField(max_digits=12, decimal_places=3, default=Decimal("0"))
    merma_kg = models.DecimalField(max_digits=12, decimal_places=3, default=Decimal("0"))
    unit_price = models.DecimalField(max_digits=12, decimal_places=5, default=Decimal("0"))
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    sort_order = models.PositiveIntegerField(default=0)
    notes = models.TextField(blank=True)
    confirmed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="confirmed_ticket_items")
    confirmed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self) -> str:
        return f"{self.operation.folio} - {self.material}"
