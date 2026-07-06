import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const outputPath = join(rootDir, "public", "version.js");
const now = new Date();
const version = now.toISOString().replace(/\.\d{3}Z$/, "Z");

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(
  outputPath,
  `window.GAME_RATING_BUILD = ${JSON.stringify({ version, builtAt: now.toISOString() })};\n`,
  "utf8"
);

console.log(`Wrote build version ${version}`);
