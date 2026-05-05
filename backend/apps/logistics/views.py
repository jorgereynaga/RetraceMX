from django.conf import settings
from django.utils.dateparse import parse_datetime
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.parsers import FormParser, MultiPartParser, JSONParser
from rest_framework.views import APIView
from django.core.exceptions import ObjectDoesNotExist, ValidationError

from apps.parties.models import CollectionCenter, Driver, Vehicle
from apps.commercialization.models import SaleOrder
from apps.users.permissions import RolePermission

from .models import CollectionTrip, CollectionTripIncident, CollectionTripStop, CollectionTripTelemetryPoint, Delivery, DeliveryEvidence, DeliveryIncident, DeliveryItem, DeliveryRouteStop, GPSPosition, GeoEvent, Route
from .serializers import CollectionTripIncidentSerializer, CollectionTripSerializer, CollectionTripStopSerializer, CollectionTripTelemetryPointSerializer, DeliveryEvidenceSerializer, DeliveryIncidentSerializer, DeliveryItemSerializer, DeliveryRouteStopSerializer, DeliverySerializer, GPSPositionSerializer, GeoEventSerializer, RouteSerializer
from .services import assign_delivery_to_trip, change_trip_status, close_collection_trip, create_delivery_from_sale, open_collection_trip, receive_gps_position, register_delivery_evidence, register_delivery_incident, register_trip_incident, register_trip_stop, register_trip_telemetry_point, resolve_trip_incident, update_delivery_status


class RouteViewSet(viewsets.ModelViewSet):
    queryset = Route.objects.select_related("origin_center", "destination_center").all()
    serializer_class = RouteSerializer
    permission_classes = [IsAuthenticated, RolePermission]


class CollectionTripViewSet(viewsets.ModelViewSet):
    queryset = CollectionTrip.objects.select_related("route", "origin_center", "destination_center", "vehicle", "driver", "operator").all().order_by("-planned_at")
    serializer_class = CollectionTripSerializer
    parser_classes = [FormParser, MultiPartParser, JSONParser]
    permission_classes = [IsAuthenticated, RolePermission]
    permission_action_map = {
        "create": ["logistics.add_collectiontrip"],
        "depart": ["logistics.change_collectiontrip"],
        "arrive": ["logistics.change_collectiontrip"],
        "close": ["logistics.change_collectiontrip"],
        "assign_delivery": ["logistics.change_collectiontrip", "logistics.change_delivery"],
        "start": ["logistics.change_collectiontrip"],
        "complete": ["logistics.change_collectiontrip"],
        "gps_track": ["logistics.view_gpsposition"],
        "live": ["logistics.view_collectiontrip"],
        "stops": ["logistics.add_collectiontripstop"],
    }

    def create(self, request, *args, **kwargs):
        try:
            vehicle = Vehicle.objects.get(pk=request.data["vehicle_id"]) if request.data.get("vehicle_id") else None
            driver = Driver.objects.get(pk=request.data["driver_id"]) if request.data.get("driver_id") else None
            origin_center = CollectionCenter.objects.get(pk=request.data["origin_center_id"]) if request.data.get("origin_center_id") else None
            destination_center = CollectionCenter.objects.get(pk=request.data["destination_center_id"]) if request.data.get("destination_center_id") else None
            trip = open_collection_trip(
                route=Route.objects.get(pk=request.data["route_id"]),
                operator=request.user,
                vehicle=vehicle,
                driver=driver,
                origin_center=origin_center,
                destination_center=destination_center,
                estimated_distance_km=request.data.get("estimated_distance_km", 0),
                notes=request.data.get("notes", ""),
            )
            return Response(self.get_serializer(trip).data, status=status.HTTP_201_CREATED)
        except (ObjectDoesNotExist, ValidationError) as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"])
    def depart(self, request, pk=None):
        trip = change_trip_status(
            self.get_object(),
            CollectionTrip.Status.DEPARTED,
            user=request.user,
            notes=request.data.get("notes", ""),
            geo_lat=request.data.get("geo_lat"),
            geo_lng=request.data.get("geo_lng"),
            odometer=request.data.get("odometer"),
        )
        for delivery in trip.deliveries.exclude(status__in=[Delivery.Status.CANCELLED, Delivery.Status.DELIVERED]):
            update_delivery_status(delivery=delivery, status=Delivery.Status.IN_ROUTE, user=request.user, notes="Ruta iniciada.")
        return Response(self.get_serializer(trip).data)

    @action(detail=True, methods=["post"])
    def arrive(self, request, pk=None):
        trip = change_trip_status(
            self.get_object(),
            CollectionTrip.Status.ARRIVED,
            user=request.user,
            notes=request.data.get("notes", ""),
            geo_lat=request.data.get("geo_lat"),
            geo_lng=request.data.get("geo_lng"),
            odometer=request.data.get("odometer"),
        )
        return Response(self.get_serializer(trip).data)

    @action(detail=True, methods=["post"])
    def close(self, request, pk=None):
        trip = close_collection_trip(
            trip=self.get_object(),
            user=request.user,
            notes=request.data.get("notes", ""),
        )
        return Response(self.get_serializer(trip).data)

    @action(detail=True, methods=["post"], url_path="assign-delivery")
    def assign_delivery(self, request, pk=None):
        try:
            delivery = Delivery.objects.get(pk=request.data["delivery_id"])
            delivery = assign_delivery_to_trip(
                delivery=delivery,
                trip=self.get_object(),
                user=request.user,
                planned_arrival_at=parse_datetime(request.data["planned_arrival_at"]) if request.data.get("planned_arrival_at") else None,
                notes=request.data.get("notes", ""),
            )
            return Response(DeliverySerializer(delivery).data)
        except (ObjectDoesNotExist, ValidationError, KeyError) as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"], url_path="start")
    def start(self, request, pk=None):
        return self.depart(request, pk=pk)

    @action(detail=True, methods=["post"], url_path="complete")
    def complete(self, request, pk=None):
        trip = self.get_object()
        if trip.status == CollectionTrip.Status.DEPARTED:
            trip = change_trip_status(trip, CollectionTrip.Status.ARRIVED, user=request.user, notes=request.data.get("notes", ""))
        trip = close_collection_trip(trip=trip, user=request.user, notes=request.data.get("notes", ""))
        return Response(self.get_serializer(trip).data)

    @action(detail=True, methods=["get"], url_path="gps-track")
    def gps_track(self, request, pk=None):
        points = GPSPosition.objects.filter(trip=self.get_object()).order_by("recorded_at")
        return Response(GPSPositionSerializer(points, many=True).data)

    @action(detail=True, methods=["get"], url_path="live")
    def live(self, request, pk=None):
        trip = self.get_object()
        last_position = GPSPosition.objects.filter(trip=trip).order_by("-recorded_at").first()
        return Response(
            {
                "trip": self.get_serializer(trip).data,
                "deliveries": DeliverySerializer(trip.deliveries.all(), many=True).data,
                "stops": DeliveryRouteStopSerializer(trip.delivery_stops.all(), many=True).data,
                "last_position": GPSPositionSerializer(last_position).data if last_position else None,
            }
        )

    @action(detail=True, methods=["post"], parser_classes=[FormParser, MultiPartParser, JSONParser])
    def stops(self, request, pk=None):
        trip = self.get_object()
        stop = register_trip_stop(
            trip=trip,
            label=request.data.get("label", "Parada"),
            user=request.user,
            notes=request.data.get("notes", ""),
            latitude=request.data.get("latitude") or None,
            longitude=request.data.get("longitude") or None,
            photo=request.FILES.get("photo"),
        )
        return Response(CollectionTripStopSerializer(stop).data, status=status.HTTP_201_CREATED)


