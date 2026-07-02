import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { normalizeQuery } from "../core/format.js";

export const cachePath = join(
  process.env.XDG_CACHE_HOME || join(homedir(), ".cache"),
  "gametire",
  "results.json"
);

export async function readResultHistory(filePath = cachePath) {
  try {
    const value = JSON.parse(await readFile(filePath, "utf8"));
    return Array.isArray(value) ? value.filter((item) => item?.query && item?.data) : [];
  } catch (error) {
    if (error.code === "ENOENT") return [];
    return [];
  }
}

export async function writeResultHistory(items, filePath = cachePath) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(items, null, 2)}\n`);
}

export async function findCachedResult(query, filePath = cachePath) {
  const normalized = normalizeQuery(query);
  const history = await readResultHistory(filePath);
  return history.find((item) => normalizeQuery(item.query) === normalized) || null;
}

export async function saveResult(query, data, filePath = cachePath) {
  const cleanQuery = query.trim();
  if (!cleanQuery || !data) return;

  const normalized = normalizeQuery(cleanQuery);
  const current = (await readResultHistory(filePath)).filter(
    (item) => normalizeQuery(item.query) !== normalized
  );
  await writeResultHistory(
    [
      {
        query: cleanQuery,
        data,
        updatedAt: new Date().toISOString()
      },
      ...current
    ],
    filePath
  );
}

export async function clearCache(filePath = cachePath) {
  await rm(filePath, { force: true });
}
