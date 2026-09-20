// Shared helpers for every serverless function: errors, access key, origin check, rate limit.
const crypto = require("crypto");

function sendError(res, status, code, message) {
  return res.status(status).json({ error: code, message: message || undefined });
}

function digest(s) {
  return crypto.createHash("sha256").update(String(s)).digest();
}

function clientIp(req) {
  return String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
}

// Best-effort limiter. Memory is per server instance; for a paid product use Upstash Redis or Vercel KV.
const buckets = new Map();
function rateLimited(bucket, ip, max, windowMs) {
  const now = Date.now();
  const key = bucket + ":" + ip;
  const list = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  list.push(now);
  buckets.set(key, list);
  if (buckets.size > 5000) buckets.clear();
  return list.length > max;
}

// Checks method, origin, rate limit and access key. Returns true when the request may continue.
// opts.required = true  -> CUE_ACCESS_KEY must be set on the server (publishing endpoints).
// opts.required = false -> key is enforced only if the server has one set (AI endpoint).
function guard(req, res, opts) {
  if (req.method !== opts.method) {
    sendError(res, 405, "method_not_allowed");
    return false;
  }
  const allowed = process.env.ALLOWED_ORIGIN;
  const origin = req.headers.origin;
  if (allowed && origin && origin !== allowed) {
    sendError(res, 403, "forbidden");
    return false;
  }
  if (rateLimited(opts.bucket, clientIp(req), opts.max || 30, 60000)) {
    sendError(res, 429, "rate_limited");
    return false;
  }
  const need = process.env.CUE_ACCESS_KEY;
  if (!need) {
    if (opts.required) {
      sendError(res, 503, "access_key_not_set", "Server par CUE_ACCESS_KEY set nahi hai.");
      return false;
    }
    return true;
  }
  const got = String(req.headers["x-cue-key"] || "");
  if (!crypto.timingSafeEqual(digest(got), digest(need))) {
    sendError(res, 401, "unauthorized", "Access key galat hai ya missing hai.");
    return false;
  }
  return true;
}

module.exports = { sendError, guard, clientIp, rateLimited };
