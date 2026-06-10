import { useEffect, useMemo, useState } from "react";
import { api } from "../api/resources";
import { Page } from "../components/Page";
import type { Device } from "../types";

type AdvancedDraft = {
  adapter: "real" | "simulated";
  baudrate: string;
  bytesize: string;
  parity: string;
  stopbits: string;
  timeout: string;
  query: string;
  encoding: string;
  min_weight: string;
  max_weight: string;
};

type Draft = {
  name: string;
  port: string;
  advanced: AdvancedDraft;
};

const KIND_ORDER: Array<Device["kind"]> = ["vehicle_scale", "secondary_scale", "thermal_printer", "gps_tracker"];

const KIND_LABELS: Record<Device["kind"], string> = {
  vehicle_scale: "Báscula vehicular",
  secondary_scale: "Báscula secundaria",
  thermal_printer: "Impresora de tickets",
  gps_tracker: "GPS tracker",
};

const KIND_HELP: Record<Device["kind"], string> = {
  vehicle_scale: "Usa este registro para el puerto de la báscula principal de recepción.",
  secondary_scale: "Usa este registro para la báscula auxiliar o de banco.",
  thermal_printer: "Actualiza el puerto cuando cambie la conexión de la impresora térmica.",
  gps_tracker: "Configuración de rastreo, si el módulo está habilitado en sitio.",
};

