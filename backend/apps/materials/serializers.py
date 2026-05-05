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
    linked_party_name = serializers.CharField(source="linked_party.legal_name", read_only=True)
    linked_party_trade_name = serializers.CharField(source="linked_party.trade_name", read_only=True)

    class Meta:
        model = PriceList
        fields = "__all__"
        extra_kwargs = {
            "name": {"required": False, "allow_blank": True},
        }

    def _build_name(self, code, linked_party):
        party_label = "Lista general"
        if linked_party:
            party_label = linked_party.trade_name or linked_party.legal_name or "Persona/empresa"
        if code:
            return f"{code} · {party_label}"
        return party_label

    def validate(self, attrs):
        linked_party = attrs.get("linked_party", getattr(self.instance, "linked_party", None))
        if linked_party:
            existing = PriceList.objects.filter(linked_party=linked_party)
            if self.instance:
                existing = existing.exclude(pk=self.instance.pk)
            if existing.exists():
                raise serializers.ValidationError(
                    {"linked_party": "Este cliente/empresa ya tiene una lista de precios asignada."}
                )

        attrs["name"] = self._build_name(
            attrs.get("code", getattr(self.instance, "code", "")),
            linked_party,
        )
        return attrs


class PriceListItemSerializer(serializers.ModelSerializer):
    price_list_name = serializers.CharField(source="price_list.name", read_only=True)
    material_name = serializers.CharField(source="material.name", read_only=True)

    class Meta:
        model = PriceListItem
        fields = "__all__"
