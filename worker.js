import { getRatings } from "./src/core/ratings.js";

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400"
};

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  ...corsHeaders
};

const serviceInfo = {
  ok: true,
  service: "game-rating-lookup",
  endpoint: "/api/ratings?q=<game-name>"
};

function sendJson(status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...jsonHeaders,
      ...headers
    }
  });
}

function methodNotAllowed() {
  return sendJson(405, { error: "Method not allowed" }, { allow: "GET, OPTIONS" });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    const url = new URL(request.url);

    if (url.pathname === "/healthz") {
      if (request.method !== "GET") return methodNotAllowed();
      return sendJson(200, serviceInfo);
    }

    if (url.pathname === "/api/ratings") {
      if (request.method !== "GET") return methodNotAllowed();

      const query = String(url.searchParams.get("q") || "").trim();
      if (query.length < 2) {
        return sendJson(400, { error: "请输入至少两个字符的游戏名称。" });
      }

      try {
        return sendJson(200, await getRatings(query));
      } catch (error) {
        return sendJson(500, { error: error.message || "查询失败。" });
      }
    }

    if (url.pathname.startsWith("/api/")) {
      return sendJson(404, { error: "Not found" });
    }

    if (request.method !== "GET" && request.method !== "HEAD") return methodNotAllowed();
    if (!env?.ASSETS?.fetch) {
      return sendJson(503, { error: "Static assets binding unavailable" });
    }

    return env.ASSETS.fetch(request);
  }
};
