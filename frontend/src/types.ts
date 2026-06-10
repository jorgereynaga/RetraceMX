export type User = {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  is_staff?: boolean;
  is_superuser?: boolean;
  is_active?: boolean;
  role_codes?: string[];
  roles?: string[];
  role_names?: string[];
};

export type CollectionCenter = {
  id: string;
  code: string;
  name: string;
  kind: "collection" | "smelter" | "destination";
  address: string;
  latitude?: string | null;
  longitude?: string | null;
  is_active: boolean;
};

export type Vehicle = {
  id: string;
  plate_number: string;
  label: string;
  owner?: string | null;
  capacity_kg: string;
  expected_km_per_liter: string;
  is_active?: boolean;
};

export type Driver = {
  id: string;
  person: string;
  person_name: string | null;
  license_number: string;
  is_active: boolean;
};

export type Material = {
  id: string;
  code: string;
  name: string;
  family: string;
  subfamily?: string;
  unit: string;
  valuation_possible: boolean;
  is_hazard_auxiliary: boolean;
  requires_special_review: boolean;
  is_buyable?: boolean;
  is_sellable?: boolean;
  is_processable?: boolean;
  is_processed?: boolean;
  is_active: boolean;
  default_merma_pct: string | null;
};

export type Device = {
  id: string;
  name: string;
  identifier: string;
  kind: "vehicle_scale" | "secondary_scale" | "thermal_printer" | "gps_tracker";
  port: string;
  is_connected: boolean;
  is_stable: boolean;
  is_manual_fallback: boolean;
  metadata?: Record<string, unknown>;
  collection_center?: string | null;
  vehicle?: string | null;
  last_seen_at?: string | null;
};

export type MaterialFamily = {
  id: string;
  code: string;
  name: string;
  description: string;
  operational_classification: string;
  possible_valuation: boolean;
  special_review: boolean;
};

export type PriceList = {
  id: string;
  code: string;
  name: string;
  collection_center: string;
  collection_center_name?: string;
  linked_party?: string | null;
  linked_party_name?: string | null;
  linked_party_trade_name?: string | null;
  currency: string;
  valid_from: string;
  valid_to?: string | null;
  is_active: boolean;
};

export type PriceListItem = {
  id: string;
  price_list: string;
  price_list_name?: string;
  material: string;
  material_name?: string;
  unit_price: string;
  is_active: boolean;
};

export type Party = {
  id: string;
  kind: "person" | "company";
  legal_name: string;
  trade_name: string;
  tax_id: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  is_active: boolean;
  commercial_roles: string[];
  commercial_role_names?: string[];
  buyer_type_label?: string;
};

export type CommercialRole = {
  id: string;
  code: string;
  name: string;
  description: string;
};

export type Role = {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
  permissions?: string[];
};

export type PurchaseOperation = {
  id: string;
  folio: string;
  status: string;
  status_label?: string;
  payment_status: string;
  payment_status_label?: string;
  print_status: string;
  total_weight_kg: string;
  total_amount: string;
  paid_amount?: string;
  pending_amount?: string;
  collection_center: string;
  customer: string;
  customer_name?: string;
  customer_trade_name?: string | null;
  customer_legal_name?: string;
  metadata?: Record<string, unknown>;
  vehicle?: string | null;
  driver?: string | null;
  vehicle_plate?: string | null;
  created_at?: string;
  opened_by?: string | null;
  opened_by_name?: string | null;
  driver_name?: string | null;
  active_weighing_session?: string | null;
  close_authorized_by?: string | null;
  close_authorized_at?: string | null;
  close_authorization_reason?: string;
  close_authorization_notes?: string;
  close_recognized_pending_amount?: string;
};

export type ScaleReading = {
  id: string;
  session: string;
  device: string;
  reading_type: "gross" | "tare" | "direct" | "manual" | "contingency";
  gross_weight_kg?: string | null;
  tare_weight_kg?: string | null;
  net_weight_kg?: string | null;
  raw_value?: string;
  is_stable?: boolean;
  is_manual?: boolean;
  captured_at?: string;
};

export type WeighingSession = {
  id: string;
  kind: "vehicle" | "secondary";
  status: string;
  vehicle?: string | null;
  operation?: string | null;
  operation_folio?: string | null;
  collection_center: string;
  device: string;
  started_at: string;
  ended_at?: string | null;
  readings: ScaleReading[];
};

