import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { updateSession } from '@/utils/supabase/middleware';

// This middleware ensures authentication is required for protected routes
export async function middleware(request: NextRequest) {
  try {
    console.log(`[Middleware] Processing request for path: ${request.nextUrl.pathname}`);
    
    // Log cookies for debugging
    const allCookies = request.cookies.getAll();
    console.log(`[Middleware] All cookies:`, allCookies.map(c => `${c.name}=${c.value.substring(0, 20)}...`));
    
    // Check for standard Supabase auth cookies
    const authCookies = ['sb-access-token', 'sb-refresh-token'];
    authCookies.forEach(cookieName => {
      const cookie = request.cookies.get(cookieName);
      console.log(`[Middleware] Cookie ${cookieName}: ${cookie ? 'Present' : 'Missing'}`);
    });
    
    // Create the Supabase client with proper cookie handling
    console.log('[Middleware] Creating Supabase client with updateSession');
    const { supabase, response } = updateSession(request);
    
    // Get the session - this refreshes the session if needed
    console.log('[Middleware] Fetching session with supabase.auth.getSession');
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('[Middleware] Error getting session:', error.message);
    }
    
    // Log session details for debugging
    console.log(`[Middleware] Session: ${session ? 'Authenticated' : 'Unauthenticated'}`);
    if (session) {
      console.log(`[Middleware] User ID: ${session.user.id}`);
      console.log(`[Middleware] Session expires at: ${new Date(session.expires_at! * 1000).toISOString()}`);
    }
    
    // Get the pathname from the request
    const path = request.nextUrl.pathname;
    
    // Public routes that don't require authentication
    const publicRoutes = ['/login', '/register', '/forgot-password', '/reset-password'];
    
    // Check if the current path is a public route
    const isPublicRoute = publicRoutes.some(route => path.startsWith(route));
    console.log(`[Middleware] Path ${path} is ${isPublicRoute ? 'public' : 'protected'}`);
    
    // If the route is not public and the user is not authenticated, redirect to login
    if (!isPublicRoute && !session) {
      console.log(`[Middleware] Redirecting unauthenticated user from ${path} to /login`);
      const redirectUrl = new URL('/login', request.url);
      return NextResponse.redirect(redirectUrl);
    }
    
    // If user is authenticated and trying to access login/register, redirect to home
    if (session && (path === '/login' || path === '/register')) {
      console.log(`[Middleware] Redirecting authenticated user from ${path} to /`);
      const redirectUrl = new URL('/', request.url);
      return NextResponse.redirect(redirectUrl);
    }
    
    console.log(`[Middleware] Continuing with request for ${path}`);
    // Continue with the request as normal for authenticated users or public routes
    return response;
  } catch (error) {
    console.error('[Middleware] Error processing request:', error);
    
    // In case of error, allow the request to proceed to avoid blocking the user
    // This prevents authentication errors from breaking the entire app
    return NextResponse.next();
  }
}

// Configure the middleware to run on specific paths
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     * - api routes
     */
    '/((?!_next/static|_next/image|favicon.ico|public/|api/).*)',
  ],
};
