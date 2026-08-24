/**
 * LiteAPI (Nuitée) client.
 *
 * Two hosts, one key:
 *  - Data & rates:  https://api.liteapi.travel/v3.0   (GET /data/hotels, POST /hotels/rates)
 *  - Booking:       https://book.liteapi.travel/v3.0  (POST /rates/prebook, POST /rates/book)
 *
 * Auth is a single `X-API-Key` header (LITEAPI_KEY). Booking is synchronous:
 * prebook locks a rate and returns a prebookId; book confirms it and returns
 * `status: "CONFIRMED"` with a bookingId directly — no hosted checkout page
 * and no async status to poll.
 */

type Rec = Record<string, unknown>;
const rec = (v: unknown): Rec => (v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : {});

export function liteApiConfigured(): boolean {
  return Boolean(process.env.LITEAPI_KEY);
}

function dataBaseUrl(): string {
  return process.env.LITEAPI_DATA_BASE_URL ?? "https://api.liteapi.travel/v3.0";
}

function bookBaseUrl(): string {
  return process.env.LITEAPI_BOOK_BASE_URL ?? "https://book.liteapi.travel/v3.0";
}

// Test-only fetch injection (same pattern as the rest of the server).
type FetchFn = typeof fetch;
let _fetch: FetchFn = (...args) => fetch(...args);
/** Inject a fetch implementation — only for use in tests. */
export function _setLiteApiFetchForTesting(fn: FetchFn | null): void {
  _fetch = fn ?? ((...args) => fetch(...args));
}

// Sandbox-tier keys carry a very tight, shared rate limit (5 requests per
// short window — confirmed via LiteAPI's response headers) on /data/hotels
// and /hotels/rates specifically. A normal search plus a retry or two can
// burst past that. Serialize calls to just these two paths through one
// FIFO queue with a minimum gap between dispatches, so the app can't fire
// them concurrently. Production's budget is far larger, so this gap is a
// negligible, harmless tax there.
const PACED_PATHS = ["/data/hotels", "/hotels/rates", "/data/hotel", "/data/reviews"];
const PACE_GAP_MS = process.env.NODE_ENV === "test" ? 0 : Number(process.env.LITEAPI_PACE_GAP_MS ?? 1500);
let _paceQueue: Promise<void> = Promise.resolve();
let _lastPacedDispatch = 0;

function pace(pathname: string): Promise<void> {
  if (!PACED_PATHS.some((p) => pathname.includes(p))) return Promise.resolve();
  const turn = _paceQueue.then(async () => {
    const wait = PACE_GAP_MS - (Date.now() - _lastPacedDispatch);
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    _lastPacedDispatch = Date.now();
  });
  _paceQueue = turn;
  return turn;
}

async function request(url: string, init: RequestInit): Promise<Rec> {
  await pace(new URL(url).pathname);
  const res = await _fetch(url, {
    ...init,
    headers: {
      "X-API-Key": process.env.LITEAPI_KEY ?? "",
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  const text = await res.text().catch(() => "");
  if (!res.ok) {
    throw new Error(`LiteAPI ${new URL(url).pathname} failed (${res.status}): ${text.slice(0, 300)}`);
  }
  try {
    return rec(JSON.parse(text));
  } catch {
    throw new Error(`LiteAPI ${new URL(url).pathname} returned non-JSON response`);
  }
}

/** GET on the data host (e.g. laGet("/data/hotels", { cityName: "Paris" })). */
export async function laGet(path: string, params: Record<string, string | number | undefined>): Promise<Rec> {
  const url = new URL(`${dataBaseUrl()}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }
  return request(url.toString(), { method: "GET" });
}

/** Fetch the full hotel content payload used by the detail screen. */
export async function getHotelDetails(hotelId: string): Promise<Rec> {
  return laGet("/data/hotel", { hotelId });
}

/** POST on the data host (e.g. laPost("/hotels/rates", body)). */
export async function laPost(path: string, body: unknown): Promise<Rec> {
  return request(`${dataBaseUrl()}${path}`, { method: "POST", body: JSON.stringify(body) });
}

/** POST on the booking host (prebook / book / cancel). */
export async function laBookPost(path: string, body: unknown): Promise<Rec> {
  return request(`${bookBaseUrl()}${path}`, { method: "POST", body: JSON.stringify(body) });
}
