import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aqiBand,
  buildAdvice,
  formatMetric,
  getSupabaseSqlEditorUrl,
  guidanceBand,
  isCarCommute,
  isWinterLocation,
  measurementIsStale,
  pollutantLabel,
  readStorageJson,
  readableTime,
  stationCanGuide,
  stationHasFreshData,
  toDashboardProfile,
} from '../src/airQualityUtils.js';

test('aqiBand categorizes US AQI ranges and invalid inputs', () => {
  assert.deepEqual(aqiBand(34), ['Good', 'good']);
  assert.deepEqual(aqiBand(80), ['Moderate', 'moderate']);
  assert.deepEqual(aqiBand(120), ['Unhealthy for sensitive groups', 'sensitive']);
  assert.deepEqual(aqiBand(175), ['Unhealthy', 'unhealthy']);
  assert.deepEqual(aqiBand(250), ['Very unhealthy', 'very']);
  assert.deepEqual(aqiBand(350), ['Hazardous', 'hazardous']);
  assert.deepEqual(aqiBand(null), ['Unavailable', 'unknown']);
  assert.deepEqual(aqiBand(undefined), ['Unavailable', 'unknown']);
  assert.deepEqual(aqiBand(''), ['Unavailable', 'unknown']);
  assert.deepEqual(aqiBand(-5), ['Unavailable', 'unknown']);
});

test('readStorageJson handles valid, empty, and malformed JSON safely', () => {
  const store = new Map([
    ['valid', '{"city":"Bengaluru"}'],
    ['bad', '{not-json'],
    ['primitive', '"hello"'],
  ]);
  const storage = { getItem: (key) => store.get(key) ?? null };

  assert.deepEqual(readStorageJson('valid', {}, storage), { city: 'Bengaluru' });
  assert.deepEqual(readStorageJson('missing', { ok: true }, storage), { ok: true });
  assert.deepEqual(readStorageJson('bad', { fallback: 1 }, storage), { fallback: 1 });
  assert.deepEqual(readStorageJson('primitive', { fallback: 2 }, storage), { fallback: 2 });
});

test('measurementIsStale, stationHasFreshData, and stationCanGuide enforce freshness and coverage', () => {
  const now = Date.parse('2026-11-25T12:00:00Z');
  const freshIso = '2026-11-25T10:30:00Z';
  const oldIso = '2026-11-25T02:00:00Z';

  assert.equal(measurementIsStale({ datetime: freshIso }, now), false);
  assert.equal(measurementIsStale({ datetime: oldIso }, now), true);
  assert.equal(measurementIsStale({ datetime: '2026-11-25T13:00:00Z' }, now), true);

  const validStation = {
    indiaAqi: {
      value: 145,
      subIndices: [{ pollutant: 'pm25' }, { pollutant: 'no2' }, { pollutant: 'o3' }],
    },
    measurements: [
      { pollutant: 'pm25', datetime: freshIso },
      { pollutant: 'no2', datetime: freshIso },
      { pollutant: 'o3', datetime: freshIso },
    ],
  };
  assert.equal(stationHasFreshData(validStation, now), true);
  assert.equal(stationCanGuide(validStation, now), true);
  assert.equal(guidanceBand('good', { stations: [validStation] }, now), 'sensitive');

  const staleStation = {
    ...validStation,
    measurements: [
      { pollutant: 'pm25', datetime: oldIso },
      { pollutant: 'no2', datetime: freshIso },
      { pollutant: 'o3', datetime: freshIso },
    ],
  };
  assert.equal(stationCanGuide(staleStation, now), false);
  assert.equal(guidanceBand('good', { stations: [staleStation] }, now), 'good');
});

test('isWinterLocation respects hemisphere and calendar month', () => {
  assert.equal(isWinterLocation({ latitude: 12.97 }, new Date('2026-11-25T00:00:00Z')), true);
  assert.equal(isWinterLocation({ latitude: 12.97 }, new Date('2026-06-15T00:00:00Z')), false);
  assert.equal(isWinterLocation({ latitude: -33.86 }, new Date('2026-06-15T00:00:00Z')), true);
  assert.equal(isWinterLocation({ latitude: -33.86 }, new Date('2026-12-15T00:00:00Z')), false);
});

test('buildAdvice handles both Car and Private car commutes and elevated alerts', () => {
  assert.equal(isCarCommute('Car'), true);
  assert.equal(isCarCommute('Private car'), true);
  assert.equal(isCarCommute('Public transportation'), false);

  const actions = buildAdvice(
    'unhealthy',
    { children: true, olderAdults: false, sensitivity: false, purifier: false, commute: 'Private car' },
    null,
    true,
    true,
  );
  assert.equal(actions.length, 3);
  assert.match(actions[0].title, /Winter smog/i);
  assert.match(actions[0].why, /OpenAQ station/i);
  assert.match(actions[2].title, /Combine errands/i);
});

test('formatting, dashboard conversion, and SQL Editor URL derivation work cleanly', () => {
  assert.equal(formatMetric(12.345, 1), '12.3');
  assert.equal(formatMetric(null, 1), '—');
  assert.equal(pollutantLabel('pm25'), 'PM2.5');
  assert.equal(readableTime(''), 'Time unavailable');
  assert.equal(
    getSupabaseSqlEditorUrl('https://abcdefghij.supabase.co'),
    'https://supabase.com/dashboard/project/abcdefghij/sql/new',
  );
  assert.equal(getSupabaseSqlEditorUrl(''), 'https://supabase.com/dashboard');

  const dash = toDashboardProfile({
    city: 'Mysuru',
    household_type: 'Family with senior citizens',
    optional_sensitivities: ['Asthma-related concerns'],
    commute_method: 'Public transportation',
    air_purifier_available: true,
    outdoor_ventilation_available: false,
    budget_preference: 'Some flexibility',
  });
  assert.deepEqual(dash, {
    city: 'Mysuru',
    household: 'Family with senior citizens',
    children: false,
    olderAdults: true,
    sensitivity: true,
    commute: 'Public transportation',
    purifier: true,
    ventilation: false,
    budget: 'Some flexibility',
  });
});
