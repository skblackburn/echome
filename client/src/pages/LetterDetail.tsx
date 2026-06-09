import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Calendar, Edit2, Trash2, Save, X, Mail, Clock, CheckCircle, RotateCw, Bell } from "lucide-react";

interface FutureLetter {
  id: number;
  userId: number;
  title: string;
  content: string;
  recipientType: string;
  recipientName: string | null;
  recipientEmail: string | null;
  recipientUserId: number | null;
  recipientHeirId: number | null;
  deliverAt: string;
  deliveredAt: string | null;
  status: string;
  reminderSentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function getStatusBadge(status: string) {
  switch (status) {
    case "scheduled":
      return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-0 gap-1"><Clock className="h-3 w-3" /> Scheduled</Badge>;
    case "delivered":
      return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0 gap-1"><CheckCircle className="h-3 w-3" /> Delivered</Badge>;
    case "cancelled":
      return <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-0">Cancelled</Badge>;
    case "failed":
      return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0">Failed</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function LetterDetail() {
  const { id } = useParams<{ id: string }>();
  const letterId = parseInt(id);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editDeliverAt, setEditDeliverAt] = useState("");

  const { data: letter, isLoading } = useQuery<FutureLetter>({
    queryKey: ["/api/letters", letterId],
    enabled: !isNaN(letterId),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const body: any = {};
      if (editTitle !== letter?.title) body.title = editTitle;
      if (editContent !== letter?.content) body.content = editContent;
      if (editDeliverAt && editDeliverAt !== letter?.deliverAt?.split("T")[0]) {
        body.deliverAt = new Date(editDeliverAt).toISOString();
      }
      return apiRequest("PUT", `/api/letters/${letterId}`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/letters", letterId] });
      queryClient.invalidateQueries({ queryKey: ["/api/letters"] });
      setEditing(false);
      toast({ title: "Letter updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/letters/${letterId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/letters"] });
      toast({ title: "Letter cancelled" });
      navigate("/letters");
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const resendMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/letters/${letterId}/resend`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/letters", letterId] });
      toast({ title: "Letter resent" });
    },
    onError: (err: Error) => {
      const msg = err.message?.includes("429") || err.message?.includes("Already resent")
        ? "Already resent today — try again tomorrow"
        : err.message;
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  const startEditing = () => {
    if (!letter) return;
    setEditTitle(letter.title);
    setEditContent(letter.content);
    setEditDeliverAt(letter.deliverAt ? new Date(letter.deliverAt).toISOString().split("T")[0] : "");
    setEditing(true);
  };

  if (isLoading) {
    return (
      <Layout title="Letter" backTo="/letters" backLabel="Letters">
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </Layout>
    );
  }

  if (!letter) {
    return (
      <Layout title="Letter" backTo="/letters" backLabel="Letters">
        <div className="max-w-2xl mx-auto px-4 py-8 text-center">
          <p className="text-muted-foreground">Letter not found.</p>
        </div>
      </Layout>
    );
  }

  const recipientLabel = letter.recipientType === "self"
    ? "To myself"
    : letter.recipientName
      ? `To ${letter.recipientName}`
      : letter.recipientEmail
        ? `To ${letter.recipientEmail}`
        : "To someone";

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split("T")[0];

  return (
    <Layout title="Letter" backTo="/letters" backLabel="Letters">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {editing ? (
          /* ─── Edit mode ─── */
          <>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Title</Label>
              <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Message</Label>
              <Textarea
                rows={10}
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                className="resize-y"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Delivery date</Label>
              <Input
                type="date"
                min={minDate}
                value={editDeliverAt}
                onChange={e => setEditDeliverAt(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending} className="gap-2">
                <Save className="h-4 w-4" /> {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
              <Button variant="outline" onClick={() => setEditing(false)} className="gap-2">
                <X className="h-4 w-4" /> Cancel
              </Button>
            </div>
          </>
        ) : (
          /* ─── View mode ─── */
          <>
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-4">
                <h1 className="font-display text-xl font-semibold text-foreground">{letter.title}</h1>
                {getStatusBadge(letter.status)}
              </div>

              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" />
                  {recipientLabel}
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {letter.status === "delivered" && letter.deliveredAt
                    ? `Delivered ${new Date(letter.deliveredAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`
                    : `Scheduled for ${new Date(letter.deliverAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`
                  }
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Written on {new Date(letter.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </p>
            </div>

            {/* Letter content */}
            <div className="rounded-xl border border-border bg-card p-6 paper-surface">
              <div className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                {letter.content}
              </div>
            </div>

            {/* Reminder status for scheduled letters */}
            {letter.status === "scheduled" && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Bell className="h-3.5 w-3.5" />
                {letter.reminderSentAt
                  ? `Reminder sent on ${new Date(letter.reminderSentAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`
                  : "We'll send you a reminder one week before delivery"
                }
              </div>
            )}

            {/* Actions for scheduled letters */}
            {letter.status === "scheduled" && (
              <div className="flex gap-3">
                <Button variant="outline" onClick={startEditing} className="gap-2">
                  <Edit2 className="h-4 w-4" /> Edit
                </Button>
                <Button
                  variant="outline"
                  className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/20"
                  onClick={() => {
                    if (confirm("Are you sure you want to cancel this letter? This cannot be undone.")) {
                      cancelMutation.mutate();
                    }
                  }}
                  disabled={cancelMutation.isPending}
                >
                  <Trash2 className="h-4 w-4" /> {cancelMutation.isPending ? "Cancelling..." : "Cancel Letter"}
                </Button>
              </div>
            )}

            {/* Resend button for delivered letters */}
            {letter.status === "delivered" && (
              <div className="flex gap-3">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="gap-2" disabled={resendMutation.isPending}>
                      <RotateCw className="h-4 w-4" /> {resendMutation.isPending ? "Resending..." : "Resend Letter"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Resend this letter?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Resend this letter to {letter.recipientName || letter.recipientEmail || "the recipient"}? They'll get a new email and in-app notification.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => resendMutation.mutate()}>
                        Resend
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
