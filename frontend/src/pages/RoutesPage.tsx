import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../api/resources";
import { RouteMap, type RouteMapPoint } from "../components/RouteMap";
import type { CollectionCenter, Route } from "../types";
import { Page } from "../components/Page";
import { Pagination } from "../components/Pagination";
import { SortableHeader } from "../components/SortableHeader";
import { matchesSearch, paginate } from "../utils/listing";
import { sortByValue } from "../utils/listing";
import { useAuth } from "../context/AuthContext";
import { userCan } from "../utils/permissions";

function routeSummary(route: Route | undefined) {
  if (!route) return "-";
  const originCoords = route.origin_center_latitude && route.origin_center_longitude ? ` (${route.origin_center_latitude}, ${route.origin_center_longitude})` : "";
  const destinationCoords =
    route.destination_center_latitude && route.destination_center_longitude
      ? ` (${route.destination_center_latitude}, ${route.destination_center_longitude})`
      : "";
  return `${route.code} - ${route.name} - ${route.origin_center_name ?? route.origin_center}${originCoords} -> ${route.destination_center_name ?? route.destination_center}${destinationCoords}`;
}

function centerSummary(center: CollectionCenter | undefined) {
  if (!center) return "-";
  const kind = center.kind === "smelter" ? "Fundidora" : center.kind === "destination" ? "Destino" : "Acopio";
  const coordinates = center.latitude && center.longitude ? ` (${center.latitude}, ${center.longitude})` : "";
  return `${center.code} - ${center.name} - ${kind}${coordinates}`;
}

