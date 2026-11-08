// Ce poate aduce Texere în vault odată cu o versiune nouă (Texere 0.4.1+): șabloane, note, câmpuri, setări.
// O listă de pași (STEPS), fiecare cu un id unic.
// Regula: Texere nu pune nimic în vault fără clicul tău. Pluginul se actualizează (codul lui), dar un șablon, o notă sau un câmp nou
// doar ți se arată: în pagina de pornire, cu „Adaugă” și „Nu acum” (nimic bifat dinainte). „Nu acum” îl mută în
// Settings → Texere → General → Din actualizări, de unde îl adaugi oricând. Singurele care se aplică singure sunt setările lui Texere
// care lipsesc (un comportament nou al pluginului), niciodată ce ai ales tu.
//
// Felurile de pași:
//   { id, kind: "note", path, text: () => "...", was: ["hash", …], name: {ro, en} }
//       o notă sau un șablon care vine cu Texere. Lipsește → „Șablon nou: X” (Adaugă). E o versiune livrată înainte (hash în „was”)
//       → „Versiune nouă: X” (Actualizează). L-ai schimbat → „Versiune nouă: X; l-ai schimbat” (Înlocuiește, cu o copie a ta).
//       Șabloanele (Support/Templates/…) merg în folderul de șabloane ales la configurare.
//   { id, kind: "field", name, template: "[]", existing: true|false, why: {ro, en} }
//       un câmp nou pentru notele de lectură: „Adaugă” îl pune în șablon (notele noi îl primesc); existing: true → apoi întreabă
//       dacă îl pune, gol, și în notele de lectură pe care le ai.
//   { id, kind: "setting", module: "core"|"sources"|"export"|"insights", path: "a.b", value }
//       o setare nouă a lui Texere: primește valoarea doar dacă lipsește (n-ai ales-o tu).
//   { id, kind: "plugin-setting", plugin: "pdf-plus", path: "a.b", value, why: {ro, en} }
//       o setare a altui plugin: doar la clicul tău.
//   { id, kind: "plugin-version", plugin: "pdf-plus", min: "0.40.0", why: {ro, en} }
//       alt plugin are nevoie de o versiune mai nouă: te trimite la el (Obsidian îl actualizează, nu Texere).
//
// Un hash pentru „was”: node tools/notehash.js <fișier> (textul cu rândurile normalizate).
const { TFile, Notice, normalizePath } = require("obsidian");

// ——— pașii, în ordinea versiunilor ———
const STEPS = [
  // 0.4.1: primul set de pași vine cu versiunile următoare (aici se adaugă: un șablon nou, un câmp, o setare…)
];

// același text, oricum l-ar fi salvat Obsidian (rânduri Windows, spații la capăt de rând, rânduri goale la final)
const norm = t => String(t ?? "").replace(/\r\n?/g, "\n").replace(/[ \t]+$/gm, "").replace(/\n+$/, "").trim();
function hash(t) { let h = 0x811c9dc5; const s = norm(t); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, "0"); }
const getPath = (o, p) => String(p).split(".").reduce((x, k) => (x == null ? undefined : x[k]), o);
function setPath(o, p, v) { const ks = String(p).split("."), last = ks.pop(); let x = o; for (const k of ks) { if (x[k] == null || typeof x[k] !== "object") x[k] = {}; x = x[k]; } x[last] = v; }
// „0.40.1” > „0.39.9”
const vnum = v => String(v || "").replace(/^v/i, "").split(/[.+-]/).slice(0, 3).map(n => parseInt(n, 10) || 0);
const older = (a, b) => { const x = vnum(a), y = vnum(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] < y[i]; return false; };

