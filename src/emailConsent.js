import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config';

// Saves "Send me the daily devotional" for the person who just signed up and is now signed in.
// It is stored with the time and where they ticked it. Best effort: a failure here must never get
// in the way of creating the account.
export async function saveDevotionalConsent(accessToken, source) {
  if (!accessToken) return;
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/save-email-consent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ devotional: true, source }),
    });
  } catch {
    /* ignore */
  }
}
