export const DEFAULT_PROFILE = {
  city: '',
  household: 'Family with children',
  children: true,
  olderAdults: false,
  sensitivity: false,
  commute: 'Private car',
  purifier: false,
  ventilation: true,
  budget: 'Low cost first',
};

export const DEFAULT_PLACE = {
  city: 'Bengaluru',
  country: 'India',
  countryCode: 'IN',
  latitude: 12.9716,
  longitude: 77.5946,
};

const POLLUTANT_LABELS = {
  pm25: 'PM2.5',
  pm10: 'PM10',
  no2: 'NO₂',
  so2: 'SO₂',
  co: 'CO',
  o3: 'O₃',
  nh3: 'NH₃',
  pb: 'Lead',
};

const AQI_LEVEL_ORDER = {
  good: 0,
  moderate: 1,
  sensitive: 2,
  unhealthy: 3,
  very: 4,
  hazardous: 5,
  unknown: -1,
};

const AQI_LEVEL_NAMES = ['good', 'moderate', 'sensitive', 'unhealthy', 'very', 'hazardous'];
const STALE_THRESHOLD_MS = 6 * 60 * 60 * 1000;
const FUTURE_CLOCK_SKEW_MS = 15 * 60 * 1000;

/**
 * Safely parse a JSON value from browser storage, falling back on missing or invalid data.
 */
