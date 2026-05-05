import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../api/resources";
import type { CommercialRole, Party } from "../types";
import { Page } from "../components/Page";
import { Pagination } from "../components/Pagination";
import { SortableHeader } from "../components/SortableHeader";
import { matchesSearch, paginate } from "../utils/listing";
import { sortByValue } from "../utils/listing";
import { useAuth } from "../context/AuthContext";
import { userCan } from "../utils/permissions";

function kindLabel(kind: Party["kind"]) {
  return kind === "company" ? "Empresa" : "Persona";
}

function emptyForm() {
  return {
    kind: "company" as Party["kind"],
    legal_name: "",
    trade_name: "",
    tax_id: "",
    email: "",
    phone: "",
    address: "",
    notes: "",
    is_active: true,
    commercial_roles: [] as string[],
  };
}

export function PartiesPage() {
  const { user } = useAuth();
  const canManageParties = userCan(user, "parties.manage");
  const [items, setItems] = useState<Party[]>([]);
  const [commercialRoles, setCommercialRoles] = useState<CommercialRole[]>([]);
  const [selectedPartyId, setSelectedPartyId] = useState("");
  const [form, setForm] = useState(emptyForm());
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState<"kind" | "legal_name" | "trade_name" | "tax_id" | "roles" | "active">("legal_name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    setItems(await api.parties().catch(() => []));
    setCommercialRoles(await api.commercialRoles().catch(() => []));
  }

  useEffect(() => {
    refresh();
  }, []);

  const selectedParty = useMemo(() => items.find((item) => item.id === selectedPartyId) ?? null, [items, selectedPartyId]);
  const commercialRoleNames = useMemo(() => Object.fromEntries(commercialRoles.map((role) => [role.id, role.name])), [commercialRoles]);
  const filteredItems = useMemo(
    () =>
      items.filter((item) =>
        matchesSearch(
          [
            kindLabel(item.kind),
            item.legal_name,
            item.trade_name,
            item.tax_id,
            item.email,
            item.phone,
            item.address,
            (item.commercial_roles ?? []).map((roleId) => commercialRoleNames[roleId] ?? roleId).join(" "),
          ],
          search,
        ),
      ),
    [commercialRoleNames, items, search],
  );
  const sortedItems = useMemo(() => {
    const accessors = {
      kind: (item: Party) => kindLabel(item.kind),
      legal_name: (item: Party) => item.legal_name,
      trade_name: (item: Party) => item.trade_name || "",
      tax_id: (item: Party) => item.tax_id || "",
      roles: (item: Party) => (item.commercial_roles ?? []).map((roleId) => commercialRoleNames[roleId] ?? roleId).join(", "),
      active: (item: Party) => (item.is_active ? 1 : 0),
    } satisfies Record<typeof sortKey, (item: Party) => string | number>;
    return sortByValue(filteredItems, accessors[sortKey], sortDirection);
  }, [commercialRoleNames, filteredItems, sortDirection, sortKey]);
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
    if (selectedParty) {
      setForm({
        kind: selectedParty.kind,
        legal_name: selectedParty.legal_name,
        trade_name: selectedParty.trade_name,
        tax_id: selectedParty.tax_id,
        email: selectedParty.email,
        phone: selectedParty.phone,
        address: selectedParty.address,
        notes: selectedParty.notes,
        is_active: selectedParty.is_active,
        commercial_roles: selectedParty.commercial_roles ?? [],
      });
    } else {
      setForm(emptyForm());
    }
  }, [selectedParty]);

  function updateField(field: keyof typeof form, value: string | boolean | string[]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canManageParties) {
      setMessage("No tienes permiso para gestionar personas/empresas.");
      return;
    }
    setMessage(null);
    try {
      const payload = {
        ...form,
        trade_name: form.trade_name || "",
        tax_id: form.tax_id || "",
        email: form.email || "",
        phone: form.phone || "",
        address: form.address || "",
        notes: form.notes || "",
        commercial_roles: form.commercial_roles,
      };
      if (selectedParty) {
        await api.partyUpdate(selectedParty.id, payload);
        setMessage("Persona/empresa actualizada.");
      } else {
        await api.partyCreate(payload);
        setMessage("Persona/empresa creada.");
      }
      setSelectedPartyId("");
      setForm(emptyForm());
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar la persona/empresa");
    }
  }

  async function removeParty() {
    if (!selectedParty) return;
    if (!canManageParties) {
      setMessage("No tienes permiso para eliminar personas/empresas.");
      return;
    }
    if (!window.confirm(`Seguro que deseas eliminar a ${selectedParty.legal_name}${selectedParty.trade_name ? ` (${selectedParty.trade_name})` : ""}? Esta accion no se puede deshacer.`)) {
      return;
    }
    setMessage(null);
    try {
      await api.partyDelete(selectedParty.id);
      setMessage("Persona/empresa eliminada.");
      setSelectedPartyId("");
      setForm(emptyForm());
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo eliminar la persona/empresa");
    }
  }

  return (
    <Page title="Personas / Empresas" actions={<span className="muted">Alta, edición y clasificación comercial</span>}>
      {message ? <div className="info-banner" style={{ marginBottom: 16 }}>{message}</div> : null}

      <section className="metric-panel" style={{ marginBottom: 16 }}>
        <span>Catálogo maestro</span>
        <strong>{items.length}</strong>
        <div className="muted" style={{ marginTop: 6 }}>
          Personas físicas y morales con roles comerciales, datos fiscales y contacto operativo.
        </div>
      </section>

      <div className="metric-panel" style={{ marginBottom: 12 }}>
        <label className="search-box">
          Búsqueda rápida
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por razón social, nombre comercial, RFC, correo, teléfono o rol"
          />
        </label>
      </div>

            <form className="party-form" onSubmit={handleSubmit} style={{ marginBottom: 20 }}>
        <div className="party-form-row party-form-primary-row">
          <label>
            Tipo
            <select value={form.kind} onChange={(e) => updateField("kind", e.target.value as Party["kind"])}>
              <option value="company">Empresa</option>
              <option value="person">Persona</option>
            </select>
          </label>
          <label>
            Razón social
            <input value={form.legal_name} onChange={(e) => updateField("legal_name", e.target.value)} required />
          </label>
          <label>
            Nombre comercial
            <input value={form.trade_name} onChange={(e) => updateField("trade_name", e.target.value)} />
          </label>
          <label>
            RFC / ID fiscal
            <input value={form.tax_id} onChange={(e) => updateField("tax_id", e.target.value)} />
          </label>
          <label>
            Correo
            <input value={form.email} onChange={(e) => updateField("email", e.target.value)} />
          </label>
          <label>
            Teléfono
            <input value={form.phone} onChange={(e) => updateField("phone", e.target.value)} />
          </label>
          <label>
            Dirección
            <input value={form.address} onChange={(e) => updateField("address", e.target.value)} />
          </label>
        </div>
        <div className="party-form-row party-form-secondary-row">
          <label className="stack-field party-roles-field">
            Roles comerciales
            <select
              multiple
              value={form.commercial_roles}
              onChange={(e) =>
                updateField(
                  "commercial_roles",
                  Array.from(e.currentTarget.selectedOptions, (option) => option.value),
                )
              }
              style={{ minHeight: 128 }}
            >
              {commercialRoles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.code} · {role.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Activo
            <div className="checkbox-field">
              <input type="checkbox" checked={form.is_active} onChange={(e) => updateField("is_active", e.target.checked)} />
              <span>{form.is_active ? "Sí" : "No"}</span>
            </div>
          </label>
          <label className="stack-field party-notes-field">
            Notas
            <textarea value={form.notes} onChange={(e) => updateField("notes", e.target.value)} rows={3} />
          </label>
          <div className="party-actions">
            <button type="submit" className="ghost-button" disabled={!canManageParties}>{selectedParty ? "Actualizar" : "Crear"} persona/empresa</button>
            <button type="button" className="ghost-button" onClick={() => { setSelectedPartyId(""); setForm(emptyForm()); }}>
              Limpiar
            </button>
            {selectedParty ? (
              <button type="button" className="ghost-button" onClick={removeParty} disabled={!canManageParties}>
                Eliminar
              </button>
            ) : null}
          </div>
        </div>
      </form>

      <table className="table">
        <thead>
          <tr>
            <th><SortableHeader label="Tipo" active={sortKey === "kind"} direction={sortDirection} onClick={() => toggleSort("kind")} /></th>
            <th><SortableHeader label="Razón social" active={sortKey === "legal_name"} direction={sortDirection} onClick={() => toggleSort("legal_name")} /></th>
            <th><SortableHeader label="Nombre comercial" active={sortKey === "trade_name"} direction={sortDirection} onClick={() => toggleSort("trade_name")} /></th>
            <th><SortableHeader label="RFC / ID" active={sortKey === "tax_id"} direction={sortDirection} onClick={() => toggleSort("tax_id")} /></th>
            <th><SortableHeader label="Roles" active={sortKey === "roles"} direction={sortDirection} onClick={() => toggleSort("roles")} /></th>
            <th><SortableHeader label="Activo" active={sortKey === "active"} direction={sortDirection} onClick={() => toggleSort("active")} /></th>
          </tr>
        </thead>
        <tbody>
          {paginatedItems.items.map((item) => (
            <tr
              key={item.id}
              onClick={() => setSelectedPartyId(item.id)}
              style={{ cursor: "pointer", background: item.id === selectedPartyId ? "rgba(124, 58, 237, 0.12)" : undefined }}
            >
              <td>{kindLabel(item.kind)}</td>
              <td>{item.legal_name}</td>
              <td>{item.trade_name || "-"}</td>
              <td>{item.tax_id || "-"}</td>
              <td>
                {(item.commercial_roles ?? []).length
                  ? (item.commercial_roles ?? []).map((roleId) => commercialRoleNames[roleId] ?? roleId).join(", ")
                  : "-"}
              </td>
              <td>{item.is_active ? "Sí" : "No"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <Pagination {...paginatedItems} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={setPageSize} />
    </Page>
  );
}

