from __future__ import annotations

from django.conf import settings
from django.db import models

from apps.core.models import UUIDTimeStampedModel


class CustodyEvent(UUIDTimeStampedModel):
    event_type = models.CharField(max_length=120)
    operation = models.ForeignKey("operations.PurchaseOperation", on_delete=models.CASCADE, related_name="custody_events")
    ticket_item = models.ForeignKey("operations.TicketItem", on_delete=models.SET_NULL, null=True, blank=True, related_name="custody_events")
    notes = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="custody_events")


class EvidenceFile(UUIDTimeStampedModel):
    operation = models.ForeignKey("operations.PurchaseOperation", on_delete=models.CASCADE, related_name="evidence_files", null=True, blank=True)
    ticket_item = models.ForeignKey("operations.TicketItem", on_delete=models.CASCADE, related_name="evidence_files", null=True, blank=True)
    custody_event = models.ForeignKey(CustodyEvent, on_delete=models.CASCADE, related_name="evidence_files", null=True, blank=True)
    trip = models.ForeignKey("logistics.CollectionTrip", on_delete=models.SET_NULL, null=True, blank=True, related_name="evidence_files")
    file = models.FileField(upload_to="evidence/")
    file_type = models.CharField(max_length=60, blank=True)
    description = models.TextField(blank=True)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="evidence_files")


class PrintLog(UUIDTimeStampedModel):
    operation = models.ForeignKey("operations.PurchaseOperation", on_delete=models.CASCADE, related_name="print_logs")
    printer_device = models.ForeignKey("devices.Device", on_delete=models.SET_NULL, null=True, blank=True, related_name="print_logs")
    printer_name = models.CharField(max_length=120, blank=True)
    is_reprint = models.BooleanField(default=False)
    copies = models.PositiveIntegerField(default=1)
    payload = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=20, default="pending")
    notes = models.TextField(blank=True)
    printed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="print_logs")
    printed_at = models.DateTimeField(auto_now_add=True)
