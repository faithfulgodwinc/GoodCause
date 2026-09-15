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
  /** Step 1 of email OTP flow — request a 6-digit code */
  sendOtp: (email: string) => Promise<void>;
  /** Step 2 of email OTP flow — verify the code, optionally provide a name for new users */
  verifyOtp: (email: string, code: string, name?: string) => Promise<{ isNewUser: boolean }>;
  completeGoogleSession: (idToken: string) => Promise<{ isNewUser: boolean }>;
  completeAppleSession: (idToken: string, name?: string) => Promise<{ isNewUser: boolean }>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
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
        console.warn("RevenueCat identity error", e);
      }
    })();
  }, [user?.id]);

  /** Request a 6-digit OTP be sent to the email address. */
  const sendOtp = useCallback(async (email: string) => {
    await api("/auth/otp/send", {
      method: "POST",
      body: { email },
      auth: false,
    });
  }, []);

  /** Verify OTP code. Returns `{ isNewUser }`. Sets auth state on success. */
  const verifyOtp = useCallback(async (email: string, code: string, name?: string) => {
    const res = await api<{ token: string; user: User; is_new_user: boolean }>(
      "/auth/otp/verify",
      {
        method: "POST",
        body: { email, code, name: name?.trim() || undefined },
        auth: false,
      }
    );
    await setToken(res.token);
    setUser(res.user);
    track("login", { provider: "email_otp" });
    return { isNewUser: res.is_new_user };
  }, []);

  const completeGoogleSession = useCallback(async (idToken: string) => {
    const res = await api<{ token: string; user: User; is_new_user: boolean }>(
      "/auth/session",
      {
        method: "POST",
        body: { id_token: idToken },
        auth: false,
      }
    );
    await setToken(res.token);
    setUser(res.user);
    return { isNewUser: res.is_new_user ?? true };
  }, []);

  const completeAppleSession = useCallback(async (idToken: string, name?: string) => {
    const res = await api<{ token: string; user: User; is_new_user: boolean }>(
      "/auth/session/apple",
      {
        method: "POST",
        body: { id_token: idToken, name },
        auth: false,
      }
    );
    await setToken(res.token);
    setUser(res.user);
    return { isNewUser: res.is_new_user ?? true };
  }, []);

  const logout = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {}
    await setToken(null);
    setUser(null);
  }, []);

  const deleteAccount = useCallback(async () => {
    try {
      await api("/auth/account", { method: "DELETE" });
    } catch (e: any) {
      console.error("Account deletion API error:", e);
      throw e;
    } finally {
      await setToken(null);
      setUser(null);
    }
  }, []);

  const updateUser = useCallback((u: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...u } : prev));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user, loading,
        sendOtp, verifyOtp,
        completeGoogleSession, completeAppleSession,
        logout, deleteAccount, refresh: bootstrap, updateUser,
      }}
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
