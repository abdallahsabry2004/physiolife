import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Loader2, Plus, Trash2, Link as LinkIcon, Download, ExternalLink, Users } from "lucide-react";
import { deleteTraineeDriveFile } from "@/lib/drive.functions";
import { PageGuard } from "@/components/PageGuard";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/trainee-applications")({
  head: () => ({
    title: "Trainee Applications — Physio Life EMR",
    meta: [{ property: "og:title", content: "Trainee Applications — Physio Life EMR" }],
  }),
  component: TraineeApplicationsAdmin,
});

function TraineeApplicationsAdmin() {
  const { isAdmin } = useAuth();
  const { t } = useI18n();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("applications");

  // Questions State
  const { data: questions, isLoading: isLoadingQuestions } = useQuery({
    queryKey: ["trainee_form_questions_admin"],
    queryFn: async () => {
      const { data, error } = await supabase.from("trainee_form_questions").select("*").order("order_index", { ascending: true });
      if (error) throw error;
      return data || [];
    }
  });

  // Applications State
  const { data: applications, isLoading: isLoadingApplications } = useQuery({
    queryKey: ["trainee_applications_admin"],
    queryFn: async () => {
      const { data, error } = await supabase.from("trainee_applications").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    }
  });

  // Export to Excel
  const handleExport = () => {
    if (!applications || !applications.length) {
      toast.error("No applications to export");
      return;
    }
    
    // Simple CSV Export
    let csv = "Date,Submission ID";
    const allQuestionIds = questions?.map(q => q.id) || [];
    questions?.forEach(q => {
      csv += `,"${q.label.replace(/"/g, '""')}"`;
    });
    csv += ",Files\n";

    applications.forEach(app => {
      const date = new Date(app.created_at).toLocaleDateString();
      let row = `"${date}","${app.id}"`;
      
      allQuestionIds.forEach(qId => {
        const ans = app.responses?.[qId] || "";
        row += `,"${ans.toString().replace(/"/g, '""')}"`;
      });
      
      const filesCount = Array.isArray(app.files) ? app.files.length : 0;
      row += `,"${filesCount} files"`;
      
      csv += row + "\n";
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `trainee_applications_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Create/Edit Question Dialog State
  const [isQuestionDialogOpen, setIsQuestionDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<any>(null);
  
  const [qLabel, setQLabel] = useState("");
  const [qType, setQType] = useState("text");
  const [qRequired, setQRequired] = useState(false);
  
  // Options State
  const [qOptionsList, setQOptionsList] = useState<string[]>([]);
  const [newOption, setNewOption] = useState("");
  
  // File Types State
  const [qFileTypesList, setQFileTypesList] = useState<string[]>([]);

  const FILE_TYPE_PRESETS = [
    { label: "PDF Document (.pdf)", value: "application/pdf" },
    { label: "Image (.jpg, .png)", value: "image/*" },
    { label: "Word Document (.doc, .docx)", value: "application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
    { label: "Video (.mp4, .mov)", value: "video/*" },
  ];

  const openNewQuestion = () => {
    setEditingQuestion(null);
    setQLabel("");
    setQType("text");
    setQRequired(false);
    setQOptionsList([]);
    setNewOption("");
    setQFileTypesList([]);
    setIsQuestionDialogOpen(true);
  };

  const openEditQuestion = (q: any) => {
    setEditingQuestion(q);
    setQLabel(q.label);
    setQType(q.field_type);
    setQRequired(q.is_required);
    setQOptionsList(q.options || []);
    setNewOption("");
    setQFileTypesList(q.allowed_file_types ? q.allowed_file_types.split(",") : []);
    setIsQuestionDialogOpen(true);
  };

  const saveQuestionMutation = useMutation({
    mutationFn: async () => {
      if (!qLabel.trim()) throw new Error("Question label is required");
      if (qType === "select" && qOptionsList.length === 0) throw new Error("Please add at least one option for the dropdown");
      
      const payload = {
        label: qLabel,
        field_type: qType,
        is_required: qRequired,
        options: (qType === "select" || qType === "radio" || qType === "checkbox") && qOptionsList.length > 0 
          ? qOptionsList 
          : null,
        allowed_file_types: qType === "file" && qFileTypesList.length > 0 ? qFileTypesList.join(",") : null,
      };

      if (editingQuestion) {
        const { error } = await supabase.from("trainee_form_questions").update(payload).eq("id", editingQuestion.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("trainee_form_questions").insert({ ...payload, order_index: (questions?.length || 0) });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingQuestion ? "Question updated" : "Question added");
      setIsQuestionDialogOpen(false);
      qc.invalidateQueries({ queryKey: ["trainee_form_questions_admin"] });
    },
    onError: (e: any) => toast.error(e.message)
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("trainee_form_questions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Question deleted");
      qc.invalidateQueries({ queryKey: ["trainee_form_questions_admin"] });
    }
  });

  const deleteAppMutation = useMutation({
    mutationFn: async (app: any) => {
      // 1. Delete associated files from Google Drive
      if (app.files && Array.isArray(app.files)) {
        for (const file of app.files) {
          if (file.drive_file_id) {
            try {
              await deleteTraineeDriveFile({ data: { driveFileId: file.drive_file_id } });
            } catch (e) {
              console.error("Could not delete file from drive", e);
            }
          }
        }
      }
      
      // 2. Delete application record
      const { error } = await supabase.from("trainee_applications").delete().eq("id", app.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Application and associated files deleted");
      qc.invalidateQueries({ queryKey: ["trainee_applications_admin"] });
    },
    onError: (e: any) => toast.error(e.message)
  });

  const updateNoteMutation = useMutation({
    mutationFn: async ({ id, note }: { id: string, note: string }) => {
      const { error } = await supabase.from("trainee_applications").update({ admin_notes: note }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Note saved");
      qc.invalidateQueries({ queryKey: ["trainee_applications_admin"] });
    },
    onError: (e: any) => toast.error(e.message)
  });

  const [notesEditing, setNotesEditing] = useState<Record<string, string>>({});

  return (
    <PageGuard isAllowed={isAdmin}>
      <Card className="shadow-sm">
        <CardHeader className="bg-muted/30 border-b">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Trainee Applications Hub
              </CardTitle>
              <CardDescription>Manage application forms and review submissions</CardDescription>
            </div>
            <Button variant="outline" className="shrink-0" onClick={() => {
              const url = `${window.location.origin}/apply`;
              navigator.clipboard.writeText(url);
              toast.success("Public application link copied!");
            }}>
              <LinkIcon className="h-4 w-4 mr-2" /> Copy Public Link
            </Button>
          </div>
        </CardHeader>
      
      <CardContent className="p-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start rounded-none border-b h-12 bg-transparent p-0">
            <TabsTrigger value="applications" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full px-6">
              Submissions
              {applications && applications.length > 0 && (
                <span className="ml-2 bg-primary/10 text-primary px-2 py-0.5 rounded-full text-xs font-bold">
                  {applications.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="form-builder" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full px-6">
              Form Builder
            </TabsTrigger>
          </TabsList>

          <TabsContent value="applications" className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold">Recent Applications</h3>
              <Button onClick={handleExport} variant="secondary">
                <Download className="h-4 w-4 mr-2" /> Export to CSV
              </Button>
            </div>

            {isLoadingApplications ? (
              <div className="py-8 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : applications?.length === 0 ? (
              <div className="text-center py-12 border rounded-lg bg-muted/10">
                <p className="text-muted-foreground">No applications received yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {applications?.map(app => (
                  <Card key={app.id} className="overflow-hidden">
                    <div className="bg-muted/40 p-4 border-b flex justify-between items-start md:items-center flex-col md:flex-row gap-4">
                      <div>
                        <h4 className="font-semibold text-lg text-primary">Application #{app.id.substring(0, 8)}</h4>
                        <div className="text-sm text-muted-foreground flex gap-4 mt-1">
                          <span>{new Date(app.created_at).toLocaleString()}</span>
                        </div>
                      </div>
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        onClick={() => {
                          if (confirm("Delete this application AND all its files from Drive?")) {
                            deleteAppMutation.mutate(app);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" /> Delete
                      </Button>
                    </div>
                    <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <h5 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Responses</h5>
                        {questions?.map(q => {
                          const ans = app.responses?.[q.id];
                          if (!ans) return null;
                          return (
                            <div key={q.id}>
                              <div className="text-sm font-medium">{q.label}</div>
                              <div className="text-sm mt-1 bg-secondary/20 p-2 rounded">{ans}</div>
                            </div>
                          );
                        })}
                      </div>
                      
                      <div className="space-y-4">
                        {app.files && Array.isArray(app.files) && app.files.length > 0 && (
                          <div className="space-y-4 mb-6">
                            <h5 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Uploaded Files</h5>
                            <div className="space-y-2">
                              {app.files.map((f: any, idx: number) => (
                                <a 
                                  key={idx} 
                                  href={f.drive_web_view_link} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                                >
                                  <ExternalLink className="h-5 w-5 text-primary" />
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium truncate">{f.name}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {(f.size / 1024 / 1024).toFixed(2)} MB
                                    </div>
                                  </div>
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="space-y-2">
                          <h5 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Admin Notes</h5>
                          <Textarea 
                            placeholder="Add private notes about this applicant..."
                            value={notesEditing[app.id] !== undefined ? notesEditing[app.id] : (app.admin_notes || "")}
                            onChange={(e) => setNotesEditing({ ...notesEditing, [app.id]: e.target.value })}
                            rows={3}
                          />
                          <Button 
                            variant="secondary" 
                            size="sm" 
                            onClick={() => {
                              const note = notesEditing[app.id] !== undefined ? notesEditing[app.id] : (app.admin_notes || "");
                              updateNoteMutation.mutate({ id: app.id, note });
                            }}
                            disabled={updateNoteMutation.isPending && updateNoteMutation.variables?.id === app.id}
                          >
                            {updateNoteMutation.isPending && updateNoteMutation.variables?.id === app.id ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : null}
                            Save Note
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="form-builder" className="p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-semibold">Form Questions</h3>
                <p className="text-sm text-muted-foreground">Basic info (Name, Phone, Email) is always required automatically.</p>
              </div>
              <Button onClick={openNewQuestion}>
                <Plus className="h-4 w-4 mr-2" /> Add Question
              </Button>
            </div>

            {isLoadingQuestions ? (
               <div className="py-8 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : questions?.length === 0 ? (
              <div className="text-center py-12 border rounded-lg border-dashed">
                <p className="text-muted-foreground mb-4">No custom questions added yet.</p>
                <Button variant="outline" onClick={openNewQuestion}>Create your first question</Button>
              </div>
            ) : (
              <div className="space-y-3">
                {questions?.map((q, index) => (
                  <div key={q.id} className="flex items-center justify-between p-4 border rounded-lg bg-card hover:shadow-sm transition-shadow">
                    <div className="flex items-center gap-4">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-sm font-medium">
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {q.label}
                          {q.is_required && <span className="text-xs text-destructive font-bold">*Required</span>}
                        </div>
                        <div className="text-sm text-muted-foreground capitalize mt-1">
                          Type: {q.field_type} 
                          {q.options && ` (${q.options.length} options)`}
                          {q.allowed_file_types && ` - Accepts: ${q.allowed_file_types}`}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openEditQuestion(q)}>Edit</Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          if (confirm("Delete this question?")) deleteQuestionMutation.mutate(q.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      <Dialog open={isQuestionDialogOpen} onOpenChange={setIsQuestionDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingQuestion ? "Edit Question" : "Add New Question"}</DialogTitle>
            <DialogDescription>Configure how this question appears to applicants.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Question Text</Label>
              <Input value={qLabel} onChange={e => setQLabel(e.target.value)} placeholder="e.g. Why do you want to join us?" />
            </div>
            
            <div className="space-y-2">
              <Label>Answer Type</Label>
              <Select value={qType} onValueChange={setQType}>
                <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Short Text</SelectItem>
                  <SelectItem value="textarea">Long Text (Paragraph)</SelectItem>
                  <SelectItem value="select">Dropdown (Select one)</SelectItem>
                  <SelectItem value="file">File Upload (CV, Image, etc.)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {qType === "select" && (
              <div className="space-y-4">
                <Label>Dropdown Options</Label>
                <div className="flex gap-2">
                  <Input 
                    value={newOption} 
                    onChange={e => setNewOption(e.target.value)} 
                    placeholder="Type an option..." 
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (newOption.trim()) {
                          setQOptionsList([...qOptionsList, newOption.trim()]);
                          setNewOption("");
                        }
                      }
                    }}
                  />
                  <Button 
                    type="button" 
                    variant="secondary"
                    onClick={() => {
                      if (newOption.trim()) {
                        setQOptionsList([...qOptionsList, newOption.trim()]);
                        setNewOption("");
                      }
                    }}
                  >
                    Add
                  </Button>
                </div>
                {qOptionsList.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {qOptionsList.map((opt, i) => (
                      <div key={i} className="flex items-center gap-1 bg-secondary text-secondary-foreground px-3 py-1 rounded-full text-sm">
                        <span>{opt}</span>
                        <button 
                          type="button" 
                          onClick={() => setQOptionsList(qOptionsList.filter((_, idx) => idx !== i))}
                          className="ml-1 text-muted-foreground hover:text-destructive"
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {qType === "file" && (
              <div className="space-y-3">
                <Label>Allowed File Types</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                  {FILE_TYPE_PRESETS.map((preset) => {
                    const isChecked = qFileTypesList.includes(preset.value);
                    return (
                      <div key={preset.value} className="flex items-center space-x-2 border p-3 rounded-md hover:bg-muted/50">
                        <Checkbox 
                          id={`ft-${preset.value}`} 
                          checked={isChecked}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setQFileTypesList([...qFileTypesList, preset.value]);
                            } else {
                              setQFileTypesList(qFileTypesList.filter(v => v !== preset.value));
                            }
                          }}
                        />
                        <Label htmlFor={`ft-${preset.value}`} className="flex-1 cursor-pointer">{preset.label}</Label>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground mt-2">Leave all unchecked to allow any file type.</p>
              </div>
            )}

            <div className="flex items-center space-x-2 pt-2">
              <Checkbox id="required" checked={qRequired} onCheckedChange={(c) => setQRequired(!!c)} />
              <Label htmlFor="required">Required field</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsQuestionDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => saveQuestionMutation.mutate()} disabled={saveQuestionMutation.isPending}>
              {saveQuestionMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Question
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </Card>
    </PageGuard>
  );
}
