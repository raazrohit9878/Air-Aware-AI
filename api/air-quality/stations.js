import { InvalidCoordinatesError, getNearbyStations } from './stations-core.js';
import { verifySupabaseSession } from '../ai/chat-core.js';
import { applyApiHeaders, extractBearerToken, getSupabaseConfig } from '../_http.js';

/**
 * Build the Vercel monitoring-stations handler with injectable dependencies for unit testing.
 */
export function createStationsHandler(deps = {}) {
  const verifySession = deps.verifySupabaseSession || verifySupabaseSession;
  const loadStations = deps.getNearbyStations || getNearbyStations;
  const getEnv = deps.getEnv || (() => process.env);

  return async function handler(req, res) {
    applyApiHeaders(res, 'private, max-age=300');

    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ error: 'Use GET to retrieve nearby monitoring stations.' });
    }

    const env = getEnv();
    const bearer = extractBearerToken(req);
    const authorized = await verifySession(bearer, getSupabaseConfig(env));
    if (!authorized) {
      return res.status(401).json({ error: 'Sign in again to view monitoring stations.' });
    }

    try {
      const url = new URL(req.url, 'https://airaware.local');
      const rawCountry = url.searchParams.get('country');
      const country = rawCountry == null ? 'IN' : rawCountry.trim().toUpperCase();
      if (country && !/^[A-Z]{2}$/.test(country)) {
        return res.status(400).json({ error: 'Country filter must be a two-letter ISO code.' });
      }
      const result = await loadStations({
        latitude: url.searchParams.get('latitude'),
        longitude: url.searchParams.get('longitude'),
        country,
        apiKey: env.OPENAQ_API_KEY,
      });
      return res.status(200).json(result);
    } catch (error) {
      const status = error instanceof InvalidCoordinatesError ? 400 : 502;
      return res.status(status).json({ error: error.message || 'Nearby monitoring data is unavailable.' });
    }
  };
}

export default createStationsHandler();
