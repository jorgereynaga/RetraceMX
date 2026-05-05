from django.db import migrations, models
import django.db.models.deletion
import uuid
from django.conf import settings


class Migration(migrations.Migration):

    dependencies = [
        ("commercialization", "0003_alter_saleorder_status"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="SalePayment",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("folio", models.CharField(blank=True, db_index=True, max_length=50, null=True, unique=True)),
                ("amount", models.DecimalField(decimal_places=2, max_digits=12)),
                ("received_amount", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("change_amount", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("method", models.CharField(choices=[("cash", "Cash"), ("transfer", "Transfer"), ("card", "Card"), ("cheque", "Cheque"), ("voucher", "Voucher"), ("credit", "Credit"), ("other", "Other")], default="cash", max_length=20)),
                ("reference", models.CharField(blank=True, max_length=120)),
                ("notes", models.TextField(blank=True)),
                ("status", models.CharField(choices=[("active", "Active"), ("cancelled", "Cancelled")], default="active", max_length=20)),
                ("cancelled_at", models.DateTimeField(blank=True, null=True)),
                ("cancel_reason", models.TextField(blank=True)),
                ("paid_at", models.DateTimeField(auto_now_add=True)),
                ("cancelled_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="cancelled_sale_payments", to=settings.AUTH_USER_MODEL)),
                ("received_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="received_sale_payments", to=settings.AUTH_USER_MODEL)),
                ("sale_order", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="payments", to="commercialization.saleorder")),
            ],
        ),
    ]
