from rest_framework import serializers

from .models import PurchaseOperation, TicketItem


class PurchaseOperationSerializer(serializers.ModelSerializer):
    opened_by_name = serializers.SerializerMethodField()
    driver_name = serializers.SerializerMethodField()
    vehicle_plate = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseOperation
        fields = "__all__"

    def get_opened_by_name(self, obj):
        if obj.opened_by:
            return obj.opened_by.get_full_name() or obj.opened_by.username
        return None

    def get_driver_name(self, obj):
        if obj.driver and obj.driver.person:
            return str(obj.driver.person)
        return None

    def get_vehicle_plate(self, obj):
        if obj.vehicle:
            return obj.vehicle.plate_number
        return None


class TicketItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = TicketItem
        fields = "__all__"


class TicketItemWriteSerializer(serializers.ModelSerializer):
    reason = serializers.CharField(required=False, allow_blank=True, write_only=True)

    class Meta:
        model = TicketItem
        fields = [
            "operation",
            "material",
            "method",
            "gross_weight_kg",
            "tare_weight_kg",
            "net_weight_kg",
            "merma_kg",
            "unit_price",
            "notes",
            "reason",
        ]
        extra_kwargs = {
            "operation": {"required": False},
            "material": {"required": False},
            "method": {"required": False},
            "gross_weight_kg": {"required": False},
            "tare_weight_kg": {"required": False},
            "net_weight_kg": {"required": False},
            "merma_kg": {"required": False},
            "unit_price": {"required": False},
            "notes": {"required": False},
        }
