from rest_framework import serializers

from .models import CollectionTrip, CollectionTripIncident, CollectionTripStop, CollectionTripTelemetryPoint, Route


class RouteSerializer(serializers.ModelSerializer):
    origin_center_name = serializers.CharField(source="origin_center.name", read_only=True)
    destination_center_name = serializers.CharField(source="destination_center.name", read_only=True)
    origin_center_kind = serializers.CharField(source="origin_center.kind", read_only=True)
    destination_center_kind = serializers.CharField(source="destination_center.kind", read_only=True)
    origin_center_latitude = serializers.CharField(source="origin_center.latitude", read_only=True)
    origin_center_longitude = serializers.CharField(source="origin_center.longitude", read_only=True)
    destination_center_latitude = serializers.CharField(source="destination_center.latitude", read_only=True)
    destination_center_longitude = serializers.CharField(source="destination_center.longitude", read_only=True)

    class Meta:
        model = Route
        fields = "__all__"


class CollectionTripSerializer(serializers.ModelSerializer):
    route_name = serializers.CharField(source="route.name", read_only=True)
    vehicle_label = serializers.CharField(source="vehicle.plate_number", read_only=True)
    driver_name = serializers.CharField(source="driver.person.legal_name", read_only=True)
    origin_center_name = serializers.CharField(source="origin_center.name", read_only=True)
    destination_center_name = serializers.CharField(source="destination_center.name", read_only=True)
    closed_by_name = serializers.CharField(source="closed_by.username", read_only=True)
    vehicle_efficiency_km_per_liter = serializers.CharField(source="vehicle.expected_km_per_liter", read_only=True)

    class Meta:
        model = CollectionTrip
        fields = "__all__"


class CollectionTripStopSerializer(serializers.ModelSerializer):
    class Meta:
        model = CollectionTripStop
        fields = "__all__"


class CollectionTripIncidentSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source="created_by.username", read_only=True)
    resolved_by_name = serializers.CharField(source="resolved_by.username", read_only=True)
    trip_name = serializers.CharField(source="trip.route.name", read_only=True)
    photo_name = serializers.SerializerMethodField()
    photo_url = serializers.SerializerMethodField()

    class Meta:
        model = CollectionTripIncident
        fields = "__all__"

    def get_photo_name(self, obj):
        return obj.photo.name.rsplit("/", 1)[-1] if obj.photo else None

    def get_photo_url(self, obj):
        try:
            return obj.photo.url if obj.photo else None
        except ValueError:
            return None


class CollectionTripTelemetryPointSerializer(serializers.ModelSerializer):
    trip_name = serializers.CharField(source="trip.route.name", read_only=True)
    vehicle_label = serializers.CharField(source="trip.vehicle.plate_number", read_only=True)
    created_by_name = serializers.CharField(source="created_by.username", read_only=True)

    class Meta:
        model = CollectionTripTelemetryPoint
        fields = "__all__"
