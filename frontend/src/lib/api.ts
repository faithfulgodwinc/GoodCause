// Central API client. Talks ONLY to the FastAPI backend at EXPO_PUBLIC_BACKEND_URL + /api.
import { Platform } from "react-native";
import Constants from "expo-constants";
import { storage } from "@/src/utils/storage";

export function getBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_BACKEND_URL;

  // On Web:
  if (Platform.OS === "web") {
    // If an explicit remote production URL is configured (e.g. https://api.goodcause.ng), use it
    if (envUrl && envUrl.startsWith("https://")) {
      return `${envUrl.replace(/\/+$/, "")}/api`;
    }
    // Otherwise use current browser host (e.g. localhost or 127.0.0.1) on port 8000
    if (typeof window !== "undefined" && window.location) {
      const host = window.location.hostname || "localhost";
      return `http://${host}:8000/api`;
    }
    return "http://localhost:8000/api";
  }

  // On Native Mobile:
  if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1")) {
    return `${envUrl.replace(/\/+$/, "")}/api`;
  }
  // If host is localhost or missing, resolve dynamically from expo hostUri
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(":")[0];
    if (ip) return `http://${ip}:8000/api`;
  }
  return `${(envUrl || "http://127.0.0.1:8000").replace(/\/+$/, "")}/api`;
}

export const TOKEN_KEY = "gc_auth_token";

let memToken: string | null = null;

export async function setToken(token: string | null) {
  memToken = token;
  if (token) await storage.secureSet(TOKEN_KEY, token);
  else await storage.secureRemove(TOKEN_KEY);
}

export async function loadToken(): Promise<string | null> {
  if (memToken) return memToken;
  const t = await storage.secureGet(TOKEN_KEY, "");
  memToken = t || null;
  return memToken;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type Options = { method?: string; body?: any; auth?: boolean; headers?: Record<string, string> };

export async function api<T = any>(path: string, opts: Options = {}): Promise<T> {
  const { method = "GET", body, auth = true } = opts;
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(opts.headers || {}) };
  if (auth) {
    const token = await loadToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  const base = getBaseUrl();
  let resp: Response;
  try {
    resp = await fetch(`${base}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new ApiError(0, "You appear to be offline. Please check your connection.");
  }

  if (resp.status === 204) return undefined as T;

  let data: any = null;
  const text = await resp.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!resp.ok) {
    const detail =
      (data && (data.detail || data.message)) ||
      (resp.status >= 500 ? "Something went wrong on our side. Please try again." : "Request failed.");
    if (resp.status === 401 && auth) {
      await setToken(null);
    }
    throw new ApiError(resp.status, typeof detail === "string" ? detail : "Request failed.");
  }
  return data as T;
}

export function track(event: string, props?: Record<string, any>) {
  // fire-and-forget
  api("/analytics/track", { method: "POST", body: { event, props }, auth: true }).catch(() => {});
}

export async function uploadMedia(uri: string, name: string, type: string): Promise<{ url: string; kind: string }> {
  const token = await loadToken();
  const form = new FormData();
  if (Platform.OS === "web") {
    const blob = await (await fetch(uri)).blob();
    form.append("file", blob, name);
  } else {
    form.append("file", { uri, name, type } as any);
  }
  const base = getBaseUrl();
  const resp = await fetch(`${base}/upload`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });
  const text = await resp.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  if (!resp.ok) {
    throw new ApiError(resp.status, (data && data.detail) || "We couldn't upload that file. Please try again.");
  }
  return { url: `${base.replace(/\/api$/, '')}${data.url}`, kind: data.kind };
}
