from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from rest_framework import decorators, status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.operations.models import PurchaseOperation
from apps.users.permissions import RolePermission

from .models import Payment
from .serializers import PaymentSerializer, PaymentWriteSerializer
from .services import cancel_payment, register_payment


class PaymentViewSet(viewsets.ModelViewSet):
    queryset = Payment.objects.select_related("operation", "operation__customer", "operation__vehicle", "received_by").all().order_by("-paid_at")
    serializer_class = PaymentSerializer
    permission_classes = [IsAuthenticated, RolePermission]
    permission_action_map = {
        "create": ["payments.add_payment"],
        "destroy": ["payments.change_payment"],
        "cancel": ["payments.change_payment"],
    }

    def create(self, request, *args, **kwargs):
        serializer = PaymentWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user_model = get_user_model()
        received_by_id = serializer.validated_data.get("received_by")
        received_by = get_object_or_404(user_model, pk=received_by_id) if received_by_id else request.user
        operation = get_object_or_404(PurchaseOperation, pk=serializer.validated_data["operation"])
        payment = register_payment(
            operation=operation,
            amount=serializer.validated_data.get("amount"),
            method=serializer.validated_data["method"],
            received_by=received_by,
            reference=serializer.validated_data.get("reference", ""),
            notes=serializer.validated_data.get("notes", ""),
            received_amount=serializer.validated_data.get("received_amount"),
            applied_amount=serializer.validated_data.get("applied_amount"),
        )
        output = PaymentSerializer(payment)
        return Response(output.data, status=status.HTTP_201_CREATED)

    def destroy(self, request, *args, **kwargs):
        payment = self.get_object()
        cancel_payment(payment=payment, user=request.user, reason=request.data.get("cancel_reason", ""))
        return Response(status=status.HTTP_204_NO_CONTENT)

    @decorators.action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        payment = self.get_object()
        cancel_payment(payment=payment, user=request.user, reason=request.data.get("cancel_reason", ""))
        return Response(self.get_serializer(payment).data, status=status.HTTP_200_OK)
