import { supabase } from './supabase.js';

const ALLOWED_ACTIVITIES = new Set([
  'shared_trip',
  'combined_errands',
  'public_transport',
  'active_trip',
]);

async function ownUserId(client = supabase) {
  if (!client) throw new Error('Supabase is not configured.');
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  if (!data.user?.id) throw new Error('Sign in again to log this community activity.');
  return data.user.id;
}

/**
 * Log a household lower-emission trip estimate under the signed-in user's account.
 */
export async function logCommunityActivity(
  { city, activityType, distanceKm, estimatedCo2eKg },
  client = supabase,
) {
  const userId = await ownUserId(client);
  const normalizedCity = String(city || '').split(',')[0].trim().slice(0, 100);
  if (!normalizedCity) throw new Error('Choose a city before logging an activity.');
  if (!ALLOWED_ACTIVITIES.has(activityType)) {
    throw new Error('Choose a valid community activity.');
  }

  const distance = Number(distanceKm);
  const avoided = Number(estimatedCo2eKg);
  if (!Number.isFinite(distance) || distance < 0 || !Number.isFinite(avoided) || avoided < 0) {
    throw new Error('The activity estimate is invalid.');
  }

  const { error } = await client.from('community_activities').insert({
    user_id: userId,
    city: normalizedCity,
    activity_type: activityType,
    distance_km: distance,
    estimated_co2e_avoided_kg: avoided,
  });
  if (error) throw error;
}

/**
 * Load privacy-thresholded 30-day community activity totals for a city.
 */
export async function loadCommunityStats(city, client = supabase) {
  await ownUserId(client);
  const normalizedCity = String(city || '').split(',')[0].trim().slice(0, 100);
  const { data, error } = await client.rpc('get_airaware_community_stats', { p_city: normalizedCity });
  if (error) throw error;
  return data;
}
