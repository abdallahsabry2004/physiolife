import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "super_admin" | "therapist" | "receptionist" | "assistant";

type AuthState = {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  fullName: string;
  loading: boolean;
  isAdmin: boolean;
  canEditClinical: boolean;
  canBill: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

const SESSION_TIMEOUT_MS = 60 * 60 * 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async (nextSession: Session | null) => {
      if (!active) return;
      setSession(nextSession);
      if (!nextSession?.user) {
        setRoles([]);
        setFullName("");
        setLoading(false);
        return;
      }
      const [{ data: roleRows }, { data: profile }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", nextSession.user.id),
        supabase.from("profiles").select("full_name").eq("id", nextSession.user.id).maybeSingle(),
      ]);
      if (!active) return;
      setRoles((roleRows ?? []).map((r) => r.role as AppRole));
      setFullName(profile?.full_name || nextSession.user.email || "");
      setLoading(false);
    };

    supabase.auth.getSession().then(({ data }) => load(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      void load(next);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Session timeout on inactivity
  useEffect(() => {
    if (!session) return;
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        void supabase.auth.signOut();
      }, SESSION_TIMEOUT_MS);
    };
    const events = ["mousedown", "keydown", "touchstart", "scroll"] as const;
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [session]);

  const value: AuthState = {
    user: session?.user ?? null,
    session,
    roles,
    fullName,
    loading,
    isAdmin: roles.includes("super_admin"),
    canEditClinical: roles.includes("super_admin") || roles.includes("therapist"),
    canBill:
      roles.includes("super_admin") ||
      roles.includes("receptionist") ||
      roles.includes("therapist"),
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
