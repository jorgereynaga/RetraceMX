import { FormEvent, useState } from "react";
import { api } from "../api/resources";
import { useAuth } from "../context/AuthContext";

function RecyclingHero() {
  return (
    <svg viewBox="0 0 720 720" role="img" aria-label="ReTrace MX illustration" className="login-hero-graphic">
      <defs>
        <linearGradient id="heroBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0d1f1a" />
          <stop offset="100%" stopColor="#102b22" />
        </linearGradient>
        <linearGradient id="heroAccent" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#22c55e" />
          <stop offset="100%" stopColor="#84cc16" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="720" height="720" rx="48" fill="url(#heroBg)" />
      <circle cx="360" cy="330" r="170" fill="rgba(255,255,255,0.03)" />
      <circle cx="360" cy="330" r="122" fill="rgba(34,197,94,0.08)" />
      <path
        d="M272 254c28-44 76-70 128-70 83 0 152 63 160 145"
        fill="none"
        stroke="url(#heroAccent)"
        strokeWidth="16"
        strokeLinecap="round"
      />
      <path d="M566 320l-8-52-42 30z" fill="#84cc16" />
      <path
        d="M448 410c-28 44-76 70-128 70-83 0-152-63-160-145"
        fill="none"
        stroke="url(#heroAccent)"
        strokeWidth="16"
        strokeLinecap="round"
      />
      <path d="M154 392l8 52 42-30z" fill="#22c55e" />
      <g transform="translate(222 226)">
        <rect x="0" y="128" width="276" height="110" rx="22" fill="#163324" stroke="#24583b" strokeWidth="2" />
        <rect x="26" y="92" width="224" height="50" rx="16" fill="#1f4430" stroke="#2f6b49" strokeWidth="2" />
        <rect x="40" y="56" width="84" height="36" rx="12" fill="#0f1f18" stroke="#2f6b49" strokeWidth="2" />
        <rect x="132" y="56" width="98" height="36" rx="12" fill="#0f1f18" stroke="#2f6b49" strokeWidth="2" />
        <rect x="54" y="154" width="168" height="28" rx="10" fill="#0f1f18" />
        <circle cx="78" cy="236" r="28" fill="#0f1f18" stroke="#24583b" strokeWidth="8" />
        <circle cx="196" cy="236" r="28" fill="#0f1f18" stroke="#24583b" strokeWidth="8" />
        <rect x="248" y="108" width="32" height="82" rx="10" fill="#0f1f18" stroke="#24583b" strokeWidth="2" />
      </g>
      <g opacity="0.95">
        <circle cx="200" cy="548" r="40" fill="rgba(34,197,94,0.12)" />
        <circle cx="520" cy="548" r="40" fill="rgba(132,204,22,0.12)" />
        <path d="M170 548h60" stroke="#86efac" strokeWidth="8" strokeLinecap="round" />
        <path d="M490 548h60" stroke="#d9f99d" strokeWidth="8" strokeLinecap="round" />
      </g>
      <text x="54" y="642" fill="#dcfce7" fontSize="28" fontWeight="700" letterSpacing="2">
        ReTrace MX
      </text>
      <text x="54" y="672" fill="#86efac" fontSize="18">
        Control operativo para reciclaje, compras, caja y logística
      </text>
    </svg>
  );
}

export function LoginPage() {
  const { setSession } = useAuth();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("Admin1234!");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const result = await api.login(username, password);
      setSession(result.token, result.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de acceso");
    }
  }

  return (
    <div className="login-screen">
      <section className="login-hero">
        <div className="login-hero-copy">
          <span className="login-kicker">ReTrace MX</span>
          <h1>Control operativo para reciclaje, compras, caja y logística</h1>
          <p>
            Centraliza compras, inventarios, ventas, rutas y caja en una sola plataforma pensada para centros de
            acopio y comercialización de materiales.
          </p>
          <ul className="login-benefits">
            <li>Acceso rápido a operación diaria</li>
            <li>Seguimiento de pagos, tickets y movimientos</li>
            <li>Visibilidad por rol para cada área</li>
          </ul>
        </div>
        <RecyclingHero />
      </section>

      <form className="login-card" onSubmit={onSubmit}>
        <div className="login-card-header">
          <h2>Iniciar sesión</h2>
          <p>Ingresa con tu usuario para continuar.</p>
        </div>

        <label>
          Usuario
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
        </label>

        <label>
          Contraseña
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>

        <div className="login-demo-box">
          <strong>Credenciales demo</strong>
          <span>Admin / Superadmin: admin · Admin1234!</span>
          <span>Resto de roles: usuario rol · Demo1234!</span>
        </div>

        {error ? <div className="error-banner">{error}</div> : null}
        <button type="submit">Entrar</button>
      </form>
    </div>
  );
}