class CollectionTripStopViewSet(viewsets.ModelViewSet):
    queryset = CollectionTripStop.objects.select_related("trip", "trip__route").all().order_by("-created_at")
    serializer_class = CollectionTripStopSerializer
    parser_classes = [FormParser, MultiPartParser, JSONParser]
    permission_classes = [IsAuthenticated, RolePermission]

    def get_queryset(self):
        queryset = super().get_queryset()
        trip_id = self.request.query_params.get("trip")
        if trip_id:
            queryset = queryset.filter(trip_id=trip_id)
        return queryset


class CollectionTripIncidentViewSet(viewsets.ModelViewSet):
    queryset = CollectionTripIncident.objects.select_related("trip", "resolved_by", "created_by").all().order_by("-created_at")
    serializer_class = CollectionTripIncidentSerializer
    parser_classes = [FormParser, MultiPartParser, JSONParser]
    permission_classes = [IsAuthenticated, RolePermission]
    permission_action_map = {
        "create": ["logistics.add_collectiontripincident"],
        "resolve": ["logistics.change_collectiontripincident"],
    }

    def get_queryset(self):
        queryset = super().get_queryset()
        trip_id = self.request.query_params.get("trip")
        if trip_id:
            queryset = queryset.filter(trip_id=trip_id)
        return queryset

    def create(self, request, *args, **kwargs):
        try:
            trip = CollectionTrip.objects.get(pk=request.data["trip_id"])
            incident = register_trip_incident(
                trip=trip,
                title=request.data.get("title", "Incidencia"),
                description=request.data.get("description", ""),
                severity=request.data.get("severity", CollectionTripIncident.Severity.MEDIUM),
                user=request.user,
                latitude=request.data.get("latitude") or None,
                longitude=request.data.get("longitude") or None,
                photo=request.FILES.get("photo"),
            )
            return Response(self.get_serializer(incident).data, status=status.HTTP_201_CREATED)
        except (ObjectDoesNotExist, ValidationError) as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"])
    def resolve(self, request, pk=None):
        incident = resolve_trip_incident(incident=self.get_object(), user=request.user, notes=request.data.get("notes", ""))
        return Response(self.get_serializer(incident).data)


