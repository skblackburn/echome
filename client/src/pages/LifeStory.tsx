import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Save, Plus, Trash2, Apple, Music, Wind, MapPin, MessageCircle, Heart, Laugh, Shield, Home, Briefcase, Star, CloudRain, Gift, BookOpen, Feather } from "lucide-react";
import type { Persona } from "@shared/schema";
import { cn } from "@/lib/utils";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

interface LifeStoryData {
  favoriteFood?: string;
  favoriteMusic?: string;
  favoriteSmell?: string;
  favoritePlace?: string;
  catchphrase?: string;
  loveLanguage?: string;
  humor?: string;
  hardTimes?: string;
  hometown?: string;
  career?: string;
  proudestMoment?: string;
  hardestPeriod?: string;
  wishForFamily?: string;
  whatToRemember?: string;
  unfinshedBusiness?: string;
}

interface Child {
  name: string;
  birthYear: string;
  note: string;
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ icon: Icon, title, color, children }: {
  icon: React.ElementType;
  title: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card paper-surface overflow-hidden">
      <div className={cn("flex items-center gap-3 px-6 py-4 border-b border-border", color)}>
        <div className="w-8 h-8 rounded-full bg-background/60 flex items-center justify-center flex-shrink-0">
          <Icon className="h-4 w-4" />
        </div>
        <h2 className="font-display font-semibold text-base">{title}</h2>
      </div>
      <div className="p-6 space-y-5">{children}</div>
    </div>
  );
}

// ── Field ─────────────────────────────────────────────────────────────────────
function Field({ label, placeholder, value, onChange, multiline = false }: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {multiline ? (
        <Textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="min-h-[80px] resize-none text-sm bg-background/60"
        />
      ) : (
        <Input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="text-sm bg-background/60"
        />
      )}
    </div>
  );
}

