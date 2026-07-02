# Game Tier

![项目截图](assets/screenshot.png)

Game Tier 是一个游戏评分查询 CLI + 网页应用。输入游戏名后，它会查询 Steam 评价与小黑盒评分，并映射为 普通、优秀、稀有、史诗、传奇。

- GitHub Repo: https://github.com/holynova/game-rating-lookup
- GitHub Pages: https://holynova.github.io/game-rating-lookup/

## Install

```sh
npm install -g game-tier
```

Node.js 18+ required.

## CLI Usage

查询单个游戏：

```sh
game-tier Hades
```

批量查询多个游戏：

```sh
game-tier "赛博朋克2077" "艾尔登法环"
```

从文件读取游戏名，支持换行、逗号、中文顿号、分号分隔：

```sh
game-tier --file games.txt
```

输出 JSON，适合脚本处理：

```sh
game-tier --json Hades
```

刷新缓存并重新查询：

```sh
game-tier --refresh Hades
```

查看本地历史缓存：

```sh
game-tier history
```

按等级筛选历史：

```sh
game-tier history --grade gold
game-tier history --grade purple
```

清空本地缓存：

```sh
game-tier cache clear
```

禁用颜色输出：

```sh
game-tier --no-color Hades
```

## Output

默认输出会在终端里使用颜色，并标出等级、匹配到的 Steam appid、Steam 好评率、小黑盒评分和数据来源：

```text
传奇  Hades  appid 1145360
  Steam   +98%  鉴定名 Hades / 305,131 条评价 / Overwhelmingly Positive
  小黑盒  +9.4  鉴定名 哈迪斯 / appid 匹配
```

等级规则取 Steam 百分比与小黑盒分数乘 10 后的较高值：

- `>= 95`: 传奇
- `>= 85`: 史诗
- `>= 75`: 稀有
- `>= 60`: 优秀
- `< 60`: 普通

## Cache

CLI 结果默认缓存到：

```text
~/.cache/game-tier/results.json
```

可以用 `XDG_CACHE_HOME` 修改缓存根目录。`--refresh` 会绕过缓存并更新结果，`--no-cache` 会跳过缓存读写。

## Network Fallback

CLI 会优先直连 Steam 与小黑盒接口。当前 Node.js 环境直连 Steam 失败时，会 fallback 到项目的 Cloudflare Worker API。可以用 `GAME_TIER_API_BASE` 指向自己的兼容 Worker。

## Development

```sh
npm test
node bin/game-tier.js Hades
npm run dev
```

本地网页开发服务默认运行在 http://localhost:5177。
