import { createClient } from '@supabase/supabase-js';

const env = import.meta.env || {};
const url = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_ANON_KEY;

const hasRealKey = Boolean(anonKey && !anonKey.toLowerCase().includes('paste-your-anon-key'));
export const supabaseConfigured = Boolean(url && anonKey && hasRealKey);
export const supabase = supabaseConfigured
  ? createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;
