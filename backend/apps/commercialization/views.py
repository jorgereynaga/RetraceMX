from decimal import Decimal

from django.shortcuts import get_object_or_404
from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.views import APIView
from rest_framework.response import Response

from apps.materials.models import Material
from apps.parties.models import CollectionCenter, PersonOrCompany

from .models import SaleItem, SaleOrder
from .serializers import SaleItemSerializer, SaleOrderSerializer
from .services import add_sale_item, close_sale_order, get_available_stock, register_sale_order


class SaleOrderViewSet(viewsets.ModelViewSet):
    queryset = SaleOrder.objects.select_related("collection_center", "buyer", "created_by").prefetch_related("items")
    serializer_class = SaleOrderSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        params = self.request.query_params
        collection_center_id = params.get("collection_center_id")
        material_id = params.get("material_id")
        date_from = params.get("date_from")
        date_to = params.get("date_to")

        if collection_center_id:
            queryset = queryset.filter(collection_center_id=collection_center_id)
        if material_id:
            queryset = queryset.filter(items__material_id=material_id)
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
        )
        return Response(self.get_serializer(sale_order).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def close(self, request, pk=None):
        sale_order = self.get_object()
        sale_order = close_sale_order(sale_order, user=request.user)
        return Response(self.get_serializer(sale_order).data)


class SaleItemViewSet(viewsets.ModelViewSet):
    queryset = SaleItem.objects.select_related("sale_order", "material", "inventory_movement")
    serializer_class = SaleItemSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        sale_item = add_sale_item(
            sale_order=serializer.validated_data["sale_order"],
            material=serializer.validated_data["material"],
            quantity_kg=serializer.validated_data["quantity_kg"],
            unit_price=serializer.validated_data["unit_price"],
            notes=serializer.validated_data.get("notes", ""),
            user=request.user,
        )
        return Response(self.get_serializer(sale_item).data, status=status.HTTP_201_CREATED)


class SaleStockView(APIView):
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
