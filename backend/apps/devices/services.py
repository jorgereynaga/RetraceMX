from __future__ import annotations

from decimal import Decimal

from django.utils import timezone

from .adapters import SerialScaleAdapter
from .models import Device
from .simulators import SimulatedScaleAdapter, SimulatedThermalPrinter


def _device_metadata(device: Device) -> dict:
    return device.metadata or {}


def _serial_settings_from_metadata(device: Device) -> dict:
    meta = _device_metadata(device)
    settings = {
        "baudrate": int(meta.get("baudrate", 9600)),
        "bytesize": int(meta.get("bytesize", 8)),
        "parity": str(meta.get("parity", "N")).upper(),
        "stopbits": float(meta.get("stopbits", 1)),
        "timeout": float(meta.get("timeout", meta.get("timeout_seconds", 1.5))),
        "encoding": str(meta.get("encoding", "utf-8")),
        "query": str(meta.get("query", "")),
    }
    return settings


def build_scale_simulator(device: Device):
    meta = _device_metadata(device)
    kwargs = dict(device_identifier=device.identifier, kind=device.kind)
    if "min_weight" in meta:
        kwargs["min_weight"] = Decimal(str(meta["min_weight"]))
    if "max_weight" in meta:
        kwargs["max_weight"] = Decimal(str(meta["max_weight"]))
    if device.kind == Device.Kind.VEHICLE_SCALE and "min_weight" not in meta:
        kwargs["min_weight"] = Decimal("3500")
        kwargs["max_weight"] = Decimal("28000")
    return SimulatedScaleAdapter(**kwargs)


def build_scale_adapter(device: Device):
    meta = _device_metadata(device)
    if meta.get("adapter") == "simulated" or not device.port:
        return build_scale_simulator(device)
    return SerialScaleAdapter(device_identifier=device.identifier, port=device.port, kind=device.kind, **_serial_settings_from_metadata(device))


def build_printer_simulator(device: Device):
    return SimulatedThermalPrinter(identifier=device.identifier, name=device.name, port=device.port)


def _sync_device_state(device: Device, *, is_connected: bool, is_stable: bool | None = None):
    device.is_connected = is_connected
    device.last_seen_at = timezone.now()
    updates = ["is_connected", "last_seen_at", "updated_at"]
    if is_stable is not None:
        device.is_stable = is_stable
        updates.insert(1, "is_stable")
    device.save(update_fields=updates)


def simulate_scale_reading(device: Device):
    adapter = build_scale_simulator(device)
    return adapter.read()


def read_scale_reading(device: Device):
    adapter = build_scale_adapter(device)
    reading = adapter.read()
    _sync_device_state(device, is_connected=True, is_stable=reading.is_stable)
    return reading


def probe_scale_reading(device: Device, max_lines: int = 5):
    adapter = build_scale_adapter(device)
    if not hasattr(adapter, "probe"):
        return {"port": device.port, "line_count": 0, "lines": []}
    return adapter.probe(max_lines=max_lines)


def simulate_print_job(device: Device, payload: dict):
    printer = build_printer_simulator(device)
    return printer.print_ticket(payload)
