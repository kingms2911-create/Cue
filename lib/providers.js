// Publishing providers: Ayrshare (official API aggregator) or a generic webhook (n8n, Make.com, Zapier).
const crypto = require("crypto");

const AYR_BASE = () => process.env.AYRSHARE_BASE_URL || "https://api.ayrshare.com/api";
const AYR_PLATFORM = {
  instagram: "instagram",
  facebook: "facebook",
  youtube: "youtube",
  linkedin: "linkedin",
  tiktok: "tiktok",
  x: "twitter",
};
const PLATFORM_IDS = Object.keys(AYR_PLATFORM);

function activeProvider() {
  if (process.env.AYRSHARE_API_KEY) return "ayrshare";
  if (process.env.PUBLISH_WEBHOOK_URL) return "webhook";
  return "none";
}

function ayrHeaders() {
  const h = { "Content-Type": "application/json", Authorization: "Bearer " + process.env.AYRSHARE_API_KEY };
  if (process.env.AYRSHARE_PROFILE_KEY) h["Profile-Key"] = process.env.AYRSHARE_PROFILE_KEY;
  return h;
}

async function fetchJson(url, opts, timeoutMs) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs || 25000);
  try {
    const r = await fetch(url, Object.assign({}, opts, { signal: ctl.signal }));
    const txt = await r.text();
    let data = null;
    try {
      data = txt ? JSON.parse(txt) : null;
    } catch (e) {
      data = { raw: txt.slice(0, 500) };
    }
    return { ok: r.ok, status: r.status, data };
  } finally {
    clearTimeout(timer);
  }
}

// Ayrshare wants UTC like 2026-07-08T12:30:00Z (no milliseconds).
function zulu(d) {
  return new Date(d).toISOString().replace(/\.\d{3}Z$/, "Z");
}

/* ---------- connections ---------- */
async function connections() {
  const provider = activeProvider();
  if (provider === "ayrshare") {
    const r = await fetchJson(AYR_BASE() + "/user", { headers: ayrHeaders() }, 15000);
    if (!r.ok) return { provider, connected: {}, error: "provider_error" };
    const active = (r.data && r.data.activeSocialAccounts) || [];
    const connected = {};
    PLATFORM_IDS.forEach((id) => (connected[id] = active.indexOf(AYR_PLATFORM[id]) > -1));
    return {
      provider,
      connected,
      accounts: active.length,
      connectUrl: process.env.CONNECT_URL || "https://app.ayrshare.com/social-accounts",
    };
  }
  if (provider === "webhook") {
    const list = (process.env.CONNECTED_PLATFORMS || "").split(",").map((s) => s.trim()).filter(Boolean);
    const connected = {};
    PLATFORM_IDS.forEach((id) => (connected[id] = list.length ? list.indexOf(id) > -1 : "webhook"));
    return { provider, connected, connectUrl: process.env.CONNECT_URL || "" };
  }
  return { provider: "none", connected: {} };
}

/* ---------- upload url (Ayrshare only) ---------- */
async function uploadUrl(fileName) {
  if (activeProvider() !== "ayrshare") {
    return { status: 501, error: "upload_not_supported", message: "Direct upload sirf Ayrshare provider ke saath hai. Video ka public URL paste karo." };
  }
  const ext = (fileName.split(".").pop() || "").toLowerCase();
  const q = "fileName=" + encodeURIComponent(fileName) + "&contentType=" + encodeURIComponent(ext);
  const r = await fetchJson(AYR_BASE() + "/media/uploadUrl?" + q, { headers: ayrHeaders() }, 15000);
  if (!r.ok || !r.data || !r.data.uploadUrl || !r.data.accessUrl) {
    return { status: 502, error: "provider_error", message: (r.data && r.data.message) || "Upload URL nahi mila (plan check karo)." };
  }
  return { status: 200, uploadUrl: r.data.uploadUrl, accessUrl: r.data.accessUrl, contentType: r.data.contentType || (ext === "mov" ? "video/quicktime" : "video/mp4") };
}

