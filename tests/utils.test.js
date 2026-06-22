import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { strip, ago, isEnglish } from "../src/utils.js";

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
