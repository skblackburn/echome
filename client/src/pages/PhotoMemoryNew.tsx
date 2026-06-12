// Photo upload — part of the Folder flow.
// Must be reached via /photos/new?persona=<id> from the Folder.
// No global Echo selection. Returns to the Folder on completion.

import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Camera, Upload, Loader2, CheckCircle2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Persona, PhotoMemory } from "@shared/schema";

type Step = "upload" | "loading" | "questions" | "done";

export default function PhotoMemoryNew() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Persona MUST come from the ?persona= query param (set by Folder → Add Memory → Upload Photo)
  const personaId = new URLSearchParams(search).get("persona") || "";

  // If no persona param, redirect back to dashboard — this page must be reached from a Folder
  if (!personaId) {
    navigate("/dashboard");
    return null;
  }

  const backTo = `/persona/${personaId}/folder`;

  const [step, setStep] = useState<Step>("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [photoMemory, setPhotoMemory] = useState<PhotoMemory | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [photoDragOver, setPhotoDragOver] = useState(false);

  const { data: persona } = useQuery<Persona>({
    queryKey: ["/api/personas", parseInt(personaId)],
    queryFn: async () => {
      const res = await fetch(`/api/personas/${personaId}`);
      return res.json();
    },
    enabled: !!personaId,
  });

  const { data: userPrefs } = useQuery<{ aiPhotoPromptsEnabled: boolean }>({
    queryKey: ["/api/user/preferences"],
  });
  const aiPromptsEnabled = userPrefs?.aiPhotoPromptsEnabled ?? true;

  const firstName = persona?.name?.split(" ")[0] || "their";

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("photo", file);
      formData.append("personaId", personaId);
      const res = await fetch("/api/photo-memories", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || "Upload failed");
      }
      return res.json() as Promise<PhotoMemory>;
    },
    onSuccess: (data) => {
      setPhotoMemory(data);
      setStep("questions");
    },
    onError: (err: Error) => {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
      setStep("upload");
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ id, userResponses }: { id: number; userResponses: Array<{ question: string; answer: string }> }) => {
      const res = await apiRequest("PUT", `/api/photo-memories/${id}`, { userResponses, status: "complete" });
      return res.json() as Promise<PhotoMemory>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personas", parseInt(personaId), "folder"] });
      queryClient.invalidateQueries({ queryKey: ["/api/photo-memories"] });
      setStep("done");
    },
    onError: (err: Error) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
  });

  const handleFileSelect = (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum size is 10MB", variant: "destructive" });
      return;
    }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleUpload = () => {
    if (!selectedFile) return;
    setStep("loading");
    uploadMutation.mutate(selectedFile);
  };

  const handleSave = () => {
    if (!photoMemory) return;
    const questions = (photoMemory.aiPrompts as string[]) || [];
    const userResponses = questions
      .map((q, i) => ({ question: q, answer: answers[i] || "" }))
      .filter(r => r.answer.trim());

    if (userResponses.length === 0) {
      toast({ title: "Please answer at least one question", variant: "destructive" });
      return;
    }
    saveMutation.mutate({ id: photoMemory.id, userResponses });
  };

  return (
    <Layout backTo={backTo} backLabel="Folder" title="Add Photo">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Step: Upload */}
        {step === "upload" && (
          <Card className="p-6 space-y-5">
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-foreground">Add a photo to {firstName}'s Folder</h2>
              <p className="text-sm text-muted-foreground">
                JPG, PNG, or WebP up to 10MB.{aiPromptsEnabled ? " AI will generate questions to help capture the story behind it." : ""}
              </p>
            </div>

            {previewUrl ? (
              <div className="space-y-4">
                <div className="rounded-xl overflow-hidden border border-border">
                  <img src={previewUrl} alt="Preview" className="w-full max-h-80 object-contain bg-muted" />
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => fileInputRef.current?.click()}>
                    Choose different
                  </Button>
                  <Button className="flex-1 gap-2" onClick={handleUpload}>
                    <Upload className="h-4 w-4" />
                    {aiPromptsEnabled ? "Upload & generate questions" : "Upload photo"}
                  </Button>
                </div>
              </div>
            ) : (
              <div
                className={`border-2 border-dashed rounded-xl p-14 text-center cursor-pointer transition-colors ${photoDragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/30"}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setPhotoDragOver(true); }}
                onDragEnter={e => { e.preventDefault(); setPhotoDragOver(true); }}
                onDragLeave={() => setPhotoDragOver(false)}
                onDrop={e => {
                  e.preventDefault();
                  setPhotoDragOver(false);
                  const file = e.dataTransfer.files[0];
                  if (file) handleFileSelect(file);
                }}
              >
                <Camera className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">
                  {photoDragOver ? "Drop photo here" : "Click or drag a photo here"}
                </p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
            />
          </Card>
        )}

        {/* Step: Loading */}
        {step === "loading" && (
          <Card className="p-14 text-center space-y-4">
            <Loader2 className="h-10 w-10 mx-auto text-primary animate-spin" />
            <div>
              <h3 className="font-medium text-foreground">
                {aiPromptsEnabled ? "Analyzing your photo…" : "Uploading your photo…"}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {aiPromptsEnabled ? "Generating thoughtful questions about this moment" : "Just a moment…"}
              </p>
            </div>
          </Card>
        )}

        {/* Step: Answer questions */}
        {step === "questions" && photoMemory && (
          <div className="space-y-5">
            <div className="rounded-xl overflow-hidden border border-border">
              <img
                src={`/api/photo-memories/photo/${photoMemory.id}`}
                alt="Your photo"
                className="w-full max-h-64 object-contain bg-muted"
              />
            </div>

            <Card className="p-6 space-y-5">
              <div>
                <h2 className="text-base font-semibold text-foreground">Tell us about this photo</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Answer the questions below to preserve the story behind it.
                </p>
              </div>

              {((photoMemory.aiPrompts as string[]) || []).map((question, i) => (
                <div key={i} className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{question}</label>
                  <Textarea
                    value={answers[i] || ""}
                    onChange={(e) => setAnswers(prev => ({ ...prev, [i]: e.target.value }))}
                    placeholder="Write your answer…"
                    rows={3}
                  />
                </div>
              ))}

              <Button className="w-full gap-2" onClick={handleSave} disabled={saveMutation.isPending}>
                {saveMutation.isPending
                  ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</>
                  : "Save photo memory"}
              </Button>
            </Card>
          </div>
        )}

        {/* Step: Done */}
        {step === "done" && (
          <Card className="p-14 text-center space-y-5">
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
            <div>
              <h3 className="text-base font-semibold text-foreground">Photo saved to {firstName}'s Folder</h3>
              <p className="text-sm text-muted-foreground mt-1">It will appear in the Photos tab.</p>
            </div>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => navigate(backTo)}>
                Back to Folder
              </Button>
              <Button
                className="gap-2"
                onClick={() => {
                  setStep("upload");
                  setSelectedFile(null);
                  setPreviewUrl("");
                  setPhotoMemory(null);
                  setAnswers({});
                }}
              >
                <Plus className="h-4 w-4" />
                Add another photo
              </Button>
            </div>
          </Card>
        )}
      </div>
    </Layout>
  );
}
