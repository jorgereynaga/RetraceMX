from rest_framework import serializers

from .models import CommercialRole, CollectionCenter, Driver, PersonOrCompany, Vehicle


class CommercialRoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = CommercialRole
        fields = "__all__"


class PersonOrCompanySerializer(serializers.ModelSerializer):
    commercial_role_names = serializers.SerializerMethodField()
    buyer_type_label = serializers.SerializerMethodField()

    class Meta:
        model = PersonOrCompany
        fields = "__all__"

    def get_commercial_role_names(self, obj):
        return [role.name for role in obj.commercial_roles.all()]

    def get_buyer_type_label(self, obj):
        return obj.get_kind_display()


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
