import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Pencil, Trash2, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Persona, PhotoMemory } from "@shared/schema";

export default function PhotoMemoryDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [answers, setAnswers] = useState<Record<number, string>>({});

  const id = parseInt(params.id || "0");

  const { data: photoMemory, isLoading } = useQuery<PhotoMemory>({
    queryKey: [`/api/photo-memories/${id}`],
    enabled: !!id,
  });

  const { data: personas = [] } = useQuery<Persona[]>({
    queryKey: ["/api/personas"],
  });

  const saveMutation = useMutation({
    mutationFn: async ({ userResponses, status }: { userResponses: Array<{ question: string; answer: string }>; status?: string }) => {
      const body: Record<string, unknown> = { userResponses };
      if (status) body.status = status;
      const res = await apiRequest("PUT", `/api/photo-memories/${id}`, body);
      return res.json() as Promise<PhotoMemory>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/photo-memories/${id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/photo-memories"] });
      setEditing(false);
      toast({ title: "Saved" });
    },
    onError: (err: Error) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/photo-memories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/photo-memories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/photo-memories/limits"] });
      navigate("/photos");
    },
  });

  if (isLoading) {
    return (
      <Layout backTo="/photos" backLabel="Photos" title="Photo Memory">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
          <div className="animate-pulse space-y-4">
            <div className="h-64 bg-muted rounded-lg" />
            <div className="h-4 bg-muted rounded w-1/3" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!photoMemory) {
    return (
      <Layout backTo="/photos" backLabel="Photos" title="Photo Memory">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 text-center">
          <p className="text-muted-foreground">Photo memory not found</p>
        </div>
      </Layout>
    );
  }

  const persona = personas.find(p => p.id === photoMemory.personaId);
  const questions = (photoMemory.aiPrompts as string[]) || [];
  const responses = (photoMemory.userResponses as Array<{ question: string; answer: string }>) || [];

  const startEditing = () => {
    const initialAnswers: Record<number, string> = {};
    questions.forEach((q, i) => {
      const existing = responses.find(r => r.question === q);
      initialAnswers[i] = existing?.answer || "";
    });
    setAnswers(initialAnswers);
    setEditing(true);
  };

  const handleSave = () => {
    const userResponses = questions.map((q, i) => ({
      question: q,
      answer: answers[i] || "",
    })).filter(r => r.answer.trim());

    saveMutation.mutate({
      userResponses,
      status: photoMemory.status === "draft" ? "complete" : undefined,
    });
  };

  return (
    <Layout backTo="/photos" backLabel="Photos" title={persona?.name || "Photo Memory"}>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {/* Photo */}
        <div className="rounded-lg overflow-hidden border border-border">
          <img
            src={`/api/photo-memories/photo/${photoMemory.id}`}
            alt="Photo memory"
            className="w-full max-h-96 object-contain bg-muted"
          />
        </div>

        {/* Meta */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant={photoMemory.status === "complete" ? "default" : "secondary"}>
              {photoMemory.status === "complete" ? "Complete" : "Draft"}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {new Date(photoMemory.createdAt!).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </span>
            {persona && <span className="text-sm text-muted-foreground">for {persona.name}</span>}
          </div>
          <div className="flex gap-2">
            {!editing && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={startEditing}>
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-destructive hover:text-destructive"
              onClick={() => {
                if (confirm("Delete this photo memory?")) deleteMutation.mutate();
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
        </div>

        {/* Q&A */}
        <Card className="p-6 space-y-5">
          {editing ? (
            <>
              {questions.map((question, i) => (
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
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button className="flex-1 gap-2" onClick={handleSave} disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
                  ) : (
                    <><Save className="h-4 w-4" /> Save</>
                  )}
                </Button>
              </div>
            </>
          ) : responses.length > 0 ? (
            responses.map((r, i) => (
              <div key={i} className="space-y-1">
                <p className="text-sm font-medium text-foreground">{r.question}</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{r.answer}</p>
              </div>
            ))
          ) : (
            <div className="text-center space-y-3 py-4">
              <p className="text-sm text-muted-foreground">No responses yet</p>
              <Button onClick={startEditing} className="gap-2">
                <Pencil className="h-4 w-4" />
                Answer Questions
              </Button>
            </div>
          )}
        </Card>
      </div>
    </Layout>
  );
}
