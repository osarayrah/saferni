# Safferni — Project Context

Read this fully before making changes. This file exists so a fresh Claude Code
session doesn't have to rediscover decisions that were already made — and
doesn't undo them by accident.

## What this is

Safferni is a mobile travel app (React Native / Expo) with an AI trip-planning
chat (Groq) that searches and books real flights and hotels through LiteAPI
(Nuitée). Target market: Middle East travelers who currently book through
phone-based travel agencies — the wedge is trust + responsiveness, not "AI
travel chat" as a category (that category is crowded; Expedia acquired a
direct competitor, Layla, in July 2026).

## Architecture

- **Monorepo**: `artifacts/saferni` (Expo app), `artifacts/api-server`
  (Node/Express backend), `lib/*` (shared OpenAPI spec, generated client/zod,
  db schema), managed with pnpm workspaces.
- **Hotels**: LiteAPI `/data/hotels` → `/hotels/rates` → `/rates/prebook` →
  `/rates/book` with `payment.method: "WALLET"`, settled from our LiteAPI
  wallet balance.
- **Flights**: search works (`/flights/rates`), **booking is NOT built yet**.
  LiteAPI's flight payment model is genuinely different from hotels — see
  Blockers below. Do not assume the hotel pattern transfers to flights.
- **AI planner**: Groq (`routes/planner.ts`), model is
  `openai/gpt-oss-120b` (the original `llama-3.3-70b-versatile` was
  retired by Groq — if planner calls start failing with `model_not_found`,
  check Groq's `/v1/models` for what's currently live before assuming
  anything else is broken).
- **Payments**: No payment processor is configured. Supplier settlement uses
  LiteAPI's account-wallet flow.
- **Auth**: Replit Auth is dead (doesn't work off Replit). App is
  currently guest-only. Real auth (Clerk/Auth0/etc.) is still unbuilt.
- **Env**: local `.env` files (`artifacts/api-server/.env`,
  `artifacts/saferni/.env`), loaded via a small custom `loadEnv.ts` (no
  `dotenv` dependency). `EXPO_PUBLIC_API_URL` must match the current
  machine's LAN IP for phone testing — **this breaks silently whenever the
  network changes,** check it first if the app suddenly can't reach the
  server. The dev server also builds once (`pnpm run build && pnpm run
  start`) rather than watching for changes — **a backend edit does nothing
  to the running server until it's rebuilt and restarted.** If new backend
  behavior doesn't show up after a full app reload, check whether the
  running process predates the edit before assuming the code is wrong.
- **`LITEAPI_KEY` is currently the production key** (switched from sandbox
  2026-08-20 — search/pricing only, no live booking risk today, see the
  safety-guard bullet below). The old sandbox key is preserved as
  `LITEAPI_KEY_SANDBOX` in the same `.env` for an easy revert. If flight
  results ever show "Nuitée Air" again, that's the sandbox key being back
  in play, not a data bug.

## Key decisions and why (don't relitigate without reason)

- **LiteAPI over Amadeus/Expedia/RapidAPI scrapers**: self-serve signup, no
  business license required, real inventory. Amadeus self-service shut down
  entirely; Expedia Rapid requires a partner application we haven't cleared.
- **Hotel settlement via WALLET**: LiteAPI's hotel payment widget is a
  web-only `<script>` tag, incompatible with React Native, so hotel bookings
  use the LiteAPI account-wallet method.
- **Flights are architecturally different, not a bug**: confirmed directly
  against LiteAPI's sandbox API on 2026-08-20 (isolated test script, not app
  code — see Blockers below). `/flights/bookings` accepts exactly three
  `payment.method` values: `CREDIT`, `TRANSACTION_ID`, `THIRD_PARTY`.
  `WALLET` and `ACC_CREDIT_CARD` are both rejected outright —
  `ACC_CREDIT_CARD` is not a real LiteAPI value, full stop, that question is
  closed. Of the three real options:
  - `TRANSACTION_ID` — the documented path requires a third-party payment
    transaction and is not implemented.
  - `CREDIT` — recognized as a valid method name, but currently rejected
    with `"no credit line available for this account"` — an
    account-entitlement gap, not a code problem. **This is the one to
    chase**: if LiteAPI enables a credit line, flights could settle the
    through LiteAPI account settlement without a native payment SDK.
  - `THIRD_PARTY` — recognized, but rejects with `"payment.token field
    missing or empty"` — needs a token from an unidentified source
    (possibly the same web-only payment-widget tradeoff hotels avoided).
    Not investigated further.
  Do not implement flight booking until the `CREDIT` path is settled one way
  or the other.
