import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Clock, Calendar, Heart, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Transfer {
  id: number;
  personaId: number;
  transferTrigger: string;
  scheduledDate: string | null;
  executedAt: string | null;
  status: string;
  createdAt: string;
}

export default function TransferSettings({
  personaId,
  personaName,
  isLiving,
  hasHeirs,
}: {
  personaId: number;
  personaName: string;
  isLiving: boolean;
  hasHeirs: boolean;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [trigger, setTrigger] = useState<"manual" | "scheduled" | "on_passing">("manual");
  const [scheduledDate, setScheduledDate] = useState("");
  const [showConfirmTransfer, setShowConfirmTransfer] = useState(false);

  const { data: transferData } = useQuery<{ transfer: Transfer | null; history: Transfer[] }>({
    queryKey: [`/api/personas/${personaId}/transfer`],
  });

  const activeTransfer = transferData?.transfer;

  const setupMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/personas/${personaId}/transfer`, {
        trigger,
        scheduledDate: trigger === "scheduled" ? scheduledDate : undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Transfer settings saved" });
      queryClient.invalidateQueries({ queryKey: [`/api/personas/${personaId}/transfer`] });
    },
    onError: (err: Error) => toast({ title: "Couldn't save", description: String(err), variant: "destructive" }),
  });

  const executeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/personas/${personaId}/transfer/execute`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Transfer complete", description: "Invitations have been sent to all heirs." });
      queryClient.invalidateQueries({ queryKey: [`/api/personas/${personaId}/transfer`] });
      queryClient.invalidateQueries({ queryKey: [`/api/personas/${personaId}/heirs`] });
      setShowConfirmTransfer(false);
    },
    onError: (err: Error) => toast({ title: "Transfer failed", description: String(err), variant: "destructive" }),
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/personas/${personaId}/transfer/cancel`);
    },
    onSuccess: () => {
      toast({ title: "Transfer cancelled" });
      queryClient.invalidateQueries({ queryKey: [`/api/personas/${personaId}/transfer`] });
    },
  });

  if (!hasHeirs) return null;

  const firstName = personaName.split(" ")[0];

  return (
    <div className="rounded-xl border border-border p-5 space-y-4 bg-muted/20">
      <div className="flex items-center gap-2">
        <Send className="h-4 w-4 text-primary" />
        <h3 className="font-display text-base font-semibold text-foreground">Transfer Settings</h3>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">
        Choose when heirs will receive access to {firstName}'s Echo.
        You'll always keep your own access.
      </p>

      {activeTransfer && activeTransfer.status === "executed" ? (
        <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/30">
          <p className="text-sm text-green-800 dark:text-green-300 flex items-center gap-2">
            <Heart className="h-4 w-4" />
            This Echo has been shared with heirs.
            {activeTransfer.executedAt && (
              <span className="text-xs text-green-600 dark:text-green-400 ml-1">
                ({new Date(activeTransfer.executedAt).toLocaleDateString()})
              </span>
            )}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <Label className="text-sm">When should heirs receive access?</Label>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setTrigger("manual")}
                className={cn(
                  "w-full px-4 py-3 rounded-lg border text-sm text-left transition-all",
                  trigger === "manual"
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/40"
                )}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <Send className="h-4 w-4 text-primary" />
                  <span className="font-medium text-foreground">I'll decide when</span>
                </div>
                <p className="text-xs text-muted-foreground ml-6">
                  Transfer manually whenever you're ready
                </p>
              </button>

              <button
                type="button"
                onClick={() => setTrigger("scheduled")}
                className={cn(
                  "w-full px-4 py-3 rounded-lg border text-sm text-left transition-all",
                  trigger === "scheduled"
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/40"
                )}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span className="font-medium text-foreground">On a specific date</span>
                </div>
                <p className="text-xs text-muted-foreground ml-6">
                  Transfer automatically on a date you choose
                </p>
              </button>

              {!isLiving && (
                <button
                  type="button"
                  onClick={() => setTrigger("on_passing")}
                  className={cn(
                    "w-full px-4 py-3 rounded-lg border text-sm text-left transition-all",
                    trigger === "on_passing"
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/40"
                  )}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <Heart className="h-4 w-4 text-rose-400" />
                    <span className="font-medium text-foreground">When I'm no longer with us</span>
                  </div>
                  <p className="text-xs text-muted-foreground ml-6">
                    Uses the passing date set on {firstName}'s profile
                  </p>
                </button>
              )}
            </div>
          </div>

          {trigger === "scheduled" && (
            <div className="space-y-1.5 ml-6">
              <Label className="text-sm">Transfer date</Label>
              <Input
                type="date"
                value={scheduledDate}
                onChange={e => setScheduledDate(e.target.value)}
                className="w-48"
                min={new Date().toISOString().split("T")[0]}
              />
            </div>
          )}

          <div className="flex gap-2">
            {(trigger === "scheduled" || trigger === "on_passing") && (
              <Button
                variant="outline"
                className="flex-1 gap-2"
                disabled={
                  setupMutation.isPending ||
                  (trigger === "scheduled" && !scheduledDate)
                }
                onClick={() => setupMutation.mutate()}
              >
                <Clock className="h-4 w-4" />
                {setupMutation.isPending ? "Saving..." : "Save schedule"}
              </Button>
            )}

            {trigger === "manual" && (
              <Button
                className="flex-1 gap-2"
                onClick={() => setShowConfirmTransfer(true)}
              >
                <Send className="h-4 w-4" />
                Transfer now
              </Button>
            )}
          </div>

          {activeTransfer && activeTransfer.status === "pending" && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30">
              <div className="text-sm text-amber-800 dark:text-amber-300">
                <Badge variant="outline" className="mr-2 border-amber-300 text-amber-700 dark:text-amber-400">
                  {activeTransfer.transferTrigger === "scheduled" ? "Scheduled" : "On passing"}
                </Badge>
                {activeTransfer.scheduledDate && `for ${new Date(activeTransfer.scheduledDate + "T12:00:00").toLocaleDateString()}`}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-amber-700 dark:text-amber-400 hover:text-destructive"
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
              >
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
            </div>
          )}
        </>
      )}

      {/* Confirm transfer modal */}
      {showConfirmTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm p-6 rounded-xl bg-background border border-border shadow-lg space-y-4">
            <h4 className="font-display text-lg font-semibold text-foreground">Share {firstName}'s Echo?</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              This will send invitations to all designated heirs, giving them access to {firstName}'s
              Echo. You'll keep your access too — nothing is taken away.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowConfirmTransfer(false)}
              >
                Not yet
              </Button>
              <Button
                className="flex-1 gap-2"
                disabled={executeMutation.isPending}
                onClick={() => executeMutation.mutate()}
              >
                <Heart className="h-4 w-4" />
                {executeMutation.isPending ? "Sharing..." : "Share now"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
