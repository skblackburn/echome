import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Camera, Plus, Image, Trash2 } from "lucide-react";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Persona, PhotoMemory } from "@shared/schema";

export default function PhotoMemories() {
  const { data: photoMemories = [], isLoading } = useQuery<PhotoMemory[]>({
    queryKey: ["/api/photo-memories"],
  });

  const { data: personas = [] } = useQuery<Persona[]>({
    queryKey: ["/api/personas"],
  });

  const { data: limits } = useQuery<{ plan: string; limit: number | null; current: number; remaining: number | null }>({
    queryKey: ["/api/photo-memories/limits"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/photo-memories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/photo-memories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/photo-memories/limits"] });
    },
  });

  const personaMap = new Map(personas.map(p => [p.id, p]));

  // Group by persona
  const grouped = new Map<number, PhotoMemory[]>();
  photoMemories.forEach(pm => {
    const list = grouped.get(pm.personaId) || [];
    list.push(pm);
    grouped.set(pm.personaId, list);
  });

  return (
    <Layout title="Photo Memories">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Camera className="h-6 w-6" />
              Photo Memories
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Upload photos and answer AI-generated questions to preserve memories
            </p>
          </div>
          <Link href="/photos/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Photo Memory
            </Button>
          </Link>
        </div>

        {/* Tier info */}
        {limits && limits.limit !== null && (
          <div className="text-sm text-muted-foreground">
            {limits.current} of {limits.limit} photo memories used
            {limits.remaining === 0 && (
              <span className="ml-2 text-amber-600 dark:text-amber-400">
                — <Link href="/pricing" className="underline">Upgrade</Link> for unlimited
              </span>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))}
          </div>
        ) : photoMemories.length === 0 ? (
          <Card className="p-12 text-center space-y-4">
            <Image className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <div>
              <h3 className="font-medium text-foreground">No photo memories yet</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Upload a photo and let AI help you capture the story behind it
              </p>
            </div>
            <Link href="/photos/new">
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Create Your First Photo Memory
              </Button>
            </Link>
          </Card>
        ) : (
          Array.from(grouped.entries()).map(([personaId, memories]) => {
            const persona = personaMap.get(personaId);
            return (
              <div key={personaId} className="space-y-3">
                <h2 className="text-lg font-semibold text-foreground">
                  {persona?.name || "Unknown Echo"}
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {memories.map(pm => (
                    <Link key={pm.id} href={`/photos/${pm.id}`}>
                      <Card className="overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all group relative">
                        <div className="aspect-square bg-muted flex items-center justify-center">
                          <img
                            src={`/api/photo-memories/photo/${pm.id}`}
                            alt="Photo memory"
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </div>
                        <div className="p-2 space-y-1">
                          <Badge variant={pm.status === "complete" ? "default" : "secondary"} className="text-xs">
                            {pm.status === "complete" ? "Complete" : "Draft"}
                          </Badge>
                          <p className="text-xs text-muted-foreground">
                            {new Date(pm.createdAt!).toLocaleDateString()}
                          </p>
                        </div>
                        <button
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-full bg-background/80 hover:bg-destructive hover:text-destructive-foreground"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (confirm("Delete this photo memory?")) {
                              deleteMutation.mutate(pm.id);
                            }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </Layout>
  );
}
