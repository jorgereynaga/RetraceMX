from rest_framework import serializers

from .models import ScaleReading, WeighingSession


class ScaleReadingSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScaleReading
        fields = "__all__"


class WeighingSessionSerializer(serializers.ModelSerializer):
    readings = ScaleReadingSerializer(many=True, read_only=True)
    operation_folio = serializers.SerializerMethodField()

    class Meta:
        model = WeighingSession
        fields = "__all__"

    def get_operation_folio(self, obj):
        if obj.operation:
            return obj.operation.folio
        return None
