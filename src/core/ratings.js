export function normalizeTitle(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[\u2122\u00ae\u00a9:：'"`\u2018\u2019\u201c\u201d()[\]{}.,，。!！?？\-_\s]/g, "")
    .replace(/demo|试玩版|试用版|ost|soundtrack|原声带/g, "");
}

export function scoreName(query, candidate) {
  const q = normalizeTitle(query);
  const c = normalizeTitle(candidate);
  if (!q || !c) return 0;
  if (q === c) return 100;
  if (c.includes(q) || q.includes(c)) return 80;

  const qChars = new Set([...q]);
  let overlap = 0;
  for (const char of c) {
    if (qChars.has(char)) overlap += 1;
  }
  return Math.round((overlap / Math.max(q.length, c.length)) * 70);
}

export function exactTitleBoost(query, candidate) {
  return normalizeTitle(query) === normalizeTitle(candidate) ? 45 : 0;
}

export function secondaryTitlePenalty(name) {
  const value = String(name || "").toLowerCase();
  const secondaryTerms = [
    "redmod",
    "bonus content",
    "soundtrack",
    "demo",
    "dlc",
    "ost"
  ];

  return secondaryTerms.some((term) => value.includes(term)) ? 55 : 0;
}

export async function fetchJson(url, headers = {}, options = {}) {
  const timeoutMs = Number(options.timeoutMs || 15000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 Game-Tier/1.0",
        accept: "application/json,text/plain,*/*",
        ...headers
      }
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`timeout from ${url.hostname}`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`${response.status} from ${url.hostname}`);
  }

  return response.json();
}

export async function searchSteam(query, options = {}) {
  const requestJson = options.fetchJson || fetchJson;
  const url = new URL("https://store.steampowered.com/api/storesearch/");
  url.searchParams.set("term", query);
  url.searchParams.set("l", "schinese");
  url.searchParams.set("cc", "cn");

  const data = await requestJson(url);
  const items = Array.isArray(data.items) ? data.items : [];
  const ranked = items
    .filter((item) => item?.id && item?.name)
    .map((item, index) => ({
      ...item,
      matchScore:
        scoreName(query, item.name) +
        exactTitleBoost(query, item.name) +
        Math.max(0, 90 - index * 20) -
        secondaryTitlePenalty(item.name)
    }))
    .sort((a, b) => b.matchScore - a.matchScore);

  return ranked[0] || null;
}

export async function getSteamReviews(appid, options = {}) {
  const requestJson = options.fetchJson || fetchJson;
  const url = new URL(`https://store.steampowered.com/appreviews/${appid}`);
  url.searchParams.set("json", "1");
  url.searchParams.set("language", "all");
  url.searchParams.set("purchase_type", "all");
  url.searchParams.set("num_per_page", "0");

  const data = await requestJson(url);
  const summary = data.query_summary || {};
  const positive = Number(summary.total_positive || 0);
  const negative = Number(summary.total_negative || 0);
  const total = Number(summary.total_reviews || positive + negative || 0);

  return {
    appid,
    label: summary.review_score_desc || "No user reviews",
    positive,
    negative,
    total,
    score: total > 0 ? Math.round((positive / Math.max(total, 1)) * 100) : null
  };
}

export async function searchHeybox(query, steamAppid, options = {}) {
  const requestJson = options.fetchJson || fetchJson;
  const url = new URL("https://api.xiaoheihe.cn/game/search/");
  url.searchParams.set("os_type", "web");
  url.searchParams.set("version", "999.0.0");
  url.searchParams.set("q", query);

  const data = await requestJson(url, {
    referer: "https://www.xiaoheihe.cn/"
  });

  const games = Array.isArray(data.result?.games) ? data.result.games : [];
  const ranked = games
    .filter((game) => game?.name && (game.score || game.score_desc))
    .map((game) => {
      const appid = Number(game.steam_appid || game.appid || 0);
      const exactAppid = steamAppid && appid === Number(steamAppid);
      const typeBoost = game.type === "game" ? 12 : 0;
      const platformBoost =
        Array.isArray(game.platforms) && game.platforms.includes("steam") ? 8 : 0;
      return {
        ...game,
        matchScore:
          (exactAppid ? 120 : 0) + scoreName(query, game.name) + typeBoost + platformBoost
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore);

  const match = ranked[0] || null;
  if (!match) return null;

  return {
    appid: match.appid || null,
    steamAppid: match.steam_appid || null,
    name: match.name,
    score: match.score || null,
    scoreText: match.score || match.score_desc || null,
    ratingCount: null,
    matchedBy: Number(match.steam_appid || match.appid || 0) === Number(steamAppid) ? "appid" : "name"
  };
}

export async function getRatings(query, options = {}) {
  const steamApp = await searchSteam(query, options);
  const appid = steamApp?.id || null;

  const [steamReviews, heybox] = await Promise.allSettled([
    appid ? getSteamReviews(appid, options) : Promise.resolve(null),
    searchHeybox(query, appid, options)
  ]);

  return {
    query,
    matched: steamApp
      ? {
          appid,
          name: steamApp.name,
          matchScore: steamApp.matchScore
        }
      : null,
    steam: steamReviews.status === "fulfilled" ? steamReviews.value : null,
    heybox: heybox.status === "fulfilled" ? heybox.value : null,
    errors: {
      steam: steamReviews.status === "rejected" ? steamReviews.reason.message : null,
      heybox: heybox.status === "rejected" ? heybox.reason.message : null
    },
    fetchedAt: new Date().toISOString()
  };
}
