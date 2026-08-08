// src/components/PatientFiles.tsx
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { deletePatientFile, initiateDriveUpload, saveFileRecord } from "@/lib/drive.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
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

const formatBytes = (bytes: number) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

export function PatientFiles({ patientId }: { patientId: string }) {
  const { canEditClinical } = useAuth();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState("X-ray");

  const [uploadStats, setUploadStats] = useState<{
    progress: number;
    uploadedBytes: number;
    totalBytes: number;
    speed: string;
    fileName: string;
  } | null>(null);

  const initUpload = useServerFn(initiateDriveUpload);
  const saveRecord = useServerFn(saveFileRecord);
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
        // 1. السيرفر بيكلم جوجل ويجيب الرابط المؤقت للرفع المباشر (مع إرسال مسار الموقع الحالي)
        const { uploadUrl, storageAccountId } = await initUpload({
          data: { 
            patientId, 
            category,
            fileName: file.name,
            mimeType: file.type || "application/octet-stream",
            origin: window.location.origin // تم إضافة السطر ده
          },
        });

        if (!uploadUrl) throw new Error("Failed to get upload URL from server.");

        // 2. المتصفح بيرفع الملف الخام للرابط مباشرة باستخدام XMLHttpRequest لتتبع التقدم
        const driveData = await new Promise<any>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", uploadUrl); // يتم الرفع بطريقة الـ PUT

          let lastTime = Date.now();
          let lastLoaded = 0;
          let currentSpeed = "0 KB/s";

          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const now = Date.now();
              const timeDiff = (now - lastTime) / 1000;

              if (timeDiff > 0.5) {
                const speedBps = (event.loaded - lastLoaded) / timeDiff;
                if (speedBps > 1024 * 1024) {
                  currentSpeed = `${(speedBps / (1024 * 1024)).toFixed(2)} MB/s`;
                } else {
                  currentSpeed = `${(speedBps / 1024).toFixed(2)} KB/s`;
                }
                lastTime = now;
                lastLoaded = event.loaded;
              }

              setUploadStats({
                progress: Math.round((event.loaded / event.total) * 100),
                uploadedBytes: event.loaded,
                totalBytes: event.total,
                speed: currentSpeed,
                fileName: file.name,
              });
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(JSON.parse(xhr.responseText));
            } else {
              reject(new Error(`Upload failed: ${xhr.statusText}`));
            }
          };

          xhr.onerror = () => reject(new Error("Network error during upload."));

          // يتم إرسال الملف مباشرة
          xhr.send(file);
        });

        // 3. حفظ بيانات الملف في قاعدة البيانات
        await saveRecord({
          data: {
            patientId,
            category,
            fileName: file.name,
            mimeType: file.type || "application/octet-stream",
            size: Number(driveData.size || file.size),
            driveFileId: driveData.id,
            webViewLink: driveData.webViewLink || `https://drive.google.com/file/d/${driveData.id}/view`,
            storageAccountId: storageAccountId,
          },
        });
      }
    },
    onSuccess: () => {
      toast.success("Files uploaded successfully");
      setUploadStats(null);
      void qc.invalidateQueries({ queryKey: ["files", patientId] });
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setUploadStats(null);
    },
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

            {uploadMutation.isPending && uploadStats && (
              <div className="space-y-2 mt-4 rounded-lg border bg-secondary/30 p-4">
                <div className="flex justify-between text-xs font-medium">
                  <span className="truncate max-w-[70%]">Uploading {uploadStats.fileName}...</span>
                  <span>{uploadStats.progress}%</span>
                </div>
                <Progress value={uploadStats.progress} className="h-2 w-full" />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>
                    {formatBytes(uploadStats.uploadedBytes)} / {formatBytes(uploadStats.totalBytes)}
                  </span>
                  <span>Speed: {uploadStats.speed}</span>
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Files upload automatically and directly to the clinic Google Drive without size limits.
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
              {f.size_bytes ? ` · ${formatBytes(f.size_bytes)}` : ""}
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
