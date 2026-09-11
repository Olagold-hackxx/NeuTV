// Display helpers. Kept deterministic and locale-pinned: a dashboard that
// renders different numbers on the server and the client produces hydration
// mismatches, and "2 minutes ago" computed in two places is exactly that bug.

export const bytes = (n: number | null | undefined): string => {
  if (!n) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
  const value = n / 1024 ** i;
  return `${value >= 100 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
};

export const coins = (n: number | null | undefined): string =>
  (n ?? 0).toLocaleString('en-US');

export const duration = (seconds: number): string => {
  if (!seconds) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
};

// Absolute, UTC, fixed format. Relative times ("3 minutes ago") drift between
// the server render and the client, and an audit trail wants a real timestamp.
export const timestamp = (ms: number | null | undefined): string => {
  if (!ms) return '—';
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
};
