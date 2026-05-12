from __future__ import annotations

from rest_framework import serializers

from .models import MaterialProcess, MaterialProcessInput, MaterialProcessOutput, MaterialProcessWaste, ProcessType


class ProcessTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProcessType
        fields = "__all__"


class MaterialProcessInputSerializer(serializers.ModelSerializer):
    material_name = serializers.CharField(source="material.name", read_only=True)
    process_folio = serializers.CharField(source="process.folio", read_only=True)

    class Meta:
        model = MaterialProcessInput
        fields = "__all__"


class MaterialProcessOutputSerializer(serializers.ModelSerializer):
    material_name = serializers.CharField(source="material.name", read_only=True)
    process_folio = serializers.CharField(source="process.folio", read_only=True)

    class Meta:
        model = MaterialProcessOutput
        fields = "__all__"


class MaterialProcessWasteSerializer(serializers.ModelSerializer):
    material_name = serializers.CharField(source="material.name", read_only=True)
    process_folio = serializers.CharField(source="process.folio", read_only=True)
    waste_type_label = serializers.CharField(source="get_waste_type_display", read_only=True)

    class Meta:
        model = MaterialProcessWaste
        fields = "__all__"


class MaterialProcessSerializer(serializers.ModelSerializer):
    process_type_name = serializers.CharField(source="process_type.name", read_only=True)
    collection_center_name = serializers.CharField(source="collection_center.name", read_only=True)
    created_by_name = serializers.SerializerMethodField()
    confirmed_by_name = serializers.SerializerMethodField()
    canceled_by_name = serializers.SerializerMethodField()
    inputs = MaterialProcessInputSerializer(many=True, read_only=True)
    outputs = MaterialProcessOutputSerializer(many=True, read_only=True)
    wastes = MaterialProcessWasteSerializer(many=True, read_only=True)
    inputs_count = serializers.SerializerMethodField()
    outputs_count = serializers.SerializerMethodField()
    wastes_count = serializers.SerializerMethodField()

    class Meta:
        model = MaterialProcess
        fields = "__all__"

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None

    def get_confirmed_by_name(self, obj):
        if obj.confirmed_by:
            return obj.confirmed_by.get_full_name() or obj.confirmed_by.username
        return None

    def get_canceled_by_name(self, obj):
        if obj.canceled_by:
            return obj.canceled_by.get_full_name() or obj.canceled_by.username
        return None

    def get_inputs_count(self, obj):
        return obj.inputs.count()

    def get_outputs_count(self, obj):
        return obj.outputs.count()

    def get_wastes_count(self, obj):
        return obj.wastes.count()


class MaterialProcessWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = MaterialProcess
        fields = ["process_type", "collection_center", "process_date", "notes"]
        extra_kwargs = {
            "process_date": {"required": False},
            "notes": {"required": False, "allow_blank": True},
        }


class MaterialProcessInputWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = MaterialProcessInput
        fields = ["process", "material", "quantity", "unit", "source_inventory_reference"]


class MaterialProcessOutputWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = MaterialProcessOutput
        fields = ["process", "material", "quantity", "unit", "lot_code"]
        extra_kwargs = {
            "lot_code": {"required": False, "allow_blank": True},
        }


class MaterialProcessWasteWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = MaterialProcessWaste
        fields = ["process", "material", "waste_type", "quantity", "unit", "notes"]
