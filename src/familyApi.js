// Spiritual Family data access. One Mother or Pastor ("the leader") sits
// at the center of a family with up to 6 accepted Seekers/Assistants
// ("siblings") around her. Formation is a real request-and-accept flow
// (see requestToJoinFamily / respondToRequest) — there is no admin step.
// Call packages are deliberately NOT here: per this round's explicit
// decision, they stay a "coming soon" screen until real billing exists.
import { supabase } from './supabaseClient';

export const MAX_SIBLINGS = 6;

// Six preset slots roughly matching the reference mind map's layout —
// used to place a newly-accepted sibling somewhere reasonable before the
// Mother ever drags anyone. Index = however many siblings are already
// accepted when this one is accepted.
export const DEFAULT_SLOTS = [
  { pos_x: -0.62, pos_y: -0.55 },
  { pos_x: -0.85, pos_y: 0.05 },
  { pos_x: -0.6, pos_y: 0.7 },
  { pos_x: 0.62, pos_y: -0.55 },
  { pos_x: 0.85, pos_y: 0.05 },
  { pos_x: 0.6, pos_y: 0.7 },
];

// --- Family shell ---

export async function fetchFamilyByLeader(leaderAuthId) {
  if (!leaderAuthId) return null;
  const { data } = await supabase
    .from('spiritual_families')
    .select('*')
    .eq('leader_auth_id', leaderAuthId)
    .maybeSingle();
  return data || null;
}

export async function fetchFamilyById(familyId) {
  if (!familyId) return null;
  const { data } = await supabase.from('spiritual_families').select('*').eq('id', familyId).maybeSingle();
  return data || null;
}

// The Mother's/Pastor's own freeform guidance note — replaces the old
// static "Do's and Don'ts" copy. One per family (lives on the family row
// itself, not per-sibling), fully hers to write/edit: starter do's/don'ts,
// her own extra sections, whatever she wants siblings' pages to remind her
// of. Readable by anyone (families_select_all), writable only by the
// leader (families_update_leader) — both policies already exist.
export async function updateMotherGuidance(familyId, text) {
  const { error } = await supabase
    .from('spiritual_families')
    .update({ mother_guidance: text })
    .eq('id', familyId);
  if (error) throw error;
}

// Lazily creates the family shell the first time it's needed — either a
// Mother/Pastor opening their own Family tab, or the first sibling ever
// requesting to join them. Safe to call repeatedly (unique constraint on
// leader_auth_id means a second insert just fails, so this falls back to
// re-fetching rather than erroring).
export async function getOrCreateFamily(leaderAuthId, leaderRole) {
  const existing = await fetchFamilyByLeader(leaderAuthId);
  if (existing) return existing;
  const { data, error } = await supabase
    .from('spiritual_families')
    .insert({ leader_auth_id: leaderAuthId, leader_role: leaderRole })
    .select('*')
    .single();
  if (error) {
    const fallback = await fetchFamilyByLeader(leaderAuthId);
    if (fallback) return fallback;
    throw error;
  }
  return data;
}

// --- Membership / requests ---

export async function fetchMyMembership(myAuthId) {
  if (!myAuthId) return null;
  const { data } = await supabase
    .from('family_memberships')
    .select('*')
    .eq('sibling_auth_id', myAuthId)
    .in('status', ['pending', 'accepted'])
    .maybeSingle();
  return data || null;
}

