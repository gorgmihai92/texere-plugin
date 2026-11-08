/* Texere · Insights — modulul Insights al pluginului Texere (până la 3.0, plugin separat)
 * Câte cuvinte scrii, lipești, inserezi și ștergi; menționările fără link și aliasurile sugerate;
 * tiparele din lectura și scrisul tău; ritmul proiectelor (teza, un articol, un curs).
 * Merge singur, în orice vault: recunoaște notele de literatură, evidențierile și notele-concept după convenții.
 * Cu modulul Sources e mai precis (datele surselor), cu PDF++ știe culorile evidențierilor; niciunul nu e obligatoriu.
 * Codul e în acest folder; aici doar îl pornim. Datele stau pe laptop, în folderul lui Texere: stats/ (scrisul) și cache/ (trecerea prin vault).
 */
const { PluginSettingTab, Setting, Notice } = require("obsidian");
const { beta } = require("../shared/beta");
const { LANG } = require("../shared/lang");
const { advanced, pickFolder } = require("../shared/util");
const { ModuleHost } = require("../shared/host");

// puține lucruri pornite de la început: liniile din notă și recenzia săptămânii se pornesc din setări; panourile stau strânse
const DEFAULTS = { claimsInEditor: false, weekly: false, voiceInline: false, wsOpen: false, cpOpen: false };
// setări care nu mai există (acum sunt fixe sau recunoscute singure)
const GONE = ["streakMin", "targetKey", "countExclude", "scanQuotes", "scanTargets", "autoScan", "minTerm", "claimFolders", "pairFolder"];
const SCAN_MIN = 30;

