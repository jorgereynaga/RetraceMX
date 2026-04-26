from __future__ import annotations

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from apps.core.models import UUIDTimeStampedModel


class MaterialFamily(UUIDTimeStampedModel):
    code = models.SlugField(max_length=50, unique=True)
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    operational_classification = models.CharField(max_length=120, blank=True)
    possible_valuation = models.BooleanField(default=True)
    special_review = models.BooleanField(default=False)

    def __str__(self) -> str:
        return self.name


class Material(UUIDTimeStampedModel):
    class Unit(models.TextChoices):
        KG = "kg", "Kilogram"
        TON = "ton", "Ton"
        PIECE = "piece", "Piece"

    code = models.SlugField(max_length=50, unique=True)
    name = models.CharField(max_length=120)
    family = models.ForeignKey(MaterialFamily, on_delete=models.PROTECT, related_name="materials")
    unit = models.CharField(max_length=20, choices=Unit.choices, default=Unit.KG)
    valuation_possible = models.BooleanField(default=True)
    is_hazard_auxiliary = models.BooleanField(default=False)
    requires_special_review = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    default_merma_pct = models.DecimalField(
        max_digits=5, decimal_places=4, null=True, blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(1)],
    )

    def __str__(self) -> str:
        return self.name


class PriceList(UUIDTimeStampedModel):
    code = models.SlugField(max_length=50, unique=True)
    name = models.CharField(max_length=120)
    collection_center = models.ForeignKey("parties.CollectionCenter", on_delete=models.PROTECT, related_name="price_lists")
    currency = models.CharField(max_length=8, default="MXN")
    valid_from = models.DateField()
    valid_to = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self) -> str:
        return self.name


class PriceListItem(UUIDTimeStampedModel):
    price_list = models.ForeignKey(PriceList, on_delete=models.CASCADE, related_name="items")
    material = models.ForeignKey(Material, on_delete=models.PROTECT, related_name="price_items")
    unit_price = models.DecimalField(max_digits=12, decimal_places=3)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ("price_list", "material")

