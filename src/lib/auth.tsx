import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "super_admin" | "therapist" | "receptionist" | "assistant";

export type PageKey = "dashboard" | "billing" | "analytics";
export const RESTRICTED_PAGES: PageKey[] = ["dashboard", "billing", "analytics"];

type AuthState = {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  fullName: string;
  loading: boolean;
  isAdmin: boolean;
  canEditClinical: boolean;
  canBill: boolean;
  canViewPage: (page: PageKey) => boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

// مدة الجلسة المؤقتة محددة بـ 60 دقيقة (تُطبق فقط إذا لم يختر المستخدم Remember me)
const SESSION_TIMEOUT_MS = 60 * 60 * 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(true);
  const [deniedPages, setDeniedPages] = useState<PageKey[]>([]);

  // دالة تحميل بيانات الجلسة والمستخدم
  useEffect(() => {
    let active = true;

    const load = async (nextSession: Session | null) => {
      if (!active) return;
      setSession(nextSession);
      if (!nextSession?.user) {
        setRoles([]);
        setFullName("");
        setDeniedPages([]);
        setLoading(false);
        return;
      }
      const [{ data: roleRows }, { data: profile }, { data: perms }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", nextSession.user.id),
        supabase.from("profiles").select("full_name").eq("id", nextSession.user.id).maybeSingle(),
        supabase
          .from("user_page_permissions")
          .select("page, allowed")
          .eq("user_id", nextSession.user.id),
      ]);
      if (!active) return;
      setRoles((roleRows ?? []).map((r) => r.role as AppRole));
      setFullName(profile?.full_name || nextSession.user.email || "");
      setDeniedPages(
        (perms ?? []).filter((p) => !p.allowed).map((p) => p.page as PageKey),
      );
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

  // مؤقت إنهاء الجلسة عند عدم النشاط (Session timeout on inactivity)
  useEffect(() => {
    if (!session) return;
    
    // التحقق مما إذا كان المستخدم قد قام بإلغاء "Remember me" وقت تسجيل الدخول
    const isSessionOnly = sessionStorage.getItem("pl-session-only") === "1";
    
    // إذا قام المستخدم بتفعيل "Remember me"، يتم إنهاء هذا الـ Effect ولن يعمل المؤقت
    if (!isSessionOnly) return;

    let timer: ReturnType<typeof setTimeout>;
    
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        // تسجيل الخروج وتنظيف المتغيرات المؤقتة
        void supabase.auth.signOut();
        sessionStorage.removeItem("pl-session-only");
      }, SESSION_TIMEOUT_MS);
    };

    // مراقبة نشاط المستخدم لإعادة ضبط العداد
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
      // تنظيف الجلسة المؤقتة عند تسجيل الخروج يدوياً
      sessionStorage.removeItem("pl-session-only");
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
