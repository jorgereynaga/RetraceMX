from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Protocol


@dataclass
class ScaleReadingPayload:
    device_identifier: str
    weight_kg: Decimal
    is_stable: bool
    is_manual: bool
    disconnected: bool = False
    raw_value: str = ""


class ScaleAdapter(Protocol):
    def read(self) -> ScaleReadingPayload: ...


class ThermalPrinterAdapter(Protocol):
    def print_ticket(self, payload: dict) -> dict: ...

