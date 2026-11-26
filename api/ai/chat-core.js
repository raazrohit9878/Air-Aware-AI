const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 18;
const MAX_TRACKED_CLIENTS = 1000;
const requestsByClient = new Map();
const POLLUTANT_FIELDS = ['pm2_5', 'pm10', 'nitrogen_dioxide', 'sulphur_dioxide', 'carbon_monoxide', 'ozone'];
const EMERGENCY_PATTERN = /can't breathe|cannot breathe|difficulty breathing|shortness of breath|chest pain|blue lips|emergency|severe symptoms/i;

function cleanText(value, max = 1200) {
  return typeof value === 'string'
    ? value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max)
    : '';
}

function numericOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Sanitize and normalize client-supplied air-quality and household context for AI prompting.
 */
export function cleanContext(value = {}, now = Date.now()) {
  const safeValue = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const pollutants = safeValue.pollutants && typeof safeValue.pollutants === 'object' ? safeValue.pollutants : {};
  const profile = safeValue.profile && typeof safeValue.profile === 'object' ? safeValue.profile : {};
  const groundStations = Array.isArray(safeValue.groundStations)
    ? safeValue.groundStations.slice(0, 3).map((station) => ({
        name: cleanText(station?.name, 90) || 'Unnamed station',
        provider: cleanText(station?.provider, 80) || 'unknown provider',
        distanceMeters: numericOrNull(station?.distanceMeters),
        stale:
          !Array.isArray(station?.measurements) ||
          !station.measurements.some((item) => {
            const time = new Date(item?.datetime || '').getTime();
            const age = now - time;
            return Number.isFinite(time) && age >= -15 * 60 * 1000 && age <= 6 * 60 * 60 * 1000;
          }),
        indiaAqi:
          station?.indiaAqi?.value == null
            ? null
            : {
                value: numericOrNull(station.indiaAqi.value),
                category: cleanText(station.indiaAqi.category, 30),
                dominantPollutant: cleanText(station.indiaAqi.pollutant, 20),
                basis: 'Calculated from OpenAQ hourly measurements using CPCB breakpoints; not official CPCB-published AQI',
              },
        measurements: Array.isArray(station?.measurements)
          ? station.measurements.slice(0, 6).map((item) => ({
              pollutant: cleanText(item?.parameter, 30),
              value: numericOrNull(item?.value),
              unit: cleanText(item?.unit, 20),
              datetime: cleanText(item?.datetime, 50),
              stale: Boolean(item?.stale),
            }))
          : [],
      }))
    : [];

  return {
    city: cleanText(safeValue.city, 100) || 'not provided',
    aqi: numericOrNull(safeValue.aqi),
    aqiCategory: cleanText(safeValue.aqiCategory, 50) || 'Unavailable',
    aqiScale: 'US AQI from Open-Meteo model estimate; not a ground-monitor reading',
    seasonalWinterGuidance: Boolean(safeValue.winter),
    groundStations,
    updatedAt: cleanText(safeValue.updatedAt, 60) || 'unavailable',
    pollutants: Object.fromEntries(POLLUTANT_FIELDS.map((key) => [key, numericOrNull(pollutants[key])])),
    nextAqi: Array.isArray(safeValue.nextAqi) ? safeValue.nextAqi.slice(0, 6).map(numericOrNull) : [],
    weather: {
      temperatureC: numericOrNull(safeValue.weather?.temperature_2m),
      humidityPercent: numericOrNull(safeValue.weather?.relative_humidity_2m),
      windKph: numericOrNull(safeValue.weather?.wind_speed_10m),
    },
    household: {
      children: Boolean(profile.children),
      olderAdults: Boolean(profile.olderAdults),
      respiratorySensitivity: Boolean(profile.sensitivity),
      purifierAvailable: Boolean(profile.purifier),
      ventilationAvailable: Boolean(profile.ventilation),
      commute: cleanText(profile.commute, 50) || 'not provided',
      budget: cleanText(profile.budget, 50) || 'not provided',
    },
  };
}

function emergencyAnswer() {
  return 'If someone is having severe trouble breathing, chest pain, fainting, or rapidly worsening symptoms, contact local emergency services or a healthcare professional now. Move away from smoke or pollution if you can do so safely, and follow the person’s existing clinician-provided care plan. I can help with general air-quality planning, but I can’t assess or diagnose an emergency.';
}

/**
 * Generate reviewed, deterministic guidance when NIM is unavailable or unconfigured.
 */
