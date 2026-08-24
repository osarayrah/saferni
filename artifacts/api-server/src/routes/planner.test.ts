import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import app from "../app";
import { _resetClientForTesting, _setClientForTesting } from "./planner";

// ---------------------------------------------------------------------------
// Build a lightweight fake OpenAI client — no module mocking needed
// ---------------------------------------------------------------------------
function makeClient(createFn: ReturnType<typeof vi.fn>) {
  return {
    chat: { completions: { create: createFn } },
  } as unknown as import("openai").default;
}

const VALID_BODY = {
  messages: [{ role: "user", content: "I want to go to Paris for a week with a $2000 budget" }],
  draft: { origin: "YUL", adults: 2, children: 0, currency: "USD", styles: [] },
};

const GOOD_RESPONSE = JSON.stringify({
  reply: "Heading to Paris for 7 nights — shall I find your options?",
  quickReplies: [],
  draft: {
    origin: "YUL", destinationCode: "CDG", destinationName: "Paris",
    nights: 7, adults: 2, children: 0, budget: 2000, currency: "USD", styles: [],
  },
  readyToSearch: true,
});

beforeEach(() => {
  // Start every test with no cached client and no AI credentials
  _resetClientForTesting();
  delete process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  delete process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
});

describe("POST /api/planner/chat", () => {
  it("rejects a request with missing required draft fields with 400", async () => {
    const res = await request(app)
      .post("/api/planner/chat")
      .send({ messages: [], draft: {} });
    expect(res.status).toBe(400);
  });

  it("returns 503 when AI credentials are not configured (live AI only)", async () => {
    // No env vars and no injected client → explicit error, never demo data.
    const res = await request(app).post("/api/planner/chat").send(VALID_BODY);
    expect(res.status).toBe(503);
    expect(typeof res.body.message).toBe("string");
  });

  it("calls the AI and returns a validated response", async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: GOOD_RESPONSE } }],
    });
    _setClientForTesting(makeClient(mockCreate));

    const res = await request(app).post("/api/planner/chat").send(VALID_BODY);

    expect(res.status).toBe(200);
    expect(res.body.reply).toContain("Paris");
    expect(res.body.draft.destinationCode).toBe("CDG");
    expect(res.body.draft.nights).toBe(7);
    expect(res.body.draft.budget).toBe(2000);
    expect(res.body.readyToSearch).toBe(true);
    expect(mockCreate).toHaveBeenCalledOnce();
  });

  it("returns 502 when the model returns non-JSON", async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: "not valid json" } }],
    });
    _setClientForTesting(makeClient(mockCreate));

    const res = await request(app).post("/api/planner/chat").send(VALID_BODY);
    expect(res.status).toBe(502);
    expect(typeof res.body.message).toBe("string");
  });

  it("returns 503 when the model returns a 429 quota error (live AI only)", async () => {
    const err = Object.assign(new Error("insufficient_quota"), { status: 429 });
    const mockCreate = vi.fn().mockRejectedValue(err);
    _setClientForTesting(makeClient(mockCreate));

    const res = await request(app).post("/api/planner/chat").send(VALID_BODY);
    expect(res.status).toBe(503);
    expect(typeof res.body.message).toBe("string");
  });

  it("accepts an arbitrary destination not on any fixed list, and still rejects a disallowed style", async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            reply: "Sure!",
            quickReplies: [],
            draft: {
              origin: "YUL", destinationCode: "TYO", destinationName: "Tokyo",
              nights: 5, adults: 2, children: 0, budget: 2000, currency: "USD",
              styles: ["injection_attack"],
            },
            readyToSearch: true,
          }),
        },
      }],
    });
    _setClientForTesting(makeClient(mockCreate));

    const res = await request(app).post("/api/planner/chat").send(VALID_BODY);
    expect(res.status).toBe(200);
    // No fixed destination whitelist anymore — LiteAPI's place search (at
    // search time) is the real-world check, not this route.
    expect(res.body.draft.destinationCode).toBe("TYO");
    expect(res.body.draft.destinationName).toBe("Tokyo");
    expect(res.body.readyToSearch).toBe(true);
    // Style validation is unrelated and unchanged — still bounded to the known tag set.
    expect(res.body.draft.styles).not.toContain("injection_attack");
  });

  it("truncates an overlong destination name from AI output", async () => {
    const longName = "A".repeat(200);
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            reply: "Sure!",
            quickReplies: [],
            draft: {
              origin: "YUL", destinationCode: "AAA", destinationName: longName,
              nights: 5, adults: 2, children: 0, budget: 2000, currency: "USD", styles: [],
            },
            readyToSearch: true,
          }),
        },
      }],
    });
    _setClientForTesting(makeClient(mockCreate));

    const res = await request(app).post("/api/planner/chat").send(VALID_BODY);
    expect(res.status).toBe(200);
    expect(res.body.draft.destinationName.length).toBe(80);
  });

  it("captures the AI's best-guess destinationCountry, needed to disambiguate same-named cities later at search time", async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            reply: "Cairo, Egypt it is!",
            quickReplies: [],
            draft: {
              origin: "YUL", destinationCode: "CAI", destinationName: "Cairo", destinationCountry: "Egypt",
              nights: 5, adults: 2, children: 0, budget: 2000, currency: "USD", styles: [],
            },
            readyToSearch: true,
          }),
        },
      }],
    });
    _setClientForTesting(makeClient(mockCreate));

    const res = await request(app).post("/api/planner/chat").send(VALID_BODY);
    expect(res.status).toBe(200);
    expect(res.body.draft.destinationName).toBe("Cairo");
    expect(res.body.draft.destinationCountry).toBe("Egypt");
  });

  it("truncates an overlong destinationCountry from AI output", async () => {
    const longCountry = "B".repeat(200);
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            reply: "Sure!",
            quickReplies: [],
            draft: {
              origin: "YUL", destinationCode: "AAA", destinationName: "Somewhere", destinationCountry: longCountry,
              nights: 5, adults: 2, children: 0, budget: 2000, currency: "USD", styles: [],
            },
            readyToSearch: true,
          }),
        },
      }],
    });
    _setClientForTesting(makeClient(mockCreate));

    const res = await request(app).post("/api/planner/chat").send(VALID_BODY);
    expect(res.status).toBe(200);
    expect(res.body.draft.destinationCountry.length).toBe(60);
  });

  it("scopes the system prompt to flights-only questions when mode is 'flights'", async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: GOOD_RESPONSE } }],
    });
    _setClientForTesting(makeClient(mockCreate));

    const res = await request(app)
      .post("/api/planner/chat")
      .send({ ...VALID_BODY, mode: "flights" });
    expect(res.status).toBe(200);
    const systemMessage = mockCreate.mock.calls[0][0].messages[0];
    expect(systemMessage.role).toBe("system");
    expect(systemMessage.content).toContain("FLIGHTS ONLY");
    expect(systemMessage.content).not.toContain("HOTELS ONLY");
  });

  it("scopes the system prompt to hotels-only questions when mode is 'hotels'", async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: GOOD_RESPONSE } }],
    });
    _setClientForTesting(makeClient(mockCreate));

    const res = await request(app)
      .post("/api/planner/chat")
      .send({ ...VALID_BODY, mode: "hotels" });
    expect(res.status).toBe(200);
    const systemMessage = mockCreate.mock.calls[0][0].messages[0];
    expect(systemMessage.content).toContain("HOTELS ONLY");
    expect(systemMessage.content).not.toContain("FLIGHTS ONLY");
  });

  it.each(["packages", "general", undefined])(
    "leaves the system prompt unchanged for mode=%s (identical to the default full planner)",
    async (mode) => {
      const mockCreate = vi.fn().mockResolvedValue({
        choices: [{ message: { content: GOOD_RESPONSE } }],
      });
      _setClientForTesting(makeClient(mockCreate));

      const res = await request(app)
        .post("/api/planner/chat")
        .send(mode ? { ...VALID_BODY, mode } : VALID_BODY);
      expect(res.status).toBe(200);
      const systemMessage = mockCreate.mock.calls[0][0].messages[0];
      expect(systemMessage.content).not.toContain("FLIGHTS ONLY");
      expect(systemMessage.content).not.toContain("HOTELS ONLY");
    },
  );

  // Rate-limit test runs last — fires 20 requests to exhaust the per-IP window
  it("rejects the 21st request within one minute with 429", async () => {
    for (let i = 0; i < 20; i++) {
      await request(app).post("/api/planner/chat").send(VALID_BODY);
    }
    const res = await request(app).post("/api/planner/chat").send(VALID_BODY);
    expect(res.status).toBe(429);
  });
});
