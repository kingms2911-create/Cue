/* Cue pure logic: platforms, caption mapping, fancy fonts, best-time maths, script parsing, stats.
   No DOM access here, so it can be unit-tested in Node. */
(function (root) {
  "use strict";
  var Cue = (root.Cue = root.Cue || {});
  var L = (Cue.lib = {});

  /* ---------- platforms ---------- */
  L.PLATFORMS = [
    { id: "instagram", name: "Instagram Reels", mono: "IG", verb: "publish", hint: "Vertical 9:16 Reel", limit: 2200, tagMax: 5, draftMax: 2200 },
    { id: "facebook", name: "Facebook Reels", mono: "FB", verb: "upload", hint: "Vertical 9:16 Reel", limit: 2200, tagMax: 3, draftMax: 2200 },
    { id: "youtube", name: "YouTube Shorts", mono: "YT", verb: "upload", hint: "Title 100 characters tak", limit: 5000, titleLimit: 100, tagMax: 3, draftMax: 5000, hasTitle: true },
    { id: "linkedin", name: "LinkedIn", mono: "in", verb: "publish", hint: "Professional tone behtar chalta hai", limit: 3000, tagMax: 3, draftMax: 3000 },
    { id: "tiktok", name: "TikTok", mono: "TT", verb: "upload", hint: "Chhota caption, 3 se 4 tags", limit: 2200, tagMax: 4, draftMax: 150 },
    { id: "x", name: "X (Twitter)", mono: "X", verb: "publish", hint: "280 characters tak", limit: 280, tagMax: 2, draftMax: 280 }
  ];

  L.byId = function (id) {
    for (var i = 0; i < L.PLATFORMS.length; i++) if (L.PLATFORMS[i].id === id) return L.PLATFORMS[i];
    return null;
  };

  /* ---------- text helpers ---------- */
  L.charLen = function (s) { return Array.from(String(s == null ? "" : s)).length; };

  L.clip = function (s, n) {
    s = String(s == null ? "" : s);
    var chars = Array.from(s);
    if (chars.length <= n) return s;
    if (n <= 1) return chars.slice(0, n).join("");
    var cut = chars.slice(0, n - 1).join("");
    var sp = Math.max(cut.lastIndexOf(" "), cut.lastIndexOf("\n"));
    if (sp > cut.length * 0.6) cut = cut.slice(0, sp);
    return cut.replace(/[\s,;:.\-]+$/, "") + "\u2026";
  };

  L.firstSentence = function (s) {
    s = String(s || "").trim();
    var m = s.match(/^[\s\S]*?[.!?\u0964](?=\s|$)/);
    return (m ? m[0] : s.split("\n")[0]).trim();
  };

  L.parseTags = function (s) {
    var out = [], seen = {};
    (String(s || "").match(/#?[\p{L}\p{N}_]+/gu) || []).forEach(function (w) {
      w = w.replace(/^#/, "");
      var k = w.toLowerCase();
      if (!w || seen[k]) return;
      seen[k] = 1;
      out.push("#" + w);
    });
    return out;
  };

  L.formatTags = function (tags, n) { return tags.slice(0, n).join(" "); };
  L.joinParts = function (parts) { return parts.filter(Boolean).join("\n\n"); };

  /* master = {title, caption, tags}  ->  {title, text} for one platform */
  L.buildDraft = function (id, m) {
    var p = L.byId(id);
    m = m || {};
    var title = String(m.title || "").trim();
    var caption = String(m.caption || "").trim() || title;
    var tagStr = L.formatTags(L.parseTags(m.tags), p.tagMax);
    var out = { title: "", text: "" };
    if (p.hasTitle) out.title = L.clip(title || L.firstSentence(caption), p.titleLimit);
    var body = caption;
    if (id === "tiktok" || id === "x") {
      var budget = p.draftMax - (tagStr ? L.charLen(tagStr) + 2 : 0);
      body = L.clip(id === "tiktok" ? L.firstSentence(caption) : caption, Math.max(budget, 20));
    }
    out.text = L.clip(L.joinParts([body, tagStr]), p.limit);
    return out;
  };

  /* ---------- fancy fonts for bios ---------- */
  var SMALL_CAPS = { a: "\u1D00", b: "\u0299", c: "\u1D04", d: "\u1D05", e: "\u1D07", f: "\uA730", g: "\u0262", h: "\u029C", i: "\u026A", j: "\u1D0A", k: "\u1D0B", l: "\u029F", m: "\u1D0D", n: "\u0274", o: "\u1D0F", p: "\u1D18", q: "\u01EB", r: "\u0280", s: "\uA731", t: "\u1D1B", u: "\u1D1C", v: "\u1D20", w: "\u1D21", x: "x", y: "\u028F", z: "\u1D22" };

  L.FONTS = [
    { id: "bold", name: "Bold", up: 0x1D400, lo: 0x1D41A, dg: 0x1D7CE },
    { id: "italic", name: "Italic", up: 0x1D434, lo: 0x1D44E, ex: { h: "\u210E" } },
    { id: "bolditalic", name: "Bold Italic", up: 0x1D468, lo: 0x1D482 },
    { id: "script", name: "Script", up: 0x1D49C, lo: 0x1D4B6, ex: { B: "\u212C", E: "\u2130", F: "\u2131", H: "\u210B", I: "\u2110", L: "\u2112", M: "\u2133", R: "\u211B", e: "\u212F", g: "\u210A", o: "\u2134" } },
    { id: "boldscript", name: "Bold Script", up: 0x1D4D0, lo: 0x1D4EA },
    { id: "fraktur", name: "Gothic", up: 0x1D504, lo: 0x1D51E, ex: { C: "\u212D", H: "\u210C", I: "\u2111", R: "\u211C", Z: "\u2128" } },
    { id: "boldfraktur", name: "Bold Gothic", up: 0x1D56C, lo: 0x1D586 },
    { id: "double", name: "Double-struck", up: 0x1D538, lo: 0x1D552, dg: 0x1D7D8, ex: { C: "\u2102", H: "\u210D", N: "\u2115", P: "\u2119", Q: "\u211A", R: "\u211D", Z: "\u2124" } },
    { id: "sans", name: "Sans", up: 0x1D5A0, lo: 0x1D5BA, dg: 0x1D7E2 },
    { id: "sansbold", name: "Sans Bold", up: 0x1D5D4, lo: 0x1D5EE, dg: 0x1D7EC },
    { id: "sansitalic", name: "Sans Italic", up: 0x1D608, lo: 0x1D622, dg: 0x1D7E2 },
    { id: "sansbolditalic", name: "Sans Bold Italic", up: 0x1D63C, lo: 0x1D656, dg: 0x1D7EC },
    { id: "mono", name: "Typewriter", up: 0x1D670, lo: 0x1D68A, dg: 0x1D7F6 },
    { id: "circled", name: "Bubble", up: 0x24B6, lo: 0x24D0, circledDigits: true },
    { id: "wide", name: "Wide", up: 0xFF21, lo: 0xFF41, dg: 0xFF10 },
    { id: "smallcaps", name: "Small caps", map: SMALL_CAPS }
  ];

  L.stylize = function (text, f) {
    return Array.from(String(text == null ? "" : text)).map(function (ch) {
      if (f.map) return f.map[ch] || ch;
      if (f.ex && f.ex[ch]) return f.ex[ch];
      var c = ch.charCodeAt(0);
      if (ch.length === 1) {
        if (c >= 65 && c <= 90) return String.fromCodePoint(f.up + c - 65);
        if (c >= 97 && c <= 122) return String.fromCodePoint(f.lo + c - 97);
        if (c >= 48 && c <= 57) {
          if (f.circledDigits) return c === 48 ? "\u24EA" : String.fromCodePoint(0x2460 + c - 49);
          if (f.dg != null) return String.fromCodePoint(f.dg + c - 48);
        }
      }
      return ch;
    }).join("");
  };

  L.SYMBOLS = ["\u2726", "\u2727", "\u2605", "\u2606", "\u2661", "\u273F", "\u26A1", "\u27A4", "\u2503", "\u21B3", "\u2733", "\u2740", "\u2022", "\uFF5C", "\u2728"];

  /* ---------- best upload time ---------- */
  L.TIMEZONES = [
    { id: "Asia/Kolkata", label: "India (IST)" },
    { id: "Asia/Dubai", label: "UAE (GST)" },
    { id: "Asia/Karachi", label: "Pakistan (PKT)" },
    { id: "Asia/Dhaka", label: "Bangladesh (BST)" },
    { id: "Asia/Singapore", label: "Singapore (SGT)" },
    { id: "Europe/London", label: "UK (London)" },
    { id: "Europe/Berlin", label: "Europe (Berlin)" },
    { id: "America/New_York", label: "USA East (New York)" },
    { id: "America/Chicago", label: "USA Central (Chicago)" },
    { id: "America/Los_Angeles", label: "USA West (Los Angeles)" },
    { id: "Australia/Sydney", label: "Australia (Sydney)" }
  ];

  /* General industry starting points, in the AUDIENCE's local time. Not guarantees. */
  L.SLOTS = {
    instagram: { wk: ["11:00", "19:30"], we: ["10:30", "20:00"] },
    facebook: { wk: ["09:00", "13:00"], we: ["10:00", "12:00"] },
    youtube: { wk: ["15:00", "19:00"], we: ["10:00", "17:00"] },
    linkedin: { wk: ["08:00", "12:00"], we: [] },
    tiktok: { wk: ["18:00", "21:00"], we: ["11:00", "20:00"] },
    x: { wk: ["08:30", "12:00", "17:30"], we: ["10:00"] }
  };

  function tzFields(date, tz) {
    var f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" });
    var o = {};
    f.formatToParts(date).forEach(function (p) { if (p.type !== "literal") o[p.type] = parseInt(p.value, 10); });
    return o;
  }

  function offsetMs(date, tz) {
    var o = tzFields(date, tz);
    return Date.UTC(o.year, o.month - 1, o.day, o.hour, o.minute, o.second) - Math.floor(date.getTime() / 1000) * 1000;
  }

  L.zonedToUtc = function (y, mo, d, h, mi, tz) {
    var guess = Date.UTC(y, mo - 1, d, h, mi);
    var utc = guess - offsetMs(new Date(guess), tz);
    return new Date(guess - offsetMs(new Date(utc), tz));
  };

  L.nextSlots = function (id, tz, now, count) {
    var s = L.SLOTS[id];
    var out = [];
    if (!s) return out;
    var t = tzFields(now, tz);
    for (var add = 0; add < 10; add++) {
      var day = new Date(Date.UTC(t.year, t.month - 1, t.day + add));
      var dow = day.getUTCDay();
      var list = dow === 0 || dow === 6 ? s.we : s.wk;
      list.forEach(function (hm) {
        var p = hm.split(":");
        var at = L.zonedToUtc(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), +p[0], +p[1], tz);
        if (at.getTime() > now.getTime() + 30 * 60000) out.push({ at: at });
      });
    }
    out.sort(function (a, b) { return a.at - b.at; });
    return out.slice(0, count);
  };

  L.slotLabel = function (date, tz, now) {
    var a = tzFields(now, tz), b = tzFields(date, tz);
    var diff = Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86400000);
    var time = new Intl.DateTimeFormat("en-IN", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true }).format(date);
    var day = diff === 0 ? "Aaj" : diff === 1 ? "Kal" : new Intl.DateTimeFormat("en-IN", { timeZone: tz, weekday: "short", day: "numeric", month: "short" }).format(date);
    return day + ", " + time;
  };

  L.fmtDateTime = function (date, tz) {
    var o = { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true };
    if (tz) o.timeZone = tz;
    return new Intl.DateTimeFormat("en-IN", o).format(date);
  };

  /* ---------- scheduling helpers ---------- */
  L.toLocalInput = function (d) {
    function p(n) { return (n < 10 ? "0" : "") + n; }
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + "T" + p(d.getHours()) + ":" + p(d.getMinutes());
  };

  L.zulu = function (d) { return new Date(d).toISOString().replace(/\.\d{3}Z$/, "Z"); };

  /* ---------- script parsing (AI output -> beats) ---------- */
  L.parseScript = function (text) {
    var beats = [], cur = null;
    String(text || "").split(/\r?\n/).forEach(function (raw) {
      var line = raw.replace(/\*\*/g, "").trim();
      if (!line) return;
      if (/^#{2,3}\s+/.test(line)) {
        var parts = line.replace(/^#{2,3}\s+/, "").split("|");
        cur = { label: parts[0].trim(), time: (parts[1] || "").trim(), lines: [] };
        beats.push(cur);
        return;
      }
      if (/^#\s/.test(line) || /^-{3,}$/.test(line)) return;
      if (!cur) { cur = { label: "Script", time: "", lines: [] }; beats.push(cur); }
      var m = line.match(/^(SHOW|SAY|TEXT)\s*:\s*(.*)$/i);
      if (m) cur.lines.push({ kind: m[1].toLowerCase(), text: m[2].trim() });
      else cur.lines.push({ kind: "say", text: line });
    });
    return beats;
  };

  L.cleanTime = function (t) {
    if (!t || /^post$/i.test(t) || t === "-") return "";
    return t.replace(/\s*[-\u2013]\s*/, "\u2013");
  };

  /* Turn a generated script into {title, caption, tags} for the publisher. */
  L.extractPublishDraft = function (idea, beats) {
    var pack = null;
    for (var i = beats.length - 1; i >= 0; i--) {
      if (!L.cleanTime(beats[i].time)) { pack = beats[i]; break; }
    }
    var draft = { title: idea.title || "", caption: "", tags: "" };
    var re = /#[\p{L}\p{N}_]+/gu;
    if (pack && /caption/i.test(pack.label)) {
      var joined = pack.lines.map(function (l) { return l.text; }).join("\n");
      draft.tags = (joined.match(re) || []).join(" ");
      draft.caption = joined.replace(re, "").replace(/^\s*(caption|hashtags?)\s*:\s*/gim, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    } else {
      var all = pack ? pack.lines.map(function (l) { return l.text; }).join(" ") : "";
      draft.tags = (all.match(re) || []).join(" ");
    }
    if (!draft.caption) draft.caption = L.joinParts([idea.hook || "", idea.angle || ""]);
    return draft;
  };

  /* ---------- history analytics ---------- */
  L.summarize = function (hist, now) {
    var s = { posts: hist.length, done: 0, scheduled: 0, failed: 0, active: 0, byPlatform: {}, week: [] };
    L.PLATFORMS.forEach(function (p) { s.byPlatform[p.id] = { done: 0, scheduled: 0, failed: 0, active: 0 }; });
    hist.forEach(function (h) {
      Object.keys(h.results || {}).forEach(function (id) {
        var st = h.results[id].state, b = s.byPlatform[id];
        if (!b) return;
        if (st === "done") { b.done++; s.done++; }
        else if (st === "scheduled") { b.scheduled++; s.scheduled++; }
        else if (st === "failed") { b.failed++; s.failed++; }
        else { b.active++; s.active++; }
      });
    });
    for (var i = 6; i >= 0; i--) {
      var d = new Date(now);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      s.week.push({ date: d, label: new Intl.DateTimeFormat("en-IN", { weekday: "short" }).format(d), count: 0 });
    }
    hist.forEach(function (h) {
      var t = new Date(h.ts);
      t.setHours(0, 0, 0, 0);
      s.week.forEach(function (w) { if (w.date.getTime() === t.getTime()) w.count++; });
    });
    return s;
  };

  L.uid = function () { return Math.random().toString(36).slice(2, 8) + Date.now().toString(36); };

  L.fmtBytes = function (n) {
    if (n < 1024 * 1024) return Math.max(1, Math.round(n / 1024)) + " KB";
    return (n / 1048576).toFixed(n < 10485760 ? 1 : 0) + " MB";
  };

  if (typeof module !== "undefined" && module.exports) module.exports = Cue;
})(typeof window !== "undefined" ? window : globalThis);