- **Diacritic-safe, country-aware place matching**: `resolvePlaceId()` in
  `search.ts` handles same-named cities worldwide (Cairo/Cambridge/Valencia
  collide across countries) using the AI-supplied `destinationCountry`
  field + diacritic folding. Zero hardcoded city names — don't reintroduce
  a lookup table if extending this.
  **History note (2026-08-20):** for a while this doc claimed both paths
  were covered, but the code only ever checked `/rates/book` — confirmed
  via `git log --all -S` that the guard was written hotel-only from its
  one and only introducing commit; `/flights/bookings` coverage was never
  present and was not a regression, just doc drift. Closed the gap the
  same day by generalizing to `FINAL_BOOKING_PATHS`, with tests for both
  paths in `liteApi.test.ts`. It wasn't an active risk in practice (flight
  booking is a hardcoded stub that never calls `laBookPost`), but fix it
  early if that stub ever gets implemented — don't let this doc overstate
  reality again.
- **`returnDate` presence is NOT a one-way/round-trip signal — `oneWay` is.**
  Found and fixed 2026-08-20: a traveller saying "one-way" still got
  round-trip flight results, because `returnDate`'s presence/absence was
  the only place trip type lived, and that channel is unreliable at every
  layer — `sanitiseDraft` (`planner.ts`) can't distinguish "the model
  omitted this because nothing changed" from "because it should be
  cleared," and `withDates()` (`search.ts`)/`ensureDates()`
  (`services/planner.ts`, frontend) both unconditionally backfill a
  `returnDate` regardless, since hotels need *some* stay-end date even on
  a one-way-flight trip. Added an explicit `oneWay: boolean` to
  `PlannerDraft` (openapi.yaml) as the single source of truth for trip
  type; `Trip.oneWay` is derived from the actual booked `FlightOffer`'s
  `inbound` presence, not carried through from the draft. `returnDate` on
  a `Trip` is **always populated** (stay-end date for itinerary/hotel
  math) — never infer trip type from it being present. If you add a new
  screen/field that shows or sends `returnDate`, check `oneWay` first.

## Current blockers (external, not ours to fix)

- LiteAPI flight booking payment method — narrowed by direct API testing on
  2026-08-20 (see Key decisions above). `ACC_CREDIT_CARD` is confirmed dead.
  Follow-up sent to LiteAPI asking them to enable a credit line on our
  account so `CREDIT` can be tested end-to-end. Waiting on their response.
- **Separate from the above — flight passenger data collection is unbuilt.**
  Regardless of which payment method wins, `/flights/prebook` requires full
  passenger detail up front for every traveler: date of birth, gender,
  nationality, and passport info (document type/number/expiry/issuing
  country). Confirmed by direct testing — this is not optional or
  fare-specific, it's required for every flight prebook. Nothing like this
  form exists in the app today (booking currently collects name/email at
  most). This is a real, sizeable piece of UI and data-handling work in its
  own right — do not treat it as a quick add-on once the payment method is
  sorted; scope and plan it separately.
- Amadeus API access — sales email sent, likely needs real booking volume
  first before they'll engage.
- Flights for dates ~330+ days out may just be a normal airline data-window
  limit, not a bug — not confirmed either way yet.

## Workflow conventions for this project

- **Diagnose and report a plan before writing code**, especially for
  anything touching payments, booking, or search logic. This isn't
  optional ceremony — this codebase has repeatedly had "obvious" fixes
  turn out to have real tradeoffs (payment architecture, place
  disambiguation, rate-limit handling) that only surfaced through
  investigation first.
- Superpowers plugin is installed (project scope) — its
  brainstorm → plan → TDD → review discipline should already be active.
  Don't bypass it for "quick" fixes on payment/booking code.
- Split unrelated fixes into separate git commits, not one dump — this has
  been the pattern all session and keeps history reviewable.
- **Never let a UI-only or "make it look better" task touch payment,
  auth, or booking logic.** Scope those tasks explicitly to visual changes
  only.
- Real production LiteAPI keys exist in this project. Treat any
  task that could reach a `/book` or `/bookings` endpoint as high-stakes by
  default.

## Testing tracker

Open bugs, blocked items, and the launch checklist live in a shared Slack
Canvas (not in this repo) — check there before assuming something is
unknown or untracked. Ask the team for the link if you don't have it.

## Known stale/removed things (don't reintroduce)

- No more Replit: no `.replit`, no `REPLIT_*` env vars, no Replit Auth, and no
  payment connectors. If you find references to any of these,
  they're leftover — flag and remove, don't build around them.
- Brand name is **Safferni** (double F), not Saferni. Colors are Deep Navy
  `#0C1D3A`, Gold Accent `#D4A017`, Light Gray `#F2F4F7`, White `#FFFFFF`.
