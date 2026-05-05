from __future__ import annotations

from django.db import migrations

from apps.users.role_permissions import assign_minimal_role_permissions


def forwards(apps, schema_editor):
    assign_minimal_role_permissions(apps)


def backwards(apps, schema_editor):
    Role = apps.get_model("users", "Role")
    for role in Role.objects.all():
        role.permissions.clear()


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0002_user_roles_and_minimal_roles"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
