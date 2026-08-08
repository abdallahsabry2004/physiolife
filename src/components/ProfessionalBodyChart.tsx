import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider"; // تم إضافة الـ Slider للتحكم في الحجم

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
  
  const [activeMarkType, setActiveMarkType] = useState("Pain");
  const [currentView, setCurrentView] = useState("anterior");
  
  // State للتحكم في حجم العلامات (افتراضي 75%)
  const [markerSize, setMarkerSize] = useState([75]);

  // إضافة currentView للـ queryKey عشان نفصل علامات الأمام عن الخلف
  const queryKey = ["body_marks", patientId, sessionId ?? "general", currentView];

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
      <div className="flex flex-wrap items-center justify-between gap-4 bg-card p-4 rounded-xl border">
        
        {/* أزرار التبديل بين الأمام والخلف */}
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

        {/* أنواع العلامات */}
        <div className="flex flex-wrap gap-1.5 flex-1 justify-center md:justify-start md:ml-4">
          {MARK_TYPES.map((m) => (
            <button
              key={m.label}
              onClick={() => setActiveMarkType(m.label)}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition border ${
                activeMarkType === m.label
                  ? "ring-2 ring-ring border-transparent font-bold " + m.color
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* أداة التحكم في حجم العلامات */}
        <div className="flex items-center gap-3 border-l pl-4 rtl:border-r rtl:border-l-0 rtl:pr-4 rtl:pl-0 min-w-[140px]">
          <span className="text-[11px] text-muted-foreground whitespace-nowrap font-medium">
            Marker Size
          </span>
          <Slider
            value={markerSize}
            onValueChange={setMarkerSize}
            min={30}
            max={150}
            step={5}
            className="w-20"
          />
        </div>
      </div>

      {/* منطقة الرسم */}
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
          <img
            src={
              currentView === "anterior"
                ? "https://6a7798db51198decb752101a.imgix.net/sandbox/anterior%20body.jpg"
                : "https://6a7798db51198decb752101a.imgix.net/posterior%20body.jpg"
            }
            alt="Anatomical Body Chart"
            className="h-full w-full object-contain opacity-75 dark:opacity-50 pointer-events-none select-none"
          />

          {marks.map((m) => {
            const markConfig = MARK_TYPES.find((t) => t.label === m.mark_type);
            return (
              <div
                key={m.id}
                style={{ left: `${m.x}%`, top: `${m.y}%` }}
                className="absolute z-10"
              >
                {/* 
                  تم تطبيق scale بناءً على قيمة الـ Slider. 
                  الـ translate(-50%, -50%) بيضمن إن سنتر العلامة هو نفس نقطة الألم بالظبط 
                */}
                <div 
                  className="flex flex-col items-center justify-center transition-transform duration-200"
                  style={{ transform: `translate(-50%, -50%) scale(${markerSize[0] / 100})` }}
                >
                  <span
                    className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold shadow-md transition-transform hover:scale-105 cursor-default ${
                      markConfig?.color ?? "bg-primary text-primary-foreground"
                    }`}
                  >
                    {m.mark_type}
                    {canEditClinical && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation(); 
                          removeMark.mutate(m.id);
                        }}
                        className="ml-0.5 rounded-full p-0.5 bg-black/20 hover:bg-black/40 text-white transition-colors cursor-pointer"
                        aria-label="Delete marker"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </span>
                  {/* نقطة دقيقة جداً في المركز عشان تبين مكان الكليك الفعلي */}
                  <div className="absolute w-1 h-1 bg-black rounded-full opacity-30 z-[-1]" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Select a symptom category above, then click anywhere on the anatomical body chart to log it. Click the (x) on any marker to delete it. Adjust the size slider for pinpoint accuracy.
      </p>
    </div>
  );
}
