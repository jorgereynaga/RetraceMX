import os

from django.contrib import admin
from django.shortcuts import redirect
from django.urls import include, path
from django.conf import settings
from django.conf.urls.static import static
from rest_framework.routers import DefaultRouter

from apps.users.views import LoginView, UserViewSet, RoleViewSet
from apps.parties.views import CommercialRoleViewSet, PersonOrCompanyViewSet, VehicleViewSet, DriverViewSet, CollectionCenterViewSet
from apps.materials.views import MaterialFamilyViewSet, MaterialViewSet, PriceListItemViewSet, PriceListViewSet
from apps.materials.views import price_suggestion
from apps.processing.views import MaterialProcessInputViewSet, MaterialProcessOutputViewSet, MaterialProcessViewSet, MaterialProcessWasteViewSet, ProcessTypeViewSet
from apps.logistics.views import CollectionTripIncidentViewSet, CollectionTripStopViewSet, CollectionTripTelemetryPointViewSet, CollectionTripViewSet, DeliveryEvidenceViewSet, DeliveryIncidentViewSet, DeliveryItemViewSet, DeliveryRouteStopViewSet, DeliveryViewSet, GeoEventViewSet, GPSPositionIngestView, GPSPositionViewSet, RouteViewSet
from apps.devices.views import DeviceViewSet
from apps.weighing.views import WeighingSessionViewSet, ScaleReadingViewSet
from apps.operations.views import PurchaseOperationViewSet, TicketItemViewSet
from apps.commercialization.views import SaleOrderViewSet, SaleItemViewSet, SalePaymentViewSet, SaleStockView
from apps.payments.views import PaymentViewSet
from apps.inventory.views import InventoryMovementViewSet
from apps.evidence.views import EvidenceFileViewSet, CustodyEventViewSet, PrintLogViewSet
from apps.auditing.views import AuditLogViewSet
from apps.reporting.views import BasicReportView, DailyReportView, LotTraceReportView

router = DefaultRouter()
router.register("users", UserViewSet)
router.register("roles", RoleViewSet)
router.register("commercial-roles", CommercialRoleViewSet)
router.register("parties", PersonOrCompanyViewSet)
router.register("vehicles", VehicleViewSet)
router.register("drivers", DriverViewSet)
router.register("collection-centers", CollectionCenterViewSet)
router.register("material-families", MaterialFamilyViewSet)
router.register("materials", MaterialViewSet)
router.register("price-lists", PriceListViewSet)
router.register("price-list-items", PriceListItemViewSet)
router.register("process-types", ProcessTypeViewSet)
router.register("material-processes", MaterialProcessViewSet)
router.register("material-process-inputs", MaterialProcessInputViewSet)
router.register("material-process-outputs", MaterialProcessOutputViewSet)
router.register("material-process-wastes", MaterialProcessWasteViewSet)
router.register("routes", RouteViewSet)
router.register("collection-trips", CollectionTripViewSet)
router.register("collection-trip-stops", CollectionTripStopViewSet)
router.register("collection-trip-incidents", CollectionTripIncidentViewSet)
router.register("collection-trip-telemetry-points", CollectionTripTelemetryPointViewSet)
router.register("deliveries", DeliveryViewSet)
router.register("delivery-items", DeliveryItemViewSet)
router.register("delivery-route-stops", DeliveryRouteStopViewSet)
router.register("delivery-evidences", DeliveryEvidenceViewSet)
router.register("delivery-incidents", DeliveryIncidentViewSet)
router.register("gps-positions", GPSPositionViewSet)
router.register("geo-events", GeoEventViewSet)
router.register("devices", DeviceViewSet)
router.register("weighing-sessions", WeighingSessionViewSet)
router.register("scale-readings", ScaleReadingViewSet)
router.register("purchase-operations", PurchaseOperationViewSet)
router.register("ticket-items", TicketItemViewSet)
router.register("sale-orders", SaleOrderViewSet)
router.register("sale-items", SaleItemViewSet)
router.register("sale-payments", SalePaymentViewSet)
router.register("payments", PaymentViewSet)
router.register("inventory-movements", InventoryMovementViewSet)
router.register("print-logs", PrintLogViewSet)
router.register("evidence-files", EvidenceFileViewSet)
router.register("custody-events", CustodyEventViewSet)
router.register("audit-logs", AuditLogViewSet)

urlpatterns = [
    path("", lambda request: redirect(os.getenv("DJANGO_ROOT_REDIRECT_URL", os.getenv("FRONTEND_URL", "http://localhost:5000/")), permanent=False)),
    path("admin/", admin.site.urls),
    path("api/auth/login/", LoginView.as_view(), name="auth-login"),
    path("api/reports/basic/", BasicReportView.as_view(), name="basic-report"),
    path("api/reports/daily/", DailyReportView.as_view(), name="daily-report"),
    path("api/reports/lot-trace/", LotTraceReportView.as_view(), name="lot-trace-report"),
    path("api/sale-stock/", SaleStockView.as_view(), name="sale-stock"),
    path("api/price-suggestion/", price_suggestion, name="price-suggestion"),
    path("api/gps/positions/", GPSPositionIngestView.as_view(), name="gps-positions-ingest"),
    path("api/", include(router.urls)),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
