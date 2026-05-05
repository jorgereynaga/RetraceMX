import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../api/resources";
import type { CollectionCenter } from "../types";
import { Page } from "../components/Page";
import { Pagination } from "../components/Pagination";
import { SortableHeader } from "../components/SortableHeader";
import { matchesSearch, paginate } from "../utils/listing";
import { sortByValue } from "../utils/listing";
import { useAuth } from "../context/AuthContext";
import { userCan } from "../utils/permissions";

function kindLabel(kind: CollectionCenter["kind"]) {
  if (kind === "smelter") return "Fundidora";
  if (kind === "destination") return "Destino";
  return "Centro de acopio";
}

function emptyForm() {
  return {
    code: "",
    name: "",
    kind: "collection" as CollectionCenter["kind"],
    address: "",
    latitude: "",
    longitude: "",
    is_active: true,
  };
}

export function CentersPage() {
  const { user } = useAuth();
  const canManageCenters = userCan(user, "centers.manage");
  const [items, setItems] = useState<CollectionCenter[]>([]);
  const [selectedCenterId, setSelectedCenterId] = useState("");
  const [form, setForm] = useState(emptyForm());
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState<"code" | "kind" | "name" | "address" | "active">("code");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    setItems(await api.centers().catch(() => []));
  }

  useEffect(() => {
    refresh();
  }, []);

  const selectedCenter = useMemo(() => items.find((center) => center.id === selectedCenterId) ?? null, [items, selectedCenterId]);
  const filteredItems = useMemo(
    () =>
      items.filter((center) =>
        matchesSearch([center.code, center.name, kindLabel(center.kind), center.address, center.latitude, center.longitude], search),
      ),
    [items, search],
  );
  const sortedItems = useMemo(() => {
    const accessors = {
      code: (center: CollectionCenter) => center.code,
      kind: (center: CollectionCenter) => kindLabel(center.kind),
      name: (center: CollectionCenter) => center.name,
      address: (center: CollectionCenter) => center.address,
      active: (center: CollectionCenter) => (center.is_active ? 1 : 0),
    } satisfies Record<typeof sortKey, (center: CollectionCenter) => string | number>;
    return sortByValue(filteredItems, accessors[sortKey], sortDirection);
  }, [filteredItems, sortDirection, sortKey]);
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

  useEffect(() => {
    if (selectedCenter) {
      setForm({
        code: selectedCenter.code,
        name: selectedCenter.name,
        kind: selectedCenter.kind,
        address: selectedCenter.address,
        latitude: selectedCenter.latitude ?? "",
        longitude: selectedCenter.longitude ?? "",
        is_active: selectedCenter.is_active ?? true,
      });
    } else {
      setForm(emptyForm());
    }
  }, [selectedCenter]);

  function updateField(field: keyof typeof form, value: string | boolean) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canManageCenters) {
      setMessage("No tienes permiso para gestionar centros.");
      return;
    }
    setMessage(null);
    try {
      const payload = {
        code: form.code,
        name: form.name,
        kind: form.kind,
        address: form.address,
        latitude: form.latitude || null,
        longitude: form.longitude || null,
        is_active: form.is_active,
      };
      if (selectedCenter) {
        await api.centerUpdate(selectedCenter.id, payload);
        setMessage("Centro actualizado.");
      } else {
        await api.centerCreate(payload);
        setMessage("Centro creado.");
      }
      setSelectedCenterId("");
      setForm(emptyForm());
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar el centro");
    }
  }

  async function removeCenter() {
    if (!selectedCenter) return;
    if (!canManageCenters) {
      setMessage("No tienes permiso para eliminar centros.");
      return;
    }
    if (!window.confirm(`Seguro que deseas eliminar el centro ${selectedCenter.code} · ${selectedCenter.name}? Esta accion no se puede deshacer.`)) {
      return;
    }
    setMessage(null);
    try {
      await api.centerDelete(selectedCenter.id);
      setMessage("Centro eliminado.");
      setSelectedCenterId("");
      setForm(emptyForm());
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo eliminar el centro");
    }
  }

  return (
    <Page
      title="Centros y destinos"
      actions={<span className="muted">Acopios, fundidoras y destinos operativos con coordenadas</span>}
    >
      {message ? <div className="info-banner" style={{ marginBottom: 16 }}>{message}</div> : null}

      <section className="metric-panel" style={{ marginBottom: 16 }}>
        <span>Catálogo maestro</span>
        <strong>{items.length}</strong>
        <div className="muted" style={{ marginTop: 6 }}>
          Registra centros de acopio, fundidoras y otros destinos con coordenadas de referencia.
        </div>
      </section>

      <div className="metric-panel" style={{ marginBottom: 12 }}>
        <label className="search-box">
          Búsqueda rápida
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por código, nombre, tipo o dirección"
          />
        </label>
      </div>

      <form className="inline-form" onSubmit={handleSubmit} style={{ marginBottom: 20 }}>
        <label>
          Código
          <input value={form.code} onChange={(e) => updateField("code", e.target.value)} placeholder="matriz" required />
        </label>
        <label>
          Nombre
          <input value={form.name} onChange={(e) => updateField("name", e.target.value)} placeholder="Centro Matriz" required />
        </label>
        <label>
          Tipo
          <select value={form.kind} onChange={(e) => updateField("kind", e.target.value as CollectionCenter["kind"])}>
            <option value="collection">Centro de acopio</option>
            <option value="smelter">Fundidora</option>
            <option value="destination">Destino</option>
          </select>
        </label>
        <label>
          Dirección
          <input value={form.address} onChange={(e) => updateField("address", e.target.value)} placeholder="Dirección operativa" />
        </label>
        <label>
          Latitud
          <input value={form.latitude} onChange={(e) => updateField("latitude", e.target.value)} placeholder="19.432610" />
        </label>
        <label>
          Longitud
          <input value={form.longitude} onChange={(e) => updateField("longitude", e.target.value)} placeholder="-99.133210" />
        </label>
        <label>
          Activo
          <div className="checkbox-field">
            <input type="checkbox" checked={form.is_active} onChange={(e) => updateField("is_active", e.target.checked)} />
            <span>{form.is_active ? "Sí" : "No"}</span>
          </div>
        </label>
        <button type="submit" disabled={!canManageCenters}>{selectedCenter ? "Actualizar" : "Crear"} centro</button>
        <button type="button" className="ghost-button" onClick={() => { setSelectedCenterId(""); setForm(emptyForm()); }}>
          Limpiar
        </button>
        {selectedCenter ? (
          <button type="button" onClick={removeCenter} className="ghost-button" disabled={!canManageCenters}>
            Eliminar
          </button>
        ) : null}
      </form>

      <table className="table">
        <thead>
          <tr>
            <th><SortableHeader label="Código" active={sortKey === "code"} direction={sortDirection} onClick={() => toggleSort("code")} /></th>
            <th><SortableHeader label="Tipo" active={sortKey === "kind"} direction={sortDirection} onClick={() => toggleSort("kind")} /></th>
            <th><SortableHeader label="Nombre" active={sortKey === "name"} direction={sortDirection} onClick={() => toggleSort("name")} /></th>
            <th><SortableHeader label="Dirección" active={sortKey === "address"} direction={sortDirection} onClick={() => toggleSort("address")} /></th>
            <th>Coordenadas</th>
            <th><SortableHeader label="Activo" active={sortKey === "active"} direction={sortDirection} onClick={() => toggleSort("active")} /></th>
          </tr>
        </thead>
        <tbody>
          {paginatedItems.items.map((center) => (
            <tr
              key={center.id}
              onClick={() => setSelectedCenterId(center.id)}
              style={{ cursor: "pointer", background: center.id === selectedCenterId ? "rgba(124, 58, 237, 0.12)" : undefined }}
            >
              <td>{center.code}</td>
              <td>{kindLabel(center.kind)}</td>
              <td>{center.name}</td>
              <td>{center.address}</td>
              <td>{center.latitude && center.longitude ? `${center.latitude}, ${center.longitude}` : "-"}</td>
              <td>{center.is_active ? "Sí" : "No"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <Pagination {...paginatedItems} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={setPageSize} />
    </Page>
  );
}
