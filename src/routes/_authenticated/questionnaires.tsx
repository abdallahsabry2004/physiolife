import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, X, ClipboardList, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { logActivityAsync } from "@/lib/logger";
import {
  SCORING_METHODS,
  parseBands,
  type InterpretationBand,
} from "@/lib/questionnaires";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/questionnaires")({
  head: () => ({
    meta: [
      { title: "Questionnaires Library — Physio Life EMR" },
      {
        name: "description",
        content:
          "Build standardized outcome measures: questions, weighted answers, scoring formulas, interpretation bands, MCID and MDC.",
      },
      { property: "og:title", content: "Questionnaires Library — Physio Life EMR" },
      {
        property: "og:description",
        content: "Standardized outcome measures with automatic scoring and clinical thresholds.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: QuestionnairesPage,
});

type OptionDraft = { id?: string; label: string; label_ar: string; score: string };
type QuestionDraft = { id?: string; text: string; text_ar: string; options: OptionDraft[] };

const emptyOption = (): OptionDraft => ({ label: "", label_ar: "", score: "0" });
const emptyQuestion = (): QuestionDraft => ({
  text: "",
  text_ar: "",
  options: [emptyOption(), emptyOption()],
});

const emptyMeta = {
  name: "",
  name_ar: "",
  category: "",
  description: "",
  scoring_method: "sum",
  scoring_formula: "",
  min_score: "0",
  max_score: "",
  mcid: "",
  mdc: "",
};

const num = (v: string) => (v.trim() === "" ? null : Number(v));

// دالة موحدة تُستخدم في مكانين لتنظيف الأسئلة والخيارات الفارغة
const getCleanQuestions = (qs: QuestionDraft[]) =>
  qs
    .map((q) => ({ ...q, options: q.options.filter((o) => o.label.trim() !== "") }))
    .filter((q) => q.text.trim() !== "" && q.options.length > 0);

function QuestionnairesPage() {
  const { canEditClinical, user, fullName } = useAuth();
  const qc = useQueryClient();
  
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [meta, setMeta] = useState(emptyMeta);
  const [questions, setQuestions] = useState<QuestionDraft[]>([emptyQuestion()]);
  const [bands, setBands] = useState<InterpretationBand[]>([{ min: 0, max: 20, label: "" }]);
  const [term, setTerm] = useState("");
  const [viewId, setViewId] = useState<string | null>(null);

  // حالات التحكم في عملية الفحص والتحذير والحذف
  const [isChecking, setIsChecking] = useState(false);
  const [warningOpen, setWarningOpen] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<{qIds: string[]; oIds: string[]}>({qIds: [], oIds: []});

  const { data: list = [] } = useQuery({
    queryKey: ["questionnaires"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("questionnaires")
        .select("*, questionnaire_questions(id)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: detail } = useQuery({
    queryKey: ["questionnaire-detail", viewId],
    enabled: !!viewId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("questionnaires")
        .select(
          "*, questionnaire_questions(id, text, text_ar, sort_order, questionnaire_options(id, label, label_ar, score, sort_order))",
        )
        .eq("id", viewId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const resetForm = () => {
    setMeta(emptyMeta);
    setQuestions([emptyQuestion()]);
    setBands([{ min: 0, max: 20, label: "" }]);
    setEditingId(null);
  };

  const startEdit = async (id: string) => {
    const { data, error } = await supabase
      .from("questionnaires")
      .select(
        "*, questionnaire_questions(id, text, text_ar, sort_order, questionnaire_options(id, label, label_ar, score, sort_order))",
      )
      .eq("id", id)
      .single();
    if (error || !data) {
      toast.error(error?.message ?? "Could not load questionnaire");
      return;
    }
    setEditingId(id);
    setMeta({
      name: data.name ?? "",
      name_ar: data.name_ar ?? "",
      category: data.category ?? "",
      description: data.description ?? "",
      scoring_method: data.scoring_method ?? "sum",
      scoring_formula: data.scoring_formula ?? "",
      min_score: String(data.min_score ?? 0),
      max_score: data.max_score === null ? "" : String(data.max_score),
      mcid: data.mcid === null ? "" : String(data.mcid),
      mdc: data.mdc === null ? "" : String(data.mdc),
    });
    setBands(parseBands(data.interpretation).length ? parseBands(data.interpretation) : []);
    const qs = [...(data.questionnaire_questions ?? [])].sort(
      (a, b) => a.sort_order - b.sort_order,
    );
    setQuestions(
      qs.length
        ? qs.map((q) => ({
            id: q.id,
            text: q.text,
            text_ar: q.text_ar ?? "",
            options: [...(q.questionnaire_options ?? [])]
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((o) => ({
                id: o.id,
                label: o.label,
                label_ar: o.label_ar ?? "",
                score: String(o.score),
              })),
          }))
        : [emptyQuestion()],
    );
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async (deleteIds?: { qIds: string[]; oIds: string[] }) => {
      const cleanQuestions = getCleanQuestions(questions);

      const payload = {
        name: meta.name.trim(),
        name_ar: meta.name_ar.trim() || null,
        category: meta.category.trim() || null,
        description: meta.description.trim() || null,
        scoring_method: meta.scoring_method,
        scoring_formula: meta.scoring_method === "custom" ? meta.scoring_formula.trim() : null,
        min_score: num(meta.min_score) ?? 0,
        max_score: num(meta.max_score),
        mcid: num(meta.mcid),
        mdc: num(meta.mdc),
        interpretation: bands.filter((b) => b.label.trim() !== ""),
      };

      let questionnaireId = editingId;
      
      if (editingId) {
        const { error } = await supabase
          .from("questionnaires")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;

        // استخدام الـ IDs الجاهزة من الدالة الفاحصة لتنفيذ الحذف الآمن
        if (deleteIds?.oIds.length) {
          const { error: delOErr } = await supabase
            .from("questionnaire_options")
            .delete()
            .in("id", deleteIds.oIds);
          if (delOErr) throw delOErr;
        }
        if (deleteIds?.qIds.length) {
          const { error: delQErr } = await supabase
            .from("questionnaire_questions")
            .delete()
            .in("id", deleteIds.qIds);
          if (delQErr) throw delQErr;
        }
      } else {
        const { data, error } = await supabase
          .from("questionnaires")
          .insert({ ...payload, created_by: user?.id ?? null })
          .select("id")
          .single();
        if (error) throw error;
        questionnaireId = data.id;
      }

      // تحديث وإضافة الأسئلة
      for (const [qi, q] of cleanQuestions.entries()) {
        let qRowId = q.id;

        if (qRowId) {
          const { error: qErr } = await supabase
            .from("questionnaire_questions")
            .update({
              text: q.text.trim(),
              text_ar: q.text_ar.trim() || null,
              sort_order: qi,
            })
            .eq("id", qRowId);
          if (qErr) throw qErr;
        } else {
          const { data: qRow, error: qErr } = await supabase
            .from("questionnaire_questions")
            .insert({
              questionnaire_id: questionnaireId!,
              text: q.text.trim(),
              text_ar: q.text_ar.trim() || null,
              sort_order: qi,
            })
            .select("id")
            .single();
          if (qErr) throw qErr;
          qRowId = qRow.id;
        }

        for (const [oi, o] of q.options.entries()) {
          if (o.id) {
            const { error: oErr } = await supabase
              .from("questionnaire_options")
              .update({
                label: o.label.trim(),
                label_ar: o.label_ar.trim() || null,
                score: Number(o.score || 0),
                sort_order: oi,
              })
              .eq("id", o.id);
            if (oErr) throw oErr;
          } else {
            const { error: oErr } = await supabase.from("questionnaire_options").insert({
              question_id: qRowId!,
              label: o.label.trim(),
              label_ar: o.label_ar.trim() || null,
              score: Number(o.score || 0),
              sort_order: oi,
            });
            if (oErr) throw oErr;
          }
        }
      }

      logActivityAsync({
        user_id: user?.id,
        user_name: fullName,
        action: editingId ? "UPDATE_QUESTIONNAIRE" : "ADD_QUESTIONNAIRE",
        entity: `Questionnaire (${payload.name})`,
        details: { questions: cleanQuestions.length },
      });
    },
    onSuccess: () => {
      toast.success(editingId ? "Questionnaire updated" : "Questionnaire added");
      resetForm();
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["questionnaires"] });
      void qc.invalidateQueries({ queryKey: ["questionnaire-detail"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handlePreSaveCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!meta.name.trim()) {
      toast.error("Give the questionnaire a name");
      return;
    }

    const cleanQuestions = getCleanQuestions(questions);
    if (cleanQuestions.length === 0) {
      toast.error("Add at least one question with answer options");
      return;
    }


    if (!editingId) {
      save.mutate(undefined);
      return;
    }

    setIsChecking(true);
    try {
      const { data: existingQs, error } = await supabase
        .from("questionnaire_questions")
        .select("id, questionnaire_options(id)")
        .eq("questionnaire_id", editingId);
      
      if (error) throw error;

      const currentQuestionIds = cleanQuestions.map((q) => q.id).filter(Boolean) as string[];
      const currentOptionIds = cleanQuestions.flatMap((q) => q.options.map((o) => o.id)).filter(Boolean) as string[];
      
      const dbQIds = (existingQs ?? []).map((q) => q.id);
      const dbOIds = (existingQs ?? []).flatMap((q) => q.questionnaire_options.map((o) => o.id));
      
      const qIds = dbQIds.filter((id) => !currentQuestionIds.includes(id));
      const oIds = dbOIds.filter((id) => !currentOptionIds.includes(id));

      let hasUsage = false;
      
      if (qIds.length) {
        const { count, error: cErr } = await supabase
          .from("patient_assessment_answers")
          .select("*", { count: "exact", head: true })
          .in("question_id", qIds);
        if (cErr) throw cErr;
        if (count && count > 0) hasUsage = true;
      }
      
      if (!hasUsage && oIds.length) {
        const { count, error: cErr } = await supabase
          .from("patient_assessment_answers")
          .select("*", { count: "exact", head: true })
          .in("option_id", oIds);
        if (cErr) throw cErr;
        if (count && count > 0) hasUsage = true;
      }

      if (hasUsage) {
        setPendingDeleteIds({ qIds, oIds });
        setWarningOpen(true);
        setIsChecking(false);
        return;
      }

      save.mutate({ qIds, oIds });
    } catch (err: any) {
      toast.error(err.message);
    }
    setIsChecking(false);
  };

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const target = list.find((q) => q.id === id);
      const { error } = await supabase.from("questionnaires").delete().eq("id", id);
      if (error) throw error;
      logActivityAsync({
        user_id: user?.id,
        user_name: fullName,
        action: "DELETE_QUESTIONNAIRE",
        entity: `Questionnaire (${target?.name ?? id})`,
      });
    },
    onSuccess: () => {
      toast.success("Questionnaire deleted");
      void qc.invalidateQueries({ queryKey: ["questionnaires"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = list.filter((q) =>
    `${q.name} ${q.category ?? ""}`.toLowerCase().includes(term.toLowerCase()),
  );

  const maxPossible = questions.reduce((sum, q) => {
    const scores = q.options.map((o) => Number(o.score || 0));
    return sum + (scores.length ? Math.max(...scores) : 0);
  }, 0);

  const updateQuestion = (idx: number, patch: Partial<QuestionDraft>) =>
    setQuestions((prev) => prev.map((q, i) => (i === idx ? { ...q, ...patch } : q)));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Questionnaires Library</h1>
          <p className="text-sm text-muted-foreground">
            Standardized outcome measures with automatic scoring, interpretation, MCID and MDC.
          </p>
        </div>
        {canEditClinical && (
          <Button
            onClick={() => {
              resetForm();
              setOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> Add questionnaire
          </Button>
        )}
      </div>

      <Input
        placeholder="Search by name or category…"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        className="max-w-sm"
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((q) => (
          <Card key={q.id}>
            <CardContent className="space-y-3 pt-6">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{q.name}</p>
                  {q.name_ar && <p className="text-sm text-muted-foreground">{q.name_ar}</p>}
                </div>
                {q.category && <Badge variant="secondary">{q.category}</Badge>}
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>{q.questionnaire_questions?.length ?? 0} questions</span>
                <span>· scoring: {q.scoring_method}</span>
                {q.mcid !== null && <span>· MCID {q.mcid}</span>}
                {q.mdc !== null && <span>· MDC {q.mdc}</span>}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setViewId(q.id)}>
                  <ClipboardList className="mr-2 h-4 w-4" /> View
                </Button>
                {canEditClinical && (
                  <>
                    <Button variant="ghost" size="icon" onClick={() => void startEdit(q.id)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => {
                        if (confirm("Delete this questionnaire and all its assessments?"))
                          remove.mutate(q.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground">No questionnaires yet.</p>
        )}
      </div>

      {/* View dialog */}
      <Dialog open={!!viewId} onOpenChange={(o) => !o && setViewId(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[680px]">
          <DialogHeader>
            <DialogTitle>{detail?.name ?? "Questionnaire"}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4 text-sm">
              <p className="text-muted-foreground">{detail.description}</p>
              <div className="grid grid-cols-2 gap-2">
                <p>Scoring: {detail.scoring_method}</p>
                <p>
                  Range: {detail.min_score} – {detail.max_score ?? "—"}
                </p>
                <p>MCID: {detail.mcid ?? "—"}</p>
                <p>MDC: {detail.mdc ?? "—"}</p>
              </div>
              {parseBands(detail.interpretation).length > 0 && (
                <div>
                  <p className="font-semibold">Interpretation</p>
                  <ul className="list-disc ps-5">
                    {parseBands(detail.interpretation).map((b, i) => (
                      <li key={i}>
                        {b.min}–{b.max}: {b.label}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="space-y-3">
                {[...(detail.questionnaire_questions ?? [])]
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((q, i) => (
                    <div key={q.id} className="rounded-lg border p-3">
                      <p className="font-medium">
                        {i + 1}. {q.text}
                      </p>
                      <ul className="mt-1 space-y-0.5 text-muted-foreground">
                        {[...(q.questionnaire_options ?? [])]
                          .sort((a, b) => a.sort_order - b.sort_order)
                          .map((o) => (
                            <li key={o.id}>
                              • {o.label} <span className="font-mono">({o.score})</span>
                            </li>
                          ))}
                      </ul>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Builder dialog */}
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) resetForm();
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[760px]">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit questionnaire" : "New questionnaire"}</DialogTitle>
          </DialogHeader>
          <form className="space-y-6" onSubmit={handlePreSaveCheck}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={meta.name}
                  onChange={(e) => setMeta({ ...meta, name: e.target.value })}
                  placeholder="Oswestry Disability Index"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Name (Arabic)</Label>
                <Input
                  value={meta.name_ar}
                  onChange={(e) => setMeta({ ...meta, name_ar: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Input
                  value={meta.category}
                  onChange={(e) => setMeta({ ...meta, category: e.target.value })}
                  placeholder="Orthopedic / Neurology / Cardiopulmonary…"
                />
              </div>
              <div className="space-y-2">
                <Label>Scoring formula</Label>
                <Select
                  value={meta.scoring_method}
                  onValueChange={(v) => setMeta({ ...meta, scoring_method: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCORING_METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {SCORING_METHODS.find((m) => m.value === meta.scoring_method)?.hint}
                </p>
              </div>
            </div>

            {meta.scoring_method === "custom" && (
              <div className="space-y-2">
                <Label>Custom expression</Label>
                <Input
                  value={meta.scoring_formula}
                  onChange={(e) => setMeta({ ...meta, scoring_formula: e.target.value })}
                  placeholder="({raw}/{max})*100"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                rows={2}
                value={meta.description}
                onChange={(e) => setMeta({ ...meta, description: e.target.value })}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-4">
              <div className="space-y-2">
                <Label>Min score</Label>
                <Input
                  type="number"
                  value={meta.min_score}
                  onChange={(e) => setMeta({ ...meta, min_score: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Max score</Label>
                <Input
                  type="number"
                  value={meta.max_score}
                  onChange={(e) => setMeta({ ...meta, max_score: e.target.value })}
                  placeholder={String(maxPossible)}
                />
              </div>
              <div className="space-y-2">
                <Label>MCID</Label>
                <Input
                  type="number"
                  step="any"
                  value={meta.mcid}
                  onChange={(e) => setMeta({ ...meta, mcid: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>MDC</Label>
                <Input
                  type="number"
                  step="any"
                  value={meta.mdc}
                  onChange={(e) => setMeta({ ...meta, mdc: e.target.value })}
                />
              </div>
            </div>

            {/* Interpretation bands */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Interpretation bands</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setBands([...bands, { min: 0, max: 0, label: "" }])}
                >
                  <Plus className="mr-1 h-3 w-3" /> Band
                </Button>
              </div>
              {bands.map((b, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    type="number"
                    className="w-20"
                    value={b.min}
                    onChange={(e) =>
                      setBands(
                        bands.map((x, xi) =>
                          xi === i ? { ...x, min: Number(e.target.value) } : x,
                        ),
                      )
                    }
                  />
                  <span className="text-muted-foreground">–</span>
                  <Input
                    type="number"
                    className="w-20"
                    value={b.max}
                    onChange={(e) =>
                      setBands(
                        bands.map((x, xi) =>
                          xi === i ? { ...x, max: Number(e.target.value) } : x,
                        ),
                      )
                    }
                  />
                  <Input
                    placeholder="Minimal disability"
                    value={b.label}
                    onChange={(e) =>
                      setBands(
                        bands.map((x, xi) => (xi === i ? { ...x, label: e.target.value } : x)),
                      )
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setBands(bands.filter((_, xi) => xi !== i))}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Questions */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Questions (max possible raw score: {maxPossible})</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setQuestions([...questions, emptyQuestion()])}
                >
                  <Plus className="mr-1 h-3 w-3" /> Question
                </Button>
              </div>
              {questions.map((q, qi) => (
                <Card key={qi}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm">Question {qi + 1}</CardTitle>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setQuestions(questions.filter((_, i) => i !== qi))}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Input
                      placeholder="Question text"
                      value={q.text}
                      onChange={(e) => updateQuestion(qi, { text: e.target.value })}
                    />
                    <Input
                      placeholder="نص السؤال بالعربية (اختياري)"
                      value={q.text_ar}
                      onChange={(e) => updateQuestion(qi, { text_ar: e.target.value })}
                    />
                    <div className="space-y-2">
                      {q.options.map((o, oi) => (
                        <div key={oi} className="flex items-center gap-2">
                          <Input
                            placeholder={`Answer option ${oi + 1}`}
                            value={o.label}
                            onChange={(e) =>
                              updateQuestion(qi, {
                                options: q.options.map((x, xi) =>
                                  xi === oi ? { ...x, label: e.target.value } : x,
                                ),
                              })
                            }
                          />
                          <Input
                            type="number"
                            step="any"
                            className="w-24"
                            value={o.score}
                            onChange={(e) =>
                              updateQuestion(qi, {
                                options: q.options.map((x, xi) =>
                                  xi === oi ? { ...x, score: e.target.value } : x,
                                ),
                              })
                            }
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              updateQuestion(qi, {
                                options: q.options.filter((_, xi) => xi !== oi),
                              })
                            }
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          updateQuestion(qi, { options: [...q.options, emptyOption()] })
                        }
                      >
                        <Plus className="mr-1 h-3 w-3" /> Answer option
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Button type="submit" className="w-full" disabled={save.isPending || isChecking}>
              {isChecking ? "Checking impact..." : save.isPending ? "Saving…" : editingId ? "Save changes" : "Create questionnaire"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* نافذة التحذير لمنع فقدان البيانات */}
      <Dialog open={warningOpen} onOpenChange={setWarningOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> Warning: Data Loss Risk
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">
              You are about to delete questions or options that have <strong>already been answered</strong> by patients.
            </p>
            <ul className="text-sm text-muted-foreground list-disc list-inside">
              <li>Deleting a question will <strong>permanently erase</strong> patient answers for that question.</li>
              <li>Deleting an option will leave existing answers without a selected text (score will remain).</li>
            </ul>
            <p className="text-sm font-semibold text-foreground">
              Are you absolutely sure you want to proceed?
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setWarningOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={() => {
                setWarningOpen(false);
                save.mutate(pendingDeleteIds);
              }}>
                Yes, delete and save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
