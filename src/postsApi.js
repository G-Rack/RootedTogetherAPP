// All the Explore-feed data access in one place, shared by ExploreScreen
// and PublicProfileScreen (a Spiritual Leader's posts show up in both) so
// the fetch/like/comment logic only exists once.
import { supabase } from './supabaseClient';
import { UPDATE_PROFILE_PICTURE_ENDPOINT, DELETE_ACCOUNT_ENDPOINT } from './config';

// Fetches the feed, or one author's posts when authorId (their AUTH user
// id — posts.author_auth_id, same id used everywhere else: comments, likes,
// follows) is given.
//
// There's no foreign key from posts to influencers (posts.author_auth_id
// points at auth.users, not at any role table), and a post's author isn't
// always an influencer anyway — a Mother or Pastor's auth id can show up
// here too. So this intentionally does NOT try to embed the author in the
// same request the way an actual FK would allow; callers resolve names/
// avatars afterwards via fetchAuthorsByAuthId (directory_listing), the same
// role-agnostic lookup comments and chat already use.
export async function fetchPosts({ authorId } = {}) {
  let query = supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false });
  if (authorId) query = query.eq('author_auth_id', authorId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// Batch-request short-lived signed URLs for a set of private-bucket paths —
// same pattern as Directory's avatar loading, reused here for both post
// images and post-author avatars.
export async function fetchSignedUrls(bucket, paths) {
  const unique = [...new Set(paths.filter(Boolean))];
  if (!unique.length) return {};
  const { data, error } = await supabase.storage.from(bucket).createSignedUrls(unique, 60 * 60);
  if (error || !data) return {};
  const map = {};
  data.forEach((d) => { if (d.signedUrl) map[d.path] = d.signedUrl; });
  return map;
}

// Returns { [postId]: { count, likedByMe } } for a batch of posts in one
// request rather than one query per post.
export async function fetchLikeMeta(postIds, myAuthId) {
  const meta = {};
  postIds.forEach((id) => { meta[id] = { count: 0, likedByMe: false }; });
  if (!postIds.length) return meta;
  const { data, error } = await supabase.from('post_likes').select('post_id, user_auth_id').in('post_id', postIds);
  if (error || !data) return meta;
  data.forEach((row) => {
    if (!meta[row.post_id]) meta[row.post_id] = { count: 0, likedByMe: false };
    meta[row.post_id].count += 1;
    if (row.user_auth_id === myAuthId) meta[row.post_id].likedByMe = true;
  });
  return meta;
}

export async function fetchCommentCounts(postIds) {
  const counts = {};
  postIds.forEach((id) => { counts[id] = 0; });
  if (!postIds.length) return counts;
  const { data, error } = await supabase.from('post_comments').select('post_id').in('post_id', postIds);
  if (error || !data) return counts;
  data.forEach((row) => { counts[row.post_id] = (counts[row.post_id] || 0) + 1; });
  return counts;
}

export async function toggleLike(postId, myAuthId, currentlyLiked) {
  if (currentlyLiked) {
    await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_auth_id', myAuthId);
  } else {
    await supabase.from('post_likes').insert({ post_id: postId, user_auth_id: myAuthId });
  }
}

export async function fetchComments(postId) {
  const { data, error } = await supabase
    .from('post_comments')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function addComment(postId, myAuthId, body) {
  const { error } = await supabase.from('post_comments').insert({ post_id: postId, author_auth_id: myAuthId, body });
  if (error) throw error;
}

// Comments (and now the Explore feed's post authors) can come from anyone,
// not just Spiritual Leaders, so there's no single role table to join
// against — directory_listing (which already spans all five role tables) is
// what resolves an arbitrary auth_user_id back to a displayable name, role,
// avatar path, and role-row id (the id PublicProfileScreen needs to open
// their profile).
export async function fetchAuthorsByAuthId(authIds) {
  const unique = [...new Set(authIds.filter(Boolean))];
  if (!unique.length) return {};
  const { data, error } = await supabase
    .from('directory_listing')
    .select('id, auth_user_id, role, name, profile_picture_path, vetting_status')
    .in('auth_user_id', unique);
  if (error || !data) return {};
  const map = {};
  data.forEach((row) => { map[row.auth_user_id] = row; });
  return map;
}

// One person's directory_listing view row, for the public profile screen.
export async function fetchDirectoryPerson(role, id) {
  const { data } = await supabase
    .from('directory_listing')
    .select('*')
    .eq('role', role)
    .eq('id', id)
    .maybeSingle();
  return data || null;
}

// The signed-in user's own directory_listing row, for the Profile tab (the
// self-view). directory_listing already spans all five role tables and
// carries auth_user_id on every row, so this is a single lookup regardless
// of which role table the person actually lives in — no need to already
// know their role/id the way fetchDirectoryPerson does.
//
// Uses .limit(1) + ordering rather than .maybeSingle() on purpose:
// .maybeSingle() throws a "multiple rows returned" error (silently swallowed
// here, since only `data` is destructured) if the same auth account ever
// has more than one sign-up row — which can genuinely happen (e.g. a test
// account signed up as both a Seeker and a Spiritual Mother). Rather than
// the Profile tab going blank in that case, this just shows the most
// recently created row.
export async function fetchMyDirectoryPerson(myAuthId) {
  if (!myAuthId) return null;
  const { data, error } = await supabase
    .from('directory_listing')
    .select('*')
    .eq('auth_user_id', myAuthId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error || !data || !data.length) return null;
  return data[0];
}

// Follow/Following — only meaningful for Leaders, Mothers, and Pastors (the
// three roles that get the new Instagram-style profile), but keyed by
// auth_user_id so it works the same regardless of which role table someone
// is in, the same pattern directory_listing already uses for comments.

// Batch version for a feed of posts: { [authorAuthId]: { followedByMe } }.
export async function fetchFollowMeta(followeeAuthIds, myAuthId) {
  const unique = [...new Set(followeeAuthIds.filter(Boolean))];
  const meta = {};
  unique.forEach((id) => { meta[id] = { followedByMe: false }; });
  if (!unique.length || !myAuthId) return meta;
  const { data, error } = await supabase
    .from('follows')
    .select('followee_auth_id')
    .eq('follower_auth_id', myAuthId)
    .in('followee_auth_id', unique);
  if (error || !data) return meta;
  data.forEach((row) => {
    if (meta[row.followee_auth_id]) meta[row.followee_auth_id].followedByMe = true;
  });
  return meta;
}

export async function getFollowStatus(myAuthId, followeeAuthId) {
  if (!myAuthId || !followeeAuthId || myAuthId === followeeAuthId) return false;
  const { data } = await supabase
    .from('follows')
    .select('id')
    .eq('follower_auth_id', myAuthId)
    .eq('followee_auth_id', followeeAuthId)
    .maybeSingle();
  return !!data;
}

export async function getFollowerCount(followeeAuthId) {
  if (!followeeAuthId) return 0;
  const { count, error } = await supabase
    .from('follows')
    .select('id', { count: 'exact', head: true })
    .eq('followee_auth_id', followeeAuthId);
  if (error) return 0;
  return count || 0;
}

export async function followPerson(myAuthId, followeeAuthId) {
  const { error } = await supabase.from('follows').insert({ follower_auth_id: myAuthId, followee_auth_id: followeeAuthId });
  if (error) throw error;
}

export async function unfollowPerson(myAuthId, followeeAuthId) {
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_auth_id', myAuthId)
    .eq('followee_auth_id', followeeAuthId);
  if (error) throw error;
}

// Real post count for a Leader (the only role the app lets post today —
// the "+ New Post" button and CreatePostScreen's own check both gate on
// an Approved influencers row). Takes their AUTH user id (posts.
// author_auth_id), not their influencers-table row id.
export async function getPostCount(authorAuthId) {
  if (!authorAuthId) return 0;
  const { count, error } = await supabase
    .from('posts')
    .select('id', { count: 'exact', head: true })
    .eq('author_auth_id', authorAuthId);
  if (error) return 0;
  return count || 0;
}

// The creator storefront (web shop) handle for a given auth user, if
// they've set one up on the website's dashboard — powers the profile
// screen's shop icon, which deep-links to WEB_BASE_URL/creator/<handle>
// instead of an in-app "Offerings" tab. Returns null if they haven't
// published a storefront handle yet (or aren't a creator at all).
export async function fetchCreatorHandle(authUserId) {
  if (!authUserId) return null;
  const { data, error } = await supabase
    .from('creator_storefronts')
    .select('handle')
    .eq('auth_user_id', authUserId)
    .maybeSingle();
  if (error || !data) return null;
  return data.handle || null;
}

// Whether the current person is an Approved leader role (Spiritual Leader/
// Influencer, Spiritual Mother, or Pastor) who's actually allowed to post —
// drives whether "+ New Post" shows up at all, in both ExploreScreen and
// CreatePostScreen's own re-check. This used to only query the influencers
// table, which silently blocked Mothers and Pastors from ever seeing or
// using "+ New Post" even though both the posts table's own RLS policy
// (posts_insert_own_approved) and the post-images storage policy already
// allow any Approved influencer, mother, OR pastor to post — so it reads
// directory_listing instead, which already has role + vetting_status
// role-agnostically.
//
// The `id` this returns is deliberately the person's AUTH user id, not a
// role-table row id — the post-images storage policy requires the upload
// path's first folder segment to equal auth.uid() exactly, so callers (see
// CreatePostScreen's handlePost) use this id as that folder name.
export async function getMyLeaderRow(myAuthId) {
  const person = await fetchMyDirectoryPerson(myAuthId);
  if (!person || !['influencer', 'mother', 'pastor'].includes(person.role)) return null;
  return { id: person.auth_user_id, vetting_status: person.vetting_status };
}

// Replaces the signed-in person's own profile photo — the Profile screen's
// avatar pencil badge used to just show a "coming later" alert. Goes
// through the update-profile-picture Edge Function rather than a direct
// Supabase Storage upload, since profile-pictures is a private bucket with
// no client-facing write policies (same reasoning as certification
// uploads during sign-up). `role` is whichever role table this person's
// own directory_listing row belongs to (mother/pastor/influencer/seeker/
// assistant) — the function re-derives *which row* to update from the
// caller's own verified session, never from anything passed here, so this
// can't be used to overwrite someone else's photo.
export async function updateMyProfilePicture(session, role, image) {
  const res = await fetch(UPDATE_PROFILE_PICTURE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify({
      role,
      photo: { base64: image.base64, filename: image.fileName, contentType: image.mimeType },
    }),
  });
  let data = {};
  try { data = await res.json(); } catch (e) { /* fall through to the generic error below */ }
  if (!res.ok || !data.ok) {
    throw new Error(data.error || 'Couldn’t update your photo right now. Please try again.');
  }
  return data.path;
}

// Permanently deletes the signed-in person's own account — the Settings
// screen's "Delete Account" row. Same shape as updateMyProfilePicture:
// goes through an Edge Function (delete-account) that verifies the
// caller's own session and then uses the service-role key to actually
// delete the auth.users row, which this app could never do directly.
// What happens to the rest of their data (posts, messages, family
// membership, etc.) is governed by each table's existing foreign-key
// behavior — see delete-account's own comments for the full picture.
export async function deleteMyAccount(session) {
  const res = await fetch(DELETE_ACCOUNT_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token}`,
    },
  });
  let data = {};
  try { data = await res.json(); } catch (e) { /* fall through to the generic error below */ }
  if (!res.ok || !data.ok) {
    throw new Error(data.error || 'Couldn’t delete your account right now. Please try again.');
  }
  return true;
}
