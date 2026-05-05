from __future__ import annotations

from django.conf import settings
from django.db import models

from apps.core.models import UUIDTimeStampedModel


class Payment(UUIDTimeStampedModel):
    class Method(models.TextChoices):
        CASH = "cash", "Cash"
        TRANSFER = "transfer", "Transfer"
        CARD = "card", "Card"
        CHEQUE = "cheque", "Cheque"
        VOUCHER = "voucher", "Voucher"
        CREDIT = "credit", "Credit"
        OTHER = "other", "Other"

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        CANCELLED = "cancelled", "Cancelled"

    folio = models.CharField(max_length=50, unique=True, db_index=True, null=True, blank=True)
    operation = models.ForeignKey("operations.PurchaseOperation", on_delete=models.CASCADE, related_name="payments")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    received_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    change_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    method = models.CharField(max_length=20, choices=Method.choices, default=Method.CASH)
    received_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="received_payments")
    reference = models.CharField(max_length=120, blank=True)
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancelled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="cancelled_payments",
    )
    cancel_reason = models.TextField(blank=True)
    paid_at = models.DateTimeField(auto_now_add=True)
