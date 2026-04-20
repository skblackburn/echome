import { useState, useRef, useEffect } from "react";
import { useParams, Link, useSearch } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { EchoMeLogo } from "@/components/EchoMeLogo";
import { useToast } from "@/hooks/use-toast";
import { Send, BookOpen, RotateCcw, Volume2, VolumeX, Loader2, Lightbulb, UserPlus, Settings2 } from "lucide-react";
import type { Persona, ChatMessage } from "@shared/schema";
import { cn } from "@/lib/utils";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";


const DEFAULT_STARTERS = [
  "What's your favorite memory of us?",
  "What advice would you give me right now?",
  "Tell me about when you were my age",
  "What's something I don't know about you?",
  "What are you most proud of?",
  "What would you say to me on a hard day?",
  "Tell me a story from your childhood",
  "What do you wish you had done differently?",
  "What's the best advice you ever received?",
  "What made you fall in love?",
  "What's your happiest memory?",
  "What would you want me to remember about you?",
];

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function getPersonaStarters(persona: Persona | undefined): string[] {
  if (!persona) return shuffleArray(DEFAULT_STARTERS).slice(0, 6);
  const starters: string[] = [];
  const p = persona as any;

  if (p.favoritePlace || p.hometown) starters.push(`Tell me about your favorite place.`);
  if (p.catchphrase) starters.push(`Where did "${p.catchphrase?.slice(0, 40)}" come from?`);
  if (p.spouse) starters.push(`Tell me about the love of your life.`);
  if (p.children) {
    try {
      const kids = JSON.parse(p.children);
      if (kids.length > 0) starters.push(`What do you most want ${kids[0].name} to know?`);
    } catch (_) {}
  }
  if (p.proudestMoment) starters.push(`What moment in your life made you most proud?`);
  if (p.hardestPeriod) starters.push(`What was the hardest thing you ever got through?`);
  if (p.wishForFamily) starters.push(`What do you most wish for us?`);
  if (p.career) starters.push(`Tell me about your work and what it meant to you.`);
  if (p.loveLanguage) starters.push(`How did you show people you loved them?`);

  // Fill with randomized defaults to reach 6 total
  const remaining = shuffleArray(DEFAULT_STARTERS.filter(s => !starters.includes(s)));
  const combined = [...starters, ...remaining];
  return combined.slice(0, 6);
}

