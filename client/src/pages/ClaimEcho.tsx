import { useState, useEffect } from "react";
import { useParams, useLocation, Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { EchoMeLogo } from "@/components/EchoMeLogo";
import { Heart, ShieldCheck, Shield, Check, X, LogIn, UserPlus } from "lucide-react";

interface ClaimPreview {
  heirId: number;
  personaName: string;
  personaRelationship: string;
  personaAvatarUrl: string | null;
  creatorName: string;
  heirName: string | null;
  heirEmail: string;
  accessLevel: string;
  status: string;
}

export default function ClaimEcho() {
  const { token } = useParams<{ token: string }>();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [preview, setPreview] = useState<ClaimPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [claimed, setClaimed] = useState(false);

  useEffect(() => {
    fetch(`/api/heirs/claim/${token}`)
      .then(async res => {
        if (!res.ok) throw new Error("Invalid or expired invitation link");
        return res.json();
      })
      .then(data => {
        setPreview(data);
        setLoading(false);
      })
      .catch(err => {
        setError(String(err));
        setLoading(false);
      });
  }, [token]);

  const handleClaim = async () => {
    setClaiming(true);
    try {
      const res = await apiRequest("POST", `/api/heirs/claim/${token}`);
      const data = await res.json();
      setClaimed(true);
      toast({ title: "Welcome to the family", description: `You now have access to ${preview?.personaName}'s Echo.` });
      setTimeout(() => navigate(`/persona/${data.personaId}`), 2000);
    } catch (err) {
      toast({ title: "Couldn't claim", description: String(err), variant: "destructive" });
    } finally {
      setClaiming(false);
    }
  };

  const handleDecline = async () => {
    setDeclining(true);
    try {
      await apiRequest("POST", `/api/heirs/claim/${token}/decline`);
      toast({ title: "Invitation declined" });
      navigate("/");
    } catch (err) {
      toast({ title: "Error", description: String(err), variant: "destructive" });
    } finally {
      setDeclining(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  if (error || !preview) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="max-w-md w-full p-8 text-center space-y-4">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-destructive/10 mx-auto">
            <X className="h-7 w-7 text-destructive" />
          </div>
          <h2 className="font-display text-xl font-semibold text-foreground">Invalid invitation</h2>
          <p className="text-sm text-muted-foreground">
            This link may have expired or already been used. If you believe this is an error,
            ask the person who invited you to send a new link.
          </p>
          <Link href="/">
            <Button variant="outline">Go home</Button>
          </Link>
        </Card>
      </div>
    );
  }

  if (preview.status === "claimed" || claimed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="max-w-md w-full p-8 text-center space-y-4">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 mx-auto breathing">
            <Check className="h-7 w-7 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="font-display text-xl font-semibold text-foreground">
            {claimed ? "Welcome to the family" : "Already claimed"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {claimed
              ? `You now have access to ${preview.personaName}'s Echo. Taking you there now...`
              : `This Echo has already been claimed. Sign in to access it.`
            }
          </p>
          {!claimed && (
            <Link href="/login">
              <Button>Sign in</Button>
            </Link>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-16">
        <Card className="p-8 paper-surface space-y-6 text-center">
          {/* Avatar */}
          <div className="mx-auto">
            {preview.personaAvatarUrl ? (
              <img
                src={preview.personaAvatarUrl}
                alt={preview.personaName}
                className="w-20 h-20 rounded-full object-cover ring-2 ring-primary/25 mx-auto breathing"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto breathing ring-2 ring-primary/20">
                <EchoMeLogo size={32} className="text-primary" />
              </div>
            )}
          </div>

          {/* Welcome message */}
          <div>
            <h1 className="font-display text-2xl font-semibold text-foreground mb-2">
              {preview.personaName}'s Echo
            </h1>
            <p className="text-muted-foreground leading-relaxed">
              {preview.creatorName} has chosen you to inherit access to {preview.personaName}'s Echo — a living
              collection of their memories, stories, and voice.
            </p>
          </div>

          {/* Access level badge */}
          <div className="flex items-center justify-center gap-2">
            {preview.accessLevel === "full" ? (
              <Badge variant="outline" className="text-sm gap-1.5 px-3 py-1 border-primary/30 text-primary">
                <ShieldCheck className="h-3.5 w-3.5" />
                Full access — chat, view, and contribute
              </Badge>
            ) : (
              <Badge variant="outline" className="text-sm gap-1.5 px-3 py-1 border-primary/30 text-primary">
                <Shield className="h-3.5 w-3.5" />
                View and chat access
              </Badge>
            )}
          </div>

          {/* What you'll find */}
          <div className="text-left p-4 rounded-lg bg-muted/30 space-y-2">
            <p className="text-sm font-medium text-foreground">What you'll find inside:</p>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <Heart className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                Conversations with {preview.personaName}'s Echo, powered by their memories and personality
              </li>
              <li className="flex items-start gap-2">
                <Heart className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                Stories, documents, and family history that have been preserved
              </li>
              {preview.accessLevel === "full" && (
                <li className="flex items-start gap-2">
                  <Heart className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                  The ability to add your own memories and perspectives
                </li>
              )}
            </ul>
          </div>

          {/* Action buttons */}
          {user ? (
            <div className="space-y-3">
              <Button
                className="w-full gap-2 h-11"
                disabled={claiming}
                onClick={handleClaim}
              >
                <Heart className="h-4 w-4" />
                {claiming ? "Claiming access..." : `Claim access to ${preview.personaName}'s Echo`}
              </Button>
              <Button
                variant="ghost"
                className="w-full text-muted-foreground"
                disabled={declining}
                onClick={handleDecline}
              >
                {declining ? "Declining..." : "Decline this invitation"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                To claim this Echo, please sign up or sign in first.
              </p>
              <div className="flex gap-3">
                <Link href={`/register?claim=${token}`} className="flex-1">
                  <Button className="w-full gap-2">
                    <UserPlus className="h-4 w-4" />
                    Sign up
                  </Button>
                </Link>
                <Link href={`/login?claim=${token}`} className="flex-1">
                  <Button variant="outline" className="w-full gap-2">
                    <LogIn className="h-4 w-4" />
                    Sign in
                  </Button>
                </Link>
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground/70 italic pt-2">
            Their voice lives on through the people who love them.
          </p>
        </Card>
      </div>
    </div>
  );
}
