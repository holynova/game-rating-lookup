import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, test } from "node:test";
import {
  colorize,
  formatCount,
  formatResult,
  parseArgs,
  readQueries,
  usage
} from "../bin/game-tier.js";

const tempDirs = [];

async function tempFile(contents) {
  const dir = await mkdtemp(join(tmpdir(), "game-tier-cli-test-"));
  tempDirs.push(dir);
  const filePath = join(dir, "games.txt");
  await writeFile(filePath, contents);
  return filePath;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

test("usage documents the public command name", () => {
  assert.match(usage(), /game-tier <game\.\.\.>/);
  assert.match(usage(), /game-tier cache clear/);
});

test("parseArgs parses lookup options without depending on the current TTY", () => {
  assert.deepEqual(parseArgs(["--json", "--refresh", "--no-color", "Hades"]).queries, ["Hades"]);
  assert.equal(parseArgs(["Hades"]).limit, null);

  const args = parseArgs(["--file", "games.txt", "--limit", "3", "--no-cache"], {
    isTTY: true
  });
  assert.equal(args.file, "games.txt");
  assert.equal(args.limit, 3);
  assert.equal(args.cache, false);
  assert.equal(parseArgs(["--no-color", "Hades"], { isTTY: true }).color, false);
});

test("parseArgs parses history and cache commands", () => {
  assert.deepEqual(
    {
      command: parseArgs(["history", "--grade", "gold"]).command,
      grade: parseArgs(["history", "--grade", "gold"]).grade
    },
    {
      command: "history",
      grade: "gold"
    }
  );

  const cacheArgs = parseArgs(["cache", "clear"]);
  assert.equal(cacheArgs.command, "cache");
  assert.equal(cacheArgs.subcommand, "clear");
});

test("parseArgs rejects unknown options and invalid limits", () => {
  assert.throws(() => parseArgs(["--wat"]), /Unknown option/);
  assert.throws(() => parseArgs(["--limit", "0"]), /positive number/);
});

test("readQueries combines argv and file input, then deduplicates and limits", async () => {
  const file = await tempFile("Hades\nCeleste\nHades");
  const queries = await readQueries({
    queries: ["Elden Ring"],
    file,
    limit: 2
  });

  assert.deepEqual(queries, ["Elden Ring", "Hades"]);
});

test("format helpers produce readable and colored output", () => {
  assert.equal(formatCount(305131), "305,131");
  assert.equal(colorize(false, "gold", "传奇"), "传奇");
  assert.equal(colorize(true, "gold", "传奇"), "\x1b[33m传奇\x1b[0m");
});

test("formatResult prints rating details and source markers", () => {
  const output = formatResult(
    {
      query: "Hades",
      cached: true,
      data: {
        matched: {
          appid: 1145360,
          name: "Hades"
        },
        steam: {
          score: 98,
          total: 305131,
          label: "Overwhelmingly Positive"
        },
        heybox: {
          name: "哈迪斯",
          score: "9.4",
          scoreText: "9.4",
          matchedBy: "appid"
        },
        errors: {
          steam: null,
          heybox: null
        }
      }
    },
    {
      color: false
    }
  );

  assert.match(output, /传奇  Hades  appid 1145360 cached/);
  assert.match(output, /Steam   \+98%/);
  assert.match(output, /小黑盒  \+9.4/);
});
