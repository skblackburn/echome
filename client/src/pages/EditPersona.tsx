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
import { Save, Camera, Trash2, Heart, Plus, X } from "lucide-react";
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
  const [isLiving, setIsLiving] = useState(true);
  const [passingDate, setPassingDate] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const avatarRef = useRef<HTMLInputElement>(null);

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
      setIsLiving((persona as any).isLiving !== false);
      setPassingDate((persona as any).passingDate || "");
      setAvatarUrl((persona as any).avatarUrl || null);
    }
  }, [persona]);

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      toast({ title: "Invalid file type", description: "Please upload a JPG, PNG, or WebP image.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAvatarUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
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
      form.append("isLiving", String(isLiving));
      if (!isLiving && passingDate) form.append("passingDate", passingDate);
      if (isLiving) form.append("passingDate", "");
      if (photoFile) form.append("photo", photoFile);
      if (avatarUrl !== undefined) form.append("avatarUrl", avatarUrl || "");

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

        {/* Avatar / Photo */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <button type="button" onClick={() => avatarRef.current?.click()}
              className="flex-shrink-0 w-24 h-24 rounded-full border-2 border-dashed border-primary/30 flex items-center justify-center bg-background hover:bg-primary/5 hover:border-primary/50 transition-all cursor-pointer overflow-hidden group">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : currentPhoto ? (
                <img src={currentPhoto} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-1.5 text-primary/50 group-hover:text-primary transition-colors">
                  <Plus className="h-6 w-6" />
                  <span className="text-xs font-medium">Photo</span>
                </div>
              )}
            </button>
            {avatarUrl && (
              <button
                type="button"
                onClick={() => setAvatarUrl(null)}
                className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-sm hover:bg-destructive/90 transition-colors"
                title="Remove photo"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <input ref={avatarRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarUpload} className="hidden" />
          <input ref={photoRef} type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
          <div>
            <p className="text-sm font-medium text-foreground">Add a photo of {firstName}</p>
            <p className="text-xs text-muted-foreground mt-0.5">JPG, PNG, or WebP. Displayed on their Echo card and in chat.</p>
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
            <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
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
            <Input value={birthPlace} onChange={e => setBirthPlace(e.target.value)} placeholder="e.g., Hana, Hawaii" />
          </div>
        </div>

        {/* Passing date — sensitive section */}
        <div className="rounded-xl border border-rose-200/60 dark:border-rose-900/30 p-5 space-y-4 bg-rose-50/30 dark:bg-rose-950/10">
          <div className="flex items-center gap-2">
            <Heart className="h-4 w-4 text-rose-400" />
            <p className="text-sm font-medium text-foreground">Is {firstName} still with us?</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsLiving(true)}
              className={cn(
                "px-4 py-2 rounded-full border text-sm font-medium transition-all",
                isLiving
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/40"
              )}
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => setIsLiving(false)}
              className={cn(
                "px-4 py-2 rounded-full border text-sm font-medium transition-all",
                !isLiving
                  ? "border-rose-400 bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800"
                  : "border-border text-muted-foreground hover:border-rose-300"
              )}
            >
              No longer with us
            </button>
          </div>

          {!isLiving && (
            <div className="space-y-3 pt-1">
              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">When did {firstName} pass away?</Label>
                <Input
                  type="date"
                  value={passingDate}
                  onChange={e => setPassingDate(e.target.value)}
                  className="w-48"
                />
                <p className="text-xs text-muted-foreground">
                  This helps the Echo acknowledge the passage of time naturally in conversations.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Memorial dates (legacy fields) */}
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
          {saveMutation.isPending ? "Saving..." : "Save changes"}
        </Button>

        {/* Danger zone */}
        <div className="rounded-xl border border-destructive/30 p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-destructive/70">Danger zone</p>
          <p className="text-sm text-muted-foreground">Permanently delete this Echo and all its memories, conversations, and milestone messages. This cannot be undone.</p>
          <Button variant="destructive" size="sm" className="gap-2" disabled={deleteMutation.isPending}
            onClick={() => { if (confirm(`Delete ${firstName}'s Echo permanently?`)) deleteMutation.mutate(); }}>
            <Trash2 className="h-4 w-4" />
            {deleteMutation.isPending ? "Deleting..." : `Delete ${firstName}'s Echo`}
          </Button>
        </div>
      </div>
    </Layout>
  );
}
