import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// This middleware ensures proper routing with Netlify for Next.js App Router
export function middleware(request: NextRequest) {
  // Continue with the request as normal
  return NextResponse.next();
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
