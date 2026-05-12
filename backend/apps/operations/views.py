from rest_framework import decorators, response, status, viewsets
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404

from apps.auditing.services import register_audit_event
from apps.evidence.services import register_print_event
from apps.parties.models import CollectionCenter, Driver, PersonOrCompany, Vehicle
from apps.users.permissions import RolePermission

from .models import PurchaseOperation, TicketItem
from .serializers import PurchaseOperationSerializer, TicketItemSerializer, TicketItemWriteSerializer
from .services import (
    change_operation_status,
    open_purchase_operation,
    recalculate_operation_total,
    register_ticket_item,
    update_ticket_item,
)


class PurchaseOperationViewSet(viewsets.ModelViewSet):
    queryset = PurchaseOperation.objects.select_related(
        "collection_center",
        "customer",
        "route",
        "vehicle",
        "driver",
        "opened_by",
        "closed_by",
    ).prefetch_related("items", "payments", "weighing_sessions")
    serializer_class = PurchaseOperationSerializer
    permission_classes = [IsAuthenticated, RolePermission]
    permission_action_map = {
        "open": ["operations.add_purchaseoperation"],
        "update_driver": ["operations.change_purchaseoperation"],
        "recalculate": ["operations.change_purchaseoperation"],
        "status_change": ["operations.change_purchaseoperation"],
        "print_ticket": ["operations.change_purchaseoperation", "evidence.add_printlog"],
    }

    @decorators.action(detail=False, methods=["post"])
    def open(self, request):
        operation = open_purchase_operation(
            collection_center=get_object_or_404(CollectionCenter, pk=request.data["collection_center_id"]),
            customer=get_object_or_404(PersonOrCompany, pk=request.data["customer_id"]),
            opened_by=request.user,
            route=None,
            vehicle=Vehicle.objects.filter(pk=request.data.get("vehicle_id")).first() if request.data.get("vehicle_id") else None,
            driver=Driver.objects.filter(pk=request.data.get("driver_id")).first() if request.data.get("driver_id") else None,
            notes=request.data.get("notes", ""),
        )
        return response.Response(self.get_serializer(operation).data, status=status.HTTP_201_CREATED)

    @decorators.action(detail=True, methods=["patch"])
    def update_driver(self, request, pk=None):
        operation = self.get_object()
        closed_statuses = {
            PurchaseOperation.Status.CONFIRMED,
            PurchaseOperation.Status.COMPLETED,
            PurchaseOperation.Status.CANCELLED,
        }
        if operation.status in closed_statuses:
            return response.Response(
                {"detail": "No se puede cambiar el conductor en una operación cerrada."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        driver_id = request.data.get("driver_id")
        if driver_id:
            driver = Driver.objects.filter(pk=driver_id).first()
            if not driver:
                return response.Response({"detail": "Conductor no encontrado."}, status=status.HTTP_400_BAD_REQUEST)
        else:
            driver = None
        old_driver = str(operation.driver) if operation.driver else None
        operation.driver = driver
        operation.save(update_fields=["driver", "updated_at"])
        register_audit_event(
            actor=request.user,
            action="update_driver",
            entity=operation,
            details={"old_driver": old_driver, "new_driver": str(driver) if driver else None},
        )
        return response.Response(self.get_serializer(operation).data)

    @decorators.action(detail=True, methods=["post"])
    def recalculate(self, request, pk=None):
        operation = self.get_object()
        operation = recalculate_operation_total(operation)
        return response.Response(self.get_serializer(operation).data)

    @decorators.action(detail=True, methods=["post"])
    def status_change(self, request, pk=None):
        operation = self.get_object()
        operation = change_operation_status(
            operation,
            request.data["status"],
            user=request.user,
            reason=request.data.get("reason", ""),
            close_reason=request.data.get("close_reason", ""),
            close_notes=request.data.get("close_notes", ""),
            close_authorized_by=request.user if request.data.get("authorize_close_with_pending") else None,
            close_recognized_pending_amount=request.data.get("close_recognized_pending_amount"),
        )
        return response.Response(self.get_serializer(operation).data)

    @decorators.action(detail=True, methods=["post"])
    def print_ticket(self, request, pk=None):
        operation = self.get_object()
        log = register_print_event(
            operation=operation,
            printed_by=request.user,
            printer_name=request.data.get("printer_name", ""),
            copies=int(request.data.get("copies", 1)),
            is_reprint=bool(request.data.get("is_reprint", False)),
            payload=request.data.get("payload", {"operation_id": str(operation.pk), "folio": operation.folio}),
            notes=request.data.get("notes", ""),
        )
        operation.print_status = operation.PrintStatus.REPRINTED if log.is_reprint else operation.PrintStatus.PRINTED
        operation.save(update_fields=["print_status", "updated_at"])
        register_audit_event(actor=request.user, action="print_ticket", entity=operation, details={"print_log_id": str(log.pk), "is_reprint": log.is_reprint})
        return response.Response({"operation": self.get_serializer(operation).data, "print_log": log.pk}, status=status.HTTP_201_CREATED)


class TicketItemViewSet(viewsets.ModelViewSet):
    queryset = TicketItem.objects.select_related("operation", "material", "weighing_session", "scale_reading")
    serializer_class = TicketItemSerializer
    filterset_fields = ["operation"]
    permission_classes = [IsAuthenticated, RolePermission]
    permission_action_map = {
        "adjust": ["operations.change_ticketitem"],
        "confirm": ["operations.change_ticketitem"],
    }

    def create(self, request, *args, **kwargs):
        serializer = TicketItemWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        operation = serializer.validated_data["operation"]
        closed_statuses = {
            PurchaseOperation.Status.CONFIRMED,
            PurchaseOperation.Status.COMPLETED,
            PurchaseOperation.Status.CANCELLED,
        }
        if operation.status in closed_statuses:
            return response.Response(
                {"detail": f"No se pueden agregar partidas a una operación en estado '{operation.status}'."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        item = register_ticket_item(
            operation=operation,
            material=serializer.validated_data["material"],
            method=serializer.validated_data["method"],
            unit_price=serializer.validated_data["unit_price"],
            gross_weight_kg=serializer.validated_data["gross_weight_kg"],
            tare_weight_kg=serializer.validated_data.get("tare_weight_kg", 0),
            merma_kg=serializer.validated_data.get("merma_kg", 0),
            net_weight_kg=serializer.validated_data.get("net_weight_kg"),
            weighing_session=serializer.validated_data.get("weighing_session"),
            scale_reading=serializer.validated_data.get("scale_reading"),
            user=self.request.user,
            notes=serializer.validated_data.get("notes", ""),
        )
        output = self.get_serializer(item)
        return response.Response(output.data, status=status.HTTP_201_CREATED)

    def destroy(self, request, *args, **kwargs):
        item = self.get_object()
        operation = item.operation
        if operation.status in {
            PurchaseOperation.Status.CONFIRMED,
            PurchaseOperation.Status.COMPLETED,
            PurchaseOperation.Status.CANCELLED,
        }:
            return response.Response(
                {"detail": "No se puede eliminar una partida de una operación cerrada."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        register_audit_event(
            actor=request.user,
            action="delete_ticket_item",
            entity=item,
            details={
                "operation_folio": operation.folio,
                "material": str(item.material),
                "net_weight_kg": str(item.net_weight_kg),
                "amount": str(item.amount),
            },
        )
        item.delete()
        recalculate_operation_total(operation)
        return response.Response(status=status.HTTP_204_NO_CONTENT)

    def update(self, request, *args, **kwargs):
        item = self.get_object()
        if item.operation.print_status != item.operation.PrintStatus.PENDING:
            return response.Response(
                {"detail": "La partida ya fue impresa. Usa el ajuste posterior."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = TicketItemWriteSerializer(data=request.data, partial=kwargs.pop("partial", False))
        serializer.is_valid(raise_exception=True)
        updated = update_ticket_item(
            ticket_item=item,
            user=request.user,
            material=serializer.validated_data.get("material"),
            method=serializer.validated_data.get("method"),
            unit_price=serializer.validated_data.get("unit_price"),
            gross_weight_kg=serializer.validated_data.get("gross_weight_kg"),
            tare_weight_kg=serializer.validated_data.get("tare_weight_kg"),
            merma_kg=serializer.validated_data.get("merma_kg"),
            notes=serializer.validated_data.get("notes"),
            reason=serializer.validated_data.get("reason", ""),
            after_print=False,
        )
        return response.Response(self.get_serializer(updated).data)

    @decorators.action(detail=True, methods=["post"])
    def adjust(self, request, pk=None):
        item = self.get_object()
        serializer = TicketItemWriteSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated = update_ticket_item(
            ticket_item=item,
            user=request.user,
            material=serializer.validated_data.get("material"),
            method=serializer.validated_data.get("method"),
            unit_price=serializer.validated_data.get("unit_price"),
            gross_weight_kg=serializer.validated_data.get("gross_weight_kg"),
            tare_weight_kg=serializer.validated_data.get("tare_weight_kg"),
            merma_kg=serializer.validated_data.get("merma_kg"),
            notes=serializer.validated_data.get("notes"),
            reason=serializer.validated_data.get("reason", request.data.get("reason", "")),
            after_print=True,
        )
        return response.Response(self.get_serializer(updated).data)

    @decorators.action(detail=True, methods=["post"])
    def confirm(self, request, pk=None):
        item = self.get_object()
        item.status = TicketItem.Status.CONFIRMED
        item.confirmed_by = request.user
        item.save(update_fields=["status", "confirmed_by", "updated_at"])
        register_audit_event(actor=request.user, action="confirm_ticket_item", entity=item, details={"manual": True})
        recalculate_operation_total(item.operation)
        return response.Response(self.get_serializer(item).data)
