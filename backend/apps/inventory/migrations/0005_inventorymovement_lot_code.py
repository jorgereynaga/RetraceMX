from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0004_inventorymovement_process_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="inventorymovement",
            name="lot_code",
            field=models.CharField(blank=True, db_index=True, max_length=80),
        ),
    ]
