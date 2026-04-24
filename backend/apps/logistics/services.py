from __future__ import annotations

from decimal import Decimal
from math import asin, cos, radians, sin, sqrt

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.auditing.services import register_audit_event
from apps.evidence.models import EvidenceFile

from .models import CollectionTrip, CollectionTripIncident, CollectionTripStop, CollectionTripTelemetryPoint, Route


def calculate_distance_km(start_lat, start_lng, end_lat, end_lng) -> Decimal:
    earth_radius_km = 6371.0
    lat1 = radians(float(start_lat))
    lat2 = radians(float(end_lat))
    lon1 = radians(float(start_lng))
    lon2 = radians(float(end_lng))
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    distance = 2 * earth_radius_km * asin(sqrt(a))
    return Decimal(str(distance)).quantize(Decimal("0.001"))


def _trip_telemetry_path(trip: CollectionTrip):
    points = []
    if trip.geo_start_lat is not None and trip.geo_start_lng is not None:
        points.append((trip.geo_start_lat, trip.geo_start_lng))
    telemetry_points = list(trip.telemetry_points.order_by("sequence", "recorded_at"))
    points.extend((point.latitude, point.longitude) for point in telemetry_points)
    if trip.geo_end_lat is not None and trip.geo_end_lng is not None:
        points.append((trip.geo_end_lat, trip.geo_end_lng))
    return points, telemetry_points


@transaction.atomic
def recalculate_trip_telemetry(*, trip: CollectionTrip) -> CollectionTrip:
    path, telemetry_points = _trip_telemetry_path(trip)
    total_distance = Decimal("0")
    for start, end in zip(path, path[1:]):
        total_distance += calculate_distance_km(start[0], start[1], end[0], end[1])

    trip.telemetry_points_count = len(telemetry_points)
    trip.telemetry_distance_km = total_distance.quantize(Decimal("0.001"))
    if trip.vehicle and trip.vehicle.expected_km_per_liter:
        trip.estimated_fuel_liters = (trip.telemetry_distance_km / trip.vehicle.expected_km_per_liter).quantize(Decimal("0.001"))
    else:
        trip.estimated_fuel_liters = Decimal("0")
    if telemetry_points:
        last_point = telemetry_points[-1]
        trip.last_telemetry_at = last_point.recorded_at
        trip.last_telemetry_lat = last_point.latitude
        trip.last_telemetry_lng = last_point.longitude
    trip.save(
        update_fields=[
            "telemetry_distance_km",
            "estimated_fuel_liters",
            "telemetry_points_count",
            "last_telemetry_at",
            "last_telemetry_lat",
            "last_telemetry_lng",
            "updated_at",
        ]
    )
    return trip


@transaction.atomic
def open_collection_trip(*, route: Route, operator, vehicle=None, driver=None, origin_center=None, destination_center=None, estimated_distance_km=0, notes="") -> CollectionTrip:
    origin_center = origin_center or route.origin_center
    destination_center = destination_center or route.destination_center
    trip = CollectionTrip.objects.create(
        route=route,
        origin_center=origin_center,
        destination_center=destination_center,
        vehicle=vehicle,
        driver=driver,
        operator=operator,
        estimated_distance_km=Decimal(estimated_distance_km),
        estimated_fuel_liters=Decimal(estimated_distance_km) / vehicle.expected_km_per_liter if vehicle and vehicle.expected_km_per_liter else Decimal("0"),
        notes=notes,
        status=CollectionTrip.Status.PLANNED,
    )
    register_audit_event(actor=operator, action="open_collection_trip", entity=trip, details={"route": str(route.pk)})
    return trip


@transaction.atomic
def change_trip_status(
    trip: CollectionTrip,
    new_status: str,
    user=None,
    notes: str = "",
    geo_lat=None,
    geo_lng=None,
    odometer=None,
) -> CollectionTrip:
    valid_transitions = {
        CollectionTrip.Status.PLANNED: {CollectionTrip.Status.DEPARTED, CollectionTrip.Status.CANCELLED},
        CollectionTrip.Status.DEPARTED: {CollectionTrip.Status.ARRIVED, CollectionTrip.Status.CANCELLED},
        CollectionTrip.Status.ARRIVED: {CollectionTrip.Status.CLOSED},
        CollectionTrip.Status.CLOSED: set(),
        CollectionTrip.Status.CANCELLED: set(),
    }
    if new_status not in valid_transitions.get(trip.status, set()):
        raise ValidationError(f"No es posible cambiar de {trip.status} a {new_status}.")

    trip.status = new_status
    if new_status == CollectionTrip.Status.DEPARTED:
        trip.departed_at = timezone.now()
        if geo_lat is not None and geo_lng is not None:
            trip.geo_start_lat = geo_lat
            trip.geo_start_lng = geo_lng
        elif trip.origin_center and trip.origin_center.latitude is not None and trip.origin_center.longitude is not None:
            trip.geo_start_lat = trip.origin_center.latitude
            trip.geo_start_lng = trip.origin_center.longitude
        if odometer is not None:
            trip.odometer_start = odometer
    elif new_status == CollectionTrip.Status.ARRIVED:
        trip.arrived_at = timezone.now()
        if geo_lat is not None and geo_lng is not None:
            trip.geo_end_lat = geo_lat
            trip.geo_end_lng = geo_lng
        elif trip.destination_center and trip.destination_center.latitude is not None and trip.destination_center.longitude is not None:
            trip.geo_end_lat = trip.destination_center.latitude
            trip.geo_end_lng = trip.destination_center.longitude
        if odometer is not None:
            trip.odometer_end = odometer
    trip.save(update_fields=["status", "departed_at", "arrived_at", "geo_start_lat", "geo_start_lng", "geo_end_lat", "geo_end_lng", "odometer_start", "odometer_end", "updated_at"])
    recalculate_trip_telemetry(trip=trip)
    register_audit_event(actor=user, action="change_trip_status", entity=trip, details={"status": new_status, "notes": notes})
    return trip


