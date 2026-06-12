import { useState, useRef } from "react";
import { useParams } from "wouter";
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
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import {
  FileText, Pencil, Trash2, Upload, Loader2, Pen, Users2,
  ChevronDown, Plus, Info, CheckCircle2, AlertCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Persona } from "@shared/schema";
import { cn } from "@/lib/utils";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

interface Document {
  id: number;
  title: string | null;
  content: string;
  contentPreview: string;
  documentType: string;
  createdAt: string;
}

// ── Inline writing guidance panel ────────────────────────────────────────────
function WritingGuidancePanel() {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
        >
          <Info className="h-3.5 w-3.5" />
          What kinds of writing help?
          <ChevronDown className={cn("h-3 w-3 transition-transform duration-200", open && "rotate-180")} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-3 p-4 rounded-xl bg-muted/40 border border-border space-y-3 text-sm">
          <p className="text-muted-foreground leading-relaxed">
            Journals, letters, emails, recipes, notes — anything written in their voice.
            Upload whatever feels meaningful. There's no right or wrong amount.
          </p>
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
              <span className="text-muted-foreground">Personal journals, letters, emails they wrote, texts, blog posts, cards, speeches</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <span className="text-muted-foreground">Work emails, creative writing, poems — anything with their personality in it</span>
            </div>
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <span className="text-muted-foreground">Avoid forwarded content, templates, or documents with multiple authors</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Supported: .txt, .pdf, .docx (up to 10MB each)</p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ── Add Document Dialog ───────────────────────────────────────────────────────
function AddDocumentDialog({
  open,
  onClose,
  personaId,
  firstName,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  personaId: number;
  firstName: string;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [documentType, setDocumentType] = useState<"voice" | "character">("voice");
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  const reset = () => {
    setSelectedFile(null);
    setTitle("");
    setDocumentType("voice");
    setDragOver(false);
    setUploading(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum size is 10MB", variant: "destructive" });
      return;
    }
    setSelectedFile(file);
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""));
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("title", title || selectedFile.name);
      formData.append("documentType", documentType);

      const res = await fetch(`${API_BASE}/api/personas/${personaId}/documents`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || "Upload failed");
      }

      toast({ title: "Document added", description: "Writing style analysis will update shortly." });
      onSuccess();
      handleClose();
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Add writing to {firstName}'s Folder</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Guidance panel */}
          <WritingGuidancePanel />

          {/* File drop zone */}
          <div
            className={cn(
              "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors",
              dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/20",
              selectedFile && "border-solid border-primary/30 bg-primary/3"
            )}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragEnter={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files[0];
              if (file) handleFile(file);
            }}
          >
            {selectedFile ? (
              <div className="space-y-1">
                <FileText className="h-8 w-8 mx-auto text-primary" />
                <p className="text-sm font-medium text-foreground">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024).toFixed(0)} KB · Click to change</p>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  {dragOver ? "Drop here" : "Click or drag a file here"}
                </p>
                <p className="text-xs text-muted-foreground/60">.txt · .pdf · .docx</p>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />

          {/* Title */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Label (optional)</Label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Letters to Dad, 2019 Journal"
            />
          </div>

          {/* Document type */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Written by or about {firstName}?</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDocumentType("voice")}
                className={cn(
                  "flex-1 px-3 py-2 rounded-lg border text-xs font-medium transition-all text-center",
                  documentType === "voice"
                    ? "border-sky-400 bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-800"
                    : "border-border text-muted-foreground hover:border-sky-300/50"
                )}
              >
                Written by {firstName}
              </button>
              <button
                type="button"
                onClick={() => setDocumentType("character")}
                className={cn(
                  "flex-1 px-3 py-2 rounded-lg border text-xs font-medium transition-all text-center",
                  documentType === "character"
                    ? "border-purple-400 bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800"
                    : "border-border text-muted-foreground hover:border-purple-300/50"
                )}
              >
                Written about {firstName}
              </button>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={uploading}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={!selectedFile || uploading} className="gap-2">
            {uploading ? <><Loader2 className="h-4 w-4 animate-spin" />Uploading…</> : <><Plus className="h-4 w-4" />Add to Folder</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
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
  const [addingDoc, setAddingDoc] = useState(false);

  const { data: persona } = useQuery<Persona>({
    queryKey: ["/api/personas", personaId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/personas/${personaId}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
  });

  const { data: documents = [], isLoading } = useQuery<Document[]>({
    queryKey: ["/api/personas", personaId, "documents"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/personas/${personaId}/documents`);
      if (!res.ok) throw new Error("Failed to fetch documents");
      return res.json();
    },
  });

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
      toast({ title: "Document updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

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
      setDeletingDoc(null);
      toast({ title: "Document deleted" });
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
    updateMutation.mutate({ memoryId: editingDoc.id, content: editContent, title: editTitle, documentType: editDocumentType });
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const firstName = persona?.name?.split(" ")[0] || "Echo";
  const filteredDocuments = filter === "all" ? documents : documents.filter(d => (d.documentType || "voice") === filter);
  const voiceCount = documents.filter(d => (d.documentType || "voice") === "voice").length;
  const characterCount = documents.filter(d => d.documentType === "character").length;

  if (isLoading) {
    return (
      <Layout backTo={`/persona/${personaId}/folder`} backLabel="Folder">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-4">
          <Skeleton className="h-8 w-48 rounded-lg" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout backTo={`/persona/${personaId}/folder`} backLabel="Folder" title="Documents">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-lg font-semibold text-foreground">
              {firstName}'s Writing
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Documents that help shape {firstName}'s voice
            </p>
          </div>
          <Button className="gap-2" onClick={() => setAddingDoc(true)}>
            <Plus className="h-4 w-4" />
            Add Memory
          </Button>
        </div>

        {/* Filter tabs (only when docs exist) */}
        {documents.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {[
              { key: "all", label: `All (${documents.length})` },
              { key: "voice", label: `By ${firstName} (${voiceCount})` },
              { key: "character", label: `About ${firstName} (${characterCount})` },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key as any)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
                  filter === key
                    ? "bg-primary/10 text-primary border-primary/30"
                    : "text-muted-foreground border-border hover:border-primary/30"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Empty state */}
        {documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-16 space-y-4">
            <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
              No writing samples yet. Journals, letters, emails — anything written in {firstName}'s voice.
            </p>
            <div className="space-y-3 w-full max-w-xs">
              <Button className="gap-2 w-full" onClick={() => setAddingDoc(true)}>
                <Plus className="h-4 w-4" />
                Add Memory
              </Button>
              <div className="flex justify-center">
                <WritingGuidancePanel />
              </div>
            </div>
          </div>
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
                      <div className={cn(
                        "p-2 rounded-lg flex-shrink-0 mt-0.5",
                        isVoice
                          ? "bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400"
                          : "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
                      )}>
                        {isVoice ? <Pen className="h-4 w-4" /> : <Users2 className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <h3 className="font-semibold text-foreground text-sm truncate">
                              {doc.title || doc.content.split("\n")[0]?.slice(0, 60) || "Untitled"}
                            </h3>
                            <Badge className={cn(
                              "text-xs flex-shrink-0 rounded-full px-2.5 py-0.5 border-0 font-normal",
                              isVoice
                                ? "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400"
                                : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                            )}>
                              {isVoice ? `By ${firstName}` : `About ${firstName}`}
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            {formatDate(doc.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed mt-1.5">
                          {doc.contentPreview}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                        <button
                          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          onClick={(e) => { e.stopPropagation(); openEdit(doc); }}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          onClick={(e) => { e.stopPropagation(); setDeletingDoc(doc); }}
                          title="Delete"
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

      {/* Add Document Dialog */}
      <AddDocumentDialog
        open={addingDoc}
        onClose={() => setAddingDoc(false)}
        personaId={personaId}
        firstName={firstName}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["/api/personas", personaId, "documents"] })}
      />

      {/* Edit Dialog */}
      <Dialog open={!!editingDoc} onOpenChange={(open) => { if (!open) setEditingDoc(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-display">Edit Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
            <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Document title" className="flex-shrink-0" />
            <div className="flex-shrink-0">
              <Label className="text-xs text-muted-foreground mb-1.5 block">Written by or about {firstName}?</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditDocumentType("voice")}
                  className={cn("px-3 py-1.5 rounded-lg border text-xs font-medium transition-all", editDocumentType === "voice"
                    ? "border-sky-400 bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-800"
                    : "border-border text-muted-foreground hover:border-sky-300/50")}
                >
                  Written by {firstName}
                </button>
                <button
                  type="button"
                  onClick={() => setEditDocumentType("character")}
                  className={cn("px-3 py-1.5 rounded-lg border text-xs font-medium transition-all", editDocumentType === "character"
                    ? "border-purple-400 bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800"
                    : "border-border text-muted-foreground hover:border-purple-300/50")}
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
            <Button variant="outline" onClick={() => setEditingDoc(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending || !editContent.trim()}>
              {updateMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" />Saving…</> : "Save Changes"}
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
              "{deletingDoc?.title || "This document"}" will be permanently removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingDoc && deleteMutation.mutate(deletingDoc.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" />Deleting…</> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
