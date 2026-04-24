from __future__ import annotations

from django.db import models

from apps.core.models import UUIDTimeStampedModel


class CommercialRole(UUIDTimeStampedModel):
    code = models.SlugField(max_length=50, unique=True)
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)

    def __str__(self) -> str:
        return self.name


class PersonOrCompany(UUIDTimeStampedModel):
    class Kind(models.TextChoices):
        PERSON = "person", "Person"
        COMPANY = "company", "Company"

    kind = models.CharField(max_length=20, choices=Kind.choices)
    legal_name = models.CharField(max_length=255)
    trade_name = models.CharField(max_length=255, blank=True)
    tax_id = models.CharField(max_length=32, blank=True, db_index=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=32, blank=True)
    address = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    commercial_roles = models.ManyToManyField(CommercialRole, blank=True, related_name="parties")
    is_active = models.BooleanField(default=True)

    def __str__(self) -> str:
        return self.trade_name or self.legal_name


class CollectionCenter(UUIDTimeStampedModel):
    class Kind(models.TextChoices):
        COLLECTION = "collection", "Centro de acopio"
        SMELTER = "smelter", "Fundidora"
        DESTINATION = "destination", "Destino"

    code = models.SlugField(max_length=50, unique=True)
    name = models.CharField(max_length=120)
    kind = models.CharField(max_length=20, choices=Kind.choices, default=Kind.COLLECTION)
    address = models.TextField(blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self) -> str:
        return self.name


class Vehicle(UUIDTimeStampedModel):
    plate_number = models.CharField(max_length=20, unique=True)
    label = models.CharField(max_length=120, blank=True)
    owner = models.ForeignKey(PersonOrCompany, on_delete=models.PROTECT, related_name="vehicles", null=True, blank=True)
    capacity_kg = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    expected_km_per_liter = models.DecimalField(max_digits=8, decimal_places=3, default=3)
    is_active = models.BooleanField(default=True)

    def __str__(self) -> str:
        return self.plate_number


class Driver(UUIDTimeStampedModel):
    person = models.OneToOneField(PersonOrCompany, on_delete=models.PROTECT, related_name="driver_profile")
    license_number = models.CharField(max_length=64, blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self) -> str:
        return str(self.person)
