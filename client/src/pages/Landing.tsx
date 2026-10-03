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
  Mic,
  BookOpen,
  FolderOpen,
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
            <Link href="/pricing" className="hidden sm:block">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground text-sm">
                Pricing
              </Button>
            </Link>
            <Link href="/faq" className="hidden sm:block">
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
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-10 grid grid-cols-1 lg:grid-cols-[1.08fr_1fr] gap-12 lg:gap-12 items-center">
        <div className="text-center lg:text-left">
          <h1 className="font-display text-4xl sm:text-5xl font-bold text-foreground mb-5 leading-[1.12]">
            Every life holds <span className="text-primary">stories worth keeping.</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto lg:mx-0 leading-relaxed mb-8">
            Echo Me makes it easier to capture the memories, wisdom, laughter, and voice of someone you love, in letters, stories, photos, and voice notes that stay together and stay private.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3">
            <Link href="/register">
              <Button size="lg" className="gap-2 text-base px-8" data-testid="button-hero-start">
                <PenLine className="h-4 w-4" />
                Start your Folder
              </Button>
            </Link>
            <Button
              variant="outline"
              size="lg"
              className="gap-2 text-base px-8 btn-secondary"
              onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}
              data-testid="button-hero-how"
            >
              See how it works
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-6 flex items-center justify-center lg:justify-start gap-2">
            <Lock className="h-3.5 w-3.5 text-primary flex-shrink-0" />
            Private by design. Built for families, one meaningful conversation at a time.
          </p>
        </div>

        {/* Story artifacts: a still composition that the motion reel will later replace */}
        <figure className="relative mx-auto w-full max-w-md" aria-label="Sample Folder entries: a letter, a voice note, and a story">
          <div className="relative h-[500px] sm:h-[520px]">
            <div className="absolute inset-x-3 inset-y-0 rounded-[2rem] bg-primary/10" aria-hidden="true" />

            {/* Letter */}
            <div className="absolute left-0 top-6 w-[80%] -rotate-3 rounded-2xl bg-card border border-border p-5 shadow-[0_8px_24px_rgba(0,0,0,0.04)]" aria-hidden="true">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-3">
                <Mail className="h-3.5 w-3.5 text-primary" />
                Letter · for Maya&apos;s 18th birthday
              </div>
              <p className="text-sm text-foreground leading-relaxed">
                Dear Maya, the summer you were born, the whole street smelled of cut grass and your grandmother&apos;s bread. I want you to know how loud the house was with happiness&hellip;
              </p>
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs bg-[rgba(217,123,90,0.10)] text-[#B5603F] dark:text-[#E8A58C]">
                <Clock className="h-3 w-3" />
                Arrives on her birthday
              </div>
            </div>

            {/* Voice note */}
            <div className="absolute right-0 top-[236px] w-[80%] rotate-2 rounded-2xl bg-card border border-border p-5 shadow-[0_8px_24px_rgba(0,0,0,0.05)]" aria-hidden="true">
              <div className="flex items-center gap-3">
                <div className="icon-pill"><Mic className="h-4 w-4" /></div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-foreground truncate">Grandpa&apos;s recipe, told his way</div>
                  <div className="text-xs text-muted-foreground">Voice note · 0:42</div>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-[3px] h-9">
                {[8,14,22,12,28,18,10,24,30,16,9,20,26,14,8,18,12,6,10,7,5,9,6,4].map((h, i) => (
                  <span
                    key={i}
                    className={"w-[3px] rounded-full " + (i < 13 ? "bg-primary" : "bg-primary/25")}
                    style={{ height: h }}
                  />
                ))}
              </div>
            </div>

            {/* Story */}
            <div className="absolute left-4 bottom-5 w-[72%] -rotate-1 rounded-2xl bg-card border border-border p-4 shadow-[0_8px_24px_rgba(0,0,0,0.04)]" aria-hidden="true">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-1.5">
                <BookOpen className="h-3.5 w-3.5 text-primary" />
                Story
              </div>
              <div className="text-sm font-semibold text-foreground">The year we moved to the coast</div>
              <div className="text-xs text-muted-foreground mt-0.5">Written in her own words</div>
            </div>
          </div>
          <figcaption className="text-xs text-muted-foreground text-center mt-4">
            Illustrative samples. Your Folder holds your own words.
          </figcaption>
        </figure>
      </section>

      {/* Reassurance */}
      <section className="px-4 sm:px-6 pb-16">
        <div className="max-w-2xl mx-auto text-center">
          <div className="mx-auto mb-5 h-px w-12 bg-[rgba(217,123,90,0.45)]" aria-hidden="true" />
          <p className="font-display text-xl sm:text-2xl font-semibold text-foreground leading-snug">
            You do not need to know every question to ask.
          </p>
          <p className="text-muted-foreground mt-2">Echo Me helps you begin.</p>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="bg-muted/40 py-20 scroll-mt-14">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h2 className="font-display text-2xl font-semibold text-foreground text-center mb-3">
            How Echo Me works
          </h2>
          <p className="text-muted-foreground text-center max-w-xl mx-auto mb-12">
            Three gentle steps. Start with one memory and add more whenever you like.
          </p>
          <ol className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                n: "1",
                icon: FolderOpen,
                title: "Start a Folder",
                body: "Create a Folder for someone you love, or for yourself. It is a private place where everything you add stays together.",
              },
              {
                n: "2",
                icon: PenLine,
                title: "Add what feels right",
                body: "Write a letter, tell a story, add a photo, or record a voice note. Not sure where to begin? Guided questions help you start.",
              },
              {
                n: "3",
                icon: Clock,
                title: "Keep it close, or share it",
                body: "Choose when each letter arrives: now, on a future date, at a milestone, or sealed until you are gone. Share only when you decide to.",
              },
            ].map(({ n, icon: Icon, title, body }) => (
              <li key={n}>
                <Card className="p-6 h-full paper-surface">
                  <div className="flex items-center justify-between mb-4">
                    <div className="icon-pill"><Icon className="h-5 w-5" /></div>
                    <span className="font-display text-sm font-semibold text-[#B5603F] dark:text-[#E8A58C]">Step {n}</span>
                  </div>
                  <h3 className="font-display font-semibold text-foreground mb-2">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
                </Card>
              </li>
            ))}
          </ol>
          <p className="text-sm text-muted-foreground text-center max-w-xl mx-auto mt-10 leading-relaxed">
            Gentle, optional prompts can help you go beyond &ldquo;Tell me about your childhood.&rdquo; AI is off by default, and you can leave it off forever.
          </p>
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
              <a href="mailto:support@echome.family" className="hover:text-foreground transition-colors">
                Contact: support@echome.family
              </a>
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
