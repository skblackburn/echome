import { useState, useRef, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Camera, ArrowRight, ArrowLeft, User, Heart, Check, BookOpen, Import } from "lucide-react";
import { cn } from "@/lib/utils";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

const RELATIONSHIPS = [
  "mother", "father", "grandmother", "grandfather",
  "wife", "husband", "partner", "sister", "brother",
  "aunt", "uncle", "friend", "mentor", "myself", "other"
];

// ── Step indicator ────────────────────────────────────────────────────────────
function Steps({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all",
            i + 1 < current
              ? "bg-primary text-primary-foreground"
              : i + 1 === current
              ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
              : "bg-muted text-muted-foreground"
          )}>
            {i + 1 < current ? <Check className="h-3.5 w-3.5" /> : i + 1}
          </div>
          {i < total - 1 && (
            <div className={cn("h-px w-8 transition-all", i + 1 < current ? "bg-primary" : "bg-border")} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Step 1: For whom? ─────────────────────────────────────────────────────────
function StepWho({ selfMode, setSelfMode, onNext }: {
  selfMode: boolean | null;
  setSelfMode: (v: boolean) => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-semibold text-foreground mb-1">Who is this Echo for?</h1>
        <p className="text-sm text-muted-foreground">This shapes how the whole experience is built.</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <button
          type="button"
          onClick={() => setSelfMode(false)}
          className={cn(
            "flex items-start gap-4 p-5 rounded-2xl border-2 text-left transition-all",
            selfMode === false
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/40 hover:bg-muted/50"
          )}
          data-testid="button-for-someone"
        >
          <div className={cn("p-2.5 rounded-xl mt-0.5", selfMode === false ? "bg-primary/15" : "bg-muted")}>
            <Heart className={cn("h-5 w-5", selfMode === false ? "text-primary" : "text-muted-foreground")} />
          </div>
          <div>
            <div className="font-semibold text-foreground text-sm mb-1">For someone I love</div>
            <div className="text-xs text-muted-foreground leading-relaxed">
              I'm preserving the voice, stories, and essence of someone important to me — a parent, spouse, friend, or family member — so their Echo lives on for those who love them.
            </div>
          </div>
          {selfMode === false && (
            <div className="ml-auto flex-shrink-0 mt-0.5">
              <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                <Check className="h-3 w-3 text-primary-foreground" />
              </div>
            </div>
          )}
        </button>

        <button
          type="button"
          onClick={() => setSelfMode(true)}
          className={cn(
            "flex items-start gap-4 p-5 rounded-2xl border-2 text-left transition-all",
            selfMode === true
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/40 hover:bg-muted/50"
          )}
          data-testid="button-for-myself"
        >
          <div className={cn("p-2.5 rounded-xl mt-0.5", selfMode === true ? "bg-primary/15" : "bg-muted")}>
            <User className={cn("h-5 w-5", selfMode === true ? "text-primary" : "text-muted-foreground")} />
          </div>
          <div>
            <div className="font-semibold text-foreground text-sm mb-1">For myself</div>
            <div className="text-xs text-muted-foreground leading-relaxed">
              I want to capture my own voice, stories, and values so the people I love can always have a piece of me — now and in the future.
            </div>
          </div>
          {selfMode === true && (
            <div className="ml-auto flex-shrink-0 mt-0.5">
              <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                <Check className="h-3 w-3 text-primary-foreground" />
              </div>
            </div>
          )}
        </button>
      </div>

      <Button
        className="w-full gap-2"
        disabled={selfMode === null}
        onClick={onNext}
        data-testid="button-step1-next"
      >
        Continue <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ── Step 2: About them ────────────────────────────────────────────────────────
function StepAboutThem({
  selfMode, name, setName, birthYear, setBirthYear, birthPlace, setBirthPlace,
  pronouns, setPronouns, relationship, setRelationship, bio, setBio,
  photoPreview, onPhoto, onNext, onBack,
}: {
  selfMode: boolean;
  name: string; setName: (v: string) => void;
  birthYear: string; setBirthYear: (v: string) => void;
  birthPlace: string; setBirthPlace: (v: string) => void;
  pronouns: string; setPronouns: (v: string) => void;
  relationship: string; setRelationship: (v: string) => void;
  bio: string; setBio: (v: string) => void;
  photoPreview: string | null;
  onPhoto: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const photoRef = useRef<HTMLInputElement>(null);
  const canContinue = name.trim() && pronouns && (selfMode || relationship);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-semibold text-foreground mb-1">
          {selfMode ? "About you" : "About them"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {selfMode
            ? "Tell us about yourself — this becomes the foundation of your Echo."
            : "The basics about the person whose Echo you're creating."}
        </p>
      </div>

      {/* Photo */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => photoRef.current?.click()}
          className="flex-shrink-0 w-20 h-20 rounded-full border-2 border-dashed border-border flex items-center justify-center bg-muted/50 hover:bg-muted hover:border-primary/40 transition-all cursor-pointer overflow-hidden group"
        >
          {photoPreview ? (
            <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-1 text-muted-foreground group-hover:text-primary transition-colors">
              <Camera className="h-5 w-5" />
              <span className="text-xs">Photo</span>
            </div>
          )}
        </button>
        <input ref={photoRef} type="file" accept="image/*" onChange={onPhoto} className="hidden" />
        <div>
          <p className="text-sm font-medium text-foreground">Add a photo</p>
          <p className="text-xs text-muted-foreground mt-0.5">Makes the Echo feel real. Optional.</p>
        </div>
      </div>

      {/* Name */}
      <div className="space-y-1.5">
        <Label>{selfMode ? "Your full name" : "Their full name"} <span className="text-destructive">*</span></Label>
        <Input
          placeholder={selfMode ? "e.g., Maria Santos" : "e.g., Sarah Chen"}
          value={name}
          onChange={e => setName(e.target.value)}
          data-testid="input-name"
        />
      </div>

      {/* Pronouns */}
      <div className="space-y-1.5">
        <Label>Pronouns <span className="text-destructive">*</span></Label>
        <div className="flex gap-2 flex-wrap">
          {["she/her", "he/him", "they/them"].map(p => (
            <button
              key={p}
              type="button"
              onClick={() => setPronouns(p)}
              className={cn(
                "px-4 py-2 rounded-full border text-sm font-medium transition-all",
                pronouns === p
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Birth year + birth place */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Birth year <span className="text-muted-foreground text-xs">(optional)</span></Label>
          <Input
            placeholder="e.g., 1952"
            value={birthYear}
            onChange={e => setBirthYear(e.target.value)}
            maxLength={4}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Place of birth <span className="text-muted-foreground text-xs">(optional)</span></Label>
          <Input
            placeholder="e.g., Honolulu, HI"
            value={birthPlace}
            onChange={e => setBirthPlace(e.target.value)}
          />
        </div>
      </div>

      {/* Relationship — only if not selfMode */}
      {!selfMode && (
        <div className="space-y-1.5">
          <Label>Your relationship to them <span className="text-destructive">*</span></Label>
          <Select value={relationship} onValueChange={setRelationship}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select relationship" />
            </SelectTrigger>
            <SelectContent>
              {RELATIONSHIPS.filter(r => r !== "myself").map(r => (
                <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Bio */}
      <div className="space-y-1.5">
        <Label>
          {selfMode ? "How would you describe yourself?" : "How would you describe them?"}
          <span className="text-muted-foreground text-xs ml-1">(optional)</span>
        </Label>
        <Textarea
          placeholder={selfMode
            ? "A few words about who you are — your spirit, your essence. This shapes how your Echo speaks."
            : "A few words about who they are — their spirit, their essence. This helps shape how the AI speaks as them."}
          value={bio}
          onChange={e => setBio(e.target.value)}
          rows={3}
          className="resize-none"
        />
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button className="flex-1 gap-2" disabled={!canContinue} onClick={onNext} data-testid="button-step2-next">
          Continue <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ── Step 3: About the creator (only if not selfMode) ──────────────────────────
function StepAboutYou({
  creatorName, setCreatorName,
  creatorRelationship, setCreatorRelationship,
  creatorNote, setCreatorNote,
  personaName,
  onBack, onSubmit, isPending,
}: {
  creatorName: string; setCreatorName: (v: string) => void;
  creatorRelationship: string; setCreatorRelationship: (v: string) => void;
  creatorNote: string; setCreatorNote: (v: string) => void;
  personaName: string;
  onBack: () => void;
  onSubmit: () => void;
  isPending: boolean;
}) {
  const firstName = personaName.split(" ")[0] || "them";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-semibold text-foreground mb-1">About you</h1>
        <p className="text-sm text-muted-foreground">
          The AI will know who built {firstName}'s Echo and why — this makes conversations feel more personal.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label>Your name <span className="text-muted-foreground text-xs">(optional)</span></Label>
        <Input
          placeholder="e.g., Emma"
          value={creatorName}
          onChange={e => setCreatorName(e.target.value)}
          data-testid="input-creator-name"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Your relationship to {firstName} <span className="text-muted-foreground text-xs">(optional)</span></Label>
        <Input
          placeholder={`e.g., "I am ${firstName}'s daughter"`}
          value={creatorRelationship}
          onChange={e => setCreatorRelationship(e.target.value)}
          data-testid="input-creator-relationship"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Why are you creating this Echo? <span className="text-muted-foreground text-xs">(optional)</span></Label>
        <Textarea
          placeholder={`e.g., "${firstName} is my mother. I want my children to know who she was — her laugh, her wisdom, the way she made everyone feel seen."`}
          value={creatorNote}
          onChange={e => setCreatorNote(e.target.value)}
          rows={3}
          className="resize-none"
        />
        <p className="text-xs text-muted-foreground">This gives the Echo emotional context for why it exists.</p>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button className="flex-1 gap-2" onClick={onSubmit} disabled={isPending} data-testid="button-create-submit">
          {isPending ? "Creating Echo…" : `Create ${personaName.split(" ")[0] || "Echo"}'s Echo`}
          {!isPending && <ArrowRight className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

// ── Step 3 (self mode): Review + create ───────────────────────────────────────
function StepReview({
  name, onBack, onSubmit, isPending,
}: {
  name: string;
  onBack: () => void;
  onSubmit: () => void;
  isPending: boolean;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-semibold text-foreground mb-1">Ready to create your Echo</h1>
        <p className="text-sm text-muted-foreground">
          Once created, you'll add your stories, values, and voice recordings. The more you share, the richer your Echo becomes.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 space-y-3 paper-surface">
        <p className="text-sm text-muted-foreground">Your Echo will:</p>
        <ul className="space-y-2 text-sm text-foreground">
          {[
            "Speak in your voice and with your personality",
            "Draw on your stories, memories, and values",
            "Answer questions the way you would",
            "Preserve your essence for those you love",
          ].map(item => (
            <li key={item} className="flex items-start gap-2">
              <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button className="flex-1 gap-2" onClick={onSubmit} disabled={isPending} data-testid="button-create-submit">
          {isPending ? "Creating Echo…" : `Create my Echo`}
          {!isPending && <ArrowRight className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
interface Contribution {
  id: number; type: string; title: string | null; content: string; period: string | null; tags: string | null;
}
interface ContributionData {
  contributions: Contribution[];
  persona: { name: string } | null;
  member: { name: string } | null;
}

// ── Step 4: Import memories ──────────────────────────────────────────────────
function StepImportMemories({
  contributions, personaName, selected, setSelected, onBack, onSubmit, isPending
}: {
  contributions: Contribution[];
  personaName: string;
  selected: Set<number>;
  setSelected: (s: Set<number>) => void;
  onBack: () => void;
  onSubmit: () => void;
  isPending: boolean;
}) {
  const toggle = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-xl font-semibold text-foreground mb-1">Your memories of {personaName}</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          You contributed {contributions.length} {contributions.length === 1 ? "memory" : "memories"} to {personaName}'s Echo. Would you like to bring any of them into your own Echo as your personal memories?
        </p>
      </div>

      <div className="space-y-3">
        {contributions.map(m => {
          const isSelected = selected.has(m.id);
          return (
            <button key={m.id} type="button" onClick={() => toggle(m.id)}
              className={cn(
                "w-full flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all",
                isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
              )}>
              <div className={cn(
                "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all",
                isSelected ? "border-primary bg-primary" : "border-muted-foreground/40"
              )}>
                {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                {m.title && <div className="text-sm font-medium text-foreground mb-0.5">{m.title}</div>}
                <p className="text-sm text-muted-foreground line-clamp-3">{m.content}</p>
                {m.period && m.period !== "general" && (
                  <span className="text-xs text-muted-foreground/60 capitalize mt-1 block">{m.period}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="rounded-lg bg-muted/50 border border-border p-3 text-xs text-muted-foreground">
        Selected memories will be added to your Echo as your personal memories — the framing stays as your perspective on {personaName}.
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button className="flex-1 gap-2" onClick={onSubmit} disabled={isPending}>
          {isPending ? "Creating Echo…" : selected.size > 0
            ? `Create Echo with ${selected.size} ${selected.size === 1 ? "memory" : "memories"}`
            : "Create Echo without importing"}
          {!isPending && <ArrowRight className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

export default function CreatePersona() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const searchStr = useSearch();
  const fromCode = new URLSearchParams(searchStr).get("from") || "";
  const [step, setStep] = useState(1);
  const [contributions, setContributions] = useState<ContributionData | null>(null);
  const [selectedMemories, setSelectedMemories] = useState<Set<number>>(new Set());
  const totalSteps = fromCode ? 4 : 3;

  // Load contributions from access code if present
  useEffect(() => {
    if (!fromCode) return;
    fetch(`${API_BASE}/api/family/${fromCode}/contributions`)
      .then(r => r.json())
      .then(d => {
        if (d.contributions?.length > 0) {
          setContributions(d);
          // Pre-select all by default
          setSelectedMemories(new Set(d.contributions.map((m: Contribution) => m.id)));
        }
      })
      .catch(() => {});
  }, [fromCode]);

  // Step 1
  const [selfMode, setSelfMode] = useState<boolean | null>(null);

  // Step 2 — about the persona
  const [name, setName] = useState("");
  const [pronouns, setPronouns] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [birthPlace, setBirthPlace] = useState("");
  const [relationship, setRelationship] = useState("");
  const [bio, setBio] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Step 3 — about the creator
  const [creatorName, setCreatorName] = useState("");
  const [creatorRelationship, setCreatorRelationship] = useState("");
  const [creatorNote, setCreatorNote] = useState("");

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const form = new FormData();
      form.append("name", name);
      form.append("relationship", selfMode ? "myself" : relationship);
      form.append("pronouns", pronouns);
      if (birthYear) form.append("birthYear", birthYear);
      if (birthPlace) form.append("birthPlace", birthPlace);
      if (bio) form.append("bio", bio);
      form.append("selfMode", selfMode ? "true" : "false");
      if (!selfMode && creatorName) form.append("creatorName", creatorName);
      if (!selfMode && creatorRelationship) form.append("creatorRelationship", creatorRelationship);
      if (!selfMode && creatorNote) form.append("creatorNote", creatorNote);
      if (photoFile) form.append("photo", photoFile);

      const res = await fetch(`${API_BASE}/api/personas`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: async (persona) => {
      // Import selected memories from contributions
      if (selectedMemories.size > 0 && contributions) {
        const toImport = contributions.contributions.filter(m => selectedMemories.has(m.id));
        await Promise.all(toImport.map(m =>
          fetch(`${API_BASE}/api/personas/${persona.id}/memories`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: m.type,
              title: m.title,
              content: m.content,
              period: m.period,
              tags: m.tags, // preserves perspective
            }),
          })
        ));
      }
      queryClient.invalidateQueries({ queryKey: ["/api/personas"] });
      toast({
        title: `${persona.name}'s Echo created`,
        description: selectedMemories.size > 0
          ? `Created with ${selectedMemories.size} imported ${selectedMemories.size === 1 ? "memory" : "memories"}.`
          : "Now let's add their memories and personality.",
      });
      navigate(`/persona/${persona.id}/memories`);
    },
    onError: (e: Error) => {
      if (e.message.includes("403") || e.message.includes("ECHO_LIMIT")) {
        toast({
          title: "Echo limit reached",
          description: "You've reached your Echo limit on your current plan. Upgrade to create more.",
          variant: "destructive",
        });
        navigate("/pricing");
      } else {
        toast({ title: "Something went wrong", description: String(e), variant: "destructive" });
      }
    },
  });

  return (
    <Layout backTo="/" backLabel="Home">
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-10">
        <Steps current={step} total={totalSteps} />

        {step === 1 && (
          <StepWho
            selfMode={selfMode}
            setSelfMode={setSelfMode}
            onNext={() => setStep(2)}
          />
        )}

        {step === 2 && (
          <StepAboutThem
            selfMode={selfMode!}
            name={name} setName={setName}
            birthYear={birthYear} setBirthYear={setBirthYear}
            birthPlace={birthPlace} setBirthPlace={setBirthPlace}
            pronouns={pronouns} setPronouns={setPronouns}
            relationship={relationship} setRelationship={setRelationship}
            bio={bio} setBio={setBio}
            photoPreview={photoPreview}
            onPhoto={handlePhoto}
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
          />
        )}

        {step === 3 && !selfMode && (
          <StepAboutYou
            creatorName={creatorName} setCreatorName={setCreatorName}
            creatorRelationship={creatorRelationship} setCreatorRelationship={setCreatorRelationship}
            creatorNote={creatorNote} setCreatorNote={setCreatorNote}
            personaName={name}
            onBack={() => setStep(2)}
            onSubmit={() => contributions?.contributions?.length ? setStep(4) : createMutation.mutate()}
            isPending={createMutation.isPending}
          />
        )}

        {step === 3 && selfMode && (
          <StepReview
            name={name}
            onBack={() => setStep(2)}
            onSubmit={() => contributions?.contributions?.length ? setStep(4) : createMutation.mutate()}
            isPending={createMutation.isPending}
          />
        )}

        {step === 4 && contributions && (
          <StepImportMemories
            contributions={contributions.contributions}
            personaName={contributions.persona?.name || "your loved one"}
            selected={selectedMemories}
            setSelected={setSelectedMemories}
            onBack={() => setStep(3)}
            onSubmit={() => createMutation.mutate()}
            isPending={createMutation.isPending}
          />
        )}
      </div>
    </Layout>
  );
}
