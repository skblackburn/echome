import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Mail, BookOpen, FileText, Camera, Plus, ChevronRight,
  Lock, CalendarClock, Milestone, Eye
} from "lucide-react";
import type { Persona } from "@shared/schema";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

interface FolderData {
  persona: Persona;
  letters: any[];
  stories: any[];
  documents: any[];
  photos: any[];
  timeline: any[];
}

function DeliveryBadge({ item }: { item: any }) {
  if (item.deliveryRuleType === "sealed_until_passing") {
    return <Badge variant="outline" className="text-xs gap-1"><Lock className="h-3 w-3" />Sealed</Badge>;
  }
  if (item.deliveryRuleType === "milestone") {
    return <Badge variant="outline" className="text-xs gap-1"><Milestone className="h-3 w-3" />{item.deliveryMilestone}</Badge>;
  }
  if (item.deliveryRuleType === "date" && item.recurring) {
    return <Badge variant="outline" className="text-xs gap-1"><CalendarClock className="h-3 w-3" />Recurring</Badge>;
  }
  if (item.deliveryRuleType === "browsable_anytime") {
    return <Badge variant="outline" className="text-xs gap-1"><Eye className="h-3 w-3" />Anytime</Badge>;
  }
  if (item.deliveryRuleType === "date") {
    return <Badge variant="outline" className="text-xs gap-1"><CalendarClock className="h-3 w-3" />{new Date(item.deliverAt).toLocaleDateString()}</Badge>;
  }
  return null;
}

function TypeIcon({ type }: { type: string }) {
  switch (type) {
    case "letter": return <Mail className="h-4 w-4 text-rose-500" />;
    case "story": return <BookOpen className="h-4 w-4 text-emerald-500" />;
    case "document": return <FileText className="h-4 w-4 text-sky-500" />;
    case "photo": return <Camera className="h-4 w-4 text-amber-500" />;
    default: return <FileText className="h-4 w-4 text-muted-foreground" />;
  }
}

function TimelineItem({ item, personaId }: { item: any; personaId: number }) {
  const type = item._type;
  const title = item.title || item.content?.slice(0, 60) || "Untitled";
  const date = item._sortDate ? new Date(item._sortDate).toLocaleDateString() : "";

  let href = "";
  if (type === "letter") href = `/persona/${personaId}/folder/letter/${item.id}`;
  else if (type === "story") href = `/persona/${personaId}/folder/story/${item.id}`;
  else if (type === "document") href = `/persona/${personaId}/documents`;
  else if (type === "photo") href = `/photos/${item.id}`;

  return (
    <Link href={href}>
      <div className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-muted/30 transition-all cursor-pointer group paper-surface">
        <div className="p-2 rounded-lg bg-muted group-hover:bg-primary/10 transition-colors flex-shrink-0">
          <TypeIcon type={type} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-foreground truncate">{title}</div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-muted-foreground capitalize">{type}</span>
            <span className="text-xs text-muted-foreground">{date}</span>
            {type === "letter" && <DeliveryBadge item={item} />}
            {type === "letter" && item.isSealed && <Badge variant="outline" className="text-xs gap-1"><Lock className="h-3 w-3" />Sealed</Badge>}
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      </div>
    </Link>
  );
}

export default function Folder() {
  const { id } = useParams<{ id: string }>();
  const personaId = parseInt(id);
  const [tab, setTab] = useState("all");

  const { data, isLoading } = useQuery<FolderData>({
    queryKey: ["/api/personas", personaId, "folder"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/personas/${personaId}/folder`);
      if (!res.ok) throw new Error("Failed to load folder");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <Layout backTo={`/persona/${personaId}`} backLabel="Echo">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-4">
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </Layout>
    );
  }

  if (!data) {
    return (
      <Layout backTo={`/persona/${personaId}`} backLabel="Echo">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
          <p className="text-muted-foreground">Folder not found.</p>
        </div>
      </Layout>
    );
  }

  const { persona, letters, stories, documents, photos, timeline } = data;
  const firstName = persona.name.split(" ")[0];

  const filteredTimeline = tab === "all" ? timeline
    : timeline.filter(item => item._type === tab);

  return (
    <Layout backTo={`/persona/${personaId}`} backLabel="Echo" title={`${firstName}'s Folder`}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-5">

        {/* Header */}
        <div className="flex items-center gap-4">
          {(persona as any).avatarUrl ? (
            <img src={(persona as any).avatarUrl} alt={persona.name}
              className="w-14 h-14 rounded-full object-cover ring-2 ring-primary/25 flex-shrink-0" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-primary/15 ring-2 ring-primary/20 flex items-center justify-center flex-shrink-0">
              <span className="font-display font-semibold text-lg text-primary">{persona.name.slice(0, 2).toUpperCase()}</span>
            </div>
          )}
          <div className="flex-1">
            <h1 className="font-display text-xl font-semibold text-foreground">{firstName}'s Folder</h1>
            <p className="text-sm text-muted-foreground">
              {letters.length} letter{letters.length !== 1 ? "s" : ""} · {stories.length} stor{stories.length !== 1 ? "ies" : "y"} · {documents.length} doc{documents.length !== 1 ? "s" : ""} · {photos.length} photo{photos.length !== 1 ? "s" : ""}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Compose
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <Link href={`/persona/${personaId}/folder/letter/new`}>
                <DropdownMenuItem className="cursor-pointer gap-2">
                  <Mail className="h-4 w-4" />
                  Write a letter
                </DropdownMenuItem>
              </Link>
              <Link href={`/persona/${personaId}/folder/story/new`}>
                <DropdownMenuItem className="cursor-pointer gap-2">
                  <BookOpen className="h-4 w-4" />
                  Add a story
                </DropdownMenuItem>
              </Link>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="letter">Letters</TabsTrigger>
            <TabsTrigger value="story">Stories</TabsTrigger>
            <TabsTrigger value="document">Docs</TabsTrigger>
            <TabsTrigger value="photo">Photos</TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-4 space-y-2">
            {filteredTimeline.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-sm">Nothing here yet.</p>
                <p className="text-xs mt-1">Use the Compose button to write a letter or add a story.</p>
              </div>
            ) : (
              filteredTimeline.map((item: any, i: number) => (
                <TimelineItem key={`${item._type}-${item.id}`} item={item} personaId={personaId} />
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
