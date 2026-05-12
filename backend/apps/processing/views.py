from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework import decorators, response, status, viewsets
from rest_framework.permissions import IsAuthenticated

from apps.users.permissions import RolePermission

from .models import MaterialProcess, MaterialProcessInput, MaterialProcessOutput, MaterialProcessWaste, ProcessType
from .serializers import (
    MaterialProcessInputSerializer,
    MaterialProcessInputWriteSerializer,
    MaterialProcessOutputSerializer,
    MaterialProcessOutputWriteSerializer,
    MaterialProcessSerializer,
    MaterialProcessWasteSerializer,
    MaterialProcessWasteWriteSerializer,
    ProcessTypeSerializer,
    MaterialProcessWriteSerializer,
)
from .services import (
    add_process_input,
    add_process_output,
    add_process_waste,
    cancel_material_process,
    confirm_material_process,
    create_material_process,
    create_process_type,
)


class ProcessTypeViewSet(viewsets.ModelViewSet):
    queryset = ProcessType.objects.all().order_by("name")
    serializer_class = ProcessTypeSerializer
    permission_classes = [IsAuthenticated, RolePermission]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        process_type = create_process_type(**serializer.validated_data, created_by=request.user)
        return response.Response(self.get_serializer(process_type).data, status=status.HTTP_201_CREATED)


class MaterialProcessViewSet(viewsets.ModelViewSet):
    queryset = MaterialProcess.objects.select_related("process_type", "collection_center", "created_by", "confirmed_by", "canceled_by").prefetch_related("inputs", "outputs", "wastes")
    serializer_class = MaterialProcessSerializer
    permission_classes = [IsAuthenticated, RolePermission]
    permission_action_map = {
        "confirm": ["processing.change_materialprocess"],
        "cancel": ["processing.change_materialprocess"],
    }

    def create(self, request, *args, **kwargs):
        serializer = MaterialProcessWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        process = create_material_process(**serializer.validated_data, created_by=request.user)
        return response.Response(self.get_serializer(process).data, status=status.HTTP_201_CREATED)

    @decorators.action(detail=True, methods=["post"])
    def confirm(self, request, pk=None):
        process = self.get_object()
        process = confirm_material_process(process=process, user=request.user)
        return response.Response(self.get_serializer(process).data)

    @decorators.action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        process = self.get_object()
        process = cancel_material_process(process=process, user=request.user, reason=request.data.get("reason", ""))
        return response.Response(self.get_serializer(process).data)

class MaterialProcessInputViewSet(viewsets.ModelViewSet):
    queryset = MaterialProcessInput.objects.select_related("process", "material")
    serializer_class = MaterialProcessInputSerializer
    permission_classes = [IsAuthenticated, RolePermission]

    def create(self, request, *args, **kwargs):
        serializer = MaterialProcessInputWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        process = serializer.validated_data["process"]
        item = add_process_input(
            process=process,
            material=serializer.validated_data["material"],
            quantity=serializer.validated_data["quantity"],
            unit=serializer.validated_data.get("unit", "kg"),
            source_inventory_reference=serializer.validated_data.get("source_inventory_reference", ""),
            user=request.user,
        )
        return response.Response(self.get_serializer(item).data, status=status.HTTP_201_CREATED)


class MaterialProcessOutputViewSet(viewsets.ModelViewSet):
    queryset = MaterialProcessOutput.objects.select_related("process", "material")
    serializer_class = MaterialProcessOutputSerializer
    permission_classes = [IsAuthenticated, RolePermission]

    def create(self, request, *args, **kwargs):
        serializer = MaterialProcessOutputWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        process = serializer.validated_data["process"]
        item = add_process_output(
            process=process,
            material=serializer.validated_data["material"],
            quantity=serializer.validated_data["quantity"],
            unit=serializer.validated_data.get("unit", "kg"),
            lot_code=serializer.validated_data.get("lot_code", ""),
            user=request.user,
        )
        return response.Response(self.get_serializer(item).data, status=status.HTTP_201_CREATED)


class MaterialProcessWasteViewSet(viewsets.ModelViewSet):
    queryset = MaterialProcessWaste.objects.select_related("process", "material")
    serializer_class = MaterialProcessWasteSerializer
    permission_classes = [IsAuthenticated, RolePermission]

    def create(self, request, *args, **kwargs):
        serializer = MaterialProcessWasteWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        process = serializer.validated_data["process"]
        item = add_process_waste(
            process=process,
            material=serializer.validated_data.get("material"),
            waste_type=serializer.validated_data.get("waste_type", MaterialProcessWaste.WasteType.MERMA),
            quantity=serializer.validated_data["quantity"],
            unit=serializer.validated_data.get("unit", "kg"),
            notes=serializer.validated_data.get("notes", ""),
            user=request.user,
        )
        return response.Response(self.get_serializer(item).data, status=status.HTTP_201_CREATED)
