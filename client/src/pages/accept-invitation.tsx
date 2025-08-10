import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, XCircle, Clock, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function AcceptInvitation() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [token, setToken] = useState<string | null>(null);
  const [invitationStatus, setInvitationStatus] = useState<'loading' | 'valid' | 'invalid' | 'accepted' | 'error'>('loading');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inviteToken = params.get('token');
    
    if (!inviteToken) {
      setInvitationStatus('invalid');
      return;
    }
    
    setToken(inviteToken);
    setInvitationStatus('valid');
  }, []);

  // Accept invitation mutation
  const acceptInvitationMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error('No token provided');
      return await apiRequest('POST', `/api/invitations/${token}/accept`);
    },
    onSuccess: () => {
      setInvitationStatus('accepted');
      toast({
        title: "Invitation Accepted",
        description: "Welcome to the team! You can now access the company dashboard.",
      });
      // Redirect to home after 2 seconds
      setTimeout(() => {
        setLocation('/');
      }, 2000);
    },
    onError: (error: any) => {
      setInvitationStatus('error');
      toast({
        title: "Error",
        description: error.message || "Failed to accept invitation",
        variant: "destructive",
      });
    },
  });

  const handleAcceptInvitation = () => {
    acceptInvitationMutation.mutate();
  };

  if (invitationStatus === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading invitation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {invitationStatus === 'valid' && (
            <>
              <div className="mx-auto w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-4">
                <Clock className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <CardTitle>Join Team</CardTitle>
              <CardDescription>
                You've been invited to join a team. Click below to accept the invitation.
              </CardDescription>
            </>
          )}
          
          {invitationStatus === 'accepted' && (
            <>
              <div className="mx-auto w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle>Welcome to the Team!</CardTitle>
              <CardDescription>
                Your invitation has been accepted. Redirecting to dashboard...
              </CardDescription>
            </>
          )}
          
          {(invitationStatus === 'invalid' || invitationStatus === 'error') && (
            <>
              <div className="mx-auto w-12 h-12 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mb-4">
                <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <CardTitle>Invalid Invitation</CardTitle>
              <CardDescription>
                This invitation link is invalid, expired, or has already been used.
              </CardDescription>
            </>
          )}
        </CardHeader>
        
        <CardContent className="text-center">
          {invitationStatus === 'valid' && (
            <Button 
              onClick={handleAcceptInvitation}
              disabled={acceptInvitationMutation.isPending}
              className="w-full"
            >
              {acceptInvitationMutation.isPending ? (
                'Accepting...'
              ) : (
                <>
                  Accept Invitation
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          )}
          
          {invitationStatus === 'accepted' && (
            <div className="space-y-3">
              <div className="animate-pulse">
                <div className="h-2 bg-green-200 dark:bg-green-800 rounded-full">
                  <div className="h-2 bg-green-600 dark:bg-green-400 rounded-full w-full transition-all duration-2000"></div>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Redirecting you to the dashboard...
              </p>
            </div>
          )}
          
          {(invitationStatus === 'invalid' || invitationStatus === 'error') && (
            <Button 
              onClick={() => setLocation('/')}
              variant="outline"
              className="w-full"
            >
              Go to Dashboard
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}