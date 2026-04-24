from __future__ import annotations

from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import transaction

from apps.auditing.services import register_audit_event
from apps.operations.models import TicketItem

from .models import Payment


def sync_payment_status(operation):
    paid_amount = sum((payment.amount for payment in operation.payments.all()), Decimal("0"))
    if paid_amount <= 0:
        operation.payment_status = operation.PaymentStatus.PENDING
    elif paid_amount < operation.total_amount:
        operation.payment_status = operation.PaymentStatus.PARTIAL
    else:
        operation.payment_status = operation.PaymentStatus.PAID
    operation.save(update_fields=["payment_status", "updated_at"])
    return operation


@transaction.atomic
def register_payment(*, operation, amount, method, received_by, reference="", notes="") -> Payment:
    if operation.status in {operation.Status.CANCELLED, operation.Status.COMPLETED}:
        raise ValidationError("No se puede registrar un pago en una operacion cancelada o cerrada.")
    if not operation.items.filter(status=TicketItem.Status.CONFIRMED).exists():
        raise ValidationError("No se puede registrar un pago sin partidas validas.")

    current_paid = sum((payment.amount for payment in operation.payments.all()), Decimal("0"))
    if current_paid + Decimal(amount) > Decimal(operation.total_amount):
        raise ValidationError("El pago no puede exceder el saldo de la operacion.")

    payment = Payment.objects.create(
        operation=operation,
        amount=amount,
        method=method,
        received_by=received_by,
        reference=reference,
        notes=notes,
    )
    sync_payment_status(operation)
    register_audit_event(actor=received_by, action="register_payment", entity=payment, details={"amount": str(amount), "method": method})
    return payment

