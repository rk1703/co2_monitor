import { NextRequest, NextResponse } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET as string;
if (!process.env.JWT_SECRET) {
  throw new Error('CRITICAL CONFIGURATION ERROR: JWT_SECRET environment variable is missing.');
}

// Routes that require authentication
const PROTECTED_ROUTES = ['/dashboard', '/elaborate', '/api/data'];

// Routes that are always accessible
const PUBLIC_ROUTES = ['/login', '/api/auth/login', '/api/auth/logout', '/api/auth/check'];

function base64urlDecodeToUtf8(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

function base64urlDecodeToBytes(str: string): Uint8Array {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function verifyJwt(token: string, secret: string): Promise<any> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  // 1. Check expiration and decode payload
  const payloadStr = base64urlDecodeToUtf8(payloadB64);
  const payload = JSON.parse(payloadStr);
  
  if (payload.exp && Date.now() >= payload.exp * 1000) {
    throw new Error('Token expired');
  }

  // 2. Import secret key for HMAC
  const encoder = new TextEncoder();
  const secretKeyData = encoder.encode(secret);
  
  const key = await crypto.subtle.importKey(
    'raw',
    secretKeyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  // 3. Decode signature
  const signatureBytes = base64urlDecodeToBytes(signatureB64);

  // 4. Verify signature
  const data = encoder.encode(`${headerB64}.${payloadB64}`);
  const isValid = await crypto.subtle.verify(
    'HMAC',
    key,
    signatureBytes as any,
    data
  );

  if (!isValid) {
    throw new Error('Invalid signature');
  }

  return payload;
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  console.log('[Middleware] Processing:', pathname);

  // Allow public routes
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
    console.log('[Middleware] No token, unauthorized access to:', pathname);
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // No token, redirect to login
    return NextResponse.redirect(new URL('/login', req.url));
  }

  try {
    // Verify JWT using Web Crypto API (Edge-safe)
    await verifyJwt(token, JWT_SECRET);
    console.log('[Middleware] Token verified successfully for:', pathname);
    return NextResponse.next();
  } catch (e: any) {
    console.log('[Middleware] Token verification failed:', e?.message);
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Clear the invalid token and redirect to login
    const response = NextResponse.redirect(new URL('/login', req.url));
    response.cookies.delete('token');
    return response;
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public files)
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};
