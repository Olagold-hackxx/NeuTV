#!/usr/bin/env node
// Render the host Caddy site block for a given hostname.
//
//   npm run deploy:caddy -- --api api.example.com
//
// The hostname used to be written into deploy/Caddyfile.host directly, which
// meant moving domains was a grep across three files that had to agree. Now it
// comes from one place and the file is generated.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith('--')) continue;
  const next = process.argv[i + 1];
  if (next && !next.startsWith('--')) { args[a.slice(2)] = next; i++; } else { args[a.slice(2)] = true; }
}

const api = args.api || process.env.API_DOMAIN;
if (!api) {
  console.error('\n  Pass --api <hostname>, or set API_DOMAIN in backend/.env\n');
  process.exit(1);
}
if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(api)) {
  console.error(`\n  "${api}" does not look like a hostname.\n`);
  process.exit(1);
}

const template = readFileSync(join(ROOT, 'deploy', 'Caddyfile.host.template'), 'utf8');
process.stdout.write(template.replaceAll('{{API_DOMAIN}}', api));
