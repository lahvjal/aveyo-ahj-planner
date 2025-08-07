/**
 * Server-side Supabase client
 * 
 * This file provides a Supabase client for use in server components and server actions.
 * It uses cookies() from next/headers, so it should only be imported in server components.
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { supabaseUrl, supabaseAnonKey } from './config';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';

/**
 * Create a Supabase client for server components with proper cookie handling
 * @returns Supabase client
 */
export function createClient() {
  try {
    return createServerComponentClient({
      cookies,
    });
  } catch (error) {
    console.error('[Supabase Server] Error creating server client:', error);
    
    // Fallback to basic client if server component client fails
    return createSupabaseClient(supabaseUrl, supabaseAnonKey);
  }
}
