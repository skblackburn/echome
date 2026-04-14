import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Check, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";

interface SubscriptionInfo {
  plan: string;
  planInterval: string | null;
  planExpiresAt: string | null;
  totalMessagesSent: number;
  cancelAtPeriodEnd: boolean;
  limits: { echoes: number; messages: number | null };
}

const tiers = [
  {
    name: "Free",
    key: "free",
    monthlyPrice: 0,
    annualPrice: 0,
    monthlyPriceId: null,
    annualPriceId: null,
    echoes: "1 Echo",
    messages: "20 messages",
    features: ["1 Echo persona", "20 total messages", "Memory archive", "Voice recordings"],
  },
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

export default function Pricing() {
  const [isAnnual, setIsAnnual] = useState(false);
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const { data: subscription } = useQuery<SubscriptionInfo>({
    queryKey: ["/api/subscription"],
    enabled: !!user,
  });

  const currentPlan = subscription?.plan || "free";

  const handleSelectPlan = async (tier: typeof tiers[0]) => {
    if (!user) {
      navigate("/register");
      return;
    }

    if (tier.key === "free" || tier.key === currentPlan) return;

    const priceId = isAnnual ? tier.annualPriceId : tier.monthlyPriceId;
    if (!priceId) return;

    setLoadingTier(tier.key);
    try {
      const res = await apiRequest("POST", "/api/create-checkout-session", { priceId });
      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch (err) {
      console.error("Checkout error:", err);
    } finally {
      setLoadingTier(null);
    }
  };

  const getButtonText = (tier: typeof tiers[0]) => {
    if (tier.key === currentPlan) return "Current Plan";
    if (tier.key === "free") return "Free";
    if (!user) return "Get Started";
    return "Upgrade";
  };

  return (
    <Layout backTo="/" backLabel="Home" title="Pricing">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="font-display text-3xl font-semibold text-foreground mb-3">
            Choose your plan
          </h1>
          <p className="text-muted-foreground text-base max-w-md mx-auto">
            Preserve the voices that matter most. Start free, upgrade anytime.
          </p>
        </div>

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-3 mb-10">
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {tiers.map(tier => {
            const isCurrent = tier.key === currentPlan;
            const price = isAnnual ? tier.annualPrice : tier.monthlyPrice;
            const effectiveMonthly = isAnnual && tier.annualPrice > 0
              ? (tier.annualPrice / 12).toFixed(2)
              : null;

            return (
              <Card
                key={tier.key}
                className={`relative p-6 flex flex-col ${
                  tier.popular
                    ? "ring-2 ring-primary shadow-lg"
                    : isCurrent
                    ? "ring-2 ring-primary/50"
                    : ""
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
                    {price === 0 ? (
                      <div className="text-3xl font-bold text-foreground">Free</div>
                    ) : (
                      <>
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
                      </>
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
                  variant={isCurrent ? "outline" : tier.popular ? "default" : "outline"}
                  disabled={isCurrent || loadingTier === tier.key}
                  onClick={() => handleSelectPlan(tier)}
                >
                  {loadingTier === tier.key ? "Redirecting..." : getButtonText(tier)}
                </Button>
              </Card>
            );
          })}
        </div>

        {/* Promo code note */}
        <div className="text-center mt-8 text-sm text-muted-foreground">
          Have a promo code? You can enter it at checkout.
        </div>
      </div>
    </Layout>
  );
}
