from __future__ import annotations

from django.db import transaction

from apps.auditing.services import register_audit_event

from .models import CustodyEvent, PrintLog


@transaction.atomic
def register_print_event(*, operation, printed_by=None, printer_device=None, printer_name="", is_reprint=False, copies=1, payload=None, notes="") -> PrintLog:
    log = PrintLog.objects.create(
        operation=operation,
        printed_by=printed_by,
        printer_device=printer_device,
        printer_name=printer_name,
        is_reprint=is_reprint,
        copies=copies,
        payload=payload or {},
        status="printed",
        notes=notes,
    )
    register_audit_event(actor=printed_by, action="register_print_event", entity=log, details={"is_reprint": is_reprint, "copies": copies})
    return log


@transaction.atomic
def register_custody_event(*, operation, event_type: str, created_by=None, ticket_item=None, notes="", metadata=None) -> CustodyEvent:
    event = CustodyEvent.objects.create(
        operation=operation,
        ticket_item=ticket_item,
        event_type=event_type,
        created_by=created_by,
        notes=notes,
        metadata=metadata or {},
    )
    register_audit_event(actor=created_by, action="register_custody_event", entity=event, details={"event_type": event_type})
    return event

