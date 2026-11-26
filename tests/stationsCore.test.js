import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateIndianAqi,
  getNearbyStations,
  InvalidCoordinatesError,
  normalizeParameter,
  resetStationCache,
  standardValue,
} from '../api/air-quality/stations-core.js';

test('normalizeParameter and standardValue normalize pollutant names and units', () => {
  assert.equal(normalizeParameter('PM2.5'), 'pm25');
  assert.equal(normalizeParameter('Nitrogen Dioxide'), 'no2');
  assert.equal(normalizeParameter('Sulphur Dioxide'), 'so2');
  assert.equal(normalizeParameter('unknown'), null);

  assert.equal(standardValue(25, 'µg/m³', 'pm25'), 25);
  assert.equal(standardValue(1.5, 'mg/m³', 'co'), 1.5);
  assert.equal(standardValue(1500, 'µg/m³', 'co'), 1.5);
  assert.ok(Math.abs(standardValue(100, 'ppb', 'no2') - 188.16) < 0.5);
  assert.equal(standardValue(10, 'unknown-unit', 'pm25'), null);
});

test('calculateIndianAqi enforces CPCB coverage rules and calculates dominant pollutant', () => {
  const now = Date.parse('2026-11-25T12:00:00Z');
  const hours = (count, value, unit = 'µg/m³') =>
    Array.from({ length: count }, (_, idx) => ({
      time: new Date(now - idx * 60 * 60 * 1000).toISOString(),
      value,
      unit,
    }));

  const insufficient = calculateIndianAqi({ pm25: hours(10, 40), no2: hours(18, 30), o3: hours(18, 25) }, now);
  assert.equal(insufficient.value, null);
  assert.match(insufficient.reason, /at least three pollutant sub-indices/i);

  const noParticulate = calculateIndianAqi({ no2: hours(18, 50), so2: hours(18, 50), o3: hours(18, 50) }, now);
  assert.equal(noParticulate.value, null);

  const valid = calculateIndianAqi(
    {
      pm25: hours(18, 45), // 50 + (50/30)*(45-30) = 75
      pm10: hours(18, 80), // 80
      no2: hours(18, 40), // 50
      co: hours(18, 1.5, 'mg/m³'), // 75
    },
    now,
  );
  assert.equal(valid.value, 80);
  assert.equal(valid.category, 'Satisfactory');
  assert.equal(valid.pollutant, 'pm10');
});

test('getNearbyStations handles missing key, invalid coords, stationary filtering, and caching', async () => {
  resetStationCache();
  const unconfigured = await getNearbyStations({ latitude: 12.97, longitude: 77.59, apiKey: '' });
  assert.equal(unconfigured.available, false);

  await assert.rejects(
    () => getNearbyStations({ latitude: '', longitude: 77.59, apiKey: 'test-key' }),
    InvalidCoordinatesError,
  );
  await assert.rejects(
    () => getNearbyStations({ latitude: 95, longitude: 77.59, apiKey: 'test-key' }),
    InvalidCoordinatesError,
  );

  let fetchCalls = 0;
  const now = Date.parse('2026-11-25T12:00:00Z');
  const mockFetch = async (url) => {
    fetchCalls += 1;
    if (url.includes('/locations?')) {
      return {
        ok: true,
        json: async () => ({
          results: [
            { id: 1, name: 'Mobile Sensor', isMobile: true, isMonitor: true, coordinates: { latitude: 12.97, longitude: 77.59 } },
            {
              id: 2,
              name: 'City Monitor',
              isMobile: false,
              isMonitor: true,
              distance: 1200,
              coordinates: { latitude: 12.98, longitude: 77.6 },
              provider: { name: 'CPCB' },
              sensors: [{ id: 101, parameter: { name: 'pm25', units: 'µg/m³' } }],
            },
          ],
        }),
      };
    }
    if (url.includes('/latest?')) {
      return {
        ok: true,
        json: async () => ({
          results: [{ sensorsId: 101, value: 22.5, datetime: { utc: '2026-11-25T11:30:00Z' } }],
        }),
      };
    }
    return { ok: true, json: async () => ({ results: [] }) };
  };

  const first = await getNearbyStations({
    latitude: 12.9716,
    longitude: 77.5946,
    country: 'IN',
    apiKey: 'test-key',
    fetchImpl: mockFetch,
    now,
  });
  assert.equal(first.available, true);
  assert.equal(first.stations.length, 1);
  assert.equal(first.stations[0].name, 'City Monitor');
  assert.equal(first.stations[0].hasFreshData, true);

  const callsAfterFirst = fetchCalls;
  const second = await getNearbyStations({
    latitude: 12.9716,
    longitude: 77.5946,
    country: 'IN',
    apiKey: 'test-key',
    fetchImpl: mockFetch,
    now: now + 60_000,
  });
  assert.equal(fetchCalls, callsAfterFirst);
  assert.equal(second.stations[0].id, 2);
});
