import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Printer } from "lucide-react";
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
import { ClinicalModule } from "@/components/ClinicalModule";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/patients/$id")({
  head: () => ({
    meta: [
      { title: "Patient record — Physio Life EMR" },
      {
        name: "description",
        content:
          "Complete physiotherapy record: history, examination, diagnosis, treatment sessions, files and progress graphs.",
      },
      { property: "og:title", content: "Patient record — Physio Life EMR" },
      { property: "og:description", content: "Full patient treatment journey in one place." },
    ],
  }),
  component: PatientDetail,
});

const MARK_TYPES = [
  "Pain",
  "Swelling",
  "Scar",
  "Bruise",
  "Weakness",
  "Spasm",
  "Trigger Point",
  "Numbness",
  "Radiating Pain",
];

function PatientDetail() {
  const { id } = Route.useParams();
  const { user, canEditClinical } = useAuth();
  const qc = useQueryClient();

  const { data: patient } = useQuery({
    queryKey: ["patient", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("patients").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ["sessions", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treatment_sessions")
        .select("*")
        .eq("patient_id", id)
        .order("session_number", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: files = [] } = useQuery({
    queryKey: ["files", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_files")
        .select("id, file_name, category, drive_web_view_link, created_at")
        .eq("patient_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: marks = [] } = useQuery({
    queryKey: ["marks", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("body_chart_marks")
        .select("id, mark_type, x, y, note")
        .eq("patient_id", id);
      if (error) throw error;
      return data;
    },
  });

  const [markType, setMarkType] = useState<string>("Pain");

  const addMark = useMutation({
    mutationFn: async (pos: { x: number; y: number }) => {
      const { error } = await supabase.from("body_chart_marks").insert({
        patient_id: id,
        mark_type: markType,
        x: pos.x,
        y: pos.y,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["marks", id] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const newSession = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("treatment_sessions").insert({
        patient_id: id,
        session_number: (sessions[0]?.session_number ?? 0) + 1,
        therapist_id: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("New visit opened");
      void qc.invalidateQueries({ queryKey: ["sessions", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateSession = useMutation({
    mutationFn: async ({ sid, patch }: { sid: string; patch: Record<string, unknown> }) => {
      const { error } = await supabase
        .from("treatment_sessions")
        .update(patch as never)
        .eq("id", sid);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Session saved");
      void qc.invalidateQueries({ queryKey: ["sessions", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const painSeries = [...sessions]
    .reverse()
    .filter((s) => s.pain_before !== null || s.pain_after !== null)
    .map((s) => ({
      name: `#${s.session_number}`,
      before: s.pain_before,
      after: s.pain_after,
    }));

  if (!patient) return <p className="text-sm text-muted-foreground">Loading record…</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div>
          <Link to="/patients" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> All patients
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">{patient.full_name}</h1>
          <p className="text-sm text-muted-foreground">
            {patient.code} · {patient.gender ?? "—"} · {patient.age ?? "—"} yrs ·{" "}
            {patient.phone ?? "no phone"}
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="secondary" className="self-center capitalize">
            {patient.status}
          </Badge>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" /> Print / PDF
          </Button>
        </div>
      </div>

      <Tabs defaultValue="history">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="exam">Examination</TabsTrigger>
          <TabsTrigger value="diagnosis">Diagnosis & Plan</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="body">Body chart</TabsTrigger>
          <TabsTrigger value="progress">Progress</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="mt-6">
          <ClinicalModule
            patientId={id}
            module="history"
            title="Complete medical history"
            description="Add only the items relevant to this patient — suggestions below, or type your own."
          />
        </TabsContent>
        <TabsContent value="exam" className="mt-6">
          <ClinicalModule
            patientId={id}
            module="exam"
            title="Physical examination"
            description="Vital signs, observation, ROM, strength, neurological and special tests."
          />
        </TabsContent>
        <TabsContent value="diagnosis" className="mt-6">
          <ClinicalModule
            patientId={id}
            module="diagnosis"
            title="Diagnosis, goals and treatment plan"
          />
        </TabsContent>

        <TabsContent value="sessions" className="mt-6 space-y-4">
          {canEditClinical && (
            <Button onClick={() => newSession.mutate()}>
              <Plus className="mr-2 h-4 w-4" /> Open a new visit
            </Button>
          )}
          {sessions.length === 0 && (
            <p className="text-sm text-muted-foreground">No visits recorded yet.</p>
          )}
          {sessions.map((s) => (
            <Card key={s.id}>
              <CardHeader>
                <CardTitle className="text-base">
                  Session #{s.session_number} · {s.session_date}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  {(["subjective", "objective", "assessment", "plan"] as const).map((k) => (
                    <div key={k} className="space-y-2">
                      <Label className="capitalize">{k}</Label>
                      <Textarea
                        rows={3}
                        disabled={!canEditClinical}
                        defaultValue={s[k] ?? ""}
                        onBlur={(e) => {
                          if ((s[k] ?? "") !== e.target.value)
                            updateSession.mutate({ sid: s.id, patch: { [k]: e.target.value } });
                        }}
                      />
                    </div>
                  ))}
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Pain before (0-10)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={10}
                      disabled={!canEditClinical}
                      defaultValue={s.pain_before ?? ""}
                      onBlur={(e) =>
                        updateSession.mutate({
                          sid: s.id,
                          patch: { pain_before: e.target.value ? Number(e.target.value) : null },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Pain after (0-10)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={10}
                      disabled={!canEditClinical}
                      defaultValue={s.pain_after ?? ""}
                      onBlur={(e) =>
                        updateSession.mutate({
                          sid: s.id,
                          patch: { pain_after: e.target.value ? Number(e.target.value) : null },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Duration (min)</Label>
                    <Input
                      type="number"
                      disabled={!canEditClinical}
                      defaultValue={s.duration_minutes ?? ""}
                      onBlur={(e) =>
                        updateSession.mutate({
                          sid: s.id,
                          patch: {
                            duration_minutes: e.target.value ? Number(e.target.value) : null,
                          },
                        })
                      }
                    />
                  </div>
                </div>
                <ClinicalModule
                  patientId={id}
                  module="session"
                  sessionId={s.id}
                  title="Interventions performed"
                />
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="body" className="mt-6 space-y-4">
          <div className="flex flex-wrap gap-2">
            {MARK_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setMarkType(t)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  markType === t
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <div
            className="relative mx-auto h-[520px] w-full max-w-sm rounded-2xl border bg-secondary/40"
            onClick={(e) => {
              if (!canEditClinical) return;
              const rect = e.currentTarget.getBoundingClientRect();
              addMark.mutate({
                x: ((e.clientX - rect.left) / rect.width) * 100,
                y: ((e.clientY - rect.top) / rect.height) * 100,
              });
            }}
          >
            <svg viewBox="0 0 100 200" className="h-full w-full text-muted-foreground/40">
              <circle cx="50" cy="18" r="12" fill="currentColor" />
              <rect x="34" y="32" width="32" height="60" rx="12" fill="currentColor" />
              <rect x="18" y="34" width="12" height="60" rx="6" fill="currentColor" />
              <rect x="70" y="34" width="12" height="60" rx="6" fill="currentColor" />
              <rect x="36" y="92" width="12" height="80" rx="6" fill="currentColor" />
              <rect x="52" y="92" width="12" height="80" rx="6" fill="currentColor" />
            </svg>
            {marks.map((m) => (
              <span
                key={m.id}
                title={m.mark_type}
                style={{ left: `${m.x}%`, top: `${m.y}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-accent-foreground shadow"
              >
                {m.mark_type}
              </span>
            ))}
          </div>
          <p className="text-center text-xs text-muted-foreground">
            Pick a marker type, then tap the body chart to place it.
          </p>
        </TabsContent>

        <TabsContent value="progress" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pain across sessions</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              {painSeries.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Record pain before/after in sessions to build the graph.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={painSeries}>
                    <XAxis dataKey="name" stroke="currentColor" fontSize={12} />
                    <YAxis domain={[0, 10]} stroke="currentColor" fontSize={12} />
                    <ChartTooltip />
                    <Line type="monotone" dataKey="before" stroke="var(--chart-1)" strokeWidth={2} />
                    <Line type="monotone" dataKey="after" stroke="var(--chart-2)" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="files" className="mt-6">
          <PatientFiles patientId={id} />
        </TabsContent>

      </Tabs>
    </div>
  );
}
