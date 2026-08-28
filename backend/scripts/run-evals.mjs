#!/usr/bin/env node
// Eval runner.
//
// The second test lane. Gate tests assert exact behaviour and must never be
// flaky; evals measure QUALITY across a corpus and pass on a threshold. They
// are allowed to use the LLM, allowed to be slower, and allowed to move a
// little - but never allowed to pass without meeting their stated number.
//
//   npm run eval             all suites
//   npm run eval -- moderation   one suite

import { readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');  // backend/
const only = process.argv.slice(2).filter((a) => !a.startsWith('-'));

const suites = [];
for (const service of readdirSync(join(ROOT, 'services'))) {
  const dir = join(ROOT, 'services', service, 'evals');
  if (!existsSync(dir)) continue;
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.eval.mjs'))) {
    if (only.length && !only.includes(service)) continue;
    suites.push({ service, file, path: join(dir, file) });
  }
}

if (!suites.length) {
  console.log(only.length ? `No eval suites for: ${only.join(', ')}` : 'No eval suites found.');
  process.exit(0);
}

const bar = (score) => {
  const filled = Math.round(score * 20);
  return `${'█'.repeat(filled)}${'░'.repeat(20 - filled)}`;
};

let failed = 0;
console.log(`\nNEU TV evals  (${suites.length} suite${suites.length === 1 ? '' : 's'})\n`);

for (const suite of suites) {
  const mod = await import(suite.path);
  const started = Date.now();
  const result = await mod.run();
  const elapsed = Date.now() - started;
  const passed = result.score >= result.threshold;
  if (!passed) failed += 1;

  console.log(`${passed ? 'PASS' : 'FAIL'}  ${suite.service}/${mod.name}`);
  console.log(`      ${bar(result.score)}  ${(result.score * 100).toFixed(1)}%  (threshold ${(result.threshold * 100).toFixed(0)}%)  ${result.total} cases  ${elapsed}ms`);
  if (result.note) console.log(`      ${result.note}`);
  for (const miss of result.failures ?? []) console.log(`      miss: ${miss}`);
  console.log('');
}

if (failed) {
  console.error(`${failed} eval suite${failed === 1 ? '' : 's'} below threshold.`);
  process.exit(1);
}
console.log('All eval suites met their thresholds.\n');
