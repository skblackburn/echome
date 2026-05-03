import { Link, useLocation } from "wouter";
import { EchoMeWordmark } from "./EchoMeLogo";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sun, Moon, LogOut, User, CreditCard, Settings, HelpCircle, Shield, BookOpen, Mail, Camera, FolderOpen } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";

interface LayoutProps {
  children: React.ReactNode;
  backTo?: string;
  backLabel?: string;
  title?: string;
  actions?: React.ReactNode;
}

export function Layout({ children, backTo, backLabel, title, actions }: LayoutProps) {
  const [isDark, setIsDark] = useState(() =>
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
  const [, navigate] = useLocation();
  const { user, logout } = useAuth();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {backTo && (
              <Link href={backTo}>
                <Button variant="ghost" size="sm" className="gap-1.5 -ml-2 text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="h-4 w-4" />
                  {backLabel || "Back"}
                </Button>
              </Link>
            )}
            {!backTo && (
              <Link href="/">
                <EchoMeWordmark className="text-foreground cursor-pointer hover:opacity-80 transition-opacity" />
              </Link>
            )}
            {title && (
              <span className="text-muted-foreground">·</span>
            )}
            {title && (
              <span className="text-sm font-medium text-muted-foreground">{title}</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {actions}
            {user && (
              <Link href="/folders">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  title="Folders">
                  <FolderOpen className="h-3.5 w-3.5" />
                </Button>
              </Link>
            )}
            {user && (
              <Link href="/photos">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  title="Photo Memories">
                  <Camera className="h-3.5 w-3.5" />
                </Button>
              </Link>
            )}
            {user && (
              <Link href="/letters">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  title="Letters">
                  <Mail className="h-3.5 w-3.5" />
                </Button>
              </Link>
            )}
            {user && (
              <Link href="/journal">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  title="Journal">
                  <BookOpen className="h-3.5 w-3.5" />
                </Button>
              </Link>
            )}
            <Link href="/faq">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground"
                title="FAQ">
                <HelpCircle className="h-3.5 w-3.5" />
              </Button>
            </Link>
            <Link href="/privacy">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground"
                title="Privacy">
                <Shield className="h-3.5 w-3.5" />
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsDark(d => !d)}
              className="text-muted-foreground hover:text-foreground h-8 w-8"
              aria-label="Toggle theme"
              data-testid="button-theme-toggle"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            {user && (
              <div className="flex items-center gap-1">
                <Link href="/pricing">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    title="Pricing">
                    <CreditCard className="h-3.5 w-3.5" />
                  </Button>
                </Link>
                <Link href="/settings">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    title="Settings">
                    <Settings className="h-3.5 w-3.5" />
                  </Button>
                </Link>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs text-muted-foreground">
                  <User className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline max-w-[100px] truncate">{user.name}</span>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={async () => { await logout(); navigate("/login"); }}
                  title="Sign out">
                  <LogOut className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6 mt-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
          <Link href="/privacy">
            <span className="hover:text-foreground cursor-pointer transition-colors">Privacy</span>
          </Link>
          <Link href="/faq">
            <span className="hover:text-foreground cursor-pointer transition-colors">FAQ</span>
          </Link>
          <a href="mailto:support@echome.family" className="hover:text-foreground transition-colors">
            Contact: support@echome.family
          </a>
        </div>
      </footer>
    </div>
  );
}
