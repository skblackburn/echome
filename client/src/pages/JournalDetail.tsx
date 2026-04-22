import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  PenLine, Trash2, Sparkles, MessageSquareQuote, BookOpen, Mic, RotateCcw, Loader2,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import type { JournalEntry } from "@shared/schema";

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

export default function JournalDetail() {
  const { id } = useParams<{ id: string }>();
  const entryId = parseInt(id);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: entry, isLoading } = useQuery<JournalEntry>({
    queryKey: ["/api/journal", entryId],
    queryFn: async () => {
      const res = await fetch(`/api/journal/${entryId}`);
      if (!res.ok) throw new Error("Failed to load entry");
      return res.json();
    },
    refetchInterval: (query) => {
      const data = query.state.data as any;
      if (data?.transcriptionStatus === "pending") return 3000;
      return false;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => { await apiRequest("DELETE", `/api/journal/${entryId}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal"] });
      queryClient.invalidateQueries({ queryKey: ["/api/journal/stats"] });
      toast({ title: "Deleted", description: "Journal entry deleted." });
      navigate("/journal");
    },
  });

  const retranscribeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/journal/${entryId}/retranscribe`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal", entryId] });
      toast({ title: "Retranscribing", description: "Transcription restarted." });
    },
    onError: (err: Error) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  if (isLoading) {
    return (
      <Layout backTo="/journal" backLabel="Journal" title="Entry">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-muted rounded w-1/3" />
            <div className="h-4 bg-muted rounded w-full" />
            <div className="h-4 bg-muted rounded w-5/6" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!entry) {
    return (
      <Layout backTo="/journal" backLabel="Journal" title="Entry">
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <BookOpen className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground">Entry not found.</p>
        </div>
      </Layout>
    );
  }

  const dateObj = new Date(entry.entryDate + "T00:00:00");
  const formattedDate = dateObj.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const isVoice = (entry as any).entryType === "voice";
  const transcriptionStatus = (entry as any).transcriptionStatus as string | undefined;

  let reflections: { question: string; timestamp: string }[] = [];
  if (entry.aiReflections) { try { reflections = JSON.parse(entry.aiReflections); } catch {} }

  return (
    <Layout backTo="/journal" backLabel="Journal" title="Entry" actions={<Link href={`/journal/${entryId}/edit`}><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground"><PenLine className="h-3.5 w-3.5" /></Button></Link>}>
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">{formattedDate}</div>
          {entry.title && <h1 className="font-display text-xl font-semibold text-foreground">{entry.title}</h1>}
          <div className="flex items-center gap-2 flex-wrap">
            {isVoice && (<Badge variant="secondary" className="text-xs gap-1 bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300"><Mic className="h-2.5 w-2.5" /> Voice Entry</Badge>)}
            {entry.mood && (<Badge variant="secondary" className={`text-xs ${MOOD_COLORS[entry.mood] || ""}`}>{entry.mood}</Badge>)}
            {entry.includedInEcho && (<Badge variant="outline" className="text-xs gap-1"><Sparkles className="h-2.5 w-2.5" /> Included in Echo</Badge>)}
          </div>
        </div>

        {isVoice && (entry as any).audioUrl && (
          <div className="rounded-xl border border-border bg-card p-4 paper-surface">
            <audio controls src={`/api/journal/audio/${entryId}`} className="w-full" />
          </div>
        )}

        {isVoice && transcriptionStatus === "pending" && (
          <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
            <span className="text-sm text-amber-700 dark:text-amber-300">Transcribing your recording...</span>
          </div>
        )}
        {isVoice && transcriptionStatus === "failed" && (
          <div className="rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-4 flex items-center justify-between">
            <span className="text-sm text-red-700 dark:text-red-300">Transcription failed.</span>
            <Button variant="outline" size="sm" onClick={() => retranscribeMutation.mutate()} disabled={retranscribeMutation.isPending} className="gap-1.5 text-red-600 border-red-300">
              {retranscribeMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}Retry
            </Button>
          </div>
        )}

        <div className="text-base text-foreground leading-relaxed whitespace-pre-wrap">{entry.content}</div>

        {reflections.length > 0 && (
          <div className="space-y-3">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Reflections</div>
            {reflections.map((r, i) => (
              <div key={i} className="rounded-xl bg-[#c48585]/5 border border-[#c48585]/20 p-4 space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-[#c48585] font-medium"><MessageSquareQuote className="h-3.5 w-3.5" />Reflection {reflections.length > 1 ? `#${i + 1}` : ""}</div>
                <p className="text-sm text-foreground/80 italic leading-relaxed">{r.question}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3 pt-4 border-t border-border">
          <Link href={`/journal/${entryId}/edit`}><Button variant="outline" size="sm" className="gap-1.5"><PenLine className="h-3.5 w-3.5" />Edit</Button></Link>
          {!showDeleteConfirm ? (
            <Button variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(true)} className="text-destructive hover:text-destructive/80 gap-1.5"><Trash2 className="h-3.5 w-3.5" />Delete</Button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-destructive">Delete this entry?</span>
              <Button variant="destructive" size="sm" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>{deleteMutation.isPending ? "Deleting\u2026" : "Yes, delete"}</Button>
              <Button variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
