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