function metaString(meta: Record<string, unknown> | undefined, key: string, fallback = "") {
  const value = meta?.[key];
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function emptyDraft(device: Device): Draft {
  const meta = device.metadata ?? {};
  return {
    name: device.name ?? "",
    port: device.port ?? "",
    advanced: {
      adapter: metaString(meta, "adapter") === "simulated" ? "simulated" : "real",
      baudrate: metaString(meta, "baudrate", "9600"),
      bytesize: metaString(meta, "bytesize", "8"),
      parity: metaString(meta, "parity", "N"),
      stopbits: metaString(meta, "stopbits", "1"),
      timeout: metaString(meta, "timeout", metaString(meta, "timeout_seconds", "1.5")),
      query: metaString(meta, "query"),
      encoding: metaString(meta, "encoding", "utf-8"),
      min_weight: metaString(meta, "min_weight"),
      max_weight: metaString(meta, "max_weight"),
    },
  };
}

function kindIcon(kind: Device["kind"]) {
  if (kind === "thermal_printer") return "PR";
  if (kind === "vehicle_scale" || kind === "secondary_scale") return "BS";
  return "OT";
}

function kindBadgeClass(kind: Device["kind"]) {
  if (kind === "thermal_printer") return "badge-blue";
  if (kind === "vehicle_scale") return "badge-green";
  if (kind === "secondary_scale") return "badge-amber";
  return "badge-gray";
}

function cleanMetadata(input: AdvancedDraft): Record<string, unknown> {
  const metadata: Record<string, unknown> = {
    adapter: input.adapter,
  };
  const maybeSet = (key: string, value: string) => {
    const trimmed = value.trim();
    if (trimmed) metadata[key] = trimmed;
  };
  maybeSet("baudrate", input.baudrate);
  maybeSet("bytesize", input.bytesize);
  maybeSet("parity", input.parity);
  maybeSet("stopbits", input.stopbits);
  maybeSet("timeout", input.timeout);
  maybeSet("query", input.query);
  maybeSet("encoding", input.encoding);
  maybeSet("min_weight", input.min_weight);
  maybeSet("max_weight", input.max_weight);
  return metadata;
}

export function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [probingId, setProbingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [testResult, setTestResult] = useState<string | null>(null);

  async function refresh() {
    const current = await api.devices().catch(() => []);
    setDevices(current);
    setDrafts(Object.fromEntries(current.map((device) => [device.id, emptyDraft(device)])));
  }

  useEffect(() => {
    refresh();
  }, []);

  const visibleDevices = useMemo(() => {
    const query = search.trim().toLowerCase();
    const ordered = [...devices].sort((a, b) => {
      const kindDelta = KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind);
      if (kindDelta !== 0) return kindDelta;
      return a.name.localeCompare(b.name, "es");
    });
    if (!query) return ordered;
    return ordered.filter((device) =>
      [device.name, device.identifier, device.port, KIND_LABELS[device.kind], ...(device.metadata ? Object.values(device.metadata).map((value) => String(value)) : [])]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(query)),
    );
  }, [devices, search]);

  const totals = useMemo(() => ({
    scales: devices.filter((device) => device.kind === "vehicle_scale" || device.kind === "secondary_scale").length,
    printers: devices.filter((device) => device.kind === "thermal_printer").length,
    connected: devices.filter((device) => device.is_connected).length,
  }), [devices]);

  function updateField(id: string, field: keyof Draft, value: string) {
    setDrafts((current) => ({
      ...current,
      [id]: {
        ...(current[id] ?? emptyDraft(devices.find((device) => device.id === id) ?? devices[0])),
        [field]: value,
      },
    }));
  }

  function updateAdvancedField(id: string, field: keyof AdvancedDraft, value: string) {
    setDrafts((current) => ({
      ...current,
      [id]: {
        ...(current[id] ?? emptyDraft(devices.find((device) => device.id === id) ?? devices[0])),
        advanced: {
          ...(current[id]?.advanced ?? emptyDraft(devices.find((device) => device.id === id) ?? devices[0]).advanced),
          [field]: value,
        },
      },
    }));
  }

  async function saveDevice(device: Device) {
    const draft = drafts[device.id] ?? emptyDraft(device);
    setSavingId(device.id);
    setMessage(null);
    setTestResult(null);
    try {
      const metadata = cleanMetadata(draft.advanced);
      const payload: Record<string, unknown> = {
        name: draft.name.trim(),
        port: draft.port.trim(),
        metadata,
      };
      await api.devicePatch(device.id, payload);
      setMessage(`Dispositivo actualizado: ${device.name}.`);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar el dispositivo");
    } finally {
      setSavingId(null);
    }
  }

  async function testScale(device: Device) {
    setTestingId(device.id);
    setMessage(null);
    setTestResult(null);
    try {
      const reading = await api.deviceReadScale(device.id);
      setTestResult(
        `${device.name}: lectura real ${reading.weight_kg} kg en ${reading.port || device.port || "sin puerto"} (${reading.is_stable ? "estable" : "inestable"})`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo leer la báscula");
    } finally {
      setTestingId(null);
    }
  }

  async function probeScale(device: Device) {
    setProbingId(device.id);
    setMessage(null);
    setTestResult(null);
    try {
      const probe = await api.deviceProbeScale(device.id, { max_lines: 5 });
      const lines = probe.lines.length
        ? probe.lines.map((line, index) => `${index + 1}. ${line.text} [${line.hex}]`).join("\n")
        : "No se recibieron lineas crudas.";
      setTestResult(`${device.name}: probe serial en ${probe.port || device.port || "sin puerto"} (${probe.line_count} linea(s))\n${lines}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo leer la traza cruda de la bÃ¡scula");
    } finally {
      setProbingId(null);
    }
  }

  async function testPrinter(device: Device) {
    setTestingId(device.id);
    setMessage(null);
    setTestResult(null);
    try {
      const result = await api.deviceSimulatePrint(device.id, {
        copies: 1,
        is_reprint: false,
        message: "Prueba de impresora",
      });
      setTestResult(`${device.name}: impresión simulada en ${result.printer_port || "sin puerto"} (${result.status})`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo probar la impresora");
    } finally {
      setTestingId(null);
    }
  }

  return (
    <Page
      title="Configuración de dispositivos"
      actions={<span className="muted">Ajusta puertos y parámetros seriales sin tocar código</span>}
    >
      {message ? <div className="info-banner" style={{ marginBottom: 16 }}>{message}</div> : null}
      {testResult ? <div className="info-banner" style={{ marginBottom: 16 }}>{testResult}</div> : null}

      <section className="metric-panel" style={{ marginBottom: 16 }}>
        <span>Dispositivos configurados</span>
        <strong>{devices.length}</strong>
        <div className="muted" style={{ marginTop: 6 }}>
          Cambia aquí el puerto físico y, si hace falta, el baudrate, la paridad, el timeout o el query inicial.
        </div>
      </section>

      <div className="users-stats-row" style={{ marginBottom: 16 }}>
        <div className="metric-panel"><span className="metric-label">Básculas</span><strong className="metric-value">{totals.scales}</strong></div>
        <div className="metric-panel"><span className="metric-label">Impresoras</span><strong className="metric-value">{totals.printers}</strong></div>
        <div className="metric-panel"><span className="metric-label">Conectados</span><strong className="metric-value">{totals.connected}</strong></div>
        <div className="metric-panel">
          <label className="search-box">
            Buscar
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nombre, identificador, tipo, puerto o parámetro"
            />
          </label>
        </div>
      </div>

      <div style={{ display: "grid", gap: 14 }}>
        {visibleDevices.map((device) => {
          const draft = drafts[device.id] ?? emptyDraft(device);
          const saving = savingId === device.id;
          const testing = testingId === device.id;
          const probing = probingId === device.id;
          const isScale = device.kind === "vehicle_scale" || device.kind === "secondary_scale";
          const isPrinter = device.kind === "thermal_printer";
          return (
            <section className="section-panel" key={device.id}>
              <div className="section-panel-header">
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      lineHeight: 1,
                      minWidth: 28,
                      height: 28,
                      borderRadius: 8,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "rgba(255,255,255,0.08)",
                      color: "var(--text-muted)",
                      fontWeight: 700,
                    }}
                  >
                    {kindIcon(device.kind)}
                  </span>
                  <div>
                    <h3 style={{ marginBottom: 4 }}>{device.name}</h3>
                    <div className="muted" style={{ fontSize: "0.8rem" }}>
                      {KIND_LABELS[device.kind]} · {device.identifier}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <span className={`badge ${kindBadgeClass(device.kind)}`}>{KIND_LABELS[device.kind]}</span>
                  <span className={`badge ${device.is_connected ? "badge-green" : "badge-red"}`}>
                    {device.is_connected ? "Conectado" : "Desconectado"}
                  </span>
                  <span className={`badge ${device.is_manual_fallback ? "badge-amber" : "badge-gray"}`}>
                    {device.is_manual_fallback ? "Contingencia" : "Normal"}
                  </span>
                </div>
              </div>

              <div className="section-panel-body" style={{ display: "grid", gap: 14 }}>
                <div className="muted" style={{ fontSize: "0.85rem" }}>{KIND_HELP[device.kind]}</div>

                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 14 }}>
                  <label>
                    Nombre visible
                    <input value={draft.name} onChange={(event) => updateField(device.id, "name", event.target.value)} />
                  </label>
                  <label>
                    Puerto físico
                    <input
                      value={draft.port}
                      onChange={(event) => updateField(device.id, "port", event.target.value)}
                      placeholder={isPrinter ? "COM4 o /dev/ttyUSB0" : "COM3 o /dev/ttyUSB1"}
                    />
                  </label>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 10, alignItems: "center" }}>
                  <div className="info-banner" style={{ margin: 0 }}>
                    Puerto actual: <strong>{device.port || "Sin configurar"}</strong>
                    {device.last_seen_at ? <> · última señal {new Date(device.last_seen_at).toLocaleString("es-MX")}</> : null}
                  </div>
                  <button type="button" className="btn-primary" onClick={() => saveDevice(device)} disabled={saving}>
                    {saving ? "Guardando..." : "Guardar cambios"}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setDrafts((current) => ({ ...current, [device.id]: emptyDraft(device) }))}
                    disabled={saving}
                  >
                    Restaurar
                  </button>
                </div>

                <div style={{ display: "grid", gap: 12 }}>
                  {isScale ? (
                    <div className="section-panel" style={{ margin: 0 }}>
                      <div className="section-panel-header">
                        <h3 style={{ margin: 0 }}>Ajustes seriales de báscula</h3>
                        <span className="muted">Parámetros finos de lectura</span>
                      </div>
                      <div className="section-panel-body" style={{ display: "grid", gap: 12 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                          <label>
                            Modo de lectura
                            <select
                              value={draft.advanced.adapter}
                              onChange={(event) => updateAdvancedField(device.id, "adapter", event.target.value as AdvancedDraft["adapter"])}
                            >
                              <option value="real">Real por serial</option>
                              <option value="simulated">Simulado</option>
                            </select>
                          </label>
                          <label>
                            Baudrate
                            <input value={draft.advanced.baudrate} onChange={(event) => updateAdvancedField(device.id, "baudrate", event.target.value)} placeholder="9600" />
                          </label>
                          <label>
                            Bytesize
                            <input value={draft.advanced.bytesize} onChange={(event) => updateAdvancedField(device.id, "bytesize", event.target.value)} placeholder="8" />
                          </label>
                          <label>
                            Paridad
                            <select value={draft.advanced.parity} onChange={(event) => updateAdvancedField(device.id, "parity", event.target.value)}>
                              <option value="N">Ninguna</option>
                              <option value="E">Par</option>
                              <option value="O">Impar</option>
                              <option value="M">Mark</option>
                              <option value="S">Space</option>
                            </select>
                          </label>
                          <label>
                            Stop bits
                            <select value={draft.advanced.stopbits} onChange={(event) => updateAdvancedField(device.id, "stopbits", event.target.value)}>
                              <option value="1">1</option>
                              <option value="1.5">1.5</option>
                              <option value="2">2</option>
                            </select>
                          </label>
                          <label>
                            Timeout (s)
                            <input value={draft.advanced.timeout} onChange={(event) => updateAdvancedField(device.id, "timeout", event.target.value)} placeholder="1.5" />
                          </label>
                          <label>
                            Encoding
                            <input value={draft.advanced.encoding} onChange={(event) => updateAdvancedField(device.id, "encoding", event.target.value)} placeholder="utf-8" />
                          </label>
                            <label>
                              Query / comando
                              <input value={draft.advanced.query} onChange={(event) => updateAdvancedField(device.id, "query", event.target.value)} placeholder="W" />
                              <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
                                Si tu báscula usa el protocolo Standard Scale, prueba con <code>W</code>.
                              </div>
                            </label>
                          <label>
                            Peso mínimo
                            <input value={draft.advanced.min_weight} onChange={(event) => updateAdvancedField(device.id, "min_weight", event.target.value)} placeholder="0" />
                          </label>
                          <label>
                            Peso máximo
                            <input value={draft.advanced.max_weight} onChange={(event) => updateAdvancedField(device.id, "max_weight", event.target.value)} placeholder="30000" />
                          </label>
                        </div>
                        <div className="muted" style={{ fontSize: "0.8rem" }}>
                          Si la báscula ya está calibrada, normalmente solo necesitas `puerto`, `baudrate`, `paridad`, `bytesize`, `stopbits` y `timeout`.
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {isPrinter ? (
                    <div className="section-panel" style={{ margin: 0 }}>
                      <div className="section-panel-header">
                        <h3 style={{ margin: 0 }}>Impresora de tickets</h3>
                        <span className="muted">El puerto es lo principal aquí</span>
                      </div>
                      <div className="section-panel-body" style={{ display: "grid", gap: 8 }}>
                        <div className="muted" style={{ fontSize: "0.85rem" }}>
                          El módulo de impresión conserva el puerto configurado y permite pruebas simuladas mientras conectas el equipo físico.
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
                  {isScale ? (
                    <>
                      <button type="button" className="btn-secondary" onClick={() => probeScale(device)} disabled={probing}>
                        {probing ? "Leyendo trama..." : "Ver lectura cruda"}
                      </button>
                      <button type="button" className="btn-secondary" onClick={() => testScale(device)} disabled={testing}>
                        {testing ? "Leyendo..." : "Leer báscula real"}
                      </button>
                    </>
                  ) : null}
                  {isPrinter ? (
                    <button type="button" className="btn-secondary" onClick={() => testPrinter(device)} disabled={testing}>
                      {testing ? "Probando..." : "Probar impresión"}
                    </button>
                  ) : null}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </Page>
  );
}

