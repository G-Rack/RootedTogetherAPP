// "Real Family" data access — a separate, parallel feature from
// familyApi.js's Spiritual Family. Any account, any role, can create and
// own one real family and invite others into it (a birth mom and dad
// managing their own kids, for instance) — there's no Mother/Pastor
// restriction here and no public "request to join" flow, since you don't
// apply to join your own family. Instead the owner invites someone
// directly (see inviteToRealFamily) and the invitee accepts or declines.
import { supabase } from './supabaseClient';
import { DEFAULT_SLOTS } from './familyApi';

export { DEFAULT_SLOTS };

// --- Family shell ---

export async function fetchRealFamilyByOwner(ownerAuthId) {
  if (!ownerAuthId) return null;
  const { data } = await supabase
    .from('real_families')
    .select('*')
    .eq('owner_auth_id', ownerAuthId)
    .maybeSingle();
  return data || null;
}

export async function fetchRealFamilyById(familyId) {
  if (!familyId) return null;
  const { data } = await supabase.from('real_families').select('*').eq('id', familyId).maybeSingle();
  return data || null;
}

export async function createRealFamily(ownerAuthId, familyName) {
  const { data, error } = await supabase
    .from('real_families')
    .insert({ owner_auth_id: ownerAuthId, family_name: familyName?.trim() || null })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updateRealFamilyName(familyId, familyName) {
  const { error } = await supabase
    .from('real_families')
    .update({ family_name: familyName?.trim() || null })
    .eq('id', familyId);
  if (error) throw error;
}

// --- Membership / invites ---

// A person can only be an accepted-or-pending member of one real family at
// a time (same v1 limit Spiritual Family places on siblings) — this is
// independent of owning your own real family, so someone can own one AND
// have a pending/accepted membership row in someone else's.
export async function fetchMyRealFamilyMembership(myAuthId) {
  if (!myAuthId) return null;
  const { data } = await supabase
    .from('real_family_members')
    .select('*')
    .eq('member_auth_id', myAuthId)
    .in('status', ['pending', 'accepted'])
    .maybeSingle();
  return data || null;
}

export async function inviteToRealFamily(familyId, memberAuthId, relationship) {
  const { data, error } = await supabase
    .from('real_family_members')
    .insert({ family_id: familyId, member_auth_id: memberAuthId, relationship: relationship?.trim() || null, status: 'pending' })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

// Covers declining a pending invite, leaving an accepted family, or (when
// called by the owner) cancelling an invite / removing a member — all the
// same delete, just invoked from different places.
export async function removeRealFamilyMember(membershipId) {
  const { error } = await supabase.from('real_family_members').delete().eq('id', membershipId);
  if (error) throw error;
}

export async function fetchPendingRealFamilyInvites(familyId) {
  if (!familyId) return [];
  const { data, error } = await supabase
    .from('real_family_members')
    .select('*')
    .eq('family_id', familyId)
    .eq('status', 'pending')
    .order('invited_at', { ascending: true });
  if (error || !data) return [];
  return data;
}

export async function fetchRealFamilyMembers(familyId) {
  if (!familyId) return [];
  const { data, error } = await supabase
    .from('real_family_members')
    .select('*')
    .eq('family_id', familyId)
    .eq('status', 'accepted')
    .order('decided_at', { ascending: true });
  if (error || !data) return [];
  return data;
}

// Accepting assigns a default position the same way Spiritual Family does,
// cycling through DEFAULT_SLOTS — there's no hard cap on real family size
// the way Spiritual Family caps at 6, so this just wraps around past 6.
export async function acceptRealFamilyInvite(membership, acceptedCountBefore) {
  const slot = DEFAULT_SLOTS[acceptedCountBefore % DEFAULT_SLOTS.length];
  const { error } = await supabase
    .from('real_family_members')
    .update({ status: 'accepted', decided_at: new Date().toISOString(), pos_x: slot.pos_x, pos_y: slot.pos_y })
    .eq('id', membership.id);
  if (error) throw error;
}

export async function updateRealFamilyMemberPosition(membershipId, pos_x, pos_y) {
  const { error } = await supabase.from('real_family_members').update({ pos_x, pos_y }).eq('id', membershipId);
  if (error) throw error;
}

// --- Group chat ---
// Same shape as family_group_messages in familyApi.js — one thread per
// real family, the owner plus every currently-accepted member.

export async function fetchRealFamilyGroupMessages(familyId) {
  if (!familyId) return [];
  const { data, error } = await supabase
    .from('real_family_group_messages')
    .select('*')
    .eq('family_id', familyId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function sendRealFamilyGroupMessage(familyId, myAuthId, body) {
  const trimmed = body.trim();
  if (!trimmed) return null;
  const { data, error } = await supabase
    .from('real_family_group_messages')
    .insert({ family_id: familyId, sender_auth_id: myAuthId, body: trimmed })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export function subscribeToRealFamilyGroupMessages(familyId, onInsert) {
  const channel = supabase
    .channel(`real_family_group_messages:${familyId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'real_family_group_messages', filter: `family_id=eq.${familyId}` },
      (payload) => onInsert(payload.new)
    )
    .subscribe();
  return channel;
}
