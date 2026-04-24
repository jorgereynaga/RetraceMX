from rest_framework import decorators, response, status, viewsets
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser

from .models import CustodyEvent, EvidenceFile, PrintLog
from .serializers import CustodyEventSerializer, EvidenceFileSerializer, PrintLogSerializer
from .services import register_print_event


class CustodyEventViewSet(viewsets.ModelViewSet):
    queryset = CustodyEvent.objects.select_related("operation", "ticket_item", "created_by").all().order_by("-created_at")
    serializer_class = CustodyEventSerializer


class EvidenceFileViewSet(viewsets.ModelViewSet):
    queryset = EvidenceFile.objects.select_related("operation", "ticket_item", "custody_event", "trip").all().order_by("-created_at")
    serializer_class = EvidenceFileSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]


class PrintLogViewSet(viewsets.ModelViewSet):
    queryset = PrintLog.objects.select_related("operation", "printer_device", "printed_by").all().order_by("-printed_at")
    serializer_class = PrintLogSerializer

    @decorators.action(detail=True, methods=["post"])
    def reprint(self, request, pk=None):
        print_log = self.get_object()
        new_log = register_print_event(
            operation=print_log.operation,
            printed_by=request.user,
            printer_device=print_log.printer_device,
            printer_name=print_log.printer_name,
            is_reprint=True,
            copies=print_log.copies,
            payload=print_log.payload,
            notes="Reimpresión solicitada desde API.",
        )
        return response.Response(self.get_serializer(new_log).data, status=status.HTTP_201_CREATED)
