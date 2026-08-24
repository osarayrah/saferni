// Vercel's catch-all function keeps the API on the same origin as the web app.
// Load the API bundle dynamically so the wrapper works whether Vercel keeps
// this file as ESM or transforms it to CommonJS.
let appModulePromise;

export default async function handler(req, res) {
  try {
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