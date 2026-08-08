import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Circle, Plus, Trash2, Pencil } from "lucide-react"; // تم إضافة Pencil
import { toast } from "sonner";
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

const today = () => new Date().toISOString().slice(0, 10);

export function PatientExercises({ patientId }: { patientId: string }) {
  const { user, canEditClinical } = useAuth();
  const qc = useQueryClient();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [exerciseId, setExerciseId] = useState("");
  const [sets, setSets] = useState("");
  const [reps, setReps] = useState("");
  const [frequency, setFrequency] = useState("");
  const [notes, setNotes] = useState("");

  const { data: library = [] } = useQuery({
    queryKey: ["exercise-library"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercises")
        .select("id, name, category")
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
        // تحديث التمرين الحالي
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
        // إضافة تمرين جديد
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
      setExerciseId("");
      setSets("");
      setReps("");
      setFrequency("");
      setNotes("");
      setEditingId(null);
      toast.success(editingId ? "Exercise updated successfully" : "Exercise added to the home program");
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

  // دالة لتجهيز بيانات التمرين في الـ Form عشان نعدلها
  const openEdit = (pex: any) => {
    setEditingId(pex.id);
    setExerciseId(pex.exercise_id || "");
    setSets(pex.sets || "");
    setReps(pex.repetitions || "");
    setFrequency(pex.frequency || "");
    setNotes(pex.notes || "");
    window.scrollTo({ top: 0, behavior: 'smooth' }); // عشان يطلع يشوف الـ Form فوق
  };

  const cancelEdit = () => {
    setEditingId(null);
    setExerciseId("");
    setSets("");
    setReps("");
    setFrequency("");
    setNotes("");
  };

  const doneCount = logs.filter((l) => l.completed).length;
  const last7 = logs.filter(
    (l) => l.completed && l.log_date >= new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10),
  ).length;

  return (
    <div className="space-y-6">
      {canEditClinical && (
        <Card className={editingId ? "border-primary" : ""}>
          <CardHeader>
            <CardTitle className="text-base">
              {editingId ? "Edit prescribed exercise" : "Prescribe an exercise"}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Exercise from the library</Label>
              <Select value={exerciseId} onValueChange={setExerciseId}>
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
                {assign.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
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

      <div className="flex flex-wrap gap-2 print:hidden">
        <Badge variant="secondary">{assigned.length} prescribed</Badge>
        <Badge variant="secondary">{last7} completions in the last 7 days</Badge>
        <Badge variant="secondary">{doneCount} completions total</Badge>
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
  );
}
