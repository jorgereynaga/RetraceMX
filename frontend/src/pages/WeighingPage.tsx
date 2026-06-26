import { useEffect, useRef, useState, useCallback } from "react";
import { api } from "../api/resources";
import { Page } from "../components/Page";
import type { Device, ScaleReading as ScaleReadingRecord } from "../types";

type LiveReading = {
  device_id: string;
  device_name: string;
  kind: string;
  raw_value: string;
  weight_kg: string;
  is_stable: boolean;
  is_manual_fallback: boolean;
  captured_at: string;
};

type WeighMode = "differential" | "direct";
type Step = "gross" | "tare" | "done";

const POLL_MS = 1800;

export function WeighingPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [reading, setReading] = useState<LiveReading | null>(null);
  const [loadingRead, setLoadingRead] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const [autoRead, setAutoRead] = useState(false);
  const [readCount, setReadCount] = useState(0);

  const [mode, setMode] = useState<WeighMode>("differential");
  const [grossKg, setGrossKg] = useState("");
  const [tareKg, setTareKg] = useState("");
  const [manualGross, setManualGross] = useState("");
  const [manualTare, setManualTare] = useState("");
  const [step, setStep] = useState<Step>("gross");
  const [confirmed, setConfirmed] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    api.devices().then((devs) => {
      const scales = devs.filter(
        (d) => d.kind === "vehicle_scale" || d.kind === "secondary_scale"
      );
      setDevices(scales);
      if (scales.length > 0) setSelectedId(scales[0].id);
    });
  }, []);

  const fetchReading = useCallback(async (id: string, silent = false) => {
    if (!id) return null;
    if (!silent) setLoadingRead(true);
    setReadError(null);
    try {
      const bridgeDevice = devices.find((d) => d.id === id);
      const bridgeMode = Boolean(
        bridgeDevice?.metadata &&
          typeof bridgeDevice.metadata === "object" &&
          (bridgeDevice.metadata as Record<string, unknown>).bridge_mode,
      );
      if (bridgeMode) {
        const latest = (await api.scaleReadingsByDevice(id))[0] as ScaleReadingRecord | undefined;
        const live = latest
          ? {
              device_id: latest.device,
              device_name: bridgeDevice?.name ?? "Báscula",
              kind: bridgeDevice?.kind ?? "secondary_scale",
              raw_value: latest.raw_value ?? "",
              weight_kg: latest.net_weight_kg ?? latest.gross_weight_kg ?? latest.tare_weight_kg ?? "0",
              is_stable: latest.is_stable ?? true,
              is_manual_fallback: bridgeDevice?.is_manual_fallback ?? false,
              captured_at: latest.captured_at ?? new Date().toISOString(),
            }
          : null;
        setReading(live);
        setReadCount((c) => c + 1);
        return live;
      }
      const r = await api.deviceReadScale(id);
      const live = {
        device_id: r.device_id,
        device_name: r.device_name,
        kind: r.kind,
        raw_value: r.raw_value,
        weight_kg: r.weight_kg,
        is_stable: r.is_stable,
        is_manual_fallback: r.is_manual_fallback,
        captured_at: r.captured_at,
      };
      setReading(live);
      setReadCount((c) => c + 1);
      return live;
    } catch {
      if (!silent) setReadError("Error al leer la báscula. Verifique la conexión o use entrada manual.");
      return null;
    } finally {
      if (!silent) setLoadingRead(false);
    }
  }, [devices]);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (autoRead && selectedId && step !== "done") {
      pollRef.current = setInterval(() => {
        fetchReading(selectedId, true);
      }, POLL_MS);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [autoRead, selectedId, step, fetchReading]);

  const stopAutoRead = () => {
    setAutoRead(false);
    if (pollRef.current) clearInterval(pollRef.current);
  };

  const captureCurrentReading = () => {
    if (!reading) return;
    if (mode === "differential") {
      if (step === "gross") {
        setGrossKg(reading.weight_kg);
        stopAutoRead();
      } else if (step === "tare") {
        setTareKg(reading.weight_kg);
        stopAutoRead();
      }
    } else {
      setManualGross(reading.weight_kg);
      stopAutoRead();
    }
  };

  const manualCapture = async () => {
    const r = await fetchReading(selectedId);
    if (r) {
      if (mode === "differential") {
        if (step === "gross") setGrossKg(r.weight_kg);
        else if (step === "tare") setTareKg(r.weight_kg);
      } else {
        setManualGross(r.weight_kg);
      }
    }
  };

  const selectedDevice = devices.find((d) => d.id === selectedId);

  const grossNum = parseFloat(mode === "differential" ? grossKg : manualGross) || 0;
  const tareNum = parseFloat(mode === "differential" ? tareKg : manualTare) || 0;
  const netKg = Math.max(0, grossNum - tareNum);
  const mermaKg = netKg * 0.03;
  const netClean = Math.max(0, netKg - mermaKg);

  function resetAll() {
    setReading(null);
    setGrossKg("");
    setTareKg("");
    setManualGross("");
    setManualTare("");
    setStep("gross");
    setReadError(null);
    setConfirmed(false);
    stopAutoRead();
  }

  const displayWeight = reading ? parseFloat(reading.weight_kg) : null;
  const isStable = reading?.is_stable ?? false;
  const isDisconnected = reading?.raw_value === "DISCONNECTED";

  function dotClass() {
    if (!reading || isDisconnected) return "disconnected";
    return isStable ? "stable" : "unstable";
  }

  function weightClass() {
    if (!reading || isDisconnected) return "disconnected";
    return isStable ? "" : "unstable";
  }

  function statusText() {
    if (!reading) return "Sin lectura — presiona Leer o activa Automático";
    if (isDisconnected) return "Desconectada";
    return isStable ? "Estable ✓" : "Oscilando…";
  }

  const stepLabel = mode === "differential"
    ? step === "gross" ? "PESO BRUTO — vehículo cargado"
      : step === "tare" ? "PESO TARA — vehículo vacío"
      : "PESAJE COMPLETO"
    : "LECTURA DIRECTA";

  const isComplete = mode === "differential"
    ? !!(grossKg && tareKg)
    : !!(manualGross || grossKg);

  return (
    <Page title="Módulo de pesaje">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20, alignItems: "start" }}>

        <div style={{ display: "grid", gap: 16 }}>

          <div className="section-panel">
            <div className="section-panel-header">
              <h3>Dispositivo y modo</h3>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className={mode === "differential" ? "btn-primary" : "btn-secondary"}
                  style={{ padding: "6px 14px", fontSize: "0.8rem" }}
                  onClick={() => { setMode("differential"); resetAll(); }}
                >
                  ⚖ Diferencial (vehículo)
                </button>
                <button
                  className={mode === "direct" ? "btn-primary" : "btn-secondary"}
                  style={{ padding: "6px 14px", fontSize: "0.8rem" }}
                  onClick={() => { setMode("direct"); resetAll(); }}
                >
                  🏋 Directo (banco)
                </button>
              </div>
            </div>
            <div className="section-panel-body" style={{ display: "grid", gap: 12 }}>
              {devices.length === 0 ? (
                <p className="muted">No hay básculas disponibles en el catálogo.</p>
              ) : (
                <>
                  <label>
                    Báscula seleccionada
                    <select value={selectedId} onChange={(e) => { setSelectedId(e.target.value); resetAll(); }}>
                      {devices.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} — {d.kind === "vehicle_scale" ? "Vehicular" : "Secundaria"}
                        </option>
                      ))}
                    </select>
                  </label>
                  {selectedDevice && (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <span className={`badge ${selectedDevice.is_connected ? "badge-green" : "badge-red"}`}>
                        {selectedDevice.is_connected ? "Conectada" : "Desconectada"}
                      </span>
                      <span className={`badge ${selectedDevice.kind === "vehicle_scale" ? "badge-blue" : "badge-gray"}`}>
                        {selectedDevice.kind === "vehicle_scale" ? "Báscula vehicular (3.5 – 28 t)" : "Báscula secundaria (0 – 500 kg)"}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="section-panel">
            <div className="section-panel-header">
              <h3 style={{ color: "var(--accent-2)", letterSpacing: "0.05em", fontSize: "0.8rem", fontWeight: 700 }}>
                {stepLabel}
              </h3>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {autoRead && (
                  <span className="badge badge-green" style={{ gap: 5 }}>
                    <span className="scale-dot stable" style={{ width: 6, height: 6, display: "inline-block" }} />
                    Auto ({readCount})
                  </span>
                )}
                <button
                  className={autoRead ? "btn-danger" : "btn-secondary"}
                  style={{ padding: "5px 12px", fontSize: "0.78rem" }}
                  disabled={!selectedId || step === "done"}
                  onClick={() => setAutoRead((v) => !v)}
                >
                  {autoRead ? "⏹ Detener" : "▶ Automático"}
                </button>
              </div>
            </div>
            <div className="section-panel-body" style={{ display: "grid", gap: 16 }}>
              <div className="scale-display">
                <div className={`scale-weight ${weightClass()}`}>
                  {displayWeight != null && !isDisconnected
                    ? displayWeight.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    : "– – –"}
                </div>
                <div className="scale-unit">
                  {selectedDevice?.kind === "vehicle_scale" ? "kg (vehicular)" : "kg"}
                </div>
                <div className="scale-status-row">
                  <div className={`scale-dot ${dotClass()}`} />
                  <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>{statusText()}</span>
                </div>
                {reading && !isDisconnected && (
                  <div style={{ fontSize: "0.7rem", color: "var(--muted)", marginTop: 6 }}>
                    Última lectura: {new Date(reading.captured_at).toLocaleTimeString("es-MX")}
                    {reading.is_manual_fallback && " · modo manual"}
                  </div>
                )}
              </div>

              {readError && <div className="error-banner">{readError}</div>}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <button
                  className="btn-primary"
                  onClick={manualCapture}
                  disabled={loadingRead || !selectedId || step === "done" || autoRead}
                >
                  {loadingRead ? "Leyendo…" : "⚖ Leer báscula"}
                </button>
                <button
                  className="btn-secondary"
                  onClick={captureCurrentReading}
                  disabled={!reading || !isStable || step === "done" || isDisconnected}
                  title="Captura el peso estable actual en el campo correspondiente"
                >
                  ✓ Capturar lectura
                </button>
              </div>

              {mode === "differential" && (
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 10, alignItems: "end" }}>
                    <label>
                      Peso bruto (kg)
                      <input
                        type="number"
                        value={grossKg}
                        onChange={(e) => setGrossKg(e.target.value)}
                        placeholder="ej. 14500"
                        style={{ borderColor: step === "gross" ? "var(--accent)" : undefined }}
                      />
                    </label>
                    <div style={{ textAlign: "center", paddingBottom: 8, color: "var(--muted)", fontSize: "1.2rem" }}>–</div>
                    <label>
                      Tara (kg)
                      <input
                        type="number"
                        value={tareKg}
                        onChange={(e) => setTareKg(e.target.value)}
                        placeholder="ej. 4800"
                        style={{ borderColor: step === "tare" ? "var(--accent)" : undefined }}
                      />
                    </label>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      className={step === "gross" ? "btn-primary" : "btn-secondary"}
                      style={{ flex: 1, fontSize: "0.82rem" }}
                      onClick={() => { setStep("gross"); setReading(null); }}
                      disabled={step === "done"}
                    >
                      {grossKg ? "✓ Bruto capturado" : "→ Capturar bruto"}
                    </button>
                    <button
                      className={step === "tare" ? "btn-primary" : "btn-secondary"}
                      style={{ flex: 1, fontSize: "0.82rem" }}
                      onClick={() => { setStep("tare"); setReading(null); }}
                      disabled={!grossKg}
                    >
                      {tareKg ? "✓ Tara capturada" : "→ Capturar tara"}
                    </button>
                  </div>
                </div>
              )}

              {mode === "direct" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <label>
                    Peso bruto (kg)
                    <input
                      type="number"
                      value={manualGross || grossKg}
                      onChange={(e) => setManualGross(e.target.value)}
                      placeholder="ej. 125.5"
                    />
                  </label>
                  <label>
                    Tara (kg)
                    <input
                      type="number"
                      value={manualTare}
                      onChange={(e) => setManualTare(e.target.value)}
                      placeholder="0 si no hay"
                    />
                  </label>
                </div>
              )}

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button className="btn-ghost" onClick={resetAll}>
                  ↺ Reiniciar
                </button>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 16 }}>
          <div className="section-panel">
            <div className="section-panel-header">
              <h3>Resumen de pesaje</h3>
            </div>
            <div className="section-panel-body" style={{ display: "grid", gap: 14 }}>

              <WeighRow
                label="Peso bruto"
                value={grossNum > 0 ? grossNum.toFixed(2) : ""}
                highlight={step === "gross" && mode === "differential"}
              />
              <WeighRow
                label="Tara"
                value={tareNum > 0 ? tareNum.toFixed(2) : ""}
                highlight={step === "tare" && mode === "differential"}
              />
              {netKg > 0 && (
                <WeighRow label="Merma estimada (3%)" value={mermaKg.toFixed(2)} muted />
              )}

              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                <div style={{ fontSize: "0.72rem", color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                  Peso neto
                </div>
                <div style={{
                  fontSize: "2.4rem", fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1,
                  color: netClean > 0 ? "var(--accent)" : "var(--muted)"
                }}>
                  {netClean > 0
                    ? netClean.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    : "—"}
                </div>
                {netClean > 0 && (
                  <div style={{ fontSize: "0.82rem", color: "var(--muted)", marginTop: 4 }}>kilogramos netos</div>
                )}
              </div>

              <div>
                <span className={`badge ${isComplete ? "badge-green" : "badge-amber"}`}>
                  {isComplete
                    ? mode === "differential" ? "Diferencial completo ✓" : "Lectura lista ✓"
                    : mode === "differential"
                    ? step === "gross" ? "Esperando peso bruto…" : "Esperando tara…"
                    : "Pendiente de captura"}
                </span>
              </div>

              {confirmed ? (
                <div className="info-banner" style={{ fontSize: "0.82rem" }}>
                  Peso confirmado: {netClean.toFixed(2)} kg. Ve a <strong>Operaciones</strong> para crear la partida.
                </div>
              ) : (
                <button
                  className="btn-primary"
                  disabled={netClean <= 0 || !isComplete}
                  onClick={() => setConfirmed(true)}
                >
                  ✓ Confirmar peso neto
                </button>
              )}

              {confirmed && (
                <button className="btn-secondary" onClick={resetAll}>
                  Nuevo pesaje
                </button>
              )}
            </div>
          </div>

          <div className="section-panel">
            <div className="section-panel-header">
              <h3>Guía rápida</h3>
            </div>
            <div className="section-panel-body" style={{ display: "grid", gap: 8, fontSize: "0.82rem", color: "var(--muted)" }}>
              {mode === "differential" ? (
                <>
                  <p style={{ margin: 0 }}><span style={{ color: "var(--accent-2)" }}>①</span> Modo <strong style={{ color: "var(--text-soft)" }}>Diferencial</strong> — báscula vehicular.</p>
                  <p style={{ margin: 0 }}>Activa <strong style={{ color: "var(--text-soft)" }}>Automático</strong> para ver lectura en vivo. Con el camión <strong style={{ color: "var(--text-soft)" }}>cargado</strong>, presiona "Capturar bruto".</p>
                  <p style={{ margin: 0 }}>Después de descargar, cambia a <strong style={{ color: "var(--text-soft)" }}>"→ Capturar tara"</strong> y repite.</p>
                  <p style={{ margin: 0 }}>El peso neto se calcula restando tara y merma (3%).</p>
                </>
              ) : (
                <>
                  <p style={{ margin: 0 }}><span style={{ color: "var(--accent-2)" }}>①</span> Modo <strong style={{ color: "var(--text-soft)" }}>Directo</strong> — báscula de banco.</p>
                  <p style={{ margin: 0 }}>Coloca el material y activa <strong style={{ color: "var(--text-soft)" }}>Automático</strong> para ver el peso en vivo.</p>
                  <p style={{ margin: 0 }}>Cuando la lectura sea estable, captura con "✓ Capturar lectura".</p>
                  <p style={{ margin: 0 }}>Si hay tara (recipiente), ingrésala en el campo de tara.</p>
                </>
              )}
            </div>
          </div>
        </div>

      </div>
    </Page>
  );
}

function WeighRow({
  label,
  value,
  highlight,
  muted,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  muted?: boolean;
}) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "8px 10px", borderRadius: "var(--radius-sm)",
      background: highlight ? "var(--accent-dim)" : "transparent",
      border: `1px solid ${highlight ? "rgba(34,197,94,0.25)" : "transparent"}`,
    }}>
      <span style={{ fontSize: "0.8rem", color: muted ? "var(--muted)" : "var(--text-soft)" }}>{label}</span>
      <span style={{
        fontWeight: 600, fontSize: "0.95rem",
        color: value ? (muted ? "var(--muted)" : "var(--text)") : "var(--muted)"
      }}>
        {value ? `${parseFloat(value).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg` : "—"}
      </span>
    </div>
  );
}
