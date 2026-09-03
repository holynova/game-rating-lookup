import { cp, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildStatic } from "./build-static.mjs";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const pagesDir = join(rootDir, ".pages-dist");
const pagesApiBase = "https://game-rating-lookup.holynova.workers.dev";

if (!String(process.env.GAME_RATING_API_BASE || "").trim()) {
  process.env.GAME_RATING_API_BASE = pagesApiBase;
}

await buildStatic();
await rm(pagesDir, { recursive: true, force: true });
await mkdir(join(pagesDir, "public"), { recursive: true });
await cp(join(rootDir, "index.html"), join(pagesDir, "index.html"));
await cp(join(rootDir, "dist"), join(pagesDir, "public"), { recursive: true });
await cp(join(rootDir, ".nojekyll"), join(pagesDir, ".nojekyll"));

console.log("Built .pages-dist/ with the original root redirect and public/ path");
