import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const publicDir = join(__dirname, "public");
const port = Number(process.env.PORT || 5177);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

function sendJson(res, status, body) {
  res.writeHead(status, jsonHeaders);
  res.end(JSON.stringify(body));
}

function normalizeTitle(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[™®©:："'’‘“”()[\]{}.,，。!！?？\-_\s]/g, "")
    .replace(/demo|试玩版|试用版|ost|soundtrack|原声带/g, "");
}

function scoreName(query, candidate) {
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

function exactTitleBoost(query, candidate) {
  return normalizeTitle(query) === normalizeTitle(candidate) ? 45 : 0;
}

function secondaryTitlePenalty(name) {
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

async function fetchJson(url, headers = {}) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 GameRatingLookup/1.0",
      accept: "application/json,text/plain,*/*",
      ...headers
    }
  });

  if (!response.ok) {
    throw new Error(`${response.status} from ${url.hostname}`);
  }

  return response.json();
}

async function searchSteam(query) {
  const url = new URL("https://store.steampowered.com/api/storesearch/");
  url.searchParams.set("term", query);
  url.searchParams.set("l", "schinese");
  url.searchParams.set("cc", "cn");

  const data = await fetchJson(url);
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

async function getSteamReviews(appid) {
  const url = new URL(`https://store.steampowered.com/appreviews/${appid}`);
  url.searchParams.set("json", "1");
  url.searchParams.set("language", "all");
  url.searchParams.set("purchase_type", "all");
  url.searchParams.set("num_per_page", "0");

  const data = await fetchJson(url);
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

async function searchHeybox(query, steamAppid) {
  const url = new URL("https://api.xiaoheihe.cn/game/search/");
  url.searchParams.set("os_type", "web");
  url.searchParams.set("version", "999.0.0");
  url.searchParams.set("q", query);

  const data = await fetchJson(url, {
    referer: "https://www.xiaoheihe.cn/"
  });

  const games = Array.isArray(data.result?.games) ? data.result.games : [];
  const ranked = games
    .filter((game) => game?.name && (game.score || game.score_desc))
    .map((game) => {
      const appid = Number(game.steam_appid || game.appid || 0);
      const exactAppid = steamAppid && appid === Number(steamAppid);
      const typeBoost = game.type === "game" ? 12 : 0;
      const platformBoost = Array.isArray(game.platforms) && game.platforms.includes("steam") ? 8 : 0;
      return {
        ...game,
        matchScore: (exactAppid ? 120 : 0) + scoreName(query, game.name) + typeBoost + platformBoost
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

async function getRatings(query) {
  const steamApp = await searchSteam(query);
  const appid = steamApp?.id || null;

  const [steamReviews, heybox] = await Promise.allSettled([
    appid ? getSteamReviews(appid) : Promise.resolve(null),
    searchHeybox(query, appid)
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

async function serveStatic(req, res) {
  const requested = new URL(req.url, `http://${req.headers.host}`).pathname;
  const cleanPath = requested === "/" ? "/index.html" : decodeURIComponent(requested);
  const filePath = normalize(join(publicDir, cleanPath));

  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const file = await readFile(filePath);
    res.writeHead(200, {
      "content-type": mimeTypes[extname(filePath)] || "application/octet-stream"
    });
    res.end(file);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/api/ratings") {
    const query = String(url.searchParams.get("q") || "").trim();
    if (query.length < 2) {
      sendJson(res, 400, { error: "请输入至少两个字符的游戏名称。" });
      return;
    }

    try {
      sendJson(res, 200, await getRatings(query));
    } catch (error) {
      sendJson(res, 500, { error: error.message || "查询失败。" });
    }
    return;
  }

  await serveStatic(req, res);
});

server.listen(port, () => {
  console.log(`Game Rating Lookup running at http://localhost:${port}`);
});
