import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import {
  User, Bot, Bell, Palette, Sun, Moon, ExternalLink,
  MessageCircle, Sparkles, Camera, Mic, PenTool, PowerOff,
} from "lucide-react";

interface UserPreferences {
  userId: number;
  aiChatEnabled: boolean;
  aiReflectionsEnabled: boolean;
  aiPhotoPromptsEnabled: boolean;
  aiVoiceTranscriptionEnabled: boolean;
  aiWritingStyleEnabled: boolean;
  emailLetterDelivery: boolean;
  emailMilestones: boolean;
  emailMarketing: boolean;
}

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains("dark")
  );

  const { data: prefs, isLoading } = useQuery<UserPreferences>({
    queryKey: ["/api/user/preferences"],
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<UserPreferences>) => {
      const res = await apiRequest("PUT", "/api/user/preferences", updates);
      return res.json() as Promise<UserPreferences>;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/user/preferences"], data);
      toast({ title: "Saved" });
    },
    onError: () => {
      toast({ title: "Failed to save", variant: "destructive" });
    },
  });

  const togglePref = (key: keyof UserPreferences, value: boolean) => {
    updateMutation.mutate({ [key]: value });
  };

  const turnOffAllAI = () => {
    updateMutation.mutate({
      aiChatEnabled: false,
      aiReflectionsEnabled: false,
      aiPhotoPromptsEnabled: false,
      aiVoiceTranscriptionEnabled: false,
      aiWritingStyleEnabled: false,
    });
  };

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  const anyAIEnabled = prefs && (
    prefs.aiChatEnabled ||
    prefs.aiReflectionsEnabled ||
    prefs.aiPhotoPromptsEnabled ||
    prefs.aiVoiceTranscriptionEnabled ||
    prefs.aiWritingStyleEnabled
  );

  if (isLoading) {
    return (
      <Layout backTo="/" backLabel="Home" title="Settings">
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout backTo="/" backLabel="Home" title="Settings">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Account */}
        <Card className="p-6 space-y-4 paper-surface">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <User className="h-4 w-4 text-muted-foreground" />
            Account
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Email</span>
              <span className="text-foreground">{user?.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Name</span>
              <span className="text-foreground">{user?.name}</span>
            </div>
            <div className="pt-2 space-y-2">
              <Link href="/account">
                <Button variant="outline" size="sm" className="gap-1.5 w-full justify-between">
                  Subscription & billing
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </Link>
              <Link href="/account">
                <Button variant="outline" size="sm" className="gap-1.5 w-full justify-between text-muted-foreground">
                  Export data
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        </Card>

        {/* AI Features */}
        <Card className="p-6 space-y-5 paper-surface" id="ai-features">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Bot className="h-4 w-4 text-muted-foreground" />
            AI Features
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            AI features are powered by OpenAI. When you turn them on, the relevant data is sent to OpenAI to generate responses. You can turn each off anytime.
          </p>

          <div className="space-y-4">
            <ToggleRow
              icon={<MessageCircle className="h-4 w-4" />}
              label="AI Echo chat"
              description="Chat with Echoes you create. Conversations are processed by OpenAI."
              checked={prefs?.aiChatEnabled ?? false}
              onToggle={(v) => togglePref("aiChatEnabled", v)}
            />
            <ToggleRow
              icon={<Sparkles className="h-4 w-4" />}
              label="AI journal reflections"
              description="Get AI reflections on your journal entries."
              checked={prefs?.aiReflectionsEnabled ?? false}
              onToggle={(v) => togglePref("aiReflectionsEnabled", v)}
            />
            <ToggleRow
              icon={<Camera className="h-4 w-4" />}
              label="AI photo prompts"
              description="Let AI generate thoughtful questions about photos you upload."
              checked={prefs?.aiPhotoPromptsEnabled ?? false}
              onToggle={(v) => togglePref("aiPhotoPromptsEnabled", v)}
            />
            <ToggleRow
              icon={<Mic className="h-4 w-4" />}
              label="Voice transcription"
              description="Auto-transcribe voice journal entries using OpenAI Whisper."
              checked={prefs?.aiVoiceTranscriptionEnabled ?? false}
              onToggle={(v) => togglePref("aiVoiceTranscriptionEnabled", v)}
            />
            <ToggleRow
              icon={<PenTool className="h-4 w-4" />}
              label="Writing-style analysis"
              description="Let AI analyze uploaded writing samples to learn how a person writes."
              checked={prefs?.aiWritingStyleEnabled ?? false}
              onToggle={(v) => togglePref("aiWritingStyleEnabled", v)}
            />
          </div>

          {anyAIEnabled && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-muted-foreground w-full"
              onClick={turnOffAllAI}
            >
              <PowerOff className="h-3.5 w-3.5" />
              Turn off all AI features
            </Button>
          )}
        </Card>

        {/* Notifications */}
        <Card className="p-6 space-y-4 paper-surface">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Bell className="h-4 w-4 text-muted-foreground" />
            Notifications
          </div>
          <div className="space-y-4">
            <ToggleRow
              label="Letter delivery emails"
              description="Get notified when scheduled letters are delivered."
              checked={prefs?.emailLetterDelivery ?? true}
              onToggle={(v) => togglePref("emailLetterDelivery", v)}
            />
            <ToggleRow
              label="Milestone emails"
              description="Get notified about milestone messages."
              checked={prefs?.emailMilestones ?? true}
              onToggle={(v) => togglePref("emailMilestones", v)}
            />
            <ToggleRow
              label="Product updates"
              description="Occasional emails about new features and improvements."
              checked={prefs?.emailMarketing ?? true}
              onToggle={(v) => togglePref("emailMarketing", v)}
            />
          </div>
        </Card>

        {/* Appearance */}
        <Card className="p-6 space-y-4 paper-surface">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Palette className="h-4 w-4 text-muted-foreground" />
            Appearance
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isDark ? <Moon className="h-4 w-4 text-muted-foreground" /> : <Sun className="h-4 w-4 text-muted-foreground" />}
              <div>
                <div className="text-sm font-medium text-foreground">{isDark ? "Dark mode" : "Light mode"}</div>
                <div className="text-xs text-muted-foreground">Toggle between light and dark themes</div>
              </div>
            </div>
            <Switch
              checked={isDark}
              onCheckedChange={setIsDark}
            />
          </div>
        </Card>

      </div>
    </Layout>
  );
}

function ToggleRow({
  icon,
  label,
  description,
  checked,
  onToggle,
}: {
  icon?: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onToggle: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-3 min-w-0">
        {icon && <div className="text-muted-foreground mt-0.5 flex-shrink-0">{icon}</div>}
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground">{label}</div>
          <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</div>
        </div>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onToggle}
        className="flex-shrink-0"
      />
    </div>
  );
}
