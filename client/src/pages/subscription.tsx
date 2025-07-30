import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Check, Crown, Zap, Shield, AlertCircle } from "lucide-react";
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

// Make sure to call `loadStripe` outside of a component's render to avoid
// recreating the `Stripe` object on every render.
// Support both naming conventions for environment variables
const stripePublicKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY || import.meta.env.VITE_Stripe_Public_Key;

if (!stripePublicKey) {
  throw new Error('Missing required Stripe key: VITE_STRIPE_PUBLIC_KEY or VITE_Stripe_Public_Key');
}
const stripePromise = loadStripe(stripePublicKey);

interface SubscriptionPlan {
  id: string;
  name: string;
  priceId: string;
  productLimit: number;
  price: number;
  interval: 'month' | 'year';
  features: string[];
}

const CheckoutForm = ({ onSuccess }: { onSuccess: () => void }) => {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.origin + '/subscription',
      },
    });

    setIsProcessing(false);

    if (error) {
      toast({
        title: "Payment Failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Payment Successful",
        description: "Your subscription has been activated!",
      });
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <Button 
        type="submit" 
        disabled={!stripe || isProcessing} 
        className="w-full"
      >
        {isProcessing ? "Processing..." : "Subscribe"}
      </Button>
    </form>
  );
};

