import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const SUGGESTED_METRICS = [
  "Knee flexion ROM",
  "Knee extension ROM",
  "Shoulder abduction ROM",
  "Quadriceps MMT",
  "Grip strength",
  "Pain (VAS)",
  "Limb girth",
  "Walking distance",
  "Balance (seconds)",
];

export function PatientMeasurements({ patientId }: { patientId: string }) {
  const { user, canEditClinical } = useAuth();
  const qc = useQueryClient();

  const [metric, setMetric] = useState("");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [selected, setSelected] = useState<string | null>(null);

  const { data: rows = [] } = useQuery({
    queryKey: ["measurements", patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("measurements")
        .select("id, metric, value, unit, measured_on")
        .eq("patient_id", patientId)
        .order("measured_on");
      if (error) throw error;
      return data;
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!metric.trim()) throw new Error("Name the measurement first");
      if (!value.trim()) throw new Error("Enter a value");
      const { error } = await supabase.from("measurements").insert({
        patient_id: patientId,
        metric: metric.trim(),
        value: Number(value),
        unit: unit.trim() || null,
        measured_on: date,
        recorded_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setValue("");
      toast.success("Measurement recorded");
      void qc.invalidateQueries({ queryKey: ["measurements", patientId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("measurements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["measurements", patientId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const metrics = Array.from(new Set(rows.map((r) => r.metric)));
  const activeMetric = selected && metrics.includes(selected) ? selected : metrics[0] ?? null;
  const series = rows
    .filter((r) => r.metric === activeMetric)
    .map((r) => ({ name: r.measured_on, value: Number(r.value) }));

  return (
    <div className="space-y-6">
      {canEditClinical && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Record an objective measurement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2 md:col-span-2">
                <Label>Measurement</Label>
                <Input
                  value={metric}
                  onChange={(e) => setMetric(e.target.value)}
                  placeholder="e.g. Knee flexion ROM"
                />
              </div>
              <div className="space-y-2">
                <Label>Value</Label>
                <Input
                  type="number"
                  step="any"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Unit</Label>
                <Input
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="deg / kg / cm"
                />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="flex items-end md:col-span-3">
                <Button onClick={() => add.mutate()} disabled={add.isPending}>
                  <Plus className="mr-2 h-4 w-4" /> Save measurement
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_METRICS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMetric(m)}
                  className="rounded-full border bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground transition hover:bg-secondary/70"
                >
                  {m}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {metrics.length === 0 ? (
        <p className="text-sm text-muted-foreground">No measurements recorded yet.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {metrics.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setSelected(m)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  activeMetric === m
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{activeMetric} over time</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series}>
                  <XAxis dataKey="name" stroke="currentColor" fontSize={12} />
                  <YAxis stroke="currentColor" fontSize={12} />
                  <ChartTooltip />
                  <Line type="monotone" dataKey="value" stroke="var(--chart-1)" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">All entries</CardTitle>
            </CardHeader>
            <CardContent className="divide-y">
              {rows
                .slice()
                .reverse()
                .map((r) => (
                  <div key={r.id} className="flex items-center justify-between py-2 text-sm">
                    <span>
                      {r.measured_on} · {r.metric}
                    </span>
                    <span className="flex items-center gap-3 font-medium">
                      {Number(r.value)} {r.unit ?? ""}
                      {canEditClinical && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => remove.mutate(r.id)}
                          aria-label="Delete measurement"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </span>
                  </div>
                ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
