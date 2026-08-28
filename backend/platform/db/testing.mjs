// Test store helper.
//
// Unset, tests open in-memory SQLite and the suite runs in seconds with no
// server. With TEST_DATABASE_URL set, the identical suite runs against a real
// Postgres, each test file in its own throwaway schema.
//
// Supporting both is the whole reason dialect drift is catchable here: a query
// that only works on SQLite fails in CI rather than in production.

let counter = 0;

export const usingPostgres = () => Boolean(process.env.TEST_DATABASE_URL);

/**
 * @param {(target: string, options?: object) => Promise<object>} openFn
 *        a service's own open*Store function
 */
export function testStore(openFn) {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return openFn(':memory:');
  // Unique per file and process so suites cannot see each other's rows.
  //
  // max: 2 because the runner executes test files in parallel, each opening its
  // own pool. At the default of 10 a full run opens more connections than a
  // stock Postgres allows and files start failing on connection exhaustion -
  // which looks exactly like a dialect bug until you count the sockets.
  return openFn(url, { schema: `t_${process.pid}_${++counter}`, max: 2 });
}
