import { useState, useEffect } from "react";
import { useParams, useLocation, useSearch } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, BookOpen, UserCircle2 } from "lucide-react";
import type { Persona, Memory } from "@shared/schema";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

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
  { value: "general", label: "General" },
];

export default function Contribute() {
  const { id } = useParams<{ id: string }>();
  const personaId = parseInt(id);
  const searchStr = useSearch();
  const viewerCode = new URLSearchParams(searchStr).get("viewer") || "";
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [type, setType] = useState("story");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [period, setPeriod] = useState("general");
  const [perspective, setPerspective] = useState<"first" | "third">("third"); // default third for contributors
  const [memberName, setMemberName] = useState("");

  const { data: persona } = useQuery<Persona>({
    queryKey: ["/api/personas", personaId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/personas/${personaId}`);
      return res.json();
    },
  });

  // Load member info from access code
  useEffect(() => {
    if (!viewerCode) return;
    fetch(`${API_BASE}/api/family/join/${viewerCode}`)
      .then(r => r.json())
      .then(d => setMemberName(d.member?.name || ""))
      .catch(() => {});
  }, [viewerCode]);

  // Load my contributions
  const { data: allMemories = [] } = useQuery<Memory[]>({
    queryKey: ["/api/personas", personaId, "memories"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/personas/${personaId}/memories`);
      return res.json();
    },
  });

  const myContributions = allMemories.filter(m => (m as any).contributorCode === viewerCode);

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/api/family/${viewerCode}/memories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, title: title || null, content, period, tags: JSON.stringify({ perspective }) }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personas", personaId, "memories"] });
      setTitle(""); setContent("");
      toast({ title: "Memory added", description: "It will enrich conversations with " + persona?.name?.split(" ")[0] });
    },
    onError: (e) => toast({ title: "Couldn't add memory", description: String(e), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (memId: number) => fetch(`${API_BASE}/api/memories/${memId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/personas", personaId, "memories"] }),
  });

  const firstName = persona?.name?.split(" ")[0] || "them";

  if (!viewerCode) {
    return (
      <Layout backTo="/" backLabel="Home">
        <div className="max-w-xl mx-auto px-4 py-10 text-center">
          <p className="text-muted-foreground">Access code required.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout backTo={`/persona/${personaId}/chat?viewer=${viewerCode}`} backLabel={`Back to ${firstName}`} title="Add a Memory">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="space-y-1">
          <h1 className="font-display text-xl font-semibold text-foreground">
            Add a memory for {firstName}
          </h1>
          {memberName && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <UserCircle2 className="h-4 w-4" />
              Contributing as {memberName}
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            Your memories will be tagged with your name so others can see who contributed them.
          </p>
        </div>

        {/* Add form */}
        <div className="space-y-4 p-5 rounded-2xl border border-border bg-card paper-surface">

          {/* Perspective picker */}
          <div className="space-y-1.5">
            <Label>Whose perspective is this?</Label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setPerspective("third")}
                className={`flex flex-col gap-0.5 p-3 rounded-xl border-2 text-left transition-all ${
                  perspective === "third" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                }`}>
                <span className="text-xs font-semibold text-foreground">My memory of {firstName}</span>
                <span className="text-xs text-muted-foreground">Something I remember her doing, saying, or experiencing</span>
              </button>
              <button type="button" onClick={() => setPerspective("first")}
                className={`flex flex-col gap-0.5 p-3 rounded-xl border-2 text-left transition-all ${
                  perspective === "first" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                }`}>
                <span className="text-xs font-semibold text-foreground">{firstName}'s own words</span>
                <span className="text-xs text-muted-foreground">Something she wrote or said, that I'm adding on her behalf</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
              <p className="text-xs text-muted-foreground">When in {firstName}'s life did this happen?</p>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Title <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Give this memory a name…" />
          </div>
          <div className="space-y-1.5">
            <Label>Memory <span className="text-destructive">*</span></Label>
            <Textarea value={content} onChange={e => setContent(e.target.value)}
              placeholder={`Share a story, memory, or piece of writing that captures who ${firstName} was…`}
              rows={5} className="resize-none" />
          </div>
          <Button disabled={!content.trim() || addMutation.isPending} onClick={() => addMutation.mutate()} className="gap-1.5">
            <Plus className="h-4 w-4" />
            {addMutation.isPending ? "Saving…" : "Add memory"}
          </Button>
        </div>

        {/* My contributions */}
        {myContributions.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Your contributions ({myContributions.length})
            </h2>
            {myContributions.map(m => (
              <Card key={m.id} className="paper-surface">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {m.title && <div className="text-sm font-medium text-foreground mb-1">{m.title}</div>}
                      <p className="text-sm text-muted-foreground line-clamp-2">{m.content}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-xs capitalize">{m.type}</Badge>
                        {m.period && m.period !== "general" && <span className="text-xs text-muted-foreground capitalize">{m.period}</span>}
                      </div>
                    </div>
                    <button onClick={() => deleteMutation.mutate(m.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        {/* Create own Echo CTA */}
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 space-y-2">
          <div className="text-sm font-semibold text-foreground">Want your own Echo?</div>
          <p className="text-xs text-muted-foreground">
            Create your own Echo and the memories you've added here can be imported directly into it.
          </p>
          <Link href={`/create?from=${viewerCode}`}>
            <button className="mt-1 text-xs font-medium text-primary hover:underline">
              Create my own Echo →
            </button>
          </Link>
        </div>
      </div>
    </Layout>
  );
}
