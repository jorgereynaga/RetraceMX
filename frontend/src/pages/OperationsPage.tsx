import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../api/resources";
import type { CollectionCenter, Party, PurchaseOperation } from "../types";
import { Page } from "../components/Page";
import { Pagination } from "../components/Pagination";
import { SortableHeader } from "../components/SortableHeader";
import { matchesSearch, paginate } from "../utils/listing";
import { sortByValue } from "../utils/listing";

export function OperationsPage() {
  const [items, setItems] = useState<PurchaseOperation[]>([]);
  const [centers, setCenters] = useState<CollectionCenter[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [collectionCenterId, setCollectionCenterId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState<"folio" | "status" | "payment_status" | "collection_center" | "customer" | "total_amount">("folio");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    const operations = await api.operations().catch(() => []);
    setItems(operations as PurchaseOperation[]);
  }

  useEffect(() => {
    refresh();
    api.centers().then(setCenters).catch(() => setCenters([]));
    api.parties().then(setParties).catch(() => setParties([]));
  }, []);

  const centerById = useMemo(() => Object.fromEntries(centers.map((center) => [center.id, center])), [centers]);
  const partyById = useMemo(() => Object.fromEntries(parties.map((party) => [party.id, party])), [parties]);
  const collectionCenters = useMemo(() => centers.filter((center) => center.kind === "collection"), [centers]);
  const filteredItems = useMemo(
    () =>
      items.filter((item) =>
        matchesSearch(
          [
            item.folio,
            item.status,
            item.payment_status,
            item.print_status,
            item.total_amount,
            item.total_weight_kg,
            centerById[item.collection_center]?.name ?? item.collection_center,
            centerById[item.collection_center]?.code ?? "",
            partyById[item.customer]?.trade_name ?? partyById[item.customer]?.legal_name ?? item.customer,
          ],
          search,
        ),
      ),
    [centerById, items, partyById, search],
  );
  const sortedItems = useMemo(() => {
    const accessors = {
      folio: (item: PurchaseOperation) => item.folio,
      status: (item: PurchaseOperation) => item.status,
      payment_status: (item: PurchaseOperation) => item.payment_status,
      collection_center: (item: PurchaseOperation) => centerById[item.collection_center]?.name ?? "",
      customer: (item: PurchaseOperation) => partyById[item.customer]?.trade_name ?? partyById[item.customer]?.legal_name ?? "",
      total_amount: (item: PurchaseOperation) => item.total_amount,
    } satisfies Record<typeof sortKey, (item: PurchaseOperation) => string | number>;
    return sortByValue(filteredItems, accessors[sortKey], sortDirection);
  }, [centerById, filteredItems, partyById, sortDirection, sortKey]);
  const paginatedItems = useMemo(() => paginate(sortedItems, page, pageSize), [page, pageSize, sortedItems]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [pageSize]);

  useEffect(() => {
    setPage(1);
  }, [sortDirection, sortKey]);

  function toggleSort(nextKey: typeof sortKey) {
    if (nextKey === sortKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDirection("asc");
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    try {
      await api.operationCreate({
        collection_center_id: collectionCenterId,
        customer_id: customerId,
      });
      setMessage("Operación abierta.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo abrir la operación");
    }
  }

  return (
    <Page title="Operaciones" actions={<span className="muted">Ticket central de compra</span>}>
      <div className="metric-panel" style={{ marginBottom: 12 }}>
        <label className="search-box">
          Búsqueda rápida
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por folio, estado, pago, centro o cliente"
          />
        </label>
      </div>

      <form className="inline-form" onSubmit={onSubmit}>
        <label>
          Centro de acopio
          <select value={collectionCenterId} onChange={(e) => setCollectionCenterId(e.target.value)}>
            <option value="">Seleccionar</option>
            {collectionCenters.map((center) => (
              <option key={center.id} value={center.id}>
                {center.code} · {center.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Cliente
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">Seleccionar</option>
            {parties.map((party) => (
              <option key={party.id} value={party.id}>
                {party.trade_name || party.legal_name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Abrir operación</button>
      </form>
      {message ? <div className="info-banner">{message}</div> : null}
      <table className="table">
        <thead>
          <tr>
            <th><SortableHeader label="Folio" active={sortKey === "folio"} direction={sortDirection} onClick={() => toggleSort("folio")} /></th>
            <th><SortableHeader label="Centro" active={sortKey === "collection_center"} direction={sortDirection} onClick={() => toggleSort("collection_center")} /></th>
            <th><SortableHeader label="Cliente" active={sortKey === "customer"} direction={sortDirection} onClick={() => toggleSort("customer")} /></th>
            <th><SortableHeader label="Estado" active={sortKey === "status"} direction={sortDirection} onClick={() => toggleSort("status")} /></th>
            <th><SortableHeader label="Pago" active={sortKey === "payment_status"} direction={sortDirection} onClick={() => toggleSort("payment_status")} /></th>
            <th><SortableHeader label="Total" active={sortKey === "total_amount"} direction={sortDirection} onClick={() => toggleSort("total_amount")} /></th>
          </tr>
        </thead>
        <tbody>
          {paginatedItems.items.map((item) => (
            <tr key={item.id}>
              <td>{item.folio}</td>
              <td>{centerById[item.collection_center]?.name ?? item.collection_center}</td>
              <td>{partyById[item.customer]?.trade_name ?? partyById[item.customer]?.legal_name ?? item.customer}</td>
              <td>{item.status}</td>
              <td>{item.payment_status}</td>
              <td>{item.total_amount}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pagination {...paginatedItems} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={setPageSize} />
    </Page>
  );
}
