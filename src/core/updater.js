// Actualizările lui Texere, din release-urile GitHub ale pluginului (în afara listei de pluginuri a Obsidian).
//  • check(): la pornire, la 20 de minute, când revii în Obsidian, când deschizi pagina de pornire (cel mult o dată la 2 minute) și la „Caută acum”, întreabă GitHub care e ultimul release publicat; cererea nu trimite nimic despre tine.
//    Nu instalează nimic singur: o versiune nouă apare în pagina de pornire și în setări, cu butonul „Actualizează”.
//  • update(): doar la clicul tău; install(): descarcă main.js, styles.css și manifest.json, le verifică (manifestul e al lui Texere, versiunea e cea a release-ului,
//    main.js nu e gol), pune fișierele de acum în previous/ și le scrie pe cele noi. Atinge doar folderul pluginului, niciodată notele.
//  • după instalare: un mesaj cu „Reîncarcă acum”; la pornirea următoare, „Ce e nou” (capitolul 10 din Ajutor).
//  • rollback(): pune la loc versiunea din previous/ și sare peste versiunea de acum, până apare una mai nouă.
const { requestUrl, Notice } = require("obsidian");

const REPO = "gorgmihai92/texere-plugin";
const API = `https://api.github.com/repos/${REPO}/releases/latest`;
const FILES = ["main.js", "styles.css", "manifest.json"];
const DAY = 864e5, HOUR = 36e5, GAP = 2 * 6e4;   // între două verificări automate: cel puțin 2 minute (GitHub lasă 60 de întrebări pe oră)

// „0.4.10” > „0.4.9”; un „v” în față nu contează
const parse = v => String(v || "").trim().replace(/^v/i, "").split(/[.+-]/).slice(0, 3).map(n => parseInt(n, 10) || 0);
function newer(a, b) { const x = parse(a), y = parse(b); for (let i = 0; i < 3; i++) { if (x[i] !== y[i]) return x[i] > y[i]; } return false; }

class Updater {
  constructor(P) { this.P = P; this.busy = false; this.timer = 0; }
  get app() { return this.P.app; }
  get dir() { return this.P.manifest?.dir; }
  get version() { return String(this.P.manifest?.version || "0.0.0"); }
  get conf() { const s = this.P.settings; return (s.updates = s.updates || {}); }
  T(a, b) { return this.P.T(a, b); }
  // „Caută actualizări” (implicit pornit): doar întreabă și arată versiunea nouă în pagina de pornire; instalarea e mereu la clicul tău
  get auto() { return this.conf.check !== false; }
  // versiunea nouă găsită (și nesărită), sau null
  get available() { const c = this.conf, v = c.latest; if (!v || !newer(v, this.version) || (c.skip && !newer(v, c.skip)) || this.pending === v) return null; return v; }
  // instalată, dar pornește abia după reîncărcare
  get pending() { const d = this.conf.done; return d && newer(d, this.version) ? d : null; }

  // la pornire: „Ce e nou” dacă tocmai s-a instalat o versiune; apoi verificarea (fără instalare), puțin după ce s-a încărcat totul, și din 6 în 6 ore
  start() {
    this.whatsNew();
    const tick = () => this.soon();
    setTimeout(tick, 8e3);
    this.timer = window.setInterval(tick, 20 * 6e4);   // la 20 de minute
    this.P.register(() => window.clearInterval(this.timer));
    // și când revii în Obsidian (o versiune publicată cât ai lucrat în altă parte apare imediat)
    try { this.P.registerDomEvent(window, "focus", tick); } catch (e) {}
  }

  // verificare automată, în tăcere: la pornire, la 20 de minute, când revii în Obsidian și când deschizi pagina de pornire (cel mult o dată la 2 minute)
  soon() { if (this.auto && !this.busy) this.check(false).catch(e => console.warn("Texere: actualizări", e)); }
  // „acum 5 minute” / „5 minutes ago”, fără să depindă de limba lui moment
  ago(t) {
    const m = Math.max(0, Math.round((Date.now() - t) / 6e4)), T = (a, b) => this.T(a, b);
    if (m < 1) return T("acum", "just now"); if (m < 60) return T(`acum ${m} min`, `${m} min ago`);
    const h = Math.round(m / 60); if (h < 24) return T(`acum ${h} h`, `${h} h ago`);
    const d = Math.round(h / 24); return T(d === 1 ? "ieri" : `acum ${d} zile`, d === 1 ? "yesterday" : `${d} days ago`);
  }
  // ultimul release publicat (fără ciorne și pre-release-uri); null dacă GitHub nu răspunde
  async latest() {
    const r = await requestUrl({ url: API, method: "GET", headers: { Accept: "application/vnd.github+json", "User-Agent": "Texere" }, throw: false });
    if (r.status === 404) return { none: true };   // repo-ul nu are încă niciun release publicat
    if (r.status !== 200 || !r.json?.tag_name) return null;
    const assets = Object.fromEntries((r.json.assets || []).map(a => [a.name, a.browser_download_url]));
    return { version: String(r.json.tag_name).replace(/^v/i, ""), assets, url: r.json.html_url || `https://github.com/${REPO}/releases` };
  }

