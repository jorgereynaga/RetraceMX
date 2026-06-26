import { apiDelete, apiDownload, apiGet, apiList, apiListAll, apiPatch, apiPost, apiPostFormData, apiPut } from "./client";
import type {
  AuditLog,
  CollectionCenter,
  CollectionTrip,
  CollectionTripIncident,
  CollectionTripTelemetryPoint,
  CollectionTripStop,
  CommercialRole,
  Delivery,
  DeliveryItem,
  DeliveryRouteStop,
  Driver,
  Device,
  EvidenceFile,
  MaterialFamily,
  Material,
  MaterialProcess,
  MaterialProcessInput,
  MaterialProcessOutput,
  MaterialProcessWaste,
  InventoryMovement,
  InventorySummary,
  LotTraceReport,
  Party,
  Payment,
  PrintLog,
  PurchaseOperation,
  PriceList,
  PriceListItem,
  PriceListBaseGenerationResponse,
  PriceSuggestion,
  ProcessType,
  Route,
  SaleItem,
  SaleOrder,
  SalePayment,
  ScaleReading,
  Role,
  TicketItem,
  User,
  Vehicle,
  WeighingSession,
  GPSPosition,
} from "../types";

export type CatalogMetadata = {
  slug: string;
  title: string;
  description: string;
  export_headers: string[];
  import_headers: string[];
  example_rows: Array<Record<string, string>>;
};

export type CatalogImportJob = {
  job: {
    id: string;
    catalog: string;
    catalog_title: string;
    mode: string;
    file_format: "csv" | "xlsx";
    original_filename: string;
    status: string;
    created_by: string | null;
    created_by_name: string | null;
    preview_data?: Record<string, unknown>;
    result_data?: Record<string, unknown>;
    summary?: Record<string, unknown> | null;
    error_message?: string;
    created_at?: string;
    updated_at?: string;
    processed_at?: string | null;
  };
};

export type CatalogImportPreviewResponse = CatalogImportJob & {
  preview: {
    job_id: string;
    catalog: string;
    title: string;
    headers: string[];
    missing_headers: string[];
    rows: Array<{
      row_number: number;
      action: string;
      status: "valid" | "invalid" | "omitted";
      errors: string[];
      values: Record<string, string>;
      lookup: Record<string, string>;
    }>;
    summary: {
      total_rows: number;
      valid_rows: number;
      invalid_rows: number;
      omitted_rows: number;
      found_rows: number;
      duplicates: number;
      missing_headers: string[];
    };
  };
};

export type CatalogImportExecuteResponse = CatalogImportJob & {
  result: {
    job_id: string;
    catalog: string;
    summary: {
      processed: number;
      found: number;
      created: number;
      updated: number;
      omitted: number;
      rejected: number;
      errors: number;
    };
  };
};

