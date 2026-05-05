from decimal import Decimal

from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response

from apps.materials.models import Material
from apps.parties.models import CollectionCenter, PersonOrCompany
from apps.users.permissions import RolePermission

from .models import SaleItem, SaleOrder, SalePayment
from .serializers import (
    SaleItemSerializer,
    SaleItemWriteSerializer,
    SaleOrderSerializer,
    SalePaymentSerializer,
    SalePaymentWriteSerializer,
)
from .services import add_sale_item, cancel_sale_payment, close_sale_order, get_available_stock, register_sale_order, register_sale_payment
from apps.logistics.models import Delivery
from apps.logistics.serializers import DeliverySerializer
from apps.logistics.services import create_delivery_from_sale


class SaleOrderViewSet(viewsets.ModelViewSet):
    queryset = SaleOrder.objects.select_related("collection_center", "buyer", "created_by").prefetch_related("items", "payments", "buyer__commercial_roles")
    serializer_class = SaleOrderSerializer
    permission_classes = [IsAuthenticated, RolePermission]
    permission_action_map = {
        "open": ["commercialization.add_saleorder"],
        "close": ["commercialization.change_saleorder"],
        "deliveries": ["commercialization.view_saleorder", "logistics.add_delivery"],
    }

    def get_queryset(self):
        queryset = super().get_queryset()
        params = self.request.query_params
        collection_center_id = params.get("collection_center_id")
        material_id = params.get("material_id")
        sale_type = params.get("sale_type")
        payment_terms = params.get("payment_terms")
        buyer_id = params.get("buyer_id")
        date_from = params.get("date_from")
        date_to = params.get("date_to")

        if collection_center_id:
            queryset = queryset.filter(collection_center_id=collection_center_id)
        if material_id:
            queryset = queryset.filter(items__material_id=material_id)
        if sale_type:
            queryset = queryset.filter(sale_type=sale_type)
        if payment_terms:
            queryset = queryset.filter(payment_terms=payment_terms)
        if buyer_id:
            queryset = queryset.filter(buyer_id=buyer_id)
        if date_from:
            queryset = queryset.filter(created_at__date__gte=date_from)
        if date_to:
            queryset = queryset.filter(created_at__date__lte=date_to)
        return queryset.distinct().order_by("-created_at")

    @action(detail=False, methods=["post"])
    def open(self, request):
        sale_order = register_sale_order(
            collection_center=CollectionCenter.objects.get(pk=request.data["collection_center_id"]),
            buyer=PersonOrCompany.objects.get(pk=request.data["buyer_id"]),
            created_by=request.user,
            notes=request.data.get("notes", ""),
            sale_type=request.data.get("sale_type", SaleOrder.SaleType.DIRECT_WEIGHT),
            payment_terms=request.data.get("payment_terms", SaleOrder.PaymentTerms.CASH),
            destination_name=request.data.get("destination_name", ""),
            transport_mode=request.data.get("transport_mode", ""),
            transport_operator=request.data.get("transport_operator", ""),
            transport_plates=request.data.get("transport_plates", ""),
            contract_reference=request.data.get("contract_reference", ""),
            negotiated_price_note=request.data.get("negotiated_price_note", ""),
        )
        return Response(self.get_serializer(sale_order).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def close(self, request, pk=None):
        sale_order = self.get_object()
        sale_order = close_sale_order(sale_order, user=request.user)
        return Response(self.get_serializer(sale_order).data)

    @action(detail=True, methods=["get", "post"])
    def deliveries(self, request, pk=None):
        sale_order = self.get_object()
        if request.method.lower() == "get":
            deliveries = Delivery.objects.filter(sale_order=sale_order).order_by("-created_at")
            return Response(DeliverySerializer(deliveries, many=True).data)
        try:
            delivery = create_delivery_from_sale(
                sale_order=sale_order,
                user=request.user,
                scheduled_date=request.data.get("scheduled_date") or None,
                time_window_start=request.data.get("time_window_start") or None,
                time_window_end=request.data.get("time_window_end") or None,
                destination_name=request.data.get("destination_name", ""),
                destination_address=request.data.get("destination_address", ""),
                destination_lat=request.data.get("destination_lat") or None,
                destination_lng=request.data.get("destination_lng") or None,
                contact_name=request.data.get("contact_name", ""),
                contact_phone=request.data.get("contact_phone", ""),
                transport_mode=request.data.get("transport_mode", ""),
                transport_operator=request.data.get("transport_operator", ""),
                transport_plates=request.data.get("transport_plates", ""),
                notes=request.data.get("notes", ""),
                delivery_type=request.data.get("delivery_type", Delivery.DeliveryType.COMPLETE),
                sale_item_ids=request.data.get("sale_item_ids"),
            )
            return Response(DeliverySerializer(delivery).data, status=status.HTTP_201_CREATED)
        except Exception as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)


