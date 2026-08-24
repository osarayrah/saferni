// Vercel's catch-all function keeps the API on the same origin as the web app.
// Load the API bundle dynamically so the wrapper works whether Vercel keeps
// this file as ESM or transforms it to CommonJS.
let appModulePromise;

export default async function handler(req, res) {
  try {
    const requestUrl = new URL(req.url || "/", "https://safferni.internal");
    const clerkPath = requestUrl.searchParams.get("__clerk_path");

    // Vercel's generated catch-all handles one API segment reliably, but
    // Clerk's Frontend API uses nested paths. vercel.json rewrites those
    // nested requests through /api/healthz and carries the original path here.
    if (clerkPath) {
      requestUrl.searchParams.delete("__clerk_path");
      const query = requestUrl.searchParams.toString();
      req.url = `/api/__clerk/${clerkPath.replace(/^\/+/, "")}${query ? `?${query}` : ""}`;
    }

    appModulePromise ??= import("../artifacts/api-server/dist/vercel.mjs");
    const { default: app } = await appModulePromise;
    return app(req, res);
  } catch (error) {
    console.error("Unable to initialize the Safferni API function.", error);
    res.status(500).json({
      error: "Unable to initialize the Safferni API.",
      type: error instanceof Error ? error.name : "UnknownError",
    });
  }
}