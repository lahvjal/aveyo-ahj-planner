/**
 * Middleware-specific Supabase client
 * 
 * This file provides functions for handling Supabase authentication in middleware.
 * It uses NextRequest and NextResponse for cookie handling.
 */

import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseUrl, supabaseAnonKey } from './config';

/**
 * Update the session in middleware
 * @param request NextRequest object
 * @returns Supabase client and response
 */
export function updateSession(request: NextRequest) {
  // Create a response object
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });
  
  // Create a Supabase client using the proper SSR approach
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          console.log(`[Supabase Middleware] Setting cookie ${name}`);
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  });
  
  return { supabase, response };
}
