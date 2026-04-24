from __future__ import annotations

from datetime import date
from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.materials.models import Material, MaterialFamily, PriceList, PriceListItem
from apps.parties.models import CollectionCenter


PRICE_LIST_CODE = "lista-inv02-25-28-2026"
PRICE_LIST_NAME = "Lista INV02-25-28 21-03-2026"
PRICE_LIST_VALID_FROM = date(2026, 3, 21)

FAMILY_DEFINITIONS = {
    "papel_carton": {
        "name": "Papel y carton",
        "description": "Materiales fibrosos y celulósicos.",
        "operational_classification": "Valorizable",
        "possible_valuation": True,
        "special_review": False,
    },
    "plastico": {
        "name": "Plastico",
        "description": "Plásticos duros y valorizables.",
        "operational_classification": "Valorizable",
        "possible_valuation": True,
        "special_review": False,
    },
    "aluminio": {
        "name": "Aluminio",
        "description": "Perfiles, botes, lámina y rebabas de aluminio.",
        "operational_classification": "Valorizable",
        "possible_valuation": True,
        "special_review": False,
    },
    "cobre": {
        "name": "Cobre",
        "description": "Cobre y materiales con contenido de cobre.",
        "operational_classification": "Valorizable",
        "possible_valuation": True,
        "special_review": False,
    },
    "bronce": {
        "name": "Bronce",
        "description": "Bronce y mezclas con contenido de bronce.",
        "operational_classification": "Valorizable",
        "possible_valuation": True,
        "special_review": False,
    },
    "plomo_baterias": {
        "name": "Plomo y baterias",
        "description": "Plomo, baterías y materiales con revisión especial.",
        "operational_classification": "Valorizable",
        "possible_valuation": True,
        "special_review": True,
    },
    "ferroso": {
        "name": "Ferrosos",
        "description": "Acero, fierro, lámina y derivados ferrosos.",
        "operational_classification": "Valorizable",
        "possible_valuation": True,
        "special_review": False,
    },
    "vidrio": {
        "name": "Vidrio",
        "description": "Vidrio por color o presentación.",
        "operational_classification": "Valorizable",
        "possible_valuation": True,
        "special_review": False,
    },
    "electronicos": {
        "name": "Electronicos",
        "description": "Componentes y aparatos electrónicos.",
        "operational_classification": "Revision especial",
        "possible_valuation": True,
        "special_review": True,
    },
    "mixto": {
        "name": "Mixtos",
        "description": "Materiales revueltos o de clasificación mixta.",
        "operational_classification": "Revision especial",
        "possible_valuation": True,
        "special_review": True,
    },
    "especial": {
        "name": "Especiales",
        "description": "Materiales de tratamiento o revisión especial.",
        "operational_classification": "Revision especial",
        "possible_valuation": True,
        "special_review": True,
    },
    "otros": {
        "name": "Otros",
        "description": "Materiales no clasificados en las familias principales.",
        "operational_classification": "Revision especial",
        "possible_valuation": True,
        "special_review": True,
    },
}

