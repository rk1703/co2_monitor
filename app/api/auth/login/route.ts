import { NextResponse, NextRequest } from 'next/server';
import { Client } from 'ldapts';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import { 
  getClientIP, 
  isIPRateLimited, 
  isUsernameLocked, 
  recordFailedAttempt, 
  clearFailedAttempts 
} from '@/lib/auth-security';

type LoginBody = { username?: string; password?: string };

const isDev = process.env.NODE_ENV !== 'production';

const JWT_SECRET = process.env.JWT_SECRET as string;
if (!process.env.JWT_SECRET) {
  throw new Error('CRITICAL CONFIGURATION ERROR: JWT_SECRET environment variable is missing.');
}

/**
 * Search for user DN by username
 */
async function searchUserDN(client: Client, baseDN: string, username: string): Promise<string> {
  try {
    const searchResult = await client.search(baseDN, {
      filter: `(sAMAccountName=${username})`,
      scope: 'sub',
      attributes: ['dn'],
    });

    const entries = (searchResult as any).entries || [];
    if (searchResult.searchReferences.length === 0 && entries.length === 0) {
      throw new Error('User not found');
    }

    const userEntry = entries[0];
    if (!userEntry) {
      throw new Error('User not found');
    }

    return userEntry.dn;
  } catch (e: any) {
    throw new Error(`User search failed: ${e?.message || e}`);
  }
}

