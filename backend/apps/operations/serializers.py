from rest_framework import serializers

from apps.weighing.models import WeighingSession
from apps.payments.services import calculate_paid_amount

from .models import PurchaseOperation, TicketItem


class PurchaseOperationSerializer(serializers.ModelSerializer):
    opened_by_name = serializers.SerializerMethodField()
    driver_name = serializers.SerializerMethodField()
    vehicle_plate = serializers.SerializerMethodField()
    customer_name = serializers.SerializerMethodField()
    customer_trade_name = serializers.SerializerMethodField()
    customer_legal_name = serializers.SerializerMethodField()
    active_weighing_session = serializers.SerializerMethodField()
    paid_amount = serializers.SerializerMethodField()
    pending_amount = serializers.SerializerMethodField()
    status_label = serializers.SerializerMethodField()
    payment_status_label = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseOperation
        fields = "__all__"

    def get_opened_by_name(self, obj):
        if obj.opened_by:
            return obj.opened_by.get_full_name() or obj.opened_by.username
        return None

    def get_driver_name(self, obj):
        if obj.driver and obj.driver.person:
            return str(obj.driver.person)
        return None

    def get_vehicle_plate(self, obj):
        if obj.vehicle:
            return obj.vehicle.plate_number
        return None

    def get_customer_name(self, obj):
        if obj.customer:
            return str(obj.customer)
        return None

    def get_customer_trade_name(self, obj):
        if obj.customer:
            return obj.customer.trade_name or None
        return None

    def get_customer_legal_name(self, obj):
        if obj.customer:
            return obj.customer.legal_name
        return None

    def get_active_weighing_session(self, obj):
        session = obj.weighing_sessions.filter(status=WeighingSession.Status.OPEN).first()
        return str(session.pk) if session else None

    def get_paid_amount(self, obj):
        return calculate_paid_amount(obj)

    def get_pending_amount(self, obj):
        paid = calculate_paid_amount(obj)
        pending = obj.total_amount - paid
        return pending if pending > 0 else 0

    def get_status_label(self, obj):
        return obj.get_status_display()

    def get_payment_status_label(self, obj):
        return obj.get_payment_status_display()


class TicketItemSerializer(serializers.ModelSerializer):
    material_name = serializers.SerializerMethodField()
    method_label = serializers.SerializerMethodField()
    confirmed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = TicketItem
        fields = "__all__"

    def get_material_name(self, obj):
        return str(obj.material) if obj.material else None

    def get_method_label(self, obj):
        return obj.get_method_display()

    def get_confirmed_by_name(self, obj):
        if obj.confirmed_by:
            return obj.confirmed_by.get_full_name() or obj.confirmed_by.username
        return None


class TicketItemWriteSerializer(serializers.ModelSerializer):
    reason = serializers.CharField(required=False, allow_blank=True, write_only=True)

    class Meta:
        model = TicketItem
        fields = [
            "operation",
            "material",
            "method",
            "gross_weight_kg",
            "tare_weight_kg",
            "net_weight_kg",
            "merma_kg",
            "unit_price",
            "notes",
            "reason",
            "weighing_session",
            "scale_reading",
        ]
        extra_kwargs = {
            "operation": {"required": False},
            "material": {"required": False},
            "method": {"required": False},
            "gross_weight_kg": {"required": False},
            "tare_weight_kg": {"required": False},
            "net_weight_kg": {"required": False},
            "merma_kg": {"required": False},
            "unit_price": {"required": False},
            "notes": {"required": False},
            "weighing_session": {"required": False},
            "scale_reading": {"required": False},
        }
