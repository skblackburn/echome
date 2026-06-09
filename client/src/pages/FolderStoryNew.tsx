import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { BookOpen } from "lucide-react";

export default function FolderStoryNew() {
  const { id } = useParams<{ id: string }>();
  const personaId = parseInt(id);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/personas/${personaId}/stories`, { title, content });
    },
    onSuccess: () => {
      toast({ title: "Story saved", description: "Your story has been added to the folder." });
      queryClient.invalidateQueries({ queryKey: ["/api/personas", personaId, "folder"] });
      navigate(`/persona/${personaId}/folder`);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const canSubmit = title.trim() && content.trim();

  return (
    <Layout backTo={`/persona/${personaId}/folder`} backLabel="Folder" title="Add a Story">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div>
          <h1 className="font-display text-xl font-semibold text-foreground">Add a Story</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Write a story, piece of advice, or memory for this person's folder.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. The summer we spent at the lake" />
          </div>

          <div>
            <Label htmlFor="content">Story</Label>
            <Textarea id="content" value={content} onChange={e => setContent(e.target.value)}
              placeholder="Write your story here..." rows={14} className="min-h-[250px]" />
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => navigate(`/persona/${personaId}/folder`)}>
            Cancel
          </Button>
          <Button onClick={() => createMutation.mutate()} disabled={!canSubmit || createMutation.isPending} className="gap-2">
            <BookOpen className="h-4 w-4" />
            {createMutation.isPending ? "Saving..." : "Save Story"}
          </Button>
        </div>
      </div>
    </Layout>
  );
}
