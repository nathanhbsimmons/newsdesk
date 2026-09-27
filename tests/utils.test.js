import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { strip, ago, isEnglish, isWithinWindow, declusterBySource, orderArticles, buildObsidianClipUrl } from "../src/utils.js";

describe("strip()", () => {
  it("removes single HTML tag", () => {
    expect(strip("<p>Hello</p>")).toBe("Hello");
  });
  it("removes nested HTML tags", () => {
    expect(strip("<div><b>Bold</b> text</div>")).toBe("Bold text");
  });
  it("removes self-closing tags", () => {
    expect(strip("line1<br/>line2")).toBe("line1 line2");
  });
  it("decodes &amp;", () => {
    expect(strip("AT&amp;T")).toBe("AT&T");
  });
  it("decodes &lt; and &gt;", () => {
    expect(strip("&lt;code&gt;val&lt;/code&gt;")).toBe("<code>val</code>");
  });
  it("decodes &nbsp;", () => {
    expect(strip("a&nbsp;b")).toBe("a b");
  });
  it("decodes &#39;", () => {
    expect(strip("it&#39;s")).toBe("it's");
  });
  it("decodes &quot;", () => {
    expect(strip("&quot;quoted&quot;")).toBe('"quoted"');
  });
  it("collapses multiple spaces", () => {
    expect(strip("a    b")).toBe("a b");
  });
  it("trims leading and trailing whitespace", () => {
    expect(strip("  hello  ")).toBe("hello");
  });
  it("handles empty string", () => {
    expect(strip("")).toBe("");
  });
  it("handles undefined (default param)", () => {
    expect(strip()).toBe("");
  });
  it("strips mixed content", () => {
    expect(strip('<a href="x">Link &amp; text</a>')).toBe("Link & text");
  });
});

describe("ago()", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-01T12:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "just now" for 0 seconds ago', () => {
    expect(ago("2024-06-01T12:00:00Z")).toBe("just now");
  });
  it('returns "just now" for 59 seconds ago', () => {
    expect(ago("2024-06-01T11:59:01Z")).toBe("just now");
  });
  it('returns minutes for exactly 1 minute ago', () => {
    expect(ago("2024-06-01T11:59:00Z")).toBe("1m ago");
  });
  it('returns minutes for 30 minutes ago', () => {
    expect(ago("2024-06-01T11:30:00Z")).toBe("30m ago");
  });
  it('returns minutes for 59 minutes ago', () => {
    expect(ago("2024-06-01T11:01:00Z")).toBe("59m ago");
  });
  it('returns hours for exactly 1 hour ago', () => {
    expect(ago("2024-06-01T11:00:00Z")).toBe("1h ago");
  });
  it('returns hours for 5 hours ago', () => {
    expect(ago("2024-06-01T07:00:00Z")).toBe("5h ago");
  });
  it('returns hours for 23 hours ago', () => {
    expect(ago("2024-05-31T13:00:00Z")).toBe("23h ago");
  });
  it('returns days for exactly 1 day ago', () => {
    expect(ago("2024-05-31T12:00:00Z")).toBe("1d ago");
  });
  it('returns days for 7 days ago', () => {
    expect(ago("2024-05-25T12:00:00Z")).toBe("7d ago");
  });
});

describe("strip() — extended entity decoding", () => {
  it("decodes &mdash;", () => { expect(strip("a&mdash;b")).toBe("a—b"); });
  it("decodes &ndash;", () => { expect(strip("a&ndash;b")).toBe("a–b"); });
  it("decodes &hellip;", () => { expect(strip("a&hellip;")).toBe("a…"); });
  it("decodes &rsquo;", () => { expect(strip("it&rsquo;s")).toBe("it’s"); });
  it("decodes &lsquo;", () => { expect(strip("&lsquo;hi")).toBe("‘hi"); });
  it("decodes &rdquo;", () => { expect(strip("say&rdquo;")).toBe("say”"); });
  it("decodes &ldquo;", () => { expect(strip("&ldquo;say")).toBe("“say"); });
  it("decodes &#8212; (em dash)", () => { expect(strip("a&#8212;b")).toBe("a—b"); });
  it("decodes &#8211; (en dash)", () => { expect(strip("a&#8211;b")).toBe("a–b"); });
  it("decodes &#8230; (ellipsis)", () => { expect(strip("a&#8230;")).toBe("a…"); });
  it("decodes &#8216; (left single quote)", () => { expect(strip("&#8216;hi")).toBe("‘hi"); });
  it("decodes &#8217; (right single quote)", () => { expect(strip("&#8217;s")).toBe("’s"); });
  it("decodes &#8220; (left double quote)", () => { expect(strip("&#8220;hi")).toBe("“hi"); });
  it("decodes &#8221; (right double quote)", () => { expect(strip("hi&#8221;")).toBe("hi”"); });
});

