import { useEffect, useState } from "react";
import { api } from "../api/resources";
import { Page } from "../components/Page";

type DailyReport = {
  date: string;
  ops_count: number;
  total_weight_kg: number;
  total_merma_kg: number;
  total_revenue: number;
  by_family: Array<{ family_id: string; name: string; weight_kg: number; amount: number; items_count: number }>;
  by_client: Array<{ client_id: string; name: string; ops_count: number; weight_kg: number; amount: number }>;
  trend_7d: Array<{ date: string; label: string; revenue: number; weight_kg: number; ops_count: number }>;
};

function fmt(n: number, decimals = 0) {
  return n.toLocaleString("es-MX", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtCurrency(n: number) {
  return "$" + n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function DashboardPage() {
  const [report, setReport] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));

  const load = (date: string) => {
    setLoading(true);
    setError(null);
    api.reportDaily(date)
      .then(setReport)
      .catch(() => setError("No se pudo cargar el reporte diario."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(selectedDate); }, [selectedDate]);

  const maxFamilyAmount = Math.max(...(report?.by_family.map((f) => f.amount) ?? [1]), 1);
  const maxTrendRevenue = Math.max(...(report?.trend_7d.map((d) => d.revenue) ?? [1]), 1);

  return (
    <Page title="Dashboard operativo">
      <div className="page-header">
        <div>
          <h2 style={{ margin: 0 }}>Resumen del día</h2>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: "0.82rem" }}>
            Compras, materiales y clientes del día seleccionado
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            type="date"
            value={selectedDate}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{ width: "auto" }}
          />
          <button className="btn-secondary" onClick={() => load(selectedDate)}>
            Actualizar
          </button>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <div className="muted" style={{ textAlign: "center", padding: 40 }}>Cargando reporte…</div>
      ) : report ? (
        <>
          <div className="kpi-grid">
            <KpiCard label="Operaciones" value={fmt(report.ops_count)} accent />
            <KpiCard label="Peso neto total" value={fmt(report.total_weight_kg, 1) + " kg"} />
            <KpiCard label="Merma total" value={fmt(report.total_merma_kg, 1) + " kg"} amber />
            <KpiCard label="Ingresos del día" value={fmtCurrency(report.total_revenue)} blue />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="section-panel">
              <div className="section-panel-header">
                <h3>Compras por familia de material</h3>
              </div>
              <div className="section-panel-body">
                {report.by_family.length === 0 ? (
                  <p className="muted" style={{ margin: 0 }}>Sin compras registradas hoy.</p>
                ) : (
                  <div className="bar-chart">
                    {report.by_family
                      .sort((a, b) => b.amount - a.amount)
                      .map((fam) => (
                        <div key={fam.family_id} className="bar-row">
                          <span className="bar-label" title={fam.name}>{fam.name}</span>
                          <div className="bar-track">
                            <div
                              className="bar-fill"
                              style={{ width: `${Math.max(2, (fam.amount / maxFamilyAmount) * 100)}%` }}
                            />
                          </div>
                          <span className="bar-amount">{fmtCurrency(fam.amount)}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>

            <div className="section-panel">
              <div className="section-panel-header">
                <h3>Tendencia 7 días — ingresos</h3>
              </div>
              <div className="section-panel-body">
                {report.trend_7d.length === 0 ? (
                  <p className="muted" style={{ margin: 0 }}>Sin datos de tendencia.</p>
                ) : (
                  <div
                    className="trend-chart"
                    style={{ alignItems: "flex-end", height: 100, display: "flex", gap: 6, marginBottom: 8 }}
                  >
                    {report.trend_7d.map((day) => {
                      const pct = maxTrendRevenue > 0 ? (day.revenue / maxTrendRevenue) * 100 : 0;
                      const isToday = day.date === selectedDate;
                      return (
                        <div key={day.date} className="trend-bar-wrap" title={`${day.label}: ${fmtCurrency(day.revenue)}`}>
                          <div className="trend-bar-inner">
                            <div
                              className={`trend-bar-fill${isToday ? " today" : ""}`}
                              style={{ height: `${Math.max(4, pct)}%` }}
                            />
                          </div>
                          <span className="trend-label">{day.label}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="section-panel">
            <div className="section-panel-header">
              <h3>Compras por cliente / proveedor</h3>
            </div>
            {report.by_client.length === 0 ? (
              <div style={{ padding: "16px 20px" }}>
                <p className="muted" style={{ margin: 0 }}>Sin clientes registrados hoy.</p>
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Cliente / Proveedor</th>
                    <th>Operaciones</th>
                    <th>Peso neto (kg)</th>
                    <th>Importe ($)</th>
                  </tr>
                </thead>
                <tbody>
                  {report.by_client
                    .sort((a, b) => b.amount - a.amount)
                    .map((client) => (
                      <tr key={client.client_id}>
                        <td style={{ fontWeight: 500, color: "var(--text)" }}>{client.name}</td>
                        <td>{client.ops_count}</td>
                        <td>{fmt(client.weight_kg, 1)}</td>
                        <td style={{ fontWeight: 600, color: "var(--accent)" }}>
                          {fmtCurrency(client.amount)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : null}
    </Page>
  );
}

function KpiCard({
  label,
  value,
  accent,
  amber,
  blue,
}: {
  label: string;
  value: string;
  accent?: boolean;
  amber?: boolean;
  blue?: boolean;
}) {
  const cls = `card${accent ? " card-accent" : amber ? " card-amber" : blue ? " card-blue" : ""}`;
  return (
    <div className={cls}>
      <div className="card-label">{label}</div>
      <div className="card-value">{value}</div>
    </div>
  );
}
