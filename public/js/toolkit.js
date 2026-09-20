/* Creator toolkit: fancy bio fonts and best-upload-time calculator. */
(function () {
  "use strict";
  var Cue = (window.Cue = window.Cue || {});
  var T = (Cue.toolkit = {});
  var U = Cue.ui, L = Cue.lib, el = U.el;
  var bioIn, bioCount, fontsOut, symList, tzSel, timesOut;
  var deviceTz = "Asia/Kolkata";
  var tzOptions = L.TIMEZONES.slice();

  try { deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone || deviceTz; } catch (e) {}
  if (!tzOptions.some(function (t) { return t.id === deviceTz; })) tzOptions.unshift({ id: deviceTz, label: "Aapka device (" + deviceTz + ")" });

  function currentTz() {
    if (tzSel && tzSel.value) return tzSel.value;
    var s = U.settings.get().audienceTz;
    return tzOptions.some(function (t) { return t.id === s; }) ? s : deviceTz;
  }

  function tzLabel(tz) {
    for (var i = 0; i < tzOptions.length; i++) if (tzOptions[i].id === tz) return tzOptions[i].label;
    return tz;
  }

  /* ---------- bio fonts ---------- */
  function renderFonts() {
    var raw = bioIn.value;
    var n = L.charLen(raw);
    bioCount.textContent = n + "/150";
    bioCount.classList.toggle("over", n > 150);
    var text = raw || bioIn.placeholder;
    fontsOut.replaceChildren();
    L.FONTS.forEach(function (f) {
      var styled = L.stylize(text, f);
      fontsOut.append(el("li", { class: "font-row" },
        el("div", { class: "font-txt" }, el("small", { text: f.name }), el("p", { class: "font-sample", text: styled })),
        el("button", {
          class: "btn quiet small", type: "button", "aria-label": f.name + " style copy karo",
          onclick: async function () { U.toast((await U.copyText(styled)) ? "Copy ho gaya: " + f.name : "Copy nahi hua. Text select karke copy karo."); }
        }, "Copy")));
    });
  }

  function renderSymbols() {
    symList.replaceChildren();
    L.SYMBOLS.forEach(function (s) {
      symList.append(el("button", {
        class: "sym", type: "button", "aria-label": "Bio mein " + s + " jodo",
        onclick: function () { bioIn.value += s; renderFonts(); bioIn.focus(); }
      }, s));
    });
  }

  /* ---------- best time ---------- */
  function renderTimes() {
    var tz = currentTz(), now = new Date();
    timesOut.replaceChildren();
    L.PLATFORMS.forEach(function (p) {
      var slots = L.nextSlots(p.id, tz, now, 3);
      var chips = el("div", { class: "slots" });
      if (!slots.length) chips.append(el("span", { class: "sub", text: "Abhi koi slot nahi mila." }));
      slots.forEach(function (s) {
        var main = L.slotLabel(s.at, tz, now);
        var btn = el("button", {
          class: "slot", type: "button", "aria-label": p.name + " ke liye " + main + " schedule karo",
          onclick: function () { Cue.publisher.setSchedule(s.at); }
        }, el("span", { text: main }));
        if (tz !== deviceTz) btn.append(el("small", { text: "Aapke time: " + L.slotLabel(s.at, deviceTz, now) }));
        chips.append(btn);
      });
      timesOut.append(el("li", { class: "time-row" },
        el("div", { class: "time-head" }, U.mono(p), el("b", { text: p.name }), p.id === "linkedin" ? el("small", { text: "Sirf weekdays" }) : null),
        chips));
    });
  }

  /* ---------- public ---------- */
  T.bestFor = function (ids) {
    var tz = currentTz(), now = new Date(), best = null;
    ids.forEach(function (id) {
      var s = L.nextSlots(id, tz, now, 1)[0];
      if (s && (!best || s.at < best.at)) best = { at: s.at, id: id };
    });
    if (!best) return null;
    return { at: best.at, platform: best.id, label: L.slotLabel(best.at, tz, now), tzLabel: tzLabel(tz) };
  };

  T.refresh = renderTimes;

  T.init = function () {
    bioIn = document.getElementById("bio-in");
    bioCount = document.getElementById("bio-count");
    fontsOut = document.getElementById("bio-out");
    symList = document.getElementById("sym-list");
    tzSel = document.getElementById("tz-sel");
    timesOut = document.getElementById("time-out");

    tzOptions.forEach(function (t) { tzSel.append(el("option", { value: t.id, text: t.label })); });
    var saved = U.settings.get().audienceTz;
    tzSel.value = tzOptions.some(function (t) { return t.id === saved; }) ? saved : deviceTz;
    tzSel.addEventListener("change", function () { U.settings.set({ audienceTz: tzSel.value }); renderTimes(); });
    bioIn.addEventListener("input", renderFonts);
    renderSymbols();
    renderFonts();
    renderTimes();
  };
})();
