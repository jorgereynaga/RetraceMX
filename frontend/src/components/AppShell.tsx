import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const navItems = [
  ["/dashboard", "Dashboard"],
  ["/materials", "Materiales"],
  ["/parties", "Personas/Empresas"],
  ["/centers", "Centros"],
  ["/routes", "Rutas"],
  ["/price-lists", "Listas de precios"],
  ["/operations", "Operaciones"],
  ["/weighing", "Pesaje"],
  ["/ticket", "Ticket"],
  ["/cashier", "Caja"],
  ["/sales", "Comercializacion"],
  ["/logistics", "Logistica"],
  ["/history", "Historial"],
];

export function AppShell() {
  const { clearSession, user } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <h1>Acopio360</h1>
          <p>Operación, pesaje y trazabilidad</p>
        </div>
        <nav>
          {navItems.map(([to, label]) => (
            <NavLink key={to} to={to} className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
              {label}
            </NavLink>
          ))}
        </nav>
        <button className="ghost-button" onClick={clearSession}>
          Cerrar sesión
        </button>
        {user ? <small>{user.username}</small> : null}
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