function formatCoordinates(latitude?: string | null, longitude?: string | null) {
  if (!latitude || !longitude) return "-";
  return `${latitude}, ${longitude}`;
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
  const { user } = useAuth();
  const canManageRoutes = userCan(user, "routes.manage");
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
  const selectedOriginCenter = useMemo(
    () => (selectedRoute ? centerById[selectedRoute.origin_center] : undefined),
    [centerById, selectedRoute],
  );
  const selectedDestinationCenter = useMemo(
    () => (selectedRoute ? centerById[selectedRoute.destination_center] : undefined),
    [centerById, selectedRoute],
  );

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

  const routeMapPoints = useMemo<RouteMapPoint[]>(() => {
    if (!selectedRoute) return [];
    const originLat = selectedOriginCenter?.latitude ?? selectedRoute.origin_center_latitude;
    const originLng = selectedOriginCenter?.longitude ?? selectedRoute.origin_center_longitude;
    const destinationLat = selectedDestinationCenter?.latitude ?? selectedRoute.destination_center_latitude;
    const destinationLng = selectedDestinationCenter?.longitude ?? selectedRoute.destination_center_longitude;
    const points: Array<RouteMapPoint | null> = [
      originLat && originLng
        ? {
            label: `${selectedRoute.code} origen`,
            latitude: Number(originLat),
            longitude: Number(originLng),
            kind: "start",
          }
        : null,
      destinationLat && destinationLng
        ? {
            label: `${selectedRoute.code} destino`,
            latitude: Number(destinationLat),
            longitude: Number(destinationLng),
            kind: "end",
          }
        : null,
    ];
    return points.filter((point): point is RouteMapPoint => Boolean(point));
  }, [selectedDestinationCenter, selectedOriginCenter, selectedRoute]);

  function printRouteSheet() {
    if (!selectedRoute) return;
    const popup = window.open("", "_blank", "width=820,height=1100");
    if (!popup) return;

    popup.document.write(`
      <html>
        <head>
          <title>Ficha de ruta ${selectedRoute.code}</title>
          <style>
            @page { size: A4 portrait; margin: 12mm; }
            body {
              font-family: "Courier New", monospace;
              font-size: 12px;
              color: #111827;
              margin: 0;
              padding: 0;
            }
            .sheet { max-width: 760px; margin: 0 auto; }
            .title { text-align: center; font-size: 22px; font-weight: 700; letter-spacing: 1px; margin-bottom: 8px; }
            .sub { text-align: center; font-size: 11px; margin-bottom: 12px; }
            .line { border-top: 1px dashed #6b7280; margin: 10px 0; }
            .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 18px; }
            .label { font-weight: 700; }
            .section { margin-top: 14px; }
            .section h2 { font-size: 14px; margin: 0 0 8px; text-transform: uppercase; }
            .box { border: 1px solid #d1d5db; border-radius: 10px; padding: 10px 12px; margin-top: 8px; }
            .footer { margin-top: 16px; text-align: center; font-size: 11px; }
          </style>
        </head>
        <body>
          <div class="sheet">
            <div class="title">FICHA DE RUTA</div>
            <div class="sub">ACOPIO360 - Planeacion y control operativo</div>
            <div class="line"></div>
            <div class="grid">
              <div><span class="label">Codigo:</span> ${selectedRoute.code}</div>
              <div><span class="label">Activa:</span> ${selectedRoute.is_active ? "Si" : "No"}</div>
              <div><span class="label">Nombre:</span> ${selectedRoute.name}</div>
              <div><span class="label">Origen:</span> ${selectedRoute.origin_center_name ?? selectedRoute.origin_center}</div>
              <div><span class="label">Destino:</span> ${selectedRoute.destination_center_name ?? selectedRoute.destination_center}</div>
              <div><span class="label">Coordenadas origen:</span> ${formatCoordinates(selectedRoute.origin_center_latitude, selectedRoute.origin_center_longitude)}</div>
              <div><span class="label">Coordenadas destino:</span> ${formatCoordinates(selectedRoute.destination_center_latitude, selectedRoute.destination_center_longitude)}</div>
              <div><span class="label">Notas:</span> ${selectedRoute.notes || "-"}</div>
            </div>
            <div class="section">
              <h2>Resumen operativo</h2>
              <div class="box">
                <div>Rutas activas: ${items.filter((route) => route.is_active).length}</div>
                <div>Total de rutas: ${items.length}</div>
                <div>Orígenes unicos: ${new Set(items.map((route) => route.origin_center)).size}</div>
                <div>Destinos unicos: ${new Set(items.map((route) => route.destination_center)).size}</div>
              </div>
            </div>
            <div class="section">
              <h2>Trazabilidad</h2>
              <div class="box">
                <div>Ruta seleccionada desde la interfaz de Acopio360.</div>
                <div>Origen operativo: ${selectedOriginCenter?.name ?? selectedRoute.origin_center_name ?? selectedRoute.origin_center}</div>
                <div>Destino operativo: ${selectedDestinationCenter?.name ?? selectedRoute.destination_center_name ?? selectedRoute.destination_center}</div>
              </div>
            </div>
            <div class="footer">Copia sin valor fiscal - Documento interno de planeacion</div>
          </div>
        </body>
      </html>
    `);
    popup.document.close();
    popup.focus();
    popup.print();
  }

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
        notes: selectedRoute.notes ?? "",
        is_active: selectedRoute.is_active,
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
    if (!canManageRoutes) {
      setMessage("No tienes permiso para gestionar rutas.");
      return;
    }
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
    if (!canManageRoutes) {
      setMessage("No tienes permiso para eliminar rutas.");
      return;
    }
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
    <Page title="Rutas" actions={<span className="muted">Planeación de orígenes, destinos y fichas operativas</span>}>
      {message ? <div className="info-banner" style={{ marginBottom: 16 }}>{message}</div> : null}

      <section className="metric-grid" style={{ marginBottom: 16, gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
        <div className="metric-panel">
          <span>Rutas activas</span>
          <strong>{items.filter((route) => route.is_active).length}</strong>
        </div>
        <div className="metric-panel">
          <span>Orígenes</span>
          <strong>{new Set(items.map((route) => route.origin_center)).size}</strong>
        </div>
        <div className="metric-panel">
          <span>Destinos</span>
          <strong>{new Set(items.map((route) => route.destination_center)).size}</strong>
        </div>
        <div className="metric-panel">
          <span>Total rutas</span>
          <strong>{items.length}</strong>
        </div>
      </section>

      <div className="metric-panel" style={{ marginBottom: 16 }}>
        <label className="search-box">
          Búsqueda rápida
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por codigo, nombre, origen, destino o notas"
          />
        </label>
      </div>

      <section className="section-panel" style={{ marginBottom: 16 }}>
        <div className="section-panel-header">
          <h3>Listado de rutas</h3>
          <span className="muted">Selecciona una ruta para ver ficha, mapa y acciones</span>
        </div>
        <div className="section-panel-body">
          <div style={{ overflowX: "auto", marginBottom: 14 }}>
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
                      <td style={{ fontWeight: 700 }}>{route.code}</td>
                      <td>{route.name}</td>
                      <td>{route.origin_center_name ?? origin?.name ?? route.origin_center}</td>
                      <td>{route.destination_center_name ?? destination?.name ?? route.destination_center}</td>
                      <td>
                        {origin?.latitude && origin?.longitude && destination?.latitude && destination?.longitude
                          ? `${origin.latitude}, ${origin.longitude} -> ${destination.latitude}, ${destination.longitude}`
                          : `${route.origin_center_latitude ?? "-"}, ${route.origin_center_longitude ?? "-"} -> ${route.destination_center_latitude ?? "-"}, ${route.destination_center_longitude ?? "-"}`}
                      </td>
                      <td>
                        <span className={`badge ${route.is_active ? "badge-green" : "badge-gray"}`}>{route.is_active ? "Activa" : "Inactiva"}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination {...paginatedItems} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={setPageSize} />
        </div>
      </section>

      <div className="processing-two-up" style={{ marginBottom: 16 }}>
        <section className="section-panel">
          <div className="section-panel-header">
            <h3>Ficha operativa</h3>
            <span className="muted">Resumen, mapa y acciones</span>
          </div>
          <div className="section-panel-body" style={{ display: "grid", gap: 14 }}>
            <div className="metric-grid" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
              <div className="metric-panel">
                <span>Ruta seleccionada</span>
                <strong>{selectedRoute ? selectedRoute.code : "-"}</strong>
              </div>
              <div className="metric-panel">
                <span>Origen</span>
                <strong>{selectedRoute ? centerSummary(selectedOriginCenter) : "-"}</strong>
              </div>
              <div className="metric-panel">
                <span>Destino</span>
                <strong>{selectedRoute ? centerSummary(selectedDestinationCenter) : "-"}</strong>
              </div>
              <div className="metric-panel">
                <span>Estado</span>
                <strong>{selectedRoute ? (selectedRoute.is_active ? "Activa" : "Inactiva") : "-"}</strong>
              </div>
            </div>
            <div className="info-banner" style={{ display: "grid", gap: 6 }}>
              <strong>Notas</strong>
              <span>{selectedRoute?.notes || "Selecciona una ruta para ver notas y trazabilidad."}</span>
            </div>
            <div className="inline-form" style={{ gridTemplateColumns: "auto auto", justifyContent: "start" }}>
              <button type="button" onClick={printRouteSheet} disabled={!canManageRoutes || !selectedRoute}>
                Imprimir ficha
              </button>
              <button type="button" className="ghost-button" onClick={() => selectedRoute && setMessage(`Ruta ${selectedRoute.code} lista para documento.`)} disabled={!canManageRoutes || !selectedRoute}>
                Preparar documento
              </button>
            </div>
            <RouteMap points={routeMapPoints} title="Mapa de ruta" />
          </div>
        </section>

        <form className="section-panel" onSubmit={handleSubmit}>
          <div className="section-panel-header">
            <h3>{selectedRoute ? "Editar ruta" : "Nueva ruta"}</h3>
            <span className="muted">Define origen, destino y notas operativas</span>
          </div>
          <div className="section-panel-body grid-form">
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
            <label className="full-width-form-field">
              Notas
              <textarea value={form.notes} onChange={(e) => updateField("notes", e.target.value)} rows={3} />
            </label>
            <label>
              Activa
              <div className="checkbox-field">
                <input type="checkbox" checked={form.is_active} onChange={(e) => updateField("is_active", e.target.checked)} />
                <span>{form.is_active ? "Sí" : "No"}</span>
              </div>
            </label>
            <div className="route-actions">
              <button type="submit" className="ghost-button" disabled={!canManageRoutes}>{selectedRoute ? "Actualizar ruta" : "Crear ruta"}</button>
              <button type="button" className="ghost-button" onClick={() => { setSelectedRouteId(""); setForm(emptyForm()); }}>
                Limpiar
              </button>
              {selectedRoute ? (
                <button type="button" className="ghost-button" onClick={removeRoute} disabled={!canManageRoutes}>
                  Eliminar
                </button>
              ) : null}
            </div>
          </div>
        </form>
      </div>

      <section className="section-panel">
        <div className="section-panel-header">
          <h3>Documento operativo</h3>
          <span className="muted">Vista rápida para planeación, despacho y seguimiento</span>
        </div>
        <div className="section-panel-body">
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
            <div className="metric-panel">
              <span>Ruta activa</span>
              <strong>{selectedRoute ? routeSummary(selectedRoute) : "Selecciona una ruta"}</strong>
            </div>
            <div className="metric-panel">
              <span>Origen</span>
              <strong>{selectedRoute ? centerSummary(selectedOriginCenter) : "-"}</strong>
            </div>
            <div className="metric-panel">
              <span>Destino</span>
              <strong>{selectedRoute ? centerSummary(selectedDestinationCenter) : "-"}</strong>
            </div>
            <div className="metric-panel">
              <span>Estado</span>
              <strong>{selectedRoute?.is_active ? "Activa" : selectedRoute ? "Inactiva" : "-"}</strong>
            </div>
          </div>
          <div className="muted" style={{ marginTop: 12 }}>
            {selectedRoute?.notes || "Selecciona una ruta para ver notas, coordenadas y documento de salida."}
          </div>
        </div>
      </section>
    </Page>
  );
}
