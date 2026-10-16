// Chat tab data access — conversations + messages, plus the Premium flag
// that gates starting a NEW conversation (see the long comment on
// PremiumUpsellScreen for the actual policy). Kept in its own file the same
// way postsApi.js holds all the Explore data access.
import { supabase } from './supabaseClient';
import { fetchBlockedIdSet, withoutBlocked } from './moderationApi';
import { notifyPush } from './notifications';

// --- Premium ---
// There's no real billing anywhere in the app yet. "Upgrading" just flips
// this flag on the signed-in person's own `profiles` row — a real,
// persisted decision, just not a paid one. profiles_select_own /
// profiles_update_own (auth.uid() = id) already allow this; no new RLS
// was needed for it.
export async function fetchIsPremium(myAuthId) {
  if (!myAuthId) return false;
  const { data, error } = await supabase
    .from('profiles')
    .select('is_premium')
    .eq('id', myAuthId)
    .maybeSingle();
  if (error || !data) return false;
  return !!data.is_premium;
}

export async function upgradeToPremium(myAuthId) {
  const { error } = await supabase.from('profiles').update({ is_premium: true }).eq('id', myAuthId);
  if (error) throw error;
}

// --- Conversations ---
// user_a is always the lexicographically smaller uuid (enforced by a DB
// check constraint) so there's exactly one row per pair of people no
// matter who messaged first — sort before every lookup/insert.
function sortPair(authIdOne, authIdTwo) {
  return authIdOne < authIdTwo ? [authIdOne, authIdTwo] : [authIdTwo, authIdOne];
}

export async function findConversationBetween(myAuthId, otherAuthId) {
  if (!myAuthId || !otherAuthId || myAuthId === otherAuthId) return null;
  const [a, b] = sortPair(myAuthId, otherAuthId);
  const { data } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_a', a)
    .eq('user_b', b)
    .maybeSingle();
  return data || null;
}

// Only call this once the Premium gate (if any) has already been cleared
// — it always creates a real conversation, no matter who's Premium.
export async function createConversation(myAuthId, otherAuthId) {
  const [a, b] = sortPair(myAuthId, otherAuthId);
  const { data, error } = await supabase
    .from('conversations')
    .insert({ user_a: a, user_b: b })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

// find-then-create, with a fallback re-fetch if two people (or a
// double-tap) both try to start the same conversation at once — the
// unique(user_a, user_b) constraint means the loser of that race gets a
// DB error rather than a duplicate row, so just fetch what won instead of
// surfacing that as a failure.
export async function getOrCreateConversation(myAuthId, otherAuthId) {
  const existing = await findConversationBetween(myAuthId, otherAuthId);
  if (existing) return existing;
  try {
    return await createConversation(myAuthId, otherAuthId);
  } catch (e) {
    const fallback = await findConversationBetween(myAuthId, otherAuthId);
    if (fallback) return fallback;
    throw e;
  }
}

export async function fetchConversations(myAuthId) {
  if (!myAuthId) return [];
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .or(`user_a.eq.${myAuthId},user_b.eq.${myAuthId}`)
    .order('last_message_at', { ascending: false });
  if (error || !data) return [];
  // Conversations with someone I've blocked (or who blocked me) disappear
  // from the list; unblocking brings them back.
  const blocked = await fetchBlockedIdSet();
  return data.filter((c) => !blocked.has(otherAuthIdFor(c, myAuthId)));
}

export function otherAuthIdFor(conversation, myAuthId) {
  return conversation.user_a === myAuthId ? conversation.user_b : conversation.user_a;
}

export function isUnread(conversation, myAuthId) {
  if (!conversation.last_message_at || !conversation.last_sender_auth_id) return false;
  if (conversation.last_sender_auth_id === myAuthId) return false;
  const myLastRead = conversation.user_a === myAuthId ? conversation.last_read_a : conversation.last_read_b;
  return new Date(conversation.last_message_at) > new Date(myLastRead);
}

export async function markConversationRead(conversation, myAuthId) {
  const column = conversation.user_a === myAuthId ? 'last_read_a' : 'last_read_b';
  await supabase.from('conversations').update({ [column]: new Date().toISOString() }).eq('id', conversation.id);
}

// --- Messages ---
export async function fetchMessages(conversationId) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return withoutBlocked(data || [], 'sender_auth_id', await fetchBlockedIdSet());
}

export async function sendMessage(conversationId, myAuthId, body) {
  const trimmed = body.trim();
  if (!trimmed) return null;
  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_auth_id: myAuthId, body: trimmed })
    .select('*')
    .single();
  if (error) throw error;

  // Best-effort denormalized preview for the chat list — a failure here
  // doesn't lose the message itself, the list would just show a stale
  // preview/order until the next successful send.
  await supabase
    .from('conversations')
    .update({
      last_message_at: data.created_at,
      last_message_preview: trimmed,
      last_sender_auth_id: myAuthId,
    })
    .eq('id', conversationId);

  notifyPush({ kind: 'message', messageId: data.id });
  return data;
}

// Live delivery for an open thread. Returns the channel so the caller can
// unsubscribe on unmount — the messages table was added to the
// supabase_realtime publication in the same migration that created it.
export function subscribeToMessages(conversationId, onInsert) {
  const channel = supabase
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
      (payload) => onInsert(payload.new)
    )
    .subscribe();
  return channel;
}

export function unsubscribe(channel) {
  if (channel) supabase.removeChannel(channel);
}
