import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { User } from "../types";
import { setAuthToken, getAuthToken } from "../api/client";

type AuthState = {
  token: string | null;
  user: User | null;
  setSession: (token: string | null, user: User | null) => void;
  clearSession: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(getAuthToken());
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem("acopio360_user");
    return stored ? (JSON.parse(stored) as User) : null;
  });

  const value = useMemo<AuthState>(
    () => ({
      token,
      user,
      setSession: (newToken, newUser) => {
        setToken(newToken);
        setUser(newUser);
        setAuthToken(newToken);
        localStorage.setItem("acopio360_user", JSON.stringify(newUser));
      },
      clearSession: () => {
        setToken(null);
        setUser(null);
        setAuthToken(null);
        localStorage.removeItem("acopio360_user");
      },
    }),
    [token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
