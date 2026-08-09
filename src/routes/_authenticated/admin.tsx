import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HardDrive, Plus, UserX, UserCheck, Search, Printer } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { getDriveQuota } from "@/lib/drive.functions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import logo from "@/assets/physio-life-logo.png";

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
  const { isAdmin, fullName } = useAuth();
  const qc = useQueryClient();
  
  const [driveEmail, setDriveEmail] = useState("");
  const [driveFolderId, setDriveFolderId] = useState("");
  
  // State خاص بالبحث في سجلات النظام
  const [logSearch, setLogSearch] = useState("");

  const { data: driveQuota, isLoading: isQuotaLoading } = useQuery({
    queryKey: ["drive_quota"],
    queryFn: async () => {
      const res = await getDriveQuota();
      return res;
    },
  });

  const formatGB = (bytes: number) => (bytes / (1024 * 1024 * 1024)).toFixed(2);
  const usagePercentage = driveQuota?.limit 
    ? Math.min((driveQuota.usage / driveQuota.limit) * 100, 100) 
    : 0;

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
        .limit(100); // زيادة العدد ليكون البحث أكثر فعالية
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

  const toggleUser = useMutation({
    mutationFn: async ({ userId, activate }: { userId: string; activate: boolean }) => {
      const { error: pErr } = await supabase.from("profiles").update({ is_active: activate }).eq("id", userId);
      if (pErr) throw pErr;
      
      if (!activate) {
        const { error: rErr } = await supabase.from("user_roles").delete().eq("user_id", userId);
        if (rErr) throw rErr;
      }
    },
    onSuccess: () => {
      toast.success("User status updated");
      void qc.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addAccount = useMutation({
    mutationFn: async () => {
      if (!driveEmail.trim() || !driveFolderId.trim()) {
        throw new Error("Please provide both email and folder ID.");
      }
      
      const { error } = await supabase
        .from("storage_accounts")
        .insert({ 
          email: driveEmail.trim(), 
          root_folder_id: driveFolderId.trim(),
          label: "Additional storage" 
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Storage account added successfully!");
      setDriveEmail("");
      setDriveFolderId("");
      void qc.invalidateQueries({ queryKey: ["storage_accounts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // تصفية السجلات بناءً على شريط البحث
  const filteredLogs = logs.filter((l) => {
    const searchLower = logSearch.toLowerCase();
    const dateStr = new Date(l.created_at).toLocaleString().toLowerCase();
    return (
      l.action.toLowerCase().includes(searchLower) ||
      (l.entity?.toLowerCase() || "").includes(searchLower) ||
      dateStr.includes(searchLower)
    );
  });

  if (!isAdmin) {
    return (
      <p className="text-sm text-muted-foreground">
        Administration is limited to super admins.
      </p>
    );
  }

  return (
    <div className="space-y-6 print:space-y-0">
      <header className="print:hidden">
        <h1 className="text-2xl font-bold tracking-tight">Administration</h1>
        <p className="text-sm text-muted-foreground">
          Staff permissions, file storage capacity and activity audit trail.
        </p>
      </header>

      <Card className="print:hidden">
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
                <div className="flex items-center gap-2">
                  <p className="font-medium">{s.full_name || s.email}</p>
                  {!s.is_active && <Badge variant="destructive">Inactive</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">{s.email}</p>
              </div>
              <div className="flex items-center gap-2">
                {s.roles.map((r) => (
                  <Badge key={r} variant="secondary" className="capitalize">
                    {r.replace("_", " ")}
                  </Badge>
                ))}
                
                {s.is_active ? (
                  <>
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
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => {
                        if (confirm("Are you sure you want to deactivate this user? They will lose access to the system.")) {
                          toggleUser.mutate({ userId: s.id, activate: false });
                        }
                      }}
                      title="Deactivate User"
                    >
                      <UserX className="h-4 w-4 text-destructive" />
                    </Button>
                  </>
                ) : (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => toggleUser.mutate({ userId: s.id, activate: true })}
                  >
                    <UserCheck className="mr-2 h-4 w-4" /> Restore Access
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="print:hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <HardDrive className="h-4 w-4" /> Google Drive Storage
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2 rounded-lg border bg-secondary/30 p-4">
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-semibold">Primary Connected Account Quota</span>
              {isQuotaLoading ? (
                <span className="text-xs text-muted-foreground">Loading...</span>
              ) : driveQuota?.limit ? (
                <span className="text-xs font-medium">
                  {formatGB(driveQuota.usage)} GB used of {formatGB(driveQuota.limit)} GB
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">Unlimited / Unknown</span>
              )}
            </div>
            <Progress value={usagePercentage} className="h-2 w-full" />
            <p className="text-[10px] text-muted-foreground mt-1">
              This shows the actual storage limits of the Google Drive account currently authorized via the system API.
            </p>
          </div>

          <div className="space-y-4 rounded-lg border p-4 bg-card">
            <h3 className="text-sm font-semibold">How to add additional storage?</h3>
            <ol className="text-xs text-muted-foreground list-decimal list-inside space-y-1.5 mb-4">
              <li>Create a new folder in the new Gmail account you want to use.</li>
              <li>Share this folder with your primary clinic email (<code>physiolife.ptcenter@gmail.com</code>) as an <strong>Editor</strong>.</li>
              <li>Copy the <strong>Folder ID</strong> from the URL (the part after <code>folders/</code>).</li>
              <li>Paste the email and the Folder ID below to link it.</li>
            </ol>
            
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] items-end">
              <div className="space-y-1.5">
                <Label>Gmail Address</Label>
                <Input
                  placeholder="extra.storage@gmail.com"
                  value={driveEmail}
                  onChange={(e) => setDriveEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Folder ID</Label>
                <Input
                  placeholder="1A2b3C4d5E6f7G8h9I0j..."
                  value={driveFolderId}
                  onChange={(e) => setDriveFolderId(e.target.value)}
                />
              </div>
              <Button 
                onClick={() => addAccount.mutate()} 
                disabled={!driveEmail || !driveFolderId || addAccount.isPending}
              >
                {addAccount.isPending ? "Adding..." : <><Plus className="mr-2 h-4 w-4" /> Add account</>}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {accounts.map((a) => (
              <div key={a.id} className="flex justify-between items-center rounded-lg border p-3 text-sm">
                <div>
                  <p className="font-medium">{a.email}</p>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">Folder: {a.root_folder_id || "N/A"}</p>
                </div>
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

      <div className="print:hidden">
        <ClinicalFieldCatalog />
      </div>

      <Card className="print:border-none print:shadow-none print:bg-transparent">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:hidden">
          <CardTitle className="text-base">Audit Log & System Activity</CardTitle>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-initial">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                className="pl-8 sm:w-64"
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
              />
            </div>
            <Button variant="outline" onClick={() => window.print()} className="shrink-0">
              <Printer className="mr-2 h-4 w-4" /> Print Logs
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-2 print:p-0">
          {/* ترويسة الطباعة الاحترافية الخاصة بالسجلات */}
          <div className="hidden print:block border-b-2 border-primary pb-6 mb-6">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-4">
                <img src={logo} alt="Physio Life" className="h-16 w-16" />
                <div>
                  <h2 className="text-2xl font-bold text-primary">Physio Life PT Center</h2>
                  <p className="text-sm font-medium text-gray-600">Physical Therapy & Rehabilitation</p>
                </div>
              </div>
              <div className="text-right text-xs text-gray-500 space-y-1">
                <p><span className="font-semibold text-gray-700">Print Date:</span> {new Date().toLocaleString('en-GB')}</p>
                <p><span className="font-semibold text-gray-700">Printed by:</span> {fullName}</p>
              </div>
            </div>
            <h3 className="text-xl font-bold text-gray-800 mt-6 text-center">System Activity & Audit Log Report</h3>
          </div>

          {filteredLogs.length === 0 && (
            <p className="text-sm text-muted-foreground print:text-black">No recorded activity matches your search.</p>
          )}
          {filteredLogs.map((l) => (
            <div key={l.id} className="flex justify-between rounded-lg border p-3 text-sm print:border-b print:border-x-0 print:border-t-0 print:rounded-none print:px-0">
              <span className="font-medium print:text-black">{l.action}</span>
              <span className="text-muted-foreground print:text-black">
                {l.entity} · {new Date(l.created_at).toLocaleString('en-GB')}
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
