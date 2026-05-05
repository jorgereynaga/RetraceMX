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


class Delivery(UUIDTimeStampedModel):
    class Status(models.TextChoices):
        PENDING_SCHEDULING = "pending_scheduling", "Pendiente de programación"
        SCHEDULED = "scheduled", "Programada"
        LOADING = "loading", "En carga"
        READY_TO_DEPART = "ready_to_depart", "Lista para salida"
        IN_ROUTE = "in_route", "En ruta"
        AT_DESTINATION = "at_destination", "En destino"
        DELIVERED = "delivered", "Entregada"
        PARTIAL = "partial", "Entrega parcial"
        REJECTED = "rejected", "Rechazada"
        CANCELLED = "cancelled", "Cancelada"
        RESCHEDULED = "rescheduled", "Reprogramada"

    class DeliveryType(models.TextChoices):
        COMPLETE = "complete", "Completa"
        PARTIAL = "partial", "Parcial"

    folio = models.CharField(max_length=50, unique=True, db_index=True)
    sale_order = models.ForeignKey("commercialization.SaleOrder", on_delete=models.CASCADE, related_name="deliveries")
    buyer = models.ForeignKey("parties.PersonOrCompany", on_delete=models.PROTECT, related_name="deliveries")
    collection_trip = models.ForeignKey(CollectionTrip, on_delete=models.SET_NULL, null=True, blank=True, related_name="deliveries")
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.PENDING_SCHEDULING)
    delivery_type = models.CharField(max_length=20, choices=DeliveryType.choices, default=DeliveryType.COMPLETE)
    scheduled_date = models.DateField(null=True, blank=True)
    time_window_start = models.TimeField(null=True, blank=True)
    time_window_end = models.TimeField(null=True, blank=True)
    origin_center = models.ForeignKey("parties.CollectionCenter", on_delete=models.PROTECT, related_name="outbound_deliveries")
    destination_name = models.CharField(max_length=255, blank=True)
    destination_address = models.TextField(blank=True)
    destination_lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    destination_lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    contact_name = models.CharField(max_length=160, blank=True)
    contact_phone = models.CharField(max_length=40, blank=True)
    transport_mode = models.CharField(max_length=80, blank=True)
    transport_operator = models.CharField(max_length=160, blank=True)
    transport_plates = models.CharField(max_length=60, blank=True)
    notes = models.TextField(blank=True)
    requires_signature = models.BooleanField(default=True)
    requires_photo = models.BooleanField(default=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="created_deliveries")
    assigned_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="assigned_deliveries")
    started_at = models.DateTimeField(null=True, blank=True)
    arrived_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)

    def __str__(self) -> str:
        return self.folio


class DeliveryItem(UUIDTimeStampedModel):
    class Status(models.TextChoices):
        PLANNED = "planned", "Programada"
        LOADED = "loaded", "Cargada"
        DELIVERED = "delivered", "Entregada"
        PARTIAL = "partial", "Parcial"
        REJECTED = "rejected", "Rechazada"
        CANCELLED = "cancelled", "Cancelada"

    delivery = models.ForeignKey(Delivery, on_delete=models.CASCADE, related_name="items")
    sale_item = models.ForeignKey("commercialization.SaleItem", on_delete=models.PROTECT, related_name="delivery_items")
    material = models.ForeignKey("materials.Material", on_delete=models.PROTECT, related_name="delivery_items")
    lot_code = models.CharField(max_length=80, blank=True)
    description = models.CharField(max_length=255, blank=True)
    planned_weight_kg = models.DecimalField(max_digits=12, decimal_places=3, default=Decimal("0"))
    loaded_weight_kg = models.DecimalField(max_digits=12, decimal_places=3, default=Decimal("0"))
    delivered_weight_kg = models.DecimalField(max_digits=12, decimal_places=3, default=Decimal("0"))
    rejected_weight_kg = models.DecimalField(max_digits=12, decimal_places=3, default=Decimal("0"))
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PLANNED)
    notes = models.TextField(blank=True)

    def __str__(self) -> str:
        return f"{self.delivery.folio} - {self.material}"


class DeliveryRouteStop(UUIDTimeStampedModel):
    class Status(models.TextChoices):
        PENDING = "pending", "Pendiente"
        ON_THE_WAY = "on_the_way", "En camino"
        AT_DESTINATION = "at_destination", "En destino"
        DELIVERED = "delivered", "Entregada"
        PARTIAL = "partial", "Parcial"
        REJECTED = "rejected", "Rechazada"
        OMITTED = "omitted", "Omitida"
        CANCELLED = "cancelled", "Cancelada"

    trip = models.ForeignKey(CollectionTrip, on_delete=models.CASCADE, related_name="delivery_stops")
    delivery = models.OneToOneField(Delivery, on_delete=models.CASCADE, related_name="route_stop")
    stop_order = models.PositiveIntegerField(default=1)
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.PENDING)
    planned_arrival_at = models.DateTimeField(null=True, blank=True)
    actual_arrival_at = models.DateTimeField(null=True, blank=True)
    actual_departure_at = models.DateTimeField(null=True, blank=True)
    destination_address = models.TextField(blank=True)
    destination_lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    destination_lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    distance_from_previous_km = models.DecimalField(max_digits=12, decimal_places=3, default=Decimal("0"))
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["stop_order", "created_at"]

    def __str__(self) -> str:
        return f"{self.trip_id} #{self.stop_order} {self.delivery.folio}"


