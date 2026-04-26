import type { CollectionCenter, Material, Party, PurchaseOperation, TicketItem, Vehicle } from "../types";

function fmtKg(v: number) {
  return v.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtMXN(v: number) {
  return "$" + v.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("es-MX") + "  " + d.toLocaleTimeString("es-MX");
}

type Props = {
  operation: PurchaseOperation;
  items: TicketItem[];
  center?: CollectionCenter | null;
  customer?: Party | null;
  vehicle?: Vehicle | null;
  materialById?: Map<string, Material>;
};

export function TicketViewer({ operation, items, center, customer, vehicle, materialById }: Props) {
  const totalWeight = parseFloat(operation.total_weight_kg) || 0;
  const totalAmount = parseFloat(operation.total_amount) || 0;
  const customerName = customer ? (customer.trade_name || customer.legal_name) : operation.customer;
  const plate = operation.vehicle_plate ?? vehicle?.plate_number ?? "—";
  const encargado = operation.opened_by_name ?? "—";
  const conductor = operation.driver_name ?? "—";

  const cell: React.CSSProperties = { color: "#555", paddingRight: 6, whiteSpace: "nowrap", verticalAlign: "top" };
  const val: React.CSSProperties = { fontWeight: 600 };

  return (
    <div style={{
      fontFamily: "'Courier New', Courier, monospace",
      background: "#fff",
      color: "#111",
      maxWidth: 400,
      margin: "0 auto",
      padding: "20px 24px",
      border: "1px solid #ccc",
      borderRadius: 4,
      fontSize: "0.8rem",
      lineHeight: 1.5,
    }}>
      {/* ── Header ─────────────────────────────── */}
      <div style={{ textAlign: "center", marginBottom: 10 }}>
        <div style={{ fontSize: "1.6rem", fontWeight: 900, letterSpacing: "0.04em", textTransform: "uppercase" }}>
          {center?.name ?? "RECICLADORA"}
        </div>
        {center?.address && (
          <div style={{ fontSize: "0.7rem", marginTop: 4, color: "#444" }}>
            Dir: {center.address}
          </div>
        )}
      </div>

      <div style={{ borderTop: "1px dashed #999", margin: "8px 0" }} />

      {/* ── Operation metadata ─────────────────── */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.76rem", marginBottom: 6 }}>
        <tbody>
          <tr>
            <td style={cell}>Encargado:</td>
            <td style={val} colSpan={3}>{encargado}</td>
          </tr>
          <tr>
            <td style={cell}>ID:</td>
            <td style={val}>{operation.folio}</td>
            <td style={{ ...cell, paddingLeft: 12 }}>Tipo:</td>
            <td style={val}>Compra</td>
          </tr>
          <tr>
            <td style={cell}>Cliente:</td>
            <td style={val} colSpan={3}>{customerName}</td>
          </tr>
          <tr>
            <td style={cell}>Estado:</td>
            <td style={{ ...val, textTransform: "uppercase" }} colSpan={3}>{operation.status}</td>
          </tr>
          <tr>
            <td style={cell}>Placas:</td>
            <td style={val} colSpan={3}>{plate}</td>
          </tr>
          <tr>
            <td style={cell}>Conductor:</td>
            <td style={val} colSpan={3}>{conductor}</td>
          </tr>
          <tr>
            <td style={cell}>Fecha:</td>
            <td colSpan={3}>{fmtDate(operation.created_at)}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ borderTop: "1px dashed #999", margin: "6px 0" }} />

      {/* ── Items header ──────────────────────── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "60px 1fr 40px 50px 60px",
        gap: "0 4px",
        fontSize: "0.7rem",
        fontWeight: 700,
        borderBottom: "1px solid #ccc",
        paddingBottom: 3,
        marginBottom: 4,
      }}>
        <span>Cant(kg)</span>
        <span>Producto</span>
        <span>Merma</span>
        <span>Prec</span>
        <span style={{ textAlign: "right" }}>Importe</span>
      </div>

      {/* ── Items ─────────────────────────────── */}
      {items.map((item) => {
        const matName = materialById?.get(item.material)?.name ?? item.material;
        const net = parseFloat(item.net_weight_kg) || 0;
        const merma = parseFloat(item.merma_kg) || 0;
        const price = parseFloat(item.unit_price) || 0;
        const amount = parseFloat(item.amount) || 0;
        const gross = parseFloat(item.gross_weight_kg) || 0;
        const tare = parseFloat(item.tare_weight_kg) || 0;
        return (
          <div key={item.id} style={{ marginBottom: 6 }}>
            <div style={{
              display: "grid",
              gridTemplateColumns: "60px 1fr 40px 50px 60px",
              gap: "0 4px",
              fontSize: "0.75rem",
            }}>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{Math.round(net)}</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{matName}</span>
              <span>{Math.round(merma)}</span>
              <span>{price.toFixed(1)}</span>
              <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{Math.round(amount)}</span>
            </div>
            {(gross > 0 || tare > 0) && (
              <div style={{ fontSize: "0.7rem", color: "#555", paddingLeft: 4 }}>
                Peso1: {Math.round(gross)}  Peso2: {Math.round(tare)}
              </div>
            )}
          </div>
        );
      })}

      {items.length === 0 && (
        <div style={{ textAlign: "center", color: "#777", padding: "12px 0", fontSize: "0.75rem" }}>
          Sin partidas
        </div>
      )}

      {/* ── Totals ────────────────────────────── */}
      <div style={{ borderTop: "1px dashed #999", marginTop: 8, paddingTop: 8 }}>
        <div style={{ fontSize: "0.82rem", fontWeight: 600 }}>
          {Math.round(totalWeight)} kg total
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: "0.95rem", marginTop: 2 }}>
          <span>Importe Total:</span>
          <span>{fmtMXN(totalAmount)}</span>
        </div>
      </div>

      {/* ── Footer ────────────────────────────── */}
      <div style={{ borderTop: "1px dashed #999", marginTop: 10, paddingTop: 8, textAlign: "center", fontSize: "0.7rem", color: "#555" }}>
        <div>1. EFECTIVO</div>
        <div style={{ marginTop: 6, letterSpacing: "0.05em" }}>* * * COPIA SIN VALOR * * *</div>
      </div>
    </div>
  );
}
