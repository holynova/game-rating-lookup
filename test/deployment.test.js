import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const deployedWorker = "game-rating-lookup";
const deployedApiBase = `https://${deployedWorker}.holynova.workers.dev`;

test("deployment config points all clients at the deployed Worker", async () => {
  const [wranglerConfig, webConfig, configWriter, cliRemote, pagesWorkflow, assetWriter] = await Promise.all([
    readFile("wrangler.toml", "utf8"),
    readFile("public/config.js", "utf8"),
    readFile("scripts/write-web-config.js", "utf8"),
    readFile("src/cli/remote.js", "utf8"),
    readFile(".github/workflows/pages.yml", "utf8"),
    readFile("scripts/write-web-assets.js", "utf8")
  ]);

  assert.match(wranglerConfig, new RegExp(`^name = "${deployedWorker}"$`, "m"));
  assert.match(webConfig, new RegExp(`window\\.GAME_RATING_API_BASE = "${deployedApiBase}"`));
  assert.match(configWriter, new RegExp(`const defaultApiBase = "${deployedApiBase}"`));
  assert.match(cliRemote, new RegExp(`const defaultApiBase = "${deployedApiBase}"`));
  assert.match(pagesWorkflow, /write-web-assets\.js/);
  assert.match(assetWriter, /GITHUB_SHA/);
});
