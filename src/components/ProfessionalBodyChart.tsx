import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

type Props = {
  patientId: string;
  sessionId?: string;
};

const MARK_TYPES = [
  { label: "Pain", color: "bg-red-500 text-white" },
  { label: "Swelling", color: "bg-blue-500 text-white" },
  { label: "Spasm", color: "bg-amber-500 text-white" },
  { label: "Numbness", color: "bg-purple-500 text-white" },
  { label: "Weakness", color: "bg-orange-500 text-white" },
  { label: "Trigger Point", color: "bg-pink-500 text-white" },
];

export function ProfessionalBodyChart({ patientId, sessionId }: Props) {
  const { canEditClinical, user } = useAuth();
  const qc = useQueryClient();
  
  // اختيار نوع العلامة الحالية (ألم، تورم، إلخ)
  const [activeMarkType, setActiveMarkType] = useState("Pain");
  // العرض الحالي: هل الجسم من الأمام ولا من الخلف؟
  const [currentView, setCurrentView] = useState("anterior");
  const queryKey = ["body_marks", patientId, sessionId ?? "general"];

  // جلب العلامات المسجلة مسبقاً من قاعدة البيانات
  const { data: marks = [] } = useQuery({
    queryKey,
    queryFn: async () => {
      let q = supabase
        .from("body_chart_marks")
        .select("id, mark_type, x, y, view, note")
        .eq("patient_id", patientId)
        .eq("view", currentView);
      
      if (sessionId) {
        q = q.eq("session_id", sessionId);
      } else {
        q = q.is("session_id", null);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  // إضافة علامة جديدة عند النقر على الصورة
  const addMark = useMutation({
    mutationFn: async (pos: { x: number; y: number }) => {
      const { error } = await supabase.from("body_chart_marks").insert({
        patient_id: patientId,
        session_id: sessionId ?? null,
        mark_type: activeMarkType,
        view: currentView,
        x: pos.x,
        y: pos.y,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // حذف علامة تم وضعها بالخطأ
  const removeMark = useMutation({
    mutationFn: async (markId: string) => {
      const { error } = await supabase.from("body_chart_marks").delete().eq("id", markId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Marker removed");
      void qc.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      {/* أدوات التحكم في العرض (أمام / خلف) وتحديد نوع الإصابة */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-card p-4 rounded-xl border">
        <div className="flex items-center gap-2">
          <Button
            variant={currentView === "anterior" ? "default" : "outline"}
            size="sm"
            onClick={() => setCurrentView("anterior")}
          >
            Anterior (Front)
          </Button>
          <Button
            variant={currentView === "posterior" ? "default" : "outline"}
            size="sm"
            onClick={() => setCurrentView("posterior")}
          >
            Posterior (Back)
          </Button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {MARK_TYPES.map((m) => (
            <button
              key={m.label}
              onClick={() => setActiveMarkType(m.label)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition border ${
                activeMarkType === m.label
                  ? "ring-2 ring-ring border-transparent font-bold " + m.color
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* منطقة الرسم والتفاعل الواقعية */}
      <div className="relative mx-auto flex justify-center bg-secondary/20 p-6 rounded-2xl border">
        <div
          className="relative h-[600px] w-full max-w-md cursor-crosshair rounded-xl overflow-hidden shadow-inner bg-white dark:bg-zinc-950 flex items-center justify-center border"
          onClick={(e) => {
            if (!canEditClinical) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const x = Number((((e.clientX - rect.left) / rect.width) * 100).toFixed(2));
            const y = Number((((e.clientY - rect.top) / rect.height) * 100).toFixed(2));
            addMark.mutate({ x, y });
          }}
        >
          {/* صورة تشریحیة واقعية تعبيرية تعتمد على الجانب (أمام أو خلف) */}
          <img
            src={
              currentView === "anterior"
                ? "https://images.unsplash.com/photo-1584017911766-d451b3d0e843?auto=format&fit=crop&q=80&w=600" // مثال لصورة تشريحية أمامية واضحة
                : "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&q=80&w=600" // مثال لصورة تشريحية خلفية واضحة
            }
            alt="Anatomical Body Chart"
            className="h-full w-full object-contain opacity-75 dark:opacity-50 pointer-events-none select-none"
          />

          {/* عرض العلامات المسجلة بدقة على الجسم */}
          {marks.map((m) => {
            const markConfig = MARK_TYPES.find((t) => t.label === m.mark_type);
            return (
              <div
                key={m.id}
                style={{ left: `${m.x}%`, top: `${m.y}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 group z-10"
              >
                <span
                  className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold shadow-lg transition-transform hover:scale-110 ${
                    markConfig?.color ?? "bg-primary text-primary-foreground"
                  }`}
                >
                  {m.mark_type}
                  {canEditClinical && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation(); // منع تفاعل النقر الأساسي للصورة
                        removeMark.mutate(m.id);
                      }}
                      className="ml-1 rounded-full p-0.5 hover:bg-black/20 text-white transition-colors"
                      aria-label="Delete marker"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Select a symptom category above, then click anywhere on the anatomical body chart to log it. Click the (x) on any marker to delete it.
      </p>
    </div>
  );
}
