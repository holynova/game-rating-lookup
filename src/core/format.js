export const batchLimit = Infinity;

export const gradeLabels = {
  white: "普通",
  green: "优秀",
  blue: "稀有",
  purple: "史诗",
  gold: "传奇"
};

export function normalizeQuery(value) {
  return String(value || "").trim().toLowerCase();
}

export function parseQueries(rawValue, limit = batchLimit) {
  const raw = rawValue.trim();
  if (!raw) return [];

  const hasStrongSeparator = /[,，、;；\n\r]/.test(raw);
  const separator = hasStrongSeparator ? /[,，、;；\n\r]+/ : /\s+/;

  const items = raw
    .split(separator)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2)
    .filter((item, index, array) => {
      const normalized = normalizeQuery(item);
      return array.findIndex((candidate) => normalizeQuery(candidate) === normalized) === index;
    });

  return Number.isFinite(limit) ? items.slice(0, limit) : items;
}

export function gradeFromScore(score100) {
  if (score100 === null || score100 === undefined || Number.isNaN(score100)) return "white";
  if (score100 >= 95) return "gold";
  if (score100 >= 85) return "purple";
  if (score100 >= 75) return "blue";
  if (score100 >= 60) return "green";
  return "white";
}

export function bestGrade(data) {
  const scores = [];
  if (typeof data.steam?.score === "number") scores.push(data.steam.score);
  if (data.heybox?.score) scores.push(Number(data.heybox.score) * 10);
  return gradeFromScore(Math.max(...scores, 0));
}

export function isUnidentified(data) {
  const steamName = data.matched?.name || "";
  const heyboxName = data.heybox?.name || "";
  const heyboxScoreText = data.heybox?.scoreText || "";
  const hasHeyboxScore =
    Boolean(data.heybox?.score) || Boolean(heyboxScoreText && !/暂无|未鉴定|无/.test(heyboxScoreText));
  return !steamName && !data.steam && !heyboxName && !hasHeyboxScore;
}
