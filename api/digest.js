export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { articles } = req.body ?? {};
  if (!Array.isArray(articles) || articles.length === 0) {
    return res.status(400).json({ error: "Missing articles array" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });
  }

  const list = articles
    .slice(0, 60)
    .map((a, i) => `${i + 1}. [${a.sourceName}] ${a.title} — ${a.excerpt?.slice(0, 120) ?? ""}`)
    .join("\n");

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
        max_tokens: 800,
        messages: [{
          role: "user",
          content: `You are a news editor for a senior engineering manager. From the articles below, pick the 5 most important or interesting ones. Criteria: technical depth, industry impact, or things that will matter in the next 6–12 months. Skip fluff, listicles, and sponsored content.

Return ONLY a JSON array of exactly 5 objects with this shape (no prose, no markdown fences):
[{"index": <1-based number from the list>, "reason": "<one tight sentence on why this matters>"}]

Articles:
${list}`,
        }],
      }),
    });

    const data = await upstream.json();
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: data.error?.message ?? "Anthropic error" });
    }

    const raw = data.content?.find((b) => b.type === "text")?.text ?? "[]";
    // Extract JSON array even if the model wraps it
    const match = raw.match(/\[[\s\S]*\]/);
    const picks = match ? JSON.parse(match[0]) : [];

    return res.json({ picks });
  } catch (err) {
    return res.status(500).json({ error: err.message ?? "Internal error" });
  }
}
