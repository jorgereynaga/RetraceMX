import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

type NavSection = {
  label: string;
  items: Array<{ to: string; label: string; icon: string }>;
};

const navSections: NavSection[] = [
  {
    label: "General",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: "📊" },
    ],
  },
  {
    label: "Catálogos",
    items: [
      { to: "/materials", label: "Materiales", icon: "📦" },
      { to: "/parties", label: "Personas / Empresas", icon: "🏢" },
      { to: "/centers", label: "Centros de acopio", icon: "🏭" },
      { to: "/price-lists", label: "Listas de precios", icon: "💲" },
    ],
  },
  {
    label: "Operación",
    items: [
      { to: "/compra", label: "Compra de materiales", icon: "⚖️" },
      { to: "/cashier", label: "Caja y pagos", icon: "💰" },
      { to: "/operations", label: "Historial de compras", icon: "📋" },
    ],
  },
  {
    label: "Comercial",
    items: [
      { to: "/sales", label: "Ventas", icon: "🛒" },
      { to: "/routes", label: "Rutas", icon: "🗺️" },
      { to: "/logistics", label: "Logística", icon: "🚚" },
    ],
  },
  {
    label: "Control",
    items: [
      { to: "/history", label: "Historial", icon: "🕓" },
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
          <h1>Acopio360</h1>
          <p>Operación · Pesaje · Trazabilidad</p>
        </div>

        <nav className="sidebar-nav">
          {navSections.map((section) => (
            <div key={section.label}>
              <div className="sidebar-section-label">{section.label}</div>
              {section.items.map(({ to, label, icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
                >
                  <span style={{ fontSize: "1rem", lineHeight: 1 }}>{icon}</span>
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
          <button className="ghost-button" onClick={clearSession} title="Cerrar sesión">
            ↩
          </button>
        </div>
      </aside>

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
