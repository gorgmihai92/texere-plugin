// Texere · Insights · ce vezi: pagina Insights, fereastra de revizuire (linkuri, nume, aliasuri, dubluri), semnele din notă pentru
// afirmațiile fără citare, recenzia săptămânii și secțiunea din tab-ul nou.
const { ItemView, Modal, Setting, Notice, TFile, setIcon, Menu } = require("obsidian");
const { beta } = require("../shared/beta");
const X = require("./text");
const { existingPrefix } = require("../shared/paths");

const VIEW = "texere-insights";
const fmt = (n, en) => Math.round(n || 0).toLocaleString(en ? "en-GB" : "ro-RO");
const el = (parent, tag, cls, text) => { const e = parent.createEl(tag, { cls }); if (text != null) e.setText(text); return e; };
const SVG = "http://www.w3.org/2000/svg";
const svg = (parent, w, h) => { const s = document.createElementNS(SVG, "svg"); s.setAttribute("viewBox", `0 0 ${w} ${h}`); s.setAttribute("width", "100%"); s.setAttribute("preserveAspectRatio", "xMinYMin meet"); parent.appendChild(s); return s; };
const rect = (s, x, y, w, h, cls, title) => { const r = document.createElementNS(SVG, "rect"); r.setAttribute("x", x); r.setAttribute("y", y); r.setAttribute("width", Math.max(0, w)); r.setAttribute("height", Math.max(0, h)); r.setAttribute("rx", Math.min(2, w / 2)); if (cls) r.setAttribute("class", cls); if (title) { const t = document.createElementNS(SVG, "title"); t.textContent = title; r.appendChild(t); } s.appendChild(r); return r; };
const txt = (s, x, y, t, cls, anchor) => { const e = document.createElementNS(SVG, "text"); e.setAttribute("x", x); e.setAttribute("y", y); if (cls) e.setAttribute("class", cls); if (anchor) e.setAttribute("text-anchor", anchor); e.textContent = t; s.appendChild(e); return e; };


