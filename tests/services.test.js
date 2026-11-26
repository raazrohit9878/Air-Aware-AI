import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deleteAllOnboardingData,
  loadOnboardingData,
  saveHomeProfile,
  saveHouseholdProfile,
  saveLifestyleProfile,
  savePersonalProfile,
  saveSensitivityProfile,
  syncDashboardHousehold,
} from '../src/onboardingService.js';
import { loadCommunityStats, logCommunityActivity } from '../src/communityService.js';

function createMockSupabase(userId = 'user-123') {
  const calls = [];
  return {
    calls,
    auth: {
      getUser: async () => ({ data: { user: userId ? { id: userId } : null }, error: null }),
    },
    from(table) {
      return {
        upsert(row, options) {
          calls.push({ op: 'upsert', table, row, options });
          return {
            select: () => ({
              single: async () => ({ data: row, error: null }),
            }),
          };
        },
        insert: async (row) => {
          calls.push({ op: 'insert', table, row });
          return { error: null };
        },
        select() {
          return {
            eq: () => ({
              maybeSingle: async () => ({ data: { id: userId, user_id: userId }, error: null }),
            }),
          };
        },
        delete() {
          return {
            eq: async (col, val) => {
              calls.push({ op: 'delete', table, col, val });
              return { error: null };
            },
          };
        },
      };
    },
    rpc: async (fn, args) => {
      calls.push({ op: 'rpc', fn, args });
      return { data: { available: false, reason: 'privacy_threshold' }, error: null };
    },
  };
}

test('onboardingService validates inputs, persists sections, and cleans up all tables on delete', async () => {
  const sb = createMockSupabase();

  const personal = await savePersonalProfile(
    { full_name: ' Asha ', city: ' Bengaluru ', state: ' Karnataka ', country: ' India ', preferred_language: 'English' },
    sb,
  );
  assert.equal(personal.full_name, 'Asha');
  assert.equal(personal.city, 'Bengaluru');

  await assert.rejects(() => saveHouseholdProfile('InvalidType', 2, sb));
  await assert.rejects(() => saveHouseholdProfile('Individual', 0, sb));
  const household = await saveHouseholdProfile('Family with children', '4', sb);
  assert.equal(household.household_size, 4);

  await assert.rejects(() => saveSensitivityProfile(['Unknown option'], sb));
  const sens = await saveSensitivityProfile(['Allergies'], sb);
  assert.equal(sens.allergies, true);
  assert.equal(sens.respiratory_sensitivity, false);

  await assert.rejects(() => saveLifestyleProfile('Rocket', 'Morning', sb));
  const lifestyle = await saveLifestyleProfile('Private car', 'Morning', sb);
  assert.equal(lifestyle.usual_commute, 'Private car');

  await assert.rejects(() => saveHomeProfile({ budget_preference: 'Unlimited' }, sb));
  const home = await saveHomeProfile({ air_purifier_available: true, budget_preference: 'Low cost first' }, sb);
  assert.equal(home.air_purifier_available, true);

  await syncDashboardHousehold(
    { household: 'Student', commute: 'Public transportation', purifier: false, ventilation: true, budget: 'No extra budget' },
    { household: { household_size: 1 }, lifestyle: { usual_outdoor_activity_time: 'Evening' }, home: {} },
    sb,
  );
  const syncedTables = sb.calls.slice(-3).map((c) => c.table);
  assert.deepEqual(syncedTables, ['household_profiles', 'lifestyle_profiles', 'home_profiles']);

  const loaded = await loadOnboardingData(sb);
  assert.ok(loaded.personal && loaded.household && loaded.sensitivities && loaded.lifestyle && loaded.home);

  await deleteAllOnboardingData(sb);
  const deletedTables = sb.calls.filter((c) => c.op === 'delete').map((c) => c.table);
  assert.deepEqual(deletedTables, [
    'user_profiles',
    'household_profiles',
    'sensitivity_profiles',
    'lifestyle_profiles',
    'home_profiles',
  ]);
});

test('communityService validates activities, rejects unauthenticated callers, and normalizes cities', async () => {
  const unauthSb = createMockSupabase(null);
  await assert.rejects(() => loadCommunityStats('Bengaluru', unauthSb));

  const sb = createMockSupabase();
  await assert.rejects(
    () => logCommunityActivity({ city: '', activityType: 'shared_trip', distanceKm: 5, estimatedCo2eKg: 1 }, sb),
  );
  await assert.rejects(
    () => logCommunityActivity({ city: 'Bengaluru', activityType: 'invalid', distanceKm: 5, estimatedCo2eKg: 1 }, sb),
  );
  await logCommunityActivity(
    { city: 'Bengaluru, Karnataka', activityType: 'shared_trip', distanceKm: 16, estimatedCo2eKg: 3.072 },
    sb,
  );
  const inserted = sb.calls.find((c) => c.op === 'insert');
  assert.equal(inserted.row.city, 'Bengaluru');

  const stats = await loadCommunityStats('Bengaluru, Karnataka', sb);
  assert.equal(stats.reason, 'privacy_threshold');
});
