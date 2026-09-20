/* Cue UI helpers: DOM builder, storage, toast, clipboard, settings, status badges. */
(function () {
  "use strict";
  var Cue = (window.Cue = window.Cue || {});
  var U = (Cue.ui = {});

  U.$ = function (sel, root) { return (root || document).querySelector(sel); };
  U.$$ = function (sel, root) { return [].slice.call((root || document).querySelectorAll(sel)); };

  U.el = function (tag, props) {
    var n = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        var v = props[k];
        if (k === "class") n.className = v;
        else if (k === "text") n.textContent = v;
        else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2), v);
        else if (v === true) n.setAttribute(k, "");
        else if (v !== false && v != null) n.setAttribute(k, v);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var kids = [].concat(arguments[i]);
      for (var j = 0; j < kids.length; j++) {
        var kid = kids[j];
        if (kid == null || kid === false) continue;
        n.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
      }
    }
    return n;
  };

  /* ---------- storage (never throws) ---------- */
  U.store = {
    get: function (key, fallback) {
      try {
        var raw = localStorage.getItem(key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch (e) { return fallback; }
    },
    set: function (key, val) {
      try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch (e) { return false; }
    }
  };

  U.settings = {
    get: function () { var s = U.store.get("cue:settings", {}); return s && typeof s === "object" ? s : {}; },
    set: function (patch) {
      var s = Object.assign(U.settings.get(), patch);
      U.store.set("cue:settings", s);
      return s;
    }
  };

  /* ---------- feedback ---------- */
  U.reducedMotion = function () {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  };

  U.announce = function (msg) {
    var sr = document.getElementById("sr");
    if (!sr) return;
    sr.textContent = "";
    setTimeout(function () { sr.textContent = msg; }, 30);
  };

  var toastTimer = null;
  U.toast = function (msg) {
    var t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 2400);
    U.announce(msg);
  };

  U.copyText = async function (text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) {}
    try {
      var ta = U.el("textarea", { "aria-hidden": "true", tabindex: "-1" });
      ta.value = text;
      ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
      document.body.append(ta);
      ta.select();
      var ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch (e) { return false; }
  };

  U.saveFile = function (name, text) {
    var url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    var a = U.el("a", { href: url, download: name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  };

  U.scrollToEl = function (node) {
    node.scrollIntoView({ behavior: U.reducedMotion() ? "auto" : "smooth", block: "start" });
  };

  /* ---------- status badges ---------- */
  U.STATE = {
    waiting: { label: "Line mein", cls: "muted" },
    uploading: { label: "Upload ho raha hai", cls: "busy" },
    publishing: { label: "Publish ho raha hai", cls: "busy" },
    processing: { label: "Processing", cls: "warn" },
    queued: { label: "Bhej diya", cls: "info" },
    done: { label: "Done", cls: "ok" },
    scheduled: { label: "Scheduled", cls: "info" },
    failed: { label: "Fail", cls: "bad" }
  };

  U.badge = function (state, labelOverride) {
    var s = U.STATE[state] || { label: state, cls: "muted" };
    return U.el("span", { class: "badge " + s.cls, text: labelOverride || s.label });
  };

  U.mono = function (p) { return U.el("span", { class: "mono", "aria-hidden": "true", text: p.mono }); };
})();
