// Texere · configurarea pas cu pas (onboarding), în 4 pași: limba · PDF++ (doar dacă lipsește) · vault-ul tău · gata.
// Nimic nu se face fără clicul tău: „Înainte” aplică ce ai ales în pas (bifele, varianta) și trece mai departe. Poți rula configurarea oricând din nou:
// fiecare pas vede ce e deja făcut și nu strică nimic (folderele, harta și notele existente rămân cum sunt).
// Pașii vin din setup.js (limba, PDF++, harta, bibliografia, folderul exportului); la final, ce s-a făcut: în Ajutor → „Ultima configurare”.
"use strict";
const { Modal, Notice, setIcon } = require("obsidian");
const setup = require("./setup");
const C = require("./common");
const PL = require("./places");

const M = (ro, en) => ({ ro, en });
const LATER = "texere-wizard-later";   // ai închis configurarea înainte de final: nu se mai deschide singură pe acest laptop (doar din setări / pagina de pornire)
const icon = (el, name) => { try { setIcon(el, name); } catch (e) {} };
const none = () => ({ ok: [], todo: [], info: [], tech: [] });

// pasul „Vault-ul tău”: doar ce lipsește, fiecare cu ce face când îl bifezi
async function vaultItems(P) {
  const S = setup, out = [];
  const nf = P.missingFolders().length;
  if (nf) out.push({ key: "folders", label: M(`Folderele propuse (${nf})`, `Suggested folders (${nf})`),
    desc: M("Locurile în care Texere pune referințele, notițele, lucrările și exporturile. Le poți redenumi sau muta oricând.", "Where Texere keeps your references, notes, work and exports. You can rename or move them any time."), hint: P.folderNames ? P.folderNames() : "01. References · 02. Notes · 03. Workspace · 04. Export",
    run: async () => { const made = await P.createFolders(); P.settings.foldersDone = true; await P.save(); return { ...none(), ok: [M(`Am creat ${made} foldere.`, `Created ${made} folders.`)] }; } });
  // harta: doar dacă ai ales-o (pasul „Domeniul tău”, la prima configurare) și îi lipsesc note; altfel n-o mai propunem aici
  let mapOk = true; try { mapOk = !(P.settings.fields?.chosen || []).length || await S.fieldsMap.check(P); } catch (e) {}
  if (!mapOk) out.push({ key: "map", label: M("Harta disciplinei", "Discipline map"), desc: M("Notele care lipsesc din harta pe care ai ales-o. Cele pe care le ai rămân cum sunt.", "The notes missing from the map you chose. The ones you have stay as they are."), hint: (() => { try { const m = P.maps?.()[0], r = m && P.mapRoot(m); return m ? (r ? `${r}/${m.folder}` : m.folder) : "Disciplines/Philosophy"; } catch (e) { return "Disciplines/Philosophy"; } })(), run: () => S.fieldsMap.run(P) });
  const nn = P.noteStatus().filter(n => !n.file).length;
  if (nn) out.push({ key: "notes", label: M(`Șabloanele și ghidurile de scris (${nn})`, `Templates and writing guides (${nn})`), hint: "Support",
    desc: M("Șabloane pentru un articol și pentru lucrarea de licență sau de disertație, plus ghidurile de scris.", "Templates for an article and for a BA or MA thesis, plus the writing guides."),
    run: async () => { const made = await P.addNotes(); return { ...none(), ok: [M(`Am adăugat ${made} note (șabloanele și ghidurile de scris).`, `Added ${made} notes (templates and writing guides).`)] }; } });
  if (P.mod("sources") && !S.bibliography.check(P)) out.push({ key: "bibliography", label: M("Lista referințelor (bibliografia)", "The list of references (bibliography)"),
    desc: M("Din ea se fac citările și bibliografia de la export. Texere o ține la zi din notele de lectură tale.", "Citations and the exported bibliography come from it. Texere keeps it up to date from your reading notes."), run: () => S.bibliography.run(P) });
  const exDir = require("../shared/paths").existing(P.app, "04. Export") || require("../shared/paths").placeFor(P.app, "04. Export");
  if (P.mod("export") && !S.exportFolder.check(P)) out.push({ key: "export", label: M(`Folderul exportului: ${exDir}`, `Export folder: ${exDir}`),
    desc: M("Aici ajung fișierele exportate (PDF, Word, Markdown). Poți alege alt folder, chiar și în afara vault-ului.", "Your exported files (PDF, Word, Markdown) are saved here. You can choose another folder, even outside the vault."), run: () => S.exportFolder.run(P, "export") });
  return out;
}

