import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2, Save, Lock, CalendarClock, Milestone, Eye } from "lucide-react";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

export default function FolderLetterDetail() {
  const { id: personaIdStr, letterId } = useParams<{ id: string; letterId: string }>();
  const personaId = parseInt(personaIdStr);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const { data: letter, isLoading } = useQuery<any>({
    queryKey: ["/api/letters", letterId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/letters/${letterId}`);
      if (!res.ok) throw new Error("Not found");
      const data = await res.json();
      setTitle(data.title);
      setContent(data.content);
      return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", `/api/letters/${letterId}`, { title, content });
    },
    onSuccess: () => {
      toast({ title: "Letter updated" });
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["/api/letters", letterId] });
      queryClient.invalidateQueries({ queryKey: ["/api/personas", personaId, "folder"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/letters/${letterId}`);
    },
    onSuccess: () => {
      toast({ title: "Letter deleted" });
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

  if (!letter) {
    return (
      <Layout backTo={`/persona/${personaId}/folder`} backLabel="Folder">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
          <p className="text-muted-foreground">Letter not found.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout backTo={`/persona/${personaId}/folder`} backLabel="Folder" title="Letter">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {editing ? (
          <>
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input id="title" value={title} onChange={e => setTitle(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="content">Letter</Label>
                <Textarea id="content" value={content} onChange={e => setContent(e.target.value)} rows={12} className="min-h-[200px]" />
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
              <h1 className="font-display text-xl font-semibold text-foreground">{letter.title}</h1>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="text-xs text-muted-foreground">
                  Written {letter.createdAt ? new Date(letter.createdAt).toLocaleDateString() : ""}
                </span>
                {letter.deliveryRuleType === "sealed_until_passing" && (
                  <Badge variant="outline" className="text-xs gap-1"><Lock className="h-3 w-3" />Sealed until passing</Badge>
                )}
                {letter.deliveryRuleType === "milestone" && (
                  <Badge variant="outline" className="text-xs gap-1"><Milestone className="h-3 w-3" />{letter.deliveryMilestone}</Badge>
                )}
                {letter.deliveryRuleType === "date" && (
                  <Badge variant="outline" className="text-xs gap-1">
                    <CalendarClock className="h-3 w-3" />
                    {letter.recurring ? "Recurring · " : ""}{new Date(letter.deliverAt).toLocaleDateString()}
                  </Badge>
                )}
                {letter.deliveryRuleType === "browsable_anytime" && (
                  <Badge variant="outline" className="text-xs gap-1"><Eye className="h-3 w-3" />Browsable anytime</Badge>
                )}
                {letter.isSealed && <Badge variant="secondary" className="text-xs gap-1"><Lock className="h-3 w-3" />Sealed</Badge>}
                <Badge variant={letter.status === "delivered" ? "default" : "secondary"} className="text-xs capitalize">{letter.status}</Badge>
              </div>
            </div>

            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-foreground leading-relaxed">
              {letter.content}
            </div>

            {letter.status === "scheduled" && (
              <div className="flex justify-end gap-3">
                <Button variant="outline" size="sm" className="gap-2" onClick={() => setEditing(true)}>
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
                <Button variant="destructive" size="sm" className="gap-2"
                  onClick={() => { if (confirm("Delete this letter?")) deleteMutation.mutate(); }}>
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
