from rest_framework import status, viewsets
from rest_framework.response import Response

from .models import Payment
from .serializers import PaymentSerializer
from .services import register_payment


class PaymentViewSet(viewsets.ModelViewSet):
    queryset = Payment.objects.select_related("operation", "received_by").all().order_by("-paid_at")
    serializer_class = PaymentSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payment = register_payment(
            operation=serializer.validated_data["operation"],
            amount=serializer.validated_data["amount"],
            method=serializer.validated_data["method"],
            received_by=serializer.validated_data.get("received_by") or request.user,
            reference=serializer.validated_data.get("reference", ""),
            notes=serializer.validated_data.get("notes", ""),
        )
        output = self.get_serializer(payment)
        return Response(output.data, status=status.HTTP_201_CREATED)
