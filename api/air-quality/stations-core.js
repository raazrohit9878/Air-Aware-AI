const cache = new Map();
const MAX_CACHE_MS = 10 * 60 * 1000;
const MAX_CACHE_ENTRIES = 200;

const AQ_RANGES = {
  pm10: [[0, 50, 0, 50], [50, 100, 50, 100], [100, 250, 100, 200], [250, 350, 200, 300], [350, 430, 300, 400], [430, Infinity, 400, 500]],
  pm25: [[0, 30, 0, 50], [30, 60, 50, 100], [60, 90, 100, 200], [90, 120, 200, 300], [120, 250, 300, 400], [250, Infinity, 400, 500]],
  no2: [[0, 40, 0, 50], [40, 80, 50, 100], [80, 180, 100, 200], [180, 280, 200, 300], [280, 400, 300, 400], [400, Infinity, 400, 500]],
  o3: [[0, 50, 0, 50], [50, 100, 50, 100], [100, 168, 100, 200], [168, 208, 200, 300], [208, 748, 300, 400], [748, Infinity, 400, 500]],
  co: [[0, 1, 0, 50], [1, 2, 50, 100], [2, 10, 100, 200], [10, 17, 200, 300], [17, 34, 300, 400], [34, Infinity, 400, 500]],
  so2: [[0, 40, 0, 50], [40, 80, 50, 100], [80, 380, 100, 200], [380, 800, 200, 300], [800, 1600, 300, 400], [1600, Infinity, 400, 500]],
  nh3: [[0, 200, 0, 50], [200, 400, 50, 100], [400, 800, 100, 200], [800, 1200, 200, 300], [1200, 1800, 300, 400], [1800, Infinity, 400, 500]],
  pb: [[0, 0.5, 0, 50], [0.5, 1, 50, 100], [1, 2, 100, 200], [2, 3, 200, 300], [3, 3.5, 300, 400], [3.5, Infinity, 400, 500]],
};

const AQI_NAMES = [[50, 'Good'], [100, 'Satisfactory'], [200, 'Moderate'], [300, 'Poor'], [400, 'Very Poor'], [500, 'Severe']];

const MOLECULAR_WEIGHTS = {
  no2: 46.0055,
  o3: 47.9982,
  so2: 64.066,
  co: 28.01,
};

const PARAMETER_DISPLAY_NAMES = {
  pm25: 'PM2.5',
  pm10: 'PM10',
  no2: 'NO₂',
  so2: 'SO₂',
  co: 'CO',
  o3: 'O₃',
  nh3: 'NH₃',
  pb: 'Lead',
};

const POLLUTANT_ORDER = ['pm25', 'pm10', 'no2', 'so2', 'co', 'o3', 'nh3', 'pb'];

/**
 * Error thrown when coordinate parameters fail validation before contacting OpenAQ.
 */
export class InvalidCoordinatesError extends Error {
  constructor(message = 'Valid coordinates are required.') {
    super(message);
    this.name = 'InvalidCoordinatesError';
  }
}

export function normalizeParameter(name = '') {
  const value = String(name).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (/^pm25(?:mass|concentration)?$/.test(value)) return 'pm25';
  if (/^pm10(?:mass|concentration)?$/.test(value)) return 'pm10';
  if (/^(?:no2|nitrogendioxide)(?:mass|concentration|ppb|ppm)?$/.test(value)) return 'no2';
  if (/^(?:so2|sulfurdioxide|sulphurdioxide)(?:mass|concentration|ppb|ppm)?$/.test(value)) return 'so2';
  if (/^(?:o3|ozone)(?:mass|concentration|ppb|ppm)?$/.test(value)) return 'o3';
  if (/^(?:co|carbonmonoxide)(?:mass|concentration|ppb|ppm)?$/.test(value)) return 'co';
  if (['nh3', 'ammonia'].includes(value)) return 'nh3';
  if (['pb', 'lead'].includes(value)) return 'pb';
  return null;
}

