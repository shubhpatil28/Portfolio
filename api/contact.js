import { Resend } from 'resend';
import crypto from 'crypto';
import { getFirestoreDb, executeFirestoreProtection } from './_firebase.js';

// Configuration constants
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_REQUESTS_PER_WINDOW = 5;
const DEDUPLICATION_WINDOW_MS = 2 * 60 * 1000; // 2 minutes

// Local in-memory fallback stores (used only if Firebase credentials are unset or Firestore fails)
const localRateLimitMap = new Map();
const localRecentSubmissionsMap = new Map();

function purgeLocalExpiredEntries() {
  const now = Date.now();
  for (const [key, value] of localRateLimitMap.entries()) {
    if (now - value.startTime > RATE_LIMIT_WINDOW_MS) {
      localRateLimitMap.delete(key);
    }
  }
  for (const [key, timestamp] of localRecentSubmissionsMap.entries()) {
    if (now - timestamp > DEDUPLICATION_WINDOW_MS) {
      localRecentSubmissionsMap.delete(key);
    }
  }
}

/**
 * Extract connecting client IP with priority to trusted Vercel proxy headers:
 * 1. x-vercel-forwarded-for
 * 2. x-real-ip
 * 3. x-forwarded-for fallback
 * 4. req.socket.remoteAddress
 * 5. unknown-ip fallback
 *
 * Handles header values safely, including arrays and comma-separated values.
 */
