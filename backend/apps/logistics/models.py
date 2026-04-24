from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.db import models

from apps.core.models import UUIDTimeStampedModel


class Route(UUIDTimeStampedModel):
    code = models.SlugField(max_length=50, unique=True)
    name = models.CharField(max_length=120)
    origin_center = models.ForeignKey("parties.CollectionCenter", on_delete=models.PROTECT, related_name="origin_routes")
    destination_center = models.ForeignKey("parties.CollectionCenter", on_delete=models.PROTECT, related_name="destination_routes")
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self) -> str:
        return self.name


class CollectionTrip(UUIDTimeStampedModel):
    class Status(models.TextChoices):
        PLANNED = "planned", "Planned"
        DEPARTED = "departed", "Departed"
        ARRIVED = "arrived", "Arrived"
        CLOSED = "closed", "Closed"
        CANCELLED = "cancelled", "Cancelled"

    route = models.ForeignKey(Route, on_delete=models.PROTECT, related_name="collection_trips")
    origin_center = models.ForeignKey("parties.CollectionCenter", on_delete=models.PROTECT, related_name="origin_collection_trips")
    destination_center = models.ForeignKey("parties.CollectionCenter", on_delete=models.PROTECT, related_name="destination_collection_trips")
    vehicle = models.ForeignKey("parties.Vehicle", on_delete=models.SET_NULL, null=True, blank=True, related_name="collection_trips")
    driver = models.ForeignKey("parties.Driver", on_delete=models.SET_NULL, null=True, blank=True, related_name="collection_trips")
    operator = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="collection_trips")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PLANNED)
    planned_at = models.DateTimeField(auto_now_add=True)
    departed_at = models.DateTimeField(null=True, blank=True)
    arrived_at = models.DateTimeField(null=True, blank=True)
    estimated_distance_km = models.DecimalField(max_digits=12, decimal_places=3, default=Decimal("0"))
    odometer_start = models.DecimalField(max_digits=12, decimal_places=3, null=True, blank=True)
    odometer_end = models.DecimalField(max_digits=12, decimal_places=3, null=True, blank=True)
    geo_start_lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    geo_start_lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    geo_end_lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    geo_end_lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    telemetry_distance_km = models.DecimalField(max_digits=12, decimal_places=3, default=Decimal("0"))
    estimated_fuel_liters = models.DecimalField(max_digits=12, decimal_places=3, default=Decimal("0"))
    telemetry_points_count = models.PositiveIntegerField(default=0)
    last_telemetry_at = models.DateTimeField(null=True, blank=True)
    last_telemetry_lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    last_telemetry_lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    closed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="closed_collection_trips")
    closure_notes = models.TextField(blank=True)
    notes = models.TextField(blank=True)

    def __str__(self) -> str:
        return f"{self.route.code} - {self.status}"


class CollectionTripStop(UUIDTimeStampedModel):
    trip = models.ForeignKey(CollectionTrip, on_delete=models.CASCADE, related_name="stops")
    sequence = models.PositiveIntegerField(default=1)
    label = models.CharField(max_length=160)
    notes = models.TextField(blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    photo = models.FileField(upload_to="trip_stops/", null=True, blank=True)
    occurred_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sequence", "created_at"]

    def __str__(self) -> str:
        return f"{self.trip_id} #{self.sequence} {self.label}"


class CollectionTripIncident(UUIDTimeStampedModel):
    class Severity(models.TextChoices):
        LOW = "low", "Low"
        MEDIUM = "medium", "Medium"
        HIGH = "high", "High"
        CRITICAL = "critical", "Critical"

    trip = models.ForeignKey(CollectionTrip, on_delete=models.CASCADE, related_name="incidents")
    title = models.CharField(max_length=160)
    description = models.TextField(blank=True)
    severity = models.CharField(max_length=20, choices=Severity.choices, default=Severity.MEDIUM)
    geo_lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    geo_lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    resolved = models.BooleanField(default=False)
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="resolved_trip_incidents")
    photo = models.FileField(upload_to="trip_incidents/", null=True, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="reported_trip_incidents")

    def __str__(self) -> str:
        return f"{self.trip_id} - {self.title}"


class CollectionTripTelemetryPoint(UUIDTimeStampedModel):
    class Source(models.TextChoices):
        GPS = "gps", "GPS"
        MANUAL = "manual", "Manual"

    trip = models.ForeignKey(CollectionTrip, on_delete=models.CASCADE, related_name="telemetry_points")
    sequence = models.PositiveIntegerField(default=1)
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    speed_kmh = models.DecimalField(max_digits=8, decimal_places=3, null=True, blank=True)
    source = models.CharField(max_length=20, choices=Source.choices, default=Source.GPS)
    notes = models.TextField(blank=True)
    recorded_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="telemetry_points")

    class Meta:
        ordering = ["sequence", "created_at"]

    def __str__(self) -> str:
        return f"{self.trip_id} #{self.sequence} {self.latitude},{self.longitude}"
