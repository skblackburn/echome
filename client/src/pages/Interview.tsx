import { useState, useRef } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { ChevronRight, ChevronLeft, CheckCircle2, Mic, MicOff, BookOpen, Heart, Users, Star, Lightbulb, Baby } from "lucide-react";
import type { Persona } from "@shared/schema";
import { cn } from "@/lib/utils";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";


// ── Interview question bank ────────────────────────────────────────────────────
interface Question {
  id: string;
  category: string;
  categoryIcon: React.ElementType;
  prompt: string;
  followUp?: string;
  memoryType: "story" | "journal" | "letter";
  period?: string;
}

const buildQuestions = (firstName: string): Question[] => [
  // Childhood
  {
    id: "childhood-home",
    category: "Childhood",
    categoryIcon: Baby,
    prompt: `Where did ${firstName} grow up, and what was it like? What do they remember most about their childhood home?`,
    followUp: "Any smells, sounds, or small details that stick out?",
    memoryType: "story",
    period: "childhood",
  },
  {
    id: "childhood-family",
    category: "Childhood",
    categoryIcon: Baby,
    prompt: `What was ${firstName}'s family like growing up? What role did they play among siblings or cousins?`,
    memoryType: "story",
    period: "childhood",
  },
  {
    id: "childhood-happiest",
    category: "Childhood",
    categoryIcon: Baby,
    prompt: `What is one of ${firstName}'s happiest childhood memories?`,
    followUp: "Who was there? What made it so special?",
    memoryType: "story",
    period: "childhood",
  },

  // Values & Beliefs
  {
    id: "values-core",
    category: "Values",
    categoryIcon: Heart,
    prompt: `What did ${firstName} believe in most deeply? What principles guided how they lived their life?`,
    memoryType: "journal",
  },
  {
    id: "values-hardship",
    category: "Values",
    categoryIcon: Heart,
    prompt: `What was the hardest thing ${firstName} ever went through, and what did it teach them?`,
    followUp: "What would they say to someone facing something similar today?",
    memoryType: "story",
  },
  {
    id: "values-proudest",
    category: "Values",
    categoryIcon: Heart,
    prompt: `What is ${firstName} most proud of in their life?`,
    memoryType: "journal",
  },

  // Relationships
  {
    id: "relationships-love",
    category: "Relationships",
    categoryIcon: Users,
    prompt: `How did ${firstName} show love to the people they cared about? What were the small things they did?`,
    memoryType: "story",
  },
  {
    id: "relationships-parenting",
    category: "Relationships",
    categoryIcon: Users,
    prompt: `What kind of parent / partner / friend was ${firstName}? What did people love most about being around them?`,
    memoryType: "story",
    period: "parenthood",
  },
  {
    id: "relationships-advice",
    category: "Relationships",
    categoryIcon: Users,
    prompt: `What advice would ${firstName} give about love and relationships? What did they learn the hard way?`,
    memoryType: "journal",
  },

  // Personality
  {
    id: "personality-laugh",
    category: "Personality",
    categoryIcon: Star,
    prompt: `What made ${firstName} laugh? What was their sense of humor like?`,
    followUp: "Describe a moment when they really let loose.",
    memoryType: "story",
  },
  {
    id: "personality-quirks",
    category: "Personality",
    categoryIcon: Star,
    prompt: `What were ${firstName}'s quirks or habits? The little things that were distinctly, unmistakably them?`,
    memoryType: "story",
  },
  {
    id: "personality-saying",
    category: "Personality",
    categoryIcon: Star,
    prompt: `What phrases or sayings did ${firstName} repeat often? What's something they always said?`,
    memoryType: "journal",
  },

  // Legacy
  {
    id: "legacy-lesson",
    category: "Legacy",
    categoryIcon: Lightbulb,
    prompt: `What is the most important thing ${firstName} taught you? What lesson do you carry from them?`,
    memoryType: "letter",
  },
  {
    id: "legacy-message",
    category: "Legacy",
    categoryIcon: Lightbulb,
    prompt: `If ${firstName} could send one message to their children or grandchildren years from now, what would it be?`,
    followUp: "What do they most want the next generation to know?",
    memoryType: "letter",
  },
  {
    id: "legacy-remember",
    category: "Legacy",
    categoryIcon: Lightbulb,
    prompt: `How do you want people to remember ${firstName}? What is the truest thing about who they are?`,
    memoryType: "journal",
  },
];

// ── Category colors ────────────────────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
  Childhood: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  Values: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  Relationships: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  Personality: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  Legacy: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
};

