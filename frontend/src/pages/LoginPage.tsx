import { FormEvent, useState } from "react";
import { api } from "../api/resources";
import { useAuth } from "../context/AuthContext";

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
      <form className="login-card" onSubmit={onSubmit}>
        <h1>Acopio360</h1>
        <p>Acceso operativo a compras, pesaje y caja</p>
        <label>
          Usuario
          <input value={username} onChange={(e) => setUsername(e.target.value)} />
        </label>
        <label>
          Contraseña
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error ? <div className="error-banner">{error}</div> : null}
        <button type="submit">Entrar</button>
      </form>
    </div>
  );
}