describe("isEnglish()", () => {
  it("returns true for empty string", () => {
    expect(isEnglish("")).toBe(true);
  });

  it("returns true when called with no argument (default param)", () => {
    expect(isEnglish()).toBe(true);
  });

  it("returns true for plain English text", () => {
    expect(isEnglish("The quick brown fox jumps over the lazy dog")).toBe(true);
  });

  it("returns false for Cyrillic text", () => {
    expect(isEnglish("Привет мир")).toBe(false);
  });

  it("returns false for Arabic text", () => {
    expect(isEnglish("مرحبا بالعالم")).toBe(false);
  });

  it("returns false for CJK (Chinese) text", () => {
    expect(isEnglish("你好世界")).toBe(false);
  });

  it("returns false for Hiragana (Japanese Kana)", () => {
    expect(isEnglish("こんにちは")).toBe(false);
  });

  it("returns false for Hangul (Korean)", () => {
    expect(isEnglish("안녕하세요")).toBe(false);
  });

  it("returns false for Devanagari (Hindi)", () => {
    expect(isEnglish("नमस्ते दुनिया")).toBe(false);
  });

  it("returns false for Thai text", () => {
    expect(isEnglish("สวัสดีชาวโลก")).toBe(false);
  });

  it("returns false for Hebrew text", () => {
    expect(isEnglish("שלום עולם")).toBe(false);
  });

  it("returns true for text with only numbers and symbols (no letters)", () => {
    expect(isEnglish("123 456 @#$")).toBe(true);
  });

  it("returns false when diacritic density exceeds 12%", () => {
    // All diacritics → 100% density
    expect(isEnglish("àáâãäåæç")).toBe(false);
  });

  it("returns true for English text with a small number of accented chars", () => {
    // "café" — 1 diacritic out of 4 letters = 25%... actually that fails. Use a longer string.
    // "resume" + a long English sentence → very low diacritic density
    expect(isEnglish("This is a long English sentence about resumé and naïve assumptions.")).toBe(true);
  });
});

describe("isWithinWindow()", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps an article 13 days old in the 14-day All-sources window (activeSrc=null)", () => {
    expect(isWithinWindow("2024-06-02T12:00:00Z", null)).toBe(true);
  });
  it("drops an article 15 days old from the 14-day All-sources window", () => {
    expect(isWithinWindow("2024-05-31T12:00:00Z", null)).toBe(false);
  });
  it("keeps an article 29 days old in the 30-day single-source window (activeSrc set)", () => {
    expect(isWithinWindow("2024-05-17T12:00:00Z", "tldr")).toBe(true);
  });
  it("drops an article 31 days old from the 30-day single-source window", () => {
    expect(isWithinWindow("2024-05-15T12:00:00Z", "tldr")).toBe(false);
  });
  it("fails open (keeps the article) when pubDate is unparsable", () => {
    expect(isWithinWindow("not-a-date", null)).toBe(true);
  });
});

describe("declusterBySource()", () => {
  const mk = (id, sourceId) => ({ id, sourceId });

  it("leaves an already-alternating order untouched", () => {
    const items = [mk("a1", "A"), mk("b1", "B"), mk("a2", "A"), mk("b2", "B")];
    expect(declusterBySource(items).map(i => i.id)).toEqual(["a1", "b1", "a2", "b2"]);
  });

  it("never produces a run longer than 2 from the same source", () => {
    const items = [mk("a1", "A"), mk("a2", "A"), mk("a3", "A"), mk("b1", "B"), mk("a4", "A")];
    const result = declusterBySource(items);
    let run = 1;
    for (let i = 1; i < result.length; i++) {
      run = result[i].sourceId === result[i - 1].sourceId ? run + 1 : 1;
      expect(run).toBeLessThanOrEqual(2);
    }
    expect(result.map(i => i.id).sort()).toEqual(["a1", "a2", "a3", "a4", "b1"].sort());
  });

  it("falls back to relaxing the constraint when one source dominates entirely", () => {
    const items = [mk("a1", "A"), mk("a2", "A"), mk("a3", "A")];
    const result = declusterBySource(items);
    expect(result.map(i => i.id)).toEqual(["a1", "a2", "a3"]);
  });

  it("is idempotent on an already-valid sequence", () => {
    const items = [mk("a1", "A"), mk("b1", "B"), mk("a2", "A"), mk("c1", "C"), mk("a3", "A")];
    const once = declusterBySource(items);
    const twice = declusterBySource(once);
    expect(twice.map(i => i.id)).toEqual(once.map(i => i.id));
  });
});

describe("orderArticles()", () => {
  const mk = (id, sourceId) => ({ id, sourceId });
  const filtered = [mk("a1", "A"), mk("a2", "A"), mk("b1", "B")];

  it("returns the chronological decluttered order when no shuffle snapshot is given", () => {
    expect(orderArticles(filtered).map(i => i.id)).toEqual(declusterBySource(filtered).map(i => i.id));
  });

  it("applies a shuffle snapshot's order when given", () => {
    const shuffledIds = ["b1", "a1", "a2"];
    expect(orderArticles(filtered, { shuffledIds }).map(i => i.id)).toEqual(["b1", "a1", "a2"]);
  });

  it("appends items missing from the shuffle snapshot", () => {
    const shuffledIds = ["a1"];
    const result = orderArticles(filtered, { shuffledIds });
    expect(result.map(i => i.id).sort()).toEqual(["a1", "a2", "b1"]);
  });
});

describe("buildObsidianClipUrl()", () => {
  const article = {
    title: "Test Title",
    sourceName: "TLDR",
    link: "https://example.com/a",
    pubDate: "2024-06-01T12:00:00Z",
    excerpt: "An excerpt.",
  };

  it("builds a shortcuts://run-shortcut URL with name, input=text, and text params", () => {
    const url = buildObsidianClipUrl(article);
    const parsed = new URL(url.replace("shortcuts://", "https://"));
    expect(url.startsWith("shortcuts://run-shortcut?")).toBe(true);
    expect(parsed.searchParams.get("name")).toBe("Clip to Obsidian");
    expect(parsed.searchParams.get("input")).toBe("text");
    const text = parsed.searchParams.get("text");
    expect(text).toContain("Test Title");
    expect(text).toContain("https://example.com/a");
    expect(text).toContain("TLDR");
  });

  it("accepts a custom shortcut name", () => {
    const url = buildObsidianClipUrl(article, "My Other Shortcut");
    const parsed = new URL(url.replace("shortcuts://", "https://"));
    expect(parsed.searchParams.get("name")).toBe("My Other Shortcut");
  });
});
