/**
 * EchoCreate — 8-step Echo Creation Flow
 * Route: /persona/:id/create
 * UX Copy Package: Final (June 2026)
 */

import { useState, useRef, useCallback } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, ArrowRight, CheckCircle2, Circle, Sparkles,
  Heart, Lightbulb, BookOpen, Mic, FileText, Camera,
  Mail, MessageSquare, Loader2, Upload, Square, ChevronDown, ChevronUp,
} from "lucide-react";
import type { Persona } from "@shared/schema";
import { cn } from "@/lib/utils";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

// ── Adaptive pronoun helper ───────────────────────────────────────────────────
function pro(isSelf: boolean, they: string, you: string) {
  return isSelf ? you : they;
}

// ── Step progress bar ─────────────────────────────────────────────────────────
const STEP_LABELS = ["About", "Values", "Life Story", "Interview", "Memories", "Voice", "Writing", "Preview"];

function StepProgress({ current, total }: { current: number; total: number }) {
  return (
    <div className="space-y-3 mb-8">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Step {current} of {total}</span>
        <span className="font-medium text-foreground">{STEP_LABELS[current - 1]}</span>
      </div>
      <div className="flex gap-1">
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} className={cn("h-1.5 flex-1 rounded-full transition-all duration-300", i < current ? "bg-primary" : "bg-muted")} />
        ))}
      </div>
    </div>
  );
}

// ── AutoSaving textarea ───────────────────────────────────────────────────────
function AutoTextarea({ value, onChange, placeholder, rows = 4, className }: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; rows?: number; className?: string;
}) {
  return (
    <Textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className={cn("resize-none text-sm leading-relaxed", className)}
    />
  );
}

