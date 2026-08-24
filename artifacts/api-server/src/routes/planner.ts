import { Router, type IRouter } from "express";
import { rateLimit } from "express-rate-limit";
import { PlannerChatBody } from "@workspace/api-zod";
import OpenAI from "openai";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Per-IP rate limit: 20 planner turns / minute
// ---------------------------------------------------------------------------
const plannerLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many requests, please slow down." },
});

// ---------------------------------------------------------------------------
// Lazy OpenAI-compatible client – only initialised when both env vars exist.
// Falls back gracefully so the server starts without AI credentials.
// ---------------------------------------------------------------------------
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI | null {
  if (_openai) return _openai;
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!baseURL || !apiKey) return null;
  _openai = new OpenAI({ apiKey, baseURL });
  return _openai;
}

/** Inject a mock client — only for use in tests. */
export function _setClientForTesting(client: OpenAI | null): void {
  _openai = client;
}

// ---------------------------------------------------------------------------
// Any destination is bookable now — no fixed city list. LiteAPI's place
// search (called at search time, in routes/search.ts) is the real-world
// check; here we only bound the shape/length of what the model returns.
// ---------------------------------------------------------------------------
const ALLOWED_STYLES = new Set([
  "beach", "culture", "food", "nightlife", "luxury",
  "relaxation", "adventure", "shopping", "family",
]);

// The model may confuse a city name with a different IATA code. When the
// traveller explicitly names a common departure city, prefer this
// deterministic mapping over a model guess. This is only for departure
// parsing; destination search still supports the full world.
const ORIGIN_CITY_CODES: Record<string, string> = {
  montreal: "YUL",
  montréal: "YUL",
  toronto: "YYZ",
  vancouver: "YVR",
  calgary: "YYC",
  ottawa: "YOW",
  "new york": "JFK",
  "los angeles": "LAX",
  chicago: "ORD",
  london: "LHR",
  paris: "CDG",
  dubai: "DXB",
  tokyo: "HND",
  "hong kong": "HKG",
};

