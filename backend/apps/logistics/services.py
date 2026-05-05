from __future__ import annotations

from decimal import Decimal
from math import asin, cos, radians, sin, sqrt

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.auditing.services import register_audit_event
from apps.evidence.models import EvidenceFile

from apps.core.utils import generate_folio
from apps.devices.models import Device

from .models import (
    CollectionTrip,
    CollectionTripIncident,
    CollectionTripStop,
    CollectionTripTelemetryPoint,
    Delivery,
    DeliveryEvidence,
    DeliveryIncident,
    DeliveryItem,
    DeliveryRouteStop,
    GPSPosition,
    Route,
)


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


def _sync_sale_from_delivery(delivery: Delivery, user=None):
    sale_order = delivery.sale_order
    statuses = list(sale_order.deliveries.values_list("status", flat=True))
    if not statuses:
        return sale_order

    if any(status == Delivery.Status.IN_ROUTE for status in statuses):
        sale_order.status = sale_order.Status.IN_ROUTE
    elif any(status in {Delivery.Status.LOADING, Delivery.Status.READY_TO_DEPART} for status in statuses):
        sale_order.status = sale_order.Status.LOADING
    elif all(status == Delivery.Status.DELIVERED for status in statuses):
        sale_order.status = sale_order.Status.DELIVERED
    elif any(status == Delivery.Status.PARTIAL for status in statuses):
        sale_order.status = sale_order.Status.SCHEDULED_DELIVERY
    elif any(status in {Delivery.Status.SCHEDULED, Delivery.Status.RESCHEDULED, Delivery.Status.PENDING_SCHEDULING} for status in statuses):
        sale_order.status = sale_order.Status.SCHEDULED_DELIVERY

    sale_order.save(update_fields=["status", "updated_at"])
    register_audit_event(actor=user, action="sync_sale_delivery_status", entity=sale_order, details={"delivery": str(delivery.pk), "status": sale_order.status})
    return sale_order


@transaction.atomic
def create_delivery_from_sale(
    *,
    sale_order,
    user,
    scheduled_date=None,
    time_window_start=None,
    time_window_end=None,
    destination_name="",
    destination_address="",
    destination_lat=None,
    destination_lng=None,
    contact_name="",
    contact_phone="",
    transport_mode="",
    transport_operator="",
    transport_plates="",
    notes="",
    delivery_type=Delivery.DeliveryType.COMPLETE,
    sale_item_ids=None,
) -> Delivery:
    if sale_order.status == sale_order.Status.CANCELLED:
        raise ValidationError("No se puede generar entrega desde una venta cancelada.")
    sale_items = sale_order.items.all()
    if sale_item_ids:
        sale_items = sale_items.filter(id__in=sale_item_ids)
    if not sale_items.exists():
        raise ValidationError("No se puede generar entrega desde una venta sin partidas.")

    delivery = Delivery.objects.create(
        folio=generate_folio("DL"),
        sale_order=sale_order,
        buyer=sale_order.buyer,
        status=Delivery.Status.SCHEDULED if scheduled_date else Delivery.Status.PENDING_SCHEDULING,
        delivery_type=delivery_type,
        scheduled_date=scheduled_date or None,
        time_window_start=time_window_start or None,
        time_window_end=time_window_end or None,
        origin_center=sale_order.collection_center,
        destination_name=destination_name or sale_order.destination_name,
        destination_address=destination_address or sale_order.buyer.address,
        destination_lat=destination_lat or None,
        destination_lng=destination_lng or None,
        contact_name=contact_name,
        contact_phone=contact_phone or sale_order.buyer.phone,
        transport_mode=transport_mode,
        transport_operator=transport_operator,
        transport_plates=transport_plates,
        notes=notes,
        created_by=user,
    )
    for sale_item in sale_items:
        DeliveryItem.objects.create(
            delivery=delivery,
            sale_item=sale_item,
            material=sale_item.material,
            lot_code=sale_item.lot_code,
            description=f"{sale_item.material.name} {sale_item.presentation or ''} {sale_item.quality or ''}".strip(),
            planned_weight_kg=sale_item.quantity_kg,
            unit_price=sale_item.unit_price,
            total_amount=sale_item.amount,
        )
    register_audit_event(actor=user, action="create_delivery_from_sale", entity=delivery, details={"sale_order": str(sale_order.pk), "items": sale_items.count()})
    _sync_sale_from_delivery(delivery, user=user)
    return delivery


