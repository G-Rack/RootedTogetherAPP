// Block + report — the safety tools every app with user-generated content
// needs (and that Google Play / the App Store expect). Kept in one file the
// same way postsApi.js / communitiesApi.js hold their own data access.
//
// How blocking works:
//  - Blocking is recorded server-side (user_blocks) through the block_user
//    RPC, so it follows the person to any device.
//  - The block applies in BOTH directions without telling either side who
//    blocked whom: get_my_blocked_ids() returns everyone I blocked plus
//    everyone who blocked me, and every feed/list below hides those people.
//  - Direct messages between a blocked pair are also refused by the
//    database itself (the messages insert policy checks the same list).
//
// How reporting works: report_content writes a row to content_reports
// (reason + optional note). The team reviews those in the Supabase
// dashboard — nothing is shown to the person who was reported.
import { supabase } from './supabaseClient';

// What a report is about. content_type values match the CHECK constraint on
// content_reports exactly.
export const CONTENT_TYPES = {
  profile: 'profile',
  post: 'post',
  postComment: 'post_comment',
  communityPost: 'community_post',
  communityComment: 'community_comment',
  directMessage: 'direct_message',
  groupMessage: 'group_message',
};

// Reason keys match the CHECK constraint on content_reports.reason.
export const REPORT_REASONS = [
  { key: 'harassment', label: 'Harassment or bullying' },
  { key: 'hate', label: 'Hate speech or discrimination' },
  { key: 'sexual', label: 'Sexual or inappropriate content' },
  { key: 'violence', label: 'Violence or threats' },
  { key: 'self_harm', label: 'Self-harm or danger to someone' },
  { key: 'spam', label: 'Spam or scam' },
  { key: 'impersonation', label: 'Pretending to be someone else' },
  { key: 'misinformation', label: 'False or misleading information' },
  { key: 'other', label: 'Something else' },
];

// --- Blocked-id cache -------------------------------------------------
// Every feed asks "who should I hide?" on each load, so keep the answer
// for a short while instead of a round trip per list. Block/unblock
// invalidate it straight away; the short expiry picks up blocks made by
// someone else.
const CACHE_MS = 30 * 1000;
let cache = { ids: null, at: 0, pending: null };

export function invalidateBlockedCache() {
  cache = { ids: null, at: 0, pending: null };
}

// Set of auth ids to hide (people I blocked + people who blocked me).
// Never throws: if the lookup fails, nothing is hidden rather than the
// whole screen failing to load.
export async function fetchBlockedIdSet(force = false) {
  const fresh = cache.ids && Date.now() - cache.at < CACHE_MS;
  if (!force && fresh) return cache.ids;
  if (!force && cache.pending) return cache.pending;
  const pending = (async () => {
    try {
      const { data, error } = await supabase.rpc('get_my_blocked_ids');
      if (error || !Array.isArray(data)) return cache.ids || new Set();
      const ids = new Set(data.map((row) => (typeof row === 'string' ? row : Object.values(row)[0])));
      cache = { ids, at: Date.now(), pending: null };
      return ids;
    } catch (e) {
      return cache.ids || new Set();
    } finally {
      cache.pending = null;
    }
  })();
  cache.pending = pending;
  return pending;
}

// Drop any row whose `key` field (an auth id) is in the blocked set.
export function withoutBlocked(rows, key, blockedSet) {
  if (!rows || !blockedSet || blockedSet.size === 0) return rows || [];
  return rows.filter((row) => !blockedSet.has(row[key]));
}

// Convenience: fetch the set and filter in one go.
export async function hideBlocked(rows, key) {
  const blocked = await fetchBlockedIdSet();
  return withoutBlocked(rows, key, blocked);
}

// --- Block / unblock --------------------------------------------------
export async function blockUser(myAuthId, otherAuthId) {
  const { error } = await supabase.rpc('block_user', { p_user: otherAuthId });
  if (error) throw error;
  // Blocking someone also stops following them (the reverse direction —
  // them following me — can't be removed from the client, and doesn't
  // matter since they can no longer see my content or message me).
  if (myAuthId) {
    await supabase.from('follows').delete().eq('follower_auth_id', myAuthId).eq('followee_auth_id', otherAuthId);
  }
  invalidateBlockedCache();
}

export async function unblockUser(otherAuthId) {
  const { error } = await supabase.rpc('unblock_user', { p_user: otherAuthId });
  if (error) throw error;
  invalidateBlockedCache();
}

// People I have blocked, newest first: [{ blocked_auth_id, created_at }]
export async function fetchMyBlockedUsers() {
  const { data, error } = await supabase.rpc('get_my_blocked_users');
  if (error) throw error;
  return data || [];
}

// --- Report -----------------------------------------------------------
export async function reportContent({ contentType, contentId = null, reportedUserId = null, reason, details = '' }) {
  const { error } = await supabase.rpc('report_content', {
    p_content_type: contentType,
    p_content_id: contentId,
    p_reported_user: reportedUserId,
    p_reason: reason,
    p_details: details && details.trim() ? details.trim().slice(0, 1000) : null,
  });
  if (error) throw error;
}
