// Shared across every screen that shows "basics" about someone from the
// directory_listing view — Directory cards, post authors, public profiles.
export const ROLE_LABELS = {
  seeker: 'Spiritual Seeker',
  assistant: 'Spiritual Assistant',
  mother: 'Spiritual Mother',
  pastor: 'Priest / Pastor',
  influencer: 'Spiritual Leader',
  church: 'Church / Ministry',
};

export function initialsFor(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

// There's no real @username field anywhere in sign-up, so the new
// Instagram-style profile header (Explore/Directory redesign) derives a
// handle-looking string straight from someone's name — good enough to
// match the reference design, but worth knowing it's cosmetic, not a real,
// unique, user-chosen handle.
export function handleFor(name) {
  if (!name) return '@member';
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
  return `@${slug || 'member'}`;
}

// Compact display for the profile stat row (Posts/Followers/Offerings) —
// matches the "612K" style in Girik's reference rather than a raw digit
// string once a count gets large.
export function formatCount(n) {
  if (n == null) return '0';
  if (n >= 1000000) return `${(n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
  return `${n}`;
}
