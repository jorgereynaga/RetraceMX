from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError

from apps.commercialization.models import SaleOrder
from apps.commercialization.services import add_sale_item, close_sale_order, register_sale_order
from apps.inventory.models import InventoryMovement
from apps.inventory.services import get_available_stock
from apps.materials.models import Material, MaterialFamily
from apps.operations.models import TicketItem
from apps.operations.services import open_purchase_operation, register_ticket_item
from apps.parties.models import CollectionCenter, PersonOrCompany
from apps.payments.services import register_payment
from apps.processing.models import MaterialProcessWaste, ProcessType
from apps.processing.services import (
    add_process_input,
    add_process_output,
    add_process_waste,
    cancel_material_process,
    confirm_material_process,
    create_material_process,
)


pytestmark = pytest.mark.django_db


def build_user(username="operator", *, staff=False):
    from django.contrib.auth import get_user_model

    user_model = get_user_model()
    user = user_model.objects.create_user(username=username, email=f"{username}@example.com", password="testpass123")
    user.is_staff = staff
    user.save(update_fields=["is_staff"])
    return user


def build_catalog():
    center = CollectionCenter.objects.create(code="matriz", name="Centro Matriz")
    customer = PersonOrCompany.objects.create(kind=PersonOrCompany.Kind.COMPANY, legal_name="Cliente SA de CV")
    family_raw = MaterialFamily.objects.create(code="scrap", name="Chatarra")
    family_proc = MaterialFamily.objects.create(code="processed", name="Procesado")
    raw_material = Material.objects.create(code="pet-raw", name="PET Crudo", family=family_raw, is_buyable=True, is_sellable=True, is_processable=True)
    processed_material = Material.objects.create(code="pet-bales", name="PET Lavado", family=family_proc, is_buyable=False, is_sellable=True, is_processable=False, is_processed=True)
    process_type = ProcessType.objects.create(code="limpieza", name="Limpieza", description="Limpieza y clasificación")
    return center, customer, raw_material, processed_material, process_type


def seed_inventory(user, center, customer, raw_material, quantity=Decimal("100")):
    operation = open_purchase_operation(collection_center=center, customer=customer, opened_by=user)
    register_ticket_item(
        operation=operation,
        material=raw_material,
        method=TicketItem.Method.SECONDARY_DIRECT,
        unit_price=Decimal("10.00"),
        gross_weight_kg=quantity,
        merma_kg=Decimal("0"),
        user=user,
    )
    register_payment(operation=operation, amount=quantity * Decimal("10.00"), method="cash", received_by=user)
    operation.refresh_from_db()
    return operation


def test_confirm_process_moves_inventory_and_records_waste():
    user = build_user(staff=True)
    center, customer, raw_material, processed_material, process_type = build_catalog()
    seed_inventory(user, center, customer, raw_material, quantity=Decimal("100"))

    process = create_material_process(process_type=process_type, collection_center=center, created_by=user, notes="Proceso demo")
    add_process_input(process=process, material=raw_material, quantity=Decimal("40"), user=user)
    add_process_output(process=process, material=processed_material, quantity=Decimal("32"), user=user)
    add_process_waste(process=process, material=raw_material, waste_type=MaterialProcessWaste.WasteType.MERMA, quantity=Decimal("8"), user=user)

    confirmed = confirm_material_process(process=process, user=user)
    confirmed.refresh_from_db()

    assert confirmed.status == confirmed.Status.CONFIRMED
    assert get_available_stock(material=raw_material, collection_center=center) == Decimal("52")
    assert get_available_stock(material=processed_material, collection_center=center) == Decimal("32")
    assert InventoryMovement.objects.filter(process=confirmed, movement_type=InventoryMovement.MovementType.PROCESS_INPUT_OUT).exists()
    assert InventoryMovement.objects.filter(process=confirmed, movement_type=InventoryMovement.MovementType.PROCESS_OUTPUT_IN).exists()
    assert InventoryMovement.objects.filter(process=confirmed, movement_type=InventoryMovement.MovementType.PROCESS_WASTE_OUT).exists()


def test_confirm_process_rejects_without_stock():
    user = build_user(staff=True)
    center, customer, raw_material, processed_material, process_type = build_catalog()
    process = create_material_process(process_type=process_type, collection_center=center, created_by=user)
    add_process_input(process=process, material=raw_material, quantity=Decimal("10"), user=user)
    add_process_output(process=process, material=processed_material, quantity=Decimal("8"), user=user)

    with pytest.raises(ValidationError):
        confirm_material_process(process=process, user=user)


def test_cancel_confirmed_process_requires_special_permission_and_reverses_stock():
    user = build_user(staff=True)
    center, customer, raw_material, processed_material, process_type = build_catalog()
    seed_inventory(user, center, customer, raw_material, quantity=Decimal("100"))

    process = create_material_process(process_type=process_type, collection_center=center, created_by=user)
    add_process_input(process=process, material=raw_material, quantity=Decimal("20"), user=user)
    add_process_output(process=process, material=processed_material, quantity=Decimal("16"), user=user)
    confirm_material_process(process=process, user=user)
    assert get_available_stock(material=raw_material, collection_center=center) == Decimal("80")

    cancelled = cancel_material_process(process=process, user=user, reason="Correccion operativa")
    cancelled.refresh_from_db()

    assert cancelled.status == cancelled.Status.CANCELLED
    assert get_available_stock(material=raw_material, collection_center=center) == Decimal("100")


def test_processed_material_can_be_sold_after_process():
    user = build_user(staff=True)
    center, customer, raw_material, processed_material, process_type = build_catalog()
    seed_inventory(user, center, customer, raw_material, quantity=Decimal("100"))

    process = create_material_process(process_type=process_type, collection_center=center, created_by=user)
    add_process_input(process=process, material=raw_material, quantity=Decimal("50"), user=user)
    add_process_output(process=process, material=processed_material, quantity=Decimal("40"), user=user)
    confirm_material_process(process=process, user=user)

    sale = register_sale_order(collection_center=center, buyer=customer, created_by=user, notes="Venta procesado")
    item = add_sale_item(sale_order=sale, material=processed_material, quantity_kg=Decimal("10"), unit_price=Decimal("20.00"), user=user)
    sale.refresh_from_db()
    assert item.amount == Decimal("200.00")
    assert sale.total_amount == Decimal("200.00")
    assert InventoryMovement.objects.filter(sale_order=sale, sale_item=item, movement_type=InventoryMovement.MovementType.SALE_OUT).exists()
    closed = close_sale_order(sale, user=user)
    assert closed.status == SaleOrder.Status.COMPLETED


def test_sale_rejects_without_stock():
    user = build_user(staff=True)
    center, customer, raw_material, processed_material, process_type = build_catalog()
    sale = register_sale_order(collection_center=center, buyer=customer, created_by=user, notes="Venta sin stock")

    with pytest.raises(ValidationError):
        add_sale_item(sale_order=sale, material=processed_material, quantity_kg=Decimal("1"), unit_price=Decimal("20.00"), user=user)
