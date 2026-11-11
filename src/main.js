/* Texere — pluginul vault-ului de cercetare, versiune 0.4.0 (un singur plugin, cu module)
 * Până la 0.4 (fost 4.0), Texere · Sources, Texere · Export și Texere · Insights erau pluginuri separate; acum sunt module ale lui Texere
 * (folderele src/sources, src/export, src/insights), pornite de aici, fiecare izolat, și pe care le oprești sau le pornești din Settings → Texere.
 *  1. Configurarea (src/core/wizard.js): 4 pași (limba, PDF++ dacă lipsește, ce lipsește din vault, gata), nimic fără clicul tău; la prima pornire pe un laptop, apoi din setări.
 *     Ajutorul, plierea ghidurilor și pașii configurării sunt cod al pluginului (src/core), nu scripturi din vault.
 *  2. Setările (Settings → Texere): limba; modulele (Sources, Export, Insights), fiecare cu secțiunea lui; PDF++ (singurul plugin de care
 *     depinde Texere: îl instalezi tu, din pagina lui din Obsidian); harta domeniilor (Fields/Philosophy), creată la cerere; Despre.
 *  3. Panoul din fiecare tab nou: ce trebuie reparat (cu un buton), Adaugă o sursă · Exportă · Ajutor, ultimele 5 fișiere.
 *  4. Structura de foldere propusă (01. Sources … 04. Export): doar ce lipsește, când apeși tu (configurarea sau Settings → Texere).
 *  5. Ghidul e în Ajutor (în plugin, nu în vault). Șabloanele și ghidurile de scris vin cu pluginul: le adaugi din configurare (doar ce lipsește) sau se creează când le cere Ajutorul.
 *  6. Mutarea o singură dată de la pluginurile separate: setările lor (în data.json, la modules.*), statisticile și trecerea prin vault
 *     ale Insights (stats/, cache/), scurtăturile de tastatură; pluginurile vechi, dacă sunt încă pornite, se opresc doar cu acordul tău.
 */
const { Plugin, Notice, TFile, Modal, Menu, Setting, PluginSettingTab, ItemView, MarkdownView, normalizePath, setIcon, addIcon, FuzzySuggestModal } = require("obsidian");
const { node } = require("./shared/node");
const { advanced, vaultFolders } = require("./shared/util");
const { popMenu } = require("./shared/popmenu");
const P_ = require("./shared/paths"), tidy = require("./core/tidy");
const { status } = require("./shared/status"), { noteMenu } = require("./shared/notemenu");
const { LANG, isEn } = require("./shared/lang");
const help = require("./core/help"), setup = require("./core/setup"), C = require("./core/common");
const { WizardModal, LATER } = require("./core/wizard");
// semnul lui Texere în bara din stânga: două fire împletite, unul pe deasupra, apoi pe dedesubt (texere = a țese), în stilul iconițelor lui Obsidian (100 × 100)
const TEXERE_ICON = '<g fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round"><path d="M30 10C30 22 70 38 70 50C70 56 64 62 58 65.5M42 74.5C36 78 30 84 30 90"/><path d="M70 10C70 16 64 22 58 25.5M42 34.5C36 38 30 44 30 50C30 62 70 78 70 90"/></g>';

// codul pluginului și locul unde semnalezi o problemă
const REPO_URL = "https://github.com/gorgmihai92/texere-plugin";
// linkul pentru „Susține Texere” (Settings → Texere → Despre și subsolul paginii de pornire); gol = nu apare nicăieri.
// Când îl pui, adaugă-l și în manifest.json, la fundingUrl.
const FUNDING_URL = "";
// bibliotecile incluse în Texere (atribuirea cerută de licențele lor)
const CREDITS = [
  ["citeproc-js", "Frank Bennett", "CPAL 1.0 / AGPL 3.0", "https://github.com/Juris-M/citeproc-js"],
  ["docx", "Dolan Miu", "MIT", "https://github.com/dolanmiu/docx"],
  ["markdown-it", "Vitaly Puzrin, Alex Kocharin", "MIT", "https://github.com/markdown-it/markdown-it"],
  ["Paged.js", "Adam Hyde, Coko Foundation", "MIT", "https://pagedjs.org"],
  ["CSL styles & locales", "Citation Style Language", "CC BY-SA 3.0", "https://citationstyles.org"],
  ["Wordplay (the idea and design of edit mode)", "Rob Hardy, after Jason Fried's Write_On", "MIT", "https://github.com/ungatedlife/wordplay"],
];
// notele care vin cu pluginul (ghidul, ghidurile de început, șabloanele): adăugate din configurare doar dacă lipsesc,
// sau când le cere Ajutorul; cele pe care le ai deja nu se ating (doar dacă ceri „Înlocuiește”)
const NOTES = [
  { path: "Support/Texere/Guides/Getting started in philosophy – reading, arguing, writing.md", text: () => require("../assets/notes/Getting started in philosophy – reading, arguing, writing.md") },
  { path: "Support/Texere/Guides/Primii pași în filosofie – citit, argumentat, scris.md", text: () => require("../assets/notes/Primii pași în filosofie – citit, argumentat, scris.md") },
  { path: "Support/Templates/New essay.md", text: () => require("../assets/notes/New essay.md") },
  { path: "Support/Templates/New author.md", text: () => require("../assets/notes/New author.md") },
  { path: "Support/Templates/Licență – Facultatea de Filosofie UB.md", text: () => require("../assets/notes/Licență – Facultatea de Filosofie UB.md") },
  { path: "Support/Templates/Disertație – Facultatea de Filosofie UB.md", text: () => require("../assets/notes/Disertație – Facultatea de Filosofie UB.md") },
];
const { Updater } = require("./core/updater");
const { VaultUpdates } = require("./core/vaultupdates");
const { beta } = require("./shared/beta");
const sleep = ms => new Promise(r => setTimeout(r, ms));

// pluginurile Texere (vin cu vault-ul)
const TEXERE = [
  { id: "texere-sources", name: "References", nameRo: "Referințe", ro: "Adaugi referințe, cu PDF-ul lor, și le citezi; adnotările ajung în note.", en: "Add references with their PDF and cite them; annotations go into your notes." },
  { id: "texere-export", name: "Export", ro: "Exporți nota în PDF, Word sau Markdown. Citările în stilul ales și bibliografia vin din Referințe; fără el, citările rămân [@cheie].", en: "Export a note to PDF, Word or Markdown. Citations in your style and the bibliography come from References; without it, citations stay as [@key]." },
  { id: "texere-insights", name: "Insights", ro: "Cât scrii, conceptele fără link și cum scrii. Merge și fără Referințe; cu el vede și referințele și adnotările tale.", en: "How much you write, unlinked concepts and how you write. Works without References; with it, it also sees your references and annotations." },
];
// modulele lui Texere (până la 3.0, pluginurile de mai sus): cheia, id-ul vechi (pentru mutarea setărilor și a scurtăturilor), codul
const MODULES = [
  { key: "sources", id: "texere-sources", label: "References", ro: "Referințe", load: () => require("./sources") },
  { key: "export", id: "texere-export", label: "Export", load: () => require("./export") },
  { key: "insights", id: "texere-insights", label: "Insights", load: () => require("./insights") },
];
const MOD_KEY = Object.fromEntries(MODULES.map(m => [m.id, m.key]));
// pluginul de care depinde Texere (doar acesta): din lista oficială Obsidian; Texere nu-l instalează singur (regula Obsidian),
// ci îți deschide pagina lui din Obsidian, unde apeși Install și Enable
const DEPS = [
  { id: "pdf-plus", name: "PDF++", by: "texere-sources", ro: "Adnotările din PDF: culorile, etichetele și legăturile spre locul din PDF (modulul Referințe).", en: "PDF annotations: colors, tags and links back to the place in the PDF (the References module)." },
];
// structura de foldere propusă: drumul de lucru, în ordine (sursele → notițele tale → lucrările → exportul)
const FOLDERS = ["02. Notes/Essays", "02. Notes/Personal", "02. Notes/Imported", "03. Workspace/01. Courses", "03. Workspace/02. Thesis", "03. Workspace/03. Articles", "03. Workspace/04. Projects"];
// hărțile domeniilor: notele din Fields/<domeniu>, din care vin valorile proprietăților notelor (ramură, concepte, teorii…)
const MAPS = [
  { id: "philosophy", folder: "Philosophy", ro: "Filosofie", en: "Philosophy", load: () => require("../assets/philosophy.json"),
    desc: { ro: "Ramurile, subdomeniile, conceptele, teoriile, curentele, perioadele și autorii filosofiei, legate între ele, pornind de la nota Filosofie. Le folosești în metadatele referințelor (de exemplu branch: Etică), iar apoi vezi tot ce ai citit într-o ramură. Nume în engleză, aliasuri în română.",
            en: "The branches, subfields, concepts, theories, movements, periods and authors of philosophy, linked together, starting from the Philosophy note. You use them in your references' metadata (for example branch: Ethics), then see everything you read in a branch. English names, Romanian aliases." } },
];

