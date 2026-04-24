import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../api/resources";
import type { CollectionCenter, Route } from "../types";
import { Page } from "../components/Page";
import { Pagination } from "../components/Pagination";
import { SortableHeader } from "../components/SortableHeader";
import { matchesSearch, paginate } from "../utils/listing";
import { sortByValue } from "../utils/listing";

function routeSummary(route: Route | undefined) {
  if (!route) return "-";
  const originCoords = route.origin_center_latitude && route.origin_center_longitude ? ` (${route.origin_center_latitude}, ${route.origin_center_longitude})` : "";
  const destinationCoords =
    route.destination_center_latitude && route.destination_center_longitude
      ? ` (${route.destination_center_latitude}, ${route.destination_center_longitude})`
      : "";
  return `${route.code} · ${route.name} · ${route.origin_center_name ?? route.origin_center}${originCoords} → ${route.destination_center_name ?? route.destination_center}${destinationCoords}`;
}

function centerSummary(center: CollectionCenter | undefined) {
  if (!center) return "-";
  const kind = center.kind === "smelter" ? "Fundidora" : center.kind === "destination" ? "Destino" : "Acopio";
  const coordinates = center.latitude && center.longitude ? ` (${center.latitude}, ${center.longitude})` : "";
  return `${center.code} · ${center.name} · ${kind}${coordinates}`;
}

function emptyForm() {
  return {
    code: "",
    name: "",
    origin_center: "",
    destination_center: "",
    notes: "",
    is_active: true,
  };
}

