#!/usr/bin/env node
// Verify DNS and TLS before trusting a deployment.
//
//   npm run check:domain -- --api api.example.com --cdn cdn.example.com
//
// This exists because of a specific failure worth never repeating: the API
// hostname was pointed at the VPS *and* at Fastly at the same time. DNS handed
// out both addresses, Fastly answered with its default certificate, and every
// request failed TLS. The backend was healthy throughout, so nothing in the
// application logs said anything was wrong.
//
// The rule this enforces: one hostname, one system. The API name resolves to
// the origin and nothing else; the CDN name resolves to the CDN and nothing
// else. Run it before touching CDN verification, and again after any DNS edit.

import { Resolver } from 'node:dns/promises';
import { connect } from 'node:tls';

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith('--')) continue;
  const next = process.argv[i + 1];
  if (next && !next.startsWith('--')) { args[a.slice(2)] = next; i++; } else { args[a.slice(2)] = true; }
}

const API = args.api || process.env.API_DOMAIN;
const CDN = args.cdn || process.env.CDN_DOMAIN;

if (!API) {
  console.error('\n  Pass --api <hostname>, or set API_DOMAIN.\n');
  process.exit(1);
}

// Ask public resolvers rather than the local one: a stale entry in your own
// cache is exactly what makes a broken record look fixed.
const resolver = new Resolver();
resolver.setServers(['1.1.1.1', '8.8.8.8']);

// Published anycast ranges for the common CDNs. Enough to recognise "this
// hostname points at a CDN" without pretending to be an IP database.
const CDN_RANGES = [
  { name: 'Fastly', test: (ip) => /^151\.101\./.test(ip) || /^199\.232\./.test(ip) },
  { name: 'Cloudflare', test: (ip) => /^104\.1[6-9]\./.test(ip) || /^172\.6[4-9]\./.test(ip) },
  { name: 'CloudFront', test: (ip) => /^13\.(2[0-9]|3[0-5])\./.test(ip) },
];
const cdnFor = (ip) => CDN_RANGES.find((r) => r.test(ip))?.name ?? null;

const ok = (m) => console.log(`  ok    ${m}`);
const bad = (m) => console.log(`  FAIL  ${m}`);
const warn = (m) => console.log(`  warn  ${m}`);
const note = (m) => console.log(`        ${m}`);

let failures = 0;

async function addresses(host) {
  try {
    return await resolver.resolve4(host);
  } catch (err) {
    if (err.code === 'ENODATA' || err.code === 'ENOTFOUND') return [];
    throw err;
  }
}

async function cname(host) {
  try { return await resolver.resolveCname(host); } catch { return []; }
}

/** Does this host present a certificate actually valid for it? */
function certificate(host, ip) {
  return new Promise((resolve) => {
    const socket = connect(
      { host: ip ?? host, port: 443, servername: host, timeout: 8000, rejectUnauthorized: false },
      () => {
        const cert = socket.getPeerCertificate();
        const names = [
          cert.subject?.CN,
          ...String(cert.subjectaltname ?? '').split(/,\s*/).map((s) => s.replace(/^DNS:/, '')),
        ].filter(Boolean);
        const matches = names.some((n) =>
          n === host || (n.startsWith('*.') && host.endsWith(n.slice(1))));
        socket.end();
        resolve({ names, matches, issuer: cert.issuer?.O ?? cert.issuer?.CN ?? 'unknown' });
      },
    );
    socket.on('timeout', () => { socket.destroy(); resolve(null); });
    socket.on('error', (err) => resolve({ error: err.message }));
  });
}

console.log(`\n  Checking ${API}${CDN ? ` and ${CDN}` : ''}\n`);

// --- the API hostname -------------------------------------------------------

const apiIps = await addresses(API);

if (apiIps.length === 0) {
  bad(`${API} has no A record. It must point at the origin server.`);
  failures++;
} else if (apiIps.length > 1) {
  bad(`${API} resolves to ${apiIps.length} addresses: ${apiIps.join(', ')}`);
  note('A hostname must point at ONE system. Round-robin between an origin');
  note('and a CDN means a share of every request fails.');
  failures++;
} else {
  ok(`${API} -> ${apiIps[0]}`);
}

for (const ip of apiIps) {
  const cdn = cdnFor(ip);
  if (cdn) {
    bad(`${API} points at ${cdn} (${ip}). The API hostname must point at the origin.`);
    note('Remove this record. Give the CDN its own hostname.');
    failures++;
  }
}

if (apiIps.length) {
  const cert = await certificate(API, apiIps[0]);
  if (!cert) {
    bad(`${API}:443 did not answer within 8s.`);
    failures++;
  } else if (cert.error) {
    bad(`${API}:443 - ${cert.error}`);
    failures++;
  } else if (!cert.matches) {
    bad(`${API} is served a certificate that does not cover it.`);
    note(`certificate is for: ${cert.names.join(', ')}`);
    note(`issued by: ${cert.issuer}`);
    note('This is what a CDN serves before its domain is verified.');
    failures++;
  } else {
    ok(`${API} has a valid certificate (${cert.issuer})`);
  }
}

// --- the CDN hostname -------------------------------------------------------

if (CDN) {
  if (CDN === API) {
    bad('The API and CDN hostnames are the same. They cannot be.');
    failures++;
  }

  const cnames = await cname(CDN);
  const cdnIps = await addresses(CDN);

  if (cnames.length) {
    ok(`${CDN} -> CNAME ${cnames.join(', ')}`);
  } else if (cdnIps.length) {
    warn(`${CDN} uses A records (${cdnIps.join(', ')}) rather than a CNAME.`);
    note('A CNAME is safer: a CDN can change its anycast addresses.');
    if (!cdnIps.some(cdnFor)) note('These do not look like a known CDN range.');
  } else {
    bad(`${CDN} does not resolve.`);
    failures++;
  }

  if (cdnIps.length || cnames.length) {
    const cert = await certificate(CDN, null);
    if (cert?.matches) {
      ok(`${CDN} has a valid certificate (${cert.issuer})`);
    } else if (cert?.names) {
      bad(`${CDN} is served a certificate that does not cover it.`);
      note(`certificate is for: ${cert.names.join(', ')}`);
      note('The CDN has not finished verifying this domain yet.');
      failures++;
    } else if (cert?.error) {
      bad(`${CDN}:443 - ${cert.error}`);
      failures++;
    }
  }
}

console.log('');
if (failures) {
  console.log(`  ${failures} problem${failures === 1 ? '' : 's'}. Fix DNS before deploying or verifying a CDN.\n`);
  process.exit(1);
}
console.log('  DNS and TLS look right.\n');
