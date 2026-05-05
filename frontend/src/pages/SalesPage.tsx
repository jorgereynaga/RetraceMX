import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../api/resources";
import { Page } from "../components/Page";
import type { CollectionCenter, Material, Party, SaleItem, SaleOrder } from "../types";
import { useAuth } from "../context/AuthContext";
import { userCan } from "../utils/permissions";

const SALE_TYPES = [
  { value: "direct_weight", label: "Venta directa por peso" },
  { value: "lot", label: "Venta por lote" },
  { value: "negotiated", label: "Precio negociado" },
  { value: "credit", label: "Venta a crédito" },
  { value: "processed", label: "Material procesado" },
  { value: "mixed", label: "Venta mixta" },
  { value: "contract", label: "Contrato o convenio" },
];

const PAYMENT_TERMS = [
  { value: "cash", label: "Contado" },
  { value: "credit", label: "Crédito" },
  { value: "advance", label: "Anticipo" },
  { value: "transfer", label: "Transferencia" },
  { value: "mixed", label: "Pago mixto" },
];

const PRESENTATIONS = ["granel", "paca", "costal", "contenedor", "tarima", "molido", "triturado", "pellet", "pieza", "lote"];
const QUALITIES = ["limpio", "clasificado", "mixto", "compactado", "seco", "postindustrial", "recuperado", "otro"];

