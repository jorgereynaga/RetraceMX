import { useState } from "react";
import { Page } from "../components/Page";

export function WeighingPage() {
  const [gross, setGross] = useState("1000");
  const [tare, setTare] = useState("200");
  const net = Number(gross) - Number(tare);

  return (
    <Page title="Captura de pesaje">
      <div className="grid form-grid">
        <label>
          Lectura bruta
          <input value={gross} onChange={(e) => setGross(e.target.value)} />
        </label>
        <label>
          Tara
          <input value={tare} onChange={(e) => setTare(e.target.value)} />
        </label>
      </div>
      <div className="metric-panel">
        <span>Peso neto simulado</span>
        <strong>{net}</strong>
      </div>
      <p className="muted">La integración real con básculas vive en el backend desacoplado.</p>
    </Page>
  );
}

