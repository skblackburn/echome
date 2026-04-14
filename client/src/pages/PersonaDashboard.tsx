import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MessageCircle, BookOpen, Mic, Brain, ChevronRight,
  Gift, Users, ScrollText, Sparkles, Heart, Pencil, FileText
} from "lucide-react";
import type { Persona, Trait, Memory, Media } from "@shared/schema";
import { cn } from "@/lib/utils";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

interface PersonaSummary { persona: Persona; traits: Trait[]; memories: Memory[]; media: Media[]; }
interface Milestone { id: number; recipientName: string; occasion: string; deliveryDate: string; delivered: boolean; }

function StatCard({ icon: Icon, label, count, color }: { icon: React.ElementType; label: string; count: number; color: string; }) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50 border border-border">
      <div className={`p-2 rounded-lg ${color}`}><Icon className="h-4 w-4" /></div>
      <div>
        <div className="text-xl font-semibold font-display text-foreground">{count}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

function AnniversaryBanner({ persona }: { persona: Persona }) {
  const today = new Date();
  const todayMMDD = `${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const firstName = persona.name.split(" ")[0];

  // Check birthday
  const isBirthday = persona.birthYear && persona.birthYear.length === 4
    ? false // we only have year, not full date — skip
    : false;

  // Check remembrance date
  let isRemembrance = false;
  let remembranceLabel = "";
  if (persona.remembranceDate) {
    const remMMDD = persona.remembranceDate.slice(5); // MM-DD from YYYY-MM-DD
    isRemembrance = remMMDD === todayMMDD;
    if (isRemembrance) {
      const remYear = parseInt(persona.remembranceDate.slice(0, 4));
      const years = today.getFullYear() - remYear;
      remembranceLabel = years > 0 ? `${years} year${years !== 1 ? "s" : ""} ago today` : "Today";
    }
  }

  if (!isRemembrance) return null;

  return (
    <div className="rounded-2xl border border-rose-300/50 bg-rose-50 dark:bg-rose-950/20 p-5 flex items-start gap-4">
      <div className="p-2.5 rounded-xl bg-rose-100 dark:bg-rose-900/30 flex-shrink-0">
        <Heart className="h-5 w-5 text-rose-500" />
      </div>
      <div className="flex-1">
        <div className="text-sm font-semibold text-rose-700 dark:text-rose-400">
          Remembering {firstName} — {remembranceLabel}
        </div>
        <p className="text-xs text-rose-600/80 dark:text-rose-400/70 mt-0.5">
          Today is a meaningful day. {firstName} is here if you want to talk.
        </p>
        <Link href={`/persona/${persona.id}/chat`}>
          <button className="mt-2 text-xs font-medium text-rose-600 dark:text-rose-400 hover:underline">
            Start a conversation →
          </button>
        </Link>
      </div>
    </div>
  );
}

export default function PersonaDashboard() {
  const { id } = useParams<{ id: string }>();
  const personaId = parseInt(id);

  const { data, isLoading } = useQuery<PersonaSummary>({
    queryKey: ["/api/personas", personaId, "summary"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/personas/${personaId}/summary`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
  });

  const { data: milestones = [] } = useQuery<Milestone[]>({
    queryKey: ["/api/personas", personaId, "milestones"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/personas/${personaId}/milestones`);
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <Layout backTo="/" backLabel="Home">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-4">
          <Skeleton className="h-24 rounded-xl" /><Skeleton className="h-40 rounded-xl" />
        </div>
      </Layout>
    );
  }

  if (!data) {
    return (
      <Layout backTo="/" backLabel="Home">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
          <p className="text-muted-foreground">Echo not found.</p>
        </div>
      </Layout>
    );
  }

  const { persona, traits, memories, media } = data;
  const firstName = persona.name.split(" ")[0];
  const audioCount = media.filter(m => m.type === "audio").length;
  const docCount = memories.filter(m => m.type === "document").length;
  const storyCount = memories.filter(m => m.type !== "document").length;

  const today = new Date().toISOString().split("T")[0];
  const dueMilestones = milestones.filter(m => !m.delivered && m.deliveryDate <= today);
  const upcomingMilestones = milestones.filter(m => !m.delivered && m.deliveryDate > today);

  const traitsByCategory: Record<string, string[]> = {};
  traits.forEach(t => {
    if (!traitsByCategory[t.category]) traitsByCategory[t.category] = [];
    traitsByCategory[t.category].push(t.content);
  });

  // Echo health score
  let score = 0;
  if (persona.bio) score += 10;
  if (persona.pronouns) score += 5;
  if (persona.birthYear) score += 5;
  if (persona.spouse) score += 10;
  if (traits.length > 0) score += Math.min(traits.length * 3, 15);
  if (storyCount > 0) score += Math.min(storyCount * 5, 20);
  if (docCount > 0) score += 15;
  if (audioCount > 0) score += 20;
  score = Math.min(score, 100);

  const scoreColor = score >= 70 ? "text-emerald-600 dark:text-emerald-400" : score >= 40 ? "text-amber-600 dark:text-amber-400" : "text-rose-500";
  const scoreLabel = score >= 70 ? "Rich & detailed" : score >= 40 ? "Good foundation" : "Just getting started";

  return (
    <Layout backTo="/" backLabel="Home" title={persona.name}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-5">

        {/* Anniversary banner */}
        <AnniversaryBanner persona={persona} />

        {/* Due milestones banner */}
        {dueMilestones.length > 0 && (
          <Link href={`/persona/${personaId}/milestones`}>
            <div className="rounded-2xl border-2 border-amber-400/50 bg-amber-50 dark:bg-amber-950/20 p-4 flex items-center gap-4 cursor-pointer hover:border-amber-400/70 transition-colors">
              <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex-shrink-0">
                <Gift className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                  {dueMilestones.length === 1 ? "A milestone message is waiting" : `${dueMilestones.length} milestone messages are waiting`}
                </div>
                <p className="text-xs text-amber-600/80 dark:text-amber-400/70 mt-0.5">
                  For {dueMilestones.map(m => m.recipientName).join(", ")} — tap to open
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-amber-500 flex-shrink-0" />
            </div>
          </Link>
        )}

        {/* Hero */}
        <div className="flex items-start gap-5">
          {persona.photo ? (
            <img src={`${API_BASE}/uploads/${persona.photo}`} alt={persona.name}
              className="w-20 h-20 rounded-full object-cover ring-2 ring-border flex-shrink-0" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-primary/15 ring-2 ring-primary/20 flex items-center justify-center flex-shrink-0">
              <span className="font-display font-semibold text-2xl text-primary">{persona.name.slice(0, 2).toUpperCase()}</span>
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <h1 className="font-display text-xl font-semibold text-foreground">{persona.name}</h1>
              <Link href={`/persona/${personaId}/edit`}>
                <button className="p-1 rounded-md text-muted-foreground/50 hover:text-muted-foreground transition-colors" title="Edit profile">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </Link>
              <Badge variant="outline" className="capitalize border-primary/30 text-primary text-xs">{persona.relationship}</Badge>
              {persona.pronouns && <Badge variant="outline" className="text-xs text-muted-foreground">{persona.pronouns}</Badge>}
            </div>
            {persona.birthYear && <p className="text-sm text-muted-foreground">b. {persona.birthYear}{persona.birthPlace ? ` · ${persona.birthPlace}` : ""}</p>}
            {persona.bio && <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed line-clamp-2">{persona.bio}</p>}
          </div>
        </div>

        {/* Echo health */}
        <div className="rounded-xl border border-border bg-card p-4 paper-surface">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Echo Richness</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn("text-sm font-semibold", scoreColor)}>{score}%</span>
              <span className="text-xs text-muted-foreground">— {scoreLabel}</span>
            </div>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div className={cn("h-2 rounded-full transition-all", score >= 70 ? "bg-emerald-500" : score >= 40 ? "bg-amber-500" : "bg-rose-400")}
              style={{ width: `${score}%` }} />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon={BookOpen} label="Memories" count={storyCount} color="bg-primary/10 text-primary" />
          <StatCard icon={Brain} label="Traits" count={traits.length} color="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" />
          <StatCard icon={Mic} label="Recordings" count={audioCount} color="bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400" />
          <StatCard icon={ScrollText} label="Documents" count={docCount} color="bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400" />
        </div>

        {/* Primary action */}
        <Link href={`/persona/${personaId}/chat`}>
          <Card className="echo-glow echo-glow-hover cursor-pointer transition-all hover:-translate-y-0.5 bg-primary text-primary-foreground border-0">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-white/15"><MessageCircle className="h-5 w-5" /></div>
                <div>
                  <div className="font-semibold">Speak with {firstName}</div>
                  <div className="text-sm opacity-75">Have a conversation powered by their memories</div>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 opacity-60" />
            </CardContent>
          </Card>
        </Link>

        {/* Feature grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link href={`/persona/${personaId}/memories`}>
            <div className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-muted/30 transition-all cursor-pointer group paper-surface">
              <div className="p-2 rounded-lg bg-muted group-hover:bg-primary/10 transition-colors flex-shrink-0">
                <BookOpen className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground">Add Memories</div>
                <div className="text-xs text-muted-foreground">Stories, documents, voice, interview</div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </div>
          </Link>

          <Link href={`/persona/${personaId}/milestones`}>
            <div className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:border-amber-400/40 hover:bg-amber-50/50 dark:hover:bg-amber-950/10 transition-all cursor-pointer group paper-surface">
              <div className="p-2 rounded-lg bg-muted group-hover:bg-amber-100 dark:group-hover:bg-amber-900/30 transition-colors flex-shrink-0">
                <Gift className="h-4 w-4 text-muted-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground">Milestone Messages</div>
                <div className="text-xs text-muted-foreground">
                  {upcomingMilestones.length > 0 ? `${upcomingMilestones.length} upcoming` : "Future messages for loved ones"}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </div>
          </Link>

          <Link href={`/persona/${personaId}/family`}>
            <div className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-muted/30 transition-all cursor-pointer group paper-surface">
              <div className="p-2 rounded-lg bg-muted group-hover:bg-primary/10 transition-colors flex-shrink-0">
                <Users className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground">Family Sharing</div>
                <div className="text-xs text-muted-foreground">Invite family to connect with {firstName}</div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </div>
          </Link>

          <Link href={`/persona/${personaId}/journal`}>
            <div className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-muted/30 transition-all cursor-pointer group paper-surface">
              <div className="p-2 rounded-lg bg-muted group-hover:bg-primary/10 transition-colors flex-shrink-0">
                <ScrollText className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground">Conversation Journal</div>
                <div className="text-xs text-muted-foreground">Archive of every conversation</div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </div>
          </Link>

          <Link href={`/persona/${personaId}/documents`}>
            <div className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:border-sky-400/40 hover:bg-sky-50/50 dark:hover:bg-sky-950/10 transition-all cursor-pointer group paper-surface">
              <div className="p-2 rounded-lg bg-muted group-hover:bg-sky-100 dark:group-hover:bg-sky-900/30 transition-colors flex-shrink-0">
                <FileText className="h-4 w-4 text-muted-foreground group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground">Manage Documents</div>
                <div className="text-xs text-muted-foreground">
                  {docCount > 0 ? `${docCount} uploaded document${docCount !== 1 ? "s" : ""}` : "View and edit uploaded writing"}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </div>
          </Link>
        </div>

        {/* Traits preview */}
        {traits.length > 0 && (
          <Card className="paper-surface">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-foreground">Personality & Values</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {Object.entries(traitsByCategory).slice(0, 3).map(([cat, items]) => (
                <div key={cat}>
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 capitalize">{cat}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {items.slice(0, 4).map((item, i) => <Badge key={i} variant="secondary" className="text-xs">{item}</Badge>)}
                    {items.length > 4 && <Badge variant="outline" className="text-xs text-muted-foreground">+{items.length - 4} more</Badge>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
