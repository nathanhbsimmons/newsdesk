import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@vercel/blob", () => ({
  get: vi.fn(),
  put: vi.fn(),
}));

import { get, put } from "@vercel/blob";
import handler from "../../api/prefs.js";

function makeRes() {
  const res = {};
  res.status = vi.fn(() => res);
  res.json   = vi.fn(() => res);
  res.end    = vi.fn(() => res);
  return res;
}

function makeReq(method = "GET", body = null) {
  return { method, body };
}

function makeStream(data) {
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  return new ReadableStream({
    start(c) { c.enqueue(bytes); c.close(); },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  delete process.env.BLOB_READ_WRITE_TOKEN;
});

// ── GET ───────────────────────────────────────────────────────────────────────

describe("GET /api/prefs", () => {
  it("returns data: null when BLOB_READ_WRITE_TOKEN is not set", async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    const res = makeRes();
    await handler(makeReq("GET"), res);
    expect(res.json).toHaveBeenCalledWith({ status: "ok", data: null });
    expect(get).not.toHaveBeenCalled();
  });

  it("returns data: null when blob does not exist", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";
    get.mockResolvedValueOnce(null);
    const res = makeRes();
    await handler(makeReq("GET"), res);
    expect(res.json).toHaveBeenCalledWith({ status: "ok", data: null });
  });

  it("returns parsed blob data when blob exists", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";
    const sources = [{ id: "a", name: "A Feed", url: "https://a.com", color: "#fff" }];
    get.mockResolvedValueOnce({
      statusCode: 200,
      stream: makeStream({ sources }),
      blob: {},
    });
    const res = makeRes();
    await handler(makeReq("GET"), res);
    expect(res.json).toHaveBeenCalledWith({ status: "ok", data: { sources } });
  });

  it("calls get() with the correct pathname and private access", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";
    get.mockResolvedValueOnce(null);
    await handler(makeReq("GET"), makeRes());
    expect(get).toHaveBeenCalledWith("newsdesk-prefs.json", { access: "private" });
  });

  it("returns data: null when get() throws", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";
    get.mockRejectedValueOnce(new Error("network error"));
    const res = makeRes();
    await handler(makeReq("GET"), res);
    expect(res.json).toHaveBeenCalledWith({ status: "ok", data: null });
  });

  it("returns data: null when stream JSON parse fails", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";
    const badBytes = new TextEncoder().encode("not-json{{{");
    get.mockResolvedValueOnce({
      statusCode: 200,
      stream: new ReadableStream({ start(c) { c.enqueue(badBytes); c.close(); } }),
      blob: {},
    });
    const res = makeRes();
    await handler(makeReq("GET"), res);
    expect(res.json).toHaveBeenCalledWith({ status: "ok", data: null });
  });
});

// ── POST ──────────────────────────────────────────────────────────────────────

describe("POST /api/prefs", () => {
  it("returns data: null when BLOB_READ_WRITE_TOKEN is not set", async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    const res = makeRes();
    await handler(makeReq("POST", { sources: [] }), res);
    expect(res.json).toHaveBeenCalledWith({ status: "ok", data: null });
    expect(put).not.toHaveBeenCalled();
  });

  it("writes blob and returns ok on success", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";
    put.mockResolvedValueOnce({ url: "https://blob.example.com/prefs.json" });
    const res = makeRes();
    await handler(makeReq("POST", { sources: [{ id: "a" }] }), res);
    expect(res.json).toHaveBeenCalledWith({ status: "ok" });
  });

  it("uses body as-is when body is already a string", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";
    put.mockResolvedValueOnce({});
    const bodyStr = '{"sources":[]}';
    await handler(makeReq("POST", bodyStr), makeRes());
    expect(put).toHaveBeenCalledWith("newsdesk-prefs.json", bodyStr, expect.any(Object));
  });

  it("JSON.stringifies object bodies before writing", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";
    put.mockResolvedValueOnce({});
    const body = { sources: [{ id: "x" }] };
    await handler(makeReq("POST", body), makeRes());
    expect(put).toHaveBeenCalledWith(
      "newsdesk-prefs.json",
      JSON.stringify(body),
      expect.any(Object)
    );
  });

  it("uses private access, no random suffix, and allowOverwrite", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";
    put.mockResolvedValueOnce({});
    await handler(makeReq("POST", {}), makeRes());
    expect(put).toHaveBeenCalledWith(
      "newsdesk-prefs.json",
      expect.any(String),
      expect.objectContaining({
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
      })
    );
  });

  it("returns error when put() throws", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";
    put.mockRejectedValueOnce(new Error("write failed"));
    const res = makeRes();
    await handler(makeReq("POST", {}), res);
    expect(res.json).toHaveBeenCalledWith({ status: "error", message: "write failed" });
  });
});

// ── Other methods ─────────────────────────────────────────────────────────────

describe("Other HTTP methods", () => {
  beforeEach(() => {
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";
  });

  it("returns 405 for PUT", async () => {
    const res = makeRes();
    await handler(makeReq("PUT"), res);
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.end).toHaveBeenCalled();
  });

  it("returns 405 for DELETE", async () => {
    const res = makeRes();
    await handler(makeReq("DELETE"), res);
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.end).toHaveBeenCalled();
  });

  it("returns 405 for PATCH", async () => {
    const res = makeRes();
    await handler(makeReq("PATCH"), res);
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.end).toHaveBeenCalled();
  });
});
