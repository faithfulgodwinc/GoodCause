import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { Platform } from "react-native";
import Purchases from "react-native-purchases";
import { api, setToken, loadToken, track } from "@/src/lib/api";
import { rcEnabled } from "@/src/lib/revenuecat";

export type User = {
  id: string;
  email: string;
  name: string;
  picture?: string | null;
  role: "donor" | "admin";
  bio?: string | null;
  verified_organizer?: boolean;
};

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  completeGoogleSession: (idToken: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  updateUser: (u: Partial<User>) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const rcRef = useRef<string | null>(null);

  const bootstrap = useCallback(async () => {
    const token = await loadToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await api<User>("/auth/me");
      setUser(me);
    } catch {
      await setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  // Bind RevenueCat identity to the backend user id on every auth change.
  useEffect(() => {
    if (!rcEnabled) return;
    (async () => {
      try {
        if (user?.id && rcRef.current !== user.id) {
          await Purchases.logIn(user.id);
          rcRef.current = user.id;
        } else if (!user?.id && rcRef.current) {
          await Purchases.logOut();
          rcRef.current = null;
        }
      } catch (e) {
        // surfaced where purchases are attempted; never crash auth
        console.warn("RevenueCat identity error", e);
      }
    })();
  }, [user?.id]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      body: { email, password },
      auth: false,
    });
    await setToken(res.token);
    setUser(res.user);
    track("login");
  }, []);

  const register = useCallback(async (email: string, password: string, name: string) => {
    const res = await api<{ token: string; user: User }>("/auth/register", {
      method: "POST",
      body: { email, password, name },
      auth: false,
    });
    await setToken(res.token);
    setUser(res.user);
    track("signup");
  }, []);

  const completeGoogleSession = useCallback(async (idToken: string) => {
    const res = await api<{ token: string; user: User }>("/auth/session", {
      method: "POST",
      body: { id_token: idToken },
      auth: false,
    });
    await setToken(res.token);
    setUser(res.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {}
    await setToken(null);
    setUser(null);
  }, []);

  const updateUser = useCallback((u: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...u } : prev));
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, completeGoogleSession, logout, refresh: bootstrap, updateUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
