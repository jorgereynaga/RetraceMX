from __future__ import annotations

from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.auditing.services import register_audit_event
from apps.core.utils import generate_folio
from apps.inventory.services import post_operation_inventory, retract_operation_inventory
from apps.operations.models import TicketItem
from apps.weighing.models import WeighingSession

from .models import Payment


def _active_payments(operation):
    return operation.payments.exclude(status=Payment.Status.CANCELLED)


def calculate_paid_amount(operation) -> Decimal:
    return sum((payment.amount for payment in _active_payments(operation)), Decimal("0"))


def sync_payment_status(operation):
    paid_amount = calculate_paid_amount(operation)
    closed_sessions = 0
    if paid_amount <= 0:
        operation.payment_status = operation.PaymentStatus.PENDING
        operation.confirmed_at = None
        if operation.status == operation.Status.CONFIRMED:
            operation.status = operation.Status.REGISTERED
    elif paid_amount < operation.total_amount:
        operation.payment_status = operation.PaymentStatus.PARTIAL
        operation.confirmed_at = None
        if operation.status in {operation.Status.DRAFT, operation.Status.OPEN, operation.Status.CONFIRMED}:
            operation.status = operation.Status.REGISTERED
    else:
        operation.payment_status = operation.PaymentStatus.PAID
        if operation.status != operation.Status.COMPLETED:
            operation.status = operation.Status.CONFIRMED
            operation.confirmed_at = timezone.now()
        closed_sessions = operation.weighing_sessions.filter(status=WeighingSession.Status.OPEN).update(
            status=WeighingSession.Status.CLOSED,
            ended_at=timezone.now(),
        )
    operation.save(update_fields=["payment_status", "status", "confirmed_at", "updated_at"])
    if closed_sessions:
        register_audit_event(
            actor=None,
            action="close_weighing_sessions_on_payment",
            entity=operation,
            details={"closed_sessions": closed_sessions, "paid_amount": str(paid_amount)},
        )
    return operation


@transaction.atomic
def register_payment(
    *,
    operation,
    amount=None,
    method,
    received_by,
    reference="",
    notes="",
    received_amount=None,
    applied_amount=None,
) -> Payment:
    if operation.status in {operation.Status.CANCELLED, operation.Status.COMPLETED}:
        raise ValidationError("No se puede registrar un pago en una operacion cancelada o cerrada.")
    if not operation.items.filter(status=TicketItem.Status.CONFIRMED).exists():
        raise ValidationError("No se puede registrar un pago sin partidas validas.")

    current_paid = calculate_paid_amount(operation)
    pending_before = max(Decimal(operation.total_amount) - current_paid, Decimal("0"))
    method_value = str(method)
    allowed_methods = {choice[0] for choice in Payment.Method.choices}
    if method_value not in allowed_methods:
        raise ValidationError("Metodo de pago invalido.")
    cash_method = method_value == Payment.Method.CASH
    reference_required_methods = {Payment.Method.TRANSFER, Payment.Method.CARD, Payment.Method.CHEQUE, Payment.Method.VOUCHER}
    if method_value in reference_required_methods and not str(reference).strip():
        raise ValidationError("Este metodo de pago requiere una referencia.")

    if pending_before <= 0:
        raise ValidationError("La operacion ya no tiene saldo pendiente.")

    if amount is not None:
        if cash_method and received_amount is None:
            received_amount = amount
        elif applied_amount is None:
            applied_amount = amount

    if cash_method:
        if received_amount is None:
            raise ValidationError("El monto recibido es obligatorio para pagos en efectivo.")
        received = Decimal(received_amount)
        if received <= 0:
            raise ValidationError("El monto recibido debe ser mayor a cero.")
        applied = min(received, pending_before)
        change = max(received - pending_before, Decimal("0")) if received >= pending_before else Decimal("0")
    else:
        if applied_amount is None:
            raise ValidationError("El monto aplicado es obligatorio para este método de pago.")
        applied = Decimal(applied_amount)
        if applied <= 0:
            raise ValidationError("El monto aplicado debe ser mayor a cero.")
        if applied > pending_before:
            raise ValidationError("El monto aplicado no puede exceder el saldo pendiente.")
        received = applied
        change = Decimal("0")

    payment = Payment.objects.create(
        folio=generate_folio("PG"),
        operation=operation,
        amount=applied,
        received_amount=received,
        change_amount=change,
        method=method_value,
        received_by=received_by,
        reference=reference,
        notes=notes,
    )
    sync_payment_status(operation)
    if operation.payment_status == operation.PaymentStatus.PAID:
        post_operation_inventory(operation=operation, user=received_by)
    register_audit_event(
        actor=received_by,
        action="register_payment",
        entity=payment,
        details={
            "amount": str(applied),
            "received_amount": str(received),
            "change_amount": str(change),
            "method": method_value,
            "reference": reference,
        },
    )
    return payment


@transaction.atomic
def cancel_payment(*, payment: Payment, user, reason: str = "") -> Payment:
    if payment.status == Payment.Status.CANCELLED:
        return payment
    payment.status = Payment.Status.CANCELLED
    payment.cancelled_at = timezone.now()
    payment.cancelled_by = user
    payment.cancel_reason = reason
    payment.save(update_fields=["status", "cancelled_at", "cancelled_by", "cancel_reason", "updated_at"])
    sync_payment_status(payment.operation)
    if payment.operation.payment_status != payment.operation.PaymentStatus.PAID:
        retract_operation_inventory(operation=payment.operation, user=user, reason=reason or "payment_cancelled")
    register_audit_event(
        actor=user,
        action="cancel_payment",
        entity=payment,
        details={"reason": reason, "payment_folio": payment.folio, "operation_folio": payment.operation.folio},
    )
    return payment
