import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/resources";
import { Page } from "../components/Page";
import { TicketViewer } from "../components/TicketViewer";
import type { CollectionCenter, Device, Driver, Material, MaterialFamily, Party, PriceList, PriceListItem, PriceSuggestion, PurchaseOperation, ScaleReading, TicketItem, Vehicle, WeighingSession } from "../types";
import { useAuth } from "../context/AuthContext";
import { userCan } from "../utils/permissions";

type LiveReading = {
  weight_kg: string;
  is_stable: boolean;
  raw_value: string;
  captured_at: string;
};

type WeighingDraft = {
  version: 1;
  method: string;
  material_id: string;
  material_name: string;
  unit_price: string;
  merma_kg: string;
  gross_kg: string;
  manual_gross: string;
  manual_tare: string;
  diff_step: "idle" | "gross" | "cycling";
  diff_ref_kg: string;
  captured_tare_kg: string;
};

const PURCHASE_WEIGHING_DRAFT_KEY = "purchase_weighing_draft";

function readWeighingDraft(operation: PurchaseOperation | null): WeighingDraft | null {
  const metadata = operation?.metadata;
  if (!metadata || typeof metadata !== "object") return null;
  const draft = (metadata as Record<string, unknown>)[PURCHASE_WEIGHING_DRAFT_KEY];
  if (!draft || typeof draft !== "object") return null;
  const raw = draft as Partial<WeighingDraft> & Record<string, unknown>;
  if (raw.version !== 1) return null;
  return {
    version: 1,
    method: typeof raw.method === "string" ? raw.method : "vehicle_differential",
    material_id: typeof raw.material_id === "string" ? raw.material_id : "",
    material_name: typeof raw.material_name === "string" ? raw.material_name : "",
    unit_price: typeof raw.unit_price === "string" ? raw.unit_price : "0",
    merma_kg: typeof raw.merma_kg === "string" ? raw.merma_kg : "",
    gross_kg: typeof raw.gross_kg === "string" ? raw.gross_kg : "",
    manual_gross: typeof raw.manual_gross === "string" ? raw.manual_gross : "",
    manual_tare: typeof raw.manual_tare === "string" ? raw.manual_tare : "",
    diff_step: raw.diff_step === "gross" || raw.diff_step === "cycling" ? raw.diff_step : "idle",
    diff_ref_kg: typeof raw.diff_ref_kg === "string" ? raw.diff_ref_kg : "",
    captured_tare_kg: typeof raw.captured_tare_kg === "string" ? raw.captured_tare_kg : "",
  };
}

function draftHasContent(draft: WeighingDraft) {
  return Boolean(
    draft.material_id ||
      draft.material_name ||
      draft.unit_price !== "0" ||
      draft.merma_kg ||
      draft.gross_kg ||
      draft.manual_gross ||
      draft.manual_tare ||
      draft.diff_ref_kg ||
      draft.captured_tare_kg ||
      draft.diff_step !== "idle",
  );
}

function readingToLiveReading(reading: ScaleReading): LiveReading {
  const weight_kg = reading.net_weight_kg ?? reading.gross_weight_kg ?? reading.tare_weight_kg ?? "0";
  return {
    weight_kg,
    is_stable: reading.is_stable ?? true,
    raw_value: reading.raw_value ?? "",
    captured_at: reading.captured_at ?? new Date().toISOString(),
  };
}

const POLL_MS = 1800;
const MERMA_PCT = 0.03;
const WEIGHT_ANOMALY_THRESHOLD = 0.20;

