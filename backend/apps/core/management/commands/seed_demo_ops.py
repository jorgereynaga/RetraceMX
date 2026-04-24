from __future__ import annotations

import random
from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.materials.models import Material, PriceListItem
from apps.operations.models import PurchaseOperation, TicketItem
from apps.parties.models import CollectionCenter, PersonOrCompany, Vehicle


MERMA_RATE = Decimal("0.03")

SCENARIOS = [
    {"materials": ["chatarra-suelta", "fierro-fundido"], "method": "vehicle_differential", "gross_range": (4000, 18000), "tare_range": (3200, 6500)},
    {"materials": ["cobre-desnudo", "aluminio-lata"], "method": "secondary_direct", "gross_range": (50, 400), "tare_range": (0, 0)},
    {"materials": ["pet-claro", "pet-color", "pead-natural"], "method": "secondary_direct", "gross_range": (100, 800), "tare_range": (0, 0)},
    {"materials": ["carton-occ", "papel-bond", "periodico"], "method": "vehicle_differential", "gross_range": (2000, 12000), "tare_range": (3000, 5500)},
    {"materials": ["acero-inoxidable", "bronce", "cobre-quemado"], "method": "secondary_direct", "gross_range": (20, 200), "tare_range": (0, 0)},
    {"materials": ["lamina-acero", "varilla-hierro"], "method": "vehicle_differential", "gross_range": (5000, 20000), "tare_range": (3500, 6000)},
    {"materials": ["aluminio-perfil", "plomo", "zinc"], "method": "secondary_direct", "gross_range": (30, 300), "tare_range": (0, 0)},
    {"materials": ["pead-color", "pvc-rigido", "polipropileno"], "method": "secondary_direct", "gross_range": (80, 600), "tare_range": (0, 0)},
    {"materials": ["vidrio-claro", "vidrio-ambar"], "method": "vehicle_differential", "gross_range": (3000, 10000), "tare_range": (3000, 5000)},
    {"materials": ["acumulador"], "method": "secondary_direct", "gross_range": (100, 500), "tare_range": (0, 0)},
]


class Command(BaseCommand):
    help = "Seeds realistic demo purchase operations for testing the dashboard and weighing module."

    def add_arguments(self, parser):
        parser.add_argument("--days", type=int, default=7, help="Number of past days to generate operations for")
        parser.add_argument("--per-day", type=int, default=5, help="Average operations per day")
        parser.add_argument("--clear", action="store_true", help="Clear existing operations before seeding")

    def handle(self, *args, **options):
        if options["clear"]:
            count = PurchaseOperation.objects.count()
            PurchaseOperation.objects.all().delete()
            self.stdout.write(self.style.WARNING(f"Eliminadas {count} operaciones previas."))

        User = get_user_model()
        admin = User.objects.filter(is_superuser=True).first()
        if not admin:
            self.stdout.write(self.style.ERROR("No hay superusuario. Corre seed_demo primero."))
            return

        center = CollectionCenter.objects.filter(code="matriz").first()
        if not center:
            self.stdout.write(self.style.ERROR("No se encontró el centro 'matriz'. Corre seed_demo primero."))
            return

        customers = list(PersonOrCompany.objects.all()[:5])
        if not customers:
            self.stdout.write(self.style.ERROR("No hay personas/empresas. Corre seed_demo primero."))
            return

        vehicles = list(Vehicle.objects.all())
        price_items = {pi.material.code: pi for pi in PriceListItem.objects.select_related("material").filter(is_active=True)}

        if not price_items:
            self.stdout.write(self.style.ERROR("No hay lista de precios activa. Corre seed_demo primero."))
            return

        days = options["days"]
        per_day = options["per_day"]
        total_ops = 0
        total_items = 0

        for day_offset in range(days - 1, -1, -1):
            day = date.today() - timedelta(days=day_offset)
            n_ops = max(1, random.randint(per_day - 2, per_day + 3))

            for op_idx in range(n_ops):
                hour = random.randint(7, 17)
                minute = random.randint(0, 59)
                op_dt = timezone.make_aware(
                    timezone.datetime(day.year, day.month, day.day, hour, minute)
                )

                customer = random.choice(customers)
                vehicle = random.choice(vehicles) if vehicles and random.random() > 0.3 else None
                folio = f"OPE-{day.strftime('%Y%m%d')}-{op_idx + 1:03d}-{random.randint(10,99)}"

                op = PurchaseOperation(
                    folio=folio,
                    collection_center=center,
                    customer=customer,
                    vehicle=vehicle,
                    opened_by=admin,
                    closed_by=admin,
                    status=PurchaseOperation.Status.COMPLETED,
                    payment_status=PurchaseOperation.PaymentStatus.PAID,
                    print_status=PurchaseOperation.PrintStatus.PRINTED,
                    notes="Operación generada por seed_demo_ops",
                )
                op.save()
                PurchaseOperation.objects.filter(pk=op.pk).update(created_at=op_dt)

                scenario = random.choice(SCENARIOS)
                mat_codes = random.sample(
                    scenario["materials"],
                    min(random.randint(1, 2), len(scenario["materials"])),
                )

                op_weight = Decimal("0")
                op_merma = Decimal("0")
                op_amount = Decimal("0")

                for mat_code in mat_codes:
                    price_item = price_items.get(mat_code)
                    if not price_item:
                        continue

                    method = scenario["method"]
                    gross_min, gross_max = scenario["gross_range"]
                    tare_min, tare_max = scenario["tare_range"]

                    gross = Decimal(str(round(random.uniform(gross_min, gross_max), 1)))
                    tare = Decimal(str(round(random.uniform(tare_min, tare_max), 1))) if tare_min > 0 else Decimal("0")
                    if tare >= gross:
                        tare = gross * Decimal("0.25")

                    net = gross - tare
                    merma = (net * MERMA_RATE).quantize(Decimal("0.001"))
                    net_clean = net - merma
                    unit_price = price_item.unit_price
                    amount = (net_clean * unit_price).quantize(Decimal("0.01"))

                    item = TicketItem(
                        operation=op,
                        material=price_item.material,
                        method=method,
                        gross_weight_kg=gross,
                        tare_weight_kg=tare,
                        net_weight_kg=net_clean,
                        merma_kg=merma,
                        unit_price=unit_price,
                        amount=amount,
                        status=TicketItem.Status.CONFIRMED,
                        confirmed_by=admin,
                    )
                    item.save()
                    TicketItem.objects.filter(pk=item.pk).update(created_at=op_dt)

                    op_weight += net_clean
                    op_merma += merma
                    op_amount += amount
                    total_items += 1

                PurchaseOperation.objects.filter(pk=op.pk).update(
                    total_weight_kg=op_weight,
                    total_merma_kg=op_merma,
                    total_amount=op_amount,
                    confirmed_at=op_dt,
                    completed_at=op_dt,
                    created_at=op_dt,
                )
                total_ops += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Demo operaciones OK — {total_ops} operaciones, {total_items} partidas confirmadas en {days} días."
            )
        )
