import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "super_admin" | "therapist" | "receptionist" | "assistant" | "trainee";

// إعادة تعريف المفاتيح اللازمة لعمل AppShell و PageGuard
export type PageKey = "dashboard" | "billing" | "analytics" | "financial_reports" | "exercise_library" | "questionnaires_library";
export const RESTRICTED_PAGES: PageKey[] = [
  "dashboard",
  "billing",
  "analytics",
  "financial_reports",
  "exercise_library",
  "questionnaires_library",
];

export type UserPermissions = {
  can_access_billing: boolean;
  can_access_dashboard: boolean;
  can_access_analytics: boolean;
  can_access_financial_reports: boolean;
  can_access_exercise_library: boolean;
  can_access_questionnaires_library: boolean;
};

type AuthState = {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  permissions: UserPermissions | null;
  fullName: string;
  loading: boolean;
  isAdmin: boolean;
  isTrainee: boolean;
  canEditClinical: boolean;
  canEditRegistration: boolean;
  canBill: boolean;
  canViewPage: (page: PageKey) => boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

const SESSION_TIMEOUT_MS = 60 * 60 * 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async (nextSession: Session | null) => {
      if (!active) return;
      setSession(nextSession);
      if (!nextSession?.user) {
        setRoles([]);
        setPermissions(null);
        setFullName("");
        setLoading(false);
        return;
      }

      const [
        { data: roleRows },
        { data: profile },
        { data: perms }, // هترجع Array مش Object واحد
      ] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", nextSession.user.id),
        supabase.from("profiles").select("full_name").eq("id", nextSession.user.id).maybeSingle(),
        // تم تصحيح اسم الجدول وإزالة maybeSingle
        supabase
          .from("user_page_permissions")
          .select("page, allowed")
          .eq("user_id", nextSession.user.id),
      ]);

      if (!active) return;

      const isTraineeFromPerms = (perms ?? []).some((p) => p.page === "trainee" && p.allowed);
      let userRoles = (roleRows ?? []).map((r) => r.role as AppRole);
      if (isTraineeFromPerms) {
        userRoles = ["trainee"];
      }
      setRoles(userRoles);
      setFullName(profile?.full_name || nextSession.user.email || "");

      // تحويل الـ Array اللي راجعة من الداتا بيز لـ Object يطابق الـ UserPermissions type
      if (perms && perms.length > 0) {
        const permissionsObj = {
          can_access_billing: false,
          can_access_dashboard: false,
          can_access_analytics: false,
          can_access_financial_reports: false,
          can_access_exercise_library: false,
          can_access_questionnaires_library: false,
        };
        perms.forEach((p) => {
          if (p.page === "dashboard") permissionsObj.can_access_dashboard = p.allowed;
          if (p.page === "billing") permissionsObj.can_access_billing = p.allowed;
          if (p.page === "analytics") permissionsObj.can_access_analytics = p.allowed;
          if (p.page === "financial_reports") permissionsObj.can_access_financial_reports = p.allowed;
          if (p.page === "exercise_library") permissionsObj.can_access_exercise_library = p.allowed;
          if (p.page === "questionnaires_library") permissionsObj.can_access_questionnaires_library = p.allowed;
        });
        setPermissions(permissionsObj);
      } else {
        setPermissions({
          can_access_billing: false,
          can_access_dashboard: false,
          can_access_analytics: false,
          can_access_financial_reports: false,
          can_access_exercise_library: false,
          can_access_questionnaires_library: false,
        });
      }

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

  useEffect(() => {
    if (!session) return;

    const isSessionOnly = sessionStorage.getItem("pl-session-only") === "1";
    if (!isSessionOnly) return;

    let timer: ReturnType<typeof setTimeout>;

    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        void supabase.auth.signOut();
        sessionStorage.removeItem("pl-session-only");
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

  const isSuperAdmin = roles.includes("super_admin");
  const isTrainee = roles.includes("trainee");

  const value: AuthState = {
    user: session?.user ?? null,
    session,
    roles,
    permissions,
    fullName,
    loading,
    isAdmin: isSuperAdmin,
    isTrainee,
    canEditClinical: !isTrainee && (isSuperAdmin || roles.includes("therapist")),
    canEditRegistration: !isTrainee && (isSuperAdmin || roles.includes("therapist") || roles.includes("receptionist")),
    canBill: !isTrainee && (isSuperAdmin || (permissions?.can_access_billing ?? false)),
    canViewPage: (page: PageKey) => {
      // المتدرب لا يملك وصول لأي من هذه الصفحات
      if (isTrainee) return false;
      // الـ Super Admin له صلاحية مطلقة، وباقي الموظفين حسب الإعدادات
      if (isSuperAdmin) return true;
      if (page === "dashboard") return permissions?.can_access_dashboard ?? false;
      if (page === "billing") return permissions?.can_access_billing ?? false;
      if (page === "analytics") return permissions?.can_access_analytics ?? false;
      if (page === "financial_reports") return permissions?.can_access_financial_reports ?? false;
      if (page === "exercise_library") return permissions?.can_access_exercise_library ?? false;
      if (page === "questionnaires_library") return permissions?.can_access_questionnaires_library ?? false;
      return false;
    },
    signOut: async () => {
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
