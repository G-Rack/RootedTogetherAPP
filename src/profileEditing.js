// Shared plumbing for the real Edit Profile screen — lets a signed-in
// person see and change every field from their original sign-up, not just
// the limited subset `directory_listing` exposes (that view is role-
// agnostic on purpose and skips most role-specific columns, e.g. a
// Seeker's `support_needs` or a Mother's `licenses_certifications`).
//
// Everything here deliberately mirrors the submit-signup Edge Function's
// own TABLES / FIELD_MAP, since that function is the authoritative map of
// "human-readable field name the UI shows" -> "real Postgres column" for
// every role. Keeping a second copy here (rather than calling the Edge
// Function) is fine because reading/writing a person's OWN row is already
// covered by the `<role>_select_own` / `<role>_update_own` RLS policies —
// no service-role key is needed for this half of the work, only for the
// account-creation and photo/certification-upload paths that already have
// their own Edge Functions.
import { supabase } from './supabaseClient';
import { FLOWS } from './flows';

export const ROLE_TABLES = {
  seeker: 'seekers',
  assistant: 'assistants',
  mother: 'mothers',
  pastor: 'pastors',
  influencer: 'influencers',
};

// `flows.js`'s FLOWS object is keyed by sign-up flow name, and Pastor's
// flow key is "priest" (inherited from the original field naming) even
// though `directory_listing.role` / `profiles.role` / a person's own row
// all spell it "pastor". Every other role key matches directly.
export const ROLE_TO_FLOW_KEY = {
  seeker: 'seeker',
  assistant: 'assistant',
  mother: 'mother',
  pastor: 'priest',
  influencer: 'influencer',
};

// Copied from submit-signup's own FIELD_MAP — keyed by FLOWS key (so
// "priest", not "pastor"), human field name -> real column.
export const FIELD_MAP = {
  seeker: {
    'Name': 'name',
    'Nickname': 'nickname',
    'Preferred Display': 'preferred_display',
    'Email': 'email',
    'Date of Birth': 'date_of_birth',
    'Signing Up For': 'signing_up_for',
    'Child Age': 'child_age',
    'Religion': 'religion',
    'What Kind of Support Are You Looking For': 'support_needs',
    'Faith Background': 'faith_background',
    'Your Story': 'your_story',
    'Country': 'country',
    'Instagram': 'instagram',
  },
  assistant: {
    'Name': 'name',
    'Email': 'email',
    'Date of Birth': 'date_of_birth',
    'Your Story / Testimony': 'story_testimony',
    'Spiritual Gifts & Areas of Focus': 'spiritual_gifts',
    'Years of Experience': 'years_experience',
    'Faith Tradition / Church': 'faith_tradition_church',
    'Church or Pastoral Reference': 'church_pastoral_reference',
    'Anything Else': 'anything_else',
    'Instagram': 'instagram',
  },
  mother: {
    'Name': 'name',
    'Email': 'email',
    'Date of Birth': 'date_of_birth',
    'Your Story / Testimony': 'story_testimony',
    'Spiritual Gifts & Areas of Focus': 'spiritual_gifts',
    'Years of Experience': 'years_experience',
    'Faith Tradition / Church': 'faith_tradition_church',
    'Capacity (How Many People)': 'capacity',
    'Assistant Preference': 'assistant_preference',
    'Desired Amount Per Seeker': 'amount_per_seeker',
    'Church or Pastoral Reference': 'church_pastoral_reference',
    'Anything Else': 'anything_else',
    'Instagram': 'instagram',
    'Has Relevant Credentials': 'has_relevant_credentials',
    'Highest Level of Education': 'highest_level_of_education',
    'Licenses & Certifications': 'licenses_certifications',
    'Areas of Specialty': 'areas_of_specialty',
  },
  priest: {
    'Name': 'name',
    'Email': 'email',
    'Date of Birth': 'date_of_birth',
    'Church / Parish Name': 'church_parish_name',
    'Denomination': 'denomination',
    'Your Story / Testimony': 'story_testimony',
    'Years in Ministry': 'years_in_ministry',
    'Church Location': 'church_location',
    'Desired Amount Per Seeker': 'amount_per_seeker',
    'Anything Else': 'anything_else',
    'Instagram': 'instagram',
    'Has Relevant Credentials': 'has_relevant_credentials',
    'Highest Level of Education': 'highest_level_of_education',
    'Licenses & Certifications': 'licenses_certifications',
    'Areas of Specialty': 'areas_of_specialty',
  },
  influencer: {
    'Name': 'name',
    'Email': 'email',
    'Date of Birth': 'date_of_birth',
    'Instagram': 'instagram',
    'Approximate Following / Community Size': 'community_size',
    'Anything Else': 'anything_else',
    'Has Relevant Credentials': 'has_relevant_credentials',
    'Highest Level of Education': 'highest_level_of_education',
    'Licenses & Certifications': 'licenses_certifications',
    'Areas of Specialty': 'areas_of_specialty',
  },
};

