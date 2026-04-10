import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Gift, Sparkles, PenLine, Calendar, Clock, CheckCircle2, ChevronRight } from "lucide-react";
import type { Persona } from "@shared/schema";
import { cn } from "@/lib/utils";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

interface Milestone {
  id: number;
  personaId: number;
  recipientName: string;
  occasion: string;
  deliveryDate: string;
  messageType: string;
  prewrittenContent?: string;
  delivered: boolean;
  deliveredContent?: string;
}

const OCCASION_SUGGESTIONS = [
  "18th birthday", "21st birthday", "Wedding day", "First child",
  "High school graduation", "College graduation", "Retirement",
  "30th birthday", "40th birthday", "50th birthday",
  "First day of a new job", "Moving into first home",
];

export default function Milestones() {
  const { id } = useParams<{ id: string }>();
  const personaId = parseInt(id);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [recipientName, setRecipientName] = useState("");
  const [occasion, setOccasion] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [messageType, setMessageType] = useState<"ai" | "prewritten">("ai");
  const [prewrittenContent, setPrewrittenContent] = useState("");
  const [revealedId, setRevealedId] = useState<number | null>(null);
  const [revealedContent, setRevealedContent] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);

  const { data: persona } = useQuery<Persona>({
    queryKey: ["/api/personas", personaId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/personas/${personaId}`);
      return res.json();
    },
  });

  const { data: milestones = [] } = useQuery<Milestone[]>({
    queryKey: ["/api/personas", personaId, "milestones"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/personas/${personaId}/milestones`);
      return res.json();
    },
  });

  const addMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/personas/${personaId}/milestones`, {
      recipientName, occasion, deliveryDate, messageType,
      prewrittenContent: messageType === "prewritten" ? prewrittenContent : null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personas", personaId, "milestones"] });
      setShowForm(false);
      setRecipientName(""); setOccasion(""); setDeliveryDate("");
      setMessageType("ai"); setPrewrittenContent("");
      toast({ title: "Milestone saved", description: "It will be waiting when the day arrives." });
    },
    onError: () => toast({ title: "Couldn't save milestone", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/milestones/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/personas", personaId, "milestones"] }),
  });

  const revealMilestone = async (milestone: Milestone) => {
    if (revealedId === milestone.id) {
      setRevealedId(null); setRevealedContent(null); return;
    }
    setRevealing(true);
    setRevealedId(milestone.id);
    try {
      const res = await apiRequest("POST", `/api/milestones/${milestone.id}/deliver`);
      const data = await res.json() as { content: string };
      setRevealedContent(data.content);
    } catch (e) {
      toast({ title: "Couldn't generate message", variant: "destructive" });
      setRevealedId(null);
    } finally {
      setRevealing(false);
    }
  };

  const firstName = persona?.name?.split(" ")[0] || "them";
  const today = new Date().toISOString().split("T")[0];

  const upcoming = milestones.filter(m => !m.delivered && m.deliveryDate > today);
  const due = milestones.filter(m => !m.delivered && m.deliveryDate <= today);
  const delivered = milestones.filter(m => m.delivered);

  const canSubmit = recipientName.trim() && occasion.trim() && deliveryDate &&
    (messageType === "ai" || prewrittenContent.trim());

  return (
    <Layout title="Milestone Messages" backTo={`/persona/${personaId}`} backLabel={persona?.name || "Back"}>
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="space-y-1">
          <h1 className="font-display text-xl font-semibold text-foreground">
            {firstName}'s Milestone Messages
          </h1>
          <p className="text-sm text-muted-foreground">
            Messages from {firstName} that will be waiting on the most important days of life — birthdays, graduations, weddings, and more.
          </p>
        </div>

        {/* Due now banner */}
        {due.length > 0 && (
          <div className="rounded-2xl border-2 border-amber-400/50 bg-amber-50 dark:bg-amber-950/20 p-5 space-y-3">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-semibold text-sm">
              <Gift className="h-4 w-4" />
              {due.length === 1 ? "A message is waiting" : `${due.length} messages are waiting`}
            </div>
            {due.map(m => (
              <div key={m.id} className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-foreground">For {m.recipientName} — {m.occasion}</div>
                    <div className="text-xs text-muted-foreground">{m.deliveryDate}</div>
                  </div>
                  <Button size="sm" onClick={() => revealMilestone(m)} disabled={revealing && revealedId === m.id}
                    className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white">
                    {revealing && revealedId === m.id ? "Opening…" : "Open message"}
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {revealedId === m.id && revealedContent && (
                  <div className="rounded-xl bg-background/80 border border-amber-300/40 p-4 text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                    {revealedContent}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add button */}
        {!showForm && (
          <Button onClick={() => setShowForm(true)} className="gap-2 w-full" variant="outline">
            <Plus className="h-4 w-4" /> Add a milestone message
          </Button>
        )}

        {/* Add form */}
        {showForm && (
          <div className="rounded-2xl border border-border bg-card p-6 space-y-5 paper-surface">
            <h2 className="font-semibold text-foreground text-sm">New milestone message</h2>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>For who? <span className="text-destructive">*</span></Label>
                <Input placeholder="e.g., Eowyn" value={recipientName} onChange={e => setRecipientName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Deliver on <span className="text-destructive">*</span></Label>
                <Input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} min={today} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Occasion <span className="text-destructive">*</span></Label>
              <Input placeholder="e.g., 18th birthday, wedding day…" value={occasion} onChange={e => setOccasion(e.target.value)} />
              <div className="flex flex-wrap gap-1.5 mt-1">
                {OCCASION_SUGGESTIONS.slice(0, 6).map(s => (
                  <button key={s} type="button" onClick={() => setOccasion(s)}
                    className="text-xs px-2.5 py-1 rounded-full bg-muted hover:bg-secondary border border-border text-muted-foreground hover:text-foreground transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Message type */}
            <div className="space-y-2">
              <Label>Message type</Label>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setMessageType("ai")}
                  className={cn("flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all",
                    messageType === "ai" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30")}>
                  <Sparkles className={cn("h-4 w-4 mt-0.5 flex-shrink-0", messageType === "ai" ? "text-primary" : "text-muted-foreground")} />
                  <div>
                    <div className="text-xs font-semibold text-foreground">AI-generated</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{firstName} writes it on the day, drawing on everything she knows</div>
                  </div>
                </button>
                <button type="button" onClick={() => setMessageType("prewritten")}
                  className={cn("flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all",
                    messageType === "prewritten" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30")}>
                  <PenLine className={cn("h-4 w-4 mt-0.5 flex-shrink-0", messageType === "prewritten" ? "text-primary" : "text-muted-foreground")} />
                  <div>
                    <div className="text-xs font-semibold text-foreground">Pre-written</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Write the exact words now, delivered verbatim on the date</div>
                  </div>
                </button>
              </div>
            </div>

            {messageType === "prewritten" && (
              <div className="space-y-1.5">
                <Label>Message <span className="text-destructive">*</span></Label>
                <Textarea
                  placeholder={`Write ${firstName}'s message to ${recipientName || "them"} in her own voice…`}
                  value={prewrittenContent}
                  onChange={e => setPrewrittenContent(e.target.value)}
                  rows={5}
                  className="resize-none"
                />
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowForm(false)} className="flex-1">Cancel</Button>
              <Button disabled={!canSubmit || addMutation.isPending} onClick={() => addMutation.mutate()} className="flex-1 gap-1.5">
                <Gift className="h-4 w-4" />
                {addMutation.isPending ? "Saving…" : "Save milestone"}
              </Button>
            </div>
          </div>
        )}

        {/* Upcoming */}
        {upcoming.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" /> Upcoming ({upcoming.length})
            </h2>
            {upcoming.map(m => (
              <div key={m.id} className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card paper-surface">
                <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
                  {m.messageType === "ai" ? <Sparkles className="h-4 w-4 text-primary" /> : <PenLine className="h-4 w-4 text-primary" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground">For {m.recipientName} — {m.occasion}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                    <Calendar className="h-3 w-3" />
                    {new Date(m.deliveryDate + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    <Badge variant="outline" className="text-xs ml-1">{m.messageType === "ai" ? "AI will write" : "Pre-written"}</Badge>
                  </div>
                </div>
                <button onClick={() => deleteMutation.mutate(m.id)} className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Delivered */}
        {delivered.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5" /> Delivered ({delivered.length})
            </h2>
            {delivered.map(m => (
              <div key={m.id} className="space-y-2">
                <button type="button" onClick={() => revealMilestone(m)}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-border bg-card/60 hover:bg-card transition-all text-left group">
                  <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex-shrink-0">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground">For {m.recipientName} — {m.occasion}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {new Date(m.deliveryDate + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    </div>
                  </div>
                  <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", revealedId === m.id && "rotate-90")} />
                </button>
                {revealedId === m.id && (revealedContent || m.deliveredContent) && (
                  <div className="rounded-xl bg-muted/40 border border-border p-4 text-sm text-foreground leading-relaxed whitespace-pre-wrap ml-4">
                    {revealedContent || m.deliveredContent}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {milestones.length === 0 && !showForm && (
          <div className="text-center py-12 space-y-3">
            <Gift className="h-10 w-10 text-muted-foreground/40 mx-auto" />
            <p className="text-sm text-muted-foreground">No milestone messages yet.</p>
            <p className="text-xs text-muted-foreground/70 max-w-xs mx-auto">
              Create a message from {firstName} that will be waiting for someone on their wedding day, graduation, or any moment that matters.
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}
