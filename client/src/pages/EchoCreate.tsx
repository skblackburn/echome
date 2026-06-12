/**
 * EchoCreate — 8-step Echo Creation Flow
 * Route: /persona/:id/create
 *
 * Steps:
 *   1. About Them/You
 *   2. Personality & Values
 *   3. Life Story
 *   4. Guided Interview
 *   5. Add Memories (Folder integration)
 *   6. Voice (optional)
 *   7. Writing Samples (optional)
 *   8. Preview & Unlock
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, ArrowRight, CheckCircle2, Circle, Sparkles,
  Heart, Lightbulb, BookOpen, Mic, FileText, Camera,
  Mail, MessageSquare, Loader2, Upload, SkipForward,
  ChevronDown, ChevronUp, Play, Square
} from "lucide-react";
import type { Persona } from "@shared/schema";
import { cn } from "@/lib/utils";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

// ── Helpers ──────────────────────────────────────────────────────────────────

function pro(isSelf: boolean, they: string, you: string) {
  return isSelf ? you : they;
}

// ── Step progress bar ─────────────────────────────────────────────────────────

const STEP_LABELS = [
  "About",
  "Values",
  "Life Story",
  "Interview",
  "Memories",
  "Voice",
  "Writing",
  "Preview",
];

function StepProgress({ current, total }: { current: number; total: number }) {
  return (
    <div className="space-y-3 mb-8">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Step {current} of {total}</span>
        <span className="font-medium text-foreground">{STEP_LABELS[current - 1]}</span>
      </div>
      <div className="flex gap-1">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-all duration-300",
              i < current ? "bg-primary" : "bg-muted"
            )}
          />
        ))}
      </div>
    </div>
  );
}

// ── AutoSaving textarea ───────────────────────────────────────────────────────

function AutoTextarea({
  value,
  onChange,
  placeholder,
  rows = 4,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
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

const CORE_VALUES = [
  "Family", "Honesty", "Faith", "Hard work", "Kindness", "Loyalty",
  "Adventure", "Creativity", "Justice", "Humility", "Service", "Courage",
  "Curiosity", "Humor", "Simplicity", "Independence", "Community",
];

const DECISION_STYLES = [
  "Heart first", "Logic first", "Prays/reflects", "Talks it through",
  "Researches deeply", "Trusts gut", "Consults family", "Takes time alone",
];

function MultiSelect({
  options,
  selected,
  onToggle,
}: {
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => {
        const active = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onToggle(opt)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
              active
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
            )}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// ── Collapsible section ───────────────────────────────────────────────────────

function CollapsibleSection({
  title,
  icon: Icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: React.ElementType;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors"
      >
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

// ── Step wrapper ──────────────────────────────────────────────────────────────

function StepShell({
  step,
  total,
  title,
  subtitle,
  onBack,
  onContinue,
  onSaveLater,
  continueLabel = "Continue",
  saving = false,
  canContinue = true,
  children,
}: {
  step: number;
  total: number;
  title: string;
  subtitle?: string;
  onBack?: () => void;
  onContinue: () => void;
  onSaveLater: () => void;
  continueLabel?: string;
  saving?: boolean;
  canContinue?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <StepProgress current={step} total={total} />
      <div>
        <h2 className="font-display text-xl font-semibold text-foreground">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{subtitle}</p>}
      </div>
      <div className="space-y-5">{children}</div>
      <div className="flex flex-col gap-3 pt-2">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="outline" onClick={onBack} className="gap-1.5">
              <ArrowLeft className="h-4 w-4" />Back
            </Button>
          )}
          <Button
            className="flex-1 gap-2"
            onClick={onContinue}
            disabled={!canContinue || saving}
          >
            {saving
              ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</>
              : <>{continueLabel}<ArrowRight className="h-4 w-4" /></>}
          </Button>
        </div>
        <button
          type="button"
          onClick={onSaveLater}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors text-center"
        >
          Save &amp; come back later
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// STEP 1 — About Them / You
// ════════════════════════════════════════════════════════════════════════════

interface Step1Data {
  description: string;
  unique: string;
  loved: string;
  extra: string;
}

function Step1({
  persona,
  isSelf,
  initial,
  onComplete,
  onSaveLater,
}: {
  persona: Persona;
  isSelf: boolean;
  initial: Step1Data;
  onComplete: (data: Step1Data) => void;
  onSaveLater: () => void;
}) {
  const [d, setD] = useState(initial);
  const firstName = persona.name.split(" ")[0];

  const set = (k: keyof Step1Data) => (v: string) => setD(prev => ({ ...prev, [k]: v }));
  const canContinue = d.description.trim().length > 10;

  return (
    <StepShell
      step={1} total={8}
      title={pro(isSelf, `Tell us about ${firstName}`, "Tell us about yourself")}
      subtitle={pro(isSelf,
        `Share what made ${firstName} who they were. There are no wrong answers — write as much or as little as feels right.`,
        "Share what makes you who you are. There are no wrong answers."
      )}
      onContinue={() => onComplete(d)}
      onSaveLater={onSaveLater}
      canContinue={canContinue}
    >
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">
          {pro(isSelf, `How would you describe ${firstName}?`, "How would you describe yourself?")}
        </label>
        <AutoTextarea
          value={d.description}
          onChange={set("description")}
          placeholder={pro(isSelf,
            `${firstName} was the kind of person who…`,
            "I'm the kind of person who…"
          )}
          rows={4}
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">
          {pro(isSelf, `What made ${firstName} unique?`, "What makes you unique?")}
        </label>
        <AutoTextarea
          value={d.unique}
          onChange={set("unique")}
          placeholder={pro(isSelf,
            "Their laugh, the way they told stories, a phrase they always used…",
            "My laugh, the way I tell stories, a phrase I always use…"
          )}
          rows={3}
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">
          {pro(isSelf, `What did ${firstName} love?`, "What do you love?")}
        </label>
        <AutoTextarea
          value={d.loved}
          onChange={set("loved")}
          placeholder={pro(isSelf,
            "Hobbies, passions, people, places, rituals they cherished…",
            "Hobbies, passions, people, places, rituals I cherish…"
          )}
          rows={3}
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">
          Anything else {pro(isSelf, "the Echo", "your Echo")} should know?{" "}
          <span className="text-muted-foreground font-normal text-xs">(optional)</span>
        </label>
        <AutoTextarea
          value={d.extra}
          onChange={set("extra")}
          placeholder="Anything that doesn't fit elsewhere…"
          rows={2}
        />
      </div>
    </StepShell>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// STEP 2 — Personality & Values
// ════════════════════════════════════════════════════════════════════════════

interface Step2Data {
  values: string[];
  valuesOther: string;
  showedLove: string;
  comforted: string;
  decisions: string[];
  decisionsOther: string;
  grounded: string;
}

function Step2({
  persona,
  isSelf,
  initial,
  onComplete,
  onBack,
  onSaveLater,
}: {
  persona: Persona;
  isSelf: boolean;
  initial: Step2Data;
  onComplete: (data: Step2Data) => void;
  onBack: () => void;
  onSaveLater: () => void;
}) {
  const [d, setD] = useState(initial);
  const firstName = persona.name.split(" ")[0];
  const set = (k: keyof Step2Data) => (v: any) => setD(prev => ({ ...prev, [k]: v }));

  return (
    <StepShell
      step={2} total={8}
      title="Personality & Values"
      subtitle={pro(isSelf,
        `What shaped ${firstName}'s character? What did ${firstName} believe in?`,
        "What shapes your character? What do you believe in?"
      )}
      onBack={onBack}
      onContinue={() => onComplete(d)}
      onSaveLater={onSaveLater}
      canContinue={d.values.length > 0 || d.valuesOther.trim().length > 0}
    >
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">
          {pro(isSelf, `${firstName}'s core values`, "Your core values")}
        </label>
        <MultiSelect
          options={CORE_VALUES}
          selected={d.values}
          onToggle={v => set("values")(d.values.includes(v) ? d.values.filter(x => x !== v) : [...d.values, v])}
        />
        <Input
          value={d.valuesOther}
          onChange={e => set("valuesOther")(e.target.value)}
          placeholder="Anything else…"
          className="text-sm mt-2"
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">
          {pro(isSelf, `How did ${firstName} show love?`, "How do you show love?")}
        </label>
        <AutoTextarea
          value={d.showedLove}
          onChange={set("showedLove")}
          placeholder={pro(isSelf,
            "Acts of service, words, time together, gifts, physical affection…",
            "Acts of service, words, time together, gifts, physical affection…"
          )}
          rows={2}
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">
          {pro(isSelf, `How did ${firstName} comfort others?`, "How do you comfort others?")}
        </label>
        <AutoTextarea
          value={d.comforted}
          onChange={set("comforted")}
          placeholder={pro(isSelf,
            "What ${firstName} would say or do when someone was hurting…",
            "What I say or do when someone is hurting…"
          )}
          rows={2}
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">
          {pro(isSelf, `How did ${firstName} make decisions?`, "How do you make decisions?")}
        </label>
        <MultiSelect
          options={DECISION_STYLES}
          selected={d.decisions}
          onToggle={v => set("decisions")(d.decisions.includes(v) ? d.decisions.filter(x => x !== v) : [...d.decisions, v])}
        />
        <Input
          value={d.decisionsOther}
          onChange={e => set("decisionsOther")(e.target.value)}
          placeholder="In their own words…"
          className="text-sm mt-2"
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">
          {pro(isSelf, `What grounded ${firstName}?`, "What grounds you?")}
        </label>
        <AutoTextarea
          value={d.grounded}
          onChange={set("grounded")}
          placeholder="Faith, nature, routine, family, music, solitude…"
          rows={2}
        />
      </div>
    </StepShell>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// STEP 3 — Life Story
// ════════════════════════════════════════════════════════════════════════════

interface Step3Data {
  childhood: string;
  places: string;
  sensory: string;
  humor: string;
  hardTimes: string;
  defining: string;
}

function Step3({
  persona,
  isSelf,
  initial,
  onComplete,
  onBack,
  onSaveLater,
}: {
  persona: Persona;
  isSelf: boolean;
  initial: Step3Data;
  onComplete: (data: Step3Data) => void;
  onBack: () => void;
  onSaveLater: () => void;
}) {
  const [d, setD] = useState(initial);
  const firstName = persona.name.split(" ")[0];
  const set = (k: keyof Step3Data) => (v: string) => setD(prev => ({ ...prev, [k]: v }));
  const filled = Object.values(d).some(v => v.trim().length > 0);

  return (
    <StepShell
      step={3} total={8}
      title="Life Story"
      subtitle={pro(isSelf,
        `Capture the moments and places that shaped ${firstName}'s life.`,
        "Capture the moments and places that shaped your life."
      )}
      onBack={onBack}
      onContinue={() => onComplete(d)}
      onSaveLater={onSaveLater}
      canContinue={filled}
    >
      <CollapsibleSection title={pro(isSelf, `${firstName}'s childhood`, "Your childhood")} icon={Heart} defaultOpen>
        <AutoTextarea value={d.childhood} onChange={set("childhood")}
          placeholder={pro(isSelf,
            `Where did ${firstName} grow up? What was home like? Early memories?`,
            "Where did you grow up? What was home like? Early memories?"
          )} rows={3} />
      </CollapsibleSection>

      <CollapsibleSection title="Favorite places" icon={BookOpen}>
        <AutoTextarea value={d.places} onChange={set("places")}
          placeholder={pro(isSelf,
            `Places ${firstName} loved — a city, a room, a restaurant, a view…`,
            "Places you love — a city, a room, a restaurant, a view…"
          )} rows={3} />
      </CollapsibleSection>

      <CollapsibleSection title="Sensory memories" icon={Sparkles}>
        <AutoTextarea value={d.sensory} onChange={set("sensory")}
          placeholder={pro(isSelf,
            `Smells, sounds, tastes that take ${firstName} back somewhere…`,
            "Smells, sounds, tastes that take you back somewhere…"
          )} rows={3} />
      </CollapsibleSection>

      <CollapsibleSection title="Humor & joy" icon={Heart}>
        <AutoTextarea value={d.humor} onChange={set("humor")}
          placeholder={pro(isSelf,
            `What made ${firstName} laugh? ${firstName}'s sense of humor, their funniest stories…`,
            "What makes you laugh? Your sense of humor, your funniest stories…"
          )} rows={3} />
      </CollapsibleSection>

      <CollapsibleSection title="Hard times" icon={Lightbulb}>
        <AutoTextarea value={d.hardTimes} onChange={set("hardTimes")}
          placeholder={pro(isSelf,
            `Struggles ${firstName} faced. How they got through them. What they learned.`,
            "Struggles you've faced. How you got through them. What you learned."
          )} rows={3} />
      </CollapsibleSection>

      <CollapsibleSection title="Defining moments" icon={Sparkles}>
        <AutoTextarea value={d.defining} onChange={set("defining")}
          placeholder={pro(isSelf,
            `The moments that changed ${firstName}'s life — a decision, a person, a turning point.`,
            "The moments that changed your life — a decision, a person, a turning point."
          )} rows={3} />
      </CollapsibleSection>
    </StepShell>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// STEP 4 — Guided Interview
// ════════════════════════════════════════════════════════════════════════════

interface Step4Data {
  childhood: string;
  relationships: string;
  turningPoints: string;
  wisdom: string;
  legacy: string;
}

function Step4({
  persona,
  isSelf,
  initial,
  onComplete,
  onBack,
  onSaveLater,
}: {
  persona: Persona;
  isSelf: boolean;
  initial: Step4Data;
  onComplete: (data: Step4Data) => void;
  onBack: () => void;
  onSaveLater: () => void;
}) {
  const [d, setD] = useState(initial);
  const firstName = persona.name.split(" ")[0];
  const set = (k: keyof Step4Data) => (v: string) => setD(prev => ({ ...prev, [k]: v }));
  const filled = Object.values(d).some(v => v.trim().length > 10);

  const interviews = [
    {
      key: "childhood" as const,
      title: "Childhood & early life",
      icon: Heart,
      defaultOpen: true,
      q: pro(isSelf,
        `Tell us about ${firstName}'s earliest memories. What was their childhood home like? Who were the most important people in their young life? What did they want to be when they grew up?`,
        "Tell us about your earliest memories. What was your childhood home like? Who were the most important people in your young life? What did you want to be when you grew up?"
      ),
      placeholder: pro(isSelf, `${firstName} grew up in…`, "I grew up in…"),
    },
    {
      key: "relationships" as const,
      title: "Relationships & love",
      icon: Heart,
      defaultOpen: false,
      q: pro(isSelf,
        `How did ${firstName} approach love and relationships? Who did they love most? What did ${firstName} believe made a relationship last?`,
        "How do you approach love and relationships? Who do you love most? What do you believe makes a relationship last?"
      ),
      placeholder: pro(isSelf, `Love, to ${firstName}, meant…`, "Love, to me, means…"),
    },
    {
      key: "turningPoints" as const,
      title: "Turning points",
      icon: Sparkles,
      defaultOpen: false,
      q: pro(isSelf,
        `What were the pivotal moments in ${firstName}'s life — decisions or events that changed everything?`,
        "What were the pivotal moments in your life — decisions or events that changed everything?"
      ),
      placeholder: pro(isSelf, `One moment that changed everything for ${firstName} was…`, "One moment that changed everything for me was…"),
    },
    {
      key: "wisdom" as const,
      title: "Wisdom & lessons",
      icon: Lightbulb,
      defaultOpen: false,
      q: pro(isSelf,
        `What did ${firstName} learn from life? What advice did they give most often? What do they wish they had known sooner?`,
        "What have you learned from life? What advice do you give most often? What do you wish you'd known sooner?"
      ),
      placeholder: pro(isSelf, `The best advice ${firstName} ever gave was…`, "The best advice I ever give is…"),
    },
    {
      key: "legacy" as const,
      title: "Legacy & meaning",
      icon: BookOpen,
      defaultOpen: false,
      q: pro(isSelf,
        `How did ${firstName} want to be remembered? What mattered most to them in the end?`,
        "How do you want to be remembered? What matters most to you?"
      ),
      placeholder: pro(isSelf, `${firstName} wanted to be remembered as…`, "I want to be remembered as…"),
    },
  ];

  return (
    <StepShell
      step={4} total={8}
      title="Guided Interview"
      subtitle="Answer as many as feel right. These become the heart of the Echo."
      onBack={onBack}
      onContinue={() => onComplete(d)}
      onSaveLater={onSaveLater}
      canContinue={filled}
    >
      {interviews.map(({ key, title, icon, defaultOpen, q, placeholder }) => (
        <CollapsibleSection key={key} title={title} icon={icon} defaultOpen={defaultOpen}>
          <p className="text-sm text-muted-foreground leading-relaxed mb-2">{q}</p>
          <AutoTextarea
            value={d[key]}
            onChange={set(key)}
            placeholder={placeholder}
            rows={4}
          />
        </CollapsibleSection>
      ))}
    </StepShell>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// STEP 5 — Add Memories (Folder integration)
// ════════════════════════════════════════════════════════════════════════════

function Step5({
  persona,
  isSelf,
  onComplete,
  onBack,
  onSaveLater,
}: {
  persona: Persona;
  isSelf: boolean;
  onComplete: () => void;
  onBack: () => void;
  onSaveLater: () => void;
}) {
  const firstName = persona.name.split(" ")[0];

  const memoryTypes = [
    {
      icon: Mail,
      label: "Write a letter",
      description: pro(isSelf, `Write a letter from you to ${firstName}, or from ${firstName} to someone they loved.`, "Write a letter to someone you love, or to your future self."),
      href: `/persona/${persona.id}/folder/letter/new`,
      color: "text-rose-500 bg-rose-50 dark:bg-rose-900/20",
    },
    {
      icon: BookOpen,
      label: "Add a story",
      description: pro(isSelf, `A memory, an anecdote, something ${firstName} experienced.`, "A memory, an anecdote, something you experienced."),
      href: `/persona/${persona.id}/folder/story/new`,
      color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20",
    },
    {
      icon: Camera,
      label: "Upload a photo",
      description: "A photo with a story behind it.",
      href: `/photos/new?persona=${persona.id}`,
      color: "text-amber-500 bg-amber-50 dark:bg-amber-900/20",
    },
    {
      icon: FileText,
      label: "Upload a document",
      description: pro(isSelf, `Journals, emails, letters ${firstName} wrote.`, "Journals, emails, or letters you wrote."),
      href: `/persona/${persona.id}/documents`,
      color: "text-sky-500 bg-sky-50 dark:bg-sky-900/20",
    },
  ];

  return (
    <StepShell
      step={5} total={8}
      title="Add Memories"
      subtitle={pro(isSelf,
        `Memories make the Echo feel real. Add as many or as few as you'd like — you can always add more later through ${firstName}'s Folder.`,
        "Memories make your Echo feel real. Add as many or as few as you'd like — you can always add more later."
      )}
      onBack={onBack}
      onContinue={onComplete}
      onSaveLater={onSaveLater}
      continueLabel="Continue without adding"
      canContinue={true}
    >
      <div className="space-y-3">
        {memoryTypes.map(({ icon: Icon, label, description, href, color }) => (
          <Link key={label} href={href}>
            <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-muted/20 transition-all cursor-pointer group">
              <div className={cn("p-2.5 rounded-lg flex-shrink-0", color)}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-foreground">{label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground/60 group-hover:text-primary/60 transition-colors flex-shrink-0" />
            </div>
          </Link>
        ))}
      </div>
      <p className="text-xs text-muted-foreground text-center pt-2">
        These open in the Folder. Use the back button to return here.
      </p>
    </StepShell>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// STEP 6 — Voice (optional)
// ════════════════════════════════════════════════════════════════════════════

function Step6({
  persona,
  isSelf,
  onComplete,
  onBack,
  onSaveLater,
}: {
  persona: Persona;
  isSelf: boolean;
  onComplete: (skipped: boolean) => void;
  onBack: () => void;
  onSaveLater: () => void;
}) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const firstName = persona.name.split(" ")[0];

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "voice");
      formData.append("description", "Voice sample");
      const res = await fetch(`${API_BASE}/api/personas/${persona.id}/media`, {
        method: "POST",
        body: formData,
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
        const file = new File([blob], "voice-sample.webm", { type: "audio/webm" });
        handleFile(file);
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
      title={pro(isSelf, `${firstName}'s Voice`, "Your Voice")}
      subtitle={pro(isSelf,
        `A voice sample helps make the Echo sound like ${firstName}. This step is optional.`,
        "A voice sample makes your Echo sound like you. This step is optional."
      )}
      onBack={onBack}
      onContinue={() => onComplete(false)}
      onSaveLater={onSaveLater}
      continueLabel={done ? "Continue" : "Skip this step"}
      canContinue={true}
    >
      {done ? (
        <Card className="p-6 text-center space-y-2">
          <CheckCircle2 className="h-10 w-10 mx-auto text-green-500" />
          <p className="text-sm font-medium text-foreground">Voice sample saved</p>
          <p className="text-xs text-muted-foreground">You can add more voice samples later from the Folder.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card className="p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-sky-50 dark:bg-sky-900/20">
                <Upload className="h-5 w-5 text-sky-500" />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">Upload an audio file</div>
                <div className="text-xs text-muted-foreground">MP3, M4A, WAV, MP4, MOV — up to 10MB</div>
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? "Uploading…" : "Choose file"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,video/mp4,video/quicktime"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
          </Card>

          <Card className="p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-900/20">
                <Mic className="h-5 w-5 text-rose-500" />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">Record a voice sample</div>
                <div className="text-xs text-muted-foreground">Read anything aloud — 30–60 seconds works well</div>
              </div>
            </div>
            {recording ? (
              <Button variant="destructive" className="w-full gap-2" onClick={stopRecording}>
                <Square className="h-4 w-4" />Stop recording
              </Button>
            ) : (
              <Button variant="outline" className="w-full gap-2" onClick={startRecording}>
                <Mic className="h-4 w-4" />Start recording
              </Button>
            )}
            {recording && (
              <p className="text-xs text-red-500 text-center animate-pulse">● Recording… click Stop when done</p>
            )}
          </Card>
        </div>
      )}
    </StepShell>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// STEP 7 — Writing Samples (optional)
// ════════════════════════════════════════════════════════════════════════════

function Step7({
  persona,
  isSelf,
  onComplete,
  onBack,
  onSaveLater,
}: {
  persona: Persona;
  isSelf: boolean;
  onComplete: () => void;
  onBack: () => void;
  onSaveLater: () => void;
}) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [pastedText, setPastedText] = useState("");
  const [mode, setMode] = useState<"file" | "paste" | null>(null);
  const firstName = persona.name.split(" ")[0];

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", file.name.replace(/\.[^.]+$/, ""));
      formData.append("documentType", "voice");
      const res = await fetch(`${API_BASE}/api/personas/${persona.id}/documents`, {
        method: "POST",
        body: formData,
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
    setUploading(true);
    try {
      const blob = new Blob([pastedText], { type: "text/plain" });
      const file = new File([blob], "pasted-writing.txt", { type: "text/plain" });
      await handleFile(file);
    } finally {
      setUploading(false);
    }
  };

  return (
    <StepShell
      step={7} total={8}
      title={pro(isSelf, `${firstName}'s Writing`, "Your Writing")}
      subtitle={pro(isSelf,
        `Journals, letters, emails — anything written in ${firstName}'s voice. This step is optional.`,
        "Journals, letters, emails — anything written in your voice. This step is optional."
      )}
      onBack={onBack}
      onContinue={onComplete}
      onSaveLater={onSaveLater}
      continueLabel={done ? "Continue" : "Skip this step"}
      canContinue={true}
    >
      {done ? (
        <Card className="p-6 text-center space-y-2">
          <CheckCircle2 className="h-10 w-10 mx-auto text-green-500" />
          <p className="text-sm font-medium text-foreground">Writing sample saved</p>
          <p className="text-xs text-muted-foreground">You can add more writing through the Folder → Documents tab.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode("file")}
              className={cn("flex-1 p-4 rounded-xl border text-sm font-medium transition-all text-center space-y-1.5",
                mode === "file" ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:border-primary/40"
              )}
            >
              <Upload className="h-5 w-5 mx-auto" />
              <div>Upload a file</div>
              <div className="text-xs font-normal">.txt · .pdf · .docx</div>
            </button>
            <button
              type="button"
              onClick={() => setMode("paste")}
              className={cn("flex-1 p-4 rounded-xl border text-sm font-medium transition-all text-center space-y-1.5",
                mode === "paste" ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:border-primary/40"
              )}
            >
              <MessageSquare className="h-5 w-5 mx-auto" />
              <div>Paste text</div>
              <div className="text-xs font-normal">Copy &amp; paste directly</div>
            </button>
          </div>

          {mode === "file" && (
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {uploading ? "Uploading…" : "Choose file"}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.pdf,.docx,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
            </div>
          )}

          {mode === "paste" && (
            <div className="space-y-3">
              <Textarea
                value={pastedText}
                onChange={e => setPastedText(e.target.value)}
                placeholder={pro(isSelf,
                  `Paste something ${firstName} wrote here…`,
                  "Paste something you wrote here…"
                )}
                rows={6}
                className="text-sm resize-none"
              />
              <Button
                className="w-full gap-2"
                onClick={handlePasteSubmit}
                disabled={!pastedText.trim() || uploading}
              >
                {uploading ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</> : "Save writing sample"}
              </Button>
            </div>
          )}
        </div>
      )}
    </StepShell>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// STEP 8 — Preview & Unlock
// ════════════════════════════════════════════════════════════════════════════

interface CompletionState {
  step1: boolean; step2: boolean; step3: boolean; step4: boolean;
  step5: boolean; step6: boolean; step7: boolean;
}

function Step8({
  persona,
  isSelf,
  completion,
  onGoTo,
  onFinish,
}: {
  persona: Persona;
  isSelf: boolean;
  completion: CompletionState;
  onGoTo: (step: number) => void;
  onFinish: () => void;
}) {
  const [, navigate] = useLocation();
  const firstName = persona.name.split(" ")[0];

  const steps = [
    { label: "About", done: completion.step1, step: 1 },
    { label: "Values", done: completion.step2, step: 2 },
    { label: "Life Story", done: completion.step3, step: 3 },
    { label: "Interview", done: completion.step4, step: 4 },
    { label: "Memories", done: completion.step5, step: 5 },
    { label: "Voice (optional)", done: completion.step6, step: 6 },
    { label: "Writing (optional)", done: completion.step7, step: 7 },
  ];

  const required = [completion.step1, completion.step2].filter(Boolean).length;
  const percent = Math.round((Object.values(completion).filter(Boolean).length / 7) * 100);

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <StepProgress current={8} total={8} />

      {/* Persona header */}
      <div className="flex items-center gap-4 p-5 rounded-2xl bg-primary/5 border border-primary/20">
        {persona.photo ? (
          <img src={`${API_BASE}/uploads/${persona.photo}`} alt={persona.name}
            className="w-16 h-16 rounded-full object-cover ring-2 ring-primary/25" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-primary/15 ring-2 ring-primary/20 flex items-center justify-center">
            <span className="font-display font-semibold text-xl text-primary">{persona.name.slice(0, 2).toUpperCase()}</span>
          </div>
        )}
        <div>
          <h2 className="font-display text-lg font-semibold text-foreground">{persona.name}</h2>
          <p className="text-sm text-muted-foreground capitalize">{persona.relationship}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <div className="w-24 bg-muted rounded-full h-1.5">
              <div className="h-1.5 rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
            </div>
            <span className="text-xs text-muted-foreground">{percent}% complete</span>
          </div>
        </div>
      </div>

      {/* Checklist */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">What you've shared</h3>
        <div className="space-y-2">
          {steps.map(({ label, done, step }) => (
            <div key={step} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
              <div className="flex items-center gap-3">
                {done
                  ? <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                  : <Circle className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />}
                <span className={cn("text-sm", done ? "text-foreground" : "text-muted-foreground")}>{label}</span>
              </div>
              <button
                type="button"
                onClick={() => onGoTo(step)}
                className="text-xs text-primary hover:text-primary/80 transition-colors"
              >
                {done ? "Edit" : "Add"}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-3 pt-2">
        {required >= 1 ? (
          <Button className="w-full gap-2 h-12 text-base" onClick={() => navigate(`/persona/${persona.id}/chat`)}>
            <Sparkles className="h-5 w-5" />
            Speak with the Echo
          </Button>
        ) : (
          <div className="text-center text-sm text-muted-foreground p-4 rounded-xl bg-muted/30 border border-border">
            Complete at least Step 1 (About) to unlock the Echo.
          </div>
        )}
        <Link href={`/persona/${persona.id}/folder`}>
          <Button variant="outline" className="w-full gap-2">
            <BookOpen className="h-4 w-4" />
            Add more memories in the Folder
          </Button>
        </Link>
        <button
          type="button"
          onClick={onFinish}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-center"
        >
          Finish later — go to {firstName}'s profile
        </button>
      </div>
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

  // Step data
  const [step1Data, setStep1Data] = useState<Step1Data>({ description: "", unique: "", loved: "", extra: "" });
  const [step2Data, setStep2Data] = useState<Step2Data>({ values: [], valuesOther: "", showedLove: "", comforted: "", decisions: [], decisionsOther: "", grounded: "" });
  const [step3Data, setStep3Data] = useState<Step3Data>({ childhood: "", places: "", sensory: "", humor: "", hardTimes: "", defining: "" });
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
  const firstName = persona?.name?.split(" ")[0] || "them";

  // ── Save helpers ────────────────────────────────────────────────────────────

  const saveTraits = useCallback(async (traits: { category: string; content: string }[]) => {
    if (!traits.some(t => t.content.trim())) return;
    await fetch(`${API_BASE}/api/personas/${personaId}/traits`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ traits: traits.filter(t => t.content.trim()) }),
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

  const saveStory = useCallback(async (title: string, content: string) => {
    if (!content.trim()) return;
    await fetch(`${API_BASE}/api/personas/${personaId}/folder/stories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content }),
    }).catch(() => {
      // Fallback: save as a document if story endpoint not available
    });
  }, [personaId]);

  // ── Step completions with save ──────────────────────────────────────────────

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
      toast({ title: "Saved locally — will sync shortly", variant: "default" });
      setStep(2);
    } finally {
      setSaving(false);
    }
  };

  const completeStep2 = async (data: Step2Data) => {
    setSaving(true);
    try {
      setStep2Data(data);
      const allValues = [...data.values, data.valuesOther].filter(Boolean).join(", ");
      const allDecisions = [...data.decisions, data.decisionsOther].filter(Boolean).join(", ");
      await saveTraits([
        { category: "value", content: allValues },
        { category: "love_language", content: data.showedLove },
        { category: "comfort_style", content: data.comforted },
        { category: "decision_making", content: allDecisions },
        { category: "grounding", content: data.grounded },
      ]);
      setStep(3);
    } catch {
      toast({ title: "Saved locally", variant: "default" });
      setStep(3);
    } finally {
      setSaving(false);
    }
  };

  const completeStep3 = async (data: Step3Data) => {
    setSaving(true);
    try {
      setStep3Data(data);
      await saveTraits([
        { category: "childhood", content: data.childhood },
        { category: "favorite_place", content: data.places },
        { category: "sensory", content: data.sensory },
        { category: "humor", content: data.humor },
        { category: "hard_times", content: data.hardTimes },
        { category: "defining_moment", content: data.defining },
      ]);
      setStep(4);
    } catch {
      toast({ title: "Saved locally", variant: "default" });
      setStep(4);
    } finally {
      setSaving(false);
    }
  };

  const completeStep4 = async (data: Step4Data) => {
    setSaving(true);
    try {
      setStep4Data(data);
      // Save each interview answer as a trait (long-form)
      await saveTraits([
        { category: "interview_childhood", content: data.childhood },
        { category: "interview_relationships", content: data.relationships },
        { category: "interview_turning_points", content: data.turningPoints },
        { category: "interview_wisdom", content: data.wisdom },
        { category: "interview_legacy", content: data.legacy },
      ]);
      setStep(5);
    } catch {
      toast({ title: "Saved locally", variant: "default" });
      setStep(5);
    } finally {
      setSaving(false);
    }
  };

  const saveLater = () => {
    toast({ title: "Progress saved", description: `You can continue ${isSelf ? "your" : `${firstName}'s`} Echo anytime from the profile.` });
    navigate(`/persona/${personaId}`);
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

  const completion: CompletionState = {
    step1: step1Data.description.trim().length > 0,
    step2: step2Data.values.length > 0 || step2Data.valuesOther.trim().length > 0,
    step3: Object.values(step3Data).some(v => v.trim().length > 0),
    step4: Object.values(step4Data).some(v => v.trim().length > 10),
    step5: step5Done,
    step6: step6Done,
    step7: step7Done,
  };

  return (
    <Layout backTo={`/persona/${personaId}`} backLabel="Profile" title={`Create ${firstName}'s Echo`}>
      {step === 1 && (
        <Step1
          persona={persona} isSelf={isSelf}
          initial={step1Data}
          onComplete={completeStep1}
          onSaveLater={saveLater}
        />
      )}
      {step === 2 && (
        <Step2
          persona={persona} isSelf={isSelf}
          initial={step2Data}
          onComplete={completeStep2}
          onBack={() => setStep(1)}
          onSaveLater={saveLater}
        />
      )}
      {step === 3 && (
        <Step3
          persona={persona} isSelf={isSelf}
          initial={step3Data}
          onComplete={completeStep3}
          onBack={() => setStep(2)}
          onSaveLater={saveLater}
        />
      )}
      {step === 4 && (
        <Step4
          persona={persona} isSelf={isSelf}
          initial={step4Data}
          onComplete={completeStep4}
          onBack={() => setStep(3)}
          onSaveLater={saveLater}
        />
      )}
      {step === 5 && (
        <Step5
          persona={persona} isSelf={isSelf}
          onComplete={() => { setStep5Done(true); setStep(6); }}
          onBack={() => setStep(4)}
          onSaveLater={saveLater}
        />
      )}
      {step === 6 && (
        <Step6
          persona={persona} isSelf={isSelf}
          onComplete={(skipped) => { if (!skipped) setStep6Done(true); setStep(7); }}
          onBack={() => setStep(5)}
          onSaveLater={saveLater}
        />
      )}
      {step === 7 && (
        <Step7
          persona={persona} isSelf={isSelf}
          onComplete={() => { setStep7Done(true); setStep(8); }}
          onBack={() => setStep(6)}
          onSaveLater={saveLater}
        />
      )}
      {step === 8 && (
        <Step8
          persona={persona} isSelf={isSelf}
          completion={completion}
          onGoTo={setStep}
          onFinish={() => navigate(`/persona/${personaId}`)}
        />
      )}
    </Layout>
  );
}
