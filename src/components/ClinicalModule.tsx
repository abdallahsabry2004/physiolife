import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type Props = {
  patientId: string;
  module: "history" | "exam" | "diagnosis" | "session";
  sessionId?: string;
  title: string;
  description?: string;
};

/**
 * Renders only the clinical items the therapist actually added, with the
 * seeded catalog offered as suggestions plus free-text custom items.
 */
export function ClinicalModule({ patientId, module, sessionId, title, description }: Props) {
  const { canEditClinical, user } = useAuth();
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
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: recordsKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveValue = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: string }) => {
      const { error } = await supabase.from("patient_records").update({ value }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved");
      void qc.invalidateQueries({ queryKey: recordsKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("patient_records").delete().eq("id", id);
      if (error) throw error;
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
    // remember the new item as a future suggestion too
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
              <Input
                value={custom}
                placeholder="Or type a custom item…"
                onChange={(e) => setCustom(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void addCustom();
                }}
              />
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
          <Card key={r.id} className="print:border-none print:shadow-none print:bg-transparent">
            <CardContent className="pt-6 print:p-0 print:py-1">
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
              <Textarea
                rows={2}
                disabled={!canEditClinical}
                value={drafts[r.id] ?? r.value ?? ""}
                className="print:text-sm print:leading-relaxed"
                onChange={(e) => setDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
                onBlur={(e) => {
                  if ((r.value ?? "") !== e.target.value) {
                    saveValue.mutate({ id: r.id, value: e.target.value });
                  }
                }}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