@transaction.atomic
def register_trip_evidence(*, trip: CollectionTrip, uploaded_by, file, file_type="", description="") -> EvidenceFile:
    evidence = EvidenceFile.objects.create(
        trip=trip,
        file=file,
        file_type=file_type,
        description=description,
        uploaded_by=uploaded_by,
    )
    register_audit_event(actor=uploaded_by, action="register_trip_evidence", entity=evidence, details={"trip": str(trip.pk), "file_type": file_type})
    return evidence


@transaction.atomic
def register_trip_stop(*, trip: CollectionTrip, label: str, user=None, notes: str = "", latitude=None, longitude=None, photo=None) -> CollectionTripStop:
    sequence = trip.stops.count() + 1
    stop = CollectionTripStop.objects.create(
        trip=trip,
        sequence=sequence,
        label=label,
        notes=notes,
        latitude=latitude,
        longitude=longitude,
        photo=photo,
    )
    register_audit_event(actor=user, action="register_trip_stop", entity=stop, details={"label": label, "sequence": sequence})
    return stop


@transaction.atomic
def register_trip_telemetry_point(
    *,
    trip: CollectionTrip,
    latitude,
    longitude,
    user=None,
    source: str = CollectionTripTelemetryPoint.Source.GPS,
    speed_kmh=None,
    notes: str = "",
) -> CollectionTripTelemetryPoint:
    if trip.status in {CollectionTrip.Status.CLOSED, CollectionTrip.Status.CANCELLED}:
        raise ValidationError("No se puede registrar telemetria en un viaje cerrado o cancelado.")
    sequence = trip.telemetry_points.count() + 1
    point = CollectionTripTelemetryPoint.objects.create(
        trip=trip,
        sequence=sequence,
        latitude=latitude,
        longitude=longitude,
        speed_kmh=speed_kmh,
        source=source,
        notes=notes,
        created_by=user,
    )
    recalculate_trip_telemetry(trip=trip)
    register_audit_event(
        actor=user,
        action="register_trip_telemetry_point",
        entity=point,
        details={"sequence": sequence, "source": source, "latitude": str(latitude), "longitude": str(longitude)},
    )
    return point


@transaction.atomic
def register_trip_incident(
    *,
    trip: CollectionTrip,
    title: str,
    description: str = "",
    severity: str = CollectionTripIncident.Severity.MEDIUM,
    user=None,
    latitude=None,
    longitude=None,
    photo=None,
) -> CollectionTripIncident:
    incident = CollectionTripIncident.objects.create(
        trip=trip,
        title=title,
        description=description,
        severity=severity,
        geo_lat=latitude,
        geo_lng=longitude,
        photo=photo,
        created_by=user,
    )
    register_audit_event(actor=user, action="register_trip_incident", entity=incident, details={"title": title, "severity": severity})
    return incident


@transaction.atomic
def resolve_trip_incident(*, incident: CollectionTripIncident, user=None, notes: str = "") -> CollectionTripIncident:
    incident.resolved = True
    incident.resolved_at = timezone.now()
    incident.resolved_by = user
    incident.save(update_fields=["resolved", "resolved_at", "resolved_by", "updated_at"])
    register_audit_event(actor=user, action="resolve_trip_incident", entity=incident, details={"notes": notes})
    return incident


@transaction.atomic
def close_collection_trip(*, trip: CollectionTrip, user=None, notes: str = "") -> CollectionTrip:
    unresolved = trip.incidents.filter(resolved=False).count()
    if unresolved:
        raise ValidationError("No es posible cerrar el viaje con incidencias pendientes.")
    if trip.status not in {CollectionTrip.Status.ARRIVED, CollectionTrip.Status.CLOSED}:
        raise ValidationError("Solo un viaje arribado puede cerrarse.")
    trip.status = CollectionTrip.Status.CLOSED
    trip.closed_at = timezone.now()
    trip.closed_by = user
    trip.closure_notes = notes
    trip.save(update_fields=["status", "closed_at", "closed_by", "closure_notes", "updated_at"])
    register_audit_event(actor=user, action="close_collection_trip", entity=trip, details={"notes": notes})
    return trip
