import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, UploadCloud, CheckCircle2 } from "lucide-react";
import logo from "@/assets/physio-life-logo.png";
import { initiateTraineeDriveUpload, finalizeTraineeDriveUpload } from "@/lib/drive.functions";

export const Route = createFileRoute("/apply")({
  component: ApplyPage,
});

function ApplyPage() {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [filesData, setFilesData] = useState<Record<string, File>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);

  const { data: questions, isLoading } = useQuery({
    queryKey: ["trainee_questions_public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trainee_form_questions")
        .select("*")
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      // Basic validation
      if (!questions || questions.length === 0) {
        throw new Error("No questions available to submit.");
      }

      // Check required questions
      for (const q of questions) {
        if (q.is_required) {
          if (q.field_type === "file" && !filesData[q.id]) {
            throw new Error(`File is required for: ${q.label}`);
          }
          if (q.field_type !== "file" && !formData[q.id]) {
            throw new Error(`Answer is required for: ${q.label}`);
          }
        }
      }

      // Generate a unique submission identifier for Drive folders
      const submissionId = `Submission - ${new Date().toISOString().replace(/[:.]/g, "-")}`;

      // Upload files first
      const uploadedFiles: any[] = [];
      for (const [qId, file] of Object.entries(filesData)) {
        const initRes = await initiateTraineeDriveUpload({
          data: {
            applicantName: submissionId,
            fileName: file.name,
            mimeType: file.type,
            questionId: qId,
          },
        });
        
        const uploadRes = await fetch(initRes.url, {
          method: "PUT",
          headers: { "Content-Length": file.size.toString() },
          body: file,
        });

        if (!uploadRes.ok) throw new Error("Failed to upload file to Google Drive");
        
        const uploadData = await uploadRes.json();
        const driveFileId = uploadData.id;

        const finalRes = await finalizeTraineeDriveUpload({
          data: { driveFileId },
        });

        uploadedFiles.push({
          question_id: qId,
          drive_file_id: finalRes.driveFileId,
          drive_web_view_link: finalRes.webViewLink,
          name: file.name,
          size: file.size,
        });
      }

      // Save application to database
      const { error } = await supabase.from("trainee_applications").insert({
        applicant_name: "Applicant " + new Date().getTime().toString().slice(-4), // Fallback to avoid breaking NOT NULL if table not altered
        applicant_phone: "N/A", // Fallback to avoid breaking NOT NULL if table not altered
        applicant_email: "",
        responses: formData,
        files: uploadedFiles,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      setIsSubmitted(true);
    },
    onError: (e: any) => {
      toast.error(e.message || "Failed to submit application");
    },
  });

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-6">
            <CheckCircle2 className="mx-auto h-16 w-16 text-primary mb-4" />
            <h2 className="text-2xl font-bold mb-2">Application Submitted!</h2>
            <p className="text-muted-foreground mb-6">
              Thank you for applying. We have received your application and will contact you soon.
            </p>
            <Button onClick={() => window.location.reload()}>Submit Another Application</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary/30 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <img src={logo} alt="Physio Life Logo" className="mx-auto h-16 w-auto mb-4" />
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Trainee Application</h1>
          <p className="mt-2 text-muted-foreground">Please fill out the form below to apply for a training position.</p>
        </div>

        <Card className="shadow-lg border-t-4 border-t-primary">
          <CardContent className="p-6 sm:p-8 space-y-8">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : questions?.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No application questions are available at the moment.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {questions && questions.length > 0 && (
                  <div className="space-y-6">
                    {questions.map((q) => (
                      <div key={q.id} className="space-y-2">
                        <Label className="text-base font-medium">
                          {q.label} {q.is_required && <span className="text-destructive">*</span>}
                        </Label>
                        
                        {q.field_type === "text" && (
                          <Input 
                            value={formData[q.id] || ""} 
                            onChange={(e) => setFormData({ ...formData, [q.id]: e.target.value })} 
                          />
                        )}
                        
                        {q.field_type === "textarea" && (
                          <Textarea 
                            rows={3} 
                            value={formData[q.id] || ""} 
                            onChange={(e) => setFormData({ ...formData, [q.id]: e.target.value })} 
                          />
                        )}

                        {q.field_type === "select" && q.options && (
                          <select 
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            value={formData[q.id] || ""}
                            onChange={(e) => setFormData({ ...formData, [q.id]: e.target.value })}
                          >
                            <option value="">Select an option...</option>
                            {q.options.map((opt: string) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        )}

                        {q.field_type === "file" && (
                          <div className="border-2 border-dashed rounded-lg p-6 hover:bg-muted/50 transition-colors text-center cursor-pointer relative">
                            <Input
                              type="file"
                              accept={q.allowed_file_types || "*"}
                              onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                  setFilesData({ ...filesData, [q.id]: e.target.files[0] });
                                }
                              }}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            {filesData[q.id] ? (
                              <div className="flex flex-col items-center justify-center">
                                <CheckCircle2 className="h-8 w-8 text-primary mb-2" />
                                <span className="font-medium text-sm">{filesData[q.id].name}</span>
                                <span className="text-xs text-muted-foreground mt-1">Click to replace</span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center">
                                <UploadCloud className="h-8 w-8 text-muted-foreground mb-2" />
                                <span className="font-medium text-sm text-primary">Upload File</span>
                                <span className="text-xs text-muted-foreground mt-1">
                                  {q.allowed_file_types ? `Supported formats: ${q.allowed_file_types}` : "Click to select a file"}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <Button 
                  className="w-full h-12 text-lg mt-6" 
                  disabled={submitMutation.isPending || !questions || questions.length === 0}
                  onClick={() => submitMutation.mutate()}
                >
                  {submitMutation.isPending && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                  Submit Application
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
