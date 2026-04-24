from __future__ import annotations

from .models import Device
from .simulators import SimulatedScaleAdapter, SimulatedThermalPrinter


def build_scale_simulator(device: Device):
    return SimulatedScaleAdapter(device_identifier=device.identifier, kind=device.kind)


def build_printer_simulator(device: Device):
    return SimulatedThermalPrinter(identifier=device.identifier, name=device.name)


def simulate_scale_reading(device: Device):
    adapter = build_scale_simulator(device)
    return adapter.read()


def simulate_print_job(device: Device, payload: dict):
    printer = build_printer_simulator(device)
    return printer.print_ticket(payload)
