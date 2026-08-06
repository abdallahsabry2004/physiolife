import { Link, useLocation } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  Users,
  Dumbbell,
  Receipt,
  ShieldCheck,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import logo from "@/assets/physio-life-logo.png";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/patients", label: "Patients", icon: Users },
  { to: "/exercises", label: "Exercise Library", icon: Dumbbell },
  { to: "/billing", label: "Billing", icon: Receipt },
  { to: "/admin", label: "Administration", icon: ShieldCheck, adminOnly: true },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { fullName, roles, isAdmin, signOut } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const items = nav.filter((item) => !("adminOnly" in item && item.adminOnly) || isAdmin);

  return (
    <div className="flex min-h-screen bg-background">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-4">
          <img src={logo} alt="Physio Life" width={40} height={40} className="h-10 w-10" />
          <div>
            <p className="text-sm font-bold leading-tight">Physio Life</p>
            <p className="text-xs text-sidebar-foreground/60">PT Center EMR</p>
          </div>
          <button className="ml-auto lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
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
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-4">
          <p className="truncate text-sm font-medium">{fullName || "Staff member"}</p>
          <p className="mb-3 text-xs capitalize text-sidebar-foreground/60">
            {roles.map((r) => r.replace("_", " ")).join(", ") || "no role assigned"}
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            onClick={() => {
              void signOut();
            }}
          >
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col lg:ml-64">
        <header className="flex items-center gap-3 border-b bg-card px-4 py-3 lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <img src={logo} alt="" width={28} height={28} className="h-7 w-7" />
          <span className="font-semibold">Physio Life</span>
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
