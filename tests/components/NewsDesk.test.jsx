import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import NewsDesk from "../../src/NewsDesk.jsx";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ITEMS = [
  {
    title: "Test Article Alpha",
    link: "https://example.com/alpha",
    guid: "guid-alpha",
    description: "<p>Content for alpha article</p>",
    pubDate: new Date(Date.now() - 3_600_000).toISOString(),
  },
  {
    title: "Test Article Beta",
    link: "https://example.com/beta",
    guid: "guid-beta",
    description: "Content for beta article",
    pubDate: new Date(Date.now() - 7_200_000).toISOString(),
  },
];

function feedOk(items = ITEMS) {
  return { ok: true, json: () => Promise.resolve({ status: "ok", items }) };
}
function feedErr() {
  return { ok: true, json: () => Promise.resolve({ status: "error", message: "down" }) };
}
function summaryOk(text = "AI summary text.") {
  return { ok: true, json: () => Promise.resolve({ summary: text }) };
}

function setupFetch({ feedResponse = feedOk(), summarizeResponse = null } = {}) {
  return vi.fn((url) => {
    if (url === "/api/summarize" && summarizeResponse) return Promise.resolve(summarizeResponse);
    if (url.startsWith("/api/feed")) return Promise.resolve(feedResponse);
    return Promise.resolve(feedOk());
  });
}

// Shortcut: query within the sidebar <nav>
const sidebarNav = () => document.querySelector("nav");

// Wait until at least one "Test Article Alpha" is visible
const waitForArticles = () => screen.findAllByText("Test Article Alpha");

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", setupFetch());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  localStorage.clear();
});

// ── Rendering ─────────────────────────────────────────────────────────────────

describe("Rendering", () => {
  it("renders the NewsDesk heading", () => {
    render(<NewsDesk />);
    expect(screen.getByText("NewsDesk")).toBeInTheDocument();
  });

  it("renders the rss reader label", () => {
    render(<NewsDesk />);
    expect(screen.getByText(/rss reader/i)).toBeInTheDocument();
  });

  it("renders all six default sources in the sidebar", () => {
    render(<NewsDesk />);
    const nav = sidebarNav();
    for (const label of ["TLDR", "Platformer", "404 Media", "Pragmatic Eng.", "Techmeme", "Dev.to"]) {
      expect(within(nav).getByText(label)).toBeInTheDocument();
    }
  });

  it("renders 'All sources' nav item", () => {
    render(<NewsDesk />);
    expect(within(sidebarNav()).getByText("All sources")).toBeInTheDocument();
  });

  it("renders 'Dismissed' nav item", () => {
    render(<NewsDesk />);
    expect(within(sidebarNav()).getByText("Dismissed")).toBeInTheDocument();
  });

  it("renders '+ Add RSS source' button", () => {
    render(<NewsDesk />);
    expect(screen.getByText("+ Add RSS source")).toBeInTheDocument();
  });

  it("renders '↻ Refresh all feeds' button", () => {
    render(<NewsDesk />);
    expect(screen.getByText("↻ Refresh all feeds")).toBeInTheDocument();
  });
});

// ── Loading & data fetching ───────────────────────────────────────────────────

