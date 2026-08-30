import { fetchJsonWithCurl } from "./fetch.js";

const defaultApiBase = "https://game-rating-lookup.holynova.workers.dev";

export async function fetchRemoteRating(query, apiBase = process.env.GAME_TIER_API_BASE || defaultApiBase) {
  const base = String(apiBase || "").replace(/\/$/, "");
  const url = `${base}/api/ratings?q=${encodeURIComponent(query)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  let response;
  try {
    response = await fetch(url, { signal: controller.signal });
  } catch {
    const data = await fetchJsonWithCurl(new URL(url), {}, { timeoutMs: 15000 });
    if (data?.error) throw new Error(data.error);
    return data;
  } finally {
    clearTimeout(timeout);
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `remote API failed with ${response.status}`);
  }

  return data;
}
