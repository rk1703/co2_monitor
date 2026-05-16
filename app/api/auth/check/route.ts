import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const isDev = process.env.NODE_ENV !== 'production';

export async function GET(req: NextRequest) {
  const token = req.cookies.get('token')?.value;
  const allCookies = req.cookies.getAll ? req.cookies.getAll().map((c: any) => c.name) : [];
  console.log('[CHECK] Token present:', !!token, 'All cookies:', allCookies);

  if (!token) {
    console.log('[CHECK] No token present');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    jwt.verify(token, JWT_SECRET);
    console.log('[CHECK] Token verified');
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    console.log('[CHECK] Token verification failed:', e?.message);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
