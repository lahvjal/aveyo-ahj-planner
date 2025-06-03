import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

// This middleware ensures authentication is required for protected routes
export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const supabase = createMiddlewareClient({ req: request, res: response });
  
  // Check if user is authenticated
  const { data: { session } } = await supabase.auth.getSession();
  
  // Get the pathname from the request
  const path = request.nextUrl.pathname;
  
  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/register', '/forgot-password', '/reset-password'];
  
  // Check if the current path is a public route
  const isPublicRoute = publicRoutes.some(route => path.startsWith(route));
  
  // If the route is not public and the user is not authenticated, redirect to login
  if (!isPublicRoute && !session) {
    const redirectUrl = new URL('/login', request.url);
    return NextResponse.redirect(redirectUrl);
  }
  
  // If user is authenticated and trying to access login/register, redirect to home
  if (session && (path === '/login' || path === '/register')) {
    const redirectUrl = new URL('/', request.url);
    return NextResponse.redirect(redirectUrl);
  }
  
  // Continue with the request as normal for authenticated users or public routes
  return response;
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
