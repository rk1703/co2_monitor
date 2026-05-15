import { NextResponse } from 'next/server';
import ldap from 'ldapjs';
import jwt from 'jsonwebtoken';
import { 
  getClientIP, 
  isIPRateLimited, 
  isUsernameLocked, 
  recordFailedAttempt, 
  clearFailedAttempts 
} from '@/lib/auth-security';

type LoginBody = { username?: string; password?: string };

async function searchUserDN(client: ldap.Client, baseDN: string, username: string) {
  return new Promise<string>((resolve, reject) => {
    const opts: ldap.SearchOptions = { filter: `(sAMAccountName=${username})`, scope: 'sub', attributes: ['dn'] };
    client.search(baseDN, opts, (err, res) => {
      if (err) return reject(err);
      let userDN: string | null = null;
      res.on('searchEntry', (entry: any) => { userDN = entry.objectName; });
      res.on('error', (e: any) => reject(e));
      res.on('end', () => {
        if (!userDN) return reject(new Error('User not found'));
        resolve(userDN);
      });
    });
  });
}

const isDev = process.env.NODE_ENV !== 'production';

export async function POST(req: Request) {
  const clientIP = getClientIP(req);
  const body: LoginBody = await req.json().catch(() => ({}));
  let { username, password } = body;
  
  // Sanitize: extract username before '@' if full email is provided
  if (username) {
    username = username.includes('@') ? username.split('@')[0] : username;
  }
  
  if (!username || !password) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 400 });
  }

  // Check rate limiting and account lockout
  if (isIPRateLimited(clientIP)) {
    if (isDev) console.warn('[LOGIN] IP rate limited:', clientIP);
    return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 });
  }

  if (isUsernameLocked(username)) {
    if (isDev) console.warn('[LOGIN] Username locked:', username);
    // Return generic error to prevent account enumeration
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const LDAP_URL = process.env.LDAP_URL;
  const LDAP_BIND_DN = process.env.LDAP_BIND_DN;
  const LDAP_BIND_PW = process.env.LDAP_BIND_PW;
  const LDAP_BASE_DN = process.env.LDAP_BASE_DN || '';
  const LDAP_DOMAIN = process.env.LDAP_DOMAIN || '';
  const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

  if (!LDAP_URL) {
    const msg = 'LDAP is not configured';
    if (isDev) console.error('[LOGIN] Config error:', msg);
    return NextResponse.json({ error: 'Authentication service unavailable' }, { status: 500 });
  }

  // Helper to attempt authentication against a specific LDAP URL
  const attemptAuth = async (url: string) => {
    const client = ldap.createClient({ url, tlsOptions: { rejectUnauthorized: process.env.NODE_ENV === 'production' } });
    let authSucceeded = false;
    client.on('error', (err) => {
      // Ignore ECONNRESET that can occur when the server closes the socket after unbind
      if (err && err.code === 'ECONNRESET' && authSucceeded) return;
      // Only log verbose errors in dev to avoid exposing internal details
      if (isDev) console.error('[LOGIN] LDAP client error:', err?.message || err);
    });

    try {
      if (LDAP_BIND_DN && LDAP_BIND_PW) {
        // Bind with service account to search for user DN
        if (isDev) console.log('[LOGIN] Attempting service account bind...');
        await new Promise<void>((resolve, reject) => {
          client.bind(LDAP_BIND_DN, LDAP_BIND_PW, (err) => (err ? reject(err) : resolve()));
        });

        if (isDev) console.log('[LOGIN] Found user DN, attempting user bind...');
        const userDN = await searchUserDN(client, LDAP_BASE_DN, username);

        // Attempt to bind as the user with supplied password
        await new Promise<void>((resolve, reject) => {
          client.bind(userDN, password, (err) => (err ? reject(err) : resolve()));
        });
        authSucceeded = true;
      } else {
        // No service account provided — try direct UPN bind (username@DOMAIN)
        if (!LDAP_DOMAIN) {
          throw new Error('LDAP_BIND_DN/PW missing and LDAP_DOMAIN unknown');
        }
        if (isDev) console.log('[LOGIN] Using UPN bind for user:', username);
        const userUPN = `${username}@${LDAP_DOMAIN}`;
        await new Promise<void>((resolve, reject) => {
          client.bind(userUPN, password, (err) => (err ? reject(err) : resolve()));
        });
        authSucceeded = true;
      }
    } finally {
      try { client.unbind(); } catch (_) { /* ignore */ }
    }
  };

  try {
    // First attempt with configured LDAP_URL
    try {
      await attemptAuth(LDAP_URL);
    } catch (e: any) {
      // If connection was reset, try LDAPS fallback
      const msg = String(e?.message || e);
      const isConnReset = e?.code === 'ECONNRESET' || msg.includes('ECONNRESET') || msg.includes('read ECONNRESET');
      if (isConnReset && LDAP_URL.startsWith('ldap://')) {
        const hostPort = LDAP_URL.replace(/^ldap:\/\//, '');
        // Use default LDAPS port 636 unless a port is present
        const hostOnly = hostPort.split(':')[0];
        const ldapsUrl = `ldaps://${hostOnly}:636`;
        if (isDev) console.warn('[LOGIN] LDAP connection reset, retrying with LDAPS...');
        await attemptAuth(ldapsUrl);
      } else {
        throw e;
      }
    }

    // Success - issue JWT and set cookie
    clearFailedAttempts(clientIP, username);
    
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '8h' });
    const secure = process.env.NODE_ENV === 'production';
    if (isDev) console.log('[LOGIN] Authentication successful for user:', username);
    
    const response = NextResponse.json({ ok: true });
    response.cookies.set({
      name: 'token',
      value: token,
      httpOnly: true,
      sameSite: 'lax',
      secure: secure,
      maxAge: 8 * 3600,
      path: '/',
    });
    return response;
  } catch (e: any) {
    // Record failed attempt
    recordFailedAttempt(clientIP, username);
    
    // Log verbose errors only in dev; return generic message to clients
    if (isDev) {
      console.error('[LOGIN] Authentication error:', e?.message || e);
      if (e?.code) console.error('[LOGIN] Error code:', e.code);
    }
    // Return generic error to prevent credential/LDAP info leakage
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }
}
