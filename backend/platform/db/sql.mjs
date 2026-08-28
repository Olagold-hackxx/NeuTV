// SQL portability helpers.
//
// Services write one query, in a dialect subset both engines understand, using
// "?" placeholders. The Postgres adapter rewrites those to $1..$n; SQLite takes
// them as-is. Anything that genuinely differs between the engines is declared
// explicitly in the migration rather than guessed at by a rewriter, because a
// rewriter that is subtly wrong fails in production and nowhere else.

/**
 * "SELECT * FROM t WHERE a = ? AND b = ?" -> "... a = $1 AND b = $2"
 *
 * Skips anything inside a string literal so a "?" in text is left alone.
 */
export function toNumberedPlaceholders(sql) {
  let out = '';
  let n = 0;
  let quote = null;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (quote) {
      out += c;
      // '' inside a single-quoted literal is an escaped quote, not the end.
      if (c === quote) {
        if (c === "'" && sql[i + 1] === "'") { out += sql[++i]; continue; }
        quote = null;
      }
      continue;
    }
    if (c === "'" || c === '"') { quote = c; out += c; continue; }
    if (c === '?') { out += `$${++n}`; continue; }
    out += c;
  }
  return out;
}

// Postgres returns BIGINT and COUNT() as strings, because they can exceed
// Number.MAX_SAFE_INTEGER. Every number this app stores - millisecond
// timestamps, coin amounts, counts - is comfortably inside the safe range, so
// they are converted back to numbers and the rest of the code stays unaware of
// which engine it is talking to.
export function coerceRow(row) {
  if (!row) return row;
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    if (typeof value === 'string' && /^-?\d+$/.test(value) && Number.isSafeInteger(Number(value))) {
      out[key] = Number(value);
    } else if (typeof value === 'bigint') {
      out[key] = Number(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}
