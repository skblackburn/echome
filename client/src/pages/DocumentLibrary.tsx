import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
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
import { FileText, Pencil, Trash2, Upload, Loader2, Pen, Users2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Persona } from "@shared/schema";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

interface Document {
  id: number;
  title: string | null;
  content: string;
  contentPreview: string;
  documentType: string;
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
  const [editDocumentType, setEditDocumentType] = useState<"voice" | "character">("voice");
  const [deletingDoc, setDeletingDoc] = useState<Document | null>(null);
  const [filter, setFilter] = useState<"all" | "voice" | "character">("all");

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
    mutationFn: async ({ memoryId, content, title, documentType }: { memoryId: number; content: string; title: string; documentType: string }) => {
      const res = await fetch(`${API_BASE}/api/personas/${personaId}/documents/${memoryId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, title, documentType }),
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
    setEditDocumentType((doc.documentType || "voice") as "voice" | "character");
  };

  const handleSave = () => {
    if (!editingDoc || !editContent.trim()) return;
    updateMutation.mutate({
      memoryId: editingDoc.id,
      content: editContent,
      title: editTitle,
      documentType: editDocumentType,
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

  const filteredDocuments = filter === "all"
    ? documents
    : documents.filter(d => (d.documentType || "voice") === filter);

  const voiceCount = documents.filter(d => (d.documentType || "voice") === "voice").length;
  const characterCount = documents.filter(d => d.documentType === "character").length;

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
              Documents that shape {firstName}'s voice and character
            </p>
          </div>
          <Link href={`/persona/${personaId}/upload-guidance`}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Upload className="h-4 w-4" />
              Upload
            </Button>
          </Link>
        </div>

        {/* Filter tabs */}
        {documents.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={() => setFilter("all")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                filter === "all"
                  ? "bg-primary/10 text-primary border border-primary/30"
                  : "text-muted-foreground border border-border hover:border-primary/30"
              }`}
            >
              All ({documents.length})
            </button>
            <button
              onClick={() => setFilter("voice")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1 ${
                filter === "voice"
                  ? "bg-sky-100 text-sky-700 border border-sky-300/50 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-800"
                  : "text-muted-foreground border border-border hover:border-sky-300/50"
              }`}
            >
              <Pen className="h-3 w-3" /> Voice ({voiceCount})
            </button>
            <button
              onClick={() => setFilter("character")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1 ${
                filter === "character"
                  ? "bg-purple-100 text-purple-700 border border-purple-300/50 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800"
                  : "text-muted-foreground border border-border hover:border-purple-300/50"
              }`}
            >
              <Users2 className="h-3 w-3" /> Character ({characterCount})
            </button>
          </div>
        )}

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
            {filteredDocuments.map((doc) => {
              const isVoice = (doc.documentType || "voice") === "voice";
              return (
                <Card
                  key={doc.id}
                  className="echo-glow echo-glow-hover cursor-pointer transition-all hover:-translate-y-0.5 paper-surface"
                  onClick={() => openEdit(doc)}
                >
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg flex-shrink-0 mt-0.5 ${
                        isVoice
                          ? "bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400"
                          : "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
                      }`}>
                        {isVoice ? <Pen className="h-4 w-4" /> : <Users2 className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <h3 className="font-medium text-foreground text-sm truncate">
                              {doc.title || doc.content.split("\n")[0]?.slice(0, 60) || "Untitled"}
                            </h3>
                            <Badge
                              variant="outline"
                              className={`text-xs flex-shrink-0 ${
                                isVoice
                                  ? "border-sky-300/50 text-sky-600 dark:text-sky-400"
                                  : "border-purple-300/50 text-purple-600 dark:text-purple-400"
                              }`}
                            >
                              {isVoice ? "Voice" : "Character"}
                            </Badge>
                          </div>
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
              );
            })}
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

            {/* Document type toggle in edit */}
            <div className="flex-shrink-0">
              <Label className="text-xs text-muted-foreground mb-1.5 block">Document type</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditDocumentType("voice")}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                    editDocumentType === "voice"
                      ? "border-sky-400 bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-800"
                      : "border-border text-muted-foreground hover:border-sky-300/50"
                  }`}
                >
                  Written by {firstName}
                </button>
                <button
                  type="button"
                  onClick={() => setEditDocumentType("character")}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                    editDocumentType === "character"
                      ? "border-purple-400 bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800"
                      : "border-border text-muted-foreground hover:border-purple-300/50"
                  }`}
                >
                  Written about {firstName}
                </button>
              </div>
            </div>

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
