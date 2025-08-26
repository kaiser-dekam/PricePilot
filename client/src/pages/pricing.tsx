import { Link, useLocation } from 'wouter';
import { Check, Zap, Star, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Navbar from '@/components/layout/navbar';
import { useAuth } from '@/hooks/useAuth';

interface PricingProps {}

export default function Pricing({}: PricingProps) {
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();

  const plans = [
    {
      name: 'Trial',
      price: 0,
      period: 'FREE during Labor Day Sale',
      description: 'Perfect for testing our platform with a small product catalog',
      icon: <Zap className="h-6 w-6 text-green-600" />,
      features: [
        'Up to 25 products',
        'Basic BigCommerce sync',
        'Manual price updates',
        'Email support',
        'Basic product management',
      ],
      limitations: [
        'No work orders/automation',
        'No team collaboration',
        'Limited to 25 products',
      ],
      buttonText: 'Get Free Access',
      buttonStyle: 'outline',
      popular: false,
    },
    {
      name: 'Starter',
      price: 0,
      period: 'FREE during Labor Day Sale',
      description: 'Ideal for small businesses ready to automate their pricing',
      icon: <Star className="h-6 w-6 text-blue-600" />,
      features: [
        'Up to 100 products',
        'Full BigCommerce integration',
        'Automated work orders',
        'Bulk price updates',
        'Price change history',
        'Basic team features (2 users)',
        'Priority email support',
      ],
      limitations: [],
      buttonText: 'Get Free Access',
      buttonStyle: 'default',
      popular: true,
    },
    {
      name: 'Premium',
      price: 0,
      period: 'FREE during Labor Day Sale',
      description: 'Complete solution for growing businesses with advanced needs',
      icon: <Crown className="h-6 w-6 text-purple-600" />,
      features: [
        'Up to 1,000 products',
        'Full BigCommerce integration',
        'Advanced work order scheduling',
        'Bulk operations & automation',
        'Complete price history tracking',
        'Full team collaboration (unlimited users)',
        'Advanced reporting',
        'Priority support & onboarding',
        'Custom integrations',
      ],
      limitations: [],
      buttonText: 'Get Free Access',
      buttonStyle: 'default',
      popular: false,
    },
  ];

  const handlePlanSelect = (planName: string) => {
    if (planName === 'Trial') {
      if (isAuthenticated) {
        setLocation('/');
      } else {
        setLocation('/login');
      }
    } else {
      if (isAuthenticated) {
        setLocation(`/subscription?upgrade=${planName.toLowerCase()}`);
      } else {
        setLocation('/login');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar isAuthenticated={isAuthenticated} />
      
      <div className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-16">
            {/* Labor Day Sale Banner */}
            <div className="bg-gradient-to-r from-red-600 to-blue-600 text-white py-3 px-6 rounded-lg mb-8 max-w-2xl mx-auto">
              <h2 className="text-lg font-bold mb-1">🎉 Labor Day Sale!</h2>
              <p className="text-sm">All plans are completely FREE until September 8th. No credit card required!</p>
            </div>
            
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Labor Day Special - Everything Free!
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Get full access to all plans at zero cost during our Labor Day Sale. 
              Choose any tier and start managing your BigCommerce products today!
            </p>
          </div>

          {/* Pricing Grid */}
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {plans.map((plan, index) => (
              <Card 
                key={plan.name} 
                className={`relative ${
                  plan.popular 
                    ? 'border-blue-500 shadow-lg scale-105' 
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white">
                    Most Popular
                  </Badge>
                )}
                
                <CardHeader className="text-center">
                  <div className="flex justify-center mb-4">
                    {plan.icon}
                  </div>
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <div className="mt-4">
                    <span className="text-4xl font-bold text-gray-900 dark:text-white">
                      ${plan.price}
                    </span>
                    <span className="text-gray-600 dark:text-gray-300 ml-2">
                      {plan.period}
                    </span>
                  </div>
                  <CardDescription className="mt-4 h-12">
                    {plan.description}
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  {/* Features */}
                  <div className="space-y-4 mb-6">
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
                        Included Features:
                      </h4>
                      <ul className="space-y-2">
                        {plan.features.map((feature, featureIndex) => (
                          <li key={featureIndex} className="flex items-start">
                            <Check className="h-4 w-4 text-green-600 mt-1 mr-3 flex-shrink-0" />
                            <span className="text-sm text-gray-600 dark:text-gray-300">
                              {feature}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Limitations (for Trial plan) */}
                    {plan.limitations.length > 0 && (
                      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
                          Limitations:
                        </h4>
                        <ul className="space-y-2">
                          {plan.limitations.map((limitation, limitationIndex) => (
                            <li key={limitationIndex} className="flex items-start">
                              <span className="h-4 w-4 text-gray-400 mt-1 mr-3 flex-shrink-0">•</span>
                              <span className="text-sm text-gray-500 dark:text-gray-400">
                                {limitation}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  <Button
                    onClick={() => handlePlanSelect(plan.name)}
                    variant={plan.buttonStyle as 'outline' | 'default'}
                    className={`w-full ${
                      plan.popular 
                        ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                        : ''
                    }`}
                  >
                    {plan.buttonText}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* FAQ Section */}
          <div className="mt-20">
            <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-12">
              Frequently Asked Questions
            </h2>
            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                  Can I change plans anytime?
                </h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately, 
                  and we'll prorate any billing differences.
                </p>
              </div>
              
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                  What happens if I exceed my product limit?
                </h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  We'll notify you when you approach your limit. You can upgrade your plan 
                  to continue syncing all your products without interruption.
                </p>
              </div>
              
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                  Is my BigCommerce data secure?
                </h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  Absolutely. We use enterprise-grade security with Firebase authentication 
                  and encrypted data storage. Your API keys and product data are fully protected.
                </p>
              </div>
              
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                  Do you offer refunds?
                </h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  We offer a 14-day free trial so you can test everything risk-free. 
                  For paid subscriptions, contact support for specific refund requests.
                </p>
              </div>
            </div>
          </div>

          {/* CTA Section */}
          <div className="mt-20 text-center">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-8">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                Ready to Streamline Your Product Management?
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
                Join hundreds of businesses already using Catalog Pilot to automate 
                their BigCommerce product pricing and save hours every week.
              </p>
              <div className="flex justify-center">
                <Button 
                  onClick={() => handlePlanSelect('Trial')}
                  size="lg"
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Start for Free
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}