export type PriceSuggestion = {
  found: boolean;
  collection_center_id: string;
  material_id: string;
  party_id?: string | null;
  unit_price: string | null;
  price_list_id: string | null;
  price_list_name: string | null;
  price_list_party_id?: string | null;
  price_list_party_name?: string | null;
  currency: string | null;
  valid_from?: string | null;
  valid_to?: string | null;
};

export type TicketItem = {
  id: string;
  operation: string;
  material: string;
  material_name?: string;
  method: string;
  method_label?: string;
  gross_weight_kg: string;
  tare_weight_kg: string;
  net_weight_kg: string;
  merma_kg: string;
  unit_price: string;
  amount: string;
  status: string;
  notes?: string;
  confirmed_by?: string | null;
  confirmed_by_name?: string | null;
  confirmed_at?: string | null;
  sort_order?: number;
};

export type Payment = {
  id: string;
  folio?: string;
  operation: string;
  amount: string;
  applied_amount?: string;
  received_amount?: string;
  change_amount?: string;
  method: string;
  method_label?: string;
  reference?: string;
  notes?: string;
  status?: string;
  status_label?: string;
  operation_folio?: string;
  received_by?: string | null;
  received_by_name?: string | null;
  paid_at?: string;
  cancelled_at?: string | null;
  cancelled_by?: string | null;
  cancel_reason?: string;
};

export type InventoryMovement = {
  id: string;
  operation?: string | null;
  ticket_item?: string | null;
  sale_order?: string | null;
  sale_item?: string | null;
  process?: string | null;
  process_input?: string | null;
  process_output?: string | null;
  process_waste?: string | null;
  lot_code?: string;
  material: string;
  material_name?: string | null;
  material_is_processed?: boolean | null;
  material_is_sellable?: boolean | null;
  material_family_name?: string | null;
  collection_center: string;
  collection_center_name?: string | null;
  movement_type:
    | "inbound"
    | "outbound"
    | "adjustment"
    | "purchase_in"
    | "process_input_out"
    | "process_output_in"
    | "process_waste_out"
    | "sale_out"
    | "manual_adjustment_in"
    | "manual_adjustment_out"
    | "transfer_in"
    | "transfer_out";
  movement_type_label?: string;
  quantity_kg: string;
  unit_price: string;
  amount: string;
  notes?: string;
  source_reference?: string;
  created_by?: string | null;
  created_by_name?: string | null;
  occurred_at?: string;
};

export type LotTraceReport = {
  lot_code: string;
  process_outputs: Array<{
    id: string;
    process_folio: string;
    process_type: string;
    collection_center: string;
    material: string;
    material_name: string;
    quantity: string;
    unit: string;
    lot_code: string;
    created_at?: string | null;
  }>;
  sale_items: Array<{
    id: string;
    sale_order: string;
    sale_folio: string;
    collection_center: string;
    material: string;
    material_name: string;
    quantity_kg: string;
    unit_price: string;
    amount: string;
    lot_code: string;
  }>;
  inventory_movements: Array<{
    id: string;
    movement_type: string;
    movement_type_label: string;
    material: string;
    material_name: string;
    collection_center: string;
    collection_center_name: string;
    quantity_kg: string;
    amount: string;
    source_reference?: string;
    lot_code?: string;
    occurred_at: string;
  }>;
  processes: Array<{
    id: string;
    folio: string;
    process_type: string;
    collection_center: string;
    status: string;
    process_date: string;
    notes: string;
    inputs: Array<{
      material: string;
      material_name: string;
      quantity: string;
      unit: string;
      source_inventory_reference: string;
    }>;
    outputs: Array<{
      material: string;
      material_name: string;
      quantity: string;
      unit: string;
      lot_code: string;
    }>;
    wastes: Array<{
      material?: string | null;
      material_name?: string | null;
      waste_type: string;
      waste_type_label: string;
      quantity: string;
      unit: string;
      notes: string;
    }>;
  }>;
};

export type InventoryBalance = {
  collection_center_id: string;
  collection_center_name: string;
  material_id: string;
  material_name: string;
  material_is_processed?: boolean;
  material_is_sellable?: boolean;
  inbound_kg: string;
  outbound_kg: string;
  adjustment_kg: string;
  balance_kg: string;
  movements_count: number;
  last_movement_at?: string | null;
};

export type InventorySummary = {
  totals: {
    movements_count: number;
    inbound_count: number;
    outbound_count: number;
    adjustment_count: number;
    stock_kg: string;
    positive_balances: number;
    negative_balances: number;
  };
  balances: InventoryBalance[];
};

