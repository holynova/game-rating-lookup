const form = document.querySelector("#search-form");
const input = document.querySelector("#game-input");
const statusEl = document.querySelector("#status");
const progressEl = document.querySelector("#progress");
const progressFill = document.querySelector("#progress-fill");
const progressLabel = document.querySelector("#progress-label");
const resultsEl = document.querySelector("#results");
const historyResultsEl = document.querySelector("#history-results");
const resultList = document.querySelector("#result-list");
const historyResultList = document.querySelector("#history-result-list");
const submitButton = form.querySelector("button[type='submit']");
const tabButtons = document.querySelectorAll(".tab-button");
const filterButtons = document.querySelectorAll(".filter-button");
const buildVersionEl = document.querySelector("#build-version");

const resultHistoryKey = "game-rating-lookup-result-history";
const legacyHistoryKey = "game-rating-lookup-history";
const apiBase = String(window.GAME_RATING_API_BASE || "").replace(/\/$/, "");
const lookupConcurrency = 3;
const numberFormatter = new Intl.NumberFormat("zh-CN");
let activeGradeFilter = "all";

const gradeLabels = {
  white: "普通",
  green: "优秀",
  blue: "稀有",
  purple: "史诗",
  gold: "传奇"
};

const steamReviewLabels = {
  "Overwhelmingly Positive": "好评如潮",
  "Very Positive": "特别好评",
  Positive: "好评",
  "Mostly Positive": "多半好评",
  Mixed: "褒贬不一",
  "Mostly Negative": "多半差评",
  Negative: "差评",
  "Very Negative": "特别差评",
  "Overwhelmingly Negative": "差评如潮",
  "No user reviews": "暂无用户评测"
};

if (buildVersionEl) {
  const buildVersion = window.GAME_RATING_BUILD?.builtAt || window.GAME_RATING_BUILD?.version || document.lastModified;
  buildVersionEl.textContent = `build ${formatBuildVersion(buildVersion)}`;
}

function formatBuildVersion(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "local";

  const parts = new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "short"
  })
    .formatToParts(date)
    .reduce((memo, part) => {
      memo[part.type] = part.value;
      return memo;
    }, {});

  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second} ${parts.timeZoneName || ""}`.trim();
}

function normalizeQuery(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeTitle(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[\u2122\u00ae\u00a9:"'`\u2018\u2019\u201c\u201d()[\]{}.,，、；;!?！？\-_/\s]/g, "")
    .replace(/demo|试玩版|试用版|ost|soundtrack|原声带/g, "");
}

function scoreName(query, candidate) {
  const q = normalizeTitle(query);
  const c = normalizeTitle(candidate);
  if (!q || !c) return 0;
  if (q === c) return 100;
  if (c.includes(q) || q.includes(c)) return 80;

  const qChars = new Set([...q]);
  let overlap = 0;
  for (const char of c) {
    if (qChars.has(char)) overlap += 1;
  }
  return Math.round((overlap / Math.max(q.length, c.length)) * 70);
}

function readResultHistory() {
  try {
    const value = JSON.parse(localStorage.getItem(resultHistoryKey) || "[]");
    return Array.isArray(value) ? value.filter((item) => item?.query && item?.data) : [];
  } catch {
    return [];
  }
}

function writeResultHistory(items) {
  localStorage.setItem(resultHistoryKey, JSON.stringify(items));
}

function findCachedResult(query) {
  const normalized = normalizeQuery(query);
  return readResultHistory().find((item) => normalizeQuery(item.query) === normalized) || null;
}

function saveResult(query, data) {
  const cleanQuery = query.trim();
  if (!cleanQuery || !data) return;

  const normalized = normalizeQuery(cleanQuery);
  const current = readResultHistory().filter((item) => normalizeQuery(item.query) !== normalized);
  writeResultHistory([
    {
      query: cleanQuery,
      data,
      updatedAt: new Date().toISOString()
    },
    ...current
  ]);
}

function setActiveView(view) {
  for (const button of tabButtons) {
    button.classList.toggle("is-active", button.dataset.view === view);
  }

  resultsEl.hidden = view !== "search" || resultList.children.length === 0;
  historyResultsEl.hidden = view !== "history";

  if (view === "history") {
    renderHistoryResults();
  }
}