export function standardValue(value, unit, pollutant) {
  if (!Number.isFinite(value)) return null;
  const normalizedUnit = String(unit || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');
  const molecularWeight = MOLECULAR_WEIGHTS[pollutant];

  if ((normalizedUnit === 'ppm' || normalizedUnit === 'partspermillion') && molecularWeight) {
    const mgm3 = (value * molecularWeight) / 24.45;
    return pollutant === 'co' ? mgm3 : mgm3 * 1000;
  }
  if ((normalizedUnit === 'ppb' || normalizedUnit === 'partsperbillion') && molecularWeight) {
    const mgm3 = (value * molecularWeight) / 24450;
    return pollutant === 'co' ? mgm3 : mgm3 * 1000;
  }

  const u = String(unit || '').toLowerCase().replace(/[μµ]/g, 'u').replace(/\s/g, '').replace('³', '3');
  if (pollutant === 'co') {
    if (u === 'mg/m3' || u === 'mgm-3') return value;
    if (u === 'ug/m3' || u === 'ugm-3') return value / 1000;
    return null;
  }
  if (pollutant === 'pb') {
    if (u === 'mg/m3' || u === 'mgm-3') return value * 1000;
    if (u === 'ug/m3' || u === 'ugm-3') return value;
    return null;
  }
  if (u === 'ug/m3' || u === 'ugm-3') return value;
  if (u === 'mg/m3' || u === 'mgm-3') return value * 1000;
  return null;
}

function interpolateAQI(pollutant, concentration) {
  const ranges = AQ_RANGES[pollutant];
  if (!ranges || !Number.isFinite(concentration) || concentration < 0) return null;
  const range = ranges.find(([, upper]) => concentration <= upper) || ranges.at(-1);
  const [low, high, aqiLow, aqiHigh] = range;
  const safeHigh = Number.isFinite(high) ? high : low + Math.max(1, Math.abs(low));
  const result = ((aqiHigh - aqiLow) / (safeHigh - low)) * (concentration - low) + aqiLow;
  return Math.max(0, Math.min(500, Math.round(result)));
}

function evaluatePollutantSubIndex(pollutant, samples, now) {
  const parsed = (Array.isArray(samples) ? samples : [])
    .map((sample) => ({
      time: new Date(sample.time).getTime(),
      value: standardValue(Number(sample.value), sample.unit, pollutant),
    }))
    .filter(
      (item) =>
        Number.isFinite(item.time) &&
        item.time <= now &&
        now - item.time <= 24 * 60 * 60 * 1000 &&
        Number.isFinite(item.value),
    );
  const needs8HourWindow = pollutant === 'co' || pollutant === 'o3';
  const recentWindow = needs8HourWindow ? parsed.filter((item) => now - item.time <= 8 * 60 * 60 * 1000) : parsed;
  const coverage = {
    hours24: parsed.length,
    hours8: needs8HourWindow ? recentWindow.length : null,
  };
  if (parsed.length < 16 || (needs8HourWindow && recentWindow.length < 6)) {
    return { coverage, subIndex: null };
  }
  const average = recentWindow.reduce((total, item) => total + item.value, 0) / recentWindow.length;
  const value = interpolateAQI(pollutant, average);
  return {
    coverage,
    subIndex: value === null ? null : { pollutant, value, concentration: average },
  };
}

/**
 * Calculate a CPCB-breakpoint-based India AQI estimate from hourly OpenAQ measurements when coverage passes.
 */
export function calculateIndianAqi(sensorHours, now = Date.now()) {
  const subIndices = [];
  const coverage = {};

  for (const [pollutant, samples] of Object.entries(sensorHours || {})) {
    const evaluated = evaluatePollutantSubIndex(pollutant, samples, now);
    coverage[pollutant] = evaluated.coverage;
    if (evaluated.subIndex) subIndices.push(evaluated.subIndex);
  }

  const hasParticulate = subIndices.some((row) => row.pollutant === 'pm25' || row.pollutant === 'pm10');
  if (subIndices.length < 3 || !hasParticulate) {
    return {
      value: null,
      category: null,
      pollutant: null,
      subIndices,
      coverage,
      reason:
        'CPCB method needs at least three pollutant sub-indices, including PM2.5 or PM10. The available hourly measurements do not meet the minimum coverage.',
    };
  }

  const dominant = subIndices.reduce((worst, item) => (item.value > worst.value ? item : worst));
  return {
    value: dominant.value,
    category: AQI_NAMES.find(([limit]) => dominant.value <= limit)?.[1] || 'Severe',
    pollutant: dominant.pollutant,
    subIndices,
    coverage,
    reason: null,
  };
}

async function openaq(path, apiKey, fetchImpl = fetch) {
  const response = await fetchImpl(`https://api.openaq.org/v3/${path}`, {
    headers: { 'X-API-Key': apiKey, Accept: 'application/json' },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`OpenAQ returned ${response.status}`);
  return response.json();
}

async function stationPayload(location, apiKey, fetchImpl = fetch, now = Date.now()) {
  const sensors = Array.isArray(location.sensors) ? location.sensors : [];
  const latestPromise = openaq(`locations/${location.id}/latest?limit=100`, apiKey, fetchImpl).catch(() => ({
    results: [],
  }));
  const sensorsByPollutant = new Map();
  for (const sensor of sensors) {
    const pollutant = normalizeParameter(sensor.parameter?.name || sensor.parameter?.displayName);
    if (!pollutant) continue;
    const previous = sensorsByPollutant.get(pollutant);
    if (!previous || new Date(sensor.datetimeLast?.utc || 0) > new Date(previous.datetimeLast?.utc || 0)) {
      sensorsByPollutant.set(pollutant, sensor);
    }
  }

  const from = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const to = new Date(now).toISOString();
  const hourlyEntries = await Promise.all(
    [...sensorsByPollutant.entries()].map(async ([pollutant, sensor]) => {
      try {
        const data = await openaq(
          `sensors/${sensor.id}/hours?datetime_from=${encodeURIComponent(from)}&datetime_to=${encodeURIComponent(to)}&limit=100`,
          apiKey,
          fetchImpl,
        );
        return [
          pollutant,
          (data.results || []).map((item) => ({
            time: item.period?.datetimeTo?.utc || item.datetime?.utc || item.datetimeTo?.utc,
            value: item.value,
            unit: item.parameter?.units || sensor.parameter?.units,
          })),
        ];
      } catch {
        return [pollutant, []];
      }
    }),
  );

  const latest = await latestPromise;
  const sensorById = new Map(sensors.map((sensor) => [Number(sensor.id), sensor]));
  const latestByPollutant = new Map();
  for (const item of latest.results || []) {
    const parameter = sensorById.get(Number(item.sensorsId))?.parameter || {};
    const pollutant = normalizeParameter(parameter.name || parameter.displayName);
    if (!pollutant) continue;
    const timestamp = item.datetime?.utc || item.datetime?.local || null;
    const parsedTime = timestamp ? new Date(timestamp).getTime() : 0;
    const ageMs = parsedTime ? now - parsedTime : Infinity;
    const reading = {
      parameter: PARAMETER_DISPLAY_NAMES[pollutant],
      pollutant,
      value: Number.isFinite(Number(item.value)) ? Number(item.value) : null,
      unit: parameter.units || '',
      datetime: timestamp,
      stale: !Number.isFinite(ageMs) || ageMs > 6 * 60 * 60 * 1000,
      sensorId: item.sensorsId,
    };
    if (reading.value === null) continue;
    const previous = latestByPollutant.get(pollutant);
    if (!previous || parsedTime > previous.parsedTime) {
      latestByPollutant.set(pollutant, { ...reading, parsedTime });
    }
  }

  const measurements = [...latestByPollutant.values()]
    .map(({ parsedTime, ...reading }) => reading)
    .sort((a, b) => POLLUTANT_ORDER.indexOf(a.pollutant) - POLLUTANT_ORDER.indexOf(b.pollutant));
  const indiaAqi = calculateIndianAqi(Object.fromEntries(hourlyEntries), now);

  return {
    id: location.id,
    name: location.name,
    coordinates: location.coordinates,
    distanceMeters: location.distance ?? null,
    isMonitor: Boolean(location.isMonitor),
    provider: location.provider?.name || 'OpenAQ provider unavailable',
    owner: location.owner?.name || null,
    timezone: location.timezone || null,
    updatedAt: location.datetimeLast?.utc || null,
    measurements,
    stale: measurements.length > 0 && measurements.every((item) => item.stale),
    hasFreshData: measurements.some((item) => !item.stale),
    indiaAqi,
  };
}

function pruneCache(now) {
  for (const [key, entry] of cache.entries()) {
    if (now - entry.time >= MAX_CACHE_MS) cache.delete(key);
  }
  while (cache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey === undefined) break;
    cache.delete(oldestKey);
  }
}

/**
 * Retrieve nearby stationary OpenAQ monitors within 25 km and compute CPCB-based India AQI estimates.
 */
export async function getNearbyStations({ latitude, longitude, country = 'IN', apiKey, fetchImpl = fetch, now = Date.now() }) {
  if (!apiKey) return { available: false, reason: 'OpenAQ API key is not configured.', stations: [] };
  if (latitude === null || latitude === undefined || latitude === '' || longitude === null || longitude === undefined || longitude === '') {
    throw new InvalidCoordinatesError('Valid coordinates are required.');
  }

  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180) {
    throw new InvalidCoordinatesError('Valid coordinates are required.');
  }

  const key = `${lat.toFixed(3)},${lon.toFixed(3)},${country}`;
  const cached = cache.get(key);
  if (cached && now - cached.time < MAX_CACHE_MS) return cached.value;

  const query = new URLSearchParams({ coordinates: `${lat},${lon}`, radius: '25000', limit: '20' });
  if (country === 'IN') query.set('iso', 'IN');
  const response = await openaq(`locations?${query.toString()}`, apiKey, fetchImpl);
  const locations = (response.results || [])
    .filter((location) => !location.isMobile && location.isMonitor && location.coordinates?.latitude != null && location.coordinates?.longitude != null)
    .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))
    .slice(0, 5);

  const stations = await Promise.all(locations.map((location) => stationPayload(location, apiKey, fetchImpl, now)));
  const value = { available: true, source: 'OpenAQ API v3', checkedAt: new Date(now).toISOString(), stations };
  pruneCache(now);
  cache.set(key, { time: now, value });
  return value;
}

/**
 * Clear in-memory station cache (used in automated tests).
 */
export function resetStationCache() {
  cache.clear();
}
