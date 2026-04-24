from rest_framework import serializers

from .models import PurchaseOperation, TicketItem


class PurchaseOperationSerializer(serializers.ModelSerializer):
    class Meta:
        model = PurchaseOperation
        fields = "__all__"


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
