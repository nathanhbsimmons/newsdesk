export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { title, content } = req.body ?? {};
  if (!title || !content) {
    return res.status(400).json({ error: "Missing title or content" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });
  }

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
        messages: [{
          role: "user",
          content: `Summarize this tech article in 2-3 tight sentences. No preamble. Written for an engineering manager who wants the key insight fast.\n\nTitle: ${title}\n\nContent: ${content}`,
        }],
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
