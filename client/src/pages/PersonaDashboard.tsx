import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageCircle, BookOpen, Mic, Brain, Image, ChevronRight } from "lucide-react";
import type { Persona, Trait, Memory, Media } from "@shared/schema";

interface PersonaSummary {
  persona: Persona;
  traits: Trait[];
  memories: Memory[];
  media: Media[];
}

function StatCard({ icon: Icon, label, count, color }: {
  icon: React.ElementType;
  label: string;
  count: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50 border border-border">
      <div className={`p-2 rounded-md ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <div className="text-xl font-semibold font-display text-foreground">{count}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

export default function PersonaDashboard() {
  const { id } = useParams<{ id: string }>();
  const personaId = parseInt(id);

  const { data, isLoading } = useQuery<PersonaSummary>({
    queryKey: ["/api/personas", personaId, "summary"],
    queryFn: async () => {
      const res = await fetch(`/api/personas/${personaId}/summary`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <Layout backTo="/" backLabel="Home">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-4">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </Layout>
    );
  }

  if (!data) {
    return (
      <Layout backTo="/" backLabel="Home">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
          <p className="text-muted-foreground">Echo not found.</p>
        </div>
      </Layout>
    );
  }

  const { persona, traits, memories, media } = data;
  const firstName = persona.name.split(" ")[0];
  const audioCount = media.filter(m => m.type === "audio").length;
  const photoCount = media.filter(m => m.type === "photo").length;

  const traitsByCategory: Record<string, string[]> = {};
  traits.forEach(t => {
    if (!traitsByCategory[t.category]) traitsByCategory[t.category] = [];
    traitsByCategory[t.category].push(t.content);
  });

  return (
    <Layout backTo="/" backLabel="Home" title={persona.name}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Persona hero */}
        <div className="flex items-start gap-5 mb-8">
          {persona.photo ? (
            <img
              src={`/uploads/${persona.photo}`}
              alt={persona.name}
              className="w-20 h-20 rounded-full object-cover ring-2 ring-border flex-shrink-0"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-primary/15 ring-2 ring-primary/20 flex items-center justify-center flex-shrink-0">
              <span className="font-display font-semibold text-2xl text-primary">
                {persona.name.slice(0, 2).toUpperCase()}
              </span>
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <h1 className="font-display text-2xl font-semibold text-foreground">{persona.name}</h1>
              <Badge variant="outline" className="capitalize border-primary/30 text-primary text-xs">
                {persona.relationship}
              </Badge>
            </div>
            {persona.birthYear && (
              <p className="text-sm text-muted-foreground">b. {persona.birthYear}</p>
            )}
            {persona.bio && (
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{persona.bio}</p>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <StatCard icon={BookOpen} label="Memories" count={memories.length} color="bg-primary/10 text-primary" />
          <StatCard icon={Brain} label="Traits" count={traits.length} color="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" />
          <StatCard icon={Mic} label="Recordings" count={audioCount} color="bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400" />
          <StatCard icon={Image} label="Photos" count={photoCount} color="bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400" />
        </div>

        {/* Primary action */}
        <Link href={`/persona/${personaId}/chat`}>
          <Card className="echo-glow echo-glow-hover cursor-pointer transition-all hover:-translate-y-0.5 mb-4 bg-primary text-primary-foreground border-0">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-white/15">
                  <MessageCircle className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-semibold">Speak with {firstName}</div>
                  <div className="text-sm opacity-75">Have a conversation powered by their memories</div>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 opacity-60" />
            </CardContent>
          </Card>
        </Link>

        {/* Add memories */}
        <Link href={`/persona/${personaId}/memories`}>
          <Card className="echo-glow echo-glow-hover cursor-pointer transition-all hover:-translate-y-0.5 mb-6 paper-surface">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-muted">
                  <BookOpen className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <div className="font-medium text-foreground">Add memories & personality</div>
                  <div className="text-sm text-muted-foreground">Stories, traits, voice recordings, photos</div>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>

        {/* Traits preview */}
        {traits.length > 0 && (
          <Card className="paper-surface mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-foreground">Personality & Values</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {Object.entries(traitsByCategory).slice(0, 4).map(([cat, items]) => (
                <div key={cat}>
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 capitalize">{cat}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {items.slice(0, 4).map((item, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">{item}</Badge>
                    ))}
                    {items.length > 4 && (
                      <Badge variant="outline" className="text-xs text-muted-foreground">+{items.length - 4} more</Badge>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Recent memories */}
        {memories.length > 0 && (
          <Card className="paper-surface">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-foreground">Recent Memories</CardTitle>
                <Link href={`/persona/${personaId}/memories`}>
                  <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-7">
                    View all
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {memories.slice(0, 3).map(m => (
                <div key={m.id} className="border-l-2 border-primary/30 pl-3 py-0.5">
                  {m.title && <div className="text-sm font-medium text-foreground">{m.title}</div>}
                  <p className="text-sm text-muted-foreground line-clamp-2">{m.content}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs capitalize">{m.type}</Badge>
                    {m.period && <span className="text-xs text-muted-foreground capitalize">{m.period}</span>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
