import { useState, useRef, useEffect } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { EchoMeLogo } from "@/components/EchoMeLogo";
import { useToast } from "@/hooks/use-toast";
import { Send, BookOpen, RotateCcw } from "lucide-react";
import type { Persona, ChatMessage } from "@shared/schema";
import { cn } from "@/lib/utils";

const CONVERSATION_STARTERS = [
  "What do you wish you'd told me more often?",
  "What was your happiest memory?",
  "What advice would you give me about love?",
  "Tell me about your childhood.",
  "What did you want most for me?",
  "What made you laugh?",
  "What are you most proud of in your life?",
];

function MessageBubble({ message, personaName }: { message: ChatMessage; personaName: string }) {
  const isUser = message.role === "user";
  return (
    <div
      className={cn("flex gap-3 message-in", isUser ? "flex-row-reverse" : "flex-row")}
      data-testid={`message-${message.id}`}
    >
      {/* Avatar */}
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center ring-1 ring-primary/20">
          <EchoMeLogo size={16} className="text-primary" />
        </div>
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
      </div>
    </div>
  );
}

export default function Chat() {
  const { id } = useParams<{ id: string }>();
  const personaId = parseInt(id);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState("");
  const [showStarters, setShowStarters] = useState(true);

  const { data: persona } = useQuery<Persona>({
    queryKey: ["/api/personas", personaId],
    queryFn: async () => {
      const res = await fetch(`/api/personas/${personaId}`);
      return res.json();
    },
  });

  const { data: messages = [], isLoading: messagesLoading } = useQuery<ChatMessage[]>({
    queryKey: ["/api/personas", personaId, "chat"],
    queryFn: async () => {
      const res = await fetch(`/api/personas/${personaId}/chat`);
      return res.json();
    },
    refetchInterval: false,
  });

  const sendMutation = useMutation({
    mutationFn: (message: string) =>
      apiRequest("POST", `/api/personas/${personaId}/chat`, { message }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personas", personaId, "chat"] });
      setShowStarters(false);
    },
    onError: () => {
      toast({ title: "Couldn't send message", description: "Please try again.", variant: "destructive" });
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

  // Hide starters once there are messages
  useEffect(() => {
    if (messages.length > 0) setShowStarters(false);
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
            <Link href={`/persona/${personaId}`}>
              <Button variant="ghost" size="sm" className="gap-1.5 -ml-2 text-muted-foreground hover:text-foreground text-sm">
                ← {persona?.name || "Back"}
              </Button>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/persona/${personaId}/memories`}>
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground">
                <BookOpen className="h-3.5 w-3.5" />
                Add memories
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs text-muted-foreground"
              onClick={() => clearMutation.mutate()}
              disabled={messages.length === 0 || clearMutation.isPending}
              data-testid="button-clear-chat"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Clear
            </Button>
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
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4 breathing">
                <EchoMeLogo size={28} className="text-primary" />
              </div>
              <h2 className="font-display text-xl font-semibold text-foreground mb-2">
                {firstName} is here
              </h2>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                This is a space to speak with {persona?.name || "your loved one"}. Ask anything —
                they'll respond from the heart, guided by everything you've shared.
              </p>
            </div>
          )}

          {/* Conversation starters */}
          {showStarters && messages.length === 0 && (
            <div className="pt-2">
              <p className="text-xs font-medium text-muted-foreground mb-2.5 text-center">Things you might ask</p>
              <div className="flex flex-col gap-2">
                {CONVERSATION_STARTERS.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => useStarter(s)}
                    className="text-sm text-left px-4 py-2.5 rounded-xl border border-border bg-card hover:bg-muted/60
                               hover:border-primary/30 text-foreground/80 hover:text-foreground transition-all"
                    data-testid="button-conversation-starter"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message list */}
          {messages.map(msg => (
            <MessageBubble key={msg.id} message={msg} personaName={firstName} />
          ))}

          {/* Typing indicator */}
          {sendMutation.isPending && (
            <div className="flex gap-3 message-in">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center ring-1 ring-primary/20">
                <EchoMeLogo size={16} className="text-primary" />
              </div>
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

      {/* Input bar */}
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
    </div>
  );
}
