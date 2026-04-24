from rest_framework import serializers

from .models import ScaleReading, WeighingSession


class WeighingSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = WeighingSession
        fields = "__all__"


class ScaleReadingSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScaleReading
        fields = "__all__"

