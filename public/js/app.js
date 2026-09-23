/* App shell: tabs, theme, settings dialog, startup. */
(function () {
  "use strict";
  var Cue = (window.Cue = window.Cue || {});
  var App = (Cue.app = {});
  var U = Cue.ui;
  var TABS = ["ideas", "vibescript", "publish", "toolkit", "history"];
  var THEME_KEY = "cue:theme";

  function $id(id) { return document.getElementById(id); }

  /* ---------- tabs ---------- */
  App.showTab = function (id) {
    if (TABS.indexOf(id) === -1) id = "ideas";
    TABS.forEach(function (t) {
      var on = t === id;
      var tab = $id("tab-" + t);
      if (tab) {
        tab.setAttribute("aria-selected", String(on));
        tab.tabIndex = on ? 0 : -1;
      }
      var panel = $id("panel-" + t);
      if (panel) panel.hidden = !on;
    });
    if (id === "history" && Cue.history) Cue.history.render();
    if (id === "toolkit" && Cue.toolkit) Cue.toolkit.refresh();
    try { history.replaceState(null, "", "#" + id); } catch (e) {}
    window.scrollTo(0, 0);
  };

  function bindTabs() {
    TABS.forEach(function (t, i) {
      var tab = $id("tab-" + t);
      if (!tab) return;
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
        var nextTab = $id("tab-" + TABS[n]);
        if (nextTab) nextTab.focus();
      });
    });
  }

  /* ---------- theme ---------- */
  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    var btnTheme = $id("btn-theme");
    if (btnTheme) btnTheme.textContent = t === "dark" ? "Light mode" : "Dark mode";
  }

  /* ---------- settings ---------- */
  App.openSettings = function () {
    var d = $id("settings"), s = U.settings.get();
    var setDemo = $id("set-demo");
    if (setDemo) setDemo.checked = !!s.demo;
    if (d) {
      if (typeof d.showModal === "function") { if (!d.open) d.showModal(); }
      else d.setAttribute("open", "");
    }
  };

  function closeSettings() {
    var d = $id("settings");
    if (d) {
      if (typeof d.close === "function") d.close(); else d.removeAttribute("open");
    }
  }

  function saveSettings() {
    var setDemo = $id("set-demo");
    U.settings.set({ demo: setDemo ? setDemo.checked : false });
    closeSettings();
    U.toast("Settings save ho gayi.");
    if (Cue.publisher) Cue.publisher.reload();
  }

  App.init = function () {
    var stored = U.store.get(THEME_KEY, "dark");
    applyTheme(stored === "light" ? "light" : "dark");
    var btnTheme = $id("btn-theme");
    if (btnTheme) {
      btnTheme.addEventListener("click", function () {
        var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
        U.store.set(THEM_KEY, next);
        applyTheme(next);
      });
    }
    var btnSettings = $id("btn-settings");
    if (btnSettings) btnSettings.addEventListener("click", App.openSettings);
    var setSave = $id("set-save");
    if (setSave) setSave.addEventListener("click", saveSettings);
    var setCancel = $id("set-cancel");
    if (setCancel) setCancel.addEventListener("click", closeSettings);
    bindTabs();
  };

  function start() {
    if (Cue.ideas && Cue.ideas.init) Cue.ideas.init();
    if (Cue.toolkit && Cue.toolkit.init) Cue.toolkit.init();
    if (Cue.history && Cue.history.init) Cue.history.init();
    if (Cue.publisher && Cue.publisher.init) Cue.publisher.init();
    App.init();
    var h = (location.hash || "").replace("#", "");
    App.showTab(TABS.indexOf(h) > -1 ? h : "ideas");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