// pașii, în ordine (PDF++ apare doar dacă nu e instalat și pornit când se deschide configurarea;
// „Domeniul tău” doar la prima configurare, când n-ai ales încă: la o configurare din nou nu mai apare)
function buildSteps(P, first) {
  const S = setup, steps = [];
  steps.push({ id: "language", icon: "sparkles", title: M("Bun venit în Texere", "Welcome to Texere"),
    explain: M("Referințele, lectura și scrisul tău, într-un singur loc. Alege limba:", "Your references, reading and writing, in one place. Choose your language:"),
    check: () => S.language.check(P), lang: true });
  // unde ține Texere lucrurile: structura recomandată sau folderele tale (doar la prima configurare; apoi din Setări → Foldere)
  if (first && !P.settings.structure) steps.push({ id: "places", icon: "folder-tree", title: M("Unde ține Texere lucrurile", "Where Texere keeps things"),
    explain: M("Folosește structura recomandată sau folderele pe care le ai deja. Nu mut și nu suprascriu nimic: doar țin minte unde pun lucrurile noi.",
      "Use the recommended structure, or the folders you already have. I don't move or overwrite anything: I only remember where new things go."), places: true, check: () => !!P.settings.structure });
  if (first && !P.settings.fields?.asked && (P.maps?.() || []).length) steps.push({ id: "fields", icon: "network", title: M("Disciplina ta", "Your discipline"),
    explain: M("Texere poate aduce harta unei discipline: notele ei de bază, legate între ele, pe care le folosești în metadatele referințelor. Alege dacă o vrei; o poți adăuga și mai târziu.",
      "Texere can bring the map of a discipline: its core notes, linked together, which you use in your references' metadata. Choose whether you want it; you can also add it later."), fields: true,
    check: async () => { for (const m of P.maps?.() || []) { try { const st = await P.mapStatus(m); if (st.have < st.total) return false; } catch (e) { return false; } } return true; } });   // toate hărțile deja în vault: nimic de ales, „Înainte”
  if (!S.pdfplus.check(P)) steps.push({ id: "pdfplus", icon: "highlighter", title: M("PDF++", "PDF++"), explain: S.pdfplus.explain, setupStep: S.pdfplus, poll: true,
    check: () => S.pdfplus.check(P), extra: (row, W) => {
      // după ce ai apăsat Install și Enable în pagina lui PDF++: verifică din nou (pornirea o faci tu, cu un clic)
      if (!S.pdfplus.check(P)) {
        const b = row.createEl("button", { text: W.T(M("L-am instalat: verifică", "I installed it: check again")) });
        b.addEventListener("click", () => W.render());
        return;
      }
      // un șablon de copiere PDF++ cu forma veche a paginii: îl schimbi tu, dacă vrei
      const src = P.mod("sources")?.sources, n = src?.pdfPageOld?.() || 0; if (!n) return;
      row.createEl("p", { cls: "txw-muted", text: W.T(M("Șablonul tău din PDF++ pune în citare pagina fișierului PDF. Îl pot schimba ca să pună pagina tipărită.",
        "Your PDF++ template puts the PDF file's page in the citation. I can change it to use the printed page.")) });
      const b = row.createEl("button", { text: W.T(M("Schimbă pagina din șablon", "Change the page in the template")) });
      b.addEventListener("click", async () => { b.disabled = true; const k = await src.patchPdfPage(); new Notice(W.T(M(`Am schimbat ${k} șablon(e) PDF++.`, `Changed ${k} PDF++ template(s).`))); W.render(); });
    } });
  steps.push({ id: "vault", icon: "folder-tree", title: M("Vault-ul tău", "Your vault"),
    explain: M("Adaug doar ce lipsește; ce ai deja rămâne neatins.", "I add only what's missing; what you already have stays untouched."), vault: true });
  steps.push({ id: "done", icon: "check-circle", title: M("Gata", "You're all set"), explain: M("Iată unde găsești totul:", "Here's where to find everything:"), info: true, last: true,
    body: (el, W) => {
      const ul = el.createEl("ul", { cls: "txw-where" });
      for (const [ic, a, b] of [["texere", M("Pagina de pornire", "Home"), M("în fiecare tab nou (sau semnul împletit din stânga).", "in every new tab (or the braid on the left).")],
        ["circle-help", M("Ajutor", "Help"), M("butonul ? de lângă +, jos pe pagina de pornire, sau Ctrl/Cmd + P → Ajutor.", "the ? button next to +, at the bottom of the home page, or Ctrl/Cmd + P → Help.")],
        ["settings", M("Settings → Texere", "Settings → Texere"), M("modulele, limba și configurarea din nou.", "modules, language and running the setup again.")]]) {
        const li = ul.createEl("li"), i = li.createSpan("txw-ic"); icon(i, ic); const t = li.createSpan(); t.createEl("b", { text: W.T(a) }); t.appendText(" — " + W.T(b));
      }
    } });
  return steps;
}

