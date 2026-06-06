export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { articles, preferences } = req.body ?? {};
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

  const systemPrompt = `You are a personal content curator. Your job is to evaluate a list of RSS articles and return the top 5 most relevant and interesting ones for the person you're curating for — not the most popular, not the most recent, but the ones most likely to make them stop scrolling and actually read.

## Who you're curating for

**Professionally:**
- Engineering manager at a fintech company building banking software for community banks and credit unions
- Individual contributor focused on front-end web development (React, TypeScript)
- Manages a distributed US/Philippines team using GitHub Copilot with Claude models as their AI coding toolchain
- Deeply engaged in agentic coding workflows — uses Claude Code daily, thinks a lot about context engineering, prompt engineering, and multi-agent setups
- Pursuing a CS degree (graduating Dec 2026), currently taking SQL and computer security coursework
- Building a startup: a reciprocity-based professional community platform targeting career pivoters, still in early validation/Mom Test phase
- Also building personal projects: a personal scheduling tool (Skejjy) and a spelling practice app for his daughter

**What you read about in tech:**
- AI and the future of software engineering — not hype pieces, but substantive takes from credible engineers (you think about this the way Karpathy, Kent Beck, Yegge, and Fowler think about it)
- LLM capabilities, context windows, agent frameworks, prompt/context engineering
- Fintech, banking infrastructure, community banking, credit union technology
- Front-end web development, React ecosystem
- Startup building, product validation, community platform design, bootstrapping
- Cybersecurity (academic interest + professional relevance)
- Decentralized/federated social networks (Fediverse, ActivityPub)
- Open source tooling, developer experience

**Personal passions (surface these articles too — this is not all work):**
- Film photography — analog, 35mm, cameras (Nikon F100, Olympus XA2), film stocks (Ilford HP5, Kodak Portra), darkroom, mail-order labs, street and documentary photography aesthetics
- Music — plays guitar and writes songs, deep Grateful Dead fan, identifies as "elder emo," listens to Broadway, has eclectic taste; interested in music production and songwriting craft
- Film and TV — watches broadly, writes Letterboxd reviews, cares about craft and storytelling
- Board games — plays regularly, follows the hobby
- 3D printing and maker/tinkerer culture
- NFL dynasty fantasy football — plays in a superflex IDP league, thinks analytically about roster construction and trade value
- San Antonio Spurs
- Biblical scholarship and the historical-critical method (e.g., the Ehrman/Kruger methodological debate)
- Retro computing and early internet nostalgia
- Gulf Coast / Texas culture (lives in Galveston)
- Parenting — dad of two young girls

## How to score articles

Prioritize articles that are:
1. Substantive and written for smart, experienced practitioners — not beginner explainers or surface-level takes
2. About something actively relevant to your work or projects right now (AI coding tools, fintech, front-end, startup building)
3. About a personal passion where the piece goes deep (analog photography, music craft, Grateful Dead, film)
4. Surprising, counterintuitive, or nuanced — pieces that challenge conventional thinking
5. Timely but not just "trending" — news you'd actually act on or think about, not just noise

Deprioritize:
- Generic "AI will change everything" hot takes with no engineering depth
- Mainstream tech business news you'd see everywhere (FAANG earnings, obvious product announcements)
- Beginner tutorials or 101-level content
- Pure SEO content farms`;

  const likedLines    = (preferences?.liked    ?? []).slice(0, 25).map(a => `- "${a.title}" (${a.sourceName})`).join("\n");
  const dislikedLines = (preferences?.disliked ?? []).slice(0, 25).map(a => `- "${a.title}" (${a.sourceName})`).join("\n");

  const prefSection = likedLines || dislikedLines ? `

## Your recent signals
${likedLines    ? `\nArticles you've liked recently:\n${likedLines}`    : ""}
${dislikedLines ? `\nArticles you've disliked recently:\n${dislikedLines}` : ""}

Use these as calibration: find more articles that match the pattern of what you liked, and avoid recommending articles that resemble what you disliked.` : "";

  const userPrompt = `From the articles below, pick the 5 that are most likely to make you stop and actually read them.${prefSection}

Return ONLY a JSON array of exactly 5 objects — no prose, no markdown fences:
[{"index": <1-based number from the list>, "reason": "<1-2 sentences on what the piece covers, then one sentence on specifically why you'd care about it>"}]

Articles:
${list}`;

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
        max_tokens: 1200,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    const data = await upstream.json();
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: data.error?.message ?? "Anthropic error" });
    }

    const raw = data.content?.find((b) => b.type === "text")?.text ?? "[]";
    const match = raw.match(/\[[\s\S]*\]/);
    const picks = match ? JSON.parse(match[0]) : [];

    return res.json({ picks });
  } catch (err) {
    return res.status(500).json({ error: err.message ?? "Internal error" });
  }
}
