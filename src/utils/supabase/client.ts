/**
 * Client-side Supabase client
 * 
 * This file provides a Supabase client for use in client components.
 * It's safe to import in client components as it doesn't use next/headers.
 */

import { createBrowserClient } from '@supabase/ssr';
import { supabaseUrl, supabaseAnonKey } from './config';

// Create a singleton instance of the Supabase client for client-side use
// Use standard Supabase SSR configuration that works with middleware
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

/**
 * Check if the Supabase connection is working
 * @returns Promise with connection status
 */
export async function checkSupabaseConnection() {
  try {
    console.log('[Supabase] Checking connection to Supabase...');
    const start = Date.now();
    
    // Try to get the server timestamp
    const { data, error } = await supabase.from('ahj').select('count(*)');
    
    const end = Date.now();
    const responseTime = end - start;
    
    if (error) {
      console.error('[Supabase] Connection check failed:', error.message);
      return {
        success: false,
        error: error.message,
        responseTime,
        url: supabaseUrl,
      };
    }
    
    console.log(`[Supabase] Connection successful (${responseTime}ms)`);
    return {
      success: true,
      responseTime,
      url: supabaseUrl,
    };
  } catch (error) {
    console.error('[Supabase] Connection check exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      url: supabaseUrl,
    };
  }
}
