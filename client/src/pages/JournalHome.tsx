import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen, PenLine, Flame, Search, X, Sparkles, ChevronRight, Mic,
} from "lucide-react";
import type { JournalEntry } from "@shared/schema";

const WRITING_PROMPTS = [
  "What's on your mind today?",
  "What are you grateful for?",
  "What did you learn this week?",
  "What do you want to remember about today?",
  "How are you really feeling?",
];

const MOOD_COLORS: Record<string, string> = {
  grateful: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  reflective: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  anxious: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  joyful: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  tired: "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300",
  hopeful: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  sad: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  excited: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
  peaceful: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
};

interface JournalListResponse {
  entries: JournalEntry[];
  pagination: { limit: number; offset: number; total: number; hasMore: boolean };
}

interface JournalStats {
  total: number;
  streak: number;
  reflectionsThisMonth: number;
  thisWeek: number;
  thisMonth: number;
}

function groupByMonth(entries: JournalEntry[]): [string, JournalEntry[]][] {
  const groups: Record<string, JournalEntry[]> = {};
  entries.forEach(e => {
    const d = new Date(e.entryDate + "T00:00:00");
    const key = d.toLocaleDateString("en-US", { year: "numeric", month: "long" });
    if (!groups[key]) groups[key] = [];
    groups[key].push(e);
  });
  return Object.entries(groups);
}

