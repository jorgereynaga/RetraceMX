from __future__ import annotations

from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import transaction

from apps.auditing.services import register_audit_event
from .models import ScaleReading, WeighingSession


def calculate_differential_weight(gross_weight_kg: Decimal, tare_weight_kg: Decimal) -> Decimal:
    net_weight = Decimal(gross_weight_kg) - Decimal(tare_weight_kg)
    if net_weight < 0:
        raise ValidationError("El peso neto diferencial no puede ser negativo.")
    return net_weight


@transaction.atomic
def register_scale_reading(*, session: WeighingSession, device, reading_type: str, gross_weight_kg=None, tare_weight_kg=None, net_weight_kg=None, raw_value: str = "", is_stable: bool = True, is_manual: bool = False, note: str = "") -> ScaleReading:
    reading = ScaleReading.objects.create(
        session=session,
        device=device,
        reading_type=reading_type,
        gross_weight_kg=gross_weight_kg,
        tare_weight_kg=tare_weight_kg,
        net_weight_kg=net_weight_kg,
        raw_value=raw_value,
        is_stable=is_stable,
        is_manual=is_manual,
        note=note,
    )
    if is_manual:
        register_audit_event(actor=None, action="manual_scale_reading", entity=reading, details={"session": str(session.pk), "note": note})
    return reading


def get_or_create_bridge_session(*, device, captured_at=None):
    from apps.parties.models import CollectionCenter

    if device.collection_center_id:
        collection_center = device.collection_center
    else:
        collection_center = CollectionCenter.objects.order_by("name").first()
    if not collection_center:
        raise ValidationError("El dispositivo no tiene centro de recoleccion y no existe uno por defecto para crear la sesion.")

    session = (
        WeighingSession.objects.filter(device=device, status=WeighingSession.Status.OPEN, manual_entry=False)
        .order_by("-started_at")
        .first()
    )
    if session:
        return session

    return WeighingSession.objects.create(
        collection_center=collection_center,
        device=device,
        kind=WeighingSession.Kind.VEHICLE if device.kind == "vehicle_scale" else WeighingSession.Kind.SECONDARY,
        status=WeighingSession.Status.OPEN,
        manual_entry=False,
        notes="Bridge scale session",
        metadata={"bridge_mode": True, "bridge_device": device.identifier},
    )


def register_individual_weight(*, operation, material, unit_price, net_weight_kg, merma_kg=0, method=None, scale_session=None, reading=None, created_by=None, notes=""):
    from apps.auditing.services import register_audit_event
    from apps.operations.models import TicketItem
    from apps.operations.services import apply_tare_or_merma, calculate_ticket_item_amount

    method = method or TicketItem.Method.SECONDARY_DIRECT
    net_after_merma = apply_tare_or_merma(net_weight_kg, merma_kg)
    item = TicketItem.objects.create(
        operation=operation,
        material=material,
        weighing_session=scale_session,
        scale_reading=reading,
        method=method,
        gross_weight_kg=net_weight_kg,
        tare_weight_kg=0,
        net_weight_kg=net_after_merma,
        merma_kg=merma_kg,
        unit_price=unit_price,
        notes=notes,
        status=TicketItem.Status.CONFIRMED,
    )
    calculate_ticket_item_amount(item)
    register_audit_event(actor=created_by, action="register_individual_weight", entity=item, details={"method": method, "net_weight_kg": str(net_after_merma)})
    return item