describe("Data fetching", () => {
  it("shows loading spinner before feeds return", () => {
    render(<NewsDesk />);
    expect(screen.getByText(/fetching feeds/i)).toBeInTheDocument();
  });

  it("calls /api/feed once per default source (6 calls)", async () => {
    render(<NewsDesk />);
    await waitForArticles();
    const feedCalls = fetch.mock.calls.filter(([u]) => u.startsWith("/api/feed"));
    expect(feedCalls).toHaveLength(6);
  });

  it("encodes the source URL in the feed API call", async () => {
    render(<NewsDesk />);
    await waitForArticles();
    const [url] = fetch.mock.calls.find(([u]) => u.startsWith("/api/feed"));
    expect(url).toMatch(/\/api\/feed\?url=https%3A/);
  });

  it("shows 12 articles (6 sources × 2 items) after all feeds load", async () => {
    render(<NewsDesk />);
    const alphas = await waitForArticles();
    expect(alphas).toHaveLength(6);
    expect(screen.getAllByText("Test Article Beta")).toHaveLength(6);
  });

  it("shows error indicator for failed feeds", async () => {
    vi.stubGlobal("fetch", setupFetch({ feedResponse: feedErr() }));
    render(<NewsDesk />);
    await waitFor(() => {
      expect(screen.getAllByText("err").length).toBeGreaterThan(0);
    });
  });

  it("shows 'All caught up' when no articles loaded", async () => {
    vi.stubGlobal("fetch", setupFetch({ feedResponse: feedOk([]) }));
    render(<NewsDesk />);
    await screen.findByText("All caught up ✓");
  });

  it("persists fetched articles in localStorage", async () => {
    render(<NewsDesk />);
    await waitForArticles();
    const stored = JSON.parse(localStorage.getItem("nd-articles") ?? "[]");
    expect(stored.some((a) => a.title === "Test Article Alpha")).toBe(true);
  });

  it("hydrates articles from localStorage before fetch completes", async () => {
    const cached = [{
      id: "tldr::cached", sourceId: "tldr", sourceName: "TLDR", sourceColor: "#4FC3F7",
      title: "Cached Headline", link: "https://example.com/cached",
      excerpt: "cached", content: "cached", pubDate: new Date().toISOString(),
    }];
    localStorage.setItem("nd-articles", JSON.stringify(cached));
    vi.stubGlobal("fetch", setupFetch({ feedResponse: feedOk([]) }));
    render(<NewsDesk />);
    expect(await screen.findByText("Cached Headline")).toBeInTheDocument();
  });

  it("loads sources from localStorage on mount", async () => {
    const customSources = [
      { id: "custom-1", name: "Custom Feed", url: "https://custom.com/feed", color: "#aaa" },
    ];
    localStorage.setItem("nd-sources", JSON.stringify(customSources));
    render(<NewsDesk />);
    expect(await within(sidebarNav()).findByText("Custom Feed")).toBeInTheDocument();
    expect(within(sidebarNav()).queryByText("TLDR")).not.toBeInTheDocument();
  });

  it("↻ refresh button triggers a new round of feed fetches", async () => {
    render(<NewsDesk />);
    await waitForArticles();
    const before = fetch.mock.calls.filter(([u]) => u.startsWith("/api/feed")).length;
    fireEvent.click(screen.getByText("↻ Refresh all feeds"));
    await waitFor(() => {
      const after = fetch.mock.calls.filter(([u]) => u.startsWith("/api/feed")).length;
      expect(after).toBeGreaterThan(before);
    });
  });
});

// ── Dismiss / undismiss ───────────────────────────────────────────────────────

