import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { userCan } from "../utils/permissions";

type NavSection = {
  label: string;
  items: Array<{ to: string; label: string; icon: string }>;
};

const navSections: NavSection[] = [
  {
    label: "General",
    items: [{ to: "/dashboard", label: "Dashboard", icon: "DB" }],
  },
  {
    label: "Catalogos",
    items: [
      { to: "/materials", label: "Materiales", icon: "MA" },
      { to: "/parties", label: "Personas / Empresas", icon: "PE" },
      { to: "/centers", label: "Centros de acopio", icon: "CA" },
      { to: "/price-lists", label: "Listas de precios", icon: "PR" },
    ],
  },
  {
    label: "Operacion",
    items: [
      { to: "/compra", label: "Compra de materiales", icon: "CO" },
      { to: "/cashier", label: "Caja y pagos", icon: "CJ" },
      { to: "/inventory", label: "Inventarios", icon: "IN" },
    ],
  },
  {
    label: "Ventas",
    items: [{ to: "/sales", label: "Comercializacion", icon: "VT" }],
  },
  {
    label: "Logistica",
    items: [
      { to: "/routes", label: "Rutas", icon: "RT" },
      { to: "/logistics", label: "Entregas", icon: "EN" },
    ],
  },
  {
    label: "Control",
    items: [
      { to: "/history", label: "Historial de compras", icon: "HI" },
      { to: "/sales-history", label: "Historial de ventas", icon: "SV" },
      { to: "/users", label: "Usuarios", icon: "US" },
    ],
  },
];

export function AppShell() {
  const { clearSession, user } = useAuth();
  const initials = user?.username?.slice(0, 2).toUpperCase() ?? "U";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <h1>ReTrace MX</h1>
          <p>Operación · Pesaje · Trazabilidad</p>
        </div>

        <nav className="sidebar-nav">
          {navSections.map((section) => (
            <div key={section.label}>
              <div className="sidebar-section-label">{section.label}</div>
              {section.items
                .filter((item) => item.to !== "/users" || userCan(user, "users.manage"))
                .map(({ to, label, icon }) => (
                  <NavLink key={to} to={to} className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        lineHeight: 1,
                        minWidth: 28,
                        height: 28,
                        borderRadius: 8,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "rgba(255,255,255,0.08)",
                        color: "var(--text-muted)",
                        fontWeight: 700,
                      }}
                    >
                      {icon}
                    </span>
                    {label}
                  </NavLink>
                ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">{initials}</div>
            <span className="sidebar-username">{user?.username ?? "Usuario"}</span>
          </div>
          {user?.role_names?.length ? (
            <div className="muted" style={{ marginTop: -6, marginBottom: 8 }}>
              {user.role_names.join(", ")}
            </div>
          ) : null}
          <button className="ghost-button" onClick={clearSession} title="Cerrar sesion">
            Salir
          </button>
        </div>
      </aside>

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
