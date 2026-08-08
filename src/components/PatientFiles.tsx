import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { deletePatientFile, uploadPatientFile } from "@/lib/drive.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CATEGORIES = [
  "X-ray",
  "MRI",
  "CT scan",
  "Ultrasound",
  "EMG / NCS",
  "Lab report",
  "Medical report",
  "Referral",
  "Photo",
  "Video",
  "Other",
];

function toBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("Could not read the file"));
    reader.readAsDataURL(file);
  });
}

export function PatientFiles({ patientId }: { patientId: string }) {
  const { canEditClinical } = useAuth();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState("X-ray");

  const upload = useServerFn(uploadPatientFile);
  const removeFile = useServerFn(deletePatientFile);

  const { data: files = [] } = useQuery({
    queryKey: ["files", patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_files")
        .select("id, file_name, category, drive_web_view_link, size_bytes, created_at")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (fileList: File[]) => {
      for (const file of fileList) {
        // تم إزالة شرط حجم الملف (20MB) من هنا
        const content = await toBase64(file);
        await upload({
          data: {
            patientId,
            category,
            fileName: file.name,
            mimeType: file.type || "application/octet-stream",
            content,
          },
        });
      }
    },
    onSuccess: () => {
      toast.success("Uploaded to the clinic Google Drive");
      void qc.invalidateQueries({ queryKey: ["files", patientId] });
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => {
      if (inputRef.current) inputRef.current.value = "";
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (fileId: string) => {
      await removeFile({ data: { fileId } });
    },
    onSuccess: () => {
      toast.success("File removed");
      void qc.invalidateQueries({ queryKey: ["files", patientId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      {canEditClinical && (
        <Card className="border-dashed">
          <CardContent className="space-y-4 pt-6">
            <div className="grid gap-4 sm:grid-cols-[200px_1fr] sm:items-end">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  File type
                </Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Choose files
                </Label>
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="file"
                    multiple
                    disabled={uploadMutation.isPending}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-secondary file:px-3 file:py-1 file:text-xs file:font-medium"
                    onChange={(e) => {
                      const picked = Array.from(e.target.files ?? []);
                      if (picked.length) uploadMutation.mutate(picked);
                    }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={uploadMutation.isPending}
                    onClick={() => inputRef.current?.click()}
                  >
                    {uploadMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Files upload automatically to the clinic Google Drive, filed under this patient and
              file type, and stay linked to the record.
            </p>
          </CardContent>
        </Card>
      )}

      {files.length === 0 && (
        <p className="text-sm text-muted-foreground">No files attached to this record yet.</p>
      )}

      {files.map((f) => (
        <div
          key={f.id}
          className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3 text-sm"
        >
          <div className="min-w-0">
            <p className="truncate font-medium">{f.file_name}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(f.created_at).toLocaleDateString()}
              {f.size_bytes ? ` · ${Math.max(1, Math.round(f.size_bytes / 1024))} KB` : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant="secondary">{f.category}</Badge>
            <a
              href={f.drive_web_view_link ?? "#"}
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground transition hover:text-primary"
              aria-label={`Open ${f.file_name}`}
            >
              <ExternalLink className="h-4 w-4" />
            </a>
            {canEditClinical && (
              <button
                onClick={() => deleteMutation.mutate(f.id)}
                className="text-muted-foreground transition hover:text-destructive"
                aria-label={`Delete ${f.file_name}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
