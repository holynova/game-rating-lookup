# Game Tier

![项目截图](assets/screenshot.png)

Game Tier 是一个游戏评分查询工具，支持 Web 页面和命令行两种形态。输入游戏名称后，会查询 Steam 评价和小黑盒评分，并按普通、优秀、稀有、史诗、传奇展示结果。

- GitHub Repo: https://github.com/holynova/game-rating-lookup
- GitHub Pages: https://holynova.github.io/game-rating-lookup/
- npm: https://www.npmjs.com/package/game-tier

## Web Demo

[![装备鉴定台 Demo 分享卡片](assets/demo-share-card.png)](https://holynova.github.io/game-rating-lookup/)

移动端优先的在线版本：打开页面后输入一个或多个游戏名即可查询。批量查询不截断数量，并以 3 个并发请求排队执行。

## CLI

### 安装

全局安装：

```bash
npm install -g game-tier
```

也可以不安装，直接运行：

```bash
npx game-tier Hades
```

### 基本使用

查询单个游戏：

```bash
game-tier Hades
```

一次查询多个游戏：

```bash
game-tier Hades "Elden Ring" "Cyberpunk 2077"
```

从文件读取游戏名，每行一个：

```bash
game-tier --file games.txt
```

输出原始 JSON：

```bash
game-tier --json Hades
```

### 缓存与历史

CLI 会默认缓存查询结果，避免重复请求。

查看历史：

```bash
game-tier history
```

按等级筛选历史：

```bash
game-tier history --grade gold
```

可用等级：

```text
white  普通
green  优秀
blue   稀有
purple 史诗
gold   传奇
```

强制刷新，不使用旧缓存：

```bash
game-tier --refresh Hades
```

本次查询不读写缓存：

```bash
game-tier --no-cache Hades
```

清空缓存：

```bash
game-tier cache clear
```

### 参数

```text
--file <path>       从文本文件读取游戏名
--json              输出原始 JSON
--refresh           忽略缓存并重新查询
--no-cache          不读取或写入缓存
--no-color          禁用终端颜色
--limit <number>    批量查询上限，默认不限制
--help              显示帮助
```

### 示例文件

`games.txt`:

```text
Hades
Elden Ring
Cyberpunk 2077
```

运行：

```bash
game-tier --file games.txt --limit 3
```