@transaction.atomic
def assign_delivery_to_trip(*, delivery: Delivery, trip: CollectionTrip, user=None, planned_arrival_at=None, notes="") -> Delivery:
    if delivery.status in {Delivery.Status.CANCELLED, Delivery.Status.DELIVERED}:
        raise ValidationError("No se puede asignar una entrega cancelada o ya entregada.")
    if trip.status not in {CollectionTrip.Status.PLANNED, CollectionTrip.Status.DEPARTED}:
        raise ValidationError("Solo se pueden asignar entregas a rutas planificadas o en proceso.")
    delivery.collection_trip = trip
    delivery.assigned_by = user
    delivery.status = Delivery.Status.SCHEDULED if trip.status == CollectionTrip.Status.PLANNED else Delivery.Status.IN_ROUTE
    delivery.save(update_fields=["collection_trip", "assigned_by", "status", "updated_at"])
    DeliveryRouteStop.objects.update_or_create(
        delivery=delivery,
        defaults={
            "trip": trip,
            "stop_order": trip.delivery_stops.count() + 1,
            "status": DeliveryRouteStop.Status.PENDING if trip.status == CollectionTrip.Status.PLANNED else DeliveryRouteStop.Status.ON_THE_WAY,
            "planned_arrival_at": planned_arrival_at or None,
            "destination_address": delivery.destination_address,
            "destination_lat": delivery.destination_lat,
            "destination_lng": delivery.destination_lng,
            "notes": notes,
        },
    )
    register_audit_event(actor=user, action="assign_delivery_to_trip", entity=delivery, details={"trip": str(trip.pk)})
    _sync_sale_from_delivery(delivery, user=user)
    return delivery


@transaction.atomic
def update_delivery_status(*, delivery: Delivery, status: str, user=None, notes="") -> Delivery:
    if status not in Delivery.Status.values:
        raise ValidationError("Estado de entrega inválido.")
    delivery.status = status
    now = timezone.now()
    if status == Delivery.Status.LOADING and not delivery.started_at:
        delivery.started_at = now
    if status == Delivery.Status.AT_DESTINATION and not delivery.arrived_at:
        delivery.arrived_at = now
    if status == Delivery.Status.DELIVERED and not delivery.delivered_at:
        delivery.delivered_at = now
    if status == Delivery.Status.CANCELLED and not delivery.cancelled_at:
        delivery.cancelled_at = now
    delivery.save(update_fields=["status", "started_at", "arrived_at", "delivered_at", "cancelled_at", "updated_at"])
    if hasattr(delivery, "route_stop"):
        stop_status = {
            Delivery.Status.IN_ROUTE: DeliveryRouteStop.Status.ON_THE_WAY,
            Delivery.Status.AT_DESTINATION: DeliveryRouteStop.Status.AT_DESTINATION,
            Delivery.Status.DELIVERED: DeliveryRouteStop.Status.DELIVERED,
            Delivery.Status.PARTIAL: DeliveryRouteStop.Status.PARTIAL,
            Delivery.Status.REJECTED: DeliveryRouteStop.Status.REJECTED,
            Delivery.Status.CANCELLED: DeliveryRouteStop.Status.CANCELLED,
        }.get(status)
        if stop_status:
            delivery.route_stop.status = stop_status
            if status == Delivery.Status.AT_DESTINATION:
                delivery.route_stop.actual_arrival_at = now
            if status in {Delivery.Status.DELIVERED, Delivery.Status.PARTIAL, Delivery.Status.REJECTED}:
                delivery.route_stop.actual_departure_at = now
            delivery.route_stop.save(update_fields=["status", "actual_arrival_at", "actual_departure_at", "updated_at"])
    register_audit_event(actor=user, action="update_delivery_status", entity=delivery, details={"status": status, "notes": notes})
    _sync_sale_from_delivery(delivery, user=user)
    return delivery