class SaleItemViewSet(viewsets.ModelViewSet):
    queryset = SaleItem.objects.select_related("sale_order", "material", "inventory_movement")
    serializer_class = SaleItemSerializer
    permission_classes = [IsAuthenticated, RolePermission]
    permission_action_map = {
        "create": ["commercialization.add_saleitem"],
        "update": ["commercialization.change_saleitem"],
        "partial_update": ["commercialization.change_saleitem"],
        "destroy": ["commercialization.delete_saleitem"],
    }

    def create(self, request, *args, **kwargs):
        serializer = SaleItemWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        sale_item = add_sale_item(
            sale_order=serializer.validated_data["sale_order"],
            material=serializer.validated_data["material"],
            quantity_kg=serializer.validated_data["quantity_kg"],
            unit_price=serializer.validated_data["unit_price"],
            notes=serializer.validated_data.get("notes", ""),
            user=request.user,
            presentation=serializer.validated_data.get("presentation", ""),
            quality=serializer.validated_data.get("quality", ""),
            lot_code=serializer.validated_data.get("lot_code", ""),
            list_unit_price=serializer.validated_data.get("list_unit_price"),
            price_override_reason=serializer.validated_data.get("price_override_reason", ""),
        )
        return Response(self.get_serializer(sale_item).data, status=status.HTTP_201_CREATED)


class SalePaymentViewSet(viewsets.ModelViewSet):
    queryset = SalePayment.objects.select_related("sale_order", "sale_order__buyer", "sale_order__collection_center", "received_by").order_by("-paid_at")
    serializer_class = SalePaymentSerializer
    permission_classes = [IsAuthenticated, RolePermission]
    permission_action_map = {
        "create": ["commercialization.add_salepayment"],
        "destroy": ["commercialization.change_salepayment"],
        "cancel": ["commercialization.change_salepayment"],
    }

    def create(self, request, *args, **kwargs):
        serializer = SalePaymentWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user_model = get_user_model()
        received_by_id = serializer.validated_data.get("received_by")
        received_by = get_object_or_404(user_model, pk=received_by_id) if received_by_id else request.user
        sale_order = get_object_or_404(SaleOrder, pk=serializer.validated_data["sale_order"])
        payment = register_sale_payment(
            sale_order=sale_order,
            amount=serializer.validated_data.get("amount"),
            method=serializer.validated_data["method"],
            received_by=received_by,
            reference=serializer.validated_data.get("reference", ""),
            notes=serializer.validated_data.get("notes", ""),
            received_amount=serializer.validated_data.get("received_amount"),
            applied_amount=serializer.validated_data.get("applied_amount"),
        )
        return Response(SalePaymentSerializer(payment).data, status=status.HTTP_201_CREATED)

    def destroy(self, request, *args, **kwargs):
        payment = self.get_object()
        cancel_sale_payment(payment=payment, user=request.user, reason=request.data.get("cancel_reason", ""))
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        payment = self.get_object()
        cancel_sale_payment(payment=payment, user=request.user, reason=request.data.get("cancel_reason", ""))
        return Response(self.get_serializer(payment).data, status=status.HTTP_200_OK)


class SaleStockView(APIView):
    permission_classes = [IsAuthenticated, RolePermission]
    def get(self, request):
        collection_center_id = request.query_params.get("collection_center_id")
        material_id = request.query_params.get("material_id")
        if not collection_center_id or not material_id:
            return Response({"detail": "collection_center_id y material_id son requeridos."}, status=status.HTTP_400_BAD_REQUEST)

        collection_center = get_object_or_404(CollectionCenter, pk=collection_center_id)
        material = get_object_or_404(Material, pk=material_id)
        available_stock = get_available_stock(material=material, collection_center=collection_center)
        return Response(
            {
                "collection_center_id": str(collection_center.pk),
                "collection_center_name": collection_center.name,
                "material_id": str(material.pk),
                "material_name": material.name,
                "available_kg": str(available_stock.quantize(Decimal("0.001"))),
            }
        )
