const { guard, sendError } = require("../lib/server");
const providers = require("../lib/providers");

module.exports = async function handler(req, res) {
  if (!guard(req, res, { method: "GET", required: true, bucket: "upload", max: 20 })) return;
  const q = req.query || {};
  const fileName = String(q.fileName || "").trim();
  if (!/^[\w][\w .()\-]{0,118}\.(mp4|mov)$/i.test(fileName)) {
    return sendError(res, 400, "bad_file", "Sirf MP4 ya MOV file allowed hai.");
  }
  try {
    const out = await providers.uploadUrl(fileName);
    if (out.status !== 200) return sendError(res, out.status, out.error, out.message);
    return res.status(200).json({ uploadUrl: out.uploadUrl, accessUrl: out.accessUrl, contentType: out.contentType });
  } catch (e) {
    return sendError(res, 502, "provider_error", "Upload URL nahi mil paya.");
  }
};