// Field names that never go through the generic form — Password/Confirm
// Password are a separate "Change Password" Settings row, and Profile
// Picture already has its own pencil-badge upload flow. Certification
// Upload is excluded too: certification-documents is a private bucket
// with no client-facing write policy (same reason update-profile-picture
// exists as its own Edge Function), so re-uploading one isn't wired up
// here — Email is handled separately as well, shown read-only rather than
// through the generic field loop.
export const EXCLUDED_FIELD_NAMES = new Set([
  'Password', 'Confirm Password', 'Profile Picture', 'Certification Upload', 'Email',
]);

// The signed-in person's full own row from their actual role table (NOT
// directory_listing, which is missing most role-specific columns). Same
// "most recent row wins" tie-break as fetchMyDirectoryPerson, for the same
// reason (a test account could in theory have more than one row).
export async function fetchMyFullProfileRow(myAuthId, role) {
  const table = ROLE_TABLES[role];
  if (!myAuthId || !table) return null;
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('auth_user_id', myAuthId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error || !data || !data.length) return null;
  return data[0];
}

// Builds the FieldControl-ready form state from a fetched role-table row —
// the inverse of FIELD_MAP, keyed by field name instead of column so it
// drops straight into `formData[field.name]`.
export function buildFormDataFromRow(flowKey, row) {
  const map = FIELD_MAP[flowKey] || {};
  const formData = {};
  Object.entries(map).forEach(([fieldName, column]) => {
    const value = row ? row[column] : undefined;
    if (fieldName === 'Child Age') {
      formData[fieldName] = value == null ? '' : String(value);
    } else {
      formData[fieldName] = value == null ? (Array.isArray(value) ? [] : '') : value;
    }
  });
  return formData;
}

// Saves every mapped field (visible or currently hidden by a condition —
// hidden fields just keep writing back the value they already had) in one
// whitelisted update, straight to the person's own role-table row. RLS's
// `<role>_update_own` policy already permits this directly from the
// client; the whitelist here is what keeps a save from ever being able to
// touch something like vetting_status, since only columns FIELD_MAP
// explicitly names are ever included.
export async function saveMyProfileFields(myAuthId, role, flowKey, formData) {
  const table = ROLE_TABLES[role];
  const map = FIELD_MAP[flowKey] || {};
  if (!myAuthId || !table) throw new Error('Could not determine which profile to update.');

  const updates = {};
  Object.entries(map).forEach(([fieldName, column]) => {
    if (EXCLUDED_FIELD_NAMES.has(fieldName)) return;
    let value = formData[fieldName];
    if (fieldName === 'Child Age') {
      const n = parseInt(String(value ?? ''), 10);
      value = Number.isFinite(n) ? n : null;
    }
    if (value === undefined) value = null;
    if (value === '') value = null;
    updates[column] = value;
  });

  const { error } = await supabase.from(table).update(updates).eq('auth_user_id', myAuthId);
  if (error) throw error;
  return true;
}

// Whether the person has filled in any of the optional "tell us more about
// yourself" step that comes right after the required core step — e.g.
// Seeker's "Help us find the right fit" (support needs, faith background,
// your story, country, Instagram). This is exactly the step the Sign-up
// Decision screen's "Skip for now" button bypasses (see App.js), so this
// doubles as "did they skip at sign-up and never come back" — used by the
// Profile screen to show a gentle reminder plus a small notification dot
// on Settings and Edit Profile until at least one of those fields is set.
// Derived straight from flows.js/FIELD_MAP rather than hand-listing field
// names again, so it can't drift out of sync with either.
export function hasCompletedOptionalDetails(role, row) {
  if (!row) return false;
  const flowKey = ROLE_TO_FLOW_KEY[role];
  const flow = flowKey ? FLOWS[flowKey] : null;
  const step = flow?.steps?.[1]; // the first optional step, right after the core one
  if (!step) return true; // no optional step for this role — nothing to nudge about

  const map = FIELD_MAP[flowKey] || {};
  return step.fields.some((f) => {
    if (EXCLUDED_FIELD_NAMES.has(f.name)) return false; // Profile Picture etc. — not "details"
    const column = map[f.name];
    if (!column) return false;
    const v = row[column];
    if (Array.isArray(v)) return v.length > 0;
    return v !== null && v !== undefined && v !== '';
  });
}
