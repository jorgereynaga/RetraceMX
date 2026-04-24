from __future__ import annotations

import os
from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from apps.materials.models import Material, MaterialFamily, PriceList, PriceListItem
from apps.logistics.models import Route
from apps.parties.models import CommercialRole, CollectionCenter, Driver, PersonOrCompany, Vehicle
from apps.users.models import Role


class Command(BaseCommand):
    help = "Creates a minimal demo dataset for Acopio360."

    def handle(self, *args, **options):
        user_model = get_user_model()
        username = os.getenv("DJANGO_SUPERUSER_USERNAME", "admin")
        email = os.getenv("DJANGO_SUPERUSER_EMAIL", "admin@acopio360.local")
        password = os.getenv("DJANGO_SUPERUSER_PASSWORD", "Admin1234!")

        admin_user, created = user_model.objects.get_or_create(
            username=username,
            defaults={
                "email": email,
                "is_staff": True,
                "is_superuser": True,
                "is_active": True,
            },
        )
        admin_user.email = email
        admin_user.is_staff = True
        admin_user.is_superuser = True
        admin_user.is_active = True
        if created:
            admin_user.set_password(password)
        elif not admin_user.has_usable_password():
            admin_user.set_password(password)
        admin_user.save()

        Role.objects.get_or_create(code="admin", defaults={"name": "Administrador"})
        Role.objects.get_or_create(code="cashier", defaults={"name": "Caja"})
        Role.objects.get_or_create(code="operator", defaults={"name": "Operador"})

        CommercialRole.objects.get_or_create(code="customer", defaults={"name": "Cliente"})
        CommercialRole.objects.get_or_create(code="generator", defaults={"name": "Generador"})
        CommercialRole.objects.get_or_create(code="buyer", defaults={"name": "Comprador"})
        CommercialRole.objects.get_or_create(code="supplier", defaults={"name": "Proveedor"})

        center, _ = CollectionCenter.objects.get_or_create(
            code="matriz",
            defaults={
                "name": "Centro Matriz",
                "kind": CollectionCenter.Kind.COLLECTION,
                "address": "Direccion demo",
                "latitude": Decimal("19.432610"),
                "longitude": Decimal("-99.133210"),
            },
        )
        center.kind = CollectionCenter.Kind.COLLECTION
        center.latitude = Decimal("19.432610")
        center.longitude = Decimal("-99.133210")
        center.save(update_fields=["kind", "latitude", "longitude", "updated_at"])

        smelter, _ = CollectionCenter.objects.get_or_create(
            code="fundidora-demo",
            defaults={
                "name": "Fundidora Demo",
                "kind": CollectionCenter.Kind.SMELTER,
                "address": "Destino industrial demo",
                "latitude": Decimal("19.501200"),
                "longitude": Decimal("-99.181500"),
            },
        )
        smelter.kind = CollectionCenter.Kind.SMELTER
        smelter.latitude = Decimal("19.501200")
        smelter.longitude = Decimal("-99.181500")
        smelter.save(update_fields=["kind", "latitude", "longitude", "updated_at"])

        customer_role = CommercialRole.objects.get(code="customer")
        customer, _ = PersonOrCompany.objects.get_or_create(
            kind=PersonOrCompany.Kind.COMPANY,
            legal_name="Cliente Demo SA de CV",
            defaults={"trade_name": "Cliente Demo", "email": "cliente@demo.local"},
        )
        customer.commercial_roles.add(customer_role)

        driver_person, _ = PersonOrCompany.objects.get_or_create(
            kind=PersonOrCompany.Kind.PERSON,
            legal_name="Operador Demo",
            defaults={"trade_name": "", "email": "operador@demo.local"},
        )
        Vehicle.objects.get_or_create(
            plate_number="ABC-123-D",
            defaults={"label": "Unidad Demo", "capacity_kg": Decimal("3500"), "owner": customer},
        )
        vehicle = Vehicle.objects.get(plate_number="ABC-123-D")
        vehicle.expected_km_per_liter = Decimal("3.200")
        vehicle.save(update_fields=["expected_km_per_liter", "updated_at"])
        Driver.objects.get_or_create(person=driver_person, defaults={"license_number": "LIC-DEMO-001"})

        Route.objects.get_or_create(
            code="ruta-matriz-demo",
            defaults={
                "name": "Ruta Matriz Demo",
                "origin_center": center,
                "destination_center": smelter,
                "notes": "Ruta de prueba para recoleccion y retorno.",
            },
        )

        family, _ = MaterialFamily.objects.get_or_create(
            code="plasticos",
            defaults={
                "name": "Plasticos",
                "operational_classification": "Valorizable",
                "possible_valuation": True,
            },
        )
        material, _ = Material.objects.get_or_create(
            code="pet-claro",
            defaults={
                "name": "PET Claro",
                "family": family,
                "unit": Material.Unit.KG,
                "valuation_possible": True,
            },
        )

        price_list, _ = PriceList.objects.get_or_create(
            code="lista-base",
            defaults={
                "name": "Lista Base",
                "collection_center": center,
                "currency": "MXN",
                "valid_from": date(2026, 1, 1),
            },
        )
        PriceListItem.objects.get_or_create(price_list=price_list, material=material, defaults={"unit_price": Decimal("8.50")})

        self.stdout.write(self.style.SUCCESS("Demo data created or updated successfully."))
