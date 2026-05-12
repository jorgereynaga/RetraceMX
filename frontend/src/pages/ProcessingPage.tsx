import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../api/resources";
import { Page } from "../components/Page";
import type { CollectionCenter, InventoryMovement, LotTraceReport, Material, MaterialProcess, ProcessType } from "../types";

type ProcessFormState = {
  process_type: string;
  collection_center: string;
  process_date: string;
  notes: string;
};

type LineFormState = {
  process: string;
  material: string;
  quantity: string;
  unit: string;
  source_inventory_reference: string;
  lot_code: string;
  waste_type: "merma" | "waste" | "loss";
  notes: string;
};

function emptyProcessForm(): ProcessFormState {
  return { process_type: "", collection_center: "", process_date: "", notes: "" };
}

function emptyLineForm(processId = ""): LineFormState {
  return {
    process: processId,
    material: "",
    quantity: "",
    unit: "kg",
    source_inventory_reference: "",
    lot_code: "",
    waste_type: "merma",
    notes: "",
  };
}

function formatKg(value?: string | number | null) {
  const parsed = typeof value === "string" ? Number(value) : Number(value ?? 0);
  return Number(parsed || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatMoney(value?: string | number | null) {
  const parsed = typeof value === "string" ? Number(value) : Number(value ?? 0);
  return "$" + Number(parsed || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.toLocaleDateString("es-MX")} ${date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}`;
}

export function ProcessingPage() {
  const [processTypes, setProcessTypes] = useState<ProcessType[]>([]);
  const [processes, setProcesses] = useState<MaterialProcess[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [centers, setCenters] = useState<CollectionCenter[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [selectedProcessId, setSelectedProcessId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [processForm, setProcessForm] = useState<ProcessFormState>(emptyProcessForm());
  const [inputForm, setInputForm] = useState<LineFormState>(emptyLineForm());
  const [outputForm, setOutputForm] = useState<LineFormState>(emptyLineForm());
  const [wasteForm, setWasteForm] = useState<LineFormState>(emptyLineForm());
  const [lotTraceCode, setLotTraceCode] = useState("");
  const [lotTrace, setLotTrace] = useState<LotTraceReport | null>(null);
  const [lotTraceLoading, setLotTraceLoading] = useState(false);

  async function refresh() {
    const [types, rows, mats, cts, invMoves] = await Promise.all([
      api.processTypes().catch(() => []),
      api.materialProcesses().catch(() => []),
      api.materials().catch(() => []),
      api.centers().catch(() => []),
      api.inventoryMovements().catch(() => []),
    ]);
    setProcessTypes(types);
    setProcesses(rows);
    setMaterials(mats);
    setCenters(cts);
    setMovements(invMoves);
  }

  useEffect(() => {
    void refresh();
  }, []);

  const selectedProcess = useMemo(
    () => processes.find((process) => process.id === selectedProcessId) ?? null,
    [processes, selectedProcessId],
  );

  const selectedProcessLotCodes = useMemo(
    () => new Set((selectedProcess?.outputs ?? []).map((output) => output.lot_code).filter(Boolean)),
    [selectedProcess],
  );

  const selectedProcessMovements = useMemo(() => {
    if (!selectedProcess) return [];
    return movements.filter((movement) => movement.process === selectedProcess.id || (movement.lot_code && selectedProcessLotCodes.has(movement.lot_code)));
  }, [movements, selectedProcess, selectedProcessLotCodes]);

  const selectedProcessMovementSummary = useMemo(() => {
    const summary = {
      count: 0,
      inputOutKg: 0,
      outputInKg: 0,
      wasteOutKg: 0,
      saleOutKg: 0,
    };
    for (const movement of selectedProcessMovements) {
      const qty = Number(movement.quantity_kg || 0);
      summary.count += 1;
      if (movement.movement_type === "process_input_out") summary.inputOutKg += qty;
      if (movement.movement_type === "process_output_in") summary.outputInKg += qty;
      if (movement.movement_type === "process_waste_out") summary.wasteOutKg += qty;
      if (movement.movement_type === "sale_out") summary.saleOutKg += qty;
    }
    return summary;
  }, [selectedProcessMovements]);

  useEffect(() => {
    if (!selectedProcess) {
      setInputForm(emptyLineForm());
      setOutputForm(emptyLineForm());
      setWasteForm(emptyLineForm());
      setLotTraceCode("");
      return;
    }
    setInputForm(emptyLineForm(selectedProcess.id));
    setOutputForm(emptyLineForm(selectedProcess.id));
    setWasteForm(emptyLineForm(selectedProcess.id));
    setLotTraceCode(selectedProcess.outputs?.[0]?.lot_code ?? "");
  }, [selectedProcess]);

  async function handleCreateProcess(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    try {
      const created = await api.materialProcessCreate(processForm);
      setProcessForm(emptyProcessForm());
      setSelectedProcessId(created.id);
      setMessage("Proceso creado en borrador.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo crear el proceso");
    }
  }

  async function addInput(event: FormEvent) {
    event.preventDefault();
    if (!selectedProcess) return;
    setMessage(null);
    try {
      await api.materialProcessInputCreate(inputForm);
      setInputForm(emptyLineForm(selectedProcess.id));
      setMessage("Entrada agregada.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo agregar la entrada");
    }
  }

  async function addOutput(event: FormEvent) {
    event.preventDefault();
    if (!selectedProcess) return;
    setMessage(null);
    try {
      await api.materialProcessOutputCreate(outputForm);
      setOutputForm(emptyLineForm(selectedProcess.id));
      setMessage("Salida agregada.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo agregar la salida");
    }
  }

  async function addWaste(event: FormEvent) {
    event.preventDefault();
    if (!selectedProcess) return;
    setMessage(null);
    try {
      await api.materialProcessWasteCreate(wasteForm);
      setWasteForm(emptyLineForm(selectedProcess.id));
      setMessage("Merma agregada.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo agregar la merma");
    }
  }

  async function confirmProcess() {
    if (!selectedProcess) return;
    setMessage(null);
    try {
      await api.materialProcessConfirm(selectedProcess.id);
      setMessage("Proceso confirmado e impactado en inventario.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo confirmar el proceso");
    }
  }

  async function cancelProcess() {
    if (!selectedProcess) return;
    const reason = window.prompt("Motivo de cancelacion", "") ?? "";
    if (!reason && reason !== "") return;
    setMessage(null);
    try {
      await api.materialProcessCancel(selectedProcess.id, reason);
      setMessage("Proceso cancelado.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cancelar el proceso");
    }
  }

  async function traceLot(event: FormEvent) {
    event.preventDefault();
    const code = lotTraceCode.trim();
    if (!code) {
      setLotTrace(null);
      setMessage("Escribe un codigo de lote para consultar.");
      return;
    }
    setLotTraceLoading(true);
    setMessage(null);
    try {
      const trace = await api.reportLotTrace(code);
      setLotTrace(trace);
    } catch (error) {
      setLotTrace(null);
      setMessage(error instanceof Error ? error.message : "No se pudo consultar la trazabilidad del lote");
    } finally {
      setLotTraceLoading(false);
    }
  }

  return (
    <Page title="Procesamiento de materiales" actions={<span className="muted">Procesos internos, merma y trazabilidad</span>}>
      {message ? <div className="info-banner" style={{ marginBottom: 16 }}>{message}</div> : null}

      <section className="metric-grid" style={{ marginBottom: 16, gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
        <div className="metric-panel"><span>Procesos</span><strong>{processes.length}</strong></div>
        <div className="metric-panel"><span>Borradores</span><strong>{processes.filter((p) => p.status === "draft").length}</strong></div>
        <div className="metric-panel"><span>Confirmados</span><strong>{processes.filter((p) => p.status === "confirmed").length}</strong></div>
        <div className="metric-panel"><span>Movimientos</span><strong>{movements.length}</strong></div>
      </section>

      <div className="processing-top-grid" style={{ marginBottom: 16 }}>
        <form className="card" onSubmit={handleCreateProcess}>
          <div className="card-header">
            <strong>Nuevo proceso</strong>
            <span className="muted">Apertura operativa en borrador</span>
          </div>
          <div className="card-body grid-form">
            <label>
              Tipo de proceso
              <select value={processForm.process_type} onChange={(e) => setProcessForm((c) => ({ ...c, process_type: e.target.value }))} required>
                <option value="">Seleccionar</option>
                {processTypes.map((type) => (
                  <option key={type.id} value={type.id}>{type.code} · {type.name}</option>
                ))}
              </select>
            </label>
            <label>
              Centro de acopio
              <select value={processForm.collection_center} onChange={(e) => setProcessForm((c) => ({ ...c, collection_center: e.target.value }))} required>
                <option value="">Seleccionar</option>
                {centers.map((center) => (
                  <option key={center.id} value={center.id}>{center.code} · {center.name}</option>
                ))}
              </select>
            </label>
            <label>
              Fecha del proceso
              <input type="datetime-local" value={processForm.process_date} onChange={(e) => setProcessForm((c) => ({ ...c, process_date: e.target.value }))} />
            </label>
            <label className="full-width-form-field">
              Notas
              <textarea value={processForm.notes} onChange={(e) => setProcessForm((c) => ({ ...c, notes: e.target.value }))} rows={4} />
            </label>
            <div className="info-banner full-width-form-field" style={{ display: "grid", gap: 6 }}>
              <strong>Flujo sugerido</strong>
              <span>1. Crear proceso</span>
              <span>2. Agregar entradas y salidas</span>
              <span>3. Revisar merma</span>
              <span>4. Confirmar para afectar inventario</span>
            </div>
            <button type="submit">Crear proceso</button>
          </div>
        </form>

        <section className="card">
          <div className="card-header">
            <strong>Guía operativa</strong>
            <span className="muted">Procesamiento centrado en la operación</span>
          </div>
          <div className="card-body" style={{ display: "grid", gap: 12 }}>
            <div className="info-banner" style={{ display: "grid", gap: 8 }}>
              <strong>Qué hace esta pantalla</strong>
              <span>Gestiona procesos en borrador, captura entradas, salidas, merma y confirma el impacto en inventario.</span>
              <span>Los tipos de proceso ya se administran desde Catálogos para mantener esta pantalla limpia y rápida.</span>
              <a className="ghost-button" href="/process-types" style={{ justifySelf: "start", marginTop: 4 }}>Ir a tipos de procesos</a>
            </div>
          </div>
        </section>
      </div>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <strong>Procesos</strong>
          <span className="muted">{selectedProcess ? selectedProcess.folio : "Selecciona uno para editar"}</span>
        </div>
        <div className="card-body" style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Folio</th>
                <th>Tipo</th>
                <th>Centro</th>
                <th>Estado</th>
                <th>Entradas</th>
                <th>Salidas</th>
                <th>Merma</th>
                <th>Inventario</th>
              </tr>
            </thead>
            <tbody>
              {processes.map((process) => {
                const processMoves = movements.filter((movement) => movement.process === process.id);
                return (
                  <tr
                    key={process.id}
                    onClick={() => setSelectedProcessId(process.id)}
                    style={{ cursor: "pointer", background: process.id === selectedProcessId ? "rgba(124, 58, 237, 0.10)" : undefined }}
                  >
                    <td>{process.folio}</td>
                    <td>{process.process_type_name ?? process.process_type}</td>
                    <td>{process.collection_center_name ?? process.collection_center}</td>
                    <td><span className={`badge ${process.status === "confirmed" ? "badge-green" : process.status === "cancelled" ? "badge-gray" : "badge-blue"}`}>{process.status}</span></td>
                    <td>{process.inputs_count ?? 0}</td>
                    <td>{process.outputs_count ?? 0}</td>
                    <td>{process.wastes_count ?? 0}</td>
                    <td>{processMoves.length}</td>
                  </tr>
                );
              })}
              {processes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="muted">No hay procesos registrados.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {selectedProcess ? (
        <div className="processing-workspace">
          <section className="card">
            <div className="card-header">
              <strong>Detalle del proceso</strong>
              <span className="badge badge-blue">{selectedProcess.status}</span>
            </div>
            <div className="card-body" style={{ display: "grid", gap: 16 }}>
              <div className="metric-grid" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
                <div className="metric-panel"><span>Folio</span><strong>{selectedProcess.folio}</strong></div>
                <div className="metric-panel"><span>Tipo</span><strong>{selectedProcess.process_type_name ?? selectedProcess.process_type}</strong></div>
                <div className="metric-panel"><span>Centro</span><strong>{selectedProcess.collection_center_name ?? selectedProcess.collection_center}</strong></div>
                <div className="metric-panel"><span>Estado</span><strong>{selectedProcess.status}</strong></div>
              </div>
              <div className="metric-grid" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
                <div className="metric-panel"><span>Entradas</span><strong>{selectedProcess.inputs_count ?? 0}</strong></div>
                <div className="metric-panel"><span>Salidas</span><strong>{selectedProcess.outputs_count ?? 0}</strong></div>
                <div className="metric-panel"><span>Merma</span><strong>{selectedProcess.wastes_count ?? 0}</strong></div>
                <div className="metric-panel"><span>Movimientos</span><strong>{selectedProcessMovements.length}</strong></div>
              </div>
              <div className="info-banner" style={{ display: "grid", gap: 6 }}>
                <strong>Impacto en inventario</strong>
                <span>
                  {selectedProcess.status === "confirmed"
                    ? "Este proceso ya descontó entradas y generó salidas/merma en inventario."
                    : "Este proceso aun no impacta inventario; se materializa al confirmar."}
                </span>
                <span>Movimientos asociados: {selectedProcessMovementSummary.count}</span>
              </div>
              <div className="inline-form">
                <button type="button" onClick={confirmProcess} disabled={selectedProcess.status !== "draft"}>
                  Confirmar y afectar inventario
                </button>
                <button type="button" className="ghost-button" onClick={cancelProcess}>
                  Cancelar
                </button>
              </div>
              <div className="muted">
                La confirmación descuenta entradas, genera salidas procesadas, registra merma y deja trazabilidad en inventario.
              </div>
            </div>
          </section>

          <div className="processing-three-up">
            <form className="card" onSubmit={addInput}>
              <div className="card-header">
                <strong>Entradas</strong>
                <span className="muted">Consumo de inventario</span>
              </div>
              <div className="card-body grid-form">
                <label>
                  Material
                  <select value={inputForm.material} onChange={(e) => setInputForm((c) => ({ ...c, material: e.target.value }))} required>
                    <option value="">Seleccionar</option>
                    {materials.map((material) => (
                      <option key={material.id} value={material.id}>{material.code} · {material.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Cantidad
                  <input type="number" value={inputForm.quantity} onChange={(e) => setInputForm((c) => ({ ...c, quantity: e.target.value }))} min={0} step={0.001} required />
                </label>
                <label>
                  Unidad
                  <input value={inputForm.unit} onChange={(e) => setInputForm((c) => ({ ...c, unit: e.target.value }))} />
                </label>
                <label>
                  Ref. inventario
                  <input value={inputForm.source_inventory_reference} onChange={(e) => setInputForm((c) => ({ ...c, source_inventory_reference: e.target.value }))} />
                </label>
                <button type="submit" disabled={selectedProcess.status !== "draft"}>Agregar entrada</button>
              </div>
            </form>

            <form className="card" onSubmit={addOutput}>
              <div className="card-header">
                <strong>Salidas</strong>
                <span className="muted">Material procesado listo para venta</span>
              </div>
              <div className="card-body grid-form">
                <label>
                  Material
                  <select value={outputForm.material} onChange={(e) => setOutputForm((c) => ({ ...c, material: e.target.value }))} required>
                    <option value="">Seleccionar</option>
                    {materials.map((material) => (
                      <option key={material.id} value={material.id}>{material.code} · {material.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Cantidad
                  <input type="number" value={outputForm.quantity} onChange={(e) => setOutputForm((c) => ({ ...c, quantity: e.target.value }))} min={0} step={0.001} required />
                </label>
                <label>
                  Unidad
                  <input value={outputForm.unit} onChange={(e) => setOutputForm((c) => ({ ...c, unit: e.target.value }))} />
                </label>
                <label>
                  Lote de salida
                  <input value={outputForm.lot_code} onChange={(e) => setOutputForm((c) => ({ ...c, lot_code: e.target.value }))} placeholder="LT-2026-0001" />
                </label>
                <button type="submit" disabled={selectedProcess.status !== "draft"}>Agregar salida</button>
              </div>
            </form>

            <form className="card" onSubmit={addWaste}>
              <div className="card-header">
                <strong>Merma</strong>
                <span className="muted">Desperdicio o pérdida</span>
              </div>
              <div className="card-body grid-form">
                <label>
                  Material
                  <select value={wasteForm.material ?? ""} onChange={(e) => setWasteForm((c) => ({ ...c, material: e.target.value }))}>
                    <option value="">Opcional</option>
                    {materials.map((material) => (
                      <option key={material.id} value={material.id}>{material.code} · {material.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Tipo
                  <select value={wasteForm.waste_type} onChange={(e) => setWasteForm((c) => ({ ...c, waste_type: e.target.value as LineFormState["waste_type"] }))}>
                    <option value="merma">Merma</option>
                    <option value="waste">Desperdicio</option>
                    <option value="loss">Perdida</option>
                  </select>
                </label>
                <label>
                  Cantidad
                  <input type="number" value={wasteForm.quantity} onChange={(e) => setWasteForm((c) => ({ ...c, quantity: e.target.value }))} min={0} step={0.001} required />
                </label>
                <label>
                  Notas
                  <textarea value={wasteForm.notes} onChange={(e) => setWasteForm((c) => ({ ...c, notes: e.target.value }))} rows={3} />
                </label>
                <button type="submit" disabled={selectedProcess.status !== "draft"}>Agregar merma</button>
              </div>
            </form>
          </div>

          <div className="processing-two-up">
            <section className="card">
              <div className="card-header">
                <strong>Impacto en inventario</strong>
                <span className="muted">Verifica que el proceso ya movió stock</span>
              </div>
              <div className="card-body" style={{ display: "grid", gap: 12 }}>
                <div className="metric-grid" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
                  <div className="metric-panel"><span>Movimientos</span><strong>{selectedProcessMovementSummary.count}</strong></div>
                  <div className="metric-panel"><span>Entrada salida</span><strong>{formatKg(selectedProcessMovementSummary.inputOutKg)} kg</strong></div>
                  <div className="metric-panel"><span>Salida procesada</span><strong>{formatKg(selectedProcessMovementSummary.outputInKg)} kg</strong></div>
                  <div className="metric-panel"><span>Merma</span><strong>{formatKg(selectedProcessMovementSummary.wasteOutKg)} kg</strong></div>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Tipo</th>
                        <th>Centro</th>
                        <th>Material</th>
                        <th>Lote</th>
                        <th>Cantidad</th>
                        <th>Importe</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedProcessMovements.map((movement) => (
                        <tr key={movement.id}>
                          <td>{formatDateTime(movement.occurred_at)}</td>
                          <td><span className="badge badge-blue">{movement.movement_type_label ?? movement.movement_type}</span></td>
                          <td>{movement.collection_center_name ?? movement.collection_center}</td>
                          <td style={{ fontWeight: 600 }}>{movement.material_name ?? movement.material}</td>
                          <td>{movement.lot_code || movement.source_reference || "—"}</td>
                          <td>{formatKg(movement.quantity_kg)} kg</td>
                          <td>{formatMoney(movement.amount)}</td>
                        </tr>
                      ))}
                      {selectedProcessMovements.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="muted">Aún no hay movimientos de inventario para este proceso.</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            <section className="card">
              <div className="card-header">
                <strong>Trazabilidad por lote</strong>
                <span className="muted">Origen, proceso y venta</span>
              </div>
              <form className="card-body grid-form" onSubmit={traceLot}>
                <label>
                  Codigo de lote
                  <input value={lotTraceCode} onChange={(e) => setLotTraceCode(e.target.value)} placeholder={selectedProcess.outputs?.[0]?.lot_code ?? "LT-2026-0001"} />
                </label>
                <button type="submit" disabled={lotTraceLoading}>{lotTraceLoading ? "Consultando..." : "Buscar lote"}</button>
                {lotTrace ? (
                  <div style={{ display: "grid", gap: 12, gridColumn: "1 / -1" }}>
                    <div className="metric-grid" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
                      <div className="metric-panel"><span>Procesos</span><strong>{lotTrace.processes.length}</strong></div>
                      <div className="metric-panel"><span>Salidas</span><strong>{lotTrace.process_outputs.length}</strong></div>
                      <div className="metric-panel"><span>Ventas</span><strong>{lotTrace.sale_items.length}</strong></div>
                      <div className="metric-panel"><span>Movimientos</span><strong>{lotTrace.inventory_movements.length}</strong></div>
                    </div>
                    <div className="muted">Lote consultado: <strong>{lotTrace.lot_code}</strong></div>
                    <div style={{ display: "grid", gap: 8, maxHeight: 320, overflowY: "auto" }}>
                      {lotTrace.process_outputs.map((output) => (
                        <div key={output.id} className="info-banner">
                          <strong>{output.material_name}</strong>
                          <div>{output.process_folio} · {formatKg(output.quantity)} {output.unit} · Lote {output.lot_code}</div>
                        </div>
                      ))}
                      {lotTrace.sale_items.map((item) => (
                        <div key={item.id} className="info-banner" style={{ background: "rgba(10, 132, 255, 0.08)" }}>
                          <strong>Venta {item.sale_folio}</strong>
                          <div>{item.material_name} · {formatKg(item.quantity_kg)} kg · {formatMoney(item.amount)}</div>
                        </div>
                      ))}
                      {lotTrace.inventory_movements.map((movement) => (
                        <div key={movement.id} className="info-banner" style={{ background: "rgba(34, 197, 94, 0.08)" }}>
                          <strong>{movement.movement_type_label}</strong>
                          <div>{movement.collection_center_name} · {movement.material_name} · {formatKg(movement.quantity_kg)} kg</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </form>
            </section>
          </div>

          <section className="card">
            <div className="card-header">
              <strong>Entradas, salidas y merma</strong>
              <span className="muted">Detalle operacional</span>
            </div>
            <div className="card-body processing-three-up">
              <div className="section-panel">
                <div className="section-panel-header"><h3>Entradas registradas</h3></div>
                <div className="section-panel-body">
                  <ul className="compact-list">
                    {selectedProcess.inputs?.map((input) => (
                      <li key={input.id}>{input.material_name ?? input.material} - {formatKg(input.quantity)} {input.unit}</li>
                    )) ?? <li className="muted">Sin entradas</li>}
                  </ul>
                </div>
              </div>
              <div className="section-panel">
                <div className="section-panel-header"><h3>Salidas registradas</h3></div>
                <div className="section-panel-body">
                  <ul className="compact-list">
                    {selectedProcess.outputs?.map((output) => (
                      <li key={output.id}>{output.material_name ?? output.material} - {formatKg(output.quantity)} {output.unit} · Lote {output.lot_code || "—"}</li>
                    )) ?? <li className="muted">Sin salidas</li>}
                  </ul>
                </div>
              </div>
              <div className="section-panel">
                <div className="section-panel-header"><h3>Merma registrada</h3></div>
                <div className="section-panel-body">
                  <ul className="compact-list">
                    {selectedProcess.wastes?.map((waste) => (
                      <li key={waste.id}>{waste.waste_type_label ?? waste.waste_type} - {formatKg(waste.quantity)} {waste.unit}</li>
                    )) ?? <li className="muted">Sin merma</li>}
                  </ul>
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </Page>
  );
}