export type PrintLog = {
  id: string;
  operation: string;
  printer_name: string;
  is_reprint: boolean;
  copies: number;
  status: string;
  printed_at: string;
};

export type AuditLog = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  created_at: string;
  details?: Record<string, unknown>;
  actor?: string | null;
};

export type SaleOrder = {
  id: string;
  folio: string;
  sale_type: string;
  sale_type_label?: string;
  payment_terms: string;
  payment_terms_label?: string;
  status: string;
  status_label?: string;
  buyer_type_label?: string;
  buyer_roles?: string[];
  items_count?: number;
  total_weight_kg: string;
  total_amount: string;
  total_cost: string;
  total_profit: string;
  paid_amount?: string;
  pending_amount?: string;
  payment_status?: string;
  payment_status_label?: string;
  collection_center: string;
  buyer: string;
  collection_center_name?: string;
  buyer_name?: string;
  destination_name?: string;
  transport_mode?: string;
  transport_operator?: string;
  transport_plates?: string;
  contract_reference?: string;
  negotiated_price_note?: string;
  notes?: string;
  created_at?: string;
};

export type ProcessType = {
  id: string;
  code: string;
  name: string;
  description: string;
  active: boolean;
};

export type MaterialProcess = {
  id: string;
  folio: string;
  process_type: string;
  process_type_name?: string;
  collection_center: string;
  collection_center_name?: string;
  process_date: string;
  status: "draft" | "confirmed" | "cancelled";
  notes?: string;
  created_by?: string | null;
  created_by_name?: string | null;
  confirmed_by?: string | null;
  confirmed_by_name?: string | null;
  confirmed_at?: string | null;
  canceled_by?: string | null;
  canceled_by_name?: string | null;
  canceled_at?: string | null;
  cancellation_reason?: string;
  inputs_count?: number;
  outputs_count?: number;
  wastes_count?: number;
  inputs?: MaterialProcessInput[];
  outputs?: MaterialProcessOutput[];
  wastes?: MaterialProcessWaste[];
};

export type MaterialProcessInput = {
  id: string;
  process: string;
  process_folio?: string;
  material: string;
  material_name?: string;
  quantity: string;
  unit: string;
  source_inventory_reference?: string;
};

export type MaterialProcessOutput = {
  id: string;
  process: string;
  process_folio?: string;
  material: string;
  material_name?: string;
  quantity: string;
  unit: string;
  lot_code: string;
};

export type MaterialProcessWaste = {
  id: string;
  process: string;
  process_folio?: string;
  material?: string | null;
  material_name?: string | null;
  waste_type: "merma" | "waste" | "loss";
  waste_type_label?: string;
  quantity: string;
  unit: string;
  notes?: string;
};

export type SalePayment = {
  id: string;
  folio?: string;
  sale_order: string;
  sale_order_folio?: string;
  amount: string;
  applied_amount?: string;
  received_amount?: string;
  change_amount?: string;
  method: string;
  method_label?: string;
  reference?: string;
  notes?: string;
  status?: string;
  status_label?: string;
  received_by?: string | null;
  received_by_name?: string | null;
  paid_at?: string;
  cancelled_at?: string | null;
  cancelled_by?: string | null;
  cancel_reason?: string;
};

export type Delivery = {
  id: string;
  folio: string;
  sale_order: string;
  sale_folio?: string;
  buyer: string;
  buyer_name?: string;
  collection_trip?: string | null;
  collection_trip_status?: string | null;
  route_name?: string | null;
  vehicle_label?: string | null;
  driver_name?: string | null;
  status: string;
  status_label?: string;
  delivery_type: "complete" | "partial";
  delivery_type_label?: string;
  scheduled_date?: string | null;
  time_window_start?: string | null;
  time_window_end?: string | null;
  origin_center: string;
  origin_center_name?: string;
  destination_name: string;
  destination_address: string;
  destination_lat?: string | null;
  destination_lng?: string | null;
  transport_mode?: string;
  transport_operator?: string;
  transport_plates?: string;
  contact_name: string;
  contact_phone: string;
  notes: string;
  items_count?: number;
  planned_weight_kg?: string;
  loaded_weight_kg?: string;
  delivered_weight_kg?: string;
  last_gps_lat?: string | null;
  last_gps_lng?: string | null;
  last_gps_at?: string | null;
  created_at?: string;
};

export type DeliveryItem = {
  id: string;
  delivery: string;
  sale_item: string;
  material: string;
  material_name?: string;
  material_code?: string;
  lot_code: string;
  description: string;
  planned_weight_kg: string;
  loaded_weight_kg: string;
  delivered_weight_kg: string;
  rejected_weight_kg: string;
  unit_price: string;
  total_amount: string;
  status: string;
  notes: string;
};

