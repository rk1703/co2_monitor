/**
 * Auth Security: Rate Limiting & Account Lockout
 * 
 * Tracks failed login attempts by:
 * 1. IP address (prevent brute force from same IP)
 * 2. Username (prevent targeting specific accounts)
 * 
 * Note: Uses in-memory storage. For production with multiple instances,
 * use Redis or a database-backed store.
 */

interface AttemptRecord {
  count: number;
  firstAttemptTime: number;
  lastAttemptTime: number;
  lockedUntil?: number;
}

// In-memory storage (consider Redis for production)
const ipAttempts = new Map<string, AttemptRecord>();
const usernameAttempts = new Map<string, AttemptRecord>();

// Configuration (can be moved to env vars)
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
export function isIPRateLimited(ip: string): boolean {
  const record = ipAttempts.get(ip);
  if (!record) return false;

  const now = Date.now();

  // Check if currently locked
  if (record.lockedUntil && now < record.lockedUntil) {
    return true;
  }

  // Check if outside window (reset)
  if (now - record.lastAttemptTime > CONFIG.IP_WINDOW_MS) {
    ipAttempts.delete(ip);
    return false;
  }

  // Check if exceeded limit
  return record.count >= CONFIG.IP_MAX_ATTEMPTS;
}

/**
 * Check if username is locked out
 */
export function isUsernameLocked(username: string): boolean {
  const record = usernameAttempts.get(username);
  if (!record) return false;

  const now = Date.now();

  // Check if currently locked
  if (record.lockedUntil && now < record.lockedUntil) {
    return true;
  }

  // Check if outside window (reset)
  if (now - record.lastAttemptTime > CONFIG.USERNAME_WINDOW_MS) {
    usernameAttempts.delete(username);
    return false;
  }

  return false;
}

/**
 * Record a failed login attempt for both IP and username
 */
export function recordFailedAttempt(ip: string, username: string): void {
  const now = Date.now();

  // Update IP attempts
  const ipRecord = ipAttempts.get(ip);
  if (ipRecord) {
    // Reset if outside window
    if (now - ipRecord.lastAttemptTime > CONFIG.IP_WINDOW_MS) {
      ipAttempts.set(ip, {
        count: 1,
        firstAttemptTime: now,
        lastAttemptTime: now,
      });
    } else {
      ipRecord.count++;
      ipRecord.lastAttemptTime = now;

      // Lock if exceeded
      if (ipRecord.count >= CONFIG.IP_MAX_ATTEMPTS && !ipRecord.lockedUntil) {
        ipRecord.lockedUntil = now + CONFIG.IP_LOCKOUT_MS;
      }
    }
  } else {
    ipAttempts.set(ip, {
      count: 1,
      firstAttemptTime: now,
      lastAttemptTime: now,
    });
  }

  // Update username attempts
  const userRecord = usernameAttempts.get(username);
  if (userRecord) {
    // Reset if outside window
    if (now - userRecord.lastAttemptTime > CONFIG.USERNAME_WINDOW_MS) {
      usernameAttempts.set(username, {
        count: 1,
        firstAttemptTime: now,
        lastAttemptTime: now,
      });
    } else {
      userRecord.count++;
      userRecord.lastAttemptTime = now;

      // Lock if exceeded
      if (userRecord.count >= CONFIG.USERNAME_MAX_ATTEMPTS && !userRecord.lockedUntil) {
        userRecord.lockedUntil = now + CONFIG.USERNAME_LOCKOUT_MS;
      }
    }
  } else {
    usernameAttempts.set(username, {
      count: 1,
      firstAttemptTime: now,
      lastAttemptTime: now,
    });
  }
}

/**
 * Clear failed attempts on successful login
 */
export function clearFailedAttempts(ip: string, username: string): void {
  ipAttempts.delete(ip);
  usernameAttempts.delete(username);
}

/**
 * Get current attempt counts (for debugging/monitoring)
 */
export function getAttemptStats(ip: string, username: string) {
  const ipRecord = ipAttempts.get(ip);
  const userRecord = usernameAttempts.get(username);
  
  return {
    ip: {
      attempts: ipRecord?.count ?? 0,
      locked: isIPRateLimited(ip),
      lockedUntil: ipRecord?.lockedUntil,
    },
    username: {
      attempts: userRecord?.count ?? 0,
      locked: isUsernameLocked(username),
      lockedUntil: userRecord?.lockedUntil,
    },
  };
}

/**
 * Cleanup old records periodically (prevent memory leak)
 * Call this from a scheduled task in production
 */
export function cleanupOldRecords(): void {
  const now = Date.now();
  const maxAge = Math.max(CONFIG.IP_WINDOW_MS, CONFIG.USERNAME_WINDOW_MS);

  for (const [ip, record] of ipAttempts.entries()) {
    if (now - record.lastAttemptTime > maxAge) {
      ipAttempts.delete(ip);
    }
  }

  for (const [username, record] of usernameAttempts.entries()) {
    if (now - record.lastAttemptTime > maxAge) {
      usernameAttempts.delete(username);
    }
  }
}

// Cleanup every 10 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    cleanupOldRecords();
  }, 10 * 60 * 1000);
}
