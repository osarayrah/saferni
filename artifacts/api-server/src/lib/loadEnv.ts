/**
 * Minimal .env loader (no dotenv dependency): populates process.env from the
 * package-root .env file when present. Hosted environments inject real env
 * vars directly, so this only matters for local development — values already
 * present in the environment always win over .env values.
 *
 * Imported for its side effect as the FIRST import of the server entry point
 * so env vars exist before any module (e.g. @workspace/db) reads them.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
// The .env sits at the package root: one level up from dist/ (bundled build)
// and two levels up from src/lib/ (direct TS execution).
for (const candidate of [resolve(here, "../.env"), resolve(here, "../../.env")]) {
  let text: string;
  try {
    text = readFileSync(candidate, "utf8");
  } catch {
    continue; // no .env at this location
  }
  for (const line of text.split("\n")) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m) continue; // blank lines and # comments don't match
    const [, key, rawValue] = m;
    if (process.env[key] !== undefined) continue; // real env always wins
    process.env[key] = rawValue.replace(/^(['"])(.*)\1$/, "$2");
  }
  break;
}