export type DeliveryRouteStop = {
  id: string;
  trip: string;
  delivery: string;
  delivery_folio?: string;
  sale_folio?: string;
  buyer_name?: string;
  stop_order: number;
  status: string;
  planned_arrival_at?: string | null;
  actual_arrival_at?: string | null;
  actual_departure_at?: string | null;
  destination_address: string;
  destination_lat?: string | null;
  destination_lng?: string | null;
  distance_from_previous_km: string;
  notes: string;
};

export type GPSPosition = {
  id: string;
  gps_device: string;
  device_identifier?: string;
  vehicle: string;
  vehicle_label?: string;
  trip?: string | null;
  route_name?: string | null;
  driver?: string | null;
  lat: string;
  lng: string;
  speed_kmh?: string | null;
  heading?: string | null;
  accuracy_m?: string | null;
  recorded_at: string;
  received_at: string;
  source: string;
};

export type SaleItem = {
  id: string;
  sale_order: string;
  material: string;
  presentation?: string;
  quality?: string;
  lot_code?: string;
  quantity_kg: string;
  list_unit_price?: string;
  unit_price: string;
  amount: string;
  estimated_cost: string;
  profit: string;
  material_name?: string;
  material_code?: string;
  presentation_label?: string;
  quality_label?: string;
};

export type Route = {
  id: string;
  code: string;
  name: string;
  origin_center: string;
  destination_center: string;
  origin_center_name?: string;
  destination_center_name?: string;
  origin_center_kind?: "collection" | "smelter" | "destination";
  destination_center_kind?: "collection" | "smelter" | "destination";
  origin_center_latitude?: string | null;
  origin_center_longitude?: string | null;
  destination_center_latitude?: string | null;
  destination_center_longitude?: string | null;
  notes: string;
  is_active: boolean;
};

export type CollectionTrip = {
  id: string;
  status: string;
  route: string;
  route_name?: string;
  origin_center: string;
  origin_center_name?: string;
  destination_center: string;
  destination_center_name?: string;
  vehicle?: string | null;
  vehicle_label?: string;
  vehicle_efficiency_km_per_liter?: string;
  driver?: string | null;
  driver_name?: string;
  operator: string;
  planned_at: string;
  departed_at?: string | null;
  arrived_at?: string | null;
  estimated_distance_km: string;
  telemetry_distance_km: string;
  estimated_fuel_liters: string;
  telemetry_points_count: number;
  last_telemetry_at?: string | null;
  last_telemetry_lat?: string | null;
  last_telemetry_lng?: string | null;
  odometer_start?: string | null;
  odometer_end?: string | null;
  geo_start_lat?: string | null;
  geo_start_lng?: string | null;
  geo_end_lat?: string | null;
  geo_end_lng?: string | null;
  closed_at?: string | null;
  closed_by?: string | null;
  closed_by_name?: string;
  closure_notes: string;
  notes: string;
  deliveries_count?: number;
  delivery_weight_kg?: string;
};

export type CollectionTripTelemetryPoint = {
  id: string;
  trip: string;
  trip_name?: string;
  vehicle_label?: string;
  sequence: number;
  latitude: string;
  longitude: string;
  speed_kmh?: string | null;
  source: "gps" | "manual";
  notes: string;
  recorded_at: string;
  created_by?: string | null;
  created_by_name?: string;
};

export type CollectionTripIncident = {
  id: string;
  trip: string;
  trip_name?: string;
  title: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  geo_lat?: string | null;
  geo_lng?: string | null;
  resolved: boolean;
  resolved_at?: string | null;
  resolved_by?: string | null;
  resolved_by_name?: string;
  created_by?: string | null;
  created_by_name?: string;
  file?: string | null;
  photo?: string | null;
  photo_name?: string | null;
  photo_url?: string | null;
};

export type EvidenceFile = {
  id: string;
  operation?: string | null;
  ticket_item?: string | null;
  custody_event?: string | null;
  trip?: string | null;
  trip_name?: string;
  file?: string;
  file_name?: string;
  file_url?: string;
  file_type: string;
  description: string;
  uploaded_by?: string | null;
};

export type CollectionTripStop = {
  id: string;
  trip: string;
  sequence: number;
  label: string;
  notes: string;
  latitude?: string | null;
  longitude?: string | null;
  photo?: string | null;
  occurred_at: string;
};
