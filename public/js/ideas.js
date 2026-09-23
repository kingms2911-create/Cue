/* Ideas and script planner (Gemini via /api/generate). */
(function () {
  "use strict";
  var Cue = (window.Cue = window.Cue || {});
  var I = (Cue.ideas = {});
  var U = Cue.ui, L = Cue.lib, A = Cue.api, el = U.el;

  var FORMATS = {
    yt: {
      label: "YouTube video", short: "YouTube video", length: "5 to 10 minutes", lengthHi: "5 se 10 minute",
      structure: "Open with a hook in the first 20 seconds that states the payoff or a bold claim. Then a promise, 3 to 4 main points each with a concrete example, one pattern interrupt around the middle, a payoff, and a call to action that asks for one specific thing. Aim for about 1,100 spoken words.",
      finalBeat: "The last beat is '## Packaging | Post' with TEXT lines: three alternative titles under 60 characters, one thumbnail idea, and a two-sentence description opener."
    },
    short: {
      label: "YouTube Short", short: "YouTube Short", length: "under 60 seconds", lengthHi: "60 second se kam",
      structure: "Vertical video. A hook in the first 3 seconds, 3 to 5 quick beats with a visual change every 3 to 5 seconds, a payoff, and a closing line that loops back to the hook. Aim for 110 to 140 spoken words.",
      finalBeat: "The last beat is '## Caption | Post' with TEXT lines: a caption under 150 characters and 5 to 8 relevant hashtags."
    },
    reel: {
      label: "Instagram Reel", short: "Instagram Reel", length: "20 to 45 seconds", lengthHi: "20 se 45 second",
      structure: "Vertical video. A hook in the first 2 seconds, 3 to 4 beats with fast visual changes, a payoff, and a call to action that asks viewers to save or share. Aim for 70 to 110 spoken words.",
      finalBeat: "The last beat is '## Caption | Post' with TEXT lines: a caption under 150 characters and 5 to 8 relevant hashtags."
    }
  };
  var TONES = ["Educational", "Funny", "Inspiring", "Straight-talking"];
  var TONE_LABELS = { "Educational": "sikhane wala", "Funny": "funny", "Inspiring": "inspiring", "Straight-talking": "seedha-seedha" };
  var LANG_NOTE = "Hinglish. Write Hindi in Roman (English) letters mixed naturally with English words, the way Indian creators talk on YouTube and Instagram. Never use Devanagari script. Keep it casual and conversational, not textbook Hindi.";
  var PREF_KEY = "cue:brief";
  var CREDITS_KEY = "cue:free_credits";
  var AD_PROGRESS_KEY = "cue:ad_progress";

  var state = { brief: null, ideas: [], selected: null, view: "ideas", ideasBusy: false, scriptBusy: false, scriptText: "", truncated: false, error: "" };
  var scriptCtl = null;
  var results, form, nicheEl, audienceEl, nicheError;

  /* ---------- credits & popup ---------- */
  function getCredits() {
    var c = U.store.get(CREDITS_KEY, null);
    if (c === null) {
      c = 1; // Naye user ko sirf 1 free credit milega
      U.store.set(CREDITS_KEY, c);
    }
    return Number(c);
  }

  function useCredit() {
    var c = getCredits();
    if (c > 0) {
      U.store.set(CREDITS_KEY, c - 1);
      return true;
    }
    return false;
  }

  function showPaywallPopup() {
    var old = document.getElementById("paywall-modal");
    if (old) old.remove();

    var adCount = Number(U.store.get(AD_PROGRESS_KEY, 0));

    var modal = document.createElement("div");
    modal.id = "paywall-modal";
    modal.style.cssText = "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; z-index: 99999; padding: 20px;";

    var card = document.createElement("div");
    card.style.cssText = "background: #1e1e2f; color: #fff; padding: 24px; border-radius: 12px; max-width: 400px; width: 100%; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.5); font-family: inherit;";

    card.innerHTML = 
      "<h3 style='margin-bottom: 12px; font-size: 20px; color: #ffcc00;'>⚠️ Free Credits Khatam!</h3>" +
      "<p style='margin-bottom: 16px; font-size: 14px; color: #ccc;'>Aur ideas ke liye Pro plan lo ya neeche Monetag ad dekh kar credit pao.</p>" +
      
      // Monetag ad space / container
      "<div id='monetag-ad-box' style='margin-bottom: 16px; min-height: 50px; background: #2a2a40; display: flex; align-items: center; justify-content: center; border-radius: 8px; font-size: 12px; color: #888;'>[ Monetag Ad Space ]</div>" +

      "<div style='display: flex; flex-direction: column; gap: 10px;'>" +
        "<button id='btn-pro' style='background: #6366f1; color: white; border: none; padding: 10px; border-radius: 6px; font-weight: bold; cursor: pointer;'>Pro Plan Lo (₹49)</button>" +
        "<button id='btn-ad' style='background: #34d399; color: #111; border: none; padding: 10px; border-radius: 6px; font-weight: bold; cursor: pointer;'>Ad Dekho (" + adCount + "/3) -> +1 Credit</button>" +
        "<button id='btn-close' style='background: transparent; color: #aaa; border: none; padding: 8px; cursor: pointer;'>Band karo</button>" +
      "</div>";

    modal.appendChild(card);
    document.body.appendChild(modal);

    card.querySelector("#btn-pro").onclick = function() {
      alert("Pro Plan redirection (₹49). Payment gateway integration yahan aayega.");
    };

    card.querySelector("#btn-ad").onclick = function() {
      adCount++;
      if (adCount >= 3) {
        U.store.set(CREDITS_KEY, 1);
        U.store.set(AD_PROGRESS_KEY, 0);
        modal.remove();
        U.toast("Badhai ho! 3 ads dekhne par 1 credit mil gaya.");
        renderIdeas();
      } else {
        U.store.set(AD_PROGRESS_KEY, adCount);
        card.querySelector("#btn-ad").textContent = "Ad Dekho (" + adCount + "/3) -> +1 Credit";
        alert("Ad load ho raha hai... (" + adCount + "/3 complete)");
      }
    };

    card.querySelector("#btn-close").onclick = function() {
      modal.remove();
    };
  }

  /* ---------- brief ---------- */
  function readBrief() {
    return {
      fmt: form.querySelector("input[name=fmt]:checked").value,
      tone: form.querySelector("input[name=tone]:checked").value,
      niche: nicheEl.value.trim(),
      audience: audienceEl.value.trim()
    };
  }

  function loadPrefs() {
    var v = U.store.get(PREF_KEY, null);
    if (!v || typeof v !== "object") return;
    if (FORMATS[v.fmt]) form.querySelector("input[name=fmt][value=" + v.fmt + "]").checked = true;
    if (TONES.indexOf(v.tone) > -1) {
      var r = U.$$("input[name=tone]", form).filter(function (x) { return x.value === v.tone; })[0];
      if (r) r.checked = true;
    }
    if (typeof v.niche === "string") nicheEl.value = v.niche.slice(0, 120);
    if (typeof v.audience === "string") audienceEl.value = v.audience.slice(0, 120);
  }

  function setFieldError(msg) {
    nicheError.textContent = msg || "";
    nicheError.hidden = !msg;
    if (msg) nicheEl.setAttribute("aria-invalid", "true"); else nicheEl.removeAttribute("aria-invalid");
  }

  function briefLines(b) {
    return "Format: " + FORMATS[b.fmt].label + " (" + FORMATS[b.fmt].length + ")\n" +
      "Niche: " + b.niche + "\n" +
      "Viewers: " + (b.audience || "people interested in this niche") + "\n" +
      "Tone: " + b.tone + "\n" +
      "Language: " + LANG_NOTE;
  }

  function focusResults() {
    if (window.matchMedia && window.matchMedia("(max-width: 899px)").matches) U.scrollToEl(results);
  }

  function handleError(e) {
    return A.errorCopy(e);
  }

  /* ---------- ideas ---------- */
  function ideasPrompt(b, avoid) {
    return "You are a sharp content strategist for YouTube and Instagram creators.\n\n" +
      "Creator brief:\n" + briefLines(b) + "\n\n" +
      "Give 1 distinct high-performing video idea for this creator. The idea has:\n" +
      "- title: under 70 characters, works as a real title\n" +
      "- hook: the literal first sentence the creator says, under 20 words, no clickbait lies\n" +
      "- angle: one sentence on why a viewer stops or clicks, and what makes it different from generic advice in this niche\n\n" +
      (avoid.length ? "Do not repeat or closely echo these earlier titles:\n" + avoid.join("\n") + "\n\n" : "") +
      "Write every value in Hinglish, but keep the JSON keys exactly as shown. Reply with only a JSON array of 1 object, like [{\"title\":\"...\",\"hook\":\"...\",\"angle\":\"...\"}].";
  }

  function normalizeIdea(x) {
    if (!x || typeof x !== "object") return null;
    var title = String(x.title || "").trim();
    if (!title) return null;
    return {
      title: title,
      hook: String(x.hook || "").trim().replace(/^["\u201C\u201D]+|["\u201C\u201D]+$/g, ""),
      angle: String(x.angle || "").trim()
    };
  }

  async function getIdeas(append) {
    var b = readBrief();
    if (!b.niche) { setFieldError("Ideas ke liye apni niche likho."); nicheEl.focus(); return; }
    
    // Check credits before generating
    if (getCredits() <= 0) {
      showPaywallPopup();
      return;
    }

    setFieldError("");
    if (state.ideasBusy) return;

    if (!append) {
      if (!useCredit()) {
        showPaywallPopup();
        return;
      }
      state.brief = b; 
      state.ideas = []; 
      U.store.set(PREF_KEY, b);
    }

    var brief = state.brief || b;
    state.view = "ideas";
    state.error = "";
    state.ideasBusy = true;
    renderIdeas();
    focusResults();
    try {
      var avoid = state.ideas.map(function (i) { return i.title; }).slice(-30);
      var data = await A.askJson(ideasPrompt(brief, avoid));
      var list = Array.isArray(data) ? data : (data && Array.isArray(data.ideas) ? data.ideas : []);
      var seen = {};
      state.ideas.forEach(function (i) { seen[i.title.toLowerCase()] = true; });
      var fresh = [];
      list.map(normalizeIdea).forEach(function (i) {
        if (i && !seen[i.title.toLowerCase()]) { seen[i.title.toLowerCase()] = true; fresh.push(i); }
      });
      if (!fresh.length) throw { code: "invalid_json" };
      state.ideas = state.ideas.concat(fresh);
      U.announce(fresh.length + " idea ready hai.");
    } catch (e) {
      state.error = handleError(e);
    } finally {
      state.ideasBusy = false;
      if (state.view === "ideas") renderIdeas();
    }
  }

  function renderIdeas() {
    state.view = "ideas";
    results.replaceChildren();
    results.setAttribute("aria-busy", state.ideasBusy ? "true" : "false");
    
    var creditsLeft = getCredits();

    if (!state.ideas.length && !state.ideasBusy && !state.error) {
      results.append(el("div", { class: "empty" },
        el("strong", { text: "Abhi koi idea nahi" }),
        el("p", { text: "Niche likho aur format chuno. Free credits bache hain: " + creditsLeft })));
      return;
    }
    if (state.ideas.length && state.brief) {
      results.append(
        el("h2", { class: "res-title", text: "Idea " + FORMATS[state.brief.fmt].short + " ke liye (Credits bache: " + creditsLeft + ")" }),
        el("p", { class: "sub", text: state.brief.niche }));
      var ul = el("ul", { class: "ideas" });
      state.ideas.forEach(function (idea) {
        ul.append(el("li", { class: "idea" },
          el("h3", { text: idea.title }),
          idea.hook ? el("p", { class: "hook", text: "\u201C" + idea.hook + "\u201D" }) : null,
          idea.angle ? el("p", { class: "angle", text: idea.angle }) : null,
          el("button", { class: "btn ghost", type: "button", "aria-label": "Script likho: " + idea.title, onclick: function () { openScript(idea); } }, "Script likho")));
      });
      results.append(ul);
    }
    if (state.ideasBusy) results.append(el("p", { class: "thinking", text: "Idea ban raha hai..." }));
    if (state.error) results.append(el("p", { class: "error", role: "alert", text: state.error }));
    if (state.ideas.length && !state.ideasBusy) {
      results.append(el("button", { class: "btn quiet more", type: "button", onclick: function () { getIdeas(true); } }, "Idea do"));
    }
  }

  /* ---------- script ---------- */
  function scriptPrompt(b, idea) {
    var f = FORMATS[b.fmt];
    return "You are a professional scriptwriter for YouTube and Instagram creators. Write a ready-to-record script.\n\n" +
      "Creator brief:\n" + briefLines(b) + "\n\n" +
      "Video:\n" + "Title: " + idea.title + "\n" +
      (idea.hook ? "Opening line to use or improve: " + idea.hook + "\n" : "") +
      (idea.angle ? "Angle: " + idea.angle + "\n" : "") + "\n" +
      "Structure: " + f.structure + "\n\n" +
      "Write in Hinglish spoken language: short sentences, natural code-switching, no filler. Give concrete examples, numbers, and steps instead of vague advice. Match the tone.\n\n" +
      "Keep the markers ##, SHOW:, SAY:, TEXT: and the timecodes exactly as shown; only the words after them are Hinglish. Beat names can stay in English (Hook, Payoff, CTA). Hashtags can mix English and Roman Hindi.\n\n" +
      "Output format (strict, plain text, no other markdown, no text outside beats):\n" +
      "## Beat name | start-end   (example: ## Hook | 0:00-0:05)\n" +
      "SHOW: one short line on what is on screen or what the creator does\n" +
      "SAY: exactly what the creator says\n" +
      "Repeat SHOW and SAY lines inside a beat as needed.\n" + f.finalBeat;
  }

  function beatEl(b) {
    var t = L.cleanTime(b.time);
    return el("section", { class: "beat" },
      el("span", { class: t ? "tc" : "tc post", text: t || "Post" }),
      el("div", null,
        el("h3", { text: b.label }),
        b.lines.map(function (l) {
          return el("p", { class: "line " + (l.kind === "show" ? "show" : "say"), text: l.kind === "show" ? "(" + l.text + ")" : l.text });
        })));
  }

  function paintBeats() {
    var host = document.getElementById("beats");
    if (!host) return;
    var beats = L.parseScript(state.scriptText);
    host.replaceChildren();
    if (!beats.length) {
      host.append(el("p", { class: "thinking", text: state.scriptBusy ? "Script ban rahi hai" : "Abhi script nahi hai." }));
      return;
    }
    beats.forEach(function (b) { host.append(beatEl(b)); });
    if (state.scriptBusy) host.append(el("p", { class: "thinking", text: state.scriptBusy ? "Script abhi bhi ban rahi hai" : "Script ban rahi hai" }));
  }

  function scriptAsText() {
    var b = state.brief, i = state.selected;
    var out = [i.title, FORMATS[b.fmt].label + ", " + TONE_LABELS[b.tone] + " tone", ""];
    L.parseScript(state.scriptText).forEach(function (beat) {
      var t = L.cleanTime(beat.time);
      out.push((t ? "[" + t + "] " : "") + beat.label);
      beat.lines.forEach(function (l) { out.push(l.kind === "show" ? "(" + l.text + ")" : l.text); });
      out.push("");
    });
    return out.join("\n").trim() + "\n";
  }

  function slug(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "script";
  }

  function setStatus(msg) {
    var s = document.getElementById("script-status");
    if (s) s.textContent = msg;
    if (msg) U.announce(msg);
  }

  function renderScript() {
    state.view = "script";
    results.replaceChildren();
    results.setAttribute("aria-busy", state.scriptBusy ? "true" : "false");
    var b = state.brief, idea = state.selected, f = FORMATS[b.fmt];
    var actions = el("div", { class: "actions" });
    if (state.scriptBusy) {
      actions.append(el("button", { class: "btn quiet", type: "button", onclick: function () { if (scriptCtl) scriptCtl.abort(); } }, "Roko"));
    } else {
      var hasText = L.parseScript(state.scriptText).length > 0;
      if (hasText) {
        actions.append(el("button", { class: "btn primary inline", type: "button", onclick: sendToPublisher }, "Publish ke liye bhejo"));
        actions.append(el("button", { class: "btn ghost", type: "button", onclick: async function () { setStatus((await U.copyText(scriptAsText())) ? "Copy ho gaya." : "Copy nahi hua. Text select karke haath se copy karo."); } }, "Script copy karo"));
        actions.append(el("button", { class: "btn quiet", type: "button", onclick: function () { try { U.saveFile(slug(idea.title) + ".txt", scriptAsText()); setStatus("Save ho gaya."); } catch (e) { setStatus("File save nahi hui."); } } }, "Download .txt"));
      }
      actions.append(el("button", { class: "btn quiet", type: "button", onclick: generateScript }, hasText ? "Dobara likho" : "Phir se try karo"));
    }
    actions.append(el("span", { class: "status", id: "script-status" }));
    results.append(
      el("button", { class: "btn link", type: "button", onclick: backToIdeas }, "Ideas par wapas"),
      el("div", { class: "script-head" },
        el("h2", { class: "res-title", text: idea.title }),
        el("p", { class: "sub", text: f.label + ", " + f.lengthHi + ", " + TONE_LABELS[b.tone] + " tone" })),
      actions,
      el("div", { class: "page", id: "beats" }));
    if (state.truncated && !state.scriptBusy) results.append(el("p", { class: "sub", text: "Ye script beech mein hi ruk gayi. 'Dobara likho' dabao, chhoti version milegi." }));
    if (state.error) results.append(el("p", { class: "error", role: "alert", text: state.error }));
    paintBeats();
  }

  function sendToPublisher() {
    var cur = I.current();
    if (!cur) return;
    Cue.publisher.loadFromScript(cur.idea, cur.brief, cur.scriptText);
    Cue.app.showTab("publish");
    U.toast("Script Publish tab mein bhar diya.");
  }

  function openScript(idea) { state.selected = idea; generateScript(); focusResults(); }

  function backToIdeas() {
    if (scriptCtl) { scriptCtl.abort(); scriptCtl = null; }
    state.scriptBusy = false;
    renderIdeas();
    focusResults();
  }

  async function generateScript() {
    var b = state.brief, idea = state.selected;
    state.scriptText = "";
    state.truncated = false;
    state.error = "";
    state.scriptBusy = true;
    var ctl = new AbortController();
    scriptCtl = ctl;
    renderScript();
    try {
      var res = await A.askStream(scriptPrompt(b, idea), {
        signal: ctl.signal,
        onText: function (o) { if (scriptCtl !== ctl) return; state.scriptText = o.text; paintBeats(); }
      });
      if (scriptCtl === ctl) { state.scriptText = res.text; state.truncated = !!res.truncated; }
    } catch (e) {
      if (scriptCtl === ctl) {
        if (e && e.text) state.scriptText = e.text;
        if (!e || e.code !== "cancelled") state.error = handleError(e);
      }
    } finally {
      if (scriptCtl === ctl) {
        state.scriptBusy = false;
        if (state.view === "script") { renderScript(); if (!state.error) U.announce("Script ready hai."); }
      }
    }
  }

  /* ---------- public ---------- */
  I.current = function () {
    if (!state.selected || !state.brief || !L.parseScript(state.scriptText).length) return null;
    return { idea: state.selected, brief: state.brief, scriptText: state.scriptText };
  };

  I.init = function () {
    results = document.getElementById("results");
    form = document.getElementById("brief");
    nicheEl = document.getElementById("niche");
    audienceEl = document.getElementById("audience");
    nicheError = document.getElementById("niche-error");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (scriptCtl && state.scriptBusy) { scriptCtl.abort(); scriptCtl = null; state.scriptBusy = false; }
      getIdeas(false);
    });
    nicheEl.addEventListener("input", function () { if (nicheEl.value.trim()) setFieldError(""); });
    loadPrefs();
    renderIdeas();
  };
})();
