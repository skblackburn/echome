import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight, FolderOpen } from "lucide-react";
import type { Persona } from "@shared/schema";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

export default function FolderChooser() {
  const { data: personas = [], isLoading } = useQuery<Persona[]>({
    queryKey: ["/api/personas"],
  });

  if (isLoading) {
    return (
      <Layout backTo="/" backLabel="Home" title="Folders">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-3">
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout backTo="/" backLabel="Home" title="Folders">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-5">
        <div>
          <h1 className="font-display text-xl font-semibold text-foreground">Whose Folder?</h1>
          <p className="text-sm text-muted-foreground mt-1">Choose a persona to open their folder.</p>
        </div>

        <div className="space-y-2">
          {personas.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No Echoes yet. Create one first.
            </p>
          ) : (
            personas.map((persona: any) => (
              <Link key={persona.id} href={`/persona/${persona.id}/folder`}>
                <div className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-muted/30 transition-all cursor-pointer group paper-surface">
                  {persona.avatarUrl ? (
                    <img src={persona.avatarUrl} alt={persona.name}
                      className="w-10 h-10 rounded-full object-cover ring-1 ring-border flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary/15 ring-1 ring-primary/20 flex items-center justify-center flex-shrink-0">
                      <span className="font-display font-semibold text-sm text-primary">{persona.name.slice(0, 2).toUpperCase()}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground">{persona.name}</div>
                    <div className="text-xs text-muted-foreground capitalize">{persona.relationship}</div>
                  </div>
                  <FolderOpen className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}