export async function POST(req: NextRequest) {
  const clientIP = getClientIP(req);
  const body: LoginBody = await req.json().catch(() => ({}));
  let { username, password } = body;
  
  console.log('[LOGIN] Received request:', { username, hasPassword: !!password, clientIP });
  
  // Sanitize: extract username before '@' if full email is provided
  if (username) {
    username = username.includes('@') ? username.split('@')[0] : username;
  }
  
  if (!username || !password) {
    console.log('[LOGIN] Missing credentials:', { username, password });
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 400 });
  }

  // Check rate limiting and account lockout
  if (await isIPRateLimited(clientIP)) {
    console.warn('[LOGIN] IP rate limited:', clientIP);
    return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 });
  }

  if (await isUsernameLocked(username)) {
    console.warn('[LOGIN] Username locked:', username);
    return NextResponse.json({ error: 'Invalid credentials or authentication service unavailable' }, { status: 401 });
  }

  const LDAP_URL = process.env.LDAP_URL;
  const LDAP_BIND_DN = process.env.LDAP_BIND_DN;
  const LDAP_BIND_PW = process.env.LDAP_BIND_PW;
  const LDAP_BASE_DN = process.env.LDAP_BASE_DN || '';
  const LDAP_DOMAIN = process.env.LDAP_DOMAIN || '';

  console.log('[LOGIN] LDAP config:', { 
    LDAP_URL, 
    LDAP_BIND_DN: !!LDAP_BIND_DN, 
    LDAP_BIND_PW: !!LDAP_BIND_PW,
    LDAP_BASE_DN,
    LDAP_DOMAIN 
  });

  if (!LDAP_URL) {
    const msg = 'LDAP is not configured';
    console.error('[LOGIN] Config error:', msg);
    return NextResponse.json({ error: 'Authentication service unavailable' }, { status: 500 });
  }

  /**
   * Attempt authentication against a specific LDAP URL
   */
  const attemptAuth = async (url: string): Promise<void> => {
    console.log('[LOGIN] Attempting auth with URL:', url);

    const tlsOptions: any = {
      rejectUnauthorized: process.env.LDAP_REJECT_UNAUTHORIZED !== 'false',
    };

    if (process.env.LDAP_CA_CERT_PATH) {
      try {
        tlsOptions.ca = fs.readFileSync(process.env.LDAP_CA_CERT_PATH);
      } catch (err) {
        console.error('[LOGIN] Failed to read LDAP CA cert file:', err);
      }
    } else if (process.env.LDAP_CA_CERT_CONTENT) {
      tlsOptions.ca = process.env.LDAP_CA_CERT_CONTENT;
    }

    const client = new Client({
      url,
      tlsOptions,
    });

    try {
      await client.bind('', '');
      console.log('[LOGIN] Connected to LDAP server');

      if (LDAP_BIND_DN && LDAP_BIND_PW) {
        // Service account bind to search for user
        console.log('[LOGIN] Attempting service account bind...');
        await client.bind(LDAP_BIND_DN, LDAP_BIND_PW);

        const userDN = await searchUserDN(client, LDAP_BASE_DN, username);
        console.log('[LOGIN] Found user DN, attempting user bind...');

        // Unbind and reconnect as the user
        await client.unbind();
        
        const userClient = new Client({
          url,
          tlsOptions,
        });

        await userClient.bind('', '');
        await userClient.bind(userDN, password);
        await userClient.unbind();
      } else {
        // No service account — try direct UPN bind
        if (!LDAP_DOMAIN) {
          throw new Error('LDAP_BIND_DN/PW missing and LDAP_DOMAIN unknown');
        }
        const userUPN = `${username}@${LDAP_DOMAIN}`;
        console.log('[LOGIN] Using UPN bind for user:', userUPN);
        
        const userClient = new Client({
          url,
          tlsOptions,
        });

        console.log('[LOGIN] Connecting to LDAP with anonymous bind...');
        await userClient.bind('', '');
        console.log('[LOGIN] Anonymous bind successful, attempting user bind with UPN...');
        await userClient.bind(userUPN, password);
        console.log('[LOGIN] UPN bind successful for:', userUPN);
        await userClient.unbind();
        await userClient.unbind();
      }

      await client.unbind();
    } catch (e: any) {
      try {
        await client.unbind();
      } catch (_) {
        /* ignore */
      }
      throw e;
    }
  };

  try {
    // First attempt with configured LDAP_URL
    try {
      await attemptAuth(LDAP_URL);
    } catch (e: any) {
      // If connection reset, try LDAPS fallback
      const msg = String(e?.message || e);
      const isConnReset = 
        e?.code === 'ECONNRESET' || 
        msg.includes('ECONNRESET') || 
        msg.includes('read ECONNRESET') ||
        msg.includes('socket hang up');

      if (isConnReset && LDAP_URL.startsWith('ldap://')) {
        const hostPort = LDAP_URL.replace(/^ldap:\/\//, '');
        const hostOnly = hostPort.split(':')[0];
        const ldapsUrl = `ldaps://${hostOnly}:636`;
        console.warn('[LOGIN] Connection reset, retrying with LDAPS...');
        await attemptAuth(ldapsUrl);
      } else {
        throw e;
      }
    }

    // Success - clear failed attempts and issue JWT
    await clearFailedAttempts(clientIP, username);
    
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '8h' });
    // Only set secure flag if actually using HTTPS
    const isHttps = req.nextUrl.protocol === 'https:' || req.headers.get('x-forwarded-proto') === 'https';
    console.log('[LOGIN] Authentication successful for user:', username);
    console.log('[LOGIN] Setting token cookie - secure:', isHttps, 'protocol:', req.nextUrl.protocol);
    
    const response = NextResponse.json({ ok: true });
    response.cookies.set({
      name: 'token',
      value: token,
      httpOnly: true,
      sameSite: 'lax',
      secure: isHttps,
      maxAge: 8 * 3600,
      path: '/',
    });
    console.log('[LOGIN] Cookie set, headers:', response.headers.get('set-cookie'));
    return response;
  } catch (e: any) {
    // Record failed attempt
    await recordFailedAttempt(clientIP, username);
    
    console.error('[LOGIN] Authentication error:', e?.message || e);
    if (e?.code) console.error('[LOGIN] Error code:', e.code);
    if (e?.stack) console.error('[LOGIN] Stack:', e.stack);

    // Return generic error to prevent credential/LDAP info leakage
    return NextResponse.json({ error: 'Invalid credentials or authentication service unavailable' }, { status: 401 });
  }
}
