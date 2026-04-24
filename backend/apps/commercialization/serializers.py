from rest_framework import serializers

from .models import SaleItem, SaleOrder


class SaleOrderSerializer(serializers.ModelSerializer):
    collection_center_name = serializers.CharField(source="collection_center.name", read_only=True)
    buyer_name = serializers.SerializerMethodField()

    class Meta:
        model = SaleOrder
        fields = "__all__"

    def get_buyer_name(self, obj):
        return obj.buyer.trade_name or obj.buyer.legal_name


class SaleItemSerializer(serializers.ModelSerializer):
    material_name = serializers.CharField(source="material.name", read_only=True)

    class Meta:
        model = SaleItem
        fields = "__all__"
