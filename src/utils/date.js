const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// "2001-06-04" -> "June 4, 2001". Falls back to the raw string if it
// doesn't parse, so a malformed value never crashes the UI.
export function formatDateHuman(iso) {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const [, y, mo, d] = m;
  const monthName = MONTH_NAMES[Number(mo) - 1];
  if (!monthName) return iso;
  return `${monthName} ${Number(d)}, ${y}`;
}