  // manual: arată rezultatul; automat: cel mult o dată pe zi, în tăcere. Nu instalează: anunță pagina de pornire (notify)
  async check(manual) {
    if (this.busy) return { state: "busy" };
    const c = this.conf;
    // automat: cel mult o dată la 2 minute; imediat dacă Texere s-a schimbat de la ultima verificare (de ex. actualizat de BRAT)
    if (!manual && c.checkedAt && c.checkedFor === this.version && Date.now() - c.checkedAt < GAP) return { state: "later" };
    this.busy = true;
    try {
      let rel = null; try { rel = await this.latest(); } catch (e) { rel = null; }
      const had = this.available;
      c.checkedAt = Date.now(); c.checkedFor = this.version; c.latest = rel?.version || c.latest || ""; await this.P.save();
      if (this.available !== had) { try { this.P.notify?.(); } catch (e) {} }
      if (rel?.none) { if (manual) new Notice(this.T(`Ai ultima versiune (${this.version}); pe GitHub nu e încă nicio versiune publicată.`, `You have the latest version (${this.version}); nothing is published on GitHub yet.`), 6000); return { state: "current" }; }
      if (!rel) { if (manual) new Notice(this.T("Nu am putut întreba GitHub de o versiune nouă. Încearcă mai târziu.", "Couldn't ask GitHub for a new version. Try again later."), 6000); return { state: "offline" }; }
      if (!newer(rel.version, this.version) || (c.skip && !newer(rel.version, c.skip))) {
        if (manual) new Notice(this.T(`Ai ultima versiune (${this.version}).`, `You have the latest version (${this.version}).`), 5000);
        return { state: "current", version: rel.version };
      }
      this.rel = rel;
      if (manual) new Notice(this.T(`Texere ${rel.version} e disponibil. Îl instalezi din pagina de pornire sau de aici, cu „Actualizează”.`, `Texere ${rel.version} is available. Install it from the home page or here, with “Update”.`), 7000);
      return { state: "available", version: rel.version };
    } finally { this.busy = false; }
  }

  // la clicul tău: ia din nou ultimul release (ca să fie sigur cel de acum) și îl instalează
  async update() {
    if (this.busy) return false;
    this.busy = true;
    try {
      let rel = null; try { rel = await this.latest(); } catch (e) { rel = null; }
      if (!rel || rel.none || !newer(rel.version, this.version)) { new Notice(this.T("Nu am găsit versiunea nouă pe GitHub. Încearcă mai târziu.", "Couldn't find the new version on GitHub. Try again later."), 6000); return false; }
      return await this.install(rel);
    } finally { this.busy = false; }
  }
  // „Nu acum” din pagina de pornire: versiunea asta nu mai e anunțată; următoarea, da
  async skipVersion(v) { this.conf.skip = v || this.conf.latest; await this.P.save(); try { this.P.notify?.(); } catch (e) {} }
  // notele versiunii, pe GitHub
  get notesUrl() { const v = this.conf.latest; return v ? `https://github.com/${REPO}/releases/tag/${v}` : `https://github.com/${REPO}/releases`; }