function SpeakButton({ text }: { text: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const speak = async () => {
    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
      return;
    }
    setIsLoading(true);
    try {
      const res = await apiRequest("POST", "/api/speak", { text });
      const data = await res.json() as { audio: string; mimeType: string };
      const byteChars = atob(data.audio);
      const byteArr = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
      const blob = new Blob([byteArr], { type: data.mimeType });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { setIsPlaying(false); URL.revokeObjectURL(url); };
      audio.onerror = () => { setIsPlaying(false); URL.revokeObjectURL(url); };
      await audio.play();
      setIsPlaying(true);
    } catch (_e) {
      // Voice not configured or unavailable — silently ignore
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={speak}
      className="flex-shrink-0 p-1 rounded-md text-muted-foreground/50 hover:text-muted-foreground transition-colors"
      title={isPlaying ? "Stop" : "Listen"}
    >
      {isLoading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : isPlaying ? (
        <VolumeX className="h-3.5 w-3.5" />
      ) : (
        <Volume2 className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

function MessageBubble({ message, personaName, avatarUrl }: { message: ChatMessage; personaName: string; avatarUrl?: string | null }) {
  const isUser = message.role === "user";
  return (
    <div
      className={cn("flex gap-3 message-in", isUser ? "flex-row-reverse" : "flex-row")}
      data-testid={`message-${message.id}`}
    >
      {/* Avatar */}
      {!isUser && (
        avatarUrl ? (
          <img src={avatarUrl} alt={personaName} className="flex-shrink-0 w-8 h-8 rounded-full object-cover ring-1 ring-primary/25" />
        ) : (
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center ring-1 ring-primary/20">
            <EchoMeLogo size={16} className="text-primary" />
          </div>
        )
      )}

      <div className={cn("max-w-[75%] space-y-1", isUser ? "items-end" : "items-start")}>
        {!isUser && (
          <div className="text-xs text-muted-foreground px-1">{personaName}</div>
        )}
        <div
          className={cn(
            "px-4 py-3 rounded-2xl text-sm leading-relaxed",
            isUser
              ? "bg-primary text-primary-foreground rounded-tr-md"
              : "bg-card border border-border text-foreground rounded-tl-md paper-surface"
          )}
        >
          {message.content}
        </div>
        {/* Voice playback for assistant messages */}
        {!isUser && (
          <div className="px-1">
            <SpeakButton text={message.content} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function Chat() {
  const { id } = useParams<{ id: string }>();
  const personaId = parseInt(id);
  const searchStr = useSearch();
  const viewerCode = new URLSearchParams(searchStr).get("viewer") || undefined;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState("");
  const [showStarters, setShowStarters] = useState(false);
  const [startersDismissed, setStartersDismissed] = useState(false);
  const [messageLimitHit, setMessageLimitHit] = useState(false);

  const { data: persona } = useQuery<Persona>({
    queryKey: ["/api/personas", personaId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/personas/${personaId}`);
      return res.json();
    },
  });

  // Also load life story for smart starters
  const { data: lifeStoryData } = useQuery({
    queryKey: ["/api/personas", personaId, "life-story"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/personas/${personaId}/life-story`);
      return res.json();
    },
  });

  const enrichedPersona = persona && lifeStoryData
    ? { ...persona, ...lifeStoryData }
    : persona;

  const { data: messages = [], isLoading: messagesLoading } = useQuery<ChatMessage[]>({
    queryKey: ["/api/personas", personaId, "chat"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/personas/${personaId}/chat`);
      return res.json();
    },
    refetchInterval: false,
  });

  const sendMutation = useMutation({
    mutationFn: (message: string) =>
      apiRequest("POST", `/api/personas/${personaId}/chat`, { message, viewerCode }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personas", personaId, "chat"] });
      setShowStarters(false);
    },
    onError: (err: Error) => {
      if (err.message.includes("403")) {
        setMessageLimitHit(true);
      } else {
        toast({ title: "Couldn't send message", description: "Please try again.", variant: "destructive" });
      }
    },
  });

  const clearMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/personas/${personaId}/chat`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personas", personaId, "chat"] });
      setShowStarters(true);
      toast({ title: "Conversation cleared" });
    },
  });

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sendMutation.isPending]);

  // Show starters when fewer than 2 messages; show suggested section on return visits
  useEffect(() => {
    if (messages.length < 2) {
      setShowStarters(true);
      setStartersDismissed(false);
    } else {
      setShowStarters(false);
    }
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || sendMutation.isPending) return;
    setInput("");
    sendMutation.mutate(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const useStarter = (starter: string) => {
    setInput(starter);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const firstName = persona?.name?.split(" ")[0] || "Echo";

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="flex-shrink-0 sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {!viewerCode ? (
              <Link href={`/persona/${personaId}`}>
                <Button variant="ghost" size="sm" className="gap-2 -ml-2 text-muted-foreground hover:text-foreground text-sm">
                  ←
                  {(persona as any)?.avatarUrl ? (
                    <img src={(persona as any).avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover ring-1 ring-primary/25" />
                  ) : null}
                  {persona?.name || "Back"}
                </Button>
              </Link>
            ) : (
              <div className="flex items-center gap-2 -ml-1">
                {(persona as any)?.avatarUrl ? (
                  <img src={(persona as any).avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover ring-1 ring-primary/25" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center">
                    <EchoMeLogo size={12} className="text-primary" />
                  </div>
                )}
                <span className="text-sm font-medium text-foreground">{persona?.name?.split(" ")[0]}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {viewerCode ? (
              <Link href={`/persona/${personaId}/contribute?viewer=${viewerCode}`}>
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground">
                  <UserPlus className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Add memory</span>
                </Button>
              </Link>
            ) : (
              <Link href={`/persona/${personaId}/memories`}>
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground">
                  <BookOpen className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Add memories</span>
                </Button>
              </Link>
            )}
            <Button variant="ghost" size="sm"
              className="gap-1.5 text-xs text-muted-foreground"
              onClick={() => { setShowStarters(s => !s); setStartersDismissed(false); }}
              title="Conversation suggestions">
              <Lightbulb className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Suggest</span>
            </Button>
            {!viewerCode && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs text-muted-foreground"
                onClick={() => clearMutation.mutate()}
                disabled={messages.length === 0 || clearMutation.isPending}
                data-testid="button-clear-chat"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Clear</span>
              </Button>
            )}
            {viewerCode && (
              <Link href={`/persona/${personaId}/contributor-settings?viewer=${viewerCode}`}>
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground" title="Content settings">
                  <Settings2 className="h-3.5 w-3.5" />
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-4">
          {messagesLoading && (
            <div className="space-y-3">
              <Skeleton className="h-14 w-3/4 rounded-2xl" />
              <Skeleton className="h-10 w-1/2 rounded-2xl ml-auto" />
            </div>
          )}

          {/* Intro / welcome */}
          {!messagesLoading && messages.length === 0 && (
            <div className="text-center py-8">
              {(persona as any)?.avatarUrl ? (
                <img src={(persona as any).avatarUrl} alt={persona?.name || ""} className="w-16 h-16 rounded-full object-cover ring-2 ring-primary/25 mx-auto mb-4 breathing" />
              ) : (
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4 breathing">
                  <EchoMeLogo size={28} className="text-primary" />
                </div>
              )}
              <h2 className="font-display text-xl font-semibold text-foreground mb-2">
                {firstName} is here
              </h2>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                This is a space to speak with {persona?.name || "your loved one"}. Ask anything —
                they'll respond from the heart, guided by everything you've shared.
              </p>
            </div>
          )}

          {/* Conversation starters — full view when fewer than 2 messages */}
          {showStarters && messages.length < 2 && (
            <div className="pt-2">
              <p className="text-xs font-medium text-muted-foreground mb-3 text-center">Things you might ask</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {getPersonaStarters(enrichedPersona as Persona).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => useStarter(s)}
                    className="text-sm px-4 py-2 rounded-full border border-primary/30 bg-background
                               hover:bg-primary/10 hover:border-primary/50
                               text-primary/80 hover:text-primary transition-all"
                    data-testid="button-conversation-starter"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {/* Smaller "Suggested" section on return visits with 2+ messages */}
          {messages.length >= 2 && !startersDismissed && showStarters && (
            <div className="py-2">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-muted-foreground">Suggested</p>
                <button
                  type="button"
                  onClick={() => { setStartersDismissed(true); setShowStarters(false); }}
                  className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                >
                  Dismiss
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {getPersonaStarters(enrichedPersona as Persona).slice(0, 3).map(s => (
                  <button key={s} type="button" onClick={() => { useStarter(s); setStartersDismissed(true); setShowStarters(false); }}
                    className="text-xs px-3 py-1.5 rounded-full border border-primary/25 bg-background
                               hover:bg-primary/10 hover:border-primary/40
                               text-primary/70 hover:text-primary transition-all">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message list */}
          {messages.map(msg => (
            <MessageBubble key={msg.id} message={msg} personaName={firstName} avatarUrl={(persona as any)?.avatarUrl} />
          ))}

          {/* Typing indicator */}
          {sendMutation.isPending && (
            <div className="flex gap-3 message-in">
              {(persona as any)?.avatarUrl ? (
                <img src={(persona as any).avatarUrl} alt="" className="flex-shrink-0 w-8 h-8 rounded-full object-cover ring-1 ring-primary/25" />
              ) : (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center ring-1 ring-primary/20">
                  <EchoMeLogo size={16} className="text-primary" />
                </div>
              )}
              <div className="bg-card border border-border px-4 py-3 rounded-2xl rounded-tl-md paper-surface">
                <div className="flex gap-1 items-center h-5">
                  {[0, 1, 2].map(i => (
                    <div
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60"
                      style={{ animation: `breathe 1.2s ${i * 0.2}s ease-in-out infinite` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Message limit banner */}
      {messageLimitHit && (
        <div className="flex-shrink-0 border-t border-border bg-amber-50 dark:bg-amber-900/20 px-4 py-3">
          <div className="max-w-2xl mx-auto text-center space-y-2">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              You've used all 20 messages this month. Upgrade for unlimited messaging.
            </p>
            <Link href="/pricing">
              <Button size="sm" className="gap-1.5">
                View Plans
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Input bar */}
      {!messageLimitHit && (
        <div className="flex-shrink-0 border-t border-border bg-background/95 backdrop-blur-sm">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3">
            <div className="flex items-end gap-3">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Message ${firstName}…`}
                rows={1}
                className="flex-1 resize-none min-h-[40px] max-h-32 rounded-xl border-border bg-card text-sm"
                data-testid="input-chat-message"
                style={{ height: "auto" }}
                onInput={e => {
                  const el = e.currentTarget;
                  el.style.height = "auto";
                  el.style.height = Math.min(el.scrollHeight, 128) + "px";
                }}
              />
              <Button
                size="icon"
                className="h-10 w-10 rounded-xl flex-shrink-0"
                disabled={!input.trim() || sendMutation.isPending}
                onClick={handleSend}
                data-testid="button-send-message"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5 text-center">
              Powered by {persona?.name}'s memories and values
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
