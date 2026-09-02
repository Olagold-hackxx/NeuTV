// Search relevance eval.
//
// Precision@1 against what a viewer typing that query obviously meant. Gate
// tests pin a couple of exact orderings; this measures whether the ranking is
// good across the whole product surface, so a scoring tweak that helps one
// query and quietly wrecks five others shows up as a number.

import { loadSeed } from '../service.mjs';
import { searchCatalog } from '../search.mjs';

export const name = 'search-relevance';

// query -> the kind:id a viewer typing this plainly wants at the top
const EXPECTATIONS = [
  ['worldstreet', 'product:worldstreet'],
  ['kashplus', 'product:linkpay'],
  ['ark', 'product:ark'],
  ['tsion', 'product:tsioncars'],
  ['market', 'product:market'],
  ['david_trades', 'spotlight:cr-1'],
  ['20x', 'spotlight:cr-1'],
  // 'apple pay' -> cr-2 lived here until that content was removed from the
  // catalog as off-ecosystem; the query must track what the catalog carries.
  ['offramp', 'spotlight:cr-7'],
  ['storefront', 'spotlight:cr-3'],
];

export async function run() {
  const content = loadSeed().content;
  const failures = [];
  let hits = 0;

  for (const [query, expected] of EXPECTATIONS) {
    const top = searchCatalog(content, query).results[0];
    const got = top ? `${top.kind}:${top.id}` : 'nothing';
    if (got === expected) hits += 1;
    else failures.push(`"${query}" -> ${got} (wanted ${expected})`);
  }

  return {
    score: hits / EXPECTATIONS.length,
    threshold: 0.75,
    total: EXPECTATIONS.length,
    failures,
    note: `precision@1 across ${EXPECTATIONS.length} queries`,
  };
}