class WizardModal extends Modal {
  constructor(P, opts = {}) { super(P.app); this.P = P; this.i = 0; this.results = {}; this.acted = new Set(); this.finished = false; let first = false; try { first = setup.needsConfig(P) && !P.settings.onboarded; } catch (e) {} this.steps = buildSteps(P, first); if (opts.step) this.i = Math.max(0, this.steps.findIndex(s => s.id === opts.step)); }
  get lg() { return C.getLang(this.app); }
  T(m) { return C.tx(m, this.lg); }
  onOpen() { this.modalEl.addClass("texere-wizard"); this.P._wiz = this; this.render(); }
  onClose() {
    clearInterval(this._poll); this._poll = null; this.stepRun = null; if (this.P._wiz === this) this.P._wiz = null; this.contentEl.empty();
    if (!this.finished) { try { this.app.saveLocalStorage(LATER, C.basePath(this.app)); } catch (e) {} }
    try { this.P.notify(); } catch (e) {}
  }
  // un mesaj sub butoane: ok (verde), todo (portocaliu), info (gri)
  note(m, kind) { const box = this.msgEl; if (!box) return; box.createDiv({ cls: "txw-msg is-" + (kind || "info"), text: String(typeof m === "string" ? m : this.T(m)).replace(/\*\*/g, "") }); }
  showResult(r) {
    if (!r) return;
    for (const x of r.ok || []) this.note(x, "ok");
    for (const x of r.info || []) this.note(x, "info");
    for (const x of r.todo || []) this.note(this.T(x.msg) + (x.you ? " " + this.T(x.you) : ""), "todo");
  }
  async isDone(s) { try { return s.vault ? !(await vaultItems(this.P)).length : s.check ? !!(await s.check()) : false; } catch (e) { return false; } }
  async render() {
    const tok = (this._tok = (this._tok || 0) + 1), s = this.steps[this.i], el = this.contentEl, T = m => this.T(m);
    clearInterval(this._poll); this._poll = null;
    const done = await this.isDone(s), items = s.vault ? await vaultItems(this.P) : null; if (tok !== this._tok) return;
    const fstat = s.fields ? await Promise.all((this.P.maps?.() || []).map(async m => { let st = null; try { st = await this.P.mapStatus(m); } catch (e) {} return { m, st }; })) : null; if (tok !== this._tok) return;
    el.empty(); this.titleEl.setText("Texere");
    // capul: pasul n din N, puncte
    const head = el.createDiv("txw-head"), dots = head.createDiv("txw-dots");
    this.steps.forEach((x, j) => dots.createSpan({ cls: "txw-dot" + (j === this.i ? " is-on" : j < this.i ? " is-past" : "") }));
    head.createSpan({ cls: "txw-count", text: T(M(`Pasul ${this.i + 1} din ${this.steps.length}`, `Step ${this.i + 1} of ${this.steps.length}`)) });
    const top = el.createDiv("txw-top"), ic = top.createSpan("txw-step-ic"); icon(ic, s.icon);
    top.createDiv({ cls: "txw-title", text: T(s.title) });
    el.createEl("p", { cls: "txw-explain", text: T(s.explain) });
    const body = el.createDiv("txw-body");
    if (s.body) { try { s.body(body, this); } catch (e) { console.error("Texere: configurarea", s.id, e); } }
    const row = el.createDiv("txw-actions"); this.msgEl = el.createDiv("txw-msgs");
    if (s.lang) this.drawLanguage(body);
    else if (s.vault) this.drawVault(body, row, items);
    else if (s.fields) this.drawFields(body, row, fstat);
    else if (s.places) this.drawPlaces(body, row);
    else this.drawActions(s, row, done);
    if (this.results[s.id]) this.showResult(this.results[s.id]);
    if (s.vault) for (const k of ["folders", "map", "notes", "bibliography", "export"]) if (this.results[k]) this.showResult(this.results[k]);
    if (s.fields && this.results.map) this.showResult(this.results.map);
    // PDF++: cât stai pe pas, vede singur când l-ai instalat și pornit (nu pornește nimic în locul tău)
    if (s.poll && !done) this._poll = setInterval(async () => { if (await this.isDone(s)) this.render(); }, 1500);
    // jos: Înapoi · Înainte / Termină
    const ft = el.createDiv("txw-foot");
    if (this.i > 0) ft.createEl("button", { text: T(M("Înapoi", "Back")) }).addEventListener("click", () => { this.i--; this.render(); });
    ft.createDiv("txw-space");
    // un singur buton principal: alegerea din pas (bifele, varianta) se aplică la „Înainte”; fără „Sari peste”
    const fwd = s.last ? M("Termină", "Finish") : M("Înainte", "Next");
    const nb = ft.createEl("button", { cls: "mod-cta", text: T(fwd) });
    nb.addEventListener("click", async () => {
      if (this.stepRun) { nb.disabled = true; nb.textContent = "…"; let go = false; try { go = await this.stepRun(); } catch (e) { console.error("Texere: configurarea", s.id, e); }
        if (!go) { nb.disabled = false; nb.textContent = T(fwd); return; } }
      // „Domeniul tău”: ce ai ales rămâne ținut minte (și ce era deja în vault); nu te mai întreabă la o configurare din nou
      if (s.places && !this.P.settings.structure) { this.P.settings.structure = "recommended"; await this.P.save(); }   // trecut mai departe: recomandarea rămâne
      if (s.fields) { for (const x of fstat || []) if (x.st?.have) await this.P.chooseField(x.m.id); if (!this.P.settings.fields?.asked) { this.P.settings.fields = { asked: true, chosen: [] }; await this.P.save(); } }
      if (s.last) this.finish(); else { this.i++; this.render(); }
    });
  }
  // limba: două opțiuni mari; alegi una, iar „Înainte” o aplică (ca la ceilalți pași)
  drawLanguage(body) {
    const box = body.createDiv("txw-lang"), btns = [];
    if (!this.langPick) this.langPick = this.lg === "en" ? "en" : "ro";
    for (const o of setup.language.options()) {
      const b = box.createEl("button", { cls: "txw-lang-btn" + (o.v === this.langPick ? " is-selected" : ""), text: this.T(o.label) }); btns.push([o.v, b]);
      b.addEventListener("click", () => { this.langPick = o.v; for (const [v, x] of btns) x.toggleClass("is-selected", v === o.v); });
    }
    this.stepRun = async () => {
      let r = null; try { r = await setup.language.run(this.P, this.langPick); } catch (e) { console.error("Texere: limba", e); }
      this.results.language = r; this.acted.add("language");
      if (r?.restart) new Notice(this.T(M("Obsidian va fi în română după repornire.", "Obsidian will be in English after a restart.")), 6000);
      return true;
    };
  }
  // vault-ul: lista a ce lipsește, toate bifate; un singur buton le face pe cele bifate
  drawVault(body, row, items) {
    const T = m => this.T(m);
    if (!items.length) { body.createDiv({ cls: "txw-allset", text: T(M("Totul e la locul lui.", "Everything is in place.")) }); return; }
    const ul = body.createEl("ul", { cls: "txw-check" }), picked = new Set(items.map(x => x.key));
    for (const it of items) {
      const li = ul.createEl("li"), lab = li.createEl("label"), cb = lab.createEl("input", { type: "checkbox" }); cb.checked = true;
      cb.addEventListener("change", () => { if (cb.checked) picked.add(it.key); else picked.delete(it.key); this.acted.delete("vault"); });
      const t = lab.createSpan("txw-check-t"); t.createSpan({ text: T(it.label) }); if (it.hint) t.createSpan({ cls: "txw-check-h", text: it.hint });
      if (it.desc) li.createDiv({ cls: "txw-check-d", text: T(it.desc) });   // pe scurt, ce se configurează
      if (it.key === "export" && setup.canPick()) {
        const a = li.createEl("a", { cls: "txw-link", href: "#", text: T(M("Alege alt folder pentru export…", "Choose another export folder…")) });
        a.addEventListener("click", async e => { e.preventDefault(); let r = null; try { r = await setup.exportFolder.run(this.P, "pick"); } catch (er) { console.error("Texere: exportul", er); }
          if (r && !r.cancelled) { this.results.export = r; this.acted.add("vault"); } this.render(); });
      }
    }
    // „Înainte” adaugă ce e bifat; dacă ceva n-a mers, rămânem pe pas ca să vezi de ce (al doilea „Înainte” trece mai departe)
    this.stepRun = async () => {
      if (this.acted.has("vault")) return true;
      let bad = false;
      for (const it of items) {
        if (!picked.has(it.key)) continue;
        try { this.results[it.key] = await it.run(); }
        catch (e) { this.results[it.key] = { ...none(), todo: [{ msg: M(`N-a mers: ${e.message}`, `Didn't work: ${e.message}`) }] }; console.error("Texere: configurarea", it.key, e); }
        if (this.results[it.key]?.todo?.length) bad = true;
      }
      this.acted.add("vault"); if (bad) { this.render(); return false; } return true;
    };
  }
  // locurile: două alegeri (recomandat / folderele mele); la „Folderele mele”, câte un câmp pentru fiecare loc
  drawPlaces(body, row) {
    const T = m => this.T(m), P = this.P, app = this.app;
    const cur = PL.current(P), rec = Object.fromEntries(PL.PLACES.map(x => [x.key, PL.recommended(app, x.key)]));
    if (!this.placesVals) this.placesVals = Object.fromEntries(PL.PLACES.map(x => [x.key, cur[x.key] || rec[x.key]]));
    const mode = this.placesMode || "rec", exists = p => !!(p && !PL.isAbs(p) && app.vault.getAbstractFileByPath(p));
    const opts = body.createDiv("txw-places");
    const card = (k, title, desc, badge) => {
      const c = opts.createEl("label", { cls: "txw-place-opt" + (mode === k ? " is-on" : "") }), r = c.createEl("input", { type: "radio" }); r.name = "txw-places"; r.checked = mode === k;
      r.addEventListener("change", () => { this.placesMode = k; this.render(); });
      const t = c.createDiv("txw-field-t"), h = t.createDiv({ cls: "txw-field-name", text: T(title) }); if (badge) h.createSpan({ cls: "txw-rec", text: T(badge) });
      t.createDiv({ cls: "txw-field-desc", text: T(desc) }); return t;
    };
    const t1 = card("rec", M("Structura recomandată", "The recommended structure"), M("Folderele lui Texere, gata de folosit. Cele care există deja în vault sunt folosite așa cum sunt.", "Texere's folders, ready to use. Those already in your vault are used as they are."), M("Recomandat", "Recommended"));
    if (mode === "rec") { const ul = t1.createEl("ul", { cls: "txw-place-list" }); for (const x of PL.PLACES) { const li = ul.createEl("li"); li.createSpan({ cls: "txw-place-k", text: T(x.label) }); li.createSpan({ cls: "txw-place-v", text: rec[x.key] }); li.createSpan({ cls: "txw-place-s", text: T(exists(rec[x.key]) ? M("există", "exists") : M("nou", "new")) }); } }
    const t2 = card("own", M("Folderele mele", "My own folders"), M("Ai deja o structură? Alege pentru fiecare loc un folder din vault (sau scrie unul nou). Exportul poate fi și în afara vault-ului.", "Already have a structure? Pick a folder in your vault for each place (or type a new one). Export can be outside the vault too."));
    const errs = {};
    if (mode === "own") {
      const box = opts.createDiv("txw-place-own");   // în afara cardului: un clic în câmp nu atinge alegerea
      for (const x of PL.PLACES) {
        const r = box.createDiv("txw-place-row"), l = r.createDiv("txw-place-l"); l.createDiv({ cls: "txw-place-k", text: T(x.label) }); l.createDiv({ cls: "txw-check-d", text: T(x.desc) });
        const f = r.createDiv("txw-place-f"), inp = f.createEl("input", { type: "text", cls: "txw-place-in" }); inp.value = this.placesVals[x.key] || ""; inp.placeholder = rec[x.key];
        const set = v => { this.placesVals[x.key] = v; err.setText(""); };
        inp.addEventListener("input", () => set(inp.value));
        try { const S = P.mod("sources")?.sources; if (S?.folderSuggest) S.folderSuggest(inp, v => { inp.value = typeof v === "string" ? v : (v?.path || inp.value); set(inp.value); }); } catch (e) {}
        if (x.outside && setup.canPick()) {
          const a = f.createEl("a", { cls: "txw-link", href: "#", text: T(M("Alege de pe calculator…", "Choose on your computer…")) });
          a.addEventListener("click", async e => { e.preventDefault(); let p = null; try { p = await setup.pickFolder?.(this.lg); } catch (er) {} if (p) { inp.value = p; set(p); } });
        }
        const err = f.createDiv("txw-place-err"); errs[x.key] = err;
      }
    }
    // „Înainte” aplică varianta aleasă (cu verificarea căilor); o cale greșită te ține pe pas, cu mesajul sub câmp
    this.stepRun = async () => {
      const choice = {}; let bad = false;
      for (const x of PL.PLACES) {
        const r = PL.clean(mode === "rec" ? rec[x.key] : this.placesVals[x.key], { outside: !!x.outside, base: (() => { try { return C.basePath(app) || ""; } catch (e) { return ""; } })() });
        if (r.error) { bad = true; errs[x.key]?.setText(T(r.error)); continue; }
        choice[x.key] = r.value; if (x.key === "export") choice.exportAbs = !!r.abs;
      }
      if (bad) return false;
      let res = null; try { res = await PL.apply(P, choice, mode === "rec" ? "recommended" : "own"); } catch (e) { console.error("Texere: folderele", e); res = { done: [], fail: ["all"] }; }
      this.results.places = res.fail.length ? { ...none(), todo: [{ msg: M("Unele foldere nu s-au putut seta; le poți schimba din Settings → Texere → General → Foldere.", "Some folders couldn't be set; you can change them in Settings → Texere → General → Folders.") }] }
        : { ...none(), ok: [M(`Folderele: notele de lectură în ${choice.notes}, PDF-urile în ${choice.pdfs}, exportul în ${choice.export}.`, `Folders: reading notes in ${choice.notes}, PDFs in ${choice.pdfs}, export in ${choice.export}.`)] };
      this.acted.add("places");
      if (res.fail.length) { this.render(); return false; }
      return true;
    };
  }
  // domeniile: câte un card (ce conține, câte note, unde ajung); ce e deja în vault nu se atinge; se adaugă doar notele care lipsesc
  drawFields(body, row, list) {
    const T = m => this.T(m), P = this.P, cards = body.createDiv("txw-fields");
    // ce n-e încă în vault vine bifat (azi: Filosofia); debifezi ce nu vrei; „Înainte” adaugă ce a rămas bifat
    if (!this.fieldsPicked) this.fieldsPicked = new Set((list || []).filter(({ st }) => !(st && st.have >= st.total)).map(({ m }) => m.id));
    const picked = this.fieldsPicked;
    for (const { m, st } of list || []) {
      const full = st && st.have >= st.total, part = st && st.have > 0 && !full;
      const card = cards.createEl("label", { cls: "txw-field" + (full ? " is-have" : "") });
      const cb = card.createEl("input", { type: "checkbox" }); cb.checked = full || picked.has(m.id); cb.disabled = full;
      cb.addEventListener("change", () => { if (cb.checked) picked.add(m.id); else picked.delete(m.id); card.toggleClass("is-off", !cb.checked); });
      if (!cb.checked) card.addClass("is-off");
      const t = card.createDiv("txw-field-t");
      t.createDiv({ cls: "txw-field-name", text: T(M(m.ro, m.en)) });
      if (m.desc) t.createDiv({ cls: "txw-field-desc", text: T(M(m.desc.ro, m.desc.en)) });
      const meta = st ? (full ? M(`Deja în vault-ul tău · ${st.folder}`, `Already in your vault · ${st.folder}`)
        : part ? M(`${st.have} din ${st.total} note sunt deja în ${st.folder}; adaug doar ce lipsește`, `${st.have} of ${st.total} notes are already in ${st.folder}; I'll add only what's missing`)
        : M(`${st.total} note · în ${st.folder}`, `${st.total} notes · in ${st.folder}`)) : null;
      if (meta) t.createDiv({ cls: "txw-field-meta", text: T(meta) });
    }
    body.createEl("p", { cls: "txw-muted", text: T(M("Alte discipline vin în versiunile următoare. O hartă o poți adăuga oricând din Settings → Texere → General → Foldere → Harta disciplinei.", "More disciplines are coming in later versions. You can add a map any time in Settings → Texere → General → Folders → Discipline map.")) });
    this.stepRun = async () => {
      const ok = []; let bad = false;
      for (const { m } of list || []) if (picked.has(m.id)) {
        try { await P.chooseField(m.id); const n = await P.createMap(m); ok.push(M(`Am adăugat harta ${m.ro} (${n} note).`, `Added the ${m.en} map (${n} notes).`)); }
        catch (e) { console.error("Texere: harta", m.id, e); bad = true; this.results.map = { ...none(), todo: [{ msg: M(`N-a mers: ${e.message}`, `Didn't work: ${e.message}`) }] }; }
      }
      // hărțile debifate (și care nu sunt deja în vault): nu le vrei, deci nici câmpurile lor în nota de lectură
      for (const { m, st } of list || []) if (!picked.has(m.id) && !(st && st.have > 0)) { try { await P.chooseField(m.id, false); } catch (e) { console.warn("Texere: harta", m.id, e); } }
      if (ok.length) this.results.map = { ...none(), ok }; this.acted.add("fields");
      picked.clear();   // adăugate; la „Înapoi” apar ca „Deja în vault”
      if (bad) { this.render(); return false; }
      return true;
    };
  }
  drawActions(s, row, done) {
    const T = m => this.T(m), P = this.P;
    const act = async (b, run) => { const old = b.textContent; b.disabled = true; b.textContent = "…"; let r = null; try { r = await run(); } catch (e) { r = { ...none(), todo: [{ msg: M(`N-a mers: ${e.message}`, `Didn't work: ${e.message}`) }] }; console.error("Texere: configurarea", s.id, e); }
      if (r?.cancelled) { b.disabled = false; b.textContent = old; return; }
      this.results[s.id] = r; this.acted.add(s.id); this.render(); };
    if (s.setupStep && !done) {
      const st = s.setupStep, opts = (st.options ? st.options(P) || [] : []).filter(o => o.v !== "later");   // „Nu acum” = Înainte
      for (const o of opts) {
        const b = row.createEl("button", { cls: o.rec ? "mod-cta" : "", text: T(o.label) }); if (o.tip) b.title = o.tip; else if (o.desc) b.title = T(o.desc);
        b.addEventListener("click", () => act(b, () => st.run(P, o.v)));
      }
    }
    if (s.extra) { try { s.extra(row, this); } catch (e) {} }
  }
  async finish() {
    const P = this.P, order = ["language", "places", "pdfplus", "folders", "map", "notes", "bibliography", "export"];
    this.finished = true;
    try { setup.markConfigured(P); this.app.saveLocalStorage(LATER, null); } catch (e) {}
    P.settings.onboarded = true; await P.save();
    let report = null;
    try { report = await setup.writeReport(P, order.map(k => this.results[k]).filter(Boolean)); } catch (e) { console.error("Texere: raportul", e); }
    this.close();
    const frag = document.createDocumentFragment(); frag.append(this.T(M("Texere e configurat. ", "Texere is set up. ")));
    if (report) { const a = document.createElement("a"); a.href = "#"; a.textContent = this.T(M("Vezi ce s-a făcut", "See what was done")); a.addEventListener("click", e => { e.preventDefault(); setup.openReport(P); }); frag.append(a); }
    new Notice(frag, 10000);
  }
}

module.exports = { WizardModal, buildSteps, vaultItems, LATER };
