import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2, Save } from "lucide-react";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

export default function FolderStoryDetail() {
  const { id: personaIdStr, storyId } = useParams<{ id: string; storyId: string }>();
  const personaId = parseInt(personaIdStr);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const { data: story, isLoading } = useQuery<any>({
    queryKey: ["/api/stories", storyId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/stories/${storyId}`);
      if (!res.ok) throw new Error("Not found");
      const data = await res.json();
      setTitle(data.title);
      setContent(data.content);
      return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", `/api/stories/${storyId}`, { title, content });
    },
    onSuccess: () => {
      toast({ title: "Story updated" });
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["/api/stories", storyId] });
      queryClient.invalidateQueries({ queryKey: ["/api/personas", personaId, "folder"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/stories/${storyId}`);
    },
    onSuccess: () => {
      toast({ title: "Story deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/personas", personaId, "folder"] });
      navigate(`/persona/${personaId}/folder`);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <Layout backTo={`/persona/${personaId}/folder`} backLabel="Folder">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-4">
          <Skeleton className="h-8 w-64 rounded" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </Layout>
    );
  }

  if (!story) {
    return (
      <Layout backTo={`/persona/${personaId}/folder`} backLabel="Folder">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
          <p className="text-muted-foreground">Story not found.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout backTo={`/persona/${personaId}/folder`} backLabel="Folder" title="Story">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {editing ? (
          <>
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input id="title" value={title} onChange={e => setTitle(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="content">Story</Label>
                <Textarea id="content" value={content} onChange={e => setContent(e.target.value)} rows={14} className="min-h-[250px]" />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
              <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending} className="gap-2">
                <Save className="h-4 w-4" />
                {updateMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div>
              <h1 className="font-display text-xl font-semibold text-foreground">{story.title}</h1>
              <span className="text-xs text-muted-foreground">
                Written {story.createdAt ? new Date(story.createdAt).toLocaleDateString() : ""}
                {story.updatedAt && story.updatedAt !== story.createdAt ? ` · Updated ${new Date(story.updatedAt).toLocaleDateString()}` : ""}
              </span>
            </div>

            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-foreground leading-relaxed">
              {story.content}
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
              <Button variant="destructive" size="sm" className="gap-2"
                onClick={() => { if (confirm("Delete this story?")) deleteMutation.mutate(); }}>
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </Button>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
