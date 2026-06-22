import { put, get } from "@vercel/blob";

const PREFS_PATH = "newsdesk-prefs.json";

export default async function handler(req, res) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.json({ status: "ok", data: null });
  }

  if (req.method === "GET") {
    try {
      const result = await get(PREFS_PATH, { access: "private" });
      if (!result) return res.json({ status: "ok", data: null });
      const data = await new Response(result.stream).json();
      return res.json({ status: "ok", data });
    } catch {
      return res.json({ status: "ok", data: null });
    }
  }

  if (req.method === "POST") {
    try {
      const body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
      await put(PREFS_PATH, body, {
        access: "private",
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
