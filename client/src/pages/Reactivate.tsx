import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Check, Sparkles, Heart } from "lucide-react";
import { EchoMeLogo, EchoMeWordmark } from "@/components/EchoMeLogo";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const tiers = [
  {
    name: "Personal",
    key: "personal",
    monthlyPrice: 9,
    annualPrice: 89,
    monthlyPriceId: "price_1TMBkv8vT1Bw3iGUdGojRSkO",
    annualPriceId: "price_1TMBkw8vT1Bw3iGUqB6rTbmp",
    echoes: "1 Echo",
    messages: "Unlimited",
    features: ["1 Echo persona", "Unlimited messages", "Memory archive", "Voice recordings", "Document uploads", "Writing style analysis"],
  },
  {
    name: "Family",
    key: "family",
    monthlyPrice: 15,
    annualPrice: 149,
    monthlyPriceId: "price_1TMBkw8vT1Bw3iGUmtP8rs4J",
    annualPriceId: "price_1TMBkx8vT1Bw3iGUpWldtaK1",
    echoes: "5 Echoes",
    messages: "Unlimited",
    popular: true,
    features: ["Up to 5 Echo personas", "Unlimited messages", "Memory archive", "Voice recordings", "Document uploads", "Writing style analysis", "Family sharing & access codes"],
  },
  {
    name: "Legacy",
    key: "legacy",
    monthlyPrice: 22,
    annualPrice: 219,
    monthlyPriceId: "price_1TMBkx8vT1Bw3iGUrocyUuqD",
    annualPriceId: "price_1TMBky8vT1Bw3iGU4SvvuG58",
    echoes: "10 Echoes",
    messages: "Unlimited",
    features: ["Up to 10 Echo personas", "Unlimited messages", "Memory archive", "Voice recordings", "Document uploads", "Writing style analysis", "Family sharing & access codes", "Milestone messages"],
  },
];

export default function Reactivate() {
  const [isAnnual, setIsAnnual] = useState(false);
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [reactivatingFree, setReactivatingFree] = useState(false);
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const handleSelectPlan = async (tier: typeof tiers[0]) => {
    const priceId = isAnnual ? tier.annualPriceId : tier.monthlyPriceId;
    if (!priceId) return;

    setLoadingTier(tier.key);
    try {
      // Reactivate account status first
      await apiRequest("POST", "/api/account/reactivate");
      // Then create checkout session
      const res = await apiRequest("POST", "/api/create-checkout-session", { priceId });
      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch (err) {
      console.error("Checkout error:", err);
      toast({ title: "Error", description: "Could not start checkout. Please try again.", variant: "destructive" });
    } finally {
      setLoadingTier(null);
    }
  };

  const handleContinueFree = async () => {
    setReactivatingFree(true);
    try {
      await apiRequest("POST", "/api/account/reactivate");
      toast({ title: "Welcome back!", description: "Your account has been reactivated." });
      navigate("/");
    } catch (err) {
      toast({ title: "Error", description: "Could not reactivate account.", variant: "destructive" });
    } finally {
      setReactivatingFree(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center breathing">
              <EchoMeLogo size={28} className="text-primary" />
            </div>
          </div>
          <h1 className="font-display text-3xl font-semibold text-foreground mb-3">
            Welcome back!
          </h1>
          <div className="flex items-center justify-center gap-2 mb-2">
            <Heart className="h-4 w-4 text-primary" />
            <p className="text-lg text-muted-foreground">
              Your Echoes are still here.
            </p>
            <Heart className="h-4 w-4 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Choose a plan to reactivate your account and reconnect with your loved ones.
          </p>
        </div>

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <span className={`text-sm ${!isAnnual ? "text-foreground font-medium" : "text-muted-foreground"}`}>
            Monthly
          </span>
          <Switch checked={isAnnual} onCheckedChange={setIsAnnual} />
          <span className={`text-sm ${isAnnual ? "text-foreground font-medium" : "text-muted-foreground"}`}>
            Annual
          </span>
          {isAnnual && (
            <Badge variant="secondary" className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
              Save up to 17%
            </Badge>
          )}
        </div>

        {/* Tier cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          {tiers.map(tier => {
            const price = isAnnual ? tier.annualPrice : tier.monthlyPrice;
            const effectiveMonthly = isAnnual && tier.annualPrice > 0
              ? (tier.annualPrice / 12).toFixed(2)
              : null;

            return (
              <Card
                key={tier.key}
                className={`relative p-6 flex flex-col ${
                  tier.popular ? "ring-2 ring-primary shadow-lg" : ""
                }`}
              >
                {tier.popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground gap-1">
                    <Sparkles className="h-3 w-3" /> Most Popular
                  </Badge>
                )}

                <div className="mb-5">
                  <h3 className="font-display text-lg font-semibold text-foreground">{tier.name}</h3>
                  <div className="mt-3">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-foreground">
                        ${isAnnual ? effectiveMonthly : price}
                      </span>
                      <span className="text-sm text-muted-foreground">/mo</span>
                    </div>
                    {isAnnual && (
                      <p className="text-xs text-muted-foreground mt-1">
                        ${tier.annualPrice}/year billed annually
                      </p>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {tier.echoes} &middot; {tier.messages}
                  </p>
                </div>

                <ul className="space-y-2 flex-1 mb-6">
                  {tier.features.map(feature => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className="w-full"
                  variant={tier.popular ? "default" : "outline"}
                  disabled={loadingTier === tier.key}
                  onClick={() => handleSelectPlan(tier)}
                >
                  {loadingTier === tier.key ? "Redirecting..." : "Reactivate"}
                </Button>
              </Card>
            );
          })}
        </div>

        {/* Continue with free option */}
        <div className="text-center space-y-3">
          <Button
            variant="ghost"
            className="text-muted-foreground hover:text-foreground"
            onClick={handleContinueFree}
            disabled={reactivatingFree}
          >
            {reactivatingFree ? "Reactivating..." : "Continue with Free plan"}
          </Button>
          <div>
            <Button
              variant="link"
              className="text-xs text-muted-foreground/60 hover:text-muted-foreground"
              onClick={handleLogout}
            >
              Sign out instead
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
