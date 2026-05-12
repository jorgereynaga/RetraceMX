from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("processing", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="materialprocessoutput",
            name="lot_code",
            field=models.CharField(blank=True, db_index=True, max_length=80),
        ),
    ]
