import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Gift, Cake, Heart, GraduationCap, Star, Flower2,
  Calendar, Sparkles, RefreshCw, Pencil, Trash2, AlertTriangle,
  Mail, Clock, RotateCw
} from "lucide-react";
import type { Persona } from "@shared/schema";
import { cn } from "@/lib/utils";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

interface Milestone {
  id: number;
  personaId: number;
  userId: number | null;
  title: string;
  occasion: string;
  recipientName: string;
  recipientEmail: string | null;
  messagePrompt: string | null;
  generatedMessage: string | null;
  scheduledDate: string;
  scheduledTime: string;
  timezone: string | null;
  isRecurring: boolean | null;
  status: string;
  deliveredAt: string | null;
  createdAt: string;
}

const OCCASION_ICONS: Record<string, React.ElementType> = {
  birthday: Cake,
  anniversary: Heart,
  graduation: GraduationCap,
  holiday: Star,
  memorial: Flower2,
  other: Gift,
};

const OCCASIONS = [
  { value: "birthday", label: "Birthday", icon: Cake },
  { value: "anniversary", label: "Anniversary", icon: Heart },
  { value: "graduation", label: "Graduation", icon: GraduationCap },
  { value: "holiday", label: "Holiday", icon: Star },
  { value: "memorial", label: "Memorial", icon: Flower2 },
  { value: "other", label: "Other", icon: Gift },
];

