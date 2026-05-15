import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const isDev = process.env.NODE_ENV !== 'production';

export async function GET(req: NextRequest) {
  const token = req.cookies.get('token')?.value;

  if (!token) {
    if (isDev) console.log('[CHECK] No token present');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    jwt.verify(token, JWT_SECRET);
    if (isDev) console.log('[CHECK] Token verified');
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    if (isDev) console.log('[CHECK] Token verification failed:', e?.message);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
