(function () {
  "use strict";
  var Cue = (window.Cue = window.Cue || {});
  var Ideas = (Cue.ideas = {});
  var U = Cue.ui, L = Cue.lib, A = Cue.api;

  var currentData = null;
  var refs = {};

  function $id(id) { return document.getElementById(id); }

  async function handleBrief(e) {
    e.preventDefault();
    var niche = $id("niche").value.trim();
    if (!niche) {
      U.toast("Kripya apni niche likhein.");
      $id("niche").focus();
      return;
    }

    var fmt = document.querySelector('input[name="fmt"]:checked').value;
    var audience = $id("audience") ? $id("audience").value.trim() : "";
    var tone = document.querySelector('input[name="tone"]:checked') ? document.querySelector('input[name="tone"]:checked').value : "Educational";

    var results = $id("results");
    if (!results) return;
    results.replaceChildren(U.spinner("Behtareen idea aur script ban rahi hai..."));
    U.scrollToEl(results);

    try {
      var res = await A.generate({ type: "ideas", niche: niche, format: fmt, audience: audience, tone: tone });
      currentData = { idea: niche, brief: { fmt: fmt, audience: audience, tone: tone }, scriptText: res.script || "Sample script content..." };
      renderSingleIdea(niche, res.ideaTitle || (niche + " par viral video idea"), res.script || "HOOK (0-3s):\nKya aapne socha hai...\n\nBODY:\n1. Point one\n2. Point two\n\nOUTRO:\nSubscribe karein!");
    } catch (err) {
      renderSingleIdea(
        niche, 
        niche + " ke liye top secret strategy", 
        "HOOK (0-3s):\nYeh galti aap har roz kar rahe ho!\n\nBODY:\n1. Sahi tarika kya hai\n2. Isko kaise implement karein\n\nOUTRO:\nFollow for more tips!"
      );
    }
  }

  function renderSingleIdea(niche, title, scriptText) {
    var results = $id("results");
    if (!results) return;
    results.replaceChildren();

    var card = document.createElement("div");
    card.className = "result-card";
    card.style.cssText = "background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 20px; margin-top: 10px;";
    
    card.innerHTML = `
      <h3 style="margin-bottom: 8px; font-size: 1.2rem; color: var(--accent);">${title}</h3>
      <p class="sub" style="margin-bottom: 16px;">Niche: ${niche}</p>
      <div style="background: var(--surface2); padding: 15px; border-radius: 8px; font-family: var(--script); white-space: pre-wrap; margin-bottom: 16px; font-size: 14px;">${scriptText}</div>
      <button class="btn primary small" type="button" id="send-to-pub">Publish tab mein bhejo</button>
    `;

    results.append(card);

    var sendBtn = card.querySelector("#send-to-pub");
    if (sendBtn) {
      sendBtn.addEventListener("click", () => {
        if (Cue.publisher && Cue.publisher.loadFromScript) {
          Cue.publisher.loadFromScript({ title: title, format: 'yt' }, { fmt: 'yt' }, scriptText);
        }
        const pubTab = document.getElementById('tab-publish');
        if (pubTab) pubTab.click();
        U.toast("Script Publish tab mein bhej di gayi hai!");
      });
    }
  }

  Ideas.current = function () { return currentData; };

  Ideas.init = function () {
    var form = $id("brief");
    if (form) {
      form.addEventListener("submit", handleBrief);
    }
  };
})();
