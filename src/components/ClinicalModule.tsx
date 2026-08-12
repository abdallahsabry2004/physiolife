import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { logActivityAsync } from "@/lib/logger"; 
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { MedicalAutocomplete } from "@/components/ui/MedicalAutocomplete";

type Props = {
  patientId: string;
  module: "history" | "exam" | "diagnosis" | "session";
  sessionId?: string;
  title: string;
  description?: string;
};

export function ClinicalModule({ patientId, module, sessionId, title, description }: Props) {
  const { canEditClinical, user, fullName } = useAuth();
  const qc = useQueryClient();
  const [custom, setCustom] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const recordsKey = ["records", patientId, module, sessionId ?? null];

  const { data: fields = [] } = useQuery({
    queryKey: ["clinical_fields", module],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clinical_fields")
        .select("id, section, label, field_type")
        .eq("module", module)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: records = [] } = useQuery({
    queryKey: recordsKey,
    queryFn: async () => {
      let q = supabase
        .from("patient_records")
        .select("id, label, value, sort_order")
        .eq("patient_id", patientId)
        .eq("module", module)
        .order("sort_order");
      q = sessionId ? q.eq("session_id", sessionId) : q.is("session_id", null);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const usedLabels = useMemo(() => new Set(records.map((r) => r.label)), [records]);
  const suggestions = fields.filter((f) => !usedLabels.has(f.label));

  const addItem = useMutation({
    mutationFn: async (label: string) => {
      const { error } = await supabase.from("patient_records").insert({
        patient_id: patientId,
        session_id: sessionId ?? null,
        module,
        label,
        value: "",
        sort_order: records.length,
        recorded_by: user?.id ?? null,
      });
      if (error) throw error;
      
      logActivityAsync({
        user_id: user?.id,
        user_name: fullName,
        action: "ADD_CLINICAL_FIELD",
        entity: `Patient Record (${module})`,
        details: { patient_id: patientId, session_id: sessionId, label }
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: recordsKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveValue = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: string }) => {
      const oldRecord = records.find((r) => r.id === id);
      
      const { error } = await supabase.from("patient_records").update({ value }).eq("id", id);
      if (error) throw error;

      logActivityAsync({
        user_id: user?.id,
        user_name: fullName,
        action: "UPDATE_CLINICAL_NOTES",
        entity: `Patient Record (${module})`,
        details: { 
          patient_id: patientId, 
          label: oldRecord?.label, 
          old_value: oldRecord?.value || "(empty)", 
          new_value: value 
        }
      });
    },
    onSuccess: () => {
      toast.success("Saved");
      void qc.invalidateQueries({ queryKey: recordsKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      const oldRecord = records.find((r) => r.id === id);
      const { error } = await supabase.from("patient_records").delete().eq("id", id);
      if (error) throw error;

      logActivityAsync({
        user_id: user?.id,
        user_name: fullName,
        action: "DELETE_CLINICAL_FIELD",
        entity: `Patient Record (${module})`,
        details: { 
          patient_id: patientId, 
          label: oldRecord?.label, 
          deleted_value: oldRecord?.value 
        }
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: recordsKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addCustom = async () => {
    const label = custom.trim();
    if (!label) return;
    setCustom("");
    
    await supabase.from("clinical_fields").insert({
      module,
      section: "Custom",
      label,
      field_type: "textarea",
      is_suggestion: true,
      sort_order: 999,
      created_by: user?.id ?? null,
    });
    void qc.invalidateQueries({ queryKey: ["clinical_fields", module] });
    addItem.mutate(label);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>

      {canEditClinical && (
        <Card className="border-dashed print:hidden">
          <CardContent className="space-y-4 pt-6">
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Add an item
              </Label>
              <div className="mt-2 flex max-h-44 flex-wrap gap-2 overflow-y-auto">
                {suggestions.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => addItem.mutate(f.label)}
                    className="rounded-full border bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground transition hover:bg-primary hover:text-primary-foreground"
                  >
                    + {f.label}
                  </button>
                ))}
                {suggestions.length === 0 && (
                  <p className="text-sm text-muted-foreground">All suggestions added.</p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                 <MedicalAutocomplete
                  value={custom}
                  onChange={(val) => setCustom(val)}
                  placeholder="Or type a custom item…"
                 />
              </div>
              <Button onClick={() => void addCustom()}>
                <Plus className="mr-1 h-4 w-4" /> Add
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {records.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nothing recorded yet — added items will appear here.
          </p>
        )}
        {records.map((r) => (
          <Card key={r.id} className="print:border-none print:shadow-none print:bg-transparent overflow-visible">
            <CardContent className="pt-6 print:p-0 print:py-1 overflow-visible">
              <div className="mb-2 flex items-center justify-between gap-2">
                <Badge variant="secondary" className="print:bg-transparent print:border print:border-gray-300 print:text-black">{r.label}</Badge>
                {canEditClinical && (
                  <button
                    onClick={() => removeItem.mutate(r.id)}
                    className="text-muted-foreground transition hover:text-destructive print:hidden"
                    aria-label={`Remove ${r.label}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              {!canEditClinical ? (
                <div className="text-sm p-3 border rounded-md min-h-[60px] bg-transparent print:border-none print:p-0 whitespace-pre-wrap break-words">
                  {r.value || "—"}
                </div>
              ) : (
                <>
                  <div 
                    className="print:hidden"
                    onBlur={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                         const currentValue = drafts[r.id] ?? r.value ?? "";
                         if ((r.value ?? "") !== currentValue) {
                           saveValue.mutate({ id: r.id, value: currentValue });
                         }
                      }
                    }}
                  >
                    <MedicalAutocomplete
                      value={drafts[r.id] ?? r.value ?? ""}
                      onChange={(val) => setDrafts((d) => ({ ...d, [r.id]: val }))}
                      placeholder={`Enter ${r.label.toLowerCase()}...`}
                    />
                  </div>
                  <div className="hidden print:block text-sm p-0 border-none whitespace-pre-wrap break-words text-black">
                    {drafts[r.id] ?? r.value ?? "—"}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
