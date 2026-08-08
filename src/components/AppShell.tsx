import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Users,
  Dumbbell,
  Receipt,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  Bell,
  BarChart3,
  Languages,
} from "lucide-react";
import logo from "@/assets/physio-life-logo.png";
import { useAuth } from "@/lib/auth";
import { useI18n, type TKey } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/dashboard", label: "nav.dashboard", icon: LayoutDashboard },
  { to: "/patients", label: "nav.patients", icon: Users },
  { to: "/exercises", label: "nav.exercises", icon: Dumbbell },
  { to: "/billing", label: "nav.billing", icon: Receipt },
  { to: "/notifications", label: "nav.notifications", icon: Bell },
  { to: "/analytics", label: "nav.analytics", icon: BarChart3 },
  { to: "/admin", label: "nav.admin", icon: ShieldCheck, adminOnly: true },
] as const satisfies readonly { to: string; label: TKey; icon: unknown; adminOnly?: boolean }[];

export function AppShell({ children }: { children: ReactNode }) {
  const { fullName, roles, isAdmin, signOut } = useAuth();
  const { t, lang, setLang } = useI18n();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const items = nav.filter((item) => !("adminOnly" in item && item.adminOnly) || isAdmin);

  const { data: unread = 0 } = useQuery({
    queryKey: ["notifications-unread"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("is_read", false);
      if (error) throw error;
      return count ?? 0;
    },
  });

  return (
    <div className="flex min-h-screen bg-background">
      <aside
        className={cn(
          "fixed inset-y-0 z-40 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform ltr:left-0 rtl:right-0",
          // بنتحكم في ظهور وإخفاء الشريط في الموبايل
          open ? "translate-x-0" : "ltr:-translate-x-full rtl:translate-x-full",
          // السطر ده هو الحل: بنجبر الشريط يظهر دايماً على الكمبيوتر بأولوية أعلى
          "ltr:lg:translate-x-0 rtl:lg:translate-x-0"
        )}
      >
        <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-4">
          <img src={logo} alt="Physio Life" width={40} height={40} className="h-10 w-10" />
          <div>
            <p className="text-sm font-bold leading-tight">{t("app.name")}</p>
            <p className="text-xs text-sidebar-foreground/60">{t("app.tagline")}</p>
          </div>
          <button className="ms-auto lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {items.map((item) => {
            const active = location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                <item.icon className="h-4.5 w-4.5" />
                {t(item.label)}
                {item.to === "/notifications" && unread > 0 && (
                  <span className="ms-auto rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                    {unread}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-4">
          <p className="truncate text-sm font-medium">{fullName || t("shell.staff")}</p>
          <p className="mb-3 text-xs capitalize text-sidebar-foreground/60">
            {roles.map((r) => r.replace("_", " ")).join(", ") || t("shell.noRole")}
          </p>
          <div className="space-y-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-sidebar-foreground/80 hover:text-sidebar-accent-foreground"
              onClick={() => setLang(lang === "ar" ? "en" : "ar")}
            >
              <Languages className="me-2 h-4 w-4" /> {t("shell.language")}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="w-full"
              onClick={async () => {
                // ننتظر لحد ما عملية تسجيل الخروج تكتمل
                await signOut();
                // ننقل المستخدم لصفحة تسجيل الدخول الرئيسية
                navigate({ to: "/" });
              }}
            >
              <LogOut className="me-2 h-4 w-4" /> {t("shell.signOut")}
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col ltr:lg:ml-64 rtl:lg:mr-64">
        <header className="flex items-center gap-3 border-b bg-card px-4 py-3 lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <img src={logo} alt="" width={28} height={28} className="h-7 w-7" />
          <span className="font-semibold">{t("app.name")}</span>
          <Link to="/notifications" className="ms-auto relative" aria-label={t("nav.notifications")}>
            <Bell className="h-5 w-5" />
            {unread > 0 && (
              <span className="absolute -end-1.5 -top-1.5 rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                {unread}
              </span>
            )}
          </Link>
        </header>
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-30 bg-foreground/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}
    </div>
  );
}
