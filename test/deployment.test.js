import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const deployedWorker = "game-rating-lookup";
const deployedApiBase = `https://${deployedWorker}.xiaosang.cc`;

test("deployment config points all clients at the deployed Worker", async () => {
  const [wranglerConfig, webConfig, configWriter, cliRemote, pagesWorkflow, workerWorkflow, assetWriter] = await Promise.all([
    readFile("wrangler.toml", "utf8"),
    readFile("public/config.js", "utf8"),
    readFile("scripts/write-web-config.js", "utf8"),
    readFile("src/cli/remote.js", "utf8"),
    readFile(".github/workflows/pages.yml", "utf8"),
    readFile(".github/workflows/worker.yml", "utf8"),
    readFile("scripts/write-web-assets.js", "utf8")
  ]);

  assert.match(wranglerConfig, new RegExp(`^name = "${deployedWorker}"$`, "m"));
  assert.match(wranglerConfig, /directory = "\.\/dist"/);
  assert.match(wranglerConfig, /binding = "ASSETS"/);
  assert.match(webConfig, new RegExp(`window\\.GAME_RATING_API_BASE = "${deployedApiBase}"`));
  assert.match(configWriter, new RegExp(`const defaultApiBase = "${deployedApiBase}"`));
  assert.match(cliRemote, new RegExp(`const defaultApiBase = "${deployedApiBase}"`));
  assert.match(pagesWorkflow, /pnpm run build:pages/);
  assert.match(pagesWorkflow, /path: \.pages-dist/);
  assert.match(workerWorkflow, /pnpm run build/);
  assert.match(workerWorkflow, /game-rating-lookup\.xiaosang\.cc\/healthz/);
  assert.match(assetWriter, /GITHUB_SHA/);
});
