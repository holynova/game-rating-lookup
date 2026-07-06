import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bestGrade,
  gradeFromScore,
  parseQueries
} from "../src/core/format.js";
import {
  exactTitleBoost,
  normalizeTitle,
  scoreName,
  secondaryTitlePenalty
} from "../src/core/ratings.js";

test("parseQueries splits, trims, and deduplicates input without a default limit", () => {
  const input = "Hades, Hades，赛博朋克2077\n艾尔登法环; a";
  assert.deepEqual(parseQueries(input), ["Hades", "赛博朋克2077", "艾尔登法环"]);

  const many = Array.from({ length: 15 }, (_, index) => `game-${index}`).join(",");
  assert.equal(parseQueries(many).length, 15);
  assert.equal(parseQueries(many, 3).length, 3);
});

test("normalizeTitle removes punctuation and secondary labels", () => {
  assert.equal(normalizeTitle("Hades (Original Soundtrack)"), "hadesoriginal");
  assert.equal(normalizeTitle("赛博朋克 2077：试玩版"), "赛博朋克2077");
});

test("scoreName ranks exact and partial title matches", () => {
  assert.equal(scoreName("Hades", "Hades"), 100);
  assert.equal(scoreName("Hades", "Hades II"), 80);
  assert.ok(scoreName("Hades", "Halo") < 80);
});

test("title scoring helpers boost exact matches and penalize secondary content", () => {
  assert.equal(exactTitleBoost("Hades", "Hades"), 45);
  assert.equal(exactTitleBoost("Hades", "Hades II"), 0);
  assert.equal(secondaryTitlePenalty("Hades Soundtrack"), 55);
  assert.equal(secondaryTitlePenalty("Hades"), 0);
});

test("gradeFromScore maps score thresholds", () => {
  assert.equal(gradeFromScore(null), "white");
  assert.equal(gradeFromScore(59), "white");
  assert.equal(gradeFromScore(60), "green");
  assert.equal(gradeFromScore(75), "blue");
  assert.equal(gradeFromScore(85, 49), "blue");
  assert.equal(gradeFromScore(85, 50), "purple");
  assert.equal(gradeFromScore(95, 499), "purple");
  assert.equal(gradeFromScore(95, 500), "gold");
});

test("bestGrade uses Steam score with review-count gates", () => {
  assert.equal(
    bestGrade({
      steam: { score: 100, total: 15 },
      heybox: { score: "9.6", ratingCount: 12000 }
    }),
    "blue"
  );
  assert.equal(
    bestGrade({
      steam: { score: 98, total: 305000 }
    }),
    "gold"
  );
});
