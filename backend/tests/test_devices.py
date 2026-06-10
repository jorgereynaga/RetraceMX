from decimal import Decimal
import sys

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.devices.models import Device
from apps.devices.views import DeviceViewSet
from apps.devices.adapters import SerialScaleAdapter
from apps.devices.services import build_scale_adapter, read_scale_reading, simulate_print_job
from apps.parties.models import CollectionCenter


pytestmark = pytest.mark.django_db


def test_simulated_printer_uses_configured_port():
    device = Device.objects.create(
        name="Impresora de tickets",
        identifier="printer-001",
        kind=Device.Kind.THERMAL_PRINTER,
        port="COM4",
    )

    result = simulate_print_job(device, {"copies": 1, "is_reprint": False})

    assert result["printer_name"] == "Impresora de tickets"
    assert result["printer_port"] == "COM4"
    assert result["status"] == "printed"


def test_serial_scale_parser_extracts_weight_and_stability():
    parsed = SerialScaleAdapter._parse_line("ST,GS,      1234.50 kg")
    assert parsed is not None
    weight_kg, is_stable = parsed
    assert weight_kg == Decimal("1234.50")
    assert is_stable is True


def test_real_scale_read_uses_serial_port_and_updates_device(monkeypatch):
    device = Device.objects.create(
        name="Bascula real",
        identifier="scale-001",
        kind=Device.Kind.VEHICLE_SCALE,
        port="COM3",
        metadata={"baudrate": 9600, "timeout": 0.2},
    )

    class FakeSerial:
        def __init__(self, **kwargs):
            self.kwargs = kwargs
            self._reads = [b"ST,GS,      1450.25 kg\r\n"]

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def reset_input_buffer(self):
            return None

        def reset_output_buffer(self):
            return None

        def write(self, data):
            self.written = data

        def flush(self):
            return None

        def readline(self):
            return self._reads.pop(0) if self._reads else b""

    fake_serial_module = type(
        "SerialModule",
        (),
        {
            "Serial": FakeSerial,
            "PARITY_NONE": "N",
            "PARITY_EVEN": "E",
            "PARITY_ODD": "O",
            "PARITY_MARK": "M",
            "PARITY_SPACE": "S",
            "FIVEBITS": 5,
            "SIXBITS": 6,
            "SEVENBITS": 7,
            "EIGHTBITS": 8,
            "STOPBITS_ONE": 1,
            "STOPBITS_ONE_POINT_FIVE": 1.5,
            "STOPBITS_TWO": 2,
        },
    )
    monkeypatch.setitem(sys.modules, "serial", fake_serial_module)

    reading = read_scale_reading(device)

    device.refresh_from_db()
    assert reading.weight_kg == Decimal("1450.25")
    assert reading.is_stable is True
    assert reading.raw_value == "ST,GS,      1450.25 kg"
    assert device.is_connected is True
    assert device.last_seen_at is not None


def test_probe_scale_returns_raw_lines(monkeypatch):
    device = Device.objects.create(
        name="Bascula real",
        identifier="scale-003",
        kind=Device.Kind.VEHICLE_SCALE,
        port="COM3",
        metadata={"baudrate": 9600, "timeout": 0.2},
    )

    class FakeSerial:
        def __init__(self, **kwargs):
            self.kwargs = kwargs
            self._reads = [b"ST,GS,      1450.25 kg\r\n", b"OK\r\n"]

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def reset_input_buffer(self):
            return None

        def reset_output_buffer(self):
            return None

        def write(self, data):
            self.written = data

        def flush(self):
            return None

        def readline(self):
            return self._reads.pop(0) if self._reads else b""

    fake_serial_module = type(
        "SerialModule",
        (object,),
        {
            "Serial": FakeSerial,
            "SerialException": OSError,
            "PARITY_NONE": "N",
            "PARITY_EVEN": "E",
            "PARITY_ODD": "O",
            "PARITY_MARK": "M",
            "PARITY_SPACE": "S",
            "FIVEBITS": 5,
            "SIXBITS": 6,
            "SEVENBITS": 7,
            "EIGHTBITS": 8,
            "STOPBITS_ONE": 1,
            "STOPBITS_ONE_POINT_FIVE": 1.5,
            "STOPBITS_TWO": 2,
        },
    )
    monkeypatch.setitem(sys.modules, "serial", fake_serial_module)

    probe = build_scale_adapter(device).probe(max_lines=5)

    assert probe["line_count"] == 2
    assert probe["lines"][0]["text"] == "ST,GS,      1450.25 kg"
    assert probe["lines"][1]["text"] == "OK"


