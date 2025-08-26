import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { Check, Crown, Zap, Star } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useEffect, useState } from "react";

const PLANS = [
  {
    name: "Trial",
    price: "$0",
    period: "FREE during Labor Day Sale",
    description: "Perfect for getting started",
    productLimit: 5,
    features: [
      "Up to 5 products",
      "Bulk price updates",
      "Scheduled price updates",
      "Email support",
    ],
    icon: Star,
    popular: false,
  },
  {
    name: "Starter",
    price: "$0",
    period: "FREE during Labor Day Sale",
    description: "Great for small businesses",
    productLimit: 100,
    features: [
      "Up to 100 products",
      "Bulk price updates",
      "Scheduled price updates",
      "Email support",
    ],
    icon: Zap,
    popular: true,
  },
  {
    name: "Premium",
    price: "$0",
    period: "FREE during Labor Day Sale",
    description: "Best for growing businesses",
    productLimit: 1000,
    features: [
      "Up to 1,000 products",
      "Bulk price updates",
      "Scheduled price updates",
      "Catalog pricing backups",
      "Priority email support",
      "Team collaboration",
    ],
    icon: Crown,
    popular: false,
  },
];

export default function Subscription() {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: company } = useQuery({
    queryKey: ["/api/auth/user"],
    select: (data: any) => data?.company,
  });

  const currentPlan = company?.subscriptionPlan || "trial";
  const currentProductLimit = company?.productLimit || 5;

  const changePlanMutation = useMutation({
    mutationFn: (plan: string) =>
      apiRequest("POST", "/api/subscription/change", { plan }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Success",
        description: data.message || "Subscription plan updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update subscription plan",
        variant: "destructive",
      });
    },
  });

  const cancelSubscriptionMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/subscription/cancel", {}),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Subscription Cancelled",
        description: data.message || "Your subscription has been cancelled",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to cancel subscription",
        variant: "destructive",
      });
    },
  });

  // Handle URL parameters for payment success/cancel
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get("success");
    const canceled = urlParams.get("canceled");
    const plan = urlParams.get("plan");

    if (success === "true" && plan) {
      // Update the subscription plan after successful payment
      changePlanMutation.mutate(plan);
      toast({
        title: "Payment Successful!",
        description: `Successfully upgraded to ${plan.charAt(0).toUpperCase() + plan.slice(1)} plan`,
      });
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (canceled === "true") {
      toast({
        title: "Payment Canceled",
        description: "Your subscription change was canceled",
        variant: "destructive",
      });
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [changePlanMutation]);

  const getPlanTier = (planName: string): number => {
    const tiers = { trial: 0, starter: 1, premium: 2 };
    return tiers[planName.toLowerCase() as keyof typeof tiers] || 0;
  };

  const getButtonText = (planName: string): string => {
    const currentTier = getPlanTier(currentPlan);
    const targetTier = getPlanTier(planName);

    if (currentTier === targetTier) return "Current Plan";
    if (targetTier > currentTier) return `Upgrade to ${planName}`;
    return `Downgrade to ${planName}`;
  };

  const handlePlanChange = (planName: string) => {
    const planLower = planName.toLowerCase();
    const currentTier = getPlanTier(currentPlan);
    const targetTier = getPlanTier(planLower);

    // Handle downgrades (including to trial) - direct change, no payment needed
    if (targetTier <= currentTier) {
      const confirmMessage = `Are you sure you want to downgrade to ${planName}? This will reduce your product limit.`;
      if (window.confirm(confirmMessage)) {
        changePlanMutation.mutate(planLower);
      }
      return;
    }

    // Handle upgrades to paid plans - redirect to Stripe checkout
    if (
      targetTier > currentTier &&
      (planLower === "starter" || planLower === "premium")
    ) {
      const confirmMessage = `Upgrade to ${planName} plan? You'll be redirected to secure payment processing.`;
      if (window.confirm(confirmMessage)) {
        // Create checkout session and redirect to Stripe
        const payload: any = { plan: planLower };

        apiRequest("POST", "/api/subscription/checkout", payload)
          .then(async (response: Response) => {
            console.log("Raw checkout response:", response);

            // Parse JSON from the Response object
            const data = await response.json();
            console.log("Parsed checkout data:", data);

            if (data?.checkoutUrl) {
              console.log("Redirecting to:", data.checkoutUrl);
              // Try window.open first, then fallback to direct redirect
              const newWindow = window.open(data.checkoutUrl, '_self');
              if (!newWindow) {
                window.location.href = data.checkoutUrl;
              }
            } else {
              console.error("No checkout URL in parsed data:", data);
              toast({
                title: "Error",
                description: "No checkout URL received from server",
                variant: "destructive",
              });
            }
          })
          .catch((error: any) => {
            console.error("Checkout error:", error);
            toast({
              title: "Error",
              description: error.message || "Failed to start checkout process",
              variant: "destructive",
            });
          });
      }
    }
  };

  const handleCancelSubscription = () => {
    const confirmMessage = `Are you sure you want to cancel your ${currentPlan} subscription? This will downgrade you to the Trial plan at the end of your billing period.`;
    
    if (window.confirm(confirmMessage)) {
      cancelSubscriptionMutation.mutate();
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="container mx-auto px-6 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Labor Day Sale Banner */}
          <div className="bg-gradient-to-r from-red-600 to-blue-600 text-white py-4 px-6 rounded-lg mb-8 text-center">
            <h2 className="text-xl font-bold mb-1">🎉 Labor Day Sale!</h2>
            <p className="text-sm">All subscription plans are completely FREE until September 8th. Upgrade now at zero cost!</p>
          </div>
          
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Labor Day Special - All Plans FREE!
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Get full access to any plan at zero cost until September 8th. No credit card required!
            </p>
          </div>

          {/* Current Plan Status */}
          {company && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                    Current Plan:{" "}
                    {currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}
                  </h3>
                  <p className="text-blue-700 dark:text-blue-300">
                    You can manage up to {currentProductLimit} products
                  </p>
                </div>
                <Badge
                  variant="secondary"
                  className="bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100"
                >
                  Active
                </Badge>
                
                {/* Cancel Subscription Button for Paid Plans */}
                {currentPlan !== 'trial' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelSubscription}
                    disabled={cancelSubscriptionMutation.isPending}
                    className="ml-4 border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/20"
                  >
                    {cancelSubscriptionMutation.isPending ? "Cancelling..." : "Cancel Subscription"}
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-3 gap-8">
            {PLANS.map((plan) => {
              const IconComponent = plan.icon;
              const isCurrentPlan = currentPlan === plan.name.toLowerCase();

              return (
                <Card
                  key={plan.name}
                  className={`relative ${plan.popular ? "ring-2 ring-blue-500 shadow-lg" : ""} ${isCurrentPlan ? "bg-green-50 dark:bg-green-900/20" : ""}`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <Badge className="bg-blue-500 text-white">
                        Most Popular
                      </Badge>
                    </div>
                  )}

                  {isCurrentPlan && (
                    <div className="absolute -top-3 right-4">
                      <Badge className="bg-green-500 text-white">
                        Current Plan
                      </Badge>
                    </div>
                  )}

                  <CardHeader className="text-center pb-6">
                    <div className="w-12 h-12 mx-auto mb-4 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                      <IconComponent className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <CardTitle className="text-2xl">{plan.name}</CardTitle>
                    <CardDescription className="text-sm text-gray-600 dark:text-gray-400">
                      {plan.description}
                    </CardDescription>
                    <div className="mt-4">
                      <span className="text-4xl font-bold text-gray-900 dark:text-white">
                        {plan.price}
                      </span>
                      <span className="text-gray-600 dark:text-gray-400 ml-1">
                        /{plan.period}
                      </span>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-6">
                    <div className="text-center">
                      <Badge variant="outline" className="text-sm">
                        Up to {plan.productLimit} products
                      </Badge>
                    </div>

                    <ul className="space-y-3">
                      {plan.features.map((feature, index) => (
                        <li key={index} className="flex items-center text-sm">
                          <Check className="w-4 h-4 text-green-500 mr-3 flex-shrink-0" />
                          <span className="text-gray-700 dark:text-gray-300">
                            {feature}
                          </span>
                        </li>
                      ))}
                    </ul>

                    <Button
                      className="w-full"
                      variant={plan.popular ? "default" : "outline"}
                      disabled={isCurrentPlan || changePlanMutation.isPending}
                      onClick={() => handlePlanChange(plan.name)}
                    >
                      {changePlanMutation.isPending
                        ? "Updating..."
                        : getButtonText(plan.name)}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Subscription Management Section */}
          {currentPlan !== 'trial' && (
            <div className="mt-16">
              <Card className="border-red-200 dark:border-red-800">
                <CardHeader>
                  <CardTitle className="text-red-600 dark:text-red-400 flex items-center gap-2">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 9V13M12 17H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Cancel Your Subscription
                  </CardTitle>
                  <CardDescription>
                    Need to cancel your subscription? We're sorry to see you go.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                    <h4 className="font-medium text-red-800 dark:text-red-200 mb-2">What happens when you cancel:</h4>
                    <ul className="space-y-1 text-sm text-red-700 dark:text-red-300">
                      <li>• Your subscription continues until the end of your current billing period</li>
                      <li>• You'll keep access to all {currentPlan} features until then</li>
                      <li>• After that, you'll be automatically moved to the Trial plan (5 products)</li>
                      <li>• You can resubscribe anytime to regain access to premium features</li>
                      <li>• Your data and settings will be preserved</li>
                    </ul>
                  </div>
                  
                  <div className="flex items-center justify-between pt-4">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Questions? Contact our support team for assistance.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={handleCancelSubscription}
                      disabled={cancelSubscriptionMutation.isPending}
                      className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/20"
                    >
                      {cancelSubscriptionMutation.isPending ? "Cancelling..." : "Cancel Subscription"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* FAQ Section */}
          <div className="mt-16 text-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">
              Frequently Asked Questions
            </h2>
            <div className="grid md:grid-cols-2 gap-8 text-left">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                  Can I change plans anytime?
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Yes, you can upgrade or downgrade your plan at any time.
                  Changes take effect immediately.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                  What happens if I exceed my product limit?
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  You'll be prompted to upgrade your plan. Existing products
                  remain accessible, but you won't be able to add new ones.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                  Is there a free trial?
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  The Trial plan is completely free forever with up to 5
                  products. Perfect for testing our platform.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                  Do you offer refunds?
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Yes, we offer a 30-day money-back guarantee for all paid
                  plans. Contact support for assistance.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
