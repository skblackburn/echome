import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Mail, Calendar, ChevronRight, Inbox } from "lucide-react";

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

export default function LetterInbox() {
  const { data: letters = [], isLoading } = useQuery<FutureLetter[]>({
    queryKey: ["/api/letters/inbox"],
  });

  if (isLoading) {
    return (
      <Layout title="Letter Inbox" backTo="/letters" backLabel="Letters">
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
    <Layout title="Letter Inbox" backTo="/letters" backLabel="Letters">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="space-y-1">
          <h1 className="font-display text-xl font-semibold text-foreground">
            Received Letters
          </h1>
          <p className="text-sm text-muted-foreground">
            Letters that have been delivered to you from the past.
          </p>
        </div>

        {letters.length > 0 ? (
          <div className="space-y-3">
            {letters.map(letter => (
              <Link key={letter.id} href={`/letters/${letter.id}`}>
                <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card paper-surface hover:border-primary/40 hover:bg-muted/30 transition-all cursor-pointer group">
                  <div className="p-2.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex-shrink-0">
                    <Mail className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground">{letter.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <span>Written {new Date(letter.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                      <span className="text-muted-foreground/50">·</span>
                      <Calendar className="h-3 w-3" />
                      <span>
                        Delivered {letter.deliveredAt
                          ? new Date(letter.deliveredAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                          : ""}
                      </span>
                    </div>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0">
                    Received
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 group-hover:text-primary transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <Inbox className="h-10 w-10 text-muted-foreground/40 mx-auto" />
            <p className="text-sm text-muted-foreground">No letters received yet.</p>
            <p className="text-xs text-muted-foreground/70 max-w-xs mx-auto">
              When someone sends you a letter to the future, it will appear here once delivered.
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}
