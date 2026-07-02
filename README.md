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

```sh
# 查询单个游戏
game-tier Hades

# 批量查询
game-tier "赛博朋克2077" "艾尔登法环"

# 从文件读取，支持换行、逗号、中文顿号、分号分隔
game-tier --file games.txt

# 输出 JSON，适合脚本处理
game-tier --json Hades

# 绕过缓存并刷新结果
game-tier --refresh Hades

# 查看历史缓存
game-tier history

# 按等级筛选历史
game-tier history --grade gold

# 清空缓存
game-tier cache clear

# 禁用颜色
game-tier --no-color Hades
```

默认输出会在终端里使用颜色，并显示等级、Steam 好评率、小黑盒评分和匹配来源：

```text
传奇  Hades  appid 1145360
  Steam   +98%  鉴定名 Hades / 305,131 条评价 / Overwhelmingly Positive
  小黑盒  +9.4  鉴定名 哈迪斯 / appid 匹配
```

CLI 结果默认缓存到 `~/.cache/game-tier/results.json`。可以用 `XDG_CACHE_HOME` 修改缓存根目录；也可以用 `GAME_TIER_API_BASE` 指向自己的兼容 Worker API。
