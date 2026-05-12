import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../api/resources";
import { Page } from "../components/Page";
import type { CollectionCenter, InventoryMovement, InventorySummary, Material } from "../types";
import { useAuth } from "../context/AuthContext";
import { userCan } from "../utils/permissions";

type AdjustForm = {
  collection_center: string;
  material: string;
  direction: "increase" | "decrease";
  quantity_kg: string;
  unit_price: string;
  notes: string;
};

const emptyAdjustForm = (): AdjustForm => ({
  collection_center: "",
  material: "",
  direction: "increase",
  quantity_kg: "",
  unit_price: "",
  notes: "",
});

function fmtKg(value: number | string) {
  const parsed = typeof value === "string" ? Number(value) : value;
  return Number(parsed || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtMoney(value: number | string) {
  const parsed = typeof value === "string" ? Number(value) : value;
  return "$" + Number(parsed || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.toLocaleDateString("es-MX")} ${date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}`;
}

export function InventoryPage() {
  const { user } = useAuth();
  const canManageInventory = userCan(user, "inventory.manage");
  const [centers, setCenters] = useState<CollectionCenter[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [form, setForm] = useState<AdjustForm>(emptyAdjustForm());
  const [loading, setLoading] = useState(true);
  const [adjusting, setAdjusting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState<"all" | "raw" | "processed">("all");
  const [centerFilter, setCenterFilter] = useState("");
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [centerList, materialList, summaryData, movementList] = await Promise.all([
        api.centers().catch(() => [] as CollectionCenter[]),
        api.materials().catch(() => [] as Material[]),
        api.inventorySummary().catch(() => null),
        api.inventoryMovements().catch(() => [] as InventoryMovement[]),
      ]);
      setCenters(centerList as CollectionCenter[]);
      setMaterials(materialList as Material[]);
      setSummary(summaryData);
      setMovements(movementList as InventoryMovement[]);
      setLastRefresh(new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    } catch {
      setError("No se pudo cargar el inventario.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, 15000);
    return () => window.clearInterval(timer);
  }, []);

  const balances = summary?.balances ?? [];
  const filteredBalances = useMemo(() => {
    const q = search.trim().toLowerCase();
    return balances.filter((row) => {
      const matchesSearch = !q || row.collection_center_name.toLowerCase().includes(q) || row.material_name.toLowerCase().includes(q);
      const matchesScope =
        scopeFilter === "all"
          || (scopeFilter === "raw" && !row.material_is_processed)
          || (scopeFilter === "processed" && row.material_is_processed);
      const matchesCenter = !centerFilter || row.collection_center_id === centerFilter;
      return matchesSearch && matchesScope && matchesCenter;
    });
  }, [balances, centerFilter, scopeFilter, search]);

  const filteredMovements = useMemo(() => {
    const q = search.trim().toLowerCase();
    return movements.filter((row) => {
      const matchesSearch = !q
        || (row.collection_center_name ?? "").toLowerCase().includes(q)
        || (row.material_name ?? "").toLowerCase().includes(q)
        || (row.lot_code ?? "").toLowerCase().includes(q)
        || (row.notes ?? "").toLowerCase().includes(q)
        || (row.movement_type_label ?? row.movement_type).toLowerCase().includes(q);
      const matchesScope =
        scopeFilter === "all"
        || (scopeFilter === "raw" && !row.material_is_processed)
        || (scopeFilter === "processed" && row.material_is_processed);
      const matchesCenter = !centerFilter || row.collection_center === centerFilter;
      return matchesSearch && matchesScope && matchesCenter;
    });
  }, [centerFilter, movements, scopeFilter, search]);

  const selectedCenter = centers.find((item) => item.id === form.collection_center) ?? null;
  const selectedMaterial = materials.find((item) => item.id === form.material) ?? null;
  const quantityValue = Number.parseFloat(form.quantity_kg || "0") || 0;
  const signedQuantity = form.direction === "decrease" ? -Math.abs(quantityValue) : Math.abs(quantityValue);

  async function submitAdjust(event: FormEvent) {
    event.preventDefault();
    if (!canManageInventory) {
      setMessage("No tienes permiso para ajustar inventarios.");
      return;
    }
    if (!form.collection_center || !form.material) {
      setMessage("Selecciona centro y material.");
      return;
    }
    if (!form.quantity_kg || quantityValue <= 0) {
      setMessage("La cantidad debe ser mayor a cero.");
      return;
    }
    setAdjusting(true);
    setMessage(null);
    try {
      await api.inventoryAdjust({
        collection_center: form.collection_center,
        material: form.material,
        delta_kg: signedQuantity.toFixed(3),
        unit_price: form.unit_price || "0",
        notes: form.notes,
      });
      setMessage("Ajuste aplicado correctamente.");
      setForm((prev) => ({ ...prev, quantity_kg: "", unit_price: "", notes: "" }));
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No se pudo aplicar el ajuste.");
    } finally {
      setAdjusting(false);
    }
  }

  return (
    <Page title="Inventarios">
      <div className="page-header">
        <div>
          <h2 style={{ margin: 0 }}>Inventarios</h2>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: "0.82rem" }}>
            Saldo automatico por movimientos, ajustes auditados y control por centro.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="search"
            placeholder="Buscar centro o material"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 240 }}
          />
          <select value={scopeFilter} onChange={(e) => setScopeFilter(e.target.value as typeof scopeFilter)}>
            <option value="all">Todo el inventario</option>
            <option value="raw">Material crudo</option>
            <option value="processed">Material procesado</option>
          </select>
          <select value={centerFilter} onChange={(e) => setCenterFilter(e.target.value)} style={{ minWidth: 220 }}>
            <option value="">Todos los centros</option>
            {centers.map((center) => (
              <option key={center.id} value={center.id}>{center.name}</option>
            ))}
          </select>
          <button className="btn-secondary" onClick={refresh} disabled={loading}>
            {loading ? "Actualizando..." : "Actualizar"}
          </button>
          {lastRefresh && <span className="badge badge-gray">Ultima actualizacion {lastRefresh}</span>}
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {message && <div className="info-banner">{message}</div>}

      <div className="kpi-grid" style={{ marginBottom: 16 }}>
        <MetricCard label="Saldo total" value={fmtKg(summary?.totals.stock_kg ?? "0") + " kg"} accent />
        <MetricCard label="Movimientos" value={String(summary?.totals.movements_count ?? 0)} />
        <MetricCard label="Ajustes" value={String(summary?.totals.adjustment_count ?? 0)} amber />
        <MetricCard label="Balances negativos" value={String(summary?.totals.negative_balances ?? 0)} blue />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 16, alignItems: "start" }}>
        <section className="section-panel">
          <div className="section-panel-header">
            <h3>Resumen por material</h3>
            <span className="badge badge-blue">Actualizacion cada 15 s</span>
          </div>
          <div className="section-panel-body" style={{ display: "grid", gap: 12 }}>
            {filteredBalances.length === 0 ? (
              <div className="muted" style={{ padding: "12px 0" }}>
                No hay balances para mostrar.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Centro</th>
                      <th>Material</th>
                      <th>Entrada</th>
                      <th>Salida</th>
                      <th>Ajuste</th>
                      <th>Saldo</th>
                      <th>Ultimo mov.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBalances.map((row) => (
                      <tr key={`${row.collection_center_id}-${row.material_id}`}>
                        <td>{row.collection_center_name}</td>
                        <td style={{ fontWeight: 600 }}>{row.material_name}</td>
                        <td>{fmtKg(row.inbound_kg)}</td>
                        <td>{fmtKg(row.outbound_kg)}</td>
                        <td>{fmtKg(row.adjustment_kg)}</td>
                        <td style={{ fontWeight: 700, color: Number(row.balance_kg) < 0 ? "var(--danger)" : "var(--text)" }}>
                          {fmtKg(row.balance_kg)}
                        </td>
                        <td>{formatDateTime(row.last_movement_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <section className="section-panel">
          <div className="section-panel-header">
            <h3>Ajuste de inventario</h3>
          </div>
          <form className="section-panel-body" onSubmit={submitAdjust} style={{ display: "grid", gap: 12 }}>
            <label>
              Centro de acopio
              <select value={form.collection_center} onChange={(e) => setForm((prev) => ({ ...prev, collection_center: e.target.value }))}>
                <option value="">Seleccionar...</option>
                {centers.map((center) => (
                  <option key={center.id} value={center.id}>
                    {center.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Material
              <select value={form.material} onChange={(e) => setForm((prev) => ({ ...prev, material: e.target.value }))}>
                <option value="">Seleccionar...</option>
                {materials.map((material) => (
                  <option key={material.id} value={material.id}>
                    {material.name}
                  </option>
                ))}
              </select>
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label>
                Tipo
                <select value={form.direction} onChange={(e) => setForm((prev) => ({ ...prev, direction: e.target.value as AdjustForm["direction"] }))}>
                  <option value="increase">Aumentar</option>
                  <option value="decrease">Disminuir</option>
                </select>
              </label>
              <label>
                Cantidad (kg)
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={form.quantity_kg}
                  onChange={(e) => setForm((prev) => ({ ...prev, quantity_kg: e.target.value }))}
                />
              </label>
            </div>
            <label>
              Precio unitario
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.unit_price}
                onChange={(e) => setForm((prev) => ({ ...prev, unit_price: e.target.value }))}
              />
            </label>
            <label>
              Observaciones
              <textarea
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                rows={4}
                placeholder="Motivo del ajuste y referencia de auditoria."
              />
            </label>
            <div className="info-banner" style={{ display: "grid", gap: 4 }}>
              <strong>Vista previa</strong>
              <span>Centro: {selectedCenter?.name ?? "—"}</span>
              <span>Material: {selectedMaterial?.name ?? "—"}</span>
              <span>Ajuste: {signedQuantity >= 0 ? "+" : ""}{fmtKg(signedQuantity)} kg</span>
              <span>Importe: {fmtMoney(signedQuantity * (Number.parseFloat(form.unit_price || "0") || 0))}</span>
            </div>
            <button className="btn-primary" type="submit" disabled={!canManageInventory || adjusting || !form.collection_center || !form.material}>
              {adjusting ? "Aplicando..." : "Aplicar ajuste"}
            </button>
          </form>
        </section>
      </div>

      <section className="section-panel" style={{ marginTop: 16 }}>
        <div className="section-panel-header">
          <h3>Movimientos recientes</h3>
          <span className="badge badge-gray">{filteredMovements.length} registros</span>
        </div>
        <div className="section-panel-body">
          {filteredMovements.length === 0 ? (
            <div className="muted" style={{ padding: "12px 0" }}>
              No hay movimientos recientes.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="table">
                <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Centro</th>
                      <th>Material</th>
                      <th>Lote</th>
                      <th>Tipo</th>
                      <th>Cantidad</th>
                      <th>Importe</th>
                      <th>Usuario</th>
                      <th>Nota</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMovements.slice(0, 80).map((movement) => (
                    <tr key={movement.id}>
                      <td>{formatDateTime(movement.occurred_at)}</td>
                      <td>{movement.collection_center_name ?? movement.collection_center}</td>
                      <td style={{ fontWeight: 600 }}>{movement.material_name ?? movement.material}</td>
                      <td>{movement.lot_code ?? "—"}</td>
                      <td>
                        <span className={`badge ${movement.movement_type === "outbound" || movement.movement_type.endsWith("_out") ? "badge-amber" : movement.movement_type.includes("adjustment") ? "badge-blue" : "badge-green"}`}>
                          {movement.movement_type_label ?? movement.movement_type}
                        </span>
                      </td>
                      <td>{fmtKg(movement.quantity_kg)}</td>
                      <td>{fmtMoney(movement.amount)}</td>
                      <td>{movement.created_by_name ?? "—"}</td>
                      <td style={{ maxWidth: 260, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {movement.notes ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </Page>
  );
}

function MetricCard({
  label,
  value,
  accent,
  amber,
  blue,
}: {
  label: string;
  value: string;
  accent?: boolean;
  amber?: boolean;
  blue?: boolean;
}) {
  const cls = `card${accent ? " card-accent" : amber ? " card-amber" : blue ? " card-blue" : ""}`;
  return (
    <div className={cls}>
      <div className="card-label">{label}</div>
      <div className="card-value">{value}</div>
    </div>
  );
}