// ── Multi-select chips ────────────────────────────────────────────────────────
function MultiSelect({ options, selected, onToggle }: {
  options: string[]; selected: string[]; onToggle: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => {
        const active = selected.includes(opt);
        return (
          <button key={opt} type="button" onClick={() => onToggle(opt)}
            className={cn("px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
              active ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
            )}>
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// ── Collapsible section ───────────────────────────────────────────────────────
function CollapsibleSection({ title, icon: Icon, defaultOpen = false, children }: {
  title: string; icon: React.ElementType; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors">
        <div className="flex items-center gap-3">
          <Icon className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm text-foreground">{title}</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1 space-y-3 border-t border-border bg-card">
          {children}
        </div>
      )}
    </div>
  );
}

// ── Step shell wrapper ────────────────────────────────────────────────────────
function StepShell({ step, total, title, subtitle, bottomNote, onBack, onContinue,
  onSaveLater, backLabel = "Back", continueLabel = "Continue", continueSecondary,
  onContinueSecondary, saving = false, canContinue = true, children }: {
  step: number; total: number; title: string; subtitle?: string; bottomNote?: string;
  onBack?: () => void; onContinue: () => void; onSaveLater: () => void;
  backLabel?: string; continueLabel?: string;
  continueSecondary?: string; onContinueSecondary?: () => void;
  saving?: boolean; canContinue?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <StepProgress current={step} total={total} />
      <div>
        <h2 className="font-display text-xl font-semibold text-foreground">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{subtitle}</p>}
      </div>
      <div className="space-y-5">{children}</div>
      {bottomNote && (
        <p className="text-xs text-muted-foreground leading-relaxed">{bottomNote}</p>
      )}
      <div className="flex flex-col gap-3 pt-2">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="outline" onClick={onBack} className="gap-1.5">
              <ArrowLeft className="h-4 w-4" />{backLabel}
            </Button>
          )}
          <Button className="flex-1 gap-2" onClick={onContinue} disabled={!canContinue || saving}>
            {saving
              ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</>
              : <>{continueLabel}<ArrowRight className="h-4 w-4" /></>}
          </Button>
        </div>
        {continueSecondary && onContinueSecondary && (
          <Button variant="outline" className="w-full" onClick={onContinueSecondary}>
            {continueSecondary}
          </Button>
        )}
        <button type="button" onClick={onSaveLater}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors text-center">
          Save &amp; come back later
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// STEP 1 — ABOUT THEM / YOU
// ════════════════════════════════════════════════════════════════════════════

interface Step1Data { description: string; unique: string; loved: string; extra: string; }

function Step1({ persona, isSelf, initial, onComplete, onSaveLater }: {
  persona: Persona; isSelf: boolean; initial: Step1Data;
  onComplete: (data: Step1Data) => void; onSaveLater: () => void;
}) {
  const [d, setD] = useState(initial);
  const set = (k: keyof Step1Data) => (v: string) => setD(p => ({ ...p, [k]: v }));

  return (
    <StepShell
      step={1} total={8}
      title={pro(isSelf, "Let's begin with who you are.", "Let's begin with who they were.")}
      subtitle={pro(isSelf,
        "Tell us a little about yourself. This helps the Echo understand your essence before we go deeper.",
        "Tell us a little about them. This helps the Echo understand their essence before we go deeper."
      )}
      bottomNote="You can share as much or as little as you want. You can always add more later."
      onContinue={() => onComplete(d)}
      onSaveLater={onSaveLater}
      canContinue={d.description.trim().length > 5}
    >
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">
          {pro(isSelf, "How would you describe yourself in your own words?", "How would you describe them in your own words?")}
        </label>
        <AutoTextarea value={d.description} onChange={set("description")} rows={4}
          placeholder="e.g., Warm and steady. Curious. Loved rainy mornings. Always humming while cooking." />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">
          {pro(isSelf, "What makes you unique?", "What made them unique?")}
        </label>
        <AutoTextarea value={d.unique} onChange={set("unique")} rows={3}
          placeholder="e.g., Their laugh. Their curiosity. Their way of making people feel seen." />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">
          {pro(isSelf, "What do you love?", "What did they love?")}
        </label>
        <AutoTextarea value={d.loved} onChange={set("loved")} rows={3}
          placeholder="e.g., Gardening, jazz, long drives, cinnamon rolls, rainy mornings." />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">
          {pro(isSelf, "Anything else you want the Echo to know about you?", "Anything else you want the Echo to know about them?")}
          {" "}<span className="text-muted-foreground font-normal text-xs">(optional)</span>
        </label>
        <AutoTextarea value={d.extra} onChange={set("extra")} rows={2}
          placeholder="e.g., They always kept a notebook in their bag. They never missed a sunset." />
      </div>
    </StepShell>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// STEP 2 — PERSONALITY & VALUES
// ════════════════════════════════════════════════════════════════════════════

const VALUES_OPTIONS = ["Kindness", "Honesty", "Loyalty", "Curiosity", "Family", "Independence", "Creativity", "Faith", "Hard work", "Justice", "Courage", "Humor", "Simplicity", "Service", "Adventure"];
const DECISION_OPTIONS = ["Intuitively", "Logically", "Slowly and carefully", "Quickly and confidently", "With others", "Independently"];

interface Step2Data {
  values: string[]; valuesOther: string; showedLove: string;
  comforted: string; decisions: string[]; decisionsOther: string; grounded: string;
}

function Step2({ persona, isSelf, initial, onComplete, onBack, onSaveLater }: {
  persona: Persona; isSelf: boolean; initial: Step2Data;
  onComplete: (data: Step2Data) => void; onBack: () => void; onSaveLater: () => void;
}) {
  const [d, setD] = useState(initial);
  const set = (k: keyof Step2Data) => (v: any) => setD(p => ({ ...p, [k]: v }));
  const toggle = (arr: string[], v: string) => arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v];

  return (
    <StepShell
      step={2} total={8}
      title={pro(isSelf, "Let's explore what shapes your inner world.", "Let's explore what shaped their inner world.")}
      subtitle={pro(isSelf,
        "These questions help the Echo understand your values, strengths, and the way you move through life.",
        "These questions help the Echo understand their values, strengths, and the way they moved through life."
      )}
      bottomNote="There are no right answers. Share whatever feels true — you can always add more later."
      onBack={onBack} backLabel="Back to Step 1"
      onContinue={() => onComplete(d)} onSaveLater={onSaveLater}
      canContinue={d.values.length > 0 || d.valuesOther.trim().length > 0}
    >
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">
          {pro(isSelf, "What matters most to you?", "What mattered most to them?")}
        </label>
        <MultiSelect options={VALUES_OPTIONS} selected={d.values}
          onToggle={v => set("values")(toggle(d.values, v))} />
        <Input value={d.valuesOther} onChange={e => set("valuesOther")(e.target.value)}
          placeholder="+ Add your own" className="text-sm mt-2" />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">
          {pro(isSelf, "How do you show love or care?", "How did they show love or care?")}
        </label>
        <AutoTextarea value={d.showedLove} onChange={set("showedLove")} rows={2}
          placeholder="e.g., Through small gestures, through words, through acts of service, through humor." />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">
          {pro(isSelf,
            "When someone you love is hurting, how do you respond?",
            "When someone they loved was hurting, how did they respond?"
          )}
        </label>
        <AutoTextarea value={d.comforted} onChange={set("comforted")} rows={2}
          placeholder="e.g., They listened quietly. They offered advice. They made tea." />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">
          {pro(isSelf, "How do you make decisions?", "How did they make decisions?")}
        </label>
        <MultiSelect options={DECISION_OPTIONS} selected={d.decisions}
          onToggle={v => set("decisions")(toggle(d.decisions, v))} />
        <Input value={d.decisionsOther} onChange={e => set("decisionsOther")(e.target.value)}
          placeholder="+ Add your own" className="text-sm mt-2" />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">
          {pro(isSelf,
            "What helps you stay grounded during hard times?",
            "What helped them stay grounded during hard times?"
          )}
        </label>
        <AutoTextarea value={d.grounded} onChange={set("grounded")} rows={2}
          placeholder="e.g., Nature, faith, journaling, music, talking to someone they trusted." />
      </div>
    </StepShell>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// STEP 3 — LIFE STORY
// ════════════════════════════════════════════════════════════════════════════

const PLACES_OPTIONS = ["Kitchen", "Beach", "Childhood bedroom", "Hiking trail", "Grandmother's house", "Café", "Garden", "Library", "Church"];

interface Step3Data {
  childhood: string; places: string[]; placesOther: string;
  sensory: string; humor: string; hardTimes: string; defining: string;
}

function Step3({ persona, isSelf, initial, onComplete, onBack, onSaveLater }: {
  persona: Persona; isSelf: boolean; initial: Step3Data;
  onComplete: (data: Step3Data) => void; onBack: () => void; onSaveLater: () => void;
}) {
  const [d, setD] = useState(initial);
  const set = (k: keyof Step3Data) => (v: any) => setD(p => ({ ...p, [k]: v }));
  const toggle = (arr: string[], v: string) => arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v];
  const filled = d.childhood.trim().length > 0 || d.sensory.trim().length > 0 || d.humor.trim().length > 0;

  return (
    <StepShell
      step={3} total={8}
      title={pro(isSelf, "Let's explore the moments that shaped your life.", "Let's explore the moments that shaped their life.")}
      subtitle={pro(isSelf,
        "These questions help the Echo understand your world — the memories, places, and experiences that matter most.",
        "These questions help the Echo understand their world — the memories, places, and experiences that mattered most."
      )}
      bottomNote="Share whatever feels meaningful. You can always add more memories later."
      onBack={onBack} backLabel="Back to Step 2"
      onContinue={() => onComplete(d)} onSaveLater={onSaveLater}
      canContinue={filled}
    >
      <CollapsibleSection title={pro(isSelf, "Your childhood", "Their childhood")} icon={Heart} defaultOpen>
        <label className="text-xs text-muted-foreground block mb-2">
          {pro(isSelf, "What was your childhood like?", "What was their childhood like?")}
        </label>
        <AutoTextarea value={d.childhood} onChange={set("childhood")} rows={3}
          placeholder="e.g., Grew up near the ocean. Shy at first but silly with family." />
      </CollapsibleSection>

      <CollapsibleSection title={pro(isSelf, "Where you feel most at home", "Where they felt most at home")} icon={BookOpen}>
        <label className="text-xs text-muted-foreground block mb-2">
          {pro(isSelf, "Where do you feel most at home?", "Where did they feel most at home?")}
        </label>
        <MultiSelect options={PLACES_OPTIONS} selected={d.places}
          onToggle={v => set("places")(toggle(d.places, v))} />
        <Input value={d.placesOther} onChange={e => set("placesOther")(e.target.value)}
          placeholder="+ Add your own" className="text-sm mt-2" />
      </CollapsibleSection>

      <CollapsibleSection title="Sensory memories" icon={Sparkles}>
        <label className="text-xs text-muted-foreground block mb-2">
          {pro(isSelf,
            "What smells, sounds, or tastes feel like home to you?",
            "What smells, sounds, or tastes remind you of them?"
          )}
        </label>
        <AutoTextarea value={d.sensory} onChange={set("sensory")} rows={3}
          placeholder="e.g., Cinnamon rolls, rain on pavement, jazz music, lavender lotion." />
      </CollapsibleSection>

      <CollapsibleSection title="Humor & joy" icon={Heart}>
        <label className="text-xs text-muted-foreground block mb-2">
          {pro(isSelf, "What makes you laugh?", "What made them laugh?")}
        </label>
        <AutoTextarea value={d.humor} onChange={set("humor")} rows={3}
          placeholder={pro(isSelf, "What brings you pure joy?", "What brought them pure joy?")} />
      </CollapsibleSection>

      <CollapsibleSection title="Hard times" icon={Lightbulb}>
        <label className="text-xs text-muted-foreground block mb-2">
          {pro(isSelf, "What challenges have you faced?", "What challenges did they face?")}
        </label>
        <AutoTextarea value={d.hardTimes} onChange={set("hardTimes")} rows={3}
          placeholder={pro(isSelf,
            "Struggles I've faced. How I got through them.",
            "Struggles they faced. How they got through them."
          )} />
      </CollapsibleSection>

      <CollapsibleSection title="Defining moments" icon={Sparkles}>
        <label className="text-xs text-muted-foreground block mb-2">
          {pro(isSelf, "What moments changed you?", "What moments changed them?")}
        </label>
        <AutoTextarea value={d.defining} onChange={set("defining")} rows={3}
          placeholder={pro(isSelf,
            "A decision, a person, a turning point in my life…",
            "A decision, a person, a turning point in their life…"
          )} />
      </CollapsibleSection>
    </StepShell>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// STEP 4 — GUIDED INTERVIEW
// ════════════════════════════════════════════════════════════════════════════

interface Step4Data {
  childhood: string; relationships: string; turningPoints: string;
  wisdom: string; legacy: string;
}

function Step4({ persona, isSelf, initial, onComplete, onBack, onSaveLater }: {
  persona: Persona; isSelf: boolean; initial: Step4Data;
  onComplete: (data: Step4Data) => void; onBack: () => void; onSaveLater: () => void;
}) {
  const [d, setD] = useState(initial);
  const set = (k: keyof Step4Data) => (v: string) => setD(p => ({ ...p, [k]: v }));
  const filled = Object.values(d).some(v => v.trim().length > 10);

  return (
    <StepShell
      step={4} total={8}
      title={pro(isSelf, "Let's go deeper into your story.", "Let's go deeper into their story.")}
      subtitle={pro(isSelf,
        "These questions help the Echo understand your life in your own words.",
        "These questions help the Echo understand their life in their own words."
      )}
      bottomNote="Share whatever feels meaningful. You can skip any question — the Echo will grow with every story you add."
      onBack={onBack} backLabel="Back to Step 3"
      onContinue={() => onComplete(d)} onSaveLater={onSaveLater}
      canContinue={filled}
    >
      <CollapsibleSection title="Childhood & early life" icon={Heart} defaultOpen>
        <p className="text-sm font-medium text-foreground mb-1">
          {pro(isSelf, "What were you like as a child?", "What were they like as a child?")}
        </p>
        <p className="text-xs text-muted-foreground mb-2 leading-relaxed">
          {pro(isSelf,
            "What's a childhood memory that still feels vivid? Who shaped you growing up?",
            "What's a childhood memory that still feels vivid? Who shaped them growing up?"
          )}
        </p>
        <AutoTextarea value={d.childhood} onChange={set("childhood")} rows={4}
          placeholder={pro(isSelf, "I grew up in…", "They grew up in…")} />
      </CollapsibleSection>

      <CollapsibleSection title="Relationships & love" icon={Heart}>
        <p className="text-sm font-medium text-foreground mb-1">
          {pro(isSelf, "Who are the most important people in your life?", "Who were the most important people in their life?")}
        </p>
        <p className="text-xs text-muted-foreground mb-2 leading-relaxed">
          {pro(isSelf,
            "How do you show love? What relationships shaped you the most?",
            "How did they show love? What relationships shaped them the most?"
          )}
        </p>
        <AutoTextarea value={d.relationships} onChange={set("relationships")} rows={4}
          placeholder={pro(isSelf, "Love, to me, means…", "Love, to them, meant…")} />
      </CollapsibleSection>

      <CollapsibleSection title="Turning points" icon={Sparkles}>
        <p className="text-sm font-medium text-foreground mb-1">
          {pro(isSelf,
            "What moments changed the direction of your life?",
            "What moments changed the direction of their life?"
          )}
        </p>
        <AutoTextarea value={d.turningPoints} onChange={set("turningPoints")} rows={4}
          placeholder={pro(isSelf,
            "One moment that changed everything for me was…",
            "One moment that changed everything for them was…"
          )} />
      </CollapsibleSection>

      <CollapsibleSection title="Wisdom & lessons" icon={Lightbulb}>
        <p className="text-sm font-medium text-foreground mb-1">
          {pro(isSelf, "What wisdom do you carry?", "What wisdom did they carry?")}
        </p>
        <AutoTextarea value={d.wisdom} onChange={set("wisdom")} rows={4}
          placeholder={pro(isSelf, "The best advice I ever give is…", "The best advice they ever gave was…")} />
      </CollapsibleSection>

      <CollapsibleSection title="Legacy & meaning" icon={BookOpen}>
        <p className="text-sm font-medium text-foreground mb-1">
          {pro(isSelf,
            "What do you hope people remember most about you?",
            "What do you hope people remember most about them?"
          )}
        </p>
        <AutoTextarea value={d.legacy} onChange={set("legacy")} rows={4}
          placeholder={pro(isSelf, "I want to be remembered as…", "They wanted to be remembered as…")} />
      </CollapsibleSection>
    </StepShell>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// STEP 5 — ADD MEMORIES (Folder integration)
// ════════════════════════════════════════════════════════════════════════════

function Step5({ persona, isSelf, onComplete, onBack, onSaveLater }: {
  persona: Persona; isSelf: boolean;
  onComplete: () => void; onBack: () => void; onSaveLater: () => void;
}) {
  const memoryCards = [
    {
      icon: Mail,
      label: "Letters",
      description: pro(isSelf,
        "Letters you've written, or letters others have written to you.",
        "Letters you've written to them — or letters they wrote to you."
      ),
      buttonLabel: "Add a Letter",
      href: `/persona/${persona.id}/folder/letter/new`,
      color: "text-rose-500 bg-rose-50 dark:bg-rose-900/20",
    },
    {
      icon: BookOpen,
      label: "Stories",
      description: pro(isSelf,
        "Stories about your life — big moments, small moments, anything that mattered.",
        "Stories about their life — big moments, small moments, anything that mattered."
      ),
      buttonLabel: "Add a Story",
      href: `/persona/${persona.id}/folder/story/new`,
      color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20",
    },
    {
      icon: Camera,
      label: "Photos",
      description: pro(isSelf,
        "Photos that capture who you are.",
        "Photos that capture who they were."
      ),
      buttonLabel: "Upload a Photo",
      href: `/photos/new?persona=${persona.id}`,
      color: "text-amber-500 bg-amber-50 dark:bg-amber-900/20",
    },
    {
      icon: FileText,
      label: "Documents",
      description: pro(isSelf,
        "Writing, notes, recipes, or anything you've written.",
        "Writing, notes, recipes, or anything they wrote."
      ),
      buttonLabel: "Upload a Document",
      href: `/persona/${persona.id}/documents`,
      color: "text-sky-500 bg-sky-50 dark:bg-sky-900/20",
    },
  ];

  return (
    <StepShell
      step={5} total={8}
      title={pro(isSelf,
        "Let's add the memories that bring your voice to life.",
        "Let's add the memories that bring their voice to life."
      )}
      subtitle="Letters, stories, photos, and documents help the Echo understand them in a deeper, more personal way."
      bottomNote="You can skip this for now. You can add memories anytime — the Echo will grow with every piece you share."
      onBack={onBack} backLabel="Back to Step 4"
      onContinue={onComplete}
      continueSecondary="Continue without adding memories"
      onContinueSecondary={onComplete}
      onSaveLater={onSaveLater}
      continueLabel="Continue"
      canContinue={true}
    >
      <div className="space-y-3">
        {memoryCards.map(({ icon: Icon, label, description, buttonLabel, href, color }) => (
          <Link key={label} href={href}>
            <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-muted/20 transition-all cursor-pointer group">
              <div className={cn("p-2.5 rounded-lg flex-shrink-0", color)}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-foreground">{label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
              </div>
              <span className="text-xs text-primary font-medium flex-shrink-0 group-hover:underline">{buttonLabel}</span>
            </div>
          </Link>
        ))}
      </div>
    </StepShell>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// STEP 6 — VOICE (optional)
// ════════════════════════════════════════════════════════════════════════════

function Step6({ persona, isSelf, onComplete, onBack, onSaveLater }: {
  persona: Persona; isSelf: boolean;
  onComplete: () => void; onBack: () => void; onSaveLater: () => void;
}) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "voice");
      formData.append("description", "Voice sample");
      const res = await fetch(`${API_BASE}/api/personas/${persona.id}/media`, {
        method: "POST", body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      setDone(true);
      toast({ title: "Voice sample saved" });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      mr.ondataavailable = e => chunks.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        handleFile(new File([blob], "voice-sample.webm", { type: "audio/webm" }));
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start();
      setMediaRecorder(mr);
      setRecording(true);
    } catch {
      toast({ title: "Microphone not available", variant: "destructive" });
    }
  };

  const stopRecording = () => {
    mediaRecorder?.stop();
    setRecording(false);
    setMediaRecorder(null);
  };

  return (
    <StepShell
      step={6} total={8}
      title={pro(isSelf, "If you'd like, you can share your voice.", "If you'd like, you can share their voice.")}
      subtitle="Voice recordings help the Echo understand tone, rhythm, and warmth — but this step is completely optional."
      bottomNote="It's completely okay to skip this step. The Echo will still be meaningful and complete."
      onBack={onBack} backLabel="Back to Step 5"
      onContinue={onComplete}
      continueSecondary="Skip this step"
      onContinueSecondary={onComplete}
      onSaveLater={onSaveLater}
      continueLabel={done ? "Continue" : "Continue"}
      canContinue={true}
    >
      {done ? (
        <Card className="p-8 text-center space-y-3">
          <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
          <p className="text-sm font-medium text-foreground">Voice sample saved</p>
          <p className="text-xs text-muted-foreground">You can add more voice samples later from the Folder.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card className="p-5 space-y-3 cursor-pointer hover:border-primary/40 transition-all"
            onClick={() => fileInputRef.current?.click()}>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-sky-50 dark:bg-sky-900/20">
                <Upload className="h-5 w-5 text-sky-500" />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">
                  {pro(isSelf, "Upload any audio where you're speaking.", "Upload any audio where they're speaking.")}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">MP3, M4A, WAV, MP4, MOV — up to 10MB</div>
              </div>
            </div>
            <Button variant="outline" className="w-full gap-2" disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? "Uploading…" : "Upload Audio"}
            </Button>
            <input ref={fileInputRef} type="file" accept="audio/*,video/mp4,video/quicktime" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </Card>

          <Card className="p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-900/20">
                <Mic className="h-5 w-5 text-rose-500" />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">
                  {pro(isSelf, "Record a short clip of yourself speaking.", "Record a short clip of them speaking.")}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">Read anything aloud — 30–60 seconds works well</div>
              </div>
            </div>
            {recording ? (
              <>
                <Button variant="destructive" className="w-full gap-2" onClick={stopRecording}>
                  <Square className="h-4 w-4" />Stop recording
                </Button>
                <p className="text-xs text-red-500 text-center animate-pulse">● Recording… click Stop when done</p>
              </>
            ) : (
              <Button variant="outline" className="w-full gap-2" onClick={startRecording} disabled={uploading}>
                <Mic className="h-4 w-4" />Record Voice
              </Button>
            )}
          </Card>
        </div>
      )}
    </StepShell>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// STEP 7 — WRITING SAMPLES (optional)
// ════════════════════════════════════════════════════════════════════════════

function Step7({ persona, isSelf, onComplete, onBack, onSaveLater }: {
  persona: Persona; isSelf: boolean;
  onComplete: () => void; onBack: () => void; onSaveLater: () => void;
}) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [pastedText, setPastedText] = useState("");
  const [mode, setMode] = useState<"file" | "paste" | null>(null);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", file.name.replace(/\.[^.]+$/, ""));
      formData.append("documentType", "voice");
      const res = await fetch(`${API_BASE}/api/personas/${persona.id}/documents`, {
        method: "POST", body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || "Upload failed");
      }
      setDone(true);
      toast({ title: "Writing sample saved" });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handlePasteSubmit = async () => {
    if (!pastedText.trim()) return;
    const blob = new Blob([pastedText], { type: "text/plain" });
    await handleFile(new File([blob], "pasted-writing.txt", { type: "text/plain" }));
  };

  return (
    <StepShell
      step={7} total={8}
      title={pro(isSelf, "If you'd like, you can share your writing.", "If you'd like, you can share their writing.")}
      subtitle={pro(isSelf,
        "Notes, messages, journal entries, or anything written in your own words can help the Echo understand your written voice — but this step is optional.",
        "Notes, messages, journal entries, or anything written in their own words can help the Echo understand their written voice — but this step is optional."
      )}
      bottomNote={pro(isSelf,
        "It's completely okay to skip this step. The Echo will still reflect your voice.",
        "It's completely okay to skip this step. The Echo will still reflect their voice."
      )}
      onBack={onBack} backLabel="Back to Step 6"
      onContinue={onComplete}
      continueSecondary="Skip this step"
      onContinueSecondary={onComplete}
      onSaveLater={onSaveLater}
      continueLabel={done ? "Continue" : "Continue"}
      canContinue={true}
    >
      {done ? (
        <Card className="p-8 text-center space-y-3">
          <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
          <p className="text-sm font-medium text-foreground">Writing sample saved</p>
          <p className="text-xs text-muted-foreground">You can add more writing through Folder → Documents.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex gap-2">
            {[
              { key: "file" as const, icon: Upload, label: "Upload Writing", sub: ".txt · .pdf · .docx" },
              { key: "paste" as const, icon: MessageSquare, label: "Paste Text", sub: "Copy & paste directly" },
            ].map(({ key, icon: Icon, label, sub }) => (
              <button key={key} type="button" onClick={() => setMode(key)}
                className={cn("flex-1 p-4 rounded-xl border text-sm font-medium transition-all text-center space-y-1.5",
                  mode === key ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:border-primary/40"
                )}>
                <Icon className="h-5 w-5 mx-auto" />
                <div>{label}</div>
                <div className="text-xs font-normal opacity-70">{sub}</div>
              </button>
            ))}
          </div>

          {mode === "file" && (
            <>
              <Button variant="outline" className="w-full gap-2"
                onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {uploading ? "Uploading…" : "Upload Writing"}
              </Button>
              <input ref={fileInputRef} type="file"
                accept=".txt,.pdf,.docx,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            </>
          )}

          {mode === "paste" && (
            <div className="space-y-3">
              <Textarea value={pastedText} onChange={e => setPastedText(e.target.value)}
                placeholder="Paste any writing here — a message, a paragraph, a memory, anything."
                rows={6} className="text-sm resize-none" />
              <Button className="w-full gap-2" onClick={handlePasteSubmit}
                disabled={!pastedText.trim() || uploading}>
                {uploading ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</> : "Save Writing Sample"}
              </Button>
            </div>
          )}
        </div>
      )}
    </StepShell>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// STEP 8 — PREVIEW & UNLOCK
// ════════════════════════════════════════════════════════════════════════════

interface CompletionState {
  step1: boolean; step2: boolean; step3: boolean; step4: boolean;
  step5: boolean; step6: boolean; step7: boolean;
}

const CHECKLIST_LABELS = [
  "About Them",
  "Personality & Values",
  "Life Story",
  "Guided Interview",
  "Memories",
  "Voice (optional)",
  "Writing Samples (optional)",
];

function Step8({ persona, isSelf, completion, onGoTo, onFinish }: {
  persona: Persona; isSelf: boolean;
  completion: CompletionState;
  onGoTo: (step: number) => void;
  onFinish: () => void;
}) {
  const [, navigate] = useLocation();
  const firstName = persona.name.split(" ")[0];
  const completedCount = Object.values(completion).filter(Boolean).length;
  const percent = Math.round((completedCount / 7) * 100);
  const canSpeak = completion.step1;

  const steps = Object.entries(completion).map(([, done], i) => ({
    label: CHECKLIST_LABELS[i], done, step: i + 1,
  }));

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <StepProgress current={8} total={8} />

      {/* Echo card */}
      <div className="p-6 rounded-2xl bg-primary/5 border border-primary/20 space-y-4">
        <div className="flex items-center gap-4">
          {persona.photo ? (
            <img src={`${API_BASE}/uploads/${persona.photo}`} alt={persona.name}
              className="w-16 h-16 rounded-full object-cover ring-2 ring-primary/25 flex-shrink-0" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-primary/15 ring-2 ring-primary/20 flex items-center justify-center flex-shrink-0">
              <span className="font-display font-semibold text-xl text-primary">{persona.name.slice(0, 2).toUpperCase()}</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-lg font-semibold text-foreground">{persona.name}</h2>
            <p className="text-sm text-muted-foreground capitalize">{persona.relationship}</p>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 bg-muted rounded-full h-2">
                <div className="h-2 rounded-full bg-primary transition-all duration-500" style={{ width: `${percent}%` }} />
              </div>
              <span className="text-xs text-muted-foreground">{percent}%</span>
            </div>
          </div>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {pro(isSelf,
            "This Echo is shaped by everything you've shared about yourself.",
            "This Echo is shaped by everything you've shared about them."
          )}
        </p>
      </div>

      {/* Title & subtitle */}
      <div className="text-center space-y-1.5">
        <h2 className="font-display text-xl font-semibold text-foreground">Your Echo is ready.</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {pro(isSelf,
            "You've shared your stories, values, memories, and voice. Your Echo is now ready to speak with you.",
            "You've shared their stories, values, memories, and voice. Their Echo is now ready to speak with you."
          )}
        </p>
      </div>

      {/* Checklist */}
      <div className="space-y-2">
        {steps.map(({ label, done, step }) => (
          <div key={step} className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-card">
            <div className="flex items-center gap-3">
              {done
                ? <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                : <Circle className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />}
              <span className={cn("text-sm", done ? "text-foreground" : "text-muted-foreground")}>{label}</span>
            </div>
            <button type="button" onClick={() => onGoTo(step)}
              className="text-xs text-primary hover:text-primary/80 transition-colors font-medium">
              {done ? "Edit" : "Add"}
            </button>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="space-y-3 pt-2">
        {canSpeak ? (
          <Button className="w-full gap-2 h-12 text-base" onClick={() => navigate(`/persona/${persona.id}/chat`)}>
            <Sparkles className="h-5 w-5" />Speak with the Echo
          </Button>
        ) : (
          <div className="p-4 rounded-xl bg-muted/40 border border-border text-sm text-muted-foreground text-center">
            Complete Step 1 to unlock the Echo.
          </div>
        )}
        <Link href={`/persona/${persona.id}/folder`}>
          <Button variant="outline" className="w-full gap-2">
            <BookOpen className="h-4 w-4" />Add more memories
          </Button>
        </Link>
        <button type="button" onClick={onFinish}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-center">
          Finish later — return to {firstName}'s profile
        </button>
      </div>

      {/* Reflection */}
      <p className="text-xs text-muted-foreground text-center leading-relaxed pb-4">
        {pro(isSelf,
          "Thank you for sharing your story. Every memory you add will help your Echo grow even richer over time.",
          "Thank you for sharing their story. Every memory you add will help their Echo grow even richer over time."
        )}
      </p>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN ORCHESTRATOR
// ════════════════════════════════════════════════════════════════════════════

export default function EchoCreate() {
  const { id } = useParams<{ id: string }>();
  const personaId = parseInt(id);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [step1Data, setStep1Data] = useState<Step1Data>({ description: "", unique: "", loved: "", extra: "" });
  const [step2Data, setStep2Data] = useState<Step2Data>({ values: [], valuesOther: "", showedLove: "", comforted: "", decisions: [], decisionsOther: "", grounded: "" });
  const [step3Data, setStep3Data] = useState<Step3Data>({ childhood: "", places: [], placesOther: "", sensory: "", humor: "", hardTimes: "", defining: "" });
  const [step4Data, setStep4Data] = useState<Step4Data>({ childhood: "", relationships: "", turningPoints: "", wisdom: "", legacy: "" });
  const [step5Done, setStep5Done] = useState(false);
  const [step6Done, setStep6Done] = useState(false);
  const [step7Done, setStep7Done] = useState(false);

  const { data: persona, isLoading } = useQuery<Persona>({
    queryKey: ["/api/personas", personaId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/personas/${personaId}`);
      if (!res.ok) throw new Error("Persona not found");
      return res.json();
    },
  });

  const isSelf = persona?.relationship === "myself";

  const saveTraits = useCallback(async (traits: { category: string; content: string }[]) => {
    const filtered = traits.filter(t => t.content.trim());
    if (!filtered.length) return;
    await fetch(`${API_BASE}/api/personas/${personaId}/traits`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ traits: filtered }),
    });
  }, [personaId]);

  const savePersonaBio = useCallback(async (bio: string) => {
    if (!bio.trim()) return;
    await fetch(`${API_BASE}/api/personas/${personaId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bio }),
    });
  }, [personaId]);

  const saveLater = () => {
    toast({ title: "Progress saved", description: "You can continue from the profile anytime." });
    navigate(`/persona/${personaId}`);
  };

  const completeStep1 = async (data: Step1Data) => {
    setSaving(true);
    try {
      setStep1Data(data);
      const bio = [data.description, data.unique, data.loved].filter(Boolean).join("\n\n");
      await savePersonaBio(bio);
      await saveTraits([
        { category: "description", content: data.description },
        { category: "unique", content: data.unique },
        { category: "loved", content: data.loved },
        { category: "extra", content: data.extra },
      ]);
      queryClient.invalidateQueries({ queryKey: ["/api/personas", personaId] });
      setStep(2);
    } catch {
      toast({ title: "Saved — syncing in background" });
      setStep(2);
    } finally { setSaving(false); }
  };

  const completeStep2 = async (data: Step2Data) => {
    setSaving(true);
    try {
      setStep2Data(data);
      await saveTraits([
        { category: "value", content: [...data.values, data.valuesOther].filter(Boolean).join(", ") },
        { category: "love_language", content: data.showedLove },
        { category: "comfort_style", content: data.comforted },
        { category: "decision_making", content: [...data.decisions, data.decisionsOther].filter(Boolean).join(", ") },
        { category: "grounding", content: data.grounded },
      ]);
      setStep(3);
    } catch { toast({ title: "Saved locally" }); setStep(3); }
    finally { setSaving(false); }
  };

  const completeStep3 = async (data: Step3Data) => {
    setSaving(true);
    try {
      setStep3Data(data);
      await saveTraits([
        { category: "childhood", content: data.childhood },
        { category: "favorite_place", content: [...data.places, data.placesOther].filter(Boolean).join(", ") },
        { category: "sensory", content: data.sensory },
        { category: "humor", content: data.humor },
        { category: "hard_times", content: data.hardTimes },
        { category: "defining_moment", content: data.defining },
      ]);
      setStep(4);
    } catch { toast({ title: "Saved locally" }); setStep(4); }
    finally { setSaving(false); }
  };

  const completeStep4 = async (data: Step4Data) => {
    setSaving(true);
    try {
      setStep4Data(data);
      await saveTraits([
        { category: "interview_childhood", content: data.childhood },
        { category: "interview_relationships", content: data.relationships },
        { category: "interview_turning_points", content: data.turningPoints },
        { category: "interview_wisdom", content: data.wisdom },
        { category: "interview_legacy", content: data.legacy },
      ]);
      setStep(5);
    } catch { toast({ title: "Saved locally" }); setStep(5); }
    finally { setSaving(false); }
  };

  if (isLoading || !persona) {
    return (
      <Layout backTo={`/persona/${personaId}`} backLabel="Profile">
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
        </div>
      </Layout>
    );
  }

  const firstName = persona.name.split(" ")[0];

  const completion: CompletionState = {
    step1: step1Data.description.trim().length > 0,
    step2: step2Data.values.length > 0 || step2Data.valuesOther.trim().length > 0,
    step3: Object.entries(step3Data).some(([k, v]) => k !== "places" && typeof v === "string" && v.trim().length > 0) || step3Data.places.length > 0,
    step4: Object.values(step4Data).some(v => v.trim().length > 5),
    step5: step5Done,
    step6: step6Done,
    step7: step7Done,
  };

  return (
    <Layout backTo={`/persona/${personaId}`} backLabel="Profile" title={`${firstName}'s Echo`}>
      {step === 1 && <Step1 persona={persona} isSelf={isSelf} initial={step1Data} onComplete={completeStep1} onSaveLater={saveLater} />}
      {step === 2 && <Step2 persona={persona} isSelf={isSelf} initial={step2Data} onComplete={completeStep2} onBack={() => setStep(1)} onSaveLater={saveLater} />}
      {step === 3 && <Step3 persona={persona} isSelf={isSelf} initial={step3Data} onComplete={completeStep3} onBack={() => setStep(2)} onSaveLater={saveLater} />}
      {step === 4 && <Step4 persona={persona} isSelf={isSelf} initial={step4Data} onComplete={completeStep4} onBack={() => setStep(3)} onSaveLater={saveLater} />}
      {step === 5 && <Step5 persona={persona} isSelf={isSelf} onComplete={() => { setStep5Done(true); setStep(6); }} onBack={() => setStep(4)} onSaveLater={saveLater} />}
      {step === 6 && <Step6 persona={persona} isSelf={isSelf} onComplete={() => { setStep6Done(true); setStep(7); }} onBack={() => setStep(5)} onSaveLater={saveLater} />}
      {step === 7 && <Step7 persona={persona} isSelf={isSelf} onComplete={() => { setStep7Done(true); setStep(8); }} onBack={() => setStep(6)} onSaveLater={saveLater} />}
      {step === 8 && <Step8 persona={persona} isSelf={isSelf} completion={completion} onGoTo={setStep} onFinish={() => navigate(`/persona/${personaId}`)} />}
    </Layout>
  );
}