describe("Dismiss / Undismiss", () => {
  it("dismissing an article removes it from the active list", async () => {
    render(<NewsDesk />);
    const alphas = await waitForArticles();
    const initialCount = alphas.length;
    fireEvent.click(screen.getAllByText(/✕ Dismiss/)[0]);
    await waitFor(() => {
      expect(screen.getAllByText("Test Article Alpha").length).toBeLessThan(initialCount);
    });
  });

  it("persists dismissed IDs in localStorage", async () => {
    render(<NewsDesk />);
    await waitForArticles();
    fireEvent.click(screen.getAllByText(/✕ Dismiss/)[0]);
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem("nd-dismissed") ?? "[]");
      expect(stored.length).toBeGreaterThan(0);
    });
  });

  it("shows dismissed articles in the Dismissed view", async () => {
    render(<NewsDesk />);
    await waitForArticles();
    fireEvent.click(screen.getAllByText(/✕ Dismiss/)[0]);
    fireEvent.click(within(sidebarNav()).getByText("Dismissed"));
    await waitFor(() => screen.getAllByText("Test Article Alpha"));
  });

  it("shows '↩ Restore' button in dismissed view", async () => {
    render(<NewsDesk />);
    await waitForArticles();
    fireEvent.click(screen.getAllByText(/✕ Dismiss/)[0]);
    fireEvent.click(within(sidebarNav()).getByText("Dismissed"));
    expect(await screen.findByText("↩ Restore")).toBeInTheDocument();
  });

  it("restoring an article clears it from localStorage dismissed set", async () => {
    render(<NewsDesk />);
    await waitForArticles();
    fireEvent.click(screen.getAllByText(/✕ Dismiss/)[0]);
    fireEvent.click(within(sidebarNav()).getByText("Dismissed"));
    await screen.findByText("↩ Restore");
    fireEvent.click(screen.getAllByText("↩ Restore")[0]);
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem("nd-dismissed") ?? "[]");
      expect(stored.length).toBe(0);
    });
  });

  it("shows 'Nothing dismissed yet.' when dismissed list is empty", async () => {
    render(<NewsDesk />);
    await waitForArticles();
    fireEvent.click(within(sidebarNav()).getByText("Dismissed"));
    expect(await screen.findByText("Nothing dismissed yet.")).toBeInTheDocument();
  });

  it("loads dismissed IDs from localStorage on mount", async () => {
    const sources = ["tldr", "platformer", "404media", "pragmatic", "techmeme", "devto"];
    const ids = sources.map((s) => `${s}::guid-alpha`);
    localStorage.setItem("nd-dismissed", JSON.stringify(ids));
    render(<NewsDesk />);
    await screen.findAllByText("Test Article Beta");
    expect(screen.queryAllByText("Test Article Alpha").length).toBe(0);
  });
});

// ── Source filtering ──────────────────────────────────────────────────────────

describe("Source filtering", () => {
  it("clicking a source nav item shows the filter label in the header", async () => {
    render(<NewsDesk />);
    // Click TLDR in the nav (not in an article badge)
    fireEvent.click(within(sidebarNav()).getByText("TLDR"));
    expect(await screen.findByText("/ TLDR")).toBeInTheDocument();
  });

  it("clicking 'All sources' clears the active filter", async () => {
    render(<NewsDesk />);
    fireEvent.click(within(sidebarNav()).getByText("TLDR"));
    await screen.findByText("/ TLDR");
    fireEvent.click(within(sidebarNav()).getByText("All sources"));
    await waitFor(() => {
      expect(screen.queryByText("/ TLDR")).not.toBeInTheDocument();
    });
  });

  it("filtering to a source shows only its articles", async () => {
    render(<NewsDesk />);
    await waitForArticles();
    fireEvent.click(within(sidebarNav()).getByText("TLDR"));
    await waitFor(() => {
      // Each source got the same 2-item mock, so TLDR has 1 "Alpha" and 1 "Beta"
      expect(screen.getAllByText("Test Article Alpha")).toHaveLength(1);
    });
  });
});

// ── Source management ─────────────────────────────────────────────────────────

