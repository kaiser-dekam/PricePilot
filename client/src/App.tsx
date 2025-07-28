import { Switch, Route } from "wouter";
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
import Sidebar from "@/components/layout/sidebar";

function Router() {
  const { user, isAuthenticated, isLoading, error } = useAuth();

  // Log authentication state for debugging
  console.log("Auth state:", { isAuthenticated, isLoading, hasUser: !!user, error });

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
        <Route path="/invite/:token" component={InvitationAccept} />
        <Route component={Landing} />
      </Switch>
    );
  }

  // Handle users without a company - redirect to company setup
  if (isAuthenticated && user && !(user as any).companyId) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Switch>
          <Route path="/invite/:token" component={InvitationAccept} />
          <Route path="/setup" component={CompanySetup} />
          <Route component={() => {
            // Auto-redirect to setup if user has no company
            window.location.href = '/setup';
            return <div>Redirecting...</div>;
          }} />
        </Switch>
      </div>
    );
  }

  // Authenticated users with a company
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden lg:ml-0 ml-0">
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