const UiMixin = {
  uiInit() {
    const P = this;
    this.registerView(VIEW, leaf => new InsightsView(leaf, P));
    // fără iconiță în bara din stânga: Insights se deschide din pagina de pornire Texere (bara de jos) sau din comenzi.
    // În paleta de comenzi doar ce folosești des; restul e în panoul Insights (Caută acum, comutatoarele „Cât scrii”, harta, însoțitorul).
    this.addCommand({ id: "open", name: this.T("Deschide Insights", "Open Insights"), callback: () => this.openView() });
    this.addCommand({ id: "review", name: this.T("Revizuiește menționările fără link", "Review unlinked mentions"), callback: () => this.review("links") });
    this.claimsInit();
  },
  // afirmațiile fără citare, în notă: pornit / oprit (din panoul Insights și din setări)
  async claimsToggle(on) {
    this.settings.claimsInEditor = on === undefined ? this.settings.claimsInEditor === false : !!on; await this.saveSettings(); this.refreshEditors();
  },
  async openView(tab) {
    if (tab) this._insTab = tab;
    const ex = this.app.workspace.getLeavesOfType(VIEW)[0];
    if (ex) { if (tab && ex.view) { ex.view.tab = tab; this._insTab = null; ex.view.render?.(); } this.app.workspace.revealLeaf(ex); return ex; }
    const leaf = this.app.workspace.getLeaf("tab"); await leaf.setViewState({ type: VIEW, active: true }); this.app.workspace.revealLeaf(leaf); return leaf;
  },
  refreshViews() { for (const l of this.app.workspace.getLeavesOfType(VIEW)) { try { l.view.render(); } catch (e) {} } },
  review(tab) { new ReviewModal(this, tab).open(); },
  // pagina Insights, desenată în altă pagină (tab-ul nou din Texere)
  panel(el, back, tab) { el.empty(); const v = Object.create(InsightsView.prototype); Object.assign(v, { P: this, contentEl: el, period: "week", balScope: "", expanded: null, tab: tab || this._insTab || "writing" }); this._insTab = null; v.render(); return v; },
  openPath(path, newTab) { const f = this.app.vault.getAbstractFileByPath(path); if (f instanceof TFile) this.app.workspace.getLeaf(newTab ? "tab" : false).openFile(f); },
  // o notă nouă care leagă două concepte, cu locurile în care apar împreună
  async connectPair(p) {
    const T = (a, b) => this.T(a, b), dir = String(this.app.fileManager.getNewFileParent?.("")?.path || "").replace(/^\/$/, "").replace(/\/+$/, "");   // unde pune Obsidian notele noi
    const A = this.app.vault.getAbstractFileByPath(p.a), B = this.app.vault.getAbstractFileByPath(p.b); if (!A || !B) return;
    const name = `${A.basename} – ${B.basename}`, path = (dir ? dir + "/" : "") + name.replace(/[\\/:*?"<>|#^[\]]/g, " ") + ".md";
    let f = this.app.vault.getAbstractFileByPath(path);
    if (!f) {
      if (dir && !this.app.vault.getAbstractFileByPath(dir)) await this.app.vault.createFolder(dir).catch(() => {});
      const lk = x => this.app.metadataCache.fileToLinktext(x, path, true);
      const body = `---\ndateCreated: ${X.dayKey()}\n---\n[[${lk(A)}]] · [[${lk(B)}]]\n\n${T("Unde apar împreună:", "Where they meet:")}\n${p.notes.map(n => { const g = this.app.vault.getAbstractFileByPath(n); return g ? `- [[${this.app.metadataCache.fileToLinktext(g, path, true)}]]` : ""; }).filter(Boolean).join("\n")}\n\n`;
      f = await this.app.vault.create(path, body);
    }
    await this.app.workspace.getLeaf("tab").openFile(f);
  },
  // ——— secțiunea din tab-ul nou (o desenează Texere · The Researcher's Vault, dacă Insights e pornit) ———
  homeSection(parent, leaf) {
    const T = (a, b) => this.T(a, b), en = this.en, d = this.totals("day"), st = this.streak(), un = this.visibleUnlinked();
    const box = parent.createDiv("txh-ins");
    beta(el(box, "div", "txh-label", T("Insights", "Insights")));
    const row = box.createDiv("txh-ins-row"); row.title = T("Deschide Insights", "Open Insights");
    const part = (n, label) => { const s = row.createSpan(); s.createEl("b", { text: fmt(n, en) }); s.appendText(" " + label); };
    part(d.t, T("cuvinte scrise azi", "words written today"));   // lipite, inserate, șterse: în Insights
    if (st.now) row.createSpan({ cls: "txh-ins-streak", text: st.now === 1 ? T("1 zi la rând", "1-day streak") : T(`${st.now} zile la rând`, `${st.now}-day streak`) });
    row.addEventListener("click", () => this.openView());
    // cum scrii, față de punctul de plecare: cele mai mari 2–3 schimbări, în cuvinte (clic → Insights, în pagină)
    const vl = this.voiceLineText?.();
    if (vl) { const v = box.createDiv("txh-ins-row txh-ins-voice"); v.createSpan({ text: vl }); v.title = T("Deschide Cum scrii", "Open How you write"); v.addEventListener("click", () => { const core = this.app.plugins.plugins.texere; if (leaf && core?.renderHome) { this._insTab = "writing"; if (core.goPage) core.goPage(leaf, "insights"); else { leaf.__txPage = "insights"; core.renderHome(leaf); } } else this.openView("writing"); }); }
    // de pus în ordine: un singur rând (menționări, nume, aliasuri, dubluri), ca în fila Linkuri
    const ns = (this.names || []).length, as = (this.aliasSugg || []).length, ds = (this.duplicates || []).length;
    const bits = [un.length && T(`${un.length} ${un.length === 1 ? "menționare" : "menționări"} fără link`, `${un.length} unlinked ${un.length === 1 ? "mention" : "mentions"}`), ns && T(`${ns} nume fără notă`, `${ns} ${ns === 1 ? "name" : "names"} without a note`), as && T(`${as} ${as === 1 ? "alias" : "aliasuri"}`, `${as} ${as === 1 ? "alias" : "aliases"}`), ds && T(`${ds} ${ds === 1 ? "dublură" : "dubluri"}`, `${ds} ${ds === 1 ? "duplicate" : "duplicates"}`)].filter(Boolean);
    if (bits.length) {
      const l = box.createDiv("txh-ins-link");
      l.createSpan({ text: T("De pus în ordine: ", "To tidy: ") + bits.join(" · ") });
      l.createEl("button", { text: T("Revizuiește", "Review") }).addEventListener("click", () => this.review(un.length ? "links" : ns ? "names" : as ? "aliases" : "dups"));
    }
  },

  // ——— afirmațiile fără citare, în notă: o linie subțire la stânga paragrafului și sursa pe care ai putea-o cita ———
  claimsInit() {
    let VP, Decoration, WidgetType, StateEffect;
    try { ({ ViewPlugin: VP, Decoration, WidgetType } = require("@codemirror/view")); ({ StateEffect } = require("@codemirror/state")); } catch (e) { return; }
    const P = this, refresh = this._claimFx = StateEffect.define();
    class Chip extends WidgetType {
      constructor(p, sugg, path) { super(); this.p = p; this.sugg = sugg; this.path = path; }
      eq(o) { return o.p.hash === this.p.hash && o.sugg.map(s => s.id).join() === this.sugg.map(s => s.id).join(); }
      // un singur semn mic la finalul paragrafului; un clic → cel mult trei acțiuni: citează una dintre (cel mult) două surse, sau „Nu e o afirmație”
      toDOM(view) {
        const T = (a, b) => P.T(a, b), w = document.createElement("span"); w.className = "txi-cite"; w.textContent = T("citare?", "cite?");
        w.title = T("Afirmație fără citare. Clic: ce poți cita.", "Uncited claim. Click: what you could cite.");
        w.addEventListener("mousedown", e => {
          e.preventDefault(); e.stopPropagation();
          const m = new Menu();
          for (const s of this.sugg.slice(0, 2)) m.addItem(i => i.setTitle(T(`Citează ${s.label}`, `Cite ${s.label}`)).setIcon("quote").onClick(() => P.insertCite(view, this.p, s.id)));
          m.addItem(i => i.setTitle(T("Nu e o afirmație", "Not a claim")).setIcon("x").onClick(async () => { P.settings.notClaims = [...new Set([...(P.settings.notClaims || []), this.p.hash])]; await P.saveSettings(); P.refreshEditors(); }));
          m.showAtMouseEvent(e);
        });
        return w;
      }
      ignoreEvent() { return true; }
    }
    const build = view => {
      if (P.settings.claimsInEditor === false) return Decoration.none;
      let file = null; try { file = view.state.field(require("obsidian").editorInfoField)?.file; } catch (e) {}
      if (!file || !P.inAnyProject(file.path)) return Decoration.none;
      const text = view.state.doc.toString(), list = P.uncitedIn(text, file.path), deco = [];
      for (const p of list) {
        const sugg = P.suggestCitations(p, text.slice(p.from, p.to), 2);
        const l1 = view.state.doc.lineAt(p.from).number, l2 = view.state.doc.lineAt(Math.max(p.from, p.to - 1)).number;
        for (let l = l1; l <= l2; l++) deco.push(Decoration.line({ class: "txi-uncited" }).range(view.state.doc.line(l).from));
        deco.push(Decoration.widget({ widget: new Chip(p, sugg, file.path), side: 1 }).range(p.to));
      }
      return Decoration.set(deco, true);
    };
    // înainte de extensie: editoarele deja deschise o construiesc pe loc
    const safe = view => { try { return build(view); } catch (e) { console.error("Texere · Insights: afirmațiile", e); return Decoration.none; } };
    this.registerEditorExtension(VP.fromClass(class {
      constructor(view) { this.view = view; this.decorations = safe(view); }
      update(u) {
        if (u.transactions.some(t => t.effects.some(e => e.is(refresh)))) { this.decorations = safe(u.view); return; }
        if (u.docChanged) { this.decorations = this.decorations.map(u.changes); clearTimeout(this.t); this.t = setTimeout(() => { try { u.view.dispatch({ effects: refresh.of(null) }); } catch (e) {} }, 900); }
      }
      destroy() { clearTimeout(this.t); }
    }, { decorations: v => v.decorations }));
  },
  refreshEditors() { this.app.workspace.iterateAllLeaves(l => { try { l.view?.editor?.cm?.dispatch({ effects: this._claimFx.of(null) }); } catch (e) {} }); },
  insertCite(view, p, id) {
    const doc = view.state.doc, para = doc.sliceString(p.from, p.to), m = /([.!?…])(\s*)$/.exec(para);
    const at = m ? p.from + m.index : p.to, ins = ` [@${id}]`;
    view.dispatch({ changes: { from: at, insert: ins }, userEvent: "input.complete" });
  },

  // ——— recenzia săptămânii: în fiecare luni, o notă scurtă cu săptămâna trecută ———
  async weeklyCheck() {
    if (this.settings.weekly === false) return;
    const now = new Date(), prev = new Date(now); prev.setDate(prev.getDate() - 7); const wk = X.weekKey(prev);
    if (this.settings.lastWeekly === wk) return;
    await this.allLogs();
    const mon = new Date(prev); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7)); const sun = new Date(mon); sun.setDate(sun.getDate() + 6);
    const range = { from: X.dayKey(mon), to: X.dayKey(sun) }, s = this.totals(range);
    this.settings.lastWeekly = wk; await this.saveSettings();
    if (s.added + s.d + s.r < 30) return;   // o săptămână fără scris și citit: nicio notă
    const raw = String(this.settings.weeklyFolder || this.weeklyDefault()).replace(/\/+$/, "");
    const dir = existingPrefix(this.app, raw) || raw, path = `${dir}/${wk}.md`;   // „02. Notes/…” când folderul e „2. Notes”: în cel care există, nu într-unul nou
    if (this.app.vault.getAbstractFileByPath(path)) return;
    try {
      let cur = ""; for (const part of dir.split("/")) { cur = cur ? cur + "/" + part : part; if (!this.app.vault.getAbstractFileByPath(cur)) await this.app.vault.createFolder(cur); }
      const f = await this.app.vault.create(path, this.weeklyText(wk, range, s));
      const T = (a, b) => this.T(a, b), frag = document.createDocumentFragment(); frag.append(T(`Recenzia săptămânii ${wk} e gata. `, `Your review of ${wk} is ready. `));
      const a = document.createElement("a"); a.href = "#"; a.textContent = T("Deschide", "Open"); frag.append(a); const n = new Notice(frag, 15000);
      a.addEventListener("click", e => { e.preventDefault(); n.hide(); this.app.workspace.getLeaf("tab").openFile(f); });
    } catch (e) { console.error("Texere · Insights: recenzia", e); }
  },
  weeklyDefault() { const p = String(this.app.fileManager.getNewFileParent?.("")?.path || "").replace(/^\/$/, ""); return (p ? p + "/" : "") + "Weekly reviews"; },
  weeklyText(wk, range, s) {
    const T = (a, b) => this.T(a, b), en = this.en, n = x => fmt(x, en), lines = [];
    const lk = p => { const f = this.app.vault.getAbstractFileByPath(p); return f ? `[[${this.app.metadataCache.fileToLinktext(f, "", true)}]]` : p; };
    lines.push(`---\ndateCreated: ${X.dayKey()}\ntags:\n  - weekly_review\n---`, `# ${T("Săptămâna", "Week")} ${wk}`, "");
    lines.push(`## ${T("Scris", "Writing")}`, `- ${T("Scrise", "Typed")}: **${n(s.t)}** · ${T("lipite", "pasted")}: ${n(s.p)} · ${T("inserate", "inserted")}: ${n(s.x)} · ${T("șterse", "deleted")}: ${n(s.d)} · ${T("net", "net")}: **${n(s.net)}**`);
    const days = this.series(400).filter(d => d.k >= range.from && d.k <= range.to), best = days.slice().sort((a, b) => b.added - a.added)[0];
    if (best?.added) lines.push(`- ${T("Ziua cea mai bună", "Best day")}: ${best.date.toLocaleDateString(en ? "en-GB" : "ro-RO", { weekday: "long", day: "numeric", month: "long" })} (${n(best.added)})`);
    const top = this.topOf(range, "n", 5); if (top.length) { lines.push(`- ${T("Ai lucrat la", "You worked on")}:`); for (const t of top) lines.push(`  - ${lk(t.path)} (+${n(t.added)} / −${n(t.d)})`); }
    lines.push("", `## ${T("Lectură", "Reading")}`, `- ${T("Adnotări noi", "New annotations")}: **${n(s.r)}**`);
    const em = this.emerging(); if (em.rising.length) lines.push("", `## ${T("În creștere", "Rising")}`, ...em.rising.slice(0, 5).map(r => `- ${lk(r.path)}`));
    const p = this.pairs(1)[0]; if (p) lines.push("", `## ${T("O legătură nefăcută", "An unmade connection")}`, `- ${lk(p.a)} + ${lk(p.b)}: ${T(`împreună în ${p.count} paragrafe, fără link între ele`, `together in ${p.count} paragraphs, with no link between them`)}`);
    const r = this.resurface(1)[0]; if (r) lines.push("", `## ${T("De recitit", "Worth rereading")}`, `- ${lk(r.path)} — ${T(`neatinsă de ${r.months} luni; are în comun: ${r.shared.join(", ")}`, `untouched for ${r.months} months; shares: ${r.shared.join(", ")}`)}`);
    const q = this.openQuestions(); if (q.length) lines.push("", `## ${T("O întrebare deschisă", "An open question")}`, `> ${q[Math.floor(Math.random() * q.length)].q}`);
    return lines.join("\n") + "\n";
  },
};

