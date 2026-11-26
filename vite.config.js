import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { allowChatRequest, createChatResponse, verifySupabaseSession } from './api/ai/chat-core.js';
import { InvalidCoordinatesError, getNearbyStations } from './api/air-quality/stations-core.js';
import {
  MAX_CHAT_BODY_BYTES, PayloadTooLargeError, applyApiHeaders,
  extractBearerToken, getClientKey, readStreamJsonBody,
} from './api/_http.js';

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

function localChatApi({ apiKey, model, openaqApiKey, supabaseUrl, supabaseAnonKey }) {
  return {
    name: 'airaware-local-chat-api',
    configureServer(server) {
      server.middlewares.use('/api/air-quality/stations', async (req, res) => {
        applyApiHeaders(res, 'private, max-age=300');
        if (req.method !== 'GET') {
          res.setHeader('Allow', 'GET');
          return sendJson(res, 405, { error: 'Use GET to retrieve nearby monitoring stations.' });
        }
        try {
          const authorized = await verifySupabaseSession(extractBearerToken(req), { supabaseUrl, supabaseAnonKey });
          if (!authorized) return sendJson(res, 401, { error: 'Sign in again to view monitoring stations.' });
          const url = new URL(req.url, 'http://airaware.local');
          const data = await getNearbyStations({
            latitude: url.searchParams.get('latitude'),
            longitude: url.searchParams.get('longitude'),
            country: url.searchParams.get('country') || 'IN',
            apiKey: openaqApiKey,
          });
          return sendJson(res, 200, data);
        } catch (error) {
          const status = error instanceof InvalidCoordinatesError ? 400 : 502;
          return sendJson(res, status, { error: error.message || 'Nearby monitoring data is unavailable.' });
        }
      });

      server.middlewares.use('/api/ai/chat', async (req, res) => {
        applyApiHeaders(res, 'no-store');
        if (req.method !== 'POST') {
          res.setHeader('Allow', 'POST');
          return sendJson(res, 405, { error: 'Use POST to send a chat message.' });
        }
        try {
          const authorized = await verifySupabaseSession(extractBearerToken(req), { supabaseUrl, supabaseAnonKey });
          if (!authorized) return sendJson(res, 401, { error: 'Your session has expired. Sign in again to use the assistant.' });
          if (!allowChatRequest(getClientKey(req, 'local'))) {
            return sendJson(res, 429, { error: 'You have sent several messages in a short time. Please wait a minute and try again.' });
          }
          const payload = await readStreamJsonBody(req, MAX_CHAT_BODY_BYTES);
          const result = await createChatResponse(payload, { apiKey, model });
          return sendJson(res, result.status, result.body);
        } catch (error) {
          const status = error instanceof PayloadTooLargeError ? 413 : 400;
          return sendJson(res, status, { error: error.message || 'The chat request could not be read. Please try again.' });
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [
      react(),
      localChatApi({
        apiKey: env.NVIDIA_API_KEY,
        model: env.NVIDIA_NIM_MODEL,
        openaqApiKey: env.OPENAQ_API_KEY,
        supabaseUrl: env.VITE_SUPABASE_URL,
        supabaseAnonKey: env.VITE_SUPABASE_ANON_KEY,
      }),
    ],
  };
});
