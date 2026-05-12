import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../api/resources";
import { Page } from "../components/Page";
import { RouteMap, type RouteMapPoint } from "../components/RouteMap";
import type { CollectionCenter, Delivery, Party, Route, SaleItem, SaleOrder, Vehicle } from "../types";

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
}

function money(value?: string | number | null) {
  const parsed = typeof value === "string" ? Number(value) : value ?? 0;
  return `$${Number(parsed || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function kg(value?: string | number | null) {
  const parsed = typeof value === "string" ? Number(value) : value ?? 0;
  return Number(parsed || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function partyLabel(party: Party | undefined) {
  if (!party) return "-";
  return party.trade_name || party.legal_name || "-";
}

function routeLabel(route: Route | undefined) {
  if (!route) return "-";
  return `${route.code} · ${route.name}`;
}

function centerLabel(center: CollectionCenter | undefined) {
  if (!center) return "-";
  const kind = center.kind === "smelter" ? "Fundidora" : center.kind === "destination" ? "Destino" : "Acopio";
  return `${center.code} · ${center.name} · ${kind}`;
}

function vehicleLabel(vehicle: Vehicle | undefined) {
  if (!vehicle) return "-";
  return `${vehicle.plate_number}${vehicle.label ? ` · ${vehicle.label}` : ""}`;
}

export function LogisticsPage() {
  const [sales, setSales] = useState<SaleOrder[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [centers, setCenters] = useState<CollectionCenter[]>([]);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [buyers, setBuyers] = useState<Party[]>([]);
  const [gpsPositions, setGpsPositions] = useState<Array<{ vehicle: string; lat: string; lng: string; recorded_at: string }>>([]);

  const [selectedSaleId, setSelectedSaleId] = useState("");
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState("");
  const [deliveryType, setDeliveryType] = useState<"complete" | "partial">("partial");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [windowStart, setWindowStart] = useState("");
  const [windowEnd, setWindowEnd] = useState("");
  const [transportMode, setTransportMode] = useState("");
  const [operator, setOperator] = useState("");
  const [plates, setPlates] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    const [nextSales, nextDeliveries, nextRoutes, nextCenters, nextItems, nextVehicles, nextBuyers, nextGps] = await Promise.all([
      api.saleOrders().catch(() => []),
      api.deliveries().catch(() => []),
      api.routes().catch(() => []),
      api.centers().catch(() => []),
      api.saleItems().catch(() => []),
      api.vehicles().catch(() => []),
      api.parties().catch(() => []),
      api.gpsPositions().catch(() => []),
    ]);
    setSales(nextSales);
    setDeliveries(nextDeliveries);
    setRoutes(nextRoutes);
    setCenters(nextCenters);
    setItems(nextItems);
    setVehicles(nextVehicles);
    setBuyers(nextBuyers);
    setGpsPositions(nextGps);
  }

  useEffect(() => {
    void refresh();
  }, []);

  const centerById = useMemo(() => Object.fromEntries(centers.map((center) => [center.id, center])), [centers]);
  const routeById = useMemo(() => Object.fromEntries(routes.map((route) => [route.id, route])), [routes]);
  const buyerById = useMemo(() => Object.fromEntries(buyers.map((buyer) => [buyer.id, buyer])), [buyers]);

  const pendingSales = useMemo(() => {
    const scheduledSaleIds = new Set(deliveries.map((delivery) => delivery.sale_order));
    return sales.filter((sale) => sale.status !== "cancelled" && sale.status !== "draft" && !scheduledSaleIds.has(sale.id));
  }, [deliveries, sales]);

  const selectedSale = useMemo(() => sales.find((sale) => sale.id === selectedSaleId) ?? null, [sales, selectedSaleId]);
  const selectedSaleItems = useMemo(() => items.filter((item) => item.sale_order === selectedSaleId), [items, selectedSaleId]);
  const selectedSaleBuyer = useMemo(() => (selectedSale ? buyerById[selectedSale.buyer] : undefined), [buyerById, selectedSale]);
  const selectedRoute = useMemo(() => routeById[selectedRouteId], [routeById, selectedRouteId]);
  const selectedRouteOrigin = useMemo(() => (selectedRoute ? centerById[selectedRoute.origin_center] : undefined), [centerById, selectedRoute]);
  const selectedRouteDestination = useMemo(() => (selectedRoute ? centerById[selectedRoute.destination_center] : undefined), [centerById, selectedRoute]);

  const selectedVehicleGps = useMemo(() => {
    if (!selectedSale) return null;
    const saleDeliveries = deliveries.filter((delivery) => delivery.sale_order === selectedSale.id);
    const latestDelivery = saleDeliveries.find((delivery) => delivery.vehicle_label);
    if (!latestDelivery?.vehicle_label) return null;

    const vehicle = vehicles.find(
      (item) => item.plate_number === latestDelivery.vehicle_label || vehicleLabel(item) === latestDelivery.vehicle_label,
    );
    if (!vehicle) return null;

    return gpsPositions.find((point) => point.vehicle === vehicle.id) ?? null;
  }, [deliveries, gpsPositions, selectedSale, vehicles]);

  const selectedSaleDeliveries = useMemo(
    () => deliveries.filter((delivery) => delivery.sale_order === selectedSaleId),
    [deliveries, selectedSaleId],
  );

  useEffect(() => {
    if (!selectedSale) {
      setSelectedItemIds([]);
      return;
    }
    setSelectedItemIds(selectedSaleItems.map((item) => item.id));
    setReceiverName(selectedSaleBuyer?.legal_name || selectedSaleBuyer?.trade_name || "");
    setReceiverPhone(selectedSaleBuyer?.phone || "");
  }, [selectedSale, selectedSaleBuyer, selectedSaleItems]);

  const mapPoints = useMemo<RouteMapPoint[]>(() => {
    const points: Array<RouteMapPoint | null> = [];

    if (selectedRouteOrigin?.latitude && selectedRouteOrigin?.longitude) {
      points.push({
        label: `Origen: ${selectedRouteOrigin.name}`,
        latitude: Number(selectedRouteOrigin.latitude),
        longitude: Number(selectedRouteOrigin.longitude),
        kind: "start",
      });
    }

    if (selectedRouteDestination?.latitude && selectedRouteDestination?.longitude) {
      points.push({
        label: `Destino: ${selectedRouteDestination.name}`,
        latitude: Number(selectedRouteDestination.latitude),
        longitude: Number(selectedRouteDestination.longitude),
        kind: "end",
      });
    }

    if (selectedVehicleGps?.lat && selectedVehicleGps?.lng) {
      points.push({
        label: "Ubicación actual",
        latitude: Number(selectedVehicleGps.lat),
        longitude: Number(selectedVehicleGps.lng),
        kind: "telemetry",
      });
    }

    return points.filter((point): point is RouteMapPoint => Boolean(point));
  }, [selectedRouteDestination, selectedRouteOrigin, selectedVehicleGps]);

  async function createDelivery(event: FormEvent) {
    event.preventDefault();
    if (!selectedSale) {
      setMessage("Selecciona una venta pendiente para programar entrega.");
      return;
    }
    if (!selectedItemIds.length) {
      setMessage("Selecciona al menos una partida para la entrega.");
      return;
    }
    if (!selectedRoute) {
      setMessage("Selecciona un destino registrado en rutas.");
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const created = await api.saleOrderDeliveryCreate(selectedSale.id, {
        sale_item_ids: selectedItemIds,
        scheduled_date: deliveryDate || null,
        time_window_start: windowStart || null,
        time_window_end: windowEnd || null,
        destination_name: selectedRouteDestination?.name || selectedRoute.name,
        destination_address: selectedRouteDestination?.address || "",
        destination_lat: selectedRouteDestination?.latitude || null,
        destination_lng: selectedRouteDestination?.longitude || null,
        contact_name: receiverName,
        contact_phone: receiverPhone,
        transport_mode: transportMode,
        transport_operator: operator,
        transport_plates: plates,
        notes,
        delivery_type: deliveryType,
      });

      setMessage(`Entrega ${created.folio} creada para la venta ${selectedSale.folio}.`);
      setSelectedSaleId("");
      setSelectedRouteId("");
      setDeliveryType("partial");
      setDeliveryDate("");
      setWindowStart("");
      setWindowEnd("");
      setTransportMode("");
      setOperator("");
      setPlates("");
      setReceiverName("");
      setReceiverPhone("");
      setNotes("");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo crear la entrega.");
    } finally {
      setLoading(false);
    }
  }

  const recentDeliveries = useMemo(() => [...deliveries].slice(0, 8), [deliveries]);

  return (
    <Page title="Logística" actions={<span className="muted">Programación de entregas y seguimiento operativo</span>}>
      <div style={{ display: "grid", gap: 20 }}>
        <section className="metric-grid" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))", marginBottom: 16 }}>
          <div className="metric-panel">
            <span className="metric-label">Ventas por programar</span>
            <strong className="metric-value">{pendingSales.length.toLocaleString("es-MX")}</strong>
          </div>
          <div className="metric-panel">
            <span className="metric-label">Entregas creadas</span>
            <strong className="metric-value">{deliveries.length.toLocaleString("es-MX")}</strong>
          </div>
          <div className="metric-panel">
            <span className="metric-label">Rutas registradas</span>
            <strong className="metric-value">{routes.length.toLocaleString("es-MX")}</strong>
          </div>
          <div className="metric-panel">
            <span className="metric-label">Unidades disponibles</span>
            <strong className="metric-value">{vehicles.length.toLocaleString("es-MX")}</strong>
          </div>
        </section>

        <section className="section-panel">
          <div className="section-panel-header">
            <h3>Ventas pendientes de entrega</h3>
            <span className="muted">Selecciona una venta para preparar su salida</span>
          </div>
          <div className="section-panel-body" style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Folio</th>
                  <th>Comprador</th>
                  <th>Centro</th>
                  <th>Kg</th>
                  <th>Total</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {pendingSales.map((sale) => {
                  const buyer = buyerById[sale.buyer];
                  const center = centerById[sale.collection_center];
                  const isSelected = sale.id === selectedSaleId;

                  return (
                    <tr
                      key={sale.id}
                      onClick={() => setSelectedSaleId(sale.id)}
                      style={{ cursor: "pointer", background: isSelected ? "var(--accent-dim)" : undefined }}
                    >
                      <td style={{ fontFamily: "monospace", fontWeight: 700 }}>{sale.folio}</td>
                      <td>{partyLabel(buyer)}</td>
                      <td>{centerLabel(center)}</td>
                      <td>{kg(sale.total_weight_kg)}</td>
                      <td>{money(sale.total_amount)}</td>
                      <td>
                        <span className={`badge ${sale.status === "confirmed" ? "badge-amber" : "badge-gray"}`}>
                          {sale.status_label ?? sale.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {!pendingSales.length ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: 18 }} className="muted">
                      No hay ventas pendientes por programar.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <div className="processing-two-up">
          <section className="section-panel">
            <div className="section-panel-header">
              <h3>Programación de entrega</h3>
              <span className="muted">Destino, transporte y responsable de recepción</span>
            </div>
            <div className="section-panel-body">
              <form className="grid-form" onSubmit={createDelivery}>
                <label>
                  Ruta / destino
                  <select value={selectedRouteId} onChange={(e) => setSelectedRouteId(e.target.value)}>
                    <option value="">Seleccionar ruta / destino</option>
                    {routes.map((route) => (
                      <option key={route.id} value={route.id}>
                        {routeLabel(route)}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Tipo de entrega
                  <select value={deliveryType} onChange={(e) => setDeliveryType(e.target.value as "complete" | "partial")}>
                    <option value="complete">Completa</option>
                    <option value="partial">Parcial</option>
                  </select>
                </label>

                <label>
                  Fecha
                  <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
                </label>

                <label>
                  Inicio
                  <input type="time" value={windowStart} onChange={(e) => setWindowStart(e.target.value)} />
                </label>

                <label>
                  Fin
                  <input type="time" value={windowEnd} onChange={(e) => setWindowEnd(e.target.value)} />
                </label>

                <label>
                  Transporte
                  <input value={transportMode} onChange={(e) => setTransportMode(e.target.value)} placeholder="Camión, torton, tráiler..." />
                </label>

                <label>
                  Operador
                  <input value={operator} onChange={(e) => setOperator(e.target.value)} placeholder="Nombre del operador" />
                </label>

                <label>
                  Placas
                  <input value={plates} onChange={(e) => setPlates(e.target.value)} placeholder="Placas de la unidad" />
                </label>

                <label>
                  Recibe
                  <input value={receiverName} onChange={(e) => setReceiverName(e.target.value)} placeholder="Nombre de quien recibe" />
                </label>

                <label>
                  Teléfono
                  <input value={receiverPhone} onChange={(e) => setReceiverPhone(e.target.value)} placeholder="Teléfono de contacto" />
                </label>

                <label className="full-width-form-field">
                  Observaciones
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Instrucciones, horarios, evidencia, observaciones operativas"
                  />
                </label>

                <label className="full-width-form-field">
                  Asignación actual
                  <div className="muted">
                    {selectedRoute
                      ? `${routeLabel(selectedRoute)} · ${selectedRouteOrigin ? centerLabel(selectedRouteOrigin) : "-"} -> ${selectedRouteDestination ? centerLabel(selectedRouteDestination) : "-"}`
                      : "Selecciona una ruta registrada"}
                  </div>
                </label>

                <button type="submit" className="btn-primary" disabled={!selectedSale || !selectedRoute || loading}>
                  Programar entrega
                </button>
              </form>
            </div>
          </section>

          <div style={{ display: "grid", gap: 12 }}>
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
              <div className="metric-panel">
                <span>Materiales</span>
                <strong>{selectedSaleItems.length}</strong>
              </div>
              <div className="metric-panel">
                <span>Kg seleccionados</span>
                <strong>{kg(selectedSaleItems.reduce((sum, item) => sum + Number(item.quantity_kg ?? 0), 0))}</strong>
              </div>
              <div className="metric-panel">
                <span>GPS</span>
                <strong>{selectedVehicleGps ? "Disponible" : "Sin señal"}</strong>
              </div>
              <div className="metric-panel">
                <span>Entregas de la venta</span>
                <strong>{selectedSaleDeliveries.length}</strong>
              </div>
            </div>

            <section className="section-panel" style={{ boxShadow: "none" }}>
              <div className="section-panel-header">
                <h3>Materiales de la venta</h3>
                <span className="muted">Marca qué partidas irán en esta entrega</span>
              </div>
              <div className="section-panel-body" style={{ overflowX: "auto" }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th></th>
                      <th>Material</th>
                      <th>Presentación</th>
                      <th>Calidad</th>
                      <th>Kg</th>
                      <th>Importe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSaleItems.map((item) => {
                      const checked = selectedItemIds.includes(item.id);
                      return (
                        <tr key={item.id}>
                          <td>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                setSelectedItemIds((current) =>
                                  e.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id),
                                );
                              }}
                            />
                          </td>
                          <td>{item.material_name ?? item.material}</td>
                          <td>{item.presentation || "-"}</td>
                          <td>{item.quality || "-"}</td>
                          <td>{kg(item.quantity_kg)}</td>
                          <td>{money(item.amount)}</td>
                        </tr>
                      );
                    })}
                    {!selectedSaleItems.length ? (
                      <tr>
                        <td colSpan={6} className="muted" style={{ textAlign: "center", padding: 18 }}>
                          Selecciona una venta para ver sus partidas.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="section-panel" style={{ boxShadow: "none" }}>
              <div className="section-panel-header">
                <h3>Resumen de la venta seleccionada</h3>
                <span className="muted">{selectedSale ? selectedSale.folio : "Sin venta seleccionada"}</span>
              </div>
              <div className="section-panel-body">
                <div style={{ display: "grid", gap: 8 }}>
                  <div>
                    <strong>Comprador:</strong> {selectedSaleBuyer ? partyLabel(selectedSaleBuyer) : "-"}
                  </div>
                  <div>
                    <strong>Centro:</strong> {selectedSale ? centerLabel(centerById[selectedSale.collection_center]) : "-"}
                  </div>
                  <div>
                    <strong>Total:</strong> {selectedSale ? money(selectedSale.total_amount) : "-"}
                  </div>
                  <div>
                    <strong>Kg:</strong> {selectedSale ? kg(selectedSale.total_weight_kg) : "-"}
                  </div>
                  <div>
                    <strong>Estado:</strong> {selectedSale?.status_label ?? selectedSale?.status ?? "-"}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>

        <section className="section-panel">
          <div className="section-panel-header">
            <h3>Mapa y monitoreo de entrega</h3>
            <span className="muted">Origen, destino, ubicación actual y datos de recepción</span>
          </div>
          <div className="section-panel-body">
            <div className="grid" style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.1fr)", gap: 16 }}>
              <div className="metric-panel" style={{ display: "grid", gap: 8 }}>
                <span>Información de entrega</span>
                <div className="muted">Origen: {selectedSale ? centerLabel(centerById[selectedSale.collection_center]) : "-"}</div>
                <div className="muted">Destino: {selectedRouteDestination ? centerLabel(selectedRouteDestination) : "-"}</div>
                <div className="muted">Ruta: {selectedRoute ? routeLabel(selectedRoute) : "-"}</div>
                <div className="muted">Tipo: {deliveryType === "complete" ? "Completa" : "Parcial"}</div>
                <div className="muted">Transporte: {transportMode || "-"}</div>
                <div className="muted">Operador: {operator || "-"}</div>
                <div className="muted">Placas: {plates || "-"}</div>
                <div className="muted">Hora de salida: {windowStart || "-"}</div>
                <div className="muted">Hora de llegada: {windowEnd || "-"}</div>
                <div className="muted">Quien recibe: {receiverName || "-"}</div>
                <div className="muted">Teléfono: {receiverPhone || "-"}</div>
                <div className="muted">Observaciones: {notes || "-"}</div>
                <div className="muted">
                  Ubicación actual: {selectedVehicleGps ? `${selectedVehicleGps.lat}, ${selectedVehicleGps.lng} · ${formatDateTime(selectedVehicleGps.recorded_at)}` : "Sin señal GPS"}
                </div>
              </div>
              <RouteMap points={mapPoints} title="Mapa de entrega" />
            </div>
          </div>
        </section>

        <section className="section-panel">
          <div className="section-panel-header">
            <h3>Documentos y entregas recientes</h3>
            <span className="muted">Orden de salida, remisión y comprobante operativo</span>
          </div>
          <div className="section-panel-body" style={{ display: "grid", gap: 16 }}>
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
              <div className="metric-panel">
                <span>Orden de salida</span>
                <strong>{selectedSale ? `OS-${selectedSale.folio}` : "-"}</strong>
                <div className="muted">Autoriza la salida de material y unidad.</div>
              </div>
              <div className="metric-panel">
                <span>Remisión</span>
                <strong>{selectedSale ? `RM-${selectedSale.folio}` : "-"}</strong>
                <div className="muted">Resume origen, destino, operador y carga.</div>
              </div>
              <div className="metric-panel">
                <span>Comprobante</span>
                <strong>{selectedSale ? "Disponible para impresión" : "-"}</strong>
                <div className="muted">Usa la entrega para ticket o copia interna.</div>
              </div>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button type="button" disabled={!selectedSale}>
                Imprimir expediente
              </button>
              <button type="button" disabled={!selectedSale}>
                Preparar orden
              </button>
              <button type="button" disabled={!selectedSale}>
                Preparar remisión
              </button>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Folio</th>
                    <th>Venta</th>
                    <th>Ruta</th>
                    <th>Unidad</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {recentDeliveries.map((delivery) => (
                    <tr key={delivery.id}>
                      <td style={{ fontFamily: "monospace", fontWeight: 700 }}>{delivery.folio}</td>
                      <td>{delivery.sale_folio ?? delivery.sale_order}</td>
                      <td>{delivery.route_name ?? delivery.route}</td>
                      <td>{delivery.vehicle_label ?? delivery.vehicle}</td>
                      <td>{formatDateTime(delivery.scheduled_date ?? delivery.created_at)}</td>
                    </tr>
                  ))}
                  {!recentDeliveries.length ? (
                    <tr>
                      <td colSpan={5} className="muted" style={{ textAlign: "center", padding: 18 }}>
                        No hay entregas registradas todavía.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {message ? <div className={message.toLowerCase().includes("no") ? "error-banner" : "info-banner"}>{message}</div> : null}
      </div>
    </Page>
  );
}
