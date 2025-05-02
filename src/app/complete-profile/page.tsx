'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/utils/AuthContext';
import { supabase } from '@/utils/supabaseClient';

export default function CompleteProfilePage() {
  const [salesRepId, setSalesRepId] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const { user, isLoading } = useAuth();
  const router = useRouter();

  // Check if user already has a sales rep ID
  useEffect(() => {
    if (!isLoading && !user) {
      // Redirect to login if not authenticated
      router.push('/login');
      return;
    }

    if (user) {
      // Check if user already has a sales rep ID
      const checkProfile = async () => {
        const { data, error } = await supabase
          .from('users')
          .select('sales_rep_id')
          .eq('id', user.id)
          .single();

        if (data && data.sales_rep_id) {
          // User already has a sales rep ID, redirect to home
          router.push('/');
        }
      };

      checkProfile();
    }
  }, [user, isLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsValidating(true);

    if (!salesRepId.trim()) {
      setError('Please enter your Sales Rep ID');
      setIsValidating(false);
      return;
    }

    try {
      // First, check if the sales rep ID exists in podio_data
      const { data: repExists, error: checkError } = await supabase
        .from('podio_data')
        .select('sales_rep_id')
        .eq('sales_rep_id', salesRepId)
        .limit(1);

      if (checkError) {
        throw checkError;
      }

      // If no projects found with this sales rep ID, check if it's a valid format
      if (!repExists || repExists.length === 0) {
        // This is a simplified validation - you might want to add more specific rules
        if (salesRepId.length < 3) {
          setError('Invalid Sales Rep ID format. Please check and try again.');
          setIsValidating(false);
          return;
        }
      }

      // Update the user's profile with the sales rep ID
      const { error: updateError } = await supabase
        .from('users')
        .update({ sales_rep_id: salesRepId })
        .eq('id', user?.id);

      if (updateError) {
        throw updateError;
      }

      // Success!
      setSuccess(true);
      setTimeout(() => {
        router.push('/');
      }, 2000);
    } catch (err: any) {
      console.error('Error updating profile:', err);
      setError(err.message || 'An error occurred while updating your profile');
    } finally {
      setIsValidating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-black">
      <div className="w-full max-w-md p-8 space-y-8 bg-gray-900 rounded-xl shadow-2xl">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white">Complete Your Profile</h1>
          <p className="mt-2 text-gray-400">
            Please enter your Sales Rep ID to access your projects
          </p>
        </div>

        {error && (
          <div className="p-4 rounded-md bg-red-900/50 text-red-200">
            {error}
          </div>
        )}

        {success && (
          <div className="p-4 rounded-md bg-green-900/50 text-green-200">
            Profile updated successfully! Redirecting...
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
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
              disabled={isValidating || success}
            />
            <p className="mt-1 text-sm text-gray-500">
              This is the ID assigned to you in the Podio system
            </p>
          </div>

          <div>
            <button
              type="submit"
              disabled={isValidating || success}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isValidating ? 'Validating...' : 'Complete Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
