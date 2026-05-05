import { NavLink } from "react-router-dom";

const tabs = [
  { to: "/sales", label: "Ventas" },
  { to: "/routes", label: "Rutas" },
  { to: "/logistics", label: "Logística" },
];

export function CommercialTabs() {
  return (
    <div className="section-panel" style={{ marginBottom: 16 }}>
      <div className="section-panel-body" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              isActive
                ? "btn-primary"
                : "btn-secondary"
            }
            style={{ textDecoration: "none" }}
          >
            {tab.label}
          </NavLink>
        ))}
      </div>
    </div>
  );
}
