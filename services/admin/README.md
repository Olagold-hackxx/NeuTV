# admin

The back office: video library, programming, and CRM. Every route requires the
admin role, enforced by the gateway from the session claim.

## Videos

`kind: 'external'` (a URL or YouTube id) is ready immediately. `kind: 'upload'`
starts as a draft and is handed an upload target.

Uploads are a **raw binary `PUT`**, not multipart. Hand-rolling a multipart
parser for gigabyte video is a bug farm; a stream to disk is simpler and behaves
better. Guards:

- content-type allowlist (mp4, webm, mov, mkv); the extension is derived from
  the verified type, never from a client filename
- the stored name is `<videoId>.<ext>`, so no path segment is caller-controlled
- the size cap is enforced on the actual byte stream, not just Content-Length,
  because a header can lie
- a rejected or empty upload leaves no partial file behind

Playback is `/media/<id>.<ext>` with byte-range support.

## Programming

`PUT /admin/programme` sets the video that owns the main page and publishes it.
Guards: an archived video cannot go on air, a video with nothing to play cannot
be broadcast or published, and the video currently on air cannot be archived out
from under the page. Every change is recorded in `programme_history`.

## CRM

Aggregates viewers, spend, engagement and the moderation queue. Those numbers
live in other services' databases, so they arrive through injected read ports
(`ports.mjs`) wired at the composition root. An unwired port reports `null`
rather than throwing, so the CRM degrades to what it can see.

Tests: `npm run test:admin`.
