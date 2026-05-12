from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.db import models

from apps.core.models import UUIDTimeStampedModel


class ProcessType(UUIDTimeStampedModel):
    code = models.SlugField(max_length=50, unique=True)
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    active = models.BooleanField(default=True)

    def __str__(self) -> str:
        return self.name


class MaterialProcess(UUIDTimeStampedModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Borrador"
        CONFIRMED = "confirmed", "Confirmado"
        CANCELLED = "cancelled", "Cancelado"

    folio = models.CharField(max_length=50, unique=True, db_index=True)
    process_type = models.ForeignKey(ProcessType, on_delete=models.PROTECT, related_name="material_processes")
    collection_center = models.ForeignKey("parties.CollectionCenter", on_delete=models.PROTECT, related_name="material_processes")
    process_date = models.DateTimeField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="created_material_processes")
    confirmed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="confirmed_material_processes")
    confirmed_at = models.DateTimeField(null=True, blank=True)
    canceled_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="cancelled_material_processes")
    canceled_at = models.DateTimeField(null=True, blank=True)
    cancellation_reason = models.TextField(blank=True)

    def __str__(self) -> str:
        return self.folio


class MaterialProcessInput(UUIDTimeStampedModel):
    process = models.ForeignKey(MaterialProcess, on_delete=models.CASCADE, related_name="inputs")
    material = models.ForeignKey("materials.Material", on_delete=models.PROTECT, related_name="process_inputs")
    quantity = models.DecimalField(max_digits=12, decimal_places=3)
    unit = models.CharField(max_length=20, default="kg")
    source_inventory_reference = models.CharField(max_length=120, blank=True)

    def __str__(self) -> str:
        return f"{self.process.folio} - {self.material}"


class MaterialProcessOutput(UUIDTimeStampedModel):
    process = models.ForeignKey(MaterialProcess, on_delete=models.CASCADE, related_name="outputs")
    material = models.ForeignKey("materials.Material", on_delete=models.PROTECT, related_name="process_outputs")
    quantity = models.DecimalField(max_digits=12, decimal_places=3)
    unit = models.CharField(max_length=20, default="kg")
    lot_code = models.CharField(max_length=80, blank=True, db_index=True)

    def __str__(self) -> str:
        return f"{self.process.folio} - {self.material}"


class MaterialProcessWaste(UUIDTimeStampedModel):
    class WasteType(models.TextChoices):
        MERMA = "merma", "Merma"
        WASTE = "waste", "Desperdicio"
        LOSS = "loss", "Pérdida"

    process = models.ForeignKey(MaterialProcess, on_delete=models.CASCADE, related_name="wastes")
    material = models.ForeignKey("materials.Material", on_delete=models.SET_NULL, null=True, blank=True, related_name="process_wastes")
    waste_type = models.CharField(max_length=20, choices=WasteType.choices, default=WasteType.MERMA)
    quantity = models.DecimalField(max_digits=12, decimal_places=3)
    unit = models.CharField(max_length=20, default="kg")
    notes = models.TextField(blank=True)

    def __str__(self) -> str:
        return f"{self.process.folio} - {self.waste_type}"
