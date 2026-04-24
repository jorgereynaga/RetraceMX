from __future__ import annotations

from .models import AuditLog


def register_audit_event(*, actor=None, action: str, entity, details=None, ip_address=None) -> AuditLog:
    entity_type = entity.__class__.__name__
    entity_id = str(getattr(entity, "pk", ""))
    return AuditLog.objects.create(
        actor=actor,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details or {},
        ip_address=ip_address,
    )
