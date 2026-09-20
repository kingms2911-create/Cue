// Vercel serverless function. The Gemini key lives here, on the server, and never reaches the browser.
const { guard, sendError } = require("../lib/server");

const DEFAULT_MODEL = "gemini-2.5-flash";
const BASE = "https://generativelanguage.googleapis.com/v1beta/models/";
const MAX_PROMPT_CHARS = 12000;

function extractText(data) {
  const parts =
    data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .filter((p) => typeof p.text === "string" && !p.thought)
    .map((p) => p.text)
    .join("");
}

module.exports = async function handler(req, res) {
  // AI calls cost money, so if CUE_ACCESS_KEY is set on the server, it is required here too.
  if (!guard(req, res, { method: "POST", required: false, bucket: "generate", max: 15 })) return;

  const key = process.env.GEMINI_API_KEY;
  if (!key) return sendError(res, 500, "server_not_configured");

  const body = req.body || {};
  const mode = body.mode === "json" ? "json" : "stream";
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) return sendError(res, 400, "bad_request");
  if (prompt.length > MAX_PROMPT_CHARS) return sendError(res, 413, "prompt_too_large");

  const payload = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: Object.assign(
      { temperature: 0.9, maxOutputTokens: 8192 },
      mode === "json" ? { responseMimeType: "application/json" } : {}
    ),
  };
  const headers = { "Content-Type": "application/json", "x-goog-api-key": key };
  const base = process.env.GEMINI_BASE_URL || BASE;
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

  try {
    if (mode === "json") {
      const r = await fetch(base + model + ":generateContent", { method: "POST", headers, body: JSON.stringify(payload) });
      if (!r.ok) return sendError(res, r.status === 429 ? 429 : 502, r.status === 429 ? "rate_limited" : "upstream_error");
      const text = extractText(await r.json());
      if (!text) return sendError(res, 422, "refused");
      return res.status(200).json({ text });
    }

    const r = await fetch(base + model + ":streamGenerateContent?alt=sse", { method: "POST", headers, body: JSON.stringify(payload) });
    if (!r.ok) return sendError(res, r.status === 429 ? 429 : 502, r.status === 429 ? "rate_limited" : "upstream_error");

    res.status(200);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("X-Accel-Buffering", "no");

    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf = (buf + dec.decode(value, { stream: true })).replace(/\r\n/g, "\n");
      let idx;
      while ((idx = buf.indexOf("\n\n")) !== -1) {
        const evt = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        const line = evt.split("\n").find((l) => l.startsWith("data:"));
        if (!line) continue;
        try {
          const t = extractText(JSON.parse(line.slice(5).trim()));
          if (t) res.write(t);
        } catch (e) {
          /* skip malformed event */
        }
      }
    }
    res.end();
  } catch (e) {
    if (!res.headersSent) return sendError(res, 502, "upstream_error");
    res.end();
  }
};
