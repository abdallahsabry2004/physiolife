import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, Plus, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — Physio Life EMR" },
      {
        name: "description",
        content:
          "Clinic reminders, patient follow-ups and unpaid invoice alerts for the Physio Life physical therapy team.",
      },
      { property: "og:title", content: "Notifications — Physio Life EMR" },
      {
        property: "og:description",
        content: "Reminders, follow-ups and outstanding payment alerts.",
      },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [dueAt, setDueAt] = useState("");

  const { data: items = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const { data: alerts } = useQuery({
    queryKey: ["notification-alerts"],
    queryFn: async () => {
      const cutoff = new Date(Date.now() - 21 * 86400000).toISOString().slice(0, 10);
      const [{ data: unpaid }, { data: patients }, { data: sessions }] = await Promise.all([
        supabase
          .from("invoices")
          .select("id, invoice_number, total, patient_id, patients(full_name)")
          .neq("status", "paid")
          .limit(20),
        supabase.from("patients").select("id, full_name").eq("status", "active").limit(200),
        supabase
          .from("treatment_sessions")
          .select("patient_id, session_date")
          .gte("session_date", cutoff),
      ]);
      const recent = new Set((sessions ?? []).map((s) => s.patient_id));
      return {
        unpaid: unpaid ?? [],
        stale: (patients ?? []).filter((p) => !recent.has(p.id)).slice(0, 20),
      };
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("notifications").insert({
        user_id: auth.user?.id ?? null,
        type: "reminder",
        title,
        body: body || null,
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setTitle("");
      setBody("");
      setDueAt("");
      toast.success(t("notif.create"));
      void qc.invalidateQueries({ queryKey: ["notifications"] });
      void qc.invalidateQueries({ queryKey: ["notifications-unread"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markRead = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notifications"] });
      void qc.invalidateQueries({ queryKey: ["notifications-unread"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unreadIds = items.filter((i) => !i.is_read).map((i) => i.id);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Bell className="h-5 w-5 text-primary" /> {t("notif.title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("notif.subtitle")}</p>
        </div>
        {unreadIds.length > 0 && (
          <Button variant="secondary" onClick={() => markRead.mutate(unreadIds)}>
            <CheckCheck className="mr-2 h-4 w-4" /> {t("notif.markAll")}
          </Button>
        )}
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("notif.new")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="n-title">{t("notif.titleField")}</Label>
            <Input
              id="n-title"
              value={title}
              maxLength={140}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="n-due">{t("notif.dueField")}</Label>
            <Input
              id="n-due"
              type="date"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-3">
            <Label htmlFor="n-body">{t("notif.bodyField")}</Label>
            <Textarea
              id="n-body"
              rows={2}
              maxLength={600}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
          <div>
            <Button disabled={!title.trim() || create.isPending} onClick={() => create.mutate()}>
              <Plus className="mr-2 h-4 w-4" /> {t("notif.create")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {items.length === 0 && <p className="text-sm text-muted-foreground">{t("notif.empty")}</p>}
        {items.map((n) => (
          <div
            key={n.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3 text-sm"
          >
            <div className="min-w-0">
              <p className="flex items-center gap-2 font-medium">
                {n.title}
                {!n.is_read && <Badge variant="default">{t("notif.unread")}</Badge>}
              </p>
              {n.body && <p className="text-xs text-muted-foreground">{n.body}</p>}
              <p className="text-xs text-muted-foreground">
                {n.due_at
                  ? new Date(n.due_at).toLocaleDateString("en-GB")
                  : new Date(n.created_at).toLocaleString("en-GB")}
              </p>
            </div>
            {!n.is_read && (
              <Button size="sm" variant="ghost" onClick={() => markRead.mutate([n.id])}>
                {t("notif.markRead")}
              </Button>
            )}
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-destructive" /> {t("notif.auto")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {(alerts?.unpaid ?? []).map((i) => (
            <div key={i.id} className="flex justify-between rounded-lg border p-3">
              <span>
                {(i.patients as { full_name: string } | null)?.full_name ?? "—"} ·{" "}
                {i.invoice_number}
              </span>
              <span className="text-muted-foreground">
                {t("notif.unpaid")} · {Number(i.total).toFixed(2)}
              </span>
            </div>
          ))}
          {(alerts?.stale ?? []).map((p) => (
            <div key={p.id} className="flex justify-between rounded-lg border p-3">
              <span>{p.full_name}</span>
              <span className="text-muted-foreground">{t("notif.inactive")}</span>
            </div>
          ))}
          {(alerts?.unpaid.length ?? 0) === 0 && (alerts?.stale.length ?? 0) === 0 && (
            <p className="text-muted-foreground">{t("notif.empty")}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