describe("Source management", () => {
  it("clicking '+ Add RSS source' shows the add form", () => {
    render(<NewsDesk />);
    fireEvent.click(screen.getByText("+ Add RSS source"));
    expect(screen.getByPlaceholderText("Source name")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("RSS feed URL")).toBeInTheDocument();
  });

  it("clicking ✕ in the add form hides it", () => {
    render(<NewsDesk />);
    fireEvent.click(screen.getByText("+ Add RSS source"));
    // The close button has text "✕" and is inside the add-form area (aside footer)
    const aside = document.querySelector("aside");
    fireEvent.click(within(aside).getByText("✕"));
    expect(screen.queryByPlaceholderText("Source name")).not.toBeInTheDocument();
  });

  it("does not add source when name is empty", () => {
    render(<NewsDesk />);
    fireEvent.click(screen.getByText("+ Add RSS source"));
    fireEvent.change(screen.getByPlaceholderText("RSS feed URL"), { target: { value: "https://x.com/feed" } });
    fireEvent.click(screen.getByText("Add feed"));
    expect(localStorage.getItem("nd-sources")).toBeNull();
  });

  it("does not add source when URL is empty", () => {
    render(<NewsDesk />);
    fireEvent.click(screen.getByText("+ Add RSS source"));
    fireEvent.change(screen.getByPlaceholderText("Source name"), { target: { value: "My Blog" } });
    fireEvent.click(screen.getByText("Add feed"));
    expect(localStorage.getItem("nd-sources")).toBeNull();
  });

  it("adds a valid source and shows it in the sidebar", async () => {
    render(<NewsDesk />);
    fireEvent.click(screen.getByText("+ Add RSS source"));
    fireEvent.change(screen.getByPlaceholderText("Source name"), { target: { value: "My Blog" } });
    fireEvent.change(screen.getByPlaceholderText("RSS feed URL"), { target: { value: "https://myblog.com/feed" } });
    fireEvent.click(screen.getByText("Add feed"));
    expect(await within(sidebarNav()).findByText("My Blog")).toBeInTheDocument();
  });

  it("persists new source in localStorage", async () => {
    render(<NewsDesk />);
    fireEvent.click(screen.getByText("+ Add RSS source"));
    fireEvent.change(screen.getByPlaceholderText("Source name"), { target: { value: "My Blog" } });
    fireEvent.change(screen.getByPlaceholderText("RSS feed URL"), { target: { value: "https://myblog.com/feed" } });
    fireEvent.click(screen.getByText("Add feed"));
    await within(sidebarNav()).findByText("My Blog");
    const stored = JSON.parse(localStorage.getItem("nd-sources") ?? "[]");
    expect(stored.some((s) => s.name === "My Blog")).toBe(true);
  });

  it("pressing Enter on URL field submits the add form", async () => {
    render(<NewsDesk />);
    fireEvent.click(screen.getByText("+ Add RSS source"));
    fireEvent.change(screen.getByPlaceholderText("Source name"), { target: { value: "Enter Blog" } });
    fireEvent.change(screen.getByPlaceholderText("RSS feed URL"), { target: { value: "https://enterblog.com/feed" } });
    fireEvent.keyDown(screen.getByPlaceholderText("RSS feed URL"), { key: "Enter" });
    expect(await within(sidebarNav()).findByText("Enter Blog")).toBeInTheDocument();
  });

  it("hovering a source nav item reveals the remove (×) button", async () => {
    render(<NewsDesk />);
    const tldrLabel = within(sidebarNav()).getByText("TLDR");
    const navItem   = tldrLabel.parentElement;
    fireEvent.mouseEnter(navItem);
    await waitFor(() => {
      expect(within(navItem).getByRole("button")).toBeInTheDocument();
    });
  });

  it("clicking the remove button deletes the source from the sidebar", async () => {
    render(<NewsDesk />);
    const tldrLabel = within(sidebarNav()).getByText("TLDR");
    const navItem   = tldrLabel.parentElement;
    fireEvent.mouseEnter(navItem);
    await waitFor(() => within(navItem).getByRole("button"));
    fireEvent.click(within(navItem).getByRole("button"));
    await waitFor(() => {
      expect(within(sidebarNav()).queryByText("TLDR")).not.toBeInTheDocument();
    });
  });

  it("removing a source persists in localStorage", async () => {
    render(<NewsDesk />);
    const tldrLabel = within(sidebarNav()).getByText("TLDR");
    const navItem   = tldrLabel.parentElement;
    fireEvent.mouseEnter(navItem);
    await waitFor(() => within(navItem).getByRole("button"));
    fireEvent.click(within(navItem).getByRole("button"));
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem("nd-sources") ?? "[]");
      expect(stored.every((s) => s.id !== "tldr")).toBe(true);
    });
  });
});

// ── Article card interactions ─────────────────────────────────────────────────

