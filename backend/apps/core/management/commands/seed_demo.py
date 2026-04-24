from __future__ import annotations

import os
from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from apps.devices.models import Device
from apps.materials.models import Material, MaterialFamily, PriceList, PriceListItem
from apps.logistics.models import Route
from apps.parties.models import CommercialRole, CollectionCenter, Driver, PersonOrCompany, Vehicle
from apps.users.models import Role


FAMILIES_CATALOG = [
    {
        "code": "ferrosos",
        "name": "Metales Ferrosos",
        "operational_classification": "Valorizable",
        "materials": [
            {"code": "chatarra-suelta", "name": "Chatarra Suelta", "price": Decimal("3.50")},
            {"code": "lamina-acero", "name": "Lámina de Acero", "price": Decimal("4.20")},
            {"code": "fierro-fundido", "name": "Fierro Fundido", "price": Decimal("3.80")},
            {"code": "acero-inoxidable", "name": "Acero Inoxidable", "price": Decimal("12.00")},
            {"code": "varilla-hierro", "name": "Varilla de Hierro", "price": Decimal("4.00")},
        ],
    },
    {
        "code": "no-ferrosos",
        "name": "Metales No Ferrosos",
        "operational_classification": "Valorizable",
        "materials": [
            {"code": "cobre-desnudo", "name": "Cobre Desnudo", "price": Decimal("118.00")},
            {"code": "cobre-quemado", "name": "Cobre Quemado", "price": Decimal("95.00")},
            {"code": "aluminio-lata", "name": "Aluminio Lata", "price": Decimal("18.50")},
            {"code": "aluminio-perfil", "name": "Aluminio Perfil", "price": Decimal("22.00")},
            {"code": "plomo", "name": "Plomo", "price": Decimal("14.50")},
            {"code": "zinc", "name": "Zinc", "price": Decimal("16.00")},
            {"code": "bronce", "name": "Bronce", "price": Decimal("55.00")},
            {"code": "acumulador", "name": "Acumulador / Batería", "price": Decimal("8.00")},
        ],
    },
    {
        "code": "plasticos",
        "name": "Plásticos",
        "operational_classification": "Valorizable",
        "materials": [
            {"code": "pet-claro", "name": "PET Claro", "price": Decimal("8.50")},
            {"code": "pet-color", "name": "PET Color", "price": Decimal("6.00")},
            {"code": "pead-natural", "name": "PEAD Natural", "price": Decimal("9.00")},
            {"code": "pead-color", "name": "PEAD Color", "price": Decimal("5.50")},
            {"code": "pvc-rigido", "name": "PVC Rígido", "price": Decimal("2.50")},
            {"code": "polipropileno", "name": "Polipropileno (PP)", "price": Decimal("4.00")},
            {"code": "poliestireno", "name": "Poliestireno (PS)", "price": Decimal("3.00")},
            {"code": "pebd-film", "name": "PEBD Film", "price": Decimal("3.50")},
        ],
    },
    {
        "code": "papel-carton",
        "name": "Papel y Cartón",
        "operational_classification": "Valorizable",
        "materials": [
            {"code": "carton-occ", "name": "Cartón OCC", "price": Decimal("2.80")},
            {"code": "papel-bond", "name": "Papel Bond", "price": Decimal("3.20")},
            {"code": "periodico", "name": "Periódico", "price": Decimal("1.80")},
            {"code": "archivo", "name": "Archivo", "price": Decimal("2.50")},
            {"code": "carton-suave", "name": "Cartón Suave", "price": Decimal("1.50")},
        ],
    },
    {
        "code": "vidrio",
        "name": "Vidrio",
        "operational_classification": "Valorizable",
        "materials": [
            {"code": "vidrio-claro", "name": "Vidrio Claro", "price": Decimal("0.80")},
            {"code": "vidrio-color", "name": "Vidrio Color", "price": Decimal("0.60")},
            {"code": "vidrio-ambar", "name": "Vidrio Ámbar", "price": Decimal("0.70")},
        ],
    },
    {
        "code": "electronicos",
        "name": "Electrónicos (RAEE)",
        "operational_classification": "Valorizable",
        "special_review": True,
        "materials": [
            {"code": "computadoras", "name": "Computadoras", "price": Decimal("5.00"), "requires_special_review": True},
            {"code": "tarjetas-pcb", "name": "Tarjetas PCB", "price": Decimal("45.00"), "requires_special_review": True},
            {"code": "cables-electricos", "name": "Cables Eléctricos", "price": Decimal("28.00")},
            {"code": "electrodomesticos", "name": "Electrodomésticos", "price": Decimal("3.50")},
        ],
    },
    {
        "code": "otros",
        "name": "Otros Materiales",
        "operational_classification": "Valorizable",
        "materials": [
            {"code": "hule-llanta", "name": "Hule / Llanta", "price": Decimal("1.20")},
            {"code": "madera-limpia", "name": "Madera Limpia", "price": Decimal("0.50")},
            {"code": "textil", "name": "Textil", "price": Decimal("1.00")},
        ],
    },
]

PROVIDERS = [
    {"kind": "company", "legal_name": "Reciclajes Norte SA de CV", "trade_name": "Reciclajes Norte"},
    {"kind": "company", "legal_name": "Chatarrera del Sur SRL", "trade_name": "Chatarrera del Sur"},
    {"kind": "person", "legal_name": "Juan Pérez García", "trade_name": "Juan Pérez"},
    {"kind": "person", "legal_name": "María López Torres", "trade_name": "María López"},
    {"kind": "company", "legal_name": "Industrias Verdes SA de CV", "trade_name": "Industrias Verdes"},
]

