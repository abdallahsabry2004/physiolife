import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HardDrive, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Administration — Physio Life EMR" },
      {
        name: "description",
        content:
          "Super admin tools: staff roles and permissions, audit logs, clinic settings and extra Google Drive storage accounts.",
      },
      { property: "og:title", content: "Administration — Physio Life EMR" },
      { property: "og:description", content: "Manage staff, permissions, storage and audit logs." },
    ],
  }),
  component: AdminPage,
});

const ROLES: AppRole[] = ["super_admin", "therapist", "receptionist", "assistant"];

function AdminPage() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [driveEmail, setDriveEmail] = useState("");

  const { data: staff = [] } = useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const [{ data: profiles, error }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email, is_active"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (error) throw error;
      return (profiles ?? []).map((p) => ({
        ...p,
        roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role as AppRole),
      }));
    },
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["storage_accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("storage_accounts")
        .select("*")
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["audit_logs"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, action, entity, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  const setRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", userId);
      if (delErr) throw delErr;
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Role updated");
      void qc.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addAccount = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("storage_accounts")
        .insert({ email: driveEmail, label: "Additional storage" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Storage account added");
      setDriveEmail("");
      void qc.invalidateQueries({ queryKey: ["storage_accounts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isAdmin) {
    return (
      <p className="text-sm text-muted-foreground">
        Administration is limited to super admins.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Administration</h1>
        <p className="text-sm text-muted-foreground">
          Staff permissions, file storage capacity and activity audit trail.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Staff & permissions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {staff.map((s) => (
            <div
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm"
            >
              <div>
                <p className="font-medium">{s.full_name || s.email}</p>
                <p className="text-xs text-muted-foreground">{s.email}</p>
              </div>
              <div className="flex items-center gap-2">
                {s.roles.map((r) => (
                  <Badge key={r} variant="secondary" className="capitalize">
                    {r.replace("_", " ")}
                  </Badge>
                ))}
                <Select onValueChange={(v) => setRole.mutate({ userId: s.id, role: v as AppRole })}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="Change role" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r} className="capitalize">
                        {r.replace("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <HardDrive className="h-4 w-4" /> Google Drive storage accounts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Add an extra Google account to expand file storage capacity. New uploads move to the
            next active account when the primary one fills up.
          </p>
          <div className="flex flex-wrap gap-2">
            <Input
              className="max-w-sm"
              placeholder="extra.storage@gmail.com"
              value={driveEmail}
              onChange={(e) => setDriveEmail(e.target.value)}
            />
            <Button onClick={() => addAccount.mutate()} disabled={!driveEmail}>
              <Plus className="mr-2 h-4 w-4" /> Add account
            </Button>
          </div>
          <div className="space-y-2">
            {accounts.map((a) => (
              <div key={a.id} className="flex justify-between rounded-lg border p-3 text-sm">
                <span>{a.email}</span>
                <Badge variant={a.is_primary ? "default" : "secondary"}>
                  {a.is_primary ? "primary" : a.is_active ? "active" : "inactive"}
                </Badge>
              </div>
            ))}
            {accounts.length === 0 && (
              <p className="text-sm text-muted-foreground">No additional accounts yet.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <ClinicalFieldCatalog />

      <Card>

        <CardHeader>
          <CardTitle className="text-base">Audit log</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {logs.length === 0 && (
            <p className="text-sm text-muted-foreground">No recorded activity yet.</p>
          )}
          {logs.map((l) => (
            <div key={l.id} className="flex justify-between rounded-lg border p-3 text-sm">
              <span>{l.action}</span>
              <span className="text-muted-foreground">
                {l.entity} · {new Date(l.created_at).toLocaleString()}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

const MODULES = ["history", "examination", "diagnosis", "plan"] as const;

function ClinicalFieldCatalog() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [module, setModule] = useState<string>("history");
  const [label, setLabel] = useState("");
  const [labelAr, setLabelAr] = useState("");

  const { data: fields = [] } = useQuery({
    queryKey: ["clinical_fields_admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clinical_fields")
        .select("id, module, label, label_ar, sort_order")
        .order("module")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("clinical_fields").insert({
        module,
        label: label.trim(),
        label_ar: labelAr.trim() || null,
        field_type: "text",
        is_suggestion: true,
        sort_order: 999,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setLabel("");
      setLabelAr("");
      toast.success("Suggestion added");
      void qc.invalidateQueries({ queryKey: ["clinical_fields_admin"] });
      void qc.invalidateQueries({ queryKey: ["clinical_fields"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clinical_fields").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["clinical_fields_admin"] });
      void qc.invalidateQueries({ queryKey: ["clinical_fields"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("cf.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t("cf.subtitle")}</p>
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label>{t("cf.module")}</Label>
            <Select value={module} onValueChange={setModule}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODULES.map((m) => (
                  <SelectItem key={m} value={m} className="capitalize">
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cf-label">{t("cf.label")}</Label>
            <Input id="cf-label" value={label} maxLength={120} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cf-label-ar">{t("cf.labelAr")}</Label>
            <Input
              id="cf-label-ar"
              value={labelAr}
              maxLength={120}
              onChange={(e) => setLabelAr(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button className="w-full" disabled={!label.trim() || add.isPending} onClick={() => add.mutate()}>
              <Plus className="mr-2 h-4 w-4" /> {t("cf.add")}
            </Button>
          </div>
        </div>
        <div className="max-h-72 space-y-2 overflow-y-auto">
          {fields.map((f) => (
            <div key={f.id} className="flex items-center justify-between rounded-lg border p-2.5 text-sm">
              <span>
                <Badge variant="secondary" className="me-2 capitalize">
                  {f.module}
                </Badge>
                {f.label}
                {f.label_ar ? <span className="text-muted-foreground"> · {f.label_ar}</span> : null}
              </span>
              <Button size="sm" variant="ghost" onClick={() => remove.mutate(f.id)}>
                {t("cf.delete")}
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
