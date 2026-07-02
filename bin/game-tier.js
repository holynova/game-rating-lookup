#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { pathToFileURL } from "node:url";
import { getRatings } from "../src/core/ratings.js";
import {
  batchLimit,
  bestGrade,
  gradeLabels,
  isUnidentified,
  parseQueries
} from "../src/core/format.js";
import {
  cachePath,
  clearCache,
  findCachedResult,
  readResultHistory,
  saveResult
} from "../src/cli/cache.js";
import { fetchJsonWithCurlFallback } from "../src/cli/fetch.js";
import { fetchRemoteRating } from "../src/cli/remote.js";

const numberFormatter = new Intl.NumberFormat("zh-CN");

const colorCodes = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  blue: "\x1b[34m",
  purple: "\x1b[35m",
  gold: "\x1b[33m",
  white: "\x1b[37m",
  cyan: "\x1b[36m"
};

const gradeColors = {
  white: "white",
  green: "green",
  blue: "blue",
  purple: "purple",
  gold: "gold"
};

export function usage() {
  return `Usage:
  game-tier <game...>
  game-tier --file games.txt
  game-tier --json <game...>
  game-tier --refresh <game...>
  game-tier history [--grade white|green|blue|purple|gold]
  game-tier cache clear

Options:
  --file <path>       Read game names from a text file
  --json             Print raw JSON
  --refresh          Ignore cached results and update the cache
  --no-cache         Do not read or write the cache
  --no-color         Disable colored output
  --limit <number>   Maximum batch size, default ${batchLimit}
  --help             Show this help`;
}

export function parseArgs(argv, options = {}) {
  const args = {
    command: "lookup",
    queries: [],
    file: null,
    json: false,
    refresh: false,
    cache: true,
    color: Boolean(options.isTTY ?? process.stdout.isTTY) && !process.env.NO_COLOR,
    grade: "all",
    limit: batchLimit,
    help: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "history" && args.queries.length === 0) {
      args.command = "history";
    } else if (value === "cache" && args.queries.length === 0) {
      args.command = "cache";
    } else if (value === "clear" && args.command === "cache") {
      args.subcommand = "clear";
    } else if (value === "--file" || value === "-f") {
      args.file = argv[++index];
    } else if (value === "--json") {
      args.json = true;
    } else if (value === "--refresh") {
      args.refresh = true;
    } else if (value === "--no-cache") {
      args.cache = false;
    } else if (value === "--no-color") {
      args.color = false;
    } else if (value === "--grade") {
      args.grade = argv[++index] || "all";
    } else if (value === "--limit") {
      args.limit = Number(argv[++index] || batchLimit);
    } else if (value === "--help" || value === "-h") {
      args.help = true;
    } else if (value.startsWith("-")) {
      throw new Error(`Unknown option: ${value}`);
    } else if (args.command === "lookup") {
      args.queries.push(value);
    } else {
      throw new Error(`Unexpected argument: ${value}`);
    }
  }

  if (!Number.isFinite(args.limit) || args.limit < 1) {
    throw new Error("--limit must be a positive number");
  }

  return args;
}

export function colorize(enabled, color, text) {
  if (!enabled) return text;
  return `${colorCodes[color] || ""}${text}${colorCodes.reset}`;
}

export function formatCount(value) {
  const number = Number(value || 0);
  return number > 0 ? numberFormatter.format(number) : "";
}