function getClientIp(req) {
  const headers = req.headers || {};

  // 1. Vercel trusted client IP header
  const vercelForwarded = headers['x-vercel-forwarded-for'];
  if (vercelForwarded) {
    const raw = Array.isArray(vercelForwarded) ? vercelForwarded[0] : vercelForwarded;
    if (typeof raw === 'string') {
      const ip = raw.split(',')[0].trim();
      if (ip) return ip;
    }
  }

  // 2. Real IP header injected by proxy
  const realIp = headers['x-real-ip'];
  if (realIp) {
    const raw = Array.isArray(realIp) ? realIp[0] : realIp;
    if (typeof raw === 'string') {
      const ip = raw.split(',')[0].trim();
      if (ip) return ip;
    }
  }

  // 3. Standard x-forwarded-for fallback
  const forwarded = headers['x-forwarded-for'];
  if (forwarded) {
    const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    if (typeof raw === 'string') {
      const ip = raw.split(',')[0].trim();
      if (ip) return ip;
    }
  }

  // 4. Raw socket remote address
  if (req.socket?.remoteAddress && typeof req.socket.remoteAddress === 'string') {
    const ip = req.socket.remoteAddress.trim();
    if (ip) return ip;
  }

  // 5. Unknown fallback
  return 'unknown-ip';
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * In-memory fallback protection when Firestore is unavailable.
 */
function executeLocalFallbackProtection(ip, contentHash) {
  purgeLocalExpiredEntries();
  const now = Date.now();

  // Check duplicate
  const previousTime = localRecentSubmissionsMap.get(contentHash);
  if (previousTime && now - previousTime < DEDUPLICATION_WINDOW_MS) {
    return {
      allowed: false,
      reason: 'duplicate',
      backend: 'in-memory-fallback'
    };
  }

  // Check rate limit
  const rateData = localRateLimitMap.get(ip) || { count: 0, startTime: now };
  if (now - rateData.startTime > RATE_LIMIT_WINDOW_MS) {
    rateData.count = 1;
    rateData.startTime = now;
  } else {
    rateData.count += 1;
  }
  localRateLimitMap.set(ip, rateData);

  if (rateData.count > MAX_REQUESTS_PER_WINDOW) {
    return {
      allowed: false,
      reason: 'rate_limited',
      count: rateData.count,
      backend: 'in-memory-fallback'
    };
  }

  // Record submission
  localRecentSubmissionsMap.set(contentHash, now);

  return {
    allowed: true,
    count: rateData.count,
    backend: 'in-memory-fallback'
  };
}

export default async function handler(req, res) {
  // 1. Enforce POST method
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      error: 'Method not allowed. Only POST requests are supported.'
    });
  }

  // 2. Parse request body
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({
        success: false,
        error: 'Invalid JSON payload received.'
      });
    }
  }

  if (!body || typeof body !== 'object') {
    return res.status(400).json({
      success: false,
      error: 'Malformed request body.'
    });
  }

  const { name, email, message, _hp_company } = body;

  // 3. Honeypot check (bots fill hidden fields; humans do not)
  if (_hp_company && String(_hp_company).trim().length > 0) {
    // Return a 200 response to misguide automated spammers without dispatching emails
    return res.status(200).json({
      success: true,
      message: 'Thank you for your message.'
    });
  }

  // 4. Validate fields
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  const trimmedEmail = typeof email === 'string' ? email.trim() : '';
  const trimmedMessage = typeof message === 'string' ? message.trim() : '';

  if (!trimmedName || !trimmedEmail || !trimmedMessage) {
    return res.status(400).json({
      success: false,
      error: 'Please fill out all required fields: name, email, and message.'
    });
  }

  if (trimmedName.length < 2 || trimmedName.length > 100) {
    return res.status(400).json({
      success: false,
      error: 'Name must be between 2 and 100 characters.'
    });
  }

  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (trimmedEmail.length > 254 || !emailRegex.test(trimmedEmail)) {
    return res.status(400).json({
      success: false,
      error: 'Please provide a valid email address.'
    });
  }

  if (trimmedMessage.length < 10 || trimmedMessage.length > 3000) {
    return res.status(400).json({
      success: false,
      error: 'Message must be between 10 and 3,000 characters.'
    });
  }

  // 5. Client IP & Content Hash
  const ip = getClientIp(req);
  const contentHash = crypto
    .createHash('sha256')
    .update(`${ip}:${trimmedName.toLowerCase()}:${trimmedEmail.toLowerCase()}:${trimmedMessage}`)
    .digest('hex');

  // 6. Atomic Firestore Protection (Rate limiting & Deduplication)
  const db = getFirestoreDb();
  let protectionResult = null;

  if (db) {
    try {
      protectionResult = await executeFirestoreProtection({
        db,
        ip,
        contentHash,
        now: Date.now()
      });
    } catch (firestoreError) {
      console.warn(
        'Firestore transaction failed. Safely falling back to local in-memory protection:',
        firestoreError.message
      );
      protectionResult = executeLocalFallbackProtection(ip, contentHash);
    }
  } else {
    protectionResult = executeLocalFallbackProtection(ip, contentHash);
  }

  if (!protectionResult.allowed) {
    if (protectionResult.reason === 'duplicate') {
      return res.status(409).json({
        success: false,
        error: 'A duplicate message was recently received. Please wait before resending.',
        backend: protectionResult.backend
      });
    }

    if (protectionResult.reason === 'rate_limited') {
      return res.status(429).json({
        success: false,
        error: 'Too many messages sent. Please wait a few minutes before trying again.',
        backend: protectionResult.backend
      });
    }
  }

  // 7. Server-side Resend API key check
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    console.error('RESEND_API_KEY environment variable is not configured.');
    return res.status(500).json({
      success: false,
      error: 'Email service configuration error. Please email directly at shubhampatil282487@gmail.com.'
    });
  }

  // 8. Resend SDK Integration
  try {
    const resend = new Resend(apiKey);
    const sanitizedName = escapeHtml(trimmedName);
    const sanitizedEmail = escapeHtml(trimmedEmail);
    const sanitizedMessage = escapeHtml(trimmedMessage).replace(/\n/g, '<br/>');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b1020; color: #f5f7ff; margin: 0; padding: 24px; }
            .card { background-color: #12182d; border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 16px; padding: 24px; max-width: 600px; margin: 0 auto; box-shadow: 0 10px 30px rgba(0,0,0,0.4); }
            .header { border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 16px; margin-bottom: 20px; }
            .badge { display: inline-block; background: rgba(96, 165, 250, 0.2); color: #60a5fa; padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; }
            h2 { margin: 12px 0 0 0; color: #ffffff; font-size: 20px; font-weight: 700; }
            .field { margin-bottom: 16px; }
            .label { font-size: 12px; color: #9aa3bc; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px; }
            .value { font-size: 15px; color: #f5f7ff; line-height: 1.5; }
            .message-box { background: rgba(4, 5, 10, 0.6); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 16px; margin-top: 6px; font-size: 15px; line-height: 1.6; }
            .footer { font-size: 12px; color: #64748b; margin-top: 24px; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.06); padding-top: 16px; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">
              <span class="badge">Portfolio Enquiry</span>
              <h2>New Message from ${sanitizedName}</h2>
            </div>
            <div class="field">
              <div class="label">Sender Name</div>
              <div class="value"><strong>${sanitizedName}</strong></div>
            </div>
            <div class="field">
              <div class="label">Sender Email</div>
              <div class="value"><a href="mailto:${sanitizedEmail}" style="color: #60a5fa;">${sanitizedEmail}</a></div>
            </div>
            <div class="field">
              <div class="label">Message</div>
              <div class="message-box">${sanitizedMessage}</div>
            </div>
            <div class="field" style="margin-top: 20px;">
              <div class="label">Metadata</div>
              <div class="value" style="font-size: 13px; color: #9aa3bc;">
                Received: ${new Date().toUTCString()}<br/>
                Client IP: ${escapeHtml(ip)}<br/>
                Protection Backend: ${escapeHtml(protectionResult.backend)}
              </div>
            </div>
            <div class="footer">
              This message was sent via your portfolio contact form at shubhfolioo.vercel.app
            </div>
          </div>
        </body>
      </html>
    `;

    const textContent = `
New Contact Form Enquiry — Shubham Patil Portfolio

Name: ${trimmedName}
Email: ${trimmedEmail}
Received: ${new Date().toUTCString()}
Client IP: ${ip}
Protection Backend: ${protectionResult.backend}

Message:
${trimmedMessage}
    `.trim();

    // Default sender for Resend onboarding is 'onboarding@resend.dev'
    // User can customize to their verified domain later via environment variables
    const fromAddress = process.env.RESEND_FROM_EMAIL || 'Portfolio Contact <onboarding@resend.dev>';
    const toAddress = 'shubhampatil282487@gmail.com';

    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: [toAddress],
      replyTo: trimmedEmail,
      subject: `Portfolio Inquiry from ${trimmedName}`,
      html: htmlContent,
      text: textContent
    });

    if (error) {
      console.error('Resend API returned error:', error);
      return res.status(502).json({
        success: false,
        error: 'Failed to send message via email provider. Please contact directly at shubhampatil282487@gmail.com.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Thank you! Your message has been sent successfully.',
      id: data?.id
    });
  } catch (err) {
    console.error('Unexpected exception during email delivery:', err);
    return res.status(500).json({
      success: false,
      error: 'An unexpected server error occurred. Please try again or reach out directly via email.'
    });
  }
}