function money(value: number | string | null | undefined) {
  const parsed = typeof value === "string" ? Number(value) : value ?? 0;
  return `$${Number(parsed || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function kg(value: number | string | null | undefined) {
  const parsed = typeof value === "string" ? Number(value) : value ?? 0;
  return Number(parsed || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function partyLabel(party: Party | undefined) {
  if (!party) return "-";
  return party.trade_name || party.legal_name || "-";
}

function centerLabel(center: CollectionCenter | undefined) {
  return center ? `${center.code} · ${center.name}` : "-";
}

function materialLabel(material: Material | undefined) {
  return material ? `${material.code} · ${material.name}` : "-";
}

function statusTone(status?: string) {
  if (status === "cancelled") return "badge-red";
  if (status === "credit") return "badge-amber";
  if (status === "completed" || status === "paid" || status === "closed" || status === "delivered") return "badge-green";
  return "badge-gray";
}

export function SalesPage() {
  const { user } = useAuth();
  const canManageSales = userCan(user, "sales.manage");
  const [orders, setOrders] = useState<SaleOrder[]>([]);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [centers, setCenters] = useState<CollectionCenter[]>([]);
  const [buyers, setBuyers] = useState<Party[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);

  const [orderId, setOrderId] = useState("");
  const [centerId, setCenterId] = useState("");
  const [buyerId, setBuyerId] = useState("");
  const [saleType, setSaleType] = useState("direct_weight");
  const [paymentTerms, setPaymentTerms] = useState("cash");
  const [notes, setNotes] = useState("");

  const [filterCenterId, setFilterCenterId] = useState("");
  const [filterMaterialId, setFilterMaterialId] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const [materialId, setMaterialId] = useState("");
  const [presentation, setPresentation] = useState("granel");
  const [quality, setQuality] = useState("clasificado");
  const [lotCode, setLotCode] = useState("");
  const [quantityKg, setQuantityKg] = useState("0");
  const [unitPrice, setUnitPrice] = useState("0");
  const [listUnitPrice, setListUnitPrice] = useState("0");
  const [priceOverrideReason, setPriceOverrideReason] = useState("");
  const [itemNotes, setItemNotes] = useState("");

  const [message, setMessage] = useState<string | null>(null);
  const [availableStock, setAvailableStock] = useState<string | null>(null);
  const [suggestedPrice, setSuggestedPrice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void refresh();
    api.centers().then(setCenters).catch(() => setCenters([]));
    api.parties().then(setBuyers).catch(() => setBuyers([]));
    api.materials().then(setMaterials).catch(() => setMaterials([]));
  }, [filterCenterId, filterMaterialId, filterDateFrom, filterDateTo]);

  async function refresh() {
    setOrders(
      await api.saleOrders({
        collection_center_id: filterCenterId,
        material_id: filterMaterialId,
        date_from: filterDateFrom,
        date_to: filterDateTo,
      }).catch(() => []),
    );
    setItems(await api.saleItems().catch(() => []));
  }

  const centerById = useMemo(() => Object.fromEntries(centers.map((center) => [center.id, center])), [centers]);
  const buyerById = useMemo(() => Object.fromEntries(buyers.map((buyer) => [buyer.id, buyer])), [buyers]);
  const materialById = useMemo(() => Object.fromEntries(materials.map((material) => [material.id, material])), [materials]);

  const selectedOrder = useMemo(() => orders.find((order) => order.id === orderId) ?? null, [orders, orderId]);
  const selectedBuyer = useMemo(
    () => buyers.find((buyer) => buyer.id === (selectedOrder?.buyer ?? buyerId)) ?? null,
    [buyers, buyerId, selectedOrder?.buyer],
  );
  const selectedCenterId = selectedOrder?.collection_center ?? centerId;
  const selectedItems = useMemo(() => items.filter((item) => item.sale_order === orderId), [items, orderId]);
  const selectedOrderLocked = Boolean(selectedOrder && ["completed", "closed", "cancelled", "paid", "delivered"].includes(selectedOrder.status));

  const totalWeight = Number(selectedOrder?.total_weight_kg ?? 0);
  const totalAmount = Number(selectedOrder?.total_amount ?? 0);
  const totalCost = Number(selectedOrder?.total_cost ?? 0);
  const totalProfit = Number(selectedOrder?.total_profit ?? 0);
  const saldoPorCobrar = Number(selectedOrder?.pending_amount ?? Math.max(totalAmount - Number(selectedOrder?.paid_amount ?? 0), 0));

  useEffect(() => {
    if (!selectedCenterId || !materialId) {
      setAvailableStock(null);
      setSuggestedPrice(null);
      return;
    }
    api.saleStock(selectedCenterId, materialId)
      .then((stock) => setAvailableStock(stock.available_kg))
      .catch(() => setAvailableStock(null));
    api.priceSuggestion(selectedCenterId, materialId)
      .then((suggestion) => {
        if (suggestion.found && suggestion.unit_price) {
          setSuggestedPrice(suggestion.unit_price);
          setListUnitPrice(suggestion.unit_price);
          setUnitPrice(suggestion.unit_price);
        } else {
          setSuggestedPrice(null);
        }
      })
      .catch(() => setSuggestedPrice(null));
  }, [materialId, selectedCenterId]);

  useEffect(() => {
    if (!selectedOrder) return;
    setCenterId(selectedOrder.collection_center);
    setBuyerId(selectedOrder.buyer);
    setSaleType(selectedOrder.sale_type);
    setPaymentTerms(selectedOrder.payment_terms);
    setNotes(selectedOrder.notes ?? "");
  }, [selectedOrder]);

  function clearForm() {
    setOrderId("");
    setCenterId("");
    setBuyerId("");
    setSaleType("direct_weight");
    setPaymentTerms("cash");
    setNotes("");
    setMaterialId("");
    setPresentation("granel");
    setQuality("clasificado");
    setLotCode("");
    setQuantityKg("0");
    setUnitPrice("0");
    setListUnitPrice("0");
    setPriceOverrideReason("");
    setItemNotes("");
    setAvailableStock(null);
    setSuggestedPrice(null);
    setMessage("Formulario listo para una nueva venta.");
  }

  async function saveOrder(event: FormEvent) {
    event.preventDefault();
    if (!canManageSales) {
      setMessage("No tienes permiso para gestionar ventas.");
      return;
    }
    if (!centerId || !buyerId) {
      setMessage("Selecciona centro y comprador.");
      return;
    }
    if (selectedOrderLocked) {
      setMessage("La venta ya está cerrada y no puede editarse.");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      if (selectedOrder) {
        const updated = await api.saleOrderUpdate(selectedOrder.id, {
          collection_center_id: centerId,
          buyer_id: buyerId,
          sale_type: saleType,
          payment_terms: paymentTerms,
          notes,
        });
        setOrderId(updated.id);
        setMessage("Venta actualizada correctamente.");
      } else {
        const created = await api.saleOrderOpen({
          collection_center_id: centerId,
          buyer_id: buyerId,
          sale_type: saleType,
          payment_terms: paymentTerms,
          notes,
        });
        setOrderId(created.id);
        setMessage("Venta creada correctamente.");
      }
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar la venta");
    } finally {
      setLoading(false);
    }
  }

  async function addItem(event: FormEvent) {
    event.preventDefault();
    if (!canManageSales) {
      setMessage("No tienes permiso para gestionar ventas.");
      return;
    }
    if (!orderId || !materialId) {
      setMessage("Selecciona una venta y un material.");
      return;
    }
    if (selectedOrderLocked) {
      setMessage("No puedes agregar partidas a una venta cerrada.");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      await api.saleItemCreate({
        sale_order: orderId,
        material: materialId,
        presentation,
        quality,
        lot_code: lotCode,
        quantity_kg: quantityKg,
        list_unit_price: listUnitPrice || unitPrice,
        unit_price: unitPrice,
        price_override_reason: priceOverrideReason,
        notes: itemNotes,
      });
      setMessage("Partida agregada a la venta.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo agregar la partida");
    } finally {
      setLoading(false);
    }
  }

  async function closeOrder() {
    if (!orderId) return;
    if (!canManageSales) {
      setMessage("No tienes permiso para cerrar ventas.");
      return;
    }
    if (selectedOrderLocked) {
      setMessage("La venta ya está cerrada.");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      await api.saleOrderClose(orderId);
      setMessage("Venta cerrada correctamente.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cerrar la venta");
    } finally {
      setLoading(false);
    }
  }

  const stockNumeric = availableStock !== null ? Number(availableStock) : null;
  const quantityNumeric = Number(quantityKg || 0);
  const stockWarning = stockNumeric !== null && quantityNumeric > stockNumeric;
  const pendingOrders = orders.filter((order) => order.status === "confirmed" || order.status === "draft").length;

  return (
    <Page title="Ventas" actions={<span className="muted">Venta de materiales, partidas y cierre comercial</span>}>
      <div style={{ display: "grid", gap: 20 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <button type="button" className="btn-primary" onClick={clearForm} disabled={!canManageSales}>
            Nueva venta
          </button>
          <button type="button" className="btn-secondary" onClick={() => void refresh()} disabled={loading}>
            Refrescar
          </button>
        </div>

        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 16 }}>
          <div className="metric-panel">
            <span className="metric-label">Ventas abiertas</span>
            <strong className="metric-value">{pendingOrders.toLocaleString("es-MX")}</strong>
          </div>
          <div className="metric-panel">
            <span className="metric-label">Importe total</span>
            <strong className="metric-value">{money(orders.reduce((sum, order) => sum + Number(order.total_amount ?? 0), 0))}</strong>
          </div>
          <div className="metric-panel">
            <span className="metric-label">Kg vendidos</span>
            <strong className="metric-value">{kg(orders.reduce((sum, order) => sum + Number(order.total_weight_kg ?? 0), 0))}</strong>
          </div>
          <div className="metric-panel">
            <span className="metric-label">Saldo por cobrar</span>
            <strong className="metric-value">{money(orders.reduce((sum, order) => sum + Number(order.pending_amount ?? Math.max(Number(order.total_amount ?? 0) - Number(order.paid_amount ?? 0), 0)), 0))}</strong>
          </div>
        </div>

        <section className="section-panel">
          <div className="section-panel-header">
            <h3>Acciones y historial</h3>
            <span className="muted">Confirmación, cierre y seguimiento comercial</span>
          </div>
          <div className="section-panel-body">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
              <button type="button" className="btn-primary" onClick={closeOrder} disabled={!canManageSales || !orderId || loading || selectedOrderLocked}>
                Cerrar venta
              </button>
              <button type="button" className="btn-secondary" onClick={() => void refresh()} disabled={loading}>
                Refrescar
              </button>
            </div>

            <table className="table">
              <thead>
                <tr>
                  <th></th>
                  <th>Folio</th>
                  <th>Centro</th>
                  <th>Comprador</th>
                  <th>Tipo</th>
                  <th>Estado</th>
                  <th>Total</th>
                  <th>Pago</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const isSelected = order.id === orderId;
                  return (
                    <tr
                      key={order.id}
                      onClick={() => setOrderId(order.id)}
                      style={{
                        cursor: "pointer",
                        background: isSelected ? "var(--accent-dim)" : undefined,
                        outline: isSelected ? "1px solid rgba(34,197,94,0.3)" : undefined,
                      }}
                    >
                      <td>{isSelected ? <span className="badge badge-green">Seleccionada</span> : null}</td>
                      <td>{order.folio}</td>
                      <td>{order.collection_center_name ?? centerById[order.collection_center]?.name ?? order.collection_center}</td>
                      <td>{order.buyer_name ?? buyerById[order.buyer]?.legal_name ?? order.buyer}</td>
                      <td>{order.sale_type_label ?? order.sale_type}</td>
                      <td><span className={`badge ${statusTone(order.status)}`}>{order.status_label ?? order.status}</span></td>
                      <td>{money(order.total_amount)}</td>
                      <td>{order.payment_terms_label ?? order.payment_terms}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="section-panel">
          <div className="section-panel-header">
            <h3>Datos del comprador</h3>
            <span className="muted">{selectedBuyer ? partyLabel(selectedBuyer) : "Selecciona comprador"}</span>
          </div>
          <div className="section-panel-body">
            <div className="grid" style={{ gridTemplateColumns: "1fr 1.1fr", gap: 16 }}>
              <div className="card">
                <div className="card-label">Resumen del comprador</div>
                <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                  <div><span className="muted">Tipo</span><br /><strong>{selectedBuyer?.buyer_type_label ?? selectedBuyer?.kind ?? "-"}</strong></div>
                  <div><span className="muted">Roles comerciales</span><br /><strong>{selectedBuyer?.commercial_role_names?.join(", ") || "-"}</strong></div>
                  <div><span className="muted">Contacto</span><br /><strong>{selectedBuyer?.email || selectedBuyer?.phone || "-"}</strong></div>
                  <div><span className="muted">Observaciones</span><br /><strong>{selectedBuyer?.notes || "-"}</strong></div>
                </div>
              </div>

              <form className="inline-form" onSubmit={saveOrder}>
                <label>
                  Centro
                  <select value={centerId} onChange={(e) => setCenterId(e.target.value)} disabled={selectedOrderLocked}>
                    <option value="">Seleccionar</option>
                    {centers.map((center) => (
                      <option key={center.id} value={center.id}>
                        {centerLabel(center)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Comprador
                  <select value={buyerId} onChange={(e) => setBuyerId(e.target.value)} disabled={selectedOrderLocked}>
                    <option value="">Seleccionar</option>
                    {buyers.map((buyer) => (
                      <option key={buyer.id} value={buyer.id}>
                        {partyLabel(buyer)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Tipo de venta
                  <select value={saleType} onChange={(e) => setSaleType(e.target.value)} disabled={selectedOrderLocked}>
                    {SALE_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Términos de pago
                  <select value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} disabled={selectedOrderLocked}>
                    {PAYMENT_TERMS.map((term) => (
                      <option key={term.value} value={term.value}>{term.label}</option>
                    ))}
                  </select>
                </label>
                <label className="full-width-form-field">
                  Observaciones de la venta
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Condiciones comerciales, notas internas o ajustes" disabled={selectedOrderLocked} />
                </label>
                <button type="submit" className="btn-primary" disabled={!canManageSales || loading || selectedOrderLocked}>
                  {selectedOrderLocked ? "Venta cerrada" : selectedOrder ? "Actualizar venta" : "Abrir venta"}
                </button>
              </form>
            </div>
          </div>
        </section>

        <section className="section-panel">
          <div className="section-panel-header">
            <h3>Selección de material y partidas</h3>
            <span className="muted">{selectedCenterId && materialId ? `Stock: ${availableStock ?? "-"}` : "Selecciona centro y material"}</span>
          </div>
          <div className="section-panel-body">
            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <form className="inline-form" onSubmit={addItem}>
                <label>
                  Material
                  <select value={materialId} onChange={(e) => setMaterialId(e.target.value)} disabled={selectedOrderLocked}>
                    <option value="">Seleccionar</option>
                    {materials.map((material) => (
                      <option key={material.id} value={material.id}>
                        {materialLabel(material)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Presentación
                  <select value={presentation} onChange={(e) => setPresentation(e.target.value)} disabled={selectedOrderLocked}>
                    {PRESENTATIONS.map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Calidad
                  <select value={quality} onChange={(e) => setQuality(e.target.value)} disabled={selectedOrderLocked}>
                    {QUALITIES.map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Lote
                  <input value={lotCode} onChange={(e) => setLotCode(e.target.value)} placeholder="L-2026-00045" disabled={selectedOrderLocked} />
                </label>
                <label>
                  Kg
                  <input value={quantityKg} onChange={(e) => setQuantityKg(e.target.value)} inputMode="decimal" disabled={selectedOrderLocked} />
                </label>
                <label>
                  Precio sugerido
                  <input value={suggestedPrice ?? listUnitPrice} readOnly />
                </label>
                <label>
                  Precio final
                  <input value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} inputMode="decimal" disabled={selectedOrderLocked} />
                </label>
                <label className="full-width-form-field">
                  Motivo de ajuste de precio
                  <input value={priceOverrideReason} onChange={(e) => setPriceOverrideReason(e.target.value)} placeholder="Si el precio final cambia, explica el motivo" disabled={selectedOrderLocked} />
                </label>
                <label className="full-width-form-field">
                  Notas de partida
                  <textarea value={itemNotes} onChange={(e) => setItemNotes(e.target.value)} placeholder="Observaciones de calidad o trazabilidad" disabled={selectedOrderLocked} />
                </label>
                <button type="submit" className="btn-primary" disabled={!canManageSales || !orderId || !materialId || loading || selectedOrderLocked}>
                  Agregar partida
                </button>
                {selectedOrderLocked ? <div className="info-banner">Esta venta ya fue cerrada; no se pueden agregar partidas.</div> : null}
                {stockWarning ? <div className="error-banner">La partida excede el inventario disponible. El sistema permitirá el registro, pero la existencia quedará negativa.</div> : null}
              </form>

              <div className="card" style={{ display: "grid", gap: 10 }}>
                <div className="card-label">Resumen financiero</div>
                <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
                  <div className="metric-panel"><span>Subtotal</span><strong>{money(totalAmount)}</strong></div>
                  <div className="metric-panel"><span>Costo</span><strong>{money(totalCost)}</strong></div>
                  <div className="metric-panel"><span>Utilidad</span><strong>{money(totalProfit)}</strong></div>
                  <div className="metric-panel"><span>Saldo por cobrar</span><strong>{money(saldoPorCobrar)}</strong></div>
                </div>
                <div className="muted">
                  {suggestedPrice ? `Precio sugerido vigente: ${money(suggestedPrice)}` : "No hay precio sugerido vigente para esta combinación."}
                </div>
                <div className="muted">
                  {stockNumeric !== null ? `Inventario disponible: ${kg(stockNumeric)} kg` : "Consulta inventario al seleccionar centro y material."}
                </div>
              </div>
            </div>

            {selectedItems.length > 0 ? (
              <table className="table" style={{ marginTop: 16 }}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Material</th>
                    <th>Presentación</th>
                    <th>Calidad</th>
                    <th>Lote</th>
                    <th>Kg</th>
                    <th>Precio</th>
                    <th>Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedItems.map((item, index) => (
                    <tr key={item.id}>
                      <td>{index + 1}</td>
                      <td>{item.material_name ?? materialById[item.material]?.name ?? item.material}</td>
                      <td>{item.presentation || "-"}</td>
                      <td>{item.quality || "-"}</td>
                      <td>{item.lot_code || "-"}</td>
                      <td>{kg(item.quantity_kg)}</td>
                      <td>{money(item.unit_price)}</td>
                      <td>{money(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="muted" style={{ marginTop: 16 }}>Todavía no hay partidas agregadas a esta venta.</div>
            )}
          </div>
        </section>

        {message ? <div className={message.toLowerCase().includes("no") ? "error-banner" : "info-banner"}>{message}</div> : null}
      </div>
    </Page>
  );
}
