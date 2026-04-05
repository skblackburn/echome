import { Link, useLocation } from "wouter";
import { EchoMeWordmark } from "./EchoMeLogo";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sun, Moon } from "lucide-react";
import { useState, useEffect } from "react";

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
          <div className="flex items-center gap-2">
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
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
