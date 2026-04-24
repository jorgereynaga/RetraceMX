from rest_framework import viewsets

from .models import InventoryMovement
from .serializers import InventoryMovementSerializer


class InventoryMovementViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = InventoryMovement.objects.select_related("operation", "ticket_item", "material", "collection_center").all().order_by("-occurred_at")
    serializer_class = InventoryMovementSerializer

