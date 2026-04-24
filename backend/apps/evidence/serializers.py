from rest_framework import serializers

from .models import CustodyEvent, EvidenceFile, PrintLog


class CustodyEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustodyEvent
        fields = "__all__"


class EvidenceFileSerializer(serializers.ModelSerializer):
    trip_name = serializers.SerializerMethodField()
    file_name = serializers.SerializerMethodField()
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = EvidenceFile
        fields = "__all__"

    def get_trip_name(self, obj):
        if obj.trip_id and obj.trip:
            return obj.trip.route.name
        return None

    def get_file_name(self, obj):
        return obj.file.name.rsplit("/", 1)[-1] if obj.file else None

    def get_file_url(self, obj):
        try:
            return obj.file.url if obj.file else None
        except ValueError:
            return None


class PrintLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = PrintLog
        fields = "__all__"
