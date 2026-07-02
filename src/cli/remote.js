const defaultApiBase = "https://game-rating-lookup-api.holynova.workers.dev";

export async function fetchRemoteRating(query, apiBase = process.env.GAMETIRE_API_BASE || defaultApiBase) {
  const base = String(apiBase || "").replace(/\/$/, "");
  const response = await fetch(`${base}/api/ratings?q=${encodeURIComponent(query)}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `remote API failed with ${response.status}`);
  }

  return data;
}