function setStatus(message, type = "") {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`.trim();
}

function setProgress(completed = 0, total = 0) {
  const safeTotal = Math.max(Number(total) || 0, 0);
  const safeCompleted = Math.min(Math.max(Number(completed) || 0, 0), safeTotal);
  const percent = safeTotal ? Math.round((safeCompleted / safeTotal) * 100) : 0;

  if (progressEl) progressEl.hidden = !safeTotal;
  if (progressFill) progressFill.style.width = `${percent}%`;
  if (progressLabel) progressLabel.textContent = safeTotal ? `${safeCompleted} / ${safeTotal}` : "0 / 0";
}

function hideProgress() {
  setProgress(0, 0);
}

function formatCount(value) {
  const number = Number(value || 0);
  return number > 0 ? numberFormatter.format(number) : "";
}

function parseQueries(rawValue) {
  const raw = rawValue.trim();
  if (!raw) return [];

  const hasStrongSeparator = /[,，、;；\n\r]/.test(raw);
  const separator = hasStrongSeparator ? /[,，、;；\n\r]+/ : /\s+/;

  return raw
    .split(separator)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2)
    .filter((item, index, array) => {
      const normalized = normalizeQuery(item);
      return array.findIndex((candidate) => normalizeQuery(candidate) === normalized) === index;
    });
}

function gradeFromScore(score100, count = 0) {
  if (score100 === null || score100 === undefined || Number.isNaN(score100)) return "white";
  if (score100 >= 95 && count >= 500) return "gold";
  if (score100 >= 85 && count >= 50) return "purple";
  if (score100 >= 75) return "blue";
  if (score100 >= 60) return "green";
  return "white";
}

function steamGrade(data) {
  return gradeFromScore(typeof data.steam?.score === "number" ? data.steam.score : null, data.steam?.total || 0);
}

function heyboxGrade(data) {
  return gradeFromScore(data.heybox?.score ? Number(data.heybox.score) * 10 : null, data.heybox?.ratingCount || 0);
}

function bestGrade(data) {
  return steamGrade(data);
}

function appendText(parent, tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = text;
  parent.append(node);
  return node;
}

function translateSteamReviewLabel(label) {
  return steamReviewLabels[label] || label || "";
}

function primaryBadgeLabel(data, isUnidentified) {
  if (isUnidentified) return "未鉴定";
  return translateSteamReviewLabel(data.steam?.label) || gradeLabels[steamGrade(data)];
}

function hasMatchRisk(query, data) {
  const steamScore = Number(data.matched?.matchScore || 0);
  const steamName = data.matched?.name || "";
  const heyboxName = data.heybox?.name || "";

  if (query && steamName && scoreName(query, steamName) < 55 && steamScore < 110) return true;
  if (steamName && heyboxName && scoreName(steamName, heyboxName) < 45) return true;
  if (data.heybox?.matchedBy === "name" && steamName && heyboxName && scoreName(steamName, heyboxName) < 65) return true;
  return false;
}

function createAttributeRow({ label, name, value, detail, href, linkLabel, grade }) {
  const row = document.createElement("div");
  row.className = "attribute-row";
  if (grade) row.dataset.grade = grade;

  appendText(row, "div", "attribute-label", label);
  const body = document.createElement("div");
  body.className = "attribute-body";
  appendText(body, "span", "attribute-name", name ? `鉴定名 ${name}` : "未鉴定");
  appendText(body, "strong", "attribute-value", value || "未鉴定");
  if (detail) appendText(body, "span", "attribute-detail", detail);
  if (href) {
    const link = document.createElement("a");
    link.className = "attribute-link";
    link.href = href;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.title = linkLabel ? `打开 ${linkLabel}` : "打开链接";
    link.setAttribute("aria-label", link.title);
    body.append(link);
  }
  row.append(body);

  return row;
}

function createRefreshButton(query) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "refresh-button";
  button.textContent = "↻";
  button.title = "刷新";
  button.setAttribute("aria-label", `刷新 ${query}`);
  button.addEventListener("click", () => refreshQuery(query, button));
  return button;
}

function renderResult(data, options = {}) {
  const target = options.target || resultList;
  const query = options.query || data.query || data.matched?.name || "";
  const steamName = data.matched?.name || "";
  const heyboxName = data.heybox?.name || "";
  const heyboxScoreText = data.heybox?.scoreText || "";
  const hasHeyboxScore = Boolean(data.heybox?.score) || Boolean(heyboxScoreText && !/暂无|未鉴定|无/.test(heyboxScoreText));
  const steamAppid = data.matched?.appid || data.steam?.appid || "";
  const steamHref = steamAppid ? `https://store.steampowered.com/app/${steamAppid}` : "";
  const heyboxAppid = data.heybox?.appid || data.heybox?.steamAppid || "";
  const heyboxHref = heyboxAppid
    ? `https://api.xiaoheihe.cn/game/share_game_detail?appid=${encodeURIComponent(heyboxAppid)}&game_type=pc`
    : "";
  const isUnidentified = !steamName && !data.steam && !heyboxName && !hasHeyboxScore;
  const grade = steamGrade(data);
  const heyboxRowGrade = heyboxGrade(data);
  const card = document.createElement("article");
  card.className = "game-result";
  card.dataset.grade = grade;
  card.classList.toggle("is-unidentified", isUnidentified);

  const top = document.createElement("div");
  top.className = "game-topline";

  const title = document.createElement("div");
  title.className = "game-title";
  appendText(title, "p", "", data.matched?.appid ? `appid ${data.matched.appid}` : "待鉴定物品");
  appendText(title, "strong", "", query || steamName || heyboxName || "未鉴定物品");
  top.append(title);

  const actions = document.createElement("div");
  actions.className = "card-actions";
  if (options.cached) appendText(actions, "span", "cache-note", "已缓存");
  actions.append(createRefreshButton(query));
  if (hasMatchRisk(query, data)) appendText(actions, "span", "match-warning", "疑似错位");
  appendText(actions, "span", "grade-badge", primaryBadgeLabel(data, isUnidentified));
  top.append(actions);
  card.append(top);

  const attributeList = document.createElement("div");
  attributeList.className = "attribute-list";

  const steamMeta = [
    data.steam?.total ? `${formatCount(data.steam.total)} 条评价` : "",
    translateSteamReviewLabel(data.steam?.label) || data.errors?.steam || ""
  ]
    .filter(Boolean)
    .join(" / ");

  attributeList.append(
    createAttributeRow({
      label: "Steam",
      name: steamName,
      value: typeof data.steam?.score === "number" ? `${data.steam.score}%` : "未鉴定",
      detail: steamMeta,
      href: steamHref,
      linkLabel: "Steam",
      grade
    })
  );

  const heyboxMeta = [data.heybox?.ratingCount ? `${formatCount(data.heybox.ratingCount)} 次鉴定` : "", data.errors?.heybox || ""]
    .filter(Boolean)
    .join(" / ");

  attributeList.append(
    createAttributeRow({
      label: "小黑盒",
      name: heyboxName,
      value: hasHeyboxScore ? data.heybox.scoreText : "未鉴定",
      detail: heyboxMeta,
      href: heyboxHref,
      linkLabel: "小黑盒",
      grade: heyboxRowGrade
    })
  );

  card.append(attributeList);
  target.append(card);
  return card;
}

