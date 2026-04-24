import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../api/resources";
import type { Payment, PurchaseOperation, TicketItem } from "../types";
import { Page } from "../components/Page";

export function CashierPage() {
  const [operations, setOperations] = useState<PurchaseOperation[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [items, setItems] = useState<TicketItem[]>([]);
  const [selectedOperationId, setSelectedOperationId] = useState("");
  const [operationSearch, setOperationSearch] = useState("");
  const [amount, setAmount] = useState("0.00");
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    const ops = await api.operations().catch(() => []);
    const pms = await api.payments().catch(() => []);
    const tks = await api.ticketItems().catch(() => []);
    setOperations(ops as PurchaseOperation[]);
    setPayments(pms as Payment[]);
    setItems(tks as TicketItem[]);
  }

  const selectedOperation = useMemo(
    () => operations.find((operation) => operation.id === selectedOperationId) ?? null,
    [operations, selectedOperationId],
  );

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

  const selectedPayments = useMemo(
    () => payments.filter((payment) => payment.operation === selectedOperationId),
    [payments, selectedOperationId],
  );

  const selectedItems = useMemo(
    () => items.filter((item) => item.operation === selectedOperationId),
    [items, selectedOperationId],
  );

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    try {
      await api.createPayment({
        operation: selectedOperationId,
        amount,
        method,
        reference,
        notes,
      });
      setMessage("Pago registrado.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo registrar el pago");
    }
  }

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

  async function closeOperation() {
    if (!selectedOperation) return;
    setMessage(null);
    try {
      await api.operationStatusChange(selectedOperation.id, "completed", "Cierre de caja");
      setMessage("Operacion cerrada.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cerrar la operacion");
    }
  }

  const remaining = useMemo(() => {
    if (!selectedOperation) return "0.00";
    const paid = selectedPayments.reduce((acc, payment) => acc + Number(payment.amount), 0);
    const total = Number(selectedOperation.total_amount);
    return Math.max(total - paid, 0).toFixed(2);
  }, [selectedOperation, selectedPayments]);

  return (
    <Page title="Caja" actions={<span className="muted">Registro de pagos por operacion</span>}>
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        <label>
          Buscar operacion
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
            El lector de código de barras funciona como teclado.
          </div>
        </label>
        <div className="metric-panel">
          <span>Total</span>
          <strong>{selectedOperation?.total_amount ?? "0.00"}</strong>
        </div>
        <div className="metric-panel">
          <span>Pendiente</span>
          <strong>{remaining}</strong>
        </div>
      </div>

      <label style={{ marginTop: 16, display: "block" }}>
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
              {operation.folio} - {operation.payment_status}
            </option>
          ))}
        </select>
      </label>

      <form className="inline-form" onSubmit={onSubmit}>
        <label>
          Monto
          <input value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <label>
          Metodo
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="cash">Efectivo</option>
            <option value="transfer">Transferencia</option>
            <option value="card">Tarjeta</option>
            <option value="other">Otro</option>
          </select>
        </label>
        <label>
          Referencia
          <input value={reference} onChange={(e) => setReference(e.target.value)} />
        </label>
        <label>
          Observaciones
          <input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <button type="submit" disabled={!selectedOperationId}>
          Registrar pago
        </button>
      </form>

      {message ? <div className="info-banner">{message}</div> : null}

      <div className="grid" style={{ gridTemplateColumns: "1fr auto", alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>Pagos y cierre</h3>
        <button type="button" onClick={closeOperation} disabled={!selectedOperationId}>
          Cerrar operacion
        </button>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <section>
          <h3>Partidas ligadas</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Material</th>
                <th>Neto</th>
                <th>Importe</th>
              </tr>
            </thead>
            <tbody>
              {selectedItems.map((item) => (
                <tr key={item.id}>
                  <td>{item.material}</td>
                  <td>{item.net_weight_kg}</td>
                  <td>{item.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section>
          <h3>Pagos</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Monto</th>
                <th>Metodo</th>
                <th>Referencia</th>
              </tr>
            </thead>
            <tbody>
              {selectedPayments.map((payment) => (
                <tr key={payment.id}>
                  <td>{payment.amount}</td>
                  <td>{payment.method}</td>
                  <td>{payment.reference ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </Page>
  );
}