  async install(rel) {
    const ad = this.app.vault.adapter, dir = this.dir, T = (a, b) => this.T(a, b);
    if (!dir || FILES.some(f => !rel.assets[f])) { console.warn("Texere: release-ul nu are cele trei fișiere", rel); return false; }
    try {
      // 1. descarcă și verifică, înainte să atingem ceva
      const got = {};
      for (const f of FILES) { const r = await requestUrl({ url: rel.assets[f], method: "GET", headers: { "User-Agent": "Texere" }, throw: false }); if (r.status !== 200) throw new Error(`${f}: ${r.status}`); got[f] = r.text; }
      let man = null; try { man = JSON.parse(got["manifest.json"]); } catch (e) {}
      if (!man || man.id !== this.P.manifest.id || String(man.version) !== rel.version) throw new Error("manifest.json nu e al acestui release");
      if (got["main.js"].length < 50000 || !/Texere/.test(got["main.js"])) throw new Error("main.js pare incomplet");
      // 2. versiunea de acum, în previous/ (una singură, cea dinainte)
      const prev = `${dir}/previous`;
      if (!(await ad.exists(prev))) await ad.mkdir(prev);
      for (const f of FILES) { const p = `${dir}/${f}`; if (await ad.exists(p)) await ad.write(`${prev}/${f}`, await ad.read(p)); }
      // 3. cele noi (manifestul la urmă: dacă ceva se oprește la jumătate, Obsidian vede tot versiunea veche)
      for (const f of ["main.js", "styles.css", "manifest.json"]) await ad.write(`${dir}/${f}`, got[f]);
      const c = this.conf; c.installed = { from: this.version, to: rel.version, at: Date.now() }; c.shown = ""; c.done = rel.version; await this.P.save();
      try { this.P.notify?.(); } catch (e) {}
      const frag = document.createDocumentFragment();
      frag.append(T(`Texere ${rel.version} e instalat. `, `Texere ${rel.version} is installed. `));
      const a = document.createElement("a"); a.href = "#"; a.textContent = T("Reîncarcă acum", "Reload now"); frag.append(a);
      frag.append(T(" (sau la următoarea pornire)", " (or next time you start Obsidian)"));
      const n = new Notice(frag, 0); a.addEventListener("click", e => { e.preventDefault(); n.hide(); this.reload(); });
      return true;
    } catch (e) {
      console.error("Texere: actualizarea", e);
      new Notice(T(`Texere ${rel.version} nu s-a putut instala; rămâi pe ${this.version}. Încearcă din nou mai târziu.`, `Texere ${rel.version} couldn't be installed; you stay on ${this.version}. Try again later.`), 8000);
      return false;
    }
  }

  // reîncarcă pluginul (codul nou), fără să închidă Obsidian
  // reîncarcă tot Obsidian (ca „Reload app without saving”): doar așa pornește versiunea nouă și dispare mesajul;
  // repornirea doar a pluginului ținea în memorie versiunea veche
  async reload() {
    try { await this.P.save(); } catch (e) {}
    try { if (this.app.commands?.executeCommandById?.("app:reload")) return; } catch (e) {}
    try { window.location.reload(); } catch (e) { new Notice(this.T("Repornește Obsidian ca să pornească versiunea nouă.", "Restart Obsidian to start the new version."), 8000); }
  }

  // o dată după o actualizare: ce s-a schimbat
  // „Ce e nou”, o dată, după orice actualizare: din Texere, din BRAT sau de mână (versiunea de acum e mai nouă decât cea pornită data trecută)
  whatsNew() {
    const c = this.conf, i = c.installed, last = c.lastRun;
    c.lastRun = this.version;
    // fără „lastRun” (versiuni dinainte de 0.4.5): un vault deja configurat înseamnă că Texere a mai rulat aici
    const updated = (i && i.to === this.version) || (last ? newer(this.version, last) : !!this.P.settings.onboarded);
    if (!updated || c.shown === this.version) { if (last !== this.version) this.P.save(); return; }
    c.shown = this.version; this.P.save();
    const T = (a, b) => this.T(a, b), frag = document.createDocumentFragment();
    frag.append(T(`Texere s-a actualizat la ${this.version}. `, `Texere was updated to ${this.version}. `));
    const a = document.createElement("a"); a.href = "#"; a.textContent = T("Ce e nou", "What's new"); frag.append(a);
    const n = new Notice(frag, 15000); a.addEventListener("click", e => { e.preventDefault(); n.hide(); this.P.help?.ask?.(null, { chapter: "7" }); });
  }

  // versiunea pusă deoparte la ultima actualizare (din previous/manifest.json), sau null
  async previous() {
    const ad = this.app.vault.adapter, p = `${this.dir}/previous/manifest.json`;
    try { if (!(await ad.exists(p))) return null; const m = JSON.parse(await ad.read(p)); return m?.version ? String(m.version) : null; } catch (e) { return null; }
  }
  async rollback() {
    const ad = this.app.vault.adapter, dir = this.dir, prev = `${dir}/previous`, back = await this.previous(), now = this.version;
    if (!back) return false;
    for (const f of FILES) if (await ad.exists(`${prev}/${f}`)) await ad.write(`${dir}/${f}`, await ad.read(`${prev}/${f}`));
    const c = this.conf; c.skip = now; c.installed = null; await this.P.save();
    new Notice(this.T(`Ai revenit la ${back}. Versiunea ${now} nu-ți mai e propusă; următoarea, da.`, `Back to ${back}. Version ${now} won't be offered again; the next one will.`), 8000);
    await this.reload();
    return true;
  }
}

module.exports = { Updater, newer, REPO };
