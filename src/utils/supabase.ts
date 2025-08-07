/**
 * Supabase client entry point
 * 
 * This file re-exports client-safe Supabase functions and objects.
 * It's safe to import in client components.
 * 
 * IMPORTANT: For server components, import directly from:
 * import { createClient } from '@/utils/supabase/server';
 * 
 * For middleware, import directly from:
 * import { updateSession } from '@/utils/supabase/middleware';
 */

// Re-export client-side Supabase client and functions
export * from './supabase/client';
