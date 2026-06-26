import { FormEvent, MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/resources";
import type { Material, MaterialFamily } from "../types";
import { Page } from "../components/Page";
import { Pagination } from "../components/Pagination";
import { SortableHeader } from "../components/SortableHeader";
import { CatalogImportExportButton } from "../components/CatalogImportExportButton";
import { paginate, sortByValue } from "../utils/listing";
import { useAuth } from "../context/AuthContext";
import { userCan } from "../utils/permissions";

function unitLabel(unit: Material["unit"]) {
  if (unit === "ton") return "Tonelada";
  if (unit === "piece") return "Pieza";
  return "Kilogramo";
}

function emptyForm() {
  return {
    code: "",
    name: "",
    family: "",
    subfamily: "",
    unit: "kg" as Material["unit"],
    valuation_possible: true,
    is_hazard_auxiliary: false,
    requires_special_review: false,
    is_buyable: true,
    is_sellable: true,
    is_processable: false,
    is_processed: false,
    is_active: true,
    default_merma_pct: "",
  };
}

type SortKey = "code" | "name" | "family" | "unit" | "valuation" | "review" | "active";

export function MaterialsPage() {
  const { user } = useAuth();
  const canManageMaterials = userCan(user, "materials.manage");
  const canUseCatalogTools = userCan(user, "catalog.export");
  const [items, setItems] = useState<Material[]>([]);
  const [families, setFamilies] = useState<MaterialFamily[]>([]);
  const [selectedMaterialId, setSelectedMaterialId] = useState("");
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState<SortKey>("code");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [message, setMessage] = useState<string | null>(null);
  const [editingMermaId, setEditingMermaId] = useState<string | null>(null);
  const [editingMermaValue, setEditingMermaValue] = useState("");
  const mermaCommitting = useRef(false);

  async function refresh() {
    setItems(await api.materials().catch(() => []));
    setFamilies(await api.materialFamilies().catch(() => []));
  }

  useEffect(() => {
    refresh();
  }, []);

  const selectedMaterial = useMemo(() => items.find((item) => item.id === selectedMaterialId) ?? null, [items, selectedMaterialId]);
  const familyNameById = useMemo(() => Object.fromEntries(families.map((family) => [family.id, family.name])), [families]);
  const filteredItems = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return items;
    return items.filter((item) => {
      const familyName = familyNameById[item.family] ?? "";
      return [item.code, item.name, familyName].join(" ").toLowerCase().includes(value);
    });
  }, [familyNameById, items, search]);
  const sortedItems = useMemo(() => {
    const accessors: Record<SortKey, (item: Material) => string | number> = {
      code: (item) => item.code,
      name: (item) => item.name,
      family: (item) => familyNameById[item.family] ?? item.family,
      unit: (item) => unitLabel(item.unit),
      valuation: (item) => (item.valuation_possible ? 1 : 0),
      review: (item) => (item.requires_special_review ? 1 : 0),
      active: (item) => (item.is_active ? 1 : 0),
    };
    return sortByValue(filteredItems, accessors[sortKey], sortDirection);
  }, [familyNameById, filteredItems, sortDirection, sortKey]);
  const paginatedItems = useMemo(() => paginate(sortedItems, page, pageSize), [page, pageSize, sortedItems]);

  useEffect(() => {
    if (!selectedMaterialId) return;
    const index = sortedItems.findIndex((item) => item.id === selectedMaterialId);
    if (index < 0) return;
    const targetPage = Math.floor(index / pageSize) + 1;
    if (targetPage !== page) {
      setPage(targetPage);
    }
  }, [page, pageSize, selectedMaterialId, sortedItems]);

  useEffect(() => {
    if (!isMaterialModalOpen) return;
    if (selectedMaterial) {
      setForm({
        code: selectedMaterial.code,
        name: selectedMaterial.name,
        family: selectedMaterial.family,
        subfamily: selectedMaterial.subfamily ?? "",
        unit: selectedMaterial.unit,
        valuation_possible: selectedMaterial.valuation_possible,
        is_hazard_auxiliary: selectedMaterial.is_hazard_auxiliary,
        requires_special_review: selectedMaterial.requires_special_review,
        is_buyable: selectedMaterial.is_buyable ?? true,
        is_sellable: selectedMaterial.is_sellable ?? true,
        is_processable: selectedMaterial.is_processable ?? false,
        is_processed: selectedMaterial.is_processed ?? false,
        is_active: selectedMaterial.is_active,
        default_merma_pct: selectedMaterial.default_merma_pct ?? "",
      });
    } else {
      setForm(emptyForm());
    }
  }, [isMaterialModalOpen, selectedMaterial]);

  useEffect(() => {
    setPage(1);
  }, [search, pageSize, sortKey, sortDirection]);

  function updateField(field: keyof typeof form, value: string | boolean) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function toggleSort(nextKey: SortKey) {
    if (nextKey === sortKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDirection("asc");
  }

  function openCreateMaterialModal() {
    setSelectedMaterialId("");
    setIsMaterialModalOpen(true);
    setMessage(null);
  }

  function openEditMaterialModal(item: Material) {
    setSelectedMaterialId(item.id);
    setIsMaterialModalOpen(true);
    setMessage(null);
  }

  function closeMaterialModal() {
    setIsMaterialModalOpen(false);
    setSelectedMaterialId("");
    setForm(emptyForm());
  }

  function startMermaEdit(item: Material, event: MouseEvent) {
    event.stopPropagation();
    if (!canManageMaterials) {
      setMessage("No tienes permiso para editar la merma.");
      return;
    }
    setEditingMermaId(item.id);
    setEditingMermaValue(item.default_merma_pct != null ? String(parseFloat(item.default_merma_pct) * 100) : "");
  }

  async function commitMermaEdit(item: Material) {
    if (!canManageMaterials) {
      setMessage("No tienes permiso para editar la merma.");
      return;
    }
    if (mermaCommitting.current) return;
    mermaCommitting.current = true;
    try {
      const raw = editingMermaValue.trim();
      const pct = raw === "" ? null : parseFloat(raw) / 100;
      setEditingMermaId(null);
      setEditingMermaValue("");
      if (pct !== null && isNaN(pct)) return;
      setMessage(null);
      await api.materialPatch(item.id, { default_merma_pct: pct });
      setMessage("Merma actualizada.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar la merma");
    } finally {
      mermaCommitting.current = false;
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canManageMaterials) {
      setMessage("No tienes permiso para gestionar materiales.");
      return;
    }
    setMessage(null);
    try {
      const payload: Record<string, unknown> = {
        code: form.code,
        name: form.name,
        family: form.family,
        unit: form.unit,
        valuation_possible: form.valuation_possible,
        is_hazard_auxiliary: form.is_hazard_auxiliary,
        requires_special_review: form.requires_special_review,
        is_buyable: form.is_buyable,
        is_sellable: form.is_sellable,
        is_processable: form.is_processable,
        is_processed: form.is_processed,
        is_active: form.is_active,
        default_merma_pct: form.default_merma_pct !== "" ? form.default_merma_pct : null,
      };
      if (selectedMaterial) {
        await api.materialUpdate(selectedMaterial.id, payload);
        setMessage("Material actualizado.");
      } else {
        const created = await api.materialCreate(payload);
        setMessage("Material creado.");
        setSelectedMaterialId(created.id);
      }
      closeMaterialModal();
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar el material");
    }
  }

  async function removeMaterial(item: Material | null = selectedMaterial) {
    if (!item) return;
    if (!canManageMaterials) {
      setMessage("No tienes permiso para eliminar materiales.");
      return;
    }
    if (!window.confirm(`Seguro que deseas eliminar el material ${item.code} · ${item.name}? Esta acción no se puede deshacer.`)) {
      return;
    }
    setMessage(null);
    try {
      await api.materialDelete(item.id);
      setMessage("Material eliminado.");
      closeMaterialModal();
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo eliminar el material");
    }
  }

  return (
    <Page title="Materiales" actions={<span className="muted">Catálogo maestro de residuos y valorizables</span>}>
      {canUseCatalogTools ? (
        <div className="page-actions">
          {canManageMaterials ? (
            <button type="button" className="btn-primary" onClick={openCreateMaterialModal}>
              Nuevo material
            </button>
          ) : null}
          <CatalogImportExportButton catalog="materials" selectedIds={selectedMaterialId ? [selectedMaterialId] : []} search={search} />
          <CatalogImportExportButton catalog="material-families" />
        </div>
      ) : null}
      {message ? <div className="info-banner" style={{ marginBottom: 16 }}>{message}</div> : null}

      <div className="catalog-top-row" style={{ marginBottom: 16 }}>
        <section className="metric-panel">
          <span>Total de registros</span>
          <strong>{items.length}</strong>
          <div className="muted" style={{ marginTop: 6 }}>
            Clasificación operativa, unidad, valorización y revisión especial por material.
          </div>
        </section>
        <label className="search-box metric-panel">
          Búsqueda rápida
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por código, nombre o familia" />
        </label>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th><SortableHeader label="Código" active={sortKey === "code"} direction={sortDirection} onClick={() => toggleSort("code")} /></th>
            <th><SortableHeader label="Nombre" active={sortKey === "name"} direction={sortDirection} onClick={() => toggleSort("name")} /></th>
            <th><SortableHeader label="Familia" active={sortKey === "family"} direction={sortDirection} onClick={() => toggleSort("family")} /></th>
            <th><SortableHeader label="Unidad" active={sortKey === "unit"} direction={sortDirection} onClick={() => toggleSort("unit")} /></th>
            <th><SortableHeader label="Valorizable" active={sortKey === "valuation"} direction={sortDirection} onClick={() => toggleSort("valuation")} /></th>
            <th><SortableHeader label="Revisión" active={sortKey === "review"} direction={sortDirection} onClick={() => toggleSort("review")} /></th>
            <th><SortableHeader label="Activo" active={sortKey === "active"} direction={sortDirection} onClick={() => toggleSort("active")} /></th>
            <th title="Clic en la celda para editar">Merma % ✎</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {paginatedItems.items.map((item) => (
            <tr
              key={item.id}
              onClick={() => setSelectedMaterialId(item.id)}
              style={{ cursor: "pointer", background: item.id === selectedMaterialId ? "rgba(124, 58, 237, 0.12)" : undefined }}
            >
              <td>{item.code}</td>
              <td>{item.name}</td>
              <td>{familyNameById[item.family] ?? item.family}</td>
              <td>{unitLabel(item.unit)}</td>
              <td>{item.valuation_possible ? "Sí" : "No"}</td>
              <td>{item.requires_special_review ? "Sí" : "No"}</td>
              <td>{item.is_active ? "Sí" : "No"}</td>
              <td onClick={(e) => startMermaEdit(item, e)} title="Clic para editar merma" style={{ cursor: canManageMaterials ? "text" : "default", minWidth: 100 }}>
                {editingMermaId === item.id ? (
                  <input
                    type="number"
                    value={editingMermaValue}
                    autoFocus
                    min={0}
                    max={100}
                    step={0.01}
                    placeholder="ej. 3"
                    style={{ width: 80 }}
                    onChange={(e) => setEditingMermaValue(e.target.value)}
                    onBlur={() => commitMermaEdit(item)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitMermaEdit(item);
                      if (e.key === "Escape") {
                        setEditingMermaId(null);
                        setEditingMermaValue("");
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : item.default_merma_pct != null ? (
                  `${(parseFloat(item.default_merma_pct) * 100).toFixed(2)}%`
                ) : (
                  <span className="muted">— (global)</span>
                )}
              </td>
              <td>
                <div className="table-actions">
                  <button
                    type="button"
                    className="btn-secondary table-action-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      openEditMaterialModal(item);
                    }}
                    disabled={!canManageMaterials}
                  >
                    Modificar
                  </button>
                  <button
                    type="button"
                    className="btn-danger table-action-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void removeMaterial(item);
                    }}
                    disabled={!canManageMaterials}
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

      {isMaterialModalOpen ? (
        <div className="catalog-dialog-backdrop" role="presentation" onClick={closeMaterialModal}>
          <div
            className="catalog-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={selectedMaterial ? "Editar material" : "Nuevo material"}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="catalog-dialog-header">
              <div>
                <strong>{selectedMaterial ? "Editar material" : "Nuevo material"}</strong>
                <div className="muted">Catálogo maestro de materiales</div>
              </div>
              <button type="button" className="ghost-button" onClick={closeMaterialModal}>
                Cerrar
              </button>
            </div>
            <form className="inline-form materials-form" onSubmit={handleSubmit}>
              <label>
                Código
                <input value={form.code} onChange={(e) => updateField("code", e.target.value)} placeholder="pet-claro" required />
              </label>
              <label>
                Nombre
                <input value={form.name} onChange={(e) => updateField("name", e.target.value)} placeholder="PET Claro" required />
              </label>
              <label>
                Subfamilia
                <input value={form.subfamily} onChange={(e) => updateField("subfamily", e.target.value)} placeholder="Limpio / Sucio / Compactado" />
              </label>
              <label>
                Familia
                <select value={form.family} onChange={(e) => updateField("family", e.target.value)} required>
                  <option value="">Seleccionar</option>
                  {families.map((family) => (
                    <option key={family.id} value={family.id}>
                      {family.code} · {family.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Unidad
                <select value={form.unit} onChange={(e) => updateField("unit", e.target.value as Material["unit"])}>
                  <option value="kg">Kilogramo</option>
                  <option value="ton">Tonelada</option>
                  <option value="piece">Pieza</option>
                </select>
              </label>
              <label>
                Valorizable
                <div className="checkbox-field">
                  <input type="checkbox" checked={form.valuation_possible} onChange={(e) => updateField("valuation_possible", e.target.checked)} />
                  <span>{form.valuation_possible ? "Sí" : "No"}</span>
                </div>
              </label>
              <label>
                Peligrosidad auxiliar
                <div className="checkbox-field">
                  <input type="checkbox" checked={form.is_hazard_auxiliary} onChange={(e) => updateField("is_hazard_auxiliary", e.target.checked)} />
                  <span>{form.is_hazard_auxiliary ? "Sí" : "No"}</span>
                </div>
              </label>
              <label>
                Revisión especial
                <div className="checkbox-field">
                  <input type="checkbox" checked={form.requires_special_review} onChange={(e) => updateField("requires_special_review", e.target.checked)} />
                  <span>{form.requires_special_review ? "Sí" : "No"}</span>
                </div>
              </label>
              <label>
                Comprable
                <div className="checkbox-field">
                  <input type="checkbox" checked={form.is_buyable} onChange={(e) => updateField("is_buyable", e.target.checked)} />
                  <span>{form.is_buyable ? "Sí" : "No"}</span>
                </div>
              </label>
              <label>
                Vendible
                <div className="checkbox-field">
                  <input type="checkbox" checked={form.is_sellable} onChange={(e) => updateField("is_sellable", e.target.checked)} />
                  <span>{form.is_sellable ? "Sí" : "No"}</span>
                </div>
              </label>
              <label>
                Procesable
                <div className="checkbox-field">
                  <input type="checkbox" checked={form.is_processable} onChange={(e) => updateField("is_processable", e.target.checked)} />
                  <span>{form.is_processable ? "Sí" : "No"}</span>
                </div>
              </label>
              <label>
                Procesado
                <div className="checkbox-field">
                  <input type="checkbox" checked={form.is_processed} onChange={(e) => updateField("is_processed", e.target.checked)} />
                  <span>{form.is_processed ? "Sí" : "No"}</span>
                </div>
              </label>
              <label>
                Activo
                <div className="checkbox-field">
                  <input type="checkbox" checked={form.is_active} onChange={(e) => updateField("is_active", e.target.checked)} />
                  <span>{form.is_active ? "Sí" : "No"}</span>
                </div>
              </label>
              <label>
                Merma por defecto
                <input
                  type="number"
                  value={form.default_merma_pct}
                  onChange={(e) => updateField("default_merma_pct", e.target.value)}
                  placeholder="ej. 0.03 (3%)"
                  min={0}
                  max={1}
                  step={0.0001}
                />
              </label>
              <div className="full-width-form-field" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button type="submit" className="btn-primary" disabled={!canManageMaterials}>
                  {selectedMaterial ? "Actualizar" : "Crear"} material
                </button>
                <button type="button" className="btn-secondary" onClick={closeMaterialModal}>
                  Cancelar
                </button>
                {selectedMaterial ? (
                  <button type="button" className="btn-danger" onClick={() => void removeMaterial()} disabled={!canManageMaterials}>
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
