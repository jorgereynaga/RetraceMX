import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../api/resources";
import type { CollectionCenter } from "../types";
import { Page } from "../components/Page";
import { CatalogImportExportButton } from "../components/CatalogImportExportButton";
import { Pagination } from "../components/Pagination";
import { SortableHeader } from "../components/SortableHeader";
import { matchesSearch, paginate, sortByValue } from "../utils/listing";
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
  const [isCenterModalOpen, setIsCenterModalOpen] = useState(false);
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

  useEffect(() => {
    if (!isCenterModalOpen) return;
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
  }, [isCenterModalOpen, selectedCenter]);

  function toggleSort(nextKey: typeof sortKey) {
    if (nextKey === sortKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDirection("asc");
  }

  function updateField(field: keyof typeof form, value: string | boolean) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function openCreateCenterModal() {
    setSelectedCenterId("");
    setIsCenterModalOpen(true);
    setMessage(null);
  }

  function openEditCenterModal(center: CollectionCenter) {
    setSelectedCenterId(center.id);
    setIsCenterModalOpen(true);
    setMessage(null);
  }

  function closeCenterModal() {
    setIsCenterModalOpen(false);
    setSelectedCenterId("");
    setForm(emptyForm());
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
      closeCenterModal();
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar el centro");
    }
  }

  async function removeCenter(center: CollectionCenter | null = selectedCenter) {
    if (!center) return;
    if (!canManageCenters) {
      setMessage("No tienes permiso para eliminar centros.");
      return;
    }
    if (!window.confirm(`Seguro que deseas eliminar el centro ${center.code} · ${center.name}? Esta acción no se puede deshacer.`)) {
      return;
    }
    setMessage(null);
    try {
      await api.centerDelete(center.id);
      setMessage("Centro eliminado.");
      closeCenterModal();
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo eliminar el centro");
    }
  }

  return (
    <Page title="Centros y destinos" actions={<span className="muted">Acopios, fundidoras y destinos operativos con coordenadas</span>}>
      {userCan(user, "catalog.export") ? (
        <div className="page-actions">
          {canManageCenters ? (
            <button type="button" className="btn-primary" onClick={openCreateCenterModal}>
              Nuevo centro
            </button>
          ) : null}
          <CatalogImportExportButton catalog="collection-centers" search={search} selectedIds={selectedCenterId ? [selectedCenterId] : []} />
        </div>
      ) : null}
      {message ? <div className="info-banner" style={{ marginBottom: 16 }}>{message}</div> : null}

      <div className="catalog-top-row" style={{ marginBottom: 16 }}>
        <section className="metric-panel">
          <span>Total de registros</span>
          <strong>{items.length}</strong>
          <div className="muted" style={{ marginTop: 6 }}>
            Registra centros de acopio, fundidoras y otros destinos con coordenadas de referencia.
          </div>
        </section>
        <label className="search-box metric-panel">
          Búsqueda rápida
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por código, nombre, tipo o dirección"
          />
        </label>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th><SortableHeader label="Código" active={sortKey === "code"} direction={sortDirection} onClick={() => toggleSort("code")} /></th>
            <th><SortableHeader label="Tipo" active={sortKey === "kind"} direction={sortDirection} onClick={() => toggleSort("kind")} /></th>
            <th><SortableHeader label="Nombre" active={sortKey === "name"} direction={sortDirection} onClick={() => toggleSort("name")} /></th>
            <th><SortableHeader label="Dirección" active={sortKey === "address"} direction={sortDirection} onClick={() => toggleSort("address")} /></th>
            <th>Coordenadas</th>
            <th><SortableHeader label="Activo" active={sortKey === "active"} direction={sortDirection} onClick={() => toggleSort("active")} /></th>
            <th>Acciones</th>
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
              <td>
                <div className="table-actions">
                  <button
                    type="button"
                    className="btn-secondary table-action-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      openEditCenterModal(center);
                    }}
                    disabled={!canManageCenters}
                  >
                    Modificar
                  </button>
                  <button
                    type="button"
                    className="btn-danger table-action-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void removeCenter(center);
                    }}
                    disabled={!canManageCenters}
                  >
                    Eliminar
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <Pagination {...paginatedItems} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={setPageSize} />

      {isCenterModalOpen ? (
        <div className="catalog-dialog-backdrop" role="presentation" onClick={closeCenterModal}>
          <div
            className="catalog-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={selectedCenter ? "Editar centro" : "Nuevo centro"}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="catalog-dialog-header">
              <div>
                <strong>{selectedCenter ? "Editar centro" : "Nuevo centro"}</strong>
                <div className="muted">Catálogo maestro de centros y destinos</div>
              </div>
              <button type="button" className="ghost-button" onClick={closeCenterModal}>
                Cerrar
              </button>
            </div>
            <form className="inline-form" onSubmit={handleSubmit}>
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
              <div className="full-width-form-field" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button type="submit" className="btn-primary" disabled={!canManageCenters}>
                  {selectedCenter ? "Actualizar" : "Crear"} centro
                </button>
                <button type="button" className="btn-secondary" onClick={closeCenterModal}>
                  Cancelar
                </button>
                {selectedCenter ? (
                  <button type="button" className="btn-danger" onClick={() => void removeCenter()} disabled={!canManageCenters}>
                    Eliminar
                  </button>
                ) : null}
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </Page>
  );
}
