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

function sendJson(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders
  });
}

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    const url = new URL(request.url);
    if (url.pathname !== "/api/ratings") {
      return sendJson(404, { error: "Not found" });
    }

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
};
