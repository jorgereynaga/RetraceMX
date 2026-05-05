import { FormEvent, useEffect, useMemo, useState } from "react";
import { Page } from "../components/Page";
import { Pagination } from "../components/Pagination";
import { SortableHeader } from "../components/SortableHeader";
import { api } from "../api/resources";
import type { Role, User } from "../types";
import { matchesSearch, paginate, sortByValue } from "../utils/listing";
import { getRolePermissionMatrix } from "../utils/permissions";

type SortKey = "username" | "name" | "email" | "phone" | "roles" | "status";

function emptyForm() {
  return {
    username: "",
    email: "",
    first_name: "",
    last_name: "",
    phone: "",
    password: "",
    is_active: true,
    roles: [] as string[],
  };
}

export function UsersPage() {
  const [items, setItems] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [form, setForm] = useState(emptyForm());
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState<SortKey>("username");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    setItems(await api.users().catch(() => []));
    setRoles(await api.roles().catch(() => []));
  }

  useEffect(() => {
    refresh();
  }, []);

  const selectedUser = useMemo(() => items.find((item) => item.id === selectedUserId) ?? null, [items, selectedUserId]);
  const roleNameById = useMemo(() => Object.fromEntries(roles.map((role) => [role.id, role.name])), [roles]);
  const roleCodeById = useMemo(() => Object.fromEntries(roles.map((role) => [role.id, role.code])), [roles]);
  const roleMatrix = useMemo(() => getRolePermissionMatrix(), []);

  const filteredItems = useMemo(
    () =>
      items.filter((item) =>
        matchesSearch(
          [
            item.username,
            item.email,
            item.first_name,
            item.last_name,
            item.phone,
            (item.role_names ?? []).join(" "),
            (item.roles ?? []).map((roleId) => roleNameById[roleId] ?? roleId).join(" "),
          ],
          search,
        ),
      ),
    [items, roleNameById, search],
  );

  const sortedItems = useMemo(() => {
    const accessors: Record<SortKey, (item: User) => string | number> = {
      username: (item) => item.username,
      name: (item) => `${item.first_name || ""} ${item.last_name || ""}`.trim(),
      email: (item) => item.email,
      phone: (item) => item.phone || "",
      roles: (item) => (item.role_names ?? []).join(", "),
      status: (item) => (item.is_active ? 1 : 0),
    };
    return sortByValue(filteredItems, accessors[sortKey], sortDirection);
  }, [filteredItems, sortDirection, sortKey]);

  const paginatedItems = useMemo(() => paginate(sortedItems, page, pageSize), [page, pageSize, sortedItems]);

  useEffect(() => {
    setPage(1);
  }, [search, pageSize, sortDirection, sortKey]);

  useEffect(() => {
    if (!selectedUserId) return;
    const index = sortedItems.findIndex((item) => item.id === selectedUserId);
    if (index < 0) return;
    const targetPage = Math.floor(index / pageSize) + 1;
    if (targetPage !== page) {
      setPage(targetPage);
    }
  }, [page, pageSize, selectedUserId, sortedItems]);

  useEffect(() => {
    if (!selectedUser) {
      setForm(emptyForm());
      return;
    }
    setForm({
      username: selectedUser.username,
      email: selectedUser.email,
      first_name: selectedUser.first_name || "",
      last_name: selectedUser.last_name || "",
      phone: selectedUser.phone || "",
      password: "",
      is_active: selectedUser.is_active ?? true,
      roles: selectedUser.roles ?? [],
    });
  }, [selectedUser]);

  function updateField(field: keyof typeof form, value: string | boolean | string[]) {
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

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    try {
      const payload: Record<string, unknown> = {
        username: form.username.trim(),
        email: form.email.trim(),
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        phone: form.phone.trim(),
        is_active: form.is_active,
        roles: form.roles,
      };
      if (form.password.trim()) {
        payload.password = form.password;
      }
      if (selectedUser) {
        await api.userUpdate(selectedUser.id, payload);
        setMessage("Usuario actualizado.");
      } else {
        await api.userCreate(payload);
        setMessage("Usuario creado.");
      }
      setSelectedUserId("");
      setForm(emptyForm());
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar el usuario");
    }
  }

  async function removeUser() {
    if (!selectedUser) return;
    if (!window.confirm(`Seguro que deseas eliminar el usuario ${selectedUser.username}? Esta accion no se puede deshacer.`)) {
      return;
    }
    setMessage(null);
    try {
      await api.userDelete(selectedUser.id);
      setMessage("Usuario eliminado.");
      setSelectedUserId("");
      setForm(emptyForm());
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo eliminar el usuario");
    }
  }

  return (
    <Page title="Usuarios" actions={<span className="muted">Alta, edición y roles mínimos del sistema</span>}>
      {message ? <div className={message.toLowerCase().includes("no") ? "error-banner" : "info-banner"} style={{ marginBottom: 16 }}>{message}</div> : null}

      <section className="metric-panel" style={{ marginBottom: 16 }}>
        <span>Usuarios totales</span>
        <strong>{items.length}</strong>
        <div className="muted" style={{ marginTop: 6 }}>
          Control de acceso para operación, caja, inventarios, ventas, logística y auditoría.
        </div>
      </section>

      <div className="users-stats-row" style={{ marginBottom: 16 }}>
        <div className="metric-panel"><span className="metric-label">Activos</span><strong className="metric-value">{items.filter((item) => item.is_active).length}</strong></div>
        <div className="metric-panel"><span className="metric-label">Superusuarios</span><strong className="metric-value">{items.filter((item) => item.is_superuser).length}</strong></div>
        <div className="metric-panel"><span className="metric-label">Con roles</span><strong className="metric-value">{items.filter((item) => (item.roles ?? []).length > 0).length}</strong></div>
        <div className="metric-panel"><span className="metric-label">Roles disponibles</span><strong className="metric-value">{roles.length}</strong></div>
      </div>

      <section className="section-panel" style={{ marginBottom: 16 }}>
        <div className="section-panel-header">
          <h3>Matriz de permisos</h3>
          <span className="muted">Referente operativo para los roles mínimos</span>
        </div>
        <div className="section-panel-body" style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Rol</th>
                <th>Identificador</th>
                <th>Permisos principales</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr key={role.id}>
                  <td>{role.name}</td>
                  <td><code>{role.code}</code></td>
                  <td>{(roleMatrix[role.code] ?? []).slice(0, 5).join(", ")}{(roleMatrix[role.code] ?? []).length > 5 ? "..." : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="metric-panel" style={{ marginBottom: 16 }}>
        <label className="search-box">
          Búsqueda rápida
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por usuario, nombre, correo, teléfono o rol" />
        </label>
      </div>

      <form className="user-form" onSubmit={handleSubmit} style={{ marginBottom: 20 }}>
        <div className="user-form-row" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14 }}>
          <label>
            Usuario
            <input value={form.username} onChange={(e) => updateField("username", e.target.value)} required />
          </label>
          <label>
            Correo
            <input value={form.email} onChange={(e) => updateField("email", e.target.value)} type="email" required />
          </label>
          <label>
            Nombre
            <input value={form.first_name} onChange={(e) => updateField("first_name", e.target.value)} />
          </label>
          <label>
            Apellido
            <input value={form.last_name} onChange={(e) => updateField("last_name", e.target.value)} />
          </label>
          <label>
            Teléfono
            <input value={form.phone} onChange={(e) => updateField("phone", e.target.value)} />
          </label>
          <label>
            Contraseña {selectedUser ? "(dejar vacío para conservar)" : ""}
            <input value={form.password} onChange={(e) => updateField("password", e.target.value)} type="password" required={!selectedUser} />
          </label>
        </div>

        <div className="user-form-row" style={{ display: "grid", gridTemplateColumns: "1.4fr 0.8fr 0.8fr", gap: 14, marginTop: 14 }}>
          <label className="stack-field">
            Roles mínimos
            <select
              multiple
              value={form.roles}
              onChange={(e) => updateField("roles", Array.from(e.currentTarget.selectedOptions, (option) => option.value))}
              style={{ minHeight: 150 }}
            >
              {roles.map((role) => (
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
          <div className="party-actions" style={{ alignSelf: "end" }}>
            <button type="submit" className="ghost-button">{selectedUser ? "Actualizar" : "Crear"} usuario</button>
            <button type="button" className="ghost-button" onClick={() => { setSelectedUserId(""); setForm(emptyForm()); }}>
              Limpiar
            </button>
            {selectedUser ? (
              <button type="button" className="ghost-button" onClick={removeUser}>
                Eliminar
              </button>
            ) : null}
          </div>
        </div>
      </form>

      <table className="table">
        <thead>
          <tr>
            <th><SortableHeader label="Usuario" active={sortKey === "username"} direction={sortDirection} onClick={() => toggleSort("username")} /></th>
            <th><SortableHeader label="Nombre" active={sortKey === "name"} direction={sortDirection} onClick={() => toggleSort("name")} /></th>
            <th><SortableHeader label="Correo" active={sortKey === "email"} direction={sortDirection} onClick={() => toggleSort("email")} /></th>
            <th><SortableHeader label="Teléfono" active={sortKey === "phone"} direction={sortDirection} onClick={() => toggleSort("phone")} /></th>
            <th><SortableHeader label="Roles" active={sortKey === "roles"} direction={sortDirection} onClick={() => toggleSort("roles")} /></th>
            <th><SortableHeader label="Estado" active={sortKey === "status"} direction={sortDirection} onClick={() => toggleSort("status")} /></th>
          </tr>
        </thead>
        <tbody>
          {paginatedItems.items.map((item) => (
            <tr
              key={item.id}
              onClick={() => setSelectedUserId(item.id)}
              style={{ cursor: "pointer", background: item.id === selectedUserId ? "rgba(124, 58, 237, 0.12)" : undefined }}
            >
              <td>{item.username}</td>
              <td>{`${item.first_name || ""} ${item.last_name || ""}`.trim() || "-"}</td>
              <td>{item.email}</td>
              <td>{item.phone || "-"}</td>
              <td>
                {(item.role_names ?? []).length
                  ? (item.role_names ?? []).join(", ")
                  : (item.roles ?? []).map((roleId) => roleNameById[roleId] ?? roleCodeById[roleId] ?? roleId).join(", ") || "-"}
              </td>
              <td>{item.is_active ? "Activo" : "Inactivo"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <Pagination {...paginatedItems} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={setPageSize} />
    </Page>
  );
}
