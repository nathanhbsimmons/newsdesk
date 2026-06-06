import { XMLParser } from "fast-xml-parser";

const PARSER_OPTIONS = {
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  cdataPropName: "__cdata",
};

// Safely extract a string from any fast-xml-parser value:
// plain string, { #text: "..." }, { __cdata: "..." }, or number.
function text(val) {
  if (val == null) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number") return String(val);
  // object with #text (element with attributes + text)
  if (val["#text"] != null) return String(val["#text"]);
  // object with __cdata (CDATA section)
  if (val["__cdata"] != null) return String(val["__cdata"]);
  return "";
}

export function parseItems(parsed) {
  // RSS 2.0
  if (parsed?.rss?.channel) {
    const raw = [].concat(parsed.rss.channel.item ?? []);
    return raw.map((item) => ({
      title:       text(item.title),
      link:        text(item.link) || text(item.guid),
      guid:        text(item.guid) || text(item.link),
      description: text(item["content:encoded"]) || text(item.description),
      pubDate:     text(item.pubDate),
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
        text(entry.link);
      return {
        title:       text(entry.title),
        link:        href ?? "",
        guid:        text(entry.id) || href || "",
        description: text(entry.content) || text(entry.summary),
        pubDate:     text(entry.published) || text(entry.updated),
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
