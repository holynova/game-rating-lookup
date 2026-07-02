import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, test } from "node:test";
import {
  clearCache,
  findCachedResult,
  readResultHistory,
  saveResult
} from "../src/cli/cache.js";

const tempDirs = [];

async function tempCachePath() {
  const dir = await mkdtemp(join(tmpdir(), "game-tier-cache-test-"));
  tempDirs.push(dir);
  return join(dir, "results.json");
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

test("readResultHistory returns an empty array for a missing cache file", async () => {
  const filePath = await tempCachePath();
  assert.deepEqual(await readResultHistory(filePath), []);
});

test("saveResult writes newest result first and replaces matching queries case-insensitively", async () => {
  const filePath = await tempCachePath();

  await saveResult("Hades", { query: "Hades", steam: { score: 98 } }, filePath);
  await saveResult("hades", { query: "hades", steam: { score: 99 } }, filePath);
  await saveResult("Celeste", { query: "Celeste", steam: { score: 97 } }, filePath);

  const history = await readResultHistory(filePath);
  assert.equal(history.length, 2);
  assert.equal(history[0].query, "Celeste");
  assert.equal(history[1].query, "hades");
  assert.equal(history[1].data.steam.score, 99);
});

test("findCachedResult matches normalized queries", async () => {
  const filePath = await tempCachePath();
  await saveResult("Hades", { query: "Hades" }, filePath);

  const cached = await findCachedResult(" hades ", filePath);
  assert.equal(cached.query, "Hades");
});

test("clearCache removes the cache file", async () => {
  const filePath = await tempCachePath();
  await saveResult("Hades", { query: "Hades" }, filePath);

  await clearCache(filePath);
  assert.deepEqual(await readResultHistory(filePath), []);
});
