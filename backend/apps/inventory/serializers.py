from __future__ import annotations

from decimal import Decimal

from rest_framework import serializers

from .models import InventoryMovement


class InventoryMovementSerializer(serializers.ModelSerializer):
    material_name = serializers.SerializerMethodField()
    collection_center_name = serializers.SerializerMethodField()
    movement_type_label = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = InventoryMovement
        fields = "__all__"

    def get_material_name(self, obj):
        return str(obj.material) if obj.material else None

    def get_collection_center_name(self, obj):
        return obj.collection_center.name if obj.collection_center else None

    def get_movement_type_label(self, obj):
        return obj.get_movement_type_display()

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None


class InventoryMovementAdjustmentSerializer(serializers.Serializer):
    collection_center = serializers.UUIDField()
    material = serializers.UUIDField()
    delta_kg = serializers.DecimalField(max_digits=12, decimal_places=3)
    unit_price = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True, default=Decimal("0"))
    notes = serializers.CharField(required=False, allow_blank=True, default="")

    def validate_delta_kg(self, value):
        if Decimal(value) == 0:
            raise serializers.ValidationError("El ajuste debe ser diferente de cero.")
        return value
