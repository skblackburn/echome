/**
 * AddFirstMemory — Step 1 of onboarding memory collection
 * Route: /persona/:id/first-memory
 * After any ONE memory added → /persona/:id/second-memory
 */
import { useParams, useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { ArrowRight, Mail, BookOpen, Camera, Mic, MessageSquare } from "lucide-react";
import type { Persona } from "@shared/schema";
import { cn } from "@/lib/utils";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

export default function AddFirstMemory() {
  const { id } = useParams<{ id: string }>();
  const personaId = parseInt(id);
  const [, navigate] = useLocation();

  const { data: persona } = useQuery<Persona>({
    queryKey: ["/api/personas", personaId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/personas/${personaId}`);
      return res.json();
    },
  });

  const firstName = persona?.name?.split(" ")[0] || "them";
  const isSelf = persona?.relationship === "myself";

  const returnPath = `/persona/${personaId}/second-memory`;

  const memories = [
    {
      icon: Mail,
      label: "Write a letter",
      description: isSelf
        ? "A letter to your future self, or someone you love."
        : `A letter to ${firstName}, or from ${firstName} to someone.`,
      href: `/persona/${personaId}/folder/letter/new?next=${encodeURIComponent(returnPath)}`,
      color: "text-rose-500 bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800",
    },
    {
      icon: BookOpen,
      label: "Tell a story",
      description: isSelf
        ? "A moment, a memory, anything worth keeping."
        : `Something that happened. A moment worth keeping.`,
      href: `/persona/${personaId}/folder/story/new?next=${encodeURIComponent(returnPath)}`,
      color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800",
    },
    {
      icon: Camera,
      label: "Upload a photo",
      description: "A photo with a story behind it.",
      href: `/photos/new?persona=${personaId}&next=${encodeURIComponent(returnPath)}`,
      color: "text-amber-500 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800",
    },
    {
      icon: Mic,
      label: "Record a voice note",
      description: isSelf
        ? "Speak freely — your voice, your words."
        : `A voice recording. Even a short one.`,
      href: `/persona/${personaId}/folder?tab=voice&next=${encodeURIComponent(returnPath)}`,
      color: "text-sky-500 bg-sky-50 dark:bg-sky-900/20 border-sky-200 dark:border-sky-800",
    },
    {
      icon: MessageSquare,
      label: "Answer a guided question",
      description: isSelf
        ? "We'll ask a simple question. Your answer becomes the first memory."
        : `Answer one question about ${firstName}. That's the first memory.`,
      href: `/persona/${personaId}/create?step=4&next=${encodeURIComponent(returnPath)}`,
      color: "text-violet-500 bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800",
    },
  ];

  return (
    <Layout backTo="/dashboard" backLabel="Home">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-8">

        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
            <Mail className="h-5 w-5 text-primary" />
          </div>
          <h1 className="font-display text-xl font-semibold text-foreground">
            {isSelf ? "Let's add your first memory." : `Let's add the first memory for ${firstName}.`}
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
            Choose whatever feels easiest right now. There's no wrong place to start.
          </p>
          <div className="flex items-center justify-center gap-2 pt-1">
            <div className="h-1.5 w-8 rounded-full bg-primary" />
            <div className="h-1.5 w-8 rounded-full bg-muted" />
          </div>
          <p className="text-xs text-muted-foreground">First memory of two</p>
        </div>

        {/* Memory options */}
        <div className="space-y-3">
          {memories.map(({ icon: Icon, label, description, href, color }) => (
            <Link key={label} href={href}>
              <div className={cn(
                "flex items-center gap-4 p-4 rounded-xl border bg-card hover:shadow-sm transition-all cursor-pointer group",
                "hover:border-primary/40 hover:bg-muted/20"
              )}>
                <div className={cn("p-2.5 rounded-lg border flex-shrink-0", color)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground">{label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground/60 group-hover:text-primary/60 flex-shrink-0" />
              </div>
            </Link>
          ))}
        </div>

        <p className="text-xs text-muted-foreground text-center">
          You can always come back and add more later. This is just the beginning.
        </p>
      </div>
    </Layout>
  );
}
