import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { logActivityAsync } from "@/lib/logger"; // إضافة دالة المراقبة
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/exercises")({
  head: () => ({
    meta: [
      { title: "Exercise Library — Physio Life EMR" },
      {
        name: "description",
        content:
          "Build the clinic exercise library with categories, target muscles, dosage, media and progressions to assign as home programs.",
      },
      { property: "og:title", content: "Exercise Library — Physio Life EMR" },
      { property: "og:description", content: "Reusable therapeutic exercises and home programs." },
    ],
  }),
  component: ExercisesPage,
});

const empty = {
  name: "",
  category: "",
  target_muscle: "",
  difficulty: "",
  sets: "",
  repetitions: "",
  frequency: "",
  description: "",
  instructions: "",
  video_url: "",
};

function ExercisesPage() {
  const { canEditClinical, user, fullName } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState(empty);
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: exercises = [] } = useQuery({
    queryKey: ["exercises"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercises")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingId) {
        // جلب البيانات القديمة للتوثيق
        const oldExercise = exercises.find(e => e.id === editingId);
        
        // تحديث تمرين موجود
        const { error } = await supabase
          .from("exercises")
          .update({ ...form })
          .eq("id", editingId);
        if (error) throw error;
        
        // توثيق التعديل
        logActivityAsync({
          user_id: user?.id,
          user_name: fullName,
          action: "UPDATE_EXERCISE",
          entity: `Exercise Library (${form.name})`,
          details: { old_data: oldExercise, new_data: form }
        });
      } else {
        // إضافة تمرين جديد
        const { error } = await supabase
          .from("exercises")
          .insert({ ...form, created_by: user?.id ?? null });
        if (error) throw error;
        
        // توثيق الإضافة
        logActivityAsync({
          user_id: user?.id,
          user_name: fullName,
          action: "ADD_EXERCISE",
          entity: `Exercise Library (${form.name})`
        });
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Exercise updated" : "Exercise added");
      setForm(empty);
      setEditingId(null);
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["exercises"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const oldEx = exercises.find(e => e.id === id);
      const { error } = await supabase.from("exercises").delete().eq("id", id);
      if (error) throw error;
      
      // توثيق الحذف
      logActivityAsync({
        user_id: user?.id,
        user_name: fullName,
        action: "DELETE_EXERCISE",
        entity: `Exercise Library (${oldEx?.name || "Unknown"})`,
      });
    },
    onSuccess: () => {
      toast.success("Exercise deleted");
      void qc.invalidateQueries({ queryKey: ["exercises"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openEdit = (exercise: any) => {
    setForm({
      name: exercise.name || "",
      category: exercise.category || "",
      target_muscle: exercise.target_muscle || "",
      difficulty: exercise.difficulty || "",
      sets: exercise.sets || "",
      repetitions: exercise.repetitions || "",
      frequency: exercise.frequency || "",
      description: exercise.description || "",
      instructions: exercise.instructions || "",
      video_url: exercise.video_url || "",
    });
    setEditingId(exercise.id);
    setOpen(true);
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setForm(empty);
      setEditingId(null);
    }
  };

  const filtered = exercises.filter(
    (e) =>
      !term ||
      e.name.toLowerCase().includes(term.toLowerCase()) ||
      (e.category ?? "").toLowerCase().includes(term.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Exercise library</h1>
          <p className="text-sm text-muted-foreground">
            Reusable exercises with dosage, media and progressions.
          </p>
        </div>
        {canEditClinical && (
          <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Add exercise
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingId ? "Edit exercise" : "New exercise"}</DialogTitle>
              </DialogHeader>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  saveMutation.mutate();
                }}
              >
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {(
                    [
                      ["category", "Category"],
                      ["target_muscle", "Target muscle"],
                      ["difficulty", "Difficulty"],
                      ["sets", "Sets"],
                      ["repetitions", "Repetitions"],
                      ["frequency", "Frequency"],
                    ] as const
                  ).map(([key, label]) => (
                    <div key={key} className="space-y-2">
                      <Label>{label}</Label>
                      <Input
                        value={form[key as keyof typeof form]}
                        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                      />
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <Label>Instructions</Label>
                  <Textarea
                    rows={3}
                    value={form.instructions}
                    onChange={(e) => setForm({ ...form, instructions: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Video link</Label>
                  <Input
                    value={form.video_url}
                    onChange={(e) => setForm({ ...form, video_url: e.target.value })}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Saving..." : "Save exercise"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </header>

      <Input
        placeholder="Search exercises…"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        className="max-w-sm"
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground">No exercises yet.</p>
        )}
        {filtered.map((e) => (
          <Card key={e.id}>
            <CardContent className="space-y-2 pt-6 relative">
              {canEditClinical && (
                <div className="absolute top-4 right-4 flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(e)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => {
                      if (confirm("Are you sure you want to delete this exercise?")) {
                        deleteMutation.mutate(e.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              )}
              <div className="flex items-start justify-between gap-2 pr-16">
                <p className="font-semibold">{e.name}</p>
                {e.difficulty && <Badge variant="secondary">{e.difficulty}</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">
                {[e.category, e.target_muscle].filter(Boolean).join(" · ") || "Uncategorised"}
              </p>
              {e.instructions && <p className="text-sm">{e.instructions}</p>}
              <p className="text-xs text-muted-foreground">
                {[e.sets && `${e.sets} sets`, e.repetitions && `${e.repetitions} reps`, e.frequency]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