module.exports = class TexereInsights extends ModuleHost {
  // limba: cea aleasă în Texere; fără Texere, limba lui Obsidian
  get en() { const l = this.app.loadLocalStorage(LANG); if (l === "en" || l === "ro") return l === "en"; let o = ""; try { o = window.localStorage.getItem("language") || ""; } catch (e) {} return !/^ro/i.test(o); }
  T(ro, en) { return this.en ? en : ro; }
  async onload() {
    this.settings = Object.assign({}, DEFAULTS, (await this.loadData()) || {});
    for (const k of GONE) delete this.settings[k];
    // o singură dată, în vault-urile existente: liniile colorate și cea portocalie se mută în însoțitorul scrisului, panourile se strâng
    // (recenzia săptămânii rămâne cum ai ales-o)
    if (this.settings.lean !== 1) { Object.assign(this.settings, { claimsInEditor: false, voiceInline: false, wsOpen: false, cpOpen: false, lean: 1 }); await this.saveData(this.settings); }
    // valorile vechi implicite (folderele vault-ului Texere) devin „recunoscute singure”: același rezultat, și în alte vault-uri
    // panourile conceptelor: oprite de la început (nota arată doar textul tău); rămân pornite unde le-ai deschis deja
    if (this.settings.cpOn === undefined) { this.settings.cpOn = this.settings.cpOpen === true; await this.saveData(this.settings); }
    if (JSON.stringify(this.settings.targetFolders) === '["Fields"]' || JSON.stringify(this.settings.targetFolders) === '["Disciplines"]') delete this.settings.targetFolders;
    if (JSON.stringify(this.settings.scanExclude) === '["Support"]') delete this.settings.scanExclude;
    // părțile modulului (în pachet; între ele, require("./text") etc.)
    const mods = { text: require("./text"), scope: require("./scope"), writing: require("./writing"), links: require("./links"), patterns: require("./patterns"), voice: require("./voice"), ui: require("./ui"), research: require("./research") };
    for (const k in mods) mods[k] = { exports: mods[k] };
    Object.assign(this, mods.writing.exports.WritingMixin, mods.links.exports.LinksMixin, mods.patterns.exports.PatternsMixin, mods.voice.exports.VoiceMixin, mods.ui.exports.UiMixin, mods.scope.exports.ScopeMixin, mods.research.exports.ResearchMixin);
    await this.writingInit();
    this.targetInit();
    this.uiInit();
    this.voiceInit();
    this.researchInit();   // pagina conceptului, harta dezbaterii, însoțitorul scrisului (după celelalte: învelește trecerea prin vault)
    this.addSettingTab(new InsightsSettingTab(this));
    this.noteMenuInit();
    this.unlinked = []; this.names = []; this.aliasSugg = []; this.duplicates = [];
    this.app.workspace.onLayoutReady(async () => {
      await this.loadScanCache();
      await this.allLogs();
      try { this.computeLinks(); this.computeNames(); this.computeAliases(); this.computeDuplicates(); } catch (e) {}
      this.changed();
      setTimeout(() => this.scan(false, true).catch(e => console.error("Texere · Insights", e)), 8000);   // după pornire, fără grabă
      this.scheduleScan();
      setTimeout(() => this.weeklyCheck(), 20000); this.registerInterval(window.setInterval(() => this.weeklyCheck(), 3600000));
    });
  }
  onunload() { clearInterval(this._scanI); }
  // meniul notei (clic dreapta în notă sau pe numele ei): totul sub un singur rând „Texere” (shared/notemenu.js)
  noteMenuInit() {
    const nm = require("../shared/notemenu").noteMenu(this.core || this), T = (a, b) => this.T(a, b);
    nm.add("insights", ctx => {
      const f = ctx.file; if (!f || f.extension !== "md") return [];
      const mine = this.voicePathOk(f.path), out = [];
      const sum = this._vsFor === f.path ? this._vsText : "";   // ce fac paragrafele notei deschise (calculat pentru ea)
      if (mine) out.push({ title: sum ? T(`Verifică ciorna · ${sum}`, `Check this draft · ${sum}`) : T("Verifică ciorna", "Check this draft"), icon: "spell-check", onClick: () => this.draftCheck(f) });
      if (mine && this.openCompanion) out.push({ title: T("Însoțitorul scrisului", "Writing companion"), icon: "pen-line", onClick: async () => { if (this.app.workspace.getActiveFile?.() !== f) await this.app.workspace.getLeaf(false).openFile(f); this.openCompanion(); } });
      out.push({ title: T("Pune o țintă de cuvinte…", "Set a word target…"), icon: "target", onClick: () => this.askTarget(f) });
      if (mine) out.push({ title: this.wsOn(f) ? T("Scoate statisticile scrisului", "Remove writing stats") : T("Statisticile scrisului în notă", "Writing stats in this note"), icon: "bar-chart-3", onClick: () => this.voiceStats(f) });
      return out;
    }, 60);
    this.register(() => nm.remove("insights"));
  }
  async saveSettings() { await this.saveData(this.settings); }
  scheduleScan() { clearInterval(this._scanI); this._scanI = window.setInterval(() => this.scan(false, true).catch(() => {}), SCAN_MIN * 60000); }   // doar notele schimbate: sub o secundă
  // ceva s-a schimbat: tab-ul nou (Texere · The Researcher's Vault) și pagina Insights se redesenează
  changed() {
    clearTimeout(this._chT);
    this._chT = setTimeout(() => { try { this.app.workspace.trigger("texere:changed"); } catch (e) {} try { this.refreshViews(); } catch (e) {} }, 300);
  }
  ago(t) {
    const s = Math.max(0, (Date.now() - t) / 1000), T = (a, b) => this.T(a, b);
    if (s < 60) return T("acum", "just now"); if (s < 3600) return T(`acum ${Math.round(s / 60)} min`, `${Math.round(s / 60)} min ago`);
    if (s < 86400) return T(`acum ${Math.round(s / 3600)} h`, `${Math.round(s / 3600)} h ago`); return T(`acum ${Math.round(s / 86400)} zile`, `${Math.round(s / 86400)} days ago`);
  }
  vaultFolders() { const out = []; const walk = f => { for (const c of f.children || []) if (Array.isArray(c.children) && !c.name.startsWith(".")) { out.push(c.path); walk(c); } }; try { walk(this.app.vault.getRoot()); } catch (e) {} return out.sort((a, b) => a.localeCompare(b)); }
  openSettings(tab) { try { this.core.openSettings("insights", tab); } catch (e) {} }
  // un panou în notă (ținta de cuvinte) are lățimea textului, în orice temă (la fel ca statisticile și bibliografia)
  fitPanel(box, watch) {
    const sizer = box?.isConnected && box.closest(".cm-sizer, .markdown-preview-sizer"); if (!sizer) return;
    const refs = [":scope > .cm-contentContainer .cm-line:not(.HyperMD-table-row)", ":scope > .inline-title", ":scope > div:not(.mod-header):not(.mod-footer) > :is(p, h1, h2, h3, ul, ol)", ":scope > .mod-header .inline-title"];
    let r = null; for (const q of refs) { for (const e of sizer.querySelectorAll(q)) { if (!e.offsetParent) continue; const b = e.getBoundingClientRect(); if (b.width > 120) { r = b; break; } } if (r) break; }
    if (r) { box.addClass("tx-fitbox"); box.setCssStyles({ width: r.width + "px" }); const b = box.getBoundingClientRect(); const cur = parseFloat(box.style.marginLeft) || 0, ml = Math.round((cur + r.left - b.left) * 10) / 10; if (b.width && Math.abs(ml - cur) > 0.5) box.setCssStyles({ marginLeft: ml + "px" }); }
    if (watch && !sizer._txiFit && typeof ResizeObserver !== "undefined") { let w = 0; sizer._txiFit = new ResizeObserver(en => { const nw = Math.round(en[0]?.contentRect?.width || 0); if (nw === w) return; w = nw; sizer.querySelectorAll(".txi-target").forEach(x => this.fitPanel(x)); }); sizer._txiFit.observe(sizer); this.register(() => { sizer._txiFit?.disconnect(); delete sizer._txiFit; }); }
  }
};

