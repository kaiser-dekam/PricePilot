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
      console.log("Firebase auth state changed:", !!user);
      setFirebaseUser(user);
      setIsFirebaseLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Get user data from backend when Firebase user exists
  const { data: backendUser, isLoading: isBackendLoading, error: backendError } = useQuery({
    queryKey: ['/api/auth/firebase-user'],
    enabled: !!firebaseUser && !isFirebaseLoading,
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  const isLoading = isFirebaseLoading || (firebaseUser && isBackendLoading);
  const isAuthenticated = !!firebaseUser && !!backendUser;

  // Debug logging
  useEffect(() => {
    console.log("Auth hook state:", {
      firebaseUser: !!firebaseUser,
      backendUser: !!backendUser,
      isFirebaseLoading,
      isBackendLoading,
      isLoading,
      isAuthenticated,
      backendError: backendError?.message
    });
  }, [firebaseUser, backendUser, isFirebaseLoading, isBackendLoading, isLoading, isAuthenticated, backendError]);

  return {
    user: backendUser,
    firebaseUser,
    isLoading,
    isAuthenticated,
    error: backendError,
  };
}