/* ---------- publish ---------- */
function mapAyrshare(r, ctx) {
  const d = r.data || {};
  const first = Array.isArray(d.postIds) && d.postIds[0] ? d.postIds[0] : {};
  const status = String(d.status || first.status || "").toLowerCase();
  const url = first.postUrl || "";
  const id = String(d.id || first.id || "");
  if (r.ok && (status === "success" || status === "scheduled" || /pend|process/.test(status))) {
    if (ctx.scheduled) return { state: "scheduled", id, url, message: "Schedule ho gaya." };
    if (ctx.asyncNow || /pend|process/.test(status)) return { state: "processing", id, url, message: "Provider process kar raha hai. 1 se 2 minute mein live hoga." };
    return { state: "done", id, url, message: "Publish ho gaya." };
  }
  const e0 = Array.isArray(d.errors) && d.errors[0];
  const msg = (e0 && e0.message) || d.message || (first && first.message) || "Publish fail ho gaya.";
  return { state: "failed", message: String(msg).slice(0, 300) };
}

async function publishAyrshare(p) {
  const body = {
    post: p.text || "",
    platforms: [AYR_PLATFORM[p.platform]],
    mediaUrls: [p.mediaUrl],
    isVideo: true,
  };
  let asyncNow = false;
  if (p.scheduleAt) {
    body.scheduleDate = zulu(p.scheduleAt);
  } else if (p.platform === "instagram" || p.platform === "facebook") {
    // Ayrshare recommends async processing (a near-future scheduleDate) for Reels and big videos.
    body.scheduleDate = zulu(Date.now() + 2 * 60000);
    asyncNow = true;
  }
  if (p.platform === "youtube") body.youTubeOptions = { title: p.title || "", shorts: true };
  if (p.platform === "instagram") body.instagramOptions = { shareReelsFeed: true };
  if (p.platform === "facebook") {
    body.faceBookOptions = { reels: true };
    if (p.title) body.faceBookOptions.title = p.title;
  }
  const r = await fetchJson(AYR_BASE() + "/post", { method: "POST", headers: ayrHeaders(), body: JSON.stringify(body) }, 45000);
  return mapAyrshare(r, { scheduled: !!p.scheduleAt, asyncNow });
}

async function publishWebhook(p) {
  const tags = (p.text || "").match(/#[\p{L}\p{N}_]+/gu) || [];
  const payload = {
    event: "cue.publish",
    version: 1,
    id: p.requestId || "",
    platform: p.platform,
    title: p.title || "",
    text: p.text || "",
    hashtags: tags,
    mediaUrl: p.mediaUrl,
    scheduleAt: p.scheduleAt || null,
    sentAt: new Date().toISOString(),
  };
  const raw = JSON.stringify(payload);
  const headers = { "Content-Type": "application/json" };
  if (process.env.WEBHOOK_SECRET) {
    headers["X-Cue-Signature"] = "sha256=" + crypto.createHmac("sha256", process.env.WEBHOOK_SECRET).update(raw).digest("hex");
  }
  const r = await fetchJson(process.env.PUBLISH_WEBHOOK_URL, { method: "POST", headers, body: raw }, 25000);
  if (!r.ok) return { state: "failed", message: "Webhook ne error diya (HTTP " + r.status + ")." };
  const d = r.data || {};
  const s = String(d.status || "").toLowerCase();
  const url = typeof d.url === "string" ? d.url : "";
  if (/^(done|published|success|posted)$/.test(s)) return { state: "done", url, message: "Publish ho gaya." };
  if (s === "scheduled") return { state: "scheduled", url, message: "Schedule ho gaya." };
  if (/fail|error/.test(s)) return { state: "failed", message: String(d.message || "Automation ne fail bataya.").slice(0, 300) };
  return { state: p.scheduleAt ? "scheduled" : "queued", url, message: p.scheduleAt ? "Schedule ke saath automation ko bheja." : "Automation (n8n / Make) ko bhej diya." };
}

async function publish(p) {
  const provider = activeProvider();
  if (provider === "ayrshare") return publishAyrshare(p);
  if (provider === "webhook") return publishWebhook(p);
  return { state: "failed", code: "not_configured", message: "Koi publishing provider set nahi hai." };
}

module.exports = { activeProvider, connections, uploadUrl, publish, PLATFORM_IDS, zulu };
