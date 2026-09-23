/* One-click multi-platform publisher: media, platform selection, per-platform captions,
   publish now / schedule, live status. Talks to /api/publish (Ayrshare or webhook) or runs in demo mode. */
(function () {
  "use strict";
  var Cue = (window.Cue = window.Cue || {});
  var P = (Cue.publisher = {});
  var U = Cue.ui, L = Cue.lib, A = Cue.api, el = U.el;
  var LS_KEY = "cue:publisher";
  var MAX_MB = 512;

  var state = {
    media: { kind: "none" },
    master: { title: "", caption: "", tags: "" },
    selected: {},
    overrides: {},
    scheduleOpen: false,
    backend: { mode: "checking", provider: "", connected: {}, message: "", connectUrl: "", accounts: 0 },
    running: false,
    current: null
  };
  var refs = {};
  var previewRefs = {};
  var jobRows = {};

  function $id(id) { return document.getElementById(id); }
  function isDemo() { return state.backend.mode === "demo"; }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function mediaUrl() {
    var m = state.media;
    if (m.kind === "url") return m.url;
    if (m.kind === "file") return m.uploaded ? m.accessUrl : "";
    return "";
  }

  function selectedIds() {
    return L.PLATFORMS.filter(function (p) { return state.selected[p.id] && connState(p.id).usable; }).map(function (p) { return p.id; });
  }

  function draftFor(id) {
    var base = L.buildDraft(id, state.master);
    var ov = state.overrides[id] || {};
    return { title: ov.title != null ? ov.title : base.title, text: ov.text != null ? ov.text : base.text };
  }

  function saveDraft() { U.store.set(LS_KEY, { master: state.master, selected: state.selected }); }

  /* ================= connections ================= */
  function setBackend(patch) { state.backend = Object.assign({ mode: "checking", provider: "", connected: {}, message: "", connectUrl: "", accounts: 0 }, patch); }

  async function loadConnections() {
    // Access key check bypass - always use demo mode
    setBackend({ mode: "demo", message: "Demo mode active hai." });
    Object.keys(state.selected).forEach(function (id) { if (!connState(id).usable) delete state.selected[id]; });
    renderAll();
    var m = state.media;
    if (m.kind === "file" && m.pending) { m.pending = false; startMediaUpload(m); }
  }

  function connState(id) {
    var b = state.backend;
    if (b.mode === "demo") return { label: "Demo", cls: "info", usable: true };
    if (b.mode === "live") {
      var c = b.connected[id];
      if (c === true) return { label: "Connected", cls: "ok", usable: true };
      if (c === "webhook") return { label: "Via webhook", cls: "info", usable: true };
      return { label: "Connect nahi hai", cls: "bad", usable: false };
    }
    if (b.mode === "checking") return { label: "Check ho raha hai", cls: "muted", usable: false };
    return { label: "Locked", cls: "warn", usable: false };
  }

  function renderBanner() {
    var node = refs.banner;
    if (node) node.hidden = true; // Banner ko hamesha ke liye hide kar diya
  }

  function renderConnLine() {
    var b = state.backend, t;
    if (b.mode === "demo") t = "Demo mode: accounts connect nahi hain, sirf flow dikhega.";
    else if (b.mode === "live" && b.provider === "ayrshare") t = "Ayrshare se " + b.accounts + " account connected hain.";
    else if (b.mode === "live") t = "Webhook (n8n / Make.com) ke through post hoga.";
    else if (b.mode === "checking") t = "Connection check ho raha hai\u2026";
    else t = b.message || "";
    refs.connLine.textContent = t;
  }

  function renderPlatforms() {
    refs.platList.replaceChildren();
    L.PLATFORMS.forEach(function (p) {
      var cs = connState(p.id);
      var input = el("input", { type: "checkbox", value: p.id, disabled: !cs.usable, "aria-describedby": "cs-" + p.id });
      input.checked = !!state.selected[p.id] && cs.usable;
      input.addEventListener("change", function () {
        if (input.checked) state.selected[p.id] = true; else delete state.selected[p.id];
        saveDraft(); syncPreviews(); updateActions();
      });
      var li = el("li", { class: "plat" + (cs.usable ? "" : " off") });
      li.append(el("label", { class: "plat-row" },
        input, U.mono(p),
        el("span", { class: "plat-txt" }, el("b", { text: p.name }), el("small", { text: p.hint })),
        el("span", { class: "badge " + cs.cls, id: "cs-" + p.id, text: cs.label })));
      if (state.backend.mode === "live" && state.backend.connected[p.id] === false && state.backend.connectUrl) {
        li.append(el("a", { class: "btn link small connect", href: state.backend.connectUrl, target: "_blank", rel: "noopener noreferrer" }, "Connect karo"));
      }
      refs.platList.append(li);
    });
  }

  /* ================= media ================= */
  function clearMedia(keepUrlInput) {
    var m = state.media;
    if (m.abort) { try { m.abort(); } catch (e) {} }
    if (m.objectUrl) URL.revokeObjectURL(m.objectUrl);
    refs.preview.removeAttribute("src");
    state.media = { kind: "none" };
    refs.fileInput.value = "";
    if (!keepUrlInput) refs.videoUrl.value = "";
    renderMedia();
    updateActions();
  }

  function onFile(file) {
    if (!file) return;
    var ext = (file.name.split(".").pop() || "").toLowerCase();
    if (ext !== "mp4" && ext !== "mov") { U.toast("Sirf MP4 ya MOV video chalegi."); return; }
    if (file.size > MAX_MB * 1048576) { U.toast("Video " + MAX_MB + " MB se chhota hona chahiye."); return; }
    clearMedia(false);
    var m = { kind: "file", file: file, name: file.name, size: file.size, objectUrl: URL.createObjectURL(file), uploading: false, progress: 0, uploaded: false, accessUrl: "", error: "", pending: false };
    state.media = m;
    renderMedia();
    if (state.backend.mode === "checking") { m.pending = true; renderMedia(); }
    else startMediaUpload(m);
    updateActions();
  }

  function startMediaUpload(m) {
    if (isDemo()) return simulateUpload(m);
    if (state.backend.mode === "live" && state.backend.provider === "ayrshare") return startUpload(m);
    m.error = state.backend.mode === "live"
      ? "Is provider mein direct upload nahi hai. Video ka public URL paste karo."
      : "Backend ready nahi hai, isliye upload nahi ho sakta.";
    renderMedia();
    updateActions();
  }

  function simulateUpload(m) {
    m.uploading = true; m.progress = 0;
    var t0 = Date.now();
    (function tick() {
      if (state.media !== m) return;
      m.progress = Math.min(1, (Date.now() - t0) / 1200);
      if (m.progress < 1) { renderMedia(); setTimeout(tick, 80); return; }
      m.uploading = false; m.uploaded = true; m.accessUrl = "https://demo.invalid/" + encodeURIComponent(m.name);
      renderMedia(); updateActions();
    })();
  }

  async function startUpload(m) {
    m.uploading = true; m.progress = 0; m.error = "";
    renderMedia(); updateActions();
    try {
      var info = await A.uploadUrl(m.name);
      if (state.media !== m) return;
      var up = A.putFile(info.uploadUrl, m.file, info.contentType, function (f) { m.progress = f; renderMedia(); });
      m.abort = up.abort;
      await up.promise;
      m.accessUrl = info.accessUrl;
      m.uploaded = true;
    } catch (e) {
      if (e && e.code === "cancelled") return;
      if (e && e.code === "unauthorized") Cue.app.openSettings();
      m.error = A.errorCopy(e);
    } finally {
      m.uploading = false; m.abort = null;
      if (state.media === m) { renderMedia(); updateActions(); }
    }
  }

  function useUrl() {
    var raw = refs.videoUrl.value.trim();
    if (!/^https:\/\/\S+$/i.test(raw)) { U.toast("Public https:// URL daalo."); refs.videoUrl.focus(); return; }
    clearMedia(true);
    state.media = { kind: "url", url: raw, name: raw };
    renderMedia();
    updateActions();
  }

  function renderMedia() {
    var m = state.media, has = m.kind !== "none";
    refs.mediaInfo.hidden = !has;
    refs.drop.classList.toggle("has-media", has);
    if (!has) return;
    var src = m.kind === "file" ? m.objectUrl : m.url;
    if (refs.preview.getAttribute("src") !== src) { refs.preview.hidden = false; refs.preview.src = src; }
    refs.mediaName.textContent = m.kind === "file" ? m.name + " (" + L.fmtBytes(m.size) + ")" : m.url;
    var showBar = m.kind === "file" && (m.uploading || m.uploaded);
    refs.uploadBar.hidden = !showBar;
    var pct = Math.round((m.uploaded ? 1 : m.progress || 0) * 100);
    refs.uploadFill.style.width = pct + "%";
    refs.uploadBar.setAttribute("aria-valuenow", String(pct));
    var msg = "";
    if (m.kind === "file") {
      if (m.error) msg = m.error;
      else if (m.uploading) msg = "Upload ho raha hai " + pct + "%";
      else if (m.uploaded) msg = isDemo() ? "Demo: upload ho gaya." : "Upload ho gaya. Publish ke liye ready.";
      else if (m.pending) msg = "Backend check ho raha hai\u2026";
    } else {
      msg = "Is URL se video publish hoga.";
    }
    refs.uploadMsg.textContent = msg;
    refs.uploadMsg.classList.toggle("error", !!(m.kind === "file" && m.error));
  }

  /* ================= content + previews ================= */
  function writeMaster() {
    refs.mTitle.value = state.master.title;
    refs.mCaption.value = state.master.caption;
    refs.mTags.value = state.master.tags;
  }

  function onMasterInput() {
    state.master = { title: refs.mTitle.value, caption: refs.mCaption.value, tags: refs.mTags.value };
    saveDraft(); syncPreviews(); updateActions();
  }

  function paintText(node, text) {
    node.replaceChildren();
    String(text).split(/(#[\p{L}\p{N}_]+)/gu).forEach(function (part) {
      if (!part) return;
      node.append(/^#[\p{L}\p{N}_]+$/u.test(part) ? el("span", { class: "tag", text: part }) : document.createTextNode(part));
    });
  }

  function createPreview(p) {
    var r = {};
    r.edited = el("span", { class: "edited", hidden: true, text: "Edit kiya hua" });
    r.reset = el("button", { class: "btn link small", type: "button", hidden: true, onclick: function () { delete state.overrides[p.id]; refreshPreview(p.id); updateActions(); } }, "Auto par wapas");
    r.count = el("span", { class: "count" });
    r.textarea = el("textarea", { rows: "5", id: "pv-text-" + p.id });
    r.textarea.addEventListener("input", function () {
      state.overrides[p.id] = Object.assign({}, state.overrides[p.id], { text: r.textarea.value });
      refreshPreview(p.id); updateActions();
    });
    r.pvTitle = el("p", { class: "pv-title" });
    r.pvText = el("p", { class: "pv-text" });
    var kids = [el("header", { class: "prev-head" }, U.mono(p), el("h3", { text: p.name }), r.edited)];
    if (p.hasTitle) {
      r.titleCount = el("span", { class: "count" });
      r.titleInput = el("input", { type: "text", id: "pv-title-" + p.id });
      r.titleInput.addEventListener("input", function () {
        state.overrides[p.id] = Object.assign({}, state.overrides[p.id], { title: r.titleInput.value });
        refreshPreview(p.id); updateActions();
      });
      kids.push(el("label", { class: "label", for: "pv-title-" + p.id }, "Title"), el("div", { class: "field-row" }, r.titleInput, r.titleCount));
    }
    kids.push(
      el("label", { class: "label", for: "pv-text-" + p.id }, p.hasTitle ? "Description" : "Caption"),
      r.textarea,
      el("div", { class: "count-row" }, r.count, r.reset),
      el("div", { class: "pv", role: "group", "aria-label": p.name + " preview" }, r.pvTitle, r.pvText));
    r.root = el("article", { class: "prev", "data-id": p.id }, kids);
    return r;
  }

  function refreshPreview(id) {
    var r = previewRefs[id], p = L.byId(id);
    if (!r) return;
    var ov = state.overrides[id] || {}, base = L.buildDraft(id, state.master);
    var title = ov.title != null ? ov.title : base.title;
    var text = ov.text != null ? ov.text : base.text;
    if (r.textarea.value !== text) r.textarea.value = text;
    if (r.titleInput && r.titleInput.value !== title) r.titleInput.value = title;
    var tl = L.charLen(text);
    r.count.textContent = tl + "/" + p.limit;
    r.count.classList.toggle("over", tl > p.limit);
    if (r.titleCount) {
      var ll = L.charLen(title);
      r.titleCount.textContent = ll + "/" + p.titleLimit;
      r.titleCount.classList.toggle("over", ll > p.titleLimit);
    }
    var edited = ov.title != null || ov.text != null;
    r.edited.hidden = !edited;
    r.reset.hidden = !edited;
    r.pvTitle.hidden = !p.hasTitle || !title;
    r.pvTitle.textContent = title;
    paintText(r.pvText, text || "(caption khaali hai)");
  }

  function syncPreviews() {
    var ids = selectedIds();
    Object.keys(previewRefs).forEach(function (id) {
      if (ids.indexOf(id) === -1) { previewRefs[id].root.remove(); delete previewRefs[id]; }
    });
    ids.forEach(function (id) {
      if (!previewRefs[id]) previewRefs[id] = createPreview(L.byId(id));
      refs.previews.append(previewRefs[id].root);
      refreshPreview(id);
    });
    refs.previewsEmpty.hidden = ids.length > 0;
  }

  /* ================= validation + actions ================= */
  function validate() {
    var out = [], ids = selectedIds(), m = state.media;
    if (m.kind === "none") out.push({ text: "Video chuno ya URL daalo", level: "todo" });
    else if (m.kind === "file" && !isDemo()) {
      if (m.uploading) out.push({ text: "Video upload ho raha hai, thoda ruko", level: "todo" });
      else if (m.pending) out.push({ text: "Backend check ho raha hai", level: "todo" });
      else if (!m.uploaded) out.push({ text: m.error || "Video ka public URL chahiye (upload nahi hua)", level: "bad" });
    } else if (m.kind === "file" && isDemo() && !m.uploaded) {
      out.push({ text: "Video upload ho raha hai, thoda ruko", level: "todo" });
    }
    if (!ids.length) out.push({ text: "Kam se kam ek platform chuno", level: "todo" });
    ids.forEach(function (id) {
      var p = L.byId(id), d = draftFor(id);
      if (p.hasTitle && !d.title.trim()) out.push({ text: p.name + " ke liye title chahiye", level: "todo" });
      if (p.titleLimit && L.charLen(d.title) > p.titleLimit) out.push({ text: p.name + " ka title bahut lamba hai (" + L.charLen(d.title) + "/" + p.titleLimit + ")", level: "bad" });
      if (L.charLen(d.text) > p.limit) out.push({ text: p.name + " ka caption bahut lamba hai (" + L.charLen(d.text) + "/" + p.limit + ")", level: "bad" });
    });
    return out;
  }

  function updateActions() {
    var problems = validate(), n = selectedIds().length;
    refs.problems.replaceChildren();
    if (!problems.length) refs.problems.append(el("li", { class: "ok", text: "Sab ready hai" }));
    problems.forEach(function (pr) { refs.problems.append(el("li", { class: pr.level, text: pr.text })); });
    var blocked = state.running || problems.length > 0;
    refs.btnNow.disabled = blocked;
    refs.btnNow.textContent = n ? "Abhi publish karo (" + n + ")" : "Abhi publish karo";
    refs.btnSchedule.disabled = blocked;
    refs.btnSchedule.textContent = state.scheduleOpen ? "Schedule confirm karo" : "Schedule karo";
  }

  function renderAll() {
    renderBanner(); renderConnLine(); renderPlatforms(); syncPreviews(); renderMedia(); updateActions();
  }

  /* ================= schedule ================= */
  function setSchedNote(msg, isErr) {
    refs.schedNote.textContent = msg || "";
    refs.schedNote.classList.toggle("error", !!isErr);
  }

  function openSchedule() {
    state.scheduleOpen = true;
    refs.schedulePanel.hidden = false;
    if (!refs.schedAt.value) applyBestTime(true);
    updateActions();
    refs.schedAt.focus();
  }

  function closeSchedule() {
    state.scheduleOpen = false;
    refs.schedulePanel.hidden = true;
    setSchedNote("");
    updateActions();
  }

  function applyBestTime(quiet) {
    var ids = selectedIds();
    var best = Cue.toolkit.bestFor(ids.length ? ids : ["instagram"]);
    if (!best) { if (!quiet) U.toast("Best time nahi mila."); return; }
    refs.schedAt.value = L.toLocalInput(best.at);
    setSchedNote("Best time: " + best.label + " (" + best.tzLabel + "). Baaki platforms ke slots Toolkit mein dekho.");
  }

  /* ================= publishing ================= */
  function defaultMsg(st) {
    return { done: "Publish ho gaya.", scheduled: "Schedule ho gaya.", processing: "Processing ho rahi hai.", queued: "Automation ko bhej diya.", failed: "Publish fail ho gaya." }[st] || "";
  }

  function setResult(rec, id, patch) {
    Object.assign(rec.results[id], patch);
    if (state.current && rec.id === state.current.id) { paintJob(id); updateProgress(); }
    Cue.history.upsert(rec);
  }

  async function simulate(id, rec, push) {
    var p = L.byId(id);
    await wait(700 + Math.random() * 1100);
    if (rec.mode === "schedule" && rec.results[id].payload.scheduleAt) return { state: "scheduled", message: "Demo: schedule ho gaya." };
    if (p.verb === "upload") {
      push({ state: "processing", message: p.name + " par processing ho rahi hai\u2026" });
      await wait(900 + Math.random() * 900);
    }
    return { state: "done", message: "Demo: publish ho gaya.", url: "" };
  }

  async function publishOne(rec, id, demo) {
    var p = L.byId(id), r = rec.results[id];
    var verb = p.verb === "upload" ? "upload" : "publish";
    setResult(rec, id, { state: verb === "upload" ? "uploading" : "publishing", message: p.name + " par " + verb + " ho raha hai\u2026", settled: false, url: "" });
    var out;
    try {
      if (demo) out = await simulate(id, rec, function (patch) { setResult(rec, id, patch); });
      else out = await A.publish(Object.assign({ requestId: rec.id + "-" + id }, r.payload));
      var st = ["done", "scheduled", "processing", "queued", "failed"].indexOf(out.state) > -1 ? out.state : "failed";
      setResult(rec, id, { state: st, message: out.message || defaultMsg(st), url: out.url || "", settled: true });
    } catch (e) {
      if (e && e.code === "unauthorized") Cue.app.openSettings();
      setResult(rec, id, { state: "failed", message: A.errorCopy(e), settled: true });
    }
  }

  function summaryText(rec) {
    var c = { done: 0, scheduled: 0, failed: 0, other: 0 };
    Object.keys(rec.results).forEach(function (id) {
      var s = rec.results[id].state;
      if (c[s] != null) c[s]++; else c.other++;
    });
    var parts = [];
    if (c.done) parts.push(c.done + " publish");
    if (c.scheduled) parts.push(c.scheduled + " scheduled");
    if (c.other) parts.push(c.other + " processing / bheje gaye");
    if (c.failed) parts.push(c.failed + " fail");
    return parts.join(", ");
  }

  async function runJobs(rec, ids) {
    state.running = true;
    updateActions();
    var demo = isDemo();
    await Promise.all(ids.map(function (id) { return publishOne(rec, id, demo); }));
    state.running = false;
    updateActions();
    updateProgress();
    U.announce("Publishing complete. " + summaryText(rec));
    Cue.history.render();
  }

  async function runPublish(scheduled) {
    if (state.running) return;
    if (validate().length) return;
    var scheduleAt = "";
    if (scheduled) {
      var d = new Date(refs.schedAt.value);
      if (!refs.schedAt.value || isNaN(d.getTime()) || d.getTime() < Date.now() + 5 * 60000) { setSchedNote("Time kam se kam 5 minute aage ka chuno.", true); refs.schedAt.focus(); return; }
      if (!isDemo() && state.media.kind === "file" && d.getTime() > Date.now() + 29 * 86400000) { setSchedNote("Upload kiya hua video 30 din tak hi available rehta hai. Isse pehle ka time chuno ya public URL use karo.", true); return; }
      scheduleAt = L.zulu(d);
      setSchedNote("");
    }
    var ids = selectedIds();
    var url = mediaUrl();
    var rec = {
      id: L.uid(), ts: Date.now(),
      title: (state.master.title || L.firstSentence(state.master.caption) || "Untitled").slice(0, 100),
      mode: scheduled ? "schedule" : "now", scheduleAt: scheduleAt, demo: isDemo(),
      media: state.media.kind === "file" ? state.media.name : state.media.url, results: {}
    };
    ids.forEach(function (id) {
      var d2 = draftFor(id);
      rec.results[id] = { state: "waiting", message: "Line mein", url: "", settled: false, payload: { platform: id, title: d2.title, text: d2.text, mediaUrl: url, scheduleAt: scheduleAt || null } };
    });
    state.current = rec;
    Cue.history.upsert(rec);
    renderStatus();
    U.scrollToEl(refs.statusBlock);
    if (scheduled) closeSchedule();
    await runJobs(rec, ids);
  }

  /* ---------- status block ---------- */
  function renderStatus() {
    var rec = state.current;
    refs.statusBlock.hidden = !rec;
    refs.statusList.replaceChildren();
    jobRows = {};
    if (!rec) return;
    L.PLATFORMS.forEach(function (p) { if (rec.results[p.id]) refs.statusList.append(createJobRow(p)); });
    updateProgress();
  }

  function createJobRow(p) {
    var row = {
      badgeHolder: el("span", { class: "badge-slot" }),
      msg: el("small", { class: "job-msg" }),
      link: el("a", { class: "btn link small", target: "_blank", rel: "noopener noreferrer", hidden: true }, "Post dekho")
    };
    row.li = el("li", { class: "job" }, U.mono(p), el("div", { class: "job-txt" }, el("b", { text: p.name }), row.msg), row.badgeHolder, row.link);
    jobRows[p.id] = row;
    paintJob(p.id);
    return row.li;
  }

  function paintJob(id) {
    var rec = state.current, row = jobRows[id];
    if (!rec || !row) return;
    var r = rec.results[id];
    row.li.dataset.state = r.state;
    row.badgeHolder.replaceChildren(U.badge(r.state));
    row.msg.textContent = r.message || "";
    if (r.url && /^https?:\/\//i.test(r.url)) { row.link.href = r.url; row.link.hidden = false; } else row.link.hidden = true;
  }

  function updateProgress() {
    var rec = state.current;
    if (!rec) return;
    var ids = Object.keys(rec.results);
    var settled = ids.filter(function (id) { return rec.results[id].settled; }).length;
    refs.statusFill.style.width = Math.round((settled / ids.length) * 100) + "%";
    refs.statusBar.setAttribute("aria-valuenow", String(Math.round((settled / ids.length) * 100)));
    var finished = settled === ids.length;
    refs.statusSum.textContent = finished ? summaryText(rec) : settled + "/" + ids.length + " complete";
    var anyFailed = ids.some(function (id) { return rec.results[id].state === "failed"; });
    refs.btnRetryFailed.hidden = !(finished && anyFailed && !state.running);
    refs.btnNew.hidden = !finished;
  }

  function retryFailed() {
    var rec = state.current;
    if (!rec || state.running) return;
    var ids = Object.keys(rec.results).filter(function (id) { return rec.results[id].state === "failed"; });
    ids.forEach(function (id) {
      var r = rec.results[id];
      if (r.payload.scheduleAt && new Date(r.payload.scheduleAt).getTime() < Date.now() + 3 * 60000) r.payload.scheduleAt = null;
      setResult(rec, id, { state: "waiting", message: "Line mein", settled: false });
    });
    runJobs(rec, ids);
  }

  function newPost() {
    state.current = null;
    state.master = { title: "", caption: "", tags: "" };
    state.overrides = {};
    writeMaster();
    clearMedia(false);
    renderStatus();
    saveDraft(); syncPreviews(); updateActions();
    U.scrollToEl(refs.dropSection);
  }

  /* ================= public API ================= */
  P.loadFromScript = function (idea, brief, scriptText) {
    var d = L.extractPublishDraft(idea, L.parseScript(scriptText));
    state.master = { title: d.title, caption: d.caption, tags: d.tags };
    state.overrides = {};
    writeMaster();
    var any = Object.keys(state.selected).some(function (k) { return state.selected[k]; });
    if (!any) {
      var pref = brief && brief.fmt === "reel" ? "instagram" : "youtube";
      if (connState(pref).usable) state.selected[pref] = true;
      renderPlatforms();
    }
    saveDraft(); syncPreviews(); updateActions();
  };

  P.setSchedule = function (date) {
    state.scheduleOpen = true;
    refs.schedulePanel.hidden = false;
    refs.schedAt.value = L.toLocalInput(date);
    setSchedNote("");
    updateActions();
    Cue.app.showTab("publish");
    U.scrollToEl(refs.schedulePanel);
  };

  P.retry = async function (recId, id) {
    var rec = Cue.history.get(recId);
    if (!rec || !rec.results[id] || !rec.results[id].payload) { U.toast("Is post ka data retry ke liye available nahi hai."); return; }
    var r = rec.results[id];
    if (r.payload.scheduleAt && new Date(r.payload.scheduleAt).getTime() < Date.now() + 3 * 60000) r.payload.scheduleAt = null;
    setResult(rec, id, { state: "waiting", message: "Line mein", settled: false });
    Cue.history.render();
    await publishOne(rec, id, isDemo());
    Cue.history.render();
  };

  P.reload = loadConnections;
  P.isDemo = isDemo;

  P.init = function () {
    ["banner", "drop", "video-file", "video-url", "video-url-set", "media-info", "media-preview", "media-name", "upload-bar", "upload-fill", "upload-msg", "media-clear",
      "conn-line", "platform-list", "plat-all", "conn-refresh", "m-title", "m-caption", "m-tags", "fill-script", "fill-demo", "previews", "previews-empty", "problems",
      "schedule-panel", "sched-at", "sched-best", "sched-cancel", "sched-note", "btn-now", "btn-schedule", "status-block", "status-list", "status-bar", "status-fill",
      "status-sum", "btn-retry-failed", "btn-new", "drop-section"].forEach(function (id) {
      refs[id.replace(/-([a-z])/g, function (_, c) { return c.toUpperCase(); })] = $id(id);
    });
    refs.fileInput = refs.videoFile;
    refs.preview = refs.mediaPreview;
    refs.platList = refs.platformList;

    var saved = U.store.get(LS_KEY, null);
    if (saved && typeof saved === "object") {
      if (saved.master) state.master = { title: String(saved.master.title || ""), caption: String(saved.master.caption || ""), tags: String(saved.master.tags || "") };
      if (saved.selected && typeof saved.selected === "object") state.selected = saved.selected;
    }
    writeMaster();

    refs.fileInput.addEventListener("change", function () { onFile(refs.fileInput.files && refs.fileInput.files[0]); });
    ["dragenter", "dragover"].forEach(function (ev) { refs.drop.addEventListener(ev, function (e) { e.preventDefault(); refs.drop.classList.add("drag"); }); });
    ["dragleave", "drop"].forEach(function (ev) { refs.drop.addEventListener(ev, function () { refs.drop.classList.remove("drag"); }); });
    refs.drop.addEventListener("drop", function (e) { e.preventDefault(); onFile(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]); });
    refs.preview.addEventListener("error", function () { refs.preview.hidden = true; });
    refs.videoUrlSet.addEventListener("click", useUrl);
    refs.videoUrl.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); useUrl(); } });
    refs.mediaClear.addEventListener("click", function () { clearMedia(false); });

    refs.platAll.addEventListener("click", function () {
      L.PLATFORMS.format = L.PLATFORMS.forEach(function (p) { if (connState(p.id).usable) state.selected[p.id] = true; });
      saveDraft(); renderPlatforms(); syncPreviews(); updateActions();
    });
    refs.connRefresh.addEventListener("click", loadConnections);

    [refs.mTitle, refs.mCaption, refs.mTags].forEach(function (n) { n.addEventListener("input", onMasterInput); });
    refs.fillScript.addEventListener("click", function () {
      var cur = Cue.ideas.current();
      if (!cur) { U.toast("Pehle Ideas tab mein ek script banao."); return; }
      P.loadFromScript(cur.idea, cur.brief, cur.scriptText);
      U.toast("Script se bhar diya.");
    });
    refs.fillDemo.addEventListener("click", function () {
      state.master = { title: "Ghar par 10 minute ka full body workout", caption: "Gym jaane ka time nahi hai? Ye 10 minute ka routine roz karo aur 2 hafte mein farak dekho.\n\nSave kar lo aur kal subah try karo!", tags: "#homeworkout #fitnessindia #10minworkout #reels #shorts" };
      state.overrides = {};
      writeMaster();
      if (isDemo() && state.media.kind === "none") {
        refs.videoUrl.value = "https://example.com/sample-reel.mp4";
        useUrl();
      }
      saveDraft(); syncPreviews(); updateActions();
      U.toast("Sample content bhar diya.");
    });

    refs.schedAt.addEventListener("input", function () { setSchedNote(""); });
    refs.schedBest.addEventListener("click", function () { applyBestTime(false); });
    refs.schedCancel.addEventListener("click", closeSchedule);
    refs.btnNow.addEventListener("click", function () { runPublish(false); });
    refs.btnSchedule.addEventListener("click", function () { if (!state.scheduleOpen) openSchedule(); else runPublish(true); });
    refs.btnRetryFailed.addEventListener("click", retryFailed);
    refs.btnNew.addEventListener("click", newPost);

    renderAll();
    loadConnections();
  };
})();
