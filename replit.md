# Safferni — AI Travel Agent

## Overview
Safferni ("Your AI travel companion") is a React Native + Expo mobile app that plans complete trips: a conversational AI planner asks clarifying questions, then searches demo flight/hotel/activity data, builds three comparable packages (best overall / lowest price / most comfortable), and generates a day-by-day itinerary with budget breakdown and a schematic trip map.

## Architecture
- `artifacts/saferni` — Expo Router app (workflow `artifacts/saferni: expo`)
  - `app/(tabs)/index.tsx` — Home: 4 mode bubbles (Flights/Hotels/Packages/General) that route into Plan, plus Trending now / In season, plus a folded-in destination search+filter browser (formerly the standalone Explore tab)
  - `app/(tabs)/plan.tsx` — conversational planner chat screen (moved from the old `app/planner.tsx` stack screen into a tab); reads a `mode` route param (`flights`/`hotels`/`packages`/`general`) that scopes both the AI's questions (via `PlannerChatRequest.mode`) and which category `onSearch()` seeds as live vs. skipped
  - `services/mockData.ts` — destinations + seeded mock search generators
  - `services/planner.ts` — emptyDraft helper, `SearchMode` type, `runSearch()` (mock package builder)
  - `store/AppContext.tsx` — profile + trips + savedOffers persisted via AsyncStorage (savedOffers is local-only, no `/api/sync`); in-memory search results; pulls/merges cloud state on sign-in and pushes local changes (debounced) while signed in
  - `services/api.ts` — configures `@workspace/api-client-react` base URL at startup
  - Tabs: Home / Plan / Trips / Profile (Explore was folded into Home, not kept as a separate tab); stack screens: results, flight/hotel details, trip, trip-budget, trip-map, onboarding
  - Trips has three sections: Saved (heart-bookmarked individual flights/hotels/packages, `SavedOffer` — a frozen price snapshot with an explicit "Refresh pricing" action, never a silent re-fetch), Planned (existing chosen-but-unbooked `Trip` objects, unchanged), Active (paid bookings via `services/bookings.ts`)
- `artifacts/api-server` — Express API server (workflow `artifacts/api-server: API Server`)
  - `src/routes/planner.ts` — `POST /api/planner/chat`: LLM-powered conversational planner; live AI only — returns 503 with a human-readable message when AI credentials are absent (no server-side demo fallback; the client surfaces the message). Includes IP-based rate limiting (20 req/min) and bounded response validation.
  - AI: Groq API via `AI_INTEGRATIONS_OPENAI_BASE_URL` + `AI_INTEGRATIONS_OPENAI_API_KEY` env vars; model set by `PLANNER_MODEL` (currently `openai/gpt-oss-120b` — `llama-3.3-70b-versatile` was retired by Groq; check `GET /v1/models` before changing again). It's a reasoning model — `max_tokens` needs real headroom (1500) or JSON generation can be cut off mid-output.
  - Clerk Auth: Express validates Clerk sessions; protected routes JIT-provision a local `users` row by the preserved legacy ID in `sessionClaims.userId`. The `users` and `sessions` tables remain in Postgres for local relationships and legacy data.
  - `/api/sync` GET/PUT — per-user trips + preferences (last-write-wins, `user_sync` table); trips stored as opaque JSON so the mobile Trip shape can evolve freely
- Mobile auth: Clerk Expo is configured in `artifacts/mobile/app/_layout.tsx`; native API calls attach Clerk bearer tokens through the shared generated API client. Signed-out users remain local-only (AsyncStorage).
- `lib/api-spec` — OpenAPI spec; codegen produces `@workspace/api-client-react`
- `lib/api-client-react` — generated React Query hooks used by the mobile app
## Environment (off Replit — local/VS Code)
- All api-server config lives in `artifacts/api-server/.env` (gitignored), loaded at startup by `src/lib/loadEnv.ts`; `.env.example` is the template. Real env vars always override `.env`.
- Groq: `AI_INTEGRATIONS_OPENAI_BASE_URL` + `AI_INTEGRATIONS_OPENAI_API_KEY` — the planner uses Groq's OpenAI-compatible API.
- Authentication is handled by Replit-managed Clerk. Web sessions use Clerk cookies through the same-origin API; the Expo app uses Clerk bearer tokens. Guest booking flows are unaffected.

## Supplier integration (LiteAPI / Nuitée)
- Hotel search + booking runs on LiteAPI: `GET /data/hotels` + `POST /hotels/rates` for search (`src/routes/search.ts`), `POST /rates/prebook` → `POST /rates/book` for booking (`src/routes/bookings.ts`); client in `src/lib/liteApi.ts`.
- Env (.env): `LITEAPI_KEY` — currently **sandbox** (`LITEAPI_KEY_PROD` holds the production key for swapping in). Optional: `LITEAPI_GUEST_NATIONALITY` (ISO-2, default `US`).
- Legacy: `ROUTESTACK_API_KEY`, `ROUTESTACK_API_SECRET`, and `ROUTESTACK_BASE_URL` are no longer read by any code and can be discarded.

### Flights — search live, booking BLOCKED on a LiteAPI-side issue (2026-08-17)
- **Search (Phase A, done):** `searchFlights()` in `src/routes/search.ts` calls `POST /flights/rates` (round-trip via two `legs` entries, `direction: OUTBOUND`/`INBOUND`) and maps `journeys[].cheapestOffer` + sibling `segments[]` into `FlightOffer[]`. Verified live end-to-end on the sandbox key (25 real offers, real airline/times/baggage). Itinerary duration is computed from elapsed segment times, never trusted from the journey-level `totalDuration`/`legDurations` summary fields — live sandbox data showed those disagreeing with the segments' own actual times.
- **`draft.destinationCode` may not be a real IATA code.** Since destination resolution opened up beyond the old fixed city list, the AI planner's `destinationCode` is a best-guess label, not a verified airport code (unlike `draft.origin`, which has always been IATA-only). If it's wrong, `/flights/rates` just returns nothing useful and search degrades to the existing empty-result → mock fallback — no special-case handling was added for this.
- **`FlightOffer.bookingRef` is deliberately left unset.** The client already gates checkout eligibility on `bookingRef` presence (`booking/new.tsx`: `bookableFlight = trip?.flight?.bookingRef ? trip.flight : null`), so flights appear in search/packages but can't reach checkout — confirmed this is sufficient on its own, no server-side guard was needed.
- **Production LiteAPI key has NO flight access** — confirmed live: `POST /flights/rates` on `LITEAPI_KEY_PROD` returns HTTP 403 `"Flights API for this account is limited to sandbox API keys only"`. Hotels are unaffected on production. Flight testing requires the sandbox key active.
- **Booking (Phase B) is on hold.** `POST /rates/prebook` with a real flight `offerId` returns a generic HTTP 500 `"unexpected prebook error"` on the sandbox account — reproduced consistently. This blocks Phase B until LiteAPI support confirms it is fixed. `placeFlightBooking()` in `src/routes/bookings.ts` stays a stub returning a clean "not yet available" error until this is resolved.

## Source badges
- `sourceType="ai"` → green "AI" badge with CPU icon (LLM-generated content)
- `sourceType="demo"` or `"mock"` → amber "Demo data" badge (fallback/mock content)
- `sourceType="live"` / `"estimated"` → green "Live" / "Estimate" badges (future: real API data)

## Branding
Teal `#087E8B` primary, coral `#FF6B5E` secondary, navy `#102A43`. The confirmed brand name is **Safferni** (double F) — never "Saferni" (single F) or "Safar AI".

## User preferences
(none recorded yet)
