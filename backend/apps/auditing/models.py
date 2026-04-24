from __future__ import annotations

from django.conf import settings
from django.db import models

from apps.core.models import UUIDTimeStampedModel


class AuditLog(UUIDTimeStampedModel):
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="audit_logs")
    action = models.CharField(max_length=120)
    entity_type = models.CharField(max_length=120)
    entity_id = models.CharField(max_length=120)
    details = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    def __str__(self) -> str:
        return f"{self.action} {self.entity_type}:{self.entity_id}"

