import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, Plus, Trash2, Eye, Printer } from "lucide-react";
import { toast } from "sonner";
import {
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { logActivityAsync } from "@/lib/logger";
import { computeScore, interpretScore, parseBands } from "@/lib/questionnaires";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Option = {
  id: string;
  label: string;
  label_ar: string | null;
  score: number;
  sort_order: number;
};
type Question = {
  id: string;
  text: string;
  text_ar: string | null;
  sort_order: number;
  questionnaire_options: Option[];
};

export function PatientAssessments({ patientId }: { patientId: string }) {
  const { canEditClinical, user, fullName } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [imageManualScore, setImageManualScore] = useState("");
  const [assessedOn, setAssessedOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  // State للتحكم في نافذة عرض تفاصيل التقييم القديم
  const [viewAssessmentId, setViewAssessmentId] = useState<string | null>(null);

  const { data: questionnaires = [] } = useQuery({
    queryKey: ["questionnaires-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("questionnaires")
        .select(
          "id, name, name_ar, category, mcid, mdc, min_score, max_score, scoring_method, scoring_formula, interpretation",
        )
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: activeQ } = useQuery({
    queryKey: ["questionnaire-fill", selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("questionnaires")
        .select(
          "*, questionnaire_questions(id, text, text_ar, sort_order, questionnaire_options(id, label, label_ar, score, sort_order))",
        )
        .eq("id", selectedId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: assessments = [] } = useQuery({
    queryKey: ["patient-assessments", patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_assessments")
        .select("*")
        .eq("patient_id", patientId)
        .order("assessed_on", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // استعلام جديد لجلب إجابات المريض لتقييم محدد عند الضغط على زر (View)
  const { data: assessmentDetails = [], isLoading: isLoadingDetails } = useQuery({
    queryKey: ["assessment-details", viewAssessmentId],
    enabled: !!viewAssessmentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_assessment_answers")
        .select(
          `
          id,
          score,
          questionnaire_questions ( text ),
          questionnaire_options ( label )
        `,
        )
        .eq("assessment_id", viewAssessmentId!);
      if (error) throw error;
      return data;
    },
  });

  const questions: Question[] = useMemo(() => {
    const qs = (activeQ?.questionnaire_questions ?? []) as Question[];
    return [...qs]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((q) => ({
        ...q,
        questionnaire_options: [...(q.questionnaire_options ?? [])].sort(
          (a, b) => a.sort_order - b.sort_order,
        ),
      }));
  }, [activeQ]);

  const live = useMemo(() => {
    if (!activeQ) return { raw: 0, max: 0, answered: 0, final: 0, interpretation: "" };
    if (activeQ.scoring_method === "image") {
      return {
        raw: 0,
        max: activeQ.max_score !== null ? Number(activeQ.max_score) : 0,
        answered: 1, // acts as valid
        final: 0,
        interpretation: imageManualScore,
      };
    }
    let raw = 0;
    let answered = 0;
    let max = 0;
    for (const q of questions) {
      const scores = q.questionnaire_options.map((o) => o.score);
      if (scores.length) max += Math.max(...scores);
      const chosen = q.questionnaire_options.find((o) => o.id === answers[q.id]);
      if (chosen) {
        raw += Number(chosen.score);
        answered += 1;
      }
    }
    const final = computeScore({
      method: activeQ.scoring_method,
      formula: activeQ.scoring_formula,
      rawSum: raw,
      maxPossible: activeQ.max_score !== null ? Number(activeQ.max_score) : max,
      answered,
    });
    return {
      raw,
      max,
      answered,
      final,
      interpretation: interpretScore(parseBands(activeQ.interpretation), final),
    };
  }, [activeQ, questions, answers, imageManualScore]);

  const submit = useMutation({
    mutationFn: async () => {
      if (!activeQ) throw new Error("Select a questionnaire");
      if (live.answered === 0 && activeQ.scoring_method !== "image")
        throw new Error("Answer at least one question");
      const maxPossible = activeQ.max_score !== null ? Number(activeQ.max_score) : live.max;
      const { data: created, error } = await supabase
        .from("patient_assessments")
        .insert({
          patient_id: patientId,
          questionnaire_id: activeQ.id,
          assessed_on: assessedOn,
          raw_score: live.raw,
          final_score: live.final,
          max_possible: maxPossible,
          interpretation: live.interpretation || null,
          notes: notes.trim() || null,
          assessed_by: user?.id ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;

      const rows = questions.flatMap((q) => {
        const chosen = q.questionnaire_options.find((o) => o.id === answers[q.id]);
        if (!chosen) return [];
        return [
          {
            assessment_id: created.id,
            question_id: q.id,
            option_id: chosen.id,
            score: Number(chosen.score),
          },
        ];
      });
      if (rows.length) {
        const { error: aErr } = await supabase.from("patient_assessment_answers").insert(rows);
        if (aErr) throw aErr;
      }

      logActivityAsync({
        user_id: user?.id,
        user_name: fullName,
        action: "ADD_PATIENT_ASSESSMENT",
        entity: `Assessment (${activeQ.name})`,
        details: { patient_id: patientId, score: live.final },
      });
    },
    onSuccess: () => {
      toast.success("Assessment saved");
      setOpen(false);
      setAnswers({});
      setImageManualScore("");
      setNotes("");
      setSelectedId("");
      void qc.invalidateQueries({ queryKey: ["patient-assessments", patientId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("patient_assessments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Assessment deleted");
      void qc.invalidateQueries({ queryKey: ["patient-assessments", patientId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const grouped = useMemo(() => {
    const map = new Map<string, typeof assessments>();
    for (const a of assessments) {
      const list = map.get(a.questionnaire_id) ?? [];
      list.push(a);
      map.set(a.questionnaire_id, list);
    }
    return [...map.entries()];
  }, [assessments]);

  return (
    <div className="space-y-6">
      {canEditClinical && (
        <Button onClick={() => setOpen(true)} className="print:hidden">
          <Plus className="mr-2 h-4 w-4" /> Add questionnaire
        </Button>
      )}

      {grouped.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No questionnaires filled for this patient yet.
        </p>
      )}

      {grouped.map(([qid, records]) => {
        const meta = questionnaires.find((q) => q.id === qid);
        const series = records.map((r) => ({
          name: r.assessed_on,
          score: Number(r.final_score),
        }));
        const baseline = series[0]?.score ?? 0;
        const mcid = meta?.mcid !== null && meta?.mcid !== undefined ? Number(meta.mcid) : null;
        const mdc = meta?.mdc !== null && meta?.mdc !== undefined ? Number(meta.mdc) : null;
        const latest = series[series.length - 1]?.score ?? 0;
        const change = latest - baseline;

        return (
          <Card key={qid}>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
              <CardTitle className="text-base">
                {meta?.name ?? "Questionnaire"}
                {meta?.category && (
                  <Badge variant="secondary" className="ms-2">
                    {meta.category}
                  </Badge>
                )}
              </CardTitle>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>Baseline {baseline}</span>
                <span>· Latest {latest}</span>
                <span>· Change {change > 0 ? `+${change}` : change}</span>
                {mcid !== null && (
                  <Badge variant={Math.abs(change) >= mcid ? "default" : "outline"}>
                    {Math.abs(change) >= mcid ? "Exceeds MCID" : "Below MCID"} ({mcid})
                  </Badge>
                )}
                {mdc !== null && (
                  <Badge variant={Math.abs(change) >= mdc ? "default" : "outline"}>
                    {Math.abs(change) >= mdc ? "Exceeds MDC" : "Below MDC"} ({mdc})
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {meta?.scoring_method !== "image" && (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series}>
                    <XAxis dataKey="name" stroke="currentColor" fontSize={12} />
                    <YAxis
                      stroke="currentColor"
                      fontSize={12}
                      domain={[
                        meta?.min_score !== undefined && meta?.min_score !== null
                          ? Number(meta.min_score)
                          : "auto",
                        meta?.max_score !== undefined && meta?.max_score !== null
                          ? Number(meta.max_score)
                          : "auto",
                      ]}
                    />
                    <ChartTooltip />
                    {mcid !== null && (
                      <>
                        <ReferenceLine
                          y={baseline + mcid}
                          stroke="var(--chart-2)"
                          strokeDasharray="4 4"
                          label={{ value: `MCID +${mcid}`, fontSize: 10 }}
                        />
                        <ReferenceLine
                          y={baseline - mcid}
                          stroke="var(--chart-2)"
                          strokeDasharray="4 4"
                          label={{ value: `MCID -${mcid}`, fontSize: 10 }}
                        />
                      </>
                    )}
                    {mdc !== null && (
                      <>
                        <ReferenceLine
                          y={baseline + mdc}
                          stroke="var(--chart-3)"
                          strokeDasharray="2 6"
                          label={{ value: `MDC +${mdc}`, fontSize: 10 }}
                        />
                        <ReferenceLine
                          y={baseline - mdc}
                          stroke="var(--chart-3)"
                          strokeDasharray="2 6"
                          label={{ value: `MDC -${mdc}`, fontSize: 10 }}
                        />
                      </>
                    )}
                    <Line type="monotone" dataKey="score" stroke="var(--chart-1)" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              )}

              <div className="space-y-2">
                {[...records].reverse().map((r) => (
                  <div
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">
                        {r.assessed_on}
                        {meta?.scoring_method !== "image" && ` · score ${Number(r.final_score)}`}
                        {meta?.scoring_method !== "image" && r.max_possible ? ` / ${Number(r.max_possible)}` : ""}
                      </p>
                      {r.interpretation && (
                        <p className={meta?.scoring_method === "image" ? "font-semibold mt-1" : "text-muted-foreground"}>
                          {meta?.scoring_method === "image" ? `Result: ${r.interpretation}` : r.interpretation}
                        </p>
                      )}
                      {r.notes && <p className="text-muted-foreground">{r.notes}</p>}
                    </div>
                    <div className="flex items-center gap-1 print:hidden">
                      {/* زر عرض تفاصيل التقييم */}
                      {meta?.scoring_method !== "image" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-primary"
                          onClick={() => setViewAssessmentId(r.id)}
                          title="View Answers"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}

                      {canEditClinical && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => {
                            if (confirm("Delete this assessment?")) remove.mutate(r.id);
                          }}
                          title="Delete Assessment"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* نافذة عرض تفاصيل الإجابات القديمة */}
      <Dialog open={!!viewAssessmentId} onOpenChange={(open) => !open && setViewAssessmentId(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Assessment Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {isLoadingDetails ? (
              <p className="text-sm text-muted-foreground text-center py-4">Loading answers...</p>
            ) : assessmentDetails.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No detailed answers found for this assessment.
              </p>
            ) : (
              <div className="space-y-3">
                {assessmentDetails.map(
                  (
                    ans: {
                      id: string;
                      score: number;
                      questionnaire_questions: { text: string } | null;
                      questionnaire_options: { label: string } | null;
                    },
                    idx: number,
                  ) => (
                    <div key={ans.id} className="rounded-lg border p-3 bg-secondary/10">
                      <p className="font-medium text-sm mb-1">
                        {idx + 1}. {ans.questionnaire_questions?.text || "Unknown Question"}
                      </p>
                      <div className="flex justify-between items-center text-sm text-muted-foreground">
                        <p>
                          Answer:{" "}
                          <span className="font-semibold text-primary">
                            {ans.questionnaire_options?.label || "Unknown Option"}
                          </span>
                        </p>
                        <Badge variant="outline">Score: {ans.score}</Badge>
                      </div>
                    </div>
                  ),
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* نافذة إضافة تقييم جديد */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[680px]">
          <DialogHeader>
            <DialogTitle>
              <span className="inline-flex items-center gap-2">
                <ClipboardList className="h-4 w-4" /> New assessment
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Questionnaire</Label>
                <Select
                  value={selectedId}
                  onValueChange={(v) => {
                    setSelectedId(v);
                    setAnswers({});
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select from library" />
                  </SelectTrigger>
                  <SelectContent>
                    {questionnaires.map((q) => (
                      <SelectItem key={q.id} value={q.id}>
                        {q.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={assessedOn}
                  onChange={(e) => setAssessedOn(e.target.value)}
                />
              </div>
            </div>

            {activeQ?.scoring_method === "image" ? (
              <div className="space-y-4 rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">
                  This is an image-based questionnaire.
                </p>
                <div className="flex flex-wrap gap-2">
                  {(activeQ.interpretation as Record<string, string>[])?.map((file, idx) => (
                    <Button
                      key={idx}
                      variant="outline"
                      onClick={() => window.open(file.webViewLink, "_blank")}
                      type="button"
                    >
                      <Printer className="mr-2 h-4 w-4" /> View File {idx + 1}
                    </Button>
                  ))}
                  {!(activeQ.interpretation as Record<string, string>[])?.length && activeQ.scoring_formula && (
                    <Button
                      variant="outline"
                      onClick={() => window.open(activeQ.scoring_formula, "_blank")}
                      type="button"
                    >
                      <Printer className="mr-2 h-4 w-4" /> View Link
                    </Button>
                  )}
                </div>
                <div className="space-y-2 mt-4">
                  <Label>Patient Result</Label>
                  <Input
                    type="text"
                    placeholder="Enter result..."
                    value={imageManualScore}
                    onChange={(e) => setImageManualScore(e.target.value)}
                  />
                </div>
              </div>
            ) : (
              questions.map((q, qi) => (
                <div key={q.id} className="space-y-2 rounded-lg border p-3">
                  <p className="text-sm font-medium">
                    {qi + 1}. {q.text}
                  </p>
                  <div className="space-y-1">
                    {q.questionnaire_options.map((o) => (
                      <label
                        key={o.id}
                        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted"
                      >
                        <input
                          type="radio"
                          name={q.id}
                          checked={answers[q.id] === o.id}
                          onChange={() => setAnswers({ ...answers, [q.id]: o.id })}
                        />
                        <span>{o.label}</span>
                        <span className="ms-auto font-mono text-xs text-muted-foreground">
                          {Number(o.score)}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))
            )}

            {selectedId && (
              <>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
                <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                  <p className="font-semibold">
                    Score: {live.final}
                    {activeQ?.max_score !== null && activeQ?.max_score !== undefined
                      ? ` / ${Number(activeQ.max_score)}`
                      : ""}
                  </p>
                  <p className="text-muted-foreground">
                    Raw {live.raw} · {live.answered}/{questions.length} answered
                    {live.interpretation ? ` · ${live.interpretation}` : ""}
                  </p>
                </div>
                <Button
                  className="w-full"
                  disabled={submit.isPending}
                  onClick={() => submit.mutate()}
                >
                  {submit.isPending ? "Saving…" : "Save assessment"}
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
