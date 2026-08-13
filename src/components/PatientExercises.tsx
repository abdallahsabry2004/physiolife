import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Circle, Plus, Trash2, Pencil, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import html2pdf from "html2pdf.js";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import logo from "@/assets/physio-life-logo.png";

const today = () => new Date().toISOString().slice(0, 10);

export function PatientExercises({ patientId }: { patientId: string }) {
  const { user, fullName, canEditClinical } = useAuth();
  const qc = useQueryClient();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [exerciseId, setExerciseId] = useState<string | undefined>(undefined);
  const [sets, setSets] = useState("");
  const [reps, setReps] = useState("");
  const [frequency, setFrequency] = useState("");
  const [notes, setNotes] = useState("");

  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const { data: patient } = useQuery({
    queryKey: ["patient-min-hep", patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patients")
        .select("full_name, code")
        .eq("id", patientId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: library = [] } = useQuery({
    queryKey: ["exercise-library"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercises")
        .select("id, name, category, instructions")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: assigned = [] } = useQuery({
    queryKey: ["patient-exercises", patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_exercises")
        .select("*, exercises(name, category, instructions)")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["exercise-logs", patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercise_logs")
        .select("id, patient_exercise_id, log_date, completed")
        .eq("patient_id", patientId)
        .order("log_date", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  const assign = useMutation({
    mutationFn: async () => {
      if (!exerciseId) throw new Error("Pick an exercise first");
      
      if (editingId) {
        const { error } = await supabase
          .from("patient_exercises")
          .update({
            exercise_id: exerciseId,
            sets: sets || null,
            repetitions: reps || null,
            frequency: frequency || null,
            notes: notes || null,
          })
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("patient_exercises").insert({
          patient_id: patientId,
          exercise_id: exerciseId,
          sets: sets || null,
          repetitions: reps || null,
          frequency: frequency || null,
          notes: notes || null,
          assigned_by: user?.id ?? null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      const isEdit = !!editingId;
      setExerciseId(undefined);
      setSets("");
      setReps("");
      setFrequency("");
      setNotes("");
      setEditingId(null);
      
      toast.success(isEdit ? "Exercise updated successfully" : "Exercise added to the home program");
      void qc.invalidateQueries({ queryKey: ["patient-exercises", patientId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("patient_exercises").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Exercise removed");
      void qc.invalidateQueries({ queryKey: ["patient-exercises", patientId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleToday = useMutation({
    mutationFn: async (pex: { id: string; logId?: string; completed: boolean }) => {
      if (pex.logId) {
        const { error } = await supabase
          .from("exercise_logs")
          .update({ completed: !pex.completed })
          .eq("id", pex.logId);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("exercise_logs").insert({
        patient_exercise_id: pex.id,
        patient_id: patientId,
        log_date: today(),
        completed: true,
        recorded_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["exercise-logs", patientId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const openEdit = (pex: any) => {
    setEditingId(pex.id);
    setExerciseId(pex.exercise_id || undefined);
    setSets(pex.sets || "");
    setReps(pex.repetitions || "");
    setFrequency(pex.frequency || "");
    setNotes(pex.notes || "");
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setExerciseId(undefined);
    setSets("");
    setReps("");
    setFrequency("");
    setNotes("");
  };

  const handleExportPDF = async () => {
    if (assigned.length === 0) {
      toast.error("No exercises assigned to export.");
      return;
    }
    
    setIsGeneratingPDF(true);
    toast.info("Preparing PDF, please wait...");
    
    // إعطاء المتصفح مهلة لتحديث الواجهة قبل بدء عملية الـ PDF الثقيلة
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      const element = document.getElementById("hep-pdf-container");
      if (!element) {
        throw new Error("Container not found.");
      }

      const opt = {
        margin:       [10, 10, 15, 10],
        filename:     `Home_Exercise_Program_${patient?.full_name?.replace(/\s+/g, '_') || 'Patient'}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { 
          scale: 2, 
          useCORS: true, 
          scrollY: 0, 
          windowWidth: 800 
        },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      await html2pdf().set(opt).from(element).save();
      toast.success("PDF Downloaded successfully!");
    } catch (err) {
      console.error("PDF Generation Error:", err);
      toast.error("An error occurred while generating the PDF.");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const doneCount = logs.filter((l) => l.completed).length;
  const last7 = logs.filter(
    (l) => l.completed && l.log_date >= new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10),
  ).length;

  return (
    <>
      {/* ----------------- قالب تصدير البرنامج المنزلي (PDF Export Container) ----------------- */}
      <div style={{ position: "absolute", left: "-10000px", top: 0, width: "800px", zIndex: -50 }}>
        <div id="hep-pdf-container" className="bg-white p-8 text-black">
          <div className="border-b-2 border-[#0f766e] pb-6 mb-8 flex justify-between items-start">
            <div className="flex items-center gap-4">
              <img src={logo} alt="Physio Life" className="h-[90px] w-[90px] object-contain" />
              <div>
                <h2 className="text-3xl font-bold text-[#0f766e]">Physio Life PT Center</h2>
                <p className="text-sm font-medium text-gray-600 mb-2">Physical Therapy & Rehabilitation</p>
                <div className="text-xs text-gray-600 leading-relaxed font-semibold">
                  <p dir="rtl">📍 قنا - أمام المستشفى العام - بجوار حلواني شوكلتير - أعلى بنك دبي الوطني</p>
                  <p dir="ltr" className="mt-1">📞 01050359331</p>
                </div>
              </div>
            </div>
            <div className="text-right">
              <h3 className="text-2xl font-bold text-gray-800 tracking-wider">HOME EXERCISE PROGRAM</h3>
              <p className="text-gray-500 mt-2 font-medium">Date: {new Date().toLocaleDateString('en-GB')}</p>
              <p className="text-gray-500 font-medium">Therapist: {fullName}</p>
            </div>
          </div>

          <div className="mb-6 flex justify-between bg-gray-50 p-4 rounded-lg border border-gray-200">
            <div>
              <p className="text-sm text-gray-500 uppercase font-semibold">Patient Name</p>
              <p className="text-xl font-bold mt-1 text-black">{patient?.full_name}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500 uppercase font-semibold">Patient ID</p>
              <p className="text-lg font-bold mt-1 text-black">{patient?.code}</p>
            </div>
          </div>

          <div className="bg-[#0f766e]/10 p-4 rounded-lg border border-[#0f766e]/30 mb-8 text-sm text-gray-800">
            <p className="font-bold mb-2 text-[#0f766e]">💡 Guidelines for your Home Program:</p>
            <ul className="list-disc list-inside space-y-1 ml-2 font-medium">
              <li>Perform exercises slowly and with control unless instructed otherwise.</li>
              <li>Stop if you experience sharp or sudden pain and consult your therapist.</li>
              <li>Breathe normally; do not hold your breath during exercises.</li>
            </ul>
          </div>

          <div className="space-y-6">
            {assigned.map((pex, index) => (
              <div key={pex.id} className="border-2 border-gray-200 rounded-xl p-5" style={{ pageBreakInside: 'avoid' }}>
                <div className="flex justify-between items-start border-b pb-3 mb-4">
                  <div>
                    <h4 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                      <span className="bg-[#0f766e] text-white h-7 w-7 rounded-full flex items-center justify-center text-sm">
                        {index + 1}
                      </span>
                      {pex.exercises?.name ?? "Custom exercise"}
                    </h4>
                    {pex.exercises?.category && (
                      <p className="text-sm text-gray-500 font-medium ml-9 mt-1">Target: {pex.exercises.category}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4 bg-gray-50 p-3 rounded-lg border border-gray-200 text-center">
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-bold">Sets</p>
                    <p className="text-lg font-bold text-[#0f766e]">{pex.sets || "-"}</p>
                  </div>
                  <div className="border-x border-gray-300">
                    <p className="text-xs text-gray-500 uppercase font-bold">Repetitions</p>
                    <p className="text-lg font-bold text-[#0f766e]">{pex.repetitions || "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-bold">Frequency</p>
                    <p className="text-lg font-bold text-[#0f766e]">{pex.frequency || "-"}</p>
                  </div>
                </div>

                {pex.exercises?.instructions && (
                  <div className="mb-3 pl-2 border-l-4 border-gray-300">
                    <p className="text-sm font-bold text-gray-800 mb-1">Instructions:</p>
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{pex.exercises.instructions}</p>
                  </div>
                )}

                {pex.notes && (
                  <div className="mt-3 bg-amber-50 border border-amber-200 p-3 rounded-md">
                    <p className="text-sm font-bold text-amber-900 mb-1">Therapist Notes:</p>
                    <p className="text-sm text-amber-800 leading-relaxed font-medium">{pex.notes}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-12 pt-6 border-t border-gray-200 text-center">
            <p className="font-bold text-lg text-[#0f766e] mb-2">We wish you a speedy recovery!</p>
            <p className="text-sm text-gray-600 font-medium">Physio Life PT Center - Your health is our priority.</p>
            <p className="text-sm text-gray-500 mt-1">If you have any questions about your program, please contact the clinic.</p>
          </div>
        </div>
      </div>
      {/* --------------------------------------------------------------------------------------- */}

      <div className="space-y-6">
        {canEditClinical && (
          <Card className={`${editingId ? "border-primary" : ""}`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">
                {editingId ? "Edit prescribed exercise" : "Prescribe an exercise"}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 mt-2">
              <div className="space-y-2 md:col-span-2">
                <Label>Exercise from the library</Label>
                <Select value={exerciseId ?? ""} onValueChange={setExerciseId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an exercise" />
                  </SelectTrigger>
                  <SelectContent>
                    {library.map((ex) => (
                      <SelectItem key={ex.id} value={ex.id}>
                        {ex.name}
                        {ex.category ? ` · ${ex.category}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Sets</Label>
                <Input value={sets} onChange={(e) => setSets(e.target.value)} placeholder="3" />
              </div>
              <div className="space-y-2">
                <Label>Repetitions</Label>
                <Input value={reps} onChange={(e) => setReps(e.target.value)} placeholder="10-12" />
              </div>
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Input
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                  placeholder="Daily / 3x per week"
                />
              </div>
              <div className="space-y-2">
                <Label>Notes for the patient</Label>
                <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <div className="md:col-span-2 flex gap-2">
                <Button onClick={() => assign.mutate()} disabled={assign.isPending || !exerciseId}>
                  <Plus className="mr-2 h-4 w-4" />
                  {editingId ? "Update exercise" : "Add to home program"}
                </Button>
                {editingId && (
                  <Button variant="outline" onClick={cancelEdit}>
                    Cancel
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{assigned.length} prescribed</Badge>
            <Badge variant="secondary">{last7} completions in the last 7 days</Badge>
            <Badge variant="secondary">{doneCount} completions total</Badge>
          </div>
          
          {assigned.length > 0 && (
            <Button 
              variant="outline" 
              onClick={handleExportPDF} 
              disabled={isGeneratingPDF}
              className="shrink-0 font-semibold"
            >
              {isGeneratingPDF ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating PDF...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" /> Export as PDF
                </>
              )}
            </Button>
          )}
        </div>

        {assigned.length === 0 && (
          <p className="text-sm text-muted-foreground">No home exercise program yet.</p>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {assigned.map((pex) => {
            const todayLog = logs.find(
              (l) => l.patient_exercise_id === pex.id && l.log_date === today(),
            );
            const done = Boolean(todayLog?.completed);
            const total = logs.filter((l) => l.patient_exercise_id === pex.id && l.completed).length;
            return (
              <Card key={pex.id}>
                <CardHeader className="flex-row items-start justify-between gap-2 pb-2">
                  <div>
                    <CardTitle className="text-base">
                      {pex.exercises?.name ?? "Custom exercise"}
                    </CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {[pex.sets && `${pex.sets} sets`, pex.repetitions && `${pex.repetitions} reps`, pex.frequency]
                        .filter(Boolean)
                        .join(" · ") || "No dosage set"}
                    </p>
                  </div>
                  {canEditClinical && (
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-primary"
                        onClick={() => openEdit(pex)}
                        aria-label="Edit exercise"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          if (confirm("Are you sure you want to remove this exercise from the patient's program?")) {
                            remove.mutate(pex.id);
                          }
                        }}
                        aria-label="Remove exercise"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  {pex.notes && <p className="text-sm text-muted-foreground">{pex.notes}</p>}
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-muted-foreground">{total} sessions logged</span>
                    <Button
                      variant={done ? "default" : "outline"}
                      size="sm"
                      onClick={() =>
                        toggleToday.mutate({
                          id: pex.id,
                          ...(todayLog ? { logId: todayLog.id } : {}),
                          completed: done,
                        })
                      }
                    >
                      {done ? (
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                      ) : (
                        <Circle className="mr-2 h-4 w-4" />
                      )}
                      {done ? "Done today" : "Mark done today"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </>
  );
}
