# Generated manually by Codex on 2026-05-01

from django.db import migrations, models
from django.db.models import Q


class Migration(migrations.Migration):

    dependencies = [
        ("materials", "0003_pricelist_linked_party"),
    ]

    operations = [
        migrations.AddConstraint(
            model_name="pricelist",
            constraint=models.UniqueConstraint(
                fields=["linked_party"],
                condition=Q(linked_party__isnull=False),
                name="unique_pricelist_per_party",
            ),
        ),
    ]
