import { useEffect, useMemo, useState } from "react";
import { api } from "../api/resources";
import type { CollectionCenter, Material, Party, PrintLog, PurchaseOperation, TicketItem, Vehicle } from "../types";
import { Page } from "../components/Page";
import { Pagination } from "../components/Pagination";
import { TicketViewer } from "../components/TicketViewer";
import { paginate } from "../utils/listing";

function fmtMXN(v: number) {
  return "$" + v.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtKg(v: number) {
  return v.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " kg";
}

function fmtDate(iso?: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-MX") + " " + d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

function money(value?: string | number | null) {
  const n = typeof value === "number" ? value : parseFloat(value ?? "0");
  return Number.isFinite(n) ? n : 0;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  open: "Abierta",
  registered: "Registrada",
  confirmed: "Confirmada",
  completed: "Completada",
  cancelled: "Cancelada",
};

const PAYMENT_LABELS: Record<string, string> = {
  pending: "Pendiente",
  partial: "Parcial",
  paid: "Pagado",
  cancelled: "Cancelado",
  credit: "Crédito",
};

function statusBadge(status: string) {
  if (status === "confirmed" || status === "completed") return "badge-green";
  if (status === "cancelled") return "badge-red";
  return "badge-gray";
}

function customerName(op: PurchaseOperation, party?: Party) {
  return op.customer_name ?? op.customer_trade_name ?? op.customer_legal_name ?? party?.trade_name ?? party?.legal_name ?? "-";
}

export function HistoryPage() {
  const [operations, setOperations] = useState<PurchaseOperation[]>([]);
  const [centers, setCenters] = useState<CollectionCenter[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [printLogs, setPrintLogs] = useState<PrintLog[]>([]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<TicketItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [centerFilter, setCenterFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.operationsAll().catch(() => [] as PurchaseOperation[]),
      api.centers().catch(() => [] as CollectionCenter[]),
      api.parties().catch(() => [] as Party[]),
      api.vehicles().catch(() => [] as Vehicle[]),
      api.materials().catch(() => [] as Material[]),
      api.printLogs().catch(() => [] as PrintLog[]),
    ]).then(([ops, ctrs, pts, vehs, mats, logs]) => {
      setOperations(ops as PurchaseOperation[]);
      setCenters(ctrs as CollectionCenter[]);
      setParties(pts as Party[]);
      setVehicles(vehs as Vehicle[]);
      setMaterials(mats as Material[]);
      setPrintLogs(logs as PrintLog[]);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setSelectedItems([]);
      return;
    }
    setItemsLoading(true);
    api.ticketItemsByOperation(selectedId)
      .then((items) => setSelectedItems(items))
      .catch(() => setSelectedItems([]))
      .finally(() => setItemsLoading(false));
  }, [selectedId]);

  const centerById = useMemo(() => new Map(centers.map((c) => [c.id, c])), [centers]);
  const partyById = useMemo(() => new Map(parties.map((p) => [p.id, p])), [parties]);
  const vehicleById = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles]);
  const materialById = useMemo(() => new Map(materials.map((m) => [m.id, m])), [materials]);

  const sortedOps = useMemo(() => {
    return [...operations].sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tb - ta;
    });
  }, [operations]);

  const filteredOps = useMemo(() => {
    const q = search.trim().toLowerCase();
    const fromTime = dateFrom ? new Date(dateFrom + "T00:00:00").getTime() : null;
    const toTime = dateTo ? new Date(dateTo + "T23:59:59").getTime() : null;

    return sortedOps.filter((op) => {
      const party = partyById.get(op.customer);
      const center = centerById.get(op.collection_center);
      const vehicle = op.vehicle ? vehicleById.get(op.vehicle) : null;
      const createdTime = op.created_at ? new Date(op.created_at).getTime() : null;

      if (statusFilter && op.status !== statusFilter) return false;
      if (paymentFilter && op.payment_status !== paymentFilter) return false;
      if (centerFilter && op.collection_center !== centerFilter) return false;
      if (fromTime && createdTime && createdTime < fromTime) return false;
      if (toTime && createdTime && createdTime > toTime) return false;

      if (!q) return true;
      const haystack = [
        op.folio,
        customerName(op, party),
        center?.name,
        vehicle?.plate_number,
        op.vehicle_plate,
        op.driver_name,
        op.opened_by_name,
        op.status,
        op.payment_status,
        op.print_status,
      ].join(" ").toLowerCase();

      return haystack.includes(q);
    });
  }, [sortedOps, search, statusFilter, paymentFilter, centerFilter, dateFrom, dateTo, partyById, centerById, vehicleById]);

  const stats = useMemo(() => {
    return filteredOps.reduce(
      (acc, op) => {
        acc.total += 1;
        acc.amount += money(op.total_amount);
        acc.weight += money(op.total_weight_kg);
        if (op.status === "cancelled") acc.cancelled += 1;
        if (op.status === "confirmed" || op.status === "completed") acc.closed += 1;
        if (op.payment_status && op.payment_status !== "paid") acc.pendingPayment += 1;
        return acc;
      },
      { total: 0, amount: 0, weight: 0, cancelled: 0, closed: 0, pendingPayment: 0 },
    );
  }, [filteredOps]);

  const paginated = useMemo(() => paginate(filteredOps, page, pageSize), [filteredOps, page, pageSize]);

  useEffect(() => { setPage(1); }, [search, statusFilter, paymentFilter, centerFilter, dateFrom, dateTo, pageSize]);

  const selectedOp = useMemo(() => operations.find((o) => o.id === selectedId) ?? null, [operations, selectedId]);

  const selectedVehicle = useMemo(() => {
    if (!selectedOp?.vehicle) return null;
    return vehicleById.get(selectedOp.vehicle) ?? null;
  }, [selectedOp, vehicleById]);

  const selectedCustomer = useMemo(() => {
    if (!selectedOp?.customer) return null;
    return partyById.get(selectedOp.customer) ?? null;
  }, [selectedOp, partyById]);

  const selectedCenter = useMemo(() => {
    if (!selectedOp?.collection_center) return null;
    return centerById.get(selectedOp.collection_center) ?? null;
  }, [selectedOp, centerById]);

  const selectedSummary = useMemo(() => {
    const weight = selectedItems.reduce((sum, item) => sum + money(item.net_weight_kg), 0);
    const amount = selectedItems.reduce((sum, item) => sum + money(item.amount), 0);
    return { weight, amount };
  }, [selectedItems]);

  const selectedPrints = useMemo(() => {
    return [...printLogs]
      .filter((log) => log.operation === selectedId)
      .sort((a, b) => new Date(b.printed_at).getTime() - new Date(a.printed_at).getTime());
  }, [printLogs, selectedId]);

  async function reprintLatestTicket() {
    const latest = selectedPrints[0];
    if (!latest) return;
    try {
      await api.reprintLog(latest.id);
      const refreshedLogs = await api.printLogs().catch(() => [] as PrintLog[]);
      setPrintLogs(refreshedLogs as PrintLog[]);
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <Page title="Historial de compras">
      <div style={{ display: "grid", gap: 16 }}>
        <div className="info-banner">
          Vista de auditoría: aquí solo se consulta el historial. Las compras no se reabren ni se modifican desde esta sección.
        </div>

        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 16 }}>
          <div className="metric-panel">
            <span className="metric-label">Operaciones filtradas</span>
            <strong className="metric-value">{stats.total.toLocaleString("es-MX")}</strong>
          </div>
          <div className="metric-panel">
            <span className="metric-label">Importe auditado</span>
            <strong className="metric-value">{fmtMXN(stats.amount)}</strong>
          </div>
          <div className="metric-panel">
            <span className="metric-label">Kg auditados</span>
            <strong className="metric-value">{fmtKg(stats.weight)}</strong>
          </div>
          <div className="metric-panel">
            <span className="metric-label">Con pago pendiente</span>
            <strong className="metric-value">{stats.pendingPayment.toLocaleString("es-MX")}</strong>
          </div>
        </div>

        <div className="section-panel">
          <div className="section-panel-header">
            <h3>Filtros de auditoría</h3>
            <span className="badge badge-gray">{filteredOps.length.toLocaleString("es-MX")} registros</span>
          </div>
          <div className="section-panel-body">
            <div style={{ display: "grid", gridTemplateColumns: "2fr repeat(5, minmax(130px, 1fr))", gap: 12 }}>
              <label className="search-box">
                Buscar
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Folio, cliente, placa, conductor, usuario..."
                />
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
                  {Object.entries(PAYMENT_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
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
        </div>

        <div style={{ display: "grid", gridTemplateColumns: selectedId ? "1fr 440px" : "1fr", gap: 20, alignItems: "start" }}>
          <div className="section-panel">
            <div className="section-panel-header">
              <h3>Bitácora histórica de compras</h3>
              <span className="badge badge-gray">Solo lectura</span>
            </div>
            <div className="section-panel-body" style={{ padding: 0 }}>
              {loading ? (
                <div className="info-banner" style={{ margin: 16 }}>Cargando operaciones...</div>
              ) : (
                <>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Folio</th>
                        <th>Fecha</th>
                        <th>Cliente</th>
                        <th>Placa</th>
                        <th>Centro</th>
                        <th>Encargado</th>
                        <th>Conductor</th>
                        <th>Estado</th>
                        <th>Pago</th>
                        <th style={{ textAlign: "right" }}>Total</th>
                        <th>Auditoría</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.items.map((op) => {
                        const party = partyById.get(op.customer);
                        const center = centerById.get(op.collection_center);
                        const vehicle = op.vehicle ? vehicleById.get(op.vehicle) : null;
                        const isSelected = op.id === selectedId;
                        return (
                          <tr
                            key={op.id}
                            style={{
                              background: isSelected ? "var(--accent-dim)" : undefined,
                              outline: isSelected ? "1px solid rgba(34,197,94,0.3)" : undefined,
                            }}
                          >
                            <td style={{ fontWeight: 700, fontFamily: "monospace" }}>{op.folio}</td>
                            <td style={{ fontSize: "0.8rem", color: "var(--muted)", whiteSpace: "nowrap" }}>{fmtDate(op.created_at)}</td>
                            <td style={{ fontWeight: 500 }}>{customerName(op, party)}</td>
                            <td>{vehicle?.plate_number ?? op.vehicle_plate ?? "-"}</td>
                            <td style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{center?.name ?? "-"}</td>
                            <td style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{op.opened_by_name ?? "-"}</td>
                            <td style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{op.driver_name ?? "-"}</td>
                            <td>
                              <span className={`badge ${statusBadge(op.status)}`} style={{ fontSize: "0.7rem" }}>
                                {STATUS_LABELS[op.status] ?? op.status}
                              </span>
                            </td>
                            <td>
                              <span className="badge badge-gray" style={{ fontSize: "0.7rem" }}>
                                {op.payment_status_label ?? PAYMENT_LABELS[op.payment_status] ?? op.payment_status ?? "-"}
                              </span>
                            </td>
                            <td style={{ textAlign: "right", fontWeight: 700, color: "var(--accent-2)" }}>
                              {fmtMXN(money(op.total_amount))}
                            </td>
                            <td>
                              <button className="btn-ghost" type="button" onClick={() => setSelectedId(isSelected ? null : op.id)}>
                                {isSelected ? "Ocultar" : "Ver detalle"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {paginated.items.length === 0 && (
                        <tr>
                          <td colSpan={11} style={{ textAlign: "center", padding: "24px", color: "var(--muted)" }}>
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
          </div>

          {selectedId && selectedOp && (
            <div className="section-panel" style={{ position: "sticky", top: 16 }}>
              <div className="section-panel-header">
                <div>
                  <h3 style={{ fontFamily: "monospace" }}>{selectedOp.folio}</h3>
                  <div style={{ color: "var(--muted)", fontSize: "0.8rem" }}>Detalle de auditoría, solo lectura</div>
                </div>
                <button className="btn-ghost" type="button" onClick={() => setSelectedId(null)}>Cerrar</button>
              </div>
              <div className="section-panel-body" style={{ display: "grid", gap: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div className="metric-panel">
                    <span className="metric-label">Total operación</span>
                    <strong>{fmtMXN(money(selectedOp.total_amount))}</strong>
                  </div>
                  <div className="metric-panel">
                    <span className="metric-label">Peso total</span>
                    <strong>{fmtKg(money(selectedOp.total_weight_kg))}</strong>
                  </div>
                  <div className="metric-panel">
                    <span className="metric-label">Partidas</span>
                    <strong>{selectedItems.length.toLocaleString("es-MX")}</strong>
                  </div>
                  <div className="metric-panel">
                    <span className="metric-label">Estado pago</span>
                    <strong>{selectedOp.payment_status_label ?? PAYMENT_LABELS[selectedOp.payment_status] ?? selectedOp.payment_status ?? "-"}</strong>
                  </div>
                </div>

                <div className="info-banner" style={{ display: "grid", gap: 6 }}>
                  <div><strong>Cliente:</strong> {customerName(selectedOp, selectedCustomer ?? undefined)}</div>
                  <div><strong>Centro:</strong> {selectedCenter?.name ?? "-"}</div>
                  <div><strong>Vehículo:</strong> {selectedVehicle?.plate_number ?? selectedOp.vehicle_plate ?? "-"}</div>
                  <div><strong>Conductor:</strong> {selectedOp.driver_name ?? "-"}</div>
                  <div><strong>Encargado:</strong> {selectedOp.opened_by_name ?? "-"}</div>
                  <div><strong>Fecha de registro:</strong> {fmtDate(selectedOp.created_at)}</div>
                  <div><strong>Estado operación:</strong> {STATUS_LABELS[selectedOp.status] ?? selectedOp.status}</div>
                  <div><strong>Estado de impresión:</strong> {selectedOp.print_status ?? "-"}</div>
                </div>

                {itemsLoading ? (
                  <div style={{ textAlign: "center", color: "var(--muted)", padding: "20px 0" }}>
                    Cargando partidas...
                  </div>
                ) : selectedItems.length === 0 ? (
                  <div style={{ textAlign: "center", color: "var(--muted)", padding: "20px 0" }}>
                    No hay partidas registradas.
                  </div>
                ) : (
                  <>
                    <div className="section-panel" style={{ boxShadow: "none" }}>
                      <div className="section-panel-header">
                        <h3>Vista previa del ticket</h3>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                          {selectedPrints[0] && (
                            <button className="btn-ghost" type="button" onClick={reprintLatestTicket}>
                              Reimprimir ticket
                            </button>
                          )}
                          <span className="badge badge-gray">{fmtKg(selectedSummary.weight)} | {fmtMXN(selectedSummary.amount)}</span>
                        </div>
                      </div>
                    </div>
                    <TicketViewer
                      operation={selectedOp}
                      items={selectedItems}
                      center={selectedCenter}
                      customer={selectedCustomer}
                      vehicle={selectedVehicle}
                      materialById={materialById}
                    />
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Page>
  );
}
