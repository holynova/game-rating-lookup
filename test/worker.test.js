import assert from "node:assert/strict";
import { test } from "node:test";
import worker from "../worker.js";

test("worker health endpoint exposes a health response", async () => {
  const response = await worker.fetch(new Request("https://api.example.test/healthz"));

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    service: "game-rating-lookup",
    endpoint: "/api/ratings?q=<game-name>"
  });
});

test("worker root serves the static asset binding", async () => {
  const response = await worker.fetch(
    new Request("https://api.example.test/"),
    {
      ASSETS: {
        fetch: async (request) => new Response(`static:${new URL(request.url).pathname}`)
      }
    }
  );

  assert.equal(response.status, 200);
  assert.equal(await response.text(), "static:/");
});

test("worker returns CORS preflight response", async () => {
  const response = await worker.fetch(
    new Request("https://api.example.test/api/ratings", {
      method: "OPTIONS",
      headers: { Origin: "https://holynova.github.io" }
    })
  );

  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), "*");
});

test("worker rejects unsupported methods and unknown routes", async () => {
  const methodResponse = await worker.fetch(
    new Request("https://api.example.test/api/ratings?q=Hades", { method: "POST" })
  );
  assert.equal(methodResponse.status, 405);
  assert.equal(methodResponse.headers.get("allow"), "GET, OPTIONS");

  const routeResponse = await worker.fetch(
    new Request("https://api.example.test/not-found"),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }
  );
  assert.equal(routeResponse.status, 404);

  const apiRouteResponse = await worker.fetch(new Request("https://api.example.test/api/unknown"));
  assert.equal(apiRouteResponse.status, 404);
  assert.deepEqual(await apiRouteResponse.json(), { error: "Not found" });
});

test("worker validates rating query length", async () => {
  const response = await worker.fetch(new Request("https://api.example.test/api/ratings?q=x"));

  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /至少两个字符/);
});