export function guideAnswer(question, context) {
  const q = question.toLowerCase();
  if (EMERGENCY_PATTERN.test(q)) return emergencyAnswer();

  const hasAqi = context.aqi !== null;
  const airLine = hasAqi
    ? `AirAware currently shows ${Math.round(context.aqi)} (${context.aqiCategory}) for ${context.city}, on the US AQI scale. This is an Open-Meteo model estimate, not a nearby monitoring-station reading; it was updated at ${context.updatedAt}.`
    : `A current air-quality estimate is unavailable for ${context.city}. Check a local official monitoring source before making a decision that depends on current pollution.`;
  const caution =
    context.household.children || context.household.olderAdults || context.household.respiratorySensitivity
      ? 'Because your household profile includes people who may be more sensitive, consider the more cautious option when conditions are elevated.'
      : 'Choose the option that fits your health, mobility, and local conditions.';

  if (/exercise|run|workout|outside|outdoor|safe today/.test(q)) {
    return `${airLine}\n\nFor vigorous outdoor exercise, use the forecast and how you feel; when the estimate is elevated, shorten or move strenuous activity indoors if possible. ${caution} The model can differ from conditions at street level.`;
  }
  if (/child|children|school|kid/.test(q)) {
    return `${airLine}\n\nFor children, consider a lower-traffic school route, avoid strenuous outdoor play when pollution is elevated, and move activity indoors when practical. Keep prescribed medicines and clinician advice unchanged. The AQI shown here is a model estimate, not a school-site measurement.`;
  }
  if (/window|ventilat|open/.test(q)) {
    return 'Open windows when outdoor air is cleaner than the air indoors and outdoor conditions are suitable. If the current estimate is elevated, smoke is nearby, or traffic is heavy, keep windows closed where practical and reduce indoor sources such as cooking smoke. This app does not measure indoor air, so no reading here can confirm that a room is clean.';
  }
  if (/purifier|filter|hepa|indoor air|inside|home|kitchen|cook|incense|dust/.test(q)) {
    const purifier = context.household.purifierAvailable
      ? 'Since your profile says you have a purifier, use a correctly sized HEPA unit in the room you occupy most and replace or clean its filter as directed.'
      : 'A purifier is optional. Low-cost steps include avoiding tobacco smoke and unnecessary incense, using a kitchen exhaust that vents outdoors, covering pans, and wiping dust with a damp cloth.';
    return `${purifier} Keep outdoor air in mind when deciding to ventilate. No single step guarantees clean air, and plants are not a substitute for source control or filtration.`;
  }
  if (/pm\s?2\.5|fine particle|danger|harm|health effect/.test(q)) {
    const pm = context.pollutants.pm2_5;
    return `PM2.5 means airborne particles no larger than 2.5 micrometres. They can reach deep into the lungs, so reducing time in polluted air and controlling indoor particle sources can help reduce exposure. ${pm === null ? 'A PM2.5 estimate is unavailable right now.' : `The current model estimate is ${pm} µg/m³, updated at ${context.updatedAt}.`} This is general information, not a personal medical assessment.`;
  }
  if (/commut|car|bus|transit|cycle|walk|emission|pollution reduction/.test(q)) {
    return `Your saved commute preference is ${context.household.commute}. If practical, combine errands, share a ride, or use public transit to reduce solo vehicle travel. Walking or cycling can lower transport emissions for short trips, but choose them only when outdoor air, route safety, and mobility needs make them suitable. Personal exposure and environmental emissions are different impacts.`;
  }
  if (/aqi|air quality|reading|pollut|condition/.test(q)) {
    const pollutants = Object.entries(context.pollutants)
      .filter(([, value]) => value !== null)
      .map(([key, value]) => `${key.replaceAll('_', ' ')} ${value}`)
      .join('; ');
    const stationLine = context.groundStations.length
      ? ` Nearby OpenAQ station(s): ${context.groundStations
          .map(
            (s) =>
              `${s.name}${s.distanceMeters === null ? '' : `, ${(s.distanceMeters / 1000).toFixed(1)} km away`}${s.stale ? ', latest readings are stale and not used for today’s precaution level' : s.indiaAqi ? `, calculated India AQI estimate ${s.indiaAqi.value} (${s.indiaAqi.category})` : ', India AQI unavailable due to coverage or data'}`,
          )
          .join('; ')}. Station observations are separate from the Open-Meteo model estimate.`
      : ' No nearby ground-station observations are available in the app context.';
    return `${airLine}${pollutants ? `\n\nAvailable pollutant model values: ${pollutants} µg/m³.` : '\n\nIndividual pollutant model values are unavailable.'}${stationLine} Use the “Why this advice?” screen for the source and limitations.`;
  }

  return `I can help with today’s air estimate, outdoor exercise, children and school routines, window ventilation, indoor particles, purifier use, or commuting choices. ${hasAqi ? `For ${context.city}, the app currently shows a US AQI model estimate of ${Math.round(context.aqi)} (${context.aqiCategory}).` : 'A current air estimate is not available right now.'} What would you like help planning?`;
}