export function readStorageJson(key, fallback, storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem?.(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Format a numeric reading with fixed decimals, or return an em-dash when unavailable.
 */
export function formatMetric(value, decimals = 0) {
  if (value === null || value === undefined || value === '') return '—';
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(decimals) : '—';
}

/**
 * Format an ISO timestamp for compact display while preserving unparseable labels.
 */
export function readableTime(value) {
  if (!value) return 'Time unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });
}

/**
 * Map a numeric US AQI value to its display label and CSS band key.
 */
export function aqiBand(value) {
  if (value === null || value === undefined || value === '') return ['Unavailable', 'unknown'];
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return ['Unavailable', 'unknown'];
  if (n <= 50) return ['Good', 'good'];
  if (n <= 100) return ['Moderate', 'moderate'];
  if (n <= 150) return ['Unhealthy for sensitive groups', 'sensitive'];
  if (n <= 200) return ['Unhealthy', 'unhealthy'];
  if (n <= 300) return ['Very unhealthy', 'very'];
  return ['Hazardous', 'hazardous'];
}

/**
 * Return true if a station pollutant measurement is missing, far in the future, or older than 6 hours.
 */
export function measurementIsStale(item, now = Date.now()) {
  const time = new Date(item?.datetime || '').getTime();
  const age = now - time;
  return !Number.isFinite(time) || age < -FUTURE_CLOCK_SKEW_MS || age > STALE_THRESHOLD_MS;
}

/**
 * Return true when a monitoring station has at least one fresh measurement.
 */
export function stationHasFreshData(station, now = Date.now()) {
  return (station?.measurements || []).some((item) => !measurementIsStale(item, now));
}

/**
 * Return true when a station's calculated India AQI meets CPCB coverage rules and uses fresh supporting readings.
 */
export function stationCanGuide(station, now = Date.now()) {
  const indices = station?.indiaAqi?.subIndices || [];
  const includesParticulate = indices.some((item) => item.pollutant === 'pm25' || item.pollutant === 'pm10');
  return (
    Number.isFinite(Number(station?.indiaAqi?.value)) &&
    includesParticulate &&
    indices.length >= 3 &&
    indices.every((index) =>
      (station.measurements || []).some(
        (reading) => reading.pollutant === index.pollutant && !measurementIsStale(reading, now),
      ),
    )
  );
}

/**
 * Select the more cautious AQI guidance band between the model estimate and eligible nearby stations.
 */
export function guidanceBand(modelBand, ground, now = Date.now()) {
  const stationValues = (ground?.stations || [])
    .filter((station) => stationCanGuide(station, now))
    .map((station) => Number(station.indiaAqi?.value))
    .filter(Number.isFinite);
  if (!stationValues.length) return modelBand;

  const highest = Math.max(...stationValues);
  const stationBand =
    highest >= 401 ? 'hazardous'
      : highest >= 301 ? 'very'
      : highest >= 201 ? 'unhealthy'
      : highest >= 101 ? 'sensitive'
      : highest > 50 ? 'moderate'
      : 'good';

  const modelIndex = AQI_LEVEL_ORDER[modelBand] ?? -1;
  return AQI_LEVEL_NAMES[Math.max(modelIndex, AQI_LEVEL_ORDER[stationBand])];
}

/**
 * Format an internal pollutant code for display.
 */
export function pollutantLabel(value) {
  return POLLUTANT_LABELS[value] || String(value || '').toUpperCase();
}

/**
 * Determine whether seasonal winter guidance applies using hemisphere and calendar month.
 */
export function isWinterLocation(place, date = new Date()) {
  const month = date.getMonth() + 1;
  const southernHemisphere = Number(place?.latitude) < 0;
  return southernHemisphere ? [5, 6, 7, 8, 9].includes(month) : [11, 12, 1, 2].includes(month);
}

/**
 * Return true when the user's commute mode represents a private/solo car trip.
 */
export function isCarCommute(commute) {
  const normalized = String(commute || '').trim().toLowerCase();
  return normalized === 'car' || normalized === 'private car';
}

/**
 * Build three practical, rule-based daily air actions tailored to the household profile.
 */
export function buildAdvice(band, profile, _weather, winter = false, stationDriven = false) {
  const sensitive = Boolean(profile.children || profile.olderAdults || profile.sensitivity);
  const elevated = ['sensitive', 'unhealthy', 'very', 'hazardous'].includes(band);
  const carCommute = isCarCommute(profile.commute);

  return [
    {
      time: 'MORNING',
      type: winter ? 'WINTER SMOG · OUTDOOR ACTIVITY' : 'OUTDOOR ACTIVITY',
      title: elevated
        ? (winter ? 'Winter smog: move hard exercise indoors' : 'Keep hard exercise indoors today')
        : 'Choose activity at a comfortable pace',
      action: elevated
        ? `When the available estimate is elevated, shorten or move vigorous outdoor activity indoors if possible. Cold air does not make polluted air safer. ${sensitive ? 'Take extra care with children, older adults, and people with respiratory sensitivity.' : 'Choose the option that fits your health and mobility.'} Follow any personal care plan.`
        : 'Check the hourly outlook before strenuous activity, and choose a route away from busy roads if practical.',
      why: elevated
        ? `${stationDriven ? 'A nearby OpenAQ station’s eligible India AQI estimate indicates elevated pollution.' : 'The available Open-Meteo model estimate is elevated.'} ${sensitive ? 'Your household profile includes people who may be more sensitive.' : 'Reducing time and effort outdoors may reduce the amount of air you breathe.'}`
        : 'Air conditions can change during the day; checking again can help you choose a better time.',
      exposure: 'Less time and exertion outdoors may reduce inhaled pollution.',
      environment: 'No direct emissions change unless you also change how you travel.',
      affordable: 'Try a gentle indoor routine or move activity to a time when conditions improve.',
    },
    {
      time: 'AFTERNOON',
      type: winter ? 'WINTER HOME AIR' : 'AT HOME',
      title: profile.purifier ? 'Run your purifier in the room you use most' : 'Keep indoor smoke and particles down',
      action: profile.purifier
        ? 'Use a correctly sized HEPA purifier in the occupied room and keep its filter maintained.'
        : winter
          ? 'Avoid smoke from tobacco, incense, and unvented fuel heaters. Cook with an exhaust fan vented outdoors when available; ventilate briefly when outdoor air is cleaner.'
          : 'Avoid smoking, incense, and unnecessary burning indoors; cook with an exhaust fan vented outdoors if available.',
      why: 'Indoor sources can add particles to the air regardless of the outdoor reading. A purifier is optional; source control costs less.',
      exposure: 'Reducing indoor sources can lower avoidable indoor particle levels.',
      environment: 'Preventing unnecessary burning can also avoid emissions at the source.',
      affordable: 'Use lids while cooking, clean dusty surfaces with a damp cloth, and skip indoor burning.',
    },
    {
      time: 'EVENING',
      type: 'GETTING AROUND',
      title: carCommute ? 'Combine errands or share a ride' : 'Keep the lower-emission trip going',
      action: carCommute
        ? 'If it suits your route and mobility, combine errands or carpool for one trip this week. Choose walking or cycling only when outdoor conditions and your needs make it suitable.'
        : 'Continue using your usual shared, transit, or active commute when it works for you; combining errands can cut extra trips.',
      why: 'This choice targets vehicle emissions. It is separate from reducing the pollution you personally breathe during a trip.',
      exposure: 'A lower-traffic route or enclosed transit may change exposure; effects vary by route and conditions.',
      environment: 'Fewer solo car kilometres can reduce estimated transport emissions.',
      affordable: 'Coordinate one shared trip with a neighbour, or combine errands you already need to make.',
    },
  ];
}

/**
 * Convert a merged onboarding profile into the dashboard's local personalization shape.
 */
export function toDashboardProfile(profile = {}) {
  const householdType = profile.household_type || DEFAULT_PROFILE.household;
  const lowered = householdType.toLowerCase();
  return {
    city: profile.city || 'Bengaluru',
    household: householdType,
    children: lowered.includes('children'),
    olderAdults: lowered.includes('senior'),
    sensitivity: Array.isArray(profile.optional_sensitivities) && profile.optional_sensitivities.length > 0,
    commute: profile.commute_method || DEFAULT_PROFILE.commute,
    purifier: Boolean(profile.air_purifier_available),
    ventilation: profile.outdoor_ventilation_available === undefined ? true : Boolean(profile.outdoor_ventilation_available),
    budget: profile.budget_preference || DEFAULT_PROFILE.budget,
  };
}

/**
 * Derive a Supabase SQL Editor link from the configured project URL without hardcoding a project ref.
 */
export function getSupabaseSqlEditorUrl(supabaseUrl = '') {
  const match = String(supabaseUrl || '').match(/^https:\/\/([a-z0-9-]+)\.supabase\.co/i);
  return match
    ? `https://supabase.com/dashboard/project/${match[1]}/sql/new`
    : 'https://supabase.com/dashboard';
}
