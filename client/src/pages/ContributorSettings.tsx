import { useState, useEffect } from "react";
import { useParams, useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Save, ChevronDown, ChevronUp, Eye, EyeOff, UserCircle2 } from "lucide-react";
import type { Persona, Memory } from "@shared/schema";
import { cn } from "@/lib/utils";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

interface Contributor { code: string; name: string; count: number; }
interface FilterSettings { disabledCodes: string[]; hiddenMemoryIds: number[]; }

export default function ContributorSettings() {
  const { id } = useParams<{ id: string }>();
  const personaId = parseInt(id);
  const searchStr = useSearch();
  const viewerCode = new URLSearchParams(searchStr).get("viewer") || "";
  const { toast } = useToast();

  const [settings, setSettings] = useState<FilterSettings>({ disabledCodes: [], hiddenMemoryIds: [] });
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  const [memberName, setMemberName] = useState("");

  const { data: persona } = useQuery<Persona>({
    queryKey: ["/api/personas", personaId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/personas/${personaId}`);
      return res.json();
    },
  });

  const { data: contributors = [] } = useQuery<Contributor[]>({
    queryKey: ["/api/personas", personaId, "contributors"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/personas/${personaId}/contributors`);
      return res.json();
    },
  });

  const { data: allMemories = [] } = useQuery<Memory[]>({
    queryKey: ["/api/personas", personaId, "memories"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/personas/${personaId}/memories`);
      return res.json();
    },
  });

  // Load member info and existing settings
  useEffect(() => {
    if (!viewerCode) return;
    fetch(`${API_BASE}/api/family/join/${viewerCode}`)
      .then(r => r.json())
      .then(d => {
        setMemberName(d.member?.name || "");
        if (d.member?.filterSettings) {
          try { setSettings(JSON.parse(d.member.filterSettings)); } catch (_) {}
        }
      }).catch(() => {});
  }, [viewerCode]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/api/family/settings/${viewerCode}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error("Save failed");
      return res.json();
    },
    onSuccess: () => toast({ title: "Settings saved", description: "Your content preferences have been updated." }),
    onError: () => toast({ title: "Couldn't save", variant: "destructive" }),
  });

  const toggleContributor = (code: string) => {
    setSettings(prev => ({
      ...prev,
      disabledCodes: prev.disabledCodes.includes(code)
        ? prev.disabledCodes.filter(c => c !== code)
        : [...prev.disabledCodes, code],
    }));
  };

  const toggleMemory = (memId: number) => {
    setSettings(prev => ({
      ...prev,
      hiddenMemoryIds: prev.hiddenMemoryIds.includes(memId)
        ? prev.hiddenMemoryIds.filter(id => id !== memId)
        : [...prev.hiddenMemoryIds, memId],
    }));
  };

  const firstName = persona?.name?.split(" ")[0] || "them";

  if (!viewerCode) return (
    <Layout backTo="/" backLabel="Home">
      <div className="max-w-xl mx-auto px-4 py-10 text-center">
        <p className="text-muted-foreground">Access code required.</p>
      </div>
    </Layout>
  );

  return (
    <Layout backTo={`/persona/${personaId}/chat?viewer=${viewerCode}`} backLabel={`Back to ${firstName}`} title="Content Settings">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        <div className="space-y-1">
          <h1 className="font-display text-xl font-semibold text-foreground">
            Content Settings
          </h1>
          {memberName && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <UserCircle2 className="h-4 w-4" />
              Viewing as {memberName}
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            Choose whose contributed memories appear in your conversations with {firstName}. Original content is always included.
          </p>
        </div>

        {/* Original content — always on */}
        <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-card paper-surface">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-primary">{persona?.name?.slice(0, 1)}</span>
            </div>
            <div>
              <div className="text-sm font-medium text-foreground">Original — {firstName}'s own words</div>
              <div className="text-xs text-muted-foreground">Built by the primary creator</div>
            </div>
          </div>
          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0 text-xs">
            Always on
          </Badge>
        </div>

        {/* Contributors */}
        {contributors.length === 0 ? (
          <div className="rounded-xl border border-border bg-muted/30 p-6 text-center">
            <p className="text-sm text-muted-foreground">No family contributions yet.</p>
            <p className="text-xs text-muted-foreground/70 mt-1">When family members add memories, they'll appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Family contributions</h2>
            {contributors.map(contributor => {
              const isDisabled = settings.disabledCodes.includes(contributor.code);
              const isExpanded = expandedCode === contributor.code;
              const theirMemories = allMemories.filter(m => (m as any).contributorCode === contributor.code);

              return (
                <div key={contributor.code} className={cn(
                  "rounded-xl border overflow-hidden transition-all",
                  isDisabled ? "border-border bg-muted/20 opacity-60" : "border-border bg-card paper-surface"
                )}>
                  {/* Contributor row */}
                  <div className="flex items-center gap-3 p-4">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-muted-foreground">{contributor.name.slice(0, 1).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground">{contributor.name}</div>
                      <div className="text-xs text-muted-foreground">{contributor.count} {contributor.count === 1 ? "memory" : "memories"}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => toggleContributor(contributor.code)}
                        className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                          isDisabled
                            ? "border-border text-muted-foreground hover:border-primary/40"
                            : "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400")}>
                        {isDisabled ? <><EyeOff className="h-3 w-3" /> Hidden</> : <><Eye className="h-3 w-3" /> Shown</>}
                      </button>
                      {!isDisabled && theirMemories.length > 0 && (
                        <button onClick={() => setExpandedCode(isExpanded ? null : contributor.code)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Individual memory toggles */}
                  {isExpanded && !isDisabled && (
                    <div className="border-t border-border bg-muted/20 p-3 space-y-2">
                      <p className="text-xs text-muted-foreground px-1 mb-2">Toggle individual memories on or off:</p>
                      {theirMemories.map(m => {
                        const isHidden = settings.hiddenMemoryIds.includes(m.id);
                        return (
                          <div key={m.id} className={cn(
                            "flex items-start gap-3 p-3 rounded-lg border transition-all",
                            isHidden ? "border-border bg-background/40 opacity-50" : "border-border bg-background/80"
                          )}>
                            <div className="flex-1 min-w-0">
                              {m.title && <div className="text-xs font-medium text-foreground">{m.title}</div>}
                              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{m.content}</p>
                              <Badge variant="outline" className="text-xs mt-1 capitalize">{m.type}</Badge>
                            </div>
                            <button onClick={() => toggleMemory(m.id)}
                              className={cn("flex-shrink-0 p-1.5 rounded-lg border text-xs transition-all mt-0.5",
                                isHidden
                                  ? "border-border text-muted-foreground hover:border-primary/40"
                                  : "border-emerald-300 bg-emerald-50 text-emerald-600 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400")}>
                              {isHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <Button className="w-full gap-2" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          <Save className="h-4 w-4" />
          {saveMutation.isPending ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </Layout>
  );
}
