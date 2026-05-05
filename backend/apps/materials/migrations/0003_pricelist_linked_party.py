# Generated manually by Codex on 2026-05-01

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("materials", "0002_material_default_merma_pct"),
        ("parties", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="pricelist",
            name="linked_party",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="price_lists",
                to="parties.personorcompany",
            ),
        ),
    ]
