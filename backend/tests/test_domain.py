from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError

from apps.auditing.models import AuditLog
from apps.commercialization.models import SaleOrder
from apps.commercialization.services import add_sale_item, close_sale_order, register_sale_order
from apps.evidence.services import register_print_event
from apps.inventory.models import InventoryMovement
from apps.logistics.models import Route
from apps.logistics.services import change_trip_status, close_collection_trip, open_collection_trip, register_trip_incident, resolve_trip_incident
from apps.materials.models import Material, MaterialFamily
from apps.operations.models import PurchaseOperation, TicketItem
from apps.operations.services import (
    apply_tare_or_merma,
    calculate_ticket_item_amount,
    change_operation_status,
    open_purchase_operation,
    recalculate_operation_total,
    register_ticket_item,
    update_ticket_item,
)
from apps.parties.models import CollectionCenter, PersonOrCompany
from apps.payments.services import register_payment


pytestmark = pytest.mark.django_db


def build_user():
    user_model = get_user_model()
    return user_model.objects.create_user(username="operator", email="operator@example.com", password="testpass123")


def build_context():
    user = build_user()
    center = CollectionCenter.objects.create(code="matriz", name="Centro Matriz")
    customer = PersonOrCompany.objects.create(kind=PersonOrCompany.Kind.COMPANY, legal_name="Cliente SA de CV")
    family = MaterialFamily.objects.create(code="pet", name="PET")
    material = Material.objects.create(code="pet-claro", name="PET Claro", family=family)
    operation = open_purchase_operation(collection_center=center, customer=customer, opened_by=user)
    return user, center, customer, material, operation


def build_route(center):
    other_center = CollectionCenter.objects.create(code="destino", name="Centro Destino")
    return Route.objects.create(code="ruta-demo", name="Ruta Demo", origin_center=center, destination_center=other_center)


def test_calculate_differential_weight_and_merma_validation():
    assert apply_tare_or_merma(Decimal("100.000"), Decimal("5.000")) == Decimal("95.000")
    with pytest.raises(ValidationError):
        apply_tare_or_merma(Decimal("5.000"), Decimal("6.000"))


def test_calculate_ticket_item_amount():
    user, center, customer, material, operation = build_context()
    item = TicketItem.objects.create(
        operation=operation,
        material=material,
        method=TicketItem.Method.SECONDARY_DIRECT,
        gross_weight_kg=Decimal("10"),
        tare_weight_kg=Decimal("0"),
        net_weight_kg=Decimal("10"),
        merma_kg=Decimal("0"),
        unit_price=Decimal("12.50"),
    )
    assert calculate_ticket_item_amount(item) == Decimal("125.00")


def test_total_ticket_and_status_transition():
    user, center, customer, material, operation = build_context()
    register_ticket_item(
        operation=operation,
        material=material,
        method=TicketItem.Method.SECONDARY_DIRECT,
        unit_price=Decimal("10.00"),
        gross_weight_kg=Decimal("10"),
        merma_kg=Decimal("1"),
        user=user,
    )
    register_ticket_item(
        operation=operation,
        material=material,
        method=TicketItem.Method.SECONDARY_DIRECT,
        unit_price=Decimal("8.00"),
        gross_weight_kg=Decimal("5"),
        merma_kg=Decimal("0"),
        user=user,
    )

    recalculate_operation_total(operation)
    operation.refresh_from_db()

    assert operation.total_weight_kg == Decimal("14")
    assert operation.total_merma_kg == Decimal("1")
    assert operation.total_amount == Decimal("130.00")

    change_operation_status(operation, PurchaseOperation.Status.CONFIRMED, user=user, reason="validated")
    operation.refresh_from_db()
    assert operation.status == PurchaseOperation.Status.CONFIRMED

    register_payment(operation=operation, amount=Decimal("130.00"), method="cash", received_by=user)
    operation.refresh_from_db()
    assert operation.payment_status == PurchaseOperation.PaymentStatus.PAID

    change_operation_status(operation, PurchaseOperation.Status.COMPLETED, user=user, reason="closed")
    operation.refresh_from_db()
    assert operation.status == PurchaseOperation.Status.COMPLETED
    assert operation.closed_by == user

    with pytest.raises(ValidationError):
        change_operation_status(operation, PurchaseOperation.Status.OPEN, user=user, reason="invalid reopen")


def test_inventory_generation_and_audit_log():
    user, center, customer, material, operation = build_context()
    item = register_ticket_item(
        operation=operation,
        material=material,
        method=TicketItem.Method.SECONDARY_DIRECT,
        unit_price=Decimal("7.00"),
        gross_weight_kg=Decimal("4"),
        merma_kg=Decimal("0"),
        user=user,
    )
    assert InventoryMovement.objects.filter(ticket_item=item).exists()
    assert AuditLog.objects.filter(action="create_inventory_movement").exists()


def test_ticket_item_can_be_edited_before_print():
    user, center, customer, material, operation = build_context()
    item = register_ticket_item(
        operation=operation,
        material=material,
        method=TicketItem.Method.SECONDARY_DIRECT,
        unit_price=Decimal("7.00"),
        gross_weight_kg=Decimal("10"),
        merma_kg=Decimal("0"),
        user=user,
    )
    updated = update_ticket_item(
        ticket_item=item,
        user=user,
        gross_weight_kg=Decimal("12"),
        merma_kg=Decimal("1"),
        unit_price=Decimal("8.50"),
        notes="Correccion antes de imprimir",
    )
    updated.refresh_from_db()
    assert updated.net_weight_kg == Decimal("11")
    assert updated.amount == Decimal("93.50")
    assert AuditLog.objects.filter(action="edit_ticket_item_before_print", entity_id=str(updated.pk)).exists()


