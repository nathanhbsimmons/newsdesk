import { XMLParser } from "fast-xml-parser";

const PARSER_OPTIONS = {
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  cdataPropName: "__cdata",
};

export function parseItems(parsed) {
  // RSS 2.0
  if (parsed?.rss?.channel) {
    const raw = [].concat(parsed.rss.channel.item ?? []);
    return raw.map((item) => ({
      title:       String(item.title?.["#text"] ?? item.title ?? ""),
      link:        String(item.link ?? item.guid?.["#text"] ?? item.guid ?? ""),
      guid:        String(item.guid?.["#text"] ?? item.guid ?? item.link ?? ""),
      description: String(item["content:encoded"] ?? item.description?.["__cdata"] ?? item.description ?? ""),
      pubDate:     String(item.pubDate ?? ""),
    }));
  }

  // Atom
  if (parsed?.feed) {
    const raw = [].concat(parsed.feed.entry ?? []);
    return raw.map((entry) => {
      const links = [].concat(entry.link ?? []);
      const href =
        links.find((l) => l["@_rel"] === "alternate")?.["@_href"] ??
        links[0]?.["@_href"] ??
        String(entry.link ?? "");
      return {
        title:       String(entry.title?.["#text"] ?? entry.title ?? ""),
        link:        href,
        guid:        String(entry.id ?? href ?? ""),
        description: String(entry.content?.["#text"] ?? entry.content ?? entry.summary?.["#text"] ?? entry.summary ?? ""),
        pubDate:     String(entry.published ?? entry.updated ?? ""),
      };
    });
  }

  return [];
}

export default async function handler(req, res) {
  const { url } = req.query ?? {};
  if (!url) {
    return res.status(400).json({ status: "error", message: "Missing url parameter" });
  }

  try {
    const upstream = await fetch(url, {
      headers: { "User-Agent": "NewsDesk/1.0 RSS Reader" },
      signal: AbortSignal.timeout(8000),
    });

    if (!upstream.ok) {
      return res.json({ status: "error", message: `Feed returned HTTP ${upstream.status}` });
    }

    const xml = await upstream.text();
    const parser = new XMLParser(PARSER_OPTIONS);
    const parsed = parser.parse(xml);
    const items = parseItems(parsed);

    return res.json({ status: "ok", items });
  } catch (err) {
    return res.json({ status: "error", message: err.message ?? "Unknown error" });
  }
}