class GPSPosition(UUIDTimeStampedModel):
    gps_device = models.ForeignKey("devices.Device", on_delete=models.PROTECT, related_name="gps_positions")
    vehicle = models.ForeignKey("parties.Vehicle", on_delete=models.PROTECT, related_name="gps_positions")
    trip = models.ForeignKey(CollectionTrip, on_delete=models.SET_NULL, null=True, blank=True, related_name="gps_positions")
    driver = models.ForeignKey("parties.Driver", on_delete=models.SET_NULL, null=True, blank=True, related_name="gps_positions")
    lat = models.DecimalField(max_digits=9, decimal_places=6)
    lng = models.DecimalField(max_digits=9, decimal_places=6)
    speed_kmh = models.DecimalField(max_digits=8, decimal_places=3, null=True, blank=True)
    heading = models.DecimalField(max_digits=8, decimal_places=3, null=True, blank=True)
    accuracy_m = models.DecimalField(max_digits=8, decimal_places=3, null=True, blank=True)
    recorded_at = models.DateTimeField()
    received_at = models.DateTimeField(auto_now_add=True)
    source = models.CharField(max_length=40, default="gps_device")
    raw_payload = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-recorded_at", "-created_at"]

    def __str__(self) -> str:
        return f"{self.vehicle_id} {self.lat},{self.lng}"


class DeliveryEvidence(UUIDTimeStampedModel):
    class EvidenceType(models.TextChoices):
        PHOTO = "photo", "Fotografía"
        SIGNATURE = "signature", "Firma"
        DOCUMENT = "document", "Documento"
        SCALE = "scale", "Báscula"
        OTHER = "other", "Otro"

    delivery = models.ForeignKey(Delivery, on_delete=models.CASCADE, related_name="evidences")
    route_stop = models.ForeignKey(DeliveryRouteStop, on_delete=models.SET_NULL, null=True, blank=True, related_name="evidences")
    evidence_type = models.CharField(max_length=30, choices=EvidenceType.choices, default=EvidenceType.PHOTO)
    file = models.FileField(upload_to="delivery_evidence/", null=True, blank=True)
    receiver_name = models.CharField(max_length=160, blank=True)
    receiver_phone = models.CharField(max_length=40, blank=True)
    lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="delivery_evidences")


class DeliveryIncident(UUIDTimeStampedModel):
    class IncidentType(models.TextChoices):
        WEIGHT_DIFFERENCE = "weight_difference", "Diferencia de peso"
        MATERIAL_REJECTED = "material_rejected", "Material rechazado"
        PARTIAL_DELIVERY = "partial_delivery", "Entrega parcial"
        CUSTOMER_REJECTED = "customer_rejected", "Cliente no recibe"
        DESTINATION_CLOSED = "destination_closed", "Destino cerrado"
        TRANSPORT_PROBLEM = "transport_problem", "Problema de transporte"
        GPS_NO_SIGNAL = "gps_no_signal", "GPS sin señal"
        OTHER = "other", "Otro"

    class Status(models.TextChoices):
        OPEN = "open", "Abierta"
        RESOLVED = "resolved", "Resuelta"
        CANCELLED = "cancelled", "Cancelada"

    delivery = models.ForeignKey(Delivery, on_delete=models.CASCADE, related_name="incidents")
    trip = models.ForeignKey(CollectionTrip, on_delete=models.SET_NULL, null=True, blank=True, related_name="delivery_incidents")
    incident_type = models.CharField(max_length=40, choices=IncidentType.choices)
    description = models.TextField(blank=True)
    reported_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="reported_delivery_incidents")
    reported_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN)
    resolution_notes = models.TextField(blank=True)
    resolved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="resolved_delivery_incidents")
    resolved_at = models.DateTimeField(null=True, blank=True)


class GeoEvent(UUIDTimeStampedModel):
    class EventType(models.TextChoices):
        CENTER_DEPARTURE = "center_departure", "Salida de centro"
        DESTINATION_ARRIVAL = "destination_arrival", "Llegada a destino"
        DESTINATION_DEPARTURE = "destination_departure", "Salida de destino"
        ROUTE_DEVIATION = "route_deviation", "Desvío de ruta"
        GPS_NO_SIGNAL = "gps_no_signal", "GPS sin señal"

    trip = models.ForeignKey(CollectionTrip, on_delete=models.CASCADE, related_name="geo_events")
    delivery = models.ForeignKey(Delivery, on_delete=models.SET_NULL, null=True, blank=True, related_name="geo_events")
    vehicle = models.ForeignKey("parties.Vehicle", on_delete=models.SET_NULL, null=True, blank=True, related_name="geo_events")
    event_type = models.CharField(max_length=40, choices=EventType.choices)
    lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    distance_m = models.DecimalField(max_digits=12, decimal_places=3, default=Decimal("0"))
    notes = models.TextField(blank=True)
