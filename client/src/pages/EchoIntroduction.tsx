/**
 * EchoIntroduction — Shown after 2 memories are added
 * Route: /persona/:id/echo-intro
 * Explains what Echo is and is not, then routes to:
 *   - Start Echo Intake → /persona/:id/create
 *   - Skip → /dashboard
 */
import { useParams, useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, Heart, AlertCircle, CheckCircle2, ArrowRight, SkipForward } from "lucide-react";
import type { Persona } from "@shared/schema";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

export default function EchoIntroduction() {
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

  return (
    <Layout backTo="/dashboard" backLabel="Home">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-8">

        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10">
            <Sparkles className="h-7 w-7 text-primary" />
          </div>
          <h1 className="font-display text-2xl font-semibold text-foreground">
            {isSelf ? "Your Echo is now available." : `${firstName}'s Echo is now available.`}
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
            You've added two memories.
            {isSelf
              ? " That's enough to start building your Echo — an AI that speaks with your voice and reflects your values."
              : ` That's enough to start building ${firstName}'s Echo — an AI that reflects their voice, values, and way of being.`}
          </p>
        </div>

        {/* What Echo IS */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Heart className="h-4 w-4 text-primary flex-shrink-0" />
            <h3 className="font-semibold text-sm text-foreground">What Echo is</h3>
          </div>
          <ul className="space-y-2.5">
            {[
              isSelf ? "A reflection of you — shaped by everything you share." : `A reflection of ${firstName} — shaped by everything you share.`,
              "A way to preserve voice, values, and presence.",
              "Optional. Completely off by default.",
              "Something you can retire or turn off at any time.",
            ].map(item => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                {item}
              </li>
            ))}
          </ul>
        </Card>

        {/* What Echo IS NOT */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
            <h3 className="font-semibold text-sm text-foreground">What Echo is not</h3>
          </div>
          <ul className="space-y-2.5">
            {[
              isSelf ? "Not a replacement for you. It's an approximation." : `Not a replacement for ${firstName}. It's an approximation.`,
              "Not therapy. Not a grief tool. Not a medical service.",
              "Not a way to deceive or impersonate anyone.",
              "Not a perfect memory. It will make mistakes.",
            ].map(item => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
                {item}
              </li>
            ))}
          </ul>
        </Card>

        {/* Ethics note */}
        <div className="p-4 rounded-xl bg-muted/40 border border-border">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground">A note on consent and care.</strong>{" "}
            {isSelf
              ? "You're building this Echo yourself. It will reflect what you choose to share — and nothing else. You can retire it at any time."
              : `This Echo is shaped by what you share about ${firstName}. Please use it with care. It is always an approximation, never the person.`}
            {" "}Echo Me will never use your memories for advertising or share them with third parties.
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-3 pt-2">
          <Button className="w-full gap-2 h-11" onClick={() => navigate(`/persona/${personaId}/create`)}>
            <Sparkles className="h-4 w-4" />
            Start Echo Intake
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => navigate("/dashboard")}
          >
            <SkipForward className="h-4 w-4" />
            Skip for now — go to my Folder
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center pb-4">
          You can start Echo Intake anytime from {isSelf ? "your" : `${firstName}'s`} profile.
        </p>
      </div>
    </Layout>
  );
}
