from rest_framework import serializers

from .models import CommercialRole, CollectionCenter, Driver, PersonOrCompany, Vehicle


class CommercialRoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = CommercialRole
        fields = "__all__"


class PersonOrCompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = PersonOrCompany
        fields = "__all__"


class VehicleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vehicle
        fields = "__all__"


class DriverSerializer(serializers.ModelSerializer):
    person_name = serializers.SerializerMethodField()

    class Meta:
        model = Driver
        fields = "__all__"

    def get_person_name(self, obj):
        if obj.person:
            return str(obj.person)
        return None


class CollectionCenterSerializer(serializers.ModelSerializer):
    class Meta:
        model = CollectionCenter
        fields = "__all__"
