from __future__ import annotations

import uuid

from django.db import models


class UUIDModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class UUIDTimeStampedModel(UUIDModel, TimeStampedModel):
    class Meta:
        abstract = True


class StatusChoices(models.TextChoices):
    DRAFT = "draft", "Draft"
    OPEN = "open", "Open"
    PENDING = "pending", "Pending"
    REGISTERED = "registered", "Registered"
    CONFIRMED = "confirmed", "Confirmed"
    COMPLETED = "completed", "Completed"
    CANCELLED = "cancelled", "Cancelled"
    PAID = "paid", "Paid"
    PRINTED = "printed", "Printed"

