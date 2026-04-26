export type User = {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
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
  license_number: string;
};

export type Material = {
  id: string;
  code: string;
  name: string;
  family: string;
  unit: string;
  valuation_possible: boolean;
  is_hazard_auxiliary: boolean;
  requires_special_review: boolean;
  is_active: boolean;
};

export type Device = {
  id: string;
  name: string;
  identifier: string;
  kind: "vehicle_scale" | "secondary_scale" | "thermal_printer";
  port: string;
  is_connected: boolean;
  is_stable: boolean;
  is_manual_fallback: boolean;
  collection_center?: string | null;
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
};

export type CommercialRole = {
  id: string;
  code: string;
  name: string;
  description: string;
};

export type PurchaseOperation = {
  id: string;
  folio: string;
  status: string;
  payment_status: string;
  print_status: string;
  total_weight_kg: string;
  total_amount: string;
  collection_center: string;
  customer: string;
  vehicle?: string | null;
  driver?: string | null;
  created_at?: string;
  opened_by?: string | null;
  opened_by_name?: string | null;
  driver_name?: string | null;
  vehicle_plate?: string | null;
  active_weighing_session?: string | null;
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

export type PriceSuggestion = {
  found: boolean;
  collection_center_id: string;
  material_id: string;
  unit_price: string | null;
  price_list_id: string | null;
  price_list_name: string | null;
  currency: string | null;
  valid_from?: string | null;
  valid_to?: string | null;
};

export type TicketItem = {
  id: string;
  operation: string;
  material: string;
  method: string;
  gross_weight_kg: string;
  tare_weight_kg: string;
  net_weight_kg: string;
  merma_kg: string;
  unit_price: string;
  amount: string;
  status: string;
  notes?: string;
};

export type Payment = {
  id: string;
  operation: string;
  amount: string;
  method: string;
  reference?: string;
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
  status: string;
  total_weight_kg: string;
  total_amount: string;
  total_cost: string;
  total_profit: string;
  collection_center: string;
  buyer: string;
  collection_center_name?: string;
  buyer_name?: string;
};

export type SaleItem = {
  id: string;
  sale_order: string;
  material: string;
  quantity_kg: string;
  unit_price: string;
  amount: string;
  estimated_cost: string;
  profit: string;
  material_name?: string;
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
