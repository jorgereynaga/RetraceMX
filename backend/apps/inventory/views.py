from __future__ import annotations

from collections import defaultdict
from decimal import Decimal

from django.shortcuts import get_object_or_404
from rest_framework import decorators, response, status, viewsets
from rest_framework.permissions import IsAuthenticated

from apps.auditing.services import register_audit_event
from apps.materials.models import Material
from apps.parties.models import CollectionCenter
from apps.users.permissions import RolePermission

from .models import InventoryMovement
from .serializers import InventoryMovementAdjustmentSerializer, InventoryMovementSerializer
from .services import create_inventory_movement


class InventoryMovementViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = InventoryMovement.objects.select_related("operation", "ticket_item", "sale_order", "sale_item", "material", "collection_center", "created_by").all().order_by("-occurred_at")
    serializer_class = InventoryMovementSerializer
    filterset_fields = ["collection_center", "material", "movement_type"]
    search_fields = ["material__name", "material__code", "collection_center__name", "notes"]
    permission_classes = [IsAuthenticated, RolePermission]
    permission_action_map = {
        "summary": ["inventory.view_inventorymovement"],
        "adjust": ["inventory.add_inventorymovement"],
    }

    @decorators.action(detail=False, methods=["get"])
    def summary(self, request):
        queryset = self.filter_queryset(self.get_queryset()).order_by("collection_center__name", "material__name", "occurred_at")
        totals = {
            "movements_count": 0,
            "inbound_count": 0,
            "outbound_count": 0,
            "adjustment_count": 0,
        }
        buckets: dict[tuple[str, str], dict] = defaultdict(
            lambda: {
                "collection_center_id": "",
                "collection_center_name": "",
                "material_id": "",
                "material_name": "",
                "inbound_kg": Decimal("0"),
                "outbound_kg": Decimal("0"),
                "adjustment_kg": Decimal("0"),
                "balance_kg": Decimal("0"),
                "last_movement_at": None,
                "movements_count": 0,
            }
        )
        for movement in queryset:
            key = (str(movement.collection_center_id), str(movement.material_id))
            bucket = buckets[key]
            bucket["collection_center_id"] = str(movement.collection_center_id)
            bucket["collection_center_name"] = movement.collection_center.name if movement.collection_center else ""
            bucket["material_id"] = str(movement.material_id)
            bucket["material_name"] = str(movement.material) if movement.material else ""
            bucket["movements_count"] += 1
            bucket["last_movement_at"] = movement.occurred_at.isoformat()
            totals["movements_count"] += 1

            qty = Decimal(movement.quantity_kg or 0)
            if movement.movement_type == InventoryMovement.MovementType.INBOUND:
                bucket["inbound_kg"] += qty
                totals["inbound_count"] += 1
            elif movement.movement_type == InventoryMovement.MovementType.OUTBOUND:
                bucket["outbound_kg"] += qty
                totals["outbound_count"] += 1
            else:
                bucket["adjustment_kg"] += qty
                totals["adjustment_count"] += 1

        balances = []
        for bucket in buckets.values():
            bucket["balance_kg"] = bucket["inbound_kg"] + bucket["adjustment_kg"] - bucket["outbound_kg"]
            balances.append(
                {
                    **bucket,
                    "inbound_kg": str(bucket["inbound_kg"]),
                    "outbound_kg": str(bucket["outbound_kg"]),
                    "adjustment_kg": str(bucket["adjustment_kg"]),
                    "balance_kg": str(bucket["balance_kg"]),
                }
            )

        balances.sort(key=lambda row: (row["collection_center_name"], row["material_name"]))
        totals["stock_kg"] = str(sum((Decimal(row["balance_kg"]) for row in balances), Decimal("0")))
        totals["positive_balances"] = sum(1 for row in balances if Decimal(row["balance_kg"]) > 0)
        totals["negative_balances"] = sum(1 for row in balances if Decimal(row["balance_kg"]) < 0)
        return response.Response({"totals": totals, "balances": balances})

    @decorators.action(detail=False, methods=["post"])
    def adjust(self, request):
        serializer = InventoryMovementAdjustmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        collection_center = get_object_or_404(CollectionCenter, pk=serializer.validated_data["collection_center"])
        material = get_object_or_404(Material, pk=serializer.validated_data["material"])
        delta_kg = Decimal(serializer.validated_data["delta_kg"])
        unit_price = Decimal(serializer.validated_data.get("unit_price") or 0)
        quantity_kg = delta_kg
        amount = (quantity_kg * unit_price).quantize(Decimal("0.01"))
        movement = create_inventory_movement(
            user=request.user,
            movement_type=InventoryMovement.MovementType.ADJUSTMENT,
            material=material,
            collection_center=collection_center,
            quantity_kg=quantity_kg,
            unit_price=unit_price,
            amount=amount,
            notes=serializer.validated_data.get("notes", ""),
        )
        register_audit_event(
            actor=request.user,
            action="adjust_inventory",
            entity=movement,
            details={
                "collection_center": str(collection_center.pk),
                "material": str(material.pk),
                "delta_kg": str(delta_kg),
                "unit_price": str(unit_price),
                "amount": str(amount),
            },
        )
        return response.Response(self.get_serializer(movement).data, status=status.HTTP_201_CREATED)
