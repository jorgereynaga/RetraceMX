from rest_framework import serializers

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
    GeoEvent,
    Route,
)


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
    deliveries_count = serializers.SerializerMethodField()
    delivery_weight_kg = serializers.SerializerMethodField()

    class Meta:
        model = CollectionTrip
        fields = "__all__"

    def get_deliveries_count(self, obj):
        return obj.deliveries.count()

    def get_delivery_weight_kg(self, obj):
        total = sum((item.planned_weight_kg for delivery in obj.deliveries.all() for item in delivery.items.all()), 0)
        return str(total)


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


class DeliverySerializer(serializers.ModelSerializer):
    sale_folio = serializers.CharField(source="sale_order.folio", read_only=True)
    buyer_name = serializers.SerializerMethodField()
    origin_center_name = serializers.CharField(source="origin_center.name", read_only=True)
    collection_trip_status = serializers.CharField(source="collection_trip.status", read_only=True)
    route_name = serializers.CharField(source="collection_trip.route.name", read_only=True)
    vehicle_label = serializers.CharField(source="collection_trip.vehicle.plate_number", read_only=True)
    driver_name = serializers.CharField(source="collection_trip.driver.person.legal_name", read_only=True)
    status_label = serializers.SerializerMethodField()
    delivery_type_label = serializers.SerializerMethodField()
    items_count = serializers.SerializerMethodField()
    planned_weight_kg = serializers.SerializerMethodField()
    loaded_weight_kg = serializers.SerializerMethodField()
    delivered_weight_kg = serializers.SerializerMethodField()
    last_gps_lat = serializers.SerializerMethodField()
    last_gps_lng = serializers.SerializerMethodField()
    last_gps_at = serializers.SerializerMethodField()

    class Meta:
        model = Delivery
        fields = "__all__"

    def get_buyer_name(self, obj):
        return obj.buyer.trade_name or obj.buyer.legal_name

    def get_status_label(self, obj):
        return obj.get_status_display()

    def get_delivery_type_label(self, obj):
        return obj.get_delivery_type_display()

    def get_items_count(self, obj):
        return obj.items.count()

    def get_planned_weight_kg(self, obj):
        return str(sum((item.planned_weight_kg for item in obj.items.all()), 0))

    def get_loaded_weight_kg(self, obj):
        return str(sum((item.loaded_weight_kg for item in obj.items.all()), 0))

    def get_delivered_weight_kg(self, obj):
        return str(sum((item.delivered_weight_kg for item in obj.items.all()), 0))

    def _last_position(self, obj):
        trip = obj.collection_trip
        if not trip:
            return None
        return trip.gps_positions.order_by("-recorded_at").first()

    def get_last_gps_lat(self, obj):
        point = self._last_position(obj)
        return str(point.lat) if point else None

    def get_last_gps_lng(self, obj):
        point = self._last_position(obj)
        return str(point.lng) if point else None

    def get_last_gps_at(self, obj):
        point = self._last_position(obj)
        return point.recorded_at if point else None


class DeliveryItemSerializer(serializers.ModelSerializer):
    material_name = serializers.CharField(source="material.name", read_only=True)
    material_code = serializers.CharField(source="material.code", read_only=True)
    sale_folio = serializers.CharField(source="delivery.sale_order.folio", read_only=True)

    class Meta:
        model = DeliveryItem
        fields = "__all__"


class DeliveryRouteStopSerializer(serializers.ModelSerializer):
    delivery_folio = serializers.CharField(source="delivery.folio", read_only=True)
    sale_folio = serializers.CharField(source="delivery.sale_order.folio", read_only=True)
    buyer_name = serializers.SerializerMethodField()

    class Meta:
        model = DeliveryRouteStop
        fields = "__all__"

    def get_buyer_name(self, obj):
        return obj.delivery.buyer.trade_name or obj.delivery.buyer.legal_name


class GPSPositionSerializer(serializers.ModelSerializer):
    device_identifier = serializers.CharField(source="gps_device.identifier", read_only=True)
    vehicle_label = serializers.CharField(source="vehicle.plate_number", read_only=True)
    route_name = serializers.CharField(source="trip.route.name", read_only=True)

    class Meta:
        model = GPSPosition
        fields = "__all__"


class DeliveryEvidenceSerializer(serializers.ModelSerializer):
    delivery_folio = serializers.CharField(source="delivery.folio", read_only=True)
    file_name = serializers.SerializerMethodField()
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = DeliveryEvidence
        fields = "__all__"

    def get_file_name(self, obj):
        return obj.file.name.rsplit("/", 1)[-1] if obj.file else None

    def get_file_url(self, obj):
        try:
            return obj.file.url if obj.file else None
        except ValueError:
            return None


class DeliveryIncidentSerializer(serializers.ModelSerializer):
    delivery_folio = serializers.CharField(source="delivery.folio", read_only=True)
    reported_by_name = serializers.CharField(source="reported_by.username", read_only=True)
    resolved_by_name = serializers.CharField(source="resolved_by.username", read_only=True)

    class Meta:
        model = DeliveryIncident
        fields = "__all__"


class GeoEventSerializer(serializers.ModelSerializer):
    delivery_folio = serializers.CharField(source="delivery.folio", read_only=True)
    vehicle_label = serializers.CharField(source="vehicle.plate_number", read_only=True)

    class Meta:
        model = GeoEvent
        fields = "__all__"
