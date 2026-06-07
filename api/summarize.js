function stripHtml(html) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, " ")
    .trim();
}

async function fetchPageContent(link) {
  try {
    const r = await fetch(link, {
      headers: { "User-Agent": "NewsDesk/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return "";
    const html = await r.text();
    // Extract main content heuristically: prefer <article> or <main>, else <body>
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const raw = articleMatch?.[1] ?? mainMatch?.[1] ?? bodyMatch?.[1] ?? html;
    return stripHtml(raw).slice(0, 3000);
  } catch {
    return "";
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { title, content, link } = req.body ?? {};
  if (!title) {
    return res.status(400).json({ error: "Missing title or content" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });
  }

  // If no content in the feed item, try fetching the linked page
  let articleContent = content?.trim() || "";
  if (!articleContent && link) {
    articleContent = await fetchPageContent(link);
  }

  const userMessage = articleContent
    ? `Summarize this tech article in 2-3 tight sentences. No preamble. Written for an engineering manager who wants the key insight fast.\n\nTitle: ${title}\n\nContent: ${articleContent}`
    : `Summarize what this tech article is likely about based on its title in 2-3 tight sentences. No preamble. Written for an engineering manager.\n\nTitle: ${title}`;

  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 300,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: data.error?.message ?? "Anthropic API error" });
    }

    const summary = data.content?.find(b => b.type === "text")?.text ?? "Failed to summarize.";
    return res.json({ summary });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
}
