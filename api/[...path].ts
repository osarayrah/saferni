// Vercel's catch-all function keeps the API on the same origin as the web app.
// That is important for Clerk's session cookies and for the generated client,
// which addresses every endpoint under /api.
import "../artifacts/api-server/src/lib/loadEnv";
import app from "../artifacts/api-server/src/app";

export default app;
