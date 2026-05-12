from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Q, Sum
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.commercialization.models import SaleItem, SaleOrder
from apps.inventory.models import InventoryMovement
from apps.inventory.services import ADJUSTMENT_TYPES, INBOUND_TYPES, OUTBOUND_TYPES
from apps.processing.models import MaterialProcess, MaterialProcessOutput
from apps.logistics.models import CollectionTrip, CollectionTripIncident, CollectionTripTelemetryPoint
from apps.operations.models import PurchaseOperation, TicketItem


def _movement_balance_kg(queryset):
    inventory_balance = queryset.aggregate(
        inbound_kg=Coalesce(Sum("quantity_kg", filter=Q(movement_type__in=INBOUND_TYPES)), Decimal("0")),
        outbound_kg=Coalesce(Sum("quantity_kg", filter=Q(movement_type__in=OUTBOUND_TYPES)), Decimal("0")),
        adjustment_kg=Coalesce(Sum("quantity_kg", filter=Q(movement_type__in=ADJUSTMENT_TYPES)), Decimal("0")),
    )
    return Decimal(inventory_balance["inbound_kg"]) + Decimal(inventory_balance["adjustment_kg"]) - Decimal(inventory_balance["outbound_kg"])


class BasicReportView(APIView):
    def get(self, request):
        confirmed_items = TicketItem.objects.filter(
            status=TicketItem.Status.CONFIRMED,
            operation__payment_status=PurchaseOperation.PaymentStatus.PAID,
        )
        operations = PurchaseOperation.objects.all()
        movements = InventoryMovement.objects.all()
        sales = SaleOrder.objects.all()
        sale_items = SaleItem.objects.all()
        processes = MaterialProcess.objects.all()
        trips = CollectionTrip.objects.all()
        incidents = CollectionTripIncident.objects.all()
        telemetry_points = CollectionTripTelemetryPoint.objects.all()
        inventory_current_kg = _movement_balance_kg(movements)
        raw_inventory_current_kg = _movement_balance_kg(movements.filter(material__is_processed=False))
        processed_inventory_current_kg = _movement_balance_kg(movements.filter(material__is_processed=True))
        total_weight_kg = sum((item.net_weight_kg for item in confirmed_items), Decimal("0"))
        total_merma_kg = sum((item.merma_kg for item in confirmed_items), Decimal("0"))
        total_revenue = sum((item.amount for item in confirmed_items), Decimal("0"))
        sale_revenue = sum((item.amount for item in sale_items), Decimal("0"))
        sale_cost = sum((item.estimated_cost for item in sale_items), Decimal("0"))
        sale_profit = sum((item.profit for item in sale_items), Decimal("0"))
        process_confirmed = list(
            processes.filter(status=MaterialProcess.Status.CONFIRMED).prefetch_related("inputs", "outputs", "wastes")
        )
        process_input_kg = sum((item.quantity for proc in process_confirmed for item in proc.inputs.all()), Decimal("0"))
        process_output_kg = sum((item.quantity for proc in process_confirmed for item in proc.outputs.all()), Decimal("0"))
        process_waste_kg = sum((item.quantity for proc in process_confirmed for item in proc.wastes.all()), Decimal("0"))
        process_yield_pct = (
            (process_output_kg / process_input_kg) * Decimal("100")
            if process_input_kg > 0
            else Decimal("0")
        )
        purchase_sale_balance_kg = total_weight_kg - sale_items.aggregate(total=Coalesce(Sum("quantity_kg"), Decimal("0")))["total"]
        sale_processed_kg = sum((item.quantity_kg for item in sale_items if getattr(item.material, "is_processed", False)), Decimal("0"))
        sale_raw_kg = sum((item.quantity_kg for item in sale_items if not getattr(item.material, "is_processed", False)), Decimal("0"))
        sale_processed_amount = sum((item.amount for item in sale_items if getattr(item.material, "is_processed", False)), Decimal("0"))
        sale_raw_amount = sum((item.amount for item in sale_items if not getattr(item.material, "is_processed", False)), Decimal("0"))

        response_payload = {
            "operations_count": operations.count(),
            "confirmed_items_count": confirmed_items.count(),
            "recovered_kg": float(total_weight_kg),
            "recovered_tons": float(total_weight_kg / Decimal("1000")),
            "merma_kg": float(total_merma_kg),
            "total_revenue": float(total_revenue),
            "volume_received_kg": float(total_weight_kg),
            "volume_sold_kg": float(sum((item.quantity_kg for item in sale_items), Decimal("0"))),
            "inventory_current_kg": float(inventory_current_kg),
            "raw_inventory_current_kg": float(raw_inventory_current_kg),
            "processed_inventory_current_kg": float(processed_inventory_current_kg),
            "processes_count": len(process_confirmed),
            "process_input_kg": float(process_input_kg),
            "process_output_kg": float(process_output_kg),
            "process_waste_kg": float(process_waste_kg),
            "process_yield_pct": float(process_yield_pct),
            "sale_orders_count": sales.count(),
            "sale_items_count": sale_items.count(),
            "sale_revenue": float(sale_revenue),
            "sale_cost": float(sale_cost),
            "sale_profit": float(sale_profit),
            "sale_processed_kg": float(sale_processed_kg),
            "sale_raw_kg": float(sale_raw_kg),
            "sale_processed_amount": float(sale_processed_amount),
            "sale_raw_amount": float(sale_raw_amount),
            "purchases_vs_sales": {
                "purchase_amount": float(total_revenue),
                "sale_amount": float(sale_revenue),
                "balance_amount": float(sale_revenue - total_revenue),
            },
            "utility_estimate": float(sale_profit) if sale_items.exists() else None,
            "utility_note": "La utilidad se estima a partir de ventas registradas y costo promedio de inventario.",
            "purchase_vs_sales_kg_balance": float(purchase_sale_balance_kg),
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

        confirmed_day_ops = PurchaseOperation.objects.filter(
            confirmed_at__gte=start_dt,
            confirmed_at__lt=end_dt,
            payment_status=PurchaseOperation.PaymentStatus.PAID,
            status__in=[PurchaseOperation.Status.CONFIRMED, PurchaseOperation.Status.COMPLETED],
        ).select_related("customer")

        day_items = list(
            TicketItem.objects.filter(
                operation__confirmed_at__gte=start_dt,
                operation__confirmed_at__lt=end_dt,
                status=TicketItem.Status.CONFIRMED,
                operation__payment_status=PurchaseOperation.PaymentStatus.PAID,
            ).select_related("material__family", "operation")
        )
        day_sales = list(
            SaleItem.objects.filter(
                sale_order__sold_at__gte=start_dt,
                sale_order__sold_at__lt=end_dt,
                sale_order__status__in=[
                    SaleOrder.Status.CONFIRMED,
                    SaleOrder.Status.SENT_TO_CASHIER,
                    SaleOrder.Status.SCHEDULED_DELIVERY,
                    SaleOrder.Status.LOADING,
                    SaleOrder.Status.IN_ROUTE,
                    SaleOrder.Status.DELIVERED,
                    SaleOrder.Status.COMPLETED,
                    SaleOrder.Status.PAID,
                    SaleOrder.Status.CREDIT,
                    SaleOrder.Status.CLOSED,
                    SaleOrder.Status.ADJUSTED,
                ],
            ).select_related("sale_order", "material")
        )
        day_processes = list(
            MaterialProcess.objects.filter(
                process_date__gte=start_dt,
                process_date__lt=end_dt,
                status=MaterialProcess.Status.CONFIRMED,
            ).prefetch_related("inputs", "outputs", "wastes")
        )
        inventory_balance = InventoryMovement.objects.aggregate(
            inbound_kg=Coalesce(Sum("quantity_kg", filter=Q(movement_type__in=INBOUND_TYPES)), Decimal("0")),
            outbound_kg=Coalesce(Sum("quantity_kg", filter=Q(movement_type__in=OUTBOUND_TYPES)), Decimal("0")),
            adjustment_kg=Coalesce(Sum("quantity_kg", filter=Q(movement_type__in=ADJUSTMENT_TYPES)), Decimal("0")),
        )
        inventory_current_kg = (
            Decimal(inventory_balance["inbound_kg"]) + Decimal(inventory_balance["adjustment_kg"]) - Decimal(inventory_balance["outbound_kg"])
        )
        raw_inventory_current_kg = _movement_balance_kg(InventoryMovement.objects.filter(material__is_processed=False))
        processed_inventory_current_kg = _movement_balance_kg(InventoryMovement.objects.filter(material__is_processed=True))

        ops_count = confirmed_day_ops.count()
        total_weight = sum((item.net_weight_kg for item in day_items), Decimal("0"))
        total_merma = sum((item.merma_kg for item in day_items), Decimal("0"))
        total_revenue = sum((item.amount for item in day_items), Decimal("0"))
        sale_weight = sum((item.quantity_kg for item in day_sales), Decimal("0"))
        sale_revenue = sum((item.amount for item in day_sales), Decimal("0"))
        process_input_kg = sum((item.quantity for proc in day_processes for item in proc.inputs.all()), Decimal("0"))
        process_output_kg = sum((item.quantity for proc in day_processes for item in proc.outputs.all()), Decimal("0"))
        process_waste_kg = sum((item.quantity for proc in day_processes for item in proc.wastes.all()), Decimal("0"))
        process_yield_pct = (process_output_kg / process_input_kg) * Decimal("100") if process_input_kg > 0 else Decimal("0")
        sale_processed_kg = sum((item.quantity_kg for item in day_sales if getattr(item.material, "is_processed", False)), Decimal("0"))
        sale_raw_kg = sum((item.quantity_kg for item in day_sales if not getattr(item.material, "is_processed", False)), Decimal("0"))
        sale_processed_amount = sum((item.amount for item in day_sales if getattr(item.material, "is_processed", False)), Decimal("0"))
        sale_raw_amount = sum((item.amount for item in day_sales if not getattr(item.material, "is_processed", False)), Decimal("0"))

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
        for op in confirmed_day_ops:
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
                    operation__confirmed_at__gte=d_start,
                    operation__confirmed_at__lt=d_end,
                    status=TicketItem.Status.CONFIRMED,
                    operation__payment_status=PurchaseOperation.PaymentStatus.PAID,
                )
            )
            d_sales = list(
                SaleItem.objects.filter(
                    sale_order__sold_at__gte=d_start,
                    sale_order__sold_at__lt=d_end,
                    sale_order__status__in=[
                        SaleOrder.Status.CONFIRMED,
                        SaleOrder.Status.SENT_TO_CASHIER,
                        SaleOrder.Status.SCHEDULED_DELIVERY,
                        SaleOrder.Status.LOADING,
                        SaleOrder.Status.IN_ROUTE,
                        SaleOrder.Status.DELIVERED,
                        SaleOrder.Status.COMPLETED,
                        SaleOrder.Status.PAID,
                        SaleOrder.Status.CREDIT,
                        SaleOrder.Status.CLOSED,
                        SaleOrder.Status.ADJUSTED,
                    ],
                )
            )
            d_purchase_revenue = sum((item.amount for item in d_items), Decimal("0"))
            d_purchase_weight = sum((item.net_weight_kg for item in d_items), Decimal("0"))
            d_sale_revenue = sum((item.amount for item in d_sales), Decimal("0"))
            d_sale_weight = sum((item.quantity_kg for item in d_sales), Decimal("0"))
            trend.append(
                {
                    "date": d.isoformat(),
                    "label": d.strftime("%d/%m"),
                    "purchase_revenue": float(d_purchase_revenue),
                    "purchase_weight_kg": float(d_purchase_weight),
                    "sale_revenue": float(d_sale_revenue),
                    "sale_weight_kg": float(d_sale_weight),
                    "purchase_ops_count": PurchaseOperation.objects.filter(
                        confirmed_at__gte=d_start,
                        confirmed_at__lt=d_end,
                        payment_status=PurchaseOperation.PaymentStatus.PAID,
                        status__in=[PurchaseOperation.Status.CONFIRMED, PurchaseOperation.Status.COMPLETED],
                    ).count(),
                    "sale_orders_count": SaleOrder.objects.filter(
                        sold_at__gte=d_start,
                        sold_at__lt=d_end,
                        status__in=[
                            SaleOrder.Status.CONFIRMED,
                            SaleOrder.Status.SENT_TO_CASHIER,
                            SaleOrder.Status.SCHEDULED_DELIVERY,
                            SaleOrder.Status.LOADING,
                            SaleOrder.Status.IN_ROUTE,
                            SaleOrder.Status.DELIVERED,
                            SaleOrder.Status.COMPLETED,
                            SaleOrder.Status.PAID,
                            SaleOrder.Status.CREDIT,
                            SaleOrder.Status.CLOSED,
                            SaleOrder.Status.ADJUSTED,
                        ],
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
                "volume_received_kg": float(total_weight),
                "volume_sold_kg": float(sale_weight),
                "sale_revenue": float(sale_revenue),
                "inventory_current_kg": float(inventory_current_kg),
                "raw_inventory_current_kg": float(raw_inventory_current_kg),
                "processed_inventory_current_kg": float(processed_inventory_current_kg),
                "processes_count": len(day_processes),
                "process_input_kg": float(process_input_kg),
                "process_output_kg": float(process_output_kg),
                "process_waste_kg": float(process_waste_kg),
                "process_yield_pct": float(process_yield_pct),
                "sale_processed_kg": float(sale_processed_kg),
                "sale_raw_kg": float(sale_raw_kg),
                "sale_processed_amount": float(sale_processed_amount),
                "sale_raw_amount": float(sale_raw_amount),
                "purchase_vs_sales_kg_balance": float(total_weight - sale_weight),
                "purchases_vs_sales": {
                    "purchase_amount": float(total_revenue),
                    "sale_amount": float(sale_revenue),
                    "balance_amount": float(sale_revenue - total_revenue),
                },
                "by_family": family_breakdown,
                "by_client": client_breakdown,
                "trend_7d": trend,
            }
        )


class LotTraceReportView(APIView):
    """
    Traces a material lot across processing, inventory and sales using the lot code as a shared identifier.
    """

    def get(self, request):
        lot_code = (request.query_params.get("lot_code") or "").strip()
        if not lot_code:
            return Response({"detail": "lot_code es requerido."}, status=400)

        process_outputs = list(
            MaterialProcessOutput.objects.select_related(
                "process",
                "process__process_type",
                "process__collection_center",
                "material",
            )
            .filter(lot_code=lot_code)
            .order_by("created_at")
        )
        processes = []
        seen_process_ids = set()
        for output in process_outputs:
            if output.process_id in seen_process_ids:
                continue
            seen_process_ids.add(output.process_id)
            processes.append(output.process)

        sale_items = list(
            SaleItem.objects.select_related(
                "sale_order",
                "sale_order__collection_center",
                "material",
            )
            .filter(lot_code=lot_code)
            .order_by("created_at")
        )
        inventory_movements = list(
            InventoryMovement.objects.select_related(
                "material",
                "collection_center",
                "process",
                "process_output",
                "sale_order",
                "sale_item",
            )
            .filter(lot_code=lot_code)
            .order_by("occurred_at")
        )
        related_processes_payload = []
        for process in processes:
            related_processes_payload.append(
                {
                    "id": str(process.id),
                    "folio": process.folio,
                    "process_type": process.process_type.name,
                    "collection_center": process.collection_center.name,
                    "status": process.status,
                    "process_date": process.process_date.isoformat(),
                    "notes": process.notes,
                    "inputs": [
                        {
                            "material": str(row.material_id),
                            "material_name": row.material.name,
                            "quantity": str(row.quantity),
                            "unit": row.unit,
                            "source_inventory_reference": row.source_inventory_reference,
                        }
                        for row in process.inputs.select_related("material").all()
                    ],
                    "outputs": [
                        {
                            "material": str(row.material_id),
                            "material_name": row.material.name,
                            "quantity": str(row.quantity),
                            "unit": row.unit,
                            "lot_code": row.lot_code,
                        }
                        for row in process.outputs.select_related("material").all()
                    ],
                    "wastes": [
                        {
                            "material": str(row.material_id) if row.material_id else None,
                            "material_name": row.material.name if row.material else None,
                            "waste_type": row.waste_type,
                            "waste_type_label": row.get_waste_type_display(),
                            "quantity": str(row.quantity),
                            "unit": row.unit,
                            "notes": row.notes,
                        }
                        for row in process.wastes.select_related("material").all()
                    ],
                }
            )

        return Response(
            {
                "lot_code": lot_code,
                "process_outputs": [
                    {
                        "id": str(output.id),
                        "process_folio": output.process.folio,
                        "process_type": output.process.process_type.name,
                        "collection_center": output.process.collection_center.name,
                        "material": str(output.material_id),
                        "material_name": output.material.name,
                        "quantity": str(output.quantity),
                        "unit": output.unit,
                        "lot_code": output.lot_code,
                        "created_at": output.created_at.isoformat() if output.created_at else None,
                    }
                    for output in process_outputs
                ],
                "sale_items": [
                    {
                        "id": str(item.id),
                        "sale_order": str(item.sale_order_id),
                        "sale_folio": item.sale_order.folio,
                        "collection_center": item.sale_order.collection_center.name,
                        "material": str(item.material_id),
                        "material_name": item.material.name,
                        "quantity_kg": str(item.quantity_kg),
                        "unit_price": str(item.unit_price),
                        "amount": str(item.amount),
                        "lot_code": item.lot_code,
                    }
                    for item in sale_items
                ],
                "inventory_movements": [
                    {
                        "id": str(movement.id),
                        "movement_type": movement.movement_type,
                        "movement_type_label": movement.get_movement_type_display(),
                        "material": str(movement.material_id),
                        "material_name": movement.material.name,
                        "collection_center": str(movement.collection_center_id),
                        "collection_center_name": movement.collection_center.name,
                        "quantity_kg": str(movement.quantity_kg),
                        "amount": str(movement.amount),
                        "source_reference": movement.source_reference,
                        "lot_code": movement.lot_code,
                        "occurred_at": movement.occurred_at.isoformat(),
                    }
                    for movement in inventory_movements
                ],
                "processes": related_processes_payload,
            }
        )
