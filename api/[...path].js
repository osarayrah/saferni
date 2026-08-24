// Vercel's catch-all function keeps the API on the same origin as the web app.
// Import the API's esbuild output so Vercel does not re-typecheck its
// bundler-style TypeScript source with NodeNext module rules.
import app from "../artifacts/api-server/dist/vercel.mjs";

export default app;