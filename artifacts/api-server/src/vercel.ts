// Serverless entrypoint: export the Express app without starting a long-lived
// listener. Vercel invokes the app directly for each /api/* request.
import "./lib/loadEnv";
import app from "./app";

export default app;