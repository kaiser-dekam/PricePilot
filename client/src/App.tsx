import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import Landing from "@/pages/landing";
import SignIn from "@/pages/signin";
import TestAuth from "@/pages/test-auth";
import TestSimple from "@/pages/test-simple";
import Home from "@/pages/home";
import NotFound from "@/pages/not-found";
import Products from "@/pages/products";
import WorkOrders from "@/pages/work-orders";
import Settings from "@/pages/settings";
import CompanySetup from "@/pages/company-setup";
import Team from "@/pages/team";
import InvitationAccept from "@/pages/invitation-accept";
import Sidebar from "@/components/layout/sidebar";

function Router() {
  const { user, isAuthenticated, isLoading } = useAuth();

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

  // Handle non-authenticated users
  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/signin" component={SignIn} />
        <Route path="/test-auth" component={TestAuth} />
        <Route path="/test-simple" component={TestSimple} />
        <Route path="/invite/:token" component={InvitationAccept} />
        <Route component={Landing} />
      </Switch>
    );
  }

  // Handle users without a company
  if (isAuthenticated && user && !(user as any).companyId) {
    return (
      <Switch>
        <Route path="/invite/:token" component={InvitationAccept} />
        <Route component={CompanySetup} />
      </Switch>
    );
  }

  // Authenticated users with a company
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/products" component={Products} />
          <Route path="/work-orders" component={WorkOrders} />
          <Route path="/settings" component={Settings} />
          <Route path="/team" component={Team} />
          <Route path="/invite/:token" component={InvitationAccept} />
          <Route component={NotFound} />
        </Switch>
      </div>
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
