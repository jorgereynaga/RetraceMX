import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/resources";
import { Page } from "../components/Page";
import type { CollectionCenter, Device, Material, MaterialFamily, Party, PriceSuggestion, PurchaseOperation, TicketItem, Vehicle } from "../types";

type LiveReading = {
  weight_kg: string;
  is_stable: boolean;
  is_manual_fallback: boolean;
  raw_value: string;
  captured_at: string;
};

type WeighStep = "idle" | "gross" | "tare" | "done";

const POLL_MS = 1800;

const MERMA_PCT = 0.03;

function fmtKg(v: number) {
  return v.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtMXN(v: number) {
  return "$" + v.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function PurchasePage() {
  const [centers, setCenters] = useState<CollectionCenter[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [families, setFamilies] = useState<MaterialFamily[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);

  const [centerId, setCenterId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [operation, setOperation] = useState<PurchaseOperation | null>(null);
  const [opLoading, setOpLoading] = useState(false);
  const [opError, setOpError] = useState<string | null>(null);

  const [familyFilter, setFamilyFilter] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [method, setMethod] = useState<TicketItem["method"]>("vehicle_differential");
  const [unitPrice, setUnitPrice] = useState("0");
  const [priceSuggestion, setPriceSuggestion] = useState<PriceSuggestion | null>(null);
  const [mermaKg, setMermaKg] = useState("");

  const [grossKg, setGrossKg] = useState("");
  const [tareKg, setTareKg] = useState("");
  const [manualGross, setManualGross] = useState("");
  const [manualTare, setManualTare] = useState("");
  const [weighStep, setWeighStep] = useState<WeighStep>("idle");

  const [liveReading, setLiveReading] = useState<LiveReading | null>(null);
  const [autoRead, setAutoRead] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [items, setItems] = useState<TicketItem[]>([]);
  const [itemLoading, setItemLoading] = useState(false);
  const [itemMsg, setItemMsg] = useState<string | null>(null);

  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [printMsg, setPrintMsg] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.centers().then(setCenters),
      api.parties().then(setParties),
      api.materials().then(setMaterials),
      api.materialFamilies().then(setFamilies),
      api.vehicles().then(setVehicles),
      api.devices().then(setDevices),
    ]).catch(() => {});
  }, []);

  useEffect(() => {
    const collectionCenters = centers.filter((c) => c.kind === "collection");
    if (collectionCenters.length === 1 && !centerId) setCenterId(collectionCenters[0].id);
  }, [centers]);

  const collectionCenters = useMemo(() => centers.filter((c) => c.kind === "collection"), [centers]);
  const center = useMemo(() => centers.find((c) => c.id === centerId), [centers, centerId]);

  const scaleDevice = useMemo(() => {
    const kind = method === "vehicle_differential" ? "vehicle_scale" : "secondary_scale";
    return devices.find((d) => d.kind === kind && (d.collection_center === centerId || !d.collection_center))
      ?? devices.find((d) => d.kind === kind)
      ?? null;
  }, [devices, method, centerId]);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!autoRead || !scaleDevice) return;
    const poll = async () => {
      try {
        const r = await api.deviceSimulateScale(scaleDevice.id);
        setLiveReading(r);
      } catch { }
    };
    poll();
    pollRef.current = setInterval(poll, POLL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [autoRead, scaleDevice?.id]);

  const priceLookupSeq = useRef(0);
  useEffect(() => {
    if (!centerId || !materialId) {
      setPriceSuggestion(null);
      return;
    }
    const seq = ++priceLookupSeq.current;
    api.priceSuggestion(centerId, materialId).then((s) => {
      if (seq !== priceLookupSeq.current) return;
      setPriceSuggestion(s);
      setUnitPrice(s.unit_price ?? "0");
    }).catch(() => {
      if (seq !== priceLookupSeq.current) return;
      setPriceSuggestion(null);
    });
  }, [centerId, materialId]);

  const filteredMaterials = useMemo(() => {
    if (!familyFilter) return materials;
    return materials.filter((m) => m.family === familyFilter);
  }, [materials, familyFilter]);

  const familyById = useMemo(() => new Map(families.map((f) => [f.id, f.name])), [families]);
  const materialById = useMemo(() => new Map(materials.map((m) => [m.id, m])), [materials]);

  const grossNum = parseFloat(method !== "manual_contingency" ? (grossKg || "0") : (manualGross || "0")) || 0;
  const tareNum = parseFloat(method === "vehicle_differential" ? (tareKg || "0") : (manualTare || "0")) || 0;
  const netRaw = Math.max(0, grossNum - tareNum);
  const mermaNum = parseFloat(mermaKg) || netRaw * MERMA_PCT;
  const netClean = Math.max(0, netRaw - mermaNum);
  const priceNum = parseFloat(unitPrice) || 0;
  const amount = netClean * priceNum;

  const canCapture = !!customerId && !!materialId && !!scaleDevice && method !== "manual_contingency";
  const weighOk =
    method === "manual_contingency"
      ? !!manualGross
      : method === "vehicle_differential"
      ? !!grossKg && !!tareKg
      : !!grossKg;
  const canAddItem = !!operation && !!materialId && weighOk && netClean > 0;

  function captureReading(slot: "gross" | "tare") {
    if (!liveReading) return;
    if (!liveReading.is_stable) { setItemMsg("Espera a que la lectura se estabilice."); return; }
    if (slot === "gross") { setGrossKg(liveReading.weight_kg); setWeighStep("tare"); }
    else { setTareKg(liveReading.weight_kg); setWeighStep("done"); }
    setItemMsg(null);
  }

  function captureDirectReading() {
    if (!liveReading) return;
    if (!liveReading.is_stable) { setItemMsg("Espera lectura estable."); return; }
    setGrossKg(liveReading.weight_kg);
    setWeighStep("done");
    setItemMsg(null);
  }

  async function openOperation() {
    if (!centerId || !customerId) { setOpError("Selecciona centro y cliente."); return; }
    setOpLoading(true); setOpError(null);
    try {
      const op = await api.operationCreate({
        collection_center: centerId,
        customer: customerId,
        vehicle: vehicleId || null,
      });
      setOperation(op);
      setItems([]);
      setConfirmed(false);
      setPrintMsg(null);
      resetWeigh();
    } catch (e) {
      setOpError(e instanceof Error ? e.message : "Error al crear la operación.");
    } finally {
      setOpLoading(false);
    }
  }

  function resetWeigh() {
    setGrossKg(""); setTareKg(""); setManualGross(""); setManualTare("");
    setMermaKg(""); setWeighStep("idle"); setLiveReading(null); setAutoRead(false);
    setItemMsg(null);
  }

  async function addItem() {
    if (!operation || !canAddItem) return;
    setItemLoading(true); setItemMsg(null);
    try {
      const gross = method === "manual_contingency" ? manualGross : grossKg;
      const tare = method === "vehicle_differential" ? tareKg : (method === "manual_contingency" ? (manualTare || "0") : "0");
      const item = await api.createTicketItem({
        operation: operation.id,
        material: materialId,
        method,
        gross_weight_kg: gross,
        tare_weight_kg: tare,
        merma_kg: mermaNum.toFixed(3),
        unit_price: unitPrice,
        notes: "",
      });
      setItems((prev) => [...prev, item]);
      const refreshed = await api.operationDetail(operation.id);
      setOperation(refreshed);
      resetWeigh();
      setItemMsg("Partida registrada correctamente.");
    } catch (e) {
      setItemMsg(e instanceof Error ? e.message : "Error al guardar la partida.");
    } finally {
      setItemLoading(false);
    }
  }

  async function confirmOp() {
    if (!operation) return;
    setConfirming(true);
    try {
      await api.operationStatusChange(operation.id, "confirmed", "Confirmación desde módulo de compra");
      const refreshed = await api.operationDetail(operation.id);
      setOperation(refreshed);
      setConfirmed(true);
    } catch (e) {
      setItemMsg(e instanceof Error ? e.message : "Error al confirmar.");
    } finally {
      setConfirming(false);
    }
  }

  async function printTicket() {
    if (!operation) return;
    try {
      await api.operationPrint(operation.id, {
        folio: operation.folio,
        operation_id: operation.id,
        items,
        totals: { total_weight_kg: operation.total_weight_kg, total_amount: operation.total_amount },
      });
      setPrintMsg("Ticket enviado a impresión. ✓");
    } catch (e) {
      setPrintMsg(e instanceof Error ? e.message : "Error al imprimir.");
    }
  }

  function startNew() {
    setOperation(null); setItems([]);
    setConfirmed(false); setPrintMsg(null);
    setCustomerId(""); setVehicleId("");
    resetWeigh();
    setMaterialId(""); setFamilyFilter("");
  }

  const isDisconnected = liveReading?.raw_value === "DISCONNECTED";
  const isStable = liveReading?.is_stable && !isDisconnected;
  const displayWeight = liveReading && !isDisconnected ? parseFloat(liveReading.weight_kg) : null;
  const totalWeight = parseFloat(operation?.total_weight_kg ?? "0") || 0;
  const totalAmount = parseFloat(operation?.total_amount ?? "0") || 0;

  return (
    <Page title="Compra de materiales">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>

        {/* ── LEFT COLUMN ────────────────────── */}
        <div style={{ display: "grid", gap: 16 }}>

          {/* Step 1: Operation setup */}
          <div className="section-panel">
            <div className="section-panel-header">
              <h3>① Datos de la compra</h3>
              {operation && (
                <span className="badge badge-green">Folio: {operation.folio}</span>
              )}
            </div>
            <div className="section-panel-body" style={{ display: "grid", gap: 12 }}>
              {collectionCenters.length > 1 && (
                <label>
                  Centro de acopio
                  <select value={centerId} onChange={(e) => setCenterId(e.target.value)} disabled={!!operation}>
                    <option value="">Seleccionar…</option>
                    {collectionCenters.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </label>
              )}
              {center && collectionCenters.length <= 1 && (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span className="badge badge-blue">🏭 {center.name}</span>
                </div>
              )}
              <label>
                Cliente / Proveedor <span style={{ color: "var(--danger)" }}>*</span>
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  disabled={!!operation}
                  style={{ borderColor: !customerId ? "rgba(239,68,68,0.5)" : undefined }}
                >
                  <option value="">— Seleccionar cliente —</option>
                  {parties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.trade_name || p.legal_name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Vehículo (opcional)
                <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} disabled={!!operation}>
                  <option value="">Sin vehículo</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>{v.plate_number} — {v.label}</option>
                  ))}
                </select>
              </label>
              {opError && <div className="error-banner">{opError}</div>}
              {!operation ? (
                <button
                  className="btn-primary"
                  style={{ marginTop: 4 }}
                  onClick={openOperation}
                  disabled={opLoading || !customerId || !centerId}
                >
                  {opLoading ? "Abriendo…" : "▶ Iniciar compra"}
                </button>
              ) : (
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span className={`badge ${confirmed ? "badge-green" : "badge-amber"}`}>
                    {confirmed ? "Operación confirmada ✓" : `Estado: ${operation.status}`}
                  </span>
                  {!confirmed && (
                    <button className="btn-ghost" onClick={startNew}>
                      Nueva compra
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Step 2: Weighing */}
          <div className="section-panel" style={{ opacity: !operation ? 0.5 : 1, pointerEvents: !operation ? "none" : undefined }}>
            <div className="section-panel-header">
              <h3>② Pesaje y captura</h3>
              {scaleDevice && (
                <span className="badge badge-gray" style={{ fontSize: "0.7rem" }}>
                  {scaleDevice.name}
                </span>
              )}
            </div>
            <div className="section-panel-body" style={{ display: "grid", gap: 14 }}>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label>
                  Familia
                  <select value={familyFilter} onChange={(e) => { setFamilyFilter(e.target.value); setMaterialId(""); }}>
                    <option value="">Todas</option>
                    {families.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Material <span style={{ color: "var(--danger)" }}>*</span>
                  <select
                    value={materialId}
                    onChange={(e) => setMaterialId(e.target.value)}
                    style={{ borderColor: !materialId ? "rgba(239,68,68,0.5)" : undefined }}
                  >
                    <option value="">— Seleccionar —</option>
                    {filteredMaterials.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label>
                  Método de pesaje
                  <select value={method} onChange={(e) => { setMethod(e.target.value as TicketItem["method"]); resetWeigh(); }}>
                    <option value="vehicle_differential">⚖ Diferencia vehicular</option>
                    <option value="secondary_direct">🏋 Báscula directa</option>
                    <option value="manual_contingency">✏ Manual / contingencia</option>
                  </select>
                </label>
                <label>
                  Precio unitario ($/kg)
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input
                      type="number"
                      value={unitPrice}
                      min={0}
                      step={0.01}
                      onChange={(e) => setUnitPrice(e.target.value)}
                    />
                    {priceSuggestion?.found && (
                      <span className="badge badge-green" style={{ whiteSpace: "nowrap" }}>Lista ✓</span>
                    )}
                  </div>
                </label>
              </div>

              {/* Scale display */}
              {method !== "manual_contingency" && (
                <div>
                  <div className="scale-display">
                    <div className={`scale-weight ${!isStable ? (isDisconnected ? "disconnected" : "unstable") : ""}`}>
                      {displayWeight != null
                        ? displayWeight.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        : "— — —"}
                    </div>
                    <div className="scale-unit">
                      {scaleDevice?.kind === "vehicle_scale" ? "kg (vehicular)" : "kg"}
                    </div>
                    <div className="scale-status-row">
                      <div className={`scale-dot ${!liveReading ? "disconnected" : isDisconnected ? "disconnected" : isStable ? "stable" : "unstable"}`} />
                      <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
                        {!liveReading ? "Sin lectura" : isDisconnected ? "Desconectada" : isStable ? "Estable ✓" : "Oscilando…"}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                    {!canCapture && (
                      <div className="info-banner" style={{ flex: 1, fontSize: "0.8rem" }}>
                        Selecciona cliente y material para habilitar la báscula.
                      </div>
                    )}
                    {canCapture && (
                      <>
                        <button
                          className={autoRead ? "btn-danger" : "btn-secondary"}
                          style={{ flex: 1 }}
                          onClick={() => setAutoRead((v) => !v)}
                        >
                          {autoRead ? "⏹ Pausar báscula" : "▶ Leer báscula"}
                        </button>
                        {method === "vehicle_differential" && (
                          <>
                            <button
                              className={weighStep === "idle" || weighStep === "tare" ? "btn-primary" : "btn-secondary"}
                              style={{ flex: 1 }}
                              disabled={!isStable || weighStep === "done"}
                              onClick={() => captureReading(weighStep === "tare" ? "tare" : "gross")}
                              title={weighStep === "tare" ? "Capturar peso tara (camión vacío)" : "Capturar peso bruto (camión cargado)"}
                            >
                              {weighStep === "tare" ? "⬇ Capturar tara" : "⬆ Capturar bruto"}
                            </button>
                            {weighStep !== "idle" && (
                              <button className="btn-ghost" onClick={() => { setWeighStep("idle"); setGrossKg(""); setTareKg(""); }}>
                                ↺
                              </button>
                            )}
                          </>
                        )}
                        {method === "secondary_direct" && (
                          <button
                            className="btn-primary"
                            style={{ flex: 1 }}
                            disabled={!isStable}
                            onClick={captureDirectReading}
                          >
                            ✓ Capturar lectura
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Differential step indicator */}
              {method === "vehicle_differential" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div style={{
                    padding: "10px 14px", borderRadius: "var(--radius-sm)",
                    background: weighStep === "idle" || weighStep === "gross" ? "var(--accent-dim)" : "var(--panel-2)",
                    border: `1px solid ${weighStep === "idle" || weighStep === "gross" ? "rgba(34,197,94,0.3)" : "var(--border)"}`,
                  }}>
                    <div style={{ fontSize: "0.7rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Paso 1 — Bruto</div>
                    <div style={{ fontSize: "1.2rem", fontWeight: 700, color: grossKg ? "var(--text)" : "var(--muted)", marginTop: 4 }}>
                      {grossKg ? `${fmtKg(parseFloat(grossKg))} kg` : "Pendiente"}
                    </div>
                    {!grossKg && <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: 2 }}>Camión cargado</div>}
                  </div>
                  <div style={{
                    padding: "10px 14px", borderRadius: "var(--radius-sm)",
                    background: weighStep === "tare" ? "var(--accent-dim)" : "var(--panel-2)",
                    border: `1px solid ${weighStep === "tare" ? "rgba(34,197,94,0.3)" : "var(--border)"}`,
                  }}>
                    <div style={{ fontSize: "0.7rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Paso 2 — Tara</div>
                    <div style={{ fontSize: "1.2rem", fontWeight: 700, color: tareKg ? "var(--text)" : "var(--muted)", marginTop: 4 }}>
                      {tareKg ? `${fmtKg(parseFloat(tareKg))} kg` : "Pendiente"}
                    </div>
                    {!tareKg && <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: 2 }}>Camión vacío</div>}
                  </div>
                </div>
              )}

              {/* Manual contingency inputs */}
              {method === "manual_contingency" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <label>
                    Peso bruto (kg)
                    <input type="number" value={manualGross} onChange={(e) => setManualGross(e.target.value)} placeholder="ej. 450" />
                  </label>
                  <label>
                    Tara (kg)
                    <input type="number" value={manualTare} onChange={(e) => setManualTare(e.target.value)} placeholder="0" />
                  </label>
                </div>
              )}

              {/* Net weight calculation */}
              {netClean > 0 && (
                <div style={{
                  padding: "14px 16px", borderRadius: "var(--radius-sm)",
                  background: "rgba(34,197,94,0.08)",
                  border: "1px solid rgba(34,197,94,0.2)",
                  display: "grid", gap: 6,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}>
                    <span style={{ color: "var(--muted)" }}>Bruto</span>
                    <span>{fmtKg(grossNum)} kg</span>
                  </div>
                  {(method === "vehicle_differential" || (method === "manual_contingency" && tareNum > 0)) && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}>
                      <span style={{ color: "var(--muted)" }}>Tara</span>
                      <span>− {fmtKg(tareNum)} kg</span>
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}>
                    <label style={{ textTransform: "none", display: "flex", gap: 8, alignItems: "center", color: "var(--muted)" }}>
                      Merma (%)
                      <input
                        type="number"
                        value={mermaKg || mermaNum.toFixed(3)}
                        min={0}
                        step={0.001}
                        onChange={(e) => setMermaKg(e.target.value)}
                        style={{ width: 80, padding: "4px 8px", fontSize: "0.8rem" }}
                      />
                    </label>
                    <span>− {fmtKg(mermaNum)} kg</span>
                  </div>
                  <div style={{ borderTop: "1px solid rgba(34,197,94,0.2)", paddingTop: 8, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--accent)" }}>Peso neto</span>
                    <span style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--accent)", letterSpacing: "-0.03em" }}>
                      {fmtKg(netClean)} kg
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", fontWeight: 600 }}>
                    <span style={{ color: "var(--muted)" }}>Precio × neto</span>
                    <span style={{ color: "var(--accent-2)" }}>{fmtMXN(amount)}</span>
                  </div>
                </div>
              )}

              {itemMsg && (
                <div className={itemMsg.includes("Error") || itemMsg.includes("error") ? "error-banner" : "info-banner"}>
                  {itemMsg}
                </div>
              )}

              <button
                className="btn-primary"
                disabled={!canAddItem || itemLoading || confirmed}
                onClick={addItem}
                style={{ fontSize: "1rem", padding: "12px" }}
              >
                {itemLoading ? "Guardando…" : `+ Agregar partida${netClean > 0 ? ` — ${fmtKg(netClean)} kg · ${fmtMXN(amount)}` : ""}`}
              </button>

            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN ────────────────────── */}
        <div style={{ display: "grid", gap: 16 }}>

          {/* Items table */}
          <div className="section-panel">
            <div className="section-panel-header">
              <h3>③ Partidas registradas</h3>
              <span className="badge badge-gray">{items.length} partida{items.length !== 1 ? "s" : ""}</span>
            </div>
            {items.length === 0 ? (
              <div style={{ padding: "24px 20px", textAlign: "center" }}>
                <div style={{ fontSize: "2rem", marginBottom: 8 }}>⚖</div>
                <p className="muted" style={{ margin: 0 }}>
                  {!operation
                    ? "Inicia una compra para registrar partidas."
                    : "Aún no hay partidas. Captura el peso de los materiales."}
                </p>
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Material</th>
                    <th>Método</th>
                    <th>Neto (kg)</th>
                    <th>Precio</th>
                    <th>Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 500, color: "var(--text)" }}>
                        {materialById.get(item.material)?.name ?? item.material}
                      </td>
                      <td>
                        <span className="badge badge-gray" style={{ fontSize: "0.68rem" }}>
                          {item.method === "vehicle_differential" ? "Diferencial" : item.method === "secondary_direct" ? "Directo" : "Manual"}
                        </span>
                      </td>
                      <td style={{ fontVariantNumeric: "tabular-nums" }}>
                        {fmtKg(parseFloat(item.net_weight_kg))}
                      </td>
                      <td style={{ color: "var(--muted)" }}>
                        {fmtMXN(parseFloat(item.unit_price))}
                      </td>
                      <td style={{ fontWeight: 700, color: "var(--accent-2)" }}>
                        {fmtMXN(parseFloat(item.amount))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {items.length > 0 && (
              <div style={{ padding: "14px 20px", borderTop: "1px solid var(--border)", background: "var(--panel-2)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
                    {items.length} partida{items.length !== 1 ? "s" : ""} · {fmtKg(totalWeight)} kg
                  </span>
                  <span style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--accent-2)" }}>
                    {fmtMXN(totalAmount)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Confirm & Print */}
          {operation && items.length > 0 && (
            <div className="section-panel">
              <div className="section-panel-header">
                <h3>④ Cerrar compra</h3>
              </div>
              <div className="section-panel-body" style={{ display: "grid", gap: 10 }}>
                {printMsg && (
                  <div className={printMsg.includes("Error") ? "error-banner" : "info-banner"}>
                    {printMsg}
                  </div>
                )}
                {confirmed ? (
                  <>
                    <div className="info-banner">
                      Compra confirmada. Folio: <strong>{operation.folio}</strong>
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                      <button className="btn-primary" style={{ flex: 1 }} onClick={printTicket}>
                        🖨 Imprimir ticket
                      </button>
                      <button className="btn-secondary" style={{ flex: 1 }} onClick={startNew}>
                        Nueva compra
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
                      Revisa las partidas antes de confirmar. Una vez confirmada no se pueden agregar más partidas sin ajuste auditado.
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                      <button className="btn-primary" style={{ flex: 1 }} onClick={confirmOp} disabled={confirming}>
                        {confirming ? "Confirmando…" : "✓ Confirmar compra"}
                      </button>
                      <button className="btn-secondary" onClick={printTicket}>
                        🖨 Ticket provisional
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Help */}
          {!operation && (
            <div className="section-panel">
              <div className="section-panel-header"><h3>Cómo usar</h3></div>
              <div className="section-panel-body" style={{ display: "grid", gap: 8, fontSize: "0.82rem", color: "var(--muted)" }}>
                <p style={{ margin: 0 }}><strong style={{ color: "var(--text-soft)" }}>①</strong> Selecciona el cliente y opcionalmente el vehículo, luego presiona <strong style={{ color: "var(--text-soft)" }}>Iniciar compra</strong>.</p>
                <p style={{ margin: 0 }}><strong style={{ color: "var(--text-soft)" }}>②</strong> Elige el <strong style={{ color: "var(--text-soft)" }}>material</strong> y el <strong style={{ color: "var(--text-soft)" }}>método</strong>. La báscula se habilita automáticamente.</p>
                <p style={{ margin: 0 }}><strong style={{ color: "var(--text-soft)" }}>③</strong> Activa la báscula con <strong style={{ color: "var(--text-soft)" }}>▶ Leer báscula</strong> y captura la lectura estable.</p>
                <p style={{ margin: 0 }}><strong style={{ color: "var(--text-soft)" }}>④</strong> Presiona <strong style={{ color: "var(--text-soft)" }}>+ Agregar partida</strong> por cada tipo de material. Repite para todos los materiales.</p>
                <p style={{ margin: 0 }}><strong style={{ color: "var(--text-soft)" }}>⑤</strong> Confirma la compra e imprime el ticket.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Page>
  );
}
