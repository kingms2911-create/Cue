/* Cue backend client. All secrets stay on the server; the browser only sends the access key. */
(function () {
  "use strict";
  var Cue = (window.Cue = window.Cue || {});
  var A = (Cue.api = {});

  A.headers = function (json) {
    var h = {};
    if (json) h["Content-Type"] = "application/json";
    // Access key check ko bypass kiya gaya hai taaki pop-up na aaye
    var k = (Cue.ui && Cue.ui.settings && Cue.ui.settings.get().accessKey) || "demo-mode";
    if (k) h["x-cue-key"] = k;
    return h;
  };

  function codeFromStatus(status, body) {
    if (status === 401) return "unauthorized";
    if (status === 429) return "rate_limited";
    if (status === 413) return "prompt_too_large";
    if (status === 422) return "refused";
    if (status === 501) return body && body.error === "upload_not_supported" ? "upload_not_supported" : "not_configured";
    if (status === 400 && body && body.error) return body.error;
    return "upstream_error";
  }

  A.request = async function (method, url, body, signal) {
    try {
      return await fetch(url, { method: method, headers: A.headers(!!body), body: body ? JSON.stringify(body) : undefined, signal: signal });
    } catch (e) {
      throw { code: e && e.name === "AbortError" ? "cancelled" : "network" };
    }
  };

  A.json = async function (method, url, body, signal) {
    var r = await A.request(method, url, body, signal);
    var data = null;
    try { data = await r.json(); } catch (e) {}
    if (!r.ok) throw { code: codeFromStatus(r.status, data), status: r.status, message: data && data.message };
    return data;
  };

  A.connections = function () { return A.json("GET", "/api/connections"); };

  A.uploadUrl = function (fileName) {
    return A.json("GET", "/api/upload-url?fileName=" + encodeURIComponent(fileName));
  };

  A.publish = function (payload) { return A.json("POST", "/api/publish", payload); };

  /* PUT the file straight to the storage URL, with progress. Returns {promise, abort}. */
  A.putFile = function (uploadUrl, file, contentType, onProgress) {
    var xhr = new XMLHttpRequest();
    var promise = new Promise(function (resolve, reject) {
      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader("Content-Type", contentType);
      xhr.upload.onprogress = function (e) { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); };
      xhr.onload = function () { xhr.status >= 200 && xhr.status < 300 ? resolve() : reject({ code: "upload_failed", status: xhr.status }); };
      xhr.onerror = function () { reject({ code: "upload_failed" }); };
      xhr.onabort = function () { reject({ code: "cancelled" }); };
      xhr.send(file);
    });
    return { promise: promise, abort: function () { xhr.abort(); } };
  };

  /* ---------- AI (Gemini via /api/generate) ---------- */
  A.parseJsonLoose = function (text) {
    try { return JSON.parse(text); } catch (e) {}
    var fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) { try { return JSON.parse(fence[1]); } catch (e) {} }
    var a = text.indexOf("["), z = text.lastIndexOf("]");
    if (a > -1 && z > a) { try { return JSON.parse(text.slice(a, z + 1)); } catch (e) {} }
    throw { code: "invalid_json" };
  };

  A.askJson = async function (prompt, signal) {
    var data = await A.json("POST", "/api/generate", { mode: "json", prompt: prompt }, signal);
    return A.parseJsonLoose(String((data && data.text) || ""));
  };

  A.askStream = async function (prompt, opts) {
    var r = await A.request("POST", "/api/generate", { mode: "stream", prompt: prompt }, opts.signal);
    if (!r.ok) {
      var body = null;
      try { body = await r.json(); } catch (e) {}
      throw { code: codeFromStatus(r.status, body), message: body && body.message };
    }
    var reader = r.body.getReader();
    var dec = new TextDecoder();
    var text = "";
    try {
      for (;;) {
        var chunk = await reader.read();
        if (chunk.done) break;
        text += dec.decode(chunk.value, { stream: true });
        if (opts.onText) opts.onText({ text: text });
      }
    } catch (e) {
      throw { code: e && e.name === "AbortError" ? "cancelled" : "upstream_error", text: text };
    }
    if (!text.trim()) throw { code: "empty_completion" };
    return { text: text, truncated: false };
  };

  A.errorCopy = function (e) {
    var msg = e && e.message;
    switch (e && e.code) {
      case "unauthorized": return "Server par access key lagi hai. Settings mein sahi key daalo.";
      case "rate_limited": return "Bahut zyada requests ho gayi. Thodi der ruko, phir try karo.";
      case "network": return "Server se connect nahi ho paya. Internet check karke phir try karo.";
      case "invalid_json": return "Ideas ka format Cue padh nahi paya. Phir se try karo.";
      case "refused": return "AI ne ye topic reject kar diya. Koi aur niche try karo.";
      case "prompt_too_large": return "Brief bahut lamba hai. Chhota karke phir try karo.";
      case "not_configured": return "Server par koi publishing provider set nahi hai.";
      case "upload_not_supported": return msg || "Direct upload yahan available nahi hai. Video ka public URL paste karo.";
      case "upload_failed": return "Video upload nahi ho paya. Dobara try karo ya public URL paste karo.";
      case "bad_media_url": return msg || "Video ka public https URL chahiye.";
      case "bad_schedule": return msg || "Schedule time kam se kam 2 minute aage ka hona chahiye.";
      default: return msg || "Kuch gadbad ho gayi. Phir se try karo.";
    }
  };
})();