export const api = {
  login: (username: string, password: string) => apiPost<{ token: string; user: User }>("/auth/login/", { username, password }),
  catalogMetadata: () => apiList<CatalogMetadata>("/catalogs/"),
  catalogExport: (catalog: string, params: Record<string, string | undefined> = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value != null && value !== "") {
        query.set(key, value);
      }
    });
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return apiDownload(`/catalogs/${catalog}/export/${suffix}`);
  },
  catalogTemplate: (catalog: string, params: Record<string, string | undefined> = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value != null && value !== "") {
        query.set(key, value);
      }
    });
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return apiDownload(`/catalogs/${catalog}/template/${suffix}`);
  },
  catalogImportPreview: (catalog: string, payload: FormData) => apiPostFormData<CatalogImportPreviewResponse>(`/catalogs/${catalog}/import/preview/`, payload),
  catalogImportExecute: (catalog: string, jobId: string) => apiPost<CatalogImportExecuteResponse>(`/catalogs/${catalog}/import/execute/`, { job_id: jobId }),
  catalogImportHistory: (catalog: string) => apiList<CatalogImportJob["job"]>(`/catalogs/${catalog}/import/history/`),
  catalogImportReport: (catalog: string, jobId: string, params: Record<string, string | undefined> = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value != null && value !== "") {
        query.set(key, value);
      }
    });
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return apiDownload(`/catalogs/${catalog}/import/${jobId}/report/${suffix}`);
  },
  users: () => apiListAll<User>("/users/"),
  userCreate: (payload: Record<string, unknown>) => apiPost<User>("/users/", payload),
  userUpdate: (id: string, payload: Record<string, unknown>) => apiPut<User>(`/users/${id}/`, payload),
  userPatch: (id: string, payload: Record<string, unknown>) => apiPatch<User>(`/users/${id}/`, payload),
  userDelete: (id: string) => apiDelete<void>(`/users/${id}/`),
  roles: () => apiListAll<Role>("/roles/"),
  centers: () => apiListAll<CollectionCenter>("/collection-centers/"),
  centerCreate: (payload: Record<string, unknown>) => apiPost<CollectionCenter>("/collection-centers/", payload),
  centerUpdate: (id: string, payload: Record<string, unknown>) => apiPut<CollectionCenter>(`/collection-centers/${id}/`, payload),
  centerPatch: (id: string, payload: Record<string, unknown>) => apiPatch<CollectionCenter>(`/collection-centers/${id}/`, payload),
  centerDelete: (id: string) => apiDelete<void>(`/collection-centers/${id}/`),
  commercialRoles: () => apiList<CommercialRole>("/commercial-roles/"),
  materialFamilies: () => apiList<MaterialFamily>("/material-families/"),
  processTypes: () => apiListAll<ProcessType>("/process-types/"),
  processTypeCreate: (payload: Record<string, unknown>) => apiPost<ProcessType>("/process-types/", payload),
  processTypeUpdate: (id: string, payload: Record<string, unknown>) => apiPut<ProcessType>(`/process-types/${id}/`, payload),
  processTypePatch: (id: string, payload: Record<string, unknown>) => apiPatch<ProcessType>(`/process-types/${id}/`, payload),
  processTypeDelete: (id: string) => apiDelete<void>(`/process-types/${id}/`),
  materialProcesses: () => apiListAll<MaterialProcess>("/material-processes/"),
  materialProcessCreate: (payload: Record<string, unknown>) => apiPost<MaterialProcess>("/material-processes/", payload),
  materialProcessConfirm: (id: string) => apiPost<MaterialProcess>(`/material-processes/${id}/confirm/`, {}),
  materialProcessCancel: (id: string, reason = "") => apiPost<MaterialProcess>(`/material-processes/${id}/cancel/`, { reason }),
  materialProcessInputs: () => apiListAll<MaterialProcessInput>("/material-process-inputs/"),
  materialProcessInputCreate: (payload: Record<string, unknown>) => apiPost<MaterialProcessInput>("/material-process-inputs/", payload),
  materialProcessOutputs: () => apiListAll<MaterialProcessOutput>("/material-process-outputs/"),
  materialProcessOutputCreate: (payload: Record<string, unknown>) => apiPost<MaterialProcessOutput>("/material-process-outputs/", payload),
  materialProcessWastes: () => apiListAll<MaterialProcessWaste>("/material-process-wastes/"),
  materialProcessWasteCreate: (payload: Record<string, unknown>) => apiPost<MaterialProcessWaste>("/material-process-wastes/", payload),
  materialCreate: (payload: Record<string, unknown>) => apiPost<Material>("/materials/", payload),
  materialUpdate: (id: string, payload: Record<string, unknown>) => apiPut<Material>(`/materials/${id}/`, payload),
  materialPatch: (id: string, payload: Record<string, unknown>) => apiPatch<Material>(`/materials/${id}/`, payload),
  materialDelete: (id: string) => apiDelete<void>(`/materials/${id}/`),
  priceLists: () => apiListAll<PriceList>("/price-lists/"),
  priceListCreate: (payload: Record<string, unknown>) => apiPost<PriceList>("/price-lists/", payload),
  priceListUpdate: (id: string, payload: Record<string, unknown>) => apiPut<PriceList>(`/price-lists/${id}/`, payload),
  priceListDuplicate: (id: string, payload: Record<string, unknown>) => apiPost<PriceList>(`/price-lists/${id}/duplicate/`, payload),
  priceListGenerateBase: () => apiPost<PriceListBaseGenerationResponse>("/price-lists/generate-base/", {}),
  priceListDelete: (id: string) => apiDelete<void>(`/price-lists/${id}/`),
  priceListItems: () => apiListAll<PriceListItem>("/price-list-items/"),
  priceListItemCreate: (payload: Record<string, unknown>) => apiPost<PriceListItem>("/price-list-items/", payload),
  priceListItemUpdate: (id: string, payload: Record<string, unknown>) => apiPut<PriceListItem>(`/price-list-items/${id}/`, payload),
  priceListItemDelete: (id: string) => apiDelete<void>(`/price-list-items/${id}/`),
  routeCreate: (payload: Record<string, unknown>) => apiPost<Route>("/routes/", payload),
  routeUpdate: (id: string, payload: Record<string, unknown>) => apiPut<Route>(`/routes/${id}/`, payload),
  routeDelete: (id: string) => apiDelete<void>(`/routes/${id}/`),
  partyCreate: (payload: Record<string, unknown>) => apiPost<Party>("/parties/", payload),
  partyUpdate: (id: string, payload: Record<string, unknown>) => apiPut<Party>(`/parties/${id}/`, payload),
  partyPatch: (id: string, payload: Record<string, unknown>) => apiPatch<Party>(`/parties/${id}/`, payload),
  partyDelete: (id: string) => apiDelete<void>(`/parties/${id}/`),
  parties: () => apiListAll<Party>("/parties/"),
  partiesAll: () => apiListAll<Party>("/parties/"),
  materials: () => apiListAll<Material>("/materials/"),
  materialsAll: () => apiListAll<Material>("/materials/"),
  vehicles: () => apiList<Vehicle>("/vehicles/"),
  vehiclesByOwner: (ownerId: string) => apiList<Vehicle>(`/vehicles/?owner=${encodeURIComponent(ownerId)}`),
  vehicleCreate: (payload: Record<string, unknown>) => apiPost<Vehicle>("/vehicles/", payload),
  vehicleDelete: (id: string) => apiDelete<void>(`/vehicles/${id}/`),
  driverCreate: (payload: Record<string, unknown>) => apiPost<Driver>("/drivers/", payload),
  deleteTicketItem: (id: string) => apiDelete<void>(`/ticket-items/${id}/`),
  drivers: () => apiList<Driver>("/drivers/"),
  devices: () => apiListAll<Device>("/devices/"),
  deviceCreate: (payload: Record<string, unknown>) => apiPost<Device>("/devices/", payload),
  devicePatch: (id: string, payload: Record<string, unknown>) => apiPatch<Device>(`/devices/${id}/`, payload),
  deviceDelete: (id: string) => apiDelete<void>(`/devices/${id}/`),
  deviceReadScale: (deviceId: string) =>
    apiPost<{ device_id: string; device_name: string; kind: string; raw_value: string; weight_kg: string; is_stable: boolean; is_manual_fallback: boolean; port: string; captured_at: string }>(`/devices/${deviceId}/read_scale/`, {}),
  deviceLatestScaleReading: (deviceId: string) =>
    apiGet<ScaleReading>(`/devices/${deviceId}/latest_reading/`),
  deviceProbeScale: (deviceId: string, payload: Record<string, unknown> = {}) =>
    apiPost<{ device_id: string; device_name: string; kind: string; port: string; captured_at: string; line_count: number; lines: Array<{ text: string; hex: string }> }>(`/devices/${deviceId}/probe_scale/`, payload),
  deviceSimulatePrint: (deviceId: string, payload: Record<string, unknown> = {}) =>
    apiPost<{ device_id: string; device_name: string; kind: string; printer_name: string; printer_identifier: string; printer_port: string; status: string; copies: number; is_reprint: boolean; payload: Record<string, unknown> }>(`/devices/${deviceId}/simulate_print/`, payload),
  routes: () => apiList<Route>("/routes/"),
  operations: () => apiList<PurchaseOperation>("/purchase-operations/"),
  operationsAll: () => apiListAll<PurchaseOperation>("/purchase-operations/"),
  operationDetail: (id: string) => apiGet<PurchaseOperation>(`/purchase-operations/${id}/`),
  operationCreate: (payload: Record<string, unknown>) => apiPost<PurchaseOperation>("/purchase-operations/open/", payload),
  operationPatch: (id: string, payload: Record<string, unknown>) => apiPatch<PurchaseOperation>(`/purchase-operations/${id}/`, payload),
  operationStatusChange: (id: string, status: string, reason = "", extra: Record<string, unknown> = {}) =>
    apiPost<PurchaseOperation>(`/purchase-operations/${id}/status_change/`, { status, reason, ...extra }),
  operationUpdateDriver: (id: string, driverId: string | null) =>
    apiPatch<PurchaseOperation>(`/purchase-operations/${id}/update_driver/`, { driver_id: driverId || null }),
  operationPrint: (id: string, payload: Record<string, unknown>) => apiPost<Record<string, unknown>>(`/purchase-operations/${id}/print_ticket/`, payload),
  ticketItems: () => apiList<TicketItem>("/ticket-items/"),
  ticketItemsAll: () => apiListAll<TicketItem>("/ticket-items/"),
  ticketItemsByOperation: (operationId: string) => apiListAll<TicketItem>(`/ticket-items/?operation=${encodeURIComponent(operationId)}`),
  createTicketItem: (payload: Record<string, unknown>) => apiPost<TicketItem>("/ticket-items/", payload),
  updateTicketItem: (id: string, payload: Record<string, unknown>) => apiPut<TicketItem>(`/ticket-items/${id}/`, payload),
  adjustTicketItem: (id: string, payload: Record<string, unknown>) => apiPost<TicketItem>(`/ticket-items/${id}/adjust/`, payload),
  payments: () => apiList<Payment>("/payments/"),
  paymentsAll: () => apiListAll<Payment>("/payments/"),
  createPayment: (payload: Record<string, unknown>) => apiPost<Payment>("/payments/", payload),
  cancelPayment: (id: string, cancelReason = "") => apiPost<Payment>(`/payments/${id}/cancel/`, { cancel_reason: cancelReason }),
  printLogs: () => apiList<PrintLog>("/print-logs/"),
  reprintLog: (id: string) => apiPost<PrintLog>(`/print-logs/${id}/reprint/`, {}),
  auditLogs: () => apiList<AuditLog>("/audit-logs/"),
  inventoryMovements: () => apiListAll<InventoryMovement>("/inventory-movements/"),
  inventorySummary: () => apiGet<InventorySummary>("/inventory-movements/summary/"),
  inventoryAdjust: (payload: Record<string, unknown>) => apiPost<InventoryMovement>("/inventory-movements/adjust/", payload),
  saleOrders: (params?: Record<string, string | undefined>) => {
    const query = params
      ? Object.entries(params)
          .filter(([, value]) => value)
          .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value as string)}`)
          .join("&")
      : "";
    return apiList<SaleOrder>(query ? `/sale-orders/?${query}` : "/sale-orders/");
  },
  saleOrderOpen: (payload: Record<string, unknown>) => apiPost<SaleOrder>("/sale-orders/open/", payload),
  saleOrderUpdate: (id: string, payload: Record<string, unknown>) => apiPatch<SaleOrder>(`/sale-orders/${id}/`, payload),
  saleOrderClose: (id: string) => apiPost<SaleOrder>(`/sale-orders/${id}/close/`, {}),
  saleOrderDeliveries: (id: string) => apiList<Delivery>(`/sale-orders/${id}/deliveries/`),
  saleOrderDeliveryCreate: (id: string, payload: Record<string, unknown>) => apiPost<Delivery>(`/sale-orders/${id}/deliveries/`, payload),
  salePayments: (params?: Record<string, string | undefined>) => {
    const query = params
      ? Object.entries(params)
          .filter(([, value]) => value)
          .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value as string)}`)
          .join("&")
      : "";
    return apiList<SalePayment>(query ? `/sale-payments/?${query}` : "/sale-payments/");
  },
  salePaymentCreate: (payload: Record<string, unknown>) => apiPost<SalePayment>("/sale-payments/", payload),
  salePaymentCancel: (id: string, cancelReason = "") => apiPost<SalePayment>(`/sale-payments/${id}/cancel/`, { cancel_reason: cancelReason }),
  saleItems: () => apiList<SaleItem>("/sale-items/"),
  saleItemCreate: (payload: Record<string, unknown>) => apiPost<SaleItem>("/sale-items/", payload),
  saleStock: (collectionCenterId: string, materialId: string) =>
    apiGet<{ collection_center_name: string; material_name: string; available_kg: string }>(
      `/sale-stock/?collection_center_id=${encodeURIComponent(collectionCenterId)}&material_id=${encodeURIComponent(materialId)}`,
    ),
  collectionTrips: () => apiList<CollectionTrip>("/collection-trips/"),
  collectionTripCreate: (payload: Record<string, unknown>) => apiPost<CollectionTrip>("/collection-trips/", payload),
  collectionTripAssignDelivery: (id: string, payload: Record<string, unknown>) => apiPost<Delivery>(`/collection-trips/${id}/assign-delivery/`, payload),
  collectionTripLive: (id: string) => apiGet<{ trip: CollectionTrip; deliveries: Delivery[]; stops: DeliveryRouteStop[]; last_position: GPSPosition | null }>(`/collection-trips/${id}/live/`),
  collectionTripGpsTrack: (id: string) => apiList<GPSPosition>(`/collection-trips/${id}/gps-track/`),
  collectionTripDepart: (id: string, payload: Record<string, unknown> = {}) => apiPost<CollectionTrip>(`/collection-trips/${id}/depart/`, payload),
  collectionTripArrive: (id: string, payload: Record<string, unknown> = {}) => apiPost<CollectionTrip>(`/collection-trips/${id}/arrive/`, payload),
  collectionTripClose: (id: string, payload: Record<string, unknown> = {}) => apiPost<CollectionTrip>(`/collection-trips/${id}/close/`, payload),
  collectionTripStopCreate: (tripId: string, formData: FormData) => apiPostFormData<CollectionTripStop>(`/collection-trips/${tripId}/stops/`, formData),
  collectionTripStops: (tripId?: string) => apiList<CollectionTripStop>(tripId ? `/collection-trip-stops/?trip=${encodeURIComponent(tripId)}` : "/collection-trip-stops/"),
  collectionTripIncidents: (tripId?: string) =>
    apiList<CollectionTripIncident>(tripId ? `/collection-trip-incidents/?trip=${encodeURIComponent(tripId)}` : "/collection-trip-incidents/"),
  collectionTripIncidentCreate: (formData: FormData) => apiPostFormData<CollectionTripIncident>("/collection-trip-incidents/", formData),
  collectionTripIncidentResolve: (id: string, payload: Record<string, unknown> = {}) =>
    apiPost<CollectionTripIncident>(`/collection-trip-incidents/${id}/resolve/`, payload),
  collectionTripTelemetryPoints: (tripId?: string) =>
    apiList<CollectionTripTelemetryPoint>(tripId ? `/collection-trip-telemetry-points/?trip=${encodeURIComponent(tripId)}` : "/collection-trip-telemetry-points/"),
  collectionTripTelemetryPointCreate: (formData: FormData) => apiPostFormData<CollectionTripTelemetryPoint>("/collection-trip-telemetry-points/", formData),
  deliveries: (params?: Record<string, string | undefined>) => {
    const query = params
      ? Object.entries(params)
          .filter(([, value]) => value)
          .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value as string)}`)
          .join("&")
      : "";
    return apiList<Delivery>(query ? `/deliveries/?${query}` : "/deliveries/");
  },
  deliveryItems: (deliveryId?: string) => apiList<DeliveryItem>(deliveryId ? `/delivery-items/?delivery=${encodeURIComponent(deliveryId)}` : "/delivery-items/"),
  deliveryAssign: (id: string, payload: Record<string, unknown>) => apiPost<Delivery>(`/deliveries/${id}/assign/`, payload),
  deliveryStatus: (id: string, status: string, notes = "") => apiPost<Delivery>(`/deliveries/${id}/status/`, { status, notes }),
  deliveryCancel: (id: string, notes = "") => apiPost<Delivery>(`/deliveries/${id}/cancel/`, { notes }),
  deliveryRouteStops: () => apiList<DeliveryRouteStop>("/delivery-route-stops/"),
  gpsPositions: () => apiList<GPSPosition>("/gps-positions/"),
  priceSuggestion: (collectionCenterId: string, materialId: string, partyId?: string | null) =>
    apiGet<PriceSuggestion>(
      `/price-suggestion/?collection_center_id=${encodeURIComponent(collectionCenterId)}&material_id=${encodeURIComponent(materialId)}${partyId ? `&party_id=${encodeURIComponent(partyId)}` : ""}`,
    ),
  deviceSimulateScale: (deviceId: string) =>
    apiGet<{ device_id: string; device_name: string; kind: string; raw_value: string; weight_kg: string; is_stable: boolean; is_manual_fallback: boolean; port: string; captured_at: string }>(`/devices/${deviceId}/simulate_scale/`),
  weighingSessionsByVehicle: (vehicleId: string, params?: { dateFrom?: string; dateTo?: string }) => {
    const query = new URLSearchParams({ vehicle: vehicleId });
    if (params?.dateFrom) query.set("date_from", params.dateFrom);
    if (params?.dateTo) query.set("date_to", params.dateTo);
    return apiListAll<WeighingSession>(`/weighing-sessions/?${query.toString()}`);
  },
  createScaleReading: (payload: Record<string, unknown>) => apiPost<ScaleReading>("/scale-readings/", payload),
  scaleReadingsByDevice: (deviceId: string) => apiListAll<ScaleReading>(`/scale-readings/?device=${encodeURIComponent(deviceId)}`),
  scaleReadingsBySession: (sessionId: string) => apiListAll<ScaleReading>(`/scale-readings/?session=${encodeURIComponent(sessionId)}`),
  evidenceFiles: () => apiList<EvidenceFile>("/evidence-files/"),
  evidenceFileUpload: (formData: FormData) => apiPostFormData<EvidenceFile>("/evidence-files/", formData),
  reportBasic: () => apiGet<Record<string, unknown>>("/reports/basic/"),
  reportDaily: (date?: string) =>
    apiGet<{
      date: string;
      ops_count: number;
      total_weight_kg: number;
      total_merma_kg: number;
      total_revenue: number;
      volume_received_kg: number;
      volume_sold_kg: number;
      sale_revenue: number;
      inventory_current_kg: number;
      raw_inventory_current_kg: number;
      processed_inventory_current_kg: number;
      processes_count: number;
      process_input_kg: number;
      process_output_kg: number;
      process_waste_kg: number;
      process_yield_pct: number;
      sale_processed_kg: number;
      sale_raw_kg: number;
      sale_processed_amount: number;
      sale_raw_amount: number;
      purchase_vs_sales_kg_balance: number;
      purchases_vs_sales: {
        purchase_amount: number;
        sale_amount: number;
        balance_amount: number;
      };
      by_family: Array<{ family_id: string; name: string; weight_kg: number; amount: number; items_count: number }>;
      by_client: Array<{ client_id: string; name: string; ops_count: number; weight_kg: number; amount: number }>;
      trend_7d: Array<{
        date: string;
        label: string;
        purchase_revenue: number;
        purchase_weight_kg: number;
        sale_revenue: number;
        sale_weight_kg: number;
        purchase_ops_count: number;
        sale_orders_count: number;
      }>;
    }>(date ? `/reports/daily/?date=${date}` : "/reports/daily/"),
  reportLotTrace: (lotCode: string) => apiGet<LotTraceReport>(`/reports/lot-trace/?lot_code=${encodeURIComponent(lotCode)}`),
};
