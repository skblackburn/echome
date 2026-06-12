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
  Lock, CalendarClock, Milestone as MilestoneIcon, Eye
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
    return <Badge className="text-xs gap-1 rounded-full px-2.5 py-0.5 bg-muted text-muted-foreground border-0 font-normal"><Lock className="h-3 w-3" />Sealed</Badge>;
  }
  if (item.deliveryRuleType === "milestone") {
    return <Badge className="text-xs gap-1 rounded-full px-2.5 py-0.5 bg-muted text-muted-foreground border-0 font-normal"><MilestoneIcon className="h-3 w-3" />{item.deliveryMilestone}</Badge>;
  }
  if (item.deliveryRuleType === "date" && item.recurring) {
    return <Badge className="text-xs gap-1 rounded-full px-2.5 py-0.5 bg-muted text-muted-foreground border-0 font-normal"><CalendarClock className="h-3 w-3" />Recurring</Badge>;
  }
  if (item.deliveryRuleType === "browsable_anytime") {
    return <Badge className="text-xs gap-1 rounded-full px-2.5 py-0.5 bg-primary/10 text-primary border-0 font-normal"><Eye className="h-3 w-3" />Anytime</Badge>;
  }
  if (item.deliveryRuleType === "date") {
    return <Badge className="text-xs gap-1 rounded-full px-2.5 py-0.5 bg-muted text-muted-foreground border-0 font-normal"><CalendarClock className="h-3 w-3" />{new Date(item.deliverAt).toLocaleDateString()}</Badge>;
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
  const date = item._sortDate ? new Date(item._sortDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "";

  let href = "";
  if (type === "letter") href = `/persona/${personaId}/folder/letter/${item.id}`;
  else if (type === "story") href = `/persona/${personaId}/folder/story/${item.id}`;
  else if (type === "document") href = `/persona/${personaId}/documents`;
  else if (type === "photo") href = `/photos/${item.id}`;

  return (
    <Link href={href}>
      <div className="flex items-center gap-4 px-4 py-4 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-muted/20 transition-all cursor-pointer group paper-surface">
        <div className="p-2.5 rounded-lg bg-muted group-hover:bg-primary/10 transition-colors flex-shrink-0">
          <TypeIcon type={type} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-foreground truncate leading-snug">{title}</div>
          <div className="flex items-center flex-wrap gap-2 mt-1.5">
            <span className="text-xs text-muted-foreground capitalize">{type}</span>
            {date && <span className="text-xs text-muted-foreground">{date}</span>}
            {type === "letter" && <DeliveryBadge item={item} />}
            {type === "letter" && item.isSealed && (
              <Badge className="text-xs gap-1 rounded-full px-2.5 py-0.5 bg-muted text-muted-foreground border-0 font-normal">
                <Lock className="h-3 w-3" />Sealed
              </Badge>
            )}
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground/60 group-hover:text-primary/60 transition-colors flex-shrink-0" />
      </div>
    </Link>
  );
}

function EmptyState({ tab }: { tab: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 space-y-2">
      <p className="text-sm font-medium text-muted-foreground">
        {tab === "story"
          ? "No stories yet. Write something meaningful when you're ready."
          : tab === "letter"
          ? "No letters yet. Write a letter — now, for a future date, or sealed until you're gone."
          : tab === "document"
          ? "No documents yet. Upload important papers, notes, or files to preserve them."
          : tab === "photo"
          ? "No photos yet. Upload a photo and let AI help you capture the story behind it."
          : "Nothing here yet. Use the Add Memory button to get started."}
      </p>
    </div>
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
      <Layout backTo="/dashboard" backLabel="Home">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-4">
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </Layout>
    );
  }

  if (!data) {
    return (
      <Layout backTo="/dashboard" backLabel="Home">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 text-center">
          <p className="text-muted-foreground">Folder not found.</p>
        </div>
      </Layout>
    );
  }

  const { persona, letters, stories, documents, photos, timeline } = data;
  const firstName = persona.name.split(" ")[0];

  const filteredTimeline = tab === "all" ? timeline
    : timeline.filter(item => item._type === tab);

  // Action button per tab
  const ActionButton = () => {
    if (tab === "all") {
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" />Add Memory</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <Link href={`/persona/${personaId}/folder/letter/new`}>
              <DropdownMenuItem className="cursor-pointer gap-2"><Mail className="h-4 w-4" />Write a letter</DropdownMenuItem>
            </Link>
            <Link href={`/persona/${personaId}/folder/story/new`}>
              <DropdownMenuItem className="cursor-pointer gap-2"><BookOpen className="h-4 w-4" />Add a story</DropdownMenuItem>
            </Link>
            <Link href={`/persona/${personaId}/documents`}>
              <DropdownMenuItem className="cursor-pointer gap-2"><FileText className="h-4 w-4" />Upload Document</DropdownMenuItem>
            </Link>
            <Link href={`/photos/new?persona=${personaId}`}>
              <DropdownMenuItem className="cursor-pointer gap-2"><Camera className="h-4 w-4" />Upload Photo</DropdownMenuItem>
            </Link>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }
    if (tab === "letter") {
      return (
        <Link href={`/persona/${personaId}/folder/letter/new`}>
          <Button className="gap-2"><Plus className="h-4 w-4" />Add Memory</Button>
        </Link>
      );
    }
    if (tab === "story") {
      return (
        <Link href={`/persona/${personaId}/folder/story/new`}>
          <Button className="gap-2"><Plus className="h-4 w-4" />Add Memory</Button>
        </Link>
      );
    }
    if (tab === "document") {
      return (
        <Link href={`/persona/${personaId}/documents`}>
          <Button className="gap-2"><Plus className="h-4 w-4" />Add Memory</Button>
        </Link>
      );
    }
    if (tab === "photo") {
      return (
        <Link href={`/photos/new?persona=${personaId}`}>
          <Button className="gap-2"><Plus className="h-4 w-4" />Add Memory</Button>
        </Link>
      );
    }
    return null;
  };

  return (
    <Layout backTo="/dashboard" backLabel="Home" title={`${firstName}'s Folder`}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Folder header row */}
        <div className="flex items-center gap-4">
          {(persona as any).avatarUrl ? (
            <img src={(persona as any).avatarUrl} alt={persona.name}
              className="w-12 h-12 rounded-full object-cover ring-2 ring-primary/25 flex-shrink-0" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-primary/15 ring-2 ring-primary/20 flex items-center justify-center flex-shrink-0">
              <span className="font-display font-semibold text-base text-primary">{persona.name.slice(0, 2).toUpperCase()}</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-lg font-semibold text-foreground">{firstName}'s Folder</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {letters.length} letter{letters.length !== 1 ? "s" : ""} · {stories.length} stor{stories.length !== 1 ? "ies" : "y"} · {documents.length} doc{documents.length !== 1 ? "s" : ""} · {photos.length} photo{photos.length !== 1 ? "s" : ""}
            </p>
          </div>
          <ActionButton />
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-5 h-10 p-1 bg-muted/50 rounded-xl">
            {(["all", "letter", "story", "document", "photo"] as const).map(t => (
              <TabsTrigger
                key={t}
                value={t}
                className="rounded-lg text-xs font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=inactive]:text-muted-foreground transition-all"
              >
                {t === "all" ? "All" : t === "letter" ? "Letters" : t === "story" ? "Stories" : t === "document" ? "Docs" : "Photos"}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={tab} className="mt-5 space-y-3">
            {filteredTimeline.length === 0 ? (
              <EmptyState tab={tab} />
            ) : (
              filteredTimeline.map((item: any) => (
                <TimelineItem key={`${item._type}-${item.id}`} item={item} personaId={personaId} />
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
