import { NextRequest, NextResponse } from 'next/server';

// Routes that require authentication
const PROTECTED_ROUTES = ['/dashboard', '/elaborate'];

// Routes that are always accessible
const PUBLIC_ROUTES = ['/login', '/api/auth/login', '/api/auth/logout', '/api/auth/check'];

export function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  console.log('[Middleware] Processing:', pathname);

  // Allow public routes and API routes (except protected endpoints)
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    console.log('[Middleware] Public route, allowing');
    return NextResponse.next();
  }

  // Check if route is protected
  const isProtected = PROTECTED_ROUTES.some(route => pathname.startsWith(route));

  if (!isProtected) {
    console.log('[Middleware] Not a protected route, allowing');
    return NextResponse.next();
  }

  // Get token from cookies
  const token = req.cookies.get('token')?.value;
  const allCookies = req.cookies.getAll ? req.cookies.getAll().map((c: any) => c.name) : [];
  console.log('[Middleware] Protected route:', pathname, 'Token present:', !!token, 'All cookies:', allCookies);

  if (!token) {
    // No token, redirect to login
    console.log('[Middleware] No token, redirecting to /login');
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Token exists, allow access (verification happens server-side in API routes)
  console.log('[Middleware] Token exists, allowing access');
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public files)
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};

export const runtime = 'nodejs';
