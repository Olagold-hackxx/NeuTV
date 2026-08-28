# admin

The NEU TV back office: video library, programming and CRM. Next.js 16 (App
Router), React 19, TypeScript.

```bash
npm run admin          # dev,  http://localhost:4174   <- use this while working
npm run admin:build    # production build
npm run admin:start    # production server
```

**Use `npm run admin` (dev) while the app is being changed.** In production mode
a rebuild changes the build id, and any tab left open from the previous build
keeps asking for chunks that no longer exist: client-side navigation fails while
a refresh works, because the refresh fetches the new build. Dev mode has no such
skew and recompiles on change.

`app/error.tsx` now catches that case and says what happened instead of leaving
the browser to show a bare "this page couldn't load", and offers a real reload -
a re-render cannot recover a failed chunk fetch, only a fresh document can.

It needs the API running (`npm start`, port 4173). Point it elsewhere with
`NEUTV_API_BASE`.

## Sign in

There is no sign-up form here, and that is deliberate: nobody should be able to
create an administrator through a public page.

```bash
# in backend/
echo 'NEUTV_ADMIN_EMAILS=you@example.com' >> .env
npm run admin:create -- --email you@example.com --generate
```

`NEUTV_ADMIN_EMAILS` says who may be an administrator. `admin:create` sets that
account's password and prints it once; re-running it resets the password and
revokes every live session. It refuses any email not on that list, so it cannot
mint an administrator the deployment has not authorised.

A non-admin account is rejected at the login form here, rather than on the first
admin route it happens to hit.

## The admin token never reaches the browser

An admin session can set the main broadcast and read the entire viewer roster,
so it is kept out of reach of any script on the page:

- login is a **server action** that puts the token in an **httpOnly cookie**
- every read is a **server component** calling the API server-side
- every write is a **server action**
- file uploads stream through `app/api/upload/[videoId]/route.ts`, which reads
  the cookie and pipes the request body to the API with `duplex: 'half'`

That last one is why uploads are proxied rather than sent straight to the API:
the browser would need the bearer token to do it directly. Streaming (rather
than buffering) keeps multi-gigabyte uploads viable, and `XMLHttpRequest` on the
client gives a real progress bar — still the only way to get upload progress
events in a browser.

## Pages

| Route | What it does |
| --- | --- |
| `/` | Live dashboard: what is on air, library, viewers, spend, moderation, ledger health |
| `/videos` | Library, and the form that registers a new video |
| `/videos/[id]` | Upload the file, change status or product, put it on air, archive it |
| `/live` | Schedule an event, reveal or rotate its stream key, go on air |
| `/programme` | Set the main broadcast, with the history of what held it |
| `/viewers` | Roster joined to what each account has spent |
| `/moderation` | The review queue: everything flagged or blocked |

Nothing is cached (`force-dynamic`). A back office showing a stale programme
after you changed it is worse than one that is slow.

## Known gaps

- **Taking a flagged message down is not wired up.** The API has no delete route
  for a published comment; the queue is read-only until that exists.
- **`authMethod: sso` means the viewer typed a name.** The ecosystem SSO gateway
  has not been built by the team that owns it, so those badges are self-asserted
  and the roster labels them `unverified` rather than presenting them as proof.
