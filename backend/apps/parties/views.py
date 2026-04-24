from rest_framework import viewsets

from .models import CommercialRole, CollectionCenter, Driver, PersonOrCompany, Vehicle
from .serializers import CommercialRoleSerializer, CollectionCenterSerializer, DriverSerializer, PersonOrCompanySerializer, VehicleSerializer


class CommercialRoleViewSet(viewsets.ModelViewSet):
    queryset = CommercialRole.objects.all().order_by("code")
    serializer_class = CommercialRoleSerializer


class PersonOrCompanyViewSet(viewsets.ModelViewSet):
    queryset = PersonOrCompany.objects.all().order_by("legal_name")
    serializer_class = PersonOrCompanySerializer


class VehicleViewSet(viewsets.ModelViewSet):
    queryset = Vehicle.objects.all().order_by("plate_number")
    serializer_class = VehicleSerializer


class DriverViewSet(viewsets.ModelViewSet):
    queryset = Driver.objects.select_related("person").all()
    serializer_class = DriverSerializer


class CollectionCenterViewSet(viewsets.ModelViewSet):
    queryset = CollectionCenter.objects.all().order_by("code")
    serializer_class = CollectionCenterSerializer

