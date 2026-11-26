export const MAX_CHAT_BODY_BYTES = 16_000;

/**
 * Custom error thrown when a request body exceeds the allowed byte limit.
 */
export class PayloadTooLargeError extends Error {
  constructor(message = 'That message is too large. Please shorten it and try again.') {
    super(message);
    this.name = 'PayloadTooLargeError';
  }
}

/**
 * Custom error thrown when a request body contains malformed JSON.
 */
export class InvalidJsonError extends Error {
  constructor(message = 'The chat request could not be read. Please try again.') {
    super(message);
    this.name = 'InvalidJsonError';
  }
}

/**
 * Apply consistent security and caching headers to API responses.
 */
export function applyApiHeaders(res, cacheControl) {
  res.setHeader('Cache-Control', cacheControl);
  res.setHeader('X-Content-Type-Options', 'nosniff');
}

/**
 * Extract a Bearer token from an Authorization header.
 */
export function extractBearerToken(req) {
  return String(req?.headers?.authorization || '').match(/^Bearer\s+(.+)$/i)?.[1] || '';
}

/**
 * Resolve Supabase URL and anon key from server environment variables.
 */
export function getSupabaseConfig(env = process.env) {
  return {
    supabaseUrl: env.SUPABASE_URL || env.VITE_SUPABASE_URL,
    supabaseAnonKey: env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY,
  };
}

/**
 * Extract the best-effort client IP key for rate limiting.
 */
export function getClientKey(req, fallback = 'unknown') {
  return String(req?.headers?.['x-forwarded-for'] || req?.socket?.remoteAddress || fallback)
    .split(',')[0]
    .trim();
}

/**
 * Validate and parse a pre-read serverless request body under the byte limit.
 */
export function parseBodyWithLimit(body, maxBytes = MAX_CHAT_BODY_BYTES) {
  if (typeof body === 'string') {
    if (Buffer.byteLength(body, 'utf8') > maxBytes) throw new PayloadTooLargeError();
    try {
      return JSON.parse(body || '{}');
    } catch {
      throw new InvalidJsonError();
    }
  }
  if (body && Buffer.byteLength(JSON.stringify(body), 'utf8') > maxBytes) {
    throw new PayloadTooLargeError();
  }
  return body || {};
}

/**
 * Stream and parse a Node IncomingMessage JSON body under the byte limit.
 */
export function readStreamJsonBody(req, maxBytes = MAX_CHAT_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let byteCount = 0;
    let settled = false;

    req.on('data', (chunk) => {
      if (settled) return;
      byteCount += Buffer.byteLength(chunk);
      if (byteCount > maxBytes) {
        settled = true;
        reject(new PayloadTooLargeError());
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (settled) return;
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(JSON.parse(raw || '{}'));
      } catch {
        reject(new InvalidJsonError());
      }
    });

    req.on('error', () => {
      if (!settled) {
        settled = true;
        reject(new InvalidJsonError());
      }
    });
  });
}
