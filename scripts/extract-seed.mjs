#!/usr/bin/env node
// Extract window.CentralData from index.html into the catalog service seed.
//
// Deterministic space: the frontend blob is the current source of truth for
// content, so it gets parsed by a script, never retyped by hand. Run this
// whenever index.html's data block changes; the checksum in the seed makes
// drift visible instead of silent.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'services', 'catalog', 'seed', 'catalog.seed.json');

// src/data.js is preferred: same content as the inline blob in index.html but
// with real asset paths (./assets/logos/*.png) instead of base64 data URIs, so
// the seed stays readable and the logos stay files. index.html is the fallback
// for a checkout that has not been split yet.
const SOURCES = [join(ROOT, 'src', 'data.js'), join(ROOT, 'index.html')];
const pickSource = () => {
  const hit = SOURCES.find((f) => existsSync(f));
  if (!hit) throw new Error(`No data source found. Looked in: ${SOURCES.join(', ')}`);
  return hit;
};

const EXPECTED_KEYS = [
  'PRODUCTS', 'PRODUCT_COMMUNITY_HUBS', 'CREATOR_SPOTLIGHTS', 'INITIAL_MEDIA_ROWS',
  'INITIAL_POSTS', 'PLATFORMS', 'SCHEDULE_ITEMS', 'INITIAL_CENTRAL_TV', 'VOD_LIBRARY',
  'HASHTAG_FEEDS', 'AGGREGATED_HASHTAG_POSTS', 'SAMPLE_LIVE_COMMENTS', 'TRENDING_TOPICS',
];

export function extractBlock(html) {
  const start = html.indexOf('window.CentralData = {');
  if (start === -1) throw new Error('window.CentralData assignment not found in index.html');

  // Brace-match from the opening brace, skipping strings and comments so that a
  // "}" inside a base64 data URI or a comment cannot end the block early.
  const open = html.indexOf('{', start);
  let depth = 0, i = open, inStr = null, inLine = false, inBlock = false;
  for (; i < html.length; i++) {
    const c = html[i], next = html[i + 1];
    if (inLine) { if (c === '\n') inLine = false; continue; }
    if (inBlock) { if (c === '*' && next === '/') { inBlock = false; i++; } continue; }
    if (inStr) {
      if (c === '\\') { i++; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '/' && next === '/') { inLine = true; i++; continue; }
    if (c === '/' && next === '*') { inBlock = true; i++; continue; }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return html.slice(open, i + 1); }
  }
  throw new Error('Unbalanced braces in the window.CentralData block');
}

export function parseCentralData(html) {
  const block = extractBlock(html);
  // The block is a JS object literal (trailing commas, comments, single quotes),
  // not JSON, so it is evaluated in a function with no scope access rather than
  // JSON.parse'd. Input is a file already in this repo, not user input.
  const data = new Function(`"use strict"; return (${block});`)();
  const missing = EXPECTED_KEYS.filter((k) => !(k in data));
  if (missing.length) throw new Error(`Seed is missing expected keys: ${missing.join(', ')}`);
  return data;
}

// Stable key order so the committed seed does not churn between runs.
const sortKeys = (value) => {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((k) => [k, sortKeys(value[k])]));
  }
  return value;
};

export function buildSeed(html, source = 'src/data.js') {
  const data = parseCentralData(html);
  const content = sortKeys(data);
  const checksum = createHash('sha256')
    .update(JSON.stringify(content))
    .digest('hex')
    .slice(0, 16);
  return { contractVersion: '1.0.0', source: `${source}#window.CentralData`, checksum, content };
}

const isMain = process.argv[1] && process.argv[1].endsWith('extract-seed.mjs');
if (isMain) {
  const source = pickSource();
  const seed = buildSeed(readFileSync(source, 'utf8'), source.replace(ROOT + '/', ''));
  writeFileSync(OUT, JSON.stringify(seed, null, 2) + '\n');
  const counts = Object.entries(seed.content)
    .map(([k, v]) => `${k}=${Array.isArray(v) ? v.length : Object.keys(v).length}`)
    .join(' ');
  console.log(`source: ${source}`);
  console.log(`seed written: ${OUT}`);
  console.log(`checksum ${seed.checksum}`);
  console.log(counts);
}
