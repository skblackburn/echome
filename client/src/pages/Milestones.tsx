import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Gift, Calendar, Clock, Cake, Heart, GraduationCap,
  Star, Flower2, ChevronRight, ArrowUpRight, Lock
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

interface MilestoneLimits {
  plan: string;
  limit: number | null;
  active: number;
  remaining: number | null;
}

const OCCASION_ICONS: Record<string, React.ElementType> = {
  birthday: Cake,
  anniversary: Heart,
  graduation: GraduationCap,
  holiday: Star,
  memorial: Flower2,
  other: Gift,
};

function getOccasionIcon(occasion: string) {
  const Icon = OCCASION_ICONS[occasion] || Gift;
  return Icon;
}

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

export default function Milestones() {
  const { id } = useParams<{ id: string }>();
  const personaId = parseInt(id);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: persona } = useQuery<Persona>({
    queryKey: ["/api/personas", personaId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/personas/${personaId}`);
      return res.json();
    },
  });

  const { data: milestones = [], isLoading } = useQuery<Milestone[]>({
    queryKey: ["/api/personas", personaId, "milestones"],
  });

  const { data: limits } = useQuery<MilestoneLimits>({
    queryKey: ["/api/milestones/limits"],
  });

  const firstName = persona?.name?.split(" ")[0] || "them";
  const today = new Date().toISOString().split("T")[0];

  const scheduled = milestones.filter(m => m.status === "scheduled");
  const delivered = milestones.filter(m => m.status === "delivered");
  const failed = milestones.filter(m => m.status === "failed");

  const atLimit = limits && limits.limit !== null && limits.active >= limits.limit;

  if (isLoading) {
    return (
      <Layout title="Milestone Messages" backTo={`/persona/${personaId}`} backLabel={persona?.name || "Back"}>
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-80" />
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Milestone Messages" backTo={`/persona/${personaId}`} backLabel={persona?.name || "Back"}>
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="space-y-1">
          <h1 className="font-display text-xl font-semibold text-foreground">
            {firstName}'s Milestone Messages
          </h1>
          <p className="text-sm text-muted-foreground">
            Messages from {firstName} that will be waiting on the most important days — birthdays, graduations, weddings, and more.
          </p>
        </div>

        {/* Usage bar */}
        {limits && (
          <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4 paper-surface">
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{limits.active}</span>
              {limits.limit !== null ? (
                <> of <span className="font-medium text-foreground">{limits.limit}</span> milestones used</>
              ) : (
                <> active milestone{limits.active !== 1 ? "s" : ""} <span className="text-xs">(unlimited)</span></>
              )}
            </div>
            <Badge variant="outline" className="capitalize text-xs">{limits.plan} plan</Badge>
          </div>
        )}

        {/* Create button */}
        {atLimit ? (
          <div className="rounded-xl border border-amber-300/50 bg-amber-50 dark:bg-amber-950/20 p-4 flex items-center gap-3">
            <Lock className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <div className="flex-1">
              <div className="text-sm font-medium text-amber-700 dark:text-amber-400">
                Milestone limit reached
              </div>
              <p className="text-xs text-amber-600/80 dark:text-amber-400/70 mt-0.5">
                Upgrade your plan to create more milestone messages.
              </p>
            </div>
            <Link href="/pricing">
              <Button size="sm" variant="outline" className="gap-1.5">
                Upgrade <ArrowUpRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        ) : (
          <Button
            onClick={() => navigate(`/persona/${personaId}/milestones/new`)}
            className="gap-2 w-full"
            variant="outline"
          >
            <Plus className="h-4 w-4" /> Create Milestone Message
          </Button>
        )}

        {/* Scheduled milestones */}
        {scheduled.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" /> Scheduled ({scheduled.length})
            </h2>
            {scheduled.map(m => {
              const OccasionIcon = getOccasionIcon(m.occasion);
              return (
                <Link key={m.id} href={`/persona/${personaId}/milestones/${m.id}`}>
                  <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card paper-surface hover:border-primary/40 hover:bg-muted/30 transition-all cursor-pointer group">
                    <div className="p-2.5 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex-shrink-0">
                      <OccasionIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground">{m.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <span>For {m.recipientName}</span>
                        <span className="text-muted-foreground/50">·</span>
                        <Calendar className="h-3 w-3" />
                        {new Date(m.scheduledDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        {m.isRecurring && (
                          <>
                            <span className="text-muted-foreground/50">·</span>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">Recurring</Badge>
                          </>
                        )}
                      </div>
                    </div>
                    {getStatusBadge(m.status)}
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 group-hover:text-primary transition-colors" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Delivered milestones */}
        {delivered.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              <Gift className="h-3.5 w-3.5" /> Delivered ({delivered.length})
            </h2>
            {delivered.map(m => {
              const OccasionIcon = getOccasionIcon(m.occasion);
              return (
                <Link key={m.id} href={`/persona/${personaId}/milestones/${m.id}`}>
                  <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card/60 hover:bg-card transition-all cursor-pointer group">
                    <div className="p-2.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex-shrink-0">
                      <OccasionIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground">{m.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        For {m.recipientName} · {m.deliveredAt
                          ? new Date(m.deliveredAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                          : m.scheduledDate}
                      </div>
                    </div>
                    {getStatusBadge(m.status)}
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Failed milestones */}
        {failed.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              Failed ({failed.length})
            </h2>
            {failed.map(m => {
              const OccasionIcon = getOccasionIcon(m.occasion);
              return (
                <Link key={m.id} href={`/persona/${personaId}/milestones/${m.id}`}>
                  <div className="flex items-center gap-4 p-4 rounded-xl border border-red-200/50 bg-red-50/50 dark:bg-red-950/10 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all cursor-pointer group">
                    <div className="p-2.5 rounded-lg bg-red-100 dark:bg-red-900/30 flex-shrink-0">
                      <OccasionIcon className="h-4 w-4 text-red-600 dark:text-red-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground">{m.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">For {m.recipientName}</div>
                    </div>
                    {getStatusBadge(m.status)}
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {milestones.length === 0 && (
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