// ——— setările: o singură pagină; ce folosești rar, în „Avansat” ———
class InsightsSettingTab extends PluginSettingTab {
  constructor(P) { super(P.app, P); this.P = P; this.id = "texere-insights"; this.name = "Texere · Insights"; this.tab = ""; }
  display() {
    const P = this.P, T = (a, b) => P.T(a, b), c = this.containerEl, keep = c.scrollTop; c.empty(); c.addClass("texere-settings"); c.addClass("txi-settings");
    const head = c.createDiv("ts-head"); beta(head.createSpan({ cls: "ts-head-t", text: "Insights" }), this.P.T("Insights e încă în lucru: unele măsurători și sugestii se pot schimba.", "Insights is still in the works: some counts and suggestions may change."));
    const body = c.createDiv("ts-body"), save = async () => { await P.saveSettings(); }, redraw = () => { P._cf = null; this.display(); };
    // o listă de foldere: goală = recunoscută singură (și scrie ce a găsit)
    const folderList = (parent, name, desc, key, auto) => {
      const s = new Setting(parent).setName(name).setDesc(desc), cur = (P.settings[key] || []).filter(Boolean), box = s.descEl.createDiv("tx-mt6");
      if (!cur.length) box.createSpan({ cls: "ts-auto", text: T("Găsite singure: ", "Found automatically: ") + (auto.length ? auto.join(", ") : T("niciunul", "none")) });
      for (const f of cur) box.createSpan({ cls: "ts-chip", text: f + "  ✕" }).addEventListener("click", async () => { P.settings[key] = cur.filter(x => x !== f); if (!P.settings[key].length) delete P.settings[key]; await save(); redraw(); });
      s.addDropdown(d => { d.addOption("", T("Alege un folder…", "Choose a folder…")); for (const f of P.vaultFolders()) if (!cur.includes(f)) d.addOption(f, f); d.onChange(async v => { if (!v) return; P.settings[key] = [...cur, v]; await save(); redraw(); }); });
    };
    // cât scrii: ce apare în note (singurul loc unde le pornești; pagina Insights arată doar ce e pornit)
    new Setting(body).setName(T("În timp ce scrii", "While you write")).setDesc(T("Ce apare în notele tale; oprit de la început.", "What shows in your notes; off until you turn it on.")).setHeading();
    new Setting(body).setName(T("Afirmații fără citare", "Uncited claims")).setDesc(T("În notele proiectelor: o linie portocalie lângă paragraful care afirmă ceva fără citare și referința pe care o poți cita.", "In your projects' notes: an orange line next to a paragraph that makes a claim without a citation, and a reference you could cite."))
      .addToggle(t => t.setValue(P.settings.claimsInEditor !== false).onChange(async v => { await P.claimsToggle(v); }));
    new Setting(body).setName(T("Analiza scrisului", "Writing insights")).setDesc(T("Culorile din margine (ce face fiecare paragraf) și cuvintele de verificat.", "Margin colors (what each paragraph does) and words to check."))
      .addToggle(t => t.setValue(P.settings.voiceInline !== false).onChange(async v => { await P.voiceInlineToggle(v); }));
    new Setting(body).setName(T("Panourile conceptelor", "Concept panels")).setDesc(T("Sus în nota unui concept: definițiile, unde apare în scrisul tău și drumul spre harta dezbaterii.", "At the top of a concept note: its definitions, where it appears in your writing, and the way to its debate map."))
      .addToggle(t => t.setValue(P.settings.cpOn === true).onChange(async v => { await P.cpToggle(v); }));
    new Setting(body).setName(T("Recenzia săptămânii", "Weekly review")).setDesc(T("Lunea, o notă scurtă cu săptămâna trecută. Folderul ei e în Settings → Texere → Foldere.", "Every Monday, a short note about last week. Its folder is in Settings → Texere → Folders."))
      .addToggle(t => t.setValue(P.settings.weekly !== false).onChange(async v => { P.settings.weekly = v; await save(); this.display(); }));

    const adv = advanced(body, T("Avansat", "Advanced"), "insights");
    if (this.tab === "projects") { adv.parentElement.open = true; this.tab = ""; }
    // „Adaugă un proiect” din Insights: un rând nou, gol, gata de ales (același loc ca „Schimbă proiectele”)
    let fresh = null; if (P._addProject) { P._addProject = false; const l = P.projects(); if (!l.some(x => !x.value)) l.push({ value: "", target: 0, deadline: "" }); fresh = l.length - 1; }
    const folders = P.vaultFolders(), tags = P.vaultTags();
    // proiectele: folder sau etichetă, ținta și termenul
    const list = P.projects(), ph = new Setting(adv).setName(T("Proiecte", "Projects")).setDesc(T("Un folder, o etichetă sau o notă, cu ținta (cuvinte) și termenul.", "A folder, a tag or a note, with its target (words) and deadline."));
    ph.settingEl.addClass("txi-proj-head");
    list.forEach((p, i) => {
      const th = P.project(p), s = new Setting(adv).setName(th.name || T("Proiect nou", "New project")).setDesc(th.exists ? T(`${th.words.toLocaleString("ro-RO")} cuvinte în ${th.docs} note`, `${th.words.toLocaleString("en-GB")} words in ${th.docs} notes`) : "");
      s.settingEl.addClass("txi-proj"); if (i === fresh) { s.settingEl.addClass("is-fresh"); setTimeout(() => { s.settingEl.scrollIntoView({ block: "center" }); s.settingEl.querySelector("select")?.focus(); }, 300); }
      // un singur selector, cu căutare: folderele, etichetele și notele (📁 folder · #etichetă · 📄 notă)
      const label = v => !v ? T("Folder, etichetă sau notă…", "Folder, tag or note…") : v.startsWith("#") ? v : /\.md$/i.test(v) ? "📄 " + v.split("/").pop().replace(/\.md$/i, "") : "📁 " + v;
      s.addButton(b => { b.setButtonText(label(p.value) + "  ▾"); b.buttonEl.addClass("txi-proj-pick"); b.buttonEl.title = p.value || ""; b.onClick(() => {
        const used = new Set(list.map(x => x.value)), items = [...folders.map(f => ({ v: f, t: "📁 " + f })), ...tags.map(t => ({ v: t, t })), ...P.app.vault.getMarkdownFiles().map(f => ({ v: f.path, t: "📄 " + f.path.replace(/\.md$/, "") }))].filter(x => x.v === p.value || !used.has(x.v));
        const tab = this, M = class extends require("obsidian").FuzzySuggestModal { getItems() { return items; } getItemText(x) { return x.t; } async onChooseItem(x) { p.value = x.v; await save(); tab.display(); P.changed(); } };
        const m = new M(P.app); m.setPlaceholder(T("Caută un folder, o etichetă sau o notă…", "Search a folder, a tag or a note…")); m.open();
      }); });
      s.addText(t => { t.setPlaceholder(T("ținta (cuvinte)", "target (words)")).setValue(p.target ? String(p.target) : "").onChange(async v => { p.target = parseInt(v, 10) || 0; await save(); P.changed(); }); t.inputEl.type = "number"; });
      s.addText(t => { t.setValue(p.deadline || "").onChange(async v => { p.deadline = v; await save(); P.changed(); }); t.inputEl.type = "date"; t.inputEl.title = T("Termenul", "Deadline"); });
      s.addExtraButton(b => b.setIcon("x").setTooltip(T("Scoate proiectul (notele rămân)", "Remove the project (notes stay)")).onClick(async () => { list.splice(i, 1); await save(); this.display(); P.changed(); }));
    });
    ph.addButton(b => b.setButtonText(T("Adaugă un proiect", "Add a project")).onClick(async () => { list.push({ value: "", target: 0, deadline: "" }); await save(); this.display(); }));
    // ce ai cerut să nu mai fie sugerat
    const ign = P.settings.ignoredTargets || [];
    if (ign.length) { const s = new Setting(adv).setName(T("Termeni ignorați", "Ignored terms")).setDesc(T("Clic pe unul ca să fie sugerat iar.", "Click one to have it suggested again.")); const ch = s.descEl.createDiv("tx-mt6"); for (const t of ign) ch.createSpan({ cls: "ts-chip", text: P.nameOf(t) + "  ✕" }).addEventListener("click", async () => { P.settings.ignoredTargets = ign.filter(x => x !== t); await save(); P.computeLinks(); this.display(); }); }
    const nh = Object.values(P.settings.notHere || {}).reduce((a, l) => a + l.length, 0);
    if (nh) new Setting(adv).setName(T("„Nu aici”", "“Not here”")).setDesc(T(`${nh} menționări pe care nu le mai sugerez.`, `${nh} mentions no longer suggested.`)).addButton(b => b.setButtonText(T("Sugerează-le iar", "Suggest them again")).onClick(async () => { P.settings.notHere = {}; await save(); P.computeLinks(); this.display(); }));
    c.scrollTop = keep;
  }
  // folderele lui Insights, desenate în Settings → Texere → Foldere: notele-concept, ce nu se caută, recenziile
  folderRows(el, redraw) {
    const P = this.P, T = (a, b) => P.T(a, b), save = async () => { await P.saveSettings(); }, again = () => { P._cf = null; redraw(); };
    const folderList = (name, desc, key, auto) => {
      const s = new Setting(el).setName(name).setDesc(desc), cur = (P.settings[key] || []).filter(Boolean), box = s.descEl.createDiv("tx-mt6");
      if (!cur.length) box.createSpan({ cls: "ts-auto", text: T("Găsite singure: ", "Found automatically: ") + (auto.length ? auto.join(", ") : T("niciunul", "none")) });
      for (const f of cur) box.createSpan({ cls: "ts-chip", text: f + "  ✕" }).addEventListener("click", async () => { P.settings[key] = cur.filter(x => x !== f); if (!P.settings[key].length) delete P.settings[key]; await save(); again(); });
      s.addButton(b => b.setButtonText(T("Schimbă…", "Change…")).onClick(() => pickFolder(P.app, { placeholder: T("Adaugă un folder…", "Add a folder…"), exclude: cur }, async v => { P.settings[key] = [...cur, v]; await save(); again(); })));
    };
    folderList(T("Notele-concept", "Concept notes"), T("Notele la care Insights leagă cuvintele tale (ex. harta disciplinei). Gol: găsite singure.", "The notes Insights links your words to (e.g. the discipline map). Empty: found automatically."), "targetFolders", P.autoConceptFolders());
    folderList(T("Ce nu numără Insights", "What Insights leaves out"), T("Folderele care nu sunt scrisul tău (ex. șabloanele). Gol: găsite singure.", "Folders that aren't your writing (e.g. templates). Empty: found automatically."), "scanExclude", P.autoExcluded());
    if (P.settings.weekly !== false) { const cur = P.settings.weeklyFolder || P.weeklyDefault(), ws = new Setting(el).setName(T("Recenziile săptămânii", "Weekly reviews")).setDesc(T("Unde ajunge nota de luni cu săptămâna ta.", "Where Monday's note about your week goes.")); ws.descEl.createDiv({ cls: "tx-mt6 ts-cur", text: cur }); ws.addButton(b => b.setButtonText(T("Schimbă…", "Change…")).onClick(() => pickFolder(P.app, { placeholder: T("Unde ajung recenziile săptămânii?", "Where should the weekly reviews go?"), exclude: [cur] }, async v => { P.settings.weeklyFolder = v; await save(); redraw(); }))); }
  }
}
