from rest_framework import serializers

from .models import Payment


class PaymentSerializer(serializers.ModelSerializer):
    operation_folio = serializers.SerializerMethodField()
    received_by_name = serializers.SerializerMethodField()
    method_label = serializers.SerializerMethodField()
    status_label = serializers.SerializerMethodField()
    applied_amount = serializers.DecimalField(source="amount", max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = Payment
        fields = "__all__"

    def get_operation_folio(self, obj):
        return obj.operation.folio if obj.operation_id else None

    def get_received_by_name(self, obj):
        if obj.received_by:
            return obj.received_by.get_full_name() or obj.received_by.username
        return None

    def get_method_label(self, obj):
        return obj.get_method_display()

    def get_status_label(self, obj):
        return obj.get_status_display()


class PaymentWriteSerializer(serializers.Serializer):
    operation = serializers.UUIDField()
    method = serializers.CharField()
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)
    received_amount = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)
    applied_amount = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)
    reference = serializers.CharField(required=False, allow_blank=True, default="")
    notes = serializers.CharField(required=False, allow_blank=True, default="")
    received_by = serializers.UUIDField(required=False, allow_null=True)
    cancel_reason = serializers.CharField(required=False, allow_blank=True, default="")
