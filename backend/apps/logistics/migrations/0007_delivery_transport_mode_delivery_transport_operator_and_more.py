from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("logistics", "0006_delivery_deliveryincident_deliveryitem_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="delivery",
            name="transport_mode",
            field=models.CharField(blank=True, max_length=80),
        ),
        migrations.AddField(
            model_name="delivery",
            name="transport_operator",
            field=models.CharField(blank=True, max_length=160),
        ),
        migrations.AddField(
            model_name="delivery",
            name="transport_plates",
            field=models.CharField(blank=True, max_length=60),
        ),
    ]
