// Cross-catalog search for the top nav.
//
// Deterministic scoring, no LLM: prefix hits beat substring hits, title hits
// beat body hits, and ties break by kind then id so the same query always
// returns the same ordering.

const KIND_RANK = { product: 0, spotlight: 1, post: 2, vod: 3, platform: 4, topic: 5 };

const score = (haystack, needle) => {
  if (!haystack) return 0;
  const h = haystack.toLowerCase();
  if (h === needle) return 100;
  if (h.startsWith(needle)) return 60;
  const at = h.indexOf(needle);
  if (at === -1) return 0;
  // A hit at a word boundary reads as more relevant than one mid-word.
  return h[at - 1] === ' ' || h[at - 1] === '#' || h[at - 1] === '@' ? 40 : 20;
};

export function searchCatalog(content, query, { limit = 20 } = {}) {
  const needle = String(query || '').trim().toLowerCase();
  if (needle.length < 2) return { query: needle, results: [], truncated: false };

  const candidates = [
    ...(content.PRODUCTS || []).map((p) => ({
      kind: 'product', id: p.id, title: p.name, subtitle: p.badge, href: p.officialUrl,
      fields: [p.name, p.id],
    })),
    ...(content.CREATOR_SPOTLIGHTS || []).map((c) => ({
      kind: 'spotlight', id: c.id, title: c.title, subtitle: `${c.name} ${c.handle}`, productId: c.productId,
      fields: [c.title, c.name, c.handle, c.product, c.tag],
    })),
    ...(content.INITIAL_POSTS || []).map((p) => ({
      kind: 'post', id: p.id, title: p.videoTitle || p.content?.slice(0, 80), subtitle: p.handle, productId: p.productId,
      fields: [p.videoTitle, p.content, p.author, p.handle, p.categoryTag, p.productName],
    })),
    ...(content.VOD_LIBRARY || []).map((v) => ({
      kind: 'vod', id: v.id, title: v.title, subtitle: v.platform, productId: v.platformId,
      fields: [v.title, v.platform, v.description],
    })),
    ...(content.PLATFORMS || []).map((p) => ({
      kind: 'platform', id: p.id, title: p.name, subtitle: p.tag, href: p.url,
      fields: [p.name, p.tag, p.description],
    })),
    ...(content.TRENDING_TOPICS || []).map((t) => ({
      kind: 'topic', id: t.id, title: t.topic, subtitle: t.category,
      fields: [t.topic, t.category, t.snippet],
    })),
  ];

  const hits = [];
  for (const c of candidates) {
    let best = 0;
    c.fields.forEach((field, index) => {
      // Earlier fields are the more identifying ones, so they decay less.
      const s = score(field, needle) - index * 2;
      if (s > best) best = s;
    });
    if (best > 0) {
      const { fields, ...rest } = c;
      hits.push({ ...rest, score: best });
    }
  }

  hits.sort((a, b) =>
    b.score - a.score ||
    KIND_RANK[a.kind] - KIND_RANK[b.kind] ||
    String(a.id).localeCompare(String(b.id)));

  return { query: needle, results: hits.slice(0, limit), truncated: hits.length > limit };
}
