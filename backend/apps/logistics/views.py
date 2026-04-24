from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import FormParser, MultiPartParser, JSONParser
from django.core.exceptions import ObjectDoesNotExist, ValidationError

from apps.parties.models import CollectionCenter, Driver, Vehicle

from .models import CollectionTrip, CollectionTripIncident, CollectionTripStop, CollectionTripTelemetryPoint, Route
from .serializers import CollectionTripIncidentSerializer, CollectionTripSerializer, CollectionTripStopSerializer, CollectionTripTelemetryPointSerializer, RouteSerializer
from .services import change_trip_status, close_collection_trip, open_collection_trip, register_trip_incident, register_trip_stop, register_trip_telemetry_point, resolve_trip_incident


class RouteViewSet(viewsets.ModelViewSet):
    queryset = Route.objects.select_related("origin_center", "destination_center").all()
    serializer_class = RouteSerializer


class CollectionTripViewSet(viewsets.ModelViewSet):
    queryset = CollectionTrip.objects.select_related("route", "origin_center", "destination_center", "vehicle", "driver", "operator").all().order_by("-planned_at")
    serializer_class = CollectionTripSerializer
    parser_classes = [FormParser, MultiPartParser, JSONParser]

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