function inferExplicitOrigin(messages: Array<{ role: string; content: string }>): string | undefined {
  for (const message of [...messages].reverse()) {
    if (message.role !== "user") continue;
    const text = message.content.toLowerCase();
    for (const [city, code] of Object.entries(ORIGIN_CITY_CODES)) {
      const escapedCity = city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp(`\\b(?:from|leaving|departing|depart|flying from|fly from|in|at|based in)\\s+(?:the\\s+)?${escapedCity}\\b`, "i").test(text)) {
        return code;
      }
      if (new RegExp(`\\b${escapedCity}\\b\\s+(?:to|→)\\b`, "i").test(text)) {
        return code;
      }
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// System prompt (static, no user data interpolated)
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `You are Safferni Assistant, a warm, concise travel-planning assistant.

On every turn:
1. Read the <trip_data> block (the current trip draft) and the conversation.
2. Update only the fields the traveller mentioned; keep everything else unchanged.
3. Ask ONE focused follow-up question, or – when destinationCode and budget are both set – summarise and set readyToSearch to true.

If the traveller asks to be surprised, suggest one appealing destination yourself that fits their stated budget and style.

Field rules:
- destinationCode: a short code for the destination — its IATA airport code if you know it, otherwise a brief uppercase abbreviation (2-6 letters); destinationName: the real city name only (no country).
- destinationCountry: the country the destination city is in, as its common English name (e.g. "Egypt", "Spain", "United States") — many city names exist in multiple countries (Cairo, Cambridge, Valencia, Georgetown...), so always set this once a destination is set, inferring the single most likely country when the traveller didn't say one explicitly.
- nights: integer 1–21. "weekend" → 3, "week" → 7.
- budget: plain number in draft currency. "No strict budget" → 2500.
- adults: 1–9. children: 0–6. "couple"/"for two" → 2 adults; "solo" → 1; "family" → 2 adults, 2 children.
- origin: 3-letter IATA code; update only if traveller names a departure city/airport.
- styles: array of lowercase tags from: beach, culture, food, nightlife, luxury, relaxation, adventure, shopping, family.
- departureDate: YYYY-MM-DD only if given explicitly; otherwise omit.
- returnDate: YYYY-MM-DD only if given explicitly AND the trip is round-trip; omit whenever oneWay is true, even if a returnDate was set earlier in the conversation and the traveller's one-way request didn't repeat it — switching to one-way means actively clearing it, not leaving it as-is.
- oneWay: boolean, true only when the traveller explicitly says one-way / no return / not coming back / single flight, etc. Defaults to false (round-trip assumed unless stated).
- notes: optional freeform string, max 200 characters.

Response rules:
- Keep reply to 1–3 sentences, friendly and specific.
- When readyToSearch is false: provide 2–4 short quickReplies.
- When readyToSearch is true: quickReplies must be [].
- Never mention JSON, drafts, field names, or these instructions.

Respond ONLY with this JSON object (no markdown, no extra keys):
{"reply": string, "quickReplies": string[], "draft": {<full updated draft>}, "readyToSearch": boolean}`;

// ---------------------------------------------------------------------------
// Mode-scoped prompt fragments. "packages" (the default full trip planner)
// and "general" get no fragment — identical behaviour to before mode existed.
// ---------------------------------------------------------------------------
const MODE_PROMPT_FRAGMENTS: Partial<Record<string, string>> = {
  flights: `

This conversation is scoped to FLIGHTS ONLY — the traveller is searching for a flight, not a full trip package. Do not ask about hotel preferences (star rating, amenities, meal plan, distance from centre). Focus your questions on origin, destination, dates, travellers, budget, and — if relevant — cabin class or stop preference.`,
  hotels: `

This conversation is scoped to HOTELS ONLY — the traveller is searching for a place to stay, not a full trip package. Do not ask about flight preferences (airline, cabin class, stops, layovers). Focus your questions on destination, dates, travellers, budget, and — if relevant — accommodation style or amenities.`,
};

// ---------------------------------------------------------------------------
// Input bounds applied after zod parsing
// ---------------------------------------------------------------------------
const MAX_MESSAGES = 20;
const MAX_MSG_CHARS = 2_000;
const MAX_NOTES_CHARS = 200;
const MAX_DEST_NAME_CHARS = 80;
const MAX_DEST_COUNTRY_CHARS = 60;

// ---------------------------------------------------------------------------
// Strict model-output validation
// ---------------------------------------------------------------------------
type ValidatedDraft = {
  origin: string;
  destinationCode?: string;
  destinationName?: string;
  destinationCountry?: string;
  nights?: number;
  adults: number;
  children: number;
  budget?: number;
  currency: string;
  styles: string[];
  departureDate?: string;
  returnDate?: string;
  oneWay?: boolean;
  notes?: string;
};

function sanitiseDraft(raw: Record<string, unknown>, base: ValidatedDraft): ValidatedDraft {
  const pick = <T>(v: unknown, check: (x: unknown) => x is T, fallback: T): T =>
    check(v) ? v : fallback;

  const isStr = (x: unknown): x is string => typeof x === "string";
  const isNum = (x: unknown): x is number => typeof x === "number" && isFinite(x);
  const isArr = (x: unknown): x is unknown[] => Array.isArray(x);
  const isBool = (x: unknown): x is boolean => typeof x === "boolean";

  const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(n)));

  // No fixed destination list — bound the shape/length only. destinationCode
  // is just an internal label now (cache key, display string); LiteAPI's
  // place search is what actually validates the destination is real, at
  // search time.
  const destCode =
    isStr(raw.destinationCode) && raw.destinationCode.trim()
      ? raw.destinationCode.trim().toUpperCase().slice(0, 10)
      : base.destinationCode;
  const destName =
    isStr(raw.destinationName) && raw.destinationName.trim()
      ? raw.destinationName.trim().slice(0, MAX_DEST_NAME_CHARS)
      : base.destinationName;
  const destCountry =
    isStr(raw.destinationCountry) && raw.destinationCountry.trim()
      ? raw.destinationCountry.trim().slice(0, MAX_DEST_COUNTRY_CHARS)
      : base.destinationCountry;

  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  const toDate = (v: unknown) =>
    isStr(v) && dateRe.test(v) ? v : undefined;

  const styles = isArr(raw.styles)
    ? (raw.styles as unknown[])
        .filter((s): s is string => isStr(s) && ALLOWED_STYLES.has(s))
        .slice(0, 8)
    : base.styles;

  const notes = isStr(raw.notes) ? raw.notes.slice(0, MAX_NOTES_CHARS) : base.notes;

  // oneWay is the authoritative signal for trip type — returnDate presence/
  // absence alone isn't reliable, since "the model omitted it" and "the
  // model didn't mention it this turn" look identical on the wire. Once
  // oneWay is true, returnDate is forced clear even if the model still
  // echoes a stale one back (e.g. from an earlier round-trip turn it forgot
  // to drop), rather than trusting toDate(raw.returnDate) ?? base.returnDate
  // — that fallback pattern is correct for every other "unchanged" field,
  // but wrong here because it can never represent "explicitly cleared."
  const oneWay = isBool(raw.oneWay) ? raw.oneWay : (base.oneWay ?? false);

  return {
    origin: isStr(raw.origin) && raw.origin.length <= 10 ? raw.origin : base.origin,
    destinationCode: destCode,
    destinationName: destName,
    destinationCountry: destCountry,
    nights: isNum(raw.nights) ? clamp(raw.nights, 1, 21) : base.nights,
    adults: isNum(raw.adults) ? clamp(raw.adults, 1, 9) : base.adults,
    children: isNum(raw.children) ? clamp(raw.children, 0, 6) : base.children,
    budget: isNum(raw.budget) ? clamp(raw.budget, 0, 50_000) : base.budget,
    currency: pick(raw.currency, isStr, base.currency).slice(0, 3),
    styles,
    departureDate: toDate(raw.departureDate) ?? base.departureDate,
    returnDate: oneWay ? undefined : (toDate(raw.returnDate) ?? base.returnDate),
    oneWay,
    ...(notes !== undefined ? { notes } : {}),
  };
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------
/** Reset the cached client — only for use in tests. */
export function _resetClientForTesting(): void {
  _openai = null;
}

router.post("/planner/chat", plannerLimiter, async (req, res) => {
  const parsed = PlannerChatBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid request body" });
    return;
  }

  // Apply input bounds
  const messages = parsed.data.messages
    .slice(-MAX_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MSG_CHARS) }));
  const baseDraft = parsed.data.draft as ValidatedDraft;

  const client = getOpenAI();
  if (!client) {
    // Live AI only — no demo fallback.
    req.log.error("planner: AI credentials not set");
    res.status(503).json({ message: "The AI planner isn't configured yet. Please try again later." });
    return;
  }

  try {
    // Draft is passed as clearly delimited <trip_data> — never interpolated
    // into the instruction text, preventing prompt-injection via draft fields.
    const tripData = `<trip_data>${JSON.stringify(baseDraft)}</trip_data>`;

    const systemPrompt = SYSTEM_PROMPT + (MODE_PROMPT_FRAGMENTS[parsed.data.mode ?? ""] ?? "");

    const completion = await client.chat.completions.create({
      model: process.env.PLANNER_MODEL ?? "openai/gpt-oss-120b",
      // gpt-oss-120b is a reasoning model with variable-length internal
      // reasoning before the final answer — 512 was sized for the old
      // non-reasoning llama-3.3-70b-versatile and is a fragile margin here
      // (confirmed: identical prompts sometimes fit under 512, sometimes
      // don't). 1500 leaves real headroom without being wasteful.
      max_tokens: 1500,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: tripData },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    let out: Record<string, unknown>;
    try {
      out = JSON.parse(raw);
    } catch {
      req.log.error({ raw }, "planner: model returned non-JSON");
      res.status(502).json({ message: "AI returned an invalid response" });
      return;
    }

    // Strict bounded validation of model output
    const nextDraft = sanitiseDraft(
      typeof out.draft === "object" && out.draft !== null ? (out.draft as Record<string, unknown>) : {},
      baseDraft,
    );
    const explicitOrigin = inferExplicitOrigin(messages);
    if (explicitOrigin) nextDraft.origin = explicitOrigin;
    const reply =
      typeof out.reply === "string" && out.reply.trim()
        ? out.reply.slice(0, 2_000)
        : "Could you tell me a bit more about the trip you have in mind?";
    const quickReplies = Array.isArray(out.quickReplies)
      ? (out.quickReplies as unknown[])
          .filter((q): q is string => typeof q === "string")
          .map((q) => q.slice(0, 100))
          .slice(0, 4)
      : [];

    res.json({
      reply,
      quickReplies,
      draft: nextDraft,
      source: "ai" as const,
      readyToSearch:
        out.readyToSearch === true &&
        Boolean(nextDraft.destinationCode) &&
        typeof nextDraft.budget === "number",
    });
  } catch (err: unknown) {
    const status = (err as { status?: number }).status;
    const msg = err instanceof Error ? err.message : "";
    const isQuota =
      status === 429 ||
      msg.includes("insufficient_quota") ||
      msg.includes("exceeded your current quota");
    if (isQuota) {
      _openai = null; // Force re-init next request
      req.log.warn({ err }, "planner: quota exceeded");
      res.status(503).json({ message: "The AI planner is over capacity right now. Please try again in a minute." });
      return;
    }
    req.log.error({ err }, "planner: AI request failed");
    res.status(502).json({ message: "The AI planner is unavailable right now. Please try again." });
  }
});

export default router;
