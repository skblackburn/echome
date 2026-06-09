import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Mail, Trash2, Shield, ShieldCheck, Clock, Crown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

interface Heir {
  id: number;
  personaId: number;
  heirEmail: string;
  heirName: string | null;
  heirRelationship: string | null;
  accessLevel: string;
  status: string;
  claimedAt: string | null;
  createdAt: string;
}

interface HeirLimits {
  plan: string;
  limit: number;
  current: number;
  remaining: number;
}

const RELATIONSHIPS = [
  "Daughter", "Son", "Spouse", "Brother", "Sister",
  "Mother", "Father", "Friend", "Other",
];

function AddHeirModal({
  personaId,
  onClose,
  onSuccess,
}: {
  personaId: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [accessLevel, setAccessLevel] = useState<"full" | "read_only">("full");
  const [personalMessage, setPersonalMessage] = useState("");

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/personas/${personaId}/heirs`, {
        email, name, relationship, accessLevel, personalMessage: personalMessage || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Heir added", description: "An invitation has been sent." });
      onSuccess();
      onClose();
    },
    onError: (err: Error) => {
      const msg = err.message;
      if (msg.includes("HEIR_LIMIT")) {
        toast({ title: "Heir limit reached", description: "Upgrade your plan to add more heirs.", variant: "destructive" });
      } else if (msg.includes("409")) {
        toast({ title: "Already added", description: "This email is already designated as an heir.", variant: "destructive" });
      } else {
        toast({ title: "Couldn't add heir", description: String(err), variant: "destructive" });
      }
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <Card className="w-full max-w-md p-6 space-y-5 relative bg-background">
        <button onClick={onClose} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground">
          <X className="h-5 w-5" />
        </button>
        <div>
          <h3 className="font-display text-lg font-semibold text-foreground">Add an Heir</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Choose someone you trust to carry this Echo forward.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label>Email <span className="text-destructive">*</span></Label>
          <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Their email address" />
        </div>

        <div className="space-y-1.5">
          <Label>Name</Label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Their name (optional)" />
        </div>

        <div className="space-y-1.5">
          <Label>Relationship</Label>
          <Select value={relationship} onValueChange={setRelationship}>
            <SelectTrigger><SelectValue placeholder="How are they related?" /></SelectTrigger>
            <SelectContent>
              {RELATIONSHIPS.map(r => <SelectItem key={r} value={r.toLowerCase()}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Access level</Label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAccessLevel("full")}
              className={cn(
                "flex-1 px-3 py-2.5 rounded-lg border text-sm text-left transition-all",
                accessLevel === "full"
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:border-primary/40"
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span className="font-medium">Full access</span>
              </div>
              <p className="text-xs text-muted-foreground">Can chat, view, and add memories</p>
            </button>
            <button
              type="button"
              onClick={() => setAccessLevel("read_only")}
              className={cn(
                "flex-1 px-3 py-2.5 rounded-lg border text-sm text-left transition-all",
                accessLevel === "read_only"
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:border-primary/40"
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <Shield className="h-4 w-4 text-primary" />
                <span className="font-medium">Read only</span>
              </div>
              <p className="text-xs text-muted-foreground">Can chat and view, but not add content</p>
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Personal message <span className="text-muted-foreground text-xs">(optional)</span></Label>
          <Textarea
            value={personalMessage}
            onChange={e => setPersonalMessage(e.target.value)}
            placeholder="A note to include in the invitation email..."
            rows={3}
            className="resize-none"
          />
        </div>

        <Button
          className="w-full gap-2"
          disabled={!email.trim() || addMutation.isPending}
          onClick={() => addMutation.mutate()}
        >
          <Mail className="h-4 w-4" />
          {addMutation.isPending ? "Sending invitation..." : "Send invitation"}
        </Button>
      </Card>
    </div>
  );
}

function HeirCard({ heir, personaId, onRefresh }: { heir: Heir; personaId: number; onRefresh: () => void }) {
  const { toast } = useToast();
  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/personas/${personaId}/heirs/${heir.id}`);
    },
    onSuccess: () => {
      toast({ title: "Heir removed" });
      onRefresh();
    },
    onError: (err: Error) => toast({ title: "Couldn't remove", description: String(err), variant: "destructive" }),
  });

  const statusBadge = {
    pending: <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 dark:text-amber-400"><Clock className="h-3 w-3 mr-1" />Pending</Badge>,
    claimed: <Badge variant="outline" className="text-xs border-green-300 text-green-700 dark:text-green-400"><ShieldCheck className="h-3 w-3 mr-1" />Claimed</Badge>,
    declined: <Badge variant="outline" className="text-xs border-red-300 text-red-700 dark:text-red-400">Declined</Badge>,
  }[heir.status] || null;

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
        <span className="text-sm font-semibold text-primary">
          {(heir.heirName || heir.heirEmail)[0].toUpperCase()}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground truncate">
            {heir.heirName || heir.heirEmail}
          </span>
          {statusBadge}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
          <span className="truncate">{heir.heirEmail}</span>
          {heir.heirRelationship && (
            <>
              <span className="text-muted-foreground/40">|</span>
              <span className="capitalize">{heir.heirRelationship}</span>
            </>
          )}
          <span className="text-muted-foreground/40">|</span>
          <span>{heir.accessLevel === "read_only" ? "Read only" : "Full access"}</span>
        </div>
      </div>
      {heir.status === "pending" && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0"
          onClick={() => deleteMutation.mutate()}
          disabled={deleteMutation.isPending}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

export default function HeirSettings({ personaId }: { personaId: number }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const queryClient = useQueryClient();

  const { data: heirs = [], isLoading } = useQuery<Heir[]>({
    queryKey: [`/api/personas/${personaId}/heirs`],
  });

  const { data: limits } = useQuery<HeirLimits>({
    queryKey: [`/api/personas/${personaId}/heirs/limits`],
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: [`/api/personas/${personaId}/heirs`] });
    queryClient.invalidateQueries({ queryKey: [`/api/personas/${personaId}/heirs/limits`] });
  };

  const atLimit = limits ? limits.remaining <= 0 : false;

  return (
    <div className="rounded-xl border border-primary/20 p-5 space-y-4 bg-primary/5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-primary" />
          <h3 className="font-display text-base font-semibold text-foreground">
            Who will inherit this Echo?
          </h3>
        </div>
        {limits && (
          <span className="text-xs text-muted-foreground">
            {limits.current}/{limits.limit} heirs
          </span>
        )}
      </div>

      <p className="text-sm text-muted-foreground leading-relaxed">
        When the time comes, these people will be able to access this Echo — to hear the voice,
        read the memories, and carry the stories forward.
      </p>

      {isLoading ? (
        <div className="space-y-2">
          <div className="h-16 bg-muted rounded-lg animate-pulse" />
        </div>
      ) : heirs.length > 0 ? (
        <div className="space-y-2">
          {heirs.map(h => (
            <HeirCard key={h.id} heir={h} personaId={personaId} onRefresh={refresh} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground/70 italic py-2">
          No heirs designated yet. Add someone you trust to carry this Echo forward.
        </p>
      )}

      {atLimit ? (
        <div className="p-3 rounded-lg bg-muted/50 text-center space-y-2">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Crown className="h-4 w-4 text-primary" />
            Heir limit reached on the {limits?.plan} plan
          </div>
          <Link href="/pricing">
            <Button size="sm" variant="outline" className="gap-1.5">Upgrade for more</Button>
          </Link>
        </div>
      ) : (
        <Button
          variant="outline"
          className="w-full gap-2 border-primary/30 text-primary hover:bg-primary/10"
          onClick={() => setShowAddModal(true)}
        >
          <UserPlus className="h-4 w-4" />
          Add an heir
        </Button>
      )}

      {showAddModal && (
        <AddHeirModal
          personaId={personaId}
          onClose={() => setShowAddModal(false)}
          onSuccess={refresh}
        />
      )}
    </div>
  );
}
