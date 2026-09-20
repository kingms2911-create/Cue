/* App shell: tabs, theme, settings dialog, startup. */
(function () {
  "use strict";
  var Cue = (window.Cue = window.Cue || {});
  var App = (Cue.app = {});
  var U = Cue.ui;
  var TABS = ["ideas", "publish", "toolkit", "history"];
  var THEME_KEY = "cue:theme";

  function $id(id) { return document.getElementById(id); }

  /* ---------- tabs ---------- */
  App.showTab = function (id) {
    if (TABS.indexOf(id) === -1) id = "ideas";
    TABS.forEach(function (t) {
      var on = t === id;
      var tab = $id("tab-" + t);
      tab.setAttribute("aria-selected", String(on));
      tab.tabIndex = on ? 0 : -1;
      $id("panel-" + t).hidden = !on;
    });
    if (id === "history") Cue.history.render();
    if (id === "toolkit") Cue.toolkit.refresh();
    try { history.replaceState(null, "", "#" + id); } catch (e) {}
    window.scrollTo(0, 0);
  };

  function bindTabs() {
    TABS.forEach(function (t, i) {
      var tab = $id("tab-" + t);
      tab.addEventListener("click", function () { App.showTab(t); });
      tab.addEventListener("keydown", function (e) {
        var n = null;
        if (e.key === "ArrowRight") n = (i + 1) % TABS.length;
        else if (e.key === "ArrowLeft") n = (i + TABS.length - 1) % TABS.length;
        else if (e.key === "Home") n = 0;
        else if (e.key === "End") n = TABS.length - 1;
        if (n == null) return;
        e.preventDefault();
        App.showTab(TABS[n]);
        $id("tab-" + TABS[n]).focus();
      });
    });
  }

  /* ---------- theme ---------- */
  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    $id("btn-theme").textContent = t === "dark" ? "Light mode" : "Dark mode";
  }

  /* ---------- settings ---------- */
  App.openSettings = function () {
    var d = $id("settings"), s = U.settings.get();
    $id("set-key").value = s.accessKey || "";
    $id("set-demo").checked = !!s.demo;
    if (typeof d.showModal === "function") { if (!d.open) d.showModal(); }
    else d.setAttribute("open", "");
    $id("set-key").focus();
  };

  function closeSettings() {
    var d = $id("settings");
    if (typeof d.close === "function") d.close(); else d.removeAttribute("open");
  }

  function saveSettings() {
    U.settings.set({ accessKey: $id("set-key").value.trim(), demo: $id("set-demo").checked });
    closeSettings();
    U.toast("Settings save ho gayi.");
    Cue.publisher.reload();
  }

  App.init = function () {
    var stored = U.store.get(THEME_KEY, "dark");
    applyTheme(stored === "light" ? "light" : "dark");
    $id("btn-theme").addEventListener("click", function () {
      var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      U.store.set(THEME_KEY, next);
      applyTheme(next);
    });
    $id("btn-settings").addEventListener("click", App.openSettings);
    $id("set-save").addEventListener("click", saveSettings);
    $id("set-cancel").addEventListener("click", closeSettings);
    bindTabs();
  };

  function start() {
    Cue.ideas.init();
    Cue.toolkit.init();
    Cue.history.init();
    Cue.publisher.init();
    App.init();
    var h = (location.hash || "").replace("#", "");
    App.showTab(TABS.indexOf(h) > -1 ? h : "ideas");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
