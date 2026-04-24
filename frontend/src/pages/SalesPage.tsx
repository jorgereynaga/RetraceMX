import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../api/resources";
import type { CollectionCenter, Material, Party, SaleItem, SaleOrder } from "../types";
import { Page } from "../components/Page";

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

export function SalesPage() {
  const [orders, setOrders] = useState<SaleOrder[]>([]);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [centers, setCenters] = useState<CollectionCenter[]>([]);
  const [buyers, setBuyers] = useState<Party[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [orderId, setOrderId] = useState("");
  const [centerId, setCenterId] = useState("");
  const [buyerId, setBuyerId] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [filterCenterId, setFilterCenterId] = useState("");
  const [filterMaterialId, setFilterMaterialId] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [quantityKg, setQuantityKg] = useState("0");
  const [unitPrice, setUnitPrice] = useState("0");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [availableStock, setAvailableStock] = useState<string | null>(null);

  useEffect(() => {
    refresh();
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

  const selectedOrder = useMemo(() => orders.find((order) => order.id === orderId) ?? null, [orders, orderId]);
  const selectedItems = useMemo(() => items.filter((item) => item.sale_order === orderId), [items, orderId]);
  const centerById = useMemo(() => Object.fromEntries(centers.map((center) => [center.id, center])), [centers]);
  const buyerById = useMemo(() => Object.fromEntries(buyers.map((buyer) => [buyer.id, buyer])), [buyers]);
  const materialById = useMemo(() => Object.fromEntries(materials.map((material) => [material.id, material])), [materials]);
  const activeCenterId = selectedOrder?.collection_center ?? centerId;

  useEffect(() => {
    if (!activeCenterId || !materialId) {
      setAvailableStock(null);
      return;
    }
    api
      .saleStock(activeCenterId, materialId)
      .then((stock) => setAvailableStock(stock.available_kg))
      .catch(() => setAvailableStock(null));
  }, [activeCenterId, materialId]);

  async function openOrder(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    try {
      const created = await api.saleOrderOpen({
        collection_center_id: centerId,
        buyer_id: buyerId,
        notes,
      });
      setOrderId(created.id);
      setMessage("Orden de venta abierta.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo abrir la orden");
    }
  }

  async function addItem(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    try {
      await api.saleItemCreate({
        sale_order: orderId,
        material: materialId,
        quantity_kg: quantityKg,
        unit_price: unitPrice,
        notes,
      });
      setMessage("Salida registrada.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo registrar la salida");
    }
  }

  async function closeOrder() {
    if (!orderId) return;
    try {
      await api.saleOrderClose(orderId);
      setMessage("Orden de venta cerrada.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cerrar la orden");
    }
  }

  return (
    <Page title="Comercializacion" actions={<span className="muted">Salida, margen y utilidad</span>}>
      <section className="metric-panel" style={{ marginBottom: 16 }}>
        <span>Contexto actual</span>
        <strong>{selectedOrder ? selectedOrder.folio : "Sin venta activa"}</strong>
        <div className="muted" style={{ marginTop: 6 }}>
          Centro: {selectedOrder?.collection_center_name ?? centerLabel(centerById[centerId])}
        </div>
        <div className="muted">
          Comprador: {selectedOrder?.buyer_name ?? partyLabel(buyerById[buyerId])}
        </div>
      </section>

      <form className="inline-form" onSubmit={(event) => event.preventDefault()}>
        <label>
          Filtro centro
          <select value={filterCenterId} onChange={(e) => setFilterCenterId(e.target.value)}>
            <option value="">Todos</option>
            {centers.map((center) => (
              <option key={center.id} value={center.id}>
                {centerLabel(center)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Filtro material
          <select value={filterMaterialId} onChange={(e) => setFilterMaterialId(e.target.value)}>
            <option value="">Todos</option>
            {materials.map((material) => (
              <option key={material.id} value={material.id}>
                {materialLabel(material)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Desde
          <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
        </label>
        <label>
          Hasta
          <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} />
        </label>
      </form>

      <form className="inline-form" onSubmit={openOrder}>
        <label>
          Centro
          <select value={centerId} onChange={(e) => setCenterId(e.target.value)}>
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
          <select value={buyerId} onChange={(e) => setBuyerId(e.target.value)}>
            <option value="">Seleccionar</option>
            {buyers.map((buyer) => (
              <option key={buyer.id} value={buyer.id}>
                {partyLabel(buyer)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Observaciones
          <input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <button type="submit">Abrir venta</button>
      </form>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        <div className="metric-panel">
          <span>Venta</span>
          <strong>{selectedOrder?.folio ?? "-"}</strong>
        </div>
        <div className="metric-panel">
          <span>Ingreso</span>
          <strong>{selectedOrder?.total_amount ?? "0.00"}</strong>
        </div>
        <div className="metric-panel">
          <span>Utilidad</span>
          <strong>{selectedOrder?.total_profit ?? "0.00"}</strong>
        </div>
      </div>

      <div className="metric-panel" style={{ marginTop: 16, marginBottom: 16 }}>
        <span>Inventario disponible</span>
        <strong>{availableStock ?? "-"}</strong>
        <div className="muted" style={{ marginTop: 6 }}>
          {activeCenterId && materialId ? "Disponibilidad consultada en tiempo real para el centro y material seleccionados." : "Selecciona centro y material para consultar disponibilidad."}
        </div>
      </div>

      <form className="inline-form" onSubmit={addItem}>
        <label>
          Material
          <select value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
            <option value="">Seleccionar</option>
            {materials.map((material) => (
              <option key={material.id} value={material.id}>
                {materialLabel(material)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Kg
          <input value={quantityKg} onChange={(e) => setQuantityKg(e.target.value)} />
        </label>
        <label>
          Precio unitario
          <input value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
        </label>
        <button
          type="submit"
          disabled={
            !orderId ||
            !materialId ||
            !activeCenterId ||
            availableStock === "0.000" ||
            (availableStock !== null && Number(quantityKg) > Number(availableStock))
          }
        >
          Agregar salida
        </button>
      </form>

      {message ? <div className="info-banner">{message}</div> : null}

      <div className="grid" style={{ gridTemplateColumns: "1fr auto", alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>Detalle de venta</h3>
        <button type="button" onClick={closeOrder} disabled={!orderId}>
          Cerrar venta
        </button>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Material</th>
            <th>Kg</th>
            <th>Importe</th>
            <th>Costo</th>
            <th>Utilidad</th>
          </tr>
        </thead>
        <tbody>
          {selectedItems.map((item) => (
            <tr key={item.id}>
              <td>{item.material_name ?? materialById[item.material]?.name ?? item.material}</td>
              <td>{item.quantity_kg}</td>
              <td>{item.amount}</td>
              <td>{item.estimated_cost}</td>
              <td>{item.profit}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section style={{ marginTop: 24 }}>
        <h3>Ventas filtradas</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Folio</th>
              <th>Centro</th>
              <th>Comprador</th>
              <th>Estado</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} onClick={() => setOrderId(order.id)} style={{ cursor: "pointer" }}>
                <td>{order.folio}</td>
                <td>{order.collection_center_name ?? centerById[order.collection_center]?.name ?? order.collection_center}</td>
                <td>{order.buyer_name ?? buyerById[order.buyer]?.legal_name ?? order.buyer}</td>
                <td>{order.status}</td>
                <td>{order.total_amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </Page>
  );
}