class CollectionTripTelemetryPointViewSet(viewsets.ModelViewSet):
    queryset = CollectionTripTelemetryPoint.objects.select_related("trip", "trip__route", "trip__vehicle", "created_by").all().order_by("-recorded_at")
    serializer_class = CollectionTripTelemetryPointSerializer
    parser_classes = [FormParser, MultiPartParser, JSONParser]
    permission_classes = [IsAuthenticated, RolePermission]
    permission_action_map = {
        "create": ["logistics.add_collectiontriptelemetrypoint"],
    }

    def get_queryset(self):
        queryset = super().get_queryset()
        trip_id = self.request.query_params.get("trip")
        if trip_id:
            queryset = queryset.filter(trip_id=trip_id)
        return queryset

    def create(self, request, *args, **kwargs):
        try:
            trip = CollectionTrip.objects.get(pk=request.data["trip_id"])
            point = register_trip_telemetry_point(
                trip=trip,
                latitude=request.data["latitude"],
                longitude=request.data["longitude"],
                speed_kmh=request.data.get("speed_kmh") or None,
                source=request.data.get("source", CollectionTripTelemetryPoint.Source.GPS),
                user=request.user,
                notes=request.data.get("notes", ""),
            )
            return Response(self.get_serializer(point).data, status=status.HTTP_201_CREATED)
        except (ObjectDoesNotExist, ValidationError) as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)


class DeliveryViewSet(viewsets.ModelViewSet):
    queryset = Delivery.objects.select_related("sale_order", "buyer", "origin_center", "collection_trip", "collection_trip__route", "collection_trip__vehicle", "collection_trip__driver", "created_by", "assigned_by").prefetch_related("items").all().order_by("-created_at")
    serializer_class = DeliverySerializer
    parser_classes = [FormParser, MultiPartParser, JSONParser]
    permission_classes = [IsAuthenticated, RolePermission]
    permission_action_map = {
        "create": ["logistics.add_delivery"],
        "assign": ["logistics.change_delivery"],
        "status_change": ["logistics.change_delivery"],
        "cancel": ["logistics.change_delivery"],
        "evidence": ["logistics.add_deliveryevidence"],
        "incidents": ["logistics.add_deliveryincident"],
    }

    def get_queryset(self):
        queryset = super().get_queryset()
        sale_order_id = self.request.query_params.get("sale_order")
        status_filter = self.request.query_params.get("status")
        trip_id = self.request.query_params.get("trip")
        pending = self.request.query_params.get("pending")
        if sale_order_id:
            queryset = queryset.filter(sale_order_id=sale_order_id)
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if trip_id:
            queryset = queryset.filter(collection_trip_id=trip_id)
        if pending in {"1", "true", "yes"}:
            queryset = queryset.exclude(status__in=[Delivery.Status.DELIVERED, Delivery.Status.CANCELLED])
        return queryset

    def create(self, request, *args, **kwargs):
        try:
            sale_order = SaleOrder.objects.get(pk=request.data["sale_order_id"])
            delivery = create_delivery_from_sale(
                sale_order=sale_order,
                user=request.user,
                scheduled_date=request.data.get("scheduled_date") or None,
                time_window_start=request.data.get("time_window_start") or None,
                time_window_end=request.data.get("time_window_end") or None,
                destination_name=request.data.get("destination_name", ""),
                destination_address=request.data.get("destination_address", ""),
                destination_lat=request.data.get("destination_lat") or None,
                destination_lng=request.data.get("destination_lng") or None,
                contact_name=request.data.get("contact_name", ""),
                contact_phone=request.data.get("contact_phone", ""),
                transport_mode=request.data.get("transport_mode", ""),
                transport_operator=request.data.get("transport_operator", ""),
                transport_plates=request.data.get("transport_plates", ""),
                notes=request.data.get("notes", ""),
                delivery_type=request.data.get("delivery_type", Delivery.DeliveryType.COMPLETE),
                sale_item_ids=request.data.get("sale_item_ids"),
            )
            return Response(self.get_serializer(delivery).data, status=status.HTTP_201_CREATED)
        except (ObjectDoesNotExist, ValidationError, KeyError) as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"])
    def assign(self, request, pk=None):
        try:
            trip = CollectionTrip.objects.get(pk=request.data["trip_id"])
            delivery = assign_delivery_to_trip(delivery=self.get_object(), trip=trip, user=request.user, notes=request.data.get("notes", ""))
            return Response(self.get_serializer(delivery).data)
        except (ObjectDoesNotExist, ValidationError, KeyError) as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"], url_path="status")
    def status_change(self, request, pk=None):
        try:
            delivery = update_delivery_status(delivery=self.get_object(), status=request.data["status"], user=request.user, notes=request.data.get("notes", ""))
            return Response(self.get_serializer(delivery).data)
        except (ValidationError, KeyError) as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        delivery = update_delivery_status(delivery=self.get_object(), status=Delivery.Status.CANCELLED, user=request.user, notes=request.data.get("notes", ""))
        return Response(self.get_serializer(delivery).data)

    @action(detail=True, methods=["post"], parser_classes=[FormParser, MultiPartParser, JSONParser])
    def evidence(self, request, pk=None):
        evidence = register_delivery_evidence(
            delivery=self.get_object(),
            user=request.user,
            file=request.FILES.get("file"),
            evidence_type=request.data.get("evidence_type", DeliveryEvidence.EvidenceType.PHOTO),
            receiver_name=request.data.get("receiver_name", ""),
            receiver_phone=request.data.get("receiver_phone", ""),
            lat=request.data.get("lat") or None,
            lng=request.data.get("lng") or None,
            notes=request.data.get("notes", ""),
        )
        return Response(DeliveryEvidenceSerializer(evidence).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def incidents(self, request, pk=None):
        try:
            incident = register_delivery_incident(
                delivery=self.get_object(),
                incident_type=request.data["incident_type"],
                description=request.data.get("description", ""),
                user=request.user,
            )
            return Response(DeliveryIncidentSerializer(incident).data, status=status.HTTP_201_CREATED)
        except (ValidationError, KeyError) as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)


