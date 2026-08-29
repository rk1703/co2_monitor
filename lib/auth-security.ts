import sql from 'mssql';
import { getPool } from '@/lib/db';

/**
 * Auth Security: Rate Limiting & Account Lockout
 * 
 * Tracks failed login attempts in the AUTH_ATTEMPTS database table by:
 * 1. IP address (prevent brute force from same IP)
 * 2. Username (prevent targeting specific accounts)
 * 
 * Note: Database-backed storage is used to support serverless and containerized scaling.
 */

// Configuration
const CONFIG = {
  IP_MAX_ATTEMPTS: 10,           // Max attempts per IP before temporary block
  IP_WINDOW_MS: 15 * 60 * 1000,  // 15 minute window for IP attempts
  IP_LOCKOUT_MS: 15 * 60 * 1000, // 15 minute lockout after exceeding limit

  USERNAME_MAX_ATTEMPTS: 5,           // Max failed attempts per username
  USERNAME_LOCKOUT_MS: 30 * 60 * 1000, // 30 minute account lockout
  USERNAME_WINDOW_MS: 60 * 60 * 1000,  // 1 hour window for username attempts
};

/**
 * Extract client IP from request headers
 */
export function getClientIP(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : req.headers.get('x-real-ip') || '0.0.0.0';
  return ip;
}

/**
 * Check if IP is rate limited
 */
export async function isIPRateLimited(ip: string): Promise<boolean> {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('ip', sql.NVarChar(150), ip)
      .query('SELECT ATTEMPT_COUNT, LAST_ATTEMPT_TIME, LOCKED_UNTIL FROM AUTH_ATTEMPTS WHERE TARGET_KEY = @ip');

    if (result.recordset.length === 0) return false;

    const record = result.recordset[0];
    const now = Date.now();

    // Check if currently locked
    if (record.LOCKED_UNTIL && now < new Date(record.LOCKED_UNTIL).getTime()) {
      return true;
    }

    // Check if outside window (reset)
    if (now - new Date(record.LAST_ATTEMPT_TIME).getTime() > CONFIG.IP_WINDOW_MS) {
      await pool.request()
        .input('ip', sql.NVarChar(150), ip)
        .query('DELETE FROM AUTH_ATTEMPTS WHERE TARGET_KEY = @ip');
      return false;
    }

    // Check if exceeded limit
    return record.ATTEMPT_COUNT >= CONFIG.IP_MAX_ATTEMPTS;
  } catch (err) {
    console.error('[AUTH SECURITY] Error checking IP rate limiting:', err);
    return false; // Fallback to allow access in case of database errors
  }
}

/**
 * Check if username is locked out
 */
export async function isUsernameLocked(username: string): Promise<boolean> {
  // Username lockout has been disabled per user request (only IP lockout is enforced)
  return false;
}

/**
 * Record a failed login attempt for a specific target key (IP or username)
 */
async function recordKeyFailedAttempt(key: string, maxAttempts: number, windowMs: number, lockoutMs: number): Promise<void> {
  try {
    const pool = await getPool();
    const now = new Date();
    const nowMs = now.getTime();

    const result = await pool.request()
      .input('key', sql.NVarChar(150), key)
      .query('SELECT ATTEMPT_COUNT, LAST_ATTEMPT_TIME, LOCKED_UNTIL FROM AUTH_ATTEMPTS WHERE TARGET_KEY = @key');

    if (result.recordset.length > 0) {
      const record = result.recordset[0];
      const lastAttemptTimeMs = new Date(record.LAST_ATTEMPT_TIME).getTime();

      if (nowMs - lastAttemptTimeMs > windowMs) {
        // Reset if outside window
        await pool.request()
          .input('key', sql.NVarChar(150), key)
          .input('now', sql.DateTime2, now)
          .query(`
            UPDATE AUTH_ATTEMPTS 
            SET ATTEMPT_COUNT = 1, FIRST_ATTEMPT_TIME = @now, LAST_ATTEMPT_TIME = @now, LOCKED_UNTIL = NULL
            WHERE TARGET_KEY = @key
          `);
      } else {
        const newCount = record.ATTEMPT_COUNT + 1;
        let lockedUntil: Date | null = record.LOCKED_UNTIL ? new Date(record.LOCKED_UNTIL) : null;

        if (newCount >= maxAttempts && !lockedUntil) {
          lockedUntil = new Date(nowMs + lockoutMs);
        }

        await pool.request()
          .input('key', sql.NVarChar(150), key)
          .input('count', sql.Int, newCount)
          .input('now', sql.DateTime2, now)
          .input('lockedUntil', sql.DateTime2, lockedUntil)
          .query(`
            UPDATE AUTH_ATTEMPTS 
            SET ATTEMPT_COUNT = @count, LAST_ATTEMPT_TIME = @now, LOCKED_UNTIL = @lockedUntil
            WHERE TARGET_KEY = @key
          `);
      }
    } else {
      // Insert new record
      await pool.request()
        .input('key', sql.NVarChar(150), key)
        .input('now', sql.DateTime2, now)
        .query(`
          INSERT INTO AUTH_ATTEMPTS (TARGET_KEY, ATTEMPT_COUNT, FIRST_ATTEMPT_TIME, LAST_ATTEMPT_TIME, LOCKED_UNTIL)
          VALUES (@key, 1, @now, @now, NULL)
        `);
    }
  } catch (err) {
    console.error('[AUTH SECURITY] Error recording failed attempt for key:', key, err);
  }
}