VEHICLES = [
    {"plate": "ABC-123-D", "label": "Camión 1 - Volteo", "capacity_kg": Decimal("8000")},
    {"plate": "XYZ-456-E", "label": "Camión 2 - Plataforma", "capacity_kg": Decimal("12000")},
    {"plate": "DEF-789-F", "label": "Camioneta 3", "capacity_kg": Decimal("2500")},
]


class Command(BaseCommand):
    help = "Creates a comprehensive demo dataset for Acopio360."

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
        supplier_role = CommercialRole.objects.get(code="supplier")

        center, _ = CollectionCenter.objects.get_or_create(
            code="matriz",
            defaults={
                "name": "Centro Matriz",
                "kind": CollectionCenter.Kind.COLLECTION,
                "address": "Av. Industrial 100, Zona Norte",
                "latitude": Decimal("19.432610"),
                "longitude": Decimal("-99.133210"),
            },
        )
        center.kind = CollectionCenter.Kind.COLLECTION
        center.save(update_fields=["kind", "updated_at"])

        smelter, _ = CollectionCenter.objects.get_or_create(
            code="fundidora-demo",
            defaults={
                "name": "Fundidora Demo",
                "kind": CollectionCenter.Kind.SMELTER,
                "address": "Parque Industrial Oriente",
                "latitude": Decimal("19.501200"),
                "longitude": Decimal("-99.181500"),
            },
        )
        smelter.kind = CollectionCenter.Kind.SMELTER
        smelter.save(update_fields=["kind", "updated_at"])

        for prov in PROVIDERS:
            kind_map = {"company": PersonOrCompany.Kind.COMPANY, "person": PersonOrCompany.Kind.PERSON}
            party, _ = PersonOrCompany.objects.get_or_create(
                legal_name=prov["legal_name"],
                defaults={"kind": kind_map[prov["kind"]], "trade_name": prov["trade_name"]},
            )
            party.commercial_roles.add(supplier_role)

        for veh_data in VEHICLES:
            owner = PersonOrCompany.objects.filter(legal_name=PROVIDERS[0]["legal_name"]).first()
            Vehicle.objects.get_or_create(
                plate_number=veh_data["plate"],
                defaults={"label": veh_data["label"], "capacity_kg": veh_data["capacity_kg"], "owner": owner},
            )

        driver_person, _ = PersonOrCompany.objects.get_or_create(
            kind=PersonOrCompany.Kind.PERSON,
            legal_name="Operador Demo",
            defaults={"trade_name": "", "email": "operador@demo.local"},
        )
        Driver.objects.get_or_create(person=driver_person, defaults={"license_number": "LIC-DEMO-001"})

        Route.objects.get_or_create(
            code="ruta-matriz-demo",
            defaults={
                "name": "Ruta Matriz Demo",
                "origin_center": center,
                "destination_center": smelter,
                "notes": "Ruta de prueba para recolección y retorno.",
            },
        )

        price_list, _ = PriceList.objects.get_or_create(
            code="lista-base-2026",
            defaults={
                "name": "Lista Base 2026",
                "collection_center": center,
                "currency": "MXN",
                "valid_from": date(2026, 1, 1),
                "is_active": True,
            },
        )

        total_materials = 0
        for fam_data in FAMILIES_CATALOG:
            family, _ = MaterialFamily.objects.get_or_create(
                code=fam_data["code"],
                defaults={
                    "name": fam_data["name"],
                    "operational_classification": fam_data.get("operational_classification", "Valorizable"),
                    "possible_valuation": True,
                    "special_review": fam_data.get("special_review", False),
                },
            )
            family.name = fam_data["name"]
            family.save(update_fields=["name", "updated_at"])

            for mat_data in fam_data["materials"]:
                material, _ = Material.objects.get_or_create(
                    code=mat_data["code"],
                    defaults={
                        "name": mat_data["name"],
                        "family": family,
                        "unit": Material.Unit.KG,
                        "valuation_possible": True,
                        "requires_special_review": mat_data.get("requires_special_review", False),
                        "is_active": True,
                    },
                )
                material.name = mat_data["name"]
                material.family = family
                material.save(update_fields=["name", "family", "updated_at"])

                PriceListItem.objects.get_or_create(
                    price_list=price_list,
                    material=material,
                    defaults={"unit_price": mat_data["price"], "is_active": True},
                )
                total_materials += 1

        Device.objects.get_or_create(
            identifier="bascula-vehicular-01",
            defaults={
                "name": "Báscula Vehicular 01",
                "kind": Device.Kind.VEHICLE_SCALE,
                "port": "COM3",
                "is_connected": True,
                "is_stable": True,
                "is_manual_fallback": False,
                "collection_center": center,
                "metadata": {"min_weight": 100, "max_weight": 30000, "model": "Revuelta RV-50T"},
            },
        )
        Device.objects.get_or_create(
            identifier="bascula-secundaria-01",
            defaults={
                "name": "Báscula Secundaria 01",
                "kind": Device.Kind.SECONDARY_SCALE,
                "port": "COM4",
                "is_connected": True,
                "is_stable": True,
                "is_manual_fallback": False,
                "collection_center": center,
                "metadata": {"min_weight": 0.1, "max_weight": 500, "model": "Ohaus D51XW"},
            },
        )
        Device.objects.get_or_create(
            identifier="impresora-epson-01",
            defaults={
                "name": "Impresora Epson TM-T20",
                "kind": Device.Kind.THERMAL_PRINTER,
                "port": "USB001",
                "is_connected": True,
                "is_stable": True,
                "collection_center": center,
                "metadata": {"model": "Epson TM-T20III", "paper_width": 80},
            },
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"Demo OK — {total_materials} materiales, {len(PROVIDERS)} proveedores, "
                f"{len(VEHICLES)} vehículos, 3 dispositivos, 1 lista de precios."
            )
        )
