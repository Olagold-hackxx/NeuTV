// Calendar quarters, in UTC, as the unit the viewers choice runs on.
//
// Pure functions of a timestamp so the wallet's revenue read and the admin's
// leaderboard agree on the window without either importing the other. A
// quarter id reads "2026-Q3"; its window is [startsAt, endsAt).

const MONTHS_PER_QUARTER = 3;

export function quarterOf(ms) {
  const d = new Date(ms);
  const q = Math.floor(d.getUTCMonth() / MONTHS_PER_QUARTER) + 1;
  return `${d.getUTCFullYear()}-Q${q}`;
}

export function parseQuarter(id) {
  const m = /^(\d{4})-Q([1-4])$/.exec(String(id || '').trim());
  if (!m) return null;
  return { year: Number(m[1]), q: Number(m[2]) };
}

export function quarterWindow(id) {
  const parsed = parseQuarter(id);
  if (!parsed) return null;
  const startMonth = (parsed.q - 1) * MONTHS_PER_QUARTER;
  const startsAt = Date.UTC(parsed.year, startMonth, 1);
  const endsAt = Date.UTC(parsed.year, startMonth + MONTHS_PER_QUARTER, 1);
  return { id, startsAt, endsAt };
}

export function previousQuarter(id) {
  const parsed = parseQuarter(id);
  if (!parsed) return null;
  return parsed.q === 1 ? `${parsed.year - 1}-Q4` : `${parsed.year}-Q${parsed.q - 1}`;
}