export function formatResult(result, options = {}) {
  const grade = bestGrade(result.data);
  const gradeText = isUnidentified(result.data) ? "未鉴定" : gradeLabels[grade];
  const coloredGrade = colorize(options.color, gradeColors[grade], gradeText);
  const sourceText = result.cached ? " cached" : result.remote ? " remote" : "";
  const cachedText = sourceText ? colorize(options.color, "dim", sourceText) : "";
  const title = result.data.matched?.name || result.query;
  const appid = result.data.matched?.appid ? `appid ${result.data.matched.appid}` : "no appid";
  const lines = [
    `${coloredGrade}  ${colorize(options.color, "bold", title)}  ${colorize(options.color, "dim", appid)}${cachedText}`
  ];

  const steamName = result.data.matched?.name || "";
  const steamValue =
    typeof result.data.steam?.score === "number" ? `+${result.data.steam.score}%` : "未鉴定";
  const steamMeta = [
    steamName ? `鉴定名 ${steamName}` : "",
    result.data.steam?.total ? `${formatCount(result.data.steam.total)} 条评价` : "",
    result.data.steam?.label || result.data.errors?.steam || ""
  ]
    .filter(Boolean)
    .join(" / ");
  lines.push(`  Steam   ${colorize(options.color, "cyan", steamValue)}  ${steamMeta}`);

  const heyboxValue = result.data.heybox?.scoreText ? `+${result.data.heybox.scoreText}` : "未鉴定";
  const heyboxMeta = [
    result.data.heybox?.name ? `鉴定名 ${result.data.heybox.name}` : "",
    result.data.heybox?.matchedBy ? `${result.data.heybox.matchedBy} 匹配` : "",
    result.data.errors?.heybox || ""
  ]
    .filter(Boolean)
    .join(" / ");
  lines.push(`  小黑盒  ${colorize(options.color, "cyan", heyboxValue)}  ${heyboxMeta}`);

  return lines.join("\n");
}

export async function readQueries(args) {
  const values = [...args.queries];
  if (args.file) {
    values.push(await readFile(args.file, "utf8"));
  }

  return parseQueries(values.join("\n"), args.limit);
}

export async function lookupQuery(query, args) {
  if (args.cache && !args.refresh) {
    const cached = await findCachedResult(query);
    if (cached) {
      return {
        query: cached.query,
        data: cached.data,
        cached: true
      };
    }
  }

  let data;
  let remote = false;
  try {
    data = await getRatings(query, {
      fetchJson: fetchJsonWithCurlFallback
    });
  } catch {
    data = await fetchRemoteRating(query);
    remote = true;
  }

  if (args.cache) {
    await saveResult(query, data);
  }

  return {
    query,
    data,
    cached: false,
    remote
  };
}

export async function lookup(args) {
  const queries = await readQueries(args);
  if (!queries.length) {
    throw new Error("Please provide at least one game name with at least two characters.");
  }

  const results = [];
  for (const query of queries) {
    try {
      results.push(await lookupQuery(query, args));
    } catch (error) {
      results.push({
        query,
        data: {
          query,
          matched: null,
          steam: null,
          heybox: null,
          errors: {
            steam: error.message || "查询失败",
            heybox: null
          },
          fetchedAt: new Date().toISOString()
        },
        cached: false
      });
    }
  }

  if (args.json) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  console.log(results.map((result) => formatResult(result, args)).join("\n\n"));
}

export async function history(args) {
  const items = await readResultHistory();
  const grade = args.grade || "all";
  const filtered =
    grade === "all" ? items : items.filter((item) => bestGrade(item.data) === grade);

  if (args.json) {
    console.log(JSON.stringify(filtered, null, 2));
    return;
  }

  if (!filtered.length) {
    console.log(grade === "all" ? "No cached history." : `No cached history for grade: ${grade}`);
    return;
  }

  console.log(
    filtered
      .map((item) =>
        formatResult(
          {
            query: item.query,
            data: item.data,
            cached: true
          },
          args
        )
      )
      .join("\n\n")
  );
}

export async function cacheCommand(args) {
  if (args.subcommand !== "clear") {
    throw new Error("Supported cache command: game-tier cache clear");
  }

  await clearCache();
  console.log(`Cleared cache: ${cachePath}`);
}

export async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  if (args.command === "history") {
    await history(args);
  } else if (args.command === "cache") {
    await cacheCommand(args);
  } else {
    await lookup(args);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((error) => {
    const bin = basename(process.argv[1] || "game-tier");
    console.error(`${bin}: ${error.message}`);
    process.exitCode = 1;
  });
}
