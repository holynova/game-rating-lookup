import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fetchJson } from "../core/ratings.js";

const execFileAsync = promisify(execFile);

export async function fetchJsonWithCurlFallback(url, headers = {}, options = {}) {
  try {
    return await fetchJson(url, headers, options);
  } catch (fetchError) {
    try {
      return await fetchJsonWithCurl(url, headers, options);
    } catch {
      throw fetchError;
    }
  }
}

async function fetchJsonWithCurl(url, headers = {}, options = {}) {
  const timeoutSeconds = Math.ceil(Number(options.timeoutMs || 15000) / 1000);
  const args = ["-sS", "-L", "--max-time", String(timeoutSeconds)];

  for (const [name, value] of Object.entries({
    "user-agent": "Mozilla/5.0 Game-Tier/1.0",
    accept: "application/json,text/plain,*/*",
    ...headers
  })) {
    args.push("-H", `${name}: ${value}`);
  }

  args.push(String(url));

  const { stdout } = await execFileAsync("curl", args, {
    maxBuffer: 1024 * 1024 * 8
  });
  return JSON.parse(stdout);
}
