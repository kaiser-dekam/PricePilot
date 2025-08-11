import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Clock, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";

export default function AcceptInvitation() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [invitation, setInvitation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get token from URL params
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  // Fetch invitation details
  useEffect(() => {
    if (!token) {
      setError('Invalid invitation link - no token provided');
      setLoading(false);
      return;
    }

    // Fetch invitation details (public endpoint - no auth needed)
    fetch(`/api/invitations/${token}`)
      .then(response => response.json())
      .then(data => {
        if (data.error || !data.invitation) {
          setError(data.message || 'Invitation not found or expired');
        } else {
          setInvitation(data.invitation);
        }
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load invitation details');
        setLoading(false);
      });
  }, [token]);

  const acceptMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/invitations/${token}/accept`),
    onSuccess: () => {
      toast({
        title: "Success!",
        description: "You've successfully joined the company.",
      });
      setLocation('/');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to accept invitation",
        variant: "destructive",
      });
    },
  });

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-gray-600">Loading invitation...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <CardTitle className="text-red-600">Invitation Error</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={() => setLocation('/')}>
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <CardTitle>Sign In Required</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-gray-600 mb-4">
              You need to sign in to accept this invitation to join <strong>{invitation?.companyName}</strong>.
            </p>
            <p className="text-sm text-gray-500 mb-4">
              After signing in, you'll be able to accept the invitation and join the company.
            </p>
            <Button onClick={() => window.location.href = '/api/login'}>
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <CardTitle>Company Invitation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            <p className="text-gray-600 mb-2">
              You've been invited to join
            </p>
            <h3 className="font-semibold text-lg text-gray-900 mb-2">
              {invitation?.companyName}
            </h3>
            <Badge variant="secondary" className="mb-4">
              Role: {invitation?.role}
            </Badge>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Invited by:</span>
              <span className="font-medium">{invitation?.inviterEmail}</span>
            </div>
            <div className="flex items-center justify-between text-sm mt-2">
              <span className="text-gray-600">Status:</span>
              <Badge variant={invitation?.status === 'pending' ? 'secondary' : 'outline'}>
                {invitation?.status}
              </Badge>
            </div>
            {invitation?.expiresAt && (
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-gray-600">Expires:</span>
                <span className="text-sm">
                  {new Date(invitation.expiresAt).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button 
              onClick={() => setLocation('/')} 
              variant="outline" 
              className="flex-1"
            >
              Cancel
            </Button>
            <Button 
              onClick={() => acceptMutation.mutate()}
              disabled={acceptMutation.isPending || invitation?.status !== 'pending'}
              className="flex-1"
            >
              {acceptMutation.isPending ? (
                <>
                  <Clock className="w-4 h-4 mr-2 animate-spin" />
                  Accepting...
                </>
              ) : (
                'Accept Invitation'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}