from rest_framework import serializers

from decimal import Decimal

from .models import SaleItem, SaleOrder, SalePayment


class SaleOrderSerializer(serializers.ModelSerializer):
    collection_center_name = serializers.CharField(source="collection_center.name", read_only=True)
    buyer_name = serializers.SerializerMethodField()
    buyer_type_label = serializers.SerializerMethodField()
    buyer_roles = serializers.SerializerMethodField()
    sale_type_label = serializers.SerializerMethodField()
    payment_terms_label = serializers.SerializerMethodField()
    items_count = serializers.SerializerMethodField()
    status_label = serializers.SerializerMethodField()
    paid_amount = serializers.SerializerMethodField()
    pending_amount = serializers.SerializerMethodField()
    payment_status = serializers.SerializerMethodField()
    payment_status_label = serializers.SerializerMethodField()

    class Meta:
        model = SaleOrder
        fields = "__all__"

    def get_buyer_name(self, obj):
        return obj.buyer.trade_name or obj.buyer.legal_name

    def get_buyer_type_label(self, obj):
        return obj.buyer_type_snapshot or obj.buyer.get_kind_display()

    def get_buyer_roles(self, obj):
        return [role.name for role in obj.buyer.commercial_roles.all()]

    def get_sale_type_label(self, obj):
        return obj.get_sale_type_display()

    def get_payment_terms_label(self, obj):
        return obj.get_payment_terms_display()

    def get_items_count(self, obj):
        return obj.items.count()

    def get_status_label(self, obj):
        return obj.get_status_display()

    def get_paid_amount(self, obj):
        active_payments = obj.payments.exclude(status=SalePayment.Status.CANCELLED)
        paid = sum((payment.amount for payment in active_payments), Decimal("0"))
        return str(paid.quantize(Decimal("0.01")))

    def get_pending_amount(self, obj):
        paid = Decimal(self.get_paid_amount(obj))
        pending = max(Decimal(obj.total_amount) - paid, Decimal("0"))
        return str(pending.quantize(Decimal("0.01")))

    def get_payment_status(self, obj):
        paid = Decimal(self.get_paid_amount(obj))
        pending = Decimal(self.get_pending_amount(obj))
        if paid <= 0:
            return "pending"
        if pending > 0:
            return "partial"
        return "paid"

    def get_payment_status_label(self, obj):
        status = self.get_payment_status(obj)
        return {
            "pending": "Pendiente",
            "partial": "Parcial",
            "paid": "Pagado",
        }.get(status, status)


class SaleItemSerializer(serializers.ModelSerializer):
    material_name = serializers.CharField(source="material.name", read_only=True)
    material_code = serializers.CharField(source="material.code", read_only=True)
    presentation_label = serializers.CharField(source="presentation", read_only=True)
    quality_label = serializers.CharField(source="quality", read_only=True)

    class Meta:
        model = SaleItem
        fields = "__all__"


class SaleItemWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = SaleItem
        fields = [
            "sale_order",
            "material",
            "presentation",
            "quality",
            "lot_code",
            "quantity_kg",
            "list_unit_price",
            "unit_price",
            "price_override_reason",
            "notes",
        ]
        extra_kwargs = {
            "sale_order": {"required": False},
            "presentation": {"required": False, "allow_blank": True},
            "quality": {"required": False, "allow_blank": True},
            "lot_code": {"required": False, "allow_blank": True},
            "list_unit_price": {"required": False},
            "price_override_reason": {"required": False, "allow_blank": True},
            "notes": {"required": False, "allow_blank": True},
        }


class SalePaymentSerializer(serializers.ModelSerializer):
    sale_order_folio = serializers.SerializerMethodField()
    received_by_name = serializers.SerializerMethodField()
    method_label = serializers.SerializerMethodField()
    status_label = serializers.SerializerMethodField()
    applied_amount = serializers.DecimalField(source="amount", max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = SalePayment
        fields = "__all__"

    def get_sale_order_folio(self, obj):
        return obj.sale_order.folio if obj.sale_order_id else None

    def get_received_by_name(self, obj):
        if obj.received_by:
            return obj.received_by.get_full_name() or obj.received_by.username
        return None

    def get_method_label(self, obj):
        return obj.get_method_display()

    def get_status_label(self, obj):
        return obj.get_status_display()


class SalePaymentWriteSerializer(serializers.Serializer):
    sale_order = serializers.UUIDField()
    method = serializers.CharField()
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)
    received_amount = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)
    applied_amount = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)
    reference = serializers.CharField(required=False, allow_blank=True, default="")
    notes = serializers.CharField(required=False, allow_blank=True, default="")
    received_by = serializers.UUIDField(required=False, allow_null=True)
    cancel_reason = serializers.CharField(required=False, allow_blank=True, default="")
