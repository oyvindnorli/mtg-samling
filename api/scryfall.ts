// Vercel serverless function - proxy for Scryfall API
// This avoids CORS issues since server-side requests don't have CORS restrictions

import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Get the path from query parameter
  const { path } = req.query;

  if (!path || typeof path !== "string") {
    return res.status(400).json({ error: "Missing path parameter" });
  }

  // Build the Scryfall URL
  const scryfallUrl = `https://api.scryfall.com${path.startsWith("/") ? path : "/" + path}`;

  try {
    const fetchOptions: RequestInit = {
      method: req.method || "GET",
      headers: {
        "Accept": "application/json",
        "User-Agent": "MTGSamling/1.0 (mtgcoll.com)",
      },
    };

    // Forward body for POST requests
    if (req.method === "POST" && req.body) {
      (fetchOptions.headers as Record<string, string>)["Content-Type"] = "application/json";
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(scryfallUrl, fetchOptions);

    // Forward the response status and headers
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");

    // Handle rate limiting
    if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After");
      if (retryAfter) {
        res.setHeader("Retry-After", retryAfter);
      }
    }

    const data = await response.json();
    return res.status(response.status).json(data);

  } catch (error) {
    console.error("Scryfall proxy error:", error);
    return res.status(500).json({
      error: "Failed to fetch from Scryfall",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
}
