import { SENSITIVITY_OPTIONS } from './onboardingOptions.js';
import { toDashboardProfile } from './airQualityUtils.js';

export const BLANK_PROFILE = {
  full_name: '',
  age_range: '',
  city: '',
  state: '',
  country: 'India',
  preferred_language: 'English',
  household_type: 'Family with children',
  household_size: '',
  optional_sensitivities: [],
  commute_method: 'Private car',
  outdoor_activity_time: 'Morning',
  air_purifier_available: false,
  air_conditioning_available: false,
  kitchen_exhaust_available: false,
  outdoor_ventilation_available: true,
  budget_preference: 'Low cost first',
};

/**
 * Validate minimum password complexity requirements for signup and password updates.
 */
export function hasValidPassword(password = '') {
  return (
    typeof password === 'string' &&
    password.length >= 10 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password)
  );
}

/**
 * Merge records across normalized onboarding tables with legacy user_profiles fallbacks.
 */
export function mergeOnboardingData(records = {}, nameFallback = '', cityFallback = '') {
  const personal = records.personal || {};
  const legacySens = Array.isArray(personal.optional_sensitivities) ? personal.optional_sensitivities : [];
  const sensitivityValues = records.sensitivities
    ? SENSITIVITY_OPTIONS.filter(({ column }) => records.sensitivities[column]).map(({ label }) => label)
    : legacySens;
  const household = records.household;
  const lifestyle = records.lifestyle;
  const home = records.home;

  return {
    ...BLANK_PROFILE,
    ...personal,
    full_name: personal.full_name || nameFallback || '',
    city: personal.city || cityFallback || '',
    household_type: household?.household_type ?? personal.household_type ?? BLANK_PROFILE.household_type,
    household_size: household ? household.household_size ?? '' : personal.household_size ?? '',
    optional_sensitivities: sensitivityValues,
    commute_method: lifestyle ? lifestyle.usual_commute ?? '' : personal.commute_method ?? BLANK_PROFILE.commute_method,
    outdoor_activity_time: lifestyle
      ? lifestyle.usual_outdoor_activity_time ?? ''
      : personal.outdoor_activity_time ?? BLANK_PROFILE.outdoor_activity_time,
    air_purifier_available:
      home?.air_purifier_available ?? personal.air_purifier_available ?? BLANK_PROFILE.air_purifier_available,
    air_conditioning_available:
      home?.air_conditioning_available ?? personal.air_conditioning_available ?? BLANK_PROFILE.air_conditioning_available,
    kitchen_exhaust_available:
      home?.kitchen_exhaust_ventilation ?? personal.kitchen_exhaust_available ?? BLANK_PROFILE.kitchen_exhaust_available,
    outdoor_ventilation_available:
      home?.can_open_windows ?? personal.outdoor_ventilation_available ?? BLANK_PROFILE.outdoor_ventilation_available,
    budget_preference: home ? home.budget_preference ?? '' : personal.budget_preference ?? BLANK_PROFILE.budget_preference,
  };
}

/**
 * Sync the user's merged onboarding profile and geocoded coordinates into localStorage.
 */
export async function syncLocalProfileAndPlace(
  mergedProfile,
  { storage = globalThis.localStorage, fetchImpl = globalThis.fetch } = {},
) {
  storage?.setItem('airaware-profile', JSON.stringify(toDashboardProfile(mergedProfile)));
  if (!mergedProfile?.city) return;
  storage?.setItem('airaware-city', mergedProfile.city);

  const fallbackPlace = {
    city: mergedProfile.city,
    country: mergedProfile.country || '',
    countryCode: '',
    latitude: null,
    longitude: null,
  };

  try {
    const response = await fetchImpl(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(mergedProfile.city)}&count=1&language=en&format=json`,
    );
    const result = (await response.json())?.results?.[0];
    storage?.setItem(
      'airaware-place',
      JSON.stringify(
        result
          ? {
              city: [result.name, result.admin1].filter(Boolean).join(', '),
              country: result.country,
              countryCode: result.country_code || '',
              latitude: result.latitude,
              longitude: result.longitude,
            }
          : fallbackPlace,
      ),
    );
  } catch {
    storage?.setItem('airaware-place', JSON.stringify(fallbackPlace));
  }
}