function renderHistoryResults() {
  const allItems = readResultHistory();
  const items =
    activeGradeFilter === "all"
      ? allItems
      : allItems.filter((item) => bestGrade(item.data) === activeGradeFilter);
  historyResultList.innerHTML = "";

  if (!allItems.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "还没有历史结果。";
    historyResultList.append(empty);
    return;
  }

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "这个等级下还没有历史结果。";
    historyResultList.append(empty);
    return;
  }

  for (const item of items) {
    renderResult(item.data, {
      target: historyResultList,
      query: item.query,
      cached: true
    });
  }
}

async function fetchRating(query) {
  const response = await fetch(`${apiBase}/api/ratings?q=${encodeURIComponent(query)}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "查询失败。");
  }

  return data;
}

async function refreshQuery(query, button) {
  if (!query) return;

  const card = button?.closest(".game-result") || null;
  document.body.classList.add("is-loading");
  card?.classList.add("is-refreshing-card");
  button?.classList.add("is-refreshing");
  if (button) {
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
  }
  setStatus(`正在刷新：${query}`);

  try {
    const data = await fetchRating(query);
    saveResult(query, data);
    if (card?.parentElement) {
      const newCard = renderResult(data, {
        target: card.parentElement,
        query
      });
      card.replaceWith(newCard);
    }
    renderHistoryResults();
    setStatus(`已刷新：${data.matched?.name || query}`);
  } catch (error) {
    setStatus(error.message || "刷新失败。", "error");
  } finally {
    card?.classList.remove("is-refreshing-card");
    button?.classList.remove("is-refreshing");
    if (button) {
      button.disabled = false;
      button.removeAttribute("aria-busy");
    }
    document.body.classList.remove("is-loading");
  }
}

async function lookupBatch(queries) {
  document.body.classList.add("is-loading");
  submitButton.disabled = true;
  setActiveView("search");
  resultsEl.hidden = false;
  resultList.innerHTML = "";

  let successCount = 0;
  let cachedCount = 0;
  const total = queries.length;

  try {
    for (const [index, query] of queries.entries()) {
      const cached = findCachedResult(query);
      if (cached) {
        renderResult(cached.data, {
          target: resultList,
          query: cached.query,
          cached: true
        });
        cachedCount += 1;
        successCount += 1;
        continue;
      }

      setStatus(`正在查询 ${index + 1}/${total}：${query}`);
      try {
        const data = await fetchRating(query);
        saveResult(query, data);
        renderResult(data, {
          target: resultList,
          query
        });
        successCount += 1;
      } catch (error) {
        renderResult({
          query,
          matched: null,
          steam: null,
          heybox: null,
          errors: {
            steam: error.message || "查询失败",
            heybox: null
          }
        });
      }
    }

    const cacheText = cachedCount ? `，${cachedCount} 个来自历史` : "";
    setStatus(successCount === total ? `查询完成${cacheText}。` : `完成 ${successCount}/${total} 个查询${cacheText}。`);
  } finally {
    submitButton.disabled = false;
    document.body.classList.remove("is-loading");
  }
}

async function lookupBatchConcurrent(queries) {
  document.body.classList.add("is-loading");
  submitButton.disabled = true;
  setActiveView("search");
  resultsEl.hidden = false;
  resultList.innerHTML = "";
  setProgress(0, queries.length);

  let successCount = 0;
  let cachedCount = 0;
  let completedCount = 0;
  let nextIndex = 0;
  const total = queries.length;
  const concurrency = Math.min(lookupConcurrency, total);

  async function lookupNext() {
    const index = nextIndex;
    nextIndex += 1;
    if (index >= total) return;

    const query = queries[index];
    const cached = findCachedResult(query);

    if (cached) {
      renderResult(cached.data, {
        target: resultList,
        query: cached.query,
        cached: true
      });
      cachedCount += 1;
      successCount += 1;
    } else {
      setStatus(`正在查询 ${index + 1}/${total}：${query}`);
      try {
        const data = await fetchRating(query);
        saveResult(query, data);
        renderResult(data, {
          target: resultList,
          query
        });
        successCount += 1;
      } catch (error) {
        renderResult({
          query,
          matched: null,
          steam: null,
          heybox: null,
          errors: {
            steam: error.message || "查询失败",
            heybox: null
          }
        });
      }
    }

    completedCount += 1;
    setProgress(completedCount, total);
    setStatus(`已完成 ${completedCount}/${total}，并发 ${concurrency}`);
    await lookupNext();
  }

  try {
    await Promise.all(Array.from({ length: concurrency }, () => lookupNext()));

    const cacheText = cachedCount ? `，${cachedCount} 个来自历史` : "";
    setStatus(successCount === total ? `查询完成${cacheText}。` : `完成 ${successCount}/${total} 个查询${cacheText}。`);
  } finally {
    submitButton.disabled = false;
    document.body.classList.remove("is-loading");
    setTimeout(hideProgress, 700);
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const queries = parseQueries(input.value);

  if (!queries.length) {
    resultsEl.hidden = true;
    setStatus("请输入至少一个游戏名称。", "error");
    return;
  }

  lookupBatchConcurrent(queries);
});

input.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;

  event.preventDefault();
  form.requestSubmit();
});

for (const button of tabButtons) {
  button.addEventListener("click", () => setActiveView(button.dataset.view));
}

for (const button of filterButtons) {
  button.addEventListener("click", () => {
    activeGradeFilter = button.dataset.gradeFilter || "all";
    for (const item of filterButtons) {
      item.classList.toggle("is-active", item === button);
    }
    renderHistoryResults();
  });
}
