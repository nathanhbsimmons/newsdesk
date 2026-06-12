import { put, list } from "@vercel/blob";

const PREFS_PATH = "newsdesk-prefs.json";

export default async function handler(req, res) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.json({ status: "ok", data: null });
  }

  if (req.method === "GET") {
    try {
      const { blobs } = await list({ prefix: PREFS_PATH });
      const found = blobs.find(b => b.pathname === PREFS_PATH);
      if (!found) return res.json({ status: "ok", data: null });
      const r = await fetch(found.downloadUrl);
      const data = await r.json();
      return res.json({ status: "ok", data });
    } catch {
      return res.json({ status: "ok", data: null });
    }
  }

  if (req.method === "POST") {
    try {
      const body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
      await put(PREFS_PATH, body, {
        access: "public",
        contentType: "application/json",
        addRandomSuffix: false,
        allowOverwrite: true,
      });
      return res.json({ status: "ok" });
    } catch (err) {
      return res.json({ status: "error", message: err.message });
    }
  }

  res.status(405).end();
}
