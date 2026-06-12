/**
 * Profile page — /profile
 * Who the user is (not how the app behaves — that's Settings).
 * - Editable name
 * - Read-only email
 * - Profile photo upload
 * - Delete Account (always visible)
 * - Delete Echo (only if echo exists)
 */
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { User, Mail, Camera, Loader2, Check, Trash2, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import type { Persona } from "@shared/schema";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

export default function Profile() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(user?.name || "");
  const [nameEditing, setNameEditing] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [showDeleteEcho, setShowDeleteEcho] = useState<Persona | null>(null);

  // Fetch personas to show "Delete Echo" if one exists
  const { data: personas = [] } = useQuery<Persona[]>({
    queryKey: ["/api/personas"],
  });
  const ownEchos = personas.filter((p: any) => !p._isInherited && !p.parentPersonaId);
  const firstEcho = ownEchos[0] || null;

  // Save name mutation
  const nameMutation = useMutation({
    mutationFn: async (newName: string) => {
      const formData = new FormData();
      formData.append("name", newName);
      const res = await fetch(`${API_BASE}/api/user/profile`, {
        method: "PATCH",
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to update name");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setNameEditing(false);
      toast({ title: "Name updated" });
    },
    onError: () => {
      toast({ title: "Failed to update name", variant: "destructive" });
    },
  });

  // Avatar upload mutation
  const avatarMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("avatar", file);
      const res = await fetch(`${API_BASE}/api/user/profile`, {
        method: "PATCH",
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to upload photo");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: "Profile photo updated" });
    },
    onError: () => {
      toast({ title: "Failed to upload photo", variant: "destructive" });
    },
  });

  // Delete account mutation
  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/api/account/delete`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete account");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Account deleted" });
      logout();
      navigate("/");
    },
    onError: () => {
      toast({ title: "Failed to delete account", variant: "destructive" });
    },
  });

  // Delete Echo mutation
  const deleteEchoMutation = useMutation({
    mutationFn: async (personaId: number) => {
      const res = await fetch(`${API_BASE}/api/personas/${personaId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete Echo");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personas"] });
      setShowDeleteEcho(null);
      toast({ title: "Echo deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete Echo", variant: "destructive" });
    },
  });

  const handleAvatarChange = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum size is 5MB", variant: "destructive" });
      return;
    }
    setAvatarPreview(URL.createObjectURL(file));
    avatarMutation.mutate(file);
  };

  const initials = (user?.name || "?")
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <Layout backTo="/dashboard" backLabel="Home" title="Profile">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Avatar */}
        <Card className="paper-surface">
          <CardContent className="p-6">
            <div className="flex items-center gap-5">
              {/* Avatar circle */}
              <div className="relative flex-shrink-0">
                {avatarPreview || (user as any)?.avatarUrl ? (
                  <img
                    src={avatarPreview || `${API_BASE}${(user as any).avatarUrl}`}
                    alt={user?.name}
                    className="w-20 h-20 rounded-full object-cover ring-2 ring-primary/20"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-primary/10 ring-2 ring-primary/20 flex items-center justify-center">
                    <span className="font-display font-semibold text-2xl text-primary">{initials}</span>
                  </div>
                )}
                {/* Upload overlay */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={avatarMutation.isPending}
                  className="absolute inset-0 rounded-full bg-black/30 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity"
                  title="Change photo"
                >
                  {avatarMutation.isPending
                    ? <Loader2 className="h-5 w-5 text-white animate-spin" />
                    : <Camera className="h-5 w-5 text-white" />}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleAvatarChange(f); }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground truncate">{user?.name}</p>
                <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs text-primary hover:text-primary/80 transition-colors mt-1"
                >
                  Change profile photo
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Name */}
        <Card className="paper-surface">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Name</span>
            </div>
            {nameEditing ? (
              <div className="flex items-center gap-3">
                <Input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") nameMutation.mutate(name); if (e.key === "Escape") { setName(user?.name || ""); setNameEditing(false); } }}
                  className="flex-1"
                  autoFocus
                  placeholder="Your name"
                />
                <Button
                  size="sm"
                  onClick={() => nameMutation.mutate(name)}
                  disabled={nameMutation.isPending || !name.trim()}
                  className="gap-1.5"
                >
                  {nameMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setName(user?.name || ""); setNameEditing(false); }}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground">{user?.name}</span>
                <button
                  type="button"
                  onClick={() => setNameEditing(true)}
                  className="text-xs text-primary hover:text-primary/80 transition-colors"
                >
                  Edit
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Email (read-only) */}
        <Card className="paper-surface">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Email</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">{user?.email}</span>
              <span className="text-xs text-muted-foreground">Cannot be changed</span>
            </div>
          </CardContent>
        </Card>

        {/* Echo management (only if echo exists) */}
        {firstEcho && (
          <Card className="paper-surface">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Echo</span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground">{firstEcho.name}'s Echo</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Deleting removes all Echo data permanently.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5"
                  onClick={() => setShowDeleteEcho(firstEcho)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete Echo
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Delete Account — always visible */}
        <Card className="border-destructive/20 paper-surface">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-destructive" />
              <span className="text-sm font-medium text-destructive">Delete Account</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Permanently deletes your account, all Folders, memories, letters, and any Echo data.
              This cannot be undone.
            </p>
            <Button
              variant="destructive"
              className="w-full gap-2"
              onClick={() => setShowDeleteAccount(true)}
              disabled={deleteAccountMutation.isPending}
            >
              {deleteAccountMutation.isPending
                ? <><Loader2 className="h-4 w-4 animate-spin" />Deleting…</>
                : <><Trash2 className="h-4 w-4" />Delete my account</>}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Delete Account confirmation */}
      <AlertDialog open={showDeleteAccount} onOpenChange={setShowDeleteAccount}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete your account, all Folders, memories, letters, and any Echo data.
              This cannot be undone — there is no recovery.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteAccountMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteAccountMutation.isPending ? "Deleting…" : "Yes, delete everything"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Echo confirmation */}
      <AlertDialog open={!!showDeleteEcho} onOpenChange={v => { if (!v) setShowDeleteEcho(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {showDeleteEcho?.name}'s Echo?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes all Echo data — voice, traits, interview answers, and conversation history.
              The Folder (letters, stories, photos) will not be affected. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => showDeleteEcho && deleteEchoMutation.mutate(showDeleteEcho.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteEchoMutation.isPending}
            >
              {deleteEchoMutation.isPending ? "Deleting…" : "Delete Echo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
