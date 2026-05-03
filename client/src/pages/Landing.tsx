import { Link } from "wouter";
import { EchoMeWordmark } from "@/components/EchoMeLogo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  PenLine,
  Clock,
  Sparkles,
  Shield,
  Lock,
  Heart,
  ArrowRight,
  Sun,
  Moon,
  Mail,
  ChevronDown,
} from "lucide-react";
import { useState, useEffect } from "react";

export default function Landing() {
  const [isDark, setIsDark] = useState(() =>
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <EchoMeWordmark className="text-foreground" />
          <div className="flex items-center gap-2">
            <Link href="/pricing">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground text-sm">
                Pricing
              </Button>
            </Link>
            <Link href="/faq">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground text-sm">
                FAQ
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsDark(d => !d)}
              className="text-muted-foreground hover:text-foreground h-8 w-8"
              aria-label="Toggle theme"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground text-sm">
                Sign in
              </Button>
            </Link>
            <Link href="/register">
              <Button size="sm" className="gap-1.5">
                Start your Folder
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-8">
          <Heart className="h-8 w-8 text-primary" />
        </div>
        <h1 className="font-display text-4xl sm:text-5xl font-semibold text-foreground mb-5 leading-tight">
          Write to the people you love.<br />
          <span className="text-primary">Across any distance — including time.</span>
        </h1>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto leading-relaxed mb-10">
          Letters, stories, voice notes, and photos for your family. Delivered when you choose: now, on a future date, on a milestone, or sealed until you're gone. AI is optional and off by default.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/register">
            <Button size="lg" className="gap-2 text-base px-8">
              <PenLine className="h-4 w-4" />
              Start your Folder
            </Button>
          </Link>
          <Button
            variant="outline"
            size="lg"
            className="gap-2 text-base px-8"
            onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}
          >
            See how it works
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="bg-muted/40 py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h2 className="font-display text-2xl font-semibold text-foreground text-center mb-12">
            How it works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-6 text-center paper-surface">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
                <PenLine className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-display font-semibold text-foreground mb-2">
                Write what matters.
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Letters, stories, voice notes, photos — for each person you love. Start with one letter. You can always add more.
              </p>
            </Card>
            <Card className="p-6 text-center paper-surface">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
                <Clock className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-display font-semibold text-foreground mb-2">
                Choose when it arrives.
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Anytime, a future date, a milestone — graduation, wedding, 18th birthday — or sealed until you're gone. You decide.
              </p>
            </Card>
            <Card className="p-6 text-center paper-surface">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-display font-semibold text-foreground mb-2">
                Add AI if you want it — later.
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Optional, off by default. You can turn it on in Settings if and when it feels right. Or leave it off forever.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section className="py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <h2 className="font-display text-2xl font-semibold text-foreground text-center mb-10">
            Who Echo Me is for
          </h2>
          <div className="space-y-5 text-muted-foreground leading-relaxed">
            <p>
              Parents who want their children to have their words — not just photos, not just memories other people tell, but their actual voice. Letters for birthdays they might not see. Stories for milestones they want to be part of, no matter what.
            </p>
            <p>
              Families who need a private place for memories that won't get lost in cloud drives, phones, or old email accounts. Somewhere the important things stay together.
            </p>
            <p>
              Anyone who has lost someone and wishes they had more of their words. Echo Me exists because that feeling is real, and because you can do something about it now for the people who love you.
            </p>
          </div>
        </div>
      </section>

      {/* Privacy & control */}
      <section className="bg-muted/40 py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <h2 className="font-display text-2xl font-semibold text-foreground text-center mb-10">
            Privacy & control
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="flex gap-4">
              <div className="flex-shrink-0 mt-1">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium text-foreground mb-1">Your Folder is yours.</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  You decide what's written, who it goes to, and when. No one else sees it unless you choose.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 mt-1">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium text-foreground mb-1">AI is off by default.</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  New accounts start with all AI features off. Turn them on one at a time in Settings, or leave them off forever.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 mt-1">
                <Lock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium text-foreground mb-1">Sealed letters stay sealed.</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Letters marked "sealed until passing" are encrypted at rest until release. They stay private until the moment they're meant to arrive.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 mt-1">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium text-foreground mb-1">Coming soon: local-only mode.</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  We're building hybrid and local-only privacy options for people who want complete control over where their data lives.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="bg-muted/40 py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="font-display text-2xl font-semibold text-foreground mb-4">
            Free forever. Really.
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-6 max-w-lg mx-auto">
            The free plan includes one Folder, unlimited letters and journal entries, voice recordings, and photo memories. No credit card required. Upgrade whenever you're ready — or don't.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/register">
              <Button size="lg" className="gap-2">
                <PenLine className="h-4 w-4" />
                Start your Folder — free
              </Button>
            </Link>
            <Link href="/pricing">
              <Button variant="outline" size="lg" className="gap-2">
                See all plans
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <EchoMeWordmark className="text-muted-foreground" />
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <Link href="/pricing">
                <span className="hover:text-foreground cursor-pointer transition-colors">Pricing</span>
              </Link>
              <Link href="/faq">
                <span className="hover:text-foreground cursor-pointer transition-colors">FAQ</span>
              </Link>
              <Link href="/privacy">
                <span className="hover:text-foreground cursor-pointer transition-colors">Privacy</span>
              </Link>
            </div>
          </div>
          <p className="text-xs text-muted-foreground/60 text-center mt-6">
            Echo Me — Letters & stories for the people you love.
          </p>
        </div>
      </footer>
    </div>
  );
}