MATERIAL_ROWS = [
    {"source_id": 2, "code": "IC1-2", "name": "Carton de 2da", "quantity": "304682.65", "family_code": "papel_carton", "unit": Material.Unit.KG, "suggested_price_mxn": "1.800"},
    {"source_id": 8, "code": "IP2-4", "name": "Periódico", "quantity": "1415", "family_code": "papel_carton", "unit": Material.Unit.KG, "suggested_price_mxn": "2.100"},
    {"source_id": 12, "code": "IP3-2", "name": "Plástico duro", "quantity": "21426.8", "family_code": "plastico", "unit": Material.Unit.KG, "suggested_price_mxn": "6.800"},
    {"source_id": 23, "code": "IA10-1", "name": "Bote de aluminio", "quantity": "7690.8", "family_code": "aluminio", "unit": Material.Unit.KG, "suggested_price_mxn": "25.000"},
    {"source_id": 25, "code": "IA11-2", "name": "Alumunio Delgado", "quantity": "3387.2", "family_code": "aluminio", "unit": Material.Unit.KG, "suggested_price_mxn": "28.500"},
    {"source_id": 26, "code": "IA11-3", "name": "Aluminio Grueso", "quantity": "1285", "family_code": "aluminio", "unit": Material.Unit.KG, "suggested_price_mxn": "3.500"},
    {"source_id": 27, "code": "IA11-4", "name": "Radiador de aluminio", "quantity": "881.4", "family_code": "aluminio", "unit": Material.Unit.KG, "suggested_price_mxn": "16.500"},
    {"source_id": 28, "code": "IA11-5", "name": "Aluminio Rin", "quantity": "2035", "family_code": "aluminio", "unit": Material.Unit.KG, "suggested_price_mxn": "28.500"},
    {"source_id": 29, "code": "IL12-1", "name": "Lamina", "quantity": "584693.5", "family_code": "aluminio", "unit": Material.Unit.KG, "suggested_price_mxn": "7.200"},
    {"source_id": 30, "code": "IL12-2", "name": "Bote Chilero", "quantity": "38228", "family_code": "aluminio", "unit": Material.Unit.KG, "suggested_price_mxn": "9.500"},
    {"source_id": 31, "code": "IC13-1", "name": "Cobre de 1ra", "quantity": "224", "family_code": "cobre", "unit": Material.Unit.KG, "suggested_price_mxn": "165.000"},
    {"source_id": 32, "code": "IC13-2", "name": "Cobre de 2da", "quantity": "2170.6", "family_code": "cobre", "unit": Material.Unit.KG, "suggested_price_mxn": "138.000"},
    {"source_id": 33, "code": "IC13-3", "name": "RVC Radiador vena de cobre", "quantity": "344.6", "family_code": "cobre", "unit": Material.Unit.KG, "suggested_price_mxn": "122.000"},
    {"source_id": 34, "code": "IB14-1", "name": "Bronce", "quantity": "1429.6", "family_code": "bronce", "unit": Material.Unit.KG, "suggested_price_mxn": "98.000"},
    {"source_id": 35, "code": "IB14-2", "name": "Radiador de Bronce", "quantity": "675.4", "family_code": "bronce", "unit": Material.Unit.KG, "suggested_price_mxn": "72.000"},
    {"source_id": 36, "code": "IA15-1", "name": "Antimonio", "quantity": "465", "family_code": "especial", "unit": Material.Unit.KG, "suggested_price_mxn": "18.000"},
    {"source_id": 37, "code": "IG16-1", "name": "Gallina", "quantity": "5826.6", "family_code": "otros", "unit": Material.Unit.KG, "suggested_price_mxn": "22.000"},
    {"source_id": 42, "code": "IP2-1", "name": "Papel para separar", "quantity": "164964", "family_code": "papel_carton", "unit": Material.Unit.KG, "suggested_price_mxn": "1.200"},
    {"source_id": 49, "code": "PI-8", "name": "Bateria de moto", "quantity": "2643.8", "family_code": "plomo_baterias", "unit": Material.Unit.PIECE, "suggested_price_mxn": "180.000"},
    {"source_id": 50, "code": "PL-1", "name": "Plomo", "quantity": "6492.2", "family_code": "plomo_baterias", "unit": Material.Unit.KG, "suggested_price_mxn": "28.000"},
    {"source_id": 51, "code": "PL-2", "name": "Plancha", "quantity": "47", "family_code": "ferroso", "unit": Material.Unit.KG, "suggested_price_mxn": "8.000"},
    {"source_id": 52, "code": "AC-1", "name": "Acero", "quantity": "5424.4", "family_code": "ferroso", "unit": Material.Unit.KG, "suggested_price_mxn": "4.200"},
    {"source_id": 53, "code": "VO-1", "name": "Volador", "quantity": "0", "family_code": "mixto", "unit": Material.Unit.KG, "suggested_price_mxn": "5.500"},
    {"source_id": 54, "code": "RA-1", "name": "Radiador de Plomo", "quantity": "54.6", "family_code": "plomo_baterias", "unit": Material.Unit.KG, "suggested_price_mxn": "24.000"},
    {"source_id": 55, "code": "FI-1", "name": "FIERRO", "quantity": "488813.8", "family_code": "ferroso", "unit": Material.Unit.KG, "suggested_price_mxn": "4.200"},
    {"source_id": 58, "code": "RE-1", "name": "REVUELTO", "quantity": "159174.6", "family_code": "mixto", "unit": Material.Unit.KG, "suggested_price_mxn": "3.800"},
    {"source_id": 59, "code": "GU-1", "name": "GUATO", "quantity": "4431.6", "family_code": "mixto", "unit": Material.Unit.KG, "suggested_price_mxn": "4.800"},
    {"source_id": 60, "code": "GU-2", "name": "GUATO ACERO", "quantity": "0", "family_code": "ferroso", "unit": Material.Unit.KG, "suggested_price_mxn": "4.200"},
    {"source_id": 61, "code": "GU-3", "name": "GUATO BRONCE", "quantity": "175.2", "family_code": "bronce", "unit": Material.Unit.KG, "suggested_price_mxn": "98.000"},
    {"source_id": 62, "code": "GU-4", "name": "GUATO COBRE", "quantity": "102.2", "family_code": "cobre", "unit": Material.Unit.KG, "suggested_price_mxn": "115.000"},
    {"source_id": 65, "code": "REB-1", "name": "Rebaba de bronce", "quantity": "0", "family_code": "bronce", "unit": Material.Unit.KG, "suggested_price_mxn": "98.000"},
    {"source_id": 66, "code": "REB-2", "name": "Rebaba de fierro", "quantity": "14160", "family_code": "ferroso", "unit": Material.Unit.KG, "suggested_price_mxn": "4.200"},
    {"source_id": 68, "code": "REB-3", "name": "Rebaba de aluminio", "quantity": "0", "family_code": "aluminio", "unit": Material.Unit.KG, "suggested_price_mxn": "20.000"},
    {"source_id": 69, "code": "PI-1", "name": "TABLETA", "quantity": "0", "family_code": "electronicos", "unit": Material.Unit.PIECE, "suggested_price_mxn": "120.000"},
    {"source_id": 70, "code": "PI-2", "name": "LAPTOP", "quantity": "0", "family_code": "electronicos", "unit": Material.Unit.PIECE, "suggested_price_mxn": "350.000"},
    {"source_id": 71, "code": "PI-3", "name": "PILA ESTANDAR", "quantity": "0", "family_code": "plomo_baterias", "unit": Material.Unit.PIECE, "suggested_price_mxn": "1.200"},
    {"source_id": 72, "code": "PI-4", "name": "PILA CACHETONA", "quantity": "0", "family_code": "plomo_baterias", "unit": Material.Unit.PIECE, "suggested_price_mxn": "2.200"},
    {"source_id": 73, "code": "PI-5", "name": "PILA RAYADA", "quantity": "0", "family_code": "plomo_baterias", "unit": Material.Unit.PIECE, "suggested_price_mxn": "1.500"},
    {"source_id": 74, "code": "PI-6", "name": "PILA FORD", "quantity": "0", "family_code": "plomo_baterias", "unit": Material.Unit.PIECE, "suggested_price_mxn": "2.500"},
    {"source_id": 75, "code": "P-8020", "name": "PAPEL 80/20", "quantity": "10320", "family_code": "papel_carton", "unit": Material.Unit.KG, "suggested_price_mxn": "1.500"},
    {"source_id": 76, "code": "ARB", "name": "ARCHIVO BLANCO", "quantity": "595", "family_code": "papel_carton", "unit": Material.Unit.KG, "suggested_price_mxn": "2.200"},
    {"source_id": 77, "code": "TU", "name": "TUBO", "quantity": "0", "family_code": "ferroso", "unit": Material.Unit.KG, "suggested_price_mxn": "4.200"},
    {"source_id": 78, "code": "VI", "name": "VIDRIO VERDE", "quantity": "0", "family_code": "vidrio", "unit": Material.Unit.KG, "suggested_price_mxn": "0.500"},
    {"source_id": 79, "code": "VI-2", "name": "VIDRIO CRISTALINO", "quantity": "5878", "family_code": "vidrio", "unit": Material.Unit.KG, "suggested_price_mxn": "0.800"},
    {"source_id": 80, "code": "VI-3", "name": "VIDRIO CAFE", "quantity": "4158", "family_code": "vidrio", "unit": Material.Unit.KG, "suggested_price_mxn": "0.600"},
    {"source_id": 81, "code": "CP-1", "name": "CABLE PERFIL", "quantity": "138.2", "family_code": "cobre", "unit": Material.Unit.KG, "suggested_price_mxn": "58.000"},
    {"source_id": 82, "code": "R-1", "name": "RADIOGRAGIA", "quantity": "746.6", "family_code": "electronicos", "unit": Material.Unit.PIECE, "suggested_price_mxn": "6.500"},
    {"source_id": 83, "code": "D-1", "name": "DISCO", "quantity": "899", "family_code": "electronicos", "unit": Material.Unit.PIECE, "suggested_price_mxn": "8.500"},
    {"source_id": 84, "code": "C-2", "name": "CELULAR", "quantity": "197.6", "family_code": "electronicos", "unit": Material.Unit.PIECE, "suggested_price_mxn": "85.000"},
    {"source_id": 85, "code": "T-1", "name": "TARJETA", "quantity": "56.2", "family_code": "electronicos", "unit": Material.Unit.PIECE, "suggested_price_mxn": "48.000"},
    {"source_id": 88, "code": "IC1-1", "name": "Carton de 1ra", "quantity": "124138", "family_code": "papel_carton", "unit": Material.Unit.KG, "suggested_price_mxn": "2.400"},
    {"source_id": 89, "code": "A-I", "name": "AUDIO", "quantity": "19.2", "family_code": "electronicos", "unit": Material.Unit.PIECE, "suggested_price_mxn": "70.000"},
    {"source_id": 92, "code": "01-MON", "name": "PTR", "quantity": "19", "family_code": "ferroso", "unit": Material.Unit.KG, "suggested_price_mxn": "4.200"},
    {"source_id": 94, "code": "AL-PE", "name": "Aluminio perfil", "quantity": "876", "family_code": "aluminio", "unit": Material.Unit.KG, "suggested_price_mxn": "34.000"},
    {"source_id": 95, "code": "L-2", "name": "LAMINAS VENTA", "quantity": "0", "family_code": "aluminio", "unit": Material.Unit.KG, "suggested_price_mxn": "7.200"},
]


