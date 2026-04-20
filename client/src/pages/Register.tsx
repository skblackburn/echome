import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EchoMeLogo, EchoMeWordmark } from "@/components/EchoMeLogo";
import { ArrowRight, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Register() {
  const [, navigate] = useLocation();
  const { register } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("Passwords don't match"); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setLoading(true);
    try {
      await register(email, password, name);
      toast({ title: "Welcome!", description: "Check your email for getting started tips." });
      navigate("/");
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const passwordStrong = password.length >= 8;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center breathing">
            <EchoMeLogo size={22} className="text-primary" />
          </div>
          <EchoMeWordmark className="h-6 text-foreground" />
          <p className="text-sm text-muted-foreground text-center">
            Create an account to start preserving the people you love.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Your name</Label>
            <Input
              id="name"
              placeholder="e.g., Emma"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="At least 8 characters"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
            {password.length > 0 && (
              <div className={`flex items-center gap-1.5 text-xs ${passwordStrong ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                {passwordStrong ? <Check className="h-3 w-3" /> : <span className="w-3 h-3 rounded-full border border-current inline-block" />}
                {passwordStrong ? "Password looks good" : "At least 8 characters"}
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input
              id="confirm"
              type="password"
              placeholder="••••••••"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
            />
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full gap-2" disabled={loading || !name.trim() || !email.trim() || !passwordStrong}>
            {loading ? "Creating account…" : "Create account"}
            {!loading && <ArrowRight className="h-4 w-4" />}
          </Button>
        </form>

        <p className="text-xs text-muted-foreground text-center leading-relaxed">
          By creating an account you agree to keep your Echoes private and use them with care for the people they represent.
        </p>

        <div className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login">
            <span className="text-primary hover:underline cursor-pointer font-medium">Sign in</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
