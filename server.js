import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { getRatings } from "./src/core/ratings.js";
import { fetchJsonWithCurlFallback } from "./src/cli/fetch.js";
import { fetchRemoteRating } from "./src/cli/remote.js";

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

async function getRatingsForLocalDev(query) {
  try {
    return await getRatings(query, {
      fetchJson: fetchJsonWithCurlFallback
    });
  } catch {
    return fetchRemoteRating(query);
  }
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
      sendJson(res, 200, await getRatingsForLocalDev(query));
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
