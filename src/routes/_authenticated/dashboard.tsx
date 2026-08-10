import { PageGuard } from "@/components/PageGuard";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  UserPlus,
  CalendarCheck,
  Wallet,
  AlertCircle,
  Activity,
  UserCheck,
  UserMinus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Clinic Dashboard — Physio Life EMR" },
      {
        name: "description",
        content:
          "Today's patients, active caseload, revenue, pending payments and recent clinical activity at Physio Life PT center.",
      },
      { property: "og:title", content: "Clinic Dashboard — Physio Life EMR" },
      {
        property: "og:description",
        content: "Live overview of patients, sessions, revenue and follow-ups.",
      },
    ],
  }),
  component: () => (
    <PageGuard page="dashboard">
      <Dashboard />
    </PageGuard>
  ),
});

const todayISO = () => new Date().toISOString().slice(0, 10);
const monthStartISO = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};

function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const count = (q: { count: number | null }) => q.count ?? 0;
      const [total, active, discharged, newThisMonth, todaySessions, payments, unpaid] =
        await Promise.all([
          supabase.from("patients").select("id", { count: "exact", head: true }),
          supabase.from("patients").select("id", { count: "exact", head: true }).eq("status", "active"),
          supabase
            .from("patients")
            .select("id", { count: "exact", head: true })
            .eq("status", "discharged"),
          supabase
            .from("patients")
            .select("id", { count: "exact", head: true })
            .gte("created_at", monthStartISO()),
          supabase
            .from("treatment_sessions")
            .select("id", { count: "exact", head: true })
            .eq("session_date", todayISO()),
          supabase.from("payments").select("amount"),
          supabase.from("invoices").select("total").neq("status", "paid"),
        ]);
      return {
        total: count(total),
        active: count(active),
        discharged: count(discharged),
        newThisMonth: count(newThisMonth),
        todaySessions: count(todaySessions),
        revenue: (payments.data ?? []).reduce((s, p) => s + Number(p.amount), 0),
        outstanding: (unpaid.data ?? []).reduce((s, i) => s + Number(i.total), 0),
      };
    },
  });

  const { data: recent = [] } = useQuery({
    queryKey: ["recent-sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treatment_sessions")
        .select("id, session_date, session_number, attendance, patient_id, patients(full_name)")
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data;
    },
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, title, body, type, due_at")
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data;
    },
  });

  const cards = [
    { label: "Today's sessions", value: stats?.todaySessions ?? 0, icon: CalendarCheck },
    { label: "Total patients", value: stats?.total ?? 0, icon: Users },
    { label: "Active patients", value: stats?.active ?? 0, icon: UserCheck },
    { label: "Discharged", value: stats?.discharged ?? 0, icon: UserMinus },
    { label: "New this month", value: stats?.newThisMonth ?? 0, icon: UserPlus },
    { label: "Revenue collected", value: `EGP ${stats?.revenue ?? 0}`, icon: Wallet },
    { label: "Outstanding balance", value: `EGP ${stats?.outstanding ?? 0}`, icon: AlertCircle },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Clinic dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Live snapshot of the Physio Life caseload, sessions and finances.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                <c.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs uppercase tracking-wide text-muted-foreground">
                  {c.label}
                </p>
                <p className="truncate text-xl font-semibold">{c.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4" /> Recent treatment sessions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recent.length === 0 && (
              <p className="text-sm text-muted-foreground">No sessions recorded yet.</p>
            )}
            {recent.map((s) => (
              <Link
                key={s.id}
                to="/patients/$id"
                params={{ id: s.patient_id }}
                className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm transition hover:bg-secondary"
              >
                <span className="font-medium">
                  {(s.patients as { full_name: string } | null)?.full_name ?? "Patient"}
                </span>
                <span className="flex items-center gap-3 text-muted-foreground">
                  Session #{s.session_number}
                  <Badge variant="secondary">{s.attendance}</Badge>
                  {s.session_date}
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {notifications.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Follow-ups, pending payments and reassessment reminders appear here.
              </p>
            )}
            {notifications.map((n) => (
              <div key={n.id} className="rounded-lg border p-3">
                <p className="text-sm font-medium">{n.title}</p>
                {n.body && <p className="text-xs text-muted-foreground">{n.body}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
