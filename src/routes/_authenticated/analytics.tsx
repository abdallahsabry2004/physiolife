import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { title: "Clinic Analytics — Physio Life EMR" },
      {
        name: "description",
        content:
          "Physiotherapy clinic analytics: monthly sessions, revenue, new patients, attendance rates, pain reduction and therapist workload.",
      },
      { property: "og:title", content: "Clinic Analytics — Physio Life EMR" },
      {
        property: "og:description",
        content: "Trends for sessions, revenue, attendance and treatment outcomes.",
      },
    ],
  }),
  component: AnalyticsPage,
});

const monthKey = (iso: string) => iso.slice(0, 7);

function groupCount(rows: { date: string }[]) {
  const map = new Map<string, number>();
  rows.forEach((r) => map.set(monthKey(r.date), (map.get(monthKey(r.date)) ?? 0) + 1));
  return [...map.entries()].sort().map(([month, value]) => ({ month, value }));
}

const PIE_COLORS = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-4)"];

function AnalyticsPage() {
  const { t } = useI18n();

  const { data } = useQuery({
    queryKey: ["analytics"],
    queryFn: async () => {
      const [{ data: sessions }, { data: payments }, { data: patients }, { data: profiles }] =
        await Promise.all([
          supabase
            .from("treatment_sessions")
            .select("session_date, attendance, pain_before, pain_after, therapist_id")
            .order("session_date")
            .limit(1000),
          supabase.from("payments").select("paid_on, amount, is_refund").limit(1000),
          supabase.from("patients").select("created_at").limit(1000),
          supabase.from("profiles").select("id, full_name"),
        ]);

      const sess = sessions ?? [];
      const sessionsByMonth = groupCount(sess.map((s) => ({ date: s.session_date })));
      const patientsByMonth = groupCount((patients ?? []).map((p) => ({ date: p.created_at })));

      const revMap = new Map<string, number>();
      (payments ?? []).forEach((p) => {
        const k = monthKey(p.paid_on);
        const amt = Number(p.amount) * (p.is_refund ? -1 : 1);
        revMap.set(k, (revMap.get(k) ?? 0) + amt);
      });
      const revenueByMonth = [...revMap.entries()].sort().map(([month, value]) => ({ month, value }));

      const attMap = new Map<string, number>();
      sess.forEach((s) => attMap.set(s.attendance, (attMap.get(s.attendance) ?? 0) + 1));
      const attendance = [...attMap.entries()].map(([name, value]) => ({ name, value }));

      const painPairs = sess.filter((s) => s.pain_before != null && s.pain_after != null);
      const painDrop =
        painPairs.length > 0
          ? painPairs.reduce((a, s) => a + ((s.pain_before ?? 0) - (s.pain_after ?? 0)), 0) /
            painPairs.length
          : 0;

      const nameOf = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
      const thMap = new Map<string, number>();
      sess.forEach((s) => {
        const name = s.therapist_id ? nameOf.get(s.therapist_id) ?? "—" : "—";
        thMap.set(name, (thMap.get(name) ?? 0) + 1);
      });
      const perTherapist = [...thMap.entries()].map(([name, value]) => ({ name, value }));

      return { sessionsByMonth, patientsByMonth, revenueByMonth, attendance, painDrop, perTherapist };
    },
  });

  const empty = <p className="text-sm text-muted-foreground">{t("an.noData")}</p>;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t("an.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("an.subtitle")}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingDown className="h-4 w-4 text-primary" /> {t("an.painDrop")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-primary">
            {(data?.painDrop ?? 0).toFixed(1)}{" "}
            <span className="text-sm font-medium text-muted-foreground">{t("an.points")}</span>
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("an.sessionsMonth")}</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {(data?.sessionsByMonth.length ?? 0) === 0 ? (
              empty
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.sessionsByMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="month" fontSize={11} />
                  <YAxis fontSize={11} allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" stroke="var(--color-primary)" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("an.revenueMonth")}</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {(data?.revenueByMonth.length ?? 0) === 0 ? (
              empty
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.revenueByMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="month" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="value" fill="var(--color-chart-2)" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("an.newPatients")}</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {(data?.patientsByMonth.length ?? 0) === 0 ? (
              empty
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.patientsByMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="month" fontSize={11} />
                  <YAxis fontSize={11} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="var(--color-chart-1)" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("an.attendance")}</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {(data?.attendance.length ?? 0) === 0 ? (
              empty
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data?.attendance} dataKey="value" nameKey="name" outerRadius={80} label>
                    {(data?.attendance ?? []).map((entry, i) => (
                      <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t("an.perTherapist")}</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {(data?.perTherapist.length ?? 0) === 0 ? (
              empty
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.perTherapist} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis type="number" fontSize={11} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={120} fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="value" fill="var(--color-chart-3)" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
