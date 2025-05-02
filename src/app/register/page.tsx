'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/utils/supabaseClient';
import { useAuth } from '@/utils/AuthContext';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [salesRepId, setSalesRepId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validSalesRepIds, setValidSalesRepIds] = useState<string[]>([]);
  const { user } = useAuth();
  const router = useRouter();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      router.push('/');
    }
  }, [user, router]);

  // Fetch valid sales rep IDs from the dedicated sales_reps table
  useEffect(() => {
    const fetchValidSalesRepIds = async () => {
      try {
        // Get all active sales rep IDs from the sales_reps table
        const { data, error } = await supabase
          .from('sales_reps')
          .select('rep_id')
          .eq('active', 'active');

        if (error) {
          console.error('Error fetching sales rep IDs:', error);
          return;
        }

        // Extract the rep_id values
        const repIds = data.map(item => item.rep_id);
        setValidSalesRepIds(repIds);
        console.log('Valid sales rep IDs:', repIds);
      } catch (err) {
        console.error('Error in fetchValidSalesRepIds:', err);
      }
    };

    fetchValidSalesRepIds();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    // Validate inputs
    if (!email || !password || !confirmPassword || !salesRepId) {
      setError('All fields are required');
      setIsLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      setIsLoading(false);
      return;
    }

    // Validate sales rep ID against our list of valid IDs
    if (!validSalesRepIds.includes(salesRepId)) {
      setError('Invalid Sales Rep ID. Please check and try again.');
      setIsLoading(false);
      return;
    }

    try {
      // Register user with Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      if (data.user) {
        // Update the user's profile with the sales rep ID
        const { error: updateError } = await supabase
          .from('users')
          .update({ rep_id: salesRepId })
          .eq('id', data.user.id);

        if (updateError) {
          throw updateError;
        }

        // Redirect to login page
        router.push('/login?registered=true');
      }
    } catch (err: any) {
      console.error('Registration error:', err);
      setError(err.message || 'An error occurred during registration');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-black">
      <div className="w-full max-w-md p-8 space-y-8 bg-gray-900 rounded-xl shadow-2xl">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white">Create Account</h1>
          <p className="mt-2 text-gray-400">
            Register to access the AHJ Knock Planner
          </p>
        </div>

        {error && (
          <div className="p-4 rounded-md bg-red-900/50 text-red-200">
            {error}
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-300">
              Email Address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md shadow-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="your.email@example.com"
              disabled={isLoading}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md shadow-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="••••••••"
              disabled={isLoading}
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md shadow-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="••••••••"
              disabled={isLoading}
            />
          </div>

          <div>
            <label htmlFor="salesRepId" className="block text-sm font-medium text-gray-300">
              Sales Rep ID
            </label>
            <input
              id="salesRepId"
              name="salesRepId"
              type="text"
              required
              value={salesRepId}
              onChange={(e) => setSalesRepId(e.target.value)}
              className="mt-1 block w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md shadow-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter your Sales Rep ID"
              disabled={isLoading}
            />
            <p className="mt-1 text-sm text-gray-500">
              This is the ID assigned to you in the Podio system
            </p>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Registering...' : 'Register'}
            </button>
          </div>
        </form>

        <div className="text-center mt-4">
          <p className="text-sm text-gray-400">
            Already have an account?{' '}
            <Link href="/login" className="text-blue-400 hover:text-blue-300">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
