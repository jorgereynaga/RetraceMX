import { useEffect, useState } from "react";
import { api } from "../api/resources";
import { Page } from "../components/Page";

type Report = Record<string, unknown>;

const KPI_KEYS: Array<[keyof Report | string, string]> = [
  ["operations_count", "Operaciones"],
  ["confirmed_items_count", "Partidas"],
  ["recovered_tons", "Ton recuperadas"],
  ["total_revenue", "Ingresos compra"],
  ["sale_orders_count", "Ventas"],
  ["sale_profit", "Utilidad venta"],
  ["collection_trips_count", "Viajes"],
  ["collection_trip_incidents_count", "Incidencias"],
  ["telemetry_points_count", "Puntos GPS"],
  ["telemetry_distance_km", "Km GPS"],
  ["estimated_fuel_liters", "Comb. est."],
  ["inventory_movements_count", "Mov. inventario"],
];

export function DashboardPage() {
  const [report, setReport] = useState<Report | null>(null);

  useEffect(() => {
    api.reportBasic().then(setReport).catch(() => setReport(null));
  }, []);

  return (
    <Page title="Dashboard">
      <div className="grid cards">
        {KPI_KEYS.map(([key, label]) => (
          <Card key={key} label={label} value={String(report?.[key] ?? "-")} />
        ))}
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 24 }}>
        <section className="metric-panel">
          <span>Utilidad estimada</span>
          <strong>{String(report?.utility_estimate ?? "-")}</strong>
          <div className="muted">{String(report?.utility_note ?? "Disponible cuando existan ventas registradas.")}</div>
        </section>
        <section className="metric-panel">
          <span>Estado operativo</span>
          <strong>
            {String(report?.collection_trips_departed ?? 0)} salidas / {String(report?.collection_trips_completed ?? 0)} llegadas /{" "}
            {String(report?.collection_trips_closed ?? 0)} cerrados
          </strong>
          <div className="muted">Tablero base para control de recolección, compra y comercialización.</div>
        </section>
        <section className="metric-panel">
          <span>Incidencias abiertas</span>
          <strong>{String(report?.collection_trip_incidents_open ?? 0)}</strong>
          <div className="muted">Alertas y eventos pendientes de resolver en viajes de campo.</div>
        </section>
      </div>
    </Page>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <article className="card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
