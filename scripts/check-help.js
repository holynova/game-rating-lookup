import { spawnSync } from "node:child_process";

const result = spawnSync(process.execPath, ["bin/game-tier.js", "--help"], {
  encoding: "utf8"
});

if (result.status !== 0) {
  process.stderr.write(result.stderr || result.stdout || "game-tier --help failed\n");
  process.exit(result.status || 1);
}