/**
 * Record failed login attempt for both IP and username
 */
export async function recordFailedAttempt(ip: string, username: string): Promise<void> {
  // Only record failed attempt for IP to prevent username blocking/denial of service
  await recordKeyFailedAttempt(ip, CONFIG.IP_MAX_ATTEMPTS, CONFIG.IP_WINDOW_MS, CONFIG.IP_LOCKOUT_MS);
}

/**
 * Clear failed attempts on successful login
 */
export async function clearFailedAttempts(ip: string, username: string): Promise<void> {
  try {
    const pool = await getPool();
    await pool.request()
      .input('ip', sql.NVarChar(150), ip)
      .input('username', sql.NVarChar(150), username)
      .query('DELETE FROM AUTH_ATTEMPTS WHERE TARGET_KEY = @ip OR TARGET_KEY = @username');
  } catch (err) {
    console.error('[AUTH SECURITY] Error clearing failed attempts:', err);
  }
}

/**
 * Get current attempt counts (for debugging/monitoring)
 */
export async function getAttemptStats(ip: string, username: string) {
  try {
    const pool = await getPool();
    const ipRes = await pool.request()
      .input('ip', sql.NVarChar(150), ip)
      .query('SELECT ATTEMPT_COUNT, LOCKED_UNTIL FROM AUTH_ATTEMPTS WHERE TARGET_KEY = @ip');
    const userRes = await pool.request()
      .input('username', sql.NVarChar(150), username)
      .query('SELECT ATTEMPT_COUNT, LOCKED_UNTIL FROM AUTH_ATTEMPTS WHERE TARGET_KEY = @username');

    const ipRecord = ipRes.recordset[0];
    const userRecord = userRes.recordset[0];

    const now = Date.now();

    return {
      ip: {
        attempts: ipRecord?.ATTEMPT_COUNT ?? 0,
        locked: ipRecord?.LOCKED_UNTIL ? now < new Date(ipRecord.LOCKED_UNTIL).getTime() : false,
        lockedUntil: ipRecord?.LOCKED_UNTIL ? new Date(ipRecord.LOCKED_UNTIL).getTime() : undefined,
      },
      username: {
        attempts: userRecord?.ATTEMPT_COUNT ?? 0,
        locked: userRecord?.LOCKED_UNTIL ? now < new Date(userRecord.LOCKED_UNTIL).getTime() : false,
        lockedUntil: userRecord?.LOCKED_UNTIL ? new Date(userRecord.LOCKED_UNTIL).getTime() : undefined,
      },
    };
  } catch (err) {
    console.error('[AUTH SECURITY] Error getting attempt stats:', err);
    return {
      ip: { attempts: 0, locked: false },
      username: { attempts: 0, locked: false },
    };
  }
}

/**
 * Cleanup old records (prevent database creep)
 */
export async function cleanupOldRecords(): Promise<void> {
  try {
    const pool = await getPool();
    const maxAgeMs = Math.max(CONFIG.IP_WINDOW_MS, CONFIG.USERNAME_WINDOW_MS);
    const cutoff = new Date(Date.now() - maxAgeMs);

    await pool.request()
      .input('cutoff', sql.DateTime2, cutoff)
      .query('DELETE FROM AUTH_ATTEMPTS WHERE LAST_ATTEMPT_TIME < @cutoff AND (LOCKED_UNTIL IS NULL OR LOCKED_UNTIL < GETDATE())');
  } catch (err) {
    console.error('[AUTH SECURITY] Error cleaning up old records:', err);
  }
}

// Cleanup every 10 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    cleanupOldRecords().catch(err => console.error('[AUTH SECURITY] Interval cleanup error:', err));
  }, 10 * 60 * 1000);
}