export default function Subscription() {
  const { toast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  // Fetch available plans
  const { data: plans = [], isLoading: plansLoading } = useQuery<SubscriptionPlan[]>({
    queryKey: ['/api/subscription/plans'],
  });

  // Fetch current subscription
  const { data: currentSubscription, isLoading: subscriptionLoading } = useQuery<{
    currentPlan: string;
    productLimit: number;
    subscriptionStatus: string;
    currentPeriodEnd?: string;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
  }>({
    queryKey: ['/api/subscription/current'],
  });

  // Create subscription mutation
  const createSubscriptionMutation = useMutation({
    mutationFn: async (planId: string) => {
      const response = await apiRequest('POST', '/api/subscription/create', { planId });
      return await response.json();
    },
    onSuccess: (data: any) => {
      console.log("Subscription creation response:", data);
      if (data.clientSecret) {
        console.log("Setting clientSecret:", data.clientSecret);
        setClientSecret(data.clientSecret);
        setSelectedPlan(selectedPlan); // Make sure selectedPlan is set
      } else {
        // Trial plan success
        toast({
          title: "Plan Updated",
          description: "Your subscription plan has been updated successfully!",
        });
        queryClient.invalidateQueries({ queryKey: ['/api/subscription/current'] });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create subscription",
        variant: "destructive",
      });
    },
  });

  // Cancel subscription mutation
  const cancelSubscriptionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/subscription/cancel');
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Subscription Cancelled",
        description: "Your subscription has been cancelled successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/subscription/current'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to cancel subscription",
        variant: "destructive",
      });
    },
  });

  const handleSelectPlan = (planId: string) => {
    console.log("Selecting plan:", planId);
    setSelectedPlan(planId);
    createSubscriptionMutation.mutate(planId);
  };

  const handlePaymentSuccess = () => {
    setClientSecret(null);
    setSelectedPlan(null);
    queryClient.invalidateQueries({ queryKey: ['/api/subscription/current'] });
  };

  const getPlanIcon = (planId: string) => {
    switch (planId) {
      case 'trial': return <Zap className="h-6 w-6" />;
      case 'starter': return <Shield className="h-6 w-6" />;
      case 'premium': return <Crown className="h-6 w-6" />;
      default: return <Zap className="h-6 w-6" />;
    }
  };

  const getPlanColor = (planId: string) => {
    switch (planId) {
      case 'trial': return 'text-blue-600';
      case 'starter': return 'text-green-600';
      case 'premium': return 'text-purple-600';
      default: return 'text-blue-600';
    }
  };

  if (plansLoading || subscriptionLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Subscription Plans</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">Loading...</p>
        </div>
      </div>
    );
  }

  // If we have a client secret, show payment form
  console.log("Checking payment form conditions:", { clientSecret: !!clientSecret, selectedPlan });
  if (clientSecret && selectedPlan) {
    const plan = plans.find((p: SubscriptionPlan) => p.id === selectedPlan);
    console.log("Showing payment form for plan:", plan);
    
    return (
      <div className="max-w-md mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-center">Complete Your Subscription</h1>
          <p className="text-center text-gray-600 dark:text-gray-300 mt-2">
            {plan?.name} Plan - ${plan?.price}/month
          </p>
        </div>
        
        <Card>
          <CardContent className="p-6">
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <CheckoutForm onSuccess={handlePaymentSuccess} />
            </Elements>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Subscription Plans</h1>
        <p className="text-gray-600 dark:text-gray-300 mt-2 text-sm sm:text-base">
          Choose the perfect plan for your business needs
        </p>
      </div>

      {/* Current Plan Status */}
      {currentSubscription && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            You are currently on the <strong>{currentSubscription.currentPlan}</strong> plan 
            with a limit of <strong>{currentSubscription.productLimit} products</strong>.
            {currentSubscription.currentPeriodEnd && (
              <> Your subscription renews on {new Date(currentSubscription.currentPeriodEnd).toLocaleDateString()}.</>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Plans Grid - Mobile-first responsive */}
      <div className="flex flex-col sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {plans.map((plan: SubscriptionPlan) => {
          const isCurrentPlan = currentSubscription?.currentPlan === plan.id;
          const isUpgrade = plan.productLimit > (currentSubscription?.productLimit || 0);
          
          return (
            <Card key={plan.id} className={`relative ${isCurrentPlan ? 'ring-2 ring-blue-500' : ''} w-full`}>
              {isCurrentPlan && (
                <Badge className="absolute -top-2 left-1/2 transform -translate-x-1/2 z-10">
                  Current Plan
                </Badge>
              )}
              
              <CardHeader className="text-center pb-4">
                <div className={`mx-auto mb-3 ${getPlanColor(plan.id)}`}>
                  {getPlanIcon(plan.id)}
                </div>
                <CardTitle className="text-xl sm:text-2xl">{plan.name}</CardTitle>
                <CardDescription>
                  <span className="text-2xl sm:text-3xl font-bold">${plan.price}</span>
                  {plan.price > 0 && <span className="text-sm">/{plan.interval}</span>}
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-4 pt-0">
                <div className="text-center">
                  <p className="font-semibold text-sm sm:text-base">Up to {plan.productLimit} products</p>
                </div>
                
                <ul className="space-y-2">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-xs sm:text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <div className="pt-4">
                  {isCurrentPlan ? (
                    currentSubscription.subscriptionStatus === 'cancelled' ? (
                      <Button
                        onClick={() => handleSelectPlan(plan.id)}
                        disabled={createSubscriptionMutation.isPending}
                        className="w-full"
                      >
                        Reactivate Plan
                      </Button>
                    ) : plan.id !== 'trial' ? (
                      <Button
                        variant="destructive"
                        onClick={() => cancelSubscriptionMutation.mutate()}
                        disabled={cancelSubscriptionMutation.isPending}
                        className="w-full"
                      >
                        {cancelSubscriptionMutation.isPending ? "Cancelling..." : "Cancel Plan"}
                      </Button>
                    ) : (
                      <Button disabled className="w-full">
                        Current Plan
                      </Button>
                    )
                  ) : (
                    <Button
                      onClick={() => handleSelectPlan(plan.id)}
                      disabled={createSubscriptionMutation.isPending}
                      variant={isUpgrade ? "default" : "outline"}
                      className="w-full"
                    >
                      {createSubscriptionMutation.isPending && selectedPlan === plan.id
                        ? "Processing..."
                        : isUpgrade
                        ? "Upgrade"
                        : plan.price === 0
                        ? "Downgrade"
                        : "Switch Plan"
                      }
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Additional Information */}
      <div className="bg-gray-50 dark:bg-gray-800 p-4 sm:p-6 rounded-lg">
        <h3 className="font-semibold mb-2 text-sm sm:text-base">Plan Features Explained</h3>
        <ul className="space-y-1 text-xs sm:text-sm text-gray-600 dark:text-gray-300">
          <li>• <strong>Product Limit:</strong> Maximum number of products you can sync from BigCommerce</li>
          <li>• <strong>Basic/Advanced Sync:</strong> Different levels of synchronization features</li>
          <li>• <strong>Work Orders:</strong> Scheduled bulk price updates and automation</li>
          <li>• <strong>Team Collaboration:</strong> Invite team members to manage your store</li>
          <li>• <strong>Priority Support:</strong> Faster response times for support requests</li>
        </ul>
      </div>
    </div>
  );
}