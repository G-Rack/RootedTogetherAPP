// Where sign-ups get sent. This is a Supabase Edge Function, backed by a
// real Postgres database — both this app and the web app (join.html) call
// the same function, so they write to the same tables.
//
// The anon key below is meant to be public (it's what "publishable" means)
// — it does NOT grant read/write access to the database by itself. The
// Edge Function does all reading/writing using a separate secret key that
// only exists inside Supabase's servers, never in this app.
export const SUPABASE_URL = 'https://ethrhogtyebqndeyytqd.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0aHJob2d0eWVicW5kZXl5dHFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0MjE1MTIsImV4cCI6MjEwMzk5NzUxMn0.5VYHM6swun4gNrsqg7FwLS0dyG44bQtV2EteUt7Y1Bc';
export const SUBMIT_ENDPOINT = `${SUPABASE_URL}/functions/v1/submit-signup`;
// Finishes a first-time Apple/Google sign-in (creates their profile row).
export const COMPLETE_SOCIAL_SIGNUP_ENDPOINT = `${SUPABASE_URL}/functions/v1/complete-social-signup`;

// Lets a signed-in person replace their own profile photo after sign-up —
// profile-pictures is a private bucket with no client-facing upload
// policies, so this (like submit-signup) goes through an Edge Function
// using the service-role key rather than a direct client storage write.
export const UPDATE_PROFILE_PICTURE_ENDPOINT = `${SUPABASE_URL}/functions/v1/update-profile-picture`;

// Permanently deletes the signed-in person's own account. Deleting the
// underlying auth.users row needs the service-role key (never exposed to
// this app), so — same reasoning as the two endpoints above — this goes
// through an Edge Function rather than anything the client could do
// directly.
export const DELETE_ACCOUNT_ENDPOINT = `${SUPABASE_URL}/functions/v1/delete-account`;

// The companion website — a creator's storefront (their web shop) lives at
// WEB_BASE_URL/creator/<handle>, matching rooted-web's app/creator/[handle]
// route exactly. Used by the profile screen's shop icon.
export const WEB_BASE_URL = 'https://rootedtogether.club';
