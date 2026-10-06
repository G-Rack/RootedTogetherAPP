// All the Communities data access in one place — mirrors the shape of
// postsApi.js (Explore) on purpose: same fetch/toggle/count patterns, just
// pointed at the community_* tables instead of posts/post_likes/post_
// comments. See the create_communities_schema migration for the schema and
// the RLS policies (only a current member of a community may post or
// comment in it; anyone signed in can join, browse, or mark a post
// "Helpful").
import { supabase } from './supabaseClient';

// The exact same list seekers already pick from at sign-up (SUPPORT_OPTIONS
// in flows.js) — a community's topic deliberately reuses that taxonomy
// rather than inventing a new one.
export const COMMUNITY_TOPICS = [
  'Grief',
  'Addiction & Recovery',
  'Family Estrangement',
  'Marriage',
  'Parenting',
  'Kids',
  'Isolation & Loneliness',
  'Anger',
  'Other',
];

// Communities live in a PUBLIC bucket (no signed URL needed, unlike post or
// profile images) — this just builds the CDN URL for a stored image_path.
// Returns null for communities created before image uploads existed (or
// that never got one), so callers fall back to the legacy emoji `icon`.
export function getCommunityImageUrl(imagePath) {
  if (!imagePath) return null;
  const { data } = supabase.storage.from('community-images').getPublicUrl(imagePath);
  return data?.publicUrl || null;
}

