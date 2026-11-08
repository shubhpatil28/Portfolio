import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

let dbInstance = null;
let initAttempted = false;

/**
 * Parses Firebase credentials from server-side environment variables.
 * Supports:
 * 1. FIREBASE_SERVICE_ACCOUNT (full JSON string or Base64 encoded JSON string)
 * 2. FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY (individual variables)
 */
function getServiceAccountCredentials() {
  const jsonString = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (jsonString && jsonString.trim()) {
    try {
      // Check if base64 encoded
      const trimmed = jsonString.trim();
      const decoded = trimmed.startsWith('{')
        ? trimmed
        : Buffer.from(trimmed, 'base64').toString('utf8');
      const credentials = JSON.parse(decoded);
      // Ensure private key has real newlines if escaped in environment variable
      if (credentials && credentials.private_key && typeof credentials.private_key === 'string') {
        credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
      }
      return credentials;
    } catch (parseError) {
      console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:', parseError.message);
      return null;
    }
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || 'shubhfolio-backend';
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (clientEmail && privateKey) {
    // Handle escaped newlines from environment strings (e.g. \n -> real newline)
    privateKey = privateKey.replace(/\\n/g, '\n');
    return {
      projectId,
      clientEmail,
      privateKey
    };
  }

  return null;
}

/**
 * Initializes and returns the Firestore instance.
 * Reuses active Firebase Admin app across serverless function invocations.
 */
export function getFirestoreDb() {
  if (dbInstance) {
    return dbInstance;
  }

  if (initAttempted) {
    return null;
  }

  initAttempted = true;
  const credentials = getServiceAccountCredentials();

  if (!credentials) {
    console.warn(
      'Firebase Admin credentials not found in environment variables. ' +
      'Firestore rate limiting is disabled; using in-memory fallback.'
    );
    return null;
  }

  try {
    const existingApps = getApps();
    const app = existingApps.length > 0
      ? existingApps[0]
      : initializeApp({
          credential: cert(credentials),
          projectId: credentials.projectId || credentials.project_id || 'shubhfolio-backend'
        });

    dbInstance = getFirestore(app);
    return dbInstance;
  } catch (error) {
    console.error('Failed to initialize Firebase Admin SDK:', error.message);
    dbInstance = null;
    return null;
  }
}

/**
 * Atomic Firestore Transaction for Rate Limiting & Duplicate Prevention.
 *
 * Enforces:
 * - Max 5 requests per IP per 10 minutes (600,000 ms window)
 * - Duplicate submission cooldown of 2 minutes (120,000 ms window)
 *
 * Returns: { allowed: boolean, reason?: 'rate_limited' | 'duplicate', count?: number }
 */
export async function executeFirestoreProtection({ db, ip, contentHash, now = Date.now() }) {
  const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
  const MAX_REQUESTS = 5;
  const DEDUPLICATION_WINDOW_MS = 2 * 60 * 1000; // 2 minutes

  // Sanitize IP for Firestore document ID (replace characters like : or /)
  const safeIpDocId = ip.replace(/[^a-zA-Z0-9_.-]/g, '_');

  const ipRateLimitRef = db.collection('contact_rate_limits').doc(safeIpDocId);
  const dedupRef = db.collection('contact_dedup').doc(contentHash);

  return await db.runTransaction(async (transaction) => {
    const [rateLimitDoc, dedupDoc] = await Promise.all([
      transaction.get(ipRateLimitRef),
      transaction.get(dedupRef)
    ]);

    // 1. Check Duplicate Submission
    if (dedupDoc.exists) {
      const dedupData = dedupDoc.data();
      const lastSeen = dedupData?.timestamp || 0;
      if (now - lastSeen < DEDUPLICATION_WINDOW_MS) {
        return {
          allowed: false,
          reason: 'duplicate',
          backend: 'firestore-transaction'
        };
      }
    }

    // 2. Check Rate Limit
    let count = 1;
    let windowStart = now;

    if (rateLimitDoc.exists) {
      const data = rateLimitDoc.data();
      const startTime = data?.windowStart || 0;
      const currentCount = data?.count || 0;

      if (now - startTime > RATE_LIMIT_WINDOW_MS) {
        // Window expired, start new window
        count = 1;
        windowStart = now;
      } else {
        // Within window
        count = currentCount + 1;
        windowStart = startTime;

        if (count > MAX_REQUESTS) {
          return {
            allowed: false,
            reason: 'rate_limited',
            count,
            backend: 'firestore-transaction'
          };
        }
      }
    }

    // 3. Atomically update rate limit and deduplication state
    // Use Firestore Timestamps for expiresAt so native Firestore TTL policies can auto-purge expired entries
    transaction.set(ipRateLimitRef, {
      ip,
      count,
      windowStart,
      lastRequestTime: now,
      expiresAt: Timestamp.fromMillis(windowStart + RATE_LIMIT_WINDOW_MS)
    });

    transaction.set(dedupRef, {
      contentHash,
      ip,
      timestamp: now,
      expiresAt: Timestamp.fromMillis(now + DEDUPLICATION_WINDOW_MS)
    });

    return {
      allowed: true,
      count,
      backend: 'firestore-transaction'
    };
  });
}