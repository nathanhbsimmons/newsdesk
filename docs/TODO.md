# Future dev notes

## Obsidian clip: full-article content (not just RSS abstract)

`buildObsidianClipUrl` (`src/utils.js`) currently pulls the clip body from
`article.content`/`article.excerpt`, which are both just the RSS feed's own
`description`/`content:encoded` field, truncated (2500 / 700 chars). For
feeds that only publish an abstract (e.g. arxiv), that's all the clip gets —
nowhere near the quality of Obsidian's browser Share Sheet clip, which reads
the live rendered page and runs its own readability+markdown extraction.

There's no way to trigger that same Safari-Share-Sheet → Obsidian-extension
flow headlessly — it only runs through the actual Share Sheet UI (which
always shows Obsidian's review screen, requiring a tap to save).

Real fix, if/when wanted: add a server-side scrape endpoint (e.g.
`/api/clip`) that fetches the article's own URL and runs a Readability-style
extraction (e.g. `@mozilla/readability` + `jsdom`) to get clean article
markdown, server-side. Swipe-left would call this first, then feed the
extracted body into the same `shortcuts://` payload instead of the RSS
excerpt. Stays fully silent (fetch happens on our server before the
Shortcuts trigger fires) and gets real full-article quality. Tradeoffs:
new dependency, added latency on swipe (fetch + parse before the Shortcut
fires), and scrape reliability varies by site (paywalls, JS-rendered
content Readability can't see without a headless browser).

Cheaper fallback considered and rejected for now: Shortcuts' own
"Get Contents of Web Page" action (raw HTTP fetch, no JS rendering, no
readability extraction) — silent but mediocre quality, often includes
nav/footer cruft.
