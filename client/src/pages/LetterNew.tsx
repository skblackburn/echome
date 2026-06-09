import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Send, User, Users, Mail } from "lucide-react";

interface EchoHeir {
  id: number;
  heirName: string | null;
  heirEmail: string;
  heirRelationship: string | null;
  personaId: number;
}

interface Persona {
  id: number;
  name: string;
}

export default function LetterNew() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [recipientType, setRecipientType] = useState<"self" | "heir" | "custom_email">("self");
  const [recipientHeirId, setRecipientHeirId] = useState<number | null>(null);
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [deliverAt, setDeliverAt] = useState("");

  // Fetch user's heirs across all personas
  const { data: personas = [] } = useQuery<Persona[]>({
    queryKey: ["/api/personas"],
  });

  // We'll gather heirs from all personas
  const { data: allHeirs = [] } = useQuery<EchoHeir[]>({
    queryKey: ["/api/heirs/all"],
    queryFn: async () => {
      const results: EchoHeir[] = [];
      for (const p of personas) {
        try {
          const res = await fetch(`/api/personas/${p.id}/heirs`);
          if (res.ok) {
            const heirs = await res.json();
            results.push(...heirs);
          }
        } catch {}
      }
      return results;
    },
    enabled: personas.length > 0 && recipientType === "heir",
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const body: any = {
        title,
        content,
        recipientType,
        deliverAt: new Date(deliverAt).toISOString(),
      };
      if (recipientType === "heir" && recipientHeirId) {
        body.recipientHeirId = recipientHeirId;
        const heir = allHeirs.find(h => h.id === recipientHeirId);
        if (heir) {
          body.recipientName = heir.heirName;
          body.recipientEmail = heir.heirEmail;
        }
      }
      if (recipientType === "custom_email") {
        body.recipientName = recipientName;
        body.recipientEmail = recipientEmail;
      }
      return apiRequest("POST", "/api/letters", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/letters"] });
      toast({ title: "Letter scheduled", description: "Your letter will be delivered on the chosen date." });
      navigate("/letters");
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const setPresetDate = (months: number) => {
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    setDeliverAt(d.toISOString().split("T")[0]);
  };

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split("T")[0];

  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() + 100);
  const maxDateStr = maxDate.toISOString().split("T")[0];

  const canSubmit = title.trim() && content.trim() && deliverAt
    && (recipientType === "self"
      || (recipientType === "heir" && recipientHeirId)
      || (recipientType === "custom_email" && recipientEmail.trim()));

  return (
    <Layout title="Write a Letter" backTo="/letters" backLabel="Letters">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="space-y-1">
          <h1 className="font-display text-xl font-semibold text-foreground">
            Write a Letter to the Future
          </h1>
          <p className="text-sm text-muted-foreground">
            Write your message now — it will be delivered by email and in-app notification on the date you choose.
          </p>
        </div>

        {/* Recipient picker */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Who is this letter for?</Label>
          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setRecipientType("self")}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                recipientType === "self"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40"
              }`}
            >
              <User className="h-5 w-5" />
              <span className="text-sm font-medium">Myself</span>
            </button>
            <button
              type="button"
              onClick={() => setRecipientType("heir")}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                recipientType === "heir"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40"
              }`}
            >
              <Users className="h-5 w-5" />
              <span className="text-sm font-medium">An Heir</span>
            </button>
            <button
              type="button"
              onClick={() => setRecipientType("custom_email")}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                recipientType === "custom_email"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40"
              }`}
            >
              <Mail className="h-5 w-5" />
              <span className="text-sm font-medium">Someone Else</span>
            </button>
          </div>

          {/* Heir picker */}
          {recipientType === "heir" && (
            <div className="space-y-2">
              <Label className="text-sm">Select an heir</Label>
              {allHeirs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No heirs found. Add heirs to your Echoes first.
                </p>
              ) : (
                <select
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  value={recipientHeirId ?? ""}
                  onChange={e => setRecipientHeirId(e.target.value ? parseInt(e.target.value) : null)}
                >
                  <option value="">Choose an heir...</option>
                  {allHeirs.map(h => (
                    <option key={h.id} value={h.id}>
                      {h.heirName || h.heirEmail} {h.heirRelationship ? `(${h.heirRelationship})` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Custom email fields */}
          {recipientType === "custom_email" && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Recipient's name</Label>
                <Input
                  placeholder="Their name"
                  value={recipientName}
                  onChange={e => setRecipientName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Recipient's email</Label>
                <Input
                  type="email"
                  placeholder="their@email.com"
                  value={recipientEmail}
                  onChange={e => setRecipientEmail(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Title */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Letter title</Label>
          <Input
            placeholder="e.g., A message for my 50th birthday"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
        </div>

        {/* Content */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Your message</Label>
          <Textarea
            placeholder="Write your letter here..."
            rows={10}
            value={content}
            onChange={e => setContent(e.target.value)}
            className="resize-y"
          />
        </div>

        {/* Date picker */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">When should it be delivered?</Label>
          <Input
            type="date"
            min={minDate}
            max={maxDateStr}
            value={deliverAt}
            onChange={e => setDeliverAt(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setPresetDate(6)}>
              6 months
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setPresetDate(12)}>
              1 year
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setPresetDate(60)}>
              5 years
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setPresetDate(120)}>
              10 years
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setPresetDate(216)}>
              18 years
            </Button>
          </div>
        </div>

        {/* Submit */}
        <Button
          onClick={() => createMutation.mutate()}
          disabled={!canSubmit || createMutation.isPending}
          className="w-full gap-2"
        >
          <Send className="h-4 w-4" />
          {createMutation.isPending ? "Scheduling..." : "Schedule Letter"}
        </Button>
      </div>
    </Layout>
  );
}
