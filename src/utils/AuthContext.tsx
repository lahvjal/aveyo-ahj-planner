'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/utils/supabaseClient';
import { useRouter, usePathname } from 'next/navigation';

type UserProfile = {
  id: string;
  email: string;
  rep_id: string | null;
  role: 'admin' | 'rep';
};

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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isProfileComplete, setIsProfileComplete] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // Fetch user profile from the users table with retry mechanism
  const fetchUserProfile = async (userId: string) => {
    const MAX_RETRIES = 3;
    let retryCount = 0;
    
    while (retryCount < MAX_RETRIES) {
      try {
        console.log(`Attempting to fetch user profile (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single();

        if (error) {
          console.error(`Error fetching user profile (attempt ${retryCount + 1}/${MAX_RETRIES}):`, error);
          
          // If this is a network error or a temporary issue, retry
          if (error.code === 'PGRST116' || error.code === '23505' || error.message.includes('network')) {
            retryCount++;
            // Exponential backoff: 500ms, 1000ms, 2000ms
            const delay = Math.min(500 * Math.pow(2, retryCount), 4000);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          } else {
            // For other errors, don't retry
            return null;
          }
        }

        // Success - return the data
        return data as UserProfile;
      } catch (error) {
        console.error(`Exception in fetchUserProfile (attempt ${retryCount + 1}/${MAX_RETRIES}):`, error);
        retryCount++;
        
        if (retryCount >= MAX_RETRIES) {
          console.error('Max retries reached for fetchUserProfile');
          return null;
        }
        
        // Exponential backoff
        const delay = Math.min(500 * Math.pow(2, retryCount), 4000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    return null;
  };

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchUserProfile(session.user.id).then(profile => {
          setUserProfile(profile);
          setIsAdmin(profile?.role === 'admin' || false);
          setIsProfileComplete(!!profile?.rep_id);
          setIsLoading(false);
        });
      } else {
        setIsLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event: any, session: any) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          const profile = await fetchUserProfile(session.user.id);
          setUserProfile(profile);
          setIsAdmin(profile?.role === 'admin' || false);
          setIsProfileComplete(!!profile?.rep_id);
        }
        
        setIsLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [pathname, router]);

  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setIsLoading(false);
    return { error };
  };

  const signOut = async () => {
    setIsLoading(true);
    await supabase.auth.signOut();
    setUserProfile(null);
    setIsAdmin(false);
    setIsProfileComplete(false);
    setIsLoading(false);
    
    // Redirect to login page after logout
    window.location.href = '/login';
  };

  const value = {
    session,
    user,
    userProfile,
    isAdmin,
    isLoading,
    isProfileComplete,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Client component wrapper for the AuthProvider
export function AuthProviderWrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
