import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, Upload, Loader2, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Persona, PhotoMemory } from "@shared/schema";

type Step = "select-persona" | "upload" | "loading" | "questions" | "done";

export default function PhotoMemoryNew() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("select-persona");
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [photoMemory, setPhotoMemory] = useState<PhotoMemory | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [photoDragOver, setPhotoDragOver] = useState(false);

  const { data: personas = [] } = useQuery<Persona[]>({
    queryKey: ["/api/personas"],
  });

  const { data: limits } = useQuery<{ plan: string; limit: number | null; current: number; remaining: number | null }>({
    queryKey: ["/api/photo-memories/limits"],
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ file, personaId }: { file: File; personaId: number }) => {
      const formData = new FormData();
      formData.append("photo", file);
      formData.append("personaId", String(personaId));

      const res = await fetch("/api/photo-memories", {
        method: "POST",
        body: formData,
      });
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
      const res = await apiRequest("PUT", `/api/photo-memories/${id}`, {
        userResponses,
        status: "complete",
      });
      return res.json() as Promise<PhotoMemory>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/photo-memories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/photo-memories/limits"] });
      setStep("done");
    },
    onError: (err: Error) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum size is 10MB", variant: "destructive" });
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleUpload = () => {
    if (!selectedFile || !selectedPersonaId) return;
    setStep("loading");
    uploadMutation.mutate({ file: selectedFile, personaId: parseInt(selectedPersonaId) });
  };

  const handleSave = () => {
    if (!photoMemory) return;
    const questions = (photoMemory.aiPrompts as string[]) || [];
    const userResponses = questions.map((q, i) => ({
      question: q,
      answer: answers[i] || "",
    })).filter(r => r.answer.trim());

    if (userResponses.length === 0) {
      toast({ title: "Please answer at least one question", variant: "destructive" });
      return;
    }

    saveMutation.mutate({ id: photoMemory.id, userResponses });
  };

  const persona = personas.find(p => p.id === parseInt(selectedPersonaId));
  const atLimit = limits && limits.limit !== null && limits.remaining === 0;

  return (
    <Layout backTo="/photos" backLabel="Photos" title="New Photo Memory">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Step 1: Select persona */}
        {step === "select-persona" && (
          <Card className="p-6 space-y-4">
            <div className="text-center space-y-2">
              <Camera className="h-10 w-10 mx-auto text-primary" />
              <h2 className="text-xl font-semibold">Create a Photo Memory</h2>
              <p className="text-sm text-muted-foreground">
                Upload a photo and answer thoughtful AI-generated questions to preserve the story behind it
              </p>
            </div>

            {atLimit && (
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 text-sm text-center">
                You've reached the photo memory limit on your plan.{" "}
                <a href="/#/pricing" className="underline font-medium">Upgrade</a> for unlimited.
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Which Echo is this memory for?</label>
              <Select value={selectedPersonaId} onValueChange={setSelectedPersonaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an Echo..." />
                </SelectTrigger>
                <SelectContent>
                  {personas.map(p => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name} — {p.relationship}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              className="w-full"
              disabled={!selectedPersonaId || !!atLimit}
              onClick={() => setStep("upload")}
            >
              Continue
            </Button>
          </Card>
        )}

        {/* Step 2: Upload photo */}
        {step === "upload" && (
          <Card className="p-6 space-y-4">
            <h2 className="text-lg font-semibold">Upload a Photo</h2>
            <p className="text-sm text-muted-foreground">
              Choose a photo for {persona?.name}'s memories. JPG, PNG, or WebP up to 10MB.
            </p>

            {previewUrl ? (
              <div className="space-y-3">
                <div className="rounded-lg overflow-hidden border border-border">
                  <img src={previewUrl} alt="Preview" className="w-full max-h-80 object-contain bg-muted" />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => fileInputRef.current?.click()}>
                    Choose Different
                  </Button>
                  <Button className="flex-1 gap-2" onClick={handleUpload}>
                    <Upload className="h-4 w-4" />
                    Upload & Generate Questions
                  </Button>
                </div>
              </div>
            ) : (
              <div
                className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${photoDragOver ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); e.stopPropagation(); setPhotoDragOver(true); }}
                onDragEnter={e => { e.preventDefault(); e.stopPropagation(); setPhotoDragOver(true); }}
                onDragLeave={e => { e.preventDefault(); e.stopPropagation(); setPhotoDragOver(false); }}
                onDrop={e => { e.preventDefault(); e.stopPropagation(); setPhotoDragOver(false); const file = e.dataTransfer.files[0]; if (file) { if (file.size > 10 * 1024 * 1024) { toast({ title: "File too large", description: "Maximum size is 10MB", variant: "destructive" }); return; } setSelectedFile(file); setPreviewUrl(URL.createObjectURL(file)); } }}
              >
                <Camera className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">{photoDragOver ? "Drop photo here" : "Click or drag a photo here"}</p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileSelect}
            />
          </Card>
        )}

        {/* Step 3: Loading */}
        {step === "loading" && (
          <Card className="p-12 text-center space-y-4">
            <Loader2 className="h-10 w-10 mx-auto text-primary animate-spin" />
            <div>
              <h3 className="font-medium text-foreground">Analyzing your photo...</h3>
              <p className="text-sm text-muted-foreground mt-1">
                AI is looking at your photo and generating thoughtful questions
              </p>
            </div>
          </Card>
        )}

        {/* Step 4: Answer questions */}
        {step === "questions" && photoMemory && (
          <div className="space-y-4">
            <div className="rounded-lg overflow-hidden border border-border">
              <img
                src={`/api/photo-memories/photo/${photoMemory.id}`}
                alt="Your photo"
                className="w-full max-h-64 object-contain bg-muted"
              />
            </div>

            <Card className="p-6 space-y-5">
              <div>
                <h2 className="text-lg font-semibold">Tell us about this photo</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Answer the questions below to create a rich memory for {persona?.name}
                </p>
              </div>

              {((photoMemory.aiPrompts as string[]) || []).map((question, i) => (
                <div key={i} className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{question}</label>
                  <Textarea
                    value={answers[i] || ""}
                    onChange={(e) => setAnswers(prev => ({ ...prev, [i]: e.target.value }))}
                    placeholder="Write your answer..."
                    rows={3}
                  />
                </div>
              ))}

              <Button
                className="w-full"
                onClick={handleSave}
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</>
                ) : (
                  "Save Photo Memory"
                )}
              </Button>
            </Card>
          </div>
        )}

        {/* Step 5: Done */}
        {step === "done" && (
          <Card className="p-12 text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
            <div>
              <h3 className="text-lg font-semibold text-foreground">Photo Memory Saved!</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Added to {persona?.name}'s memories
              </p>
            </div>
            <div className="flex gap-3 justify-center">
              <Link href="/photos">
                <Button variant="outline">View All Photos</Button>
              </Link>
              <Link href="/photos/new">
                <Button
                  onClick={() => {
                    setStep("select-persona");
                    setSelectedFile(null);
                    setPreviewUrl("");
                    setPhotoMemory(null);
                    setAnswers({});
                  }}
                >
                  Add Another
                </Button>
              </Link>
            </div>
          </Card>
        )}
      </div>
    </Layout>
  );
}
