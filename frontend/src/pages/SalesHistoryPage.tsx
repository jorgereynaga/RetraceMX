// @ts-nocheck
import { useEffect, useMemo, useState } from "react";
import { api } from "../api/resources";
import { Page } from "../components/Page";
import { Pagination } from "../components/Pagination";
import type { CollectionCenter, Party, SaleItem, SaleOrder } from "../types";
import { paginate } from "../utils/listing";

const STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  confirmed: "Confirmada",
  sent_to_cashier: "Enviada a caja",
  scheduled_delivery: "Entrega programada",
  loading: "En carga",
  in_route: "En ruta",
  delivered: "Entregada",
  completed: "Cerrada",
  paid: "Pagada",
  credit: "Crédito",
  closed: "Cerrada",
  cancelled: "Cancelada",
  adjusted: "Ajustada",
};

function money(value?: string | number | null) {
  const parsed = typeof value === "string" ? Number(value) : value ?? 0;
  return `$${Number(parsed || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function kg(value?: string | number | null) {
  const parsed = typeof value === "string" ? Number(value) : value ?? 0;
  return Number(parsed || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
}

function saleCreatedAt(order: { created_at?: string } | null | undefined) {
  return order?.created_at ?? null;
}

function partyLabel(party: Party | undefined) {
  if (!party) return "-";
  return party.trade_name || party.legal_name || "-";
}

function centerLabel(center: CollectionCenter | undefined) {
  return center ? `${center.code} · ${center.name}` : "-";
}

function tone(status?: string) {
  if (status === "cancelled") return "badge-red";
  if (status === "credit") return "badge-amber";
  if (status === "completed" || status === "paid" || status === "closed" || status === "delivered") return "badge-green";
  return "badge-gray";
}

export function SalesHistoryPage() {
  const [orders, setOrders] = useState<SaleOrder[]>([]);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [centers, setCenters] = useState<CollectionCenter[]>([]);
  const [buyers, setBuyers] = useState<Party[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [centerFilter, setCenterFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.saleOrders().catch(() => [] as SaleOrder[]),
      api.saleItems().catch(() => [] as SaleItem[]),
      api.centers().catch(() => [] as CollectionCenter[]),
      api.parties().catch(() => [] as Party[]),
    ])
      .then(([nextOrders, nextItems, nextCenters, nextBuyers]) => {
        setOrders(nextOrders as SaleOrder[]);
        setItems(nextItems as SaleItem[]);
        setCenters(nextCenters as CollectionCenter[]);
        setBuyers(nextBuyers as Party[]);
      })
      .finally(() => setLoading(false));
  }, []);

  const centerById = useMemo(() => new Map(centers.map((center) => [center.id, center])), [centers]);
  const partyById = useMemo(() => new Map(buyers.map((buyer) => [buyer.id, buyer])), [buyers]);

  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
      const ta = saleCreatedAt(a) ? new Date(saleCreatedAt(a) as string).getTime() : 0;
      const tb = saleCreatedAt(b) ? new Date(saleCreatedAt(b) as string).getTime() : 0;
      return tb - ta;
    });
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    const fromTime = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const toTime = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : null;

    return sortedOrders.filter((order) => {
      const buyer = partyById.get(order.buyer);
      const center = centerById.get(order.collection_center);
      const createdTime = saleCreatedAt(order) ? new Date(saleCreatedAt(order) as string).getTime() : null;

      if (statusFilter && order.status !== statusFilter) return false;
      if (paymentFilter && (order.payment_status ?? "") !== paymentFilter) return false;
      if (centerFilter && order.collection_center !== centerFilter) return false;
      if (fromTime && createdTime && createdTime < fromTime) return false;
      if (toTime && createdTime && createdTime > toTime) return false;

      if (!q) return true;
      const haystack = [
        order.folio,
        partyLabel(buyer ?? undefined),
        center?.name,
        order.status,
        order.payment_status,
        order.payment_terms,
        order.sale_type,
        order.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [centerById, centerFilter, dateFrom, dateTo, partyById, paymentFilter, search, sortedOrders, statusFilter]);

  const paginated = useMemo(() => paginate(filteredOrders, page, pageSize), [filteredOrders, page, pageSize]);
  const selectedOrder = useMemo(() => orders.find((order) => order.id === selectedId) ?? null, [orders, selectedId]);
  const selectedBuyer = useMemo(() => (selectedOrder ? partyById.get(selectedOrder.buyer) ?? null : null), [partyById, selectedOrder]);
  const selectedCenter = useMemo(() => (selectedOrder ? centerById.get(selectedOrder.collection_center) ?? null : null), [centerById, selectedOrder]);
  const selectedItems = useMemo(() => items.filter((item) => item.sale_order === selectedId), [items, selectedId]);

  const stats = useMemo(() => {
    return filteredOrders.reduce(
      (acc, order) => {
        acc.total += 1;
        acc.amount += Number(order.total_amount ?? 0);
        acc.weight += Number(order.total_weight_kg ?? 0);
        if (order.status === "cancelled") acc.cancelled += 1;
        if (order.payment_status === "paid") acc.paid += 1;
        if (order.payment_status === "partial") acc.partial += 1;
        if (order.payment_status === "pending") acc.pending += 1;
        return acc;
      },
      { total: 0, amount: 0, weight: 0, cancelled: 0, paid: 0, partial: 0, pending: 0 },
    );
  }, [filteredOrders]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, paymentFilter, centerFilter, dateFrom, dateTo, pageSize]);

  return (
    <Page title="Historial de ventas" actions={<span className="muted">Consulta comercial y auditoría de ventas</span>}>
      <div style={{ display: "grid", gap: 16 }}>
        <div className="info-banner">
          Vista de auditoría: aquí solo se consulta el historial comercial. Las ventas no se reabren ni se modifican desde esta sección.
        </div>

        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
          <div className="metric-panel"><span className="metric-label">Ventas filtradas</span><strong className="metric-value">{stats.total.toLocaleString("es-MX")}</strong></div>
          <div className="metric-panel"><span className="metric-label">Importe auditado</span><strong className="metric-value">{money(stats.amount)}</strong></div>
          <div className="metric-panel"><span className="metric-label">Kg auditados</span><strong className="metric-value">{kg(stats.weight)}</strong></div>
          <div className="metric-panel"><span className="metric-label">Cerradas</span><strong className="metric-value">{stats.paid.toLocaleString("es-MX")}</strong></div>
        </div>

        <section className="section-panel">
          <div className="section-panel-header">
            <h3>Filtros de auditoría</h3>
            <span className="badge badge-gray">{filteredOrders.length.toLocaleString("es-MX")} registros</span>
          </div>
          <div className="section-panel-body">
            <div style={{ display: "grid", gridTemplateColumns: "2fr repeat(5, minmax(130px, 1fr))", gap: 12 }}>
              <label className="search-box">
                Buscar
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Folio, cliente, estado, pago..." />
              </label>
              <label className="search-box">
                Estado
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="">Todos</option>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="search-box">
                Pago
                <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)}>
                  <option value="">Todos</option>
                  <option value="pending">Pendiente</option>
                  <option value="partial">Parcial</option>
                  <option value="paid">Pagado</option>
                </select>
              </label>
              <label className="search-box">
                Centro
                <select value={centerFilter} onChange={(e) => setCenterFilter(e.target.value)}>
                  <option value="">Todos</option>
                  {centers.map((center) => (
                    <option key={center.id} value={center.id}>{center.name}</option>
                  ))}
                </select>
              </label>
              <label className="search-box">
                Desde
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </label>
              <label className="search-box">
                Hasta
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </label>
            </div>
          </div>
        </section>

        <div style={{ display: "grid", gridTemplateColumns: selectedId ? "1fr 440px" : "1fr", gap: 20, alignItems: "start" }}>
          <section className="section-panel">
            <div className="section-panel-header">
              <h3>Historial de ventas</h3>
              <span className="badge badge-gray">Solo lectura</span>
            </div>
            <div className="section-panel-body" style={{ padding: 0 }}>
              {loading ? (
                <div className="info-banner" style={{ margin: 16 }}>Cargando ventas...</div>
              ) : (
                <>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Folio</th>
                        <th>Fecha</th>
                        <th>Comprador</th>
                        <th>Centro</th>
                        <th>Estado</th>
                        <th>Pago</th>
                        <th style={{ textAlign: "right" }}>Total</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.items.map((order) => {
                        const buyer = partyById.get(order.buyer);
                        const center = centerById.get(order.collection_center);
                        const isSelected = order.id === selectedId;
                        return (
                          <tr
                            key={order.id}
                            style={{
                              background: isSelected ? "var(--accent-dim)" : undefined,
                              outline: isSelected ? "1px solid rgba(34,197,94,0.3)" : undefined,
                            }}
                          >
                            <td style={{ fontWeight: 700, fontFamily: "monospace" }}>{order.folio}</td>
                            <td style={{ fontSize: "0.8rem", color: "var(--muted)", whiteSpace: "nowrap" }}>{formatDateTime(saleCreatedAt(order))}</td>
                            <td>{partyLabel(buyer ?? undefined)}</td>
                            <td style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{center?.name ?? "-"}</td>
                            <td><span className={`badge ${tone(order.status)}`}>{order.status_label ?? STATUS_LABELS[order.status] ?? order.status}</span></td>
                            <td><span className="badge badge-gray">{order.payment_status_label ?? order.payment_status ?? "-"}</span></td>
                            <td style={{ textAlign: "right", fontWeight: 700, color: "var(--accent-2)" }}>{money(order.total_amount)}</td>
                            <td>
                              <button className="btn-ghost" type="button" onClick={() => setSelectedId(isSelected ? null : order.id)}>
                                {isSelected ? "Ocultar" : "Ver detalle"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {paginated.items.length === 0 && (
                        <tr>
                          <td colSpan={8} style={{ textAlign: "center", padding: "24px", color: "var(--muted)" }}>
                            Sin resultados para los filtros seleccionados.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  <div style={{ padding: "0 16px 16px" }}>
                    <Pagination {...paginated} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={setPageSize} />
                  </div>
                </>
              )}
            </div>
          </section>

          {selectedId && selectedOrder && (
            <section className="section-panel" style={{ position: "sticky", top: 16 }}>
              <div className="section-panel-header">
                <div>
                  <h3 style={{ fontFamily: "monospace" }}>{selectedOrder.folio}</h3>
                  <div style={{ color: "var(--muted)", fontSize: "0.8rem" }}>Detalle comercial, solo lectura</div>
                </div>
                <button className="btn-ghost" type="button" onClick={() => setSelectedId(null)}>Cerrar</button>
              </div>
              <div className="section-panel-body" style={{ display: "grid", gap: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div className="metric-panel">
                    <span className="metric-label">Total venta</span>
                    <strong>{money(selectedOrder.total_amount)}</strong>
                  </div>
                  <div className="metric-panel">
                    <span className="metric-label">Peso total</span>
                    <strong>{kg(selectedOrder.total_weight_kg)}</strong>
                  </div>
                  <div className="metric-panel">
                    <span className="metric-label">Partidas</span>
                    <strong>{selectedItems.length.toLocaleString("es-MX")}</strong>
                  </div>
                  <div className="metric-panel">
                    <span className="metric-label">Estado pago</span>
                    <strong>{selectedOrder.payment_status_label ?? selectedOrder.payment_status ?? "-"}</strong>
                  </div>
                </div>

                <div className="info-banner" style={{ display: "grid", gap: 6 }}>
                  <div><strong>Comprador:</strong> {partyLabel(selectedBuyer ?? undefined)}</div>
                  <div><strong>Centro:</strong> {selectedCenter?.name ?? "-"}</div>
                  <div><strong>Destino:</strong> {selectedOrder.destination_name || "-"}</div>
                  <div><strong>Fecha de registro:</strong> {formatDateTime(saleCreatedAt(selectedOrder))}</div>
                  <div><strong>Estado venta:</strong> {STATUS_LABELS[selectedOrder.status] ?? selectedOrder.status}</div>
                  <div><strong>Términos de pago:</strong> {selectedOrder.payment_terms_label ?? selectedOrder.payment_terms}</div>
                  <div><strong>Pendiente:</strong> {money(selectedOrder.pending_amount)}</div>
                  <div><strong>Pagado:</strong> {money(selectedOrder.paid_amount)}</div>
                </div>

                {selectedItems.length === 0 ? (
                  <div style={{ textAlign: "center", color: "var(--muted)", padding: "20px 0" }}>
                    No hay partidas registradas.
                  </div>
                ) : (
                  <table className="table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Material</th>
                        <th>Presentación</th>
                        <th>Calidad</th>
                        <th>Kg</th>
                        <th>Precio</th>
                        <th>Importe</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedItems.map((item, index) => (
                        <tr key={item.id}>
                          <td>{index + 1}</td>
                          <td>{item.material_name ?? item.material}</td>
                          <td>{item.presentation || "-"}</td>
                          <td>{item.quality || "-"}</td>
                          <td>{kg(item.quantity_kg)}</td>
                          <td>{money(item.unit_price)}</td>
                          <td>{money(item.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </Page>
  );
}
