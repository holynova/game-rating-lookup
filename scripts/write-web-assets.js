import { readFile, writeFile } from "node:fs/promises";

const cacheBust = encodeURIComponent(process.env.GITHUB_SHA || "local");
const assetPattern = /(styles\.css|config\.js|version\.js|app\.js)(?!\?)/g;
const html = await readFile("public/index.html", "utf8");
const versionedHtml = html.replace(assetPattern, `$1?v=${cacheBust}`);

await writeFile("public/index.html", versionedHtml, "utf8");
