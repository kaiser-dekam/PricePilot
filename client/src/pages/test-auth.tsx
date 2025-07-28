import { useAuth } from "@/hooks/useAuth";
import { signInWithGoogle, signOutUser } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TestAuth() {
  const { user, isLoading, isAuthenticated } = useAuth();

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error("Sign in error:", error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  if (isLoading) {
    return <div>Loading auth state...</div>;
  }

  return (
    <div className="min-h-screen p-8">
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Firebase Auth Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <strong>Authenticated:</strong> {isAuthenticated ? "Yes" : "No"}
          </div>
          {user && (
            <div>
              <strong>User ID:</strong> {user.uid}<br/>
              <strong>Email:</strong> {user.email}
            </div>
          )}
          <div className="space-y-2">
            {!isAuthenticated ? (
              <Button onClick={handleSignIn} className="w-full">
                Sign In with Google
              </Button>
            ) : (
              <Button onClick={handleSignOut} variant="outline" className="w-full">
                Sign Out
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}