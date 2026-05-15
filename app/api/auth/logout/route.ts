import { NextRequest, NextResponse } from 'next/server';

const isDev = process.env.NODE_ENV !== 'production';

export async function POST(req: NextRequest) {
  const response = NextResponse.json({ ok: true });
  
  // Delete token cookie with matching attributes for reliability across all browsers
  response.cookies.set({
    name: 'token',
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
    path: '/',
  });
  
  if (isDev) console.log('[LOGOUT] User logged out');
  return response;
}
