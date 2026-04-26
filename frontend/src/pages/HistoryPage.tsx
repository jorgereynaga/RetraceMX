import { useEffect, useMemo, useState } from "react";
import { api } from "../api/resources";
import type { CollectionCenter, Material, Party, PurchaseOperation, TicketItem, Vehicle } from "../types";
import { Page } from "../components/Page";
import { Pagination } from "../components/Pagination";
import { TicketViewer } from "../components/TicketViewer";
import { paginate } from "../utils/listing";

function fmtMXN(v: number) {
  return "$" + v.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("es-MX") + " " + d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  open: "Abierta",
  registered: "Registrada",
  confirmed: "Confirmada",
  completed: "Completada",
  cancelled: "Cancelada",
};

export function HistoryPage() {
  const [operations, setOperations] = useState<PurchaseOperation[]>([]);
  const [centers, setCenters] = useState<CollectionCenter[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<TicketItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.operationsAll().catch(() => [] as PurchaseOperation[]),
      api.centers().catch(() => [] as CollectionCenter[]),
      api.parties().catch(() => [] as Party[]),
      api.vehicles().catch(() => [] as Vehicle[]),
      api.materials().catch(() => [] as Material[]),
    ]).then(([ops, ctrs, pts, vehs, mats]) => {
      setOperations(ops as PurchaseOperation[]);
      setCenters(ctrs as CollectionCenter[]);
      setParties(pts as Party[]);
      setVehicles(vehs as Vehicle[]);
      setMaterials(mats as Material[]);
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
    if (!q) return sortedOps;
    return sortedOps.filter((op) => {
      const customer = partyById.get(op.customer);
      const center = centerById.get(op.collection_center);
      const vehicle = op.vehicle ? vehicleById.get(op.vehicle) : null;
      return (
        op.folio.toLowerCase().includes(q) ||
        (customer?.trade_name ?? customer?.legal_name ?? "").toLowerCase().includes(q) ||
        (center?.name ?? "").toLowerCase().includes(q) ||
        (vehicle?.plate_number ?? "").toLowerCase().includes(q) ||
        (op.status ?? "").toLowerCase().includes(q)
      );
    });
  }, [sortedOps, search, partyById, centerById, vehicleById]);

  const paginated = useMemo(() => paginate(filteredOps, page, pageSize), [filteredOps, page, pageSize]);

  useEffect(() => { setPage(1); }, [search]);

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

  return (
    <Page title="Historial de compras">
      <div style={{ display: "grid", gridTemplateColumns: selectedId ? "1fr 420px" : "1fr", gap: 20, alignItems: "start" }}>

        {/* Left: list */}
        <div>
          <div className="metric-panel" style={{ marginBottom: 12 }}>
            <label className="search-box">
              Búsqueda rápida
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Folio, cliente, placa, centro…"
              />
            </label>
          </div>

          {loading ? (
            <div className="info-banner">Cargando operaciones…</div>
          ) : (
            <>
              <table className="table" style={{ cursor: "pointer" }}>
                <thead>
                  <tr>
                    <th>Folio</th>
                    <th>Fecha</th>
                    <th>Cliente</th>
                    <th>Placa</th>
                    <th>Centro</th>
                    <th>Estado</th>
                    <th style={{ textAlign: "right" }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.items.map((op) => {
                    const customer = partyById.get(op.customer);
                    const center = centerById.get(op.collection_center);
                    const vehicle = op.vehicle ? vehicleById.get(op.vehicle) : null;
                    const isSelected = op.id === selectedId;
                    return (
                      <tr
                        key={op.id}
                        onClick={() => setSelectedId(isSelected ? null : op.id)}
                        style={{
                          background: isSelected ? "var(--accent-dim)" : undefined,
                          outline: isSelected ? "1px solid rgba(34,197,94,0.3)" : undefined,
                        }}
                      >
                        <td style={{ fontWeight: 600, fontFamily: "monospace" }}>{op.folio}</td>
                        <td style={{ fontSize: "0.8rem", color: "var(--muted)", whiteSpace: "nowrap" }}>{fmtDate(op.created_at)}</td>
                        <td style={{ fontWeight: 500 }}>{customer?.trade_name ?? customer?.legal_name ?? "—"}</td>
                        <td>{vehicle?.plate_number ?? "—"}</td>
                        <td style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{center?.name ?? "—"}</td>
                        <td>
                          <span className={`badge ${op.status === "confirmed" || op.status === "completed" ? "badge-green" : op.status === "cancelled" ? "badge-red" : "badge-gray"}`} style={{ fontSize: "0.7rem" }}>
                            {STATUS_LABELS[op.status] ?? op.status}
                          </span>
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 700, color: "var(--accent-2)" }}>
                          {fmtMXN(parseFloat(op.total_amount) || 0)}
                        </td>
                      </tr>
                    );
                  })}
                  {paginated.items.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", padding: "24px", color: "var(--muted)" }}>
                        Sin resultados
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <Pagination {...paginated} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={() => {}} />
            </>
          )}
        </div>

        {/* Right: ticket detail */}
        {selectedId && selectedOp && (
          <div className="section-panel" style={{ position: "sticky", top: 16 }}>
            <div className="section-panel-header">
              <h3 style={{ fontFamily: "monospace" }}>{selectedOp.folio}</h3>
              <button className="btn-ghost" style={{ fontSize: "0.8rem" }} onClick={() => setSelectedId(null)}>✕</button>
            </div>
            <div className="section-panel-body" style={{ paddingTop: 12 }}>
              {itemsLoading ? (
                <div style={{ textAlign: "center", color: "var(--muted)", padding: "20px 0" }}>
                  Cargando partidas…
                </div>
              ) : selectedItems.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--muted)", padding: "20px 0" }}>
                  No hay partidas registradas
                </div>
              ) : (
                <TicketViewer
                  operation={selectedOp}
                  items={selectedItems}
                  center={selectedCenter}
                  customer={selectedCustomer}
                  vehicle={selectedVehicle}
                  materialById={materialById}
                />
              )}

              <div style={{ marginTop: 12, display: "grid", gap: 6, fontSize: "0.78rem", color: "var(--muted)" }}>
                <div>Partidas: <strong style={{ color: "var(--text)" }}>{selectedItems.length}</strong></div>
                <div>Pago: <strong style={{ color: "var(--text)" }}>{selectedOp.payment_status}</strong></div>
                <div>Impresión: <strong style={{ color: "var(--text)" }}>{selectedOp.print_status}</strong></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Page>
  );
}
