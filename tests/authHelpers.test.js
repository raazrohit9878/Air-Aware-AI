import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasValidPassword,
  mergeOnboardingData,
  syncLocalProfileAndPlace,
} from '../src/authHelpers.js';

test('hasValidPassword enforces length, uppercase, lowercase, and numeric characters', () => {
  assert.equal(hasValidPassword('Short1a'), false);
  assert.equal(hasValidPassword('alllowercase12'), false);
  assert.equal(hasValidPassword('ALLUPPERCASE12'), false);
  assert.equal(hasValidPassword('NoNumbersHere'), false);
  assert.equal(hasValidPassword('ValidPass123'), true);
});

test('mergeOnboardingData combines normalized onboarding sections and legacy fallbacks', () => {
  const merged = mergeOnboardingData(
    {
      personal: { full_name: 'Riya', city: 'Pune', country: 'India' },
      household: { household_type: 'Family with children', household_size: 3 },
      sensitivities: { respiratory_sensitivity: true, asthma_concerns: false, allergies: true, other_air_pollution_sensitivity: false },
      lifestyle: { usual_commute: 'Cycling', usual_outdoor_activity_time: 'Morning' },
      home: { air_purifier_available: true, air_conditioning_available: false, kitchen_exhaust_ventilation: true, can_open_windows: false, budget_preference: 'Some flexibility' },
    },
    'Fallback',
    'Bengaluru',
  );
  assert.equal(merged.full_name, 'Riya');
  assert.equal(merged.household_size, 3);
  assert.deepEqual(merged.optional_sensitivities, ['Respiratory sensitivity', 'Allergies']);
  assert.equal(merged.commute_method, 'Cycling');
  assert.equal(merged.air_purifier_available, true);
  assert.equal(merged.outdoor_ventilation_available, false);

  const legacyMerged = mergeOnboardingData(
    { personal: { optional_sensitivities: ['Allergies'], commute_method: 'Walking' } },
    'Asha',
    'Mysuru',
  );
  assert.equal(legacyMerged.full_name, 'Asha');
  assert.equal(legacyMerged.city, 'Mysuru');
  assert.deepEqual(legacyMerged.optional_sensitivities, ['Allergies']);
});

test('syncLocalProfileAndPlace stores geocoded coordinates and falls back cleanly on error', async () => {
  const store = new Map();
  const storage = {
    setItem: (k, v) => store.set(k, v),
    getItem: (k) => store.get(k) ?? null,
  };

  await syncLocalProfileAndPlace(
    { city: 'Bengaluru', country: 'India', household_type: 'Individual', optional_sensitivities: [] },
    {
      storage,
      fetchImpl: async () => ({
        json: async () => ({
          results: [{ name: 'Bengaluru', admin1: 'Karnataka', country: 'India', country_code: 'IN', latitude: 12.97, longitude: 77.59 }],
        }),
      }),
    },
  );
  assert.equal(JSON.parse(store.get('airaware-place')).countryCode, 'IN');
  assert.equal(JSON.parse(store.get('airaware-place')).latitude, 12.97);

  await syncLocalProfileAndPlace(
    { city: 'Kochi', country: 'India', household_type: 'Individual', optional_sensitivities: [] },
    {
      storage,
      fetchImpl: async () => {
        throw new Error('Network unavailable');
      },
    },
  );
  assert.equal(JSON.parse(store.get('airaware-place')).city, 'Kochi');
  assert.equal(JSON.parse(store.get('airaware-place')).latitude, null);
});
