from django.db.models import Q
from django.db import IntegrityError, transaction
from django.db.models.deletion import ProtectedError
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.decorators import action
from django.utils.text import slugify

from apps.auditing.services import register_audit_event
from apps.core.utils import protected_delete_message
from apps.users.permissions import RolePermission
from .models import Material, MaterialFamily, PriceList, PriceListItem
from .serializers import MaterialFamilySerializer, MaterialSerializer, PriceListItemSerializer, PriceListSerializer


class MaterialFamilyViewSet(viewsets.ModelViewSet):
    queryset = MaterialFamily.objects.all().order_by("code")
    serializer_class = MaterialFamilySerializer
    permission_classes = [IsAuthenticated, RolePermission]


class MaterialViewSet(viewsets.ModelViewSet):
    queryset = Material.objects.select_related("family").all().order_by("code")
    serializer_class = MaterialSerializer
    permission_classes = [IsAuthenticated, RolePermission]

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError as error:
            payload = protected_delete_message(f"el material {instance.code} · {instance.name}", error.protected_objects)
            return Response(payload, status=status.HTTP_400_BAD_REQUEST)


class PriceListViewSet(viewsets.ModelViewSet):
    queryset = PriceList.objects.select_related("collection_center", "linked_party").all().order_by("-valid_from")
    serializer_class = PriceListSerializer
    permission_classes = [IsAuthenticated, RolePermission]
    permission_action_map = {
        "duplicate": ["materials.add_pricelist", "materials.change_pricelist"],
    }

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.items.exists():
            payload = {
                "detail": f"No se puede eliminar la lista {instance.code} porque tiene partidas de precios registradas.",
                "dependencies": [{"model": "partida de precio", "count": instance.items.count()}],
            }
            return Response(payload, status=status.HTTP_400_BAD_REQUEST)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["post"])
    def duplicate(self, request, pk=None):
        source = self.get_object()
        linked_party_id = request.data.get("linked_party_id") or request.data.get("party_id")
        code = (request.data.get("code") or "").strip()
        name = (request.data.get("name") or "").strip()
        collection_center_id = request.data.get("collection_center") or source.collection_center_id
        currency = (request.data.get("currency") or source.currency).strip() or source.currency
        valid_from = request.data.get("valid_from") or source.valid_from
        valid_to = request.data.get("valid_to")
        is_active = request.data.get("is_active")

        if not linked_party_id:
            return Response({"detail": "linked_party_id es requerido."}, status=status.HTTP_400_BAD_REQUEST)

        if not code:
            code = slugify(f"{source.code}-{timezone.now():%Y%m%d%H%M%S}")[:50]
        if not name:
            name = f"{source.name} - Copia"
        if is_active is None:
            is_active = True
        if PriceList.objects.filter(linked_party_id=linked_party_id).exists():
            return Response({"detail": "Este cliente/empresa ya tiene una lista de precios asignada."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            try:
                duplicated = PriceList.objects.create(
                    code=code,
                    name=name,
                    collection_center_id=collection_center_id,
                    linked_party_id=linked_party_id,
                    currency=currency,
                    valid_from=valid_from,
                    valid_to=valid_to or None,
                    is_active=bool(is_active),
                )
                items = [
                    PriceListItem(
                        price_list=duplicated,
                        material=item.material,
                        unit_price=item.unit_price,
                        is_active=item.is_active,
                    )
                    for item in source.items.select_related("material").order_by("created_at", "id").all()
                ]
                PriceListItem.objects.bulk_create(items)
            except IntegrityError:
                return Response({"detail": "Este cliente/empresa ya tiene una lista de precios asignada."}, status=status.HTTP_400_BAD_REQUEST)

        register_audit_event(
            actor=request.user,
            action="duplicate_price_list",
            entity=duplicated,
            details={"source_price_list_id": str(source.id), "linked_party_id": str(linked_party_id)},
        )
        serializer = self.get_serializer(duplicated)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class PriceListItemViewSet(viewsets.ModelViewSet):
    queryset = PriceListItem.objects.select_related("price_list", "material").all()
    serializer_class = PriceListItemSerializer
    pagination_class = None
    permission_classes = [IsAuthenticated, RolePermission]

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError as error:
            payload = protected_delete_message(
                f"la partida {instance.price_list.code} · {instance.material.name}",
                error.protected_objects,
            )
            return Response(payload, status=status.HTTP_400_BAD_REQUEST)

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
    party_id = request.query_params.get("party_id")
    if not collection_center_id or not material_id:
        return Response({"detail": "collection_center_id y material_id son requeridos."}, status=400)

    today = timezone.localdate()
    base_filters = Q(
        price_list__collection_center_id=collection_center_id,
        price_list__is_active=True,
        price_list__valid_from__lte=today,
        material_id=material_id,
        is_active=True,
    ) & (Q(price_list__valid_to__isnull=True) | Q(price_list__valid_to__gte=today))

    query = PriceListItem.objects.select_related("price_list", "material")
    if party_id:
        price_list_item = (
            query.filter(base_filters, price_list__linked_party_id=party_id)
            .order_by("-price_list__valid_from", "-price_list__created_at", "-created_at")
            .first()
        )
        if not price_list_item:
            price_list_item = (
                query.filter(base_filters, price_list__linked_party__isnull=True)
                .order_by("-price_list__valid_from", "-price_list__created_at", "-created_at")
                .first()
            )
    else:
        price_list_item = (
            query.filter(base_filters)
            .order_by("-price_list__valid_from", "-price_list__created_at", "-created_at")
            .first()
        )

    if not price_list_item:
        return Response(
            {
                "found": False,
                "collection_center_id": collection_center_id,
                "material_id": material_id,
                "party_id": party_id,
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
                "party_id": party_id,
                "unit_price": str(price_list_item.unit_price),
                "price_list_id": str(price_list_item.price_list_id),
                "price_list_name": price_list_item.price_list.name,
                "price_list_party_id": str(price_list_item.price_list.linked_party_id) if price_list_item.price_list.linked_party_id else None,
                "price_list_party_name": price_list_item.price_list.linked_party.legal_name if price_list_item.price_list.linked_party else None,
                "currency": price_list_item.price_list.currency,
                "valid_from": price_list_item.price_list.valid_from,
                "valid_to": price_list_item.price_list.valid_to,
            }
    )
