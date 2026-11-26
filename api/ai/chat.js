import { allowChatRequest, createChatResponse, verifySupabaseSession } from './chat-core.js';
import {
  InvalidJsonError, MAX_CHAT_BODY_BYTES, PayloadTooLargeError,
  applyApiHeaders, extractBearerToken, getClientKey, getSupabaseConfig, parseBodyWithLimit,
} from '../_http.js';

/**
 * Build the Vercel chat handler with injectable dependencies for unit testing.
 */
export function createChatHandler(deps = {}) {
  const verifySession = deps.verifySupabaseSession || verifySupabaseSession;
  const allowRequest = deps.allowChatRequest || allowChatRequest;
  const respond = deps.createChatResponse || createChatResponse;
  const getEnv = deps.getEnv || (() => process.env);

  return async function handler(req, res) {
    applyApiHeaders(res, 'no-store');

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Use POST to send a chat message.' });
    }

    const contentType = String(req.headers?.['content-type'] || '').toLowerCase();
    if (contentType && !contentType.includes('application/json')) {
      return res.status(415).json({ error: 'Use application/json when sending a chat message.' });
    }

    const contentLength = Number(req.headers?.['content-length'] || 0);
    if (contentLength > MAX_CHAT_BODY_BYTES) {
      return res.status(413).json({ error: 'That message is too large. Please shorten it and try again.' });
    }

    const env = getEnv();
    const bearer = extractBearerToken(req);
    const authorized = await verifySession(bearer, getSupabaseConfig(env));
    if (!authorized) {
      return res.status(401).json({ error: 'Your session has expired. Sign in again to use the assistant.' });
    }

    if (!allowRequest(getClientKey(req))) {
      return res.status(429).json({
        error: 'You have sent several messages in a short time. Please wait a minute and try again.',
      });
    }

    let body;
    try {
      body = parseBodyWithLimit(req.body, MAX_CHAT_BODY_BYTES);
    } catch (error) {
      const status = error instanceof PayloadTooLargeError ? 413 : 400;
      return res.status(status).json({
        error: error instanceof InvalidJsonError || error instanceof PayloadTooLargeError
          ? error.message
          : 'The chat request could not be read. Please try again.',
      });
    }

    const result = await respond(body, {
      apiKey: env.NVIDIA_API_KEY,
      model: env.NVIDIA_NIM_MODEL,
    });
    return res.status(result.status).json(result.body);
  };
}

export default createChatHandler();
