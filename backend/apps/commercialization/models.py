from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.db import models

from apps.core.models import UUIDTimeStampedModel


class SaleOrder(UUIDTimeStampedModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Borrador"
        CONFIRMED = "confirmed", "Confirmada"
        SENT_TO_CASHIER = "sent_to_cashier", "Enviada a caja"
        SCHEDULED_DELIVERY = "scheduled_delivery", "Entrega programada"
        LOADING = "loading", "En carga"
        IN_ROUTE = "in_route", "En ruta"
        DELIVERED = "delivered", "Entregada"
        COMPLETED = "completed", "Entregada"
        PAID = "paid", "Pagada"
        CREDIT = "credit", "Crédito"
        CLOSED = "closed", "Cerrada"
        CANCELLED = "cancelled", "Cancelada"
        ADJUSTED = "adjusted", "Ajustada"

    class SaleType(models.TextChoices):
        DIRECT_WEIGHT = "direct_weight", "Venta directa por peso"
        LOT = "lot", "Venta por lote"
        SHIPMENT = "shipment", "Venta por carga"
        NEGOTIATED = "negotiated", "Precio negociado"
        CREDIT = "credit", "Venta a crédito"
        PROCESSED = "processed", "Material procesado"
        MIXED = "mixed", "Venta mixta"
        CONTRACT = "contract", "Contrato o convenio"

    class PaymentTerms(models.TextChoices):
        CASH = "cash", "Contado"
        CREDIT = "credit", "Crédito"
        ADVANCE = "advance", "Anticipo"
        TRANSFER = "transfer", "Transferencia"
        MIXED = "mixed", "Pago mixto"

    folio = models.CharField(max_length=50, unique=True, db_index=True)
    collection_center = models.ForeignKey("parties.CollectionCenter", on_delete=models.PROTECT, related_name="sale_orders")
    buyer = models.ForeignKey("parties.PersonOrCompany", on_delete=models.PROTECT, related_name="sale_orders")
    sale_type = models.CharField(max_length=30, choices=SaleType.choices, default=SaleType.DIRECT_WEIGHT)
    payment_terms = models.CharField(max_length=20, choices=PaymentTerms.choices, default=PaymentTerms.CASH)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    total_weight_kg = models.DecimalField(max_digits=12, decimal_places=3, default=Decimal("0"))
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    total_cost = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    total_profit = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    destination_name = models.CharField(max_length=255, blank=True)
    transport_mode = models.CharField(max_length=80, blank=True)
    transport_operator = models.CharField(max_length=255, blank=True)
    transport_plates = models.CharField(max_length=60, blank=True)
    contract_reference = models.CharField(max_length=80, blank=True)
    negotiated_price_note = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    sold_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="sale_orders")
    buyer_type_snapshot = models.CharField(max_length=120, blank=True)

    def __str__(self) -> str:
        return self.folio


class SaleItem(UUIDTimeStampedModel):
    sale_order = models.ForeignKey(SaleOrder, on_delete=models.CASCADE, related_name="items")
    material = models.ForeignKey("materials.Material", on_delete=models.PROTECT, related_name="sale_items")
    presentation = models.CharField(max_length=80, blank=True)
    quality = models.CharField(max_length=80, blank=True)
    lot_code = models.CharField(max_length=80, blank=True)
    quantity_kg = models.DecimalField(max_digits=12, decimal_places=3)
    list_unit_price = models.DecimalField(max_digits=12, decimal_places=5, default=Decimal("0"))
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    estimated_cost = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    profit = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    price_override_reason = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    inventory_movement = models.OneToOneField("inventory.InventoryMovement", on_delete=models.SET_NULL, null=True, blank=True, related_name="sale_item_link")

    def __str__(self) -> str:
        return f"{self.sale_order.folio} - {self.material}"


class SalePayment(UUIDTimeStampedModel):
    class Method(models.TextChoices):
        CASH = "cash", "Cash"
        TRANSFER = "transfer", "Transfer"
        CARD = "card", "Card"
        CHEQUE = "cheque", "Cheque"
        VOUCHER = "voucher", "Voucher"
        CREDIT = "credit", "Credit"
        OTHER = "other", "Other"

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        CANCELLED = "cancelled", "Cancelled"

    folio = models.CharField(max_length=50, unique=True, db_index=True, null=True, blank=True)
    sale_order = models.ForeignKey(SaleOrder, on_delete=models.CASCADE, related_name="payments")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    received_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    change_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    method = models.CharField(max_length=20, choices=Method.choices, default=Method.CASH)
    received_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="received_sale_payments")
    reference = models.CharField(max_length=120, blank=True)
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancelled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="cancelled_sale_payments",
    )
    cancel_reason = models.TextField(blank=True)
    paid_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return self.folio or str(self.pk)
