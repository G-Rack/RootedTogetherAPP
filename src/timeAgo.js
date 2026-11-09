// Short "how long ago" for headers and comments: now, 5m, 3h, 2d, then the date.
export function timeAgo(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const mins = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  try {
    const opts = { month: 'short', day: 'numeric' };
    if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
    return d.toLocaleDateString('en-US', opts);
  } catch (e) {
    return d.toDateString();
  }
}

// The exact time a post was shared, e.g. "November 9, 9:47 PM".
export function fullStamp(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  try {
    const dateOpts = { month: 'long', day: 'numeric' };
    if (d.getFullYear() !== new Date().getFullYear()) dateOpts.year = 'numeric';
    const date = d.toLocaleDateString('en-US', dateOpts);
    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return `${date}, ${time}`;
  } catch (e) {
    return d.toString();
  }
}
