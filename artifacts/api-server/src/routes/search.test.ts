import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import app from "../app";
import { _setFetchForTesting } from "./search";
import { getOfferContext } from "../lib/offerStore";

const DRAFT = {
  origin: "YUL",
  destinationCode: "CDG",
  destinationName: "Paris",
  departureDate: "2026-09-01",
  returnDate: "2026-09-08",
  nights: 7,
  adults: 2,
  children: 0,
  budget: 3000,
  currency: "USD",
  styles: [],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Mirrors LiteAPI GET /data/places.
const PLACES_RESPONSE = {
  data: [{ placeId: "plc_paris_fr", displayName: "Paris, France", types: ["locality"] }],
};

// Mirrors LiteAPI GET /data/hotels.
const HOTEL_CONTENT_RESPONSE = {
  data: [
    {
      id: "lp1234",
      name: "Hotel Lutetia",
      hotelDescription: "A grand hotel on the Left Bank.",
      stars: 5,
      rating: 9.2,
      reviewCount: 812,
      address: "45 Boulevard Raspail",
      latitude: 48.8514,
      longitude: 2.3266,
      main_photo: "https://example.com/p.jpg",
      city: "Paris",
      country: "FR",
    },
    {
      id: "lp5678",
      name: "Hotel Petit",
      stars: 3,
      rating: 8.1,
      reviewCount: 120,
      address: "2 Rue Cler",
      latitude: 48.857,
      longitude: 2.306,
      main_photo: "https://example.com/q.jpg",
    },
  ],
};

// Mirrors LiteAPI POST /hotels/rates.
const RATES_RESPONSE = {
  data: [
    {
      hotelId: "lp1234",
      roomTypes: [
        {
          offerId: "offer_expensive",
          offerRetailRate: { amount: 2400, currency: "USD" },
          rates: [
            {
              name: "Suite",
              boardName: "Breakfast Included",
              cancellationPolicies: { refundableTag: "RFN" },
              retailRate: { total: [{ amount: 2400, currency: "USD" }] },
            },
          ],
        },
        {
          offerId: "offer_cheap",
          offerRetailRate: { amount: 2100, currency: "USD" },
          rates: [
            {
              name: "Classic Room",
              boardName: "Room Only",
              cancellationPolicies: { refundableTag: "RFN" },
              retailRate: { total: [{ amount: 2100, currency: "USD" }] },
            },
          ],
        },
      ],
    },
    {
      hotelId: "lp5678",
      roomTypes: [
        {
          offerId: "offer_petit",
          offerRetailRate: { amount: 910, currency: "USD" },
          rates: [
            {
              name: "Double Room",
              boardName: "Room Only",
              cancellationPolicies: { refundableTag: "NRFN" },
              retailRate: { total: [{ amount: 910, currency: "USD" }] },
            },
          ],
        },
      ],
    },
  ],
};

// Mirrors LiteAPI POST /flights/rates (shape confirmed against a real live
// sandbox response). No journeys — the shared happy-path fixture only
// exercises hotel mapping; dedicated flight tests below use their own.
const FLIGHTS_RESPONSE = { data: [{ journeys: [] }] };

function flightSegment(overrides: Record<string, unknown> = {}) {
  return {
    direction: "OUTBOUND",
    originCode: "YUL",
    destinationCode: "CDG",
    departureTime: "2027-06-01T13:50:00",
    arrivalTime: "2027-06-01T21:29:00",
    carrier: { marketingCode: "ND", marketingName: "Nuitée Air", operatingCode: "ND", operatingName: "Nuitée Air" },
    flight: { marketingNumber: "6497", operatingNumber: "6497" },
    duration: { iso8601: "PT7H39M", minutes: 459 },
    ...overrides,
  };
}

function flightOffer(overrides: Record<string, unknown> = {}) {
  return {
    offerId: "offer_yulcdg_1",
    pricing: {
      display: {
        total: 547.26,
        currency: "USD",
        base: 410.44,
        fees: 0,
        taxes: 136.82,
        perPassenger: { adult: { total: 547.26, base: 410.44, currency: "USD", fees: 0, taxes: 136.82 } },
      },
    },
    baggage: {
      included: [{ bagType: "personal", description: "Personal item", pieces: 1, weightKg: 5 }],
      paid: [{ bagType: "checked", description: "Checked bag", pieces: 1, weightKg: 23, pricing: { display: { amount: 53.09, currency: "USD" } } }],
    },
    fare: { family: "Economy Light", mixedCabin: false, seatsRemaining: 9 },
    segmentFares: [{ cabin: "Economy", segmentKey: "seg1", seatsRemaining: 9 }],
    terms: { changeable: false, refundable: false, summary: [{ level: "warning", message: "Non-refundable ticket" }] },
    ...overrides,
  };
}

// Round-trip: one journey with both directions' segments.
const ROUND_TRIP_FLIGHTS_RESPONSE = {
  data: [{
    journeys: [{
      cheapestOffer: flightOffer(),
      segments: [
        flightSegment(),
        flightSegment({
          direction: "INBOUND", originCode: "CDG", destinationCode: "YUL",
          departureTime: "2027-06-08T10:00:00", arrivalTime: "2027-06-08T12:15:00",
          duration: { iso8601: "PT8H15M", minutes: 495 },
          flight: { marketingNumber: "6498", operatingNumber: "6498" },
        }),
      ],
    }],
  }],
};

// One-way: single OUTBOUND-only journey (no return leg requested).
const ONE_WAY_FLIGHTS_RESPONSE = {
  data: [{ journeys: [{ cheapestOffer: flightOffer(), segments: [flightSegment()] }] }],
};

function makeLiteApiFetch() {
  return vi.fn(async (input: string | URL | Request, _init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/data/places")) return jsonResponse(PLACES_RESPONSE);
    if (url.includes("/data/hotels")) return jsonResponse(HOTEL_CONTENT_RESPONSE);
    if (url.includes("/hotels/rates")) return jsonResponse(RATES_RESPONSE);
    if (url.includes("/flights/rates")) return jsonResponse(FLIGHTS_RESPONSE);
    return jsonResponse({ error: "not found" }, 404);
  });
}

beforeEach(() => {
  _setFetchForTesting(null);
  delete process.env.LITEAPI_KEY;
});

afterEach(() => {
  _setFetchForTesting(null);
  delete process.env.LITEAPI_KEY;
});

function configure() {
  process.env.LITEAPI_KEY = "sand_test_key";
}

describe("POST /api/search", () => {
  it("rejects an invalid body with 400", async () => {
    const res = await request(app).post("/api/search").send({ draft: {} });
    expect(res.status).toBe(400);
  });

  it("rejects a draft without a destination with 400", async () => {
    const res = await request(app)
      .post("/api/search")
      .send({ draft: { ...DRAFT, destinationCode: undefined, destinationName: undefined } });
    expect(res.status).toBe(400);
  });

  it("returns source:mock when no API credentials are configured", async () => {
    const res = await request(app).post("/api/search").send({ draft: DRAFT });
    expect(res.status).toBe(200);
    expect(res.body.source).toBe("mock");
    expect(res.body.flights).toEqual([]);
    expect(res.body.hotels).toEqual([]);
  });

  it("authenticates every LiteAPI call with the X-API-Key header", async () => {
    configure();
    const fetchMock = makeLiteApiFetch();
    _setFetchForTesting(fetchMock as unknown as typeof fetch);

    await request(app).post("/api/search").send({ draft: DRAFT });

    const liteApiCalls = fetchMock.mock.calls.filter(
      (c) =>
        String(c[0]).includes("/data/places") ||
        String(c[0]).includes("/data/hotels") ||
        String(c[0]).includes("/hotels/rates") ||
        String(c[0]).includes("/flights/rates"),
    );
    expect(liteApiCalls.length).toBeGreaterThanOrEqual(4);
    for (const call of liteApiCalls) {
      const headers = (call[1] as RequestInit).headers as Record<string, string>;
      expect(headers["X-API-Key"]).toBe("sand_test_key");
    }
  });

  it("returns mapped live hotel offers when LiteAPI responds", async () => {
    configure();
    _setFetchForTesting(makeLiteApiFetch() as unknown as typeof fetch);

    const res = await request(app).post("/api/search").send({ draft: DRAFT });
    expect(res.status).toBe(200);
    expect(res.body.source).toBe("live");

    // This fixture's FLIGHTS_RESPONSE has no journeys — flight mapping is
    // covered by its own dedicated tests below.
    expect(res.body.flights).toEqual([]);

    // Sorted by price — Hotel Petit (910) before Hotel Lutetia (2100).
    const [petit, lutetia] = res.body.hotels;
    expect(res.body.hotels.length).toBe(2);

    expect(lutetia.id).toBe("la_ht_lp1234");
    expect(lutetia.provider).toBe("LiteAPI");
    expect(lutetia.sourceType).toBe("live");
    expect(lutetia.name).toBe("Hotel Lutetia");
    expect(lutetia.starRating).toBe(5);
    expect(lutetia.guestRating).toBe(9.2);
    expect(lutetia.reviewCount).toBe(812);
    // Cheapest room type wins: 2100, not the 2400 suite.
    expect(lutetia.totalPrice).toBe(2100);
    expect(lutetia.nightlyPrice).toBe(300);
    expect(lutetia.currency).toBe("USD");
    expect(lutetia.refundable).toBe(true);
    expect(lutetia.roomName).toBe("Classic Room");
    expect(lutetia.mealPlan).toBe("Room Only");
    expect(lutetia.images).toEqual(["https://example.com/p.jpg"]);
    expect(lutetia.address).toBe("45 Boulevard Raspail");
    expect(lutetia.bookingRef).toBe("lp1234");

    expect(petit.id).toBe("la_ht_lp5678");
    expect(petit.totalPrice).toBe(910);
    expect(petit.refundable).toBe(false);
    expect(petit.cancellationSummary).toBe("Non-refundable");
  });

  it("sends the expected place, hotel content, and rates request payloads", async () => {
    configure();
    const fetchMock = makeLiteApiFetch();
    _setFetchForTesting(fetchMock as unknown as typeof fetch);

    await request(app)
      .post("/api/search")
      .send({ draft: { ...DRAFT, children: 1, departureDate: "2026-09-15", returnDate: "2026-09-22" } });

    const placesCall = fetchMock.mock.calls.find((c) => String(c[0]).includes("/data/places"));
    expect(placesCall).toBeDefined();
    const placesUrl = new URL(String(placesCall![0]));
    expect(placesUrl.searchParams.get("textQuery")).toBe("Paris");
    expect(placesUrl.searchParams.get("type")).toBe("locality");

    const contentCall = fetchMock.mock.calls.find((c) => String(c[0]).includes("/data/hotels"));
    expect(contentCall).toBeDefined();
    const contentUrl = new URL(String(contentCall![0]));
    expect(contentUrl.searchParams.get("placeId")).toBe("plc_paris_fr");

    const ratesCall = fetchMock.mock.calls.find((c) => String(c[0]).includes("/hotels/rates"));
    expect(ratesCall).toBeDefined();
    const ratesBody = JSON.parse(String((ratesCall![1] as RequestInit).body));
    expect(ratesBody.hotelIds).toEqual(["lp1234", "lp5678"]);
    expect(ratesBody.checkin).toBe("2026-09-15");
    expect(ratesBody.checkout).toBe("2026-09-22");
    expect(ratesBody.currency).toBe("USD");
    expect(typeof ratesBody.guestNationality).toBe("string");
    expect(ratesBody.occupancies).toEqual([{ adults: 2, children: [10] }]);
  });

  it("serves cached results on a repeat search without re-calling the API", async () => {
    configure();
    const fetchMock = makeLiteApiFetch();
    _setFetchForTesting(fetchMock as unknown as typeof fetch);

    const first = await request(app).post("/api/search").send({ draft: DRAFT });
    expect(first.body.source).toBe("live");
    const callsAfterFirst = fetchMock.mock.calls.length;

    const second = await request(app).post("/api/search").send({ draft: DRAFT });
    expect(second.body.source).toBe("cached");
    expect(second.body.hotels[0].sourceType).toBe("cached");
    expect(fetchMock.mock.calls.length).toBe(callsAfterFirst);
  });

  it("skips hotels with malformed or missing prices instead of exposing them", async () => {
    configure();
    _setFetchForTesting(
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes("/data/places")) return jsonResponse(PLACES_RESPONSE);
        if (url.includes("/data/hotels")) return jsonResponse(HOTEL_CONTENT_RESPONSE);
        if (url.includes("/hotels/rates")) {
          return jsonResponse({
            data: [
              {
                hotelId: "lp1234",
                roomTypes: [
                  {
                    offerId: "offer_bad",
                    offerRetailRate: { amount: "junk" },
                    rates: [{ retailRate: { total: [{ amount: "1450junk" }] } }],
                  },
                ],
              },
              // No offerId — unbookable, must be skipped.
              { hotelId: "lp5678", roomTypes: [{ offerRetailRate: { amount: 500, currency: "USD" } }] },
            ],
          });
        }
        return jsonResponse({}, 404);
      }) as unknown as typeof fetch,
    );

    const res = await request(app)
      .post("/api/search")
      .send({ draft: { ...DRAFT, departureDate: "2027-05-01", returnDate: "2027-05-08" } });
    expect(res.status).toBe(200);
    expect(res.body.source).toBe("mock");
    expect(res.body.hotels).toEqual([]);
  });

  it("resolves any destination via LiteAPI's place search — no hardcoded city list", async () => {
    configure();
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/data/places")) {
        expect(new URL(url).searchParams.get("textQuery")).toBe("Tokyo");
        return jsonResponse({ data: [{ placeId: "plc_tokyo_jp", displayName: "Tokyo, Japan" }] });
      }
      if (url.includes("/data/hotels")) {
        expect(new URL(url).searchParams.get("placeId")).toBe("plc_tokyo_jp");
        return jsonResponse({
          data: [{ id: "tk1", name: "Tokyo Stay Hotel", stars: 4, rating: 8.8, reviewCount: 50 }],
        });
      }
      if (url.includes("/hotels/rates")) {
        expect(JSON.parse(String(init?.body)).hotelIds).toEqual(["tk1"]);
        return jsonResponse({
          data: [
            {
              hotelId: "tk1",
              roomTypes: [
                {
                  offerId: "offer_tk",
                  offerRetailRate: { amount: 400, currency: "USD" },
                  rates: [
                    {
                      name: "Standard",
                      boardName: "Room Only",
                      cancellationPolicies: { refundableTag: "RFN" },
                      retailRate: { total: [{ amount: 400, currency: "USD" }] },
                    },
                  ],
                },
              ],
            },
          ],
        });
      }
      return jsonResponse({}, 404);
    });
    _setFetchForTesting(fetchMock as unknown as typeof fetch);

    const res = await request(app).post("/api/search").send({
      draft: {
        ...DRAFT,
        destinationCode: "TYO",
        destinationName: "Tokyo",
        departureDate: "2027-09-01",
        returnDate: "2027-09-08",
      },
    });
    expect(res.status).toBe(200);
    expect(res.body.source).toBe("live");
    expect(res.body.hotels[0].name).toBe("Tokyo Stay Hotel");
  });

  it("biases the /data/places query with the country and picks the matching candidate — Cairo, Egypt vs Cairo, USA", async () => {
    configure();
    const fetchMock = vi.fn(async (input: string | URL | Request, _init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/data/places")) {
        expect(new URL(url).searchParams.get("textQuery")).toBe("Cairo, Egypt");
        return jsonResponse({
          data: [
            { placeId: "plc_cairo_ga", displayName: "Cairo", formattedAddress: "GA, USA", types: ["locality"] },
            { placeId: "plc_cairo_il", displayName: "Cairo", formattedAddress: "IL, USA", types: ["locality"] },
            { placeId: "plc_cairo_eg", displayName: "Cairo", formattedAddress: "Egypt", types: ["locality"] },
          ],
        });
      }
      if (url.includes("/data/hotels")) {
        expect(new URL(url).searchParams.get("placeId")).toBe("plc_cairo_eg");
        return jsonResponse({ data: [{ id: "eg1", name: "Nile View Hotel", stars: 5 }] });
      }
      if (url.includes("/hotels/rates")) {
        return jsonResponse({
          data: [{ hotelId: "eg1", roomTypes: [{ offerId: "o1", offerRetailRate: { amount: 200, currency: "USD" }, rates: [{ retailRate: { total: [{ amount: 200, currency: "USD" }] } }] }] }],
        });
      }
      return jsonResponse({}, 404);
    });
    _setFetchForTesting(fetchMock as unknown as typeof fetch);

    const res = await request(app).post("/api/search").send({
      draft: { ...DRAFT, destinationCode: "CAI", destinationName: "Cairo", destinationCountry: "Egypt" },
    });
    expect(res.status).toBe(200);
    expect(res.body.source).toBe("live");
    expect(res.body.hotels[0].name).toBe("Nile View Hotel");
  });

  it("picks the correct country among three real candidates — Cambridge, United Kingdom", async () => {
    configure();
    const fetchMock = vi.fn(async (input: string | URL | Request, _init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/data/places")) {
        return jsonResponse({
          data: [
            { placeId: "plc_cambridge_on", displayName: "Cambridge", formattedAddress: "ON, Canada", types: ["locality"] },
            { placeId: "plc_cambridge_ma", displayName: "Cambridge", formattedAddress: "MA, USA", types: ["locality"] },
            { placeId: "plc_cambridge_uk", displayName: "Cambridge", formattedAddress: "UK", types: ["locality"] },
            { placeId: "plc_cambridge_md", displayName: "Cambridge", formattedAddress: "MD, USA", types: ["locality"] },
          ],
        });
      }
      if (url.includes("/data/hotels")) {
        expect(new URL(url).searchParams.get("placeId")).toBe("plc_cambridge_uk");
        return jsonResponse({ data: [{ id: "uk1", name: "Punting House Hotel", stars: 4 }] });
      }
      if (url.includes("/hotels/rates")) {
        return jsonResponse({
          data: [{ hotelId: "uk1", roomTypes: [{ offerId: "o2", offerRetailRate: { amount: 180, currency: "USD" }, rates: [{ retailRate: { total: [{ amount: 180, currency: "USD" }] } }] }] }],
        });
      }
      return jsonResponse({}, 404);
    });
    _setFetchForTesting(fetchMock as unknown as typeof fetch);

    const res = await request(app).post("/api/search").send({
      draft: { ...DRAFT, destinationCode: "CBG", destinationName: "Cambridge", destinationCountry: "United Kingdom" },
    });
    expect(res.status).toBe(200);
    expect(res.body.hotels[0].name).toBe("Punting House Hotel");
  });

  it("matches an accented city name despite diacritics, and skips noise from the same country — Valencia, Spain vs Venezuela", async () => {
    configure();
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/data/places")) {
        return jsonResponse({
          data: [
            // Real place name carries the accent LiteAPI's own search returns —
            // a naive ASCII .includes("valencia") would miss this entirely.
            { placeId: "plc_valencia_es", displayName: "València", formattedAddress: "Spain", types: ["locality"] },
            { placeId: "plc_valencia_ve", displayName: "Valencia", formattedAddress: "Carabobo, Venezuela", types: ["locality"] },
            { placeId: "plc_valencia_pa", displayName: "Valencia", formattedAddress: "PA, USA", types: ["locality"] },
            // Same-country noise the fuzzy text search pulls in — must be
            // excluded by the name-match filter despite matching on country.
            { placeId: "plc_noise_es", displayName: "Vergel", formattedAddress: "Spain", types: ["locality"] },
          ],
        });
      }
      if (url.includes("/data/hotels")) {
        expect(new URL(url).searchParams.get("placeId")).toBe("plc_valencia_es");
        return jsonResponse({ data: [{ id: "es1", name: "Hotel de las Artes", stars: 4 }] });
      }
      if (url.includes("/hotels/rates")) {
        return jsonResponse({
          data: [{ hotelId: "es1", roomTypes: [{ offerId: "o3", offerRetailRate: { amount: 150, currency: "USD" }, rates: [{ retailRate: { total: [{ amount: 150, currency: "USD" }] } }] }] }],
        });
      }
      return jsonResponse({}, 404);
    });
    _setFetchForTesting(fetchMock as unknown as typeof fetch);

    const res = await request(app).post("/api/search").send({
      draft: { ...DRAFT, destinationCode: "VLC", destinationName: "Valencia", destinationCountry: "Spain" },
    });
    expect(res.status).toBe(200);
    expect(res.body.hotels[0].name).toBe("Hotel de las Artes");
  });

  it("matches an accented city name in the other direction too — Zurich (ASCII) finds Zürich (accented)", async () => {
    configure();
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/data/places")) {
        return jsonResponse({
          data: [
            { placeId: "plc_zurich_ch", displayName: "Zürich", formattedAddress: "Switzerland", types: ["locality"] },
            { placeId: "plc_noise", displayName: "Zurich Avenue", formattedAddress: "Chicago, IL, USA", types: ["route"] },
          ],
        });
      }
      if (url.includes("/data/hotels")) {
        expect(new URL(url).searchParams.get("placeId")).toBe("plc_zurich_ch");
        return jsonResponse({ data: [{ id: "ch1", name: "Lake Zurich Hotel", stars: 5 }] });
      }
      if (url.includes("/hotels/rates")) {
        return jsonResponse({
          data: [{ hotelId: "ch1", roomTypes: [{ offerId: "o4", offerRetailRate: { amount: 300, currency: "USD" }, rates: [{ retailRate: { total: [{ amount: 300, currency: "USD" }] } }] }] }],
        });
      }
      return jsonResponse({}, 404);
    });
    _setFetchForTesting(fetchMock as unknown as typeof fetch);

    const res = await request(app).post("/api/search").send({
      draft: { ...DRAFT, destinationCode: "ZRH", destinationName: "Zurich", destinationCountry: "Switzerland" },
    });
    expect(res.status).toBe(200);
    expect(res.body.hotels[0].name).toBe("Lake Zurich Hotel");
  });

  it("without a country hint, biases toward a genuine locality instead of an arbitrary first result", async () => {
    configure();
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/data/places")) {
        return jsonResponse({
          data: [
            // A non-locality entry ranked first by the API — must be skipped
            // in favor of the real locality below when there's no country to
            // disambiguate with.
            { placeId: "plc_poi", displayName: "Some Landmark", formattedAddress: "Somewhere", types: ["point_of_interest", "establishment"] },
            { placeId: "plc_locality", displayName: "Somewhereville", formattedAddress: "Somewhereland", types: ["locality", "political"] },
          ],
        });
      }
      if (url.includes("/data/hotels")) {
        expect(new URL(url).searchParams.get("placeId")).toBe("plc_locality");
        return jsonResponse({ data: [{ id: "sw1", name: "Somewhereville Inn", stars: 3 }] });
      }
      if (url.includes("/hotels/rates")) {
        return jsonResponse({
          data: [{ hotelId: "sw1", roomTypes: [{ offerId: "o5", offerRetailRate: { amount: 90, currency: "USD" }, rates: [{ retailRate: { total: [{ amount: 90, currency: "USD" }] } }] }] }],
        });
      }
      return jsonResponse({}, 404);
    });
    _setFetchForTesting(fetchMock as unknown as typeof fetch);

    const res = await request(app).post("/api/search").send({
      draft: { ...DRAFT, destinationCode: "SWV", destinationName: "Somewhereville", destinationCountry: undefined },
    });
    expect(res.status).toBe(200);
    expect(res.body.hotels[0].name).toBe("Somewhereville Inn");
  });

  it("does not collide in the search cache when the same city name has different countries", async () => {
    configure();
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/data/places")) {
        const q = new URL(url).searchParams.get("textQuery");
        const eg = { placeId: "plc_cairo_eg", displayName: "Cairo", formattedAddress: "Egypt", types: ["locality"] };
        const us = { placeId: "plc_cairo_ga", displayName: "Cairo", formattedAddress: "GA, USA", types: ["locality"] };
        return jsonResponse({ data: q?.includes("Egypt") ? [eg, us] : [us, eg] });
      }
      if (url.includes("/data/hotels")) {
        const placeId = new URL(url).searchParams.get("placeId");
        return jsonResponse({ data: [{ id: placeId, name: placeId === "plc_cairo_eg" ? "Nile View Hotel" : "Georgia Inn" }] });
      }
      if (url.includes("/hotels/rates")) {
        const hotelId = JSON.parse(String(init?.body ?? "{}")).hotelIds?.[0];
        return jsonResponse({
          data: [{ hotelId, roomTypes: [{ offerId: "o", offerRetailRate: { amount: 100, currency: "USD" }, rates: [{ retailRate: { total: [{ amount: 100, currency: "USD" }] } }] }] }],
        });
      }
      return jsonResponse({}, 404);
    });
    _setFetchForTesting(fetchMock as unknown as typeof fetch);

    const egyptRes = await request(app).post("/api/search").send({
      draft: { ...DRAFT, destinationCode: "CAI", destinationName: "Cairo", destinationCountry: "Egypt", departureDate: "2027-11-01", returnDate: "2027-11-08" },
    });
    const usaRes = await request(app).post("/api/search").send({
      draft: { ...DRAFT, destinationCode: "CAI", destinationName: "Cairo", destinationCountry: "United States", departureDate: "2027-11-01", returnDate: "2027-11-08" },
    });
    expect(egyptRes.body.hotels[0].name).toBe("Nile View Hotel");
    expect(usaRes.body.hotels[0].name).toBe("Georgia Inn");
  });

  it("falls back to source:mock when the destination can't be resolved to a place", async () => {
    configure();
    _setFetchForTesting(
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes("/data/places")) return jsonResponse({ data: [] }); // no match
        return jsonResponse({}, 404);
      }) as unknown as typeof fetch,
    );

    const res = await request(app).post("/api/search").send({
      draft: { ...DRAFT, destinationName: "Nowhereville", departureDate: "2027-10-01", returnDate: "2027-10-08" },
    });
    expect(res.status).toBe(200);
    expect(res.body.source).toBe("mock");
  });

  it("returns live flights for category:flights and never calls the hotel APIs", async () => {
    configure();
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/flights/rates")) return jsonResponse(ONE_WAY_FLIGHTS_RESPONSE);
      return jsonResponse({ error: "not found" }, 404);
    });
    _setFetchForTesting(fetchMock as unknown as typeof fetch);

    const res = await request(app)
      .post("/api/search")
      .send({ draft: { ...DRAFT, departureDate: "2027-06-01", returnDate: "2027-06-08" }, category: "flights" });
    expect(res.status).toBe(200);
    expect(res.body.source).toBe("live");
    expect(res.body.flights.length).toBe(1);
    expect(res.body.hotels).toEqual([]);
    // The hotel API (including place resolution) must not be called for a flights-only search.
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("/data/places"))).toBe(false);
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("/hotels/rates"))).toBe(false);
  });

  it("maps a round-trip flight journey into outbound/inbound legs with full offer detail", async () => {
    configure();
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/flights/rates")) {
        const body = JSON.parse(String(init?.body));
        expect(body.legs).toEqual([
          { origin: "YUL", destination: "CDG", date: "2027-06-01", direction: "OUTBOUND" },
          { origin: "CDG", destination: "YUL", date: "2027-06-08", direction: "INBOUND" },
        ]);
        expect(body.adults).toBe(2);
        return jsonResponse(ROUND_TRIP_FLIGHTS_RESPONSE);
      }
      return jsonResponse({ error: "not found" }, 404);
    });
    _setFetchForTesting(fetchMock as unknown as typeof fetch);

    const res = await request(app).post("/api/search").send({
      draft: { ...DRAFT, departureDate: "2027-06-01", returnDate: "2027-06-08" },
      category: "flights",
    });
    expect(res.status).toBe(200);
    expect(res.body.source).toBe("live");
    const flight = res.body.flights[0];

    expect(flight.provider).toBe("LiteAPI");
    expect(flight.sourceType).toBe("live");
    expect(flight.totalPrice).toBe(547);
    expect(flight.currency).toBe("USD");
    expect(flight.pricePerTraveller).toBe(547); // perPassenger.adult.total
    expect(flight.validatingAirline).toBe("Nuitée Air");
    expect(flight.cabinClass).toBe("economy");

    expect(flight.outbound.segments[0].departureAirport).toBe("YUL");
    expect(flight.outbound.segments[0].arrivalAirport).toBe("CDG");
    expect(flight.outbound.segments[0].airlineCode).toBe("ND");
    expect(flight.outbound.segments[0].flightNumber).toBe("ND6497");
    expect(flight.outbound.durationMinutes).toBe(459); // elapsed 13:50->21:29, matches segment duration

    expect(flight.inbound.segments[0].departureAirport).toBe("CDG");
    expect(flight.inbound.segments[0].flightNumber).toBe("ND6498");
    expect(flight.totalDurationMinutes).toBe(flight.outbound.durationMinutes + flight.inbound.durationMinutes);
    expect(flight.totalStops).toBe(0); // one segment per direction

    expect(flight.baggage.checked).toContain("53.09");
    expect(flight.baggage.unknown).toBe(false);
    expect(flight.refundable).toBe(false);
    expect(flight.changeable).toBe(false);
    expect(flight.fareRulesSummary).toContain("Non-refundable");
    expect(flight.bookingRef).toBeUndefined(); // not bookable yet — Phase B is on hold
    expect(flight.id).toMatch(/^la_fl_/);
  });

  it("maps a one-way flight search with no inbound leg", async () => {
    configure();
    _setFetchForTesting(
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes("/flights/rates")) return jsonResponse(ONE_WAY_FLIGHTS_RESPONSE);
        return jsonResponse({ error: "not found" }, 404);
      }) as unknown as typeof fetch,
    );

    const res = await request(app).post("/api/search").send({
      draft: { ...DRAFT, departureDate: "2027-07-01", returnDate: "2027-07-08" },
      category: "flights",
    });
    expect(res.status).toBe(200);
    const flight = res.body.flights[0];
    expect(flight.outbound).toBeDefined();
    expect(flight.inbound).toBeUndefined();
    expect(flight.totalDurationMinutes).toBe(flight.outbound.durationMinutes);
  });

  it("computes itinerary duration from elapsed segment times, not a summary field", async () => {
    // Regression guard: live testing found journey-level totalDuration/
    // legDurations could disagree with the segments' own actual times —
    // duration must come from the segments, never trusted from a summary.
    configure();
    const skewedResponse = {
      data: [{
        journeys: [{
          cheapestOffer: flightOffer(),
          segments: [flightSegment()],
          totalDuration: { iso8601: "PT1H39M", minutes: 99 }, // deliberately wrong/unused
          legDurations: [{ direction: "OUTBOUND", duration: { minutes: 99 } }],
        }],
      }],
    };
    _setFetchForTesting(
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes("/flights/rates")) return jsonResponse(skewedResponse);
        return jsonResponse({ error: "not found" }, 404);
      }) as unknown as typeof fetch,
    );

    const res = await request(app).post("/api/search").send({
      draft: { ...DRAFT, departureDate: "2027-08-01", returnDate: "2027-08-08" },
      category: "flights",
    });
    // 13:50 -> 21:29 elapsed = 459 minutes, not the bogus 99-minute summary.
    expect(res.body.flights[0].outbound.durationMinutes).toBe(459);
  });

  it("dedupes journeys mapping to the same offer id, keeping the cheaper one", async () => {
    configure();
    const cheap = flightOffer({ offerId: "offer_dup", pricing: { display: { total: 400, currency: "USD", perPassenger: { adult: { total: 400 } } } } });
    const expensive = flightOffer({ offerId: "offer_dup", pricing: { display: { total: 900, currency: "USD", perPassenger: { adult: { total: 900 } } } } });
    const dupResponse = {
      data: [{
        journeys: [
          { cheapestOffer: expensive, segments: [flightSegment()] },
          { cheapestOffer: cheap, segments: [flightSegment()] },
        ],
      }],
    };
    _setFetchForTesting(
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes("/flights/rates")) return jsonResponse(dupResponse);
        return jsonResponse({ error: "not found" }, 404);
      }) as unknown as typeof fetch,
    );

    const res = await request(app).post("/api/search").send({
      draft: { ...DRAFT, departureDate: "2027-09-01", returnDate: "2027-09-08" },
      category: "flights",
    });
    expect(res.body.flights.length).toBe(1);
    expect(res.body.flights[0].totalPrice).toBe(400);
  });

  it("skips journeys with a missing offerId, no valid price, or no usable segments", async () => {
    configure();
    const noOfferId = { cheapestOffer: flightOffer({ offerId: undefined }), segments: [flightSegment()] };
    const noPrice = { cheapestOffer: flightOffer({ pricing: { display: { total: 0 } } }), segments: [flightSegment()] };
    const noSegments = { cheapestOffer: flightOffer({ offerId: "offer_nosegs" }), segments: [] };
    const badResponse = { data: [{ journeys: [noOfferId, noPrice, noSegments] }] };
    _setFetchForTesting(
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes("/flights/rates")) return jsonResponse(badResponse);
        return jsonResponse({ error: "not found" }, 404);
      }) as unknown as typeof fetch,
    );

    const res = await request(app).post("/api/search").send({
      draft: { ...DRAFT, departureDate: "2027-10-01", returnDate: "2027-10-08" },
      category: "flights",
    });
    expect(res.status).toBe(200);
    expect(res.body.source).toBe("mock"); // nothing usable came back
    expect(res.body.flights).toEqual([]);
  });

  it("stores flight offer context (the raw LiteAPI offerId) for later prebook use", async () => {
    configure();
    _setFetchForTesting(
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes("/flights/rates")) return jsonResponse(ONE_WAY_FLIGHTS_RESPONSE);
        return jsonResponse({ error: "not found" }, 404);
      }) as unknown as typeof fetch,
    );

    const res = await request(app).post("/api/search").send({
      draft: { ...DRAFT, departureDate: "2027-11-01", returnDate: "2027-11-08" },
      category: "flights",
    });
    // Booking a flight isn't wired up yet (Phase B on hold), but search must
    // still snapshot the context so Phase B can pick it up without another
    // change to search.ts.
    const flight = res.body.flights[0];
    const ctx = getOfferContext(flight.id);
    expect(ctx?.kind).toBe("flight");
    expect(ctx?.offerId).toBe("offer_yulcdg_1"); // the raw LiteAPI offerId, not our hashed id
    expect(ctx?.origin).toBe("YUL");
    expect(ctx?.destination).toBe("CDG");
    expect(ctx?.departureDate).toBe("2027-11-01");
    expect(ctx?.returnDate).toBe("2027-11-08");
  });

  it("guarantees at least 2 of the highest-starRating hotels survive the cheapest-16 cut", async () => {
    configure();
    // 18 cheap 3-star hotels (all cheaper than the 2 five-star ones below) —
    // a pure price sort would fill all 16 slots with these and drop every
    // 5-star hotel entirely, reproducing the real bug report.
    const cheapContent = Array.from({ length: 18 }, (_, i) => ({
      id: `cheap${i}`, name: `Budget Inn ${i}`, stars: 3,
    }));
    const luxContent = [
      { id: "lux0", name: "Grand Palace Hotel", stars: 5 },
      { id: "lux1", name: "Royal Suites", stars: 5 },
    ];
    const cheapRates = cheapContent.map((h, i) => ({
      hotelId: h.id,
      roomTypes: [{
        offerId: `o_${h.id}`,
        offerRetailRate: { amount: 100 + i, currency: "USD" },
        rates: [{ retailRate: { total: [{ amount: 100 + i, currency: "USD" }] } }],
      }],
    }));
    const luxRates = luxContent.map((h, i) => ({
      hotelId: h.id,
      roomTypes: [{
        offerId: `o_${h.id}`,
        offerRetailRate: { amount: 900 + i, currency: "USD" },
        rates: [{ retailRate: { total: [{ amount: 900 + i, currency: "USD" }] } }],
      }],
    }));

    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/data/places")) return jsonResponse(PLACES_RESPONSE);
      if (url.includes("/data/hotels")) return jsonResponse({ data: [...cheapContent, ...luxContent] });
      if (url.includes("/hotels/rates")) return jsonResponse({ data: [...cheapRates, ...luxRates] });
      return jsonResponse({}, 404);
    });
    _setFetchForTesting(fetchMock as unknown as typeof fetch);

    const res = await request(app).post("/api/search").send({ draft: DRAFT });
    expect(res.status).toBe(200);
    expect(res.body.hotels.length).toBe(16);
    const fiveStarInResult = res.body.hotels.filter((h: { starRating: number }) => h.starRating === 5);
    expect(fiveStarInResult.length).toBe(2);
    // The result must stay price-sorted even with the swap-in.
    const prices = res.body.hotels.map((h: { totalPrice: number }) => h.totalPrice);
    expect(prices).toEqual([...prices].sort((a: number, b: number) => a - b));
  });

  it("searches only hotels when category:hotels is requested", async () => {
    configure();
    const fetchMock = makeLiteApiFetch();
    _setFetchForTesting(fetchMock as unknown as typeof fetch);

    const draft = { ...DRAFT, departureDate: "2027-07-01", returnDate: "2027-07-08" };
    const res = await request(app).post("/api/search").send({ draft, category: "hotels" });
    expect(res.status).toBe(200);
    expect(res.body.source).toBe("live");
    expect(res.body.hotels.length).toBe(2);
    expect(res.body.flights).toEqual([]);
  });

  it("falls back to source:mock when the travel API fails and no cache exists", async () => {
    configure();
    _setFetchForTesting(vi.fn(async () => jsonResponse({ error: "boom" }, 500)) as unknown as typeof fetch);

    const res = await request(app)
      .post("/api/search")
      .send({ draft: { ...DRAFT, departureDate: "2026-10-01", returnDate: "2026-10-08" } });
    expect(res.status).toBe(200);
    expect(res.body.source).toBe("mock");
  });

  it("returns source:mock when the API responds with an unrecognized/empty shape", async () => {
    configure();
    _setFetchForTesting(
      vi.fn(async () => jsonResponse({ something: "else" })) as unknown as typeof fetch,
    );

    const res = await request(app)
      .post("/api/search")
      .send({ draft: { ...DRAFT, departureDate: "2026-11-01", returnDate: "2026-11-08" } });
    expect(res.status).toBe(200);
    expect(res.body.source).toBe("mock");
  });
});