function fmtKg(v: number) {
  return v.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtMXN(v: number) {
  return "$" + v.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function normalizeLookup(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

type EditState = {
  itemId: string;
  materialId: string;
  unitPrice: string;
  mermaKg: string;
  grossKg: string;
  tareKg: string;
  method: string;
};

export function PurchasePage() {
  const { user } = useAuth();
  const canManagePurchases = userCan(user, "purchases.manage");
  const [centers, setCenters] = useState<CollectionCenter[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [priceListItems, setPriceListItems] = useState<PriceListItem[]>([]);
  const [families, setFamilies] = useState<MaterialFamily[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [driverId, setDriverId] = useState("");
  const [driverInput, setDriverInput] = useState("");
  const [showDriverSuggestions, setShowDriverSuggestions] = useState(false);

  const [centerId, setCenterId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const [customerCreateKind, setCustomerCreateKind] = useState<Party["kind"]>("company");
  const [customerCreateLoading, setCustomerCreateLoading] = useState(false);
  const [customerCreateError, setCustomerCreateError] = useState<string | null>(null);

  const [plateInput, setPlateInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [customerVehicles, setCustomerVehicles] = useState<Vehicle[]>([]);
  const [allVehicles, setAllVehicles] = useState<Vehicle[]>([]);
  const [vehicleLoading, setVehicleLoading] = useState(false);

  const [operation, setOperation] = useState<PurchaseOperation | null>(null);
  const [opLoading, setOpLoading] = useState(false);
  const [opError, setOpError] = useState<string | null>(null);

  const [familyFilter, setFamilyFilter] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [method, setMethod] = useState<string>("vehicle_differential");
  const [unitPrice, setUnitPrice] = useState("0");
  const [priceSuggestion, setPriceSuggestion] = useState<PriceSuggestion | null>(null);
  const [mermaKg, setMermaKg] = useState("");

  const [grossKg, setGrossKg] = useState("");
  const [manualGross, setManualGross] = useState("");
  const [manualTare, setManualTare] = useState("");
  const [diffStep, setDiffStep] = useState<"idle" | "gross" | "cycling">("idle");
  const [diffRefKg, setDiffRefKg] = useState("");
  const [capturedTareKg, setCapturedTareKg] = useState("");

  const [liveReading, setLiveReading] = useState<LiveReading | null>(null);
  const [autoRead, setAutoRead] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const draftSyncRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftHydratingRef = useRef(false);
  const suppressPriceAutoFillRef = useRef(false);
  const operationRef = useRef<PurchaseOperation | null>(null);
  const driverSelectionRef = useRef<{ id: string; input: string }>({ id: "", input: "" });

  const [items, setItems] = useState<TicketItem[]>([]);
  const [itemLoading, setItemLoading] = useState(false);
  const [itemMsg, setItemMsg] = useState<string | null>(null);

  const [editState, setEditState] = useState<EditState | null>(null);

  const [editingDriver, setEditingDriver] = useState(false);
  const [editDriverId, setEditDriverId] = useState("");
  const [driverUpdateLoading, setDriverUpdateLoading] = useState(false);
  const [driverUpdateError, setDriverUpdateError] = useState<string | null>(null);

  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [printMsg, setPrintMsg] = useState<string | null>(null);

  const [todayOps, setTodayOps] = useState<PurchaseOperation[]>([]);
  const [allOperations, setAllOperations] = useState<PurchaseOperation[]>([]);
  const [opsLoading, setOpsLoading] = useState(false);
  const [opsPage, setOpsPage] = useState(0);
  const OPS_PAGE_SIZE = 2;

  const [vehicleHistory, setVehicleHistory] = useState<WeighingSession[]>([]);
  const [vehicleHistoryLoading, setVehicleHistoryLoading] = useState(false);
  const [historyDateFrom, setHistoryDateFrom] = useState("");
  const [historyDateTo, setHistoryDateTo] = useState("");
  const [historyDisplayCount, setHistoryDisplayCount] = useState(10);
  const HISTORY_PAGE_SIZE = 10;
  const [vehicleHistoryAll, setVehicleHistoryAll] = useState<WeighingSession[]>([]);

  operationRef.current = operation;

  useEffect(() => {
    Promise.all([
      api.centers().then(setCenters),
      api.partiesAll().then(setParties),
      api.materials().then(setMaterials),
      api.priceLists().then(setPriceLists),
      api.priceListItems().then(setPriceListItems),
      api.materialFamilies().then(setFamilies),
      api.vehicles().then(setAllVehicles),
      api.devices().then(setDevices),
      api.drivers().then(setDrivers),
    ]).catch(() => {});
    loadTodayOps();
  }, []);

  useEffect(() => {
    const cs = centers.filter((c) => c.kind === "collection");
    if (cs.length === 1 && !centerId) setCenterId(cs[0].id);
  }, [centers]);

  useEffect(() => {
    if (!customerId) { setCustomerVehicles([]); return; }
    setVehicleLoading(true);
    api.vehiclesByOwner(customerId)
      .then((vs) => setCustomerVehicles(vs as Vehicle[]))
      .catch(() => setCustomerVehicles([]))
      .finally(() => setVehicleLoading(false));
  }, [customerId]);

  const collectionCenters = useMemo(() => centers.filter((c) => c.kind === "collection"), [centers]);
  const center = useMemo(() => centers.find((c) => c.id === centerId), [centers, centerId]);

  const plateSuggestions = useMemo(() => {
    const q = plateInput.trim().toLowerCase();
    if (!q) return customerVehicles;
    return customerVehicles.filter(
      (v) => v.plate_number.toLowerCase().includes(q) || v.label.toLowerCase().includes(q)
    );
  }, [customerVehicles, plateInput]);

  const activeDrivers = useMemo(() => drivers.filter((d) => d.is_active !== false), [drivers]);
  const customerDriverPool = useMemo(() => {
    if (!customerId) return [];
    const relatedIds = new Set(
      allOperations
        .filter((op) => op.customer === customerId && op.driver)
        .map((op) => op.driver as string),
    );
    const related = activeDrivers.filter((driver) => relatedIds.has(driver.id));
    return related.length ? related : activeDrivers;
  }, [activeDrivers, allOperations, customerId]);
  const driverSuggestions = useMemo(() => {
    if (!customerId) return [];
    const q = normalizeLookup(driverInput);
    if (!q) return customerDriverPool;
    return customerDriverPool.filter((d) => {
      const name = normalizeLookup(d.person_name ?? "");
      const license = normalizeLookup(d.license_number);
      return name.includes(q) || license.includes(q);
    });
  }, [customerDriverPool, customerId, driverInput]);

  const scaleDevice = useMemo(() => {
    const kind = method === "vehicle_differential" ? "vehicle_scale" : "secondary_scale";
    const isBridgeDevice = (device: Device) =>
      Boolean(device.metadata && typeof device.metadata === "object" && (device.metadata as Record<string, unknown>).bridge_mode);
    const pickBest = (candidates: Device[]) =>
      [...candidates].sort((a, b) => {
        const bridgeDelta = Number(isBridgeDevice(b)) - Number(isBridgeDevice(a));
        if (bridgeDelta !== 0) return bridgeDelta;
        const connectedDelta = Number(b.is_connected) - Number(a.is_connected);
        if (connectedDelta !== 0) return connectedDelta;
        const seenA = a.last_seen_at ? Date.parse(a.last_seen_at) : 0;
        const seenB = b.last_seen_at ? Date.parse(b.last_seen_at) : 0;
        return seenB - seenA;
      })[0] ?? null;
    const sameCenter = devices.filter((d) => d.kind === kind && d.collection_center === centerId);
    const anyOfKind = devices.filter((d) => d.kind === kind);
    return pickBest(sameCenter) ?? pickBest(anyOfKind);
  }, [devices, method, centerId]);
  const scaleBridgeMode = Boolean(scaleDevice?.metadata && typeof scaleDevice.metadata === "object" && (scaleDevice.metadata as Record<string, unknown>).bridge_mode);
  const scaleDeviceLabel = scaleDevice
    ? [
        scaleDevice.name,
        scaleDevice.identifier,
        scaleBridgeMode ? "Puente local" : "Lectura directa",
        scaleDevice.id ? `ID ${scaleDevice.id.slice(0, 8)}` : null,
      ].filter(Boolean).join(" · ")
    : "";

  const activeSessionId = operation?.active_weighing_session ?? null;

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!scaleDevice) return;
    if (method === "manual_contingency") return;
    let cancelled = false;
    const poll = async () => {
      try {
        const latestByDevice = await api.deviceLatestScaleReading(scaleDevice.id).catch(() => null);
        const latestBySession = !latestByDevice && activeSessionId ? (await api.scaleReadingsBySession(activeSessionId))[0] ?? null : null;
        const latest = latestByDevice
          ?? latestBySession
          ?? (!latestByDevice && !latestBySession && (autoRead || activeSessionId) ? await api.deviceReadScale(scaleDevice.id) : null);
        if (!cancelled) {
          if (latest) {
            const latestRow = latest as Record<string, unknown>;
            const sessionReading = "session" in latest && "device" in latest;
            setLiveReading(
              sessionReading
                ? readingToLiveReading(latest as ScaleReading)
                : {
                    weight_kg: typeof latestRow.weight_kg === "string" && latestRow.weight_kg ? latestRow.weight_kg : "0",
                    is_stable: typeof latestRow.is_stable === "boolean" ? latestRow.is_stable : true,
                    raw_value: typeof latestRow.raw_value === "string" ? latestRow.raw_value : "",
                    captured_at: typeof latestRow.captured_at === "string" && latestRow.captured_at ? latestRow.captured_at : new Date().toISOString(),
                  },
            );
          } else {
            setLiveReading(null);
          }
        }
      } catch {
        if (!cancelled) setLiveReading(null);
      }
    };
    poll();
    pollRef.current = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [autoRead, activeSessionId, scaleBridgeMode, scaleDevice?.id]);

  const priceLookupSeq = useRef(0);
  useEffect(() => {
    if (!centerId || !materialId) { setPriceSuggestion(null); return; }
    const seq = ++priceLookupSeq.current;
    api.priceSuggestion(centerId, materialId, customerId || undefined)
      .then((s) => {
        if (seq !== priceLookupSeq.current) return;
        setPriceSuggestion(s);
        const savedDraft = readWeighingDraft(operationRef.current);
        if (suppressPriceAutoFillRef.current || (savedDraft?.material_id === materialId && savedDraft.unit_price)) {
          suppressPriceAutoFillRef.current = false;
          return;
        }
        setUnitPrice(s.unit_price ?? "0");
      })
      .catch(() => { if (seq !== priceLookupSeq.current) return; setPriceSuggestion(null); });
  }, [centerId, customerId, materialId]);

  const filteredMaterials = useMemo(() => {
    if (!familyFilter) return materials;
    return materials.filter((m) => m.family === familyFilter);
  }, [materials, familyFilter]);

  function materialOptionLabel(material: Material) {
    const priceItem = priceItemByMaterialId.get(material.id);
    if (!priceItem) return `${material.name}${material.code ? ` · ${material.code}` : ""}`;
    const priceValue = parseFloat(priceItem.unit_price) || 0;
    const sourceLabel = priceItemSourceByMaterialId.get(material.id) === "provider" ? "proveedor" : "base";
    return `${material.name}${material.code ? ` · ${material.code}` : ""} · ${fmtMXN(priceValue)} (${sourceLabel})`;
  }

  const materialById = useMemo(() => new Map(materials.map((m) => [m.id, m])), [materials]);
  const vehicleById = useMemo(() => new Map(allVehicles.map((v) => [v.id, v])), [allVehicles]);
  const partyById = useMemo(() => new Map(parties.map((p) => [p.id, p])), [parties]);
  const selectedCustomer = useMemo(() => partyById.get(customerId) ?? null, [customerId, partyById]);
  const customerSearchResults = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    const items = parties.filter((party) => {
      if (!q) return true;
      return [
        party.trade_name,
        party.legal_name,
        party.tax_id,
        party.phone,
        party.email,
      ].some((value) => value?.toLowerCase().includes(q));
    });
    return items.slice(0, 8);
  }, [customerQuery, parties]);
  const customerExactMatch = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (!q) return null;
    return parties.find((party) => (
      party.trade_name?.trim().toLowerCase() === q
      || party.legal_name.trim().toLowerCase() === q
    )) ?? null;
  }, [customerQuery, parties]);
  const activeCustomerPriceList = useMemo(() => {
    if (!centerId || !customerId) return null;
    const today = new Date().toISOString().slice(0, 10);
    const candidates = priceLists.filter((priceList) => (
      priceList.collection_center === centerId
      && priceList.linked_party === customerId
      && priceList.is_active
      && priceList.valid_from <= today
      && (!priceList.valid_to || priceList.valid_to >= today)
    ));
    return candidates.sort((a, b) => b.valid_from.localeCompare(a.valid_from) || a.name.localeCompare(b.name))[0] ?? null;
  }, [centerId, customerId, priceLists]);
  const fallbackPriceList = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const candidates = priceLists.filter((priceList) => (
      priceList.code === "LP-GRAL-001"
      && priceList.is_active
      && priceList.valid_from <= today
      && (!priceList.valid_to || priceList.valid_to >= today)
    ));
    return candidates.sort((a, b) => b.valid_from.localeCompare(a.valid_from) || a.name.localeCompare(b.name))[0] ?? null;
  }, [priceLists]);
  const selectedPriceList = activeCustomerPriceList ?? fallbackPriceList;
  const isBasePriceList = selectedPriceList?.code === "LP-GRAL-001";
  const customerPriceListItems = useMemo(
    () => priceListItems.filter((item) => item.price_list === activeCustomerPriceList?.id && item.is_active),
    [activeCustomerPriceList?.id, priceListItems],
  );
  const fallbackPriceListItems = useMemo(
    () => priceListItems.filter((item) => item.price_list === fallbackPriceList?.id && item.is_active),
    [fallbackPriceList?.id, priceListItems],
  );
  const selectedPriceListItems = useMemo(
    () => priceListItems.filter((item) => item.price_list === selectedPriceList?.id && item.is_active),
    [priceListItems, selectedPriceList?.id],
  );
  const priceItemByMaterialId = useMemo(
    () => {
      const map = new Map(fallbackPriceListItems.map((item) => [item.material, item] as const));
      for (const item of customerPriceListItems) {
        map.set(item.material, item);
      }
      return map;
    },
    [customerPriceListItems, fallbackPriceListItems],
  );
  const priceItemSourceByMaterialId = useMemo(
    () => {
      const map = new Map<string, "provider" | "base">();
      for (const item of fallbackPriceListItems) {
        map.set(item.material, "base");
      }
      for (const item of customerPriceListItems) {
        map.set(item.material, "provider");
      }
      return map;
    },
    [customerPriceListItems, fallbackPriceListItems],
  );

  const isDisc = liveReading?.raw_value === "DISCONNECTED";
  const liveStable = !!liveReading?.is_stable && !isDisc;
  const displayWeight = liveReading && !isDisc ? parseFloat(liveReading.weight_kg) : null;
  const totalWeight = parseFloat(operation?.total_weight_kg ?? "0") || 0;
  const totalAmount = parseFloat(operation?.total_amount ?? "0") || 0;
  const totalMermaKg = items.reduce((sum, item) => sum + (parseFloat(item.merma_kg) || 0), 0);
  const totalCleanKg = totalWeight + totalMermaKg;
  const totalMermaPct = totalCleanKg > 0 ? (totalMermaKg / totalCleanKg) * 100 : 0;

  const refKgNum = parseFloat(diffRefKg) || 0;
  const capturedTareNum = parseFloat(capturedTareKg) || 0;
  const liveNum = displayWeight ?? 0;

  const netRaw = (() => {
    if (method === "vehicle_differential" && diffStep === "cycling" && capturedTareKg)
      return Math.max(0, refKgNum - capturedTareNum);
    if (method === "manual_contingency") return Math.max(0, (parseFloat(manualGross) || 0) - (parseFloat(manualTare) || 0));
    if (method === "secondary_direct" && grossKg) return parseFloat(grossKg) || 0;
    return 0;
  })();
  const selectedMaterial = materialId ? materialById.get(materialId) : undefined;
  const effectiveMermaPct = selectedMaterial?.default_merma_pct != null
    ? parseFloat(selectedMaterial.default_merma_pct)
    : MERMA_PCT;
  const mermaSourceLabel = selectedMaterial
    ? (selectedMaterial.default_merma_pct != null
        ? `Default del material: ${(parseFloat(selectedMaterial.default_merma_pct) * 100).toFixed(1)}%`
        : `Default global: ${(MERMA_PCT * 100).toFixed(0)}%`)
    : null;
  useEffect(() => {
    if (!operation) return;
    if (draftHydratingRef.current) {
      draftHydratingRef.current = false;
      return;
    }
    if (draftSyncRef.current) clearTimeout(draftSyncRef.current);
    const draft = buildWeighingDraft();
    if (!draftHasContent(draft)) return;
    draftSyncRef.current = setTimeout(() => {
      void persistWeighingDraft(draft);
    }, 450);
    return () => {
      if (draftSyncRef.current) {
        clearTimeout(draftSyncRef.current);
        draftSyncRef.current = null;
      }
    };
  }, [
    operation?.id,
    selectedMaterial?.name,
    method,
    materialId,
    unitPrice,
    mermaKg,
    grossKg,
    manualGross,
    manualTare,
    diffStep,
    diffRefKg,
    capturedTareKg,
  ]);
  const mermaNum = mermaKg !== "" && !isNaN(parseFloat(mermaKg)) ? parseFloat(mermaKg) : netRaw * effectiveMermaPct;
  const netClean = Math.max(0, netRaw - mermaNum);
  const priceNum = parseFloat(unitPrice) || 0;
  const estimatedAmount = netClean * priceNum;

  const hasScale = !!scaleDevice;
  const canReadScale = !!operation && !!activeSessionId && method !== "manual_contingency";
  const canCaptureGross = canReadScale && diffStep === "idle" && liveStable && !confirmed;
  const canCaptureTare = canReadScale && diffStep === "cycling" && !!materialId && liveStable && !capturedTareKg && !confirmed;
  const canAddItemDiff = !!operation && diffStep === "cycling" && !!materialId && !!capturedTareKg && netClean > 0 && !confirmed;
  const canCaptureDirect = canReadScale && method === "secondary_direct" && !!materialId && liveStable && !confirmed;

  const canAddItemManual = !!operation && !!materialId && method === "manual_contingency" && !!manualGross && netClean > 0 && !confirmed;
  const canAddItemDirect = !!operation && !!materialId && method === "secondary_direct" && !!grossKg && netClean > 0 && !confirmed;
  const canCancelOperation = !!operation && operation.payment_status === "pending" && !confirmed;
  const isCancelledOperation = operation?.status === "cancelled";

  function buildWeighingDraft(): WeighingDraft {
    const selected = materialId ? materialById.get(materialId) : undefined;
    return {
      version: 1,
      method,
      material_id: materialId,
      material_name: selected?.name ?? "",
      unit_price: unitPrice,
      merma_kg: mermaKg,
      gross_kg: grossKg,
      manual_gross: manualGross,
      manual_tare: manualTare,
      diff_step: diffStep,
      diff_ref_kg: diffRefKg,
      captured_tare_kg: capturedTareKg,
    };
  }

  async function persistWeighingDraft(nextDraft: WeighingDraft | null) {
    const currentOperation = operationRef.current;
    if (!currentOperation) return;
    const metadata = { ...(currentOperation.metadata ?? {}) } as Record<string, unknown>;
    if (nextDraft && draftHasContent(nextDraft)) {
      metadata[PURCHASE_WEIGHING_DRAFT_KEY] = nextDraft;
    } else {
      delete metadata[PURCHASE_WEIGHING_DRAFT_KEY];
    }
    try {
      const updated = await api.operationPatch(currentOperation.id, { metadata });
      setOperation(updated);
      setTodayOps((prev) => prev.map((op) => (op.id === updated.id ? updated : op)));
      setAllOperations((prev) => prev.map((op) => (op.id === updated.id ? updated : op)));
    } catch {
      // Keep the local flow usable even if draft persistence fails momentarily.
    }
  }

  function applyWeighingDraft(draft: WeighingDraft | null) {
    draftHydratingRef.current = true;
    if (!draft) {
      suppressPriceAutoFillRef.current = false;
      resetWeigh();
      setMethod("vehicle_differential");
      setMaterialId("");
      setUnitPrice("0");
      return;
    }
    suppressPriceAutoFillRef.current = true;
    setMethod(draft.method || "vehicle_differential");
    setMaterialId(draft.material_id || "");
    setUnitPrice(draft.unit_price || "0");
    setMermaKg(draft.merma_kg || "");
    setGrossKg(draft.gross_kg || "");
    setManualGross(draft.manual_gross || "");
    setManualTare(draft.manual_tare || "");
    setDiffStep(draft.diff_step || "idle");
    setDiffRefKg(draft.diff_ref_kg || "");
    setCapturedTareKg(draft.captured_tare_kg || "");
    setItemMsg("Se recuperó el borrador del pesaje para continuar.");
  }

  function captureGross() {
    if (!liveReading || !liveStable) { setItemMsg("Espera lectura estable."); return; }
    setDiffRefKg(liveReading.weight_kg);
    setCapturedTareKg("");
    setDiffStep("cycling");
    setItemMsg(`Peso inicial capturado: ${fmtKg(parseFloat(liveReading.weight_kg))} kg. Selecciona el material y captura la tara.`);
    void persistWeighingDraft({ ...buildWeighingDraft(), diff_ref_kg: liveReading.weight_kg, captured_tare_kg: "" });
  }

  function captureTare() {
    if (!liveReading || !liveStable) { setItemMsg("Espera lectura estable para capturar la tara."); return; }
    const tare = parseFloat(liveReading.weight_kg);
    const ref = parseFloat(diffRefKg) || 0;
    if (tare >= ref) {
      setItemMsg(`La tara (${fmtKg(tare)} kg) no puede ser mayor o igual al peso de referencia (${fmtKg(ref)} kg). Verifica que el vehículo haya descargado el material.`);
      return;
    }
    setCapturedTareKg(liveReading.weight_kg);
    setItemMsg(null);
    void persistWeighingDraft({ ...buildWeighingDraft(), captured_tare_kg: liveReading.weight_kg });
  }

  function captureDirectReading() {
    if (!liveReading || !liveStable) { setItemMsg("Espera lectura estable."); return; }
    setGrossKg(liveReading.weight_kg);
    setItemMsg(null);
    void persistWeighingDraft({ ...buildWeighingDraft(), gross_kg: liveReading.weight_kg });
  }

  async function startScaleReading() {
    if (!operation) {
      setItemMsg("Abre una compra antes de iniciar la lectura.");
      return;
    }
    if (!scaleDevice) {
      setItemMsg("No hay báscula configurada para esta compra.");
      return;
    }
    try {
      const currentMetadata = scaleDevice.metadata && typeof scaleDevice.metadata === "object"
        ? (scaleDevice.metadata as Record<string, unknown>)
        : {};
      const updated = await api.devicePatch(scaleDevice.id, {
        metadata: {
          ...currentMetadata,
          bridge_mode: true,
          bridge_enabled: true,
        },
      });
      setDevices((prev) => prev.map((device) => (device.id === updated.id ? updated : device)));
      setAutoRead(true);
      setItemMsg("Lectura iniciada. El puente del cliente ya puede leer la báscula.");
    } catch (error) {
      setItemMsg(error instanceof Error ? error.message : "No se pudo activar la lectura.");
    }
  }

  async function pauseScaleReading() {
    if (!scaleDevice) {
      setAutoRead(false);
      return;
    }
    try {
      const currentMetadata = scaleDevice.metadata && typeof scaleDevice.metadata === "object"
        ? (scaleDevice.metadata as Record<string, unknown>)
        : {};
      const updated = await api.devicePatch(scaleDevice.id, {
        metadata: {
          ...currentMetadata,
          bridge_mode: true,
          bridge_enabled: false,
        },
      });
      setDevices((prev) => prev.map((device) => (device.id === updated.id ? updated : device)));
      setAutoRead(false);
      setItemMsg("Lectura pausada. El puente del cliente quedó en espera.");
    } catch (error) {
      setItemMsg(error instanceof Error ? error.message : "No se pudo pausar la lectura.");
    }
  }

  function registerCurrentReading() {
    if (!liveReading) {
      setItemMsg("Primero inicia la lectura para obtener un peso.");
      return;
    }
    if (!liveStable) {
      setItemMsg("Espera a que la lectura se estabilice antes de registrarla.");
      return;
    }
    if (method === "vehicle_differential") {
      if (diffStep === "idle") {
        captureGross();
        return;
      }
      if (diffStep === "cycling" && !capturedTareKg) {
        captureTare();
        return;
      }
      if (diffStep === "cycling" && capturedTareKg) {
        setItemMsg("La tara ya quedó capturada. Puedes agregar la partida.");
        return;
      }
    }
    captureDirectReading();
    setItemMsg("Lectura registrada en la compra.");
  }

  async function resolveVehicleId(): Promise<string | null> {
    const plate = plateInput.trim().toUpperCase();
    if (!plate) return null;

    const existing = [...allVehicles, ...customerVehicles].find(
      (v) => v.plate_number.toUpperCase() === plate
    );
    if (existing) return existing.id;

    const created = await api.vehicleCreate({
      plate_number: plate,
      label: plate,
      owner: customerId || null,
      capacity_kg: "0",
      expected_km_per_liter: "3",
      is_active: true,
    });
    setAllVehicles((prev) => [...prev, created]);
    setCustomerVehicles((prev) => [...prev, created]);
    return created.id;
  }

  async function resolveDriverSelection(): Promise<string | null> {
    const selectedId = driverSelectionRef.current.id || driverId;
    if (selectedId) return selectedId;
    const rawInput = (driverSelectionRef.current.input || driverInput).trim();
    const query = normalizeLookup(rawInput);
    if (!query) return null;
    const pools = customerDriverPool.length ? [customerDriverPool, activeDrivers] : [activeDrivers];
    const exact = pools.flat().find((driver) => {
      const name = normalizeLookup(driver.person_name ?? "");
      const license = normalizeLookup(driver.license_number);
      return name === query || license === query;
    });
    if (exact) return exact.id;
    const partial = pools.flat().find((driver) => {
      const name = normalizeLookup(driver.person_name ?? "");
      const license = normalizeLookup(driver.license_number);
      return name.includes(query) || license.includes(query);
    });
    if (partial) return partial.id;
    if (!rawInput) return null;

    const createdPerson = await api.partyCreate({
      kind: "person",
      legal_name: rawInput,
      trade_name: rawInput,
      tax_id: "",
      email: "",
      phone: "",
      address: "",
      notes: "",
      is_active: true,
      commercial_roles: [],
    });
    const createdDriver = await api.driverCreate({
      person: createdPerson.id,
      license_number: "",
      is_active: true,
    });
    setParties((current) => [...current, createdPerson]);
    setDrivers((current) => [...current, createdDriver]);
    driverSelectionRef.current = { id: createdDriver.id, input: rawInput };
    setDriverId(createdDriver.id);
    setDriverInput(rawInput);
    return createdDriver.id;
  }

  async function openOperation() {
    if (!canManagePurchases) { setOpError("No tienes permiso para iniciar compras."); return; }
    if (!centerId || !customerId) { setOpError("Selecciona centro y cliente."); return; }
    setOpLoading(true); setOpError(null);
    try {
      const resolvedVehicleId = await resolveVehicleId();
      const resolvedDriverId = await resolveDriverSelection();
      const op = await api.operationCreate({
        collection_center_id: centerId,
        customer_id: customerId,
        vehicle_id: resolvedVehicleId,
        driver_id: resolvedDriverId || driverSelectionRef.current.id || driverId || null,
      });
      setOperation(op);
      setItems([]);
      setConfirmed(false);
      setPrintMsg(null);
      driverSelectionRef.current = { id: op.driver ?? "", input: op.driver_name ?? drivers.find((d) => d.id === op.driver)?.person_name ?? "" };
      applyWeighingDraft(readWeighingDraft(op));
      loadTodayOps();
    } catch (e) {
      setOpError(e instanceof Error ? e.message : "Error al crear la operación o el vehículo.");
    } finally {
      setOpLoading(false);
    }
  }

  async function createCustomerFromSearch() {
    const name = customerQuery.trim();
    if (!name) {
      setCustomerCreateError("Escribe el nombre del cliente.");
      return;
    }
    if (!canManagePurchases) {
      setCustomerCreateError("No tienes permiso para crear clientes.");
      return;
    }
    setCustomerCreateLoading(true);
    setCustomerCreateError(null);
    try {
      const created = await api.partyCreate({
        kind: customerCreateKind,
        legal_name: name,
        trade_name: name,
        tax_id: "",
        email: "",
        phone: "",
        address: "",
        notes: "",
        is_active: true,
        commercial_roles: [],
      });
      setParties((current) => [...current, created]);
      setCustomerId(created.id);
      setCustomerQuery(created.trade_name || created.legal_name);
      setShowCustomerSuggestions(false);
      setCustomerCreateError(null);
    } catch (error) {
      setCustomerCreateError(error instanceof Error ? error.message : "No se pudo crear el cliente.");
    } finally {
      setCustomerCreateLoading(false);
    }
  }

  function resetWeigh() {
    setGrossKg(""); setDiffRefKg(""); setCapturedTareKg(""); setManualGross(""); setManualTare("");
    setMermaKg(""); setDiffStep("idle"); setLiveReading(null); setAutoRead(false);
    setItemMsg(null);
  }

  function resetForNextMaterial() {
    draftHydratingRef.current = true;
    suppressPriceAutoFillRef.current = false;
    resetWeigh();
    setMaterialId("");
    setUnitPrice("0");
    setMermaKg("");
    setGrossKg("");
    setManualGross("");
    setManualTare("");
    setDiffRefKg("");
    setCapturedTareKg("");
    setDiffStep("idle");
    setItemMsg("Partida registrada. Selecciona el siguiente material y captura la tara.");
  }

  async function addItemDiff() {
    if (!canManagePurchases) { setItemMsg("No tienes permiso para agregar partidas."); return; }
    if (!operation || !canAddItemDiff) return;
    setItemLoading(true); setItemMsg(null);
    try {
      const sessionId = operation.active_weighing_session ?? null;

      let tareReadingId: string | null = null;

      if (sessionId && scaleDevice) {
        const [, tareReading] = await Promise.all([
          api.createScaleReading({
            session: sessionId,
            device: scaleDevice.id,
            reading_type: "gross",
            gross_weight_kg: diffRefKg,
            raw_value: diffRefKg,
            is_stable: true,
          }),
          api.createScaleReading({
            session: sessionId,
            device: scaleDevice.id,
            reading_type: "tare",
            tare_weight_kg: capturedTareKg,
            raw_value: capturedTareKg,
            is_stable: true,
          }),
        ]);
        tareReadingId = tareReading.id;
      }

      const payload: Record<string, unknown> = {
        operation: operation.id,
        material: materialId,
        method,
        gross_weight_kg: diffRefKg,
        tare_weight_kg: capturedTareKg,
        merma_kg: mermaNum.toFixed(3),
        unit_price: unitPrice,
        notes: "",
      };
      if (sessionId) payload.weighing_session = sessionId;
      if (tareReadingId) payload.scale_reading = tareReadingId;

      const item = await api.createTicketItem(payload);
      setItems((prev) => [...prev, item]);
      const refreshed = await api.operationDetail(operation.id);
      setOperation(refreshed);
      await persistWeighingDraft(null);
      resetForNextMaterial();
    } catch (e) {
      setItemMsg(e instanceof Error ? e.message : "Error al guardar la partida.");
    } finally {
      setItemLoading(false);
    }
  }

  async function addItem() {
    if (!canManagePurchases) { setItemMsg("No tienes permiso para agregar partidas."); return; }
    if (!operation) return;
    setItemLoading(true); setItemMsg(null);
    try {
      let gross: string;
      let tare: string;
      if (method === "manual_contingency") {
        gross = manualGross; tare = manualTare || "0";
      } else {
        gross = grossKg; tare = "0";
      }
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
      await persistWeighingDraft(null);
      resetForNextMaterial();
      setItemMsg("Partida registrada correctamente.");
    } catch (e) {
      setItemMsg(e instanceof Error ? e.message : "Error al guardar la partida.");
    } finally {
      setItemLoading(false);
    }
  }

  async function deleteItem(itemId: string) {
    if (!canManagePurchases) { setItemMsg("No tienes permiso para eliminar partidas."); return; }
    if (!window.confirm("¿Eliminar esta partida?")) return;
    setItemLoading(true);
    try {
      await api.deleteTicketItem(itemId);
      setItems((prev) => prev.filter((i) => i.id !== itemId));
      if (operation) {
        const refreshed = await api.operationDetail(operation.id);
        setOperation(refreshed);
      }
      setItemMsg("Partida eliminada.");
    } catch (e) {
      setItemMsg(e instanceof Error ? e.message : "Error al eliminar la partida.");
    } finally {
      setItemLoading(false);
    }
  }

  function startEditItem(item: TicketItem) {
    if (!canManagePurchases) {
      setItemMsg("No tienes permiso para editar partidas.");
      return;
    }
    setEditState({
      itemId: item.id,
      materialId: item.material,
      unitPrice: item.unit_price,
      mermaKg: item.merma_kg,
      grossKg: item.gross_weight_kg,
      tareKg: item.tare_weight_kg,
      method: item.method,
    });
  }

  async function saveEditItem() {
    if (!canManagePurchases) { setItemMsg("No tienes permiso para actualizar partidas."); return; }
    if (!editState || !operation) return;
    setItemLoading(true);
    try {
      const updated = await api.updateTicketItem(editState.itemId, {
        operation: operation.id,
        material: editState.materialId,
        method: editState.method,
        gross_weight_kg: editState.grossKg,
        tare_weight_kg: editState.tareKg,
        merma_kg: editState.mermaKg,
        unit_price: editState.unitPrice,
        notes: "",
      });
      setItems((prev) => prev.map((i) => i.id === editState.itemId ? updated : i));
      const refreshed = await api.operationDetail(operation.id);
      setOperation(refreshed);
      setEditState(null);
      setItemMsg("Partida actualizada.");
    } catch (e) {
      setItemMsg(e instanceof Error ? e.message : "Error al actualizar. La partida puede ya haber sido impresa.");
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
      loadTodayOps();
    } catch (e) {
      setItemMsg(e instanceof Error ? e.message : "Error al confirmar.");
    } finally {
      setConfirming(false);
    }
  }

  async function printTicket() {
    if (!canManagePurchases) { setPrintMsg("No tienes permiso para imprimir tickets de compra."); return; }
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

  async function cancelOperation() {
    if (!canManagePurchases) { setItemMsg("No tienes permiso para cancelar compras."); return; }
    if (!operation) return;
    if (!canCancelOperation) {
      setItemMsg("No se puede cancelar: ya hay pago registrado.");
      return;
    }
    if (!window.confirm("¿Cancelar esta compra antes de registrar pago?")) return;
    setConfirming(true);
    try {
      await api.operationStatusChange(operation.id, "cancelled", "Cancelación antes de ticket y pago");
      const refreshed = await api.operationDetail(operation.id);
      setOperation(refreshed);
      setConfirmed(refreshed.status === "confirmed" || refreshed.status === "completed");
      await loadTodayOps();
      setItemMsg("Compra cancelada.");
    } catch (e) {
      setItemMsg(e instanceof Error ? e.message : "Error al cancelar la compra.");
    } finally {
      setConfirming(false);
    }
  }

  async function loadTodayOps() {
    setOpsLoading(true);
    try {
      const all = await api.operationsAll();
      const todayStr = new Date().toLocaleDateString("en-CA");
      const unique = [...new Map((all as PurchaseOperation[]).map((op) => [op.id, op])).values()];
      setAllOperations(unique);
      const filtered = unique
        .filter((op) => op.created_at && new Date(op.created_at).toLocaleDateString("en-CA") === todayStr)
        .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());
      setTodayOps(filtered);
      setOpsPage(0);
    } catch {
      setTodayOps([]);
    } finally {
      setOpsLoading(false);
    }
  }

  async function selectExistingOp(op: PurchaseOperation) {
    setOpError(null);
    setOperation(op);
    setConfirmed(op.status === "confirmed" || op.status === "completed" || op.status === "cancelled" || op.payment_status === "paid");
    setPrintMsg(null);
    setEditState(null);
    applyWeighingDraft(readWeighingDraft(op));
    setFamilyFilter("");
    setCenterId(op.collection_center);
    setCustomerId(op.customer);
    setCustomerQuery(op.customer_name ?? op.customer_trade_name ?? op.customer_legal_name ?? partyById.get(op.customer)?.trade_name ?? partyById.get(op.customer)?.legal_name ?? "");
    setShowCustomerSuggestions(false);
    setCustomerCreateError(null);
    setDriverId(op.driver ?? "");
    setDriverInput(op.driver_name ?? drivers.find((d) => d.id === op.driver)?.person_name ?? "");
    setShowDriverSuggestions(false);
    setEditingDriver(false); setEditDriverId(""); setDriverUpdateError(null);
    setItems([]);
    try {
      const opItems = await api.ticketItemsByOperation(op.id);
      setItems(opItems as TicketItem[]);
    } catch { }
  }

  function startNew() {
    setOperation(null); setItems([]);
    setConfirmed(false); setPrintMsg(null);
    setCustomerId(""); setCustomerQuery(""); setShowCustomerSuggestions(false);
    setCustomerCreateError(null); setPlateInput(""); setCustomerVehicles([]);
    setDriverId("");
    setDriverInput(""); setShowDriverSuggestions(false);
    driverSelectionRef.current = { id: "", input: "" };
    applyWeighingDraft(null);
    setFamilyFilter("");
    setEditState(null);
    setEditingDriver(false); setEditDriverId(""); setDriverUpdateError(null);
    loadTodayOps();
  }

  async function saveDriver() {
    if (!canManagePurchases) { setDriverUpdateError("No tienes permiso para cambiar el conductor."); return; }
    if (!operation) return;
    setDriverUpdateLoading(true);
    setDriverUpdateError(null);
    try {
      const updated = await api.operationUpdateDriver(operation.id, editDriverId || null);
      setOperation(updated);
      setTodayOps((prev) => prev.map((op) => (op.id === updated.id ? updated : op)));
      setEditingDriver(false);
      setEditDriverId("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al actualizar el conductor";
      setDriverUpdateError(msg);
    } finally {
      setDriverUpdateLoading(false);
    }
  }

  const operationVehicle = useMemo(() => {
    if (!operation?.vehicle) return null;
    return vehicleById.get(operation.vehicle) ?? null;
  }, [operation, vehicleById]);

  const selectedVehicleId = useMemo(() => {
    if (operation?.vehicle) return operation.vehicle;
    const plate = plateInput.trim().toUpperCase();
    if (!plate) return null;
    const found = [...allVehicles, ...customerVehicles].find(
      (v) => v.plate_number.toUpperCase() === plate
    );
    return found?.id ?? null;
  }, [operation, plateInput, allVehicles, customerVehicles]);

  const historyStats = useMemo(() => {
    const MIN_SESSIONS = 2;
    const completed = vehicleHistoryAll.filter((s) => {
      const g = s.readings.find((r) => r.reading_type === "gross");
      const t = s.readings.find((r) => r.reading_type === "tare");
      return g && t;
    });
    if (completed.length < MIN_SESSIONS) return null;
    let sumGross = 0, sumNet = 0, count = 0;
    for (const s of completed) {
      const g = parseFloat(s.readings.find((r) => r.reading_type === "gross")?.gross_weight_kg ?? "0") || 0;
      const t = parseFloat(s.readings.find((r) => r.reading_type === "tare")?.tare_weight_kg ?? "0") || 0;
      if (g > 0 && t > 0) { sumGross += g; sumNet += Math.max(0, g - t); count++; }
    }
    if (count < MIN_SESSIONS) return null;
    return { avgGrossKg: sumGross / count, avgNetKg: sumNet / count, count };
  }, [vehicleHistoryAll]);

  useEffect(() => {
    setHistoryDateFrom("");
    setHistoryDateTo("");
  }, [selectedVehicleId]);

  useEffect(() => {
    if (!selectedVehicleId) { setVehicleHistory([]); return; }
    setVehicleHistoryLoading(true);
    setHistoryDisplayCount(HISTORY_PAGE_SIZE);
    api.weighingSessionsByVehicle(selectedVehicleId, {
      dateFrom: historyDateFrom || undefined,
      dateTo: historyDateTo || undefined,
    })
      .then((sessions) => {
        const sorted = [...sessions].sort(
          (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
        );
        setVehicleHistory(sorted);
      })
      .catch(() => setVehicleHistory([]))
      .finally(() => setVehicleHistoryLoading(false));
  }, [selectedVehicleId, historyDateFrom, historyDateTo]);

  useEffect(() => {
    if (!selectedVehicleId) { setVehicleHistoryAll([]); return; }
    api.weighingSessionsByVehicle(selectedVehicleId, {})
      .then((sessions) => setVehicleHistoryAll(sessions))
      .catch(() => setVehicleHistoryAll([]));
  }, [selectedVehicleId]);

  const operationCustomer = useMemo(() => {
    if (!operation?.customer) return null;
    return partyById.get(operation.customer) ?? null;
  }, [operation, partyById]);

  const statusLabel: Record<string, string> = {
    open: "Abierta",
    confirmed: "Confirmada",
    completed: "Completada",
    cancelled: "Cancelada",
  };
  const statusBadge: Record<string, string> = {
    open: "badge-amber",
    confirmed: "badge-green",
    completed: "badge-blue",
    cancelled: "badge-gray",
  };

  return (
    <Page title="Compra de materiales">

      {/* Operaciones del día */}
      <div className="section-panel" style={{ marginBottom: 20 }}>
        <div className="section-panel-header">
          <h3>Operaciones del día</h3>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {opsLoading && <span className="muted" style={{ fontSize: "0.8rem" }}>Cargando...</span>}
            <span className="badge badge-gray">{todayOps.length} operación{todayOps.length !== 1 ? "es" : ""}</span>
            <button className="btn-ghost" style={{ fontSize: "0.78rem", padding: "3px 10px" }} onClick={loadTodayOps} disabled={opsLoading}>
              Actualizar
            </button>
            <button className="btn-primary" style={{ fontSize: "0.78rem", padding: "4px 14px" }} onClick={startNew} disabled={!canManagePurchases}>
              + Nueva compra
            </button>
          </div>
        </div>
        {todayOps.length === 0 ? (
          <div style={{ padding: "16px 20px", color: "var(--muted)", fontSize: "0.85rem" }}>
            {opsLoading ? "Cargando operaciones del día..." : "No hay operaciones registradas hoy. Presiona + Nueva compra para iniciar."}
          </div>
        ) : (() => {
          const totalPages = Math.ceil(todayOps.length / OPS_PAGE_SIZE);
          const pageOps = todayOps.slice(opsPage * OPS_PAGE_SIZE, (opsPage + 1) * OPS_PAGE_SIZE);
          return (
            <>
              <div style={{ overflowX: "auto" }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: 32 }}>#</th>
                      <th>Folio</th>
                      <th>Cliente</th>
                      <th>Encargado</th>
                      <th>Conductor</th>
                      <th>Hora</th>
                      <th>Estado</th>
                      <th>Total</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageOps.map((op) => {
                      const isSelected = operation?.id === op.id;
                      const customer = partyById.get(op.customer);
                      const time = op.created_at
                        ? new Date(op.created_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })
                        : "-";
                      const globalIdx = todayOps.indexOf(op);
                      return (
                        <tr
                          key={op.id}
                          style={{ background: isSelected ? "var(--accent-dim)" : undefined, cursor: "pointer" }}
                          onClick={() => selectExistingOp(op)}
                        >
                          <td style={{ color: "var(--muted)", fontSize: "0.78rem" }}>{todayOps.length - globalIdx}</td>
                          <td style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                            {isSelected && <span style={{ color: "var(--accent)", marginRight: 6 }}>▶</span>}
                            {op.folio}
                          </td>
                          <td>{customer?.trade_name || customer?.legal_name || "-"}</td>
                          <td style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{op.opened_by_name ?? "-"}</td>
                          <td style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{op.driver_name?.trim() || "-"}</td>
                          <td style={{ color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>{time}</td>
                          <td>
                            <span className={`badge ${statusBadge[op.status] ?? "badge-gray"}`} style={{ fontSize: "0.7rem" }}>
                              {statusLabel[op.status] ?? op.status}
                            </span>
                          </td>
                          <td style={{ fontWeight: 700, color: "var(--accent-2)", fontVariantNumeric: "tabular-nums" }}>
                            {parseFloat(op.total_amount) > 0 ? fmtMXN(parseFloat(op.total_amount)) : "-"}
                          </td>
                          <td>
                            <button
                              className={isSelected ? "btn-secondary" : "btn-ghost"}
                              style={{ fontSize: "0.75rem", padding: "3px 10px" }}
                              onClick={(e) => { e.stopPropagation(); selectExistingOp(op); }}
                            >
                              {isSelected ? "Activa" : "Ver"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "10px 20px",
                  borderTop: "1px solid var(--border)", background: "var(--panel-2)",
                }}>
                  <button
                    className="btn-ghost"
                    style={{ fontSize: "0.78rem", padding: "3px 10px" }}
                    disabled={opsPage === 0}
                    onClick={() => setOpsPage((p) => p - 1)}
                  >
                    Anterior
                  </button>
                  <span style={{ fontSize: "0.8rem", color: "var(--muted)", flex: 1, textAlign: "center" }}>
                    Página {opsPage + 1} de {totalPages} · {todayOps.length} operaciones
                  </span>
                  <button
                    className="btn-ghost"
                    style={{ fontSize: "0.78rem", padding: "3px 10px" }}
                    disabled={opsPage >= totalPages - 1}
                    onClick={() => setOpsPage((p) => p + 1)}
                  >
                    Siguiente →
                  </button>
                </div>
              )}
            </>
          );
        })()}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>

        {/* LEFT COLUMN */}
        <div style={{ display: "grid", gap: 16 }}>

          {/* Step 1: Operation setup */}
          <div className="section-panel" style={{ display: operation ? "none" : "block" }}>
            <div className="section-panel-header">
              <h3>Datos de la compra</h3>
              {operation && (
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span className="badge badge-green">Folio: {operation.folio}</span>
                  <span className="badge badge-blue" title="Conductor asignado">
                    🧑‍✈️ {operation.driver_name ?? "Sin conductor"}
                  </span>
                </div>
              )}
            </div>
            <div className="section-panel-body" style={{ display: "grid", gap: 12, minHeight: 260 }}>
              {collectionCenters.length > 1 && (
                <label>
                  Centro de acopio
                  <select value={centerId} onChange={(e) => setCenterId(e.target.value)} disabled={!!operation}>
                    <option value="">Seleccionar...</option>
                    {collectionCenters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  {materialId && priceItemByMaterialId.get(materialId) && (
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: 4 }}>
                      Precio vigente:{" "}
                      <strong style={{ color: "var(--text)" }}>
                        {fmtMXN(parseFloat(priceItemByMaterialId.get(materialId)?.unit_price ?? "0") || 0)}
                      </strong>
                      {priceItemSourceByMaterialId.get(materialId) === "provider" ? " · lista del proveedor" : " · lista base general"}
                    </div>
                  )}
                </label>
              )}
              {center && collectionCenters.length <= 1 && (
                  <div><span className="badge badge-blue">🏭 {center.name}</span></div>
              )}

              <label style={{ position: "relative" }}>
                Cliente / Proveedor <span style={{ color: "var(--danger)" }}>*</span>
                <input
                  type="text"
                  value={customerQuery}
                  placeholder={
                    selectedCustomer
                      ? "Buscar otro cliente o crear uno nuevo"
                      : "Busca por nombre, RFC, teléfono o escribe uno nuevo"
                  }
                  disabled={!!operation}
                  onChange={(e) => {
                    setCustomerQuery(e.target.value);
                    setCustomerId("");
                    setShowCustomerSuggestions(true);
                    setCustomerCreateError(null);
                    setPlateInput("");
                  }}
                  onFocus={() => setShowCustomerSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowCustomerSuggestions(false), 150)}
                  autoComplete="off"
                  style={{ borderColor: !customerId ? "rgba(239,68,68,0.5)" : undefined }}
                />
                {selectedCustomer && !operation && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, fontSize: "0.72rem", color: "var(--muted)" }}>
                    <span>
                      Seleccionado: <strong style={{ color: "var(--text)" }}>{selectedCustomer.trade_name || selectedCustomer.legal_name}</strong>
                    </span>
                    <button
                      type="button"
                      className="btn-ghost"
                      style={{ fontSize: "0.7rem", padding: "2px 8px" }}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setCustomerId("");
                        setCustomerQuery("");
                        setShowCustomerSuggestions(true);
                      }}
                    >
                      Limpiar
                    </button>
                  </div>
                )}
                {showCustomerSuggestions && !operation && (
                  <div style={{
                    position: "absolute",
                    zIndex: 20,
                    left: 0,
                    right: 0,
                    top: "100%",
                    background: "var(--panel)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                    maxHeight: 280,
                    overflowY: "auto",
                  }}>
                    <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", fontSize: "0.72rem", color: "var(--muted)" }}>
                      Busca un cliente existente o crea uno nuevo sin salir de la compra.
                    </div>
                    {customerSearchResults.map((party) => {
                      const label = party.trade_name || party.legal_name;
                      return (
                        <div
                          key={party.id}
                          style={{ padding: "8px 12px", cursor: "pointer", fontSize: "0.85rem" }}
                          onMouseDown={() => {
                            setCustomerId(party.id);
                            setCustomerQuery(label);
                            setShowCustomerSuggestions(false);
                            setCustomerCreateError(null);
                            setPlateInput("");
                            setShowDriverSuggestions(false);
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--panel-2)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                        >
                          <div style={{ fontWeight: 600 }}>{label}</div>
                          <div style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
                            {party.kind === "company" ? "Empresa" : "Persona"}
                            {party.tax_id ? ` · RFC/ID ${party.tax_id}` : ""}
                            {party.phone ? ` · ${party.phone}` : ""}
                          </div>
                        </div>
                      );
                    })}
                    {customerSearchResults.length === 0 && customerQuery.trim() && (
                      <div style={{ padding: "10px 12px", fontSize: "0.82rem", color: "var(--muted)" }}>
                        No hay coincidencias.
                      </div>
                    )}
                    {!customerExactMatch && customerQuery.trim() && (
                      <div style={{ padding: "10px 12px", borderTop: "1px solid var(--border)", display: "grid", gap: 8 }}>
                        <div style={{ fontSize: "0.76rem", color: "var(--muted)" }}>
                          No existe un cliente con ese nombre. Podemos crearlo en este momento.
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <label style={{ margin: 0, fontSize: "0.76rem", display: "flex", alignItems: "center", gap: 6 }}>
                            Tipo
                            <select
                              value={customerCreateKind}
                              onChange={(e) => setCustomerCreateKind(e.target.value as Party["kind"])}
                              style={{ minWidth: 120 }}
                            >
                              <option value="company">Empresa</option>
                              <option value="person">Persona</option>
                            </select>
                          </label>
                          <button
                            type="button"
                            className="btn-primary"
                            style={{ fontSize: "0.78rem", padding: "4px 10px" }}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={createCustomerFromSearch}
                            disabled={!canManagePurchases || customerCreateLoading}
                          >
                            {customerCreateLoading ? "Creando..." : `Crear "${customerQuery.trim()}"`}
                          </button>
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
                          Se guardará con ese nombre y quedará seleccionada para seguir la compra.
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {customerCreateError && (
                  <div style={{ fontSize: "0.75rem", color: "var(--danger)", marginTop: 4 }}>
                    {customerCreateError}
                  </div>
                )}
              </label>

              {/* Plate input with customer-scoped autocomplete */}
              <label style={{ position: "relative" }}>
                Placa del vehículo (opcional)
                <input
                  type="text"
                  value={plateInput}
                  placeholder={
                    !customerId ? "Selecciona cliente primero" :
                    vehicleLoading ? "Cargando..." :
                    customerVehicles.length > 0 ? `${customerVehicles.length} vehículo(s) registrados — escribe la placa` :
                    "Escribe la placa (nueva o existente)"
                  }
                  disabled={!!operation || !customerId}
                  onChange={(e) => { setPlateInput(e.target.value); setShowSuggestions(true); }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  autoComplete="off"
                />
                {showSuggestions && !operation && customerId && plateSuggestions.length > 0 && (
                  <div style={{
                    position: "absolute", zIndex: 10, left: 0, right: 0, top: "100%",
                    background: "var(--panel)", border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)", boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                    maxHeight: 200, overflowY: "auto",
                  }}>
                    {plateSuggestions.map((v) => (
                      <div
                        key={v.id}
                        style={{ padding: "8px 12px", cursor: "pointer", fontSize: "0.85rem" }}
                        onMouseDown={() => { setPlateInput(v.plate_number); setShowSuggestions(false); }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--panel-2)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                      >
                        <span style={{ fontWeight: 600 }}>{v.plate_number}</span>
                        {v.label && v.label !== v.plate_number && (
                            <span style={{ color: "var(--muted)", marginLeft: 8 }}>— {v.label}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {plateInput && !operation && (
                  <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: 3 }}>
                    {[...allVehicles, ...customerVehicles].find((v) => v.plate_number.toUpperCase() === plateInput.trim().toUpperCase())
                      ? "✓ Vehículo existente"
                      : "⚠ Placa nueva — se creará al iniciar la compra"}
                  </div>
                )}
              </label>

              {!operation ? (
                <label style={{ position: "relative" }}>
                  Conductor (opcional)
                  <input
                    type="text"
                    value={driverInput}
                    placeholder={
                      !customerId
                        ? "Selecciona cliente primero"
                        : customerDriverPool.length > 0
                          ? `${customerDriverPool.length} conductor(es) relacionados — escribe para buscar`
                          : "Escribe el conductor"
                    }
                    disabled={!customerId || !!operation}
                    onChange={(e) => {
                      setDriverInput(e.target.value);
                      setDriverId("");
                      driverSelectionRef.current = { id: "", input: e.target.value };
                      setShowDriverSuggestions(true);
                    }}
                    onFocus={() => setShowDriverSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowDriverSuggestions(false), 150)}
                    autoComplete="off"
                  />
                  {showDriverSuggestions && !operation && customerId && driverSuggestions.length > 0 && (
                    <div style={{
                      position: "absolute", zIndex: 10, left: 0, right: 0, top: "100%",
                      background: "var(--panel)", border: "1px solid var(--border)",
                      borderRadius: "var(--radius-sm)", boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                      maxHeight: 220, overflowY: "auto",
                    }}>
                      {driverSuggestions.map((d) => (
                        <div
                          key={d.id}
                          style={{ padding: "8px 12px", cursor: "pointer", fontSize: "0.85rem" }}
                          onMouseDown={() => {
                            setDriverId(d.id);
                            setDriverInput(d.person_name ?? d.license_number ?? d.id);
                            driverSelectionRef.current = { id: d.id, input: d.person_name ?? d.license_number ?? d.id };
                            setShowDriverSuggestions(false);
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--panel-2)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                        >
                          <span style={{ fontWeight: 600 }}>{d.person_name ?? d.license_number ?? d.id}</span>
                          {d.person_name && d.license_number && (
                            <span style={{ color: "var(--muted)", marginLeft: 8 }}>— Lic: {d.license_number}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {driverInput && !operation && (
                    <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: 3 }}>
                      {driverSuggestions.find((d) => d.id === driverId) ||
                      activeDrivers.find((d) => normalizeLookup(d.person_name ?? "") === normalizeLookup(driverInput) || normalizeLookup(d.license_number) === normalizeLookup(driverInput))
                        ? "✓ Conductor registrado"
                        : "⚠ Se usará la coincidencia elegida al iniciar la compra"}
                    </div>
                  )}
                </label>
              ) : (
                <div>
                  <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginBottom: 4 }}>Conductor</div>
                  {editingDriver ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <select
                        value={editDriverId}
                        onChange={(e) => setEditDriverId(e.target.value)}
                        disabled={driverUpdateLoading}
                      >
                        <option value="">— Sin conductor asignado —</option>
                        {drivers.filter((d) => d.is_active !== false).map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.person_name ?? d.license_number ?? d.id}
                            {d.person_name && d.license_number ? ` (Lic: ${d.license_number})` : ""}
                          </option>
                        ))}
                      </select>
                      {driverUpdateError && (
                        <div style={{ fontSize: "0.75rem", color: "var(--danger)" }}>{driverUpdateError}</div>
                      )}
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          className="btn-primary"
                          style={{ fontSize: "0.78rem", padding: "4px 12px" }}
                          onClick={saveDriver}
                          disabled={!canManagePurchases || driverUpdateLoading}
                        >
                          {driverUpdateLoading ? "Guardando..." : "Guardar"}
                        </button>
                        <button
                          className="btn-ghost"
                          style={{ fontSize: "0.78rem", padding: "4px 10px" }}
                          onClick={() => { setEditingDriver(false); setEditDriverId(""); setDriverUpdateError(null); }}
                          disabled={driverUpdateLoading}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontWeight: 500, fontSize: "0.88rem" }}>
                        {operation.driver_name ?? <span style={{ color: "var(--muted)" }}>Sin conductor asignado</span>}
                      </span>
                      {!confirmed && (
                        <button
                          className="btn-ghost"
                          style={{ fontSize: "0.72rem", padding: "2px 8px" }}
                          onClick={() => {
                            setEditDriverId(operation.driver ?? "");
                            setEditingDriver(true);
                            setDriverUpdateError(null);
                          }}
                          disabled={!canManagePurchases}
                        >
                          ✏ Cambiar
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {opError && <div className="error-banner">{opError}</div>}
              {!operation ? (
                <button
                  className="btn-primary"
                  style={{ marginTop: 4 }}
                  onClick={openOperation}
                  disabled={!canManagePurchases || opLoading || !customerId || !centerId}
                >
                  {opLoading ? "Abriendo..." : "Iniciar compra"}
                </button>
              ) : (
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span className={`badge ${confirmed ? "badge-green" : "badge-amber"}`}>
                    {confirmed ? "Confirmada ✓" : `Estado: ${operation.status}`}
                  </span>
                  {!confirmed && <button className="btn-ghost" onClick={startNew} disabled={!canManagePurchases}>Nueva compra</button>}
                </div>
              )}
              <div className="info-banner" style={{ display: "grid", gap: 4 }}>
                <strong>Lista de precios aplicada</strong>
                <span style={{ fontSize: "0.82rem" }}>
                  {selectedPriceList
                    ? `${selectedPriceList.name} · ${selectedPriceList.code}${selectedPriceList.linked_party ? ` · ${partyById.get(selectedPriceList.linked_party)?.trade_name ?? partyById.get(selectedPriceList.linked_party)?.legal_name ?? "Persona/empresa"}` : ""}`
                    : customerId
                      ? "No hay lista enlazada a este cliente; se usará la lista general del centro si existe."
                      : "Selecciona un cliente para cargar su lista de precios."}
                </span>
                {selectedPriceListItems.length > 0 && (
                  <span style={{ fontSize: "0.76rem", color: "var(--muted)" }}>
                    {(isBasePriceList ? fallbackPriceListItems.length : customerPriceListItems.length)} material
                    {(isBasePriceList ? fallbackPriceListItems.length : customerPriceListItems.length) !== 1 ? "es" : ""}{" "}
                    con precio {isBasePriceList ? "base" : "especial"}.
                  </span>
                )}
                {!isBasePriceList && selectedPriceList?.linked_party ? (
                  <span style={{ fontSize: "0.76rem", color: "var(--muted)" }}>
                    Si un material no está en la lista del proveedor, se toma el precio base del centro.
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {operation && (
            <div className="section-panel">
              <div className="section-panel-header">
                <h3>Compra activa</h3>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span className="badge badge-green">Folio: {operation.folio}</span>
                  <span className={`badge ${isCancelledOperation ? "badge-red" : confirmed ? "badge-green" : "badge-amber"}`}>
                    {confirmed ? "Confirmada" : isCancelledOperation ? "Cancelada" : `Estado: ${operation.status}`}
                  </span>
                </div>
              </div>
              <div className="section-panel-body" style={{ display: "grid", gap: 12 }}>
                <div className="info-banner" style={{ display: "grid", gap: 4 }}>
                  <strong>{operation.customer_name ?? operation.customer_trade_name ?? operation.customer_legal_name ?? "Cliente"}</strong>
                  <span>Centro: {center?.name ?? "—"}</span>
                  <span>Vehiculo: {operation.vehicle_plate ?? plateInput ?? "—"}</span>
                  <span>Conductor: {operation.driver_name ?? "—"}</span>
                  <span>Total: {fmtMXN(totalAmount)} · Pagado: {fmtMXN(parseFloat(operation.paid_amount ?? "0") || 0)} · Pendiente: {fmtMXN(parseFloat(operation.pending_amount ?? "0") || 0)}</span>
                </div>
                {!isCancelledOperation ? (
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button className="btn-secondary" onClick={printTicket} disabled={!canManagePurchases}>
                      Imprimir ticket
                    </button>
                    {canCancelOperation && (
                      <button className="btn-ghost" onClick={cancelOperation} disabled={!canManagePurchases || confirming}>
                        Cancelar compra
                      </button>
                    )}
                    <button className="btn-ghost" onClick={startNew} disabled={!canManagePurchases}>
                      Nueva compra
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button className="btn-ghost" onClick={startNew}>
                      Nueva compra
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Vehicle weighing history */}
          {selectedVehicleId && (
            <div className="section-panel">
              <div className="section-panel-header">
                <h3>Historial de pesajes del vehículo</h3>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {vehicleHistoryLoading
                    ? <span className="muted" style={{ fontSize: "0.78rem" }}>Cargando...</span>
                    : <span className="badge badge-gray">{vehicleHistory.length} sesión{vehicleHistory.length !== 1 ? "es" : ""}</span>
                  }
                  {historyStats && !vehicleHistoryLoading && (
                    <span className="badge badge-blue" style={{ fontSize: "0.68rem" }} title={`Promedio de ${historyStats.count} sesiones completadas`}>
                      <span className="badge badge-blue" style={{ fontSize: "0.68rem" }} title={`Promedio de ${historyStats.count} sesiones completadas`}>Promedio neto {fmtKg(historyStats.avgNetKg)} kg</span>
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-end", padding: "10px 20px 0", flexWrap: "wrap" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: "0.78rem", margin: 0 }}>
                  Desde
                  <input
                    type="date"
                    value={historyDateFrom}
                    onChange={(e) => setHistoryDateFrom(e.target.value)}
                    style={{ fontSize: "0.78rem", padding: "3px 7px" }}
                  />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: "0.78rem", margin: 0 }}>
                  Hasta
                  <input
                    type="date"
                    value={historyDateTo}
                    onChange={(e) => setHistoryDateTo(e.target.value)}
                    style={{ fontSize: "0.78rem", padding: "3px 7px" }}
                  />
                </label>
                {(historyDateFrom || historyDateTo) && (
                  <button
                    className="btn-ghost"
                    style={{ fontSize: "0.75rem", padding: "3px 10px" }}
                    onClick={() => { setHistoryDateFrom(""); setHistoryDateTo(""); }}
                  >
                    Limpiar filtros
                  </button>
                )}
              </div>
              {vehicleHistory.length === 0 && !vehicleHistoryLoading ? (
                <div style={{ padding: "12px 20px", color: "var(--muted)", fontSize: "0.82rem" }}>
                  Sin sesiones de pesaje{(historyDateFrom || historyDateTo) ? " en el período seleccionado" : " previas"} para este vehículo.
                </div>
              ) : (
                <>
                  <div style={{ overflowX: "auto" }}>
                    <table className="table" style={{ fontSize: "0.8rem" }}>
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Folio op.</th>
                          <th>Bruto (kg)</th>
                          <th>Tara (kg)</th>
                          <th>Neto (kg)</th>
                          <th>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vehicleHistory.slice(0, historyDisplayCount).map((session) => {
                          const grossReading = session.readings.find((r) => r.reading_type === "gross");
                          const tareReading = session.readings.find((r) => r.reading_type === "tare");
                          const grossKgVal = parseFloat(grossReading?.gross_weight_kg ?? "0") || 0;
                          const tareKgVal = parseFloat(tareReading?.tare_weight_kg ?? "0") || 0;
                          const netKgVal = grossKgVal > 0 && tareKgVal > 0 ? Math.max(0, grossKgVal - tareKgVal) : null;
                          const dateStr = new Date(session.started_at).toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "2-digit" });
                          const timeStr = new Date(session.started_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
                          const netAnomaly = historyStats && netKgVal !== null && historyStats.avgNetKg > 0
                            ? Math.abs(netKgVal - historyStats.avgNetKg) / historyStats.avgNetKg
                            : null;
                          const isNetAnomalous = netAnomaly !== null && netAnomaly > WEIGHT_ANOMALY_THRESHOLD;
                          const netAnomalyDir = isNetAnomalous && netKgVal !== null ? (netKgVal > historyStats!.avgNetKg ? "high" : "low") : null;
                          return (
                            <tr key={session.id} style={isNetAnomalous ? { background: netAnomalyDir === "high" ? "rgba(239,68,68,0.06)" : "rgba(234,179,8,0.07)" } : undefined}>
                              <td style={{ color: "var(--muted)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                                {dateStr} {timeStr}
                              </td>
                              <td style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                                {session.operation_folio ?? "—"}
                              </td>
                              <td style={{ fontVariantNumeric: "tabular-nums" }}>
                                {grossKgVal > 0 ? fmtKg(grossKgVal) : "—"}
                              </td>
                              <td style={{ fontVariantNumeric: "tabular-nums" }}>
                                {tareKgVal > 0 ? fmtKg(tareKgVal) : "—"}
                              </td>
                              <td style={{ fontVariantNumeric: "tabular-nums", fontWeight: netKgVal !== null ? 600 : undefined }}>
                                {netKgVal !== null ? fmtKg(netKgVal) : "—"}
                                {isNetAnomalous && (
                                  <span
                                    title={`Neto ${netAnomalyDir === "high" ? "inusualmente alto" : "inusualmente bajo"}: ${(netAnomaly! * 100).toFixed(0)}% vs promedio histórico (${fmtKg(historyStats!.avgNetKg)} kg)`}
                                    style={{
                                      marginLeft: 5,
                                      cursor: "help",
                                      fontSize: "0.75rem",
                                      color: netAnomalyDir === "high" ? "var(--danger)" : "var(--warning, #ca8a04)",
                                    }}
                                  >
                                    {netAnomalyDir === "high" ? "⚠ Alto" : "⚠ Bajo"}
                                  </span>
                                )}
                              </td>
                              <td>
                                <span className={`badge ${session.status === "open" ? "badge-amber" : "badge-green"}`} style={{ fontSize: "0.68rem" }}>
                                  {session.status === "open" ? "Abierta" : "Cerrada"}
                                </span>
                                {session.status !== "open" && session.ended_at && (
                                  <div style={{ fontSize: "0.68rem", color: "var(--muted)", marginTop: 2, whiteSpace: "nowrap" }}>
                                    {new Date(session.ended_at).toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "2-digit" })}{" "}
                                    {new Date(session.ended_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {vehicleHistory.length > historyDisplayCount && (
                    <div style={{ padding: "10px 20px" }}>
                      <button
                        className="btn-ghost"
                        style={{ fontSize: "0.8rem", width: "100%" }}
                        onClick={() => setHistoryDisplayCount((c) => c + HISTORY_PAGE_SIZE)}
                      >
                        Cargar más ({vehicleHistory.length - historyDisplayCount} restantes)
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Step 2: Weighing */}
          <div className="section-panel" style={{ opacity: !operation ? 0.5 : 1, pointerEvents: !operation ? "none" : undefined }}>
            <div className="section-panel-header">
              <h3>② Pesaje y captura</h3>
              {scaleDevice && <span className="badge badge-gray" style={{ fontSize: "0.7rem" }}>{scaleDevice.name}</span>}
            </div>
            <div className="section-panel-body" style={{ display: "grid", gap: 14 }}>
              {scaleDevice && (
                <div className="info-banner" style={{ fontSize: "0.8rem" }}>
                  <strong>Dispositivo activo:</strong> {scaleDeviceLabel}
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label>
                  Familia
                  <select value={familyFilter} onChange={(e) => { setFamilyFilter(e.target.value); setMaterialId(""); }}>
                    <option value="">Todas</option>
                    {families.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </label>
                <label>
                  Material <span style={{ color: "var(--danger)" }}>*</span>
                  <select
                    value={materialId}
                    onChange={(e) => { setMaterialId(e.target.value); setMermaKg(""); }}
                    style={{ borderColor: !materialId && diffStep === "cycling" ? "rgba(239,68,68,0.5)" : undefined }}
                  >
                    <option value="">— Seleccionar —</option>
                    {filteredMaterials.map((m) => <option key={m.id} value={m.id}>{materialOptionLabel(m)}</option>)}
                  </select>
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label>
                  Método de pesaje
                  <select
                    value={method}
                    onChange={(e) => { setMethod(e.target.value); resetWeigh(); }}
                    disabled={diffStep === "cycling"}
                  >
                    <option value="vehicle_differential">⚖ Diferencia vehicular</option>
                    <option value="secondary_direct">🏋 Báscula directa</option>
                    <option value="manual_contingency">✏ Manual / contingencia</option>
                  </select>
                </label>
                <label>
                  Precio unitario ($/kg)
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input type="number" value={unitPrice} min={0} step={0.01} onChange={(e) => setUnitPrice(e.target.value)} />
                    {priceSuggestion?.found && <span className="badge badge-green" style={{ whiteSpace: "nowrap" }}>Lista ✓</span>}
                  </div>
                </label>
              </div>

              {/* Scale display */}
              {method !== "manual_contingency" && (
                <div>
                  <div className="scale-display">
                    <div className={`scale-weight ${!liveStable ? (isDisc ? "disconnected" : "unstable") : ""}`}>
                      {displayWeight != null
                        ? displayWeight.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        : "— — —"}
                    </div>
                    <div className="scale-unit">{scaleDevice?.kind === "vehicle_scale" ? "kg (vehicular)" : "kg"}</div>
                    <div className="scale-status-row">
                      <div className={`scale-dot ${!liveReading ? "disconnected" : isDisc ? "disconnected" : liveStable ? "stable" : "unstable"}`} />
                      <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
                        {!liveReading ? "Sin lectura" : isDisc ? "Desconectada" : liveStable ? "Estable ✓" : "Oscilando..."}
                      </span>
                    </div>
                  </div>

                  {!hasScale ? (
                    <div className="info-banner" style={{ marginTop: 10, fontSize: "0.8rem" }}>Sin báscula configurada.</div>
                  ) : !scaleDevice ? (
                    <div className="info-banner" style={{ marginTop: 10, fontSize: "0.8rem" }}>
                      No hay báscula configurada para esta compra.
                    </div>
                  ) : null}

                  <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                    <button
                      className={autoRead ? "btn-danger" : "btn-secondary"}
                      style={{ flex: 1 }}
                      onClick={() => {
                        if (autoRead) {
                          void pauseScaleReading();
                          return;
                        }
                        void startScaleReading();
                      }}
                      disabled={!canManagePurchases}
                    >
                      {autoRead ? "⏸ Pausar lectura" : "▶ Iniciar lectura"}
                    </button>

                    <button
                      className="btn-primary"
                      style={{ flex: 1 }}
                      onClick={registerCurrentReading}
                      disabled={!canManagePurchases || !liveReading}
                    >
                      ● Registrar lectura
                    </button>

                    {method === "vehicle_differential" && diffStep === "idle" && (
                      <button
                        className="btn-primary"
                        style={{ flex: 1 }}
                        disabled={!canManagePurchases || !canCaptureGross}
                        onClick={captureGross}
                        title="Captura el peso inicial (vehículo cargado). No necesitas seleccionar material todavía."
                      >
                        ⬇ Capturar peso inicial
                      </button>
                    )}

                    {method === "vehicle_differential" && diffStep === "cycling" && !capturedTareKg && (
                      <button
                        className="btn-primary"
                        style={{ flex: 1 }}
                        disabled={!canManagePurchases || !canCaptureTare}
                        onClick={captureTare}
                        title="Captura la tara cuando el vehículo haya descargado el material"
                      >
                        ⬇ Capturar tara
                      </button>
                    )}
                    {method === "vehicle_differential" && diffStep === "cycling" && capturedTareKg && (
                      <button
                        className="btn-primary"
                        style={{ flex: 1 }}
                        type="button"
                        disabled={!canManagePurchases || !canAddItemDiff || itemLoading}
                        onClick={addItemDiff}
                      >
                        {itemLoading ? "Guardando..." : "+ Agregar partida"}
                      </button>
                    )}

                    {method === "secondary_direct" && (
                      <button
                        className="btn-primary"
                        style={{ flex: 1 }}
                        type="button"
                        disabled={!canManagePurchases || (!canCaptureDirect && !!materialId)}
                        onClick={captureDirectReading}
                      >
                        ✓ Capturar lectura
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Differential step indicators */}
              {method === "vehicle_differential" && (
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{
                    padding: "10px 14px", borderRadius: "var(--radius-sm)",
                    background: diffStep === "idle" ? "var(--accent-dim)" : "var(--panel-2)",
                    border: `1px solid ${diffStep === "idle" ? "rgba(34,197,94,0.3)" : "var(--border)"}`,
                  }}>
                    <div style={{ fontSize: "0.7rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      Paso 1 — Peso inicial (vehículo cargado)
                    </div>
                    <div style={{ fontSize: "1.2rem", fontWeight: 700, color: diffRefKg ? "var(--text)" : "var(--muted)", marginTop: 4 }}>
                      {diffRefKg ? `${fmtKg(parseFloat(diffRefKg))} kg` : "Pendiente — no es necesario seleccionar material"}
                    </div>
                    {(() => {
                      if (!diffRefKg || !historyStats || historyStats.avgGrossKg <= 0) return null;
                      const capturedGross = parseFloat(diffRefKg);
                      const deviation = Math.abs(capturedGross - historyStats.avgGrossKg) / historyStats.avgGrossKg;
                      if (deviation <= WEIGHT_ANOMALY_THRESHOLD) return null;
                      const dir = capturedGross > historyStats.avgGrossKg ? "high" : "low";
                      return (
                        <div style={{
                          marginTop: 8, padding: "6px 10px", borderRadius: "var(--radius-sm)",
                          background: dir === "high" ? "rgba(239,68,68,0.08)" : "rgba(234,179,8,0.10)",
                          border: `1px solid ${dir === "high" ? "rgba(239,68,68,0.35)" : "rgba(234,179,8,0.4)"}`,
                          fontSize: "0.78rem",
                          color: dir === "high" ? "var(--danger)" : "#92400e",
                          display: "flex", gap: 6, alignItems: "center",
                        }}>
                          <span>⚠</span>
                          <span>
                            Peso inicial {dir === "high" ? "inusualmente alto" : "inusualmente bajo"} — {(deviation * 100).toFixed(0)}% vs promedio histórico del vehículo ({fmtKg(historyStats.avgGrossKg)} kg, {historyStats.count} sesiones)
                          </span>
                        </div>
                      );
                    })()}
                  </div>

                  {diffStep === "cycling" && (
                    <div style={{
                      padding: "10px 14px", borderRadius: "var(--radius-sm)",
                      background: capturedTareKg ? "rgba(34,197,94,0.06)" : "var(--accent-dim)",
                      border: `1px solid ${capturedTareKg ? "rgba(34,197,94,0.3)" : "rgba(34,197,94,0.2)"}`,
                    }}>
                      <div style={{ fontSize: "0.7rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        Paso 2 — Tara y registro del material
                      </div>
                      <div style={{ fontSize: "0.82rem", color: "var(--muted)", marginTop: 6, display: "flex", gap: 16, flexWrap: "wrap" }}>
                        <span>Ref: <strong style={{ color: "var(--text)" }}>{fmtKg(refKgNum)} kg</strong></span>
                        {capturedTareKg ? (
                          <span>Tara capturada: <strong style={{ color: "var(--accent)" }}>{fmtKg(capturedTareNum)} kg</strong></span>
                        ) : displayWeight != null ? (
                          <span>En báscula: <strong style={{ color: liveStable ? "var(--text-soft)" : "var(--warning)" }}>
                            {fmtKg(displayWeight)} kg {liveStable ? "" : "(oscilando)"}
                          </strong></span>
                        ) : null}
                      </div>
                      {capturedTareKg && netClean > 0 && (
                        <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "0.82rem", color: "var(--muted)" }}>
                            <label style={{ display: "flex", gap: 6, alignItems: "center", textTransform: "none", margin: 0 }}>
                              Merma (kg)
                              <input
                                type="number"
                                value={mermaKg !== "" ? mermaKg : mermaNum.toFixed(3)}
                                min={0}
                                step={0.001}
                                onChange={(e) => setMermaKg(e.target.value)}
                                style={{ width: 80, padding: "4px 8px", fontSize: "0.8rem" }}
                              />
                            </label>
                            <span style={{ color: "var(--muted)" }}>({((mermaNum / netRaw) * 100).toFixed(1)}%)</span>
                            {mermaSourceLabel && (
                              <span style={{ fontSize: "0.75rem", color: "var(--muted)", fontStyle: "italic", marginLeft: 4 }}>
                                {mermaSourceLabel}
                              </span>
                            )}
                          </div>
                          <div style={{ display: "flex", gap: 16, alignItems: "baseline" }}>
                            <span style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--accent)" }}>{fmtKg(netClean)} kg neto</span>
                            {priceNum > 0 && <span style={{ color: "var(--accent-2)", fontWeight: 600 }}>{fmtMXN(estimatedAmount)}</span>}
                            <button
                              className="btn-ghost"
                              style={{ fontSize: "0.72rem", padding: "2px 8px" }}
                              onClick={() => { setCapturedTareKg(""); setMermaKg(""); setItemMsg(null); }}
                            >
                              ↺ Recapturar
                            </button>
                          </div>
                          {(() => {
                            if (!historyStats || historyStats.avgNetKg <= 0 || netClean <= 0) return null;
                            const deviation = Math.abs(netClean - historyStats.avgNetKg) / historyStats.avgNetKg;
                            if (deviation <= WEIGHT_ANOMALY_THRESHOLD) return null;
                            const dir = netClean > historyStats.avgNetKg ? "high" : "low";
                            return (
                              <div style={{
                                padding: "6px 10px", borderRadius: "var(--radius-sm)",
                                background: dir === "high" ? "rgba(239,68,68,0.08)" : "rgba(234,179,8,0.10)",
                                border: `1px solid ${dir === "high" ? "rgba(239,68,68,0.35)" : "rgba(234,179,8,0.4)"}`,
                                fontSize: "0.78rem",
                                color: dir === "high" ? "var(--danger)" : "#92400e",
                                display: "flex", gap: 6, alignItems: "center",
                              }}>
                                <span>⚠</span>
                                <span>
                                  Neto {dir === "high" ? "inusualmente alto" : "inusualmente bajo"} — {(deviation * 100).toFixed(0)}% vs promedio histórico del vehículo ({fmtKg(historyStats.avgNetKg)} kg, {historyStats.count} sesiones)
                                </span>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                      {!materialId && (
                        <div style={{ fontSize: "0.75rem", color: "var(--warning)", marginTop: 6 }}>
                          Selecciona el material antes de capturar la tara.
                        </div>
                      )}
                      {!capturedTareKg && materialId && (
                        <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: 6 }}>
                          Cuando el vehículo haya descargado el material, presiona <strong>⬇ Capturar tara</strong>.
                        </div>
                      )}
                      <button
                        className="btn-ghost"
                        style={{ marginTop: 8, fontSize: "0.75rem" }}
                        onClick={() => { setDiffStep("idle"); setDiffRefKg(""); setCapturedTareKg(""); setMaterialId(""); setMermaKg(""); setItemMsg(null); }}
                      >
                        ↺ Reiniciar ciclo completo
                      </button>
                    </div>
                  )}
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

              {/* Net weight preview (non-differential) */}
              {netClean > 0 && method !== "vehicle_differential" && (
                <div style={{
                  padding: "14px 16px", borderRadius: "var(--radius-sm)",
                  background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", display: "grid", gap: 6,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}>
                    <label style={{ textTransform: "none", display: "flex", gap: 8, alignItems: "center", color: "var(--muted)" }}>
                      Merma (kg)
                      <input type="number" value={mermaKg !== "" ? mermaKg : mermaNum.toFixed(3)} min={0} step={0.001}
                        onChange={(e) => setMermaKg(e.target.value)}
                        style={{ width: 80, padding: "4px 8px", fontSize: "0.8rem" }} />
                      {mermaSourceLabel && (
                        <span style={{ fontSize: "0.75rem", color: "var(--muted)", fontStyle: "italic" }}>
                          {mermaSourceLabel}
                        </span>
                      )}
                    </label>
                    <span>− {fmtKg(mermaNum)} kg</span>
                  </div>
                  <div style={{ borderTop: "1px solid rgba(34,197,94,0.2)", paddingTop: 8, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--accent)" }}>Peso neto</span>
                    <span style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--accent)", letterSpacing: "-0.03em" }}>{fmtKg(netClean)} kg</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", fontWeight: 600 }}>
                    <span style={{ color: "var(--muted)" }}>Precio × neto</span>
                    <span style={{ color: "var(--accent-2)" }}>{fmtMXN(estimatedAmount)}</span>
                  </div>
                </div>
              )}

              {itemMsg && (
                <div className={itemMsg.toLowerCase().includes("error") ? "error-banner" : "info-banner"}>
                  {itemMsg}
                </div>
              )}

              {method !== "vehicle_differential" && (
                <button
                  className="btn-primary"
                  disabled={!canManagePurchases || ((!canAddItemManual && !canAddItemDirect) || itemLoading || confirmed)}
                  onClick={addItem}
                  style={{ fontSize: "1rem", padding: "12px" }}
                >
                  {itemLoading ? "Guardando..." : `+ Agregar partida${netClean > 0 ? ` — ${fmtKg(netClean)} kg · ${fmtMXN(estimatedAmount)}` : ""}`}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: "grid", gap: 16 }}>

          {/* Items table */}
          <div className="section-panel">
            <div className="section-panel-header">
              <h3>Partidas registradas</h3>
              <span className="badge badge-gray">{items.length} partida{items.length !== 1 ? "s" : ""}</span>
            </div>
            {items.length === 0 ? (
              <div style={{ padding: "24px 20px", textAlign: "center" }}>
                <div style={{ fontSize: "2rem", marginBottom: 8 }}>○</div>
                <p className="muted" style={{ margin: 0 }}>
                  {!operation ? "Inicia una compra para registrar partidas." : "Aún no hay partidas."}
                </p>
              </div>
            ) : (
              <>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Material</th>
                      <th>Método</th>
                      <th>Neto (kg)</th>
                      <th>Merma</th>
                      <th>Precio</th>
                      <th>Importe</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => {
                      const mermaKgVal = parseFloat(item.merma_kg) || 0;
                      const netKgVal = parseFloat(item.net_weight_kg) || 0;
                      const cleanKg = netKgVal + mermaKgVal;
                      const mermaPct = cleanKg > 0 ? (mermaKgVal / cleanKg) * 100 : 0;
                      return (
                      <tr key={item.id}>
                        <td style={{ fontWeight: 500 }}>{materialById.get(item.material)?.name ?? item.material}</td>
                        <td>
                          <span className="badge badge-gray" style={{ fontSize: "0.68rem" }}>
                            {item.method === "vehicle_differential" ? "Diferencial" : item.method === "secondary_direct" ? "Directo" : "Manual"}
                          </span>
                        </td>
                        <td style={{ fontVariantNumeric: "tabular-nums" }}>{fmtKg(netKgVal)}</td>
                        <td style={{ fontVariantNumeric: "tabular-nums", color: mermaKgVal > 0 ? "var(--warning, #f59e0b)" : "var(--muted)" }}>
                          {mermaKgVal > 0 ? (
                            <>
                              <span>{fmtKg(mermaKgVal)}</span>
                              <span style={{ fontSize: "0.72rem", marginLeft: 4, opacity: 0.75 }}>({mermaPct.toFixed(1)}%)</span>
                            </>
                           ) : <span>—</span>}
                        </td>
                        <td style={{ color: "var(--muted)" }}>{fmtMXN(parseFloat(item.unit_price))}</td>
                        <td style={{ fontWeight: 700, color: "var(--accent-2)" }}>{fmtMXN(parseFloat(item.amount))}</td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {!confirmed && (
                            <div style={{ display: "flex", gap: 4 }}>
                              <button className="btn-ghost" style={{ fontSize: "0.72rem", padding: "3px 8px" }}
                                onClick={() => startEditItem(item)} title="Editar partida" disabled={!canManagePurchases}>✏</button>
                              <button className="btn-ghost" style={{ fontSize: "0.72rem", padding: "3px 8px", color: "var(--danger)" }}
                                onClick={() => deleteItem(item.id)} title="Eliminar partida" disabled={!canManagePurchases || itemLoading}>🗑</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );})}
                  </tbody>
                </table>
                <div style={{ padding: "14px 20px", borderTop: "1px solid var(--border)", background: "var(--panel-2)", display: "grid", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
                       {items.length} partida{items.length !== 1 ? "s" : ""} · {fmtKg(totalWeight)} kg
                    </span>
                    <span style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--accent-2)" }}>{fmtMXN(totalAmount)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span style={{ fontSize: "0.78rem", color: totalMermaKg > 0 ? "var(--warning, #f59e0b)" : "var(--muted)" }}>Merma total</span>
                    <span style={{ fontSize: "0.88rem", fontVariantNumeric: "tabular-nums", color: totalMermaKg > 0 ? "var(--warning, #f59e0b)" : "var(--muted)" }}>
                      {fmtKg(totalMermaKg)} kg
                      <span style={{ fontSize: "0.72rem", marginLeft: 4, opacity: 0.8 }}>({totalMermaPct.toFixed(1)}%)</span>
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Edit item panel */}
          {editState && (
            <div className="section-panel">
              <div className="section-panel-header">
                <h3>Editar partida</h3>
                <button className="btn-ghost" style={{ fontSize: "0.8rem" }} onClick={() => setEditState(null)} disabled={!canManagePurchases}>Cancelar</button>
              </div>
              <div className="section-panel-body" style={{ display: "grid", gap: 10 }}>
                <label>
                  Material
                  <select value={editState.materialId} onChange={(e) => setEditState((s) => s && ({ ...s, materialId: e.target.value }))}>
                    {materials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <label>Peso bruto (kg)<input type="number" value={editState.grossKg} onChange={(e) => setEditState((s) => s && ({ ...s, grossKg: e.target.value }))} /></label>
                  <label>Peso tara (kg)<input type="number" value={editState.tareKg} onChange={(e) => setEditState((s) => s && ({ ...s, tareKg: e.target.value }))} /></label>
                  <label>
                    Merma (kg)
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input type="number" value={editState.mermaKg} min={0} step={0.001}
                        onChange={(e) => setEditState((s) => s && ({ ...s, mermaKg: e.target.value }))}
                        style={{ flex: 1 }} />
                      {(() => {
                        const m = parseFloat(editState.mermaKg) || 0;
                        const gross = parseFloat(editState.grossKg) || 0;
                        const tare = parseFloat(editState.tareKg) || 0;
                        const clean = gross - tare;
                        return clean > 0 && m > 0
                          ? <span style={{ fontSize: "0.78rem", color: "var(--warning, #f59e0b)", whiteSpace: "nowrap" }}>
                              {((m / clean) * 100).toFixed(1)}%
                            </span>
                          : null;
                      })()}
                    </div>
                  </label>
                  <label>Precio ($/kg)<input type="number" value={editState.unitPrice} onChange={(e) => setEditState((s) => s && ({ ...s, unitPrice: e.target.value }))} /></label>
                </div>
                {itemMsg && itemMsg.toLowerCase().includes("error") && (
                  <div className="error-banner">{itemMsg}</div>
                )}
                <button className="btn-primary" onClick={saveEditItem} disabled={!canManagePurchases || itemLoading}>
                  {itemLoading ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            </div>
          )}

          {/* Confirm section */}
          {operation && items.length > 0 && !confirmed && operation.status !== "cancelled" && (
            <div className="section-panel">
                <div className="section-panel-header"><h3>Cerrar compra</h3></div>
              <div className="section-panel-body" style={{ display: "grid", gap: 10 }}>
                <div style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
                  Revisa las partidas antes de imprimir el ticket. La compra se confirma cuando el pago queda liquidado en caja.
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="btn-primary" style={{ flex: 1 }} onClick={printTicket} disabled={!canManagePurchases || confirming || itemLoading}>
                    {confirming ? "Procesando..." : "Imprimir ticket"}
                  </button>
                  {canCancelOperation && (
                    <button className="btn-ghost" onClick={cancelOperation} disabled={!canManagePurchases || confirming}>
                      Cancelar compra
                    </button>
                  )}
                </div>
                {printMsg && <div className="info-banner">{printMsg}</div>}
              </div>
            </div>
          )}

          {/* Ticket on confirm */}
          {confirmed && operation && (
            <div className="section-panel">
              <div className="section-panel-header">
                  <h3>✓ Compra confirmada</h3>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn-secondary" style={{ fontSize: "0.8rem" }} onClick={printTicket} disabled={!canManagePurchases}>🖨 Imprimir</button>
                  <button className="btn-ghost" style={{ fontSize: "0.8rem" }} onClick={startNew} disabled={!canManagePurchases}>Nueva compra</button>
                </div>
              </div>
              <div className="section-panel-body" style={{ paddingTop: 12 }}>
                {printMsg && <div className="info-banner" style={{ marginBottom: 12 }}>{printMsg}</div>}
                <TicketViewer
                  operation={operation}
                  items={items}
                  center={center ?? null}
                  customer={operationCustomer}
                  vehicle={operationVehicle}
                  materialById={materialById}
                />
              </div>
            </div>
          )}

          {/* Help */}
          {!operation && (
            <div className="section-panel">
              <div className="section-panel-header"><h3>Cómo usar</h3></div>
              <div className="section-panel-body" style={{ display: "grid", gap: 8, fontSize: "0.82rem", color: "var(--muted)" }}>
                <p style={{ margin: 0 }}><strong style={{ color: "var(--text-soft)" }}>①</strong> Selecciona cliente. Escribe la placa (se sugieren las del cliente; si es nueva se crea automáticamente). Presiona <strong style={{ color: "var(--text-soft)" }}>Iniciar compra</strong>.</p>
                <p style={{ margin: 0 }}><strong style={{ color: "var(--text-soft)" }}>②</strong> Para <em>Diferencia vehicular</em>: captura el peso inicial con el vehículo cargado (sin seleccionar material). Luego por cada material, selecciónalo, regresa el vehículo y presiona <strong style={{ color: "var(--text-soft)" }}>Tara + agregar partida</strong>.</p>
                <p style={{ margin: 0 }}><strong style={{ color: "var(--text-soft)" }}>③</strong> Edita o elimina partidas con los botones de cada fila.</p>
                <p style={{ margin: 0 }}><strong style={{ color: "var(--text-soft)" }}>④</strong> Al confirmar, aparece el ticket completo en pantalla.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Page>
  );
}
