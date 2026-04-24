from django.db.models import Q
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.auditing.services import register_audit_event
from .models import Material, MaterialFamily, PriceList, PriceListItem
from .serializers import MaterialFamilySerializer, MaterialSerializer, PriceListItemSerializer, PriceListSerializer


class MaterialFamilyViewSet(viewsets.ModelViewSet):
    queryset = MaterialFamily.objects.all().order_by("code")
    serializer_class = MaterialFamilySerializer


class MaterialViewSet(viewsets.ModelViewSet):
    queryset = Material.objects.select_related("family").all().order_by("code")
    serializer_class = MaterialSerializer


class PriceListViewSet(viewsets.ModelViewSet):
    queryset = PriceList.objects.select_related("collection_center").all().order_by("-valid_from")
    serializer_class = PriceListSerializer


class PriceListItemViewSet(viewsets.ModelViewSet):
    queryset = PriceListItem.objects.select_related("price_list", "material").all()
    serializer_class = PriceListItemSerializer

    def perform_create(self, serializer):
        item = serializer.save()
        register_audit_event(actor=self.request.user, action="change_price", entity=item, details={"unit_price": str(item.unit_price), "material": str(item.material_id)})

    def perform_update(self, serializer):
        item = serializer.save()
        register_audit_event(actor=self.request.user, action="change_price", entity=item, details={"unit_price": str(item.unit_price), "material": str(item.material_id)})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def price_suggestion(request):
    collection_center_id = request.query_params.get("collection_center_id")
    material_id = request.query_params.get("material_id")
    if not collection_center_id or not material_id:
        return Response({"detail": "collection_center_id y material_id son requeridos."}, status=400)

    today = timezone.localdate()
    price_list_item = (
        PriceListItem.objects.select_related("price_list", "material")
        .filter(
            price_list__collection_center_id=collection_center_id,
            price_list__is_active=True,
            price_list__valid_from__lte=today,
            material_id=material_id,
            is_active=True,
        )
        .filter(Q(price_list__valid_to__isnull=True) | Q(price_list__valid_to__gte=today))
        .order_by("-price_list__valid_from", "-price_list__created_at", "-created_at")
        .first()
    )

    if not price_list_item:
        return Response(
            {
                "found": False,
                "collection_center_id": collection_center_id,
                "material_id": material_id,
                "unit_price": None,
                "price_list_id": None,
                "price_list_name": None,
                "currency": None,
            }
        )

    return Response(
        {
            "found": True,
            "collection_center_id": collection_center_id,
            "material_id": material_id,
            "unit_price": str(price_list_item.unit_price),
            "price_list_id": str(price_list_item.price_list_id),
            "price_list_name": price_list_item.price_list.name,
            "currency": price_list_item.price_list.currency,
            "valid_from": price_list_item.price_list.valid_from,
            "valid_to": price_list_item.price_list.valid_to,
        }
    )
