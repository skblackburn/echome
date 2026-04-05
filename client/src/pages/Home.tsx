import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { EchoMeWordmark } from "@/components/EchoMeLogo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, MessageCircle, Heart, BookOpen, Mic } from "lucide-react";
import type { Persona } from "@shared/schema";

function PersonaCard({ persona }: { persona: Persona }) {
  const initials = persona.name
    .split(" ")
    .map(n => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <Link href={`/persona/${persona.id}`}>
      <Card
        className="p-5 cursor-pointer echo-glow echo-glow-hover transition-all duration-200 hover:-translate-y-0.5 paper-surface"
        data-testid={`card-persona-${persona.id}`}
      >
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="flex-shrink-0">
            {persona.photo ? (
              <img
                src={`/uploads/${persona.photo}`}
                alt={persona.name}
                className="w-14 h-14 rounded-full object-cover ring-2 ring-border"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-primary/15 ring-2 ring-primary/20 flex items-center justify-center">
                <span className="font-display font-semibold text-lg text-primary">{initials}</span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-display font-semibold text-foreground leading-tight">{persona.name}</h3>
                <p className="text-sm text-muted-foreground capitalize mt-0.5">{persona.relationship}</p>
              </div>
              <Badge variant="outline" className="text-xs flex-shrink-0 capitalize border-primary/30 text-primary">
                {persona.status}
              </Badge>
            </div>
            {persona.bio && (
              <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{persona.bio}</p>
            )}
            <div className="flex items-center gap-3 mt-3">
              <Link href={`/persona/${persona.id}/chat`} onClick={e => e.stopPropagation()}>
                <Button size="sm" className="h-7 gap-1.5 text-xs">
                  <MessageCircle className="h-3.5 w-3.5" />
                  Speak with {persona.name.split(" ")[0]}
                </Button>
              </Link>
              <Link href={`/persona/${persona.id}/memories`} onClick={e => e.stopPropagation()}>
                <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-muted-foreground">
                  <BookOpen className="h-3.5 w-3.5" />
                  Add memories
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}

export default function Home() {
  const { data: personas, isLoading } = useQuery<Persona[]>({
    queryKey: ["/api/personas"],
  });

  const hasPersonas = personas && personas.length > 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <EchoMeWordmark className="text-foreground" />
          <Link href="/create">
            <Button size="sm" className="gap-1.5" data-testid="button-create-persona">
              <Plus className="h-4 w-4" />
              New Persona
            </Button>
          </Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        {/* Hero — shown when no personas */}
        {!isLoading && !hasPersonas && (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-6">
              <Heart className="h-8 w-8 text-primary" />
            </div>
            <h1 className="font-display text-3xl font-semibold text-foreground mb-3">
              Preserve a voice that matters
            </h1>
            <p className="text-muted-foreground text-base max-w-md mx-auto leading-relaxed mb-8">
              EchoMe captures someone's personality, stories, and voice — so the people who love them can keep asking
              <em className="text-foreground"> "What would they say?"</em>
            </p>

            {/* Feature pills */}
            <div className="flex flex-wrap gap-2 justify-center mb-10">
              {[
                { icon: Mic, label: "Voice & stories" },
                { icon: Heart, label: "Personality capture" },
                { icon: MessageCircle, label: "AI conversation" },
                { icon: BookOpen, label: "Memory archive" },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-muted-foreground text-sm">
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </div>
              ))}
            </div>

            <Link href="/create">
              <Button size="lg" className="gap-2" data-testid="button-start-echo">
                <Plus className="h-4 w-4" />
                Create your first Echo
              </Button>
            </Link>
          </div>
        )}

        {/* Personas list */}
        {isLoading && (
          <div className="space-y-3">
            {[1, 2].map(i => (
              <Skeleton key={i} className="h-28 rounded-lg" />
            ))}
          </div>
        )}

        {hasPersonas && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-xl font-semibold text-foreground">Your Echoes</h2>
              <span className="text-sm text-muted-foreground">{personas.length} persona{personas.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="space-y-3">
              {personas.map(p => (
                <PersonaCard key={p.id} persona={p} />
              ))}
            </div>

            <div className="mt-6 pt-6 border-t border-border">
              <Link href="/create">
                <Button variant="outline" className="gap-2 w-full" data-testid="button-add-another">
                  <Plus className="h-4 w-4" />
                  Add another Echo
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
