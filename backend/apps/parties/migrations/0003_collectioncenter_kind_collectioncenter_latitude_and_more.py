# Generated manually for center kind and coordinates support.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("parties", "0002_vehicle_expected_km_per_liter"),
    ]

    operations = [
        migrations.AddField(
            model_name="collectioncenter",
            name="kind",
            field=models.CharField(
                choices=[("collection", "Centro de acopio"), ("smelter", "Fundidora"), ("destination", "Destino")],
                default="collection",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="collectioncenter",
            name="latitude",
            field=models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True),
        ),
        migrations.AddField(
            model_name="collectioncenter",
            name="longitude",
            field=models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True),
        ),
    ]