describe("GET /api/hotels/:hotelId/detail", () => {
  it("maps full Nuitee hotel details while retaining image order and policy data", async () => {
    configure();
    const fetchMock = vi.fn(async (input: string | URL | Request, _init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/data/hotel")) {
        return jsonResponse({
          data: {
            hotelName: "Grand Detail Hotel",
            hotelDescription: "A detailed supplier description.",
            address: "12 Detail Street",
            city: "Paris",
            country: "France",
            location: { latitude: 48.8566, longitude: 2.3522 },
            starRating: 5,
            rating: 9.4,
            reviewCount: 1234,
            hotelImages: [
              { url: "https://example.com/lobby.jpg", caption: "Lobby", order: 2 },
              { url: "https://example.com/room.jpg", caption: "Room", order: 1 },
            ],
            checkinCheckoutTimes: { checkin: "15:00", checkout: "11:00" },
            hotelImportantInformation: ["Photo ID required", "No smoking"],
            facilities: [{ name: "Pool" }, { name: "Spa" }],
            cancellationPolicies: {
              refundableTag: "RFN",
              cancelPolicyInfos: [{ cancelTime: "2027-06-01T12:00:00Z", amount: 75, currency: "USD" }],
            },
          },
        });
      }
      if (url.includes("/data/reviews")) {
        return jsonResponse({
          data: [{
            name: "Ari", country: "CA", averageScore: 10, date: "2027-05-01",
            headline: "Excellent stay",
          }],
        });
      }
      return jsonResponse({ error: "not found" }, 404);
    });
    _setFetchForTesting(fetchMock as unknown as typeof fetch);

    const res = await request(app).get("/api/hotels/detail-fixture-001/detail");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      name: "Grand Detail Hotel",
      description: "A detailed supplier description.",
      address: "12 Detail Street",
      city: "Paris",
      country: "France",
      latitude: 48.8566,
      longitude: 2.3522,
      starRating: 5,
      rating: 9.4,
      reviewCount: 1234,
      checkinTime: "15:00",
      checkoutTime: "11:00",
      facilities: ["Pool", "Spa"],
      cancellation: {
        refundable: true,
        deadline: "2027-06-01T12:00:00Z",
        amount: 75,
        currency: "USD",
      },
    });
    expect(res.body.images.map((image: { url: string }) => image.url)).toEqual([
      "https://example.com/room.jpg",
      "https://example.com/lobby.jpg",
    ]);
    expect(res.body.importantInformation).toContain("Photo ID required");
    expect(res.body.reviews).toHaveLength(1);
    expect(fetchMock.mock.calls.every((call) => {
      const headers = (call[1] as RequestInit).headers as Record<string, string>;
      return headers["X-API-Key"] === "sand_test_key";
    })).toBe(true);
  });

  it("returns an empty safe detail shape when LiteAPI is not configured", async () => {
    const res = await request(app).get("/api/hotels/detail-fixture-no-key/detail");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ images: [], rooms: [], reviews: [] });
  });
});
