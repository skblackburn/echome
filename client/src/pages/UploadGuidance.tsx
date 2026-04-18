import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import {
  ArrowRight, ChevronDown, FileText, Mail, MessageSquare,
  BookOpen, Lightbulb, CheckCircle2, AlertCircle, HelpCircle, SkipForward
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Document tier visual ─────────────────────────────────────────────────────
function DocumentTier() {
  const tiers = [
    { label: "Good start", range: "5–10 docs", width: "33%", color: "bg-amber-400/60" },
    { label: "Better", range: "10–20 docs", width: "60%", color: "bg-amber-500/70" },
    { label: "Sweet spot", range: "20–30 docs", width: "100%", color: "bg-primary/80" },
  ];

  return (
    <div className="space-y-3">
      {tiers.map((tier) => (
        <div key={tier.label} className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="font-medium text-foreground">{tier.label}</span>
            <span className="text-muted-foreground">{tier.range}</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", tier.color)}
              style={{ width: tier.width }}
            />
          </div>
        </div>
      ))}
      <p className="text-xs text-muted-foreground mt-2">
        More is better — you can always add more later to improve accuracy.
      </p>
    </div>
  );
}

// ── Collapsible guidance section ─────────────────────────────────────────────
function GuidanceSection({
  icon: Icon,
  title,
  defaultOpen = false,
  children,
}: {
  icon: React.ElementType;
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-2xl border border-border bg-card paper-surface overflow-hidden transition-all">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full flex items-center gap-3 p-4 sm:p-5 text-left hover:bg-muted/30 transition-colors"
          >
            <div className="p-2 rounded-xl bg-primary/10 flex-shrink-0">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <span className="font-display text-sm font-semibold text-foreground flex-1">{title}</span>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform duration-200",
                open && "rotate-180"
              )}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-0">
            <div className="border-t border-border/50 pt-4">
              {children}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function UploadGuidance() {
  const params = useParams<{ id: string }>();
  const personaId = params.id;
  const [, navigate] = useLocation();

  const handleContinue = () => {
    // Mark guidance as seen for this persona
    try {
      const seen = JSON.parse(localStorage.getItem("echome_guidance_seen") || "[]");
      if (!seen.includes(personaId)) {
        seen.push(personaId);
        localStorage.setItem("echome_guidance_seen", JSON.stringify(seen));
      }
    } catch (_) {}
    navigate(`/persona/${personaId}/memories`);
  };

  const handleSkip = () => {
    navigate(`/persona/${personaId}`);
  };

  return (
    <Layout backTo={`/persona/${personaId}`} backLabel="Back">
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display text-xl sm:text-2xl font-semibold text-foreground mb-2">
            Add their writing for an even richer Echo
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your Echo is already taking shape from the details you shared. Uploading letters, emails, or journals will help capture exactly how they wrote.
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-3">
          {/* Section 1: How Many Documents */}
          <GuidanceSection icon={FileText} title="How many documents?" defaultOpen={true}>
            <DocumentTier />
          </GuidanceSection>

          {/* Section 2: Best Types */}
          <GuidanceSection icon={BookOpen} title="Best types to upload">
            <div className="space-y-4">
              {/* Great sources */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <span className="text-sm font-medium text-foreground">Great sources</span>
                  <span className="text-xs text-muted-foreground">(personal voice shines through)</span>
                </div>
                <ul className="space-y-1.5 ml-6 text-sm text-muted-foreground">
                  <li>Personal journal entries</li>
                  <li>Letters to friends or family</li>
                  <li>Personal emails they wrote (not forwarded chains)</li>
                  <li>Text messages or chat logs (their side only)</li>
                  <li>Social media posts, blog entries</li>
                  <li>Cards, notes, toasts, speeches</li>
                </ul>
              </div>

              {/* Good sources */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-medium text-foreground">Good sources</span>
                </div>
                <ul className="space-y-1.5 ml-6 text-sm text-muted-foreground">
                  <li>Work emails they authored</li>
                  <li>Creative writing, poems, stories</li>
                </ul>
              </div>

              {/* Avoid */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <span className="text-sm font-medium text-foreground">Avoid these</span>
                </div>
                <ul className="space-y-1.5 ml-6 text-sm text-muted-foreground">
                  <li>Copied or forwarded content they didn't write</li>
                  <li>Form letters or templates</li>
                  <li>Shared documents with multiple authors</li>
                </ul>
              </div>
            </div>
          </GuidanceSection>

          {/* Section 3: Tips */}
          <GuidanceSection icon={Lightbulb} title="Tips for best results">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Mail className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <span className="text-sm font-medium text-foreground">Email threads</span>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Include only the parts written by your person — remove reply chains and forwarded text.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MessageSquare className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <span className="text-sm font-medium text-foreground">Variety matters</span>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    A mix of casual and formal writing gives the richest voice capture.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <FileText className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <span className="text-sm font-medium text-foreground">Length</span>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Both short notes and longer pieces are valuable.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <BookOpen className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <span className="text-sm font-medium text-foreground">Time span</span>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Writing from different periods of their life adds depth.
                  </p>
                </div>
              </div>
            </div>
          </GuidanceSection>

          {/* Section 4: Supported Formats */}
          <GuidanceSection icon={HelpCircle} title="Supported formats">
            <div className="flex flex-wrap gap-2">
              {[".txt", ".pdf", ".docx", "Copy & paste"].map((format) => (
                <span
                  key={format}
                  className="inline-flex items-center px-3 py-1.5 rounded-full bg-muted text-sm font-medium text-foreground"
                >
                  {format}
                </span>
              ))}
            </div>
          </GuidanceSection>
        </div>

        {/* CTAs */}
        <div className="mt-8 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="gap-2" onClick={handleSkip}>
              <SkipForward className="h-4 w-4" /> Skip for now
            </Button>
            <Button className="gap-2" onClick={handleContinue}>
              Continue to Upload <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            You can always add documents later from your Echo's page.
          </p>
        </div>
      </div>
    </Layout>
  );
}
