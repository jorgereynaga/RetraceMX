# Generated manually for cashier enhancements.

from decimal import Decimal

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("payments", "0002_initial"),
        ("operations", "0003_ticketitem_unit_price_decimal5"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AlterField(
            model_name="payment",
            name="method",
            field=models.CharField(
                choices=[
                    ("cash", "Cash"),
                    ("transfer", "Transfer"),
                    ("card", "Card"),
                    ("cheque", "Cheque"),
                    ("voucher", "Voucher"),
                    ("credit", "Credit"),
                    ("other", "Other"),
                ],
                default="cash",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="payment",
            name="cancel_reason",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="payment",
            name="cancelled_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="payment",
            name="cancelled_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="cancelled_payments",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="payment",
            name="change_amount",
            field=models.DecimalField(decimal_places=2, default=Decimal("0"), max_digits=12),
        ),
        migrations.AddField(
            model_name="payment",
            name="folio",
            field=models.CharField(blank=True, db_index=True, max_length=50, null=True, unique=True),
        ),
        migrations.AddField(
            model_name="payment",
            name="received_amount",
            field=models.DecimalField(decimal_places=2, default=Decimal("0"), max_digits=12),
        ),
        migrations.AddField(
            model_name="payment",
            name="status",
            field=models.CharField(
                choices=[("active", "Active"), ("cancelled", "Cancelled")],
                default="active",
                max_length=20,
            ),
        ),
    ]