class VaultUpdates {
  constructor(P, steps) { this.P = P; this.app = P.app; this.steps = steps || STEPS; this.busy = null; }
  T(a, b) { return this.P.T(a, b); }
  get st() { const s = this.P.settings; const v = (s.vaultUpdates = s.vaultUpdates || {}); for (const k of ["done", "pending", "later", "log"]) v[k] = v[k] || []; v.stage = v.stage || {}; return v; }
  name(n) { return n ? this.T(n.ro || n.en, n.en || n.ro) : ""; }
  // unde ajunge o notă: șabloanele, în folderul de șabloane ales la configurare
  target(path) {
    const tdir = String(this.P.settings?.dirs?.templates || "").replace(/\/+$/, "");
    return normalizePath(tdir && path.startsWith("Support/Templates/") ? `${tdir}/${path.slice("Support/Templates/".length)}` : path);
  }
  readingNotes() {
    const S = this.P.sourcesApi?.(); if (!S) return [];
    const dir = S.litDir(), mc = this.app.metadataCache;
    return (this.app.vault.getMarkdownFiles?.() || []).filter(f => f.path.startsWith(dir) && S.isLitNote(mc.getFileCache(f)?.frontmatter));
  }
  // module settings: the live object if the module is on, otherwise the saved one
  store(module) {
    const P = this.P;
    if (!module || module === "core") return { obj: P.settings, save: () => P.save() };
    const M = P.mod(module);
    if (M?.settings) return { obj: M.settings, save: () => M.saveData(M.settings) };
    const all = (P.settings.modules = P.settings.modules || {}); all[module] = all[module] || {};
    return { obj: all[module], save: () => P.save() };
  }
  // o dată la pornire (și după fiecare actualizare): pașii noi
  run() { if (!this.busy) this.busy = this._run().finally(() => { this.busy = null; }); return this.busy; }
  async _run() {
    const st = this.st, fresh = this.steps.filter(s => s?.id && !st.done.includes(s.id) && !st.pending.includes(s.id) && !st.later.includes(s.id));
    if (!fresh.length) return { applied: 0, offered: 0 };
    let applied = 0, offered = 0;
    for (const s of fresh) {
      let r = null;
      try { r = await this.check(s); } catch (e) { console.error("Texere: ce aduce versiunea nouă", s.id, e); r = null; }
      if (r?.offer) { st.pending.push(s.id); offered++; }
      else { st.done.push(s.id); if (r?.text) { st.log.push({ id: s.id, at: Date.now(), text: r.text, seen: false }); applied++; } }
    }
    st.log = st.log.slice(-30);
    await this.P.save();
    if (applied || offered) { try { this.P.notify?.(); } catch (e) {} }
    return { applied, offered };
  }
  // ce e de propus: { offer: true }; doar setările lipsă ale lui Texere se aplică direct
  async check(s) {
    const V = this.app.vault;
    if (s.kind === "note") {
      const f = V.getAbstractFileByPath(this.target(s.path));
      if (f instanceof TFile && hash(await V.read(f)) === hash(s.text())) return null;   // e deja exact versiunea nouă
      return f && !(f instanceof TFile) ? null : { offer: true };
    }
    if (s.kind === "field") {
      const S = this.P.sourcesApi?.();
      if (S && S.template().fields.some(f => f.name === s.name) && !(s.existing && this.missingIn(s.name))) return null;
      return { offer: true };
    }
    if (s.kind === "setting") {
      const { obj, save } = this.store(s.module);
      if (getPath(obj, s.path) !== undefined) return null;   // ai ales-o deja: rămâne a ta
      setPath(obj, s.path, JSON.parse(JSON.stringify(s.value))); await save();
      return s.name ? { text: this.T(`Setare nouă: ${this.name(s.name)}`, `New setting: ${this.name(s.name)}`) } : null;
    }
    if (s.kind === "plugin-setting") {
      const pl = this.app.plugins?.plugins?.[s.plugin];
      return pl?.settings && JSON.stringify(getPath(pl.settings, s.path)) === JSON.stringify(s.value) ? null : { offer: true };
    }
    if (s.kind === "plugin-version") {
      const m = this.app.plugins?.manifests?.[s.plugin];
      return m && older(m.version, s.min) ? { offer: true } : null;
    }
    return null;
  }
  missingIn(name) { return this.readingNotes().filter(f => this.app.metadataCache.getFileCache(f)?.frontmatter?.[name] === undefined).length; }
  // o propunere: textul și butoanele ei (fără nimic bifat dinainte)
  offer(id) {
    const s = this.steps.find(x => x.id === id); if (!s) return null;
    const T = (a, b) => this.T(a, b), V = this.app.vault;
    if (s.kind === "note") {
      const nm = this.name(s.name) || s.path.split("/").pop().replace(/\.md$/, ""), tpl = s.path.startsWith("Support/Templates/");
      const f = V.getAbstractFileByPath(this.target(s.path)), cur = f instanceof TFile ? this._cur?.[f.path] : null;
      if (!(f instanceof TFile)) return { id, text: tpl ? T(`Șablon nou: ${nm}`, `New template: ${nm}`) : T(`Notă nouă: ${nm}`, `New note: ${nm}`), yes: T("Adaugă", "Add"), run: () => this.addNote(s) };
      const mine = cur != null && !(s.was || []).includes(hash(cur));
      return { id, text: mine ? T(`Versiune nouă: ${nm}. L-ai schimbat; dacă o iei, al tău rămâne alături.`, `New version: ${nm}. You changed yours; if you take it, yours stays next to it.`) : T(`Versiune nouă: ${nm}`, `New version: ${nm}`),
        yes: mine ? T("Înlocuiește", "Replace") : T("Actualizează", "Update"), run: () => this.replaceNote(s, mine) };
    }
    if (s.kind === "field") {
      const S = this.P.sourcesApi?.(), why = s.why ? " — " + this.name(s.why) : "";
      if (!S) return { id, text: T(`Câmp nou pentru notele de lectură: ${s.name}${why}. Pornește Referințe ca să-l poți adăuga.`, `New field for reading notes: ${s.name}${why}. Turn on References to add it.`), wait: true };
      if (this.st.stage[id] === "notes" || S.template().fields.some(f => f.name === s.name)) {
        const n = this.missingIn(s.name);
        return { id, text: T(`Câmpul ${s.name} e în șablon. Îl adaug, gol, și în cele ${n} note de lectură pe care le ai?`, `The field ${s.name} is in the template. Add it, empty, to your ${n} reading notes too?`), yes: T("Adaugă în note", "Add to notes"), run: () => this.addField(s) };
      }
      return { id, text: T(`Câmp nou pentru notele de lectură: ${s.name}${why}`, `New field for reading notes: ${s.name}${why}`), yes: T("Adaugă", "Add"), run: () => this.addFieldToTemplate(s) };
    }
    if (s.kind === "plugin-setting") {
      const nm = this.app.plugins?.manifests?.[s.plugin]?.name || s.plugin;
      if (!this.app.plugins?.plugins?.[s.plugin]) return { id, text: T(`${nm}: ${this.name(s.why)} (pornește-l întâi)`, `${nm}: ${this.name(s.why)} (turn it on first)`), wait: true };
      return { id, text: `${nm}: ${this.name(s.why)}`, yes: T("Aplică", "Apply"), run: () => this.setPluginSetting(s) };
    }
    if (s.kind === "plugin-version") {
      const nm = this.app.plugins?.manifests?.[s.plugin]?.name || s.plugin;
      return { id, text: T(`${nm} are nevoie de versiunea ${s.min} sau mai nouă: ${this.name(s.why)}`, `${nm} needs version ${s.min} or newer: ${this.name(s.why)}`), yes: T("Deschide-l în Obsidian", "Open it in Obsidian"), keep: true, run: () => this.P.openPluginPage?.(s.plugin) };
    }
    return null;
  }
  // textul de acum al notelor propuse (ca să știm dacă le-ai schimbat), citit o dată înainte de desen
  async prepare() {
    const V = this.app.vault, out = {};
    for (const id of [...this.st.pending, ...this.st.later]) {
      const s = this.steps.find(x => x.id === id); if (s?.kind !== "note") continue;
      const f = V.getAbstractFileByPath(this.target(s.path)); if (f instanceof TFile) { try { out[f.path] = await V.read(f); } catch (e) {} }
    }
    this._cur = out;
  }
  offers(list) { return (list || this.st.pending).map(id => this.offer(id)).filter(Boolean); }
  async addNote(s) { await this.P.writeNote({ path: s.path }, s.text()); return this.T("Adăugat.", "Added."); }
  async replaceNote(s, keepMine) {
    const V = this.app.vault, f = V.getAbstractFileByPath(this.target(s.path));
    if (!(f instanceof TFile)) return this.addNote(s);
    if (keepMine) {
      const base = f.path.replace(/\.md$/, ""); let p = base + " (my version).md", i = 2;
      while (V.getAbstractFileByPath(p)) p = base + ` (my version ${i++}).md`;
      await V.create(p, await V.read(f));
    }
    await V.modify(f, s.text());
    return keepMine ? this.T("Înlocuit; versiunea ta e alături, ca „(my version)”.", "Replaced; your version sits next to it, as “(my version)”.") : this.T("Actualizat.", "Updated.");
  }
  async addFieldToTemplate(s) {
    const S = this.P.sourcesApi?.(); if (!S) return null;
    const t = S.template(); if (!t.fields.some(f => f.name === s.name)) { t.fields.push({ name: s.name, template: s.template ?? "[]", enabled: true }); await S.save(); }
    if (s.existing && this.missingIn(s.name)) { this.st.stage[s.id] = "notes"; return { again: true, msg: this.T(`${s.name} e în șablon: notele noi îl primesc.`, `${s.name} is in the template: new notes get it.`) }; }
    return this.T(`${s.name} e în șablon: notele noi îl primesc.`, `${s.name} is in the template: new notes get it.`);
  }
  async addField(s) {
    let n = 0; const val = (() => { try { return JSON.parse(s.template ?? "[]"); } catch (e) { return ""; } })();
    for (const f of this.readingNotes()) {
      if (this.app.metadataCache.getFileCache(f)?.frontmatter?.[s.name] !== undefined) continue;
      try { await this.app.fileManager.processFrontMatter(f, fm => { if (fm[s.name] === undefined) { fm[s.name] = JSON.parse(JSON.stringify(val)); n++; } }); } catch (e) { console.warn("Texere: câmpul nou", f.path, e); }
    }
    return this.T(`Am adăugat „${s.name}” în ${n} note de lectură.`, `Added “${s.name}” to ${n} reading notes.`);
  }
  async setPluginSetting(s) {
    const pl = this.app.plugins?.plugins?.[s.plugin]; if (!pl?.settings) return null;
    setPath(pl.settings, s.path, JSON.parse(JSON.stringify(s.value)));
    if (typeof pl.saveSettings === "function") await pl.saveSettings(); else await pl.saveData?.(pl.settings);
    return this.T("Gata.", "Done.");
  }
  // clicul tău: „Adaugă” rulează pasul; „Nu acum” îl mută în setări (Din actualizări), de unde îl adaugi oricând
  async answer(id, yes) {
    const st = this.st; await this.prepare(); const o = this.offer(id); let msg = null;
    if (yes && o?.run) {
      let r; try { r = await o.run(); } catch (e) { new Notice(e?.message || String(e), 8000); return; }
      if (r && typeof r === "object" && r.again) { await this.P.save(); if (r.msg) new Notice(r.msg, 6000); return; }   // al doilea pas (notele existente) rămâne propus
      msg = r;
      if (o.keep) { await this.P.save(); return; }
      st.pending = st.pending.filter(x => x !== id); st.later = st.later.filter(x => x !== id); delete st.stage[id];
      if (!st.done.includes(id)) st.done.push(id);
    } else if (!yes) {
      st.pending = st.pending.filter(x => x !== id); if (!st.later.includes(id)) st.later.push(id);
    }
    await this.P.save();
    if (msg) new Notice(msg, 6000);
  }
  // setările: ce ai lăsat pentru mai târziu (și ce e încă în pagina de pornire), cu „Adaugă”
  async settingsRows(el, Setting, redraw) {
    await this.prepare();
    const T = (a, b) => this.T(a, b), items = this.offers([...this.st.pending, ...this.st.later]);
    new Setting(el).setName(T("Din actualizări", "From updates")).setDesc(items.length
      ? T("Ce a adus Texere la versiunile noi și n-ai adăugat încă. Nimic nu intră în vault fără clicul tău.", "What Texere brought with new versions and you haven't added yet. Nothing goes into your vault without your click.")
      : T("Nimic de adăugat acum. Ce aduc versiunile noi apare aici și în pagina de pornire; nimic nu intră fără clicul tău.", "Nothing to add now. What new versions bring shows up here and on the home page; nothing goes in without your click."));
    for (const o of items) {
      const s = new Setting(el).setName(o.text);
      if (!o.wait) s.addButton(b => b.setButtonText(o.yes).onClick(async () => { b.setDisabled(true); await this.answer(o.id, true); redraw(); }));
    }
  }
  // ce s-a schimbat singur de la ultima vizită în pagina de pornire
  unseen() { return this.st.log.filter(x => !x.seen); }
  async markSeen() { for (const x of this.st.log) x.seen = true; await this.P.save(); }
  // pagina de pornire: un card doar când e ceva de spus; fiecare propunere cu „Adaugă” și „Nu acum”
  async home(inner, redraw) {
    const T = (a, b) => this.T(a, b), news = this.unseen();
    await this.prepare(); const offers = this.offers();
    if (!news.length && !offers.length) return;
    const box = inner.createDiv("txh-vu-box");
    box.createDiv({ cls: "txh-label", text: T("Nou în Texere", "New in Texere") });
    if (news.length) {
      const r = box.createDiv("txh-row txh-vu");
      r.createSpan({ text: news.map(x => x.text).join(" · ") });
      const b = r.createEl("button", { text: "OK" }); b.addEventListener("click", async () => { await this.markSeen(); redraw(); });
    }
    for (const o of offers) {
      const r = box.createDiv("txh-row txh-vu"); r.createSpan({ text: o.text });
      if (o.wait) continue;
      const acts = r.createDiv("txh-row-acts");
      const y = acts.createEl("button", { text: o.yes }); y.addEventListener("click", async () => { y.disabled = true; await this.answer(o.id, true); redraw(); });
      const n = acts.createEl("button", { text: T("Nu acum", "Not now") }); n.setAttr?.("aria-label", T("Îl găsești oricând în Settings → Texere → General → Din actualizări", "You'll find it any time in Settings → Texere → General → From updates"));
      n.addEventListener("click", async () => { await this.answer(o.id, false); redraw(); });
    }
  }
}

module.exports = { VaultUpdates, STEPS, hash, norm };
