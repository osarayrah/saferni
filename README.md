# Safferni

Coming-soon landing page for Safferni, an AI travel agent that plans full trips from a single conversation.

- `index.html` — self-contained single-page site (fonts and logo embedded inline, no build step)
- `assets/logo-original.png` — source app icon (S + airplane mark)
- `assets/logo-480.png` — resized copy embedded in the page
- `assets/logo-primary.png` — primary logo lockup (icon + wordmark), for reference/future use
- `assets/bg-sky.jpg` — wing/clouds hero background, embedded inline in the page
- `api/waitlist.js` — Vercel serverless function backing the waitlist form

## Preview

Open `index.html` directly in a browser, or serve the folder locally:

```
python3 -m http.server 8000
```

Then visit `http://localhost:8000`. Note: the waitlist form calls `/api/waitlist`,
which only exists once deployed to Vercel (or run via `vercel dev`) — it 404s
under the plain static server above.

## Waitlist backend

Deployed on Vercel at **https://safferni.site**, connected to this
GitHub repo (`osarayrah/saferni`) — every push to `main` auto-deploys.
(Also reachable at the Vercel-assigned `saferni-landing-*.vercel.app` URLs,
though those sit behind Vercel's deployment-protection SSO by default.)

Signups are stored in a private Vercel Blob store (`saferni-waitlist`), one
JSON file per email at `waitlist/<email>.json`, keyed by address so repeat
signups overwrite rather than duplicate. The blob store is private — files
aren't reachable without the project's read/write token.

`api/waitlist.js` handles both sides:

- `POST /api/waitlist` — used by the form; body `{ "email": "..." }`.
- `GET /api/waitlist?token=<ADMIN_TOKEN>` — returns the full list as JSON
  (`{ count, entries: [{ email, at }] }`). `ADMIN_TOKEN` is set as an
  environment variable on the Vercel project (Production/Preview/Development)
  — get it with `vercel env pull` or from the Vercel dashboard's
  Settings → Environment Variables.

To view the list right now:

```
curl "https://safferni.site/api/waitlist?token=$ADMIN_TOKEN"
```
