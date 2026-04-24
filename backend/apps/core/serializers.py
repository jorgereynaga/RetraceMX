from rest_framework import serializers


class UUIDModelSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
