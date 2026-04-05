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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  BookOpen, Brain, Mic, Image as ImageIcon, Plus, Trash2,
  Upload, X, CheckCircle2, ChevronRight
} from "lucide-react";
import { Link } from "wouter";
import type { Persona, Trait, Memory, Media } from "@shared/schema";

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

// ── Trait intake tab ──────────────────────────────────────────────────────────
function TraitsTab({ personaId, firstName }: { personaId: number; firstName: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState("value");
  const [content, setContent] = useState("");

  const { data: traits = [] } = useQuery<Trait[]>({
    queryKey: ["/api/personas", personaId, "traits"],
    queryFn: async () => {
      const res = await fetch(`/api/personas/${personaId}/traits`);
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
      queryClient.invalidateQueries({ queryKey: ["/api/personas", personaId, "summary"] });
    },
  });

  const traitsByCategory: Record<string, Trait[]> = {};
  traits.forEach(t => {
    if (!traitsByCategory[t.category]) traitsByCategory[t.category] = [];
    traitsByCategory[t.category].push(t);
  });

  const PROMPTS: Record<string, string[]> = {
    value: ["Family above all else", "Honesty in everything", "Hard work and persistence"],
    belief: ["Everything happens for a reason", "Love conquers all", "Education opens every door"],
    personality: ["Warm and generous", "Could light up any room", "Always the first to help"],
    saying: ["\"This too shall pass\"", "\"Work hard, be kind\"", "\"Family is everything\""],
    advice: ["Always trust your gut", "Don't sweat the small things", "Call your family more"],
  };

  return (
    <div className="space-y-5">
      <div className="rounded-lg bg-muted/50 border border-border p-4 text-sm text-muted-foreground">
        <p>Traits shape how {firstName}'s Echo thinks and speaks. Add their core values, personality, favorite sayings — anything that captures who they are.</p>
      </div>

      {/* Add trait form */}
      <div className="space-y-3 p-4 rounded-lg border border-border paper-surface">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger data-testid="select-trait-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRAIT_CATEGORIES.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Trait</Label>
            <Input
              placeholder="e.g., Always put family first"
              value={content}
              onChange={e => setContent(e.target.value)}
              onKeyDown={e => e.key === "Enter" && content.trim() && addMutation.mutate()}
              data-testid="input-trait-content"
            />
          </div>
        </div>

        {/* Prompt suggestions */}
        <div>
          <p className="text-xs text-muted-foreground mb-1.5">Quick prompts:</p>
          <div className="flex flex-wrap gap-1.5">
            {(PROMPTS[category] || []).map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setContent(p.replace(/"/g, ""))}
                className="text-xs px-2.5 py-1 rounded-full bg-muted hover:bg-secondary border border-border text-muted-foreground hover:text-foreground transition-colors"
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <Button
          size="sm"
          disabled={!content.trim() || addMutation.isPending}
          onClick={() => addMutation.mutate()}
          className="gap-1.5"
          data-testid="button-add-trait"
        >
          <Plus className="h-3.5 w-3.5" />
          Add trait
        </Button>
      </div>

      {/* Existing traits */}
      {Object.entries(traitsByCategory).map(([cat, items]) => (
        <div key={cat}>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 capitalize">
            {TRAIT_CATEGORIES.find(c => c.value === cat)?.label || cat}
          </div>
          <div className="flex flex-wrap gap-2">
            {items.map(t => (
              <div key={t.id} className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted border border-border text-sm">
                <span>{t.content}</span>
                <button
                  onClick={() => deleteMutation.mutate(t.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors ml-0.5"
                  data-testid={`button-delete-trait-${t.id}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {traits.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">No traits added yet. Start with a core value.</p>
      )}
    </div>
  );
}

// ── Memory stories tab ────────────────────────────────────────────────────────
function MemoriesTab({ personaId, firstName }: { personaId: number; firstName: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [type, setType] = useState("story");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [period, setPeriod] = useState("general");

  const { data: memories = [] } = useQuery<Memory[]>({
    queryKey: ["/api/personas", personaId, "memories"],
    queryFn: async () => {
      const res = await fetch(`/api/personas/${personaId}/memories`);
      return res.json();
    },
  });

  const addMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/personas/${personaId}/memories`, {
      type, title: title || null, content, period,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personas", personaId, "memories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/personas", personaId, "summary"] });
      setTitle("");
      setContent("");
      toast({ title: "Memory saved" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/memories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personas", personaId, "memories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/personas", personaId, "summary"] });
    },
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
      <div className="rounded-lg bg-muted/50 border border-border p-4 text-sm text-muted-foreground">
        <p>Memories are the foundation of {firstName}'s Echo. The more stories you share, the more authentic the conversations will feel.</p>
      </div>

      {/* Add memory form */}
      <div className="space-y-3 p-4 rounded-lg border border-border paper-surface">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger data-testid="select-memory-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MEMORY_TYPES.map(m => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Life period</Label>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LIFE_PERIODS.map(l => (
                  <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Title <span className="text-muted-foreground text-xs">(optional)</span></Label>
          <Input
            placeholder="Give this memory a name…"
            value={title}
            onChange={e => setTitle(e.target.value)}
            data-testid="input-memory-title"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Memory / Story <span className="text-destructive">*</span></Label>
          <Textarea
            placeholder="Write in your own words. Be as detailed and personal as you can — the more genuine, the better the Echo will be."
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={5}
            className="resize-none"
            data-testid="input-memory-content"
          />
        </div>

        {/* Prompts */}
        <div>
          <p className="text-xs text-muted-foreground mb-1.5">Story prompts:</p>
          <div className="flex flex-wrap gap-1.5">
            {STORY_PROMPTS.map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setTitle(p)}
                className="text-xs px-2.5 py-1 rounded-full bg-muted hover:bg-secondary border border-border text-muted-foreground hover:text-foreground transition-colors"
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <Button
          size="sm"
          disabled={!content.trim() || addMutation.isPending}
          onClick={() => addMutation.mutate()}
          className="gap-1.5"
          data-testid="button-add-memory"
        >
          <Plus className="h-3.5 w-3.5" />
          Save memory
        </Button>
      </div>

      {/* Memories list */}
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
                      {m.period && m.period !== "general" && (
                        <span className="text-xs text-muted-foreground capitalize">{m.period}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteMutation.mutate(m.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0 mt-0.5"
                    data-testid={`button-delete-memory-${m.id}`}
                  >
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

// ── Media upload tab ──────────────────────────────────────────────────────────
function MediaTab({ personaId, firstName }: { personaId: number; firstName: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const audioRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);

  const { data: mediaList = [] } = useQuery<Media[]>({
    queryKey: ["/api/personas", personaId, "media"],
    queryFn: async () => {
      const res = await fetch(`/api/personas/${personaId}/media`);
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/media/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personas", personaId, "media"] });
      queryClient.invalidateQueries({ queryKey: ["/api/personas", personaId, "summary"] });
    },
  });

  const uploadFile = async (file: File, type: string) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("type", type);
      if (description) form.append("description", description);
      const res = await fetch(`/api/personas/${personaId}/media`, { method: "POST", body: form });
      if (!res.ok) throw new Error("Upload failed");
      queryClient.invalidateQueries({ queryKey: ["/api/personas", personaId, "media"] });
      queryClient.invalidateQueries({ queryKey: ["/api/personas", personaId, "summary"] });
      setDescription("");
      toast({ title: `${type === "audio" ? "Recording" : "Photo"} uploaded` });
    } catch (e) {
      toast({ title: "Upload failed", description: String(e), variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const audioFiles = mediaList.filter(m => m.type === "audio");
  const photoFiles = mediaList.filter(m => m.type === "photo");

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-muted/50 border border-border p-4 text-sm text-muted-foreground">
        <p>Upload voice recordings so the Echo knows how {firstName} sounds. Photos and documents add richness to who they are.</p>
      </div>

      {/* Optional description */}
      <div className="space-y-1.5">
        <Label>Description <span className="text-muted-foreground text-xs">(optional, applies to next upload)</span></Label>
        <Input
          placeholder="e.g., Voicemail from Christmas 2019"
          value={description}
          onChange={e => setDescription(e.target.value)}
          data-testid="input-media-description"
        />
      </div>

      {/* Upload buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => audioRef.current?.click()}
          disabled={uploading}
          className="flex flex-col items-center gap-2 p-5 rounded-lg border-2 border-dashed border-border
                     hover:border-primary/40 hover:bg-muted/50 transition-all cursor-pointer disabled:opacity-50"
          data-testid="button-upload-audio"
        >
          <Mic className="h-7 w-7 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Voice Recording</span>
          <span className="text-xs text-muted-foreground text-center">MP3, WAV, M4A up to 50MB</span>
        </button>
        <button
          type="button"
          onClick={() => photoRef.current?.click()}
          disabled={uploading}
          className="flex flex-col items-center gap-2 p-5 rounded-lg border-2 border-dashed border-border
                     hover:border-primary/40 hover:bg-muted/50 transition-all cursor-pointer disabled:opacity-50"
          data-testid="button-upload-photo"
        >
          <ImageIcon className="h-7 w-7 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Photo</span>
          <span className="text-xs text-muted-foreground text-center">JPG, PNG up to 50MB</span>
        </button>
      </div>

      <input ref={audioRef} type="file" accept="audio/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f, "audio"); }} />
      <input ref={photoRef} type="file" accept="image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f, "photo"); }} />

      {uploading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="h-4 w-4 rounded-full border-2 border-primary/50 border-t-primary animate-spin" />
          Uploading…
        </div>
      )}

      {/* Audio list */}
      {audioFiles.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-2">Voice Recordings ({audioFiles.length})</h4>
          <div className="space-y-2">
            {audioFiles.map(m => (
              <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
                <Mic className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{m.originalName}</div>
                  {m.description && <div className="text-xs text-muted-foreground">{m.description}</div>}
                </div>
                <audio src={`/uploads/${m.filename}`} controls className="h-8 max-w-[160px]" />
                <button onClick={() => deleteMutation.mutate(m.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Photo list */}
      {photoFiles.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-2">Photos ({photoFiles.length})</h4>
          <div className="grid grid-cols-3 gap-2">
            {photoFiles.map(m => (
              <div key={m.id} className="relative group">
                <img src={`/uploads/${m.filename}`} alt={m.originalName}
                  className="w-full aspect-square object-cover rounded-lg border border-border" />
                <button
                  onClick={() => deleteMutation.mutate(m.id)}
                  className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
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
      const res = await fetch(`/api/personas/${personaId}`);
      return res.json();
    },
  });

  const firstName = persona?.name?.split(" ")[0] || "them";

  return (
    <Layout backTo={`/persona/${personaId}`} backLabel={persona?.name || "Back"} title="Memory Intake">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="font-display text-xl font-semibold text-foreground mb-1">
            Build {firstName}'s Echo
          </h1>
          <p className="text-sm text-muted-foreground">
            Add personality traits, memories, and recordings. The more you add, the more authentic the conversations become.
          </p>
        </div>

        <Tabs defaultValue="traits" className="space-y-5">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="traits" className="gap-1.5 text-xs sm:text-sm" data-testid="tab-traits">
              <Brain className="h-3.5 w-3.5" />
              Personality
            </TabsTrigger>
            <TabsTrigger value="memories" className="gap-1.5 text-xs sm:text-sm" data-testid="tab-memories">
              <BookOpen className="h-3.5 w-3.5" />
              Memories
            </TabsTrigger>
            <TabsTrigger value="media" className="gap-1.5 text-xs sm:text-sm" data-testid="tab-media">
              <Mic className="h-3.5 w-3.5" />
              Voice & Photos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="traits">
            <TraitsTab personaId={personaId} firstName={firstName} />
          </TabsContent>
          <TabsContent value="memories">
            <MemoriesTab personaId={personaId} firstName={firstName} />
          </TabsContent>
          <TabsContent value="media">
            <MediaTab personaId={personaId} firstName={firstName} />
          </TabsContent>
        </Tabs>

        {/* CTA */}
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
