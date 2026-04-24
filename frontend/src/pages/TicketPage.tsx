import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/resources";
import type { AuditLog, CollectionCenter, Device, Material, PriceSuggestion, PrintLog, PurchaseOperation, TicketItem } from "../types";
import { Page } from "../components/Page";

type LiveScaleReading = {
  device_id: string;
  device_name: string;
  kind: string;
  raw_value: string;
  weight_kg: string;
  is_stable: boolean;
  is_manual_fallback: boolean;
  captured_at: string;
};

function methodLabel(method: TicketItem["method"]) {
  const labels: Record<TicketItem["method"], string> = {
    vehicle_differential: "Diferencia vehicular",
    secondary_direct: "Báscula secundaria",
    manual_contingency: "Contingencia manual",
  };
  return labels[method];
}

export function TicketPage() {
  const [operations, setOperations] = useState<PurchaseOperation[]>([]);
  const [centers, setCenters] = useState<CollectionCenter[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedOperationId, setSelectedOperationId] = useState("");
  const [operationSearch, setOperationSearch] = useState("");
  const [method, setMethod] = useState<TicketItem["method"]>("vehicle_differential");
  const [materialId, setMaterialId] = useState("");
  const [grossWeightKg, setGrossWeightKg] = useState("0");
  const [tareWeightKg, setTareWeightKg] = useState("0");
  const [mermaKg, setMermaKg] = useState("0");
  const [unitPrice, setUnitPrice] = useState("0");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [items, setItems] = useState<TicketItem[]>([]);
  const [prints, setPrints] = useState<PrintLog[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [selectedAdjustmentAuditId, setSelectedAdjustmentAuditId] = useState("");
  const [printNote, setPrintNote] = useState<string | null>(null);
  const [availableStock, setAvailableStock] = useState<string | null>(null);
  const [priceSuggestion, setPriceSuggestion] = useState<PriceSuggestion | null>(null);
  const [liveScale, setLiveScale] = useState<LiveScaleReading | null>(null);
  const [scaleTrail, setScaleTrail] = useState<string[]>([]);
  const [pendingGrossWeight, setPendingGrossWeight] = useState("");
  const priceLookupRef = useRef(0);

  useEffect(() => {
    refresh();
    api.centers().then(setCenters).catch(() => setCenters([]));
    api.materials().then(setMaterials).catch(() => setMaterials([]));
    api.devices().then(setDevices).catch(() => setDevices([]));
  }, []);

  async function refresh() {
    const ops = await api.operations().catch(() => []);
    setOperations(ops as PurchaseOperation[]);
    const ticketItems = await api.ticketItems().catch(() => []);
    setItems(ticketItems as TicketItem[]);
    const printLogs = await api.printLogs().catch(() => []);
    setPrints(printLogs as PrintLog[]);
    const audits = await api.auditLogs().catch(() => []);
    setAuditLogs(audits as AuditLog[]);
  }

  const selectedOperation = useMemo(
    () => operations.find((operation) => operation.id === selectedOperationId) ?? null,
    [operations, selectedOperationId],
  );

  const selectedItems = useMemo(
    () => items.filter((item) => item.operation === selectedOperationId),
    [items, selectedOperationId],
  );

  const selectedPrints = useMemo(
    () => prints.filter((printLog) => printLog.operation === selectedOperationId),
    [prints, selectedOperationId],
  );

  const adjustedItemIds = useMemo(() => {
    const ids = new Set<string>();
    for (const auditLog of auditLogs) {
      if (auditLog.action === "adjust_ticket_item_after_print") {
        ids.add(auditLog.entity_id);
      }
    }
    return ids;
  }, [auditLogs]);

  const latestAdjustmentByItemId = useMemo(() => {
    const map = new Map<string, AuditLog>();
    for (const auditLog of auditLogs) {
      if (auditLog.action !== "adjust_ticket_item_after_print") continue;
      const current = map.get(auditLog.entity_id);
      if (!current || new Date(auditLog.created_at).getTime() > new Date(current.created_at).getTime()) {
        map.set(auditLog.entity_id, auditLog);
      }
    }
    return map;
  }, [auditLogs]);

  const selectedAdjustmentAudit = useMemo(
    () => auditLogs.find((auditLog) => auditLog.id === selectedAdjustmentAuditId) ?? null,
    [auditLogs, selectedAdjustmentAuditId],
  );

  const materialById = useMemo(
    () => new Map(materials.map((material) => [material.id, material.name])),
    [materials],
  );

  const centerById = useMemo(
    () => new Map(centers.map((center) => [center.id, center])),
    [centers],
  );

  const selectedDeviceInfo = useMemo(() => {
    if (!selectedOperation || method === "manual_contingency") return null;
    const preferredKind = method === "vehicle_differential" ? "vehicle_scale" : "secondary_scale";
    const device =
      devices.find(
        (item) => item.collection_center === selectedOperation.collection_center && item.kind === preferredKind,
      ) ?? devices.find((item) => item.kind === preferredKind) ?? null;
    if (!device) return null;
    return {
      id: device.id,
      label: `${device.name} · ${device.kind}`,
    };
  }, [devices, method, selectedOperation]);
  const selectedDeviceId = selectedDeviceInfo?.id ?? "";

  async function refreshPricingForMaterial(collectionCenterId: string, nextMaterialId: string) {
    const lookupId = ++priceLookupRef.current;
    try {
      const [stockResult, suggestionResult] = await Promise.allSettled([
        api.saleStock(collectionCenterId, nextMaterialId),
        api.priceSuggestion(collectionCenterId, nextMaterialId),
      ]);
      if (lookupId !== priceLookupRef.current) return;
      if (stockResult.status === "fulfilled") {
        setAvailableStock(stockResult.value.available_kg);
      } else {
        setAvailableStock(null);
      }
      if (suggestionResult.status === "fulfilled") {
        setPriceSuggestion(suggestionResult.value);
        setUnitPrice(suggestionResult.value.unit_price ?? "0");
      } else {
        setPriceSuggestion(null);
        setUnitPrice("0");
      }
    } catch {
      if (lookupId !== priceLookupRef.current) return;
      setAvailableStock(null);
      setPriceSuggestion(null);
      setUnitPrice("0");
    }
  }

  const favoriteMaterialId = useMemo(() => {
    const materialCounts = new Map<string, number>();
    for (const item of selectedItems) {
      materialCounts.set(item.material, (materialCounts.get(item.material) ?? 0) + 1);
    }
    let favoriteId = "";
    let favoriteCount = 0;
    for (const [materialIdKey, count] of materialCounts.entries()) {
      if (count > favoriteCount) {
        favoriteId = materialIdKey;
        favoriteCount = count;
      }
    }
    return favoriteId;
  }, [selectedItems]);

  useEffect(() => {
    setPendingGrossWeight("");
    setLiveScale(null);
  }, [selectedOperationId]);

  useEffect(() => {
    if (favoriteMaterialId) {
      setMaterialId(favoriteMaterialId);
    } else if (selectedOperationId) {
      setMaterialId("");
    }
  }, [favoriteMaterialId, selectedOperationId]);

  useEffect(() => {
    const collectionCenterId = selectedOperation?.collection_center;
    if (!collectionCenterId || !materialId) {
      setAvailableStock(null);
      setPriceSuggestion(null);
      setUnitPrice("0");
      return;
    }
    void refreshPricingForMaterial(collectionCenterId, materialId);
  }, [materialId, selectedOperation?.collection_center]);

  useEffect(() => {
    if (priceSuggestion?.found) {
      setUnitPrice(priceSuggestion.unit_price ?? "0");
    }
  }, [priceSuggestion]);

  useEffect(() => {
    const deviceId = selectedDeviceId;
    if (!deviceId) {
      setLiveScale(null);
      return;
    }

    let active = true;

    async function poll() {
      try {
        const reading = await api.deviceSimulateScale(deviceId);
        if (active) {
          setLiveScale(reading);
          setScaleTrail((current) => [...current.slice(-4), reading.weight_kg]);
        }
      } catch {
        if (active) {
          setLiveScale(null);
        }
      }
    }

    poll();
    const timer = window.setInterval(poll, 1800);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [selectedDeviceId]);

  function useLiveReadingAsGross() {
    if (!liveScale) return;
    if (!liveScale.is_stable) {
      setMessage("Espera a que la lectura se estabilice para usarla como peso base.");
      return;
    }
    setGrossWeightKg(liveScale.weight_kg);
    setMessage("Lectura aplicada como peso base.");
  }

  function handleMaterialChange(nextMaterialId: string) {
    setMaterialId(nextMaterialId);
    const collectionCenterId = selectedOperation?.collection_center;
    if (!collectionCenterId || !nextMaterialId) {
      setAvailableStock(null);
      setPriceSuggestion(null);
      setUnitPrice("0");
      return;
    }
    void refreshPricingForMaterial(collectionCenterId, nextMaterialId);
  }

  const filteredOperations = useMemo(() => {
    const query = operationSearch.trim().toLowerCase();
    if (!query) {
      return operations;
    }
    return operations.filter((operation) => {
      const folio = operation.folio.toLowerCase();
      const identifier = operation.id.toLowerCase();
      return folio.includes(query) || identifier.includes(query);
    });
  }, [operations, operationSearch]);

  function commitOperationSearch() {
    const query = operationSearch.trim().toLowerCase();
    if (!query) {
      setSelectedOperationId("");
      return;
    }
    const exactMatch =
      operations.find(
        (operation) => operation.folio.toLowerCase() === query || operation.id.toLowerCase() === query,
      ) ?? filteredOperations[0];
    if (exactMatch) {
      setSelectedOperationId(exactMatch.id);
      setOperationSearch(exactMatch.folio);
      return;
    }
    setMessage("No se encontró una operación con ese folio o ID.");
  }

  function captureInitialVehicleWeight() {
    if (!liveScale) {
      setMessage("No hay lectura de báscula disponible.");
      return;
    }
    if (!liveScale.is_stable) {
      setMessage("La báscula sigue fluctuando. Espera una lectura estable para capturar el peso inicial.");
      return;
    }
    setPendingGrossWeight(liveScale.weight_kg);
    setGrossWeightKg(liveScale.weight_kg);
    setTareWeightKg("0");
    setMessage(`Peso inicial capturado: ${liveScale.weight_kg}. Retira el material y registra la siguiente lectura.`);
  }

  async function submitTicketItem(payload: {
    gross: string;
    tare: string;
    merma: string;
    price: string;
  }) {
    await api.createTicketItem({
      operation: selectedOperationId,
      material: materialId,
      method,
      gross_weight_kg: payload.gross,
      tare_weight_kg: payload.tare,
      merma_kg: payload.merma,
      unit_price: payload.price,
      notes,
    });
  }

  function startEditingItem(item: TicketItem) {
    setEditingItemId(item.id);
    setMaterialId(item.material);
    setMethod(item.method);
    setGrossWeightKg(item.gross_weight_kg);
    setTareWeightKg(item.tare_weight_kg);
    setMermaKg(item.merma_kg);
    setUnitPrice(item.unit_price);
    setNotes((item as TicketItem & { notes?: string }).notes ?? "");
    setAdjustmentReason("");
    setMessage(`Editando partida ${item.id}.`);
  }

  function cancelEditingItem() {
    setEditingItemId("");
    setAdjustmentReason("");
    setMessage(null);
  }

  function openAdjustmentDetail(itemId: string) {
    const log = latestAdjustmentByItemId.get(itemId);
    if (!log) return;
    setSelectedAdjustmentAuditId(log.id);
  }

  function buildTicketPayload() {
    let gross = grossWeightKg;
    let tare = tareWeightKg;

    if (method === "vehicle_differential") {
      if (!pendingGrossWeight) {
        throw new Error("Primero captura el peso inicial del vehículo con la báscula estable.");
      }
      if (!liveScale) {
        throw new Error("No hay lectura de tara disponible.");
      }
      if (!liveScale.is_stable) {
        throw new Error("Espera una lectura estable para registrar la diferencia.");
      }
      gross = pendingGrossWeight;
      tare = liveScale.weight_kg;
    }

    if (method === "secondary_direct") {
      if (!liveScale) {
        throw new Error("No hay lectura de báscula disponible para la partida.");
      }
      if (!liveScale.is_stable) {
        throw new Error("Espera una lectura estable para registrar la partida.");
      }
      gross = liveScale.weight_kg;
      tare = "0";
    }

    if (method === "manual_contingency") {
      if (!grossWeightKg) {
        throw new Error("Captura el peso base manual.");
      }
      gross = grossWeightKg;
      tare = tareWeightKg || "0";
    }

    return { gross, tare, merma: mermaKg, price: unitPrice };
  }

  async function saveTicketItem() {
    const payload = buildTicketPayload();
      if (editingItemId) {
        if (selectedOperation?.print_status === "pending") {
          await api.updateTicketItem(editingItemId, {
          operation: selectedOperationId,
          material: materialId,
          method,
          gross_weight_kg: payload.gross,
          tare_weight_kg: payload.tare,
          merma_kg: payload.merma,
          unit_price: payload.price,
          notes,
        });
        } else {
          await api.adjustTicketItem(editingItemId, {
          material: materialId,
          method,
          gross_weight_kg: payload.gross,
          tare_weight_kg: payload.tare,
          merma_kg: payload.merma,
          unit_price: payload.price,
          notes,
          reason: adjustmentReason || notes || "Ajuste posterior a impresión",
          });
          setPrintNote("Ajuste auditado registrado. Será necesario reimprimir el ticket.");
        }
        setMessage("Partida actualizada.");
      } else {
      await submitTicketItem(payload);
      setMessage("Partida registrada.");
    }
    if (method === "vehicle_differential") {
      setPendingGrossWeight(payload.tare);
      setGrossWeightKg(payload.tare);
    }
      setEditingItemId("");
      setAdjustmentReason("");
      setSelectedAdjustmentAuditId("");
      await refresh();
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    try {
      await saveTicketItem();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo registrar la partida");
    }
  }

  async function quickRegisterFromScale() {
    setMessage(null);
    try {
      if (!selectedOperationId || !materialId) {
        throw new Error("Selecciona operación y material.");
      }
      await saveTicketItem();
      setMessage("Partida registrada desde báscula.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo registrar desde báscula");
    }
  }

  async function printTicket() {
    if (!selectedOperation) return;
    setPrintNote(null);
    try {
      const payload = {
        folio: selectedOperation.folio,
        operation_id: selectedOperation.id,
        items: selectedItems,
        totals: {
          total_weight_kg: selectedOperation.total_weight_kg,
          total_amount: selectedOperation.total_amount,
        },
      };
      await api.operationPrint(selectedOperation.id, payload);
      setPrintNote("Ticket enviado a impresión simulada.");
      await refresh();
    } catch (error) {
      setPrintNote(error instanceof Error ? error.message : "No se pudo imprimir");
    }
  }

  async function confirmOperation() {
    if (!selectedOperation) return;
    setMessage(null);
    try {
      await api.operationStatusChange(selectedOperation.id, "confirmed", "Confirmación desde ticket");
      setMessage("Operación confirmada.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo confirmar la operación");
    }
  }

  async function reprintLast() {
    const last = selectedPrints[0];
    if (!last) return;
    try {
      await api.reprintLog(last.id);
      setPrintNote("Reimpresión auditada registrada.");
      await refresh();
    } catch (error) {
      setPrintNote(error instanceof Error ? error.message : "No se pudo reimprimir");
    }
  }

  return (
    <Page title="Ticket operativo" actions={<span className="muted">Partidas, impresión y confirmación</span>}>
      <div className="grid" style={{ gridTemplateColumns: "1.2fr 1fr 1fr", gap: 16 }}>
        <label>
          Buscar operación
          <input
            value={operationSearch}
            onChange={(e) => setOperationSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitOperationSearch();
              }
            }}
            placeholder="Escanea folio o ID y presiona Enter"
            inputMode="search"
          />
          <div className="muted" style={{ marginTop: 4 }}>
            También puedes usar el selector manual si lo prefieres.
          </div>
        </label>
        <div className="metric-panel">
          <span>Total operación</span>
          <strong>{selectedOperation?.total_amount ?? "0.00"}</strong>
          <div className="muted" style={{ marginTop: 6 }}>
            Folio: {selectedOperation?.folio ?? "-"}
          </div>
        </div>
          <div className="metric-panel">
            <span>Inventario disponible en centro</span>
            <strong>{availableStock ?? "-"}</strong>
            <div className="muted" style={{ marginTop: 6 }}>
            Centro: {centerById.get(selectedOperation?.collection_center ?? "")?.name ?? "-"}
            </div>
          </div>
      </div>

      <label style={{ marginBottom: 16 }}>
        Operación seleccionada
        <select
          value={selectedOperationId}
          onChange={(e) => {
            const nextOperation = operations.find((operation) => operation.id === e.target.value) ?? null;
            setSelectedOperationId(e.target.value);
            setOperationSearch(nextOperation?.folio ?? "");
          }}
        >
          <option value="">Seleccionar</option>
          {filteredOperations.map((operation) => (
            <option key={operation.id} value={operation.id}>
              {operation.folio} - {operation.status}
            </option>
          ))}
        </select>
      </label>

      <section className="metric-panel" style={{ marginBottom: 16 }}>
        <div className="section-header">
          <div>
            <h3 style={{ margin: 0 }}>Báscula en tiempo real</h3>
            <div className="muted" style={{ marginTop: 4 }}>
              La lectura fluctúa hasta estabilizarse. Cuando la lectura se fija, captura el peso inicial o registra la partida.
            </div>
          </div>
          <div className="muted">{selectedDeviceInfo?.label ?? "Sin báscula asignada"}</div>
        </div>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 12 }}>
          <div className="metric-panel" style={{ margin: 0 }}>
            <span>Lectura actual</span>
            <strong>{liveScale?.weight_kg ?? "-"}</strong>
            <div className="muted" style={{ marginTop: 6 }}>
              {liveScale?.is_stable ? "Estable" : "Inestable"} · {liveScale?.is_manual_fallback ? "Manual" : "Automática"}
            </div>
          </div>
          <div className="metric-panel" style={{ margin: 0 }}>
            <span>Peso inicial capturado</span>
            <strong>{pendingGrossWeight || "-"}</strong>
            <div className="muted" style={{ marginTop: 6 }}>
              Flujo vehicular diferencial
            </div>
          </div>
          <div className="metric-panel" style={{ margin: 0 }}>
            <span>Última actualización</span>
            <strong>{liveScale?.captured_at ? new Date(liveScale.captured_at).toLocaleTimeString() : "-"}</strong>
            <div className="muted" style={{ marginTop: 6 }}>
              {liveScale?.raw_value ?? "Esperando lectura"}
            </div>
          </div>
        </div>
        {scaleTrail.length > 0 ? (
          <div className="muted" style={{ marginTop: 12 }}>
            Fluctuación reciente: {scaleTrail.join(" · ")}
          </div>
        ) : null}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
          {method === "vehicle_differential" ? (
            <button type="button" className="ghost-button" onClick={captureInitialVehicleWeight} disabled={!liveScale || !liveScale.is_stable}>
              Capturar peso inicial
            </button>
          ) : null}
          {method === "secondary_direct" ? (
            <button type="button" className="ghost-button" onClick={useLiveReadingAsGross} disabled={!liveScale || !liveScale.is_stable}>
              Usar lectura actual
            </button>
          ) : null}
        </div>
      </section>

      <form className="grid" onSubmit={onSubmit}>
        {editingItemId ? (
          <div className="info-banner">
            {selectedOperation?.print_status === "pending"
              ? "Editando partida antes de impresión."
              : "Editando una partida ya impresa. Este cambio quedará auditado como ajuste posterior."}
          </div>
        ) : null}
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <label>
            Material
            <select value={materialId} onChange={(e) => handleMaterialChange(e.target.value)}>
              <option value="">Seleccionar</option>
              {materials.map((material) => (
                <option key={material.id} value={material.id}>
                  {material.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Método
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as TicketItem["method"])}
            >
              <option value="vehicle_differential">Diferencia vehicular</option>
              <option value="secondary_direct">Báscula secundaria</option>
              <option value="manual_contingency">Contingencia manual</option>
            </select>
          </label>
          <label>
            Merma
            <input value={mermaKg} onChange={(e) => setMermaKg(e.target.value)} />
          </label>
          <label>
            Precio unitario
            <input value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
            {priceSuggestion?.found ? (
              <span className="muted">
                Sugerido desde {priceSuggestion.price_list_name} · {priceSuggestion.unit_price}
              </span>
            ) : null}
          </label>
        </div>

        {method === "manual_contingency" ? (
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <label>
              Peso manual base
              <input value={grossWeightKg} onChange={(e) => setGrossWeightKg(e.target.value)} />
            </label>
            <label>
              Tara manual
              <input value={tareWeightKg} onChange={(e) => setTareWeightKg(e.target.value)} />
            </label>
          </div>
        ) : null}

        <label>
          Observaciones
          <input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>

        {editingItemId && selectedOperation?.print_status !== "pending" ? (
          <label>
            Motivo del ajuste
            <input value={adjustmentReason} onChange={(e) => setAdjustmentReason(e.target.value)} placeholder="Describe el ajuste" />
          </label>
        ) : null}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            className="ghost-button"
            onClick={quickRegisterFromScale}
            disabled={
              !selectedOperationId ||
              !materialId ||
              (method !== "manual_contingency" && !liveScale) ||
              ((method === "vehicle_differential" || method === "secondary_direct") && liveScale ? !liveScale.is_stable : false)
            }
          >
            Capturar y registrar
          </button>
          <button type="submit" className="ghost-button" disabled={!selectedOperationId || !materialId}>
            {editingItemId ? (selectedOperation?.print_status === "pending" ? "Actualizar partida" : "Ajustar partida") : "Agregar partida"}
          </button>
          {editingItemId ? (
            <button type="button" className="ghost-button" onClick={cancelEditingItem}>
              Cancelar edición
            </button>
          ) : null}
        </div>
      </form>

      {message ? <div className="info-banner">{message}</div> : null}

      <div className="grid" style={{ gridTemplateColumns: "1fr auto auto auto", alignItems: "center", marginTop: 18 }}>
        <h3 style={{ margin: 0 }}>Partidas del ticket</h3>
        <button type="button" className="ghost-button" onClick={printTicket} disabled={!selectedOperationId}>
          Imprimir ticket
        </button>
        <button type="button" className="ghost-button" onClick={reprintLast} disabled={!selectedOperationId || selectedPrints.length === 0}>
          Reimprimir última
        </button>
        <button type="button" className="ghost-button" onClick={confirmOperation} disabled={!selectedOperationId}>
          Confirmar operación
        </button>
      </div>

      {printNote ? <div className="info-banner">{printNote}</div> : null}

      <table className="table" style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th>Material</th>
            <th>Método</th>
            <th>Bruto</th>
            <th>Tara</th>
            <th>Merma</th>
            <th>Neto</th>
            <th>Importe</th>
            <th>Estado</th>
            <th>Ajuste</th>
            <th>Fecha ajuste</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          {selectedItems.map((item) => (
            (() => {
              const adjustmentLog = latestAdjustmentByItemId.get(item.id) ?? null;
              return (
            <tr key={item.id}>
              <td>{materialById.get(item.material) ?? item.material}</td>
              <td>{methodLabel(item.method)}</td>
              <td>{item.gross_weight_kg}</td>
              <td>{item.tare_weight_kg}</td>
              <td>{item.merma_kg}</td>
              <td>{item.net_weight_kg}</td>
              <td>{item.amount}</td>
              <td>{item.status}</td>
              <td>
                {adjustmentLog ? <span className="status-badge status-badge-warning">Ajustada</span> : <span className="muted">-</span>}
              </td>
              <td>
                {adjustmentLog ? new Date(adjustmentLog.created_at).toLocaleString() : <span className="muted">-</span>}
              </td>
              <td>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button type="button" className="ghost-button" onClick={() => startEditingItem(item)}>
                    {selectedOperation?.print_status === "pending" ? "Editar" : "Ajustar"}
                  </button>
                  <button type="button" className="ghost-button" onClick={() => openAdjustmentDetail(item.id)} disabled={!adjustmentLog}>
                    Ver detalle
                  </button>
                </div>
              </td>
            </tr>
              );
            })()
          ))}
        </tbody>
      </table>

      {selectedAdjustmentAudit ? (
        <section className="metric-panel" style={{ marginTop: 18 }}>
          <div className="section-header">
            <div>
              <h3 style={{ margin: 0 }}>Detalle de ajuste</h3>
              <div className="muted" style={{ marginTop: 4 }}>
                Registro de bitácora del ajuste posterior a impresión.
              </div>
            </div>
            <button type="button" className="ghost-button" onClick={() => setSelectedAdjustmentAuditId("")}>
              Cerrar
            </button>
          </div>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginTop: 12 }}>
            <div className="metric-panel" style={{ margin: 0 }}>
              <span>Acción</span>
              <strong style={{ fontSize: "1rem" }}>{selectedAdjustmentAudit.action}</strong>
            </div>
            <div className="metric-panel" style={{ margin: 0 }}>
              <span>Fecha y hora</span>
              <strong style={{ fontSize: "1rem" }}>{new Date(selectedAdjustmentAudit.created_at).toLocaleString()}</strong>
            </div>
            <div className="metric-panel" style={{ margin: 0 }}>
              <span>Entidad</span>
              <strong style={{ fontSize: "1rem" }}>{selectedAdjustmentAudit.entity_type}</strong>
            </div>
          </div>
          <pre style={{ marginTop: 12, whiteSpace: "pre-wrap", background: "rgba(0,0,0,0.2)", padding: 12, borderRadius: 12, overflow: "auto" }}>
            {JSON.stringify(selectedAdjustmentAudit.details ?? {}, null, 2)}
          </pre>
        </section>
      ) : null}

      <section style={{ marginTop: 18 }}>
        <h3>Partidas confirmadas recientes</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Material</th>
              <th>Método</th>
              <th>Neto</th>
              <th>Importe</th>
            </tr>
          </thead>
          <tbody>
            {selectedItems.slice(-5).map((item) => (
              <tr key={item.id}>
                <td>{materialById.get(item.material) ?? item.material}</td>
                <td>{methodLabel(item.method)}</td>
                <td>{item.net_weight_kg}</td>
                <td>{item.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={{ marginTop: 18 }}>
        <h3>Impresiones</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Impresora</th>
              <th>Reimpresión</th>
              <th>Copias</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {selectedPrints.map((printLog) => (
              <tr key={printLog.id}>
                <td>{printLog.printer_name || "-"}</td>
                <td>{printLog.is_reprint ? "Sí" : "No"}</td>
                <td>{printLog.copies}</td>
                <td>{printLog.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </Page>
  );
}



