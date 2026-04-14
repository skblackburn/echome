import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FileText, Pencil, Trash2, Upload, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Persona } from "@shared/schema";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

interface Document {
  id: number;
  title: string | null;
  content: string;
  contentPreview: string;
  createdAt: string;
}

export default function DocumentLibrary() {
  const { id } = useParams<{ id: string }>();
  const personaId = parseInt(id);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [editingDoc, setEditingDoc] = useState<Document | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [deletingDoc, setDeletingDoc] = useState<Document | null>(null);

  // Fetch persona info
  const { data: persona } = useQuery<Persona>({
    queryKey: ["/api/personas", personaId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/personas/${personaId}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
  });

  // Fetch documents
  const { data: documents = [], isLoading } = useQuery<Document[]>({
    queryKey: ["/api/personas", personaId, "documents"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/personas/${personaId}/documents`);
      if (!res.ok) throw new Error("Failed to fetch documents");
      return res.json();
    },
  });

  // Update document mutation
  const updateMutation = useMutation({
    mutationFn: async ({ memoryId, content, title }: { memoryId: number; content: string; title: string }) => {
      const res = await fetch(`${API_BASE}/api/personas/${personaId}/documents/${memoryId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, title }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to save" }));
        throw new Error(err.error || "Failed to save");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personas", personaId, "documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/personas", personaId, "summary"] });
      setEditingDoc(null);
      toast({ title: "Document updated", description: "Writing style analysis will update shortly." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // Delete document mutation
  const deleteMutation = useMutation({
    mutationFn: async (memoryId: number) => {
      const res = await fetch(`${API_BASE}/api/personas/${personaId}/documents/${memoryId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personas", personaId, "documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/personas", personaId, "summary"] });
      setDeletingDoc(null);
      toast({ title: "Document deleted", description: "Writing style analysis will update shortly." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete document.", variant: "destructive" });
    },
  });

  const openEdit = (doc: Document) => {
    setEditingDoc(doc);
    setEditContent(doc.content);
    setEditTitle(doc.title || "");
  };

  const handleSave = () => {
    if (!editingDoc || !editContent.trim()) return;
    updateMutation.mutate({
      memoryId: editingDoc.id,
      content: editContent,
      title: editTitle,
    });
  };

  const handleDelete = () => {
    if (!deletingDoc) return;
    deleteMutation.mutate(deletingDoc.id);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const firstName = persona?.name?.split(" ")[0] || "Echo";

  if (isLoading) {
    return (
      <Layout backTo={`/persona/${personaId}`} backLabel={firstName}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-4">
          <Skeleton className="h-8 w-48 rounded-lg" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout backTo={`/persona/${personaId}`} backLabel={firstName} title="Documents">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-xl font-semibold text-foreground">
              Uploaded Writing
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Documents that shape {firstName}'s writing style
            </p>
          </div>
          <Link href={`/persona/${personaId}/upload-guidance`}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Upload className="h-4 w-4" />
              Upload
            </Button>
          </Link>
        </div>

        {/* Document list or empty state */}
        {documents.length === 0 ? (
          <Card className="paper-surface">
            <CardContent className="p-8 text-center">
              <div className="p-3 rounded-xl bg-muted/50 w-fit mx-auto mb-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-display text-lg font-semibold text-foreground mb-1">
                No documents uploaded yet
              </h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
                Add writing samples to build {firstName}'s voice. Journals, letters, emails, or any personal writing will help.
              </p>
              <Link href={`/persona/${personaId}/upload-guidance`}>
                <Button className="gap-1.5">
                  <Upload className="h-4 w-4" />
                  Upload Writing Samples
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {documents.map((doc) => (
              <Card
                key={doc.id}
                className="echo-glow echo-glow-hover cursor-pointer transition-all hover:-translate-y-0.5 paper-surface"
                onClick={() => openEdit(doc)}
              >
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400 flex-shrink-0 mt-0.5">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h3 className="font-medium text-foreground text-sm truncate">
                          {doc.title || doc.content.split("\n")[0]?.slice(0, 60) || "Untitled"}
                        </h3>
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {formatDate(doc.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                        {doc.contentPreview}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                      <button
                        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        onClick={(e) => { e.stopPropagation(); openEdit(doc); }}
                        title="Edit document"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        onClick={(e) => { e.stopPropagation(); setDeletingDoc(doc); }}
                        title="Delete document"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingDoc} onOpenChange={(open) => { if (!open) setEditingDoc(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-display">Edit Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Document title"
              className="flex-shrink-0"
            />
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="flex-1 min-h-[200px] max-h-[50vh] resize-none font-mono text-sm"
              placeholder="Document content..."
            />
          </div>
          <DialogFooter className="flex-shrink-0 gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setEditingDoc(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending || !editContent.trim()}
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingDoc} onOpenChange={(open) => { if (!open) setDeletingDoc(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this document?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingDoc?.title || "this document"}"? This may affect {firstName}'s writing style. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
