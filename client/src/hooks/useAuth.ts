import { useState, useEffect } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useQuery } from '@tanstack/react-query';

export function useAuth() {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isFirebaseLoading, setIsFirebaseLoading] = useState(true);

  // Listen to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setIsFirebaseLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Get user data from backend when Firebase user exists
  const { data: backendUser, isLoading: isBackendLoading } = useQuery({
    queryKey: ['/api/auth/firebase-user'],
    enabled: !!firebaseUser && !isFirebaseLoading,
    retry: false,
  });

  const isLoading = isFirebaseLoading || (firebaseUser && isBackendLoading);
  const isAuthenticated = !!firebaseUser && !!backendUser;

  return {
    user: backendUser,
    firebaseUser,
    isLoading,
    isAuthenticated,
  };
}