from __future__ import annotations

from django.db import migrations, models


MINIMAL_ROLES = [
    ("superadmin", "Superadministrador"),
    ("admin", "Administrador / Gerente"),
    ("weighing", "Báscula / Recepción"),
    ("purchasing", "Compras"),
    ("inventory", "Inventarios / Almacén"),
    ("cashier", "Caja"),
    ("sales", "Ventas / Comercial"),
    ("logistics", "Logística / Rutas"),
    ("operator", "Operador / Chofer"),
    ("auditor", "Auditor / Consulta"),
]


def seed_minimal_roles(apps, schema_editor):
    Role = apps.get_model("users", "Role")
    User = apps.get_model("users", "User")

    created_roles = {}
    for code, name in MINIMAL_ROLES:
        role, _ = Role.objects.get_or_create(code=code, defaults={"name": name})
        if role.name != name:
            role.name = name
            role.save(update_fields=["name"])
        created_roles[code] = role

    super_roles = [created_roles["superadmin"], created_roles["admin"]]
    for user in User.objects.filter(is_superuser=True):
        user.roles.add(*super_roles)


def unseed_minimal_roles(apps, schema_editor):
    # Keep the schema change; role data is intentionally preserved.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="roles",
            field=models.ManyToManyField(blank=True, related_name="users", to="users.role"),
        ),
        migrations.RunPython(seed_minimal_roles, unseed_minimal_roles),
    ]
