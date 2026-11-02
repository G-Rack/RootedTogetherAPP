import { supabase } from './supabaseClient';

// Creator Pro is bought on the website; the creator_pro table is the single
// source of truth and is publicly readable, so the app only ever reads it.

// Set of auth user ids that are on Creator Pro (for the Directory badge + ordering).
export async function fetchProIds() {
  const { data, error } = await supabase.from('creator_pro').select('auth_user_id');
  if (error || !data) return new Set();
  return new Set(data.map((r) => r.auth_user_id));
}

// Whether one person is on Creator Pro (for a profile screen).
export async function fetchIsPro(authUserId) {
  if (!authUserId) return false;
  const { data, error } = await supabase
    .from('creator_pro')
    .select('auth_user_id')
    .eq('auth_user_id', authUserId)
    .maybeSingle();
  return !error && !!data;
}
