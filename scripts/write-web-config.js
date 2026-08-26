import { writeFile } from "node:fs/promises";

const defaultApiBase = "https://game-rating-lookup-api.holynova.workers.dev";
const apiBase = String(process.env.GAME_RATING_API_BASE || defaultApiBase)
  .trim()
  .replace(/\/+$/, "");

if (!/^https:\/\//i.test(apiBase)) {
  throw new Error("GAME_RATING_API_BASE must be an https URL");
}

await writeFile(
  "public/config.js",
  `window.GAME_RATING_API_BASE = ${JSON.stringify(apiBase)};\n`,
  "utf8"
);