describe("Article card", () => {
  it("shows article titles after load", async () => {
    render(<NewsDesk />);
    await waitForArticles();
  });

  it("shows '↗ Read' link with correct href", async () => {
    render(<NewsDesk />);
    await waitForArticles();
    const readLinks = screen.getAllByText("↗ Read");
    expect(readLinks.length).toBeGreaterThan(0);
    expect(readLinks[0].closest("a")).toHaveAttribute("href", "https://example.com/alpha");
  });

  it("shows '✦ AI Summary' button initially", async () => {
    render(<NewsDesk />);
    await waitForArticles();
    expect(screen.getAllByText("✦ AI Summary").length).toBeGreaterThan(0);
  });

  it("clicking the card header toggles ▼/▲ indicator", async () => {
    render(<NewsDesk />);
    await waitForArticles();
    // All cards start collapsed (▼). Click the first card header.
    const firstTitle = screen.getAllByText("Test Article Alpha")[0];
    // The clickable header is the div wrapping the title
    const header = firstTitle.closest("div[style*='cursor: pointer']")
      ?? firstTitle.parentElement;
    fireEvent.click(header);
    await waitFor(() => expect(screen.getAllByText("▲").length).toBeGreaterThan(0));
    fireEvent.click(header);
    await waitFor(() => expect(screen.queryAllByText("▲").length).toBe(0));
  });
});

// ── AI Summary ────────────────────────────────────────────────────────────────

describe("AI Summary", () => {
  it("calls /api/summarize with title and content", async () => {
    vi.stubGlobal("fetch", setupFetch({ summarizeResponse: summaryOk() }));
    render(<NewsDesk />);
    await waitForArticles();
    fireEvent.click(screen.getAllByText("✦ AI Summary")[0]);
    await waitFor(() => {
      const call = fetch.mock.calls.find(([u]) => u === "/api/summarize");
      expect(call).toBeTruthy();
      const body = JSON.parse(call[1].body);
      expect(body).toHaveProperty("title");
      expect(body).toHaveProperty("content");
    });
  });

  it("shows '⟳ Thinking…' while summary is in flight", async () => {
    let resolve;
    const pending = new Promise((r) => { resolve = r; });
    vi.stubGlobal("fetch", vi.fn((url) => {
      if (url === "/api/summarize") return pending.then(() => summaryOk());
      return Promise.resolve(feedOk());
    }));
    render(<NewsDesk />);
    await waitForArticles();
    fireEvent.click(screen.getAllByText("✦ AI Summary")[0]);
    await screen.findByText("⟳ Thinking…");
    resolve();
    await screen.findByText("AI summary text.");
  });

  it("renders the summary text returned from the API", async () => {
    vi.stubGlobal("fetch", setupFetch({ summarizeResponse: summaryOk("Incredible insight here.") }));
    render(<NewsDesk />);
    await waitForArticles();
    fireEvent.click(screen.getAllByText("✦ AI Summary")[0]);
    await screen.findByText("Incredible insight here.");
  });

  it("shows '✓ Summarized' on the button after completion", async () => {
    vi.stubGlobal("fetch", setupFetch({ summarizeResponse: summaryOk() }));
    render(<NewsDesk />);
    await waitForArticles();
    fireEvent.click(screen.getAllByText("✦ AI Summary")[0]);
    await screen.findByText("✓ Summarized");
  });

  it("shows 'Summary unavailable.' on fetch error", async () => {
    vi.stubGlobal("fetch", vi.fn((url) => {
      if (url === "/api/summarize") return Promise.reject(new Error("net fail"));
      return Promise.resolve(feedOk());
    }));
    render(<NewsDesk />);
    await waitForArticles();
    fireEvent.click(screen.getAllByText("✦ AI Summary")[0]);
    await screen.findByText("Summary unavailable.");
  });

  it("does not call summarize again if button is already summarized", async () => {
    vi.stubGlobal("fetch", setupFetch({ summarizeResponse: summaryOk() }));
    render(<NewsDesk />);
    await waitForArticles();
    fireEvent.click(screen.getAllByText("✦ AI Summary")[0]);
    await screen.findByText("✓ Summarized");
    const callsBefore = fetch.mock.calls.filter(([u]) => u === "/api/summarize").length;
    fireEvent.click(screen.getAllByText("✓ Summarized")[0]);
    await waitFor(() => {
      const callsAfter = fetch.mock.calls.filter(([u]) => u === "/api/summarize").length;
      expect(callsAfter).toBe(callsBefore);
    });
  });
});