@transaction.atomic
def register_delivery_evidence(*, delivery: Delivery, user=None, file=None, evidence_type=DeliveryEvidence.EvidenceType.PHOTO, receiver_name="", receiver_phone="", lat=None, lng=None, notes="") -> DeliveryEvidence:
    evidence = DeliveryEvidence.objects.create(
        delivery=delivery,
        route_stop=getattr(delivery, "route_stop", None),
        evidence_type=evidence_type,
        file=file,
        receiver_name=receiver_name,
        receiver_phone=receiver_phone,
        lat=lat or None,
        lng=lng or None,
        notes=notes,
        created_by=user,
    )
    register_audit_event(actor=user, action="register_delivery_evidence", entity=evidence, details={"delivery": str(delivery.pk), "evidence_type": evidence_type})
    return evidence


@transaction.atomic
def register_delivery_incident(*, delivery: Delivery, incident_type: str, description="", user=None) -> DeliveryIncident:
    incident = DeliveryIncident.objects.create(
        delivery=delivery,
        trip=delivery.collection_trip,
        incident_type=incident_type,
        description=description,
        reported_by=user,
    )
    if incident_type in {DeliveryIncident.IncidentType.MATERIAL_REJECTED, DeliveryIncident.IncidentType.CUSTOMER_REJECTED}:
        update_delivery_status(delivery=delivery, status=Delivery.Status.REJECTED, user=user, notes=description)
    elif incident_type == DeliveryIncident.IncidentType.PARTIAL_DELIVERY:
        update_delivery_status(delivery=delivery, status=Delivery.Status.PARTIAL, user=user, notes=description)
    register_audit_event(actor=user, action="register_delivery_incident", entity=incident, details={"delivery": str(delivery.pk), "type": incident_type})
    return incident


@transaction.atomic
def receive_gps_position(
    *,
    device_code="",
    imei="",
    lat,
    lng,
    speed_kmh=None,
    heading=None,
    accuracy_m=None,
    recorded_at=None,
    raw_payload=None,
) -> GPSPosition:
    latitude = Decimal(str(lat))
    longitude = Decimal(str(lng))
    if latitude < Decimal("-90") or latitude > Decimal("90") or longitude < Decimal("-180") or longitude > Decimal("180"):
        raise ValidationError("Coordenadas GPS inválidas.")

    device = Device.objects.filter(kind=Device.Kind.GPS_TRACKER, identifier=device_code).first()
    if not device and imei:
        device = Device.objects.filter(kind=Device.Kind.GPS_TRACKER, metadata__imei=imei).first()
    if not device:
        raise ValidationError("Dispositivo GPS no registrado.")
    if not device.is_connected:
        raise ValidationError("Dispositivo GPS inactivo o sin autorización.")
    if not device.vehicle:
        raise ValidationError("El dispositivo GPS no tiene vehículo asociado.")

    active_trip = CollectionTrip.objects.filter(vehicle=device.vehicle, status=CollectionTrip.Status.DEPARTED).order_by("-departed_at").first()
    driver = active_trip.driver if active_trip else device.vehicle.collection_trips.filter(status=CollectionTrip.Status.DEPARTED).order_by("-departed_at").values_list("driver", flat=True).first()
    if driver and not hasattr(driver, "pk"):
        from apps.parties.models import Driver

        driver = Driver.objects.filter(pk=driver).first()

    timestamp = recorded_at or timezone.now()
    position = GPSPosition.objects.create(
        gps_device=device,
        vehicle=device.vehicle,
        trip=active_trip,
        driver=driver,
        lat=latitude,
        lng=longitude,
        speed_kmh=Decimal(str(speed_kmh)) if speed_kmh not in (None, "") else None,
        heading=Decimal(str(heading)) if heading not in (None, "") else None,
        accuracy_m=Decimal(str(accuracy_m)) if accuracy_m not in (None, "") else None,
        recorded_at=timestamp,
        raw_payload=raw_payload or {},
    )
    device.last_seen_at = timezone.now()
    device.save(update_fields=["last_seen_at", "updated_at"])
    if active_trip:
        register_trip_telemetry_point(
            trip=active_trip,
            latitude=latitude,
            longitude=longitude,
            speed_kmh=speed_kmh,
            source=CollectionTripTelemetryPoint.Source.GPS,
            notes="Posición recibida desde dispositivo GPS",
        )
    register_audit_event(actor=None, action="receive_gps_position", entity=position, details={"device": str(device.pk), "trip": str(active_trip.pk) if active_trip else None})
    return position
