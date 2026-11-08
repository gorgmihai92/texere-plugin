// Texere · Ajutor: baza de cunoștințe a lui Texere, în română sau engleză. Tot ce ține de folosirea lui Texere stă aici, nu în vault:
//  • întrebările frecvente (help-data.js), cu răspunsul și butoanele care fac acțiunea;
//  • ghidul întreg (assets/help/guide-ro.md, guide-en.md), pe capitole, cu întrebările fiecărui capitol deasupra;
//  • ultima configurare (ce s-a făcut, ce mai e de făcut), dacă există.
// Căutarea trece prin întrebări și prin ghid. Se deschide din pagina de pornire (Ajutor) și din comanda „Ajutor”. Stilurile: clase txhp-* în styles.css.
"use strict";
const { Modal, Notice, Component, MarkdownRenderer, MarkdownView, setIcon, Platform, moment } = require("obsidian");
const { beta } = require("../shared/beta");
const { node } = require("../shared/node");
const C = require("./common");
const { QA, ACT } = require("./help-data");
// ghidul: în plugin (se actualizează odată cu el)
const GUIDE = { ro: require("../../assets/help/guide-ro.md"), en: require("../../assets/help/guide-en.md") };
const STEP = { ro: ["**Pasul 1", "**Pasul 2"], en: ["**Step 1", "**Step 2"] };
const GUIDE_NOTES = /^(?:\d+\.\s*)?(?:Texere\s*[–—-]\s*)?(?:The Researcher's Vault|Vault-ul cercetătorului)(?:\.md)?#(.+)$/;   // legăturile vechi spre ghidul-notă
const stripFront = s => String(s || "").replace(/^---\n[\s\S]*?\n---\n?/, "");
const guideText = lg => stripFront(GUIDE[lg === "en" ? "en" : "ro"]);

const UI = {
  title: ["Ajutor", "Help"],
  sub: ["Întreabă cu cuvintele tale sau alege o întrebare.", "Ask in your own words, or pick a question."],
  ph: ["Scrie întrebarea sau problema ta (ex. „exportul în PDF nu merge”)", "Type your question or problem (e.g. \"PDF export doesn't work\")"],
  none: ["Nu am găsit nimic. Încearcă alte cuvinte sau deschide ghidul.", "Nothing found. Try other words or open the guide."],
  qa: ["Întrebare frecventă", "Frequent question"], from: ["Din ghid: ", "From the guide: "], sec: ["Secțiune din ghid", "Guide section"],
  back: ["← Înapoi", "← Back"], close: ["Închide", "Close"], fromGhid: ["Din ghid", "From the guide"],
  other: ["Altă întrebare", "Another question"], open: ["Deschide în ghid", "Open in the guide"],
  by: ["Creat de ", "Created by "], cmdName: ["Ajutor", "Help"], more: ["Mai multe întrebări", "More questions"],
  guide: ["Ghidul", "The guide"], contents: ["Cuprinsul ghidului", "Guide contents"], qs: ["Întrebări", "Questions"],
  setup: ["Ultima configurare", "Your last setup"],
  qsTitle: ["Întrebări frecvente", "Frequent questions"], qsSub: ["Răspunsuri scurte, cu un buton care face lucrul pentru tine.", "Short answers, with a button that does it for you."],
  guideSub: ["Tot ce face Texere, pe capitole. Citește de la capăt sau sari la ce te interesează.", "Everything Texere does, by chapter. Read it through or jump to what you need."],
  answers: ["Răspunsuri", "Answers"], inGuide: ["Din ghid", "In the guide"],
  crumbQ: ["Întrebare frecventă", "Frequent question"], crumbG: ["Ghid", "Guide"], crumbCh: ["Ghid · capitolul ", "Guide · chapter "], crumbSetup: ["Configurare", "Setup"],
};
// întrebările arătate la început (după titlul în română, ca să nu depindă de ordinea din help-data.js); restul: căutarea sau „Mai multe întrebări”
const TOP = ["Cum adaug o referință (carte sau articol)?", "Cum adnotez un PDF?", "Cum citez o referință în text?", "Cum export în Word sau PDF?",
  "Cum import din Zotero, cu PDF-urile și adnotările?", "Ce este Distilează?", "Ceva nu mai funcționează. Ce fac?", "Cum cer ajutor, semnalez o problemă sau trimit o sugestie?"];
const t = (k, lg) => UI[k][lg === "en" ? 1 : 0];

// ---------- căutare (fără nicio legătură cu Obsidian: se poate testa singură) ----------
const LX = {
  ro: {
    STOP: new Set("a ai al ale am are as asa au ca cat ce cel cea cei cele cu cum da dar de din dintr dupa e ea ei el este eu fara fi in imi in intr la le lui ma mai mea meu mi mie n ne nici nu o or ori pe pentru poate pot prin sa sau se si sunt ta te tu un una unde unei unui va vreau apare apar alt alta alte alti".split(" ")),
    // rădăcina cuvântului: „citez”, „citare”, „citarea” → „cit”, dar „import” nu se confundă cu „important”
    SUF: ["urilor", "arilor", "ilor", "elor", "ului", "urile", "area", "arii", "este", "esti", "esc", "eaza", "eze", "ezi", "are", "ari", "ate", "ati", "ata", "uri", "ele", "ile", "ul", "ii", "ei", "ea", "le", "ez", "at", "a", "e", "i", "u"],
    DEF: /\b(inseamna|ce e|ce este|definitie|ce sunt)\b/, DEFW: /^(inseamna|definitie)$/,
  },
  en: {
    STOP: new Set("a an the and or but if of to in on at for from with by as is are was were be been being it its this that these those i me my we our you your he she they them their what which who whom how why when where do does did doing can could should would will shall may might must not no so than too very just about into over under again there here all any some such only own same other more most also up out off then once has have had having am get got isn doesn don won can't".split(" ")),
    SUF: ["ational", "ations", "ation", "ings", "ing", "ies", "ied", "edly", "ers", "ed", "es", "er", "ly", "ment", "s", "e"],
    DEF: /\b(mean|means|meaning|define|definition|what is|whats)\b/, DEFW: /^(mean|means|meaning|define|definition)$/,
  },
};
const norm = s => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const toks = (s, lg) => norm(s).split(/[^a-z0-9+#]+/).filter(w => w.length > 1 && !LX[lg].STOP.has(w));
const stem = (w, lg) => { for (const x of LX[lg].SUF) if (w.length - x.length >= 3 && w.endsWith(x)) return w.slice(0, -x.length); return w; };
const prep = (s, lg) => toks(s, lg).map(w => ({ w, s: stem(w, lg) }));
// cât de bine se potrivește un cuvânt căutat: identic 1, aceeași rădăcină 0.85, început de cuvânt (doar pentru cuvântul pe care îl scrii acum) 0.6
const match = (q, words) => {
  let best = 0;
  for (const x of words) {
    if (x.w === q.w) return 1;
    if (x.s === q.s) best = Math.max(best, 0.85);
    else if (q.partial && x.w.startsWith(q.w)) best = Math.max(best, 0.6);
  }
  return best;
};
// {{cmd:id|text}} comandă · {{sec:6.4|text}} secțiune din ghid · {{set:tab|text}} setări · {{note:nume|text}} notă
// {{search:căutare|text}} căutare · {{reveal:folder|text}} folder în Obsidian · {{os:vault|text}} folderul vault-ului în Finder/Explorer
const LINK = /\{\{(cmd|sec|set|note|search|reveal|os|guide):(.+?)\|([^}]+)\}\}/g;
const linkify = s => (s || "").replace(LINK, (m, tp, v, l) => `[${l}](#ghid=${tp}=${encodeURIComponent(v)})`);
const plain = s => (s || "").replace(LINK, "$3").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
// acțiunile (butoanele) fiecărei întrebări: cheile din ACT, rezolvate în help() după `actions`
const qaItems = (lg, actions = {}) => QA.map(([ref, ro, en], i) => { const x = lg === "en" ? en : ro; return { kind: "qa", i, title: x[0], k: x[1], a: x[2], ref, acts: (ACT[ro[0]] || []).map(k => actions[k]).filter(Boolean) }; });

const lines = s => s.split("\n");
const headings = s => lines(s).map((l, i) => { const m = l.match(/^(#{1,6})\s+(.+)$/); return m ? { i, level: m[1].length, text: m[2].trim() } : null; }).filter(Boolean);
const findHeading = (s, ref, lg) => {
  if (!ref || ref[0] === "step1") return null;
  const num = ref[0], word = lg === "en" ? ref[2] : ref[1], hs = headings(s);
  return hs.find(h => h.text.startsWith(num + " ") || h.text.startsWith(num + ". ")) || (word && hs.find(h => norm(h.text).includes(norm(word)))) || null;
};
const section = (s, ref, lg) => {
  const A = lines(s);
  if (ref && ref[0] === "step1") {
    const [m1, m2] = STEP[lg === "en" ? "en" : "ro"], a = A.findIndex(l => l.startsWith(m1)), b = A.findIndex(l => l.startsWith(m2));
    return a < 0 ? "" : A.slice(a, b > a ? b : a + 15).join("\n");
  }
  const h = findHeading(s, ref, lg); if (!h) return "";
  let end = A.length; for (let j = h.i + 1; j < A.length; j++) { const m = A[j].match(/^(#{1,6})\s/); if (m && m[1].length <= h.level) { end = j; break; } }
  return A.slice(h.i + 1, end).join("\n").trim();
};
// cuprinsul ghidului: capitolele (##) și secțiunile lor (###), cu numărul („5”, „2.3”)
const toc = s => headings(s).filter(h => h.level === 2 || h.level === 3).map(h => ({ ...h, num: (h.text.match(/^(\d+(?:\.\d+)?)[.\s]/) || [])[1] || "" }));
// textul unei secțiuni, fără titlu: până la următorul titlu de același nivel sau mai sus (un capitol își include secțiunile)
const sectionAt = (s, h) => { const A = lines(s); let end = A.length; for (let j = h.i + 1; j < A.length; j++) { const m = A[j].match(/^(#{1,6})\s/); if (m && m[1].length <= h.level) { end = j; break; } } return A.slice(h.i + 1, end).join("\n").trim(); };
// întrebările unui capitol („5” și „5.x”; pentru 1 și „step1”) sau ale unei secțiuni („2.3”)
const chapterQs = (items, h) => items.filter(x => { const r = x.ref && x.ref[0]; if (!r || !h.num) return false; if (h.level === 2) return r === h.num || r.startsWith(h.num + ".") || (h.num === "1" && r === "step1"); return r === h.num; });
// pasajele din ghid: fiecare secțiune, plus rândurile din tabele (erori, glosar etc.)
const passages = s => {
  const out = [], hs = headings(s), A = lines(s);
  let parent = null;   // un subtitlu (####) ține de secțiunea lui: rezultatul o deschide pe ea, cu titlul „Secțiune › subtitlu”
  hs.forEach((h, k) => {
    const end = k + 1 < hs.length ? hs[k + 1].i : A.length;
    const body = A.slice(h.i + 1, end).join("\n");
    if (h.level <= 3) parent = h;
    const sub = h.level > 3 && parent, ref = sub ? [parent.text.split(" ")[0], parent.text, parent.text] : [h.text.split(" ")[0], h.text, h.text];
    out.push({ kind: "ghid", title: sub ? `${parent.text} › ${h.text}` : h.text, text: body, ref });
    // rândurile din tabele devin rezultate separate, în afară de tabelele cu exemple (citări, comparația de la început)
    let header = null;
    body.split("\n").forEach(l => {
      if (!/^\|/.test(l)) { header = null; return; }
      if (/^\|\s*-/.test(l)) return;
      const cells = l.split("|").map(c => c.trim()).filter(Boolean);
      if (header === null) { header = cells[0] || ""; return; }
      if (/^(Scrii|Etap[aă]|You write|Stage)/.test(header) || cells.length < 2) return;
      out.push({ kind: "rand", title: cells[0].replace(/\*\*|`/g, ""), text: cells.slice(1).join(" — ").replace(/\*\*/g, ""), ref });
    });
  });
  return out;
};
const rank = (query, s, lg, actions) => {
  const X = LX[lg], def = X.DEF.test(norm(query));
  let qw = toks(query, lg); if (!qw.length) return [];
  // la „ce înseamnă X” / „what does X mean” contează X
  if (def && qw.some(w => !X.DEFW.test(w))) qw = qw.filter(w => !X.DEFW.test(w));
  const typing = !/\s$/.test(query);
  const qt = qw.map((w, i) => ({ w, s: stem(w, lg), partial: typing && i === qw.length - 1 }));
  const items = [
    ...qaItems(lg, actions).map(x => ({ ...x, Q: prep(x.title, lg), T: prep(x.title + " " + x.k, lg), X: prep(plain(x.a), lg) })),
    ...passages(s).map(p => ({ ...p, Q: prep(p.title, lg), T: prep(p.title, lg), X: prep(p.text, lg) })),
  ];
  // cuvintele rare (ex. „zotero”) contează mai mult decât cele comune (ex. „merge”)
  const df = {}; items.forEach(it => new Set([...it.T, ...it.X].map(x => x.s)).forEach(k => { df[k] = (df[k] || 0) + 1; }));
  const idf = q => Math.log(1 + items.length / (df[q.s] || 1));
  const sc = words => qt.reduce((sum, q) => sum + idf(q) * match(q, words), 0);
  const all = it => qt.every(q => match(q, [...it.T, ...it.X]) > 0);
  items.forEach(it => {
    it.score = it.kind === "qa" ? 3 * sc(it.T) + 2 * sc(it.Q) + sc(it.X) : 2.5 * sc(it.T) + Math.min(0.4 * sc(it.X), 2);
    if (def && it.kind === "rand" && it.ref && /Termeni|Terms/.test(it.ref[1])) it.score += 4 * sc(it.T);
    if (qt.length > 1 && all(it)) it.score *= 1.3;
  });
  const sorted = items.filter(x => x.score > 0).sort((x, y) => y.score - x.score);
  if (!sorted.length) return [];
  // doar rezultatele apropiate de cel mai bun, maximum 8
  return sorted.filter(x => x.score >= 0.4 * sorted[0].score).slice(0, 8);
};
const topItems = all => { const top = TOP.map(ro => QA.findIndex(x => x && x[1][0] === ro)).filter(i => i >= 0).map(i => all.find(x => x.i === i)).filter(Boolean); return top.length ? top : all.slice(0, 8); };
const suggestions = (q, s, lg, actions, everything) => {
  const all = qaItems(lg, actions);
  if (q.trim().length < 2) return everything ? all : topItems(all);
  const r = rank(q, s, lg, actions);
  if (r.length) return r;
  if (!toks(q, lg).length) {   // doar cuvinte comune („ce”, „cum”, „how”, „what”)
    const nq = norm(q).trim().replace(/\s+/g, " ");
    const m = all.filter(x => (" " + norm(x.title) + " ").includes(" " + nq));
    return m.length ? m : all;
  }
  return [{ kind: "none", title: t("none", lg), ref: null }];
};
const hintOf = (x, lg) => x.kind === "rand" ? t("from", lg) + (x.ref ? x.ref[1] : "") : x.kind === "ghid" ? t("sec", lg) : "";

// ---------- Ajutorul unui plugin: acțiunile, fereastra, pagina din tab-ul Texere ----------
function makeHelp(plugin) {
  const app = plugin.app;
  const notice = (ro, en, lg) => new Notice(lg === "en" ? en : ro, 6000);
  const NEEDS_NOTE = new Set(["texere-export:export-note", "texere-export:export-insert-toc"].map(id => C.cmdId(plugin, id)));
  // acțiunile care nu mai sunt comenzi (sunt butoane sau meniuri acum): Ajutorul le face direct; false = modulul lor e oprit
  const src = () => C.sourcesApi(plugin), xmod = () => plugin.mod?.("export") || null, active = () => app.workspace.getActiveFile?.();
  const call = (o, m, ...a) => { if (!o || typeof o[m] !== "function") return false; o[m](...a); return true; };
  const insertToc = lg => {
    const v = app.workspace.getActiveViewOfType?.(MarkdownView), ed = v?.editor;
    if (!ed) { notice("Deschide întâi nota în care pui cuprinsul.", "First open the note where the contents go.", lg); return true; }
    const c = ed.getCursor(), pre = ed.getLine(c.line).trim() ? "\n\n" : "";
    ed.replaceRange(`${pre}\`\`\`${lg === "en" ? "contents" : "cuprins"}\n\`\`\`\n`, { line: c.line, ch: ed.getLine(c.line).length }); return true;
  };
  const insights = () => { const id = C.cmdId(plugin, "texere-insights:open"); if (!app.commands?.commands?.[id]) return false; app.commands.executeCommandById(id); return true; };
  const MOVED = {
    "texere:setup": () => call(plugin, "onboard", true),
    "texere:open-home": () => call(plugin, "openHome"),
    "texere:sources-rebuild-bib": () => call(src(), "rebuildFromNotes"),
    "texere:sources-tidy": () => call(src(), "tidy"),
    "texere:sources-uncataloged": () => call(src(), "uncataloged"),
    "texere:sources-import-highlights": lg => { const H = src()?.highlights, f = active(); if (!H) return false; if (f && H.pairsFor?.(f)?.length) H.importManual(f); else notice("Deschide întâi nota sau PDF-ul referinței.", "First open the reading note or PDF.", lg); return true; },
    "texere:sources-find-pdf": lg => { const S = src(), f = active(); if (!S) return false; if (f && f.path.startsWith(S.litDir?.() || "\u0000")) S.findPdfForNote(f); else notice("Deschide întâi nota de lectură.", "First open the reading note.", lg); return true; },
    "texere:export-pick": () => { const X = xmod()?.exporter, f = active(); if (!X) return false; if (f?.extension === "md") X.open(f); else X.pick(); return true; },
    "texere:export-insert-toc": lg => insertToc(lg),
    "texere:import-files": () => call(xmod(), "importFiles"),
    "texere:import-folder": () => call(xmod(), "importFolder"),
    "texere:paste-clean-toggle": () => { settings("texere-export"); return true; },
    "texere:citation-style-add": () => { settings("texere-sources"); return true; },
    "texere:citation-style-default": () => { settings("texere-sources"); return true; },
  };
  for (const k of ["companion", "debate-map", "concept-panels", "voice-inline", "voice-stats", "voice-baseline", "scan", "claims-toggle", "word-target"]) MOVED["texere:" + k] = () => insights();
  const cmd = (id0, lg, needsNote) => {
    const id = C.cmdId(plugin, id0);
    if (!app.commands?.commands?.[id]) {
      try { if (MOVED[id] && MOVED[id](lg) !== false) return; } catch (e) { return notice(e.message, e.message, lg); }
      return notice("Nu e disponibil acum. Verifică dacă modulul e pornit (Settings → Texere).", "Not available right now. Check that the module is on (Settings → Texere).", lg);
    }
    if (!app.commands.executeCommandById(id) && (needsNote || NEEDS_NOTE.has(id))) notice("Deschide întâi nota pe care vrei s-o exporți, apoi încearcă din nou.", "First open the note you want to export, then try again.", lg);
  };
  const settings = tab => C.openSettings(plugin, tab);
  const search = q => { try { app.internalPlugins.getPluginById("global-search").instance.openGlobalSearch(q); } catch (e) {} };
  // o notă din pachetul Texere (ghidurile de scris, șabloanele) se creează dacă lipsește; alta trebuie să fie deja în vault
  const ensureNote = async name => { try { return typeof plugin.ensureNote === "function" ? await plugin.ensureNote(name) : null; } catch (e) { return null; } };
  const openNote = async (name, lg) => {
    const base = String(name || "").split("/").pop().replace(/\.md$/, "");   // mutată în altă parte: o găsește după nume
    const f = app.vault.getAbstractFileByPath(name) || app.vault.getMarkdownFiles().find(x => x.basename === base) || await ensureNote(name);
    if (f) app.workspace.getLeaf("tab").openFile(f); else notice(`Nu găsesc nota „${name}”.`, `I can't find the note "${name}".`, lg);
  };
  const reveal = name => { try { const f = app.vault.getAbstractFileByPath(name); if (f) app.internalPlugins.getPluginById("file-explorer").instance.revealInFolder(f); } catch (e) {} };
  // un folder de pe calculator, în Finder / Explorer (doar pe desktop)
  const showOS = (p, lg) => {
    try { if (Platform && Platform.isDesktopApp === false) throw new Error("mobile"); node("electron").shell.openPath(p); }
    catch (e) { notice("Nu pot deschide folderul.", "I can't open the folder.", lg); }
  };
  const newPaper = async lg => {
    const tpl = app.vault.getAbstractFileByPath("Support/Templates/New essay.md") || await ensureNote("Support/Templates/New essay.md");
    if (!tpl) return notice("Nu găsesc șablonul Support/Templates/New essay.", "I can't find the Support/Templates/New essay template.", lg);
    const b0 = lg === "en" ? "New paper" : "Articol nou"; let n = b0, i = 2;
    while (app.vault.getAbstractFileByPath(n + ".md")) n = `${b0} ${i++}`;
    const f = await app.vault.copy(tpl, n + ".md"); app.workspace.getLeaf("tab").openFile(f);
  };
  const exportFolder = () => { const e = C.exportStore(plugin)?.settings?.export; return String((e && e.folder) || "04. Export").trim(); };
  const showExportDir = lg => {
    let o = exportFolder(); if (o.startsWith("~")) { try { o = node("os").homedir() + o.slice(1); } catch (e) {} }
    showOS(/^(\/|[A-Za-z]:[\\/]|\\\\)/.test(o) ? o : C.basePath(app) + "/" + o, lg);
  };
  const A = {
    setup: { icon: "settings", label: ["Rulează configurarea", "Run the setup"], run: () => plugin.onboard?.(true) },
    core: { icon: "sliders-horizontal", label: ["Ce e pornit și ce lipsește", "What's on and what's missing"], run: () => settings("texere") },
    errors: { icon: "table", label: ["Vezi tabelul de erori", "See the error table"], guide: ["6.4", "eroare", "error"] },
    bib: { icon: "book-open", label: ["Refă bibliografia din note", "Rebuild the bibliography from notes"], run: lg => cmd("texere-sources:sources-rebuild-bib", lg) },
    keys: { icon: "library", label: ["Caută o referință", "Search a reference"], run: lg => cmd("texere-sources:sources-search", lg) },
    add: { icon: "file-plus", label: ["Adaugă o referință", "Add a reference"], run: lg => cmd("texere-sources:sources-search", lg) },
    paste: { icon: "clipboard-paste", label: ["Lipește o referință", "Paste a reference"], run: lg => cmd("texere-sources:sources-bibtex", lg) },
    zotero: { icon: "download", label: ["Descarcă Zotero Connector", "Download Zotero Connector"], url: "https://www.zotero.org/download/connectors" },
    zImport: { icon: "download", label: ["Importă din Zotero", "Import from Zotero"], run: lg => cmd("texere-sources:sources-zotero-import", lg) },
    srcSet: { icon: "sliders-horizontal", label: ["Setările Texere · Referințe", "Texere · References settings"], run: () => settings("texere-sources") },
    hl: { icon: "highlighter", label: ["Importă adnotările din PDF", "Import annotations from PDF"], run: lg => cmd("texere-sources:sources-import-highlights", lg) },
    uncat: { icon: "file-search", label: ["PDF-uri fără referință", "PDFs without a reference"], run: lg => cmd("texere-sources:sources-uncataloged", lg) },
    plugins: { icon: "puzzle", label: ["Deschide Community plugins", "Open Community plugins"], run: () => settings("community-plugins") },
    docs: { icon: "folder-open", label: ["Arată folderul PDFs", "Show the PDFs folder"], run: () => reveal("01. References/PDFs") },
    refs: { icon: "folder-open", label: ["Arată folderul Reading Notes", "Show the Reading Notes folder"], run: () => reveal("01. References/Reading Notes") },
    disagree: { icon: "search", label: ["Caută #disagree", "Search #disagree"], run: () => search("tag:#disagree") },
    paper: { icon: "file-plus", label: ["Creează un articol nou", "Create a new paper"], run: lg => newPaper(lg) },
    tpl: { icon: "file-text", label: ["Deschide șablonul New essay", "Open the New essay template"], run: lg => openNote("Support/Templates/New essay.md", lg) },
    licenta: { icon: "graduation-cap", label: ["Șablonul de licență", "The bachelor's thesis template"], run: lg => openNote("Support/Templates/Licență – Facultatea de Filosofie UB.md", lg) },
    disertatie: { icon: "graduation-cap", label: ["Șablonul de disertație", "The master's thesis template"], run: lg => openNote("Support/Templates/Disertație – Facultatea de Filosofie UB.md", lg) },
    styles: { icon: "external-link", label: ["Zotero Style Repository", "Zotero Style Repository"], url: "https://www.zotero.org/styles" },
    exportNote: { icon: "file-output", label: ["Exportă nota deschisă", "Export the open note"], run: lg => cmd("texere-export:export-note", lg, true) },
    exportPick: { icon: "file-output", label: ["Alege nota pe care o exporți", "Choose a note to export"], run: lg => cmd("texere:export-pick", lg) },
    exportSet: { icon: "sliders-horizontal", label: ["Setările exportului", "Export settings"], run: () => settings("texere-export") },
    exportDir: { icon: "folder-open", label: ["Arată folderul de export", "Show the export folder"], run: lg => showExportDir(lg) },
    toc: { icon: "list", label: ["Pune cuprinsul în nota deschisă", "Insert the contents in the open note"], run: lg => cmd("texere-export:export-insert-toc", lg, true) },
    philo: { icon: "network", label: ["Deschide nota Philosophy", "Open the Philosophy note"], run: lg => openNote("Philosophy", lg) },
    versions: { icon: "history", label: ["Vezi istoricul versiunilor", "See the version history"], guide: ["7", "nou", "new"] },
    recovery: { icon: "rotate-ccw", label: ["Deschide File recovery", "Open File recovery"], run: () => settings("file-recovery") },
    vault: { icon: "folder-open", label: ["Arată vault-ul în Finder / Explorer", "Show the vault in Finder / Explorer"], run: lg => showOS(C.basePath(app), lg) },
    lang: { icon: "languages", label: ["Switch to English", "Treci la română"], stay: true },
    mail: { icon: "mail", label: ["Scrie un e-mail", "Send an e-mail"], url: "mailto:hi@georgemihai.com" },
    site: { icon: "globe", label: ["www.georgemihai.com", "www.georgemihai.com"], url: "https://www.georgemihai.com/?utm_source=texere&utm_medium=help&utm_campaign=texere" },
  };

  const icon = (el, name) => { try { setIcon(el, name); } catch (e) {} };
  // ultima configurare (o scrie setup.js): { at, lang, md }
  const lastSetup = () => { const r = plugin.settings?.lastSetup; return r && r.md ? r : null; };

  // o singură fereastră, de aceeași mărime: lista (căutare, întrebări, cuprinsul ghidului) și vizualizările de detaliu
  // (răspuns, capitol, cuprins, ultima configurare), cu „Înapoi” la cea dinainte.
  // `root` e locul în care se desenează (conținutul ferestrei sau pagina din tab-ul Texere); `close` o închide
  class HelpView {
    constructor(root, lg, close, opts = {}) { this.c = root; this.lg = lg; this.close = close; this.opts = opts; this.text = ""; this.comp = new Component(); this.query = ""; this.items = []; this.sel = 0; this.item = null; this.rows = []; this.state = null; this.stack = []; }
    async open() {
      this.comp.load();
      const c = this.c; c.addClass("texere-help");
      // titlu și comutatorul de limbă (rămân mereu sus); ordinea copiilor contează pentru pagina din tab-ul Texere (stilurile ei)
      const h = c.createDiv("txhp-head");
      const ic = h.createSpan("txhp-icon"); icon(ic, "life-buoy");
      this.titleTx = h.createSpan("txhp-title");
      // autor și contact, discret, sus lângă limbă
      this.foot = h.createSpan("txhp-foot");
      this.langEl = h.createDiv("txhp-lang");
      this.sub = c.createDiv("txhp-sub is-hidden");   // fără subtitlu: căutarea vorbește singură
      // vizualizarea „căutare”
      this.searchView = c.createDiv("txhp-search");
      this.input = this.searchView.createEl("input", { type: "text", cls: "txhp-input" });
      this.list = this.searchView.createDiv("txhp-list");
      this.input.addEventListener("input", () => { this.query = this.input.value; this.sel = 0; this.renderList(); });
      // implicit: ghidul; cu clic în căutare: întrebările; ieși din căutare fără să scrii nimic: din nou ghidul
      this.input.addEventListener("focus", () => { if (this.focused) return; this.focused = true; if (!this.state) { this.sel = 0; this.renderList(); } });
      this.input.addEventListener("blur", () => { setTimeout(() => { if (this.input.ownerDocument?.activeElement === this.input) return; this.focused = false; if (!this.state && this.query.trim().length < 2) this.renderList(); }, 120); });
      this.input.addEventListener("keydown", e => {
        if (e.key === "ArrowDown") { e.preventDefault(); this.sel = Math.min(this.sel + 1, this.items.length - 1); this.highlight(); }
        else if (e.key === "ArrowUp") { e.preventDefault(); this.sel = Math.max(this.sel - 1, 0); this.highlight(); }
        else if (e.key === "Enter") { e.preventDefault(); if (this.items[this.sel]) this.choose(this.items[this.sel]); }
      });
      // vizualizările de detaliu
      this.answerView = c.createDiv("txhp-answer is-hidden");
      await this.setLanguage(this.lg);
      if (this.opts.page === "setup" && lastSetup()) await this.go({ kind: "setup" }, false);
      else if (this.opts.chapter) await this.goRef([String(this.opts.chapter)], false);
      else if (this.opts.contents) await this.go({ kind: "contents" }, false);

    }
    async setLanguage(lg) {
      this.lg = lg; C.setLang(app, lg);
      this.text = guideText(lg);
      this.titleTx.setText(t("title", lg)); this.input.placeholder = t("ph", lg);
      this.langEl.empty();
      ["ro", "en"].forEach(l => {
        const b = this.langEl.createSpan({ text: l.toUpperCase(), cls: l === lg ? "is-active" : "" });
        b.addEventListener("click", () => { if (l !== this.lg) this.setLanguage(l); });
      });
      this.foot.empty(); this.foot.appendText(t("by", lg));
      const link = (text, url) => { const a = this.foot.createEl("a", { text, href: url }); a.addEventListener("click", e => { e.preventDefault(); window.open(url); }); };
      link("George Mihai", "https://www.georgemihai.com/?utm_source=texere&utm_medium=help&utm_campaign=texere"); this.foot.appendText(" · "); link("hi@georgemihai.com", "mailto:hi@georgemihai.com");
      // ce era deschis rămâne deschis, în limba nouă: întrebarea după poziție, capitolul după număr
      const tr = st => { if (!st) return null; if (st.kind === "answer" && st.item?.kind === "qa") return { kind: "answer", item: qaItems(lg, A)[st.item.i] }; if (st.kind === "chapter") { const h = toc(this.text).find(x => x.num && x.num === st.h.num) || null; return h ? { kind: "chapter", h } : { kind: "contents" }; } if (st.kind === "answer") return null; return st; };
      if (this.state) { this.stack = this.stack.map(tr).filter(Boolean); const st = tr(this.state); if (st) { this.state = st; await this.render(); } else this.backToList(); }
      else this.renderList();
    }
    // ——— lista: căutarea; fără căutare, întrebările cele mai folosite și cuprinsul ghidului ———
    // lista, în două zone care nu se amestecă: întrebările (răspunsuri scurte) și ghidul (capitolele); la căutare, la fel: răspunsuri, apoi din ghid
    renderList() {
      const lg = this.lg, q = this.query.trim();
      const found = suggestions(this.query, this.text, lg, A, this.all); this.list.empty(); this.rows = []; this.items = [];
      const isQ = x => x.kind === "qa";
      const group = (ico, title, sub, n) => {
        const g = this.list.createDiv("txhp-group"); icon(g.createSpan("txhp-gi"), ico); g.createSpan({ text: title });
        if (n != null) g.createSpan({ cls: "txhp-gn", text: String(n) });
        if (sub) this.list.createDiv({ cls: "txhp-gsub", text: sub });
      };
      const row = (x, parent, cls) => {
        const i = this.rows.length; this.items.push(x);
        const kind = x.kind === "none" ? "none" : x.mini ? "link" : isQ(x) ? "q" : x.kind === "chapter" || x.kind === "setup" ? "ch" : "g";
        const r = (parent || this.list).createDiv("txhp-row txhp-row-" + kind + (cls ? " " + cls : ""));
        if (kind === "ch" && x.h?.num) r.createSpan({ cls: "txhp-num", text: x.h.num });
        else if (kind !== "none") icon(r.createSpan("txhp-ri"), kind === "q" ? "circle-help" : kind === "link" ? (x.kind === "setup" ? "clipboard-check" : "sparkles") : kind === "ch" ? "clipboard-check" : "book-open");
        const tx = r.createDiv("txhp-rt"), title = kind === "ch" && x.h?.num ? String(x.title).replace(/^\d+\.\s*/, "") : x.title;
        const tt = tx.createDiv({ cls: "txhp-rtt", text: title }); if (kind === "ch" && /Insights/.test(title)) beta(tt);
        const hint = hintOf(x, lg); if (hint) tx.createEl("small", { text: hint });
        r.addEventListener("mouseenter", () => { this.sel = i; this.highlight(); });
        r.addEventListener("mousedown", e => { if (this.focused) e.preventDefault(); });   // clicul pe un rând nu scoate cursorul din căutare
        r.addEventListener("click", () => this.choose(x));
        this.rows.push(r);
      };
      if (q.length < 2 && this.focused) {
        group("circle-help", t("qsTitle", lg), t("qsSub", lg));
        found.forEach(x => row(x));
        // la început: doar întrebările cele mai folosite; restul, cu un clic (sau cu căutarea)
        if (!this.all && found.length < QA.filter(Boolean).length) {
          const a = this.list.createEl("a", { cls: "txhp-more", href: "#", text: t("more", lg) + " →" });
          a.addEventListener("mousedown", e => e.preventDefault());
          a.addEventListener("click", e => { e.preventDefault(); this.all = true; this.renderList(); });
        }
      } else if (q.length < 2) {
        // pagina de pornire a Ajutorului: cuprinsul întreg (capitolele și secțiunile lor), sub căutare
        this.tocInto(this.list.createDiv("txhp-body txhp-toc txhp-home-toc"));
      } else {
        const qs = found.filter(isQ), gs = found.filter(x => !isQ(x) && x.kind !== "none"), none = found.filter(x => x.kind === "none");
        if (qs.length) { group("circle-help", t("answers", lg), null, qs.length); qs.forEach(x => row(x)); }
        if (gs.length) { group("book-open", t("inGuide", lg), null, gs.length); gs.forEach(x => row(x)); }
        none.forEach(x => row(x));
      }
      this.highlight();
    }
    // unde ești: o întrebare, ghidul (capitolul), configurarea
    crumb(v, st) {
      const lg = this.lg, c = v.createDiv("txhp-crumb");
      const qa = st.kind === "answer" && st.item?.kind === "qa";
      c.addClass(qa ? "is-q" : "is-g"); icon(c.createSpan("txhp-ci"), qa ? "circle-help" : st.kind === "setup" ? "clipboard-check" : "book-open");
      const num = st.kind === "chapter" ? String(st.h?.num || "").split(".")[0] : st.kind === "answer" && st.item?.ref ? String(st.item.ref[0] || "").split(".")[0] : "";
      c.createSpan({ text: qa ? t("crumbQ", lg) : st.kind === "setup" ? t("crumbSetup", lg) : num ? t("crumbCh", lg) + num : t("crumbG", lg) });
    }
    when(at) { try { return moment(at).format(this.lg === "en" ? "D MMM YYYY, HH:mm" : "D MMM YYYY, HH:mm"); } catch (e) { return String(at || ""); } }
    highlight() {
      this.rows.forEach((r, i) => r.toggleClass("is-selected", i === this.sel));
      const r = this.rows[this.sel]; if (r && r.scrollIntoView) r.scrollIntoView({ block: "nearest" });
    }
    choose(x) {
      if (x.kind === "none") return this.go({ kind: "contents" });
      if (x.kind === "chapter") return this.go({ kind: "chapter", h: x.h });
      if (x.kind === "setup") return this.go({ kind: "setup" });
      if (x.kind === "ghid") { const h = findHeading(this.text, x.ref, this.lg); if (h) return this.go({ kind: "chapter", h: toc(this.text).find(y => y.i === h.i) || { ...h, num: "" } }); }
      return this.showAnswer(x);
    }
    // ——— vizualizările de detaliu, cu „Înapoi” ———
    async go(state, push = true) { if (push && this.state) this.stack.push(this.state); this.state = state; await this.render(); }
    goRef(ref, push = true) { const h = findHeading(this.text, ref, this.lg); const th = h && toc(this.text).find(y => y.i === h.i); return this.go(th ? { kind: "chapter", h: th } : { kind: "contents" }, push); }
    back() { const prev = this.stack.pop(); if (!prev) return this.backToList(); this.state = prev; return this.render(); }
    showAnswer(item) { return this.go({ kind: "answer", item }); }
    async render() {
      const st = this.state; if (!st || st.kind === "contents") return this.backToList(false);   // cuprinsul e pagina de pornire a Ajutorului
      this.item = st.kind === "answer" ? st.item : null;
      this.searchView.addClass("is-hidden"); this.sub.addClass("is-hidden");
      const v = this.answerView; v.empty(); v.removeClass("is-hidden");
      const top = v.createDiv("txhp-top");
      const back = top.createEl("a", { text: t("back", this.lg), href: "#", cls: "txhp-back" });
      back.addEventListener("click", e => { e.preventDefault(); this.back(); });
      if (st.kind !== "contents") { const cn = top.createEl("a", { text: t("contents", this.lg), href: "#", cls: "txhp-back txhp-tocl" }); cn.addEventListener("click", e => { e.preventDefault(); this.query = ""; this.input.value = ""; this.backToList(false); }); }
      // fără eticheta „Ghid · capitolul N” / „Întrebare frecventă”: titlul spune destul
      if (st.kind === "answer") return this.renderAnswer(v, st.item);
      if (st.kind === "chapter") return this.renderChapter(v, st.h);
      if (st.kind === "setup") return this.renderSetup(v);
    }
    md(s, el) { return MarkdownRenderer.render(app, s, el, "", this.comp); }
    // imaginile din ghid care nu sunt în vault (ex. ale vault-ului Texere) nu apar deloc, în loc de un link stricat
    // ce nu e în vault (imaginile și notele vault-ului Texere, dacă ai instalat doar pluginul): imaginile dispar, linkurile rămân text (un clic ar crea o notă goală)
    dropMissing(el) {
      for (const e of el.querySelectorAll(".internal-embed")) { const src = e.getAttribute("src") || ""; try { if (!app.metadataCache.getFirstLinkpathDest(src.split("#")[0], "")) e.remove(); } catch (x) {} }
      for (const a of el.querySelectorAll("a.internal-link")) { const h = a.getAttribute("data-href") || a.getAttribute("href") || ""; if (!h || h.startsWith("#")) continue; try { if (!app.metadataCache.getFirstLinkpathDest(h.split("#")[0], "")) a.replaceWith(document.createTextNode(a.textContent)); } catch (x) {} }
    }
    // clic pe un link: comandă, secțiune din ghid, setări, notă, căutare sau site; legăturile spre ghid rămân aici
    wire(body) {
      body.addEventListener("click", e => {
        const a = e.target && e.target.closest ? e.target.closest("a") : null; if (!a) return;
        const href = a.getAttribute("data-href") || a.getAttribute("href") || "";
        if (href === "#" || a.classList.contains("txhp-chq-a")) return;   // întrebările capitolului au clicul lor (deschid răspunsul aici); nu sunt note
        e.preventDefault(); e.stopPropagation();
        const m = href.match(/ghid=(\w+)=(.*)$/);
        if (m) return this.runLink(m[1], decodeURIComponent(m[2]));
        if (/^(https?:|mailto:)/i.test(href)) return window.open(href);
        const g = href.startsWith("#") ? href.slice(1) : (href.match(GUIDE_NOTES) || [])[1];
        if (g) { const all = toc(this.text), num = (g.match(/^(\d+(?:\.\d+)?)[.\s]/) || [])[1]; const h = all.find(x => x.text === g) || (num && all.find(x => x.num === num)); if (h) return this.go({ kind: "chapter", h }); }
        if (href) { this.close(); app.workspace.openLinkText(href, "", "tab"); }
      }, true);
    }
    async renderAnswer(v, item) {
      const lg = this.lg;
      v.createDiv({ text: item.title, cls: "txhp-q" });
      const body = v.createDiv("txhp-body"); this.wire(body);
      if (item.a) await this.md(linkify(item.a), body.createDiv());
      if (item.acts && item.acts.length) {
        const ar = body.createDiv("txhp-acts");
        item.acts.forEach(a => {
          const b = ar.createEl("button", { cls: "txhp-act" });
          icon(b.createSpan("txhp-act-icon"), a.icon);
          b.appendText(a.label[lg === "en" ? 1 : 0]);
          if (a.url) icon(b.createSpan("txhp-act-ext"), "arrow-up-right");
          b.addEventListener("click", () => {
            if (a.stay) return this.setLanguage(lg === "en" ? "ro" : "en");
            if (a.url) return window.open(a.url);
            if (a.guide) return this.goRef(a.guide);
            this.close();
            setTimeout(() => { try { a.run(lg); } catch (e) { new Notice(e.message); } }, 60);
          });
        });
      }
      if (item.kind === "rand") await this.md("**" + item.title + "**: " + item.text, body.createDiv());
      const sec = item.kind === "rand" ? "" : section(this.text, item.ref, lg);
      if (sec) { const d = body.createEl("details"); if (!item.a) d.open = true; d.createEl("summary", { text: t("fromGhid", lg) }); await this.md(sec, d.createDiv()); this.dropMissing(d); }
      const row = v.createDiv("txhp-btns");
      const btn = (label, fn, cta) => { const b = row.createEl("button", { text: label }); if (cta) b.addClass("mod-cta"); b.addEventListener("click", fn); };
      btn(t("other", lg), () => { this.query = ""; this.input.value = ""; this.backToList(true); });
      if (item.ref || item.kind === "rand") btn(t("open", lg), () => this.goRef(item.ref || []), true);
    }
    // un capitol (cu secțiunile lui) sau o secțiune: întâi întrebările lui, apoi textul; dedesubt, capitolul de dinainte și cel de după
    async renderChapter(v, h) {
      const lg = this.lg, all = toc(this.text);
      // titlul și, pe același rând în dreapta, capitolul de dinainte și cel de după
      const hrow = v.createDiv("txhp-qrow"), ht = hrow.createDiv({ text: h.text, cls: "txhp-q" }); if (/Insights/.test(h.text) && h.level === 2) beta(ht);
      const body = v.createDiv("txhp-body txhp-chapter"); this.wire(body);
      const qs = chapterQs(qaItems(lg, A), h);
      if (qs.length) {
        // întrebările capitolului, strânse: un rând; se deschid cu un clic
        const det = body.createDiv("txhp-chq").createEl("details"); det.createEl("summary", { cls: "txhp-group", text: `${t("qs", lg)} · ${qs.length}` });
        const box = det.createDiv("txhp-chq-list");
        for (const q of qs) { const a = box.createEl("a", { cls: "txhp-chq-a", href: "#", text: q.title }); a.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); this.showAnswer(q); }); }
      }
      if (h.level === 2 && h.num === "6" && lastSetup()) {
        const box = body.createDiv("txhp-chq"); const a = box.createEl("a", { cls: "txhp-chq-a", href: "#", text: t("setup", lg) + " · " + this.when(lastSetup().at) });
        a.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); this.go({ kind: "setup" }); });
      }
      const txt = body.createDiv("txhp-ch"); await this.md(sectionAt(this.text, h), txt); this.dropMissing(txt);
      // „Ce e nou”: rândul care începe cu numărul versiunii („**0.4.0** · data”) devine capul versiunii
      for (const pEl of txt.querySelectorAll("p")) { const f = pEl.firstElementChild; if (f && f.tagName === "STRONG" && pEl.firstChild === f && /^\d+\.\d+(\.\d+)?( – \d+\.\d+(\.\d+)?)?$/.test(f.textContent.trim())) pEl.addClass("txhp-ver"); else if (f && f.tagName === "STRONG" && pEl.childNodes.length === 1) pEl.addClass("txhp-steph"); }
      // vecinii: la un capitol, capitolele; la o secțiune, titlul de dinainte și cel de după
      const k = all.findIndex(x => x.i === h.i), pool = h.level === 2 ? all.filter(x => x.level === 2) : all, j = pool.findIndex(x => x.i === h.i);
      const prev = j > 0 ? pool[j - 1] : null, next = j >= 0 && j < pool.length - 1 ? pool[j + 1] : (k >= 0 && k < all.length - 1 ? all[k + 1] : null);
      // înainte și înapoi prin ghid: butoanele stau mereu în același loc (← în stânga, → în dreapta), iar pașii nu se adună în „Înapoi”:
      // „Înapoi” te duce unde erai înainte de ghid, nu prin fiecare capitol citit
      const nav = hrow.createDiv("txhp-nav");
      // pe buton, doar numele scurt (până la „:”), tăiat cu … dacă tot nu încape; săgeata rămâne mereu întreagă
      const slot = (h, cls, back) => {
        if (!h) return nav.createSpan(cls);
        const b = nav.createEl("button", { cls }); b.title = h.text;
        if (back) b.createSpan({ cls: "txhp-nav-ar", text: "← " });
        b.createSpan({ cls: "txhp-nav-t", text: h.text.split(/: | – /)[0] });
        if (!back) b.createSpan({ cls: "txhp-nav-ar", text: " →" });
        b.addEventListener("click", () => this.go({ kind: "chapter", h }, false));
      };
      slot(prev, "txhp-prev", true); slot(next, "txhp-next", false);
    }
    // cuprinsul: capitolele și secțiunile lor, apoi ultima configurare
    tocInto(body) {
      const lg = this.lg;
      for (const h of toc(this.text)) { const r = body.createDiv(h.level === 2 ? "txhp-toc-ch" : "txhp-toc-sec"); r.setText(h.text); if (h.level === 2 && /Insights/.test(h.text)) beta(r); r.addEventListener("click", () => this.go({ kind: "chapter", h })); }
      if (lastSetup()) { const r = body.createDiv("txhp-toc-ch"); r.setText(t("setup", lg) + " · " + this.when(lastSetup().at)); r.addEventListener("click", () => this.go({ kind: "setup" })); }
    }
    // un raport vechi poate trimite la numere de capitol de dinainte („7. Bibliography and export” e acum 4): după nume, când numărul nu se mai potrivește
    fixRefs(md) {
      const all = toc(this.text), bare = x => norm(String(x || "").replace(/^\d+(\.\d+)?\.?\s*/, ""));
      return String(md || "").replace(/\{\{sec:([\d.]+)\|([^}]+)\}\}/g, (m, num, label) => {
        if (!/^\d/.test(label)) return m;
        const cur = all.find(h => h.num === num); if (cur && bare(cur.text) === bare(label)) return m;
        const ws = bare(label).split(/\s+/).filter(w => w.length > 3);
        let hit = all.find(h => bare(h.text) === bare(label)); for (const w of ws) { if (hit) break; hit = all.find(h => bare(h.text).startsWith(w)); }
        return hit ? `{{sec:${hit.num}|${hit.text}}}` : m;
      });
    }
    async renderSetup(v) {
      const r = lastSetup(); if (!r) return this.back();
      v.createDiv({ text: t("setup", this.lg) + " · " + this.when(r.at), cls: "txhp-q" });
      const body = v.createDiv("txhp-body"); this.wire(body);
      await this.md(linkify(this.fixRefs(r.md)), body.createDiv());
    }
    runLink(tp, v) {
      const lg = this.lg;
      if (tp === "sec") return this.goRef([v]);   // un capitol din ghid: aici, în Ajutor
      if (tp === "guide") return (v && v !== this.lg ? this.setLanguage(v) : Promise.resolve()).then(() => this.go({ kind: "contents" }));
      this.close();
      setTimeout(() => {
        try {
          if (tp === "cmd") cmd(v, lg);
          else if (tp === "set") settings(v);
          else if (tp === "note") openNote(v, lg);
          else if (tp === "search") search(v);
          else if (tp === "reveal") reveal(v);
          else if (tp === "os") showOS(C.basePath(app), lg);
        } catch (e) { new Notice(e.message); }
      }, 60);
    }
    // înapoi la listă: cu cursorul în căutare doar dacă ai cerut altă întrebare sau aveai deja o căutare
    backToList(focus) {
      this.item = null; this.state = null; this.stack = [];
      this.answerView.addClass("is-hidden"); this.answerView.empty();
      this.searchView.removeClass("is-hidden");
      if (focus === undefined) focus = this.query.trim().length >= 2;
      this.focused = !!focus; this.sel = 0; this.renderList(); if (focus) setTimeout(() => this.input.focus(), 0);
    }
    unload() { this.comp.unload(); this.c.empty(); }
  }
  class HelpModal extends Modal {
    constructor(lg, opts) { super(app); this.lg = lg; this.opts = opts || {}; }
    onOpen() { this.modalEl.addClass("texere-help-modal"); this.view = new HelpView(this.contentEl, this.lg, () => this.close(), this.opts); return this.view.open(); }
    onClose() { this.view?.unload(); }
  }
  // opts: { chapter: "8" } deschide un capitol din ghid; { contents: true } cuprinsul; { page: "setup" } ultima configurare
  const ask = (lg, opts) => { const m = new HelpModal(lg || C.getLang(app), opts); m.open(); return m; };
  // același Ajutor, desenat într-o pagină (tab-ul nou din Texere) în loc de fereastră; `done` = înapoi la pagina de pornire
  const panel = (el, done, opts) => {
    el.empty(); const f = el.createDiv("tx-embedded");
    f.createDiv("modal-title"); const content = f.createDiv("modal-content");
    let closed = false;
    const view = new HelpView(content, C.getLang(app), () => { if (closed) return; closed = true; try { view.unload(); } catch (e) {} if (done) done(); }, opts);
    view.open();
    return { view, close: () => view.close(), el: f };
  };
  return { ask, panel, actions: A, cmd, settings, HelpView, HelpModal };
}

// comanda „Ajutor” și plugin.help = { ask, panel } (pentru pagina de pornire Texere, unde e butonul Ajutor)
function install(plugin) {
  const H = makeHelp(plugin), lg = C.getLang(plugin.app);
  plugin.addCommand({ id: "help", name: t("cmdName", lg), icon: "life-buoy", callback: () => H.ask() });
  plugin.help = H;
  return H;
}

module.exports = { install, makeHelp, rank, suggestions, qaItems, topItems, linkify, plain, section, findHeading, passages, toks, stem, UI, TOP, toc, sectionAt, chapterQs, guideText };
