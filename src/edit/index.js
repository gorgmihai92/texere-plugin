// Modul Editare al lui Texere: încerci variante ale unui cuvânt, ale unei propoziții sau ale unui paragraf direct în notă,
// estompezi un pasaj ca să citești pagina fără el, pui deoparte ce nu-ți trebuie acum. Nimic nu e definitiv până nu alegi tu.
// Nu e un modul separat: îl pornește nucleul și nu se vede nimic până nu pornești Editarea pe o notă
// (✎ din colțul notei, elementul Texere din bara de jos, clic dreapta → Texere, sau comanda „Modul Editare”).
// „Verifică” folosește „Verifică ciorna” din Insights (fără AI), dacă Insights e pornit.
// După Wordplay de Rob Hardy (MIT), după Write_On al lui Jason Fried. Fără AI deocamdată (în setări e doar locul pentru o cheie).
const { MarkdownView, Notice, Menu, TFile, normalizePath, moment } = require("obsidian");
const { status } = require("../shared/status");
const { noteMenu } = require("../shared/notemenu");
const { makeEdit, EV } = require("./cm");
const { makeOverflow } = require("./overflow");
const { trim } = require("./trim");

// în plus față de Insights, doar pentru semnele din modul Editare (nu schimbă statisticile din Insights)
const SURE = /(?<![\p{L}\p{N}])(?:of course|for sure|certainly|without a doubt|there is no doubt that|everyone knows|desigur|bineînțeles|bineinteles|cu siguranță|cu siguranta|fără îndoială|fara indoiala|oricine știe|oricine stie)(?![\p{L}\p{N}])/giu;
const NONE = { long: ["Nicio propoziție de peste 25 de cuvinte.", "No sentences over 25 words."], hedge: ["Nicio ezitare sau umplutură aici.", "No hedges or filler here."], slip: ["Niciun cuvânt nepotrivit tonului aici.", "No words out of tone here."], commit: ["Nicio afirmație prea tare aici.", "No claims stated too strongly here."], opinion: ["Nicio opinie personală aici.", "No personal opinions here."] };

const ASIDE_RX = /^%% texere: set aside ([^%\n]*) %%\n([\s\S]*?)(?=\n%% texere: set aside |\s*$)/gm;

// unde stăteau, în versiunile vechi, notele „Pune deoparte”: lângă notă, „<nota> · set aside.md” (acum Deoparte-ul notei e în Support/Texere/Overflow; cele vechi sunt preluate de acolo)
const asidePath = f => normalizePath((f.parent && f.parent.path && f.parent.path !== "/" ? f.parent.path + "/" : "") + `${f.basename} · set aside.md`);
const parseAside = text => { const out = []; String(text || "").replace(ASIDE_RX, (m, at, body) => { out.push({ at: at.trim(), text: body.replace(/\s+$/, ""), raw: m }); return m; }); return out; };

// locul unui text în notă, cel mai aproape de unde era
function nearest(doc, needle, near) {
  if (!needle) return -1; let best = -1;
  for (let i = doc.indexOf(needle); i !== -1; i = doc.indexOf(needle, i + 1)) {
    if (best === -1 || Math.abs(i - near) < Math.abs(best - near)) best = i;
    if (i > near && i - near > Math.abs(best - near)) break;
  }
  return best;
}

