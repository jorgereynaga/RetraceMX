from __future__ import annotations

from django.db import models

from apps.core.models import UUIDTimeStampedModel


class WeighingSession(UUIDTimeStampedModel):
    class Kind(models.TextChoices):
        VEHICLE = "vehicle", "Vehicle"
        SECONDARY = "secondary", "Secondary"

    collection_center = models.ForeignKey("parties.CollectionCenter", on_delete=models.PROTECT, related_name="weighing_sessions")
    operation = models.ForeignKey("operations.PurchaseOperation", on_delete=models.CASCADE, related_name="weighing_sessions", null=True, blank=True)
    device = models.ForeignKey("devices.Device", on_delete=models.PROTECT, related_name="weighing_sessions")
    vehicle = models.ForeignKey("parties.Vehicle", on_delete=models.PROTECT, related_name="weighing_sessions", null=True, blank=True)
    kind = models.CharField(max_length=20, choices=Kind.choices)
    status = models.CharField(max_length=30, default="open")
    manual_entry = models.BooleanField(default=False)
    notes = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    started_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)

    def __str__(self) -> str:
        return f"{self.kind} - {self.collection_center}"


class ScaleReading(UUIDTimeStampedModel):
    class ReadingType(models.TextChoices):
        GROSS = "gross", "Gross"
        TARE = "tare", "Tare"
        DIRECT = "direct", "Direct"
        MANUAL = "manual", "Manual"
        CONTINGENCY = "contingency", "Contingency"

    session = models.ForeignKey(WeighingSession, on_delete=models.CASCADE, related_name="readings")
    device = models.ForeignKey("devices.Device", on_delete=models.PROTECT, related_name="scale_readings")
    reading_type = models.CharField(max_length=20, choices=ReadingType.choices)
    gross_weight_kg = models.DecimalField(max_digits=12, decimal_places=3, null=True, blank=True)
    tare_weight_kg = models.DecimalField(max_digits=12, decimal_places=3, null=True, blank=True)
    net_weight_kg = models.DecimalField(max_digits=12, decimal_places=3, null=True, blank=True)
    raw_value = models.CharField(max_length=120, blank=True)
    is_stable = models.BooleanField(default=True)
    is_manual = models.BooleanField(default=False)
    note = models.TextField(blank=True)
    captured_at = models.DateTimeField(auto_now_add=True)

