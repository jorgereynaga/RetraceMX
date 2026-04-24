from decimal import Decimal

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
