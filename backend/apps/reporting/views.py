from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal

from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.commercialization.models import SaleItem, SaleOrder
from apps.inventory.models import InventoryMovement
from apps.logistics.models import CollectionTrip, CollectionTripIncident, CollectionTripTelemetryPoint
from apps.operations.models import PurchaseOperation, TicketItem


class BasicReportView(APIView):
    def get(self, request):
        confirmed_items = TicketItem.objects.filter(status=TicketItem.Status.CONFIRMED)
        operations = PurchaseOperation.objects.all()
        movements = InventoryMovement.objects.all()
        sales = SaleOrder.objects.all()
        sale_items = SaleItem.objects.all()
        trips = CollectionTrip.objects.all()
        incidents = CollectionTripIncident.objects.all()
        telemetry_points = CollectionTripTelemetryPoint.objects.all()

        total_weight_kg = sum((item.net_weight_kg for item in confirmed_items), Decimal("0"))
        total_merma_kg = sum((item.merma_kg for item in confirmed_items), Decimal("0"))
        total_revenue = sum((item.amount for item in confirmed_items), Decimal("0"))
        sale_revenue = sum((item.amount for item in sale_items), Decimal("0"))
        sale_cost = sum((item.estimated_cost for item in sale_items), Decimal("0"))
        sale_profit = sum((item.profit for item in sale_items), Decimal("0"))

        response_payload = {
            "operations_count": operations.count(),
            "confirmed_items_count": confirmed_items.count(),
            "recovered_kg": float(total_weight_kg),
            "recovered_tons": float(total_weight_kg / Decimal("1000")),
            "merma_kg": float(total_merma_kg),
            "total_revenue": float(total_revenue),
            "sale_orders_count": sales.count(),
            "sale_items_count": sale_items.count(),
            "sale_revenue": float(sale_revenue),
            "sale_cost": float(sale_cost),
            "sale_profit": float(sale_profit),
            "utility_estimate": float(sale_profit) if sale_items.exists() else None,
            "utility_note": "La utilidad se estima a partir de ventas registradas y costo promedio de inventario.",
            "inventory_movements_count": movements.count(),
            "pending_operations_count": operations.filter(status=PurchaseOperation.Status.OPEN).count(),
            "cancelled_operations_count": operations.filter(status=PurchaseOperation.Status.CANCELLED).count(),
            "sale_orders_pending": sales.filter(status=SaleOrder.Status.DRAFT).count(),
            "collection_trips_count": trips.count(),
            "collection_trips_departed": trips.filter(status=CollectionTrip.Status.DEPARTED).count(),
            "collection_trips_completed": trips.filter(status=CollectionTrip.Status.ARRIVED).count(),
            "collection_trips_closed": trips.filter(status=CollectionTrip.Status.CLOSED).count(),
            "collection_trip_incidents_count": incidents.count(),
            "collection_trip_incidents_open": incidents.filter(resolved=False).count(),
            "telemetry_points_count": telemetry_points.count(),
            "telemetry_distance_km": float(sum((trip.telemetry_distance_km for trip in trips), Decimal("0"))),
            "estimated_fuel_liters": float(sum((trip.estimated_fuel_liters for trip in trips), Decimal("0"))),
        }
        return Response(response_payload)


