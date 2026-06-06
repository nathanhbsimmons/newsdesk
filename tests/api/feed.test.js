import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import handler, { parseItems } from "../../api/feed.js";

function makeRes() {
  const res = {};
  res.status = vi.fn(() => res);
  res.json   = vi.fn(() => res);
  return res;
}

function makeReq(query = {}) {
  return { method: "GET", query };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const RSS_TWO_ITEMS = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <item>
      <title>Article One</title>
      <link>https://example.com/1</link>
      <guid>guid-1</guid>
      <description>&lt;p&gt;Hello world&lt;/p&gt;</description>
      <pubDate>Mon, 01 Jan 2024 12:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Article Two</title>
      <link>https://example.com/2</link>
      <guid>guid-2</guid>
      <description>Second item</description>
      <pubDate>Sun, 31 Dec 2023 12:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

const RSS_SINGLE_ITEM = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Solo Feed</title>
    <item>
      <title>Solo Article</title>
      <link>https://example.com/solo</link>
      <guid>guid-solo</guid>
      <description>Only one</description>
      <pubDate>Mon, 01 Jan 2024 12:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

const RSS_CDATA = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <item>
      <title>CDATA Article</title>
      <link>https://example.com/c</link>
      <guid>guid-c</guid>
      <description><![CDATA[<p>Rich content here</p>]]></description>
      <pubDate>Mon, 01 Jan 2024 12:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

const RSS_CONTENT_ENCODED = `<?xml version="1.0"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <item>
      <title>Content Encoded</title>
      <link>https://example.com/ce</link>
      <guid>guid-ce</guid>
      <content:encoded>Full HTML body here</content:encoded>
      <pubDate>Mon, 01 Jan 2024 12:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

const ATOM_FEED = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Feed</title>
  <entry>
    <title>Atom Article</title>
    <id>urn:uuid:abc123</id>
    <link rel="alternate" href="https://example.com/atom/1"/>
    <content type="html">Atom content text</content>
    <published>2024-01-01T12:00:00Z</published>
  </entry>
</feed>`;

const ATOM_MULTI_LINK = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Multi-link</title>
    <id>urn:uuid:mlk</id>
    <link rel="self" href="https://example.com/self"/>
    <link rel="alternate" href="https://example.com/alternate"/>
    <content>Content</content>
    <published>2024-01-01T12:00:00Z</published>
  </entry>
</feed>`;

// ── Handler tests ─────────────────────────────────────────────────────────────

describe("GET /api/feed — validation", () => {
  it("returns 400 when url param is missing", async () => {
    const res = makeRes();
    await handler(makeReq({}), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0]).toMatchObject({ status: "error" });
  });

  it("returns 400 when url param is empty string", async () => {
    const res = makeRes();
    await handler(makeReq({ url: "" }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe("GET /api/feed — upstream fetch", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches the provided URL", async () => {
    fetch.mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(RSS_TWO_ITEMS) });
    const res = makeRes();
    await handler(makeReq({ url: "https://feeds.example.com/rss" }), res);
    expect(fetch).toHaveBeenCalledWith(
      "https://feeds.example.com/rss",
      expect.objectContaining({ headers: expect.objectContaining({ "User-Agent": expect.stringContaining("NewsDesk") }) })
    );
  });

  it("returns error status (not 4xx) when upstream returns non-200", async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 404 });
    const res = makeRes();
    await handler(makeReq({ url: "https://example.com/gone" }), res);
    const body = res.json.mock.calls[0][0];
    expect(body.status).toBe("error");
    expect(body.message).toContain("404");
    // handler returns 200 to caller; error is in body
    expect(res.status).not.toHaveBeenCalled();
  });

  it("returns error status on network failure", async () => {
    fetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const res = makeRes();
    await handler(makeReq({ url: "https://example.com/feed" }), res);
    const body = res.json.mock.calls[0][0];
    expect(body.status).toBe("error");
    expect(body.message).toBe("ECONNREFUSED");
  });

  it("returns error status on timeout (AbortError)", async () => {
    fetch.mockRejectedValueOnce(Object.assign(new Error("The operation was aborted"), { name: "AbortError" }));
    const res = makeRes();
    await handler(makeReq({ url: "https://slow.example.com/feed" }), res);
    expect(res.json.mock.calls[0][0].status).toBe("error");
  });

  it("parses RSS 2.0 with two items", async () => {
    fetch.mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(RSS_TWO_ITEMS) });
    const res = makeRes();
    await handler(makeReq({ url: "https://example.com/rss" }), res);
    const body = res.json.mock.calls[0][0];
    expect(body.status).toBe("ok");
    expect(body.items).toHaveLength(2);
    expect(body.items[0]).toMatchObject({ title: "Article One", link: "https://example.com/1", guid: "guid-1" });
    expect(body.items[1]).toMatchObject({ title: "Article Two", link: "https://example.com/2" });
  });

  it("parses Atom feed correctly", async () => {
    fetch.mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(ATOM_FEED) });
    const res = makeRes();
    await handler(makeReq({ url: "https://example.com/atom" }), res);
    const body = res.json.mock.calls[0][0];
    expect(body.status).toBe("ok");
    expect(body.items[0]).toMatchObject({
      title: "Atom Article",
      link: "https://example.com/atom/1",
      guid: "urn:uuid:abc123",
      pubDate: "2024-01-01T12:00:00Z",
    });
  });

  it("prefers rel=alternate link in Atom multi-link entry", async () => {
    fetch.mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(ATOM_MULTI_LINK) });
    const res = makeRes();
    await handler(makeReq({ url: "https://example.com/atom" }), res);
    expect(res.json.mock.calls[0][0].items[0].link).toBe("https://example.com/alternate");
  });

  it("handles CDATA description", async () => {
    fetch.mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(RSS_CDATA) });
    const res = makeRes();
    await handler(makeReq({ url: "https://example.com/rss" }), res);
    const item = res.json.mock.calls[0][0].items[0];
    expect(item.description).toContain("Rich content here");
  });

  it("prefers content:encoded over description when present", async () => {
    fetch.mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(RSS_CONTENT_ENCODED) });
    const res = makeRes();
    await handler(makeReq({ url: "https://example.com/rss" }), res);
    const item = res.json.mock.calls[0][0].items[0];
    expect(item.description).toBe("Full HTML body here");
  });
});

// ── parseItems unit tests ─────────────────────────────────────────────────────

describe("parseItems()", () => {
  it("returns empty array for empty object", () => {
    expect(parseItems({})).toEqual([]);
  });

  it("returns empty array for null", () => {
    expect(parseItems(null)).toEqual([]);
  });

  it("returns empty array when RSS channel has no items", () => {
    expect(parseItems({ rss: { channel: {} } })).toEqual([]);
  });

  it("returns empty array when Atom feed has no entries", () => {
    expect(parseItems({ feed: {} })).toEqual([]);
  });

  it("handles single RSS item (not wrapped in array by parser)", () => {
    const parsed = {
      rss: {
        channel: {
          item: {
            title: "Solo",
            link: "https://example.com/solo",
            guid: "g-solo",
            description: "content",
            pubDate: "2024-01-01",
          },
        },
      },
    };
    const items = parseItems(parsed);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Solo");
  });

  it("handles single Atom entry (not wrapped in array by parser)", () => {
    const parsed = {
      feed: {
        entry: {
          title: "Solo Atom",
          id: "urn:solo",
          link: { "@_rel": "alternate", "@_href": "https://example.com/atom-solo" },
          content: "content",
          published: "2024-01-01T00:00:00Z",
        },
      },
    };
    const items = parseItems(parsed);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Solo Atom");
    expect(items[0].link).toBe("https://example.com/atom-solo");
  });

  it("falls back to link as guid when guid is missing", () => {
    const parsed = {
      rss: {
        channel: {
          item: { title: "No GUID", link: "https://example.com/no-guid", description: "", pubDate: "" },
        },
      },
    };
    expect(parseItems(parsed)[0].guid).toBe("https://example.com/no-guid");
  });

  it("falls back to updated when published is missing in Atom", () => {
    const parsed = {
      feed: {
        entry: {
          title: "Updated only",
          id: "urn:upd",
          link: { "@_href": "https://example.com/upd" },
          content: "",
          updated: "2024-06-01T00:00:00Z",
        },
      },
    };
    expect(parseItems(parsed)[0].pubDate).toBe("2024-06-01T00:00:00Z");
  });
});
