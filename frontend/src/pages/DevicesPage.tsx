import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../api/resources";
import { Page } from "../components/Page";
import type { CollectionCenter, Device } from "../types";

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

type DeviceForm = {
  name: string;
  identifier: string;
  kind: Device["kind"];
  port: string;
  collection_center: string;
  is_connected: boolean;
  is_stable: boolean;
  is_manual_fallback: boolean;
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

function metaString(meta: Record<string, unknown> | undefined, key: string, fallback = "") {
  const value = meta?.[key];
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function emptyForm(): DeviceForm {
  return {
    name: "",
    identifier: "",
    kind: "secondary_scale",
    port: "",
    collection_center: "",
    is_connected: false,
    is_stable: true,
    is_manual_fallback: false,
    advanced: {
      adapter: "real",
      baudrate: "9600",
      bytesize: "8",
      parity: "N",
      stopbits: "1",
      timeout: "1.5",
      query: "",
      encoding: "utf-8",
      min_weight: "",
      max_weight: "",
    },
  };
}

function formFromDevice(device: Device): DeviceForm {
  const meta = device.metadata ?? {};
  return {
    name: device.name ?? "",
    identifier: device.identifier ?? "",
    kind: device.kind,
    port: device.port ?? "",
    collection_center: device.collection_center ?? "",
    is_connected: device.is_connected,
    is_stable: device.is_stable,
    is_manual_fallback: device.is_manual_fallback,
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
  const [centers, setCenters] = useState<CollectionCenter[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);
  const [form, setForm] = useState<DeviceForm>(emptyForm());
  const [search, setSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [probingId, setProbingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  async function refresh() {
    const [currentDevices, currentCenters] = await Promise.all([
      api.devices().catch(() => []),
      api.centers().catch(() => []),
    ]);
    setDevices(currentDevices);
    setCenters(currentCenters);
  }

  useEffect(() => {
    void refresh();
  }, []);

  const selectedDevice = useMemo(
    () => devices.find((device) => device.id === selectedDeviceId) ?? null,
    [devices, selectedDeviceId],
  );

  const centerLabelById = useMemo(
    () => Object.fromEntries(centers.map((center) => [center.id, `${center.code} · ${center.name}`])),
    [centers],
  );

  const visibleDevices = useMemo(() => {
    const query = search.trim().toLowerCase();
    const ordered = [...devices].sort((a, b) => {
      const kindDelta = KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind);
      if (kindDelta !== 0) return kindDelta;
      return a.name.localeCompare(b.name, "es");
    });
    if (!query) return ordered;
    return ordered.filter((device) =>
      [
        device.name,
        device.identifier,
        device.port,
        KIND_LABELS[device.kind],
        centerLabelById[device.collection_center ?? ""] ?? "",
        ...(device.metadata ? Object.values(device.metadata).map((value) => String(value)) : []),
      ]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(query)),
    );
  }, [centerLabelById, devices, search]);

  const totals = useMemo(
    () => ({
      scales: devices.filter((device) => device.kind === "vehicle_scale" || device.kind === "secondary_scale").length,
      printers: devices.filter((device) => device.kind === "thermal_printer").length,
      connected: devices.filter((device) => device.is_connected).length,
    }),
    [devices],
  );

  useEffect(() => {
    if (!isDeviceModalOpen) return;
    if (selectedDevice) {
      setForm(formFromDevice(selectedDevice));
      return;
    }
    setForm(emptyForm());
  }, [isDeviceModalOpen, selectedDevice]);

  function updateField(field: keyof DeviceForm, value: string | boolean) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateAdvancedField(field: keyof AdvancedDraft, value: string) {
    setForm((current) => ({
      ...current,
      advanced: {
        ...current.advanced,
        [field]: value,
      },
    }));
  }

  function openCreateDeviceModal() {
    setSelectedDeviceId("");
    setForm(emptyForm());
    setIsDeviceModalOpen(true);
    setMessage(null);
    setTestResult(null);
  }

  function openEditDeviceModal(device: Device) {
    setSelectedDeviceId(device.id);
    setIsDeviceModalOpen(true);
    setMessage(null);
    setTestResult(null);
  }

  function closeDeviceModal() {
    setIsDeviceModalOpen(false);
    setSelectedDeviceId("");
    setForm(emptyForm());
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    setTestResult(null);
    setIsSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        identifier: form.identifier.trim(),
        kind: form.kind,
        port: form.port.trim(),
        collection_center: form.collection_center || null,
        is_connected: form.is_connected,
        is_stable: form.is_stable,
        is_manual_fallback: form.is_manual_fallback,
        metadata: cleanMetadata(form.advanced),
      };

      if (selectedDevice) {
        await api.devicePatch(selectedDevice.id, payload);
        setMessage("Dispositivo actualizado.");
      } else {
        await api.deviceCreate(payload);
        setMessage("Dispositivo creado.");
      }

      closeDeviceModal();
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar el dispositivo");
    } finally {
      setIsSaving(false);
    }
  }

  async function removeDevice(device: Device) {
    if (deletingId) return;
    if (!window.confirm(`¿Seguro que deseas eliminar el dispositivo ${device.name}? Esta acción no se puede deshacer.`)) {
      return;
    }
    setDeletingId(device.id);
    setMessage(null);
    setTestResult(null);
    try {
      await api.deviceDelete(device.id);
      if (selectedDeviceId === device.id) {
        closeDeviceModal();
      }
      setMessage("Dispositivo eliminado.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo eliminar el dispositivo");
    } finally {
      setDeletingId(null);
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
        : "No se recibieron líneas crudas.";
      setTestResult(`${device.name}: probe serial en ${probe.port || device.port || "sin puerto"} (${probe.line_count} línea(s))\n${lines}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo leer la traza cruda de la báscula");
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

  const isScaleForm = form.kind === "vehicle_scale" || form.kind === "secondary_scale";
  const isPrinterForm = form.kind === "thermal_printer";

  return (
    <Page
      title="Dispositivos"
      actions={
        <div className="page-actions">
          <button type="button" className="btn-primary" onClick={openCreateDeviceModal}>
            Nuevo dispositivo
          </button>
          <span className="muted">Alta, edición, baja y pruebas de hardware</span>
        </div>
      }
    >
      {message ? <div className="info-banner" style={{ marginBottom: 16 }}>{message}</div> : null}
      {testResult ? <div className="info-banner" style={{ marginBottom: 16, whiteSpace: "pre-wrap" }}>{testResult}</div> : null}

      <section className="metric-panel" style={{ marginBottom: 16 }}>
        <span>Dispositivos configurados</span>
        <strong>{devices.length}</strong>
        <div className="muted" style={{ marginTop: 6 }}>
          Aquí administras puertos físicos, metadata serial y la relación con centro de acopio cuando aplica.
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
          const isScale = device.kind === "vehicle_scale" || device.kind === "secondary_scale";
          const isPrinter = device.kind === "thermal_printer";
          const centerLabel = device.collection_center ? centerLabelById[device.collection_center] ?? device.collection_center : "Sin centro";
          const testing = testingId === device.id;
          const probing = probingId === device.id;
          const deleting = deletingId === device.id;

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

                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                  <div className="info-banner" style={{ margin: 0 }}>
                    <div className="muted" style={{ fontSize: "0.75rem" }}>Centro de acopio</div>
                    <strong>{centerLabel}</strong>
                  </div>
                  <div className="info-banner" style={{ margin: 0 }}>
                    <div className="muted" style={{ fontSize: "0.75rem" }}>Puerto actual</div>
                    <strong>{device.port || "Sin configurar"}</strong>
                    {device.last_seen_at ? (
                      <div className="muted" style={{ marginTop: 4, fontSize: "0.78rem" }}>
                        Última señal {new Date(device.last_seen_at).toLocaleString("es-MX")}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                  <div className="info-banner" style={{ margin: 0 }}>
                    <div className="muted" style={{ fontSize: "0.75rem" }}>Identificador</div>
                    <strong>{device.identifier}</strong>
                  </div>
                  <div className="info-banner" style={{ margin: 0 }}>
                    <div className="muted" style={{ fontSize: "0.75rem" }}>Tipo</div>
                    <strong>{KIND_LABELS[device.kind]}</strong>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
                  <button type="button" className="btn-secondary table-action-button" onClick={() => openEditDeviceModal(device)}>
                    Modificar
                  </button>
                  <button
                    type="button"
                    className="btn-danger table-action-button"
                    onClick={() => void removeDevice(device)}
                    disabled={deleting}
                  >
                    {deleting ? "Eliminando..." : "Eliminar"}
                  </button>
                  {isScale ? (
                    <>
                      <button type="button" className="btn-secondary table-action-button" onClick={() => void probeScale(device)} disabled={probing}>
                        {probing ? "Leyendo trama..." : "Ver lectura cruda"}
                      </button>
                      <button type="button" className="btn-secondary table-action-button" onClick={() => void testScale(device)} disabled={testing}>
                        {testing ? "Leyendo..." : "Leer báscula real"}
                      </button>
                    </>
                  ) : null}
                  {isPrinter ? (
                    <button type="button" className="btn-secondary table-action-button" onClick={() => void testPrinter(device)} disabled={testing}>
                      {testing ? "Probando..." : "Probar impresión"}
                    </button>
                  ) : null}
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {isDeviceModalOpen ? (
        <div className="party-modal-backdrop" role="presentation" onClick={closeDeviceModal}>
          <div
            className="party-modal"
            role="dialog"
            aria-modal="true"
            aria-label={selectedDevice ? `Editar dispositivo ${selectedDevice.name}` : "Nuevo dispositivo"}
            onClick={(event) => event.stopPropagation()}
            style={{ width: "min(1100px, 100%)" }}
          >
            <div className="party-modal-header">
              <div>
                <h2 style={{ marginBottom: 6 }}>{selectedDevice ? "Editar dispositivo" : "Nuevo dispositivo"}</h2>
                <div className="muted">
                  {selectedDevice ? selectedDevice.name : "Crea un registro nuevo para una báscula, impresora o tracker."}
                </div>
              </div>
              <button type="button" className="btn-secondary" onClick={closeDeviceModal}>
                Cerrar
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                <label>
                  Nombre visible
                  <input value={form.name} onChange={(event) => updateField("name", event.target.value)} />
                </label>
                <label>
                  Identificador único
                  <input value={form.identifier} onChange={(event) => updateField("identifier", event.target.value)} placeholder="bascula-secundaria-01" />
                </label>
                <label>
                  Tipo
                  <select value={form.kind} onChange={(event) => updateField("kind", event.target.value as Device["kind"])}>
                    <option value="vehicle_scale">Báscula vehicular</option>
                    <option value="secondary_scale">Báscula secundaria</option>
                    <option value="thermal_printer">Impresora de tickets</option>
                    <option value="gps_tracker">GPS tracker</option>
                  </select>
                </label>
                <label>
                  Puerto físico
                  <input value={form.port} onChange={(event) => updateField("port", event.target.value)} placeholder="COM7" />
                </label>
                <label>
                  Centro de acopio
                  <select value={form.collection_center} onChange={(event) => updateField("collection_center", event.target.value)}>
                    <option value="">Sin asignar</option>
                    {centers.map((center) => (
                      <option key={center.id} value={center.id}>
                        {center.code} · {center.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="muted" style={{ display: "block", marginBottom: 6 }}>Estado del dispositivo</span>
                  <div style={{ display: "grid", gap: 8 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={form.is_connected}
                        onChange={(event) => updateField("is_connected", event.target.checked)}
                      />
                      Conectado
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={form.is_stable}
                        onChange={(event) => updateField("is_stable", event.target.checked)}
                      />
                      Estable
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={form.is_manual_fallback}
                        onChange={(event) => updateField("is_manual_fallback", event.target.checked)}
                      />
                      Contingencia manual
                    </label>
                  </div>
                </label>
              </div>

              <div className="section-panel" style={{ margin: 0 }}>
                <div className="section-panel-header">
                  <h3 style={{ margin: 0 }}>Configuración avanzada</h3>
                  <span className="muted">{KIND_HELP[form.kind]}</span>
                </div>
                <div className="section-panel-body" style={{ display: "grid", gap: 12 }}>
                  {isScaleForm ? (
                    <>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                        <label>
                          Modo de lectura
                          <select
                            value={form.advanced.adapter}
                            onChange={(event) => updateAdvancedField("adapter", event.target.value as AdvancedDraft["adapter"])}
                          >
                            <option value="real">Real por serial</option>
                            <option value="simulated">Simulado</option>
                          </select>
                        </label>
                        <label>
                          Baudrate
                          <input value={form.advanced.baudrate} onChange={(event) => updateAdvancedField("baudrate", event.target.value)} placeholder="9600" />
                        </label>
                        <label>
                          Bytesize
                          <input value={form.advanced.bytesize} onChange={(event) => updateAdvancedField("bytesize", event.target.value)} placeholder="8" />
                        </label>
                        <label>
                          Paridad
                          <select value={form.advanced.parity} onChange={(event) => updateAdvancedField("parity", event.target.value)}>
                            <option value="N">Ninguna</option>
                            <option value="E">Par</option>
                            <option value="O">Impar</option>
                            <option value="M">Mark</option>
                            <option value="S">Space</option>
                          </select>
                        </label>
                        <label>
                          Stop bits
                          <select value={form.advanced.stopbits} onChange={(event) => updateAdvancedField("stopbits", event.target.value)}>
                            <option value="1">1</option>
                            <option value="1.5">1.5</option>
                            <option value="2">2</option>
                          </select>
                        </label>
                        <label>
                          Timeout (s)
                          <input value={form.advanced.timeout} onChange={(event) => updateAdvancedField("timeout", event.target.value)} placeholder="1.5" />
                        </label>
                        <label>
                          Encoding
                          <input value={form.advanced.encoding} onChange={(event) => updateAdvancedField("encoding", event.target.value)} placeholder="utf-8" />
                        </label>
                        <label>
                          Query / comando
                          <input value={form.advanced.query} onChange={(event) => updateAdvancedField("query", event.target.value)} placeholder="W" />
                          <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
                            Si tu báscula usa el protocolo Standard Scale, prueba con <code>W</code>.
                          </div>
                        </label>
                        <label>
                          Peso mínimo
                          <input value={form.advanced.min_weight} onChange={(event) => updateAdvancedField("min_weight", event.target.value)} placeholder="0" />
                        </label>
                        <label>
                          Peso máximo
                          <input value={form.advanced.max_weight} onChange={(event) => updateAdvancedField("max_weight", event.target.value)} placeholder="30000" />
                        </label>
                      </div>
                      <div className="muted" style={{ fontSize: "0.8rem" }}>
                        Si la báscula ya está calibrada, normalmente solo necesitas puerto, baudrate, paridad, bytesize, stopbits y timeout.
                      </div>
                    </>
                  ) : null}

                  {isPrinterForm ? (
                    <div className="muted" style={{ fontSize: "0.85rem" }}>
                      La impresora normalmente solo requiere puerto físico y una prueba de impresión. Si cambia el formato del ticket, el backend puede ajustar el comportamiento sin tocar esta ficha.
                    </div>
                  ) : null}

                  {!isScaleForm && !isPrinterForm ? (
                    <div className="muted" style={{ fontSize: "0.85rem" }}>
                      Este tipo de dispositivo puede guardar metadata libre para integraciones futuras.
                    </div>
                  ) : null}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  {selectedDevice ? (
                    <button type="button" className="btn-danger" onClick={() => void removeDevice(selectedDevice)} disabled={isSaving || deletingId === selectedDevice.id}>
                      {deletingId === selectedDevice.id ? "Eliminando..." : "Eliminar dispositivo"}
                    </button>
                  ) : null}
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button type="button" className="btn-secondary" onClick={closeDeviceModal} disabled={isSaving}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn-primary" disabled={isSaving}>
                    {isSaving ? "Guardando..." : selectedDevice ? "Guardar cambios" : "Crear dispositivo"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </Page>
  );
}
