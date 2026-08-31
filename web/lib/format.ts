// Locale-pinned formatting. Values change in place on a live page, so
// everything numeric renders with tabular figures (the .num class).

export function compact(n: number | undefined | null): string {
  if (n === undefined || n === null) return '0';
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, '')}K`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
}

export function coins(n: number | undefined | null): string {
  return (n ?? 0).toLocaleString('en-US');
}

export function mmss(seconds: number | undefined | null): string {
  const s = Math.max(0, Math.round(seconds ?? 0));
  if (!s) return '';
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

// Relative age against a fixed "now" so the server render and the hydration
// render agree.
export function relativeTime(ms: number | undefined, now: number): string {
  if (!ms) return '';
  const seconds = Math.max(0, Math.round((now - ms) / 1000));
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