export default function Interview() {
  const { id } = useParams<{ id: string }>();
  const personaId = parseInt(id);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [skipped, setSkipped] = useState<Set<string>>(new Set());

  const { data: persona } = useQuery<Persona>({
    queryKey: ["/api/personas", personaId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/personas/${personaId}`);
      return res.json();
    },
  });

  const firstName = persona?.name?.split(" ")[0] || "them";
  const questions = buildQuestions(firstName);
  const current = questions[currentIndex];
  const totalAnswered = Object.keys(saved).length + skipped.size;
  const progress = Math.round((totalAnswered / questions.length) * 100);

  const saveMutation = useMutation({
    mutationFn: (q: Question) =>
      apiRequest("POST", `/api/personas/${personaId}/memories`, {
        type: q.memoryType,
        title: q.prompt,
        content: answers[q.id],
        period: q.period || "general",
      }),
    onSuccess: (_, q) => {
      setSaved(s => ({ ...s, [q.id]: true }));
      queryClient.invalidateQueries({ queryKey: ["/api/personas", personaId, "memories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/personas", personaId, "summary"] });
      toast({ title: "Memory saved", description: "This response has been added to the Echo." });
      // Auto-advance
      if (currentIndex < questions.length - 1) {
        setTimeout(() => setCurrentIndex(i => i + 1), 600);
      }
    },
  });

  const handleSave = () => {
    if (!answers[current.id]?.trim()) return;
    saveMutation.mutate(current);
  };

  const handleSkip = () => {
    setSkipped(s => new Set([...s, current.id]));
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(i => i + 1);
    }
  };

  const isFinished = currentIndex >= questions.length - 1 && (saved[current?.id] || skipped.has(current?.id));

  // Grouped categories for the sidebar progress
  const categories = [...new Set(questions.map(q => q.category))];

  return (
    <Layout backTo={`/persona/${personaId}/memories`} backLabel="Memory Intake" title="Guided Interview">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">

        {/* Header */}
        <div className="mb-6">
          <h1 className="font-display text-xl font-semibold text-foreground mb-1">
            Interview: {persona?.name || "…"}
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Answer each question as if you're speaking about {firstName} to someone who never met them.
            The more vivid and personal, the better the Echo.
          </p>
        </div>

        {/* Progress */}
        <div className="mb-6 space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{totalAnswered} of {questions.length} questions answered</span>
            <span>{progress}% complete</span>
          </div>
          <Progress value={progress} className="h-1.5" />
          {/* Category pills */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {categories.map(cat => {
              const catQs = questions.filter(q => q.category === cat);
              const catDone = catQs.filter(q => saved[q.id] || skipped.has(q.id)).length;
              return (
                <div key={cat} className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", CATEGORY_COLORS[cat])}>
                  {catDone === catQs.length && <CheckCircle2 className="h-3 w-3" />}
                  {cat} {catDone}/{catQs.length}
                </div>
              );
            })}
          </div>
        </div>

        {/* Finished state */}
        {isFinished ? (
          <div className="text-center py-12 paper-surface rounded-xl border border-border">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <CheckCircle2 className="h-8 w-8 text-primary" />
            </div>
            <h2 className="font-display text-xl font-semibold text-foreground mb-2">
              Interview complete
            </h2>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">
              {firstName}'s Echo now has a rich foundation of memories and stories.
              The conversations will feel much more real and personal.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link href={`/persona/${personaId}/chat`}>
                <Button className="gap-2">
                  Talk with {firstName}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href={`/persona/${personaId}/memories`}>
                <Button variant="outline" className="gap-2">
                  <BookOpen className="h-4 w-4" />
                  Add more memories
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Question card */}
            <div className="rounded-xl border border-border paper-surface p-6 space-y-4">
              {/* Category + number */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium", CATEGORY_COLORS[current.category])}>
                    {current.categoryIcon && <current.categoryIcon className="h-3 w-3" />}
                    {current.category}
                  </div>
                  {saved[current.id] && (
                    <Badge variant="outline" className="text-xs border-primary/30 text-primary gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Saved
                    </Badge>
                  )}
                  {skipped.has(current.id) && (
                    <Badge variant="outline" className="text-xs text-muted-foreground gap-1">
                      Skipped
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {currentIndex + 1} / {questions.length}
                </span>
              </div>

              {/* Question */}
              <div>
                <p className="font-display text-lg font-medium text-foreground leading-snug">
                  {current.prompt}
                </p>
                {current.followUp && (
                  <p className="text-sm text-muted-foreground mt-1.5 italic">
                    {current.followUp}
                  </p>
                )}
              </div>

              {/* Answer textarea */}
              <Textarea
                placeholder="Write your answer here — use as much detail as you can. First-person is fine, or write as if describing them to someone else."
                value={answers[current.id] || ""}
                onChange={e => setAnswers(a => ({ ...a, [current.id]: e.target.value }))}
                rows={6}
                className="resize-none text-sm"
                data-testid="input-interview-answer"
              />

              {/* Actions */}
              <div className="flex items-center justify-between pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground gap-1.5"
                  onClick={handleSkip}
                  disabled={saveMutation.isPending}
                  data-testid="button-skip-question"
                >
                  Skip this one
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    disabled={!answers[current.id]?.trim() || saveMutation.isPending || saved[current.id]}
                    onClick={handleSave}
                    className="gap-1.5"
                    data-testid="button-save-answer"
                  >
                    {saveMutation.isPending ? "Saving…" : saved[current.id] ? "Saved ✓" : "Save & continue"}
                    {!saveMutation.isPending && !saved[current.id] && <ChevronRight className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            </div>

            {/* Navigation dots */}
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground"
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex(i => i - 1)}
                data-testid="button-prev-question"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>

              {/* Dot indicators */}
              <div className="flex items-center gap-1">
                {questions.map((q, i) => (
                  <button
                    key={q.id}
                    onClick={() => setCurrentIndex(i)}
                    className={cn(
                      "w-2 h-2 rounded-full transition-all",
                      i === currentIndex
                        ? "w-4 bg-primary"
                        : saved[q.id]
                        ? "bg-primary/50"
                        : skipped.has(q.id)
                        ? "bg-muted-foreground/30"
                        : "bg-muted-foreground/20"
                    )}
                    aria-label={`Question ${i + 1}`}
                  />
                ))}
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground"
                disabled={currentIndex === questions.length - 1}
                onClick={() => setCurrentIndex(i => i + 1)}
                data-testid="button-next-question"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Jump to category */}
            <div className="pt-2">
              <p className="text-xs text-muted-foreground mb-2">Jump to section:</p>
              <div className="flex flex-wrap gap-1.5">
                {categories.map(cat => {
                  const firstInCat = questions.findIndex(q => q.category === cat);
                  return (
                    <button
                      key={cat}
                      onClick={() => setCurrentIndex(firstInCat)}
                      className={cn(
                        "text-xs px-2.5 py-1 rounded-full border transition-all",
                        cat === current.category
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-border bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted"
                      )}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
