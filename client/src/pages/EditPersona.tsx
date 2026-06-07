import { useState, useRef, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Save, Camera, Trash2 } from "lucide-react";
import type { Persona } from "@shared/schema";
import { cn } from "@/lib/utils";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

const RELATIONSHIPS = [
  "mother", "father", "grandmother", "grandfather", "wife", "husband",
  "partner", "sister", "brother", "aunt", "uncle", "friend", "mentor", "myself", "other"
];

export default function EditPersona() {
  const { id } = useParams<{ id: string }>();
  const personaId = parseInt(id);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const photoRef = useRef<HTMLInputElement>(null);

  const { data: persona, isLoading } = useQuery<Persona>({
    queryKey: ["/api/personas", personaId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/personas/${personaId}`);
      return res.json();
    },
  });

  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [pronouns, setPronouns] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [birthPlace, setBirthPlace] = useState("");
  const [bio, setBio] = useState("");
  const [deathYear, setDeathYear] = useState("");
  const [remembranceDate, setRemembranceDate] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Populate form when persona loads
  useEffect(() => {
    if (persona) {
      setName(persona.name || "");
      setRelationship(persona.relationship || "");
      setPronouns(persona.pronouns || "");
      setBirthYear(persona.birthYear || "");
      setBirthPlace((persona as any).birthPlace || "");
      setBio(persona.bio || "");
      setDeathYear((persona as any).deathYear || "");
      setRemembranceDate((persona as any).remembranceDate || "");
    }
  }, [persona]);

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const form = new FormData();
      form.append("name", name);
      form.append("relationship", relationship);
      form.append("pronouns", pronouns);
      if (birthYear) form.append("birthYear", birthYear);
      if (birthPlace) form.append("birthPlace", birthPlace);
      if (bio) form.append("bio", bio);
      if (deathYear) form.append("deathYear", deathYear);
      if (remembranceDate) form.append("remembranceDate", remembranceDate);
      if (photoFile) form.append("photo", photoFile);

      const res = await fetch(`${API_BASE}/api/personas/${personaId}`, {
        method: "PATCH",
        body: form,
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personas", personaId] });
      queryClient.invalidateQueries({ queryKey: ["/api/personas"] });
      toast({ title: "Profile updated" });
      navigate(`/persona/${personaId}`);
    },
    onError: (e) => toast({ title: "Couldn't save", description: String(e), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/api/personas/${personaId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personas"] });
      toast({ title: "Echo deleted" });
      navigate("/");
    },
    onError: () => toast({ title: "Couldn't delete", variant: "destructive" }),
  });

  const currentPhoto = photoPreview || (persona?.photo ? `${API_BASE}/uploads/${persona.photo}` : null);
  const firstName = persona?.name?.split(" ")[0] || "Echo";

  if (isLoading) return (
    <Layout backTo={`/persona/${personaId}`} backLabel="Back">
      <div className="max-w-xl mx-auto px-4 py-10">
        <div className="h-8 w-48 bg-muted rounded animate-pulse mb-6" />
        <div className="space-y-4">
          {[1,2,3,4].map(i => <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />)}
        </div>
      </div>
    </Layout>
  );

  return (
    <Layout backTo={`/persona/${personaId}`} backLabel={persona?.name || "Back"} title="Edit Profile">
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div>
          <h1 className="font-display text-xl font-semibold text-foreground mb-1">Edit {firstName}'s Profile</h1>
          <p className="text-sm text-muted-foreground">Changes here update how the AI understands and speaks as {firstName}.</p>
        </div>

        {/* Photo */}
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => photoRef.current?.click()}
            className="flex-shrink-0 w-20 h-20 rounded-full border-2 border-dashed border-border flex items-center justify-center bg-muted/50 hover:bg-muted hover:border-primary/40 transition-all cursor-pointer overflow-hidden group">
            {currentPhoto ? (
              <img src={currentPhoto} alt="Preview" className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-1 text-muted-foreground group-hover:text-primary transition-colors">
                <Camera className="h-5 w-5" />
                <span className="text-xs">Photo</span>
              </div>
            )}
          </button>
          <input ref={photoRef} type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
          <div>
            <p className="text-sm font-medium text-foreground">Profile photo</p>
            <p className="text-xs text-muted-foreground mt-0.5">Click to change. Optional.</p>
          </div>
        </div>

        {/* Name */}
        <div className="space-y-1.5">
          <Label>Full name <span className="text-destructive">*</span></Label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Norah Kealoha" />
        </div>

        {/* Pronouns */}
        <div className="space-y-2">
          <Label>Pronouns</Label>
          <div className="flex gap-2 flex-wrap">
            {["she/her", "he/him", "they/them"].map(p => (
              <button key={p} type="button" onClick={() => setPronouns(p)}
                className={cn("px-4 py-2 rounded-full border text-sm font-medium transition-all",
                  pronouns === p ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40")}>
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Relationship */}
        <div className="space-y-1.5">
          <Label>Relationship</Label>
          <Select value={relationship} onValueChange={setRelationship}>
            <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent>
              {RELATIONSHIPS.map(r => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Birth + place */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Birth year</Label>
            <Input value={birthYear} onChange={e => setBirthYear(e.target.value)} placeholder="e.g., 1972" maxLength={4} />
          </div>
          <div className="space-y-1.5">
            <Label>Place of birth</Label>
            <Input value={birthPlace} onChange={e => setBirthPlace(e.target.value)} placeholder="e.g., Hana, Hawaiʻi" />
          </div>
        </div>

        {/* Death year + remembrance date */}
        <div className="rounded-xl border border-border p-4 space-y-4 bg-muted/20">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Memorial dates</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Year of passing <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input value={deathYear} onChange={e => setDeathYear(e.target.value)} placeholder="e.g., 2023" maxLength={4} />
            </div>
            <div className="space-y-1.5">
              <Label>Remembrance date <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input type="date" value={remembranceDate} onChange={e => setRemembranceDate(e.target.value)} />
              <p className="text-xs text-muted-foreground">A gentle reminder appears on this date each year.</p>
            </div>
          </div>
        </div>

        {/* Bio */}
        <div className="space-y-1.5">
          <Label>Description</Label>
          <Textarea value={bio} onChange={e => setBio(e.target.value)}
            placeholder="A few words about who they are — their spirit, their essence."
            rows={4} className="resize-none" />
        </div>

        {/* Save */}
        <Button className="w-full gap-2" disabled={!name.trim() || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
          <Save className="h-4 w-4" />
          {saveMutation.isPending ? "Saving…" : "Save changes"}
        </Button>

        {/* Danger zone */}
        <div className="rounded-xl border border-destructive/30 p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-destructive/70">Danger zone</p>
          <p className="text-sm text-muted-foreground">Permanently delete this Echo and all its memories, conversations, and milestone messages. This cannot be undone.</p>
          <Button variant="destructive" size="sm" className="gap-2" disabled={deleteMutation.isPending}
            onClick={() => { if (confirm(`Delete ${firstName}'s Echo permanently?`)) deleteMutation.mutate(); }}>
            <Trash2 className="h-4 w-4" />
            {deleteMutation.isPending ? "Deleting…" : `Delete ${firstName}'s Echo`}
          </Button>
        </div>
      </div>
    </Layout>
  );
}
