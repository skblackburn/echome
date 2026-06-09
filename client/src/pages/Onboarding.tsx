import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { EchoMeWordmark } from "@/components/EchoMeLogo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Users,
  PenLine,
  Settings,
  ArrowRight,
  SkipForward,
  Check,
  Shield,
} from "lucide-react";

const RELATIONSHIPS = [
  "daughter", "son", "child", "partner", "spouse", "mother", "father",
  "sister", "brother", "friend", "grandchild", "other",
];

const PROMPTS = [
  { label: "Something I want them to know.", placeholder: "Write whatever comes to mind. There's no wrong way to start." },
  { label: "A memory I don't want to lose.", placeholder: "A moment, a feeling, a conversation — anything worth keeping." },
  { label: "Advice for a future moment.", placeholder: "Something you'd say if you could be there. For a hard day, a big decision, a celebration." },
];

const DELIVERY_OPTIONS = [
  { value: "browsable_anytime", label: "Anytime (they can read it whenever)" },
  { value: "specific_date", label: "On a specific date" },
  { value: "milestone", label: "At a milestone" },
  { value: "sealed", label: "Sealed until I'm gone" },
];

export default function Onboarding() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState(1);

  // Step 1: Who are you writing to?
  const [personaName, setPersonaName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [createdPersonaId, setCreatedPersonaId] = useState<number | null>(null);

  // Step 2: Write your first letter
  const [selectedPrompt, setSelectedPrompt] = useState<number | null>(null);
  const [letterContent, setLetterContent] = useState("");
  const [deliveryRule, setDeliveryRule] = useState("browsable_anytime");

  const createPersonaMutation = useMutation({
    mutationFn: async () => {
      const form = new FormData();
      form.append("name", personaName.trim());
      form.append("relationship", relationship);
      form.append("bio", "");
      form.append("selfMode", "false");
      const res = await fetch("/api/personas", {
        method: "POST",
        body: form,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create persona");
      return res.json();
    },
    onSuccess: (data) => {
      setCreatedPersonaId(data.id);
      toast({ title: "Folder created", description: `You're writing to ${personaName}.` });
      setStep(2);
    },
    onError: () => {
      toast({ title: "Something went wrong", description: "Please try again.", variant: "destructive" });
    },
  });

  const createLetterMutation = useMutation({
    mutationFn: async () => {
      if (!createdPersonaId) return;
      const prompt = selectedPrompt !== null ? PROMPTS[selectedPrompt] : null;
      const title = prompt ? prompt.label : "My first letter";
      const res = await apiRequest("POST", `/api/personas/${createdPersonaId}/letters`, {
        title,
        content: letterContent,
        deliveryRuleType: deliveryRule,
        isSealed: deliveryRule === "sealed",
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Letter saved", description: "It's safe in the Folder." });
      setStep(3);
    },
    onError: () => {
      toast({ title: "Something went wrong", description: "Please try again.", variant: "destructive" });
    },
  });

  const handleFinish = () => {
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <EchoMeWordmark className="text-foreground" />
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground gap-1.5"
            onClick={handleFinish}
          >
            <SkipForward className="h-3.5 w-3.5" />
            Skip to dashboard
          </Button>
        </div>
      </header>

      {/* Progress */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-8 w-full">
        <div className="flex items-center gap-2 mb-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`flex-1 h-1.5 rounded-full transition-colors ${
                s <= step ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground mb-8">Step {step} of 3</p>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 pb-16 flex-1 w-full">
        {/* Step 1: Who are you writing to? */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="font-display text-xl font-semibold text-foreground">
                  Who are you writing to?
                </h1>
                <p className="text-sm text-muted-foreground">
                  Create a Folder for someone. You can always add more later.
                </p>
              </div>
            </div>

            <Card className="p-6 space-y-4 paper-surface">
              <div className="space-y-1.5">
                <Label htmlFor="persona-name">Their name</Label>
                <Input
                  id="persona-name"
                  placeholder="e.g., Emma, Dad, My daughter"
                  value={personaName}
                  onChange={(e) => setPersonaName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="relationship">Your relationship</Label>
                <Select value={relationship} onValueChange={setRelationship}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a relationship" />
                  </SelectTrigger>
                  <SelectContent>
                    {RELATIONSHIPS.map((r) => (
                      <SelectItem key={r} value={r} className="capitalize">
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </Card>

            <div className="flex items-center justify-between gap-3">
              <Button
                variant="ghost"
                className="text-muted-foreground gap-1.5"
                onClick={() => setStep(3)}
              >
                <SkipForward className="h-3.5 w-3.5" />
                Skip this step
              </Button>
              <Button
                className="gap-1.5"
                disabled={!personaName.trim() || !relationship || createPersonaMutation.isPending}
                onClick={() => createPersonaMutation.mutate()}
              >
                {createPersonaMutation.isPending ? "Creating…" : "Create Folder"}
                {!createPersonaMutation.isPending && <ArrowRight className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Write your first letter */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <PenLine className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="font-display text-xl font-semibold text-foreground">
                  Write your first letter.
                </h1>
                <p className="text-sm text-muted-foreground">
                  Pick a prompt to get started, or write whatever feels right.
                </p>
              </div>
            </div>

            {/* Prompt choices */}
            <div className="grid gap-2">
              {PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedPrompt(i)}
                  className={`text-left p-3 rounded-lg border transition-colors ${
                    selectedPrompt === i
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  <span className="text-sm font-medium">{prompt.label}</span>
                </button>
              ))}
            </div>

            {selectedPrompt !== null && (
              <Card className="p-6 space-y-4 paper-surface">
                <Textarea
                  placeholder={PROMPTS[selectedPrompt].placeholder}
                  value={letterContent}
                  onChange={(e) => setLetterContent(e.target.value)}
                  className="min-h-[120px] resize-none"
                  autoFocus
                />
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">When should this arrive?</Label>
                  <Select value={deliveryRule} onValueChange={setDeliveryRule}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DELIVERY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </Card>
            )}

            <div className="flex items-center justify-between gap-3">
              <Button
                variant="ghost"
                className="text-muted-foreground gap-1.5"
                onClick={() => setStep(3)}
              >
                <SkipForward className="h-3.5 w-3.5" />
                Skip this step
              </Button>
              <Button
                className="gap-1.5"
                disabled={!letterContent.trim() || createLetterMutation.isPending}
                onClick={() => createLetterMutation.mutate()}
              >
                {createLetterMutation.isPending ? "Saving…" : "Save to Folder"}
                {!createLetterMutation.isPending && <ArrowRight className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: AI settings preview */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Settings className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="font-display text-xl font-semibold text-foreground">
                  One more thing.
                </h1>
                <p className="text-sm text-muted-foreground">
                  AI features are currently off. That's the default.
                </p>
              </div>
            </div>

            <Card className="p-6 paper-surface space-y-5">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-medium text-foreground mb-1">AI features are off by default</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Echo Me has optional AI features — like AI Echo chat, journal reflections, and writing-style analysis. They're all turned off for new accounts. You can turn them on one at a time in Settings whenever you're ready, or leave them off forever.
                  </p>
                </div>
              </div>
              <div className="border-t border-border pt-4 space-y-3">
                <p className="text-xs text-muted-foreground">
                  You can change these anytime in Settings. Nothing is enabled until you choose.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    className="flex-1 gap-1.5"
                    onClick={handleFinish}
                  >
                    <Check className="h-4 w-4" />
                    Keep AI off for now
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 gap-1.5"
                    onClick={() => navigate("/settings")}
                  >
                    <Settings className="h-4 w-4" />
                    Turn on AI Echo
                  </Button>
                </div>
              </div>
            </Card>

            <p className="text-xs text-muted-foreground text-center leading-relaxed">
              You're all set. Your Folder is waiting for you.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
