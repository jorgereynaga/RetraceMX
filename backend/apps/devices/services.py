from __future__ import annotations

from .models import Device
from .simulators import SimulatedScaleAdapter, SimulatedThermalPrinter


def build_scale_simulator(device: Device):
    meta = device.metadata or {}
    kwargs = dict(device_identifier=device.identifier, kind=device.kind)
    if "min_weight" in meta:
        from decimal import Decimal
        kwargs["min_weight"] = Decimal(str(meta["min_weight"]))
    if "max_weight" in meta:
        from decimal import Decimal
        kwargs["max_weight"] = Decimal(str(meta["max_weight"]))
    if device.kind == Device.Kind.VEHICLE_SCALE and "min_weight" not in meta:
        from decimal import Decimal
        kwargs["min_weight"] = Decimal("3500")
        kwargs["max_weight"] = Decimal("28000")
    return SimulatedScaleAdapter(**kwargs)


def build_printer_simulator(device: Device):
    return SimulatedThermalPrinter(identifier=device.identifier, name=device.name)


def simulate_scale_reading(device: Device):
    adapter = build_scale_simulator(device)
    return adapter.read()


def simulate_print_job(device: Device, payload: dict):
    printer = build_printer_simulator(device)
    return printer.print_ticket(payload)
