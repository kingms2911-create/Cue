/* App shell: tabs, theme, settings dialog, startup. */
(function () {
  "use strict";
  var Cue = (window.Cue = window.Cue || {});
  var App = (Cue.app = {});
  var U = Cue.ui;
  var TABS = ["ideas", "publish", "toolkit", "history"];
  var THEME_KEY = "cue:theme";
  var CREDITS_KEY = "cue:free_credits";
  var AD_PROGRESS_KEY = "cue:ad_progress";

  function $id(id) { return document.getElementById(id); }

  /* ---------- global paywall popup (3-ads reward system) ---------- */
  Cue.showPaywallPopup = function() {
    var old = document.getElementById("paywall-modal");
    if (old) old.remove();

    var adCount = Number(U.store.get(AD_PROGRESS_KEY, 0));

    var modal = document.createElement("div");
    modal.id = "paywall-modal";
    modal.style.cssText = "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; z-index: 99999; padding: 20px; overflow-y: auto;";

    var card = document.createElement("div");
    card.style.cssText = "background: #1e1e2f; color: #fff; padding: 24px; border-radius: 14px; max-width: 400px; width: 100%; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.5); font-family: inherit; margin: auto;";

    card.innerHTML = 
      "<h3 style='margin-bottom: 8px; font-size: 20px; color: #ffcc00;'>⚡ Free Credits Khatam Ho Gaye!</h3>" +
      "<p style='margin-bottom: 16px; font-size: 13px; color: #ccc; line-height: 1.5;'>Naye ideas aur scripts ke liye <strong>3 alag-alag ads</strong> dekhiye, aur badle mein turant <strong>1 free credit</strong> paiye!</p>" +
      
      // Monetag Ad Space Container
      "<div id='monetag-ad-box' style='margin-bottom: 16px; min-height: 50px; background: #2a2a40; display: flex; align-items: center; justify-content: center; border-radius: 8px; font-size: 11px; color: #888; border: 1px dashed #444;'>[ Monetag Ad Space ]</div>" +

      "<div style='display: flex; flex-direction: column; gap: 8px;'>" +
        "<button id='btn-ad' style='background: #34d399; color: #111; border: none; padding: 12px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 13px;'>Ad Dekho (" + adCount + "/3) -> +1 Credit</button>" +
        "<button id='btn-close' style='background: transparent; color: #aaa; border: none; padding: 8px; cursor: pointer; font-size: 12px;'>Baad mein karenge</button>" +
      "</div>";

    modal.appendChild(card);
    document.body.appendChild(modal);

    card.querySelector("#btn-ad").onclick = function() {
      adCount++;
      if (adCount >= 3) {
        U.store.set(CREDITS_KEY, 1);
        U.store.set(AD_PROGRESS_KEY, 0);
        modal.remove();
        U.toast("Badhai ho! 3 ads dekhne par 1 free credit mil gaya.");
        if (typeof Cue.ideas.renderIdeas === "function") Cue.ideas.renderIdeas();
      } else {
        U.store.set(AD_PROGRESS_KEY, adCount);
        card.querySelector("#btn-ad").textContent = "Ad Dekho (" + adCount + "/3) -> +1 Credit";
        U.toast("Ad load ho raha hai... (" + adCount + "/3 complete)");
      }
    };

    card.querySelector("#btn-close").onclick = function() {
      modal.remove();
    };
  };

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