export async function requestToJoinFamily(myAuthId, leaderAuthId, leaderRole) {
  const family = await getOrCreateFamily(leaderAuthId, leaderRole);
  const { data, error } = await supabase
    .from('family_memberships')
    .insert({ family_id: family.id, sibling_auth_id: myAuthId, status: 'pending' })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function withdrawRequest(membershipId) {
  const { error } = await supabase.from('family_memberships').delete().eq('id', membershipId);
  if (error) throw error;
}

export async function fetchPendingRequests(familyId) {
  if (!familyId) return [];
  const { data, error } = await supabase
    .from('family_memberships')
    .select('*')
    .eq('family_id', familyId)
    .eq('status', 'pending')
    .order('requested_at', { ascending: true });
  if (error || !data) return [];
  return data;
}

export async function fetchFamilyMembers(familyId) {
  if (!familyId) return [];
  const { data, error } = await supabase
    .from('family_memberships')
    .select('*')
    .eq('family_id', familyId)
    .eq('status', 'accepted')
    .order('decided_at', { ascending: true });
  if (error || !data) return [];
  return data;
}

// Accepting also assigns a default position if the sibling doesn't have
// one yet — `acceptedCountBefore` picks which of the 6 preset slots to
// use, so pass the count of already-accepted siblings at call time.
export async function respondToRequest(membership, accept, acceptedCountBefore) {
  const patch = { status: accept ? 'accepted' : 'declined', decided_at: new Date().toISOString() };
  if (accept) {
    const slot = DEFAULT_SLOTS[acceptedCountBefore % DEFAULT_SLOTS.length];
    patch.pos_x = slot.pos_x;
    patch.pos_y = slot.pos_y;
  }
  const { error } = await supabase.from('family_memberships').update(patch).eq('id', membership.id);
  if (error) throw error;
}

export async function updateSiblingPosition(membershipId, pos_x, pos_y) {
  const { error } = await supabase.from('family_memberships').update({ pos_x, pos_y }).eq('id', membershipId);
  if (error) throw error;
}

// --- Weekly shares (siblings) ---

export async function fetchSiblingUpdate(siblingAuthId) {
  if (!siblingAuthId) return null;
  const { data } = await supabase.from('family_updates').select('*').eq('sibling_auth_id', siblingAuthId).maybeSingle();
  return data || null;
}

export async function upsertMyUpdate(myAuthId, familyId, fields) {
  const { error } = await supabase
    .from('family_updates')
    .upsert({ sibling_auth_id: myAuthId, family_id: familyId, ...fields, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function fetchPrivateNote(siblingAuthId) {
  if (!siblingAuthId) return null;
  const { data } = await supabase.from('family_private_notes').select('*').eq('sibling_auth_id', siblingAuthId).maybeSingle();
  return data || null;
}

export async function upsertMyPrivateNote(myAuthId, familyId, note) {
  const { error } = await supabase
    .from('family_private_notes')
    .upsert({ sibling_auth_id: myAuthId, family_id: familyId, note, updated_at: new Date().toISOString() });
  if (error) throw error;
}

// The Mother's/Pastor's reply to a sibling's private note (presented in the
// app as "Present Challenges"). Keyed by the SIBLING's auth id, not the
// leader's — a leader can write this even before the sibling has written
// anything yet (notes_insert_leader lets her create the row), which is why
// this is a separate function from upsertMyPrivateNote rather than reusing
// it with a different id.
export async function upsertMotherResponse(familyId, siblingAuthId, response) {
  const { error } = await supabase
    .from('family_private_notes')
    .upsert({ sibling_auth_id: siblingAuthId, family_id: familyId, mother_response: response, updated_at: new Date().toISOString() });
  if (error) throw error;
}

// --- Family group chat ---
// One thread per family — the Mother/Pastor plus every currently-accepted
// sibling, same shape as the 1:1 conversations in chatApi.js (sender +
// body + created_at) but scoped to family_id instead of a user pair.

export async function fetchFamilyGroupMessages(familyId) {
  if (!familyId) return [];
  const { data, error } = await supabase
    .from('family_group_messages')
    .select('*')
    .eq('family_id', familyId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function sendFamilyGroupMessage(familyId, myAuthId, body) {
  const trimmed = body.trim();
  if (!trimmed) return null;
  const { data, error } = await supabase
    .from('family_group_messages')
    .insert({ family_id: familyId, sender_auth_id: myAuthId, body: trimmed })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

// Live delivery for an open group chat thread — family_group_messages was
// added to the supabase_realtime publication in the same migration that
// created it. Caller unsubscribes on unmount via chatApi's `unsubscribe`
// (a generic supabase.removeChannel wrapper, nothing chat-specific in it).
export function subscribeToFamilyGroupMessages(familyId, onInsert) {
  const channel = supabase
    .channel(`family_group_messages:${familyId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'family_group_messages', filter: `family_id=eq.${familyId}` },
      (payload) => onInsert(payload.new)
    )
    .subscribe();
  return channel;
}

// --- Mother's / Pastor's own weekly share ---

export async function fetchMotherPost(familyId) {
  if (!familyId) return null;
  const { data } = await supabase.from('family_mother_posts').select('*').eq('family_id', familyId).maybeSingle();
  return data || null;
}

export async function upsertMotherPost(familyId, fields) {
  const { error } = await supabase
    .from('family_mother_posts')
    .upsert({ family_id: familyId, ...fields, updated_at: new Date().toISOString() });
  if (error) throw error;
}

// --- Practices ---

export async function fetchPractices(familyId) {
  if (!familyId) return [];
  const { data, error } = await supabase
    .from('family_practices')
    .select('*')
    .eq('family_id', familyId)
    .order('sort_order', { ascending: true });
  if (error || !data) return [];
  return data;
}

export async function addPractice(familyId, label, sortOrder) {
  const { error } = await supabase.from('family_practices').insert({ family_id: familyId, label, sort_order: sortOrder });
  if (error) throw error;
}

export async function deletePractice(practiceId) {
  const { error } = await supabase.from('family_practices').delete().eq('id', practiceId);
  if (error) throw error;
}

export async function fetchMyChecks(myAuthId) {
  if (!myAuthId) return new Set();
  const { data, error } = await supabase.from('family_practice_checks').select('practice_id').eq('sibling_auth_id', myAuthId);
  if (error || !data) return new Set();
  return new Set(data.map((r) => r.practice_id));
}

export async function toggleCheck(practiceId, myAuthId, checked) {
  if (checked) {
    const { error } = await supabase.from('family_practice_checks').insert({ practice_id: practiceId, sibling_auth_id: myAuthId });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('family_practice_checks')
      .delete()
      .eq('practice_id', practiceId)
      .eq('sibling_auth_id', myAuthId);
    if (error) throw error;
  }
}

// --- Daily content ---

export async function fetchDailyContent(familyId) {
  if (!familyId) return [];
  const { data, error } = await supabase
    .from('family_daily_content')
    .select('*')
    .eq('family_id', familyId)
    .order('sort_order', { ascending: true });
  if (error || !data) return [];
  return data;
}

export async function addDailyContent(familyId, fields, sortOrder) {
  const { error } = await supabase.from('family_daily_content').insert({ family_id: familyId, ...fields, sort_order: sortOrder });
  if (error) throw error;
}

export async function deleteDailyContent(id) {
  const { error } = await supabase.from('family_daily_content').delete().eq('id', id);
  if (error) throw error;
}
