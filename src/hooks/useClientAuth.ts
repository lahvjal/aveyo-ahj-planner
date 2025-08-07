'use client';

import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/utils/supabase';

type UserProfile = {
  id: string;
  email: string;
  rep_id: string | null;
  role: 'admin' | 'rep';
};

/**
 * Modern client-side auth hook that uses the Supabase client
 * This hook provides authentication state and methods for client components
 */
export function useClientAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isProfileComplete, setIsProfileComplete] = useState(false);

  // Fetch user profile from the users table with retry mechanism
  const fetchUserProfile = async (userId: string) => {
    const MAX_RETRIES = 3;
    let retryCount = 0;
    
    while (retryCount < MAX_RETRIES) {
      try {
        console.log(`[Auth] Attempting to fetch user profile (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        
        // Try to get profile from users table
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single();
        
        if (error) {
          console.warn(`[Auth] Error fetching user profile: ${error.message}`);
          
          // Try to get profile from profiles table as fallback
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
          
          if (profileError) {
            console.error(`[Auth] Error fetching from profiles table: ${profileError.message}`);
            retryCount++;
            
            if (retryCount < MAX_RETRIES) {
              // Wait before retrying (exponential backoff)
              await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
              continue;
            } else {
              console.error(`[Auth] Max retries reached. Unable to fetch user profile.`);
              return null;
            }
          }
          
          if (profileData) {
            console.log(`[Auth] User profile fetched from profiles table`);
            return profileData;
          }
        }
        
        if (data) {
          console.log(`[Auth] User profile fetched from users table`);
          return data;
        }
        
        // If we get here, no profile was found in either table
        retryCount++;
        
        if (retryCount < MAX_RETRIES) {
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
        } else {
          console.error(`[Auth] Max retries reached. No user profile found.`);
          return null;
        }
      } catch (error) {
        console.error(`[Auth] Unexpected error fetching user profile:`, error);
        retryCount++;
        
        if (retryCount < MAX_RETRIES) {
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
        } else {
          console.error(`[Auth] Max retries reached. Unable to fetch user profile.`);
          return null;
        }
      }
    }
    
    return null;
  };

  // Initialize auth state
  useEffect(() => {
    console.log('[Auth] Initializing auth state');
    
    const initAuth = async () => {
      try {
        // Get the current session
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        
        if (currentSession?.user) {
          console.log('[Auth] User is authenticated, fetching profile');
          const profile = await fetchUserProfile(currentSession.user.id);
          setUserProfile(profile);
          setIsAdmin(profile?.role === 'admin' || false);
          setIsProfileComplete(!!profile?.rep_id);
        } else {
          console.log('[Auth] No authenticated user');
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error('[Auth] Error initializing auth state:', error);
        setIsLoading(false);
      }
    };
    
    initAuth();
    
    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        console.log(`[Auth] Auth state changed: ${_event}`);
        setSession(newSession);
        setUser(newSession?.user ?? null);
        
        if (newSession?.user) {
          const profile = await fetchUserProfile(newSession.user.id);
          setUserProfile(profile);
          setIsAdmin(profile?.role === 'admin' || false);
          setIsProfileComplete(!!profile?.rep_id);
        } else {
          setUserProfile(null);
          setIsAdmin(false);
          setIsProfileComplete(false);
        }
        
        setIsLoading(false);
      }
    );
    
    // Clean up subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Sign in function
  const signIn = async (email: string, password: string) => {
    try {
      console.log('[Auth] Signing in user with email:', email);
      setIsLoading(true);
      
      // Check if Supabase client is initialized properly
      console.log('[Auth] Supabase client initialized:', !!supabase);
      
      // Attempt to sign in
      console.log('[Auth] Calling supabase.auth.signInWithPassword');
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) {
        console.error('[Auth] Sign in error:', error.message, error);
        setIsLoading(false);
        return { error };
      }
      
      // Log successful sign in with session data
      console.log('[Auth] Sign in successful, session:', data.session ? 'Session exists' : 'No session');
      console.log('[Auth] User:', data.user ? `ID: ${data.user.id}` : 'No user');
      
      // Log session details
      console.log('[Auth] Sign in successful, now checking session');
      
      // Verify that we have a session after login
      const { data: sessionData } = await supabase.auth.getSession();
      console.log('[Auth] Session after login:', sessionData.session ? 'Exists' : 'Missing');
      
      // Check if we have auth cookies
      if (typeof document !== 'undefined') {
        console.log('[Auth] Checking for auth cookies');
        const cookies = document.cookie.split(';').map(c => c.trim());
        // Look for Supabase auth token cookies (pattern: sb-{project-ref}-auth-token)
        const hasAuthCookie = cookies.some(c => c.match(/^sb-[a-z0-9]+-auth-token=/));
        console.log('[Auth] Auth cookies:', hasAuthCookie ? 'Found' : 'Missing');
        console.log('[Auth] Available cookies:', cookies.filter(c => c.startsWith('sb-')));
      }
      
      return { error: null };
    } catch (error) {
      console.error('[Auth] Unexpected sign in error:', error);
      setIsLoading(false);
      return { error };
    }
  };

  // Sign out function
  const signOut = async () => {
    try {
      console.log('[Auth] Signing out user');
      setIsLoading(true);
      
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('[Auth] Sign out error:', error.message);
      } else {
        console.log('[Auth] Sign out successful');
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('[Auth] Unexpected sign out error:', error);
      setIsLoading(false);
    }
  };

  return {
    session,
    user,
    userProfile,
    isAdmin,
    isLoading,
    isProfileComplete,
    signIn,
    signOut
  };
}
