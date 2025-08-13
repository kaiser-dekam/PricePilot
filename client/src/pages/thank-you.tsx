import { useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { Check, ArrowRight, Users, Zap, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ThankYouProps {}

export default function ThankYou({}: ThankYouProps) {
  const [, setLocation] = useLocation();
  
  // Get query parameters to determine which plan was purchased
  const urlParams = new URLSearchParams(window.location.search);
  const plan = urlParams.get('plan') || 'premium';

  // Track conversion for Google Ads
  useEffect(() => {
    // Google Ads conversion tracking
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'conversion', {
        'send_to': 'AW-CONVERSION_ID/CONVERSION_LABEL', // Replace with actual conversion ID
        'transaction_id': Math.random().toString(36).substring(7), // Generate unique transaction ID
      });
    }

    // Google Analytics purchase event
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'purchase', {
        'transaction_id': Math.random().toString(36).substring(7),
        'value': plan === 'starter' ? 5.00 : 10.00, // Starter $5, Premium $10
        'currency': 'USD',
        'items': [{
          'item_id': `catalog-pilot-${plan}`,
          'item_name': `Catalog Pilot ${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan`,
          'category': 'Software Subscription',
          'quantity': 1,
        }]
      });
    }
  }, []);

  const features = [
    {
      icon: <Zap className="h-5 w-5 text-blue-600" />,
      title: "Lightning Fast Sync",
      description: "Instantly sync all your BigCommerce products with real-time updates"
    },
    {
      icon: <Users className="h-5 w-5 text-green-600" />,
      title: "Team Collaboration", 
      description: "Invite team members and manage permissions across your organization"
    },
    {
      icon: <Shield className="h-5 w-5 text-purple-600" />,
      title: "Advanced Security",
      description: "Enterprise-grade security with Firebase authentication and encrypted data"
    }
  ];

  const nextSteps = [
    {
      step: 1,
      title: "Sync Your Products",
      description: "Connect to BigCommerce and import your entire product catalog",
      action: "Go to Settings"
    },
    {
      step: 2,
      title: "Create Work Orders",
      description: "Set up automated bulk price changes and schedule them for execution",
      action: "Create Work Order"
    },
    {
      step: 3,
      title: "Invite Your Team",
      description: "Add team members to collaborate on product management",
      action: "Manage Team"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        {/* Header Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full mb-6">
            <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Thank You for Your Purchase!
          </h1>
          
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-2">
            Welcome to Catalog Pilot {plan.charAt(0).toUpperCase() + plan.slice(1)}
          </p>
          
          <p className="text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
            You now have access to all premium features including unlimited products, 
            team collaboration, and advanced bulk editing tools to streamline your 
            BigCommerce product management.
          </p>
        </div>

        {/* Features Section */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {features.map((feature, index) => (
            <Card key={index} className="text-center border-0 shadow-lg">
              <CardHeader>
                <div className="flex justify-center mb-2">
                  {feature.icon}
                </div>
                <CardTitle className="text-lg">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{feature.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Next Steps Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-2xl text-center">Get Started in 3 Easy Steps</CardTitle>
            <CardDescription className="text-center">
              Here's how to make the most of your new Catalog Pilot subscription
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {nextSteps.map((step, index) => (
                <div key={index} className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                    <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                      {step.step}
                    </span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                      {step.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300 text-sm mb-3">
                      {step.description}
                    </p>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="text-sm"
                      onClick={() => {
                        if (step.step === 1) setLocation('/settings');
                        else if (step.step === 2) setLocation('/create-work-order');
                        else if (step.step === 3) setLocation('/team');
                      }}
                    >
                      {step.action}
                      <ArrowRight className="ml-2 h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* CTA Section */}
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
            Ready to Transform Your Product Management?
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Start by syncing your BigCommerce products and experience the power of automated bulk editing.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg"
              onClick={() => setLocation('/settings')}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Connect BigCommerce
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            
            <Button 
              variant="outline" 
              size="lg"
              onClick={() => setLocation('/')}
            >
              Go to Dashboard
            </Button>
          </div>
        </div>

        {/* Support Section */}
        <div className="mt-16 text-center">
          <Card className="border-0 bg-gray-50 dark:bg-gray-800/50">
            <CardContent className="pt-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                Need Help Getting Started?
              </h3>
              <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">
                Our team is here to help you get the most out of Catalog Pilot
              </p>
              <Link href="/feedback">
                <Button variant="ghost" size="sm">
                  Contact Support
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}