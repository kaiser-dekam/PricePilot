import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CheckCircle, XCircle, Users, Loader2 } from "lucide-react";

export default function InvitationAccept() {
  const [, params] = useRoute("/invite/:token");
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'invalid'>('loading');
  const { toast } = useToast();

  const acceptInvitationMutation = useMutation({
    mutationFn: async (token: string) => {
      return await apiRequest(`/api/invitations/accept/${token}`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      setStatus('success');
      toast({
        title: "Invitation accepted",
        description: "Welcome to the team! You can now access the company dashboard.",
      });
      // Redirect to home after a delay
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    },
    onError: (error: Error) => {
      setStatus('error');
      toast({
        title: "Failed to accept invitation",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (!params?.token) {
      setStatus('invalid');
      return;
    }

    // Automatically accept the invitation
    acceptInvitationMutation.mutate(params.token);
  }, [params?.token]);

  const renderContent = () => {
    switch (status) {
      case 'loading':
        return (
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />
            </div>
            <h2 className="text-xl font-semibold">Processing invitation...</h2>
            <p className="text-gray-600 dark:text-gray-400">
              Please wait while we add you to the company.
            </p>
          </div>
        );

      case 'success':
        return (
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <CheckCircle className="h-12 w-12 text-green-500" />
            </div>
            <h2 className="text-xl font-semibold text-green-600 dark:text-green-400">
              Welcome to the team!
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Your invitation has been accepted successfully. You'll be redirected to the dashboard shortly.
            </p>
            <Button onClick={() => window.location.href = '/'}>
              Go to Dashboard
            </Button>
          </div>
        );

      case 'error':
        return (
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <XCircle className="h-12 w-12 text-red-500" />
            </div>
            <h2 className="text-xl font-semibold text-red-600 dark:text-red-400">
              Invitation failed
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              There was a problem accepting your invitation. It may have expired or already been used.
            </p>
            <Button 
              variant="outline" 
              onClick={() => params?.token && acceptInvitationMutation.mutate(params.token)}
              disabled={acceptInvitationMutation.isPending}
            >
              {acceptInvitationMutation.isPending ? "Retrying..." : "Try Again"}
            </Button>
          </div>
        );

      case 'invalid':
      default:
        return (
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <XCircle className="h-12 w-12 text-red-500" />
            </div>
            <h2 className="text-xl font-semibold text-red-600 dark:text-red-400">
              Invalid invitation
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              This invitation link is not valid. Please check the URL or contact your company administrator.
            </p>
            <Button onClick={() => window.location.href = '/'}>
              Go to Home
            </Button>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <Users className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
          <CardTitle>Company Invitation</CardTitle>
          <CardDescription>
            Join your team on BigCommerce Manager
          </CardDescription>
        </CardHeader>
        <CardContent>
          {renderContent()}
        </CardContent>
      </Card>
    </div>
  );
}