function pruneRateLimiter(now) {
  if (requestsByClient.size < MAX_TRACKED_CLIENTS) return;
  for (const [key, timestamps] of requestsByClient.entries()) {
    const recent = timestamps.filter((time) => now - time < RATE_WINDOW_MS);
    if (recent.length) requestsByClient.set(key, recent);
    else requestsByClient.delete(key);
  }
  if (requestsByClient.size >= MAX_TRACKED_CLIENTS) {
    const oldestKey = requestsByClient.keys().next().value;
    if (oldestKey !== undefined) requestsByClient.delete(oldestKey);
  }
}

function requestIsLimited(clientKey, now = Date.now()) {
  pruneRateLimiter(now);
  const prior = requestsByClient.get(clientKey) || [];
  const recent = prior.filter((time) => now - time < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    requestsByClient.set(clientKey, recent);
    return true;
  }
  recent.push(now);
  requestsByClient.set(clientKey, recent);
  return false;
}

/**
 * Handle an AirAware chat request using NVIDIA NIM when configured, with deterministic fallback.
 */
export async function createChatResponse(payload = {}, options = {}) {
  const safePayload = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
  const question = cleanText(safePayload.question, 1000);
  if (!question) return { status: 400, body: { error: 'Write a question to get started.' } };
  if (question.length < 2) return { status: 400, body: { error: 'Please add a little more detail to your question.' } };

  const context = cleanContext(safePayload.context);
  if (EMERGENCY_PATTERN.test(question)) {
    return { status: 200, body: { answer: emergencyAnswer(), mode: 'guide' } };
  }

  const apiKey = options.apiKey || '';
  if (!apiKey) {
    return {
      status: 200,
      body: {
        answer: guideAnswer(question, context),
        mode: 'guide',
        notice: 'NVIDIA_API_KEY is not configured; using reviewed AirAware guidance.',
      },
    };
  }

  const history = Array.isArray(safePayload.history)
    ? safePayload.history
        .slice(-6)
        .map((item) => ({
          role: item?.role === 'assistant' ? 'assistant' : 'user',
          content: cleanText(item?.content, 700),
        }))
        .filter((item) => item.content)
    : [];

  const system = [
    'You are AirAware, a friendly urban air-quality planning assistant. Answer briefly, warmly, and in plain language.',
    'Use only the supplied current context for readings, timestamps, location, pollutant values, and household preferences. Never invent a measurement, source, station, forecast, or health fact.',
    'The AQI supplied is a US AQI Open-Meteo model estimate, not a ground monitor or India National AQI. Always call it a model estimate when mentioning it. If a value is null, say it is unavailable.',
    'If groundStations are supplied, describe them as separate OpenAQ station observations. A station India AQI is only an app-calculated estimate using CPCB breakpoints and hourly station data, not an official CPCB-published value. Never merge station readings with the model estimate. Treat stale readings as stale.',
    'Seasonal winter guidance is based on the selected location hemisphere and calendar month. The app does not detect winter smog, temperature inversions, or indoor air; never claim that it does.',
    'Keep personal exposure reduction separate from environmental emissions reduction. Do not claim an action guarantees protection, diagnose, prescribe, or replace a clinician. For severe breathing difficulty, chest pain, fainting, blue lips, or rapidly worsening symptoms, direct the user to local emergency help immediately.',
    'Give practical options that account for cost, mobility, and access to transport. Do not recommend plants as an effective pollution-removal device. Indoor air is not measured by the supplied outdoor data.',
    `Verified app context (JSON): ${JSON.stringify(context)}`,
  ].join('\n');

  const fetchImpl = options.fetchImpl || fetch;
  try {
    const response = await fetchImpl('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: options.model || 'nvidia/nemotron-3.5-bolt-e4b',
        messages: [{ role: 'system', content: system }, ...history, { role: 'user', content: question }],
        temperature: 0.2,
        max_tokens: 420,
        stream: false,
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok) throw new Error(`NVIDIA NIM returned ${response.status}`);
    const result = await response.json();
    const answer = cleanText(result.choices?.[0]?.message?.content, 5000);
    if (!answer) throw new Error('NVIDIA NIM returned an empty answer');
    return { status: 200, body: { answer, mode: 'nim' } };
  } catch {
    return {
      status: 200,
      body: {
        answer: guideAnswer(question, context),
        mode: 'guide',
        notice: 'AI model is unavailable; showing reviewed guidance.',
      },
    };
  }
}

/**
 * Enforce an in-memory sliding-window rate limit per client key.
 */
export function allowChatRequest(clientKey = 'unknown', now = Date.now()) {
  return !requestIsLimited(clientKey, now);
}

/**
 * Reset in-memory rate-limit state (used in automated tests).
 */
export function resetChatRateLimit() {
  requestsByClient.clear();
}

/**
 * Verify a Supabase bearer token against the project Auth API.
 */
export async function verifySupabaseSession(accessToken, options = {}) {
  if (!accessToken || !options.supabaseUrl || !options.supabaseAnonKey) return false;
  const fetchImpl = options.fetchImpl || fetch;
  try {
    const response = await fetchImpl(`${options.supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
      headers: { apikey: options.supabaseAnonKey, Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(8000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
