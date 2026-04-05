import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Camera, User, ArrowRight } from "lucide-react";

const RELATIONSHIPS = [
  "mother", "father", "grandmother", "grandfather",
  "wife", "husband", "partner", "sister", "brother",
  "aunt", "uncle", "friend", "mentor", "other"
];

export default function CreatePersona() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const photoRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [bio, setBio] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: async () => {
      const form = new FormData();
      form.append("name", name);
      form.append("relationship", relationship);
      if (birthYear) form.append("birthYear", birthYear);
      if (bio) form.append("bio", bio);
      if (photoFile) form.append("photo", photoFile);

      const res = await fetch("/api/personas", {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (persona) => {
      queryClient.invalidateQueries({ queryKey: ["/api/personas"] });
      toast({ title: `${persona.name}'s Echo has been created`, description: "Now let's add their memories and personality." });
      navigate(`/persona/${persona.id}/memories`);
    },
    onError: (e) => {
      toast({ title: "Something went wrong", description: String(e), variant: "destructive" });
    },
  });

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const url = URL.createObjectURL(file);
      setPhotoPreview(url);
    }
  };

  const canSubmit = name.trim() && relationship;

  return (
    <Layout backTo="/" backLabel="Home">
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display text-2xl font-semibold text-foreground mb-2">
            Create an Echo
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Start by telling us who this Echo is for. You'll add their stories,
            voice, and personality in the next step.
          </p>
        </div>

        <div className="space-y-6">
          {/* Photo upload */}
          <div className="flex items-start gap-4">
            <button
              type="button"
              onClick={() => photoRef.current?.click()}
              className="flex-shrink-0 w-20 h-20 rounded-full border-2 border-dashed border-border
                         flex items-center justify-center bg-muted/50 hover:bg-muted hover:border-primary/40
                         transition-all cursor-pointer overflow-hidden group"
              data-testid="button-upload-photo"
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
            <input ref={photoRef} type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Add a photo</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                A photo helps make this Echo feel real. You can always add one later.
              </p>
            </div>
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="name">Their name <span className="text-destructive">*</span></Label>
            <Input
              id="name"
              placeholder="e.g., Sarah Chen"
              value={name}
              onChange={e => setName(e.target.value)}
              data-testid="input-name"
            />
          </div>

          {/* Relationship */}
          <div className="space-y-1.5">
            <Label>Your relationship to them <span className="text-destructive">*</span></Label>
            <Select value={relationship} onValueChange={setRelationship} data-testid="select-relationship">
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select relationship" />
              </SelectTrigger>
              <SelectContent>
                {RELATIONSHIPS.map(r => (
                  <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Birth year */}
          <div className="space-y-1.5">
            <Label htmlFor="birthYear">Birth year <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input
              id="birthYear"
              placeholder="e.g., 1952"
              value={birthYear}
              onChange={e => setBirthYear(e.target.value)}
              maxLength={4}
              data-testid="input-birth-year"
            />
          </div>

          {/* Bio */}
          <div className="space-y-1.5">
            <Label htmlFor="bio">Short description <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Textarea
              id="bio"
              placeholder="A few words about who they are — their spirit, their essence. This helps shape how the AI speaks as them."
              value={bio}
              onChange={e => setBio(e.target.value)}
              rows={3}
              className="resize-none"
              data-testid="input-bio"
            />
            <p className="text-xs text-muted-foreground">
              Example: "A warm and fiercely loving mother who always put family first. Known for her homemade bread and her laugh."
            </p>
          </div>

          {/* Submit */}
          <div className="pt-2">
            <Button
              className="w-full gap-2"
              disabled={!canSubmit || createMutation.isPending}
              onClick={() => createMutation.mutate()}
              data-testid="button-create-submit"
            >
              {createMutation.isPending ? "Creating..." : "Create Echo and add memories"}
              {!createMutation.isPending && <ArrowRight className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
