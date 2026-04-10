import { useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { EchoMeLogo } from "@/components/EchoMeLogo";
import { ArrowRight, Lock } from "lucide-react";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

export default function JoinEcho() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/family/join/${trimmed}`);
      if (!res.ok) {
        toast({ title: "Code not found", description: "Double-check the code and try again.", variant: "destructive" });
        return;
      }
      const data = await res.json() as { member: { name: string; personaId: number; accessCode: string }; persona: { name: string } };
      // Store viewer session in memory (not localStorage — sandbox blocked)
      // Pass code as query param to the chat page
      toast({ title: `Welcome, ${data.member.name}`, description: `You now have access to ${data.persona.name}'s Echo.` });
      navigate(`/persona/${data.member.personaId}/chat?viewer=${trimmed}`);
    } catch (e) {
      toast({ title: "Something went wrong", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout backTo="/" backLabel="Home">
      <div className="max-w-sm mx-auto px-4 py-16 flex flex-col items-center text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center breathing">
          <EchoMeLogo size={28} className="text-primary" />
        </div>

        <div className="space-y-2">
          <h1 className="font-display text-xl font-semibold text-foreground">Join an Echo</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Enter the access code you were given to connect with your loved one's Echo.
          </p>
        </div>

        <div className="w-full space-y-3">
          <div className="space-y-1.5">
            <Label className="text-left block">Access code</Label>
            <Input
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === "Enter" && handleJoin()}
              placeholder="e.g., A3B7K2"
              className="text-center font-mono text-lg tracking-widest uppercase"
              maxLength={8}
              data-testid="input-access-code"
              autoFocus
            />
          </div>
          <Button className="w-full gap-2" disabled={code.trim().length < 4 || loading} onClick={handleJoin}>
            {loading ? "Connecting…" : "Connect to Echo"}
            {!loading && <ArrowRight className="h-4 w-4" />}
          </Button>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" />
          Your conversations are private to you
        </div>
      </div>
    </Layout>
  );
}
