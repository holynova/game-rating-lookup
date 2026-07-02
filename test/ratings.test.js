import assert from "node:assert/strict";
import { test } from "node:test";
import { getRatings } from "../src/core/ratings.js";

test("getRatings combines Steam search, Steam reviews, and Heybox rating", async () => {
  const calls = [];
  const fetchJson = async (url) => {
    calls.push(String(url));

    if (url.hostname === "store.steampowered.com" && url.pathname === "/api/storesearch/") {
      return {
        items: [
          {
            id: 1145350,
            name: "Hades II"
          },
          {
            id: 1145360,
            name: "Hades"
          }
        ]
      };
    }

    if (url.hostname === "store.steampowered.com" && url.pathname === "/appreviews/1145360") {
      return {
        query_summary: {
          total_positive: 98,
          total_negative: 2,
          total_reviews: 100,
          review_score_desc: "Overwhelmingly Positive"
        }
      };
    }

    if (url.hostname === "api.xiaoheihe.cn" && url.pathname === "/game/search/") {
      return {
        result: {
          games: [
            {
              appid: 1145360,
              steam_appid: 1145360,
              name: "哈迪斯",
              score: "9.4",
              platforms: ["steam"],
              type: "game"
            }
          ]
        }
      };
    }

    throw new Error(`Unexpected URL: ${url}`);
  };

  const data = await getRatings("Hades", { fetchJson });

  assert.equal(data.matched.appid, 1145360);
  assert.equal(data.steam.score, 98);
  assert.equal(data.heybox.scoreText, "9.4");
  assert.equal(data.heybox.matchedBy, "appid");
  assert.deepEqual(data.errors, {
    steam: null,
    heybox: null
  });
  assert.equal(calls.length, 3);
});

test("getRatings preserves per-source errors without failing the whole lookup", async () => {
  const fetchJson = async (url) => {
    if (url.hostname === "store.steampowered.com" && url.pathname === "/api/storesearch/") {
      return {
        items: [
          {
            id: 1145360,
            name: "Hades"
          }
        ]
      };
    }

    if (url.hostname === "store.steampowered.com" && url.pathname === "/appreviews/1145360") {
      throw new Error("steam reviews failed");
    }

    if (url.hostname === "api.xiaoheihe.cn") {
      throw new Error("heybox failed");
    }

    throw new Error(`Unexpected URL: ${url}`);
  };

  const data = await getRatings("Hades", { fetchJson });

  assert.equal(data.matched.appid, 1145360);
  assert.equal(data.steam, null);
  assert.equal(data.heybox, null);
  assert.deepEqual(data.errors, {
    steam: "steam reviews failed",
    heybox: "heybox failed"
  });
});
