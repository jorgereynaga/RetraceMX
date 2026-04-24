const API_BASE = import.meta.env.VITE_API_URL ?? "/api";

export function getAuthToken() {
  return localStorage.getItem("acopio360_token");
}

export function setAuthToken(token: string | null) {
  if (token) {
    localStorage.setItem("acopio360_token", token);
  } else {
    localStorage.removeItem("acopio360_token");
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
  if (!isFormData) {
    headers.set("Content-Type", "application/json");
  }
  const token = getAuthToken();
  if (token) {
    headers.set("Authorization", `Token ${token}`);
  }
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Request failed");
  }
  if (response.status === 204) {
    return undefined as T;
  }
  const text = await response.text();
  if (!text) {
    return undefined as T;
  }
  return JSON.parse(text) as T;
}

async function requestList<T>(path: string): Promise<T[]> {
  const payload = await request<T[] | { results?: T[] }>(path);
  if (Array.isArray(payload)) {
    return payload;
  }
  return payload.results ?? [];
}

export function apiGet<T>(path: string) {
  return request<T>(path);
}

export function apiList<T>(path: string) {
  return requestList<T>(path);
}

export function apiPost<T>(path: string, body: unknown) {
  return request<T>(path, { method: "POST", body: JSON.stringify(body) });
}

export function apiPut<T>(path: string, body: unknown) {
  return request<T>(path, { method: "PUT", body: JSON.stringify(body) });
}

export function apiPatch<T>(path: string, body: unknown) {
  return request<T>(path, { method: "PATCH", body: JSON.stringify(body) });
}

export function apiDelete<T>(path: string) {
  return request<T>(path, { method: "DELETE" });
}

export function apiPostFormData<T>(path: string, body: FormData) {
  return request<T>(path, {
    method: "POST",
    body,
    headers: {},
  });
}
