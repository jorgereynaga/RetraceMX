import { FormEvent, useEffect, useState } from "react";
import { api } from "../api/resources";
import { Page } from "../components/Page";
import type { ProcessType } from "../types";

type ProcessTypeFormState = {
  code: string;
  name: string;
  description: string;
  active: boolean;
};

const emptyForm: ProcessTypeFormState = {
  code: "",
  name: "",
  description: "",
  active: true,
};

function formatCount(value: number) {
  return value.toLocaleString("es-MX");
}

export function ProcessTypesPage() {
  const [items, setItems] = useState<ProcessType[]>([]);
  const [form, setForm] = useState<ProcessTypeFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      const rows = await api.processTypes();
      setItems(rows);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cargar el catálogo de tipos de proceso.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const total = items.length;
  const activeCount = items.filter((item) => item.active).length;
  const inactiveCount = total - activeCount;

  function startEdit(item: ProcessType) {
    setEditingId(item.id);
    setForm({
      code: item.code,
      name: item.name,
      description: item.description ?? "",
      active: item.active,
    });
    setMessage(null);
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    try {
      if (editingId) {
        await api.processTypePatch(editingId, form);
        setMessage("Tipo de proceso actualizado.");
      } else {
        await api.processTypeCreate(form);
        setMessage("Tipo de proceso creado.");
      }
      resetForm();
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar el tipo de proceso.");
    }
  }

  async function remove(item: ProcessType) {
    const ok = window.confirm(`¿Eliminar el tipo de proceso "${item.name}"?`);
    if (!ok) return;
    setMessage(null);
    try {
      await api.processTypeDelete(item.id);
      if (editingId === item.id) {
        resetForm();
      }
      setMessage("Tipo de proceso eliminado.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo eliminar el tipo de proceso.");
    }
  }

  return (
    <Page
      title="Tipos de procesos"
      actions={<span className="muted">Catálogo independiente para configurar el módulo de procesamiento</span>}
    >
      {message ? <div className="info-banner" style={{ marginBottom: 16 }}>{message}</div> : null}

      <section className="kpi-grid" style={{ marginBottom: 16 }}>
        <Kpi label="Tipos registrados" value={formatCount(total)} accent />
        <Kpi label="Tipos activos" value={formatCount(activeCount)} blue />
        <Kpi label="Tipos inactivos" value={formatCount(inactiveCount)} amber />
        <Kpi label="Estado" value={loading ? "Cargando..." : "Listo"} />
      </section>

      <div className="processing-two-up">
        <section className="card">
          <div className="card-header">
            <strong>Catálogo</strong>
            <span className="muted">Se usa desde el módulo de procesamiento</span>
          </div>
          <div className="card-body" style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nombre</th>
                  <th>Estado</th>
                  <th>Descripción</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 700 }}>{item.code}</td>
                    <td>{item.name}</td>
                    <td>
                      <span className={`badge ${item.active ? "badge-green" : "badge-gray"}`}>{item.active ? "Activo" : "Inactivo"}</span>
                    </td>
                    <td>{item.description || "—"}</td>
                    <td>
                      <div className="inline-form" style={{ gridTemplateColumns: "auto auto" }}>
                        <button type="button" className="ghost-button" onClick={() => startEdit(item)}>
                          Editar
                        </button>
                        <button type="button" className="ghost-button" onClick={() => remove(item)}>
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="muted">
                      No hay tipos de proceso registrados.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <strong>{editingId ? "Editar tipo de proceso" : "Nuevo tipo de proceso"}</strong>
            <span className={`badge ${editingId ? "badge-blue" : "badge-green"}`}>{editingId ? "Editando" : "Alta"}</span>
          </div>
          <form className="card-body grid-form" onSubmit={save}>
            <label>
              Código
              <input value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} required />
            </label>
            <label>
              Nombre
              <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
            </label>
            <label className="full-width-form-field">
              Descripción
              <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} rows={4} />
            </label>
            <label>
              Activo
              <select value={String(form.active)} onChange={(event) => setForm((current) => ({ ...current, active: event.target.value === "true" }))}>
                <option value="true">Sí</option>
                <option value="false">No</option>
              </select>
            </label>
            <div className="inline-form">
              <button type="submit">{editingId ? "Guardar cambios" : "Crear tipo"}</button>
              {editingId ? (
                <button type="button" className="ghost-button" onClick={resetForm}>
                  Cancelar
                </button>
              ) : null}
            </div>
            <div className="info-banner full-width-form-field" style={{ display: "grid", gap: 6 }}>
              <strong>Uso operativo</strong>
              <span>Este catálogo alimenta el selector de tipo de proceso dentro de Procesamiento.</span>
              <span>La configuración vive aquí para mantener la operación diaria limpia y rápida.</span>
            </div>
          </form>
        </section>
      </div>
    </Page>
  );
}

function Kpi({ label, value, accent, amber, blue }: { label: string; value: string; accent?: boolean; amber?: boolean; blue?: boolean }) {
  const className = `card${accent ? " card-accent" : amber ? " card-amber" : blue ? " card-blue" : ""}`;
  return (
    <div className={className}>
      <div className="card-label">{label}</div>
      <div className="card-value">{value}</div>
    </div>
  );
}
