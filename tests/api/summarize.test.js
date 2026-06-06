import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import handler from "../../api/summarize.js";

function makeRes() {
  const res = {};
  res.status = vi.fn(() => res);
  res.json   = vi.fn(() => res);
  return res;
}

function makeReq(method = "POST", body = {}) {
  return { method, body };
}

const GOOD_BODY = { title: "Test Article", content: "Some interesting content about tech." };

const ANTHROPIC_OK = {
  content: [{ type: "text", text: "This is a two-sentence summary." }],
};

describe("POST /api/summarize — method guard", () => {
  it("returns 405 for GET", async () => {
    const res = makeRes();
    await handler(makeReq("GET", GOOD_BODY), res);
    expect(res.status).toHaveBeenCalledWith(405);
  });
  it("returns 405 for DELETE", async () => {
    const res = makeRes();
    await handler(makeReq("DELETE", GOOD_BODY), res);
    expect(res.status).toHaveBeenCalledWith(405);
  });
});

describe("POST /api/summarize — validation", () => {
  it("returns 400 when title is missing", async () => {
    const res = makeRes();
    await handler(makeReq("POST", { content: "content" }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0]).toMatchObject({ error: expect.any(String) });
  });
  it("returns 400 when content is missing", async () => {
    const res = makeRes();
    await handler(makeReq("POST", { title: "title" }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
  it("returns 400 when body is empty", async () => {
    const res = makeRes();
    await handler(makeReq("POST", {}), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
  it("returns 400 when body is null", async () => {
    const res = makeRes();
    await handler({ method: "POST", body: null }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe("POST /api/summarize — API key", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.ANTHROPIC_API_KEY;
  });

  it("returns 500 when ANTHROPIC_API_KEY is not set", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const res = makeRes();
    await handler(makeReq("POST", GOOD_BODY), res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].error).toMatch(/API_KEY/i);
  });
});

describe("POST /api/summarize — Anthropic proxy", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    process.env.ANTHROPIC_API_KEY = "sk-test-key";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.ANTHROPIC_API_KEY;
  });

  it("returns summary text on success", async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(ANTHROPIC_OK) });
    const res = makeRes();
    await handler(makeReq("POST", GOOD_BODY), res);
    expect(res.json).toHaveBeenCalledWith({ summary: "This is a two-sentence summary." });
    expect(res.status).not.toHaveBeenCalled();
  });

  it("calls the Anthropic messages endpoint", async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(ANTHROPIC_OK) });
    await handler(makeReq("POST", GOOD_BODY), makeRes());
    expect(fetch).toHaveBeenCalledWith(
      "https://api.anthropic.com/v1/messages",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("sends x-api-key header with the env key", async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(ANTHROPIC_OK) });
    await handler(makeReq("POST", GOOD_BODY), makeRes());
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ "x-api-key": "sk-test-key" }),
      })
    );
  });

  it("sends anthropic-version header", async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(ANTHROPIC_OK) });
    await handler(makeReq("POST", GOOD_BODY), makeRes());
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ "anthropic-version": "2023-06-01" }),
      })
    );
  });

  it("uses claude-sonnet-4-6 model", async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(ANTHROPIC_OK) });
    await handler(makeReq("POST", GOOD_BODY), makeRes());
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.model).toBe("claude-sonnet-4-6");
  });

  it("sends title and content in the user message", async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(ANTHROPIC_OK) });
    await handler(makeReq("POST", { title: "My Title", content: "My content" }), makeRes());
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.messages[0].content).toContain("My Title");
    expect(body.messages[0].content).toContain("My content");
  });

  it("returns upstream error message and status on Anthropic 429", async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: () => Promise.resolve({ error: { message: "Rate limit exceeded" } }),
    });
    const res = makeRes();
    await handler(makeReq("POST", GOOD_BODY), res);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json.mock.calls[0][0].error).toBe("Rate limit exceeded");
  });

  it("returns 500 on fetch network error", async () => {
    fetch.mockRejectedValueOnce(new Error("timeout"));
    const res = makeRes();
    await handler(makeReq("POST", GOOD_BODY), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("falls back gracefully when Anthropic response has no text block", async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ content: [] }),
    });
    const res = makeRes();
    await handler(makeReq("POST", GOOD_BODY), res);
    expect(res.json.mock.calls[0][0].summary).toBe("Failed to summarize.");
  });
});