export default function JournalHome() {
  const [searchQuery, setSearchQuery] = useState("");
  const [dismissedPrompts, setDismissedPrompts] = useState(false);
  const [offset, setOffset] = useState(0);

  const { data: listData, isLoading } = useQuery<JournalListResponse>({
    queryKey: ["/api/journal", `?limit=100&offset=${offset}`],
    queryFn: async () => {
      const res = await fetch(`/api/journal?limit=100&offset=${offset}`);
      if (!res.ok) throw new Error("Failed to load entries");
      return res.json();
    },
  });

  const { data: stats } = useQuery<JournalStats>({
    queryKey: ["/api/journal/stats"],
  });

  const entries = listData?.entries || [];
  const total = listData?.pagination?.total || 0;
  const isFirstVisit = total === 0 && !isLoading;

  const filtered = searchQuery.trim()
    ? entries.filter(e =>
        e.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (e.title || "").toLowerCase().includes(searchQuery.toLowerCase())
      )
    : entries;
  const grouped = groupByMonth(filtered);

  const today = new Date().toISOString().split("T")[0];
  const todayEntry = entries.find(e => e.entryDate === today);

  const todayFormatted = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // First visit onboarding
  if (isFirstVisit) {
    return (
      <Layout backTo="/" backLabel="Home" title="Journal">
        <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-[#d4a0a0]/20 flex items-center justify-center mx-auto">
            <BookOpen className="h-8 w-8 text-[#c48585]" />
          </div>
          <h1 className="font-display text-2xl font-semibold text-foreground">
            Your Journal
          </h1>
          <p className="text-muted-foreground text-base max-w-sm mx-auto leading-relaxed">
            This is your private journal. Write freely — nobody else will see this. And if you'd like, you can let your entries shape your Echo over time.
          </p>
          <div className="space-y-3 text-sm text-muted-foreground/80">
            {WRITING_PROMPTS.slice(0, 3).map(prompt => (
              <div key={prompt} className="flex items-center gap-2 justify-center">
                <Sparkles className="h-3.5 w-3.5 text-[#c48585]" />
                <span>{prompt}</span>
              </div>
            ))}
          </div>
          <Link href="/journal/new">
            <Button size="lg" className="mt-4 bg-[#c48585] hover:bg-[#b57575] text-white gap-2">
              <PenLine className="h-4 w-4" />
              Write your first entry
            </Button>
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout backTo="/" backLabel="Home" title="Journal">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="font-display text-xl font-semibold text-foreground">Your Journal</h1>
          <p className="text-sm text-muted-foreground">{todayFormatted}</p>
          {stats && stats.streak > 0 && (
            <div className="flex items-center gap-1.5 text-sm text-[#c48585]">
              <Flame className="h-4 w-4" />
              <span>You've journaled {stats.streak} day{stats.streak !== 1 ? "s" : ""} in a row</span>
            </div>
          )}
        </div>

        {/* CTA */}
        <Link href={todayEntry ? `/journal/${todayEntry.id}/edit` : "/journal/new"}>
          <Button size="lg" className="w-full bg-[#c48585] hover:bg-[#b57575] text-white gap-2 h-12">
            <PenLine className="h-4 w-4" />
            {todayEntry ? "Continue today's entry" : "Write today's entry"}
          </Button>
        </Link>

        {/* Writing prompts */}
        {!dismissedPrompts && !todayEntry && (
          <div className="rounded-xl border border-border bg-card p-4 paper-surface space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Writing prompts</span>
              <button onClick={() => setDismissedPrompts(true)} className="text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="space-y-1.5">
              {WRITING_PROMPTS.map(prompt => (
                <Link key={prompt} href={`/journal/new?prompt=${encodeURIComponent(prompt)}`}>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground cursor-pointer py-1 transition-colors">
                    <Sparkles className="h-3 w-3 text-[#c48585] flex-shrink-0" />
                    <span>{prompt}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        {stats && stats.total > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-border bg-card p-3 paper-surface text-center">
              <div className="text-xl font-display font-bold text-foreground">{stats.total}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">entries</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-3 paper-surface text-center">
              <div className="text-xl font-display font-bold text-foreground">{stats.streak}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">day streak</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-3 paper-surface text-center">
              <div className="text-xl font-display font-bold text-foreground">{stats.reflectionsThisMonth}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">reflections</div>
            </div>
          </div>
        )}

        {/* Search */}
        {entries.length > 0 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search entries…"
              className="pl-9 pr-9 text-sm"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Timeline */}
        {grouped.length > 0 ? (
          <div className="space-y-6">
            {grouped.map(([month, monthEntries]) => (
              <div key={month} className="space-y-2">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
                  {month}
                </h3>
                <div className="space-y-2">
                  {monthEntries.map(entry => {
                    const dateObj = new Date(entry.entryDate + "T00:00:00");
                    const dayName = dateObj.toLocaleDateString("en-US", { weekday: "short" });
                    const dayNum = dateObj.getDate();

                    return (
                      <Link key={entry.id} href={`/journal/${entry.id}`}>
                        <div className="rounded-xl border border-border bg-card p-4 paper-surface hover:shadow-sm transition-all cursor-pointer group">
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-10 text-center">
                              <div className="text-[10px] text-muted-foreground uppercase">{dayName}</div>
                              <div className="text-lg font-display font-bold text-foreground">{dayNum}</div>
                            </div>
                            <div className="flex-1 min-w-0">
                              {entry.title && (
                                <div className="font-medium text-sm text-foreground mb-0.5">{entry.title}</div>
                              )}
                              <div className="text-sm text-muted-foreground line-clamp-2">
                                {entry.content.slice(0, 150)}{entry.content.length > 150 ? "…" : ""}
                              </div>
                              <div className="flex items-center gap-2 mt-2 flex-wrap">
                                {(entry as any).entryType === "voice" && (
                                  <Badge variant="secondary" className="text-[10px] px-2 py-0 gap-1 bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300">
                                    <Mic className="h-2.5 w-2.5" /> Voice
                                  </Badge>
                                )}
                                {entry.mood && (
                                  <Badge variant="secondary" className={`text-[10px] px-2 py-0 ${MOOD_COLORS[entry.mood] || ""}`}>
                                    {entry.mood}
                                  </Badge>
                                )}
                                {entry.includedInEcho && (
                                  <Badge variant="outline" className="text-[10px] px-2 py-0 gap-1">
                                    <Sparkles className="h-2.5 w-2.5" /> In Echo
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors flex-shrink-0 mt-1" />
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : entries.length > 0 && searchQuery ? (
          <div className="text-center py-10">
            <p className="text-sm text-muted-foreground">No entries match your search.</p>
          </div>
        ) : null}

        {/* Load more */}
        {listData?.pagination?.hasMore && (
          <div className="text-center">
            <Button variant="outline" size="sm" onClick={() => setOffset(o => o + 100)}>
              Load more entries
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
}
