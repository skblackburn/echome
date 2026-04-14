import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Gift, Cake, Heart, GraduationCap, Star, Flower2 } from "lucide-react";
import type { Persona } from "@shared/schema";
import { cn } from "@/lib/utils";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

const OCCASIONS = [
  { value: "birthday", label: "Birthday", icon: Cake },
  { value: "anniversary", label: "Anniversary", icon: Heart },
  { value: "graduation", label: "Graduation", icon: GraduationCap },
  { value: "holiday", label: "Holiday", icon: Star },
  { value: "memorial", label: "Memorial", icon: Flower2 },
  { value: "other", label: "Other", icon: Gift },
];

export default function CreateMilestone() {
  const { id } = useParams<{ id: string }>();
  const personaId = parseInt(id);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [occasion, setOccasion] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [messagePrompt, setMessagePrompt] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);

  const { data: persona } = useQuery<Persona>({
    queryKey: ["/api/personas", personaId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/personas/${personaId}`);
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/personas/${personaId}/milestones`, {
        title,
        occasion,
        recipientName,
        recipientEmail: recipientEmail || null,
        messagePrompt: messagePrompt || null,
        scheduledDate,
        isRecurring,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personas", personaId, "milestones"] });
      queryClient.invalidateQueries({ queryKey: ["/api/milestones/limits"] });
      toast({ title: "Milestone created", description: "It will be waiting when the day arrives." });
      navigate(`/persona/${personaId}/milestones`);
    },
    onError: (err: Error) => {
      if (err.message.includes("403")) {
        toast({
          title: "Milestone limit reached",
          description: "Upgrade your plan to create more milestone messages.",
          variant: "destructive",
        });
      } else {
        toast({ title: "Couldn't create milestone", variant: "destructive" });
      }
    },
  });

  const firstName = persona?.name?.split(" ")[0] || "them";
  const today = new Date().toISOString().split("T")[0];

  const canSubmit = title.trim() && occasion && recipientName.trim() && scheduledDate;

  return (
    <Layout
      title="Create Milestone"
      backTo={`/persona/${personaId}/milestones`}
      backLabel="Milestones"
    >
      <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="font-display text-xl font-semibold text-foreground">
            New Milestone Message
          </h1>
          <p className="text-sm text-muted-foreground">
            Create a message from {firstName} for a special occasion. It will be generated in {firstName}'s voice when the day arrives.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 space-y-5 paper-surface">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="title">What's the occasion? <span className="text-destructive">*</span></Label>
            <Input
              id="title"
              placeholder="e.g., Mom's 60th Birthday, Wedding Anniversary"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>

          {/* Occasion type */}
          <div className="space-y-1.5">
            <Label>Occasion type <span className="text-destructive">*</span></Label>
            <Select value={occasion} onValueChange={setOccasion}>
              <SelectTrigger>
                <SelectValue placeholder="Select occasion type" />
              </SelectTrigger>
              <SelectContent>
                {OCCASIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>
                    <span className="flex items-center gap-2">
                      <o.icon className="h-4 w-4" />
                      {o.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Recipient */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="recipientName">Recipient name <span className="text-destructive">*</span></Label>
              <Input
                id="recipientName"
                placeholder="e.g., Sarah"
                value={recipientName}
                onChange={e => setRecipientName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="recipientEmail">Recipient email</Label>
              <Input
                id="recipientEmail"
                type="email"
                placeholder="sarah@example.com"
                value={recipientEmail}
                onChange={e => setRecipientEmail(e.target.value)}
              />
            </div>
          </div>

          {/* Scheduled date */}
          <div className="space-y-1.5">
            <Label htmlFor="scheduledDate">Scheduled date <span className="text-destructive">*</span></Label>
            <Input
              id="scheduledDate"
              type="date"
              value={scheduledDate}
              onChange={e => setScheduledDate(e.target.value)}
              min={today}
            />
          </div>

          {/* Additional context */}
          <div className="space-y-1.5">
            <Label htmlFor="messagePrompt">Any details to include? <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Textarea
              id="messagePrompt"
              placeholder="e.g., She just got into her dream college, mention how proud you are of her journey..."
              value={messagePrompt}
              onChange={e => setMessagePrompt(e.target.value)}
              rows={3}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              This context helps {firstName}'s message feel more personal and specific.
            </p>
          </div>

          {/* Recurring toggle */}
          <div className="flex items-center justify-between rounded-xl border border-border p-4 bg-muted/30">
            <div>
              <div className="text-sm font-medium text-foreground">Repeat every year?</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Automatically create a new milestone for the same date next year after delivery.
              </div>
            </div>
            <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => navigate(`/persona/${personaId}/milestones`)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              disabled={!canSubmit || createMutation.isPending}
              onClick={() => createMutation.mutate()}
              className="flex-1 gap-1.5"
            >
              <Gift className="h-4 w-4" />
              {createMutation.isPending ? "Creating..." : "Create Milestone"}
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