// ——— pagina Insights ———
class InsightsView extends ItemView {
  constructor(leaf, P) { super(leaf); this.P = P; this.period = "week"; this.balScope = ""; this.expanded = null; this.tab = "writing"; }
  getViewType() { return VIEW; }
  getDisplayText() { return "Insights"; }
  getIcon() { return "lightbulb"; }
  async onOpen() {
    this.contentEl.addClass("txi-view");
    if (this.P._insTab) { this.tab = this.P._insTab; this.P._insTab = null; }
    try { await this.P.allLogs(); } catch (e) {}
    if (!this.P.scanCache?.at) this.P.scan(false, true).then(() => this.render()).catch(e => console.error("Texere · Insights", e));
    await this.render();
  }
  // o eroare nu lasă pagina goală: o arată, ca să știi ce s-a întâmplat
  showError(e) { console.error("Texere · Insights: pagina", e); const d = this.contentEl.createDiv("txi-wrap"); d.createEl("h2", { text: "Insights" }); d.createEl("p", { cls: "txi-muted", text: this.P.T("Pagina n-a putut fi desenată: ", "The page couldn't be drawn: ") + (e?.message || e) }); }
  async render() { try { await this.draw(); } catch (e) { this.contentEl.empty(); this.showError(e); } }
  async draw() {
    const P = this.P, T = (a, b) => P.T(a, b), en = P.en, c = this.contentEl, keep = c.scrollTop;
    c.empty(); const w = c.createDiv("txi-wrap");
    const head = w.createDiv("txi-head"); beta(head.createDiv({ cls: "txi-title", text: "Insights" }), T("Insights e încă în lucru: unele măsurători și sugestii se pot schimba.", "Insights is still in the works: some counts and suggestions may change."));
    const sub = head.createDiv("txi-sub"); sub.createSpan({ text: P.scanCache?.at ? T(`actualizat ${P.ago(P.scanCache.at)}`, `updated ${P.ago(P.scanCache.at)}`) : T("se citește vault-ul…", "reading your vault…") });
    const rb = sub.createEl("button", { text: T("Caută acum", "Scan now") }); rb.title = T("Recitește vault-ul: cuvintele, menționările, tiparele", "Read your vault again: words, mentions, patterns");
    rb.addEventListener("click", async () => { rb.disabled = true; rb.setText("…"); await P.allLogs(); P._logsAt = 0; await P.allLogs(); await P.scan(false, true); this.render(); });
    // LAB: ce înseamnă (experimental, se îmbunătățește) și unde stau datele (adevărat: rețeaua doar la traducerea titlurilor și la lucrările citate, la cererea ta)
    if (!P.settings.labSeen) {   // o singură dată: după ✕ rămâne doar eticheta LAB din titlu
    const lab = w.createDiv("txi-lab");
    const x = lab.createEl("button", { cls: "txi-lab-x clickable-icon", attr: { "aria-label": T("Am înțeles", "Got it") } }); try { setIcon(x, "x"); } catch (e) { x.setText("✕"); }
    x.addEventListener("click", async () => { P.settings.labSeen = true; await P.saveSettings(); this.render(); });
    lab.createEl("b", { text: T("Experimental, încă în lucru. ", "Experimental, still in the works. ") });
    lab.appendText(T("Insights se îmbunătățește de la o versiune la alta, așa că unele cifre și sugestii se pot schimba. Ce numără și ce găsește rămâne la tine, în vault. Iese pe internet doar când îi ceri: ca să traducă titlul unui concept sau să caute lucrările citate de referințele tale.",
      "Insights gets better with each version, so some counts and suggestions may change. What it counts and finds stays with you, in your vault. It goes online only when you ask: to translate a concept's title or to look up the works your references cite."));
    }
    // patru file în loc de o pagină lungă: Azi · Scrisul · Linkuri · Proiecte
    // câte o întrebare pe tab: cât și cum scrii · ce citești · ce se leagă · unde ești cu proiectele
    const TABS = [["writing", T("Scrisul", "Writing")], ["reading", T("Lectura", "Reading")], ["links", T("Linkuri", "Links")], ["projects", T("Proiecte", "Projects")]];
    if (this.tab === "today") this.tab = "writing";   // „Azi” e acum la începutul tab-ului Scrisul
    if (!TABS.some(([id]) => id === this.tab)) this.tab = "writing";
    const nav = w.createDiv("txi-pnav");
    for (const [id, l] of TABS) { const b = nav.createEl("button", { cls: "txi-pnav-b" + (this.tab === id ? " on" : ""), text: l }); b.addEventListener("click", () => { if (this.tab === id) return; this.tab = id; c.scrollTop = 0; this.render(); }); }
    const parts = {
      writing: [() => this.writing(w), () => this.whileWriting(w), () => P.voiceSection?.(this, w), () => this.behaviour(w)],   // „De făcut” e pe Acasă (tab-ul nou), nu și aici
      reading: [() => this.concepts(w), () => this.sources(w), () => this.topics(w)],
      links: [() => this.links(w), () => this.patterns(w), () => this.forgotten(w)],
      projects: [() => this.projectsSec(w)],
    }[this.tab];
    for (const f of parts) { try { await f(); } catch (e) { console.error(e); } }
    c.scrollTop = keep;
  }
  // o secțiune: titlul, cel mult un rând de explicație; explicația lungă, la trecerea mouse-ului peste titlu
  // același cap pentru fiecare secțiune: titlul și subtitlul (un rând) în stânga, butoanele în dreapta; explicația lungă, la hover pe titlu
  sec(w, title, lead, tip, acts) {
    const s = w.createDiv("txi-sec"), hd = s.createDiv("txi-sec-h"), tt = hd.createDiv("txi-sec-t"), h = tt.createEl("h3", { text: title });
    if (tip) h.title = tip; if (lead) tt.createDiv({ cls: "txi-lead", text: lead });
    s.acts = hd.createDiv("txi-sec-acts"); for (const a of acts || []) if (a) this.btn(s.acts, a);
    return s;
  }
  // un buton Insights: același aspect peste tot; `cta` doar pentru acțiunea principală a ecranului
  btn(parent, { text, cta, title, onClick }) { const b = parent.createEl("button", { text, cls: cta ? "mod-cta" : "" }); if (title) b.title = title; b.addEventListener("click", onClick); return b; }
  card(parent, title, hint) { const c = parent.createDiv("txi-card"); const h = c.createEl("h4", { text: title }); if (hint) h.createSpan({ cls: "txi-hint", text: hint }); return c; }
  num(parent, n, label, neg) { const d = parent.createDiv("txi-num" + (neg ? " neg" : "")); d.createEl("b", { text: fmt(n, this.P.en) }); d.createSpan({ text: label }); }
  row(parent, name, meta, onClick) { const r = parent.createDiv("txi-row" + (onClick ? " click" : "")); r.createSpan({ cls: "txi-name", text: name }); if (meta != null) r.createSpan({ cls: "txi-meta", text: meta }); if (onClick) r.addEventListener("click", onClick); return r; }

