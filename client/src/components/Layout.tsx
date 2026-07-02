import { Link, useLocation } from "wouter";
import { EchoMeWordmark } from "./EchoMeLogo";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sun, Moon, Settings, User, LogOut } from "lucide-react";
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
      {/* Header — simplified: Back ← | Title · Settings */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">

          {/* Left: back button or wordmark */}
          <div className="flex items-center gap-2 min-w-0">
            {backTo ? (
              <Link href={backTo}>
                <Button variant="ghost" size="sm" className="gap-1.5 -ml-2 text-muted-foreground hover:text-foreground px-2.5">
                  <ArrowLeft className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate max-w-[120px]">{backLabel || "Back"}</span>
                </Button>
              </Link>
            ) : (
              <Link href="/dashboard">
                <EchoMeWordmark className="text-foreground cursor-pointer hover:opacity-80 transition-opacity" />
              </Link>
            )}
            {title && (
              <>
                <span className="text-muted-foreground/50 hidden sm:inline select-none">·</span>
                <span className="text-sm font-medium text-foreground hidden sm:inline truncate max-w-[180px]">{title}</span>
              </>
            )}
          </div>

          {/* Right: actions + Settings + theme */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {actions}
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
              <Link href="/profile">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" title="Profile">
                  <User className="h-4 w-4" />
                </Button>
              </Link>
            )}
            {user && (
              <Link href="/settings">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" title="Settings">
                  <Settings className="h-4 w-4" />
                </Button>
              </Link>
            )}
            {user && (
              <Button
                variant="ghost" size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                title="Sign out"
                onClick={async () => { await logout(); window.location.href = "/#/"; }}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6 mt-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-3">
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
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
              Contact
            </a>
            {/* Marketing home — useful for sharing or reviewing the public page */}
            <Link href="/">
              <span className="hover:text-foreground cursor-pointer transition-colors">About Echo Me</span>
            </Link>
          </div>
          <p className="text-center text-xs text-muted-foreground/50">
            Echo Me — Family Legacy
          </p>
        </div>
      </footer>
    </div>
  );
}