export function RoutesPage() {
  const [items, setItems] = useState<Route[]>([]);
  const [centers, setCenters] = useState<CollectionCenter[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState("");
  const [form, setForm] = useState(emptyForm());
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState<"code" | "name" | "origin" | "destination" | "active">("code");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    setItems(await api.routes().catch(() => []));
    setCenters(await api.centers().catch(() => []));
  }

  useEffect(() => {
    refresh();
  }, []);

  const selectedRoute = useMemo(() => items.find((route) => route.id === selectedRouteId) ?? null, [items, selectedRouteId]);
  const centerById = useMemo(() => Object.fromEntries(centers.map((center) => [center.id, center])), [centers]);
  const filteredItems = useMemo(
    () =>
      items.filter((route) =>
        matchesSearch(
          [
            route.code,
            route.name,
            route.origin_center_name ?? centerById[route.origin_center]?.name ?? route.origin_center,
            route.destination_center_name ?? centerById[route.destination_center]?.name ?? route.destination_center,
            route.notes,
          ],
          search,
        ),
      ),
    [centerById, items, search],
  );
  const sortedItems = useMemo(() => {
    const accessors = {
      code: (route: Route) => route.code,
      name: (route: Route) => route.name,
      origin: (route: Route) => route.origin_center_name ?? centerById[route.origin_center]?.name ?? route.origin_center,
      destination: (route: Route) => route.destination_center_name ?? centerById[route.destination_center]?.name ?? route.destination_center,
      active: (route: Route) => (route.is_active ? 1 : 0),
    } satisfies Record<typeof sortKey, (route: Route) => string | number>;
    return sortByValue(filteredItems, accessors[sortKey], sortDirection);
  }, [centerById, filteredItems, sortDirection, sortKey]);
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
    if (selectedRoute) {
      setForm({
        code: selectedRoute.code,
        name: selectedRoute.name,
        origin_center: selectedRoute.origin_center,
        destination_center: selectedRoute.destination_center,
        notes: "",
        is_active: true,
      });
    } else {
      setForm(emptyForm());
    }
  }, [selectedRoute]);

  function updateField(field: keyof typeof form, value: string | boolean) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    try {
      const payload = {
        code: form.code,
        name: form.name,
        origin_center: form.origin_center,
        destination_center: form.destination_center,
        notes: form.notes,
        is_active: form.is_active,
      };
      if (selectedRoute) {
        await api.routeUpdate(selectedRoute.id, payload);
        setMessage("Ruta actualizada.");
      } else {
        await api.routeCreate(payload);
        setMessage("Ruta creada.");
      }
      setSelectedRouteId("");
      setForm(emptyForm());
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar la ruta");
    }
  }

  async function removeRoute() {
    if (!selectedRoute) return;
    setMessage(null);
    try {
      await api.routeDelete(selectedRoute.id);
      setMessage("Ruta eliminada.");
      setSelectedRouteId("");
      setForm(emptyForm());
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo eliminar la ruta");
    }
  }

  return (
    <Page title="Rutas" actions={<span className="muted">Orígenes y destinos con coordenadas geográficas</span>}>
      {message ? <div className="info-banner" style={{ marginBottom: 16 }}>{message}</div> : null}

      <section className="metric-panel" style={{ marginBottom: 16 }}>
        <span>Catálogo de rutas</span>
        <strong>{items.length}</strong>
        <div className="muted" style={{ marginTop: 6 }}>
          Planea recorridos entre centros de acopio, fundidoras y otros destinos operativos.
        </div>
      </section>

      <div className="metric-panel" style={{ marginBottom: 12 }}>
        <label className="search-box">
          Búsqueda rápida
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por código, nombre, origen, destino o notas"
          />
        </label>
      </div>

      <form className="route-form" onSubmit={handleSubmit} style={{ marginBottom: 20 }}>
        <div className="route-form-row route-form-primary-row">
          <label>
            Código
            <input value={form.code} onChange={(e) => updateField("code", e.target.value)} placeholder="ruta-matriz-demo" required />
          </label>
          <label>
            Nombre
            <input value={form.name} onChange={(e) => updateField("name", e.target.value)} placeholder="Ruta Matriz Demo" required />
          </label>
          <label className="route-center-field">
            Origen
            <select value={form.origin_center} onChange={(e) => updateField("origin_center", e.target.value)} required>
              <option value="">Seleccionar</option>
              {centers.map((center) => (
                <option key={center.id} value={center.id}>
                  {centerSummary(center)}
                </option>
              ))}
            </select>
          </label>
          <label className="route-center-field">
            Destino
            <select value={form.destination_center} onChange={(e) => updateField("destination_center", e.target.value)} required>
              <option value="">Seleccionar</option>
              {centers.map((center) => (
                <option key={center.id} value={center.id}>
                  {centerSummary(center)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="route-form-row route-form-secondary-row">
          <label className="stack-field route-notes-field">
            Notas
            <textarea value={form.notes} onChange={(e) => updateField("notes", e.target.value)} rows={2} />
          </label>
          <label>
            Activa
            <div className="checkbox-field">
              <input type="checkbox" checked={form.is_active} onChange={(e) => updateField("is_active", e.target.checked)} />
              <span>{form.is_active ? "Sí" : "No"}</span>
            </div>
          </label>
          <div className="route-actions">
            <button type="submit" className="ghost-button">{selectedRoute ? "Actualizar ruta" : "Crear ruta"}</button>
            <button type="button" className="ghost-button" onClick={() => { setSelectedRouteId(""); setForm(emptyForm()); }}>
              Limpiar
            </button>
            {selectedRoute ? (
              <button type="button" className="ghost-button" onClick={removeRoute}>
                Eliminar
              </button>
            ) : null}
          </div>
        </div>
      </form>

      <table className="table">
        <thead>
          <tr>
            <th><SortableHeader label="Código" active={sortKey === "code"} direction={sortDirection} onClick={() => toggleSort("code")} /></th>
            <th><SortableHeader label="Nombre" active={sortKey === "name"} direction={sortDirection} onClick={() => toggleSort("name")} /></th>
            <th><SortableHeader label="Origen" active={sortKey === "origin"} direction={sortDirection} onClick={() => toggleSort("origin")} /></th>
            <th><SortableHeader label="Destino" active={sortKey === "destination"} direction={sortDirection} onClick={() => toggleSort("destination")} /></th>
            <th>Coordenadas</th>
            <th><SortableHeader label="Activa" active={sortKey === "active"} direction={sortDirection} onClick={() => toggleSort("active")} /></th>
          </tr>
        </thead>
        <tbody>
          {paginatedItems.items.map((route) => {
            const origin = centerById[route.origin_center];
            const destination = centerById[route.destination_center];
            return (
              <tr
                key={route.id}
                onClick={() => setSelectedRouteId(route.id)}
                style={{ cursor: "pointer", background: route.id === selectedRouteId ? "rgba(124, 58, 237, 0.12)" : undefined }}
              >
                <td>{route.code}</td>
                <td>{route.name}</td>
                <td>{route.origin_center_name ?? origin?.name ?? route.origin_center}</td>
                <td>{route.destination_center_name ?? destination?.name ?? route.destination_center}</td>
                <td>
                  {origin?.latitude && origin?.longitude && destination?.latitude && destination?.longitude
                    ? `${origin.latitude}, ${origin.longitude} → ${destination.latitude}, ${destination.longitude}`
                    : `${route.origin_center_latitude ?? "-"}, ${route.origin_center_longitude ?? "-"} → ${route.destination_center_latitude ?? "-"}, ${route.destination_center_longitude ?? "-"}`}
                </td>
                <td>{route.is_active ? "Sí" : "No"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <Pagination {...paginatedItems} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={setPageSize} />

      <section className="metric-panel" style={{ marginTop: 20 }}>
        <span>Ruta activa</span>
        <strong>{selectedRoute ? routeSummary(selectedRoute) : "Selecciona una ruta"}</strong>
        <div className="muted">Origen: {selectedRoute ? centerSummary(centerById[selectedRoute.origin_center]) : "-"}</div>
        <div className="muted">Destino: {selectedRoute ? centerSummary(centerById[selectedRoute.destination_center]) : "-"}</div>
        <div className="muted">Notas: {selectedRoute?.notes || "-"}</div>
      </section>
    </Page>
  );
}
