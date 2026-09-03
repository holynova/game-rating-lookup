import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const publicDir = join(rootDir, "public");
const defaultOutputDir = join(rootDir, "dist");

function resolveApiBase() {
  const apiBase = String(process.env.GAME_RATING_API_BASE || "")
    .trim()
    .replace(/\/+$/, "");

  if (apiBase && !/^https:\/\//i.test(apiBase)) {
    throw new Error("GAME_RATING_API_BASE must be an https URL");
  }

  return apiBase;
}

export async function buildStatic(outputDir = defaultOutputDir) {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  await cp(publicDir, outputDir, { recursive: true });

  const now = new Date();
  const apiBase = resolveApiBase();
  await writeFile(
    join(outputDir, "config.js"),
    `window.GAME_RATING_API_BASE = ${JSON.stringify(apiBase)};\n`,
    "utf8"
  );
  await writeFile(
    join(outputDir, "version.js"),
    `window.GAME_RATING_BUILD = ${JSON.stringify({
      version: now.toISOString().replace(/\.\d{3}Z$/, "Z"),
      builtAt: now.toISOString()
    })};\n`,
    "utf8"
  );

  const cacheBust = encodeURIComponent(process.env.GITHUB_SHA || "local");
  const assetPattern = /(styles\.css|config\.js|version\.js|app\.js)(?!\?)/g;
  const htmlPath = join(outputDir, "index.html");
  const html = await readFile(htmlPath, "utf8");
  await writeFile(htmlPath, html.replace(assetPattern, `$1?v=${cacheBust}`), "utf8");

  console.log(`Built ${relative(rootDir, outputDir)} from public/`);
  return outputDir;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildStatic();
}
