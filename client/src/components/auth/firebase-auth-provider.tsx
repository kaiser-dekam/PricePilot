import { signInWithGoogle, signOutUser } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface FirebaseAuthProviderProps {
  children: React.ReactNode;
}

export function FirebaseAuthProvider({ children }: FirebaseAuthProviderProps) {
  const { toast } = useToast();

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
      toast({
        title: "Success",
        description: "Successfully signed in with Google",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to sign in",
        variant: "destructive",
      });
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
      toast({
        title: "Success", 
        description: "Successfully signed out",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to sign out",
        variant: "destructive",
      });
    }
  };

  return (
    <div>
      {children}
      {/* Export auth functions for use in other components */}
      <script dangerouslySetInnerHTML={{
        __html: `
          window.firebaseSignIn = ${handleSignIn.toString()};
          window.firebaseSignOut = ${handleSignOut.toString()};
        `
      }} />
    </div>
  );
}

export { signInWithGoogle as handleSignIn, signOutUser as handleSignOut };