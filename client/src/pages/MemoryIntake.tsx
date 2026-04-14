import { useState, useRef } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  BookOpen, Brain, Mic, Plus, Trash2,
  Upload, X, ChevronRight, MessageSquare, FileText, HelpCircle
} from "lucide-react";
import { Link } from "wouter";
import type { Persona, Trait, Memory, Media } from "@shared/schema";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

const TRAIT_CATEGORIES = [
  { value: "value", label: "Core Value" },
  { value: "belief", label: "Belief" },
  { value: "personality", label: "Personality Trait" },
  { value: "saying", label: "Favorite Saying" },
  { value: "advice", label: "Advice They'd Give" },
];

const MEMORY_TYPES = [
  { value: "story", label: "Story" },
  { value: "letter", label: "Letter" },
  { value: "journal", label: "Journal Entry" },
  { value: "message", label: "Text / Message" },
];

const LIFE_PERIODS = [
  { value: "childhood", label: "Childhood" },
  { value: "young adult", label: "Young Adult" },
  { value: "parenthood", label: "Parenthood" },
  { value: "later life", label: "Later Life" },
  { value: "general", label: "General / Any time" },
];

// ── Traits tab ────────────────────────────────────────────────────────────────
function TraitsTab({ personaId, firstName }: { personaId: number; firstName: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState("value");
  const [content, setContent] = useState("");

  const { data: traits = [] } = useQuery<Trait[]>({
    queryKey: ["/api/personas", personaId, "traits"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/personas/${personaId}/traits`);
      return res.json();
    },
  });

  const addMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/personas/${personaId}/traits`, { category, content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personas", personaId, "traits"] });
      queryClient.invalidateQueries({ queryKey: ["/api/personas", personaId, "summary"] });
      setContent("");
      toast({ title: "Trait added" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/traits/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personas", personaId, "traits"] });
    },
  });

  const traitsByCategory: Record<string, Trait[]> = {};
  traits.forEach(t => {
    if (!traitsByCategory[t.category]) traitsByCategory[t.category] = [];
    traitsByCategory[t.category].push(t);
  });

  const PROMPTS: Record<string, string[]> = {
    value: [
      "Family above all else — she rearranged her whole life around the people she loved",
      "Honesty, even when it was hard — she'd rather tell you a difficult truth than a comfortable lie",
      "Hard work as a form of love — she showed care through doing, fixing, showing up",
    ],
    belief: [
      "Everything happens for a reason — she found meaning in even the hardest moments",
      "People are fundamentally good — she gave everyone the benefit of the doubt until proven otherwise",
      "Nature heals — she believed the ocean, the land, and open air could fix almost anything",
    ],
    personality: [
      "Resilient — she kept going after profound loss, rebuilding quietly instead of shutting down",
      "Warm but private — she made everyone feel seen, but kept her own pain close",
      "Funny in a dry, quiet way — her humor snuck up on you; she'd deadpan something devastating",
    ],
    saying: [
      "\"Let's see what happens\" — her way of turning fear into curiosity",
      "\"I'm here with you\" — she said this when words weren't enough",
      "\"We'll figure it out\" — calm and practical, even in crisis",
    ],
    advice: [
      "Stay close to the ocean — it will remind you what's small and what's not",
      "Don't wait to say the thing you're afraid to say",
      "Choose the life that makes you feel most like yourself, even if it's harder",
    ],
  };

  const TRAIT_PLACEHOLDER: Record<string, string> = {
    value: `e.g., "Family above all else — she rearranged her whole life around the people she loved"`,
    belief: `e.g., "Everything happens for a reason — she found meaning even in the hardest moments"`,
    personality: `e.g., "Resilient — she kept going after profound loss, rebuilding quietly instead of shutting down"`,
    saying: `e.g., "Let's see what happens" — her way of turning fear into curiosity`,
    advice: `e.g., "Don't wait to say the thing you're afraid to say"`,
  };

  return (
    <div className="space-y-5">
      <div className="rounded-lg bg-muted/50 border border-border p-4 text-sm text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">The more detail, the better the Echo.</p>
        <p>Don't just write the trait — explain what it looked like in practice. <span className="text-foreground">"Resilient"</span> is good. <span className="text-foreground">"Resilient — she kept going after profound loss, rebuilding quietly instead of shutting down"</span> is what makes the AI sound unmistakably like {firstName}.</p>
      </div>
      <div className="space-y-3 p-4 rounded-lg border border-border paper-surface">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger data-testid="select-trait-category"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TRAIT_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Trait</Label>
            <Input
              placeholder={TRAIT_PLACEHOLDER[category] || "Describe the trait with context…"}
              value={content}
              onChange={e => setContent(e.target.value)}
              onKeyDown={e => e.key === "Enter" && content.trim() && addMutation.mutate()}
              data-testid="input-trait-content"
            />
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1.5">Examples — click to use as a starting point, then personalize:</p>
          <div className="flex flex-wrap gap-1.5">
            {(PROMPTS[category] || []).map(p => (
              <button key={p} type="button" onClick={() => setContent(p.replace(/"/g, ""))}
                className="text-xs px-2.5 py-1 rounded-full bg-muted hover:bg-secondary border border-border text-muted-foreground hover:text-foreground transition-colors">
                {p}
              </button>
            ))}
          </div>
        </div>
        <Button size="sm" disabled={!content.trim() || addMutation.isPending} onClick={() => addMutation.mutate()} className="gap-1.5" data-testid="button-add-trait">
          <Plus className="h-3.5 w-3.5" /> Add trait
        </Button>
      </div>
      {Object.entries(traitsByCategory).map(([cat, items]) => (
        <div key={cat}>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 capitalize">
            {TRAIT_CATEGORIES.find(c => c.value === cat)?.label || cat}
          </div>
          <div className="flex flex-wrap gap-2">
            {items.map(t => (
              <div key={t.id} className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted border border-border text-sm">
                <span>{t.content}</span>
                <button onClick={() => deleteMutation.mutate(t.id)} className="text-muted-foreground hover:text-destructive transition-colors ml-0.5">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
      {traits.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No traits yet. Start with a core value.</p>}
    </div>
  );
}

// ── Memories tab ──────────────────────────────────────────────────────────────
function MemoriesTab({ personaId, firstName }: { personaId: number; firstName: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [type, setType] = useState("story");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [period, setPeriod] = useState("general");
  const [perspective, setPerspective] = useState<"first" | "third">("first");

  const { data: memories = [] } = useQuery<Memory[]>({
    queryKey: ["/api/personas", personaId, "memories"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/personas/${personaId}/memories`);
      return res.json();
    },
  });

  const addMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/personas/${personaId}/memories`, {
      type, title: title || null, content, period,
      tags: JSON.stringify({ perspective }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personas", personaId, "memories"] });
      setTitle(""); setContent("");
      setPerspective("first");
      toast({ title: "Memory saved" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/memories/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/personas", personaId, "memories"] }),
  });

  const STORY_PROMPTS = [
    `A story about ${firstName}'s childhood`,
    `How ${firstName} met someone important`,
    `${firstName}'s proudest moment`,
    `A hard time ${firstName} got through`,
    `What ${firstName} loved most about life`,
  ];

  return (
    <div className="space-y-5">
      <div className="rounded-lg bg-muted/50 border border-border p-4 text-sm text-muted-foreground space-y-1">
        <p>Stories, letters, journal entries, text messages — write them in your own words. The more genuine, the better the Echo.</p>
      </div>
      <div className="space-y-3 p-4 rounded-lg border border-border paper-surface">

        {/* Perspective picker */}
        <div className="space-y-1.5">
          <Label>Whose perspective is this?</Label>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setPerspective("first")}
              className={`flex flex-col gap-0.5 p-3 rounded-xl border-2 text-left transition-all ${
                perspective === "first" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
              }`}>
              <span className="text-xs font-semibold text-foreground">{firstName}'s own words</span>
              <span className="text-xs text-muted-foreground">Written by {firstName}, or capturing her direct experience</span>
            </button>
            <button type="button" onClick={() => setPerspective("third")}
              className={`flex flex-col gap-0.5 p-3 rounded-xl border-2 text-left transition-all ${
                perspective === "third" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
              }`}>
              <span className="text-xs font-semibold text-foreground">My memory of {firstName}</span>
              <span className="text-xs text-muted-foreground">My recollection of something she did, said, or experienced</span>
            </button>
          </div>
          {perspective === "third" && (
            <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
              The AI will use this as context about {firstName} — it will speak as if it knows this happened, but from her own perspective.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger data-testid="select-memory-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MEMORY_TYPES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Period of {firstName}'s life</Label>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LIFE_PERIODS.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">When in {firstName}'s life did this take place?</p>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Title <span className="text-muted-foreground text-xs">(optional)</span></Label>
          <Input placeholder="Give this memory a name…" value={title} onChange={e => setTitle(e.target.value)} data-testid="input-memory-title" />
        </div>
        <div className="space-y-1.5">
          <Label>Content <span className="text-destructive">*</span></Label>
          <Textarea placeholder="Write in your own words. Paste emails, texts, or journal entries directly here too." value={content} onChange={e => setContent(e.target.value)} rows={5} className="resize-none" data-testid="input-memory-content" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1.5">Story prompts:</p>
          <div className="flex flex-wrap gap-1.5">
            {STORY_PROMPTS.map(p => (
              <button key={p} type="button" onClick={() => setTitle(p)}
                className="text-xs px-2.5 py-1 rounded-full bg-muted hover:bg-secondary border border-border text-muted-foreground hover:text-foreground transition-colors">{p}</button>
            ))}
          </div>
        </div>
        <Button size="sm" disabled={!content.trim() || addMutation.isPending} onClick={() => addMutation.mutate()} className="gap-1.5" data-testid="button-add-memory">
          <Plus className="h-3.5 w-3.5" /> Save memory
        </Button>
      </div>
      {memories.length > 0 && (
        <div className="space-y-3">
          {memories.map(m => (
            <Card key={m.id} className="paper-surface">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {m.title && <div className="text-sm font-medium text-foreground mb-1">{m.title}</div>}
                    <p className="text-sm text-muted-foreground line-clamp-3">{m.content}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-xs capitalize">{m.type}</Badge>
                      {m.period && m.period !== "general" && <span className="text-xs text-muted-foreground capitalize">{m.period}</span>}
                    </div>
                  </div>
                  <button onClick={() => deleteMutation.mutate(m.id)} className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0 mt-0.5" data-testid={`button-delete-memory-${m.id}`}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Voice tab ─────────────────────────────────────────────────────────────────
function VoiceTab({ personaId, firstName }: { personaId: number; firstName: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const audioRef = useRef<HTMLInputElement>(null);
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);

  const { data: mediaList = [] } = useQuery<Media[]>({
    queryKey: ["/api/personas", personaId, "media"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/personas/${personaId}/media`);
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/media/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/personas", personaId, "media"] }),
  });

  const uploadAudio = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("type", "audio");
      if (description) form.append("description", description);
      const res = await fetch(`${API_BASE}/api/personas/${personaId}/media`, { method: "POST", body: form });
      if (!res.ok) throw new Error("Upload failed");
      queryClient.invalidateQueries({ queryKey: ["/api/personas", personaId, "media"] });
      setDescription("");
      toast({ title: "Recording uploaded" });
    } catch (e) {
      toast({ title: "Upload failed", description: String(e), variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const audioFiles = mediaList.filter(m => m.type === "audio");
  const MAX_RECORDINGS = 5;

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-muted/50 border border-border p-4 text-sm text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">Why voice recordings matter</p>
        <p>ElevenLabs can clone {firstName}'s voice from a real recording, so the Echo speaks in their actual voice. Even one good 3–5 minute recording makes an enormous difference.</p>
        <p className="mt-1 text-xs">Best recordings: naturally spoken, minimal background noise. A voicemail, a video call recording, or someone reading aloud all work well.</p>
      </div>

      {audioFiles.length < MAX_RECORDINGS && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input placeholder="e.g., Voicemail from Christmas 2019" value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <button type="button" onClick={() => audioRef.current?.click()} disabled={uploading}
            className="flex flex-col items-center gap-2 w-full p-6 rounded-lg border-2 border-dashed border-border hover:border-primary/40 hover:bg-muted/50 transition-all cursor-pointer disabled:opacity-50"
            data-testid="button-upload-audio">
            <Mic className="h-8 w-8 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Upload Voice Recording</span>
            <span className="text-xs text-muted-foreground">MP3, WAV, M4A, M4R up to 50MB · {MAX_RECORDINGS - audioFiles.length} remaining</span>
          </button>
          <input ref={audioRef} type="file" accept="audio/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadAudio(f); }} />
          {uploading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="h-4 w-4 rounded-full border-2 border-primary/50 border-t-primary animate-spin" />
              Uploading…
            </div>
          )}
        </div>
      )}

      {audioFiles.length >= MAX_RECORDINGS && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-4 text-sm text-amber-800 dark:text-amber-300">
          Maximum of {MAX_RECORDINGS} recordings reached. Delete one to add another.
        </div>
      )}

      {audioFiles.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-3">Voice Recordings ({audioFiles.length}/{MAX_RECORDINGS})</h4>
          <div className="space-y-2">
            {audioFiles.map(m => (
              <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
                <Mic className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{m.originalName}</div>
                  {m.description && <div className="text-xs text-muted-foreground">{m.description}</div>}
                </div>
                <audio src={`${API_BASE}/uploads/${m.filename}`} controls className="h-8 max-w-[160px]" />
                <button onClick={() => deleteMutation.mutate(m.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {audioFiles.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-2">No recordings yet.</p>
      )}
    </div>
  );
}

// ── Documents tab ─────────────────────────────────────────────────────────────
function DocumentsTab({ personaId, firstName }: { personaId: number; firstName: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [docTitle, setDocTitle] = useState("");
  const [uploading, setUploading] = useState(false);

  const { data: memories = [] } = useQuery<Memory[]>({
    queryKey: ["/api/personas", personaId, "memories"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/personas/${personaId}/memories`);
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/memories/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/personas", personaId, "memories"] }),
  });

  const uploadDoc = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      if (docTitle) form.append("title", docTitle);
      const res = await fetch(`${API_BASE}/api/personas/${personaId}/documents`, { method: "POST", body: form });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Upload failed");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/personas", personaId, "memories"] });
      setDocTitle("");
      toast({ title: "Document imported", description: "Text extracted and added to memories." });
    } catch (e) {
      toast({ title: "Import failed", description: String(e), variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const docMemories = memories.filter(m => m.type === "document" as string);

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-muted/50 border border-border p-4 text-sm text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">Upload documents to feed the AI</p>
        <p>PDF, Word (.docx), or plain text files. The text is extracted and stored as memory — letters, journals, essays, narratives all work beautifully.</p>
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Document title <span className="text-muted-foreground text-xs">(optional)</span></Label>
          <Input placeholder="e.g., Letters to family, 1987–1992" value={docTitle} onChange={e => setDocTitle(e.target.value)} />
        </div>
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
          className="flex flex-col items-center gap-2 w-full p-6 rounded-lg border-2 border-dashed border-border hover:border-primary/40 hover:bg-muted/50 transition-all cursor-pointer disabled:opacity-50"
          data-testid="button-upload-document">
          <FileText className="h-8 w-8 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Upload Document</span>
          <span className="text-xs text-muted-foreground">PDF, DOCX, TXT up to 10MB</span>
        </button>
        <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) uploadDoc(f); }} />
        {uploading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="h-4 w-4 rounded-full border-2 border-primary/50 border-t-primary animate-spin" />
            Extracting text…
          </div>
        )}
      </div>

      {docMemories.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-3">Imported Documents ({docMemories.length})</h4>
          <div className="space-y-3">
            {docMemories.map(m => (
              <Card key={m.id} className="paper-surface">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        <div className="text-sm font-medium text-foreground">{m.title || "Untitled document"}</div>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{m.content}</p>
                      <div className="mt-2">
                        <Badge variant="outline" className="text-xs">{m.content.length.toLocaleString()} characters</Badge>
                      </div>
                    </div>
                    <button onClick={() => deleteMutation.mutate(m.id)} className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0 mt-0.5">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {docMemories.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-2">No documents imported yet.</p>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function MemoryIntake() {
  const { id } = useParams<{ id: string }>();
  const personaId = parseInt(id);

  const { data: persona } = useQuery<Persona>({
    queryKey: ["/api/personas", personaId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/personas/${personaId}`);
      return res.json();
    },
  });

  const firstName = persona?.name?.split(" ")[0] || "them";

  return (
    <Layout backTo={`/persona/${personaId}`} backLabel={persona?.name || "Back"} title="Memory Intake">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="font-display text-xl font-semibold text-foreground mb-1">
                Build {firstName}'s Echo
              </h1>
              <p className="text-sm text-muted-foreground">
                Add personality traits, memories, and recordings. The more you add, the more authentic the conversations become.
              </p>
            </div>
            <Link href={`/persona/${personaId}/upload-guidance`}>
              <button
                type="button"
                className="flex-shrink-0 p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                title="Upload tips & guidance"
              >
                <HelpCircle className="h-5 w-5" />
              </button>
            </Link>
          </div>
        </div>

        {/* CTA cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          <Link href={`/persona/${personaId}/interview`}>
            <div className="flex items-center gap-3 p-4 rounded-xl border-2 border-primary/25 bg-primary/5 hover:border-primary/40 hover:bg-primary/8 transition-all cursor-pointer h-full group">
              <div className="p-2.5 rounded-lg bg-primary/15 flex-shrink-0">
                <MessageSquare className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-foreground text-sm">Guided Interview</div>
                <div className="text-xs text-muted-foreground mt-0.5">15 questions capturing {firstName}'s stories and values</div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
            </div>
          </Link>
          <Link href={`/persona/${personaId}/life-story`}>
            <div className="flex items-center gap-3 p-4 rounded-xl border-2 border-amber-500/25 bg-amber-500/5 hover:border-amber-500/40 hover:bg-amber-500/8 transition-all cursor-pointer h-full group">
              <div className="p-2.5 rounded-lg bg-amber-500/15 flex-shrink-0">
                <BookOpen className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-foreground text-sm">Life Story</div>
                <div className="text-xs text-muted-foreground mt-0.5">Sensory details, family, life chapters & legacy</div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors flex-shrink-0" />
            </div>
          </Link>
        </div>

        <Tabs defaultValue="traits" className="space-y-5">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="traits" className="gap-1 text-xs sm:text-sm" data-testid="tab-traits">
              <Brain className="h-3.5 w-3.5" /><span className="hidden sm:inline">Personality</span><span className="sm:hidden">Traits</span>
            </TabsTrigger>
            <TabsTrigger value="memories" className="gap-1 text-xs sm:text-sm" data-testid="tab-memories">
              <BookOpen className="h-3.5 w-3.5" />Memories
            </TabsTrigger>
            <TabsTrigger value="voice" className="gap-1 text-xs sm:text-sm" data-testid="tab-voice">
              <Mic className="h-3.5 w-3.5" />Voice
            </TabsTrigger>
            <TabsTrigger value="documents" className="gap-1 text-xs sm:text-sm" data-testid="tab-documents">
              <FileText className="h-3.5 w-3.5" />Documents
            </TabsTrigger>
          </TabsList>

          <TabsContent value="traits"><TraitsTab personaId={personaId} firstName={firstName} /></TabsContent>
          <TabsContent value="memories"><MemoriesTab personaId={personaId} firstName={firstName} /></TabsContent>
          <TabsContent value="voice"><VoiceTab personaId={personaId} firstName={firstName} /></TabsContent>
          <TabsContent value="documents"><DocumentsTab personaId={personaId} firstName={firstName} /></TabsContent>
        </Tabs>

        <div className="mt-8 pt-6 border-t border-border">
          <Link href={`/persona/${personaId}/chat`}>
            <Button className="w-full gap-2" data-testid="button-start-conversation">
              Start talking with {firstName}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </Layout>
  );
}
