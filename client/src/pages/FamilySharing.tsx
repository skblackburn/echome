import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Users, Plus, Trash2, Copy, Check, Heart } from "lucide-react";
import type { Persona } from "@shared/schema";
import { cn } from "@/lib/utils";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

interface FamilyMember {
  id: number;
  personaId: number;
  name: string;
  relationship: string;
  accessCode: string;
}

const RELATIONSHIPS = [
  "daughter", "son", "granddaughter", "grandson", "sister", "brother",
  "niece", "nephew", "spouse", "partner", "friend", "other"
];

export default function FamilySharing() {
  const { id } = useParams<{ id: string }>();
  const personaId = parseInt(id);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const { data: persona } = useQuery<Persona>({
    queryKey: ["/api/personas", personaId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/personas/${personaId}`);
      return res.json();
    },
  });

  const { data: members = [] } = useQuery<FamilyMember[]>({
    queryKey: ["/api/personas", personaId, "family"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/personas/${personaId}/family`);
      return res.json();
    },
  });

  const addMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/personas/${personaId}/family`, { name, relationship }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personas", personaId, "family"] });
      setShowForm(false);
      setName(""); setRelationship("");
      toast({ title: "Family member added", description: "Share their access code so they can connect." });
    },
    onError: () => toast({ title: "Couldn't add family member", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/family/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/personas", personaId, "family"] }),
  });

  const copyCode = (member: FamilyMember) => {
    const shareText = `${member.name}, I've created an Echo of ${persona?.name} on EchoMe so you can always talk with ${persona?.pronouns === "he/him" ? "him" : "her"}.\n\nYour access code: ${member.accessCode}\n\nOpen EchoMe and enter this code to start a conversation.`;
    navigator.clipboard.writeText(shareText).then(() => {
      setCopiedId(member.id);
      setTimeout(() => setCopiedId(null), 2500);
      toast({ title: "Copied to clipboard", description: "Share this message with " + member.name });
    });
  };

  const firstName = persona?.name?.split(" ")[0] || "them";

  return (
    <Layout title="Family Sharing" backTo={`/persona/${personaId}`} backLabel={persona?.name || "Back"}>
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        <div className="space-y-1">
          <h1 className="font-display text-xl font-semibold text-foreground">
            Share {firstName}'s Echo
          </h1>
          <p className="text-sm text-muted-foreground">
            Invite family members to have their own private conversations with {firstName}. Each person gets a unique access code.
          </p>
        </div>

        {/* How it works */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3 paper-surface">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">How it works</p>
          <div className="space-y-2">
            {[
              "Add a family member's name and relationship below",
              "Share their unique 6-character access code with them",
              "They enter the code in EchoMe to access their own conversation",
              "Each person has a completely private conversation thread",
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-primary/15 text-primary text-xs font-semibold flex items-center justify-center flex-shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <p className="text-sm text-muted-foreground">{step}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Add button */}
        {!showForm && (
          <Button onClick={() => setShowForm(true)} variant="outline" className="w-full gap-2">
            <Plus className="h-4 w-4" /> Add a family member
          </Button>
        )}

        {/* Form */}
        {showForm && (
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4 paper-surface">
            <h2 className="font-semibold text-foreground text-sm">Add family member</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Name <span className="text-destructive">*</span></Label>
                <Input placeholder="e.g., Eowyn" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Relationship <span className="text-destructive">*</span></Label>
                <Select value={relationship} onValueChange={setRelationship}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    {RELATIONSHIPS.map(r => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowForm(false)} className="flex-1">Cancel</Button>
              <Button disabled={!name.trim() || !relationship || addMutation.isPending}
                onClick={() => addMutation.mutate()} className="flex-1 gap-1.5">
                <Users className="h-4 w-4" />
                {addMutation.isPending ? "Adding…" : "Add & generate code"}
              </Button>
            </div>
          </div>
        )}

        {/* Members list */}
        {members.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Family members with access ({members.length})
            </h2>
            {members.map(m => (
              <div key={m.id} className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card paper-surface">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Heart className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground">{m.name}</div>
                  <div className="text-xs text-muted-foreground capitalize">{m.relationship}</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="font-mono text-sm font-semibold tracking-widest text-primary bg-primary/10 px-3 py-1 rounded-lg">
                    {m.accessCode}
                  </div>
                  <button
                    onClick={() => copyCode(m)}
                    className={cn(
                      "p-2 rounded-lg transition-all",
                      copiedId === m.id
                        ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                    title="Copy share message"
                  >
                    {copiedId === m.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                  <button onClick={() => deleteMutation.mutate(m.id)}
                    className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {members.length === 0 && !showForm && (
          <div className="text-center py-12 space-y-3">
            <Users className="h-10 w-10 text-muted-foreground/40 mx-auto" />
            <p className="text-sm text-muted-foreground">No family members added yet.</p>
            <p className="text-xs text-muted-foreground/70 max-w-xs mx-auto">
              {firstName}'s Echo can be shared with anyone who loved {firstName === persona?.name?.split(" ")[0] ? "them" : firstName} — each person gets their own private conversation.
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}
