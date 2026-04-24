from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone

from .models import Device
from .serializers import DeviceSerializer
from .services import simulate_scale_reading


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
                "captured_at": timezone.now().isoformat(),
            }
        )