module.exports = class Texere extends Plugin {
  async onload() {
    this.settings = Object.assign({ onboarded: false }, (await this.loadData()) || {});
    this.loadedAt = Date.now();
    // modulele: pornite după ce se încarcă interfața (după ce verificăm pluginurile vechi și mutăm setările lor)
    this.mods = {}; this._regs = { views: {}, blocks: {}, protocols: {} }; this._extArrs = {}; this._cmdOwner = {};
    // (setările vechi ale Sources și Export rămân aici neatinse: modulele le copiază de aici la prima pornire)
    // configurarea pas cu pas: din Settings → Texere, Despre, Ajutor și pagina de pornire (nu mai e în lista de comenzi)
    this.addSettingTab(new TexereSettingTab(this));
    // Texere în bara din stânga: pagina de pornire a vault-ului (tab-ul nou)
    try { addIcon?.("texere", TEXERE_ICON); } catch (e) {}
    // singura iconiță Texere din bară: pagina de pornire (Surse, Export, Insights și Ajutor sunt în bara ei de jos)
    this.addRibbonIcon?.("texere", this.T("Texere · pagina de pornire", "Texere · home"), () => this.openHome());
    // Ajutorul (comanda „Ajutor”, pagina din tab-ul Texere) și plierea ghidurilor: cod al pluginului (fostele scripturi din vault)
    try { help.install(this); this._cmdOwner.help = "core"; } catch (e) { console.error("Texere: Ajutorul", e); }
    // modul Editare (variante, estompare, pus deoparte): nu se vede nimic până nu-l pornești pe o notă
    try { require("./edit").install(this); } catch (e) { console.error("Texere: modul Editare", e); }
    this.app.workspace.onLayoutReady(() => { this._boot = this.bootModules().catch(e => console.error("Texere: modulele", e)); });
    // după module: ce foldere sunt deja aici, ce-i trebuie lui Texere ca să meargă din prima (bibliografia, stilurile) și, pe un vault nou, pagina de pornire și iconița din ribbon
    this.app.workspace.onLayoutReady(() => { (this._boot || Promise.resolve()).then(() => this.firstRun()).catch(e => console.error("Texere: prima pornire", e)); });
    // o singură dată, când o cere instalarea (tidy-once.json în folderul pluginului): folderele lui Texere la un loc, prin Obsidian
    this.app.workspace.onLayoutReady(() => { this.tidyOnce().catch(e => console.error("Texere: folderele, o dată", e)); });
    // prima pornire pe acest laptop: configurarea pas cu pas (o singură dată; după ce pornesc modulele)
    this.app.workspace.onLayoutReady(() => { this.start().catch(e => console.error("Texere: configurarea", e)); });
    // actualizările, din release-urile GitHub ale pluginului (core/updater.js): „Ce e nou” după o actualizare, apoi o verificare pe zi
    this.app.workspace.onLayoutReady(() => { try { this.updater = new Updater(this); this.updater.start(); } catch (e) { console.error("Texere: actualizările", e); } });
    // ce aduce o versiune nouă în vault (core/vaultupdates.js): doar propuneri în pagina de pornire; nimic fără clicul tău
    this.vaultUpdates = new VaultUpdates(this);
    this.app.workspace.onLayoutReady(() => { setTimeout(() => { (this._boot || Promise.resolve()).then(() => this.vaultUpdates.run()).catch(e => console.error("Texere: ce aduce versiunea nouă", e)); }, 4000); });
    // folderele de care are nevoie Texere: când redenumești sau muți unul, îți spune pe loc ce înseamnă
    this.app.workspace.onLayoutReady(() => { if (this.app.vault.on) this.registerEvent(this.app.vault.on("rename", (f, old) => { try { this.onRename(f, old); } catch (e) { console.error("Texere: folderele", e); } })); });
    // ce repari într-un loc se vede și în celălalt: tab-ul nou și setările se redesenează când se schimbă un folder sau o setare a lor
    this.app.workspace.onLayoutReady(() => {
      if (this.app.workspace.on) this.registerEvent(this.app.workspace.on("texere:changed", () => this.changed()));
      if (this.app.vault.on) for (const ev of ["create", "delete", "rename"]) this.registerEvent(this.app.vault.on(ev, f => { if (Array.isArray(f?.children)) this.changed(); }));
    });
    // elementul Texere din bara de jos: întâi acțiunile notei deschise, aceleași ca la clic dreapta → Texere (o singură listă)
    this.app.workspace.onLayoutReady(() => { if (typeof this.addStatusBarItem !== "function") return;
      status(this).set("note", { order: 5, show: () => !!this.app.workspace.getActiveViewOfType?.(MarkdownView)?.file, menu: m => {
        const v = this.app.workspace.getActiveViewOfType?.(MarkdownView); if (!v?.file) return;
        for (const x of noteMenu(this).items({ kind: "editor", file: v.file, editor: v.editor, selection: v.editor?.getSelection?.() || "" })) {
          if (!x) { m.addSeparator(); continue; }
          m.addItem(i => { i.setTitle(x.title); if (x.icon) i.setIcon(x.icon); i.onClick(x.onClick); });
        }
      } });
      this.register(() => status(this).remove("note"));
    });
    // structura de foldere: o singură dată, după ce pornesc și celelalte pluginuri Texere (folderele lor pot avea alte nume)
    this.app.workspace.onLayoutReady(() => setTimeout(() => this.foldersOnce().catch(e => console.error("Texere: folderele", e)), 3000));
    // panoul din tab-ul nou
    this.app.workspace.onLayoutReady(() => {
      try { this.home(); } catch (e) { console.error("Texere: panoul", e); }
      this.registerEvent(this.app.workspace.on("layout-change", () => this.home()));
      this.registerEvent(this.app.workspace.on("active-leaf-change", l => { if (l?.view?.getViewType?.() === "empty") this.home(l); }));
      this.registerEvent(this.app.workspace.on("file-open", f => { try { if (!f?.path) return; const o = this.app.loadLocalStorage("texere-opened") || {}; o[f.path] = Date.now(); this.app.saveLocalStorage("texere-opened", Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 40))); } catch (e) {} }));
    });
    this.register(() => (this.app.workspace.getLeavesOfType?.("empty") || []).forEach(l => { const c = l.view?.contentEl; c?.querySelector(".texere-home")?.remove(); c?.removeClass("texere-home-on"); }));
  }
  save() { return this.saveData(this.settings); }
  onunload() { for (const M of Object.values(this.mods || {})) { try { M._stop(); } catch (e) {} } this.mods = {}; try { this._txStatus?.el?.remove?.(); } catch (e) {} this._txStatus = null; }
  get en() { return isEn(this.app); }

  // ——— modulele (Sources, Export, Insights) ———
  mod(key) { return this.mods?.[key] || null; }                       // modulul pornit (sau null)
  modOn(key) { return !this.settings?.modOff?.[key]; }               // pornit din setări
  running(M) { return !!M && this.mods?.[M.key] === M; }
  async setModule(key, on) {
    const off = (this.settings.modOff = this.settings.modOff || {});
    if (on) delete off[key]; else off[key] = true;
    await this.save();
    if (on) await this.startModule(key); else await this.stopModule(key);
  }
  async startModule(key) {
    if (this.mods[key] || !this.modOn(key) || this._oldOn?.length) return false;
    const def = MODULES.find(m => m.key === key); if (!def) return false;
    let M = null;
    try { const Cls = def.load(); M = new Cls(this, key); this.mods[key] = M; await M._start(); }
    catch (e) { console.error(`Texere · ${def.label}`, e); if (M) { delete this.mods[key]; try { await M._stop(); } catch (er) {} } return false; }
    this.notify(); return true;
  }
  async stopModule(key) { const M = this.mods[key]; if (!M) return; delete this.mods[key]; await M._stop(); this.notify(); }
  async startModules() { for (const m of MODULES) await this.startModule(m.key); }
  // după ce se încarcă interfața: pluginurile vechi (dacă mai sunt pornite), mutarea setărilor, apoi modulele
  async bootModules() {
    const P = this.app.plugins, old = MODULES.map(m => m.id).filter(id => P?.plugins?.[id] || P?.enabledPlugins?.has?.(id));
    const wasOn = new Set(old);
    if (old.length) {
      this._oldOn = old;   // cât timp sunt pornite, modulele nu pornesc (ar fi dublate)
      if (!(await this.askOldOff(old))) { new Notice(this.T("Texere: modulele Referințe, Export și Insights nu pornesc cât timp pluginurile vechi sunt pornite. Oprește-le din Setări → Community plugins, apoi repornește Obsidian.", "Texere: the References, Export and Insights modules won't start while the old plugins are on. Turn them off in Settings → Community plugins, then restart Obsidian."), 15000); return; }
      for (const id of old) { try { await P.disablePluginAndSave(id); } catch (e) { console.error("Texere: pluginul vechi", id, e); } }
      this._oldOn = null;
    }
    await this.migrate3(wasOn);
    await this.startModules();
  }
  askOldOff(ids) {
    return new Promise(res => {
      const m = new Modal(this.app), T = (a, b) => this.T(a, b); let done = false; const end = v => { if (done) return; done = true; res(v); m.close(); };
      m.titleEl.setText(T("Texere are acum totul într-un singur plugin", "Texere is now one plugin"));
      m.contentEl.createEl("p", { text: T("Referințe, Export și Insights sunt acum module ale lui Texere. Pluginurile vechi sunt încă pornite: le opresc (rămân instalate), iar setările lor trec în Texere. Nimic nu se șterge.", "References, Export and Insights are now modules of Texere. The old plugins are still on: I'll turn them off (they stay installed) and move their settings into Texere. Nothing is deleted.") });
      m.contentEl.createEl("p", { cls: "mod-muted", text: ids.join(" · ") });
      const row = m.contentEl.createDiv("modal-button-container");
      row.createEl("button", { text: T("Nu acum", "Not now") }).addEventListener("click", () => end(false));
      const ok = row.createEl("button", { cls: "mod-cta", text: T("Oprește-le și continuă", "Turn them off and continue") }); ok.addEventListener("click", () => end(true));
      m.onClose = () => end(false);
      m.open();
    });
  }
  // o singură dată: setările pluginurilor separate (data.json) → data.json-ul lui Texere (modules.*); stats/ și cache/ ale Insights → folderul lui Texere;
  // scurtăturile de tastatură → comenzile noi. Nu șterge nimic; dacă ceva e deja mutat, nu-l suprascrie.
  async migrate3(wasOn) {
    if (this.settings.migrated3) return;
    const ad = this.app.vault.adapter, cd = this.app.vault.configDir, me = this.manifest.dir, P = this.app.plugins;
    const mods = (this.settings.modules = this.settings.modules || {});
    for (const m of MODULES) {
      const p = normalizePath(`${cd}/plugins/${m.id}/data.json`);
      try { if (mods[m.key] == null && (await ad.exists(p))) mods[m.key] = JSON.parse(await ad.read(p)); } catch (e) { console.error("Texere: mutarea setărilor", m.id, e); }
      // un plugin vechi instalat, dar oprit: modulul rămâne oprit
      if (wasOn && P?.manifests?.[m.id] && !wasOn.has(m.id) && !P?.enabledPlugins?.has?.(m.id)) (this.settings.modOff = this.settings.modOff || {})[m.key] = true;
    }
    for (const sub of ["stats", "cache"]) {
      const from = normalizePath(`${cd}/plugins/texere-insights/${sub}`), to = normalizePath(`${me}/${sub}`);
      try {
        if (!(await ad.exists(from))) continue;
        if (!(await ad.exists(to))) await ad.mkdir(to);
        for (const f of (await ad.list(from)).files || []) {
          const dest = `${to}/${f.split("/").pop()}`;
          if (await ad.exists(dest)) continue;
          if (ad.copy) await ad.copy(f, dest); else await ad.write(dest, await ad.read(f));
        }
      } catch (e) { console.error("Texere: mutarea datelor Insights", sub, e); }
    }
    try {
      const hk = normalizePath(`${cd}/hotkeys.json`);
      if (await ad.exists(hk)) {
        const H = JSON.parse(await ad.read(hk)); let ch = false;
        for (const [k, v] of Object.entries(H)) {
          const mm = /^(texere-sources|texere-export|texere-insights):(.+)$/.exec(k); if (!mm) continue;
          const nk = `${this.manifest.id}:${this.cmdId(MOD_KEY[mm[1]], mm[2], true)}`;
          if (!(nk in H)) { H[nk] = v; ch = true; }
        }
        if (ch) { await ad.write(hk, JSON.stringify(H, null, 2)); try { await this.app.hotkeyManager?.load?.(); } catch (e) {} }
      }
    } catch (e) { console.error("Texere: scurtăturile", e); }
    this.settings.migrated3 = 1; await this.save();
  }
  async saveModuleData(key, d) { (this.settings.modules = this.settings.modules || {})[key] = d == null ? d : JSON.parse(JSON.stringify(d)); await this.save(); }
  // id-ul unei comenzi a unui modul: același ca înainte (fără prefixul pluginului vechi); la o coliziune, cu numele modulului în față
  cmdId(key, id, peek) {
    const own = this._cmdOwner || (this._cmdOwner = {}), cur = own[id];
    if (!cur || cur === key) { if (!peek) own[id] = key; return id; }
    const alt = `${key}-${id}`; if (!peek) own[alt] = key; return alt;
  }
  coreCommand(c) { (this._cmdOwner || (this._cmdOwner = {}))[c.id] = "core"; return this.addCommand(c); }
  // extensiile editorului ale unui modul: o listă înregistrată o singură dată, golită când modulul se oprește
  _extArrFor(key) { if (!this._extArrs[key]) { this._extArrs[key] = []; this.registerEditorExtension(this._extArrs[key]); } return this._extArrs[key]; }
  // vizualizările, blocurile de cod și linkurile obsidian:// ale modulelor: înregistrate o singură dată, trimise modulului cât e pornit
  _moduleView(key, type, creator) {
    const R = this._regs.views, had = R[type]; R[type] = { key, creator };
    if (!had) this.registerView(type, leaf => { const r = this._regs.views[type]; return r?.creator && this.mods[r.key] ? r.creator(leaf) : new OffView(leaf, type, this, r?.key); });
  }
  _moduleBlock(key, lang, fn, order) {
    const R = this._regs.blocks, had = R[lang]; R[lang] = { key, fn };
    if (!had) this.registerMarkdownCodeBlockProcessor(lang, (src, el, ctx) => { const r = this._regs.blocks[lang]; if (r?.fn && this.mods[r.key]) return r.fn(src, el, ctx); el.createEl("pre").createEl("code", { text: src }); }, order);
  }
  _moduleProtocol(key, action, fn) {
    const R = this._regs.protocols, had = R[action]; R[action] = { key, fn };
    if (!had) this.registerObsidianProtocolHandler(action, params => { const r = this._regs.protocols[action]; if (r?.fn && this.mods[r.key]) return r.fn(params); });
  }
  _viewTypesOf(key) { return Object.entries(this._regs.views).filter(([, r]) => r.key === key).map(([t]) => t); }
  _dropModuleRegs(key) { for (const R of Object.values(this._regs)) for (const r of Object.values(R)) if (r.key === key) { r.creator = null; r.fn = null; } }
  // Settings → Texere, la o secțiune (texere, sources, export, insights, about) și, la un modul, la o filă a lui
  openSettings(section, sub) {
    try {
      this.app.setting.open(); this.app.setting.openTabById(this.manifest.id);
      const t = this.app.setting.activeTab; if (!t || typeof t.showSection !== "function") return;
      if (sub) { const mt = this.mod(section)?.settingTabs?.[0]; if (mt) mt.tab = sub; }
      t.showSection(section || "texere");
    } catch (e) { console.warn("Texere: setările", e); }
  }
  // mută un folder al lui Texere în alt folder din vault, prin Obsidian (linkurile și setările lui Texere urmează)
  moveFolder(path, done) {
    const P = this, T = (a, b) => this.T(a, b), f = this.app.vault.getAbstractFileByPath(path); if (!f || !Array.isArray(f.children)) { new Notice(T(`Nu găsesc „${path}”.`, `Can't find “${path}”.`)); return; }
    const ROOT = T("(rădăcina vault-ului)", "(the vault's root)"), name = f.name;
    const M = class extends FuzzySuggestModal {
      getItems() { return [ROOT, ...vaultFolders(P.app).filter(x => x !== path && !x.startsWith(path + "/") && x !== (f.parent?.path || ""))]; }
      getItemText(x) { return x; }
      async onChooseItem(x) {
        const to = normalizePath(x === ROOT ? name : `${x}/${name}`);
        if (P.app.vault.getAbstractFileByPath(to)) { new Notice(T(`Există deja „${to}”.`, `“${to}” already exists.`)); return; }
        try { await P.app.fileManager.renameFile(f, to); new Notice(T(`Mutat în ${to}. Texere îl urmează.`, `Moved to ${to}. Texere follows it.`), 5000); } catch (e) { new Notice(e?.message || String(e)); }
        setTimeout(() => done?.(), 400);
      }
    };
    const m = new M(this.app); m.setPlaceholder(T(`Unde muți „${name}”?`, `Where should “${name}” go?`)); m.open();
  }
  T(a, b) { return this.en ? b : a; }

  base() { const a = this.app.vault.adapter; return a.getBasePath ? a.getBasePath() : a.basePath; }

  // niciodată configurat pe acest laptop, sau vault mutat / copiat în alt folder
  needsConfig() { return setup.needsConfig(this); }
  // la prima pornire: configurarea pas cu pas se deschide singură (o dată; dacă o închizi, o găsești în Settings → Texere și pe pagina de pornire)
  async start() {
    await sleep(2500);
    if (this._wiz || !this.needsConfig()) return;
    let later = null; try { later = this.app.loadLocalStorage(LATER); } catch (e) {}
    if (later && later === C.basePath(this.app)) return;
    this.onboard(true);
  }

  // ——— pluginurile: pornit / instalat, dar oprit / lipsă ———
  // un modul Texere (id-ul vechi al pluginului) e pornit sau oprit din setări; un plugin (PDF++): pornit / instalat, dar oprit / lipsă
  state(id) { if (MOD_KEY[id]) return this.modOn(MOD_KEY[id]) ? "on" : "off"; const P = this.app.plugins; return P.enabledPlugins?.has?.(id) ? "on" : P.manifests?.[id] ? "off" : "missing"; }
  async enable(id) { if (MOD_KEY[id]) return this.setModule(MOD_KEY[id], true); if (id === "pdf-plus") { try { await require("./core/pdfpreset").apply(this.app, { reload: false }); } catch (e) {} } await this.app.plugins.enablePluginAndSave(id); }
  async disable(id) { if (MOD_KEY[id]) return this.setModule(MOD_KEY[id], false); await this.app.plugins.disablePluginAndSave(id); }
  // pagina unui plugin în Obsidian (Community plugins), unde apeși Install: Texere nu instalează singur alte pluginuri
  openPluginPage(id) { return setup.openPluginPage(this.app, id); }
  // pentru configurare: API-ul modulului Sources și setările exportului (din modulele pornite)
  sourcesApi() { return this.mod("sources")?.sources || null; }
  exportStore() { const X = this.mod("export"); return X?.settings ? { settings: X.settings, save: () => X.saveData(X.settings) } : null; }
  // ——— harta domeniilor ———
  maps() { return MAPS; }
  // o hartă e dorită dacă n-ai fost încă întrebat (vault-urile de dinainte) sau ai ales-o la configurare; altfel Texere nu ți-o mai propune
  mapWanted(m) { const f = this.settings.fields; return !f?.asked || (f.chosen || []).includes(m.id); }
  async chooseField(id, on = true) { const f = (this.settings.fields = this.settings.fields || {}); f.asked = true; const c = new Set(f.chosen || []); if (on) c.add(id); else c.delete(id); f.chosen = [...c]; await this.save();
    // câmpurile hărții în șablonul notei de lectură: intră cu harta, ies dacă n-o alegi (doar cele neschimbate și nefolosite)
    try { const S = this.sourcesApi(); if (S) await (on ? S.addMapFields?.(id) : S.dropMapFields?.(id)); } catch (e) { console.warn("Texere: câmpurile hărții", e); } }
  // unde e harta acum: folderul în care stă „Philosophy/Philosophy.md” (oriunde l-ai mutat); altfel, una nouă: „Fields”, lângă notele tale (în „02. Notes”, dacă îl ai)
  mapRoot(m) {
    const tail = `${m.folder}/${m.folder}.md`, hit = (this.app.vault.getMarkdownFiles?.() || []).find(f => f.path === tail || f.path.endsWith("/" + tail));
    if (hit) return hit.path === tail ? "" : hit.path.slice(0, -(tail.length + 1));
    // ca în vault-ul Texere: „2. Notes/Disciplines”; cu structura Texere aleasă, chiar dacă „2. Notes” nu e încă creat
    const base = "Disciplines", notes = P_.existing(this.app, "02. Notes") || (this.settings.structure === "recommended" ? P_.placeFor(this.app, "02. Notes") : null);
    return notes && !base.includes("/") ? `${notes}/${base}` : base;
  }
  async mapData(m) { if (!this._maps) this._maps = {}; if (!this._maps[m.id]) this._maps[m.id] = m.load(); return this._maps[m.id]; }
  async mapStatus(m) {
    const d = await this.mapData(m), root = this.mapRoot(m), files = Object.keys(d.files).filter(p => p.startsWith(m.folder + "/"));
    const names = new Set((this.app.vault.getMarkdownFiles?.() || []).map(f => f.name));
    const have = files.filter(p => this.app.vault.getAbstractFileByPath(normalizePath(`${root}/${p}`)) || names.has(p.split("/").pop())).length;
    return { total: files.length, have, folder: root ? `${root}/${m.folder}` : m.folder };
  }
  // creează notele care lipsesc (nu atinge ce ai deja)
  async createMap(m) {
    const d = await this.mapData(m), root = this.mapRoot(m), names = new Set((this.app.vault.getMarkdownFiles?.() || []).map(f => f.name)); let made = 0;
    for (const [rel, text] of Object.entries(d.files)) {
      if (!rel.startsWith(m.folder + "/")) continue;
      const path = normalizePath(root ? `${root}/${rel}` : rel); if (this.app.vault.getAbstractFileByPath(path) || names.has(rel.split("/").pop())) continue;   // mutată sau redenumită de tine: n-o mai facem o dată
      const dir = path.slice(0, path.lastIndexOf("/")); let cur = "";
      for (const part of dir.split("/")) { cur = cur ? `${cur}/${part}` : part; if (!this.app.vault.getAbstractFileByPath(cur)) { try { await this.app.vault.createFolder(cur); } catch (e) {} } }
      try { await this.app.vault.create(path, text); made++; } catch (e) { console.warn("Texere: harta", path, e); }
    }
    if (this.settings.fields?.asked) await this.chooseField(m.id);   // ai creat-o: e harta ta
    return made;
  }
  // ce mai e de făcut: pluginurile lipsă sau oprite, harta
  async todo() {
    const T = (a, b) => this.T(a, b), out = [];
    for (const d of DEPS) { const st = this.state(d.id); if (st !== "on") out.push({ kind: "dep", d, st, label: st === "missing" ? T(`Instalează ${d.name} (din pagina lui din Obsidian)`, `Install ${d.name} (from its page in Obsidian)`) : T(`Pornește ${d.name}`, `Turn on ${d.name}`), why: this.en ? d.en : d.ro }); }
    for (const m of MAPS.filter(x => this.mapWanted(x))) { try { const s = await this.mapStatus(m); if (!s.have) out.push({ kind: "map", m, label: T(`Creează harta: ${m.ro}`, `Create the map: ${m.en}`), why: T(`${s.total} note în ${s.folder}: ramuri, subdomenii, concepte, teorii, curente, perioade, autori (valorile pentru metadatele referințelor).`, `${s.total} notes in ${s.folder}: branches, subfields, concepts, theories, movements, periods, authors (the values for your references' metadata).`) }); } catch (e) {} }
    return out;
  }
  async doItem(it) {
    if (it.kind === "dep") {
      // PDF++: instalat prin Obsidian (ca din Community plugins), cu setările lui Texere; dacă nu merge, pagina lui
      if (it.st === "missing" && it.d.id === "pdf-plus") { const r = await require("./core/setup").pdfplus.run(this, "install"); if (!this.app.plugins.enabledPlugins.has("pdf-plus")) this.openPluginPage(it.d.id); else new Notice(this.T("Am instalat și am pornit PDF++.", "Installed and turned on PDF++."), 5000); this.notify(); }
      else if (it.st === "missing") this.openPluginPage(it.d.id); else await this.enable(it.d.id);
      return;
    }
    if (it.kind === "texere") { await this.enable(it.p.id); return; }
    if (it.kind === "map") { await this.createMap(it.m); return; }
  }
  // anunță că s-a schimbat ceva (un folder pus la loc, o setare): tab-urile noi și setările deschise se redesenează
  notify() { try { this.app.workspace.trigger?.("texere:changed"); } catch (e) {} this.changed(); }
  changed() {
    clearTimeout(this._chT);
    this._chT = setTimeout(() => {
      try { this.home(true); } catch (e) {}
      try {
        const t = this.app.setting?.activeTab, c = t?.containerEl; if (!t || !/^texere/.test(String(t.id || "")) || !c?.isConnected) return;
        // cât timp scrii într-un câmp din setări, nu le redesenăm: așteptăm să ieși din câmp
        const a = document.activeElement; if (a && c.contains(a) && /^(INPUT|TEXTAREA)$/.test(a.tagName) && a.type !== "checkbox") { if (!c._txWait) { c._txWait = true; c.addEventListener("focusout", () => { c._txWait = false; this.changed(); }, { once: true }); } return; }
        t.display();
      } catch (e) {}
    }, 250);
  }

  // ——— folderele de care are nevoie Texere ———
  // ce foldere ale lui Texere au fost deja în vault: doar unul care a fost aici și a dispărut e o alertă („Pune-l la loc”, „Alege…”);
  // unul care n-a fost niciodată (vault nou, sau Texere instalat acum într-un vault al tău) se creează singur, la nevoie
  seen(path) { const s = this.settings.seen, p = String(path || "").replace(/\/+$/, ""); return Array.isArray(s) ? s.includes(p) : !!this.settings.onboarded; }
  markSeen(paths) {
    const s = (this.settings.seen = Array.isArray(this.settings.seen) ? this.settings.seen : []); let add = false;
    for (const p0 of paths || []) { const p = String(p0 || "").replace(/\/+$/, ""); if (p && !s.includes(p)) { s.push(p); add = true; } }
    if (add) { clearTimeout(this._seenT); this._seenT = setTimeout(() => this.save(), 500); }
  }
  // folderele lui Texere care sunt acum în vault devin „văzute”
  trackSeen() { try { const V = this.app.vault; this.markSeen([...this.fixedFolders(), ...this.movableFolders()].map(x => x.path).filter(p => p && V.getAbstractFileByPath(p))); } catch (e) {} }
  // o singură dată: un vault configurat înainte de această versiune păstrează alertele de până acum (folderele lui contează ca văzute, chiar dacă lipsesc);
  // unul neconfigurat pornește doar cu ce e deja în el
  seenInit() {
    if (Array.isArray(this.settings.seen)) return;
    const all = [...this.fixedFolders(), ...this.movableFolders()].map(x => x.path).filter(Boolean);
    this.settings.seen = []; this.markSeen(this.settings.onboarded ? all : all.filter(p => this.app.vault.getAbstractFileByPath(p)));
  }
  // bibliografia (gol) și stilurile de citare, dacă n-au fost niciodată în vault; citările merg din prima
  ensureEssentials() {
    if (this._ess) return this._ess;
    this._ess = require("./core/essentials").ensure(this).then(r => { if (r?.made?.length) this.notify(); return r; }).catch(e => { console.error("Texere: bibliografia și stilurile", e); return { made: [] }; }).finally(() => { this._ess = null; });
    return this._ess;
  }
  async completeSetup(force) {
    const v = this.manifest?.version || "";
    if (!this.settings.onboarded || this.needsConfig() || this._wiz || (!force && this.settings.completedFor === v)) return false;
    const W = require("./core/wizard"), miss = W.missingSetup(this);
    this.settings.completedFor = v; await this.save();   // o singură dată pe versiune; ce rămâne apare pe pagina de pornire
    if (!miss.any) return false;
    await sleep(1500); await this.toMainWindow();
    new W.WizardModal(this, { complete: true, missing: miss }).open();
    return true;
  }
  // un vault nou: fără note ale tale (nota „Welcome” pe care o pune Obsidian într-un vault nou și ce a pus Texere nu contează)
  // vault-ul Texere descărcat (structura lui, ghidurile, exemplele) e tot unul nou; un vault deja configurat de Texere nu mai e
  isNewVault() {
    if (this.settings.onboarded) return false;
    const V = this.app.vault, texereVault = !!(V.getAbstractFileByPath("Support/Texere/Guides") && P_.existing(this.app, "01. References/Reading Notes"));
    return texereVault || !(V.getMarkdownFiles?.() || []).some(f => !f.path.startsWith(".") && !/^Support\/Texere\//.test(f.path) && f.path !== "Welcome.md");
  }
  // vault nou: hotărât o dată, la prima pornire a lui Texere (înainte ca, de exemplu, configurarea să adauge note)
  freshVault() { return this.settings.presetDone ? this.settings.presetDone === "new" : this.isNewVault(); }
  // iconița lui Texere, prima în ribbon (bara de iconițe din stânga); Obsidian ține minte ordinea
  ribbonFirst() {
    const R = this.app.workspace.leftRibbon, items = R?.items, i = (items || []).findIndex(x => String(x.id || "").startsWith(this.manifest.id + ":"));
    if (i < 0) return false;
    const [it] = items.splice(i, 1); it.hidden = false; items.unshift(it);
    if (typeof R.onChange === "function") R.onChange(true); else { R.ribbonItemsEl?.prepend(it.buttonEl); this.app.workspace.requestSaveLayout?.(); }
    return true;
  }
  // O singură dată pe vault. Vault nou: pagina de pornire în tab-ul nou, iconița lui Texere prima în ribbon, linkurile se actualizează la redenumire.
  // Într-un vault existent nu schimbăm nimic din aranjamentul tău (iconița e la capătul ribbonului, unde Obsidian pune pluginurile).
  async firstRun() {
    this.seenInit();
    await this.ensureEssentials();
    // PDF++ cu setările lui Texere, dar fără autor: fără el, PDF++ nu scrie evidențierile în PDF
    try { if (await require("./core/pdfpreset").ensureAuthor(this.app)) console.log("Texere: autorul adnotărilor PDF++ setat"); } catch (e) {}
    // după o actualizare, într-un vault configurat înainte: dacă lipsește ceva de care Texere are nevoie, îl adaug pas cu pas (o dată pe versiune)
    try { await this.completeSetup(); } catch (e) { console.error("Texere: completarea configurării", e); }
    if (!this.settings.presetDone) {
      const fresh = this.isNewVault();
      this.settings.presetDone = fresh ? "new" : "existing"; await this.save();
      if (fresh) {
        try { this.ribbonFirst(); } catch (e) { console.warn("Texere: ribbon", e); }
        try { if (this.app.vault.getConfig?.("alwaysUpdateLinks") !== true) this.app.vault.setConfig?.("alwaysUpdateLinks", true); } catch (e) {}
        try { if (!(this.app.workspace.getLeavesOfType?.("empty") || []).some(l => ![this.app.workspace.leftSplit, this.app.workspace.rightSplit].includes(l.getRoot?.()))) this.openHome(); } catch (e) {}
      }
    }
    this.notify();
  }
  // bibliografia și stilurile de citare: dacă le muți în Obsidian, Texere le urmează; dacă dispar (mutate în afara lui Obsidian), le caută după bibliography.json
  fixedFolders() {
    const T = (a, b) => this.T(a, b), S = this.mod("sources");
    let live = S?.settings?.sources?.bibPath || ""; if (!live && typeof S?.sources?.bibPath === "function") { try { live = S.sources.bibPath(); } catch (e) {} }
    const bib = String(live || this.settings?.modules?.sources?.sources?.bibPath || "");
    if (!bib.includes("/")) return [];   // fără Sources (și fără o cale știută) nu e nimic de păzit
    return [
      { path: bib.slice(0, bib.lastIndexOf("/")), mark: bib.split("/").pop(), why: T("Texere ține aici bibliografia și stilurile de citare.", "Texere keeps the bibliography and the citation styles here."), breaks: T("Citările și bibliografia nu merg", "Citations and the bibliography don't work") },
    ];
  }
  // pot fi schimbate (din Setări): folderele surselor și al exportului
  movableFolders() {
    const T = (a, b) => this.T(a, b), P = this.app.plugins.plugins, out = [];
    const src = this.mod("sources")?.sources, f = this.mod("sources")?.settings?.sources?.files || {}, root = p => { p = String(p || "").replace(/\/+$/, ""); const i = p.indexOf("{{"); return i < 0 ? p : p.slice(0, i).replace(/\/[^/]*$/, "").replace(/\/+$/, ""); };
    // breaks = ce nu mai merge (titlul alertei); next = ce se întâmplă la următoarea salvare
    for (const [k, def, label, breaks, next] of [["notes", "01. References/Reading Notes", T("folderul notelor de lectură", "the reading notes folder"), T("Referințele noi nu ajung în folderul tău de note", "New references don't go into your notes folder"), T("următoarea referință pe care o salvezi", "the next reference you save")],
      ["pdfs", "01. References/PDFs", T("folderul PDF-urilor", "the PDF folder"), T("PDF-urile noi nu ajung în folderul tău de PDF-uri", "New PDFs don't go into your PDF folder"), T("următorul PDF (al unei referințe noi, din Zotero sau din Downloads)", "the next PDF (from a new reference, Zotero or Downloads)")]])
      if (src) out.push({ key: k, path: root(src.filesConf?.()[k] || f[k]) || def, label, breaks, next, plugin: "texere-sources", use: to => src?.setFolderRoot?.(k, to), choose: () => src?.checkFolders?.() });   // doar cu Sources pornit (cât pornește, nu știm încă folderele lui)
    const X = this.mod("export")?.exporter, ex = String(this.mod("export")?.settings?.export?.folder || "04. Export").replace(/\/+$/, "");
    if (X && !/^([\/~]|[A-Za-z]:[\\/])/.test(ex)) out.push({ key: "export", path: ex, label: T("folderul exportului", "the export folder"), breaks: T("Exporturile nu ajung în folderul tău de export", "Exports don't go into your export folder"), next: T("următorul export", "the next export"), plugin: "texere-export",
      use: async to => { const c = X.conf(); c.folder = to; c.folderMoved = null; await X.save(); this.notify(); }, choose: async () => { const to = await X.askFolder(ex); if (to) { const c = X.conf(); c.folder = to; c.folderMoved = null; await X.save(); this.notify(); } } });
    return out;
  }
  // instalarea poate cere o dată „Folderele lui Texere, la un loc”: tidy-once.json (în folderul pluginului) spune ce se mută și dacă se repară căile vechi.
  // Se mută doar ce e în listă și în planul de acum, prin Obsidian (linkurile se actualizează); „trash” duce în coșul lui Obsidian doar notele numite.
  // Ce s-a făcut se scrie în tidy-done.json. O singură dată pe cerere (id).
  async tidyOnce() {
    const ad = this.app.vault.adapter, dir = this.manifest?.dir; if (!dir || typeof ad?.exists !== "function") return;
    const once = `${dir}/tidy-once.json`; if (!(await ad.exists(once))) return;
    let want = null; try { want = JSON.parse(await ad.read(once)); } catch (e) { console.warn("Texere: tidy-once.json", e); return; }
    const id = String(want?.id || ""); if (!id || this.settings.tidyOnceDone === id) return;
    await (this._boot || Promise.resolve());
    const mc = this.app.metadataCache;   // întâi indexul vault-ului: după el actualizează Obsidian linkurile
    if (mc && mc.resolved === false && typeof mc.on === "function") await new Promise(r => { let ref = null; const t = setTimeout(() => { try { mc.offref(ref); } catch (e) {} r(); }, 60000); ref = mc.on("resolved", () => { clearTimeout(t); try { mc.offref(ref); } catch (e) {} r(); }); });
    await sleep(2500);
    // redenumiri de foldere (ex. „1. Sources” → „1. References”), prin Obsidian: linkurile și setările lui Texere urmează; numerotarea rămâne
    const renamed = [], renFail = [];
    for (const [from0, base] of (want.renames || [])) {
      const from = P_.existing(this.app, String(from0)) || String(from0), f = this.app.vault.getAbstractFileByPath(from); if (!f || !base) continue;
      const par = from.includes("/") ? from.slice(0, from.lastIndexOf("/")) : "", num = /^(\d+\.\s*)/.exec(f.name || ""), to = (par ? par + "/" : "") + (num ? num[1] : "") + base;
      if (to === from || this.app.vault.getAbstractFileByPath(to)) { if (to !== from) renFail.push({ from, to, why: "exists" }); continue; }
      try { await this.app.fileManager.renameFile(f, to); renamed.push({ from, to }); await sleep(300); } catch (e) { renFail.push({ from, to, why: e?.message || String(e) }); }
    }
    const moves = new Set((want.moves || []).map(String)), items = tidy.tidyPlan(this).filter(it => moves.has(it.from)).map(it => ({ ...it, checked: true }));
    const r = items.length ? await tidy.tidyRun(this, items) : { done: [], fail: [] };
    r.done.push(...renamed); r.fail.push(...renFail);
    if (want.map === 2) { try { const mm = await require("./core/mapmigrate").migrateMap2(this); r.done.push({ from: "Philosophy map v1", to: `v2: ${mm.folders} folders, ${mm.titles} titles, ${mm.props} notes' properties, ${mm.aliases} alias lists, ${mm.authors} new author notes, ${mm.types} property types removed` }); for (const x of mm.fail) r.fail.push({ from: "map", to: "", why: x }); this.settings.mapVersion = 2; } catch (e) { console.error("Texere: harta v2", e); r.fail.push({ from: "map", to: "", why: e?.message || String(e) }); } }
    // metadatele notelor de lectură, înapoi în ordinea de la import (datele referinței, apoi câmpurile șablonului, apoi ale tale)
    if (want.reorder) { try { const S = this.sourcesApi(), o = S ? await S.reorderNotes() : null; if (o) { r.done.push({ from: "Reading notes' metadata", to: `import order in ${o.done} notes` }); for (const x of o.fail) r.fail.push({ from: "reorder", to: "", why: x }); } } catch (e) { console.error("Texere: ordinea metadatelor", e); r.fail.push({ from: "reorder", to: "", why: e?.message || String(e) }); } }
    // un șablon Texere neschimbat de tine, înlocuit cu versiunea nouă (doar dacă textul e exact cel vechi; altfel rămâne al tău)
    for (const x of (want.restock || [])) {
      const f = this.app.vault.getAbstractFileByPath(String(x.path || "")), note = NOTES.find(n => n.path === x.path); if (!(f instanceof TFile) || !note) continue;
      try { const cur = await this.app.vault.read(f); if (cur.trim() === String(x.old || "").trim()) { await this.app.vault.modify(f, note.text()); r.done.push({ from: x.path, to: "new version" }); } else r.fail.push({ from: x.path, to: "", why: "edited by you: kept" }); } catch (e) { r.fail.push({ from: x.path, to: "", why: e?.message || String(e) }); }
    }
    // textul unei note Texere (fără metadate), înlocuit doar dacă e exact cel livrat înainte; metadatele tale rămân
    for (const x of (want.rebody || [])) {
      const f = this.app.vault.getAbstractFileByPath(P_.existing(this.app, String(x.path || "")) || String(x.path || ""));
      if (!(f instanceof TFile)) { r.fail.push({ from: String(x.path), to: "", why: "not found" }); continue; }
      try {
        const cur = await this.app.vault.read(f), m = /^---\n[\s\S]*?\n---\n/.exec(cur), head = m ? m[0] : "", body = cur.slice(head.length);
        // la fel și cu tabelele aliniate de Obsidian (spații în plus) sau cu numele de proprietăți schimbate de harta v2
        const nb = t => String(t || "").replace(/[ \t]+/g, " ").replace(/ ?\| ?/g, "|").replace(/-{3,}/g, "---").replace(/author-links/g, "authors").trim();
        if (nb(body) === nb(x.old)) { await this.app.vault.modify(f, head + String(x.new || "")); r.done.push({ from: f.path, to: "new text" }); }
        else r.fail.push({ from: f.path, to: "", why: "edited by you: kept" });
      } catch (e) { r.fail.push({ from: String(x.path), to: "", why: e?.message || String(e) }); }
    }
    let repaired = 0; if (want.repair) { try { repaired = await tidy.repairPaths(this); } catch (e) { console.error("Texere: căile", e); } }
    // notele lui Texere care nu mai au ce căuta în vault (ex. ghidul vechi, acum în Ajutor): în coșul lui Obsidian (.trash), doar ce e în listă;
    // un folder din listă, doar dacă a rămas gol
    for (const p of (want.trash || []).map(String)) {
      const f = this.app.vault.getAbstractFileByPath(p); if (!f) continue;
      if (Array.isArray(f.children) && f.children.length) { r.fail.push({ from: p, to: "(.trash)", why: "not empty" }); continue; }
      try { const dir = Array.isArray(f.children); await this.app.vault.trash(f, false); r.done.push({ from: p, to: "(.trash)", dir }); } catch (e) { r.fail.push({ from: p, to: "(.trash)", why: e?.message || String(e) }); }
    }
    const res = { id, at: new Date().toISOString(), done: r.done.map(x => ({ from: x.from, to: x.to || "(.trash)" })), fail: r.fail.map(x => ({ from: x.from, to: x.to, why: x.why })), skipped: [...moves].filter(m => !items.some(it => it.from === m)), repaired };
    const trashed = r.done.filter(x => x.to === "(.trash)" && !x.dir && (want.trash || []).includes(x.from)).length;
    this.settings.tidyOnceDone = id; await this.save();
    try { await ad.write(`${dir}/tidy-done.json`, JSON.stringify(res, null, 1)); } catch (e) { console.warn("Texere: tidy-done.json", e); }
    const moved = r.done.filter(x => x.to && x.to !== "(.trash)").length, T = (a, b) => this.T(a, b);
    if (trashed && !moved && !r.fail.length) new Notice(T(`Texere: ghidul e acum în Ajutor; notele vechi despre Texere (${trashed}) sunt în coșul lui Obsidian.`, `Texere: the guide is in Help now; the old notes about Texere (${trashed}) are in Obsidian's trash.`), 12000);
    else if (moved || r.fail.length || repaired) new Notice(r.fail.length
      ? T(`Texere: am mutat ${moved} la locul lor; ${r.fail.length} n-au putut fi mutate (vezi Settings → Texere → Foldere).`, `Texere: moved ${moved} into place; ${r.fail.length} couldn't be moved (see Settings → Texere → Folders).`)
      : T(`Texere: folderele sunt la locul lor (${moved} mutate prin Obsidian, linkurile actualizate${repaired ? `, ${repaired} căi reparate` : ""}).`, `Texere: the folders are in place (${moved} moved through Obsidian, links updated${repaired ? `, ${repaired} paths fixed` : ""}).`), 12000);
    this.notify?.();
  }
  // un folder redenumit sau mutat în Obsidian: setările lui Texere îl urmează (tidy.followRename); mesajele de mai jos rămân doar pentru ce n-a putut urma
  onRename(f, old) {
    try { tidy.followRename(this, f, old); } catch (e) { console.error("Texere: căile", e); }   // setările lui Texere urmează redenumirea
    // ce era „văzut” sub numele vechi e văzut și sub cel nou (dacă îl muți apoi în afara lui Obsidian, Texere tot îți spune)
    try { if (Array.isArray(f?.children) && Array.isArray(this.settings.seen)) this.markSeen(this.settings.seen.filter(p => p === old || p.startsWith(old + "/")).map(p => f.path + p.slice(old.length))); } catch (e) {}
    if (!Array.isArray(f?.children) || this._putting || this._tidying) return;   // doar folderele; nu și când le mută Texere
    const T = (a, b) => this.T(a, b), hit = p => old === p || p.startsWith(old + "/"), now = p => f.path + p.slice(old.length);
    const fixed = this.fixedFolders().filter(x => hit(x.path));
    if (fixed.length) {
      (this.settings.moved = (this.settings.moved || []).filter(m => m.to !== old)).push({ from: old, to: f.path }); this.save();
      const frag = document.createDocumentFragment();
      frag.append(T(`${fixed[0].breaks}: Texere n-a putut urma „${fixed[0].path}”. ${fixed[0].why} `, `${fixed[0].breaks}: Texere couldn't follow “${fixed[0].path}”. ${fixed[0].why} `));
      const a = document.createElement("a"); a.href = "#"; a.textContent = T("Pune-l la loc", "Put it back"); frag.append(a);
      const n = new Notice(frag, 0); a.addEventListener("click", async e => { e.preventDefault(); n.hide(); await this.putBack(fixed[0].path); this.notify(); });
      this.notify(); return;
    }
    const mv = this.movableFolders().find(x => hit(x.path));
    if (mv) {
      const to = now(mv.path), frag = document.createDocumentFragment();
      frag.append(T(`Ai redenumit ${mv.label}: „${mv.path}” e acum „${to}”. ${mv.breaks}: Texere încă îl caută pe „${mv.path}”, așa că ${mv.next} se va opri și te va întreba unde să ajungă. `, `You renamed ${mv.label}: “${mv.path}” is now “${to}”. ${mv.breaks}: Texere still looks for “${mv.path}”, so ${mv.next} will stop and ask where to go. `));
      const a = document.createElement("a"); a.href = "#"; a.textContent = T(`Folosește „${to}”`, `Use “${to}”`); frag.append(a);
      const n = new Notice(frag, 15000); a.addEventListener("click", async e => { e.preventDefault(); n.hide(); await mv.use(to); this.notify(); });
      setTimeout(() => this.notify(), 300);
    }
  }
  // bibliografia lui Texere mutată în afara lui Obsidian: un alt folder cu bibliography.json și cu stilurile lui Texere (cel puțin două .csl);
  // nu bibliografia altui plugin (de ex. BibLib, cu un singur stil)
  bibElsewhere(dir) {
    const V = this.app.vault;
    return V.getFiles().filter(g => g.name === "bibliography.json" && g.parent && g.parent.path !== dir && !g.path.startsWith(".")).map(g => g.parent)
      .find(f => (f.children || []).filter(c => c.extension === "csl").length >= 2) || null;
  }
  // pune la loc un folder fix: după redenumirea ținută minte, altfel după fișierul lui (ex. bibliography.json)
  async putBack(path) {
    const T = (a, b) => this.T(a, b), V = this.app.vault; this._putting = true;
    try {
      if (V.getAbstractFileByPath(path)) return true;
      const rec = (this.settings.moved || []).slice().reverse().find(m => (path === m.from || path.startsWith(m.from + "/")) && V.getAbstractFileByPath(m.to) && !V.getAbstractFileByPath(m.from));
      let from = rec ? V.getAbstractFileByPath(rec.to) : null, to = rec ? rec.from : path;
      if (!from && this.fixedFolders().some(y => y.path === path)) from = this.bibElsewhere(path);
      if (!from) { new Notice(T(`Nu găsesc „${path}” în vault. Copiază-l din vault-ul Texere.`, `I can't find “${path}” in the vault. Copy it from the Texere vault.`), 10000); return false; }
      const parent = to.includes("/") ? to.slice(0, to.lastIndexOf("/")) : ""; let cur = "";
      for (const part of parent ? parent.split("/") : []) { cur = cur ? `${cur}/${part}` : part; if (!V.getAbstractFileByPath(cur)) await V.createFolder(cur); }
      await this.app.fileManager.renameFile(from, to);
      this.settings.moved = (this.settings.moved || []).filter(m => m !== rec); await this.save();
      new Notice(T(`„${to}” e din nou la locul lui.`, `“${to}” is back in its place.`), 5000);
      return true;
    } catch (e) { new Notice(T("N-am putut pune folderul la loc: ", "Couldn't put the folder back: ") + e.message, 10000); return false; }
    finally { this._putting = false; }
  }

  // ——— structura de foldere ———
  // folderele propuse; cele ale surselor și exportului, cu numele din setările lor (dacă le-ai schimbat)
  folders() {
    const P = this.app.plugins.plugins, root = p => { p = String(p || "").replace(/\/+$/, ""); const i = p.indexOf("{{"); return i < 0 ? p : p.slice(0, i).replace(/\/[^/]*$/, "").replace(/\/+$/, ""); };
    // modulul oprit: folderele din setările lui (acolo le pune și configurarea)
    const f = this.mod("sources")?.settings?.sources?.files || this.settings.modules?.sources?.sources?.files || {}, ex = String(this.mod("export")?.settings?.export?.folder || this.settings.modules?.export?.export?.folder || "04. Export");
    // cu folderele tale (configurarea: „Folderele mele”), Texere nu-și mai propune structura lui; doar locurile pe care le folosește
    const out = [root(f.pdfs) || "01. References/PDFs", root(f.notes) || "01. References/Reading Notes", ...(this.settings.structure === "own" ? [] : FOLDERS)];
    // folderul exportului e al lui Texere · Export (îl creează la export și te întreabă dacă l-ai redenumit); fără el, îl creăm aici
    if (!this.mod("export") && !/^([\/~]|[A-Za-z]:[\\/])/.test(ex)) out.push(root(ex) || "04. Export");
    return [...new Set(out.filter(Boolean))];
  }
  // celelalte foldere ale structurii Texere (notițe, lucrări, imagini): cum sunt sau ar fi numite în vault-ul tău
  otherFolders() { return [...FOLDERS, "Support/Media"].map(p => P_.existing(this.app, normalizePath(p)) || P_.placeFor(this.app, normalizePath(p))); }
  missingFolders() { return this.folders().filter(p => !P_.existing(this.app, normalizePath(p))); }
  // numele de sus ale folderelor propuse, așa cum sunt (sau ar fi) în vault-ul tău: „1. Sources · 2. Notes · …”
  folderNames() { return [...new Set([...this.folders(), "04. Export"].map(p => (P_.existing(this.app, p) || P_.placeFor(this.app, p)).split("/")[0]))].join(" · "); }
  async createFolders() {
    let made = 0;
    for (const p of this.missingFolders()) {
      const want = P_.placeFor(this.app, normalizePath(p));
      let cur = ""; for (const part of want.split("/")) { cur = cur ? `${cur}/${part}` : part; if (!this.app.vault.getAbstractFileByPath(cur)) { try { await this.app.vault.createFolder(cur); } catch (e) {} } }
      if (this.app.vault.getAbstractFileByPath(want)) made++;   // câte din cele propuse (cât spunea butonul), nu și folderele-părinte
    }
    return made;
  }
  // vault-urile Texere vechi: „02. Disertation” devine „02. Thesis”, prin Obsidian (linkurile urmează), o singură dată.
  // Structura de foldere propusă nu se mai creează singură: o creezi tu, cu un clic, din configurare sau din Settings → Texere.
  async foldersOnce() {
    if (!this.settings.thesisFolder) {
      const from = this.app.vault.getAbstractFileByPath("03. Workspace/02. Disertation"), to = "03. Workspace/02. Thesis";
      if (from && !this.app.vault.getAbstractFileByPath(to)) { try { await this.app.fileManager.renameFile(from, to); } catch (e) { console.warn("Texere: 02. Thesis", e); } }
      this.settings.thesisFolder = true; await this.save();
    }
  }

  // ——— panoul din tab-ul nou ———
  // ce trebuie reparat în vault sau în setări: [{ text, why, btn, fn }]
  async problems() {
    const T = (a, b) => this.T(a, b), out = [], P = this.app.plugins;
    // neconfigurat (vault nou, laptop nou): un singur lucru de făcut, configurarea; restul îl rezolvă ea
    if (this.needsConfig()) return [{ text: T("Texere nu e încă configurat aici.", "Texere isn't set up here yet."), why: T("Câțiva pași scurți: limba, unde ține Texere lucrurile, disciplina ta și ce lipsește din vault.", "A few short steps: language, where Texere keeps things, your discipline and what's missing in the vault."), btn: T("Configurează", "Set up"), fn: () => this.onboard(true) }];
    this.trackSeen();
    for (const d of DEPS) {
      const st = this.state(d.id); if (st === "on") continue;
      out.push({ text: st === "missing" ? T(`Lipsește ${d.name}.`, `${d.name} is missing.`) : T(`${d.name} e oprit.`, `${d.name} is off.`),
        why: st === "missing" ? T("Fără el, adnotările din PDF nu ajung în note. Îl instalez din lista oficială Obsidian, cu setările lui Texere.", "Without it, PDF annotations don't reach your notes. I'll install it from Obsidian's official list, with Texere's settings.") : T("Fără el, adnotările din PDF nu ajung în note.", "Without it, PDF annotations don't reach your notes."),
        btn: st === "missing" ? T("Instalează", "Install") : T("Pornește", "Turn on"), fn: () => this.doItem({ kind: "dep", d, st }) });
    }
    // PDF++ pornit, dar cu setările lui de început: fără paleta-etichete și auto-copy / auto-paste, adnotările nu ajung bine în note
    try { const PRE = require("./core/pdfpreset"); const pps = this.app.plugins.plugins["pdf-plus"]?.settings; if (this.state("pdf-plus") === "on" && pps && PRE.isFresh(pps))
      out.push({ text: T("PDF++ nu are încă setările lui Texere.", "PDF++ doesn't have Texere's settings yet."), why: T("Culorile ca etichete, auto-copy și auto-paste, formatele de copiere: ca adnotările să ajungă în nota de lectură.", "Colours as tags, auto-copy and auto-paste, the copy formats: so your annotations reach the reading note."),
        btn: T("Pune-le", "Apply"), fn: async () => { const ok = await PRE.apply(this.app); new Notice(ok ? T("PDF++ are acum setările lui Texere.", "PDF++ now has Texere's settings.") : T("Nu am putut pune setările.", "Couldn't apply the settings."), 5000); this.notify(); } }); } catch (e) {}
    // (un modul oprit nu e o problemă: l-ai oprit tu, din setări sau din configurare)
    // setări care arată încă spre nume vechi de foldere („02. Notes/…” când folderul e acum „2. Notes”)
    try {
      const st = tidy.stalePaths(this);
      if (st.length) { const ex = st[0]; out.push({ text: T("Unele setări ale lui Texere arată spre foldere care s-au redenumit.", "Some Texere settings point to folders that were renamed."), why: T(`„${ex.from}” e acum „${ex.to}”`, `“${ex.from}” is now “${ex.to}”`) + (st.length > 1 ? T(` (și încă ${st.length - 1}).`, ` (and ${st.length - 1} more).`) : "."), btn: T("Repară", "Fix"), fn: async () => { const n = await tidy.repairPaths(this); new Notice(T(`Am reparat ${n} căi.`, `Fixed ${n} paths.`), 4000); } }); }
    } catch (e) { console.warn("Texere: căile vechi", e); }
    for (const m of MAPS.filter(x => this.mapWanted(x))) { try { const s = await this.mapStatus(m); if (!s.have) out.push({ text: T(`Harta disciplinei (${m.ro}) nu e creată.`, `The discipline map (${m.en}) isn't created.`), why: T(`${s.total} note în ${s.folder}.`, `${s.total} notes in ${s.folder}.`), btn: T("Creează", "Create"), fn: () => this.createMap(m) }); } catch (e) {} }
    // folderele de care are nevoie Texere
    for (const x of this.fixedFolders()) if (!this.app.vault.getAbstractFileByPath(x.path)) {
      if (!this.seen(x.path)) { this.ensureEssentials(); continue; }   // n-a fost niciodată aici: îl facem acum, fără alarmă
      out.push({ text: x.breaks, why: T(`„${x.path}” nu mai e acolo (mutat sau redenumit în afara lui Obsidian?). `, `“${x.path}” isn't there anymore (moved or renamed outside Obsidian?). `) + x.why, btn: T("Pune-l la loc", "Put it back"), fn: () => this.putBack(x.path) });
    }
    for (const x of this.movableFolders()) if (!this.app.vault.getAbstractFileByPath(x.path) && this.seen(x.path)) {   // unul care n-a fost încă aici se creează la prima folosire
      let m = x.key === "export" ? this.mod("export")?.settings?.export?.folderMoved : this.mod("sources")?.settings?.sources?.folderMoved?.[x.key];
      if (!(m && m.from === x.path) && x.key !== "export") { try { m = this.mod("sources")?.sources?.movedFor?.(x.key, x.path) || m; } catch (e) {} }
      const to = m && m.from === x.path && this.app.vault.getAbstractFileByPath(m.to) ? m.to : null, guess = !!m?.guess;
      const L = x.label.charAt(0).toUpperCase() + x.label.slice(1), wait = T(`Până alegi, ${x.next} se oprește și te întreabă unde să ajungă.`, `Until you choose, ${x.next} will stop and ask where to go.`);
      out.push(to ? { text: x.breaks, why: (guess ? T(`${L}, „${x.path}”, nu mai e în vault; pare că l-ai redenumit în afara lui Obsidian în „${to}”. `, `${L}, “${x.path}”, isn't in the vault anymore; it looks like you renamed it outside Obsidian to “${to}”. `) : T(`Ai redenumit ${x.label}: „${x.path}” e acum „${to}”, dar Texere încă îl caută pe „${x.path}”. `, `You renamed ${x.label}: “${x.path}” is now “${to}”, but Texere still looks for “${x.path}”. `)) + wait, btn: T(`Folosește „${to}”`, `Use “${to}”`), fn: () => x.use(to) }
        : { text: x.breaks, why: T(`${L}, „${x.path}”, nu mai e în vault, iar Texere încă îl caută. `, `${L}, “${x.path}”, isn't in the vault anymore, but Texere still looks for it. `) + wait, btn: T("Alege…", "Choose…"), fn: () => x.choose() });
    }
    if (this.app.vault.getConfig?.("alwaysUpdateLinks") === false) out.push({ text: T("Linkurile nu se actualizează când redenumești o notă.", "Links don't update when you rename a note."), why: T("Texere redenumește note; fără asta, linkurile spre ele se rup.", "Texere renames notes; without this, links to them break."), btn: T("Repară", "Fix"), fn: () => this.app.vault.setConfig("alwaysUpdateLinks", true) });
    return out;
  }
  // sursele din Literature Notes și PDF-urile care așteaptă în Inbox
  counts() {
    const src = this.mod("sources")?.sources;
    const lit = (() => { try { return src?.litDir?.() || "01. References/Reading Notes/"; } catch (e) { return "01. References/Reading Notes/"; } })();
    const inbox = (() => { try { return (src?.inboxDir?.() || "01. References/PDFs/Inbox") + "/"; } catch (e) { return "01. References/PDFs/Inbox/"; } })();
    let sources = 0, pdfs = 0;
    for (const f of this.app.vault.getFiles()) {
      if (f.extension === "md" && f.path.startsWith(lit) && this.app.metadataCache.getFileCache(f)?.frontmatter?.id) sources++;
      else if (f.extension === "pdf" && f.path.startsWith(inbox)) pdfs++;
    }
    return { sources, pdfs };
  }
  // „acum 5 min”, „ieri”, „31 oct.”
  ago(t) {
    const T = (a, b) => this.T(a, b), sec = (Date.now() - t) / 1000;
    if (sec < 60) return T("acum", "just now");
    if (sec < 3600) { const m = Math.floor(sec / 60); return T(`acum ${m} min`, `${m} min ago`); }
    if (sec < 86400) { const h = Math.floor(sec / 3600); return T(`acum ${h} h`, `${h} h ago`); }
    const d = Math.floor(sec / 86400); if (d === 1) return T("ieri", "yesterday"); if (d < 7) return T(`acum ${d} zile`, `${d} days ago`);
    try { return new Date(t).toLocaleDateString(this.en ? "en-GB" : "ro-RO", { day: "numeric", month: "short" }); } catch (e) { return new Date(t).toISOString().slice(0, 10); }
  }
  cmd(id) { const c = this.app.commands; if (!c?.commands?.[id]) return false; c.executeCommandById(id); return true; }
  // pagina de pornire: dacă e deja deschisă într-un tab gol din zona notelor, mergi acolo; altfel un tab nou (panoul se desenează singur în el)
  openHome(page) {
    const W = this.app.workspace, side = [W.leftSplit, W.rightSplit];
    let leaf = (W.getLeavesOfType?.("empty") || []).find(l => !side.includes(l.getRoot?.()));
    if (!leaf) leaf = W.getLeaf("tab");
    leaf.__txPage = page || "home";
    try { W.setActiveLeaf(leaf, { focus: true }); } catch (e) { try { W.revealLeaf(leaf); } catch (e2) {} }
    try { this.home(leaf); } catch (e) { console.error("Texere: panoul", e); }
  }
  // o pagină a tab-ului (Acasă, Referințe, Export, Insights, Ajutor)
  goPage(leaf, page) { leaf.__txPage = page; this.renderHome(leaf); }
  // pune panoul în tab-urile goale (doar în zona notelor, nu în barele laterale); redraw: true = toate din nou, sau un singur tab
  home(redraw) {
    const W = this.app.workspace, side = [W.leftSplit, W.rightSplit];
    const leaves = redraw && redraw !== true ? [redraw] : (W.getLeavesOfType?.("empty") || []);
    for (const leaf of leaves) {
      const el = leaf?.view?.contentEl; if (!el || side.includes(leaf.getRoot?.())) continue;
      if (!redraw && el.querySelector(".texere-home")) continue;
      if (redraw === true && leaf.__txPage && leaf.__txPage !== "home") continue;   // nu redesenăm peste ce faci în altă pagină
      this.renderHome(leaf).catch(e => console.error("Texere: panoul", e));
    }
  }
  async renderHome(leaf) {
    const T = (a, b) => this.T(a, b), el = leaf.view.contentEl, tok = (leaf.__txh = (leaf.__txh || 0) + 1);
    const probs = await this.problems(); if (leaf.__txh !== tok || !leaf.view?.contentEl) return;   // un desen mai nou a pornit între timp
    const { sources, pdfs } = this.counts();
    const fw = (leaf.__txPage || "home") === "home" ? await this.firstWeek(sources) : null;
    let distilN = 0; try { const D = this.distil(); if (D?.count && (leaf.__txPage || "home") === "home") distilN = await D.count(); } catch (e) {}
    if (leaf.__txh !== tok || !leaf.view?.contentEl) return;
    el.addClass("texere-home-on"); el.querySelector(".texere-home")?.remove();
    const box = el.createDiv("texere-home"), page = leaf.__txPage || "home", area = box.createDiv("txh-page txh-page-" + (page === "home" ? "home" : "panel"));
    this.navBar(box, leaf, page);
    if (page !== "home") { this.renderPanel(page, area, leaf); return; }
    const inner = area.createDiv("txh-inner");
    const redraw = () => setTimeout(() => this.notify(), 400);
    // 1. bun venit: ce e Texere, într-o propoziție
    inner.createDiv({ cls: "txh-hi", text: T("Bun venit în Texere", "Welcome to Texere") });
    inner.createDiv({ cls: "txh-desc", text: T("Referințele, lectura și scrisul tău, într-un singur loc.\nAdaugi o referință, o adnotezi, scrii cu citări și exporți.", "Your references, reading and writing, in one place.\nAdd a reference, annotate it, write with citations, export.") });
    // 2. o versiune nouă a lui Texere (core/updater.js): se instalează doar când apeși „Actualizează”; ✕ o sare pe asta
    try {
      const U = this.updater, nv = U?.available, pv = U?.pending;
      if (nv || pv) {
        const r = inner.createDiv("txh-row txh-update");
        r.createSpan({ text: pv ? T(`Texere ${pv} e instalat. Pornește după reîncărcare.`, `Texere ${pv} is installed. It starts after a reload.`) : T(`Versiune nouă: Texere ${nv}`, `New version: Texere ${nv}`) });
        const acts = r.createDiv("txh-row-acts");
        if (pv) acts.createEl("button", { cls: "mod-cta", text: T("Reîncarcă", "Reload") }).addEventListener("click", () => U.reload());
        else {
          acts.createEl("button", { text: T("Ce e nou", "What's new") }).addEventListener("click", () => window.open(U.notesUrl));
          const up = acts.createEl("button", { cls: "mod-cta", text: T("Actualizează", "Update") });
          up.addEventListener("click", async () => { up.disabled = true; up.setText("…"); try { await U.update(); } finally { redraw(); } });
          const x = acts.createEl("button", { cls: "clickable-icon txh-x" }); x.setAttr?.("aria-label", T("Nu acum", "Not now")); try { setIcon(x, "x"); } catch (e) { x.setText("×"); }
          x.addEventListener("click", () => U.skipVersion(nv));
        }
      }
    } catch (e) { console.warn("Texere: actualizarea în pagina de pornire", e); }
    // 2b. ce aduce versiunea nouă (șabloane, note, câmpuri): propuneri, cu „Adaugă” și „Nu acum”
    try { await this.vaultUpdates?.home(inner, redraw); } catch (e) { console.warn("Texere: ce aduce versiunea nouă, în pagina de pornire", e); }
    if (leaf.__txh !== tok) return;
    // 3. ce trebuie reparat (doar dacă e ceva)
    if (probs.length) {
      const pb = inner.createDiv("txh-problems");
      for (const p of probs) {
        const r = pb.createDiv("txh-problem"), t = r.createDiv("txh-pt");
        t.createDiv({ cls: "txh-ptext", text: p.text }); if (p.why) t.createDiv({ cls: "txh-pwhy", text: p.why });
        if (p.btn) { const b = r.createEl("button", { text: p.btn }); b.addEventListener("click", async () => { b.disabled = true; b.setText("…"); try { await p.fn(); } catch (e) { new Notice(e?.message || String(e), 8000); } redraw(); }); }
      }
    }
    // 3a. prima săptămână: patru pași care se bifează singuri când îi faci; dispare când sunt gata (sau când o ascunzi)
    if (fw) this.firstWeekBox(inner, leaf, fw);
    // 3a'. evidențierile sub care n-ai scris încă nimic (Texere · Sources → Distilează)
    if (distilN) {
      inner.createDiv({ cls: "txh-label", text: T("Lectură", "Reading") });
      const r = inner.createDiv("txh-row");
      r.createSpan({ text: distilN === 1 ? T("1 adnotare încă fără cuvintele tale", "1 annotation still without your words") : T(`${distilN} adnotări încă fără cuvintele tale`, `${distilN} annotations still without your words`) });
      r.createEl("button", { text: T("Distilează", "Distil") }).addEventListener("click", () => this.goPage(leaf, "distil"));
    }
    // 3a''. surse care ar putea primi nume „Autor An – Titlu” (în locul ferestrei care apărea singură la pornire); ✕ o ascunde până apar altele
    try {
      const src = this.mod("sources")?.sources, n = (leaf.__txPage || "home") === "home" && src?.tidyPlan ? src.tidyPlan().length : 0;
      if (n && n > (this.settings.tidyHide || 0)) {
        inner.createDiv({ cls: "txh-label", text: T("Referințe", "References") });
        const r = inner.createDiv("txh-row");
        r.createSpan({ text: n === 1 ? T("O referință poate primi un nume „Autor An – Titlu”", "1 reference could get an “Author Year – Title” name") : T(`${n} referințe pot primi nume „Autor An – Titlu”`, `${n} references could get “Author Year – Title” names`) });
        const acts = r.createDiv("txh-row-acts");
        acts.createEl("button", { text: T("Redenumește", "Rename") }).addEventListener("click", () => src.tidy());
        const x = acts.createEl("button", { cls: "clickable-icon txh-x" }); x.setAttr?.("aria-label", T("Nu acum", "Not now")); try { setIcon(x, "x"); } catch (e) { x.setText("×"); }
        x.addEventListener("click", async () => { this.settings.tidyHide = n; await this.save(); this.renderHome(leaf); });
      }
    } catch (e) { console.warn("Texere: numele referințelor", e); }
    // 3b. Texere · Insights (dacă e pornit): cât ai scris azi, menționările fără link, ideea zilei
    try { const I = this.mod("insights"); if (I?.homeSection) I.homeSection(inner, leaf); } catch (e) { console.error("Texere: Insights în tab-ul nou", e); }
    // 4. ultimele 5 fișiere deschise, cu folderul și când le-ai deschis sau schimbat ultima dată
    let opened = {}; try { opened = this.app.loadLocalStorage("texere-opened") || {}; } catch (e) {}
    const recent = this.app.workspace.getLastOpenFiles().map(p => this.app.vault.getAbstractFileByPath(p)).filter(f => f instanceof TFile && !/^(csl|json)$/i.test(f.extension) && (opened[f.path] || (f.stat?.mtime || 0) - (f.stat?.ctime || 0) > 5000)).slice(0, 5);   // nu și ce a creat Texere (harta, șabloanele) fără să fi deschis   // nu și stilurile sau bibliografia (le creează Texere)
    if (recent.length) {
      inner.createDiv({ cls: "txh-label", text: T("Recente", "Recent") });
      const ul = inner.createDiv("txh-recent");
      for (const f of recent) {
        const a = ul.createEl("a", { cls: "txh-file", href: "#" });
        a.createSpan({ cls: "txh-fname", text: f.extension === "md" ? f.basename : f.name });
        const meta = a.createSpan("txh-fmeta"), op = opened[f.path] || 0, ed = f.stat?.mtime || 0, when = Math.max(op, ed);
        if (f.parent && f.parent.path !== "/") meta.createSpan({ cls: "txh-fdir", text: f.parent.path });
        if (when) { const w = meta.createSpan({ cls: "txh-ftime", text: this.ago(when) }); w.title = (op >= ed ? T("Deschis ", "Opened ") : T("Schimbat ", "Edited ")) + new Date(when).toLocaleString(this.en ? "en-GB" : "ro-RO"); }
        a.addEventListener("click", e => { e.preventDefault(); (e.metaKey || e.ctrlKey ? this.app.workspace.getLeaf("tab") : leaf).openFile(f); });
        a.addEventListener("auxclick", e => { if (e.button === 1) { e.preventDefault(); this.app.workspace.getLeaf("tab").openFile(f); } });
      }
    }
    // 5. doar dacă ai PDF-uri care așteaptă în Inbox (un clic: „PDF-uri fără sursă”); numărul surselor nu mai apare
    if (pdfs) { const ft = inner.createDiv("txh-foot"); const a = ft.createEl("a", { href: "#", text: pdfs === 1 ? T("1 PDF în Inbox", "1 PDF in Inbox") : T(`${pdfs} PDF-uri în Inbox`, `${pdfs} PDFs in Inbox`) }); a.addEventListener("click", e => { e.preventDefault(); this.mod("sources")?.sources?.uncataloged?.(); }); }
    // 6. „Susține Texere”: un link mic, doar dacă există un link de susținere (fără ferestre, fără amintiri)
    if (FUNDING_URL) { const ft = inner.createDiv("txh-foot txh-support"); const a = ft.createEl("a", { href: "#", text: T("Susține Texere", "Support Texere") }); a.addEventListener("click", e => { e.preventDefault(); window.open(FUNDING_URL); }); }
  }

  // Distilează (din Texere · Sources), dacă e pornit
  distil() { const P = this.mod("sources"); return P?.sources?.distil || P?.distil || null; }
  // ——— prima săptămână: adaugi o sursă, o evidențiezi, scrii o notă care o citează, exporți ———
  // fiecare pas se vede din ce e în vault (nu din clicuri); când toți sunt gata, nu mai apare niciodată
  async firstWeek(sources) {
    const st = this.settings.firstWeek; if (st === "done" || st === "hidden") return null;
    const V = this.app.vault, mc = this.app.metadataCache, P = this.app.plugins.plugins, md = V.getMarkdownFiles();
    const lit = (() => { try { return String(this.mod("sources")?.sources?.litDir?.() || "01. References/Reading Notes").replace(/\/+$/, "") + "/"; } catch (e) { return "01. References/Reading Notes/"; } })();
    const isLit = f => f.path.startsWith(lit) || !!(mc.getFileCache(f)?.frontmatter?.["citation-key"]);
    const steps = { source: sources > 0, highlight: false, cite: !!this.settings.fwCite, export: false };
    steps.highlight = md.some(f => (mc.getFileCache(f)?.links || []).some(l => /\.pdf#/i.test(l.link || "") && /annotation=/.test(l.link || "")));
    if (!steps.cite) {   // o notă a ta (nu de literatură, nu din Support sau șabloane) cu o citare [@…]
      const skip = /^(Support|Templates?|\.trash)\//i, mine = md.filter(f => !isLit(f) && !skip.test(f.path)).sort((a, b) => (b.stat?.mtime || 0) - (a.stat?.mtime || 0)).slice(0, 200);
      for (const f of mine) { let t = ""; try { t = await V.cachedRead(f); } catch (e) { continue; } if (/\[-?@[^\]\s]+[^\]]*\]/.test(t)) { steps.cite = true; this.settings.fwCite = true; await this.save(); break; } }
    }
    try {   // un fișier în folderul exporturilor
      const c = this.mod("export")?.exporter?.conf?.() || {}, dir = String(c.folder || "04. Export").replace(/[\\/]+$/, "");
      if (/^(\/|~|[A-Za-z]:)/.test(dir)) { const fs = node("fs"), d = dir.startsWith("~") ? node("os").homedir() + dir.slice(1) : dir; steps.export = fs.existsSync(d) && fs.readdirSync(d).some(n => !n.startsWith(".")); }
      else { const f = V.getAbstractFileByPath(dir); const any = x => (x.children || []).some(ch => ch.children ? any(ch) : !ch.name.startsWith(".")); steps.export = !!(f && any(f)); }
    } catch (e) {}
    if (Object.values(steps).every(Boolean)) { this.settings.firstWeek = "done"; await this.save(); return null; }
    return steps;
  }
  firstWeekBox(parent, leaf, steps) {
    const T = (a, b) => this.T(a, b), box = parent.createDiv("txh-fw"), n = Object.values(steps).filter(Boolean).length;
    const head = box.createDiv("txh-label txh-fw-h"); head.createSpan({ text: T(`Prima săptămână · ${n} din 4`, `Your first week · ${n} of 4`) });
    const hide = head.createEl("a", { text: T("Ascunde", "Hide"), href: "#" }); hide.addEventListener("click", async e => { e.preventDefault(); this.settings.firstWeek = "hidden"; await this.save(); this.renderHome(leaf); });
    const go = page => this.goPage(leaf, page);
    const list = [
      ["source", T("Adaugă o referință", "Add a reference"), T("Caut-o după titlu, DOI sau ISBN, ori adu-o din Zotero.", "Search by title, DOI or ISBN, or bring it in from Zotero."), () => go("sources")],
      ["highlight", T("Adnoteaz-o", "Annotate it"), T("Deschide PDF-ul referinței și marchează un pasaj; adnotările intră singure în nota ei.", "Open the reference's PDF and mark a passage; the annotations go into its note by themselves."), () => this.openLatestPdf(leaf) || go("sources")],
      ["cite", T("Scrie o notă care o citează", "Write a note that cites it"), T("Într-o notă nouă, scrie @ și alege referința.", "In a new note, type @ and pick the reference."), () => this.newNote(leaf)],
      ["export", T("Exportă nota", "Export the note"), T("În Word sau PDF, cu citările și bibliografia în stilul ales.", "To Word or PDF, with citations and bibliography in your style."), () => go("export")],
    ];
    const next = list.find(([k]) => !steps[k])?.[0], ul = box.createDiv("txh-fw-list");
    list.forEach(([k, title, hint, fn], i) => {
      const done = steps[k], row = ul.createEl(done ? "div" : "a", { cls: "txh-fw-i" + (done ? " done" : k === next ? " next" : "") }); if (!done) row.href = "#";
      const c = row.createSpan("txh-fw-c"); if (done) { try { setIcon(c, "check"); } catch (e) { c.setText("✓"); } } else c.setText(String(i + 1));
      const t = row.createSpan("txh-fw-t"); t.createSpan({ cls: "txh-fw-n", text: title }); if (k === next) t.createSpan({ cls: "txh-fw-d", text: hint });
      if (!done) row.addEventListener("click", e => { e.preventDefault(); fn(); });
    });
  }
  // PDF-ul celei mai recente surse (pentru „Evidențiază-o”); false dacă nu e niciunul
  openLatestPdf(leaf) {
    const mc = this.app.metadataCache, rl = mc.resolvedLinks || {};
    const notes = this.app.vault.getMarkdownFiles().filter(f => mc.getFileCache(f)?.frontmatter?.id && Object.keys(rl[f.path] || {}).some(p => /\.pdf$/i.test(p))).sort((a, b) => (b.stat?.mtime || 0) - (a.stat?.mtime || 0));
    const p = notes.length && Object.keys(rl[notes[0].path]).find(x => /\.pdf$/i.test(x)), f = p && this.app.vault.getAbstractFileByPath(p);
    if (!(f instanceof TFile)) return false; leaf.__txPage = "home"; leaf.openFile(f); return true;
  }

  // ——— bara de jos din tab-ul nou: Acasă · Surse · Export · Insights · Ajutor, și (+) pentru o notă nouă ———
  // fiecare pagină e ecranul pluginului desenat aici (aceeași clasă ca fereastra lui); dacă pluginul lipsește: ce face și cum îl instalezi
  navBar(box, leaf, page) {
    const T = (a, b) => this.T(a, b), wrap = box.createDiv("txh-navwrap"), nav = wrap.createDiv("txh-nav");
    for (const [id, icon, label] of [["home", "home", T("Acasă", "Home")], ["sources", "library", T("Referințe", "References")], ["export", "file-output", T("Export", "Export")], ["insights", "lightbulb", "Insights"]]) {
      const b = nav.createEl("button", { cls: "txh-nb" + (page === id ? " on" : "") });   // numele se vede pe buton: fără balon la hover
      const ic = b.createSpan("txh-ic"); try { setIcon(ic, icon); } catch (e) {} const nl = b.createSpan({ cls: "txh-nl", text: label }); if (id === "insights") { b.addClass("is-beta"); beta(nl); }
      b.addEventListener("click", () => { if (leaf.__txPage === id && id !== "home") return; this.goPage(leaf, id); });
    }
    // un singur balon, deasupra butonului (nu peste el)
    const tip = (b, text) => { b.setAttr?.("aria-label", text); b.setAttr?.("data-tooltip-position", "top"); };
    const add = wrap.createEl("button", { cls: "txh-new" }); tip(add, T("Nou", "New"));
    try { setIcon(add, "plus"); } catch (e) { add.setText("+"); }
    add.addEventListener("click", ev => this.newMenu(leaf, ev));
    // Ajutorul nu e un loc de lucru: un buton rotund lângă (+), nu în bară; când ești în Ajutor, el e cel selectat
    const help = wrap.createEl("button", { cls: "txh-new txh-helpbtn" + (page === "help" ? " on" : "") }); tip(help, T("Ajutor", "Help"));
    try { setIcon(help, "circle-help"); } catch (e) { help.setText("?"); }
    help.addEventListener("click", () => { if (leaf.__txPage === "help") return; this.goPage(leaf, "help"); });
  }
  // (+): o notă nouă, o sursă, documente de pe calculator (doar ce e pornit) · deasupra butonului, în limbajul meniului Texere din modul Editare
  newMenu(leaf, ev) {
    const T = (a, b) => this.T(a, b), src = this.mod("sources")?.sources, X = this.mod("export"), btn = ev?.currentTarget || ev?.target?.closest?.(".txh-new");
    const items = [
      { label: T("Notă nouă", "New note"), onClick: () => this.newNote(leaf) },
      src?.open && { label: T("Adaugă o referință", "Add a reference"), onClick: () => src.open() },
      typeof X?.importFiles === "function" && { label: T("Importă documente…", "Import documents…"), onClick: () => X.importFiles() },
      typeof X?.importFolder === "function" && { label: T("Importă un folder…", "Import a folder…"), onClick: () => X.importFolder() },
    ];
    if (!btn) { this.newNote(leaf); return; }
    if (btn.ownerDocument.querySelector(".tx-menu")) { btn.ownerDocument.querySelectorAll(".tx-menu").forEach(m => m._close?.()); return; }   // al doilea clic pe (+) îl închide
    popMenu(btn, { items, width: 260 });
  }
  // o notă nouă, în tab-ul acesta, în folderul ales în Obsidian pentru notele noi; titlul e selectat, ca să-l scrii direct
  async newNote(leaf) {
    const T = (a, b) => this.T(a, b);
    try {
      const fm = this.app.fileManager, parent = fm.getNewFileParent?.(this.app.workspace.getActiveFile()?.path || "") || this.app.vault.getRoot();
      const f = await fm.createNewMarkdownFile(parent, T("Fără titlu", "Untitled"));
      leaf.__txPage = "home"; await leaf.openFile(f, { active: true, eState: { rename: "all" } });
    } catch (e) { new Notice(T("N-am putut crea nota: ", "Couldn't create the note: ") + (e?.message || e), 8000); }
  }
  renderPanel(page, area, leaf) {
    const P = this.app.plugins.plugins, back = () => { leaf.__txPage = "home"; this.renderHome(leaf); };
    try {
      if (page === "sources" && this.mod("sources")?.sources?.panel) return this.mod("sources").sources.panel(area, back);
      if (page === "export" && this.mod("export")?.exporter?.panel) return this.mod("export").exporter.panel(area, back);
      if (page === "distil") { const D = this.distil(); if (D?.panel) return D.panel(area, back); return back(); }
      if (page === "insights" && this.mod("insights")?.panel) return this.mod("insights").panel(area, back);
      if (page === "help" && this.help?.panel) { const m = this.help.panel(area, back); area.querySelector(".tx-embedded")?.addClass("txh-help"); return m; }
    } catch (e) { console.error("Texere: pagina", page, e); }
    this.installPage(page, area, leaf);
  }
  // un modul oprit: ce face, și un buton care îl pornește
  installPage(page, area, leaf) {
    const T = (a, b) => this.T(a, b), info = { sources: { id: "texere-sources", icon: "library" }, export: { id: "texere-export", icon: "file-output" }, insights: { id: "texere-insights", icon: "lightbulb" } }[page];
    const p = info && TEXERE.find(x => x.id === info.id); if (!p) return;
    const card = area.createDiv("txh-inst"), ic = card.createDiv("txh-inst-ic"); try { setIcon(ic, info.icon); } catch (e) {}
    card.createDiv({ cls: "txh-inst-t", text: T(p.nameRo || p.name, p.name) });
    card.createDiv({ cls: "txh-inst-d", text: T(p.ro, p.en) });
    const b = card.createEl("button", { cls: "mod-cta", text: T("Pornește", "Turn on") });
    // pornit: aceeași pagină, acum cu modulul (redesenarea obișnuită nu atinge tab-urile aflate pe altă pagină decât Acasă)
    b.addEventListener("click", async () => {
      b.disabled = true; b.setText("…");
      try { await this.enable(info.id); } catch (e) { new Notice(e?.message || String(e), 8000); }
      if (!this.mod(page)) { b.disabled = false; b.setText(T("Pornește", "Turn on")); new Notice(T("Modulul nu a pornit; vezi consola (Ctrl/Cmd + Alt + I).", "The module didn't start; see the console (Ctrl/Cmd + Alt + I)."), 8000); return; }
      if (leaf) this.renderHome(leaf).catch(e => console.error("Texere: panoul", e)); this.notify();
    });
  }
  // modulele, pentru configurare: cheia, numele și ce face, într-un rând
  moduleInfo() { return TEXERE.map(p => ({ key: MOD_KEY[p.id], name: this.T(p.nameRo || p.name, p.name), ro: p.ro, en: p.en })); }

  // ——— notele care vin cu pluginul: ghidul, ghidurile de început, șabloanele ———
  // ce e deja în vault (ghidul se recunoaște și după redenumire; restul, după cale sau după nume, oriunde ar fi)
  noteStatus() {
    const V = this.app.vault, files = V.getMarkdownFiles?.() || [];
    return NOTES.map(n => {
      const name = n.path.split("/").pop();
      const file = V.getAbstractFileByPath(n.path) || files.find(f => f.name === name) || null;
      return { ...n, file };
    });
  }
  async writeNote(n, text) {
    // șabloanele merg în folderul ales la configurare (Unde ține Texere lucrurile), dacă ai ales altul
    const tdir = String(this.settings.dirs?.templates || "").replace(/\/+$/, ""), rel = tdir && n.path.startsWith("Support/Templates/") ? `${tdir}/${n.path.slice("Support/Templates/".length)}` : n.path;
    const V = this.app.vault, path = normalizePath(rel), dir = path.slice(0, path.lastIndexOf("/")); let cur = "";
    for (const part of dir ? dir.split("/") : []) { cur = cur ? `${cur}/${part}` : part; if (!V.getAbstractFileByPath(cur)) { try { await V.createFolder(cur); } catch (e) {} } }
    return V.create(path, text);
  }
  // adaugă doar notele care lipsesc; nu atinge ce ai deja
  async addNotes() {
    let made = 0;
    for (const n of this.noteStatus()) { if (n.file) continue; try { await this.writeNote(n, n.text()); made++; } catch (e) { console.error("Texere: nota", n.path, e); } }
    if (made) this.notify();
    return made;
  }
  // doar când ceri: înlocuiește notele existente cu versiunea din Texere; din fiecare păstrează o copie lângă ea
  async updateNotes() {
    const V = this.app.vault; let n = 0;
    for (const x of this.noteStatus()) {
      if (!x.file) continue;
      try {
        const old = await V.read(x.file), text = x.text(); if (old === text) continue;
        const dir = x.file.parent?.path && x.file.parent.path !== "/" ? x.file.parent.path + "/" : "", base = `${dir}${x.file.basename} (${this.T("înainte de actualizare", "before update")})`;
        let p = `${base}.md`, i = 2; while (V.getAbstractFileByPath(p)) p = `${base} ${i++}.md`;
        await V.create(p, old); await V.process(x.file, () => text); n++;
      } catch (e) { console.error("Texere: actualizarea notei", x.path, e); }
    }
    return n;
  }
  // pentru Ajutor: ghidul (ro / en) sau o notă din pachet, creată dacă lipsește; null dacă nu e în pachet
  async ensureNote(pathOrName) {
    const key = String(pathOrName || "").replace(/\.md$/, ""), n = this.noteStatus().find(x => x.path.replace(/\.md$/, "") === key || x.path.split("/").pop().replace(/\.md$/, "") === key);
    if (!n) return null; if (n.file) return n.file; try { return await this.writeNote(n, n.text()); } catch (e) { return null; }
  }

  // configurarea pas cu pas (o singură fereastră deschisă odată)
  async onboard(force, step) {
    if (!force && this.settings.onboarded) return;
    if (this._wiz) { try { this._wiz.render(); } catch (e) {} return; }
    await this.toMainWindow();
    new WizardModal(this, { step }).open();
  }
  // Obsidian 1.15 deschide Setările într-o fereastră separată (după „Trust author” chiar singur): o fereastră a lui Texere
  // deschisă atunci ar apărea acolo și s-ar închide odată cu Setările. Închide Setările și așteaptă fereastra principală.
  async toMainWindow() {
    try { if (typeof activeDocument === "undefined" || activeDocument === document) return; } catch (e) { return; }
    try { this.app.setting?.close?.(); } catch (e) {}
    for (let i = 0; i < 20 && activeDocument !== document; i++) await sleep(50);
    try { window.focus(); } catch (e) {}
  }
};

