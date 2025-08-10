import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Zap, Star } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const PLANS = [
  {
    name: "Trial",
    price: "$0",
    period: "forever",
    description: "Perfect for getting started",
    productLimit: 5,
    features: [
      "Up to 5 products",
      "Basic product management",
      "Work order scheduling",
      "Email support"
    ],
    icon: Star,
    popular: false
  },
  {
    name: "Starter",
    price: "$10",
    period: "per month",
    description: "Great for small businesses",
    productLimit: 10,
    features: [
      "Up to 10 products",
      "Advanced filtering & search",
      "Bulk price updates",
      "Work order automation",
      "Priority email support"
    ],
    icon: Zap,
    popular: true
  },
  {
    name: "Premium",
    price: "$20",
    period: "per month",
    description: "Best for growing businesses",
    productLimit: 1000,
    features: [
      "Up to 1,000 products",
      "Advanced analytics",
      "Custom work order templates",
      "API access",
      "Priority phone & email support",
      "Team collaboration"
    ],
    icon: Crown,
    popular: false
  }
];

export default function Subscription() {
  const { user } = useAuth();
  
  const { data: company } = useQuery({
    queryKey: ["/api/auth/user"],
    select: (data: any) => data?.company
  });

  const currentPlan = company?.subscriptionPlan || 'trial';
  const currentProductLimit = company?.productLimit || 5;

  const handleUpgrade = (planName: string) => {
    // TODO: Implement Stripe checkout
    console.log("Upgrading to", planName);
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="container mx-auto px-6 py-8">
        <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Choose Your Plan
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Scale your BigCommerce management with plans designed for businesses of all sizes
          </p>
        </div>

        {/* Current Plan Status */}
        {company && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                  Current Plan: {currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}
                </h3>
                <p className="text-blue-700 dark:text-blue-300">
                  You can manage up to {currentProductLimit} products
                </p>
              </div>
              <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100">
                Active
              </Badge>
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
                className={`relative ${plan.popular ? 'ring-2 ring-blue-500 shadow-lg' : ''} ${isCurrentPlan ? 'bg-green-50 dark:bg-green-900/20' : ''}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-blue-500 text-white">Most Popular</Badge>
                  </div>
                )}
                
                {isCurrentPlan && (
                  <div className="absolute -top-3 right-4">
                    <Badge className="bg-green-500 text-white">Current Plan</Badge>
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
                        <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    className="w-full"
                    variant={plan.popular ? "default" : "outline"}
                    disabled={isCurrentPlan}
                    onClick={() => handleUpgrade(plan.name)}
                  >
                    {isCurrentPlan ? "Current Plan" : `Upgrade to ${plan.name}`}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

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
                Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                What happens if I exceed my product limit?
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                You'll be prompted to upgrade your plan. Existing products remain accessible, but you won't be able to add new ones.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                Is there a free trial?
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                The Trial plan is completely free forever with up to 5 products. Perfect for testing our platform.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                Do you offer refunds?
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Yes, we offer a 30-day money-back guarantee for all paid plans. Contact support for assistance.
              </p>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}