export async function fetchCommunities() {
  const { data, error } = await supabase
    .from('community_listing')
    .select('*')
    .order('member_count', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function fetchCommunity(id) {
  const { data, error } = await supabase
    .from('community_listing')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

// { [communityId]: boolean } for a batch of communities in one request.
export async function fetchMyMembershipMap(communityIds, myAuthId) {
  const unique = [...new Set(communityIds.filter(Boolean))];
  const map = {};
  unique.forEach((id) => { map[id] = false; });
  if (!unique.length || !myAuthId) return map;
  const { data, error } = await supabase
    .from('community_memberships')
    .select('community_id')
    .eq('auth_user_id', myAuthId)
    .in('community_id', unique);
  if (error || !data) return map;
  data.forEach((row) => { map[row.community_id] = true; });
  return map;
}

// Every community the signed-in person has joined — powers the "Communities"
// tab on their own profile.
export async function fetchMyCommunities(myAuthId) {
  if (!myAuthId) return [];
  const { data, error } = await supabase
    .from('community_memberships')
    .select('community_listing(*)')
    .eq('auth_user_id', myAuthId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map((row) => row.community_listing).filter(Boolean);
}

export async function joinCommunity(communityId, myAuthId) {
  const { error } = await supabase
    .from('community_memberships')
    .insert({ community_id: communityId, auth_user_id: myAuthId });
  if (error) throw error;
}

export async function leaveCommunity(communityId, myAuthId) {
  const { error } = await supabase
    .from('community_memberships')
    .delete()
    .eq('community_id', communityId)
    .eq('auth_user_id', myAuthId);
  if (error) throw error;
}

// Lets a community's creator change its image and/or description after the
// fact — the only two fields CreateCommunityScreen collects besides the
// name, which stays fixed once set. The RLS policy (communities_update_own)
// is the real gate; the .eq('creator_auth_id', ...) here just avoids a
// silently-no-op update if it's ever called by anyone else.
export async function updateCommunity(communityId, { description, imagePath }, myAuthId) {
  const payload = {};
  if (description !== undefined) payload.description = description;
  if (imagePath !== undefined) payload.image_path = imagePath;
  const { error } = await supabase
    .from('communities')
    .update(payload)
    .eq('id', communityId)
    .eq('creator_auth_id', myAuthId);
  if (error) throw error;
}

export async function createCommunity({ name, description, imagePath }, myAuthId) {
  const { data, error } = await supabase
    .from('communities')
    .insert({ name, description, image_path: imagePath || null, creator_auth_id: myAuthId })
    .select('id')
    .single();
  if (error) throw error;
  // Creating a community joins it automatically — starting a community with
  // no members (not even its own creator) would be a strange first state.
  await joinCommunity(data.id, myAuthId);
  return data.id;
}

// Posts from every community in a batch of community ids, newest first —
// powers the Explore feed's mixed-in community posts (only communities the
// signed-in person has actually joined, per Girik's instruction that
// Communities should surface through Explore and profiles rather than a
// standalone tab).
export async function fetchCommunityPostsForCommunities(communityIds, limitCount = 30) {
  const unique = [...new Set(communityIds.filter(Boolean))];
  if (!unique.length) return [];
  const { data, error } = await supabase
    .from('community_posts')
    .select('*')
    .in('community_id', unique)
    .order('created_at', { ascending: false })
    .limit(limitCount);
  if (error) return [];
  return data || [];
}

export async function fetchCommunityPosts(communityId, tag) {
  let query = supabase
    .from('community_posts')
    .select('*')
    .eq('community_id', communityId)
    .order('created_at', { ascending: false });
  if (tag) query = query.eq('tag', tag);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function createCommunityPost(communityId, myAuthId, tag, body) {
  const { error } = await supabase
    .from('community_posts')
    .insert({ community_id: communityId, author_auth_id: myAuthId, tag, body });
  if (error) throw error;
}

// { [postId]: { count, helpfulByMe } } — same batching pattern as
// postsApi.fetchLikeMeta.
export async function fetchHelpfulMeta(postIds, myAuthId) {
  const meta = {};
  postIds.forEach((id) => { meta[id] = { count: 0, helpfulByMe: false }; });
  if (!postIds.length) return meta;
  const { data, error } = await supabase
    .from('community_post_helpful')
    .select('post_id, user_auth_id')
    .in('post_id', postIds);
  if (error || !data) return meta;
  data.forEach((row) => {
    if (!meta[row.post_id]) meta[row.post_id] = { count: 0, helpfulByMe: false };
    meta[row.post_id].count += 1;
    if (row.user_auth_id === myAuthId) meta[row.post_id].helpfulByMe = true;
  });
  return meta;
}

export async function toggleHelpful(postId, myAuthId, currentlyHelpful) {
  if (currentlyHelpful) {
    await supabase.from('community_post_helpful').delete().eq('post_id', postId).eq('user_auth_id', myAuthId);
  } else {
    await supabase.from('community_post_helpful').insert({ post_id: postId, user_auth_id: myAuthId });
  }
}

export async function fetchCommunityPostComments(postId) {
  const { data, error } = await supabase
    .from('community_post_comments')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function addCommunityPostComment(postId, myAuthId, body) {
  const { error } = await supabase
    .from('community_post_comments')
    .insert({ post_id: postId, author_auth_id: myAuthId, body });
  if (error) throw error;
}

export async function fetchCommentCounts(postIds) {
  const counts = {};
  postIds.forEach((id) => { counts[id] = 0; });
  if (!postIds.length) return counts;
  const { data, error } = await supabase.from('community_post_comments').select('post_id').in('post_id', postIds);
  if (error || !data) return counts;
  data.forEach((row) => { counts[row.post_id] = (counts[row.post_id] || 0) + 1; });
  return counts;
}

// How many times this person's community posts have been marked
// "Helpful" — the real number behind the Dedication Scorecard's "Growth"
// stat, computed live rather than stored/denormalized (nothing to keep in
// sync, and this is nowhere near hot-path enough to need it cached).
export async function getGrowthScore(authAuthId) {
  if (!authAuthId) return 0;
  const { count, error } = await supabase
    .from('community_post_helpful')
    .select('post_id, community_posts!inner(author_auth_id)', { count: 'exact', head: true })
    .eq('community_posts.author_auth_id', authAuthId);
  if (error) return 0;
  return count || 0;
}