function getStatusBadge(status: string) {
  switch (status) {
    case "scheduled":
      return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-0">Scheduled</Badge>;
    case "generating":
      return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0">Generating</Badge>;
    case "delivered":
      return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0">Delivered</Badge>;
    case "failed":
      return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0">Failed</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function MilestoneDetail() {
  const { id, milestoneId: milestoneIdParam } = useParams<{ id: string; milestoneId: string }>();
  const personaId = parseInt(id);
  const milestoneId = parseInt(milestoneIdParam);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Edit form state
  const [editTitle, setEditTitle] = useState("");
  const [editOccasion, setEditOccasion] = useState("");
  const [editRecipientName, setEditRecipientName] = useState("");
  const [editRecipientEmail, setEditRecipientEmail] = useState("");
  const [editScheduledDate, setEditScheduledDate] = useState("");
  const [editMessagePrompt, setEditMessagePrompt] = useState("");
  const [editIsRecurring, setEditIsRecurring] = useState(false);

  const { data: persona } = useQuery<Persona>({
    queryKey: ["/api/personas", personaId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/personas/${personaId}`);
      return res.json();
    },
  });

  const { data: milestone, isLoading } = useQuery<Milestone>({
    queryKey: ["/api/personas", personaId, "milestones", milestoneId],
    queryFn: async () => {
      // Get from the list (single milestone endpoint not needed)
      const res = await fetch(`${API_BASE}/api/personas/${personaId}/milestones`);
      const milestones: Milestone[] = await res.json();
      return milestones.find(m => m.id === milestoneId);
    },
  });

  const previewMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/milestones/${milestoneId}/preview`),
    onSuccess: async (res) => {
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/personas", personaId, "milestones", milestoneId] });
      queryClient.invalidateQueries({ queryKey: ["/api/personas", personaId, "milestones"] });
      toast({ title: "Message generated", description: "Preview is ready." });
    },
    onError: () => toast({ title: "Couldn't generate message", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      apiRequest("PUT", `/api/personas/${personaId}/milestones/${milestoneId}`, {
        title: editTitle,
        occasion: editOccasion,
        recipientName: editRecipientName,
        recipientEmail: editRecipientEmail || null,
        messagePrompt: editMessagePrompt || null,
        scheduledDate: editScheduledDate,
        isRecurring: editIsRecurring,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personas", personaId, "milestones"] });
      queryClient.invalidateQueries({ queryKey: ["/api/personas", personaId, "milestones", milestoneId] });
      setEditing(false);
      toast({ title: "Milestone updated" });
    },
    onError: () => toast({ title: "Couldn't update milestone", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/personas/${personaId}/milestones/${milestoneId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personas", personaId, "milestones"] });
      queryClient.invalidateQueries({ queryKey: ["/api/milestones/limits"] });
      toast({ title: "Milestone deleted" });
      navigate(`/persona/${personaId}/milestones`);
    },
    onError: () => toast({ title: "Couldn't delete milestone", variant: "destructive" }),
  });

  const startEditing = () => {
    if (!milestone) return;
    setEditTitle(milestone.title);
    setEditOccasion(milestone.occasion);
    setEditRecipientName(milestone.recipientName);
    setEditRecipientEmail(milestone.recipientEmail || "");
    setEditScheduledDate(milestone.scheduledDate);
    setEditMessagePrompt(milestone.messagePrompt || "");
    setEditIsRecurring(milestone.isRecurring || false);
    setEditing(true);
  };

  const firstName = persona?.name?.split(" ")[0] || "them";
  const OccasionIcon = milestone ? (OCCASION_ICONS[milestone.occasion] || Gift) : Gift;

  if (isLoading) {
    return (
      <Layout title="Milestone" backTo={`/persona/${personaId}/milestones`} backLabel="Milestones">
        <div className="max-w-xl mx-auto px-4 py-8 space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </Layout>
    );
  }

  if (!milestone) {
    return (
      <Layout title="Milestone" backTo={`/persona/${personaId}/milestones`} backLabel="Milestones">
        <div className="max-w-xl mx-auto px-4 py-8">
          <p className="text-muted-foreground">Milestone not found.</p>
        </div>
      </Layout>
    );
  }

  const today = new Date().toISOString().split("T")[0];
  const isEditable = milestone.status === "scheduled";

  return (
    <Layout title="Milestone Detail" backTo={`/persona/${personaId}/milestones`} backLabel="Milestones">
      <div className="max-w-xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-start gap-4">
          <div className={cn(
            "p-3 rounded-xl flex-shrink-0",
            milestone.status === "delivered" ? "bg-emerald-100 dark:bg-emerald-900/30" :
            milestone.status === "failed" ? "bg-red-100 dark:bg-red-900/30" :
            "bg-blue-100 dark:bg-blue-900/30"
          )}>
            <OccasionIcon className={cn(
              "h-5 w-5",
              milestone.status === "delivered" ? "text-emerald-600 dark:text-emerald-400" :
              milestone.status === "failed" ? "text-red-600 dark:text-red-400" :
              "text-blue-600 dark:text-blue-400"
            )} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display text-xl font-semibold text-foreground">{milestone.title}</h1>
              {getStatusBadge(milestone.status)}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              A message from {firstName} for {milestone.recipientName}
            </p>
          </div>
        </div>

        {/* Details card */}
        {!editing && (
          <div className="rounded-xl border border-border bg-card p-5 space-y-4 paper-surface">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Occasion</div>
                <div className="text-sm text-foreground capitalize">{milestone.occasion}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Recipient</div>
                <div className="text-sm text-foreground">{milestone.recipientName}</div>
                {milestone.recipientEmail && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Mail className="h-3 w-3" /> {milestone.recipientEmail}
                  </div>
                )}
              </div>
              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Scheduled Date</div>
                <div className="text-sm text-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  {new Date(milestone.scheduledDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Recurring</div>
                <div className="text-sm text-foreground flex items-center gap-1.5">
                  {milestone.isRecurring ? (
                    <><RotateCw className="h-3.5 w-3.5 text-muted-foreground" /> Repeats annually</>
                  ) : (
                    "One-time"
                  )}
                </div>
              </div>
            </div>

            {milestone.messagePrompt && (
              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Additional Context</div>
                <div className="text-sm text-foreground bg-muted/50 rounded-lg p-3">{milestone.messagePrompt}</div>
              </div>
            )}

            {milestone.deliveredAt && (
              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Delivered</div>
                <div className="text-sm text-foreground flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  {new Date(milestone.deliveredAt).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Edit form */}
        {editing && (
          <div className="rounded-2xl border border-border bg-card p-6 space-y-5 paper-surface">
            <h2 className="font-semibold text-foreground text-sm">Edit Milestone</h2>

            <div className="space-y-1.5">
              <Label>Title <span className="text-destructive">*</span></Label>
              <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label>Occasion type <span className="text-destructive">*</span></Label>
              <Select value={editOccasion} onValueChange={setEditOccasion}>
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

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Recipient name <span className="text-destructive">*</span></Label>
                <Input value={editRecipientName} onChange={e => setEditRecipientName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Recipient email</Label>
                <Input type="email" value={editRecipientEmail} onChange={e => setEditRecipientEmail(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Scheduled date <span className="text-destructive">*</span></Label>
              <Input type="date" value={editScheduledDate} onChange={e => setEditScheduledDate(e.target.value)} min={today} />
            </div>

            <div className="space-y-1.5">
              <Label>Additional context</Label>
              <Textarea value={editMessagePrompt} onChange={e => setEditMessagePrompt(e.target.value)} rows={3} className="resize-none" />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border p-4 bg-muted/30">
              <div>
                <div className="text-sm font-medium text-foreground">Repeat every year?</div>
              </div>
              <Switch checked={editIsRecurring} onCheckedChange={setEditIsRecurring} />
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setEditing(false)} className="flex-1">Cancel</Button>
              <Button
                disabled={!editTitle.trim() || !editOccasion || !editRecipientName.trim() || !editScheduledDate || updateMutation.isPending}
                onClick={() => updateMutation.mutate()}
                className="flex-1"
              >
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        )}

        {/* Generated message preview */}
        {milestone.generatedMessage && (
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {milestone.status === "delivered" ? "Delivered Message" : "Message Preview"}
            </div>
            <div className="rounded-xl border border-border bg-card p-5 paper-surface">
              <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {milestone.generatedMessage}
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        {!editing && (
          <div className="space-y-3">
            {/* Preview / Regenerate */}
            {isEditable && (
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 gap-1.5"
                  onClick={() => previewMutation.mutate()}
                  disabled={previewMutation.isPending}
                >
                  {milestone.generatedMessage ? (
                    <><RefreshCw className={cn("h-4 w-4", previewMutation.isPending && "animate-spin")} /> {previewMutation.isPending ? "Generating..." : "Regenerate"}</>
                  ) : (
                    <><Sparkles className="h-4 w-4" /> {previewMutation.isPending ? "Generating..." : "Preview Message"}</>
                  )}
                </Button>
              </div>
            )}

            {/* Edit / Delete */}
            <div className="flex gap-3">
              {isEditable && (
                <Button variant="outline" className="flex-1 gap-1.5" onClick={startEditing}>
                  <Pencil className="h-4 w-4" /> Edit
                </Button>
              )}
              <Button
                variant="outline"
                className="flex-1 gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/5"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            </div>
          </div>
        )}

        {/* Delete confirmation */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Delete this milestone?
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{milestone.title}"? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete Milestone"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
