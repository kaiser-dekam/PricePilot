import { Switch, Route, Link } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Home from "@/pages/home";
import NotFound from "@/pages/not-found";
import Products from "@/pages/products";
import WorkOrders from "@/pages/work-orders";
import Settings from "@/pages/settings";
import Subscription from "@/pages/subscription";
import Team from "@/pages/team";
import AcceptInvitation from "@/pages/accept-invitation";
import Feedback from "@/pages/feedback";
import CreateWorkOrder from "@/pages/create-work-order";
import CategoryDemo from "@/pages/category-demo";
import ThankYou from "@/pages/thank-you";
import Sidebar from "@/components/layout/sidebar";
import Walkthrough from "@/components/onboarding/walkthrough";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import logoPath from "@assets/Artboard 1_1754940868643.png";

function Router() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  
  console.log("Auth state:", { isAuthenticated, isLoading, user: user?.email });

  // Fetch user profile to check walkthrough status
  const { data: userProfile } = useQuery({
    queryKey: ["/api/auth/user"],
    enabled: isAuthenticated,
    retry: false,
  });

  // Mark walkthrough as completed
  const markWalkthroughCompleteMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/auth/user/walkthrough-complete"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setShowWalkthrough(false);
    },
  });

  // Check if user should see walkthrough
  useEffect(() => {
    if (userProfile && !(userProfile as any).hasSeenWalkthrough && isAuthenticated) {
      // Show walkthrough after a brief delay to let the page load
      const timer = setTimeout(() => {
        setShowWalkthrough(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [userProfile, isAuthenticated]);

  const handleWalkthroughComplete = () => {
    markWalkthroughCompleteMutation.mutate();
  };

  const handleWalkthroughSkip = () => {
    markWalkthroughCompleteMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/login" component={Login} />
        <Route path="/accept-invitation" component={AcceptInvitation} />
        <Route component={Landing} />
      </Switch>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
      />
      <div className="flex-1 flex flex-col overflow-hidden lg:ml-0">
        {/* Mobile Header */}
        <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <Link href="/">
              <img
                src={logoPath}
                alt="Catalog Pilot"
                className="h-6 w-auto object-contain cursor-pointer hover:opacity-80 transition-opacity"
              />
            </Link>
          </div>
        </div>
        
        <div className="flex-1 overflow-auto">
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/products" component={Products} />
            <Route path="/work-orders" component={WorkOrders} />
            <Route path="/work-orders/create" component={CreateWorkOrder} />
            <Route path="/settings" component={Settings} />
            <Route path="/subscription" component={Subscription} />
            <Route path="/team" component={Team} />
            <Route path="/feedback" component={Feedback} />
            <Route path="/category-demo" component={CategoryDemo} />
            <Route path="/thank-you" component={ThankYou} />
            <Route path="/login" component={() => <div />} />
            <Route component={NotFound} />
          </Switch>
        </div>
      </div>

      {/* Walkthrough for new users */}
      <Walkthrough
        isVisible={showWalkthrough}
        onComplete={handleWalkthroughComplete}
        onSkip={handleWalkthroughSkip}
      />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