function install(P) {
  const T = (a, b) => P.T(a, b);
  const on = new Set();                 // notele în modul Editare (doar cât e deschis Obsidian)
  let lastMd = null;                    // nota din față (ultima notă activă): Deoparte ține doar de ea
  const conf = () => { if (!P.settings.edit || typeof P.settings.edit !== "object") P.settings.edit = {}; if (!P.settings.edit.notes) P.settings.edit.notes = {}; return P.settings.edit; };
  let saveT = 0; const saveSoon = () => { clearTimeout(saveT); saveT = setTimeout(() => P.save().catch?.(() => {}), 400); };
  const fileOf = path => { const f = path && P.app.vault.getAbstractFileByPath(path); return f instanceof TFile ? f : null; };
  const mdViews = () => (P.app.workspace.getLeavesOfType?.("markdown") || []).map(l => l.view).filter(v => v && v.file);
  const activePath = () => { const v = P.app.workspace.getActiveViewOfType?.(MarkdownView); return v?.file?.path || null; };
  const current = () => { const a = activePath(); if (a) lastMd = a; return lastMd && fileOf(lastMd) ? lastMd : null; };
  const cmOf = v => v?.editor?.cm || null;
  const refreshViews = path => { for (const v of mdViews()) if (!path || v.file.path === path) { try { cmOf(v)?.dispatch({}); } catch (e) {} } };

  const E = {
    T,
    isOn: path => !!path && on.has(path),
    canCheck: () => typeof P.mod?.("insights")?.weakSpots === "function",
    async check(text, path, kinds) {
      const I = P.mod?.("insights"); if (typeof I?.weakSpots !== "function") return null;
      let marks = []; try { marks = I.weakSpots(text, path, kinds, { long: 25 }) || []; } catch (e) { console.warn("Texere: Lab", e); new Notice(T("Verificarea n-a mers: ", "The check didn't work: ") + (e?.message || e), 5000); return null; }
      const extra = [], free = (a, b) => !marks.some(m => a < m.to && b > m.from) && !extra.some(m => a < m.to && b > m.from);
      // „ezitări și umplutură”: și umplutura (very, really, just, foarte, de fapt…), ca în scurtarea ușoară
      if (kinds?.includes("hedge")) for (const x of trim(text, 1).spans) { const t = text.slice(x.from, x.to).replace(/\s+$/, ""), b = x.from + t.length; if (t && free(x.from, b)) extra.push({ from: x.from, to: b, kind: "filler", why: T("Umplutură: fraza spune la fel și fără ea.", "Filler: the sentence says the same without it.") }); }
      if (kinds?.includes("commit")) { const fm = /^---\n[\s\S]*?\n---(\n|$)/.exec(text), off = fm ? fm[0].length : 0; let m; SURE.lastIndex = off; while ((m = SURE.exec(text))) { const a = m.index, b = a + m[0].length; if (free(a, b)) extra.push({ from: a, to: b, kind: "commit", why: T("Spus ca sigur: argumentul arată chiar atât?", "Stated as certain: does the argument show that much?") }); } }
      marks = [...marks, ...extra].sort((a, b) => a.from - b.from);
      if (!marks.length) { const k = (kinds || [])[0], msg = NONE[k] || ["Nimic de felul ăsta aici.", "Nothing like that here."]; new Notice(T(msg[0], msg[1]), 3500); }
      return marks;
    },
    // variantele și estompările notei, regăsite după text (nota se poate schimba între timp)
    load(path, doc) {
      const s = conf().notes[path]; if (!s) return { spots: [], dims: [] };
      const spots = [], taken = [];
      for (const x of s.spots || []) {
        if (!Array.isArray(x.options) || x.options.length < 2) continue;
        let cur = Math.min(Math.max(0, x.cur | 0), x.options.length - 1), at = nearest(doc, x.options[cur], x.at | 0);
        if (at < 0) for (let i = 0; i < x.options.length && at < 0; i++) { const a = nearest(doc, x.options[i], x.at | 0); if (a >= 0) { at = a; cur = i; } }
        if (at < 0) continue; const to = at + x.options[cur].length;
        if (taken.some(([f, t]) => at < t && to > f)) continue; taken.push([at, to]);
        spots.push({ id: "v" + spots.length + Date.now().toString(36), from: at, to, options: x.options.slice(), cur });
      }
      const dims = [];
      for (const d of s.dims || []) { const at = nearest(doc, d.text, d.at | 0); if (at >= 0 && d.text) dims.push({ id: "d" + dims.length + Date.now().toString(36), from: at, to: at + d.text.length, text: d.text }); }
      return { spots: spots.sort((a, b) => a.from - b.from), dims: dims.sort((a, b) => a.from - b.from) };
    },
    save(path, items) {
      const c = conf(), spots = items.spots.filter(s => s.options.length > 1).map(s => ({ options: s.options, cur: s.cur, at: s.from })), dims = items.dims.map(d => ({ text: d.text, at: d.from }));
      if (spots.length || dims.length) c.notes[path] = { spots, dims }; else delete c.notes[path];
      saveSoon();
    },
    toggle(path, v) {
      if (!path) return; const want = v === undefined ? !on.has(path) : !!v;
      if (want) on.add(path); else on.delete(path);
      for (const view of mdViews()) if (view.file.path === path) { try { cmOf(view)?.dispatch({ effects: X.effects.setOn.of(want) }); } catch (e) {} }
      // Deoparte nu se deschide singur: îl deschizi din bară (butonul Deoparte); dacă e deschis, trece pe nota asta
      if (want) { lastMd = path; const v = mdViews().find(x => x.file.path === path); v?.editor?.focus?.(); O.follow(); }
      else { O.hideIfOurs(); O.follow(); }
      paintActions(); status(P).refresh();
    },
    anyOn: () => on.size > 0,
    // nota pentru care lucrează Deoparte: doar cea din față, și doar dacă e în modul Editare (nu una generală)
    current,
    target: () => { const c = current(); return c && on.has(c) ? c : null; },
    targetView: () => { const t = E.target(); const act = P.app.workspace.getActiveViewOfType?.(MarkdownView); return act?.file?.path === t ? act : mdViews().find(v => v.file.path === t) || null; },
    showOverflow: () => O.show(true),
    // butonul Deoparte din bară: îl deschide sau îl închide
    overflowOpen: () => (P.app.workspace.getLeavesOfType?.(O.VIEW) || []).length > 0,
    async toggleOverflow() { if (E.overflowOpen()) O.close(); else await O.show(true); },
    // „Pune deoparte”: textul pleacă din notă în panoul Deoparte (Overflow), păstrat în nota de alături; nu se șterge nimic
    async stash(view, text) {
      const path = view.state.field(X.fields.uiField).path; if (!fileOf(path)) return false;
      try { await O.stash(path, text); } catch (e) { new Notice(T("N-am putut muta în Tăieturi: ", "Couldn't move it to Cuts: ") + (e?.message || e), 6000); return false; }
      new Notice(T("Mutat în Tăieturi", "Moved to Cuts"), 2000);
      return true;
    },
  };
  const X = makeEdit(E);
  P.registerEditorExtension(X.extension);
  const O = makeOverflow(P, E, { parseAside, asidePath, EV });
  P.edit = { E, X, O, EV, asidePath, parseAside, isOn: E.isOn, toggle: E.toggle };

  // ✎ în colțul fiecărei note: pornește și oprește Editarea; aprins cât e pornită
  const acts = new Set();
  const paintActions = () => {
    for (const v of mdViews()) {
      if (!v._txEditAct && typeof v.addAction === "function") { const p = () => v.file?.path; v._txEditAct = v.addAction("pencil", T("Modul Editare", "Edit mode"), () => E.toggle(p())); v._txEditAct?.addClass?.("tx-edit-act"); acts.add(v._txEditAct); }
      const on_ = on.has(v.file.path); v._txEditAct?.toggleClass?.("is-active", on_);
      v._txEditAct?.setAttr?.("aria-label", on_ ? T("Ieși din modul Editare", "Leave edit mode") : T("Modul Editare", "Edit mode"));
    }
  };
  P.app.workspace.onLayoutReady?.(() => paintActions());
  for (const ev of ["layout-change", "active-leaf-change", "file-open"]) if (P.app.workspace.on) P.registerEvent(P.app.workspace.on(ev, () => {
    paintActions(); status(P).refresh(); if (ev !== "layout-change") O.follow();
    else for (const v of mdViews()) if (on.has(v.file.path)) { try { cmOf(v)?.dispatch({}); } catch (e) {} }   // butonul Deoparte din bară: aprins cât e deschis
  }));
  P.register(() => { for (const a of acts) { try { a.remove(); } catch (e) {} } for (const v of mdViews()) delete v._txEditAct; acts.clear(); });

  // în elementul Texere din bara de jos: „✎ Editare” cât e pornit (are întâietate); rândul care o pornește vine din meniul notei (aceeași listă peste tot)
  status(P).set("edit", {
    order: 0,
    show: () => !!activePath(),
    text: () => (E.isOn(activePath()) ? "✎ " + T("Editare", "Edit mode") : null),
  });
  P.register(() => status(P).remove("edit"));
  // clic dreapta → Texere → Modul Editare
  noteMenu(P).add("edit", ctx => (ctx.file?.extension === "md" ? [{ title: E.isOn(ctx.file.path) ? T("Ieși din modul Editare", "Leave edit mode") : T("Modul Editare", "Edit mode"), icon: "pencil", onClick: () => E.toggle(ctx.file.path) }] : []), 1);
  // o singură comandă (fără scurtătură implicită: o pui tu în Setări → Taste rapide)
  P.addCommand({ id: "edit-mode", name: T("Modul Editare", "Edit mode"), checkCallback: checking => { const p = activePath(); if (!p) return false; if (!checking) E.toggle(p); return true; } });
  if (P._cmdOwner) P._cmdOwner["edit-mode"] = "core";
  // nota redenumită: variantele și modul Editare o urmează
  if (P.app.vault.on) P.registerEvent(P.app.vault.on("rename", (f, old) => {
    const c = conf(); if (c.notes[old]) { c.notes[f.path] = c.notes[old]; delete c.notes[old]; saveSoon(); }
    if (on.has(old)) { on.delete(old); on.add(f.path); }
    if (lastMd === old) lastMd = f.path;
    if (f instanceof TFile && f.extension === "md" && !/ · overflow$/.test(f.basename)) O.renamed(f, old).then(() => O.follow()).catch(e => console.warn("Texere: Tăieturi, redenumirea", e));
  }));
  // notele Deoparte de dinainte (lângă notă) se mută în Support/Texere/Overflow, prin Obsidian; nimic nu se șterge
  P.app.workspace.onLayoutReady?.(() => setTimeout(() => O.adoptAll().then(n => { if (n) O.follow(); }).catch(e => console.warn("Texere: Tăieturi", e)), 1500));
  return P.edit;
}

module.exports = { install, asidePath, parseAside, nearest };
