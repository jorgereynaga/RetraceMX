from django.db.models.deletion import ProtectedError
from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.utils import protected_delete_message
from apps.users.permissions import RolePermission

from .models import CommercialRole, CollectionCenter, Driver, PersonOrCompany, Vehicle
from .serializers import CommercialRoleSerializer, CollectionCenterSerializer, DriverSerializer, PersonOrCompanySerializer, VehicleSerializer


class CommercialRoleViewSet(viewsets.ModelViewSet):
    queryset = CommercialRole.objects.all().order_by("code")
    serializer_class = CommercialRoleSerializer
    permission_classes = [IsAuthenticated, RolePermission]


class PersonOrCompanyViewSet(viewsets.ModelViewSet):
    queryset = PersonOrCompany.objects.all().order_by("legal_name")
    serializer_class = PersonOrCompanySerializer
    permission_classes = [IsAuthenticated, RolePermission]

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError as error:
            payload = protected_delete_message(
                f"la persona/empresa {instance.legal_name}",
                error.protected_objects,
            )
            return Response(payload, status=status.HTTP_400_BAD_REQUEST)


class VehicleViewSet(viewsets.ModelViewSet):
    queryset = Vehicle.objects.all().order_by("plate_number")
    serializer_class = VehicleSerializer
    filterset_fields = ["owner"]
    permission_classes = [IsAuthenticated, RolePermission]

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError as error:
            payload = protected_delete_message(f"el vehículo {instance.plate_number}", error.protected_objects)
            return Response(payload, status=status.HTTP_400_BAD_REQUEST)


class DriverViewSet(viewsets.ModelViewSet):
    queryset = Driver.objects.select_related("person").all()
    serializer_class = DriverSerializer
    permission_classes = [IsAuthenticated, RolePermission]

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError as error:
            payload = protected_delete_message(f"el operador {instance.person}", error.protected_objects)
            return Response(payload, status=status.HTTP_400_BAD_REQUEST)


class CollectionCenterViewSet(viewsets.ModelViewSet):
    queryset = CollectionCenter.objects.all().order_by("code")
    serializer_class = CollectionCenterSerializer
    permission_classes = [IsAuthenticated, RolePermission]

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError as error:
            payload = protected_delete_message(
                f"el centro de acopio {instance.code} · {instance.name}",
                error.protected_objects,
            )
            return Response(payload, status=status.HTTP_400_BAD_REQUEST)
