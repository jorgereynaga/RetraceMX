import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../api/resources";
import { Page } from "../components/Page";
import { useAuth } from "../context/AuthContext";
import { userCan } from "../utils/permissions";
import type { Payment, PurchaseOperation, SaleItem, SaleOrder, SalePayment, TicketItem } from "../types";

const CASH_QUICK_AMOUNTS = [50, 100, 200, 500, 1000, 2000, 5000, 10000];

const PAYMENT_METHODS = [
  { value: "cash", label: "Efectivo", requiresReference: false, allowsChange: true },
  { value: "transfer", label: "Transferencia", requiresReference: true, allowsChange: false },
  { value: "card", label: "Tarjeta", requiresReference: true, allowsChange: false },
  { value: "cheque", label: "Cheque", requiresReference: true, allowsChange: false },
  { value: "voucher", label: "Vale", requiresReference: true, allowsChange: false },
  { value: "credit", label: "Crédito", requiresReference: false, allowsChange: false },
  { value: "other", label: "Otro", requiresReference: false, allowsChange: false },
] as const;

type CashierMode = "purchase" | "sale";

function parseMoney(value: string) {
  const parsed = Number.parseFloat(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: number | string | null | undefined) {
  const parsed = typeof value === "string" ? Number(value) : value ?? 0;
  return `$${Number(parsed || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatKg(value: number | string | null | undefined) {
  const parsed = typeof value === "string" ? Number(value) : value ?? 0;
  return Number(parsed || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateTime(iso?: string | null) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.toLocaleDateString("es-MX")} ${date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}`;
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function paymentMethodConfig(method: string) {
  return PAYMENT_METHODS.find((item) => item.value === method) ?? PAYMENT_METHODS[0];
}

function paymentMethodLabel(method?: string) {
  return PAYMENT_METHODS.find((item) => item.value === method)?.label ?? method ?? "—";
}

function operationTone(status?: string) {
  if (status === "cancelled") return "badge-red";
  if (status === "completed" || status === "paid" || status === "closed" || status === "delivered") return "badge-green";
  if (status === "credit") return "badge-amber";
  return "badge-gray";
}

function paymentTone(status?: string) {
  if (status === "cancelled") return "badge-red";
  if (status === "active") return "badge-green";
  return "badge-gray";
}

function buildReceiptWindow(title: string, subtitle: string, rows: string, lines: Array<[string, string]>, totals: Array<[string, string]>) {
  const metaRows = lines
    .map(([label, value]) => `<tr><td class="label">${label}</td><td class="value">${value}</td></tr>`)
    .join("");
  const totalRows = totals
    .map(([label, value]) => `<div class="totals-row"><span>${label}</span><span class="strong">${value}</span></div>`)
    .join("");
  return `
    <html>
      <head>
        <title>${title}</title>
        <style>
          @page { size: 80mm auto; margin: 0; }
          * { box-sizing: border-box; }
          body { width: 80mm; margin: 0; padding: 0; font-family: "Courier New", Courier, monospace; color: #111; background: #fff; }
          .ticket { width: 80mm; padding: 4mm 4mm 5mm; font-size: 11px; line-height: 1.25; }
          .center { text-align: center; }
          .title { font-size: 17px; font-weight: 700; letter-spacing: 0.02em; text-transform: uppercase; }
          .subtle { font-size: 10px; color: #333; }
          .rule { border-top: 1px dashed #333; margin: 5px 0; }
          .meta { width: 100%; border-collapse: collapse; margin-top: 2px; }
          .meta td { vertical-align: top; padding: 1px 0; }
          .label { width: 32%; white-space: nowrap; }
          .value { width: 68%; font-weight: 700; }
          .items { width: 100%; border-collapse: collapse; margin-top: 3px; font-size: 10px; }
          .items th { text-align: left; border-bottom: 1px solid #333; padding: 2px 0 3px; font-size: 10px; }
          .items td { padding: 2px 0; border-bottom: 0; vertical-align: top; }
          .totals { margin-top: 4px; }
          .totals-row { display: flex; justify-content: space-between; gap: 8px; padding: 1px 0; }
          .strong { font-weight: 700; }
          .footer { margin-top: 6px; text-align: center; font-size: 10px; }
          .smallcaps { text-transform: uppercase; letter-spacing: 0.03em; }
        </style>
      </head>
      <body>
        <div class="ticket">
          <div class="center">
            <div class="title">CENTRO MATRIZ</div>
            <div class="subtle">${subtitle}</div>
            <div class="subtle">Acopio360</div>
          </div>
          <div class="rule"></div>
          <table class="meta"><tbody>${metaRows}</tbody></table>
          <div class="rule"></div>
          <table class="items">
            <thead><tr><th>Partida</th><th style="text-align:right;">Neto</th><th style="text-align:right;">Importe</th></tr></thead>
            <tbody>${rows || "<tr><td colspan='3'>Sin partidas</td></tr>"}</tbody>
          </table>
          <div class="rule"></div>
          <div class="totals">${totalRows}</div>
          <div class="rule"></div>
          <div class="footer"><div>* * * COPIA SIN VALOR * * *</div></div>
        </div>
        <script>window.onload = () => { window.focus(); window.print(); };</script>
      </body>
    </html>
  `;
}

function openPurchaseReceipt(payment: Payment, operation?: PurchaseOperation | null, items: TicketItem[] = []) {
  const rows = items
    .map((item) => {
      const materialName = item.material_name ?? item.material;
      return `
        <tr>
          <td style="padding: 0 0 2px 0;">${materialName}</td>
          <td style="text-align:right; padding: 0 0 2px 0;">${Number(item.net_weight_kg || 0).toFixed(2)}</td>
          <td style="text-align:right; padding: 0 0 2px 0;">${formatMoney(item.amount)}</td>
        </tr>
      `;
    })
    .join("");
  const html = buildReceiptWindow(
    `Comprobante ${payment.folio ?? payment.id}`,
    "Comprobante de pago",
    rows,
    [
      ["Operacion:", `<span class="smallcaps">${operation?.folio ?? payment.operation_folio ?? "—"}</span>`],
      ["Pago:", `<span class="smallcaps">${payment.folio ?? payment.id}</span>`],
      ["Fecha:", formatDateTime(payment.paid_at)],
      ["Cajero:", payment.received_by_name ?? "—"],
      ["Cliente:", operation?.customer_name ?? operation?.customer_trade_name ?? operation?.customer_legal_name ?? "—"],
      ["Metodo:", payment.method_label ?? payment.method],
      ["Referencia:", payment.reference ?? "—"],
      ["Estado:", operation?.status_label ?? operation?.status ?? "—"],
    ],
    [
      ["Total operacion", formatMoney(operation?.total_amount)],
      ["Pagado", formatMoney(operation?.paid_amount)],
      ["Aplicado", formatMoney(payment.applied_amount ?? payment.amount)],
      ["Recibido", formatMoney(payment.received_amount ?? payment.amount)],
      ["Cambio", formatMoney(payment.change_amount ?? 0)],
      ["Saldo pendiente", formatMoney(operation?.pending_amount)],
    ],
  );
  const win = window.open("", "_blank", "width=360,height=760");
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
}

function openSaleReceipt(payment: SalePayment, sale?: SaleOrder | null, items: SaleItem[] = []) {
  const rows = items
    .map((item) => {
      const materialName = item.material_name ?? item.material;
      return `
        <tr>
          <td style="padding: 0 0 2px 0;">${materialName}</td>
          <td style="text-align:right; padding: 0 0 2px 0;">${Number(item.quantity_kg || 0).toFixed(2)}</td>
          <td style="text-align:right; padding: 0 0 2px 0;">${formatMoney(item.amount)}</td>
        </tr>
      `;
    })
    .join("");
  const html = buildReceiptWindow(
    `Comprobante ${payment.folio ?? payment.id}`,
    "Comprobante de venta",
    rows,
    [
      ["Venta:", `<span class="smallcaps">${sale?.folio ?? payment.sale_order_folio ?? "—"}</span>`],
      ["Pago:", `<span class="smallcaps">${payment.folio ?? payment.id}</span>`],
      ["Fecha:", formatDateTime(payment.paid_at)],
      ["Cajero:", payment.received_by_name ?? "—"],
      ["Cliente:", sale?.buyer_name ?? "—"],
      ["Metodo:", payment.method_label ?? payment.method],
      ["Referencia:", payment.reference ?? "—"],
      ["Estado:", sale?.status_label ?? sale?.status ?? "—"],
    ],
    [
      ["Total venta", formatMoney(sale?.total_amount)],
      ["Pagado", formatMoney(sale?.paid_amount)],
      ["Aplicado", formatMoney(payment.applied_amount ?? payment.amount)],
      ["Recibido", formatMoney(payment.received_amount ?? payment.amount)],
      ["Cambio", formatMoney(payment.change_amount ?? 0)],
      ["Saldo pendiente", formatMoney(sale?.pending_amount)],
    ],
  );
  const win = window.open("", "_blank", "width=360,height=760");
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
}

export function CashierPage() {
  const { user } = useAuth();
  const canManageCashier = userCan(user, "cashier.manage");
  const [mode, setMode] = useState<CashierMode>("purchase");
  const [purchaseOperations, setPurchaseOperations] = useState<PurchaseOperation[]>([]);
  const [purchasePayments, setPurchasePayments] = useState<Payment[]>([]);
  const [purchaseItems, setPurchaseItems] = useState<TicketItem[]>([]);
  const [saleOrders, setSaleOrders] = useState<SaleOrder[]>([]);
  const [salePayments, setSalePayments] = useState<SalePayment[]>([]);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOperationId, setSelectedOperationId] = useState("");
  const [selectedPaymentId, setSelectedPaymentId] = useState("");
  const [method, setMethod] = useState("cash");
  const [receivedAmount, setReceivedAmount] = useState("");
  const [appliedAmount, setAppliedAmount] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    setSelectedPaymentId("");
    setMethod("cash");
    setReceivedAmount("");
    setAppliedAmount("");
    setReference("");
    setNotes("");
  }, [selectedOperationId, mode]);

  const selectedPurchaseOperation = useMemo(
    () => purchaseOperations.find((operation) => operation.id === selectedOperationId) ?? null,
    [purchaseOperations, selectedOperationId],
  );
  const selectedSaleOrder = useMemo(
    () => saleOrders.find((order) => order.id === selectedOperationId) ?? null,
    [saleOrders, selectedOperationId],
  );
  const selectedOperation = mode === "purchase" ? selectedPurchaseOperation : selectedSaleOrder;
  const selectedPurchasePayments = useMemo(
    () => purchasePayments.filter((payment) => payment.operation === selectedOperationId),
    [purchasePayments, selectedOperationId],
  );
  const selectedSalePayments = useMemo(
    () => salePayments.filter((payment) => payment.sale_order === selectedOperationId),
    [salePayments, selectedOperationId],
  );
  const selectedPayments = mode === "purchase" ? selectedPurchasePayments : selectedSalePayments;
  const selectedPurchaseItems = useMemo(
    () => purchaseItems.filter((item) => item.operation === selectedOperationId),
    [purchaseItems, selectedOperationId],
  );
  const selectedSaleLines = useMemo(
    () => saleItems.filter((item) => item.sale_order === selectedOperationId),
    [saleItems, selectedOperationId],
  );
  const selectedLineItems = mode === "purchase" ? selectedPurchaseItems : selectedSaleLines;

  const currentPaid = mode === "purchase"
    ? Number(selectedPurchaseOperation?.paid_amount ?? 0)
    : Number(selectedSaleOrder?.paid_amount ?? 0);
  const totalAmount = Number(mode === "purchase" ? selectedPurchaseOperation?.total_amount ?? 0 : selectedSaleOrder?.total_amount ?? 0);
  const pendingAmount = Number(
    mode === "purchase"
      ? selectedPurchaseOperation?.pending_amount ?? Math.max(totalAmount - currentPaid, 0)
      : selectedSaleOrder?.pending_amount ?? Math.max(totalAmount - currentPaid, 0),
  );
  const isCash = method === "cash";
  const paymentConfig = paymentMethodConfig(method);
  const receivedValue = parseMoney(receivedAmount);
  const appliedValue = isCash ? Math.min(receivedValue, pendingAmount) : parseMoney(appliedAmount);
  const changeValue = isCash ? Math.max(receivedValue - pendingAmount, 0) : 0;
  const canCancelPayment = canManageCashier;
  const paymentReferenceRequired = paymentConfig.requiresReference;

  const filteredPurchaseOperations = useMemo(() => {
    const query = normalize(searchTerm);
    if (!query) return purchaseOperations;
    return purchaseOperations.filter((operation) => {
      const haystack = [
        operation.folio,
        operation.customer_name,
        operation.customer_trade_name,
        operation.customer_legal_name,
        operation.vehicle_plate,
        operation.status,
        operation.payment_status,
      ].join(" ").toLowerCase();
      return haystack.includes(query);
    });
  }, [purchaseOperations, searchTerm]);

  const filteredSaleOrders = useMemo(() => {
    const query = normalize(searchTerm);
    if (!query) return saleOrders;
    return saleOrders.filter((order) => {
      const haystack = [
        order.folio,
        order.buyer_name,
        order.status,
        order.payment_status,
        order.payment_terms,
        order.sale_type,
        order.destination_name,
      ].join(" ").toLowerCase();
      return haystack.includes(query);
    });
  }, [saleOrders, searchTerm]);

  const selectedPayment = useMemo(
    () => selectedPayments.find((payment) => payment.id === selectedPaymentId) ?? null,
    [selectedPayments, selectedPaymentId],
  );
  const pendingPurchaseOperations = useMemo(
    () => purchaseOperations.filter((operation) => Number(operation.pending_amount ?? 0) > 0 && operation.status !== "cancelled"),
    [purchaseOperations],
  );
  const pendingSaleOrders = useMemo(
    () => saleOrders.filter((order) => Number(order.pending_amount ?? 0) > 0 && order.status !== "cancelled"),
    [saleOrders],
  );
  const visibleOperations = selectedOperation
    ? [selectedOperation]
    : mode === "purchase"
      ? (searchTerm.trim() ? filteredPurchaseOperations.filter((operation) => Number(operation.pending_amount ?? 0) > 0) : pendingPurchaseOperations)
      : (searchTerm.trim() ? filteredSaleOrders.filter((order) => Number(order.pending_amount ?? 0) > 0) : pendingSaleOrders);

  const visibleOperationsTotal = visibleOperations.reduce((sum, operation) => sum + Number(operation.total_amount ?? 0), 0);
  const visibleOperationsPending = visibleOperations.reduce((sum, operation) => sum + Number(operation.pending_amount ?? 0), 0);
  const visibleOperationsPaid = visibleOperations.reduce((sum, operation) => sum + Number(operation.paid_amount ?? 0), 0);
  const selectedPartyLabel = mode === "purchase"
    ? (selectedPurchaseOperation?.customer_name ?? selectedPurchaseOperation?.customer_trade_name ?? selectedPurchaseOperation?.customer_legal_name ?? "-")
    : (selectedSaleOrder?.buyer_name ?? "-");
  const selectedModeLabel = mode === "purchase" ? "Compra" : "Venta";
  const paymentMethodHint = paymentReferenceRequired
    ? "Este metodo requiere referencia para registrar el pago."
    : isCash
      ? "En efectivo puedes capturar el monto recibido y el sistema calcula el cambio."
      : "Captura el monto aplicado y las observaciones necesarias.";

  async function refresh() {
    const [ops, pms, tks, sales, salePms, saleLines] = await Promise.all([
      api.operationsAll().catch(() => []),
      api.paymentsAll().catch(() => []),
      api.ticketItemsAll().catch(() => []),
      api.saleOrders().catch(() => []),
      api.salePayments().catch(() => []),
      api.saleItems().catch(() => []),
    ]);
    setPurchaseOperations(ops as PurchaseOperation[]);
    setPurchasePayments(pms as Payment[]);
    setPurchaseItems(tks as TicketItem[]);
    setSaleOrders(sales as SaleOrder[]);
    setSalePayments(salePms as SalePayment[]);
    setSaleItems(saleLines as SaleItem[]);
  }

  function handleModeChange(nextMode: CashierMode) {
    setMode(nextMode);
    setSelectedOperationId("");
    setSelectedPaymentId("");
    setSearchTerm("");
    setReceivedAmount("");
    setAppliedAmount("");
    setReference("");
    setNotes("");
    setMessage(null);
  }

  function clearSearch() {
    setSearchTerm("");
    setSelectedOperationId("");
    setSelectedPaymentId("");
    setMessage(null);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canManageCashier) {
      setMessage("No tienes permiso para registrar pagos.");
      return;
    }
    if (!selectedOperation) return;
    if (pendingAmount <= 0) {
      setMessage("La operacion ya no tiene saldo pendiente.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const payload: Record<string, unknown> = {
        method,
        notes,
        reference,
      };
      if (mode === "purchase") {
        payload.operation = selectedOperation.id;
      } else {
        payload.sale_order = selectedOperation.id;
      }
      if (isCash) {
        payload.received_amount = receivedValue;
        payload.amount = receivedValue;
      } else {
        payload.applied_amount = appliedValue;
        payload.amount = appliedValue;
      }
      const created = mode === "purchase"
        ? await api.createPayment(payload)
        : await api.salePaymentCreate(payload);
      setMessage(
        isCash
          ? `Pago registrado correctamente. Cambio a devolver: ${formatMoney(changeValue)}`
          : "Pago registrado correctamente.",
      );
      setReceivedAmount("");
      setAppliedAmount("");
      setReference("");
      setNotes("");
      setSelectedPaymentId(created.id);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo registrar el pago");
    } finally {
      setBusy(false);
    }
  }

  function commitSearch() {
    const query = normalize(searchTerm);
    if (!query) {
      setSelectedOperationId("");
      return;
    }
    const list = mode === "purchase" ? filteredPurchaseOperations : filteredSaleOrders;
    const exactMatch = list.find((operation) => normalize(operation.folio) === query) ?? list[0];
    if (exactMatch) {
      setSelectedOperationId(exactMatch.id);
      setSearchTerm(exactMatch.folio);
      setMessage(`Operacion cargada: ${exactMatch.folio}`);
      return;
    }
    setMessage("No se encontro una operacion con ese criterio.");
  }

  function applyQuickCash(value: number) {
    setMethod("cash");
    setReceivedAmount((current) => {
      const next = parseMoney(current) + value;
      return next.toFixed(2);
    });
  }

  function setExactCashAmount() {
    setMethod("cash");
    setReceivedAmount(pendingAmount.toFixed(2));
  }

  async function cancelSelectedPayment(payment: Payment | SalePayment) {
    if (!canCancelPayment) {
      setMessage("No tienes permiso para cancelar pagos.");
      return;
    }
    const cancelReasonInput = window.prompt("Motivo de cancelacion", payment.cancel_reason || "");
    if (cancelReasonInput === null) return;
    setBusy(true);
    setMessage(null);
    try {
      if (mode === "purchase") {
        await api.cancelPayment(payment.id, cancelReasonInput);
      } else {
        await api.salePaymentCancel(payment.id, cancelReasonInput);
      }
      setMessage("Pago cancelado. El saldo fue recalculado.");
      await refresh();
      if (selectedPaymentId === payment.id) {
        setSelectedPaymentId("");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cancelar el pago");
    } finally {
      setBusy(false);
    }
  }

  function printSelectedPayment(payment: Payment | SalePayment) {
    if (mode === "purchase") {
      openPurchaseReceipt(payment as Payment, selectedPurchaseOperation, selectedPurchaseItems);
    } else {
      openSaleReceipt(payment as SalePayment, selectedSaleOrder, selectedSaleLines);
    }
  }

  return (
    <Page title="Caja" actions={<span className="muted">Cobro, historial y trazabilidad de pagos</span>}>
      <div style={{ display: "grid", gap: 20 }}>
        <section className="section-panel">
          <div className="section-panel-header">
            <div>
              <h3>Centro de cobro</h3>
              <div className="muted">Busca la operacion, revisa su saldo y registra el pago con claridad.</div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button type="button" className={mode === "purchase" ? "btn-primary" : "btn-secondary"} onClick={() => handleModeChange("purchase")}>
                Compras
              </button>
              <button type="button" className={mode === "sale" ? "btn-primary" : "btn-secondary"} onClick={() => handleModeChange("sale")}>
                Ventas
              </button>
            </div>
          </div>
          <div className="section-panel-body" style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
              <div className="metric-panel">
                <span className="metric-label">Operaciones visibles</span>
                <strong>{visibleOperations.length}</strong>
                <span className="muted">Filtradas para {selectedModeLabel.toLowerCase()}</span>
              </div>
              <div className="metric-panel">
                <span className="metric-label">Saldo pendiente visible</span>
                <strong>{formatMoney(visibleOperationsPending)}</strong>
                <span className="muted">Suma de las operaciones filtradas</span>
              </div>
              <div className="metric-panel">
                <span className="metric-label">Monto pagado visible</span>
                <strong>{formatMoney(visibleOperationsPaid)}</strong>
                <span className="muted">Pagos ya registrados</span>
              </div>
              <div className="metric-panel">
                <span className="metric-label">Total en pantalla</span>
                <strong>{formatMoney(visibleOperationsTotal)}</strong>
                <span className="muted">Importe bruto de la vista actual</span>
              </div>
            </div>
            <div className="info-banner" style={{ display: "grid", gap: 6 }}>
              <div><strong>Modo activo:</strong> {selectedModeLabel}</div>
              <div><strong>Flujo:</strong> Busca la operacion, valida el saldo y registra el cobro. En efectivo, captura el monto recibido y el sistema calcula cambio.</div>
            </div>
          </div>
        </section>

        <section className="section-panel">
          <div className="section-panel-header">
            <h3>Búsqueda de operación</h3>
            <span className="muted">
              {mode === "purchase"
                ? "Folio, codigo de barras, cliente, placa, fecha o estado"
                : "Folio de venta, comprador, fecha, estado o terminos de pago"}
            </span>
          </div>
          <div className="section-panel-body" style={{ display: "grid", gap: 12 }}>
            <div className="inline-form" style={{ gridTemplateColumns: "1fr auto auto auto", alignItems: "end" }}>
              <label className="full-width-form-field">
                Buscar operación
                <input
                  autoFocus
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitSearch();
                    }
                  }}
                  placeholder={mode === "purchase" ? "Folio, cliente, placa o estado" : "Folio de venta, comprador o estado"}
                />
              </label>
              <button type="button" className="btn-primary" onClick={commitSearch}>Cargar operación</button>
              <button type="button" className="btn-secondary" onClick={() => void refresh()}>Actualizar</button>
              <button type="button" className="btn-secondary" onClick={clearSearch}>Limpiar</button>
            </div>
            <div className="muted" style={{ fontSize: "0.82rem" }}>
              Presiona <strong>Enter</strong> para cargar el folio o usa el lector como teclado.
            </div>
          </div>
        </section>

        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20, alignItems: "start" }}>
          <section className="section-panel">
            <div className="section-panel-header">
              <div>
                <h3>{mode === "purchase" ? "Compras pendientes" : "Ventas pendientes"}</h3>
                <div className="muted" style={{ fontSize: "0.82rem" }}>
                  {selectedOperation
                    ? "La lista se centra en la operación seleccionada."
                    : "Se muestran únicamente operaciones con saldo pendiente."}
                </div>
              </div>
              <span className="badge badge-gray">{selectedOperation ? `Seleccionada: ${selectedOperation.folio}` : "Ninguna seleccionada"}</span>
            </div>
            <div className="section-panel-body" style={{ padding: 0 }}>
              <div style={{ overflowX: "auto" }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th></th>
                      <th>Folio</th>
                      <th>Cliente / Comprador</th>
                      <th>Estado</th>
                      <th>Pago</th>
                      <th style={{ textAlign: "right" }}>Total</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleOperations.map((operation) => {
                      const isSelected = operation.id === selectedOperationId;
                      const paymentStatus = mode === "purchase" ? (operation as PurchaseOperation).payment_status : (operation as SaleOrder).payment_status;
                      const label = mode === "purchase"
                        ? ((operation as PurchaseOperation).customer_name ?? (operation as PurchaseOperation).customer_trade_name ?? (operation as PurchaseOperation).customer_legal_name ?? "-")
                        : ((operation as SaleOrder).buyer_name ?? "-");
                      return (
                        <tr
                          key={operation.id}
                          style={{
                            background: isSelected ? "var(--accent-dim)" : undefined,
                            outline: isSelected ? "1px solid rgba(34,197,94,0.3)" : undefined,
                          }}
                        >
                          <td>{isSelected ? <span className="badge badge-green">Seleccionada</span> : null}</td>
                          <td style={{ fontFamily: "monospace", fontWeight: 700 }}>{operation.folio}</td>
                          <td>
                            <div style={{ display: "grid", gap: 2 }}>
                              <strong>{label}</strong>
                              <span className="muted" style={{ fontSize: "0.78rem" }}>{selectedModeLabel} {operation.status_label ?? operation.status}</span>
                            </div>
                          </td>
                          <td><span className={`badge ${operationTone(operation.status)}`}>{operation.status_label ?? operation.status}</span></td>
                          <td><span className={`badge ${paymentTone(mode === "purchase" ? (operation as PurchaseOperation).payment_status : paymentStatus)}`}>{mode === "purchase" ? (operation as PurchaseOperation).payment_status_label ?? paymentStatus : (operation as SaleOrder).payment_status_label ?? paymentStatus ?? "-"}</span></td>
                          <td style={{ textAlign: "right", fontWeight: 700, color: "var(--accent-2)" }}>{formatMoney(operation.total_amount)}</td>
                          <td>
                            <button className="btn-ghost" type="button" onClick={() => setSelectedOperationId(isSelected ? "" : operation.id)}>
                              {isSelected ? "Ocultar" : "Ver detalle"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {visibleOperations.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: "center", padding: 24, color: "var(--muted)" }}>
                          No hay operaciones pendientes para mostrar.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </section>          {selectedOperation ? (
            <section className="section-panel" style={{ maxHeight: "calc(100vh - 32px)", overflowY: "auto" }}>
              <div className="section-panel-header">
                <div>
                  <h3 style={{ fontFamily: "monospace" }}>{selectedOperation.folio}</h3>
                  <div style={{ color: "var(--muted)", fontSize: "0.8rem" }}>{selectedModeLabel} lista para cobro</div>
                </div>
                <button className="btn-ghost" type="button" onClick={() => setSelectedOperationId("")}>Cerrar</button>
              </div>
              <div className="section-panel-body" style={{ display: "grid", gap: 14 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
                  <div className="metric-panel"><span className="metric-label">Total</span><strong>{formatMoney(totalAmount)}</strong></div>
                  <div className="metric-panel"><span className="metric-label">Pendiente</span><strong>{formatMoney(pendingAmount)}</strong></div>
                  <div className="metric-panel"><span className="metric-label">Pagado</span><strong>{formatMoney(currentPaid)}</strong></div>
                  <div className="metric-panel"><span className="metric-label">Método</span><strong>{paymentMethodLabel(method)}</strong></div>
                </div>

                <div className="info-banner" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
                  <div><strong>Cliente / Comprador:</strong> {selectedPartyLabel}</div>
                  <div><strong>Estado:</strong> {selectedOperation.status_label ?? selectedOperation.status}</div>
                  <div><strong>Saldo por cobrar:</strong> {formatMoney(pendingAmount)}</div>
                </div>

                <section className="section-panel" style={{ boxShadow: "none" }}>
                  <div className="section-panel-header">
                    <h3>Captura de pago</h3>
                    <span className={`badge ${paymentTone((mode === "purchase" ? selectedPurchaseOperation?.payment_status : selectedSaleOrder?.payment_status) ?? undefined)}`}>
                      {mode === "purchase"
                        ? selectedPurchaseOperation?.payment_status_label ?? selectedPurchaseOperation?.payment_status ?? "-"
                        : selectedSaleOrder?.payment_status_label ?? selectedSaleOrder?.payment_status ?? "-"}
                    </span>
                  </div>
                  <div className="section-panel-body" style={{ display: "grid", gap: 12 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.35fr) minmax(260px, 0.85fr)", gap: 14, alignItems: "start" }}>
                      <form className="section-panel" style={{ boxShadow: "none", margin: 0 }} onSubmit={onSubmit}>
                        <div className="section-panel-body" style={{ display: "grid", gap: 12, padding: 0 }}>
                          <div className="info-banner" style={{ display: "grid", gap: 4, fontSize: "0.88rem" }}>
                            <strong>{paymentMethodHint}</strong>
                            <span>{isCash ? "Si el monto recibido es mayor al saldo pendiente, el sistema calcula el cambio a devolver." : "En métodos distintos a efectivo no se genera cambio."}</span>
                          </div>

                          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                            <label>
                              Método de pago
                              <select value={method} onChange={(e) => setMethod(e.target.value)}>
                                {PAYMENT_METHODS.map((item) => (
                                  <option key={item.value} value={item.value}>{item.label}</option>
                                ))}
                              </select>
                            </label>

                            {isCash ? (
                              <label>
                                Monto recibido
                                <input value={receivedAmount} onChange={(e) => setReceivedAmount(e.target.value)} inputMode="decimal" placeholder="0.00" />
                              </label>
                            ) : (
                              <label>
                                Monto aplicado
                                <input value={appliedAmount} onChange={(e) => setAppliedAmount(e.target.value)} inputMode="decimal" placeholder="0.00" />
                              </label>
                            )}
                          </div>

                          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                            <label>
                              Referencia
                              <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder={paymentReferenceRequired ? "Obligatoria para este método" : "Voucher, referencia, folio"} />
                            </label>
                            <label>
                              Observaciones
                              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas internas" />
                            </label>
                          </div>

                          <button
                            type="submit"
                            className="btn-primary"
                            style={{ width: "100%" }}
                            disabled={
                              !canManageCashier ||
                              busy ||
                              !selectedOperation ||
                              (isCash ? receivedValue <= 0 : appliedValue <= 0) ||
                              (paymentReferenceRequired && !reference.trim())
                            }
                          >
                            Registrar pago
                          </button>
                        </div>
                      </form>

                      <aside className="section-panel" style={{ boxShadow: "none", margin: 0 }}>
                        <div className="section-panel-body" style={{ display: "grid", gap: 10, padding: 0 }}>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
                            <div className="metric-panel"><span>Recibido</span><strong>{formatMoney(isCash ? receivedValue : appliedValue)}</strong></div>
                            <div className="metric-panel"><span>Aplicado</span><strong>{formatMoney(appliedValue)}</strong></div>
                            <div className="metric-panel"><span>Cambio</span><strong>{formatMoney(changeValue)}</strong></div>
                          </div>

                          <div className="info-banner" style={{ display: "grid", gap: 4 }}>
                            <div><strong>Cliente:</strong> {selectedPartyLabel}</div>
                            <div><strong>Método:</strong> {paymentMethodLabel(method)}</div>
                            <div><strong>Saldo:</strong> {formatMoney(pendingAmount)}</div>
                          </div>

                          <div style={{ display: "grid", gap: 8 }}>
                            <div style={{ fontSize: "0.82rem", color: "var(--muted)" }}>Importes rápidos para efectivo</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                              {CASH_QUICK_AMOUNTS.map((amount) => (
                                <button key={amount} type="button" className="btn-secondary" onClick={() => applyQuickCash(amount)} disabled={!isCash}>
                                  {formatMoney(amount)}
                                </button>
                              ))}
                              <button type="button" className="btn-secondary" onClick={setExactCashAmount} disabled={!isCash}>
                                Monto exacto
                              </button>
                            </div>
                          </div>
                        </div>
                      </aside>
                    </div>
                  </div>
                </section>

                <section className="section-panel" style={{ boxShadow: "none" }}>
                  <div className="section-panel-header">
                    <h3>Pagos registrados</h3>
                    <span className="badge badge-gray">{selectedPayments.length}</span>
                  </div>
                  <div className="section-panel-body" style={{ padding: 0 }}>
                    <div style={{ overflowX: "auto" }}>
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Fecha</th>
                            <th>Método</th>
                            <th>Referencia</th>
                            <th style={{ textAlign: "right" }}>Monto</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedPayments.map((payment) => (
                            <tr
                              key={payment.id}
                              style={{
                                background: payment.id === selectedPaymentId ? "var(--accent-dim)" : undefined,
                                outline: payment.id === selectedPaymentId ? "1px solid rgba(34,197,94,0.3)" : undefined,
                              }}
                            >
                              <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(payment.paid_at)}</td>
                              <td><span className={`badge ${paymentTone(payment.status)}`}>{payment.method_label ?? payment.method}</span></td>
                              <td>{payment.reference || "-"}</td>
                              <td style={{ textAlign: "right", fontWeight: 700 }}>{formatMoney(payment.amount)}</td>
                              <td style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                                <button className="btn-ghost" type="button" onClick={() => setSelectedPaymentId(payment.id)}>
                                  Ver
                                </button>
                                <button className="btn-ghost" type="button" onClick={() => printSelectedPayment(payment)} disabled={!canManageCashier}>
                                  Imprimir
                                </button>
                                <button className="btn-ghost" type="button" onClick={() => void cancelSelectedPayment(payment)} disabled={!canCancelPayment || payment.status === "cancelled"}>
                                  Cancelar
                                </button>
                              </td>
                            </tr>
                          ))}
                          {selectedPayments.length === 0 ? (
                            <tr>
                              <td colSpan={5} style={{ textAlign: "center", color: "var(--muted)", padding: 18 }}>
                                Sin pagos registrados.
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>
              </div>
            </section>
          ) : null}
        </div>

        {message ? <div className={message.toLowerCase().includes("no") ? "error-banner" : "info-banner"}>{message}</div> : null}
      </div>
    </Page>
  );
}