class DailyReportView(APIView):
    """
    Returns a daily operations summary with breakdowns by material family and by client.
    Accepts optional ?date=YYYY-MM-DD param; defaults to today.
    Also returns last 7 days trend.
    """

    def get(self, request):
        date_str = request.query_params.get("date")
        try:
            target_date = date.fromisoformat(date_str) if date_str else timezone.localdate()
        except ValueError:
            target_date = timezone.localdate()

        start_dt = timezone.make_aware(
            timezone.datetime.combine(target_date, timezone.datetime.min.time())
        )
        end_dt = start_dt + timedelta(days=1)

        day_ops = PurchaseOperation.objects.filter(
            created_at__gte=start_dt, created_at__lt=end_dt
        ).select_related("customer")

        day_items = list(
            TicketItem.objects.filter(
                operation__created_at__gte=start_dt,
                operation__created_at__lt=end_dt,
                status=TicketItem.Status.CONFIRMED,
            ).select_related("material__family", "operation")
        )

        ops_count = day_ops.count()
        total_weight = sum((item.net_weight_kg for item in day_items), Decimal("0"))
        total_merma = sum((item.merma_kg for item in day_items), Decimal("0"))
        total_revenue = sum((item.amount for item in day_items), Decimal("0"))

        by_family: dict[str, dict] = defaultdict(
            lambda: {"name": "", "weight_kg": Decimal("0"), "amount": Decimal("0"), "items_count": 0}
        )
        for item in day_items:
            fam_id = str(item.material.family.id)
            by_family[fam_id]["name"] = item.material.family.name
            by_family[fam_id]["weight_kg"] += item.net_weight_kg
            by_family[fam_id]["amount"] += item.amount
            by_family[fam_id]["items_count"] += 1

        family_breakdown = sorted(
            [
                {
                    "family_id": fid,
                    "name": data["name"],
                    "weight_kg": float(data["weight_kg"]),
                    "amount": float(data["amount"]),
                    "items_count": data["items_count"],
                }
                for fid, data in by_family.items()
            ],
            key=lambda x: x["weight_kg"],
            reverse=True,
        )

        items_by_op: dict[str, list] = defaultdict(list)
        for item in day_items:
            items_by_op[str(item.operation_id)].append(item)

        by_client: dict[str, dict] = defaultdict(
            lambda: {"name": "", "ops_count": 0, "weight_kg": Decimal("0"), "amount": Decimal("0")}
        )
        for op in day_ops:
            cid = str(op.customer_id) if op.customer_id else "no-client"
            by_client[cid]["name"] = (
                op.customer.trade_name or op.customer.legal_name if op.customer else "Sin cliente"
            )
            by_client[cid]["ops_count"] += 1
            op_items = items_by_op.get(str(op.id), [])
            by_client[cid]["weight_kg"] += sum((i.net_weight_kg for i in op_items), Decimal("0"))
            by_client[cid]["amount"] += sum((i.amount for i in op_items), Decimal("0"))

        client_breakdown = sorted(
            [
                {
                    "client_id": cid,
                    "name": data["name"],
                    "ops_count": data["ops_count"],
                    "weight_kg": float(data["weight_kg"]),
                    "amount": float(data["amount"]),
                }
                for cid, data in by_client.items()
            ],
            key=lambda x: x["amount"],
            reverse=True,
        )

        trend = []
        for i in range(6, -1, -1):
            d = target_date - timedelta(days=i)
            d_start = timezone.make_aware(
                timezone.datetime.combine(d, timezone.datetime.min.time())
            )
            d_end = d_start + timedelta(days=1)
            d_items = list(
                TicketItem.objects.filter(
                    operation__created_at__gte=d_start,
                    operation__created_at__lt=d_end,
                    status=TicketItem.Status.CONFIRMED,
                )
            )
            d_revenue = sum((item.amount for item in d_items), Decimal("0"))
            d_weight = sum((item.net_weight_kg for item in d_items), Decimal("0"))
            trend.append(
                {
                    "date": d.isoformat(),
                    "label": d.strftime("%d/%m"),
                    "revenue": float(d_revenue),
                    "weight_kg": float(d_weight),
                    "ops_count": PurchaseOperation.objects.filter(
                        created_at__gte=d_start, created_at__lt=d_end
                    ).count(),
                }
            )

        return Response(
            {
                "date": target_date.isoformat(),
                "ops_count": ops_count,
                "total_weight_kg": float(total_weight),
                "total_merma_kg": float(total_merma),
                "total_revenue": float(total_revenue),
                "by_family": family_breakdown,
                "by_client": client_breakdown,
                "trend_7d": trend,
            }
        )
