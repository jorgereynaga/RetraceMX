import { useEffect, useState, useCallback } from "react";
import { api } from "../api/resources";
import { Page } from "../components/Page";
import type { Device } from "../types";

type ScaleReading = {
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

export function WeighingPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [reading, setReading] = useState<ScaleReading | null>(null);
  const [loadingRead, setLoadingRead] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);

  const [mode, setMode] = useState<WeighMode>("differential");
  const [grossKg, setGrossKg] = useState<string>("");
  const [tareKg, setTareKg] = useState<string>("");
  const [manualGross, setManualGross] = useState<string>("");
  const [manualTare, setManualTare] = useState<string>("");
  const [step, setStep] = useState<"gross" | "tare" | "done">("gross");

  useEffect(() => {
    api.devices().then((devs) => {
      const scales = devs.filter(
        (d) => d.kind === "vehicle_scale" || d.kind === "secondary_scale"
      );
      setDevices(scales);
      if (scales.length > 0) setSelectedId(scales[0].id);
    });
  }, []);

  const selectedDevice = devices.find((d) => d.id === selectedId);

  const captureReading = useCallback(async () => {
    if (!selectedId) return;
    setLoadingRead(true);
    setReadError(null);
    try {
      const r = await api.deviceSimulateScale(selectedId);
      setReading(r);
      if (mode === "differential") {
        if (step === "gross") {
          setGrossKg(r.weight_kg);
        } else if (step === "tare") {
          setTareKg(r.weight_kg);
        }
      } else {
        setGrossKg(r.weight_kg);
      }
    } catch {
      setReadError("Error al leer la báscula. Verifique la conexión o use la entrada manual.");
    } finally {
      setLoadingRead(false);
    }
  }, [selectedId, mode, step]);

  const netKg = (() => {
    const g = parseFloat(mode === "differential" ? grossKg : manualGross || grossKg) || 0;
    const t = parseFloat(mode === "differential" ? tareKg : manualTare) || 0;
    const n = g - t;
    return n > 0 ? n : 0;
  })();

  const displayWeight = reading?.weight_kg ?? null;
  const isStable = reading?.is_stable ?? false;
  const isManual = reading?.is_manual_fallback ?? false;

  function weightClass() {
    if (!reading) return "";
    if (isManual) return "unstable";
    return isStable ? "" : "unstable";
  }

  function statusText() {
    if (!reading) return "Sin lectura";
    if (isManual) return "Modo manual (fallback)";
    return isStable ? "Estable ✓" : "Inestable — espere…";
  }

  function statusDotClass() {
    if (!reading) return "disconnected";
    if (isManual) return "unstable";
    return isStable ? "stable" : "unstable";
  }

  function resetAll() {
    setReading(null);
    setGrossKg("");
    setTareKg("");
    setManualGross("");
    setManualTare("");
    setStep("gross");
    setReadError(null);
  }

  const differentialComplete = mode === "differential" && grossKg && tareKg;
  const directComplete = mode === "direct" && (grossKg || manualGross);

  return (
    <Page title="Módulo de pesaje">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20, alignItems: "start" }}>
        <div style={{ display: "grid", gap: 16 }}>
          <div className="section-panel">
            <div className="section-panel-header">
              <h3>Selección de báscula</h3>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className={mode === "differential" ? "btn-primary" : "btn-secondary"}
                  style={{ padding: "6px 14px", fontSize: "0.8rem" }}
                  onClick={() => { setMode("differential"); resetAll(); }}
                >
                  Diferencial (vehículo)
                </button>
                <button
                  className={mode === "direct" ? "btn-primary" : "btn-secondary"}
                  style={{ padding: "6px 14px", fontSize: "0.8rem" }}
                  onClick={() => { setMode("direct"); resetAll(); }}
                >
                  Directo (banco)
                </button>
              </div>
            </div>
            <div className="section-panel-body">
              {devices.length === 0 ? (
                <p className="muted">No hay básculas disponibles. Verifique los dispositivos en el catálogo.</p>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  <label>
                    Dispositivo
                    <select value={selectedId} onChange={(e) => { setSelectedId(e.target.value); resetAll(); }}>
                      {devices.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} — {d.kind === "vehicle_scale" ? "Vehicular" : "Secundaria"}
                          {d.is_connected ? "" : " (desconectada)"}
                        </option>
                      ))}
                    </select>
                  </label>
                  {selectedDevice && (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: "0.8rem" }}>
                      <span className={`badge ${selectedDevice.is_connected ? "badge-green" : "badge-red"}`}>
                        {selectedDevice.is_connected ? "Conectada" : "Desconectada"}
                      </span>
                      <span className={`badge ${selectedDevice.is_stable ? "badge-green" : "badge-amber"}`}>
                        {selectedDevice.is_stable ? "Estable" : "Inestable"}
                      </span>
                      <span className="badge badge-gray">
                        {selectedDevice.kind === "vehicle_scale" ? "Báscula vehicular" : "Báscula secundaria"}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="section-panel">
            <div className="section-panel-header">
              <h3>
                {mode === "differential"
                  ? step === "gross"
                    ? "Paso 1 — Peso bruto (vehículo cargado)"
                    : step === "tare"
                    ? "Paso 2 — Peso tara (vehículo vacío)"
                    : "Pesaje completo"
                  : "Lectura directa"}
              </h3>
            </div>
            <div className="section-panel-body" style={{ display: "grid", gap: 16 }}>
              <div className="scale-panel" style={{ padding: 0, background: "transparent", border: "none" }}>
                <div className="scale-display">
                  <div className={`scale-weight ${weightClass()}`}>
                    {displayWeight ? parseFloat(displayWeight).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
                  </div>
                  <div className="scale-unit">kg</div>
                  <div className="scale-status-row">
                    <div className={`scale-dot ${statusDotClass()}`} />
                    <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>{statusText()}</span>
                    {isManual && (
                      <span className="badge badge-amber" style={{ marginLeft: 6 }}>Fallback manual</span>
                    )}
                  </div>
                  {reading && (
                    <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: 6 }}>
                      Capturado: {new Date(reading.captured_at).toLocaleTimeString("es-MX")}
                    </div>
                  )}
                </div>

                {readError && <div className="error-banner" style={{ marginTop: 10 }}>{readError}</div>}

                <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
                  <button
                    className="btn-primary"
                    style={{ flex: 1 }}
                    onClick={captureReading}
                    disabled={loadingRead || !selectedId || (mode === "differential" && step === "done")}
                  >
                    {loadingRead ? "Leyendo…" : "⚖ Capturar lectura de báscula"}
                  </button>
                  <button className="btn-secondary" onClick={resetAll}>
                    Reiniciar
                  </button>
                </div>
              </div>

              {mode === "differential" && (
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <label>
                      Peso bruto (kg)
                      <div style={{ display: "flex", gap: 6 }}>
                        <input
                          type="number"
                          value={grossKg}
                          onChange={(e) => setGrossKg(e.target.value)}
                          placeholder="ej. 12500"
                          readOnly={!!grossKg && step !== "gross"}
                        />
                        <button
                          className={step === "gross" ? "btn-primary" : "btn-secondary"}
                          style={{ padding: "8px 12px", minWidth: 70, fontSize: "0.78rem" }}
                          onClick={() => setStep("gross")}
                        >
                          {step === "gross" ? "Activo" : "Editar"}
                        </button>
                      </div>
                    </label>
                    <label>
                      Peso tara (kg)
                      <div style={{ display: "flex", gap: 6 }}>
                        <input
                          type="number"
                          value={tareKg}
                          onChange={(e) => setTareKg(e.target.value)}
                          placeholder="ej. 4200"
                        />
                        <button
                          className={step === "tare" ? "btn-primary" : "btn-secondary"}
                          style={{ padding: "8px 12px", minWidth: 70, fontSize: "0.78rem" }}
                          onClick={() => { setStep("tare"); setReading(null); }}
                          disabled={!grossKg}
                        >
                          {step === "tare" ? "Activo" : step === "done" ? "OK" : "→ Tara"}
                        </button>
                      </div>
                    </label>
                  </div>
                  {grossKg && tareKg && (
                    <button
                      className="btn-primary"
                      onClick={() => setStep("done")}
                    >
                      Confirmar pesaje diferencial
                    </button>
                  )}
                </div>
              )}

              {mode === "direct" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <label>
                    Peso bruto (kg) — capturado/manual
                    <input
                      type="number"
                      value={grossKg || manualGross}
                      onChange={(e) => setManualGross(e.target.value)}
                      placeholder="ej. 85.5"
                    />
                  </label>
                  <label>
                    Tara (kg) — si aplica
                    <input
                      type="number"
                      value={manualTare}
                      onChange={(e) => setManualTare(e.target.value)}
                      placeholder="ej. 0"
                    />
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 16 }}>
          <div className="section-panel">
            <div className="section-panel-header">
              <h3>Resumen de pesaje</h3>
            </div>
            <div className="section-panel-body" style={{ display: "grid", gap: 12 }}>
              <WeighRow label="Peso bruto" value={grossKg || manualGross} unit="kg" />
              <WeighRow label="Tara" value={mode === "differential" ? tareKg : manualTare} unit="kg" />
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                <div style={{ fontSize: "0.72rem", color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                  Peso neto
                </div>
                <div style={{ fontSize: "2rem", fontWeight: 900, color: netKg > 0 ? "var(--accent)" : "var(--muted)", letterSpacing: "-0.03em" }}>
                  {netKg > 0 ? netKg.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
                </div>
                {netKg > 0 && <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>kilogramos</div>}
              </div>
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginBottom: 8 }}>Estado</div>
                <span className={`badge ${
                  (mode === "differential" && differentialComplete) || (mode === "direct" && directComplete)
                    ? "badge-green" : "badge-amber"
                }`}>
                  {(mode === "differential" && differentialComplete)
                    ? "Diferencial completo"
                    : (mode === "direct" && directComplete)
                    ? "Lectura directa lista"
                    : mode === "differential"
                    ? step === "gross" ? "Esperando peso bruto" : "Esperando tara"
                    : "Pendiente de captura"}
                </span>
              </div>
              <button
                className="btn-primary"
                disabled={netKg <= 0}
                onClick={() => {
                  alert(`Peso neto confirmado: ${netKg.toFixed(2)} kg\n\nPara registrar en una operación, dirígete al módulo de Operaciones y añade una partida con este peso.`);
                }}
              >
                Confirmar y registrar
              </button>
            </div>
          </div>

          <div className="section-panel">
            <div className="section-panel-header">
              <h3>Ayuda rápida</h3>
            </div>
            <div className="section-panel-body" style={{ fontSize: "0.82rem", color: "var(--muted)", display: "grid", gap: 8 }}>
              {mode === "differential" ? (
                <>
                  <p style={{ margin: 0 }}><strong style={{ color: "var(--text-soft)" }}>Modo diferencial:</strong> para básculas vehiculares.</p>
                  <p style={{ margin: 0 }}>1. Con el vehículo cargado, captura el <strong style={{ color: "var(--text-soft)" }}>peso bruto</strong>.</p>
                  <p style={{ margin: 0 }}>2. Tras la descarga, captura el <strong style={{ color: "var(--text-soft)" }}>peso tara</strong>.</p>
                  <p style={{ margin: 0 }}>3. El peso neto se calcula automáticamente.</p>
                </>
              ) : (
                <>
                  <p style={{ margin: 0 }}><strong style={{ color: "var(--text-soft)" }}>Modo directo:</strong> para básculas de banco o secundarias.</p>
                  <p style={{ margin: 0 }}>Coloca el material y captura la lectura. Si hay tara (recipiente), ingrésala para obtener el peso neto.</p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </Page>
  );
}

function WeighRow({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{label}</span>
      <span style={{ fontWeight: 600, fontSize: "1rem", color: value ? "var(--text)" : "var(--muted)" }}>
        {value ? `${parseFloat(value).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${unit}` : "—"}
      </span>
    </div>
  );
}
