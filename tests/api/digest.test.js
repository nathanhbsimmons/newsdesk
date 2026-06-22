import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import handler from "../../api/digest.js";

function makeRes() {
  const res = {};
  res.status = vi.fn(() => res);
  res.json   = vi.fn(() => res);
  return res;
}

function makeReq(method = "POST", body = {}) {
  return { method, body };
}

const ARTICLES = [
  { sourceName: "TLDR",    title: "AI Coding Update",   excerpt: "About agentic coding tools" },
  { sourceName: "HN",      title: "Tech News Today",    excerpt: "Startup ecosystem news" },
  { sourceName: "Dev.to",  title: "React 19 patterns",  excerpt: "Frontend patterns" },
];

function anthropicOk(text) {
  return {
    ok: true,
    json: () => Promise.resolve({ content: [{ type: "text", text }] }),
  };
}

// ── Method guard ──────────────────────────────────────────────────────────────

describe("POST /api/digest — method guard", () => {
  it("returns 405 for GET", async () => {
    const res = makeRes();
    await handler(makeReq("GET", { articles: ARTICLES }), res);
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json.mock.calls[0][0]).toMatchObject({ error: expect.any(String) });
  });

  it("returns 405 for DELETE", async () => {
    const res = makeRes();
    await handler(makeReq("DELETE"), res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it("returns 405 for PATCH", async () => {
    const res = makeRes();
    await handler(makeReq("PATCH", { articles: ARTICLES }), res);
    expect(res.status).toHaveBeenCalledWith(405);
  });
});

// ── Validation ────────────────────────────────────────────────────────────────

describe("POST /api/digest — validation", () => {
  it("returns 400 when articles is missing", async () => {
    const res = makeRes();
    await handler(makeReq("POST", {}), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0]).toMatchObject({ error: expect.any(String) });
  });

  it("returns 400 when articles is an empty array", async () => {
    const res = makeRes();
    await handler(makeReq("POST", { articles: [] }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 400 when articles is not an array", async () => {
    const res = makeRes();
    await handler(makeReq("POST", { articles: "not-an-array" }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 400 when body is null", async () => {
    const res = makeRes();
    await handler({ method: "POST", body: null }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

// ── API key ───────────────────────────────────────────────────────────────────

describe("POST /api/digest — API key", () => {
  afterEach(() => { delete process.env.ANTHROPIC_API_KEY; });

  it("returns 500 when ANTHROPIC_API_KEY is not set", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const res = makeRes();
    await handler(makeReq("POST", { articles: ARTICLES }), res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].error).toMatch(/API_KEY/i);
  });
});

// ── Anthropic proxy ───────────────────────────────────────────────────────────

describe("POST /api/digest — Anthropic proxy", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    process.env.ANTHROPIC_API_KEY = "sk-test-key";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.ANTHROPIC_API_KEY;
  });

  it("calls the Anthropic messages endpoint", async () => {
    fetch.mockResolvedValueOnce(anthropicOk("[]"));
    await handler(makeReq("POST", { articles: ARTICLES }), makeRes());
    expect(fetch).toHaveBeenCalledWith(
      "https://api.anthropic.com/v1/messages",
      expect.any(Object)
    );
  });

  it("sends x-api-key and anthropic-version headers", async () => {
    fetch.mockResolvedValueOnce(anthropicOk("[]"));
    await handler(makeReq("POST", { articles: ARTICLES }), makeRes());
    const init = fetch.mock.calls[0][1];
    expect(init.headers["x-api-key"]).toBe("sk-test-key");
    expect(init.headers["anthropic-version"]).toBe("2023-06-01");
  });

  it("uses claude-sonnet-4-6 model", async () => {
    fetch.mockResolvedValueOnce(anthropicOk("[]"));
    await handler(makeReq("POST", { articles: ARTICLES }), makeRes());
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.model).toBe("claude-sonnet-4-6");
  });

  it("includes article titles in the user prompt", async () => {
    fetch.mockResolvedValueOnce(anthropicOk("[]"));
    await handler(makeReq("POST", { articles: ARTICLES }), makeRes());
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.messages[0].content).toContain("AI Coding Update");
    expect(body.messages[0].content).toContain("Tech News Today");
    expect(body.messages[0].content).toContain("React 19 patterns");
  });

  it("returns parsed picks on success", async () => {
    const picks = [
      { index: 1, reason: "Great article on coding tools" },
      { index: 2, reason: "Interesting startup news" },
    ];
    fetch.mockResolvedValueOnce(anthropicOk(JSON.stringify(picks)));
    const res = makeRes();
    await handler(makeReq("POST", { articles: ARTICLES }), res);
    expect(res.json.mock.calls[0][0]).toMatchObject({ picks });
  });

  it("extracts JSON array even when surrounded by prose", async () => {
    const picks = [{ index: 1, reason: "Great" }];
    const textWithProse = `Here are my picks:\n${JSON.stringify(picks)}\nThose are my choices.`;
    fetch.mockResolvedValueOnce(anthropicOk(textWithProse));
    const res = makeRes();
    await handler(makeReq("POST", { articles: ARTICLES }), res);
    expect(res.json.mock.calls[0][0].picks).toEqual(picks);
  });

  it("returns empty picks when Anthropic returns no text block", async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ content: [] }),
    });
    const res = makeRes();
    await handler(makeReq("POST", { articles: ARTICLES }), res);
    expect(res.json.mock.calls[0][0].picks).toEqual([]);
  });

  it("returns empty picks when response text has no JSON array", async () => {
    fetch.mockResolvedValueOnce(anthropicOk("I cannot pick any articles."));
    const res = makeRes();
    await handler(makeReq("POST", { articles: ARTICLES }), res);
    expect(res.json.mock.calls[0][0].picks).toEqual([]);
  });

  it("returns upstream error status when Anthropic responds with error", async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: () => Promise.resolve({ error: { message: "Rate limit exceeded" } }),
    });
    const res = makeRes();
    await handler(makeReq("POST", { articles: ARTICLES }), res);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json.mock.calls[0][0].error).toBe("Rate limit exceeded");
  });

  it("returns 500 on fetch network error", async () => {
    fetch.mockRejectedValueOnce(new Error("connection timeout"));
    const res = makeRes();
    await handler(makeReq("POST", { articles: ARTICLES }), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("includes liked and disliked preferences in user prompt when provided", async () => {
    fetch.mockResolvedValueOnce(anthropicOk("[]"));
    const preferences = {
      liked:    [{ title: "Loved this AI article", sourceName: "TLDR" }],
      disliked: [{ title: "Too basic tutorial",    sourceName: "Dev.to" }],
    };
    await handler(makeReq("POST", { articles: ARTICLES, preferences }), makeRes());
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.messages[0].content).toContain("Loved this AI article");
    expect(body.messages[0].content).toContain("Too basic tutorial");
  });

  it("does not include preferences section when prefs are empty", async () => {
    fetch.mockResolvedValueOnce(anthropicOk("[]"));
    const preferences = { liked: [], disliked: [] };
    await handler(makeReq("POST", { articles: ARTICLES, preferences }), makeRes());
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.messages[0].content).not.toContain("recent signals");
  });

  it("slices articles list to at most 60 entries", async () => {
    const manyArticles = Array.from({ length: 70 }, (_, i) => ({
      sourceName: "Src", title: `Article ${i + 1}`, excerpt: "content",
    }));
    fetch.mockResolvedValueOnce(anthropicOk("[]"));
    await handler(makeReq("POST", { articles: manyArticles }), makeRes());
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.messages[0].content).toContain("Article 60");
    expect(body.messages[0].content).not.toContain("Article 61");
  });

  it("handles null excerpt gracefully without throwing", async () => {
    const articlesWithNullExcerpt = [
      { sourceName: "Src", title: "No excerpt", excerpt: null },
    ];
    fetch.mockResolvedValueOnce(anthropicOk("[]"));
    const res = makeRes();
    await handler(makeReq("POST", { articles: articlesWithNullExcerpt }), res);
    expect(res.json.mock.calls[0][0]).toMatchObject({ picks: [] });
  });

  it("includes system prompt in the Anthropic request", async () => {
    fetch.mockResolvedValueOnce(anthropicOk("[]"));
    await handler(makeReq("POST", { articles: ARTICLES }), makeRes());
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.system).toBeTruthy();
    expect(typeof body.system).toBe("string");
    expect(body.system.length).toBeGreaterThan(100);
  });

  it("includes only liked when no dislikes provided", async () => {
    fetch.mockResolvedValueOnce(anthropicOk("[]"));
    const preferences = { liked: [{ title: "Great Post", sourceName: "TLDR" }], disliked: [] };
    await handler(makeReq("POST", { articles: ARTICLES, preferences }), makeRes());
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.messages[0].content).toContain("Great Post");
    expect(body.messages[0].content).not.toContain("disliked recently");
  });

  it("includes only disliked when no likes provided", async () => {
    fetch.mockResolvedValueOnce(anthropicOk("[]"));
    const preferences = { liked: [], disliked: [{ title: "Boring Post", sourceName: "Dev.to" }] };
    await handler(makeReq("POST", { articles: ARTICLES, preferences }), makeRes());
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.messages[0].content).toContain("Boring Post");
    expect(body.messages[0].content).not.toContain("Articles you've liked recently");
  });

  it("falls back to 'Anthropic error' when error response has no message field", async () => {
    fetch.mockResolvedValueOnce({
      ok: false, status: 500,
      json: () => Promise.resolve({ error: {} }),
    });
    const res = makeRes();
    await handler(makeReq("POST", { articles: ARTICLES }), res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].error).toBe("Anthropic error");
  });

  it("falls back to 'Internal error' when caught error has no message property", async () => {
    fetch.mockRejectedValueOnce("plain string thrown");
    const res = makeRes();
    await handler(makeReq("POST", { articles: ARTICLES }), res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].error).toBe("Internal error");
  });
});
