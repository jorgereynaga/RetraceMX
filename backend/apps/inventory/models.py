from __future__ import annotations

from django.conf import settings
from django.db import models

from apps.core.models import UUIDTimeStampedModel


class InventoryMovement(UUIDTimeStampedModel):
    class MovementType(models.TextChoices):
        INBOUND = "inbound", "Inbound"
        OUTBOUND = "outbound", "Outbound"
        ADJUSTMENT = "adjustment", "Adjustment"
        PURCHASE_IN = "purchase_in", "Compra ingresada"
        PROCESS_INPUT_OUT = "process_input_out", "Consumo por proceso"
        PROCESS_OUTPUT_IN = "process_output_in", "Salida procesada"
        PROCESS_WASTE_OUT = "process_waste_out", "Merma de proceso"
        SALE_OUT = "sale_out", "Venta"
        MANUAL_ADJUSTMENT_IN = "manual_adjustment_in", "Ajuste positivo"
        MANUAL_ADJUSTMENT_OUT = "manual_adjustment_out", "Ajuste negativo"
        TRANSFER_IN = "transfer_in", "Transferencia recibida"
        TRANSFER_OUT = "transfer_out", "Transferencia enviada"

    operation = models.ForeignKey("operations.PurchaseOperation", on_delete=models.SET_NULL, null=True, blank=True, related_name="inventory_movements")
    ticket_item = models.ForeignKey("operations.TicketItem", on_delete=models.SET_NULL, null=True, blank=True, related_name="inventory_movements")
    sale_order = models.ForeignKey("commercialization.SaleOrder", on_delete=models.SET_NULL, null=True, blank=True, related_name="inventory_movements")
    sale_item = models.ForeignKey("commercialization.SaleItem", on_delete=models.SET_NULL, null=True, blank=True, related_name="inventory_movements")
    process = models.ForeignKey("processing.MaterialProcess", on_delete=models.SET_NULL, null=True, blank=True, related_name="inventory_movements")
    process_input = models.ForeignKey("processing.MaterialProcessInput", on_delete=models.SET_NULL, null=True, blank=True, related_name="inventory_movements")
    process_output = models.ForeignKey("processing.MaterialProcessOutput", on_delete=models.SET_NULL, null=True, blank=True, related_name="inventory_movements")
    process_waste = models.ForeignKey("processing.MaterialProcessWaste", on_delete=models.SET_NULL, null=True, blank=True, related_name="inventory_movements")
    lot_code = models.CharField(max_length=80, blank=True, db_index=True)
    material = models.ForeignKey("materials.Material", on_delete=models.PROTECT, related_name="inventory_movements")
    collection_center = models.ForeignKey("parties.CollectionCenter", on_delete=models.PROTECT, related_name="inventory_movements")
    movement_type = models.CharField(max_length=32, choices=MovementType.choices, default=MovementType.INBOUND)
    quantity_kg = models.DecimalField(max_digits=12, decimal_places=3)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    notes = models.TextField(blank=True)
    source_reference = models.CharField(max_length=120, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="inventory_movements")
    occurred_at = models.DateTimeField(auto_now_add=True)
