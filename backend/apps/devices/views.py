from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone

from .models import Device
from .serializers import DeviceSerializer
from .services import probe_scale_reading, read_scale_reading, simulate_print_job, simulate_scale_reading
from apps.weighing.services import get_or_create_bridge_session, register_scale_reading


class DeviceViewSet(viewsets.ModelViewSet):
    queryset = Device.objects.select_related("collection_center").all().order_by("name")
    serializer_class = DeviceSerializer

    @action(detail=True, methods=["get"])
    def simulate_scale(self, request, pk=None):
        device = self.get_object()
        if device.kind not in {Device.Kind.VEHICLE_SCALE, Device.Kind.SECONDARY_SCALE}:
            return Response({"detail": "El dispositivo no es una bascula."}, status=400)
        reading = simulate_scale_reading(device)
        return Response(
            {
                "device_id": str(device.id),
                "device_name": device.name,
                "kind": device.kind,
                "raw_value": reading.raw_value,
                "weight_kg": str(reading.weight_kg),
                "is_stable": reading.is_stable,
                "is_manual_fallback": device.is_manual_fallback,
                "port": device.port,
                "captured_at": timezone.now().isoformat(),
            }
        )

    @action(detail=True, methods=["post"])
    def read_scale(self, request, pk=None):
        device = self.get_object()
        if device.kind not in {Device.Kind.VEHICLE_SCALE, Device.Kind.SECONDARY_SCALE}:
            return Response({"detail": "El dispositivo no es una bascula."}, status=400)
        try:
            reading = read_scale_reading(device)
        except RuntimeError as exc:
            device.is_connected = False
            device.last_seen_at = timezone.now()
            device.save(update_fields=["is_connected", "last_seen_at", "updated_at"])
            return Response({"detail": str(exc)}, status=400)
        return Response(
            {
                "device_id": str(device.id),
                "device_name": device.name,
                "kind": device.kind,
                "raw_value": reading.raw_value,
                "weight_kg": str(reading.weight_kg),
                "is_stable": reading.is_stable,
                "is_manual_fallback": device.is_manual_fallback,
                "port": device.port,
                "captured_at": timezone.now().isoformat(),
            }
        )

    @action(detail=True, methods=["post"])
    def probe_scale(self, request, pk=None):
        device = self.get_object()
        if device.kind not in {Device.Kind.VEHICLE_SCALE, Device.Kind.SECONDARY_SCALE}:
            return Response({"detail": "El dispositivo no es una bascula."}, status=400)
        max_lines = int((request.data or {}).get("max_lines") or 5)
        try:
            probe = probe_scale_reading(device, max_lines=max_lines)
        except RuntimeError as exc:
            device.is_connected = False
            device.last_seen_at = timezone.now()
            device.save(update_fields=["is_connected", "last_seen_at", "updated_at"])
            return Response({"detail": str(exc)}, status=400)
        return Response(
            {
                "device_id": str(device.id),
                "device_name": device.name,
                "kind": device.kind,
                "port": device.port,
                "captured_at": timezone.now().isoformat(),
                **probe,
            }
        )

    @action(detail=True, methods=["post"])
    def ingest_scale(self, request, pk=None):
        device = self.get_object()
        if device.kind not in {Device.Kind.VEHICLE_SCALE, Device.Kind.SECONDARY_SCALE}:
            return Response({"detail": "El dispositivo no es una bascula."}, status=400)

        payload = request.data or {}
        try:
            session = get_or_create_bridge_session(device=device, captured_at=payload.get("captured_at"))
        except Exception as exc:
            return Response({"detail": str(exc)}, status=400)

        reading = register_scale_reading(
            session=session,
            device=device,
            reading_type=payload.get("reading_type", "direct"),
            gross_weight_kg=payload.get("gross_weight_kg"),
            tare_weight_kg=payload.get("tare_weight_kg"),
            net_weight_kg=payload.get("net_weight_kg", payload.get("weight_kg")),
            raw_value=payload.get("raw_value", ""),
            is_stable=bool(payload.get("is_stable", True)),
            is_manual=bool(payload.get("is_manual", False)),
            note=payload.get("notes", payload.get("note", "")),
        )

        device.is_connected = True
        device.is_stable = reading.is_stable
        device.last_seen_at = timezone.now()
        device.metadata = {**(device.metadata or {}), "bridge_mode": True, "bridge_enabled": True}
        device.save(update_fields=["is_connected", "is_stable", "last_seen_at", "metadata", "updated_at"])

        return Response(
            {
                "device_id": str(device.id),
                "device_name": device.name,
                "kind": device.kind,
                "session_id": str(session.id),
                "reading_id": str(reading.id),
                "raw_value": reading.raw_value,
                "weight_kg": str(reading.net_weight_kg or reading.gross_weight_kg or payload.get("weight_kg") or ""),
                "is_stable": reading.is_stable,
                "is_manual_fallback": device.is_manual_fallback,
                "port": device.port,
                "captured_at": reading.captured_at.isoformat(),
            },
            status=201,
        )

    @action(detail=True, methods=["post"])
    def simulate_print(self, request, pk=None):
        device = self.get_object()
        if device.kind != Device.Kind.THERMAL_PRINTER:
            return Response({"detail": "El dispositivo no es una impresora."}, status=400)
        result = simulate_print_job(device, request.data or {})
        return Response(
            {
                "device_id": str(device.id),
                "device_name": device.name,
                "kind": device.kind,
                **result,
            }
        )
