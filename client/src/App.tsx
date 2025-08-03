import { Switch, Route, useLocation } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import Landing from "@/pages/landing";
import SignIn from "@/pages/signin";
import Home from "@/pages/home";
import NotFound from "@/pages/not-found";
import Products from "@/pages/products";
import WorkOrders from "@/pages/work-orders";
import Settings from "@/pages/settings";
import CompanySetup from "@/pages/company-setup";
import Team from "@/pages/team";
import InvitationAccept from "@/pages/invitation-accept";
import Subscription from "@/pages/subscription";
import Sidebar from "@/components/layout/sidebar";

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location, navigate] = useLocation();

  useEffect(() => {
    if (isAuthenticated && location === "/") {
      navigate("/products");
    }
  }, [isAuthenticated, location, navigate]);

  return (
    <TooltipProvider>
      {isLoading ? (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-300">Loading...</p>
          </div>
        </div>
      ) : !isAuthenticated ? (
        <SignIn />
      ) : (
        <Sidebar>
          <Switch>
            <Route path="/" component={Landing} />
            <Route path="/home" component={Home} />
            <Route path="/products" component={Products} />
            <Route path="/work-orders" component={WorkOrders} />
            <Route path="/settings" component={Settings} />
            <Route path="/company-setup" component={CompanySetup} />
            <Route path="/team" component={Team} />
            <Route path="/invitation-accept" component={InvitationAccept} />
            <Route path="/subscription" component={Subscription} />
            <Route component={NotFound} />
          </Switch>
        </Sidebar>
      )}
      <Toaster />
    </TooltipProvider>
  );
}

function Router() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

export default Router;