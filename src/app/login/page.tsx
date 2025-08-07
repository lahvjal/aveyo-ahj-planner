'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/providers';

// Component to handle search params
function LoginContent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const { signIn, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Check for registration success message
  useEffect(() => {
    if (searchParams) {
      const registered = searchParams.get('registered');
      if (registered === 'true') {
        setMessage({ 
          text: 'Registration successful! Please sign in with your credentials.', 
          type: 'success' 
        });
      }
    }
  }, [searchParams]);

  // Redirect if already logged in
  useEffect(() => {
    console.log('[Login Page] User state changed:', user ? `Authenticated (${user.id})` : 'Not authenticated');
    if (user) {
      console.log('[Login Page] User is authenticated, redirecting to home page');
      router.push('/');
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('[Login] Attempting to sign in');
    setMessage(null); // Clear previous messages
    
    if (!email.trim() || !password.trim()) {
      console.log('[Login] Email or password is empty');
      setMessage({ text: 'Please enter your email and password', type: 'error' });
      return;
    }

    try {
      setLoginLoading(true); // Set our local loading state
      console.log('[Login] Calling signIn function');
      const { error } = await signIn(email, password);
      
      if (error) {
        console.error('[Login] Sign in error:', error.message);
        setMessage({ 
          text: `Authentication failed: ${error.message}`, 
          type: 'error' 
        });
        
        // Check for specific error types to provide better feedback
        if (error.message.includes('Invalid login credentials')) {
          setMessage({ 
            text: 'Invalid email or password. Please check your credentials and try again.', 
            type: 'error' 
          });
        } else if (error.message.includes('Email not confirmed')) {
          setMessage({ 
            text: 'Email not confirmed. Please check your inbox for a confirmation email.', 
            type: 'error' 
          });
        }
      } else {
        console.log('[Login] Sign in successful, waiting for redirect');
        setMessage({ text: 'Login successful! Redirecting...', type: 'success' });
      }
    } catch (error: any) {
      console.error('[Login] Unexpected error during sign in:', error);
      setMessage({ 
        text: `Login error: ${error.message || 'An unexpected error occurred'}`, 
        type: 'error' 
      });
    } finally {
      setLoginLoading(false); // Reset loading state regardless of outcome
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
      <div className="max-w-md w-full space-y-8 p-8 bg-gray-800 rounded-lg shadow-lg">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
            Sign in to your account
          </h2>
        </div>
        
        {message && (
          <div className={`rounded-md p-4 ${message.type === 'success' ? 'bg-green-900/50 text-green-200' : 'bg-red-900/50 text-red-200'}`}>
            <p>{message.text}</p>
          </div>
        )}
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email-address" className="sr-only">Email address</label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-600 placeholder-gray-500 text-white bg-gray-700 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-600 placeholder-gray-500 text-white bg-gray-700 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loginLoading}
              className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white ${
                loginLoading ? 'bg-blue-600 opacity-70 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
              }`}
            >
              {loginLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <Link href="/register" className="font-medium text-blue-400 hover:text-blue-300">
                Don't have an account? Register
              </Link>
            </div>
          </div>
          
          {/* Debug section - only visible in development */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-6 p-4 bg-gray-800 rounded text-xs overflow-auto max-h-40">
              <h3 className="font-bold text-blue-400">Debug Info</h3>
              <button 
                onClick={() => {
                  // Check auth status
                  const cookies = document.cookie.split(';').map(c => c.trim());
                  const hasAuthCookie = cookies.some(c => c.startsWith('sb-access-token=') || c.startsWith('sb-refresh-token='));
                  console.log('[Debug] Auth cookies:', hasAuthCookie ? 'Found' : 'Missing');
                  console.log('[Debug] Cookies:', cookies);
                  
                  // Try to get session
                  const { supabase } = require('@/utils/supabase');
                  supabase.auth.getSession().then(({ data }: { data: { session: any } }) => {
                    console.log('[Debug] Session:', data.session ? 'Exists' : 'Missing');
                    if (data.session) {
                      console.log('[Debug] User ID:', data.session.user.id);
                    }
                  });
                }}
                className="mt-2 bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs"
              >
                Check Auth Status
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

// Main component with Suspense boundary
export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-900">Loading...</div>}>
      <LoginContent />
    </Suspense>
  );
}
