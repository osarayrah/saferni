// Vercel's catch-all function keeps the API on the same origin as the web app.
// Use a JavaScript wrapper so Vercel bundles the API source without applying
// its NodeNext TypeScript checker to the workspace's bundler-style imports.
import "../artifacts/api-server/src/lib/loadEnv.ts";
import app from "../artifacts/api-server/src/app.ts";

export default app;