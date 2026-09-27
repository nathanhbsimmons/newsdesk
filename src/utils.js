export const strip = (html = "") =>
  html.replace(/<[^>]*>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&nbsp;/g, " ")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&mdash;/gi, "—")
      .replace(/&ndash;/gi, "–")
      .replace(/&hellip;/gi, "…")
      .replace(/&rsquo;/gi, "’")
      .replace(/&lsquo;/gi, "‘")
      .replace(/&rdquo;/gi, "”")
      .replace(/&ldquo;/gi, "“")
      .replace(/&#8212;/g, "—")
      .replace(/&#8211;/g, "–")
      .replace(/&#8230;/g, "…")
      .replace(/&#8216;/g, "‘")
      .replace(/&#8217;/g, "’")
      .replace(/&#8220;/g, "“")
      .replace(/&#8221;/g, "”")
      .replace(/\s+/g, " ")
      .trim();

export const isEnglish = (text = "") => {
  if (!text) return true;
  // Definitive non-Latin scripts: Cyrillic, Arabic, Devanagari, CJK, Kana, Hangul, Thai, Hebrew
  if (/[Ѐ-ӿ؀-ۿऀ-ॿ一-鿿぀-ヿ가-힯฀-๿א-ת]/.test(text)) return false;
  // High diacritic density → likely non-English European language
  const letters = (text.match(/[a-zA-ZÀ-ÿŒœ]/g) || []).length;
  if (letters === 0) return true;
  const diacritics = (text.match(/[À-ÿŒœ]/g) || []).length;
  return diacritics / letters <= 0.12;
};

export const ago = (d) => {
  const s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 60)    return "just now";
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export const DAY_MS = 86_400_000;
export const ALL_SOURCES_WINDOW_DAYS = 14;
export const SINGLE_SOURCE_WINDOW_DAYS = 30;

export function isWithinWindow(pubDate, activeSrc) {
  const days = activeSrc ? SINGLE_SOURCE_WINDOW_DAYS : ALL_SOURCES_WINDOW_DAYS;
  const t = new Date(pubDate).getTime();
  if (Number.isNaN(t)) return true; // fail-open on unparsable dates
  return t >= Date.now() - days * DAY_MS;
}

export function shuffleArray(items) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function declusterBySource(items, { maxRun = 2, sourceKey = "sourceId" } = {}) {
  if (items.length <= maxRun) return items;
  const queues = new Map();
  items.forEach((item, i) => {
    const key = item[sourceKey];
    if (!queues.has(key)) queues.set(key, []);
    queues.get(key).push({ item, i });
  });
  const result = [];
  let lastKey = null, runLength = 0, remaining = items.length;
  while (remaining > 0) {
    let bestKey = null, bestIndex = Infinity;
    for (const [key, q] of queues) {
      if (q.length === 0) continue;
      if (key === lastKey && runLength >= maxRun) continue;
      if (q[0].i < bestIndex) { bestIndex = q[0].i; bestKey = key; }
    }
    if (bestKey === null) {
      for (const [key, q] of queues) {
        if (q.length && q[0].i < bestIndex) { bestIndex = q[0].i; bestKey = key; }
      }
    }
    const { item } = queues.get(bestKey).shift();
    result.push(item);
    remaining--;
    if (bestKey === lastKey) runLength++; else { lastKey = bestKey; runLength = 1; }
  }
  return result;
}

// Applies shuffle snapshot if present, else chronological+decluttered default.
// Re-decluttering on top of the snapshot self-heals if a dismiss/refresh broke
// the max-run rule, and folds in any items missing from the snapshot.
export function orderArticles(filteredList, { shuffledIds } = {}) {
  if (!shuffledIds) return declusterBySource(filteredList);
  const byId = new Map(filteredList.map(a => [a.id, a]));
  const known = shuffledIds.map(id => byId.get(id)).filter(Boolean);
  const knownSet = new Set(shuffledIds);
  const extra = filteredList.filter(a => !knownSet.has(a.id));
  return declusterBySource([...known, ...extra]);
}

export const OBSIDIAN_SHORTCUT_NAME = "Clip to Obsidian";

export function buildObsidianClipUrl(article, shortcutName = OBSIDIAN_SHORTCUT_NAME) {
  const lines = [
    `# ${article.title}`,
    "",
    `Source: ${article.sourceName}`,
    `Link: ${article.link}`,
    article.pubDate ? `Date: ${new Date(article.pubDate).toLocaleDateString()}` : null,
    "",
    article.excerpt || "",
  ].filter(Boolean);
  // URLSearchParams encodes spaces as "+" (form-encoding), but shortcuts://
  // expects standard percent-encoding (%20) — encode manually to avoid that.
  const params = { name: shortcutName, input: "text", text: lines.join("\n") };
  const query = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
  return `shortcuts://run-shortcut?${query}`;
}
