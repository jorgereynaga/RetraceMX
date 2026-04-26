from rest_framework import status, viewsets
from rest_framework.response import Response

from apps.auditing.services import register_audit_event
from .models import ScaleReading, WeighingSession
from .serializers import ScaleReadingSerializer, WeighingSessionSerializer
from .services import register_scale_reading


class WeighingSessionViewSet(viewsets.ModelViewSet):
    queryset = WeighingSession.objects.select_related("collection_center", "operation", "device").prefetch_related("readings").all()
    serializer_class = WeighingSessionSerializer
    filterset_fields = ["vehicle"]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        session = serializer.save()
        register_audit_event(actor=request.user, action="create_weighing_session", entity=session, details={"kind": session.kind})
        output = self.get_serializer(session)
        return Response(output.data, status=status.HTTP_201_CREATED)


class ScaleReadingViewSet(viewsets.ModelViewSet):
    queryset = ScaleReading.objects.select_related("session", "device").all().order_by("-captured_at")
    serializer_class = ScaleReadingSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reading = register_scale_reading(
            session=serializer.validated_data["session"],
            device=serializer.validated_data["device"],
            reading_type=serializer.validated_data["reading_type"],
            gross_weight_kg=serializer.validated_data.get("gross_weight_kg"),
            tare_weight_kg=serializer.validated_data.get("tare_weight_kg"),
            net_weight_kg=serializer.validated_data.get("net_weight_kg"),
            raw_value=serializer.validated_data.get("raw_value", ""),
            is_stable=serializer.validated_data.get("is_stable", True),
            is_manual=serializer.validated_data.get("is_manual", False),
            note=serializer.validated_data.get("note", ""),
        )
        output = self.get_serializer(reading)
        return Response(output.data, status=status.HTTP_201_CREATED)