  writing(w) {
    const P = this.P, T = (a, b) => P.T(a, b), en = P.en;
    const s = this.sec(w, T("Cuvinte", "Words"), T("Scrise, lipite, inserate și șterse, numărate în editor.", "Typed, pasted, inserted and deleted, counted in the editor."),
      T("Numărate în editor. Lipite: și adnotările pe care PDF++ le lipește singur (doar pasajul). Inserate: ce pun alte unelte, de exemplu un plugin AI. Anulează nu se numără.", "Counted in the editor. Pasted includes the annotations PDF++ pastes for you (just the passage). Inserted is what other tools add, e.g. an AI plugin. Undo isn't counted."));
    // o cifră (cuvintele scrise de tine), dedesubt restul într-un rând, zilele la rând și notele la care ai lucrat; anul îl arată calendarul
    if (this.period === "year") this.period = "month";
    const c1 = this.card(s, T("Cât ai scris", "How much you wrote"));
    const tabs = c1.createDiv("txi-tabs");
    for (const [id, l] of [["day", T("Azi", "Today")], ["week", T("Săptămâna", "Week")], ["month", T("Luna", "Month")]]) { const b = tabs.createEl("button", { text: l, cls: this.period === id ? "on" : "" }); b.addEventListener("click", () => { this.period = id; this.render(); }); }
    const t = P.totals(this.period), nums = c1.createDiv("txi-nums");
    this.num(nums, t.t, T("cuvinte scrise", "words written"));
    const more = [t.p && T(`${fmt(t.p, en)} lipite`, `${fmt(t.p, en)} pasted`), t.x && T(`${fmt(t.x, en)} inserate`, `${fmt(t.x, en)} inserted`), t.d && T(`${fmt(t.d, en)} șterse`, `${fmt(t.d, en)} deleted`)].filter(Boolean);
    if (more.length) el(c1, "p", "txi-muted", more.join(" · "));
    const st = P.streak();
    if (st.best) el(c1, "p", "txi-muted", (st.now ? T(`${st.now} ${st.now === 1 ? "zi" : "zile"} la rând`, `${st.now} ${st.now === 1 ? "day" : "days"} in a row`) : T("Nicio zi la rând acum", "No streak right now")) + T(` · cel mai lung: ${st.best}`, ` · longest: ${st.best}`)).title = T("Zile cu cel puțin 20 de cuvinte", "Days with at least 20 words");
    const top = P.topOf(this.period, "n", 3); if (top.length) { el(c1, "p", null, T("Ai lucrat cel mai mult la:", "You worked most on:")); const l = c1.createDiv("txi-list"); for (const r of top) this.row(l, P.nameOf(r.path), `+${fmt(r.added, en)} / −${fmt(r.d, en)}`, () => P.openPath(r.path)); }
    // calendarul anului, ca pe GitHub: 53 de săptămâni, de duminică la sâmbătă, pătrățele mici, lunile sus, „Mai puțin … Mai mult” jos
    // mereu la vedere: un titlu și calendarul, fără pliere
    const fold = s.createDiv("txi-year tx-mt12");
    const fsum = fold.createDiv("txi-year-t"), c3 = fold.createDiv("txi-card txi-gh");
    const now = new Date(), end = new Date(now.getFullYear(), now.getMonth(), now.getDate()), start = new Date(end); start.setDate(start.getDate() - 52 * 7 - end.getDay());
    const nDays = Math.round((end - start) / 864e5) + 1, days = P.series(nDays), total = days.reduce((a, d) => a + d.added, 0);
    fsum.setText(T(`Ultimul an: ${fmt(total, en)} de cuvinte`, `The last year: ${fmt(total, en)} words`));
    const nz = days.map(d => d.added).filter(v => v > 0).sort((a, b) => a - b), q = f => nz.length ? nz[Math.min(nz.length - 1, Math.floor(nz.length * f))] : 0;
    const q1 = q(.25), q2 = q(.5), q3 = q(.75), level = v => !v ? 0 : v <= q1 ? 1 : v <= q2 ? 2 : v <= q3 ? 3 : 4;
    const C = 10, G = 3, S = C + G, L = 30, Tp = 16, cols = Math.ceil(nDays / 7), W = L + cols * S, H = Tp + 7 * S;
    const box = c3.createDiv("txi-gh-scroll"), sv = document.createElementNS(SVG, "svg"); sv.setAttribute("width", W); sv.setAttribute("height", H); sv.setAttribute("viewBox", `0 0 ${W} ${H}`); sv.classList.add("txi-gh-svg"); box.appendChild(sv);
    const loc = en ? "en-GB" : "ro-RO"; let lastLabel = -9;
    days.forEach((d, i) => {
      const col = Math.floor(i / 7), row = i % 7, v = d.added;
      const tip = v ? T(`${fmt(v, en)} cuvinte pe ${d.date.toLocaleDateString(loc, { weekday: "long", day: "numeric", month: "long" })}`, `${fmt(v, en)} words on ${d.date.toLocaleDateString(loc, { weekday: "long", day: "numeric", month: "long" })}`) + (d.d ? T(` · ${fmt(d.d, en)} șterse`, ` · ${fmt(d.d, en)} deleted`) : "")
        : T(`Niciun cuvânt pe ${d.date.toLocaleDateString(loc, { day: "numeric", month: "long" })}`, `No words on ${d.date.toLocaleDateString(loc, { day: "numeric", month: "long" })}`);
      const r = rect(sv, L + col * S, Tp + row * S, C, C, "g" + level(v), tip); r.setAttribute("rx", 2);
      if (d.date.getDate() <= 7 && row === 0 || (i === 0)) { if (col - lastLabel >= 3 && cols - col >= 3) { txt(sv, L + col * S, 10, d.date.toLocaleDateString(loc, { month: "short" }).replace(".", ""), "txi-gh-l"); lastLabel = col; } }
    });
    (en ? ["", "Mon", "", "Wed", "", "Fri", ""] : ["", "Lu", "", "Mi", "", "Vi", ""]).forEach((l, i) => l && txt(sv, 0, Tp + i * S + 9, l, "txi-gh-l"));
    const ft = c3.createDiv("txi-gh-foot"); ft.createSpan();
    const lg = ft.createDiv("txi-gh-legend"); lg.createSpan({ text: T("Mai puțin", "Less") }); for (let k = 0; k <= 4; k++) lg.createSpan({ cls: "txi-gh-sq g" + k }); lg.createSpan({ text: T("Mai mult", "More") });
    if (!total) el(c3, "p", "txi-empty", T("Se umple pe măsură ce scrii.", "It fills in as you write."));
  }
  // Scrisul: ce apare în note cât scrii (pornit / oprit dintr-un clic)
  whileWriting(w) {
    const P = this.P, T = (a, b) => P.T(a, b);
    const s = this.sec(w, T("În timp ce scrii", "While you write"), T("Ce apare în notele tale. Toate sunt oprite la început.", "What shows in your notes. All are off to begin with."), null,
      [P.openCompanion ? { text: T("Însoțitorul scrisului", "Writing companion"), onClick: () => P.openCompanion() } : null]);
    const c = s.createDiv("txi-card txi-toggles");
    const row = (name, desc, val, fn) => new Setting(c).setName(name).setDesc(desc).addToggle(t => t.setValue(val).onChange(async v => { await fn(v); }));
    row(T("Afirmații fără citare", "Uncited claims"), T("O linie lângă paragraful care afirmă fără citare, cu ce poți cita.", "A line next to a paragraph that claims without a citation, with what you could cite."), P.settings.claimsInEditor !== false, v => P.claimsToggle(v));
    row(T("Analiza scrisului", "Writing insights"), T("Culori în margine (ce face paragraful) și cuvinte de verificat.", "Margin colors (what each paragraph does) and words to check."), P.settings.voiceInline !== false, v => P.voiceInlineToggle(v));
    row(T("Panourile conceptelor", "Concept panels"), T("Sus în nota unui concept: definițiile și unde apare în scrisul tău.", "At the top of a concept note: its definitions and where it appears in your writing."), P.settings.cpOn === true, v => P.cpToggle(v));
    // însoțitorul scrisului: locul unei ciorne (verificarea ei, paragrafele, ce ai în vault pentru fiecare)
  }
  // Lectura: harta dezbaterii (se deschide în tab-ul ei)
  concepts(w) {
    const P = this.P, T = (a, b) => P.T(a, b);
    // butonul hărții e în capul secțiunii „Referințele și lectura”
    return;
  }
  behaviour(w) {
    const P = this.P, T = (a, b) => P.T(a, b), en = P.en;
    const s = this.sec(w, T("Cum lucrezi", "How you work"), T("Când scrii și cât citești lângă scris.", "When you write, and how much you read next to it."));
    const hab = P.habits({ noMix: true, noReading: true });
    if (hab.length) { const l = s.createEl("ul", "txi-facts"); for (const h of hab) l.createEl("li", { text: h }); }
    const g = s.createDiv("txi-grid txi-work"), h = P.hours(90), wd = P.weekdays(180);
    if (h.some(Boolean) || wd.some(Boolean)) {
      const c2 = this.card(g, T("Orele în care scrii", "When you write"), T("ultimele 90 de zile", "last 90 days")), mh = Math.max(1, ...h), sv = svg(c2.createDiv("txi-chart"), 24 * 11, 70);
      h.forEach((v, i) => { rect(sv, i * 11, 56 - v / mh * 50, 8, Math.max(1, v / mh * 50), v ? "b" : "b0", `${i}:00 — ${v}`); if (i % 6 === 0) txt(sv, i * 11, 67, `${i}`); });
      const mw = Math.max(1, ...wd), sv2 = svg(c2.createDiv("txi-chart"), 7 * 36, 56), names = en ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] : ["Lu", "Ma", "Mi", "Jo", "Vi", "Sâ", "Du"];
      wd.forEach((v, i) => { rect(sv2, i * 36, 42 - v / mw * 36, 28, Math.max(1, v / mw * 36), v ? "b" : "b0", `${names[i]}: ${v}`); txt(sv2, i * 36 + 14, 53, names[i], null, "middle"); });
    }
    const rw = P.readingWriting(12);
    if (rw.some(x => x.r || x.w)) {
      const c3 = this.card(g, T("Lectura lângă scris", "Reading next to writing"), T("ultimele 12 săptămâni", "last 12 weeks"));   // mai lată decât orele: 12 săptămâni
      const mr = Math.max(1, ...rw.map(x => x.r)), mw2 = Math.max(1, ...rw.map(x => x.w)), sv3 = svg(c3.createDiv("txi-chart"), 12 * 44, 84);
      rw.forEach((x, i) => { rect(sv3, i * 44, 70 - x.r / mr * 60, 16, Math.max(1, x.r / mr * 60), x.r ? "b2" : "b0", `${x.wk}: ${x.r} ${T("adnotări", "annotations")}${x.est ? T(" (estimat)", " (estimated)") : ""}`); rect(sv3, i * 44 + 18, 70 - x.w / mw2 * 60, 16, Math.max(1, x.w / mw2 * 60), x.w ? "b" : "b0", `${x.wk}: ${x.w} ${T("cuvinte", "words")}${x.est ? T(" (estimat)", " (estimated)") : ""}`); txt(sv3, i * 44 + 17, 81, x.wk.slice(6), null, "middle"); });
      const lg = c3.createDiv("txi-legend"); lg.createSpan(); const a = lg.createSpan(); a.createEl("i", { cls: "tx-bg-faint" }); a.appendText(T("adnotări", "annotations")); const b = lg.createSpan(); b.createEl("i", { cls: "tx-bg-accent" }); b.appendText(T("cuvinte scrise", "words written"));
      const line = P.readingLine?.(); if (line) el(c3, "p", "txi-muted", line);
      if (rw.some(x => x.est)) c3.createDiv({ cls: "txi-muted txi-small", text: T("Săptămânile dinainte de numărare sunt estimate din notele create atunci.", "Weeks before counting started are estimated from the notes created then.") });
    }
    if (!g.childElementCount) g.remove();
    if (!hab.length && !s.querySelector(".txi-card")) el(s, "p", "txi-empty", T("Apar după câteva zile de scris.", "These appear after a few days of writing."));
  }
  topics(w) {
    const P = this.P, T = (a, b) => P.T(a, b), em = P.emerging();
    // „În creștere” are sens doar cu istoric: dacă toate sunt noi (vault abia început), nu apare
    const rising = em.rising.some(r => r.bef >= 0.5) ? em.rising : [];
    if (!rising.length && !em.unwritten.length && !em.fading.length) return;
    const s = this.sec(w, T("Subiecte", "Topics"), T("Ultimele două luni: ce citești fără să scrii, ce crește, ce se stinge.", "The last two months: what you read without writing, what rises, what fades."), T("Clic pe un concept: povestea lui în vault.", "Click a concept to see its story in your vault."));
    const g = s.createDiv("txi-grid");
    const list = (title, rows, meta) => { if (!rows.length) return; const c = this.card(g, title), l = c.createDiv("txi-list"); for (const r of rows) { const row = this.row(l, r.name, meta(r), () => { this.expanded = this.expanded === r.path ? null : r.path; this.render(); }); if (this.expanded === r.path) this.timeline(l, r.path); } };
    const trend = r => r.bef < 0.5 ? T("nou", "new") : `×${(r.rec / r.bef).toFixed(1)}`;
    list(T("Citite, nescrise", "Read, not written"), em.unwritten, r => T(`${r.n6} referințe`, `${r.n6} references`));
    list(T("În creștere", "Rising"), rising, trend);
    list(T("Se sting", "Fading"), em.fading, trend);
  }
  timeline(parent, path) {
    const P = this.P, T = (a, b) => P.T(a, b), en = P.en, t = P.timeline(path), d = parent.createDiv("txi-detail");
    const when = t.firstAt ? new Date(t.firstAt).toLocaleDateString(en ? "en-GB" : "ro-RO", { month: "long", year: "numeric" }) : "?";
    d.createDiv({ text: T(`Prima dată: ${when}${t.firstSrc ? `, citind ${P.nameOf(t.firstSrc)}` : ""}. În ${t.lit} referințe și ${t.own} note de-ale tale.`, `First seen: ${when}${t.firstSrc ? `, reading ${P.nameOf(t.firstSrc)}` : ""}. In ${t.lit} references and ${t.own} of your notes.`) });
    const mr = Math.max(1, ...t.r), mw = Math.max(1, ...t.w), sv = svg(d.createDiv("txi-chart"), 12 * 30, 50);
    t.months.forEach((m, i) => { rect(sv, i * 30, 38 - t.r[i] / mr * 32, 11, Math.max(1, t.r[i] / mr * 32), t.r[i] ? "b2" : "b0", `${m}: ${t.r[i]}`); rect(sv, i * 30 + 12, 38 - t.w[i] / mw * 32, 11, Math.max(1, t.w[i] / mw * 32), t.w[i] ? "b" : "b0", `${m}: ${t.w[i]}`); txt(sv, i * 30 + 11, 48, m.slice(5), null, "middle"); });
    const a = d.createDiv("txi-actions"); a.createEl("button", { text: T("Deschide nota", "Open the note") }).addEventListener("click", () => P.openPath(path));
    if (P.openMap && P.isTarget?.(path)) a.createEl("button", { text: T("Harta dezbaterii", "Debate map") }).addEventListener("click", () => P.openMap(path));
  }
  patterns(w) {
    const P = this.P, T = (a, b) => P.T(a, b), pairs = P.pairs(8), br = P.bridges(4);
    const s = this.sec(w, T("Tipare ascunse", "Hidden patterns"), T("Concepte care apar împreună, dar nu sunt legate.", "Concepts that appear together but aren't linked."), T("Perechi: concepte care apar împreună în aceleași paragrafe mai des decât la întâmplare, dar pe care nu le-ai legat — adesea, ideile pe care nu le-ai scris încă. Punți: singura notă care leagă un grup de note de restul vault-ului.", "Pairs: concepts that appear together in the same paragraphs more often than chance, but that you haven't linked — often the ideas you haven't written yet. Bridges: the only note connecting a group of notes to the rest of your vault."));
    const g = s.createDiv("txi-grid"), c1 = this.card(g, T("Perechi nelegate", "Unlinked pairs")), l1 = c1.createDiv("txi-list");   // rămâne și gol: spune cum apar
    if (!pairs.length) el(c1, "p", "txi-empty", T("Apar când ai mai multe note și adnotări cu aceleași concepte.", "These appear once you have more notes and annotations sharing concepts."));
    for (const p of pairs) {
      const r = this.row(l1, `${p.an} + ${p.bn}`, T(`${p.count} parag. · ${p.notes.length} note`, `${p.count} para. · ${p.notes.length} notes`), e => { const m = new Menu(); m.addItem(i => i.setTitle(T("Scrie o notă care le leagă", "Write a note that connects them")).setIcon("file-plus").onClick(() => P.connectPair(p))); for (const n of p.notes.slice(0, 8)) m.addItem(i => i.setTitle(P.nameOf(n)).setIcon("file").onClick(() => P.openPath(n, true))); m.addSeparator(); m.addItem(i => i.setTitle(T("Nu sunt legate", "Not related")).setIcon("x").onClick(async () => { P.settings.ignoredPairs = [...new Set([...(P.settings.ignoredPairs || []), [p.a, p.b].sort().join("\u0000")])]; await P.saveSettings(); this.render(); })); m.showAtMouseEvent(e); });
    }
    if (!br.length) return;   // punțile: doar când există
    const c2 = this.card(g, T("Punți", "Bridges")), l2 = c2.createDiv("txi-list");
    for (const b of br) { this.row(l2, b.name, T(`leagă ${b.small.size} note`, `links ${b.small.size} notes`), () => P.openPath(b.path)).title = T(`Fără ea, ${b.small.size} note (de ex. ${b.small.sample.map(x => P.nameOf(x)).join(", ")}) n-ar mai avea legătură cu restul.`, `Without it, ${b.small.size} notes (e.g. ${b.small.sample.map(x => P.nameOf(x)).join(", ")}) would lose their connection to the rest.`); }
  }
  forgotten(w) {
    const P = this.P, T = (a, b) => P.T(a, b), rs = P.resurface(5);
    if (!rs.length) return;   // apar după câteva zile de scris
    const s = this.sec(w, T("De recitit", "Worth rereading"), T("Note uitate care au concepte comune cu scrisul tău recent.", "Forgotten notes that share concepts with your recent writing."), T("Note neatinse de peste două luni, cu concepte comune cu scrisul tău recent.", "Notes untouched for over two months, sharing concepts with your recent writing."));
    const l = s.createDiv("txi-card").createDiv("txi-list");
    for (const r of rs) this.row(l, r.name, T(`${r.months} luni · ${r.shared.join(", ")}`, `${r.months} mo · ${r.shared.join(", ")}`), () => P.openPath(r.path));
  }
  async projectsSec(w) {
    const P = this.P, T = (a, b) => P.T(a, b), en = P.en, list = P.projects(), loc = en ? "en-GB" : "ro-RO", dfmt = d => d.toLocaleDateString(loc, { day: "numeric", month: "long", year: "numeric" });
    const s = this.sec(w, T("Proiectele tale", "Your projects"), T("Un proiect e un folder, o etichetă sau o notă: teza, un articol, un curs.", "A project is a folder, a tag or a note: your thesis, an article, a course."), null, [
      // un singur loc pentru proiecte: Setări → Insights → Proiecte (acolo se adaugă un rând nou)
      { cta: true, text: T("Adaugă un proiect", "Add a project"), onClick: () => { P._addProject = true; P.openSettings("projects"); } },
      list.length ? { text: T("Schimbă proiectele", "Change projects"), onClick: () => P.openSettings("projects") } : null]);
    const g = s.createDiv("txi-grid");
    if (!list.some(p => p.value)) { const c = this.card(g, T("Niciun proiect", "No project yet")); c.createEl("p", { cls: "txi-muted", text: T("Adaugă-l cu butonul de sus.", "Add one with the button above.") }); }
    for (const p of list) {
      if (!p.value) continue;   // un rând început în setări, încă fără folder, etichetă sau notă
      const th = P.project(p), c1 = this.card(g, th.name, th.value.startsWith("#") ? th.value : null), n = c1.createDiv("txi-nums");
      this.num(n, th.words, T("cuvinte acum", "words now")); this.num(n, th.avg, T("pe săptămână", "per week")); if (th.target) this.num(n, th.target, T("ținta", "target"));
      if (th.target) { const bar = c1.createDiv("txi-bar"); bar.createDiv().setCssStyles({ width: Math.min(100, th.words / th.target * 100) + "%" }); }
      const dl = th.deadline ? dfmt(th.deadline) : null;
      if (!th.exists) c1.createEl("p", { text: T(`„${th.value}” nu mai e în vault. Alege-l din nou în setări.`, `“${th.value}” isn't in the vault anymore. Choose it again in the settings.`) });
      else if (!th.target) c1.createEl("p", { text: T("Pune o țintă (și un termen) ca să vezi când ajungi acolo.", "Set a target (and a deadline) to see when you'll get there.") });
      else if (th.words >= th.target) c1.createEl("p", { text: T("Ținta e atinsă.", "Target reached.") });
      else { c1.createEl("p", { text: th.eta ? T(`În ritmul ăsta ajungi la țintă pe ${dfmt(th.eta)}${dl ? ` (termenul: ${dl})` : ""}.`, `At this pace you reach the target on ${dfmt(th.eta)}${dl ? ` (deadline: ${dl})` : ""}.`) : T("N-ai scris aici în ultimele 4 săptămâni.", "You haven't written here in the last 4 weeks.") }); if (th.perWeek != null) c1.createEl("p", { text: T(`Ca să prinzi termenul: ~${fmt(th.perWeek, en)} cuvinte pe săptămână.`, `To make the deadline: ~${fmt(th.perWeek, en)} words a week.`) }); }
      if (!th.weeks.some(x => x.net > 0)) continue;   // graficul săptămânilor: doar când ai scris în ele
      const mx = Math.max(1, ...th.weeks.map(x => Math.abs(x.net))), sv = svg(c1.createDiv("txi-chart"), 8 * 40, 50);
      th.weeks.forEach((x, i) => { rect(sv, i * 40, 38 - Math.max(0, x.net) / mx * 32, 26, Math.max(1, Math.max(0, x.net) / mx * 32), x.net > 0 ? "b" : "b0", `${x.wk}: ${x.net}`); txt(sv, i * 40 + 13, 48, x.wk.slice(6), null, "middle"); });
    }
    const g2 = s.createDiv("txi-grid tx-mt12");
    // țintele notelor
    const c2 = this.card(g2, T("Ținte de cuvinte", "Word targets")), l2 = c2.createDiv("txi-list"), tg = P.targets();
    if (!tg.length) el(c2, "p", "txi-empty", T("Nicio notă cu țintă. Meniul ⋯ al notei → Pune o țintă de cuvinte.", "No note has a target. The note's ⋯ menu → Set a word target."));
    for (const t of tg) { const r = this.row(l2, t.file.basename, t.words == null ? `${fmt(t.target, en)}` : `${fmt(t.words, en)} / ${fmt(t.target, en)}`, () => P.openPath(t.file.path)); if (t.words != null) { const b = l2.createDiv("txi-bar"); b.createDiv().setCssStyles({ width: Math.min(100, t.words / t.target * 100) + "%" }); } }
    // afirmații fără citare
    const c3 = this.card(g2, T("Afirmații fără citare", "Uncited claims"), T("în proiecte", "in your projects")), l3 = c3.createDiv("txi-list"); let total = 0;
    for (const f of this.P.app.vault.getMarkdownFiles()) {
      if (!P.inAnyProject(f.path)) continue;
      const list = P.uncitedIn(await P.app.vault.cachedRead(f), f.path); if (!list.length) continue; total += list.length;
      this.row(l3, f.basename, T(`${list.length} parag.`, `${list.length} para.`), async () => { const leaf = P.app.workspace.getLeaf(false); await leaf.openFile(f); const ed = leaf.view?.editor; if (ed) { const pos = ed.offsetToPos(list[0].from); ed.setCursor(pos); ed.scrollIntoView({ from: pos, to: pos }, true); } });
    }
    if (!list.length) el(c3, "p", "txi-empty", T("Se caută în notele proiectelor: adaugă un proiect.", "Looked for in your projects' notes: add a project."));
    else if (!total) el(c3, "p", "txi-empty", T("Niciunul. Bravo.", "None. Well done."));
    else c3.createEl("p", { cls: "txi-muted", text: T("Le vezi în notă cu „Afirmații fără citare” (fila Scrisul).", "See them in the note with “Uncited claims” (Writing tab).") });
  }
  sources(w) {
    const P = this.P, T = (a, b) => P.T(a, b), en = P.en, projects = P.projects();
    const s = this.sec(w, T("Referințele și lectura", "References and reading"), T("Pe cine citezi, ce adnotezi, ce întrebări îți rămân.", "Who you cite, what you annotate, which questions stay open."), null,
      [P.debateMap ? { text: T("Harta dezbaterii…", "Debate map…"), title: T("Ce spun referințele tale despre un concept și unde ești tu", "What your references say about a concept, and where you stand"), onClick: () => P.debateMap() } : null]);
    if (!P.hasSources()) s.createDiv({ cls: "txi-note", text: T("Cu modulul Referințe oprit, cifrele de aici sunt aproximative.", "With the References module off, these numbers are approximate.") });
    const g = s.createDiv("txi-grid"), c1 = this.card(g, T("Echilibrul citărilor", "Balance of citations"));
    const tabs = c1.createDiv("txi-tabs"); for (const [id, l] of [["", T("Toate notele", "All notes")], ...projects.map((p, i) => [String(i), P.projectName(p)])]) { const b = tabs.createEl("button", { text: l, cls: this.balScope === id ? "on" : "" }); b.addEventListener("click", () => { this.balScope = id; this.render(); }); }
    const b = P.balance(this.balScope ? projects[+this.balScope] : null);
    if (!b.total) el(c1, "p", "txi-empty", T("Nicio citare [@…] încă.", "No [@…] citations yet."));
    else {
      const n = c1.createDiv("txi-nums"); this.num(n, b.total, T("citări", "citations")); this.num(n, b.unique, T("referințe", "references"));
      if (b.top && b.unique > 2) c1.createEl("p", { text: T(`${Math.round(b.top.share * 100)}% din citări sunt la ${b.top.name}${b.top.share > .35 ? " — te sprijini mult pe un singur autor." : "."}`, `${Math.round(b.top.share * 100)}% of your citations are to ${b.top.name}${b.top.share > .35 ? " — you lean heavily on one author." : "."}`) });
      if (b.newest) c1.createEl("p", { text: T(`Referințele tale: ${b.oldest}–${b.newest}${new Date().getFullYear() - b.newest > 8 ? ` — nimic din ultimii ${new Date().getFullYear() - b.newest} ani.` : "."}`, `Your references: ${b.oldest}–${b.newest}${new Date().getFullYear() - b.newest > 8 ? ` — nothing from the last ${new Date().getFullYear() - b.newest} years.` : "."}`) });
      const langs = Object.entries(b.langs).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k.toUpperCase()} ${Math.round(v / b.total * 100)}%`).join(" · "); c1.createEl("p", { text: T(`Limbi: ${langs}`, `Languages: ${langs}`) });
      const dec = Object.entries(b.decades).sort((x, y) => x[0] - y[0]); if (dec.length > 1) { const md = Math.max(...dec.map(d => d[1])), sv = svg(c1.createDiv("txi-chart"), dec.length * 34, 50); dec.forEach(([d, v], i) => { rect(sv, i * 34, 38 - v / md * 32, 24, Math.max(1, v / md * 32), "b", `${d}s: ${v}`); txt(sv, i * 34 + 12, 48, `’${String(d).slice(2)}`, null, "middle"); }); }
    }
    const cl = P.claims(), c2 = this.card(g, T("Ce adnotezi", "What you annotate"));
    if (!cl.total) el(c2, "p", "txi-empty", T("Nicio adnotare încă.", "No annotations yet."));
    else {
      // etichetele, cu culoarea lor din PDF++ (fără „#”), cele mai folosite 4
      const pal = P.app.plugins?.plugins?.["pdf-plus"]?.settings?.colors || {}, colorOf = k => { const e = Object.entries(pal).find(([n]) => n.toLowerCase() === k); return e ? e[1] : null; };
      const n = c2.createDiv("txi-nums"); for (const [k, v] of Object.entries(cl.tot).sort((x, y) => y[1] - x[1]).slice(0, 4)) { this.num(n, v, k); const c = colorOf(k), lab = n.lastElementChild?.querySelector("span"); if (c && lab) { const d = createSpan({ cls: "txi-dot" }); d.style.background = c; lab.prepend(d); } }
      const q = cl.tot.question || 0, c = cl.tot.claim || 0; if (c && q) c2.createEl("p", { text: c > q * 3 ? T(`Marchezi de ${Math.round(c / q)} ori mai multe afirmații decât întrebări: citești mai mult ca să aduni decât ca să întrebi.`, `You mark ${Math.round(c / q)}× more claims than questions: you read more to collect than to question.`) : T(`Un echilibru bun între afirmații (${c}) și întrebări (${q}).`, `A good balance of claims (${c}) and questions (${q}).`) });
      const ag = cl.tot.agree || 0, dg = cl.tot.disagree || 0; if (ag + dg >= 5) c2.createEl("p", { text: dg < ag / 3 ? T(`Rar nu ești de acord (${dg} față de ${ag}). Caută și autori cu care nu ești de acord.`, `You rarely disagree (${dg} vs ${ag}). Look for authors you disagree with, too.`) : T(`De acord: ${ag} · Nu: ${dg}.`, `Agree: ${ag} · Disagree: ${dg}.`) });
      // cele mai adnotate referințe, doar cu numărul (detaliul pe culori e în panoul fiecărei referințe)
      const l = c2.createDiv("txi-list"); for (const r of cl.per.slice(0, 3)) this.row(l, r.name, String(Object.values(r.hl).reduce((a, b) => a + b, 0)), () => P.openPath(r.path));
    }
    const oq = P.openQuestions(), c3 = this.card(g, T("Întrebări deschise", "Open questions"), T(`${oq.length}`, `${oq.length}`));
    if (!oq.length) el(c3, "p", "txi-empty", T("Nicio întrebare din lectură fără răspuns în notele tale.", "No question from your reading left unanswered in your notes."));
    else { c3.createEl("p", { text: T("Întrebări (#question) din referințe pe care nu le-ai citat încă:", "Questions (#question) from references you haven't cited yet:") }); const l = c3.createDiv("txi-list"); for (const q of oq.slice(0, 5)) { const r = this.row(l, q.q, q.source, () => P.openPath(q.path)); r.querySelector(".txi-name")?.addClass("tx-wrap"); } }
  }
  links(w) {
    const P = this.P, T = (a, b) => P.T(a, b), un = P.visibleUnlinked();
    const tf = P.targetFolders(), where = tf.length ? tf.join(", ") : T("notele cu aliasuri", "notes with aliases");
    const s = this.sec(w, T("De pus în ordine", "To tidy"), T("Menționări fără link, nume fără notă, aliasuri și dubluri.", "Mentions without a link, names without a note, aliases and duplicates."), T(`Se caută singure, la 30 de minute, după titlurile și aliasurile notelor-concept (${where}).`, `Found automatically every 30 minutes, from the titles and aliases of your concept notes (${where}).`));
    // un singur card: fereastra de revizuire are o filă pentru fiecare (menționări, nume, aliasuri, dubluri)
    const kinds = [[un.length, "links", n => T(`${n} ${n === 1 ? "menționare" : "menționări"} fără link`, `${n} unlinked ${n === 1 ? "mention" : "mentions"}`)],
      [(P.names || []).length, "names", n => T(`${n} ${n === 1 ? "nume" : "nume"} fără notă`, `${n} ${n === 1 ? "name" : "names"} without a note`)],
      [(P.aliasSugg || []).length, "aliases", n => T(`${n} ${n === 1 ? "alias sugerat" : "aliasuri sugerate"}`, `${n} suggested ${n === 1 ? "alias" : "aliases"}`)],
      [(P.duplicates || []).length, "dups", n => T(`${n} ${n === 1 ? "posibilă dublură" : "posibile dubluri"}`, `${n} possible ${n === 1 ? "duplicate" : "duplicates"}`)]].filter(k => k[0]);
    const c = s.createDiv("txi-card txi-todo-card");
    if (!kinds.length) { el(c, "p", "txi-empty", T("Nimic de pus în ordine. Se caută singur, la 30 de minute.", "Nothing to tidy. Texere looks again every 30 minutes.")); return; }
    const l = c.createDiv("txi-list");
    for (const [n, tab, label] of kinds) this.row(l, label(n), T("Revizuiește", "Review"), () => P.review(tab));
  }
  async onClose() {}
}

// ——— fereastra de revizuire: menționări fără link, nume fără notă, aliasuri, dubluri ———
class ReviewModal extends Modal {
  constructor(P, tab) { super(P.app); this.P = P; this.tab = tab || "links"; this.sel = new Set(); this.inited = false; }
  async onOpen() {
    this.modalEl.addClass("txi-review"); this.titleEl.setText(this.P.T("Linkuri și aliasuri", "Links and aliases"));
    if (!this.P.scanCache?.at) { this.contentEl.setText(this.P.T("Citesc vault-ul…", "Reading your vault…")); await this.P.scan(false, true); }
    this.draw();
  }
  draw() {
    const P = this.P, T = (a, b) => P.T(a, b), c = this.contentEl, keep = c.querySelector(".txi-rbody")?.scrollTop || 0; c.empty();
    const nav = c.createDiv("txi-rnav"), un = P.visibleUnlinked();
    if (!this.inited) { this.inited = true; for (const u of un) if (!u.amb && !u.common) this.sel.add(u.note + "\u0000" + u.target); }
    for (const [id, l, n] of [["links", T("Menționări fără link", "Unlinked mentions"), un.length], ["names", T("Nume fără notă", "Names without a note"), (P.names || []).length], ["aliases", T("Aliasuri", "Aliases"), (P.aliasSugg || []).length], ["dups", T("Dubluri", "Duplicates"), (P.duplicates || []).length]]) {
      const s = nav.createSpan({ cls: this.tab === id ? "on" : "", text: l }); s.createEl("em", { text: String(n) }); s.addEventListener("click", () => { this.tab = id; this.draw(); });
    }
    const body = c.createDiv("txi-rbody"), foot = c.createDiv("txi-rfoot");
    const rescan = foot.createEl("button", { text: T("Caută din nou", "Scan again") }); rescan.addEventListener("click", async () => { rescan.disabled = true; rescan.setText("…"); await P.scan(true, true); this.draw(); });
    if (this.tab === "links") this.drawLinks(body, foot, un);
    else if (this.tab === "names") this.drawNames(body, foot);
    else if (this.tab === "aliases") this.drawAliases(body, foot);
    else this.drawDups(body, foot);
    body.scrollTop = keep;
  }
  drawLinks(body, foot, un) {
    const P = this.P, T = (a, b) => P.T(a, b);
    foot.createDiv({ cls: "txi-muted", text: T("Se leagă doar prima menționare din fiecare notă; textul rămâne cum l-ai scris.", "Only the first mention in each note is linked; your text stays as you wrote it.") });
    if (!un.length) { body.createDiv({ cls: "txi-empty", text: T("Nicio menționare fără link. Totul e legat.", "No unlinked mentions. Everything is linked.") }); return; }
    const groups = {}; for (const u of un) (groups[u.target] = groups[u.target] || []).push(u);
    // întâi conceptele clare, apoi cele care sunt și cuvinte obișnuite (nebifate: verifică-le)
    let commonShown = false;
    for (const [target, list] of Object.entries(groups).sort((a, b) => (a[1][0].common - b[1][0].common) || b[1].length - a[1].length)) {
      if (list[0].common && !commonShown) { commonShown = true; body.createDiv({ cls: "txi-lead", text: T("Mai jos: concepte care sunt și cuvinte obișnuite. Bifează doar unde chiar e conceptul.", "Below: concepts that are also everyday words. Tick only where it really is the concept.") }); }
      const g = body.createDiv("txi-grp"), h = g.createDiv("txi-grp-h"), all = h.createEl("input", { type: "checkbox" }), key = u => u.note + "\u0000" + u.target;
      all.checked = list.every(u => this.sel.has(key(u))); all.addEventListener("change", () => { for (const u of list) all.checked ? this.sel.add(key(u)) : this.sel.delete(key(u)); this.draw(); });
      h.createSpan({ text: P.nameOf(target) }); h.createSpan({ cls: "txi-meta", text: T(`${list.length} ${list.length === 1 ? "notă" : "note"} · ${target}`, `${list.length} ${list.length === 1 ? "note" : "notes"} · ${target}`) });
      const ga = h.createDiv("txi-gact");
      ga.createEl("button", { text: T("Deschide nota", "Open note") }).addEventListener("click", () => P.openPath(target, true));
      ga.createEl("button", { text: T("Ignoră termenul", "Ignore term") }).addEventListener("click", async () => { await P.ignoreTerm(target); this.draw(); });
      for (const u of list) {
        const r = g.createDiv("txi-hit"), cb = r.createEl("input", { type: "checkbox" }); cb.checked = this.sel.has(key(u)); cb.addEventListener("change", () => { cb.checked ? this.sel.add(key(u)) : this.sel.delete(key(u)); this.updateFoot(); });
        const cx = r.createDiv("txi-ctx"); cx.appendText(u.b); cx.createEl("mark", { text: u.hit }); cx.appendText(u.a);
        cx.createSpan({ cls: "txi-in", text: P.nameOf(u.note) + (u.amb ? T(" · mai multe note au acest termen", " · several notes share this term") : "") }); cx.addClass("tx-pointer"); cx.addEventListener("click", () => { cb.checked = !cb.checked; cb.dispatchEvent(new Event("change")); });
        if (u.alt) cx.createSpan({ cls: "txi-in txi-alt-to", text: T(`→ se leagă cu „${P.nameOf(u.alt)}”`, `→ links to “${P.nameOf(u.alt)}”`) });
        const al = r.createSpan({ cls: "txi-x txi-alt", text: T("Leagă cu…", "Link with…") }); al.title = T("Alege altă notă pentru acest link", "Choose another note for this link");
        al.addEventListener("click", () => new NotePicker(P, f => { u.alt = f.path === u.target ? null : f.path; this.sel.add(key(u)); this.draw(); }).open());
        const x = r.createSpan({ cls: "txi-x", text: "✕" }); x.title = T("Nu aici: nu mai sugera acest link în nota asta", "Not here: don't suggest this link in this note again"); x.addEventListener("click", async () => { await P.notHereAdd(u.note, u.target); this.sel.delete(key(u)); this.draw(); });
      }
    }
    this.linkBtn = foot.createEl("button", { cls: "mod-cta" }); this.updateFoot();
    this.linkBtn.addEventListener("click", async () => {
      const items = un.filter(u => this.sel.has(u.note + "\u0000" + u.target)); if (!items.length) return;
      this.linkBtn.disabled = true; this.linkBtn.setText("…");
      const r = await P.applyLinks(items); for (const i of items) this.sel.delete(i.note + "\u0000" + i.target);
      new Notice(T(`Am pus ${r.done} linkuri${r.missed ? `; ${r.missed} n-au mai fost găsite (nota s-a schimbat)` : ""}.`, `Added ${r.done} links${r.missed ? `; ${r.missed} couldn't be found anymore (the note changed)` : ""}.`), 6000);
      this.draw();
    });
  }
  updateFoot() { if (!this.linkBtn) return; const n = this.P.visibleUnlinked().filter(u => this.sel.has(u.note + "\u0000" + u.target)).length; this.linkBtn.setText(this.P.T(`Leagă ${n} selectate`, `Link ${n} selected`)); this.linkBtn.disabled = !n; }
  drawNames(body, foot) {
    const P = this.P, T = (a, b) => P.T(a, b), names = P.names || [];
    foot.createDiv({ cls: "txi-muted", text: T("Nume cu literă mare care apar de cel puțin 3 ori, în cel puțin 2 note, și n-au notă.", "Capitalized names that appear at least 3 times, in at least 2 notes, and have no note.") });
    if (!names.length) { body.createDiv({ cls: "txi-empty", text: T("Niciun nume fără notă.", "No names without a note.") }); return; }
    for (const n of names) {
      const r = body.createDiv("txi-row"); r.createSpan({ cls: "txi-name", text: n.name }); r.createSpan({ cls: "txi-meta", text: T(`${n.count}× · ${n.notes.length} note`, `${n.count}× · ${n.notes.length} notes`) });
      r.createEl("button", { text: T("Creează nota", "Create note") }).addEventListener("click", () => new CreateNoteModal(P, n.name, async () => { await P.scan(false, true); this.draw(); }).open());
      r.createEl("button", { text: T("Ignoră", "Ignore") }).addEventListener("click", async () => { P.settings.ignoredNames = [...new Set([...(P.settings.ignoredNames || []), n.name])]; await P.saveSettings(); P.names = names.filter(x => x !== n); this.draw(); });
    }
  }
  drawAliases(body, foot) {
    const P = this.P, T = (a, b) => P.T(a, b), list = P.aliasSugg || [];
    const why = { link: T("textul linkurilor tale", "your link text"), spelling: T("cum scrii", "how you spell it"), short: T("formă scurtă", "short form"), wikidata: "Wikidata", wikipedia: "Wikipedia", mymemory: "MyMemory" };
    const wd = foot.createEl("button", { text: T("Caută traduceri", "Look up translations") }); wd.title = T("Pentru conceptele fără alias: numele în română din Wikidata, Wikipedia și MyMemory. Cu cât sunt de acord mai multe, cu atât sugestia e mai sigură. Singura parte care folosește internetul.", "For concepts without an alias: the Romanian name from Wikidata, Wikipedia and MyMemory. The more of them agree, the safer the suggestion. The only part that uses the internet.");
    wd.addEventListener("click", async () => { wd.disabled = true; const r = await P.translate((d, t) => wd.setText(`${d}/${t}`)); new Notice(T(`Traduceri pentru ${r.got} din ${r.asked} concepte (Wikidata, Wikipedia, MyMemory).`, `Translations for ${r.got} of ${r.asked} concepts (Wikidata, Wikipedia, MyMemory).`), 6000); this.draw(); });
    foot.createDiv({ cls: "txi-muted", text: T("Aliasurile noi ajută la găsirea menționărilor și la căutare.", "New aliases help find mentions and search.") });
    if (!list.length) { body.createDiv({ cls: "txi-empty", text: T("Nicio sugestie acum.", "No suggestions right now.") }); return; }
    for (const s of list) {
      const r = body.createDiv("txi-row"); const nm = r.createSpan({ cls: "txi-name" }); nm.createEl("b", { text: s.alias }); nm.appendText(T(" → ", " → ") + P.nameOf(s.target)); for (const w of s.why) nm.createSpan({ cls: "txi-why", text: why[w] || w });
      const tr = s.why.filter(w => ["wikidata", "wikipedia", "mymemory"].includes(w)).length;
      r.createSpan({ cls: "txi-meta", text: tr ? T(`${tr}/3 referințe`, `${tr}/3 references`) : s.count > 1 ? `${s.count}×` : "" });
      r.createEl("button", { cls: "mod-cta", text: T("Adaugă", "Add") }).addEventListener("click", async () => { await P.addAlias(s.target, s.alias); this.draw(); });
      r.createEl("button", { text: T("Ignoră", "Ignore") }).addEventListener("click", async () => { await P.ignoreAlias(s.target, s.alias); this.draw(); });
    }
  }
  drawDups(body, foot) {
    const P = this.P, T = (a, b) => P.T(a, b), list = P.duplicates || [];
    foot.createDiv({ cls: "txi-muted", text: T("Note cu același titlu sau alias (sau aproape). Unește-le tu, dacă sunt aceeași idee.", "Notes with the same title or alias (or nearly). Merge them yourself if they're the same idea.") });
    if (!list.length) { body.createDiv({ cls: "txi-empty", text: T("Nicio dublură.", "No duplicates.") }); return; }
    for (const d of list) {
      const r = body.createDiv("txi-row"); r.createSpan({ cls: "txi-name", text: `${P.nameOf(d.a)} ↔ ${P.nameOf(d.b)}` }); r.createSpan({ cls: "txi-meta", text: d.why.join(", ") });
      r.createEl("button", { text: T("Deschide-le", "Open both") }).addEventListener("click", () => { P.openPath(d.a, true); P.openPath(d.b, true); });
      r.createEl("button", { text: T("Nu sunt dubluri", "Not duplicates") }).addEventListener("click", async () => { await P.notDuplicate(d.a, d.b); this.draw(); });
    }
  }
}

// alegi nota cu care se face linkul (oricare din vault)
class NotePicker extends require("obsidian").FuzzySuggestModal {
  constructor(P, done, ph) { super(P.app); this.P = P; this.done = done; this.setPlaceholder(ph || P.T("Leagă cu nota…", "Link with the note…")); }
  getItems() { return this.app.vault.getMarkdownFiles(); }
  getItemText(f) { return f.path.replace(/\.md$/, ""); }
  onChooseItem(f) { this.done(f); }
}

class CreateNoteModal extends Modal {
  constructor(P, name, done) { super(P.app); this.P = P; this.name = name; this.done = done; }
  onOpen() {
    const P = this.P, T = (a, b) => P.T(a, b), c = this.contentEl; this.titleEl.setText(T("Notă nouă", "New note"));
    const folders = P.vaultFolders(); let name = this.name, folder = P.settings.namesFolder || (folders.find(f => /authors$/i.test(f)) || P.targetFolders()[0] || "");
    const tpls = this.app.vault.getMarkdownFiles().filter(f => /templates?\//i.test(f.path)); let tpl = (tpls.find(f => /new author/i.test(f.basename)) || {}).path || "";
    new Setting(c).setName(T("Nume", "Name")).addText(t => t.setValue(name).onChange(v => { name = v; }));
    new Setting(c).setName(T("Folder", "Folder")).addDropdown(d => { for (const f of folders) d.addOption(f, f); d.setValue(folder).onChange(v => { folder = v; }); });
    new Setting(c).setName(T("Șablon", "Template")).addDropdown(d => { d.addOption("", T("fără", "none")); for (const f of tpls) d.addOption(f.path, f.basename); d.setValue(tpl).onChange(v => { tpl = v; }); });
    const bc = c.createDiv("modal-button-container");
    bc.createEl("button", { text: T("Renunță", "Cancel") }).addEventListener("click", () => this.close());
    bc.createEl("button", { cls: "mod-cta", text: T("Creează", "Create") }).addEventListener("click", async () => { P.settings.namesFolder = folder; await P.saveSettings(); const f = await P.createNote(name, folder, tpl); this.close(); new Notice(T(`Am creat „${f.basename}”. Menționările ei apar acum la „Menționări fără link”.`, `Created “${f.basename}”. Its mentions now show under “Unlinked mentions”.`), 6000); this.done?.(); });
  }
  onClose() { this.contentEl.empty(); }
}


module.exports = { UiMixin, VIEW, InsightsView, ReviewModal };
