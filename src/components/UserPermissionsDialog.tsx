import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Shield, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { RESTRICTED_PAGES, type PageKey } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const PAGE_LABELS: Record<PageKey, { en: string; ar: string }> = {
  dashboard: { en: "Dashboard", ar: "الرئيسية" },
  billing: { en: "Billing", ar: "الفواتير" },
  analytics: { en: "Analytics", ar: "التحليلات" },
};

export function UserPermissionsDialog({
  userId,
  userName,
  isSuperAdmin,
}: {
  userId: string;
  userName: string;
  isSuperAdmin: boolean;
}) {
  const { t, lang } = useI18n();
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [state, setState] = useState<Record<PageKey, boolean>>({
    dashboard: false,
    billing: false,
    analytics: false,
  });

  const { data: perms, isLoading } = useQuery({
    queryKey: ["user_page_permissions", userId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_page_permissions")
        .select("page, allowed")
        .eq("user_id", userId);
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!perms) return;
    const next: Record<PageKey, boolean> = { dashboard: false, billing: false, analytics: false };
    perms.forEach((p) => {
      if (RESTRICTED_PAGES.includes(p.page as PageKey)) {
        next[p.page as PageKey] = p.allowed;
      }
    });
    setState(next);
  }, [perms]);

  const save = useMutation({
    mutationFn: async () => {
      const rows = RESTRICTED_PAGES.map((page) => ({
        user_id: userId,
        page,
        allowed: state[page],
      }));
      const { error } = await supabase
        .from("user_page_permissions")
        .upsert(rows, { onConflict: "user_id,page" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(lang === "ar" ? "تم حفظ الصلاحيات" : "Permissions saved");
      void qc.invalidateQueries({ queryKey: ["user_page_permissions", userId] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Shield className="me-2 h-4 w-4" /> {t("perm.button")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("perm.dialogTitle")}</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">{userName}</p>

        {isSuperAdmin ? (
          <p className="rounded-lg border bg-muted/40 p-3 text-sm">
            {lang === "ar"
              ? "المسؤول الأعلى لديه وصول كامل لجميع الصفحات."
              : "Super admins always have full access to every page."}
          </p>
        ) : isLoading ? (
          <div className="flex justify-center p-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3">
            {RESTRICTED_PAGES.map((page) => (
              <div key={page} className="flex items-center justify-between rounded-lg border p-3">
                <Label htmlFor={`perm-${userId}-${page}`} className="text-sm font-medium">
                  {PAGE_LABELS[page][lang]}
                </Label>
                <Switch
                  id={`perm-${userId}-${page}`}
                  checked={state[page]}
                  onCheckedChange={(v) => setState((s) => ({ ...s, [page]: v }))}
                />
              </div>
            ))}

            <Button className="w-full" disabled={save.isPending} onClick={() => save.mutate()}>
              {t("common.save")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