class Command(BaseCommand):
    help = "Carga materiales del PDF INV02-25-28 y actualiza una lista de precios con valores sugeridos."

    def add_arguments(self, parser):
        parser.add_argument(
            "--price-list-code",
            default=PRICE_LIST_CODE,
            help="Codigo de la lista de precios a crear o actualizar.",
        )
        parser.add_argument(
            "--price-list-name",
            default=PRICE_LIST_NAME,
            help="Nombre de la lista de precios a crear o actualizar.",
        )
        parser.add_argument(
            "--valid-from",
            default=PRICE_LIST_VALID_FROM.isoformat(),
            help="Fecha de vigencia inicial en formato YYYY-MM-DD.",
        )
        parser.add_argument(
            "--center-code",
            default="matriz",
            help="Codigo del centro de acopio o destino al que se asociara la lista.",
        )

    def handle(self, *args, **options):
        price_list_code = options["price_list_code"]
        price_list_name = options["price_list_name"]
        valid_from = date.fromisoformat(options["valid_from"])
        center_code = options["center_code"]

        collection_center = CollectionCenter.objects.filter(code=center_code).first()
        if collection_center is None:
            collection_center = CollectionCenter.objects.order_by("created_at").first()
        if collection_center is None:
            raise CommandError("No existe un centro de acopio o destino para asociar la lista de precios.")

        created_families = 0
        updated_families = 0
        created_materials = 0
        updated_materials = 0
        created_items = 0
        updated_items = 0

        with transaction.atomic():
            families: dict[str, MaterialFamily] = {}
            for family_code, definition in FAMILY_DEFINITIONS.items():
                family, created = MaterialFamily.objects.update_or_create(
                    code=family_code,
                    defaults={
                        "name": definition["name"],
                        "description": definition["description"],
                        "operational_classification": definition["operational_classification"],
                        "possible_valuation": definition["possible_valuation"],
                        "special_review": definition["special_review"],
                    },
                )
                families[family_code] = family
                if created:
                    created_families += 1
                else:
                    updated_families += 1

            price_list, _ = PriceList.objects.update_or_create(
                code=price_list_code,
                defaults={
                    "name": price_list_name,
                    "collection_center": collection_center,
                    "currency": "MXN",
                    "valid_from": valid_from,
                    "valid_to": None,
                    "is_active": True,
                },
            )

            for row in MATERIAL_ROWS:
                family = families[row["family_code"]]
                material, material_created = Material.objects.update_or_create(
                    code=row["code"],
                    defaults={
                        "name": row["name"],
                        "family": family,
                        "unit": row["unit"],
                        "valuation_possible": True,
                        "is_hazard_auxiliary": row["family_code"] in {"plomo_baterias", "electronicos", "especial"},
                        "requires_special_review": row["family_code"] in {"plomo_baterias", "electronicos", "especial", "mixto"},
                        "is_active": True,
                    },
                )
                if material_created:
                    created_materials += 1
                else:
                    updated_materials += 1

                _, item_created = PriceListItem.objects.update_or_create(
                    price_list=price_list,
                    material=material,
                    defaults={
                        "unit_price": Decimal(row["suggested_price_mxn"]),
                        "is_active": True,
                    },
                )
                if item_created:
                    created_items += 1
                else:
                    updated_items += 1

        self.stdout.write(
            self.style.SUCCESS(
                "Materiales cargados: %s creados / %s actualizados. Familias: %s creadas / %s actualizadas. "
                "Lista '%s' con %s partidas creadas / %s actualizadas."
                % (
                    created_materials,
                    updated_materials,
                    created_families,
                    updated_families,
                    price_list.code,
                    created_items,
                    updated_items,
                )
            )
        )
