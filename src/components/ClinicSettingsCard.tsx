import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";

export function ClinicSettingsCard() {
  const qc = useQueryClient();
  const { lang } = useI18n();
  const [newDept, setNewDept] = useState("");
  const [newPartnerName, setNewPartnerName] = useState("");
  const [newPartnerType, setNewPartnerType] = useState("percentage");
  const [newPartnerValue, setNewPartnerValue] = useState("");
  const [newPartnerNum, setNewPartnerNum] = useState("");
  const [newPartnerDenom, setNewPartnerDenom] = useState("");

  const { data: settings } = useQuery({
    queryKey: ["clinic_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clinic_settings").select("*");
      if (error) throw error;
      const parsed: Record<string, any> = {};
      data.forEach((d) => {
        parsed[d.key] = d.value;
      });
      return parsed;
    },
  });

  const { data: departments } = useQuery({
    queryKey: ["clinic_departments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clinic_departments")
        .select("*")
        .order("created_at");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: partnerships } = useQuery({
    queryKey: ["clinic_partnerships"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clinic_partnerships")
        .select("*")
        .order("created_at");
      if (error) throw error;
      return data || [];
    },
  });

  const toggleSetting = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: any }) => {
      const { error } = await supabase
        .from("clinic_settings")
        .upsert({ key, value }, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clinic_settings"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const addDept = useMutation({
    mutationFn: async () => {
      if (!newDept) return;
      const { error } = await supabase.from("clinic_departments").insert({ name: newDept });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewDept("");
      qc.invalidateQueries({ queryKey: ["clinic_departments"] });
      toast.success(lang === "ar" ? "تمت الإضافة بنجاح" : "Added successfully");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const delDept = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clinic_departments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clinic_departments"] });
      toast.success(lang === "ar" ? "تم الحذف بنجاح" : "Deleted successfully");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const addPartner = useMutation({
    mutationFn: async () => {
      if (!newPartnerName) return;
      const { error } = await supabase.from("clinic_partnerships").insert({
        name: newPartnerName,
        type: newPartnerType,
        value: newPartnerValue ? Number(newPartnerValue) : null,
        fraction_numerator: newPartnerNum ? Number(newPartnerNum) : null,
        fraction_denominator: newPartnerDenom ? Number(newPartnerDenom) : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewPartnerName("");
      setNewPartnerValue("");
      setNewPartnerNum("");
      setNewPartnerDenom("");
      qc.invalidateQueries({ queryKey: ["clinic_partnerships"] });
      toast.success(lang === "ar" ? "تمت الإضافة بنجاح" : "Added successfully");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const delPartner = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clinic_partnerships").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clinic_partnerships"] });
      toast.success(lang === "ar" ? "تم الحذف بنجاح" : "Deleted successfully");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deptsEnabled =
    settings?.departments_enabled === true || settings?.departments_enabled === "true";
  const partsEnabled =
    settings?.partnerships_enabled === true || settings?.partnerships_enabled === "true";

  return (
    <Card className="print:hidden mt-6">
      <CardHeader>
        <CardTitle>{lang === "ar" ? "إعدادات العيادة" : "Clinic Settings"}</CardTitle>
        <CardDescription>
          {lang === "ar"
            ? "تفعيل وإدارة الأقسام والشراكات"
            : "Enable and manage departments and partnerships"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Departments */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base font-semibold">
                {lang === "ar" ? "أقسام العيادة" : "Clinic Departments"}
              </Label>
              <p className="text-sm text-muted-foreground">
                {lang === "ar"
                  ? "تفعيل تقسيم الفواتير والحالات على أقسام (مثل: علاج طبيعي، عظام، أطفال)"
                  : "Enable dividing invoices and cases into departments"}
              </p>
            </div>
            <Switch
              checked={deptsEnabled}
              onCheckedChange={(c) =>
                toggleSetting.mutate({ key: "departments_enabled", value: c })
              }
            />
          </div>

          {deptsEnabled && (
            <div className="border rounded-lg p-4 space-y-4 bg-muted/20">
              <div className="flex items-center gap-2">
                <Input
                  placeholder={lang === "ar" ? "اسم القسم..." : "Department name..."}
                  value={newDept}
                  onChange={(e) => setNewDept(e.target.value)}
                />
                <Button
                  type="button"
                  onClick={() => addDept.mutate()}
                  disabled={addDept.isPending || !newDept}
                  size="sm"
                >
                  <Plus className="h-4 w-4 rtl:ml-2 ltr:mr-2 mr-2" />
                  {lang === "ar" ? "إضافة" : "Add"}
                </Button>
              </div>
              <div className="space-y-2">
                {departments?.map((d) => (
                  <div
                    key={d.id}
                    className="flex justify-between items-center bg-background border p-2 rounded"
                  >
                    <span>{d.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => delDept.mutate(d.id)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {departments?.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    {lang === "ar" ? "لا توجد أقسام مضافة بعد." : "No departments added yet."}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Partnerships */}
        <div className="space-y-4 pt-4 border-t">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base font-semibold">
                {lang === "ar" ? "الشراكات وحصص الأرباح" : "Partnerships & Revenue Sharing"}
              </Label>
              <p className="text-sm text-muted-foreground">
                {lang === "ar"
                  ? "تفعيل تقسيم الدخل اليومي على شركاء بنسب أو مبالغ ثابتة"
                  : "Enable splitting daily income among partners with percentage or fixed amounts"}
              </p>
            </div>
            <Switch
              checked={partsEnabled}
              onCheckedChange={(c) =>
                toggleSetting.mutate({ key: "partnerships_enabled", value: c })
              }
            />
          </div>

          {partsEnabled && (
            <div className="border rounded-lg p-4 space-y-4 bg-muted/20">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
                <div className="space-y-1">
                  <Label>{lang === "ar" ? "اسم الشريك / المصروف" : "Partner / Expense Name"}</Label>
                  <Input
                    value={newPartnerName}
                    onChange={(e) => setNewPartnerName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>{lang === "ar" ? "نوع الحصة" : "Share Type"}</Label>
                  <Select value={newPartnerType} onValueChange={setNewPartnerType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">
                        {lang === "ar" ? "نسبة مئوية (%)" : "Percentage (%)"}
                      </SelectItem>
                      <SelectItem value="fixed">
                        {lang === "ar" ? "مبلغ ثابت" : "Fixed Amount"}
                      </SelectItem>
                      <SelectItem value="fraction">
                        {lang === "ar" ? "كسر (مثل 1/3)" : "Fraction (e.g. 1/3)"}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {newPartnerType === "fraction" ? (
                  <div className="flex items-end gap-2 space-y-1">
                    <div className="flex-1">
                      <Label>{lang === "ar" ? "البسط" : "Numerator"}</Label>
                      <Input
                        type="number"
                        placeholder="1"
                        value={newPartnerNum}
                        onChange={(e) => setNewPartnerNum(e.target.value)}
                      />
                    </div>
                    <span className="mb-2">/</span>
                    <div className="flex-1">
                      <Label>{lang === "ar" ? "المقام" : "Denominator"}</Label>
                      <Input
                        type="number"
                        placeholder="3"
                        value={newPartnerDenom}
                        onChange={(e) => setNewPartnerDenom(e.target.value)}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Label>{lang === "ar" ? "القيمة" : "Value"}</Label>
                    <Input
                      type="number"
                      value={newPartnerValue}
                      onChange={(e) => setNewPartnerValue(e.target.value)}
                    />
                  </div>
                )}

                <Button
                  type="button"
                  onClick={() => addPartner.mutate()}
                  disabled={addPartner.isPending || !newPartnerName}
                  className="mb-0.5"
                >
                  <Plus className="h-4 w-4 rtl:ml-2 ltr:mr-2 mr-2" />
                  {lang === "ar" ? "إضافة" : "Add"}
                </Button>
              </div>

              <div className="space-y-2 mt-4">
                {partnerships?.map((p) => {
                  const staffSources: string[] = settings?.staff_financial_sources || [];
                  const isStaffSource = staffSources.includes(p.id);
                  return (
                    <div
                      key={p.id}
                      className="flex justify-between items-center bg-background border p-3 rounded"
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={isStaffSource}
                          onCheckedChange={(c) => {
                            const newSources = c
                              ? [...staffSources, p.id]
                              : staffSources.filter((id) => id !== p.id);
                            toggleSetting.mutate({
                              key: "staff_financial_sources",
                              value: newSources,
                            });
                          }}
                        />
                        <div>
                          <p className="font-medium">{p.name}</p>
                          <p className="text-sm text-muted-foreground flex items-center gap-2">
                            <span>
                              {p.type === "percentage" && `${p.value}%`}
                              {p.type === "fixed" && `${p.value} ${lang === "ar" ? "ج.م" : "EGP"}`}
                              {p.type === "fraction" &&
                                `${p.fraction_numerator} / ${p.fraction_denominator}`}
                            </span>
                            {isStaffSource && (
                              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                                {lang === "ar" ? "مصدر دخل الفريق" : "Staff Source"}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => delPartner.mutate(p.id)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
                {partnerships?.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    {lang === "ar" ? "لا توجد شراكات مضافة بعد." : "No partnerships added yet."}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
