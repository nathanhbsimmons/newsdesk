import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { strip, ago } from "../src/utils.js";

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