// ——— Settings → Texere: o singură filă, cu secțiuni (Texere · Sources · Export · Insights · Despre) ———
class TexereSettingTab extends PluginSettingTab {
  constructor(P) { super(P.app, P); this.P = P; this.id = P.manifest.id; this.name = "Texere"; this.section = "texere"; this.cur = null; }
  showSection(k) { try { this.cur?.hide?.(); } catch (e) {} this.section = k; this.display(); this.containerEl.scrollTop = 0; }
  hide() { try { this.cur?.hide?.(); } catch (e) {} }
  display() {
    const P = this.P, T = (a, b) => P.T(a, b), root = this.containerEl, keep = root.scrollTop; root.empty(); root.addClass("texere-settings");
    const secs = [["texere", T("General", "General")], ...MODULES.filter(m => P.mod(m.key)?.settingTabs?.length).map(m => [m.key, T(m.ro || m.label, m.label)]), ["about", T("Despre", "About")]];
    if (!secs.some(([k]) => k === this.section)) this.section = "texere";
    const nav = root.createDiv("tx-secnav");
    for (const [k, l] of secs) { const b = nav.createSpan({ cls: "tx-secbtn" + (k === this.section ? " on" : ""), text: l }); if (k === "insights") beta(b); b.addEventListener("click", () => { if (k !== this.section) this.showSection(k); }); }
    const sec = root.createDiv("tx-setsec"); this.cur = null;
    if (this.section === "about") this.displayAbout(sec);
    else if (this.section !== "texere") { const tab = P.mod(this.section)?.settingTabs?.[0]; if (tab) { tab.containerEl = sec; this.cur = tab; try { tab.display(); } catch (e) { console.error("Texere: setările", this.section, e); } } }
    else this.displayCore(sec);
    root.scrollTop = keep;
  }
  displayAbout(el) {
    const P = this.P, T = (a, b) => P.T(a, b); el.addClass("texere-core-settings");
    const head = el.createDiv("ts-head"); head.createSpan({ cls: "ts-head-t", text: T("Despre Texere", "About Texere") });
    const body = el.createDiv("ts-body");
    body.createEl("p", { cls: "ts-intro", text: T("Un vault de cercetare pentru Obsidian. Gratuit și deschis.", "A research vault for Obsidian. Free and open.") });
    const open = (name, desc, fn) => new Setting(body).setName(name).setDesc(desc).addButton(b => b.setButtonText(T("Deschide", "Open")).onClick(fn));
    new Setting(body).setName(T("Versiunea", "Version")).setDesc(String(P.manifest.version || ""));
    // ghidul și întrebările: în Ajutor (nu în vault)
    open(T("Ghidul", "The guide"), T("Tot ce face Texere, pas cu pas, în Ajutor.", "Everything Texere does, step by step, in Help."), () => { this.app.setting.close?.(); P.help?.ask?.(null, { contents: true }); });
    if (P.settings.lastSetup?.md) open(T("Ultima configurare", "Your last setup"), String(P.settings.lastSetup.at || "").slice(0, 10) + " · " + T("ce s-a făcut și ce mai e de făcut.", "what was done and what's left."), () => { this.app.setting.close?.(); P.help?.ask?.(null, { page: "setup" }); });
    // autorul: site-ul și e-mailul (același rând cu „Creat de” din Ajutor)
    new Setting(body).setName(T("Autor", "Made by")).setDesc("George Mihai · georgemihai.com")
      .addButton(b => b.setButtonText(T("Site", "Website")).onClick(() => window.open("https://www.georgemihai.com/?utm_source=texere&utm_medium=settings&utm_campaign=texere")));
    open("GitHub", T("Codul și noutățile.", "The code and what's new."), () => window.open(REPO_URL));
    // o problemă sau o idee: un e-mail gata început (versiunea și sistemul, ca să nu le cauți), nu GitHub
    {
      const sys = `Texere ${P.manifest.version || ""} · Obsidian ${(typeof require === "function" && (() => { try { return require("obsidian").apiVersion; } catch (e) { return ""; } })()) || ""} · ${process?.platform === "darwin" ? "macOS" : process?.platform === "win32" ? "Windows" : process?.platform || ""}`;
      const subj = T("Texere: o problemă sau o idee", "Texere: a problem or an idea"), msg = T("Ce s-a întâmplat (sau ce ți-ar trebui):\n\n\nCe te așteptai să se întâmple:\n\n\n", "What happened (or what you'd need):\n\n\nWhat you expected:\n\n\n") + "—\n" + sys;
      new Setting(body).setName(T("Semnalează o problemă", "Report a problem")).setDesc(T("Spune-mi ce nu merge sau ce ți-ar trebui.", "Tell me what doesn't work or what you'd need."))
        .addButton(b => b.setButtonText(T("Scrie-mi", "Write to me")).onClick(() => window.open(`mailto:hi@georgemihai.com?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(msg)}`)));
    }
    if (FUNDING_URL) new Setting(body).setName(T("Susține Texere", "Support Texere")).setDesc(T("Texere e gratuit și îl face o singură persoană.", "Texere is free and made by one person.")).addButton(b => b.setButtonText(T("Susține", "Support")).onClick(() => window.open(FUNDING_URL)));
    // atribuirea cerută de licențele bibliotecilor incluse (lista întreagă, în „Licențe”)
    body.createEl("p", { cls: "ts-intro", text: T("Include citeproc-js, docx, markdown-it, Paged.js și stilurile CSL, fiecare sub licența lui. Modul Editare pornește de la Wordplay de Rob Hardy (MIT), după Write_On al lui Jason Fried.", "Includes citeproc-js, docx, markdown-it, Paged.js and the CSL styles, each under its own license. Edit mode is based on Wordplay by Rob Hardy (MIT), after Jason Fried's Write_On.") });
    const lic = advanced(body, T("Licențe", "Licenses"), "about-licenses");
    const ul = lic.createEl("ul", { cls: "tx-credits" });
    for (const [name, who, l, url] of CREDITS) { const li = ul.createEl("li"); const a = li.createEl("a", { text: name, href: url }); a.addEventListener("click", e => { e.preventDefault(); window.open(url); }); li.appendText(` · ${who} · ${l}`); }
    lic.createEl("p", { cls: "ts-intro", text: T("Texere e sub licența MIT. citeproc-js e inclus neschimbat, sub licențele lui (CPAL 1.0 / AGPL 3.0); codul lui referință e la adresa de mai sus.", "Texere is MIT-licensed. citeproc-js is included unchanged, under its own licenses (CPAL 1.0 / AGPL 3.0); its source code is at the address above.") });
  }
  displayCore(el) {
    const P = this.P, T = (a, b) => P.T(a, b); el.addClass("texere-core-settings"); el.addClass("texere-settings");
    const head = el.createDiv("ts-head"); head.createSpan({ cls: "ts-head-t", text: T("General", "General") });
    const body = el.createDiv("ts-body");
    const busy = async (b, fn) => { const old = b.buttonEl.textContent; b.setDisabled(true); b.setButtonText("…"); try { await fn(); } catch (e) { new Notice(e?.message || String(e), 8000); } finally { b.setButtonText(old); b.setDisabled(false); this.display(); P.notify(); } };

    // 0. ce trebuie reparat (aceeași listă ca în tab-ul nou); când totul e bine, nu apare
    const fixes = body.createDiv("tx-fixes");
    P.problems().then(probs => {
      if (!probs.length || !fixes.isConnected) return;
      fixes.createDiv({ cls: "tx-fixes-t", text: probs.length === 1 ? T("Un lucru de reparat", "One thing to fix") : T(`${probs.length} lucruri de reparat`, `${probs.length} things to fix`) });
      for (const p of probs) {
        const r = fixes.createDiv("txh-problem"), t = r.createDiv("txh-pt"); t.createDiv({ cls: "txh-ptext", text: p.text }); if (p.why) t.createDiv({ cls: "txh-pwhy", text: p.why });
        if (p.btn) { const b = r.createEl("button", { text: p.btn }); b.addEventListener("click", async () => { b.disabled = true; b.setText("…"); try { await p.fn(); } catch (e) { new Notice(e?.message || String(e), 8000); } setTimeout(() => P.notify(), 400); }); }
      }
    }).catch(() => {});

    // 1. modulele: pornit / oprit (setările fiecăruia sunt în fila lui, sus)
    new Setting(body).setName(T("Modulele", "Modules")).setHeading();
    for (const p of TEXERE) {
      const ms = new Setting(body).setName(T(p.nameRo || p.name, p.name)).setDesc(P.en ? p.en : p.ro); if (p.id === "texere-insights") beta(ms.nameEl, T("Insights e încă în lucru: unele măsurători și sugestii se pot schimba.", "Insights is still in the works: some counts and suggestions may change."));
      ms.addToggle(t => t.setValue(P.state(p.id) === "on").onChange(async v => { try { if (v) await P.enable(p.id); else await P.disable(p.id); } catch (e) { new Notice(e?.message || String(e)); } this.display(); }));
    }
    // 2. limba și configurarea
    new Setting(body).setName(T("Limba și configurarea", "Language and setup")).setHeading();
    new Setting(body).setName(T("Limba", "Language")).setDesc(T("Unele texte se schimbă după repornire.", "Some labels change after a restart."))
      .addDropdown(d => d.addOption("ro", "Română").addOption("en", "English").setValue(P.en ? "en" : "ro").onChange(v => { this.app.saveLocalStorage(LANG, v); this.display(); }));
    new Setting(body).setName(T("Configurarea", "Setup")).setDesc(T("Câțiva pași scurți; vede ce e deja făcut.", "A few short steps; it sees what's already done."))
      .addButton(b => b.setButtonText(T("Rulează configurarea din nou", "Run the setup again")).onClick(() => { this.app.setting.close?.(); P.onboard(true); }));
    // 2b. actualizările: Texere doar caută (dacă vrei); instalarea e la clicul tău; înapoi la versiunea dinainte
    {
      const U = P.updater, c = (P.settings.updates = P.settings.updates || {});
      new Setting(body).setName(T("Actualizări", "Updates")).setHeading();
      new Setting(body).setName(T("Caută actualizări", "Check for updates"))
        .setDesc(T(`O dată pe zi, Texere întreabă GitHub (${REPO_URL.replace("https://", "")}) dacă e o versiune nouă și ți-o arată în pagina de pornire. Se instalează doar când apeși „Actualizează”. Nu trimite nimic despre tine.`, `Once a day, Texere asks GitHub (${REPO_URL.replace("https://", "")}) for a new version and shows it on the home page. It installs only when you press “Update”. Nothing about you is sent.`))
        .addToggle(t => t.setValue(c.check !== false).onChange(async v => { c.check = v; await P.save(); }));
      const when = c.checkedAt && U ? U.ago(c.checkedAt) : T("niciodată", "never"), nv = U?.available, pv = U?.pending;
      const vs = new Setting(body).setName(T("Versiunea ta", "Your version") + ": " + P.manifest.version)
        .setDesc(T(`Verificat ${when}`, `Checked ${when}`) + (nv ? T(` · ${nv} e disponibil`, ` · ${nv} is available`) : pv ? T(` · ${pv} e instalat, pornește după reîncărcare`, ` · ${pv} is installed, starts after a reload`) : ""));
      if (nv) vs.addButton(b => b.setButtonText(T(`Actualizează la ${nv}`, `Update to ${nv}`)).setCta().onClick(() => busy(b, () => U.update())));
      else if (pv) vs.addButton(b => b.setButtonText(T("Reîncarcă", "Reload")).setCta().onClick(() => U.reload()));
      else vs.addButton(b => b.setButtonText(T("Caută acum", "Check now")).onClick(() => busy(b, () => U?.check(true))));
      vs
        .addButton(b => b.setButtonText(T("Ce e nou", "What's new")).onClick(() => { this.app.setting.close?.(); P.help?.ask?.(null, { chapter: "7" }); }));
      U?.previous().then(v => {
        if (!v || v === P.manifest.version || !body.isConnected) return;
        const s = new Setting(body).setName(T(`Revino la ${v}`, `Go back to ${v}`)).setDesc(T("Dacă versiunea nouă îți face probleme. Pune la loc versiunea dinainte de ultima actualizare.", "If the new version gives you trouble. Puts back the version you had before the last update."))
          .addButton(b => b.setButtonText(T(`Revino la ${v}`, `Go back to ${v}`)).onClick(() => busy(b, () => U.rollback())));
        const after = body.querySelector(".tx-upd-anchor"); if (after) body.insertBefore(s.settingEl, after);
      }).catch(() => {});
      body.createDiv("tx-upd-anchor");
      // ce au adus versiunile noi și n-ai adăugat încă (șabloane, note, câmpuri): le adaugi de aici, oricând
      if (P.vaultUpdates) { const box = body.createDiv("tx-vu-settings"); P.vaultUpdates.settingsRows(box, Setting, () => this.display()).catch(e => console.warn("Texere: Din actualizări", e)); }
    }
    const ovDir = (() => { try { return P.edit?.O?.folder?.() || "Support/Texere/Cuts"; } catch (e) { return "Support/Texere/Cuts"; } })();

    // 3. Foldere: toate folderele lui Texere, într-un loc (dacă le muți din Obsidian, Texere le urmează)
    new Setting(body).setName(T("Foldere", "Folders")).setDesc(T("Unde ține Texere fiecare fel de fișier. Le schimbi aici sau le muți din Obsidian: Texere le urmează.", "Where Texere keeps each kind of file. Change them here, or move them in Obsidian: Texere follows.")).setHeading();
    {
      const plan = tidy.tidyPlan(P), s = new Setting(body).setName(T("Fișierele lui Texere", "Texere's own files"));
      s.setDesc(plan.length ? T(`Ghidurile și bibliografia în ${tidy.HOME}, harta disciplinei lângă notele tale (${plan.length} de mutat).`, `The guides and the bibliography in ${tidy.HOME}, the discipline map next to your notes (${plan.length} to move).`) : T(`Totul e la locul lui: ${tidy.HOME}.`, `Everything is in place: ${tidy.HOME}.`));
      if (plan.length) s.addButton(b => b.setButtonText(T("Vezi ce se mută…", "See what moves…")).setCta().onClick(() => new tidy.TidyModal(P, plan, () => this.display()).open()));
    }
    {
      const miss = P.missingFolders(), s = new Setting(body).setName(T("Folderele principale", "Main folders")).setDesc(T("Cele propuse de Texere: ", "The ones Texere suggests: ") + P.folderNames());
      if (miss.length) s.addButton(b => b.setButtonText(T(`Creează ce lipsește (${miss.length})`, `Create what's missing (${miss.length})`)).onClick(() => busy(b, async () => { const n = await P.createFolders(); new Notice(T(`Am creat ${n} foldere.`, `Created ${n} folders.`), 5000); })));
    }
    // folderele modulelor (sursele, bibliografia, exportul, importul, notele-concept, recenziile): desenate de fiecare modul, aici
    for (const k of ["sources", "export", "insights"]) {
      const tab = P.mod(k)?.settingTabs?.[0]; if (typeof tab?.folderRows !== "function") continue;
      try { tab.folderRows(body, () => this.display(), sec => this.showSection(sec)); } catch (e) { console.error("Texere: folderele", k, e); }
    }
    const cS = new Setting(body).setName(T("Tăieturi", "Cuts")).setDesc(T("Ce tai din text în modul Editare; fiecare notă are Tăieturile ei.", "What you cut in edit mode; each note has its own Cuts."));
    cS.descEl.createDiv({ cls: "tx-mt6 ts-cur", text: ovDir });
    cS.addButton(b => b.setButtonText(T("Schimbă…", "Change…")).setDisabled(!this.app.vault.getAbstractFileByPath(ovDir)).onClick(() => P.moveFolder(ovDir, () => this.display())));
    for (const m of MAPS) {
      const s = new Setting(body).setName(T(`Harta disciplinei: ${m.ro}`, `Discipline map: ${m.en}`)).setDesc("…");
      P.mapStatus(m).then(st => {
        s.setDesc(T("O notă pentru fiecare ramură, concept, autor…", "A note for each branch, concept, author…")); s.descEl.createDiv({ cls: "tx-mt6 ts-cur", text: T(`${st.folder} (${st.have} din ${st.total} note)`, `${st.folder} (${st.have} of ${st.total} notes)`) });
        if (st.have && this.app.vault.getAbstractFileByPath(st.folder)) s.addButton(b => b.setButtonText(T("Schimbă…", "Change…")).onClick(() => P.moveFolder(st.folder, () => this.display())));
        if (st.have < st.total) s.addButton(b => b.setButtonText(st.have ? T(`Adaugă ce lipsește (${st.total - st.have})`, `Add what's missing (${st.total - st.have})`) : T("Creează harta", "Create the map")).onClick(() => busy(b, async () => { const n = await P.createMap(m); new Notice(T(`Am creat ${n} note.`, `Created ${n} notes.`), 5000); })));
      }).catch(e => s.setDesc(T("Nu pot citi harta: ", "Couldn't read the map: ") + e.message));
    }
    // 4. Avansat: PDF++, șabloanele și ghidurile de scris, AI
    const adv = advanced(body, T("Avansat", "Advanced"), "texere");
    for (const d of DEPS) {
      const st = P.state(d.id), s = new Setting(adv).setName(d.name).setDesc(st === "on" ? T("Pornit. Referințe îl folosește pentru adnotările din PDF.", "On. References uses it for PDF annotations.") : T("Îl folosește Referințe pentru adnotările din PDF. Îl instalezi din pagina lui din Obsidian.", "References uses it for PDF annotations. Install it from its page in Obsidian."));
      if (st === "missing") s.addButton(b => b.setButtonText(T("Deschide pagina lui", "Open its page")).onClick(() => P.openPluginPage(d.id)));
      else if (st === "off") s.addButton(b => b.setButtonText(T("Pornește", "Turn on")).onClick(() => busy(b, () => P.enable(d.id))));
    }
    {
      const ns = P.noteStatus(), miss = ns.filter(n => !n.file).length, have = ns.length - miss;
      const s = new Setting(adv).setName(T("Șabloanele și ghidurile de scris", "Templates and writing guides")).setDesc(T(`${ns.length} note care vin cu Texere.`, `${ns.length} notes that come with Texere.`));
      if (miss) s.addButton(b => b.setButtonText(T(`Adaugă ce lipsește (${miss})`, `Add what's missing (${miss})`)).onClick(() => busy(b, async () => { const n = await P.addNotes(); new Notice(T(`Am adăugat ${n} note.`, `Added ${n} notes.`), 5000); })));
      if (have) s.addButton(b => b.setButtonText(T("Înlocuiește cu versiunea din Texere…", "Replace with Texere's version…")).onClick(() => this.confirmReplace(have)));
    }
    // sugestiile AI (opțional): deocamdată doar locul pentru cheie; Texere nu trimite nimic nicăieri
    {
      const ai = P.settings.ai || (P.settings.ai = { key: "", model: "" }), save = () => P.save();
      new Setting(adv).setName(T("Sugestii AI (opțional, încă nefolosite)", "AI suggestions (optional, not used yet)")).setDesc(T("Texere nu le folosește încă și nu trimite nimic nicăieri. Cheia se păstrează în setările lui Texere (data.json) de pe acest laptop.", "Texere doesn't use them yet and sends nothing anywhere. The key is kept in Texere's settings (data.json) on this laptop.")).setHeading?.();
      new Setting(adv).setName(T("Cheia OpenRouter", "OpenRouter key")).setDesc(T("Începe cu sk-or-. Gol = fără AI.", "Starts with sk-or-. Empty = no AI."))
        .addText(t => { t.setPlaceholder("sk-or-…").setValue(ai.key || "").onChange(v => { ai.key = v.trim(); save(); }); if (t.inputEl) { t.inputEl.type = "password"; t.inputEl.autocomplete = "off"; } });
      new Setting(adv).setName(T("Modelul", "Model")).setDesc(T("De exemplu anthropic/claude-sonnet-5.5.", "For example anthropic/claude-sonnet-5.5."))
        .addText(t => t.setPlaceholder("anthropic/claude-sonnet-5.5").setValue(ai.model || "").onChange(v => { ai.model = v.trim(); save(); }));
    }
  }
  // înlocuiește șabloanele și ghidurile de scris existente cu versiunea din Texere; din fiecare păstrează o copie lângă ea
  confirmReplace(n) {
    const P = this.P, T = (a, b) => P.T(a, b), c = new Modal(this.app);
    c.titleEl.setText(T("Sigur?", "Are you sure?"));
    c.contentEl.createEl("p", { text: T(`Conținutul a ${n} note se înlocuiește cu versiunea din Texere. Din fiecare păstrez o copie în același folder („… (înainte de actualizare)”).`, `The content of ${n} notes is replaced with Texere's version. I keep a copy of each in the same folder (“… (before update)”).`) });
    const row = c.contentEl.createDiv("modal-button-container");
    row.createEl("button", { text: T("Renunță", "Cancel") }).addEventListener("click", () => c.close());
    const ok = row.createEl("button", { cls: "mod-warning", text: T("Înlocuiește", "Replace") });
    ok.addEventListener("click", async () => { c.close(); try { const k = await P.updateNotes(); new Notice(T(`Am actualizat ${k} note (copiile vechi sunt lângă ele).`, `Updated ${k} notes (the old copies are next to them).`), 6000); } catch (e) { new Notice(e?.message || String(e)); } this.display(); });
    c.open();
  }
}

// vizualizarea unui modul oprit (Obsidian o poate redeschide la pornire, din tab-urile salvate)
class OffView extends ItemView {
  constructor(leaf, type, P, key) { super(leaf); this.type = type; this.P = P; this.key = key; }
  getViewType() { return this.type; }
  getDisplayText() { return "Texere"; }
  async onOpen() {
    const T = (a, b) => this.P.T(a, b), md = MODULES.find(m => m.key === this.key), name = md ? T(md.ro || md.label, md.label) : "";
    this.contentEl.empty(); this.contentEl.createDiv({ cls: "tx-offview", text: T(`Modulul ${name} al lui Texere e oprit. Îl pornești din Settings → Texere.`, `Texere's ${name} module is off. Turn it on in Settings → Texere.`) });
  }
}

