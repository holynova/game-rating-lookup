import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { fetchRemoteRating } from "../src/cli/remote.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("fetchRemoteRating calls a compatible remote API", async () => {
  let requestedUrl = "";
  globalThis.fetch = async (url) => {
    requestedUrl = url;
    return {
      ok: true,
      async json() {
        return {
          query: "Hades",
          matched: {
            appid: 1145360
          }
        };
      }
    };
  };

  const data = await fetchRemoteRating("Hades", "https://example.test/api-root/");

  assert.equal(
    requestedUrl,
    "https://example.test/api-root/api/ratings?q=Hades"
  );
  assert.equal(data.matched.appid, 1145360);
});

test("fetchRemoteRating throws the remote error message for non-2xx responses", async () => {
  globalThis.fetch = async () => ({
    ok: false,
    status: 500,
    async json() {
      return {
        error: "remote exploded"
      };
    }
  });

  await assert.rejects(() => fetchRemoteRating("Hades", "https://example.test"), /remote exploded/);
});
