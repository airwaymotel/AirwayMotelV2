import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Check if real Supabase credentials are configured
const isConfigured =
  supabaseUrl.length > 10 &&
  supabaseAnonKey.length > 10 &&
  !supabaseUrl.includes('your_') &&
  !supabaseAnonKey.includes('your_');

export const supabase = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export const isSupabaseConnected = isConfigured;

if (!isConfigured) {
  console.warn(
    '[Airway Motel] Supabase not configured — running with local mock data.\n' +
    'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local to connect.'
  );
}
