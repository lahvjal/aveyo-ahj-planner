'use client';

import React, { createContext, useContext } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { useClientAuth } from '@/hooks/useClientAuth';

// Define the UserProfile type to match the existing AuthContext
type UserProfile = {
  id: string;
  email: string;
  rep_id: string | null;
  role: 'admin' | 'rep';
};

// Define the AuthContextType to match the existing AuthContext
type AuthContextType = {
  session: Session | null;
  user: User | null;
  userProfile: UserProfile | null;
  isAdmin: boolean;
  isLoading: boolean;
  isProfileComplete: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
};

// Create the context with undefined as default value
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Modern AuthProvider that uses the useClientAuth hook
 * This provider maintains compatibility with the existing components
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Use our modern client-side auth hook
  const auth = useClientAuth();
  
  // The value provided to the context is the same as the existing AuthContext
  const value: AuthContextType = {
    session: auth.session,
    user: auth.user,
    userProfile: auth.userProfile,
    isAdmin: auth.isAdmin,
    isLoading: auth.isLoading,
    isProfileComplete: auth.isProfileComplete,
    signIn: auth.signIn,
    signOut: auth.signOut
  };
  
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to use the auth context
 * This hook maintains compatibility with the existing useAuth hook
 */
export function useAuth() {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
}
