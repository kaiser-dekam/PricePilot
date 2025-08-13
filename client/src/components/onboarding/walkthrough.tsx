import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, ArrowLeft, ArrowRight, CheckCircle } from "lucide-react";

interface WalkthroughStep {
  id: string;
  title: string;
  description: string;
  targetSelector?: string;
  content: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

interface WalkthroughProps {
  isVisible: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

export default function Walkthrough({ isVisible, onComplete, onSkip }: WalkthroughProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [highlightedElement, setHighlightedElement] = useState<HTMLElement | null>(null);

  const steps: WalkthroughStep[] = [
    {
      id: "welcome",
      title: "Welcome to Catalog Pilot!",
      description: "Let's take a quick tour of your BigCommerce product management dashboard",
      position: "center",
      content: (
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-primary" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L2 7v10c0 5.55 3.84 10 9 11 1.09-.21 2.08-.64 3-1.22 .92.58 1.91 1.01 3 1.22 5.16-1 9-5.45 9-11V7l-10-5z"/>
            </svg>
          </div>
          <p className="text-gray-600 dark:text-gray-300">
            Catalog Pilot helps you manage your BigCommerce products efficiently with bulk pricing updates, work orders, and team collaboration.
          </p>
        </div>
      )
    },
    {
      id: "products",
      title: "Products Page",
      description: "View and manage all your BigCommerce products",
      targetSelector: "[data-walkthrough='products-nav']",
      position: "bottom",
      content: (
        <div className="space-y-3">
          <p>Here you can:</p>
          <ul className="space-y-1 text-sm">
            <li>• Browse all your products with search and filtering</li>
            <li>• Switch between grid and list views</li>
            <li>• Edit individual product prices</li>
            <li>• Sync products from BigCommerce</li>
          </ul>
        </div>
      )
    },
    {
      id: "work-orders",
      title: "Work Orders",
      description: "Schedule bulk price changes for multiple products",
      targetSelector: "[data-walkthrough='work-orders-nav']",
      position: "bottom",
      content: (
        <div className="space-y-3">
          <p>Work orders let you:</p>
          <ul className="space-y-1 text-sm">
            <li>• Schedule price changes for future dates</li>
            <li>• Apply different prices to multiple products at once</li>
            <li>• Track execution status and history</li>
            <li>• Undo completed work orders if needed</li>
          </ul>
        </div>
      )
    },
    {
      id: "team",
      title: "Team Management",
      description: "Collaborate with your team members",
      targetSelector: "[data-walkthrough='team-nav']",
      position: "bottom",
      content: (
        <div className="space-y-3">
          <p>Team features include:</p>
          <ul className="space-y-1 text-sm">
            <li>• Invite team members to your company</li>
            <li>• Manage user roles and permissions</li>
            <li>• Company-wide product access</li>
            <li>• Shared work order management</li>
          </ul>
        </div>
      )
    },
    {
      id: "settings",
      title: "Settings & API",
      description: "Connect your BigCommerce store",
      targetSelector: "[data-walkthrough='settings-nav']",
      position: "bottom",
      content: (
        <div className="space-y-3">
          <p>Configure your setup:</p>
          <ul className="space-y-1 text-sm">
            <li>• Add BigCommerce API credentials</li>
            <li>• Set store hash and access token</li>
            <li>• Configure company preferences</li>
            <li>• Manage subscription settings</li>
          </ul>
        </div>
      )
    },
    {
      id: "complete",
      title: "You're All Set!",
      description: "Start by connecting your BigCommerce store in Settings",
      position: "center",
      content: (
        <div className="text-center space-y-4">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
          <p className="text-gray-600 dark:text-gray-300">
            You now know the basics of Catalog Pilot. Head to Settings to connect your BigCommerce store and start managing your products!
          </p>
        </div>
      )
    }
  ];

  useEffect(() => {
    if (!isVisible) return;

    const step = steps[currentStep];
    if (step.targetSelector) {
      const element = document.querySelector(step.targetSelector) as HTMLElement;
      if (element) {
        setHighlightedElement(element);
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } else {
      setHighlightedElement(null);
    }
  }, [currentStep, isVisible]);

  useEffect(() => {
    if (!isVisible) return;

    // Add overlay styles
    const overlay = document.createElement('div');
    overlay.id = 'walkthrough-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      z-index: 999;
      pointer-events: none;
    `;
    document.body.appendChild(overlay);

    return () => {
      const existingOverlay = document.getElementById('walkthrough-overlay');
      if (existingOverlay) {
        existingOverlay.remove();
      }
      if (highlightedElement) {
        highlightedElement.style.position = '';
        highlightedElement.style.zIndex = '';
        highlightedElement.style.boxShadow = '';
      }
    };
  }, [isVisible]);

  useEffect(() => {
    if (!highlightedElement) return;

    // Highlight the target element
    highlightedElement.style.position = 'relative';
    highlightedElement.style.zIndex = '1000';
    highlightedElement.style.boxShadow = '0 0 0 4px rgba(103, 146, 255, 0.5), 0 0 20px rgba(103, 146, 255, 0.3)';
    highlightedElement.style.borderRadius = '8px';

    return () => {
      if (highlightedElement) {
        highlightedElement.style.position = '';
        highlightedElement.style.zIndex = '';
        highlightedElement.style.boxShadow = '';
        highlightedElement.style.borderRadius = '';
      }
    };
  }, [highlightedElement]);

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const getCardPosition = () => {
    const step = steps[currentStep];
    if (!step.targetSelector || step.position === 'center') {
      return {
        position: 'fixed' as const,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1001
      };
    }

    if (highlightedElement) {
      const rect = highlightedElement.getBoundingClientRect();
      const cardWidth = 400;
      const cardHeight = 200;
      
      switch (step.position) {
        case 'bottom':
          return {
            position: 'fixed' as const,
            top: rect.bottom + 20,
            left: Math.max(20, Math.min(window.innerWidth - cardWidth - 20, rect.left + rect.width / 2 - cardWidth / 2)),
            zIndex: 1001
          };
        case 'top':
          return {
            position: 'fixed' as const,
            top: rect.top - cardHeight - 20,
            left: Math.max(20, Math.min(window.innerWidth - cardWidth - 20, rect.left + rect.width / 2 - cardWidth / 2)),
            zIndex: 1001
          };
        case 'right':
          return {
            position: 'fixed' as const,
            top: Math.max(20, rect.top + rect.height / 2 - cardHeight / 2),
            left: rect.right + 20,
            zIndex: 1001
          };
        case 'left':
          return {
            position: 'fixed' as const,
            top: Math.max(20, rect.top + rect.height / 2 - cardHeight / 2),
            left: rect.left - cardWidth - 20,
            zIndex: 1001
          };
      }
    }

    return {
      position: 'fixed' as const,
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      zIndex: 1001
    };
  };

  if (!isVisible) return null;

  const currentStepData = steps[currentStep];

  return (
    <div
      className="transition-opacity duration-300"
      style={getCardPosition()}
    >
        <Card className="w-96 max-w-[90vw] shadow-2xl border-primary/20">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  Step {currentStep + 1} of {steps.length}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onSkip}
                  className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <CardTitle className="text-lg">{currentStepData.title}</CardTitle>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {currentStepData.description}
            </p>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {currentStepData.content}
            
            <div className="flex justify-between items-center pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={prevStep}
                disabled={currentStep === 0}
                className="flex items-center gap-1"
              >
                <ArrowLeft className="w-4 h-4" />
                Previous
              </Button>
              
              <div className="flex gap-1">
                {steps.map((_, index) => (
                  <div
                    key={index}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      index === currentStep ? 'bg-primary' : 'bg-gray-300'
                    }`}
                  />
                ))}
              </div>
              
              <Button
                size="sm"
                onClick={nextStep}
                className="flex items-center gap-1"
              >
                {currentStep === steps.length - 1 ? 'Finish' : 'Next'}
                {currentStep < steps.length - 1 && <ArrowRight className="w-4 h-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
    </div>
  );
}