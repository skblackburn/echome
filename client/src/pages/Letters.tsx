import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus, Mail, Calendar, Clock, ChevronRight, Inbox, Send,
} from "lucide-react";

interface FutureLetter {
  id: number;
  userId: number;
  title: string;
  content: string;
  recipientType: string;
  recipientName: string | null;
  recipientEmail: string | null;
  deliverAt: string;
  deliveredAt: string | null;
  status: string;
  createdAt: string;
}

function getStatusBadge(status: string) {
  switch (status) {
    case "scheduled":
      return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-0">Scheduled</Badge>;
    case "delivered":
      return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0">Delivered</Badge>;
    case "cancelled":
      return <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-0">Cancelled</Badge>;
    case "failed":
      return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0">Failed</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function getRecipientLabel(letter: FutureLetter) {
  if (letter.recipientType === "self") return "To myself";
  if (letter.recipientName) return `To ${letter.recipientName}`;
  if (letter.recipientEmail) return `To ${letter.recipientEmail}`;
  return "To someone";
}

export default function Letters() {
  const [, navigate] = useLocation();

  const { data: letters = [], isLoading } = useQuery<FutureLetter[]>({
    queryKey: ["/api/letters"],
  });

  const scheduled = letters.filter(l => l.status === "scheduled");
  const delivered = letters.filter(l => l.status === "delivered");
  const cancelled = letters.filter(l => l.status === "cancelled");
  const failed = letters.filter(l => l.status === "failed");

  if (isLoading) {
    return (
      <Layout title="Letters to the Future" backTo="/" backLabel="Home">
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
    <Layout title="Letters to the Future" backTo="/" backLabel="Home">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="font-display text-xl font-semibold text-foreground">
            Letters to the Future
          </h1>
          <p className="text-sm text-muted-foreground">
            Write a message today and schedule it for delivery on a future date — to yourself, an heir, or anyone you choose.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <Button
            onClick={() => navigate("/letters/new")}
            className="gap-2 flex-1"
            variant="outline"
          >
            <Plus className="h-4 w-4" /> Write a New Letter
          </Button>
          <Link href="/letters/inbox">
            <Button variant="outline" className="gap-2">
              <Inbox className="h-4 w-4" /> Inbox
            </Button>
          </Link>
        </div>

        {/* Scheduled letters */}
        {scheduled.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" /> Scheduled ({scheduled.length})
            </h2>
            {scheduled.map(letter => (
              <Link key={letter.id} href={`/letters/${letter.id}`}>
                <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card paper-surface hover:border-primary/40 hover:bg-muted/30 transition-all cursor-pointer group">
                  <div className="p-2.5 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex-shrink-0">
                    <Send className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground">{letter.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <span>{getRecipientLabel(letter)}</span>
                      <span className="text-muted-foreground/50">·</span>
                      <Calendar className="h-3 w-3" />
                      {new Date(letter.deliverAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </div>
                  </div>
                  {getStatusBadge(letter.status)}
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 group-hover:text-primary transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Delivered letters */}
        {delivered.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              <Mail className="h-3.5 w-3.5" /> Delivered ({delivered.length})
            </h2>
            {delivered.map(letter => (
              <Link key={letter.id} href={`/letters/${letter.id}`}>
                <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card/60 hover:bg-card transition-all cursor-pointer group">
                  <div className="p-2.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex-shrink-0">
                    <Mail className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground">{letter.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {getRecipientLabel(letter)} · Delivered {letter.deliveredAt
                        ? new Date(letter.deliveredAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                        : ""}
                    </div>
                  </div>
                  {getStatusBadge(letter.status)}
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Cancelled letters */}
        {cancelled.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              Cancelled ({cancelled.length})
            </h2>
            {cancelled.map(letter => (
              <Link key={letter.id} href={`/letters/${letter.id}`}>
                <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card/60 opacity-60 hover:opacity-80 transition-all cursor-pointer group">
                  <div className="p-2.5 rounded-lg bg-gray-100 dark:bg-gray-800 flex-shrink-0">
                    <Mail className="h-4 w-4 text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground">{letter.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{getRecipientLabel(letter)}</div>
                  </div>
                  {getStatusBadge(letter.status)}
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Failed letters */}
        {failed.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              Failed ({failed.length})
            </h2>
            {failed.map(letter => (
              <Link key={letter.id} href={`/letters/${letter.id}`}>
                <div className="flex items-center gap-4 p-4 rounded-xl border border-red-200/50 bg-red-50/50 dark:bg-red-950/10 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all cursor-pointer group">
                  <div className="p-2.5 rounded-lg bg-red-100 dark:bg-red-900/30 flex-shrink-0">
                    <Mail className="h-4 w-4 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground">{letter.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{getRecipientLabel(letter)}</div>
                  </div>
                  {getStatusBadge(letter.status)}
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Empty state */}
        {letters.length === 0 && (
          <div className="text-center py-12 space-y-3">
            <Mail className="h-10 w-10 text-muted-foreground/40 mx-auto" />
            <p className="text-sm text-muted-foreground">No letters yet.</p>
            <p className="text-xs text-muted-foreground/70 max-w-xs mx-auto">
              Write a letter to your future self, a loved one, or an heir — and choose when it arrives.
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}
