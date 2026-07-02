# Game Tier

Game Tier looks up Steam review scores and Xiaoheihe ratings by game name, then
maps the best score to a rarity tier: 普通, 优秀, 稀有, 史诗, or 传奇.

It includes both:

- `game-tier`, a Node.js CLI for terminal lookups.
- 装备鉴定台, the original web app.

![项目截图](assets/screenshot.png)

Pages: https://holynova.github.io/game-rating-lookup/

## Install

```sh
npm install -g game-tier
```

Node.js 18 or newer is required.

## CLI Usage

```sh
game-tier Hades
game-tier "赛博朋克2077" "艾尔登法环"
game-tier --file games.txt
game-tier --json Hades
game-tier --refresh Hades
game-tier history
game-tier history --grade gold
game-tier cache clear
```

The default output uses color when stdout is a terminal. Use `--no-color` to
disable color output, or `--json` for machine-readable output.

## Cache

CLI results are cached at:

```text
~/.cache/game-tier/results.json
```

Set `XDG_CACHE_HOME` to change the cache root. Use `--refresh` to bypass a
cached result and update it, or `--no-cache` to skip cache reads and writes.

## Rating Sources

Game Tier queries:

- Steam Store Search API.
- Steam app review summaries.
- Xiaoheihe game search.

Xiaoheihe search is not a formal public API. If it fails, Game Tier keeps the
Steam result and reports the Xiaoheihe error instead of failing the whole
lookup.

The CLI tries direct lookups first. If direct Steam access fails in Node.js, it
falls back to the project's Cloudflare Worker API. Set `GAME_TIER_API_BASE` to
use a different compatible Worker endpoint.

## Development

```sh
npm test
node bin/game-tier.js Hades
npm run dev
```

The local web app runs at http://localhost:5177.

## Publish Checklist

1. Confirm the package name:

   ```sh
   npm view game-tier
   ```

   A 404 means the package is not currently published under that name.

2. Run tests and inspect the package contents:

   ```sh
   npm test
   npm run pack:dry
   ```

3. Log in and publish:

   ```sh
   npm login
   npm publish --access public
   ```

4. Smoke-test the published package:

   ```sh
   npx game-tier Hades
   ```

## Web App

The web app supports batch lookups, browser history cache, refresh, and grade
filtering. The Cloudflare Worker API is in `worker.js`.
