import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { EchoMeWordmark } from "@/components/EchoMeLogo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, MessageCircle, Heart, BookOpen, Mic, Key, CreditCard, Settings, Sun, Moon, LogOut, User, Crown, Users, GitFork, ArrowRight, Pencil, Lock } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import type { Persona } from "@shared/schema";
import { cn } from "@/lib/utils";

interface SubscriptionInfo {
  plan: string;
  limits: { echoes: number; messages: number | null };
  totalMessagesSent: number;
}

function PersonaCard({ persona }: { persona: Persona & { _isInherited?: boolean; _heirAccess?: string; parentPersonaId?: number | null; isShared?: boolean | null } }) {
  const initials = persona.name
    .split(" ")
    .map(n => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const isInherited = (persona as any)._isInherited;
  const isForked = !!(persona as any).parentPersonaId;
  const isShared = (persona as any).isShared;

  return (
    <Link href={`/persona/${persona.id}`}>
      <Card
        className="p-5 cursor-pointer echo-glow echo-glow-hover transition-all duration-200 hover:-translate-y-0.5 paper-surface"
        data-testid={`card-persona-${persona.id}`}
      >
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            {(persona as any).avatarUrl ? (
              <img src={(persona as any).avatarUrl} alt={persona.name} className="w-14 h-14 rounded-full object-cover ring-2 ring-primary/25" />
            ) : persona.photo ? (
              <img src={`/uploads/${persona.photo}`} alt={persona.name} className="w-14 h-14 rounded-full object-cover ring-2 ring-border" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-primary/15 ring-2 ring-primary/20 flex items-center justify-center">
                <span className="font-display font-semibold text-lg text-primary">{initials}</span>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-display font-semibold text-foreground leading-tight">{persona.name}</h3>
                <p className="text-sm text-muted-foreground capitalize mt-0.5">{persona.relationship}</p>
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                {isShared && !isInherited && (
                  <Badge variant="outline" className="text-xs border-purple-300 text-purple-700 dark:text-purple-400 gap-1">
                    <Users className="h-3 w-3" />Shared
                  </Badge>
                )}
                {isInherited && (
                  <Badge variant="outline" className="text-xs border-rose-300 text-rose-700 dark:text-rose-400 gap-1">
                    <Heart className="h-3 w-3" />Inherited
                  </Badge>
                )}
                {isForked && !isInherited && (
                  <Badge variant="outline" className="text-xs border-blue-300 text-blue-700 dark:text-blue-400 gap-1">
                    <GitFork className="h-3 w-3" />Copy
                  </Badge>
                )}
              </div>
            </div>
            {persona.bio && (
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed line-clamp-2">{persona.bio}</p>
            )}
            <div className="flex items-center gap-2 mt-3">
              <Link href={`/persona/${persona.id}/folder`} onClick={e => e.stopPropagation()}>
                <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-full hover:bg-muted">
                  <BookOpen className="h-3 w-3" />
                  Open Folder
                </button>
              </Link>
              <Link href={`/persona/${persona.id}/chat`} onClick={e => e.stopPropagation()}>
                <button className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors px-2.5 py-1.5 rounded-full hover:bg-primary/5">
                  <MessageCircle className="h-3 w-3" />
                  Echo
                </button>
              </Link>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}

// ── Progress bar component ────────────────────────────────────────────────────
function FolderProgress({ persona }: { persona: Persona }) {
  const { data: memories } = useQuery({
    queryKey: ["/api/personas", persona.id, "memories"],
    queryFn: async () => {
      const res = await fetch(`/api/personas/${persona.id}/memories`);
      return res.json();
    },
  });

  const memoryCount = Array.isArray(memories) ? memories.length : 0;
  const hasPhoto = !!(persona.photo || (persona as any).avatarUrl);
  const hasBio = !!persona.bio;
  const hasSpouse = !!(persona as any).spouse;

  // Score out of 100
  let score = 0;
  if (hasBio) score += 15;
  if (hasPhoto) score += 10;
  if (hasSpouse) score += 10;
  if (memoryCount >= 1) score += 20;
  if (memoryCount >= 3) score += 20;
  if (memoryCount >= 5) score += 15;
  if (memoryCount >= 10) score += 10;
  score = Math.min(score, 100);

  const label = score < 25 ? "Just getting started" : score < 50 ? "Building nicely" : score < 75 ? "Getting rich" : "Full and rich";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{persona.name}'s Folder</span>
        <span className={cn("font-medium", score < 25 ? "text-muted-foreground" : score < 75 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400")}>
          {score}% · {label}
        </span>
      </div>
      <div className="w-full bg-muted rounded-full h-1.5">
        <div
          className={cn("h-1.5 rounded-full transition-all", score < 25 ? "bg-muted-foreground/40" : score < 75 ? "bg-amber-500" : "bg-emerald-500")}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

// ── Next step recommendation ──────────────────────────────────────────────────
function NextStep({ personas }: { personas: Persona[] }) {
  const firstPersona = personas[0];

  const { data: memories } = useQuery({
    queryKey: ["/api/personas", firstPersona?.id, "memories"],
    enabled: !!firstPersona,
    queryFn: async () => {
      const res = await fetch(`/api/personas/${firstPersona.id}/memories`);
      return res.json();
    },
  });

  if (!firstPersona) return null;

  const memoryCount = Array.isArray(memories) ? memories.length : 0;
  const firstName = firstPersona.name.split(" ")[0];

  let step = {
    label: "",
    description: "",
    href: "",
    icon: Plus,
  };

  if (memoryCount === 0) {
    step = {
      label: `Write something for ${firstName}'s Folder`,
      description: "A letter, a story, or a voice note — anything that feels right.",
      href: `/persona/${firstPersona.id}/folder`,
      icon: Pencil,
    };
  } else if (memoryCount < 2) {
    step = {
      label: `Add one more memory for ${firstName}`,
      description: "Two memories create a real foundation. Keep going.",
      href: `/persona/${firstPersona.id}/folder`,
      icon: Heart,
    };
  } else if (!firstPersona.bio) {
    step = {
      label: `Tell us a little about ${firstName}`,
      description: "A few words about who they are — this shapes everything.",
      href: `/persona/${firstPersona.id}/edit`,
      icon: Pencil,
    };
  } else {
    step = {
      label: `Continue building ${firstName}'s Folder`,
      description: "More memories make the Echo richer and more personal.",
      href: `/persona/${firstPersona.id}/folder`,
      icon: BookOpen,
    };
  }

  const Icon = step.icon;

  return (
    <Link href={step.href}>
      <div className="flex items-center gap-4 p-4 rounded-xl border-2 border-primary/20 bg-primary/5 hover:border-primary/40 hover:bg-primary/8 transition-all cursor-pointer group">
        <div className="p-2.5 rounded-lg bg-primary/15 flex-shrink-0">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-foreground">{step.label}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{step.description}</div>
        </div>
        <ArrowRight className="h-4 w-4 text-primary/60 group-hover:text-primary transition-colors flex-shrink-0" />
      </div>
    </Link>
  );
}

// ── Main Home component ───────────────────────────────────────────────────────
export default function Home() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const [isDark, setIsDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  const { data: personas = [], isLoading } = useQuery<(Persona & { _isInherited?: boolean; parentPersonaId?: number | null; isShared?: boolean | null })[]>({
    queryKey: ["/api/personas"],
  });

  const { data: subscription } = useQuery<SubscriptionInfo>({
    queryKey: ["/api/subscription"],
  });

  const echoLimit = subscription?.limits?.echoes ?? 1;
  const ownEchoes = personas.filter(p => !p._isInherited && !p.parentPersonaId);
  const atEchoLimit = ownEchoes.length >= echoLimit;
  const hasPersonas = personas.length > 0;
  const firstName = user?.name?.split(" ")[0] || user?.name || "";

  // Header
  const header = (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-sm">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <EchoMeWordmark className="h-5 text-foreground" />
        <div className="flex items-center gap-1">
          <Link href="/pricing">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" title="Pricing">
              <CreditCard className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/settings">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" title="Settings">
              <Settings className="h-4 w-4" />
            </Button>
          </Link>
          <Button variant="ghost" size="icon" onClick={() => setIsDark(d => !d)} className="text-muted-foreground hover:text-foreground h-8 w-8" aria-label="Toggle theme">
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          {user && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={async () => { await logout(); navigate("/login"); }} title="Sign out">
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </header>
  );

  return (
    <div className="min-h-screen bg-background">
      {header}

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">

        {/* ── New user state ── */}
        {!isLoading && !hasPersonas && (
          <div className="space-y-8">
            {/* Personal welcome */}
            <div className="text-center pt-8 pb-4">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-5">
                <Heart className="h-7 w-7 text-primary" />
              </div>
              <h1 className="font-display text-2xl font-semibold text-foreground mb-2">
                {firstName ? `Welcome, ${firstName}.` : "Welcome."}
              </h1>
              <p className="text-muted-foreground text-base max-w-sm mx-auto leading-relaxed">
                This is your space to preserve the voice, stories, and presence of someone you love.
              </p>
            </div>

            {/* Single clear next step */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground text-center">Your first step</p>
              <Link href="/create">
                <div className="flex items-center gap-4 p-5 rounded-xl border-2 border-primary/25 bg-primary/5 hover:border-primary/40 transition-all cursor-pointer group">
                  <div className="p-3 rounded-lg bg-primary/15 flex-shrink-0">
                    <Heart className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-foreground">Start a Folder for someone you love</div>
                    <div className="text-sm text-muted-foreground mt-0.5">Letters, stories, voice notes — delivered when you choose.</div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-primary/60 group-hover:text-primary transition-colors flex-shrink-0" />
                </div>
              </Link>
            </div>

            {/* What's inside — gentle, not overwhelming */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: Pencil, label: "Write letters", desc: "Now, or for a future date" },
                { icon: Mic, label: "Record your voice", desc: "A message that lives on" },
                { icon: BookOpen, label: "Tell stories", desc: "Moments worth keeping" },
                { icon: MessageCircle, label: "Optional AI Echo", desc: "Off by default" },
              ].map(({ icon: Icon, label, desc }) => (
                <div key={label} className="flex items-start gap-3 p-3.5 rounded-xl bg-muted/40 border border-border">
                  <div className="p-1.5 rounded-lg bg-background flex-shrink-0">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-foreground">{label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-center">
              <Link href="/join">
                <button className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 mx-auto">
                  <Key className="h-3.5 w-3.5" />
                  Join with an access code
                </button>
              </Link>
            </div>
          </div>
        )}

        {/* ── Loading state ── */}
        {isLoading && (
          <div className="space-y-4 pt-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-28 rounded-lg" />
            <Skeleton className="h-28 rounded-lg" />
          </div>
        )}

        {/* ── Returning user dashboard ── */}
        {!isLoading && hasPersonas && (
          <div className="space-y-6">

            {/* Personal welcome */}
            <div>
              <h1 className="font-display text-xl font-semibold text-foreground">
                {firstName ? `Welcome back, ${firstName}.` : "Welcome back."}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {ownEchoes.length === 1
                  ? `You have one Folder here.`
                  : `You have ${ownEchoes.length} Folders here.`}
              </p>
            </div>

            {/* Next recommended step */}
            {ownEchoes.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recommended next step</p>
                <NextStep personas={ownEchoes} />
              </div>
            )}

            {/* Progress bars for each persona */}
            {ownEchoes.length > 0 && (
              <div className="space-y-3 p-4 rounded-xl bg-muted/30 border border-border">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Folder richness</p>
                <div className="space-y-4">
                  {ownEchoes.map(p => <FolderProgress key={p.id} persona={p as Persona} />)}
                </div>
              </div>
            )}

            {/* Own echoes */}
            {ownEchoes.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-base font-semibold text-foreground">Your Folders</h2>
                  <span className="text-sm text-muted-foreground">{ownEchoes.length}</span>
                </div>
                <div className="space-y-3">
                  {ownEchoes.map(p => <PersonaCard key={p.id} persona={p as any} />)}
                </div>
              </div>
            )}

            {/* Inherited/shared echoes */}
            {personas.filter(p => p._isInherited).length > 0 && (
              <div className="space-y-3">
                <h2 className="font-display text-base font-semibold text-foreground flex items-center gap-2">
                  <Heart className="h-4 w-4 text-rose-400" />
                  Shared with me
                </h2>
                <div className="space-y-3">
                  {personas.filter(p => p._isInherited).map(p => <PersonaCard key={p.id} persona={p as any} />)}
                </div>
              </div>
            )}

            {/* Forked echoes */}
            {personas.filter(p => p.parentPersonaId && !p._isInherited).length > 0 && (
              <div className="space-y-3">
                <h2 className="font-display text-base font-semibold text-foreground flex items-center gap-2">
                  <GitFork className="h-4 w-4 text-blue-500" />
                  My private copies
                </h2>
                <div className="space-y-3">
                  {personas.filter(p => p.parentPersonaId && !p._isInherited).map(p => <PersonaCard key={p.id} persona={p as any} />)}
                </div>
              </div>
            )}

            {/* Bottom actions */}
            <div className="pt-2 border-t border-border space-y-2">
              {atEchoLimit ? (
                <div className="p-4 rounded-lg bg-muted/50 text-center space-y-3">
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Crown className="h-4 w-4 text-primary" />
                    You've reached your Echo limit ({echoLimit}) on the {subscription?.plan || "free"} plan.
                  </div>
                  <Link href="/pricing">
                    <Button size="sm" className="gap-1.5">Upgrade to create more</Button>
                  </Link>
                </div>
              ) : (
                <Link href="/create">
                  <Button variant="outline" className="gap-2 w-full" data-testid="button-add-another">
                    <Plus className="h-4 w-4" />
                    Add another Folder
                  </Button>
                </Link>
              )}
              <Link href="/join">
                <Button variant="ghost" className="gap-2 w-full text-muted-foreground" data-testid="button-join-echo">
                  <Key className="h-4 w-4" />
                  Join with access code
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
