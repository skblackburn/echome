import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Input } from "@/components/ui/input";
import { BookOpen, MessageCircle, ChevronDown, ChevronUp, Search, X } from "lucide-react";
import type { Persona, ChatMessage } from "@shared/schema";
import { cn } from "@/lib/utils";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

function groupByDate(messages: ChatMessage[]) {
  const groups: Record<string, ChatMessage[]> = {};
  messages.forEach(m => {
    const date = m.createdAt
      ? new Date(typeof m.createdAt === "number" ? m.createdAt * 1000 : m.createdAt).toLocaleDateString("en-US", {
          weekday: "long", year: "numeric", month: "long", day: "numeric"
        })
      : "Unknown date";
    if (!groups[date]) groups[date] = [];
    groups[date].push(m);
  });
  return Object.entries(groups).reverse();
}

export default function Journal() {
  const { id } = useParams<{ id: string }>();
  const personaId = parseInt(id);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: persona } = useQuery<Persona>({
    queryKey: ["/api/personas", personaId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/personas/${personaId}`);
      return res.json();
    },
  });

  const { data: messages = [] } = useQuery<ChatMessage[]>({
    queryKey: ["/api/personas", personaId, "chat"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/personas/${personaId}/chat`);
      return res.json();
    },
  });

  const firstName = persona?.name?.split(" ")[0] || "them";
  const filtered = searchQuery.trim()
    ? messages.filter(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;
  const grouped = groupByDate(filtered);
  const totalConversations = groupByDate(messages).length;
  const totalMessages = messages.filter(m => m.role === "user").length;

  return (
    <Layout title="Conversation Journal" backTo={`/persona/${personaId}`} backLabel={persona?.name || "Back"}>
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        <div className="space-y-1">
          <h1 className="font-display text-xl font-semibold text-foreground">
            Journal — {firstName}
          </h1>
          <p className="text-sm text-muted-foreground">
            Every conversation you've had with {firstName}, saved and organized by date.
          </p>
        </div>

        {/* Search */}
        {messages.length > 0 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search conversations…"
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

        {/* Stats */}
        {messages.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-card p-4 paper-surface text-center">
              <div className="text-2xl font-display font-bold text-foreground">{totalConversations}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{totalConversations === 1 ? "day" : "days"} of conversations</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 paper-surface text-center">
              <div className="text-2xl font-display font-bold text-foreground">{totalMessages}</div>
              <div className="text-xs text-muted-foreground mt-0.5">messages you've sent</div>
            </div>
          </div>
        )}

        {/* Conversation groups */}
        {grouped.length > 0 ? (
          <div className="space-y-3">
            {grouped.map(([date, msgs]) => {
              const isExpanded = expandedDate === date;
              const userMsgs = msgs.filter(m => m.role === "user");
              const firstUserMsg = userMsgs[0]?.content || "";

              return (
                <div key={date} className="rounded-xl border border-border bg-card paper-surface overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedDate(isExpanded ? null : date)}
                    className="w-full flex items-center gap-4 p-4 text-left hover:bg-muted/30 transition-colors"
                  >
                    <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
                      <MessageCircle className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground">{date}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 truncate">
                        {firstUserMsg ? `"${firstUserMsg.slice(0, 60)}${firstUserMsg.length > 60 ? "…" : ""}"` : `${msgs.length} messages`}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-muted-foreground">{msgs.length} msgs</span>
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-border p-4 space-y-3 bg-muted/20">
                      {msgs.map(m => (
                        <div key={m.id} className={cn("flex gap-3", m.role === "user" ? "flex-row-reverse" : "flex-row")}>
                          <div className={cn(
                            "max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-relaxed",
                            m.role === "user"
                              ? "bg-primary text-primary-foreground rounded-tr-sm"
                              : "bg-background border border-border text-foreground rounded-tl-sm"
                          )}>
                            {m.content}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16 space-y-3">
            <BookOpen className="h-10 w-10 text-muted-foreground/40 mx-auto" />
            <p className="text-sm text-muted-foreground">No conversations yet.</p>
            <p className="text-xs text-muted-foreground/70">
              Your conversations with {firstName} will be saved here automatically.
            </p>
            <Link href={`/persona/${personaId}/chat`}>
              <button className="mt-2 text-xs text-primary hover:underline">
                Start a conversation →
              </button>
            </Link>
          </div>
        )}
      </div>
    </Layout>
  );
}