def test_serial_scale_adapter_wraps_plain_query_with_lf_cr(monkeypatch):
    captured = {}

    class FakeSerial:
        def __init__(self, **kwargs):
            captured["kwargs"] = kwargs
            self._reads = [b"ST,GS,      1450.25 kg\r\n"]

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def reset_input_buffer(self):
            return None

        def reset_output_buffer(self):
            return None

        def write(self, data):
            captured["written"] = data

        def flush(self):
            return None

        def readline(self):
            return self._reads.pop(0) if self._reads else b"" 

    fake_serial_module = type(
        "SerialModule",
        (object,),
        {
            "Serial": FakeSerial,
            "SerialException": OSError,
            "PARITY_NONE": "N",
            "PARITY_EVEN": "E",
            "PARITY_ODD": "O",
            "PARITY_MARK": "M",
            "PARITY_SPACE": "S",
            "FIVEBITS": 5,
            "SIXBITS": 6,
            "SEVENBITS": 7,
            "EIGHTBITS": 8,
            "STOPBITS_ONE": 1,
            "STOPBITS_ONE_POINT_FIVE": 1.5,
            "STOPBITS_TWO": 2,
        },
    )
    monkeypatch.setitem(sys.modules, "serial", fake_serial_module)

    adapter = SerialScaleAdapter(
        device_identifier="scale-004",
        port="COM3",
        query="W",
    )

    reading = adapter.read()

    assert captured["written"] == b"\nW\r"
    assert reading.weight_kg == Decimal("1450.25")


def test_real_scale_read_reports_port_open_failure(monkeypatch):
    device = Device.objects.create(
        name="Bascula real",
        identifier="scale-002",
        kind=Device.Kind.VEHICLE_SCALE,
        port="COM4",
        metadata={"baudrate": 9600, "timeout": 0.2},
    )

    class FakeSerial:
        def __init__(self, **kwargs):
            self.kwargs = kwargs
            raise OSError(2, "No such file or directory")

    fake_serial_module = type(
        "SerialModule",
        (object,),
        {
            "Serial": FakeSerial,
            "SerialException": OSError,
            "PARITY_NONE": "N",
            "PARITY_EVEN": "E",
            "PARITY_ODD": "O",
            "PARITY_MARK": "M",
            "PARITY_SPACE": "S",
            "FIVEBITS": 5,
            "SIXBITS": 6,
            "SEVENBITS": 7,
            "EIGHTBITS": 8,
            "STOPBITS_ONE": 1,
            "STOPBITS_ONE_POINT_FIVE": 1.5,
            "STOPBITS_TWO": 2,
        },
    )
    monkeypatch.setitem(sys.modules, "serial", fake_serial_module)

    with pytest.raises(RuntimeError, match="COM4"):
        read_scale_reading(device)


def test_simulated_adapter_is_used_when_metadata_requests_it():
    device = Device.objects.create(
        name="Bascula demo",
        identifier="scale-demo",
        kind=Device.Kind.VEHICLE_SCALE,
        port="COM9",
        metadata={"adapter": "simulated"},
    )

    adapter = build_scale_adapter(device)

    assert adapter.__class__.__name__ == "SimulatedScaleAdapter"


def test_bridge_ingest_scale_creates_reading_and_session():
    User = get_user_model()
    user = User.objects.create_user(username="bridge-admin", password="bridge-pass", is_staff=True, is_superuser=True)
    center = CollectionCenter.objects.create(code="cc-bridge", name="Centro Bridge")
    device = Device.objects.create(
        name="Bascula bridge",
        identifier="STD-21X3-COM5",
        kind=Device.Kind.VEHICLE_SCALE,
        port="COM5",
        collection_center=center,
    )

    factory = APIRequestFactory()
    request = factory.post(
        f"/api/devices/{device.id}/ingest_scale/",
        {
            "weight_kg": "1450.25",
            "raw_value": "ST,GS,      1450.25 kg",
            "is_stable": True,
            "is_manual": False,
            "reading_type": "direct",
            "notes": "Live reading from COM5",
        },
        format="json",
    )
    force_authenticate(request, user=user)

    response = DeviceViewSet.as_view({"post": "ingest_scale"})(request, pk=str(device.id))

    assert response.status_code == 201
    assert response.data["device_id"] == str(device.id)
    assert response.data["raw_value"] == "ST,GS,      1450.25 kg"
    assert response.data["weight_kg"] == "1450.25"
    assert response.data["session_id"]
