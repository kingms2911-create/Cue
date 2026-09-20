const { guard, sendError } = require("../lib/server");
const providers = require("../lib/providers");

module.exports = async function handler(req, res) {
  if (!guard(req, res, { method: "GET", required: true, bucket: "connections", max: 30 })) return;
  try {
    const data = await providers.connections();
    return res.status(200).json(data);
  } catch (e) {
    return sendError(res, 502, "provider_error", "Provider se connect nahi ho paya.");
  }
};
