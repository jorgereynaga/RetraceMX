from rest_framework import serializers

from .models import Material, MaterialFamily, PriceList, PriceListItem


class MaterialFamilySerializer(serializers.ModelSerializer):
    class Meta:
        model = MaterialFamily
        fields = "__all__"


class MaterialSerializer(serializers.ModelSerializer):
    class Meta:
        model = Material
        fields = "__all__"


class PriceListSerializer(serializers.ModelSerializer):
    collection_center_name = serializers.CharField(source="collection_center.name", read_only=True)

    class Meta:
        model = PriceList
        fields = "__all__"


class PriceListItemSerializer(serializers.ModelSerializer):
    price_list_name = serializers.CharField(source="price_list.name", read_only=True)
    material_name = serializers.CharField(source="material.name", read_only=True)

    class Meta:
        model = PriceListItem
        fields = "__all__"
