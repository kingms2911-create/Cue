const { guard, sendError } = require("../lib/server");
const providers = require("../lib/providers");

module.exports = async function handler(req, res) {
  if (!guard(req, res, { method: "POST", required: true, bucket: "publish", max: 40 })) return;

  const b = req.body || {};
  const platform = String(b.platform || "");
  if (providers.PLATFORM_IDS.indexOf(platform) === -1) return sendError(res, 400, "bad_platform");

  const mediaUrl = String(b.mediaUrl || "").trim();
  if (!/^https:\/\//i.test(mediaUrl) || mediaUrl.length > 2000) {
    return sendError(res, 400, "bad_media_url", "Video ka public https URL chahiye.");
  }

  let scheduleAt = null;
  if (b.scheduleAt) {
    const d = new Date(b.scheduleAt);
    if (isNaN(d.getTime()) || d.getTime() < Date.now() + 2 * 60000) {
      return sendError(res, 400, "bad_schedule", "Schedule time kam se kam 2 minute aage ka hona chahiye.");
    }
    scheduleAt = d.toISOString();
  }

  const payload = {
    platform,
    title: String(b.title || "").slice(0, 255),
    text: String(b.text || "").slice(0, 6000),
    mediaUrl,
    scheduleAt,
    requestId: String(b.requestId || "").slice(0, 64),
  };

  try {
    const out = await providers.publish(payload);
    if (out.code === "not_configured") return sendError(res, 501, "not_configured", out.message);
    return res.status(200).json(out);
  } catch (e) {
    return res.status(200).json({ state: "failed", message: e && e.name === "AbortError" ? "Provider ne time par jawab nahi diya." : "Provider se connect nahi ho paya." });
  }
};
