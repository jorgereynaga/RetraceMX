from __future__ import annotations

import random
from dataclasses import dataclass
from decimal import Decimal

from .adapters import ScaleReadingPayload


@dataclass
class SimulatedScaleAdapter:
    device_identifier: str
    kind: str = "vehicle_scale"
    min_weight: Decimal = Decimal("40.0")
    max_weight: Decimal = Decimal("1500.0")
    unstable_probability: float = 0.08
    disconnected_probability: float = 0.02

    def read(self) -> ScaleReadingPayload:
        disconnected = random.random() < self.disconnected_probability
        if disconnected:
            return ScaleReadingPayload(
                device_identifier=self.device_identifier,
                weight_kg=Decimal("0"),
                is_stable=False,
                is_manual=False,
                disconnected=True,
                raw_value="DISCONNECTED",
            )
        weight = Decimal(str(round(random.uniform(float(self.min_weight), float(self.max_weight)), 3)))
        stable = random.random() >= self.unstable_probability
        return ScaleReadingPayload(
            device_identifier=self.device_identifier,
            weight_kg=weight,
            is_stable=stable,
            is_manual=False,
            raw_value=f"{weight}",
        )


@dataclass
class SimulatedThermalPrinter:
    identifier: str
    name: str = "Epson TM-T20"
    port: str = ""

    def print_ticket(self, payload: dict) -> dict:
        return {
            "printer_identifier": self.identifier,
            "printer_name": self.name,
            "printer_port": self.port,
            "status": "printed",
            "copies": payload.get("copies", 1),
            "is_reprint": payload.get("is_reprint", False),
            "payload": payload,
        }
