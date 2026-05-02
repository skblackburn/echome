import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Sparkles, Trash2, Save, Loader2, MessageSquareQuote, Mic, Square, RotateCcw, Play, Pause,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import type { JournalEntry } from "@shared/schema";

interface UserPreferences {
  aiReflectionsEnabled: boolean;
}

const MOODS = [
  { key: "grateful", label: "Grateful", color: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800" },
  { key: "reflective", label: "Reflective", color: "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800" },
  { key: "anxious", label: "Anxious", color: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800" },
  { key: "joyful", label: "Joyful", color: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800" },
  { key: "tired", label: "Tired", color: "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-900/30 dark:text-slate-300 dark:border-slate-800" },
  { key: "hopeful", label: "Hopeful", color: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800" },
  { key: "sad", label: "Sad", color: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800" },
  { key: "excited", label: "Excited", color: "bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-900/30 dark:text-pink-300 dark:border-pink-800" },
  { key: "peaceful", label: "Peaceful", color: "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-800" },
];

interface PersonaOption {
  id: number;
  name: string;
  selfMode: boolean;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function JournalEditor() {
  const params = useParams<{ id: string }>();
  const entryId = params.id ? parseInt(params.id) : null;
  const isEdit = !!entryId;
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<"write" | "record">("write");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split("T")[0]);
  const [mood, setMood] = useState<string | null>(null);
  const [includedInEcho, setIncludedInEcho] = useState(false);
  const [echoPersonaId, setEchoPersonaId] = useState<number | null>(null);
  const [savedEntryId, setSavedEntryId] = useState<number | null>(entryId);
  const [reflectionQuestion, setReflectionQuestion] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: userPrefs } = useQuery<UserPreferences>({
    queryKey: ["/api/user/preferences"],
  });
  const reflectionsEnabled = userPrefs?.aiReflectionsEnabled ?? true;

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [micSupported, setMicSupported] = useState(true);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const urlParams = new URLSearchParams(window.location.hash.split("?")[1] || "");
  const initialPrompt = urlParams.get("prompt");

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) setMicSupported(false);
  }, []);

  const { data: existingEntry } = useQuery<JournalEntry>({
    queryKey: ["/api/journal", entryId],
    queryFn: async () => {
      const res = await fetch(`/api/journal/${entryId}`);
      if (!res.ok) throw new Error("Failed to load entry");
      return res.json();
    },
    enabled: isEdit,
  });

  const { data: personas = [] } = useQuery<PersonaOption[]>({
    queryKey: ["/api/journal/personas"],
  });

  useEffect(() => {
    if (existingEntry) {
      setTitle(existingEntry.title || "");
      setContent(existingEntry.content);
      setEntryDate(existingEntry.entryDate);
      setMood(existingEntry.mood);
      setIncludedInEcho(!!existingEntry.includedInEcho);
      setEchoPersonaId(existingEntry.echoPersonaId);
      setSavedEntryId(existingEntry.id);
      if (existingEntry.aiReflections) {
        try {
          const reflections = JSON.parse(existingEntry.aiReflections);
          if (reflections.length > 0) setReflectionQuestion(reflections[reflections.length - 1].question);
        } catch {}
      }
    }
  }, [existingEntry]);

  useEffect(() => {
    if (personas.length > 0 && !echoPersonaId && !isEdit) {
      const selfPersona = personas.find(p => p.selfMode);
      if (selfPersona) setEchoPersonaId(selfPersona.id);
      else if (personas.length === 1) setEchoPersonaId(personas[0].id);
    }
  }, [personas, echoPersonaId, isEdit]);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [audioUrl]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorder.start(1000);
      setIsRecording(true);
      setRecordingTime(0);
      setAudioBlob(null);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch (_err) {
      toast({ title: "Microphone access denied", description: "Please allow microphone access to record.", variant: "destructive" });
    }
  }, [audioUrl, toast]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") mediaRecorderRef.current.stop();
    setIsRecording(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const discardRecording = useCallback(() => {
    setAudioBlob(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setRecordingTime(0);
  }, [audioUrl]);

  const togglePlayback = useCallback(() => {
    if (!audioRef.current || !audioUrl) return;
    if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); }
    else { audioRef.current.play(); setIsPlaying(true); }
  }, [isPlaying, audioUrl]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (savedEntryId) {
        const res = await apiRequest("PUT", `/api/journal/${savedEntryId}`, {
          title: title || null, content, entryDate, mood,
          includedInEcho, echoPersonaId: includedInEcho ? echoPersonaId : null,
        });
        return res.json();
      } else {
        const res = await apiRequest("POST", "/api/journal", {
          title: title || null, content, entryDate, mood,
          includedInEcho, echoPersonaId: includedInEcho ? echoPersonaId : null,
        });
        return res.json();
      }
    },
    onSuccess: (data) => {
      setSavedEntryId(data.id);
      queryClient.invalidateQueries({ queryKey: ["/api/journal"] });
      queryClient.invalidateQueries({ queryKey: ["/api/journal/stats"] });
      toast({ title: "Saved", description: "Journal entry saved." });
      if (!isEdit) navigate(`/journal/${data.id}`);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const voiceSaveMutation = useMutation({
    mutationFn: async () => {
      if (!audioBlob) throw new Error("No recording to save");
      const formData = new FormData();
      formData.append("file", audioBlob, "recording.webm");
      formData.append("duration", String(recordingTime));
      formData.append("entryDate", entryDate);
      if (title) formData.append("title", title);
      if (mood) formData.append("mood", mood);
      if (includedInEcho && echoPersonaId) {
        formData.append("includedInEcho", "true");
        formData.append("echoPersonaId", String(echoPersonaId));
      }
      const res = await fetch("/api/journal/voice", {
        method: "POST", body: formData, credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(err.error || "Upload failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal"] });
      queryClient.invalidateQueries({ queryKey: ["/api/journal/stats"] });
      toast({ title: "Saved", description: "Voice entry saved. Transcription in progress..." });
      navigate(`/journal/${data.id}`);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => { if (!savedEntryId) return; await apiRequest("DELETE", `/api/journal/${savedEntryId}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal"] });
      queryClient.invalidateQueries({ queryKey: ["/api/journal/stats"] });
      toast({ title: "Deleted", description: "Journal entry deleted." });
      navigate("/journal");
    },
  });

  const reflectMutation = useMutation({
    mutationFn: async () => {
      if (!savedEntryId) {
        const res = await apiRequest("POST", "/api/journal", {
          title: title || null, content, entryDate, mood,
          includedInEcho, echoPersonaId: includedInEcho ? echoPersonaId : null,
        });
        const entry = await res.json();
        setSavedEntryId(entry.id);
        const reflectRes = await apiRequest("POST", `/api/journal/${entry.id}/reflect`, {});
        return reflectRes.json();
      }
      await apiRequest("PUT", `/api/journal/${savedEntryId}`, {
        title: title || null, content, entryDate, mood,
        includedInEcho, echoPersonaId: includedInEcho ? echoPersonaId : null,
      });
      const res = await apiRequest("POST", `/api/journal/${savedEntryId}/reflect`, {});
      return res.json();
    },
    onSuccess: (data) => { setReflectionQuestion(data.question); queryClient.invalidateQueries({ queryKey: ["/api/journal"] }); },
    onError: (err: Error) => { toast({ title: "Couldn't reflect", description: err.message, variant: "destructive" }); },
  });

  const hasContent = content.trim().length > 0;

  return (
    <Layout backTo={savedEntryId ? `/journal/${savedEntryId}` : "/journal"} backLabel="Journal" title={isEdit ? "Edit Entry" : "New Entry"}>
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {!isEdit && micSupported && (
          <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
            <button onClick={() => setTab("write")} className={`px-4 py-1.5 text-sm rounded-md transition-all ${tab === "write" ? "bg-background text-foreground shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"}`}>Write</button>
            <button onClick={() => setTab("record")} className={`px-4 py-1.5 text-sm rounded-md transition-all flex items-center gap-1.5 ${tab === "record" ? "bg-background text-foreground shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"}`}>
              <Mic className="h-3.5 w-3.5" />Record
            </button>
          </div>
        )}

        <div><Input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} className="w-auto text-sm" /></div>

        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="A title for today (optional)" className="text-lg font-display border-0 border-b border-border rounded-none px-0 focus-visible:ring-0 focus-visible:border-[#c48585] placeholder:text-muted-foreground/50" />

        {tab === "write" && (
          <Textarea value={content} onChange={e => setContent(e.target.value)} placeholder={initialPrompt || "Write freely\u2026"} className="min-h-[250px] text-base leading-relaxed border-0 rounded-none px-0 focus-visible:ring-0 resize-none placeholder:text-muted-foreground/50 bg-transparent" autoFocus />
        )}

        {tab === "record" && !isEdit && (
          <div className="rounded-xl border border-border bg-card p-6 paper-surface space-y-6">
            {!audioBlob ? (
              <div className="flex flex-col items-center space-y-4">
                <div className="text-3xl font-mono text-foreground tabular-nums">{formatDuration(recordingTime)}</div>
                {isRecording && (<div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /><span className="text-sm text-red-500 font-medium">Recording</span></div>)}
                <div className="flex items-center gap-3">
                  {!isRecording ? (
                    <Button size="lg" onClick={startRecording} className="bg-red-500 hover:bg-red-600 text-white rounded-full h-16 w-16 p-0"><Mic className="h-6 w-6" /></Button>
                  ) : (
                    <Button size="lg" onClick={stopRecording} variant="outline" className="border-red-300 text-red-500 hover:bg-red-50 dark:hover:bg-red-950 rounded-full h-16 w-16 p-0"><Square className="h-5 w-5 fill-current" /></Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground text-center">{isRecording ? "Tap to stop recording" : "Tap to start recording"}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-4">
                <div className="text-lg font-mono text-foreground tabular-nums">{formatDuration(recordingTime)}</div>
                <audio ref={audioRef} src={audioUrl || undefined} onEnded={() => setIsPlaying(false)} className="hidden" />
                <div className="flex items-center gap-3">
                  <Button variant="outline" size="sm" onClick={togglePlayback} className="gap-1.5">
                    {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}{isPlaying ? "Pause" : "Play"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={discardRecording} className="text-muted-foreground gap-1.5"><RotateCcw className="h-3.5 w-3.5" />Re-record</Button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">How are you feeling?</div>
          <div className="flex flex-wrap gap-2">
            {MOODS.map(m => (
              <button key={m.key} onClick={() => setMood(mood === m.key ? null : m.key)} className={`px-3 py-1 rounded-full text-xs border transition-all ${mood === m.key ? `${m.color} ring-2 ring-offset-1 ring-current` : "border-border text-muted-foreground hover:border-muted-foreground/50"}`}>{m.label}</button>
            ))}
          </div>
        </div>

        {reflectionQuestion && (
          <div className="rounded-xl bg-[#c48585]/5 border border-[#c48585]/20 p-4 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-[#c48585] font-medium"><MessageSquareQuote className="h-3.5 w-3.5" />Reflection</div>
            <p className="text-sm text-foreground/80 italic leading-relaxed">{reflectionQuestion}</p>
          </div>
        )}

        {tab === "write" && hasContent && reflectionsEnabled && (
          <Button variant="outline" size="sm" onClick={() => reflectMutation.mutate()} disabled={reflectMutation.isPending} className="gap-1.5 text-[#c48585] border-[#c48585]/30 hover:bg-[#c48585]/5">
            {reflectMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}Help me reflect
          </Button>
        )}
        {tab === "write" && hasContent && !reflectionsEnabled && (
          <div className="text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3 inline mr-1" />
            AI reflections are off. <Link href="/settings" className="underline text-primary">Turn on in Settings</Link>
          </div>
        )}

        {personas.length > 0 ? (
          <div className="rounded-xl border border-border bg-card p-4 paper-surface space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-foreground">Include in my Echo</div>
                <div className="text-xs text-muted-foreground mt-0.5">This helps preserve your voice over time</div>
              </div>
              <Switch checked={includedInEcho} onCheckedChange={setIncludedInEcho} />
            </div>
            {includedInEcho && personas.length > 1 && (
              <select value={echoPersonaId || ""} onChange={e => setEchoPersonaId(Number(e.target.value) || null)} className="w-full text-sm rounded-lg border border-border bg-background px-3 py-2">
                <option value="">Select an Echo</option>
                {personas.map(p => (<option key={p.id} value={p.id}>{p.name}{p.selfMode ? " (You)" : ""}</option>))}
              </select>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-center">
            <p className="text-xs text-muted-foreground">Create an Echo of yourself to include journal entries in your voice archive.</p>
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          {tab === "write" ? (
            <Button onClick={() => saveMutation.mutate()} disabled={!hasContent || saveMutation.isPending} className="bg-[#c48585] hover:bg-[#b57575] text-white gap-2">
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save
            </Button>
          ) : (
            <Button onClick={() => voiceSaveMutation.mutate()} disabled={!audioBlob || voiceSaveMutation.isPending} className="bg-[#c48585] hover:bg-[#b57575] text-white gap-2">
              {voiceSaveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save Voice Entry
            </Button>
          )}
          {isEdit && (
            <>
              {!showDeleteConfirm ? (
                <Button variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(true)} className="text-destructive hover:text-destructive/80 gap-1.5"><Trash2 className="h-3.5 w-3.5" />Delete</Button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-destructive">Delete this entry?</span>
                  <Button variant="destructive" size="sm" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>{deleteMutation.isPending ? "Deleting\u2026" : "Yes, delete"}</Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
