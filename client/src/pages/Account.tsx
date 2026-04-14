import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { CreditCard, ExternalLink, Crown, AlertTriangle } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface SubscriptionInfo {
  plan: string;
  planInterval: string | null;
  planExpiresAt: string | null;
  totalMessagesSent: number;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  cancelAtPeriodEnd: boolean;
  limits: { echoes: number; messages: number | null };
}

const planNames: Record<string, string> = {
  free: "Free",
  personal: "Personal",
  family: "Family",
  legacy: "Legacy",
};

export default function Account() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [canceling, setCanceling] = useState(false);
  const [resuming, setResuming] = useState(false);

  const { data: subscription, isLoading } = useQuery<SubscriptionInfo>({
    queryKey: ["/api/subscription"],
    enabled: !!user,
  });

  const handleCancel = async () => {
    setCanceling(true);
    try {
      await apiRequest("POST", "/api/cancel-subscription");
      queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
      toast({ title: "Subscription canceled", description: "You'll keep access until the end of your billing period." });
    } catch (err) {
      toast({ title: "Error", description: String(err), variant: "destructive" });
    } finally {
      setCanceling(false);
    }
  };

  const handleResume = async () => {
    setResuming(true);
    try {
      await apiRequest("POST", "/api/resume-subscription");
      queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
      toast({ title: "Subscription resumed", description: "Your subscription will continue as normal." });
    } catch (err) {
      toast({ title: "Error", description: String(err), variant: "destructive" });
    } finally {
      setResuming(false);
    }
  };

  const handleManageBilling = async () => {
    try {
      const res = await apiRequest("POST", "/api/create-portal-session");
      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch (err) {
      toast({ title: "Error", description: "Could not open billing portal.", variant: "destructive" });
    }
  };

  const plan = subscription?.plan || "free";
  const isPaid = plan !== "free";
  const expiresAt = subscription?.planExpiresAt
    ? new Date(subscription.planExpiresAt).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <Layout backTo="/" backLabel="Home" title="Account">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="font-display text-2xl font-semibold text-foreground mb-6">Account Settings</h1>

        {/* User info */}
        <Card className="p-5 mb-5">
          <h2 className="text-sm font-medium text-muted-foreground mb-2">Profile</h2>
          <p className="text-foreground font-medium">{user?.name}</p>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        </Card>

        {/* Subscription info */}
        <Card className="p-5 mb-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-sm font-medium text-muted-foreground mb-2">Subscription</h2>
              <div className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-primary" />
                <span className="text-lg font-semibold text-foreground">{planNames[plan]} Plan</span>
                {isPaid && subscription?.planInterval && (
                  <Badge variant="outline" className="text-xs capitalize">
                    {subscription.planInterval === "year" ? "Annual" : "Monthly"}
                  </Badge>
                )}
              </div>
            </div>
            <Link href="/pricing">
              <Button variant="outline" size="sm">
                {isPaid ? "Change Plan" : "Upgrade"}
              </Button>
            </Link>
          </div>

          {/* Plan limits */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Echoes</p>
              <p className="text-sm font-medium text-foreground">
                {subscription?.limits?.echoes ?? 1} allowed
              </p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Messages</p>
              <p className="text-sm font-medium text-foreground">
                {subscription?.limits?.messages === null
                  ? "Unlimited"
                  : `${subscription?.totalMessagesSent ?? 0} / ${subscription?.limits?.messages ?? 20}`}
              </p>
            </div>
          </div>

          {/* Billing date */}
          {isPaid && expiresAt && !subscription?.cancelAtPeriodEnd && (
            <p className="text-sm text-muted-foreground">
              Next billing date: <span className="text-foreground">{expiresAt}</span>
            </p>
          )}

          {/* Cancellation notice */}
          {subscription?.cancelAtPeriodEnd && expiresAt && (
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 mb-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                    Your plan will downgrade to Free on {expiresAt}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300"
                    onClick={handleResume}
                    disabled={resuming}
                  >
                    {resuming ? "Resuming..." : "Resume Subscription"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-2 mt-4">
            {isPaid && subscription?.stripeCustomerId && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handleManageBilling}>
                <CreditCard className="h-4 w-4" />
                Manage Billing
                <ExternalLink className="h-3 w-3" />
              </Button>
            )}

            {isPaid && !subscription?.cancelAtPeriodEnd && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                    Cancel Subscription
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel your subscription?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure? You'll keep access to your {planNames[plan]} plan until{" "}
                      {expiresAt || "the end of your billing period"}. After that, your account will
                      be downgraded to the Free plan.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleCancel}
                      disabled={canceling}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {canceling ? "Canceling..." : "Yes, Cancel"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </Card>
      </div>
    </Layout>
  );
}
