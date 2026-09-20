/* Publishing history and simple analytics, stored in this browser (localStorage). */
(function () {
  "use strict";
  var Cue = (window.Cue = window.Cue || {});
  var H = (Cue.history = {});
  var U = Cue.ui, L = Cue.lib, el = U.el;
  var KEY = "cue:history";
  var MAX = 100;
  var IN_FLIGHT = ["waiting", "uploading", "publishing"];
  var list = [];
  var filter = "all";

  function load() {
    var raw = U.store.get(KEY, []);
    list = Array.isArray(raw) ? raw : [];
    var changed = false;
    list.forEach(function (rec) {
      Object.keys(rec.results || {}).forEach(function (id) {
        var r = rec.results[id];
        if (IN_FLIGHT.indexOf(r.state) > -1) {
          r.state = "failed";
          r.message = "Page beech mein band ho gaya. Retry se pehle platform par check kar lo.";
          changed = true;
        }
      });
    });
    if (changed) persist();
  }

  function persist() { U.store.set(KEY, list); }

  function panelVisible() {
    var p = document.getElementById("panel-history");
    return !!p && !p.hidden;
  }

  H.all = function () { return list; };

  H.get = function (id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  };

  /* Store a copy. Payloads (needed for retry) are kept only while a result can still be retried. */
  H.upsert = function (rec) {
    var copy = JSON.parse(JSON.stringify(rec));
    Object.keys(copy.results || {}).forEach(function (id) {
      var s = copy.results[id].state;
      if (s !== "failed" && IN_FLIGHT.indexOf(s) === -1) delete copy.results[id].payload;
    });
    var idx = -1;
    for (var i = 0; i < list.length; i++) if (list[i].id === rec.id) idx = i;
    if (idx > -1) list[idx] = copy; else list.unshift(copy);
    if (list.length > MAX) list.length = MAX;
    persist();
    if (panelVisible()) H.render();
  };

  H.clear = function () { list = []; persist(); H.render(); };

  function matches(rec) {
    if (filter === "all") return true;
    return Object.keys(rec.results).some(function (id) { return rec.results[id].state === filter; });
  }

  function renderStats(s) {
    var host = document.getElementById("stats");
    host.replaceChildren();
    var fin = s.done + s.failed;
    var tiles = [
      [String(s.posts), "Total posts"],
      [String(s.done), "Published (platforms)"],
      [String(s.scheduled), "Scheduled"],
      [fin ? Math.round((s.done / fin) * 100) + "%" : "\u2013", "Success rate"]
    ];
    tiles.forEach(function (t) { host.append(el("div", { class: "stat" }, el("b", { text: t[0] }), el("span", { text: t[1] }))); });
  }

  function renderPlatformChart(s) {
    var host = document.getElementById("chart-plat");
    host.replaceChildren();
    var totals = L.PLATFORMS.map(function (p) { var b = s.byPlatform[p.id]; return b.done + b.scheduled + b.failed + b.active; });
    var max = Math.max.apply(null, [1].concat(totals));
    L.PLATFORMS.forEach(function (p, i) {
      var b = s.byPlatform[p.id];
      var desc = p.name + ": " + b.done + " publish, " + b.scheduled + " scheduled, " + b.failed + " fail" + (b.active ? ", " + b.active + " processing" : "");
      var stack = el("div", { class: "stack", role: "img", "aria-label": desc });
      [["ok", b.done], ["info", b.scheduled], ["warn", b.active], ["bad", b.failed]].forEach(function (seg) {
        if (seg[1]) stack.append(el("span", { class: "seg " + seg[0], style: "width:" + (seg[1] / max) * 100 + "%" }));
      });
      host.append(el("li", { class: "bar-row" }, U.mono(p), stack, el("span", { class: "bar-num", text: String(totals[i]) })));
    });
  }

  function renderWeekChart(s) {
    var host = document.getElementById("chart-week");
    host.replaceChildren();
    var max = Math.max.apply(null, [1].concat(s.week.map(function (w) { return w.count; })));
    s.week.forEach(function (w) {
      host.append(el("li", { class: "wk", "aria-label": w.label + ": " + w.count + " posts" },
        el("b", { text: String(w.count) }),
        el("span", { class: "wk-bar" }, el("span", { class: "wk-fill", style: "height:" + (w.count / max) * 100 + "%" })),
        el("small", { text: w.label })));
    });
  }

  function itemEl(rec) {
    var plats = el("ul", { class: "h-plats" });
    L.PLATFORMS.forEach(function (p) {
      var r = rec.results[p.id];
      if (!r) return;
      var li = el("li", { class: "h-plat" }, U.mono(p), el("span", { class: "h-pname", text: p.name }), U.badge(r.state));
      if (r.url && /^https?:\/\//i.test(r.url)) li.append(el("a", { class: "btn link small", href: r.url, target: "_blank", rel: "noopener noreferrer" }, "Post dekho"));
      if (r.state === "failed") {
        if (r.message) li.append(el("small", { class: "h-msg", text: r.message }));
        if (r.payload) li.append(el("button", { class: "btn quiet small", type: "button", "aria-label": p.name + " par retry karo", onclick: function () { Cue.publisher.retry(rec.id, p.id); } }, "Retry"));
      }
      plats.append(li);
    });
    var when = rec.mode === "schedule" && rec.scheduleAt ? "Schedule: " + L.fmtDateTime(new Date(rec.scheduleAt)) : "Turant post";
    return el("li", { class: "hitem" },
      el("div", { class: "h-top" }, el("h3", { text: rec.title }), el("time", { datetime: new Date(rec.ts).toISOString(), text: L.fmtDateTime(new Date(rec.ts)) })),
      el("p", { class: "sub", text: when + (rec.demo ? ", demo" : "") }),
      plats);
  }

  H.render = function () {
    if (!panelVisible()) return;
    var s = L.summarize(list, new Date());
    renderStats(s);
    renderPlatformChart(s);
    renderWeekChart(s);
    var host = document.getElementById("hist-list");
    host.replaceChildren();
    var shown = list.filter(matches);
    if (!shown.length) {
      host.append(el("li", { class: "empty" }, el("strong", { text: list.length ? "Is filter mein kuch nahi" : "Abhi tak koi post nahi" }),
        el("p", { text: list.length ? "Doosra filter try karo." : "Publish tab se pehla post karo, yahan record dikhega." })));
    } else {
      shown.forEach(function (rec) { host.append(itemEl(rec)); });
    }
    document.getElementById("hist-clear").hidden = !list.length;
  };

  H.init = function () {
    load();
    U.$$("[data-filter]").forEach(function (b) {
      b.addEventListener("click", function () {
        filter = b.getAttribute("data-filter");
        U.$$("[data-filter]").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
        H.render();
      });
    });
    document.getElementById("hist-clear").addEventListener("click", function () {
      if (window.confirm("Saari publishing history saaf kar dein?")) H.clear();
    });
  };
})();