def test_ticket_item_adjustment_after_print_updates_audit_and_inventory():
    user, center, customer, material, operation = build_context()
    item = register_ticket_item(
        operation=operation,
        material=material,
        method=TicketItem.Method.SECONDARY_DIRECT,
        unit_price=Decimal("7.00"),
        gross_weight_kg=Decimal("10"),
        merma_kg=Decimal("0"),
        user=user,
    )
    operation.print_status = PurchaseOperation.PrintStatus.PRINTED
    operation.save(update_fields=["print_status", "updated_at"])
    updated = update_ticket_item(
        ticket_item=item,
        user=user,
        gross_weight_kg=Decimal("9"),
        merma_kg=Decimal("0"),
        unit_price=Decimal("9.00"),
        notes="Ajuste posterior a impresion",
        reason="Diferencia detectada en revisión",
        after_print=True,
    )
    updated.refresh_from_db()
    operation.refresh_from_db()
    assert updated.amount == Decimal("81.00")
    assert operation.print_status == PurchaseOperation.PrintStatus.REPRINTED
    assert AuditLog.objects.filter(action="adjust_ticket_item_after_print", entity_id=str(updated.pk)).exists()
    assert InventoryMovement.objects.filter(ticket_item=updated, movement_type=InventoryMovement.MovementType.ADJUSTMENT).exists()


def test_payment_requires_valid_items():
    user, center, customer, material, operation = build_context()
    with pytest.raises(ValidationError):
        register_payment(operation=operation, amount=Decimal("10.00"), method="cash", received_by=user)


def test_payment_updates_status_and_print_event():
    user, center, customer, material, operation = build_context()
    register_ticket_item(
        operation=operation,
        material=material,
        method=TicketItem.Method.SECONDARY_DIRECT,
        unit_price=Decimal("7.00"),
        gross_weight_kg=Decimal("10"),
        merma_kg=Decimal("0"),
        user=user,
    )
    operation.refresh_from_db()
    payment = register_payment(operation=operation, amount=Decimal("70.00"), method="cash", received_by=user)
    operation.refresh_from_db()
    assert payment.amount == Decimal("70.00")
    assert operation.payment_status == PurchaseOperation.PaymentStatus.PAID

    log = register_print_event(operation=operation, printed_by=user, printer_name="SimPrinter", copies=1)
    assert log.is_reprint is False


def test_payment_overflow_and_completion_requires_paid_status():
    user, center, customer, material, operation = build_context()
    register_ticket_item(
        operation=operation,
        material=material,
        method=TicketItem.Method.SECONDARY_DIRECT,
        unit_price=Decimal("10.00"),
        gross_weight_kg=Decimal("10"),
        merma_kg=Decimal("0"),
        user=user,
    )

    with pytest.raises(ValidationError):
        register_payment(operation=operation, amount=Decimal("150.00"), method="cash", received_by=user)

    with pytest.raises(ValidationError):
        change_operation_status(operation, PurchaseOperation.Status.COMPLETED, user=user, reason="not paid yet")


def test_sale_order_closes_and_reduces_stock():
    user, center, customer, material, operation = build_context()
    register_ticket_item(
        operation=operation,
        material=material,
        method=TicketItem.Method.SECONDARY_DIRECT,
        unit_price=Decimal("10.00"),
        gross_weight_kg=Decimal("20"),
        merma_kg=Decimal("0"),
        user=user,
    )

    sale_order = register_sale_order(collection_center=center, buyer=customer, created_by=user, notes="Venta demo")
    sale_item = add_sale_item(
        sale_order=sale_order,
        material=material,
        quantity_kg=Decimal("5"),
        unit_price=Decimal("15.00"),
        user=user,
    )
    sale_order.refresh_from_db()

    assert sale_item.amount == Decimal("75.00")
    assert sale_order.total_amount == Decimal("75.00")
    assert sale_order.total_profit >= Decimal("0")
    assert InventoryMovement.objects.filter(sale_order=sale_order, sale_item=sale_item).exists()

    closed = close_sale_order(sale_order, user=user)
    assert closed.status == SaleOrder.Status.COMPLETED


def test_sale_order_requires_items_to_close():
    user, center, customer, material, operation = build_context()
    sale_order = register_sale_order(collection_center=center, buyer=customer, created_by=user, notes="Venta vacia")
    with pytest.raises(ValidationError):
        close_sale_order(sale_order, user=user)


def test_trip_incident_must_be_resolved_before_close():
    user, center, customer, material, operation = build_context()
    route = build_route(center)
    trip = open_collection_trip(route=route, operator=user)

    incident = register_trip_incident(trip=trip, title="Llantas bajas", user=user, description="Revisar presion", severity="high")
    assert incident.resolved is False

    with pytest.raises(ValidationError):
        close_collection_trip(trip=trip, user=user, notes="Intento con incidencia abierta")

    resolved = resolve_trip_incident(incident=incident, user=user, notes="Presion corregida")
    assert resolved.resolved is True

    change_trip_status(trip, "departed", user=user, notes="Salida a ruta")
    change_trip_status(trip, "arrived", user=user, notes="Arribo a destino")
    closed = close_collection_trip(trip=trip, user=user, notes="Ruta finalizada")
    assert closed.status == "closed"
