from __future__ import annotations

from django.db import models

from apps.core.models import UUIDTimeStampedModel


class Device(UUIDTimeStampedModel):
    class Kind(models.TextChoices):
        VEHICLE_SCALE = "vehicle_scale", "Vehicle Scale"
        SECONDARY_SCALE = "secondary_scale", "Secondary Scale"
        THERMAL_PRINTER = "thermal_printer", "Thermal Printer"

    name = models.CharField(max_length=120)
    identifier = models.CharField(max_length=120, unique=True)
    kind = models.CharField(max_length=50, choices=Kind.choices)
    port = models.CharField(max_length=120, blank=True)
    is_connected = models.BooleanField(default=False)
    is_stable = models.BooleanField(default=True)
    is_manual_fallback = models.BooleanField(default=False)
    metadata = models.JSONField(default=dict, blank=True)
    collection_center = models.ForeignKey("parties.CollectionCenter", on_delete=models.PROTECT, related_name="devices", null=True, blank=True)

    def __str__(self) -> str:
        return self.name