export default function LifeStory() {
  const { id } = useParams<{ id: string }>();
  const personaId = parseInt(id);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Persona
  const { data: persona } = useQuery<Persona>({
    queryKey: ["/api/personas", personaId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/personas/${personaId}`);
      return res.json();
    },
  });

  // Life story
  const { data: saved } = useQuery<LifeStoryData>({
    queryKey: ["/api/personas", personaId, "life-story"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/personas/${personaId}/life-story`);
      return res.json();
    },
  });

  // Form state — sensory
  const [favoriteFood, setFavoriteFood] = useState("");
  const [favoriteMusic, setFavoriteMusic] = useState("");
  const [favoriteSmell, setFavoriteSmell] = useState("");
  const [favoritePlace, setFavoritePlace] = useState("");
  const [catchphrase, setCatchphrase] = useState("");
  // how they loved
  const [loveLanguage, setLoveLanguage] = useState("");
  const [humor, setHumor] = useState("");
  const [hardTimes, setHardTimes] = useState("");
  // life chapters
  const [hometown, setHometown] = useState("");
  const [career, setCareer] = useState("");
  const [proudestMoment, setProudestMoment] = useState("");
  const [hardestPeriod, setHardestPeriod] = useState("");
  // legacy
  const [wishForFamily, setWishForFamily] = useState("");
  const [whatToRemember, setWhatToRemember] = useState("");
  const [unfinshedBusiness, setUnfinshedBusiness] = useState("");
  // family
  const [spouse, setSpouse] = useState("");
  const [children, setChildren] = useState<Child[]>([]);

  // Load saved data
  useEffect(() => {
    if (saved) {
      setFavoriteFood(saved.favoriteFood || "");
      setFavoriteMusic(saved.favoriteMusic || "");
      setFavoriteSmell(saved.favoriteSmell || "");
      setFavoritePlace(saved.favoritePlace || "");
      setCatchphrase(saved.catchphrase || "");
      setLoveLanguage(saved.loveLanguage || "");
      setHumor(saved.humor || "");
      setHardTimes(saved.hardTimes || "");
      setHometown(saved.hometown || "");
      setCareer(saved.career || "");
      setProudestMoment(saved.proudestMoment || "");
      setHardestPeriod(saved.hardestPeriod || "");
      setWishForFamily(saved.wishForFamily || "");
      setWhatToRemember(saved.whatToRemember || "");
      setUnfinshedBusiness(saved.unfinshedBusiness || "");
    }
  }, [saved]);

  useEffect(() => {
    if (persona) {
      setSpouse(persona.spouse || "");
      try {
        if (persona.children) setChildren(JSON.parse(persona.children));
      } catch (_) {}
    }
  }, [persona]);

  // Save life story mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      // Save life story fields
      await apiRequest("PUT", `/api/personas/${personaId}/life-story`, {
        favoriteFood, favoriteMusic, favoriteSmell, favoritePlace, catchphrase,
        loveLanguage, humor, hardTimes,
        hometown, career, proudestMoment, hardestPeriod,
        wishForFamily, whatToRemember, unfinshedBusiness,
      });
      // Save spouse + children to persona
      await apiRequest("PATCH", `/api/personas/${personaId}`, {
        spouse,
        children: JSON.stringify(children.filter(c => c.name.trim())),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personas", personaId, "life-story"] });
      queryClient.invalidateQueries({ queryKey: ["/api/personas", personaId] });
      toast({ title: "Life story saved", description: "The AI will use this to speak as them." });
    },
    onError: () => {
      toast({ title: "Couldn't save", variant: "destructive" });
    },
  });

  const addChild = () => setChildren(prev => [...prev, { name: "", birthYear: "", note: "" }]);
  const updateChild = (i: number, field: keyof Child, value: string) => {
    setChildren(prev => prev.map((c, idx) => idx === i ? { ...c, [field]: value } : c));
  };
  const removeChild = (i: number) => setChildren(prev => prev.filter((_, idx) => idx !== i));

  const firstName = persona?.name?.split(" ")[0] || "them";

  return (
    <Layout
      title="Life Story"
      backHref={`/persona/${personaId}/memories`}
      backLabel="Back"
    >
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="font-display text-xl font-semibold text-foreground">
            {persona?.name ? `${persona.name}'s Life Story` : "Life Story"}
          </h1>
          <p className="text-sm text-muted-foreground">
            The specific details that make {firstName} unmistakably themselves. Every answer makes the Echo richer.
          </p>
        </div>

        {/* Family */}
        <Section icon={Heart} title="Family" color="bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400">
          <Field
            label={`Spouse or partner`}
            placeholder={`e.g. "Robert, her husband of 42 years — patient, funny, her rock"`}
            value={spouse}
            onChange={setSpouse}
          />
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">Children</label>
              <Button
                variant="ghost"
                size="sm"
                onClick={addChild}
                className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
              >
                <Plus className="h-3 w-3" /> Add child
              </Button>
            </div>
            {children.length === 0 && (
              <p className="text-xs text-muted-foreground italic">No children added yet</p>
            )}
            {children.map((child, i) => (
              <div key={i} className="flex gap-2 items-start p-3 rounded-xl border border-border bg-background/40">
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <Input
                    value={child.name}
                    onChange={e => updateChild(i, "name", e.target.value)}
                    placeholder="Name"
                    className="text-sm h-8 bg-background/60"
                  />
                  <Input
                    value={child.birthYear}
                    onChange={e => updateChild(i, "birthYear", e.target.value)}
                    placeholder="Birth year"
                    className="text-sm h-8 bg-background/60"
                  />
                  <Input
                    value={child.note}
                    onChange={e => updateChild(i, "note", e.target.value)}
                    placeholder="A note about them (optional)"
                    className="text-sm h-8 bg-background/60 col-span-2"
                  />
                </div>
                <button
                  onClick={() => removeChild(i)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors mt-0.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </Section>

        {/* Sensory World */}
        <Section icon={Apple} title="Their Sensory World" color="bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400">
          <Field label="Favorite food or meal" placeholder={`e.g. "Her own chicken soup — always made from scratch on Sundays"`} value={favoriteFood} onChange={setFavoriteFood} />
          <Field label="Music they loved" placeholder={`e.g. "Motown, anything by Stevie Wonder, hummed while cooking"`} value={favoriteMusic} onChange={setFavoriteMusic} />
          <Field label="A smell that takes them back" placeholder={`e.g. "Fresh bread, pine trees, her mother's perfume"`} value={favoriteSmell} onChange={setFavoriteSmell} />
          <Field label="A place that meant everything" placeholder={`e.g. "The lake cabin we rented every August"`} value={favoritePlace} onChange={setFavoritePlace} />
          <Field label="Something they always said" placeholder={`e.g. "Life is short, eat the dessert" or "You've got this, kiddo"`} value={catchphrase} onChange={setCatchphrase} />
        </Section>

        {/* How They Loved */}
        <Section icon={Laugh} title="How They Loved" color="bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-400">
          <Field label="How they showed affection" placeholder={`e.g. "Acts of service — always fixing things, showing up, cooking your favorite meal when you were sad"`} value={loveLanguage} onChange={setLoveLanguage} multiline />
          <Field label="Their sense of humor" placeholder={`e.g. "Dry, self-deprecating, loved puns — could make anyone laugh at a funeral"`} value={humor} onChange={setHumor} multiline />
          <Field label="How they handled hard times" placeholder={`e.g. "Went quiet, then practical — made a list and worked through it step by step"`} value={hardTimes} onChange={setHardTimes} multiline />
        </Section>

        {/* Life Chapters */}
        <Section icon={BookOpen} title="Life Chapters" color="bg-sky-50 dark:bg-sky-950/20 text-sky-700 dark:text-sky-400">
          <Field label="Where they grew up" placeholder={`e.g. "A small town in rural Ohio, youngest of five kids"`} value={hometown} onChange={setHometown} />
          <Field label="Career and work" placeholder={`e.g. "Nurse for 30 years — loved the patients, hated the paperwork"`} value={career} onChange={setCareer} multiline />
          <Field label="Their proudest moment" placeholder={`e.g. "Watching you graduate college — cried the whole ceremony"`} value={proudestMoment} onChange={setProudestMoment} multiline />
          <Field label="The hardest period of their life" placeholder={`e.g. "Losing her mother in 1989 — took years to find herself again"`} value={hardestPeriod} onChange={setHardestPeriod} multiline />
        </Section>

        {/* Legacy */}
        <Section icon={Feather} title="Hopes & Legacy" color="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400">
          <Field label={`What ${firstName} wishes for their family`} placeholder={`e.g. "That you choose joy — not the safe choice, the joyful one"`} value={wishForFamily} onChange={setWishForFamily} multiline />
          <Field label="What they most want to be remembered for" placeholder={`e.g. "Being someone who showed up — for everyone, every time"`} value={whatToRemember} onChange={setWhatToRemember} multiline />
          <Field label="Things left unsaid or unfinished" placeholder={`e.g. "Never told her daughter how proud she was. Wanted to travel to Italy."`} value={unfinshedBusiness} onChange={setUnfinshedBusiness} multiline />
        </Section>

        {/* Save */}
        <div className="flex justify-end pb-8">
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-8"
          >
            <Save className="h-4 w-4" />
            {saveMutation.isPending ? "Saving…" : "Save Life Story"}
          </Button>
        </div>
      </div>
    </Layout>
  );
}
