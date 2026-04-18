import { useState, useEffect } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowRight, Heart, MessageSquare, Lightbulb,
  Smile, Sparkles, BookOpen, Star, ChevronRight, SkipForward
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Persona, Trait } from "@shared/schema";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

interface QuestionItem {
  id: string;
  icon: React.ElementType;
  question: string;
  placeholder: string;
  traitCategory: string;
  color: string;
}

const QUESTIONS: QuestionItem[] = [
  {
    id: "greeting",
    icon: MessageSquare,
    question: "How did they greet people?",
    placeholder: "e.g., Always with a big hug and \"Hey, sunshine!\" — didn't matter if it was a stranger or family, everyone got the same warmth.",
    traitCategory: "saying",
    color: "bg-primary/10 text-primary",
  },
  {
    id: "advice",
    icon: Lightbulb,
    question: "What advice did they always give?",
    placeholder: "e.g., \"Don't let perfect be the enemy of good\" — she said this whenever I was overthinking something.",
    traitCategory: "advice",
    color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
  {
    id: "phrases",
    icon: Star,
    question: "What were their favorite phrases or sayings?",
    placeholder: "e.g., \"We'll figure it out\" — calm and practical, even in the middle of chaos. Also loved to say \"That's the way the cookie crumbles.\"",
    traitCategory: "saying",
    color: "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400",
  },
  {
    id: "love",
    icon: Heart,
    question: "How did they express love?",
    placeholder: "e.g., Through food, always. A full plate meant \"I love you.\" She'd also leave little notes in lunchboxes and pockets.",
    traitCategory: "personality",
    color: "bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400",
  },
  {
    id: "topics",
    icon: BookOpen,
    question: "What topics did they love talking about?",
    placeholder: "e.g., The ocean, old movies, family history. She could talk for hours about her grandmother's village in Italy.",
    traitCategory: "personality",
    color: "bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400",
  },
  {
    id: "personality",
    icon: Sparkles,
    question: "How would you describe their personality?",
    placeholder: "e.g., Warm but no-nonsense. She made everyone feel welcome but wouldn't sugarcoat the truth. Fiercely loyal.",
    traitCategory: "personality",
    color: "bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400",
  },
  {
    id: "laugh",
    icon: Smile,
    question: "What made them laugh?",
    placeholder: "e.g., Bad puns — the worse the better. She'd laugh until she cried at America's Funniest Home Videos. Also loved teasing Dad.",
    traitCategory: "personality",
    color: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  {
    id: "passion",
    icon: Heart,
    question: "What were they passionate about?",
    placeholder: "e.g., Her garden — she treated every plant like a child. Also passionate about education; she volunteered at the library every Saturday.",
    traitCategory: "value",
    color: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
  },
];

function QuestionCard({
  question,
  answer,
  onChange,
  saved,
}: {
  question: QuestionItem;
  answer: string;
  onChange: (val: string) => void;
  saved: boolean;
}) {
  const Icon = question.icon;

  return (
    <div className={cn(
      "rounded-2xl border bg-card paper-surface overflow-hidden transition-all",
      saved ? "border-primary/30" : "border-border"
    )}>
      <div className="p-5 space-y-3">
        <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-xl flex-shrink-0", question.color)}>
            <Icon className="h-4 w-4" />
          </div>
          <h3 className="font-display text-sm font-semibold text-foreground">
            {question.question}
          </h3>
        </div>
        <Textarea
          value={answer}
          onChange={e => onChange(e.target.value)}
          placeholder={question.placeholder}
          rows={3}
          className="resize-none text-sm"
        />
        {saved && (
          <p className="text-xs text-primary flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> Saved
          </p>
        )}
      </div>
    </div>
  );
}

export default function QuestionsIntake() {
  const { id } = useParams<{ id: string }>();
  const personaId = parseInt(id);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [savedQuestions, setSavedQuestions] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const { data: persona } = useQuery<Persona>({
    queryKey: ["/api/personas", personaId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/personas/${personaId}`);
      return res.json();
    },
  });

  const { data: existingTraits = [] } = useQuery<Trait[]>({
    queryKey: ["/api/personas", personaId, "traits"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/personas/${personaId}/traits`);
      return res.json();
    },
  });

  // Pre-populate answers from existing traits (for returning users)
  useEffect(() => {
    if (existingTraits.length > 0 && Object.keys(answers).length === 0) {
      const prefilled: Record<string, string> = {};
      const prefilledSaved = new Set<string>();

      // Match existing traits to questions by category
      existingTraits.forEach(trait => {
        const matchingQuestion = QUESTIONS.find(
          q => q.traitCategory === trait.category && !prefilled[q.id]
        );
        if (matchingQuestion) {
          prefilled[matchingQuestion.id] = trait.content;
          prefilledSaved.add(matchingQuestion.id);
        }
      });

      if (Object.keys(prefilled).length > 0) {
        setAnswers(prefilled);
        setSavedQuestions(prefilledSaved);
      }
    }
  }, [existingTraits]);

  const firstName = persona?.name?.split(" ")[0] || "them";

  const saveAnswers = async () => {
    setSaving(true);
    try {
      const toSave = Object.entries(answers).filter(
        ([key, val]) => val.trim() && !savedQuestions.has(key)
      );

      for (const [questionId, content] of toSave) {
        const question = QUESTIONS.find(q => q.id === questionId);
        if (!question) continue;

        await apiRequest("POST", `/api/personas/${personaId}/traits`, {
          category: question.traitCategory,
          content: content.trim(),
        });
        setSavedQuestions(prev => { const next = new Set(Array.from(prev)); next.add(questionId); return next; });
      }

      queryClient.invalidateQueries({ queryKey: ["/api/personas", personaId, "traits"] });
      queryClient.invalidateQueries({ queryKey: ["/api/personas", personaId, "summary"] });

      if (toSave.length > 0) {
        toast({
          title: `${toSave.length} ${toSave.length === 1 ? "answer" : "answers"} saved`,
          description: `${firstName}'s Echo is getting richer.`,
        });
      }
    } catch (e) {
      toast({ title: "Something went wrong", description: String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleContinue = async () => {
    await saveAnswers();
    navigate(`/persona/${personaId}/upload-guidance`);
  };

  const unsavedCount = Object.entries(answers).filter(
    ([key, val]) => val.trim() && !savedQuestions.has(key)
  ).length;

  const answeredCount = Object.values(answers).filter(v => v.trim()).length;

  return (
    <Layout backTo={`/persona/${personaId}`} backLabel={persona?.name || "Back"}>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display text-xl sm:text-2xl font-semibold text-foreground mb-2">
            Let's bring {firstName} to life
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Tell us about {firstName}. These details become the heart of their Echo — how they spoke,
            what they believed, what made them <em>them</em>. Answer as many as you'd like; you can always come back and add more.
          </p>
        </div>

        {/* Progress indicator */}
        {answeredCount > 0 && (
          <div className="mb-6 flex items-center gap-3">
            <div className="flex-1 bg-muted rounded-full h-2">
              <div
                className="h-2 rounded-full bg-primary transition-all"
                style={{ width: `${Math.min((answeredCount / QUESTIONS.length) * 100, 100)}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {answeredCount} of {QUESTIONS.length}
            </span>
          </div>
        )}

        {/* Question cards */}
        <div className="space-y-4">
          {QUESTIONS.map(question => (
            <QuestionCard
              key={question.id}
              question={question}
              answer={answers[question.id] || ""}
              onChange={val => setAnswers(prev => ({ ...prev, [question.id]: val }))}
              saved={savedQuestions.has(question.id)}
            />
          ))}
        </div>

        {/* Save + continue */}
        <div className="mt-8 space-y-3">
          {unsavedCount > 0 && (
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={saveAnswers}
              disabled={saving}
            >
              {saving ? "Saving..." : `Save ${unsavedCount} ${unsavedCount === 1 ? "answer" : "answers"}`}
            </Button>
          )}

          <Button className="w-full gap-2" onClick={handleContinue} disabled={saving}>
            Continue <ArrowRight className="h-4 w-4" />
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            You can always come back and add more details from {firstName}'s Echo page.
          </p>
        </div>

        {/* Quick links */}
        <div className="mt-8 pt-6 border-t border-border space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Want to go deeper?
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link href={`/persona/${personaId}/life-story`}>
              <div className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-muted/30 transition-all cursor-pointer group paper-surface">
                <div className="p-2 rounded-lg bg-amber-500/10 flex-shrink-0">
                  <BookOpen className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground">Life Story</div>
                  <div className="text-xs text-muted-foreground">Sensory details, family, legacy</div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </div>
            </Link>
            <Link href={`/persona/${personaId}/interview`}>
              <div className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-muted/30 transition-all cursor-pointer group paper-surface">
                <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
                  <MessageSquare className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground">Guided Interview</div>
                  <div className="text-xs text-muted-foreground">15 in-depth questions</div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </div>
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
}
