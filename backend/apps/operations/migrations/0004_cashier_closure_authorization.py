# Generated manually for cashier enhancements.

from decimal import Decimal

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("operations", "0003_ticketitem_unit_price_decimal5"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="purchaseoperation",
            name="close_authorized_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="purchaseoperation",
            name="close_authorized_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="authorized_closures",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="purchaseoperation",
            name="close_authorization_notes",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="purchaseoperation",
            name="close_authorization_reason",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="purchaseoperation",
            name="close_recognized_pending_amount",
            field=models.DecimalField(decimal_places=2, default=Decimal("0"), max_digits=12),
        ),
    ]
