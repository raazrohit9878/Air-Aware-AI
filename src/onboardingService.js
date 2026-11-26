import { supabase } from './supabase.js';
import {
  BUDGET_OPTIONS,
  COMMUTE_OPTIONS,
  HOUSEHOLD_TYPE_OPTIONS,
  OUTDOOR_ACTIVITY_TIME_OPTIONS,
  SENSITIVITY_OPTIONS,
} from './onboardingOptions.js';

const ONBOARDING_TABLES = [
  'user_profiles',
  'household_profiles',
  'sensitivity_profiles',
  'lifestyle_profiles',
  'home_profiles',
];

function ensureSupabaseClient(client = supabase) {
  if (!client) throw new Error('Supabase is not configured.');
  return client;
}

async function authenticatedUserId(client = supabase) {
  const sb = ensureSupabaseClient(client);
  const { data, error } = await sb.auth.getUser();
  if (error) throw error;
  if (!data.user?.id) throw new Error('Your session expired. Sign in again to continue.');
  return data.user.id;
}

async function saveOwnRow(table, values, client = supabase) {
  const sb = ensureSupabaseClient(client);
  const userId = await authenticatedUserId(sb);
  const { data, error } = await sb
    .from(table)
    .upsert({ user_id: userId, ...values }, { onConflict: 'user_id' })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/**
 * Load all onboarding sections for the currently authenticated user.
 */
export async function loadOnboardingData(client = supabase) {
  const sb = ensureSupabaseClient(client);
  const userId = await authenticatedUserId(sb);
  const results = await Promise.all(
    ONBOARDING_TABLES.map(async (table) => {
      const { data, error } = await sb
        .from(table)
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    }),
  );
  return {
    personal: results[0],
    household: results[1],
    sensitivities: results[2],
    lifestyle: results[3],
    home: results[4],
  };
}

/**
 * Save Step 1 personal profile fields into user_profiles.
 */
export async function savePersonalProfile(values, client = supabase) {
  const sb = ensureSupabaseClient(client);
  const userId = await authenticatedUserId(sb);
  const { data: existing, error: lookupError } = await sb
    .from('user_profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  if (lookupError) throw lookupError;

  const row = {
    id: existing?.id || userId,
    user_id: userId,
    full_name: String(values.full_name || '').trim(),
    age_range: values.age_range || null,
    city: String(values.city || '').trim(),
    state: String(values.state || '').trim() || null,
    country: String(values.country || '').trim(),
    preferred_language: values.preferred_language || 'English',
  };
  const { data, error } = await sb
    .from('user_profiles')
    .upsert(row, { onConflict: 'user_id' })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/**
 * Validate and save Step 2 household type and optional size.
 */
export async function saveHouseholdProfile(householdType, householdSize, client = supabase) {
  if (!HOUSEHOLD_TYPE_OPTIONS.includes(householdType)) {
    throw new Error('Choose a household type from the available options.');
  }
  const size = householdSize === '' || householdSize == null ? null : Number(householdSize);
  if (size !== null && (!Number.isInteger(size) || size <= 0)) {
    throw new Error('Household size must be a positive whole number, or left blank.');
  }
  return saveOwnRow('household_profiles', { household_type: householdType, household_size: size }, client);
}

/**
 * Validate and save Step 3 optional sensitivity flags.
 */
export async function saveSensitivityProfile(selectedLabels = [], client = supabase) {
  const validLabels = new Set(SENSITIVITY_OPTIONS.map(({ label }) => label));
  if (selectedLabels.some((label) => !validLabels.has(label))) {
    throw new Error('A sensitivity selection is not valid.');
  }
  const selected = new Set(selectedLabels);
  return saveOwnRow(
    'sensitivity_profiles',
    Object.fromEntries(SENSITIVITY_OPTIONS.map(({ label, column }) => [column, selected.has(label)])),
    client,
  );
}

/**
 * Validate and save Step 4 commute and outdoor routine preferences.
 */
export async function saveLifestyleProfile(commute, activityTime, client = supabase) {
  if (commute != null && commute !== '' && !COMMUTE_OPTIONS.includes(commute)) {
    throw new Error('Choose a commute method from the available options.');
  }
  if (activityTime != null && activityTime !== '' && !OUTDOOR_ACTIVITY_TIME_OPTIONS.includes(activityTime)) {
    throw new Error('Choose an outdoor activity time from the available options.');
  }
  return saveOwnRow(
    'lifestyle_profiles',
    {
      usual_commute: commute || null,
      usual_outdoor_activity_time: activityTime || null,
    },
    client,
  );
}

/**
 * Validate and save Step 5 indoor setup and budget preference.
 */
export async function saveHomeProfile(values, client = supabase) {
  if (values.budget_preference && !BUDGET_OPTIONS.includes(values.budget_preference)) {
    throw new Error('Choose a budget option from the available options.');
  }
  return saveOwnRow(
    'home_profiles',
    {
      air_purifier_available: Boolean(values.air_purifier_available),
      air_conditioning_available: Boolean(values.air_conditioning_available),
      kitchen_exhaust_ventilation: Boolean(values.kitchen_exhaust_available ?? values.kitchen_exhaust_ventilation),
      can_open_windows: Boolean(values.can_open_windows),
      budget_preference: values.budget_preference || null,
    },
    client,
  );
}

/**
 * Persist dashboard household edits across the corresponding Supabase onboarding tables.
 */
export async function syncDashboardHousehold(profile, existingRecords = null, client = supabase) {
  const sb = ensureSupabaseClient(client);
  const current = existingRecords || (await loadOnboardingData(sb));
  const householdType = HOUSEHOLD_TYPE_OPTIONS.includes(profile.household)
    ? profile.household
    : current.household?.household_type || 'Individual';
  const commute = COMMUTE_OPTIONS.includes(profile.commute)
    ? profile.commute
    : current.lifestyle?.usual_commute || null;
  const budget = BUDGET_OPTIONS.includes(profile.budget)
    ? profile.budget
    : current.home?.budget_preference || null;

  await Promise.all([
    saveHouseholdProfile(householdType, current.household?.household_size ?? null, sb),
    saveLifestyleProfile(commute, current.lifestyle?.usual_outdoor_activity_time ?? null, sb),
    saveHomeProfile(
      {
        air_purifier_available: Boolean(profile.purifier),
        air_conditioning_available: Boolean(current.home?.air_conditioning_available),
        kitchen_exhaust_ventilation: Boolean(current.home?.kitchen_exhaust_ventilation),
        can_open_windows: Boolean(profile.ventilation),
        budget_preference: budget,
      },
      sb,
    ),
  ]);
}

/**
 * Delete all household profile rows belonging to the signed-in user across onboarding tables.
 */
export async function deleteAllOnboardingData(client = supabase) {
  const sb = ensureSupabaseClient(client);
  const userId = await authenticatedUserId(sb);
  for (const table of ONBOARDING_TABLES) {
    const { error } = await sb.from(table).delete().eq('user_id', userId);
    if (error && error.code !== 'PGRST205') throw error;
  }
}