class DeliveryItemViewSet(viewsets.ModelViewSet):
    queryset = DeliveryItem.objects.select_related("delivery", "sale_item", "material").all()
    serializer_class = DeliveryItemSerializer
    permission_classes = [IsAuthenticated, RolePermission]

    def get_queryset(self):
        queryset = super().get_queryset()
        delivery_id = self.request.query_params.get("delivery")
        if delivery_id:
            queryset = queryset.filter(delivery_id=delivery_id)
        return queryset


class DeliveryRouteStopViewSet(viewsets.ModelViewSet):
    queryset = DeliveryRouteStop.objects.select_related("trip", "delivery", "delivery__buyer", "delivery__sale_order").all()
    serializer_class = DeliveryRouteStopSerializer
    permission_classes = [IsAuthenticated, RolePermission]


class GPSPositionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = GPSPosition.objects.select_related("gps_device", "vehicle", "trip", "driver").all()
    serializer_class = GPSPositionSerializer
    permission_classes = [IsAuthenticated, RolePermission]


class DeliveryEvidenceViewSet(viewsets.ModelViewSet):
    queryset = DeliveryEvidence.objects.select_related("delivery", "route_stop", "created_by").all().order_by("-created_at")
    serializer_class = DeliveryEvidenceSerializer
    parser_classes = [FormParser, MultiPartParser, JSONParser]
    permission_classes = [IsAuthenticated, RolePermission]


class DeliveryIncidentViewSet(viewsets.ModelViewSet):
    queryset = DeliveryIncident.objects.select_related("delivery", "trip", "reported_by", "resolved_by").all().order_by("-created_at")
    serializer_class = DeliveryIncidentSerializer
    permission_classes = [IsAuthenticated, RolePermission]


class GeoEventViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = GeoEvent.objects.select_related("trip", "delivery", "vehicle").all().order_by("-created_at")
    serializer_class = GeoEventSerializer
    permission_classes = [IsAuthenticated, RolePermission]


class GPSPositionIngestView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        expected_key = getattr(settings, "GPS_INGEST_API_KEY", "")
        provided_key = request.headers.get("X-GPS-API-Key", "") or request.query_params.get("api_key", "")
        if expected_key and provided_key != expected_key:
            return Response({"detail": "API key GPS inválida."}, status=status.HTTP_403_FORBIDDEN)
        try:
            point = receive_gps_position(
                device_code=request.data.get("deviceCode") or request.data.get("device_code") or "",
                imei=request.data.get("imei") or "",
                lat=request.data["lat"],
                lng=request.data["lng"],
                speed_kmh=request.data.get("speedKmh") or request.data.get("speed_kmh"),
                heading=request.data.get("heading"),
                accuracy_m=request.data.get("accuracyM") or request.data.get("accuracy_m"),
                recorded_at=parse_datetime(request.data["recordedAt"]) if request.data.get("recordedAt") else None,
                raw_payload=request.data.get("rawPayload") or request.data,
            )
            return Response(GPSPositionSerializer(point).data, status=status.HTTP_201_CREATED)
        except (ValidationError, KeyError) as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
