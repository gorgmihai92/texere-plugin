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

// prima configurare, pas cu pas: după ce alegi structura, fiecare pas face un singur lucru și îți arată ce a făcut; apoi „Înainte”.
// Ce n-a mers rămâne scris în pas (și în raport), cu ce ai de făcut; nu oprește restul.
const PRE = require("./pdfpreset");
const STYLE_NAMES = "APA · Chicago (author-date) · Chicago (notes) · MLA · Harvard · IEEE";
const mkdirs = async (V, dir) => { let cur = ""; for (const part of dir.split("/")) { cur = cur ? `${cur}/${part}` : part; if (!V.getAbstractFileByPath(cur)) { try { await V.createFolder(cur); } catch (e) {} } } };
// alegerea de la „Unde ține Texere lucrurile” (sau, dacă pasul n-a fost, ce e deja în setări)
function pickOf(W) {
  if (W.placesPick) return W.placesPick;
  const P = W.P, cur = PL.current(P), choice = {};
  for (const x of PL.PLACES) choice[x.key] = cur[x.key] || PL.recommended(P.app, x.key);
  return { mode: P.settings.structure === "own" ? "own" : "recommended", choice, others: [] };
}
// după o actualizare, într-un vault configurat înainte: ce lipsește din ce-i trebuie lui Texere ca să meargă.
// Doar folderele lui Texere (nu și Notes, Workspace: ale tale), bibliografia și stilurile, șabloanele și ghidurile, PDF++.
// Un folder mutat sau redenumit (Texere îl găsește în altă parte) nu e refăcut gol: pagina de pornire îți propune „Folosește…” / „Pune-l la loc”.
function missingSetup(P) {
  const V = P.app.vault, out = { folders: [], bib: false, bibForce: false, notes: 0, pdf: false }, cur = PL.current(P), S = P.mod("sources")?.sources;
  for (const x of PL.PLACES) {
    const p = cur[x.key]; if (!p || PL.isAbs(p) || V.getAbstractFileByPath(p)) continue;
    let moved = null;
    if ((x.key === "notes" || x.key === "pdfs") && S?.movedFor) { try { moved = S.movedFor(x.key, p); } catch (e) {} }
    if (x.key === "export") { const m = P.mod("export")?.settings?.export?.folderMoved; if (m && m.from === p && V.getAbstractFileByPath(m.to)) moved = m; }
    if (!moved) out.folders.push({ key: x.key, label: x.label, path: p });
  }
  if (S?.bibPath) {
    let bib = ""; try { bib = S.bibPath(); } catch (e) {}
    const dir = bib.includes("/") ? bib.slice(0, bib.lastIndexOf("/")) : "", f = dir && V.getAbstractFileByPath(dir);
    if (dir && !f) { const away = P.bibElsewhere?.(dir); if (!away) { out.bib = true; out.bibForce = true; } }
    else if (f && (!V.getAbstractFileByPath(bib) || !(f.children || []).some(c => c.extension === "csl"))) out.bib = true;
  }
  try { out.notes = P.noteStatus().filter(n => !n.file).length; } catch (e) {}
  out.pdf = !setup.pdfplus.check(P);
  { const s = P.app.plugins?.plugins?.["pdf-plus"]?.settings; out.preset = !out.pdf && !!s && PRE.isFresh(s); }   // PDF++ pornit, dar cu setările lui de început
  try { out.links = V.getConfig?.("alwaysUpdateLinks") !== true && !!V.setConfig; } catch (e) {}   // Texere redenumește note: linkurile trebuie să urmeze
  out.any = !!(out.folders.length || out.bib || out.notes || out.pdf || out.preset || out.links);
  return out;
}
const AUTO = {
  // după o actualizare: doar folderele lui Texere care lipsesc
  async coreFolders(W) {
    const P = W.P, V = P.app.vault, out = none();
    for (const x of W.missing?.folders || []) { await mkdirs(V, x.path); out.ok.push({ label: x.label, value: x.path, state: V.getAbstractFileByPath(x.path) ? M("creat", "created") : M("n-a mers", "didn't work") }); }
    try { P.markSeen?.((W.missing?.folders || []).map(x => x.path)); P.notify?.(); } catch (e) {}
    return out;
  },
  // 1. folderele: locurile alese, apoi restul structurii (toate, la structura Texere; cele bifate, la ale tale)
  async folders(W) {
    const P = W.P, V = P.app.vault, { mode, choice, others } = pickOf(W), out = none(), had = new Set(), T = x => x;
    for (const p of [...Object.values(choice), ...(others || [])]) if (typeof p === "string" && V.getAbstractFileByPath(p)) had.add(p);
    let res = null; try { res = await PL.apply(P, choice, mode); } catch (e) { console.error("Texere: folderele", e); res = { done: [], fail: ["all"] }; }
    const st = p => had.has(p) ? M("exista deja", "already there") : M("creat", "created");
    for (const x of PL.PLACES) { const p = choice[x.key]; if (!p) continue; out.ok.push({ label: x.label, value: p, state: PL.isAbs(p) ? M("pe calculator", "on your computer") : st(p) }); }
    if (res.fail.length) out.todo.push({ msg: M("Unele foldere nu s-au putut seta; le poți schimba din Settings → Texere → General → Foldere.", "Some folders couldn't be set; you can change them in Settings → Texere → General → Folders.") });
    let made = 0;
    try {
      if (mode === "recommended") { made += await P.createFolders(); P.settings.foldersDone = true; }
      for (const p of others || []) if (!V.getAbstractFileByPath(p)) { await mkdirs(V, p); made++; }
      await P.save();
    } catch (e) { console.error("Texere: folderele", e); }
    // Texere redenumește note (referințele, numele „Autor An – Titlu”): linkurile spre ele trebuie să se actualizeze singure
    try { if (V.getConfig?.("alwaysUpdateLinks") !== true && V.setConfig) { V.setConfig("alwaysUpdateLinks", true); out.ok.push({ label: M("Linkurile se actualizează când redenumești o notă", "Links update when you rename a note"), value: "", state: M("pornit", "turned on") }); } } catch (e) {}
    const rest = (others || []).filter(p => V.getAbstractFileByPath(p));
    if (rest.length) out.ok.push({ label: M("Notițele și lucrările tale", "Your notes and work"), value: [...new Set(rest.map(p => p.split("/").slice(-1)[0]))].join(" · "), state: made ? M(`${made} create`, `${made} created`) : M("existau deja", "already there") });
    try { P.notify?.(); } catch (e) {}
    return out;
  },
  async links(W) {
    const V = W.P.app.vault, out = none();
    try { V.setConfig("alwaysUpdateLinks", true); } catch (e) {}
    if (V.getConfig?.("alwaysUpdateLinks") === true) out.ok.push({ label: M("Linkurile se actualizează când redenumești o notă", "Links update when you rename a note"), value: "Settings → Files and links → Automatically update internal links", state: M("pornit", "turned on") });
    else out.todo.push({ msg: M("Nu am putut porni actualizarea linkurilor.", "Couldn't turn on link updates."), you: M("Settings → Files and links → Automatically update internal links.", "Settings → Files and links → Automatically update internal links.") });
    try { W.P.notify?.(); } catch (e) {}
    return out;
  },
  // 2. bibliografia și stilurile de citare; lista referințelor, din notele de lectură pe care le ai deja
  async bibliography(W) {
    const P = W.P, out = none();
    try { if (W.missing?.bibForce) await require("./essentials").ensure(P, { force: true }); else await P.ensureEssentials?.(); } catch (e) {}
    const S = P.mod("sources")?.sources; let bib = ""; try { bib = S?.bibPath?.() || ""; } catch (e) {}
    if (!S) { out.info.push(M("Modulul Referințe e oprit: bibliografia se face când îl pornești.", "The References module is off: the bibliography is made when you turn it on.")); return out; }
    let n = 0; try { await setup.bibliography.run(P); n = S.lib?.all?.().length || 0; } catch (e) { console.warn("Texere: bibliografia", e); }
    out.ok.push({ label: M("Bibliografia", "Bibliography"), value: bib, state: n ? M(`${n} referințe`, `${n} references`) : M("gata, goală", "ready, empty") });
    const dir = bib.includes("/") ? bib.slice(0, bib.lastIndexOf("/")) : "";
    const styles = (P.app.vault.getAbstractFileByPath(dir || "/")?.children || []).filter(f => f.extension === "csl").length;
    out.ok.push({ label: M("Stilurile de citare", "Citation styles"), value: styles >= 6 ? STYLE_NAMES : `${styles}`, state: M("gata", "ready") });
    return out;
  },
  // 3. șabloanele (articol, autor, licență, disertație) și ghidurile de scris
  async notes(W) {
    const P = W.P, out = none(), before = P.noteStatus().filter(n => n.file).length;
    let made = 0; try { made = await P.addNotes(); } catch (e) { console.error("Texere: notele", e); }
    const tdir = String(P.settings.dirs?.templates || "Support/Templates");
    const all = P.noteStatus(), tpl = all.filter(n => n.path.startsWith("Support/Templates/")), gd = all.filter(n => !n.path.startsWith("Support/Templates/"));
    out.ok.push({ label: M("Șabloanele", "Templates"), value: tpl.map(n => n.path.split("/").pop().replace(/\.md$/, "")).join(" · "), state: M(`în ${tdir}`, `in ${tdir}`) });
    out.ok.push({ label: M("Ghidurile de scris", "Writing guides"), value: gd.map(n => n.path.split("/").pop().replace(/\.md$/, "")).join(" · "), state: M("în Support/Texere/Guides", "in Support/Texere/Guides") });
    if (!made && before) out.info.push(M("Erau deja în vault; nu le-am atins.", "They were already in your vault; I didn't touch them."));
    return out;
  },
  // 4. PDF++: instalat prin Obsidian (ca din Community plugins) și pornit
  async pdfplus(W) {
    const P = W.P, out = none();
    const wasOn = setup.pdfplus.check(P), wasFresh = !wasOn || PRE.isFresh(P.app.plugins.plugins["pdf-plus"]?.settings);
    let r = null; try { r = await setup.pdfplus.run(P, "install"); } catch (e) { console.error("Texere: PDF++", e); r = { ...none(), todo: [{ msg: M(`Nu am putut instala PDF++ (${e.message}).`, `I couldn't install PDF++ (${e.message}).`) }] }; }
    // setările lui Texere pentru PDF++ (dacă PDF++ are încă setările lui de început; ce ți-ai setat tu rămâne)
    let preset = false; if (setup.pdfplus.check(P)) { try { preset = await PRE.apply(P.app); } catch (e) { console.warn("Texere: setările PDF++", e); } }
    if (setup.pdfplus.check(P) && (preset || PRE.hasTexere(P.app.plugins.plugins["pdf-plus"]?.settings))) out.ok.push({ label: M("Setările lui Texere pentru PDF++", "Texere's settings for PDF++"), value: (() => { const a = P.app.plugins.plugins["pdf-plus"]?.settings?.author; return a ? M(`${PRE.SUMMARY.ro} · autorul adnotărilor: ${a}`, `${PRE.SUMMARY.en} · annotations' author: ${a}`) : M(PRE.SUMMARY.ro, PRE.SUMMARY.en); })(), state: preset || wasFresh ? M("puse", "applied") : M("erau deja", "already there") });
    if (setup.pdfplus.check(P)) out.ok.unshift({ label: M("PDF++", "PDF++"), value: M("adnotările din PDF: culori, etichete, legături spre pasaj", "PDF annotations: colours, tags, links back to the passage"), state: M(`instalat și pornit${P.app.plugins.manifests?.["pdf-plus"]?.version ? " · " + P.app.plugins.manifests["pdf-plus"].version : ""}`, `installed and on${P.app.plugins.manifests?.["pdf-plus"]?.version ? " · " + P.app.plugins.manifests["pdf-plus"].version : ""}`) });
    out.todo.push(...(r?.todo || [])); out.tech.push(...(r?.tech || []));
    return out;
  },
};

// pașii, în ordine (PDF++ apare doar dacă nu e instalat și pornit când se deschide configurarea;
// „Domeniul tău” doar la prima configurare, când n-ai ales încă: la o configurare din nou nu mai apare)
function buildSteps(P, first) {
  const S = setup, steps = [];
  steps.push({ id: "language", icon: "sparkles", title: M("Bun venit în Texere", "Welcome to Texere"),
    explain: M("Referințele, lectura și scrisul tău, într-un singur loc. Alege limba:", "Your references, reading and writing, in one place. Choose your language:"),
    check: () => S.language.check(P), lang: true });
  // unde ține Texere lucrurile: structura recomandată sau folderele tale (doar la prima configurare; apoi din Setări → Foldere)
  if (first && !P.settings.structure) steps.push({ id: "places", icon: "folder-tree", title: M("Unde ține Texere lucrurile", "Where Texere keeps things"),
    explain: M("Alege cum pregătesc vault-ul. Apoi fac totul pas cu pas și îți arăt ce am făcut. Nu mut și nu suprascriu nimic din ce ai.",
      "Choose how I set up your vault. Then I do everything step by step and show you what I did. Nothing of yours is moved or overwritten."), places: true, check: () => !!P.settings.structure });
  // prima configurare: fiecare lucru într-un pas al lui, care îți arată ce face și ce a făcut
  if (first) {
    steps.push({ id: "folders", icon: "folder-tree", title: M("Folderele", "Your folders"), auto: AUTO.folders,
      explain: M("Creez folderele în care Texere ține referințele, PDF-urile și exporturile. Ce ai deja rămâne cum e.", "I'm creating the folders where Texere keeps references, PDFs and exports. What you already have stays as it is.") });
    steps.push({ id: "bibliography", icon: "book-open", title: M("Bibliografia și stilurile de citare", "Bibliography and citation styles"), auto: AUTO.bibliography,
      explain: M("Din bibliografie se fac citările (@) și lista de referințe de la export; stilul îl alegi oricând.", "Citations (@) and the exported reference list come from the bibliography; you choose the style any time.") });
    steps.push({ id: "notes", icon: "layout-template", title: M("Șabloanele și ghidurile de scris", "Templates and writing guides"), auto: AUTO.notes,
      explain: M("Șabloane pentru un eseu, un autor, o lucrare de licență sau de disertație, plus ghidurile de scris.", "Templates for an essay, an author, a BA or MA thesis, plus the writing guides.") });
  }
  if (first && !P.settings.fields?.asked && (P.maps?.() || []).length) steps.push({ id: "fields", icon: "network", title: M("Harta disciplinei tale", "Your discipline's map"),
    explain: M("Pot importa în vault harta unei discipline: câte o notă pentru fiecare ramură, concept, teorie, curent, perioadă și autor, legate între ele, ca un mic dicționar al domeniului. Cu ea etichetezi referințele (de exemplu ramura: Etică) și vezi apoi tot ce ai citit într-o ramură.",
      "I can import a discipline's map into your vault: one note for each branch, concept, theory, movement, period and author, linked together, like a small dictionary of the field. With it you tag your references (for example branch: Ethics), then see everything you read in a branch."), fields: true,
    check: async () => { for (const m of P.maps?.() || []) { try { const st = await P.mapStatus(m); if (st.have < st.total) return false; } catch (e) { return false; } } return true; } });   // toate hărțile deja în vault: nimic de ales, „Înainte”
  const ppFresh = () => { try { const s = P.app.plugins.plugins["pdf-plus"]?.settings; return !!s && PRE.isFresh(s); } catch (e) { return false; } };
  if (first && (!S.pdfplus.check(P) || ppFresh())) steps.push({ id: "pdfplus", icon: "highlighter", title: M("PDF++", "PDF++"), auto: AUTO.pdfplus,
    explain: M("Texere folosește PDF++ pentru adnotările din PDF. Îl instalez din lista oficială Obsidian, îl pornesc și îi pun setările lui Texere: culorile ca etichete, auto-copy, auto-paste, formatele de copiere.", "Texere uses PDF++ for your PDF annotations. I'm installing it from Obsidian's official list, turning it on and giving it Texere's settings: colours as tags, auto-copy, auto-paste, copy formats.") });
  else if (!S.pdfplus.check(P)) steps.push({ id: "pdfplus", icon: "highlighter", title: M("PDF++", "PDF++"), explain: S.pdfplus.explain, setupStep: S.pdfplus, poll: true,
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
  // la o configurare din nou: ce mai lipsește, bifat (la prima, pașii de mai sus au făcut deja totul)
  if (!first) steps.push({ id: "vault", icon: "folder-tree", title: M("Vault-ul tău", "Your vault"),
    explain: M("Adaug doar ce lipsește; ce ai deja rămâne neatins.", "I add only what's missing; what you already have stays untouched."), vault: true });
  steps.push({ id: "done", icon: "check-circle", title: M("Gata", "You're all set"), explain: M("Texere e pregătit. La „Termină” îți deschid pagina de pornire într-un tab nou. Iată unde găsești totul:", "Texere is ready. When you click Finish, I'll open the home page in a new tab. Here's where to find everything:"), info: true, last: true,
    body: (el, W) => {
      const ul = el.createEl("ul", { cls: "txw-where" });
      for (const [ic, a, b] of [["texere", M("Pagina de pornire", "Home"), M("în fiecare tab nou, sau iconița împletită din ribbon (bara de iconițe din stânga).", "in every new tab, or the braid icon in the ribbon (the icon bar on the left).")],
        ["circle-help", M("Ajutor", "Help"), M("butonul ? de lângă +, jos pe pagina de pornire, sau Ctrl/Cmd + P → Ajutor.", "the ? button next to +, at the bottom of the home page, or Ctrl/Cmd + P → Help.")],
        ["settings", M("Settings → Texere", "Settings → Texere"), M("modulele, limba și configurarea din nou.", "modules, language and running the setup again.")]]) {
        const li = ul.createEl("li"), i = li.createSpan("txw-ic"); icon(i, ic); const t = li.createSpan(); t.createEl("b", { text: W.T(a) }); t.appendText(" — " + W.T(b));
      }
    } });
  return steps;
}

// după o actualizare: doar ce lipsește, câte un pas, apoi „Gata”
function completeSteps(P, miss) {
  const steps = [], v = P.manifest?.version || "";
  steps.push({ id: "intro", icon: "sparkles", title: M("Completez configurarea", "Completing your setup"), info: true,
    explain: M(`Texere ${v} a verificat vault-ul tău: lipsesc câteva lucruri de care Texere are nevoie. Le adaug pe rând, cu „Înainte”. Nu mut și nu schimb nimic din ce ai.`, `Texere ${v} checked your vault: a few things Texere needs are missing. I'll add them one at a time, with Next. Nothing of yours is moved or changed.`),
    body: (el, W) => { const ul = el.createEl("ul", { cls: "txw-where" }), add = (ic, a, b) => { const li = ul.createEl("li"), i = li.createSpan("txw-ic"); icon(i, ic); const t = li.createSpan(); t.createEl("b", { text: W.T(a) }); if (b) t.appendText(" — " + b); };
      if (miss.folders.length) add("folder-tree", M("Folderele lui Texere", "Texere's folders"), miss.folders.map(x => x.path).join(" · "));
      if (miss.bib) add("book-open", M("Bibliografia și stilurile de citare", "Bibliography and citation styles"), "");
      if (miss.notes) add("layout-template", M(`Șabloanele și ghidurile de scris (${miss.notes})`, `Templates and writing guides (${miss.notes})`), "");
      if (miss.pdf) add("highlighter", M("PDF++, pentru adnotările din PDF", "PDF++, for your PDF annotations"), "");
      if (miss.links) add("link", M("Linkurile se actualizează când redenumești o notă", "Links update when you rename a note"), "");
      if (miss.pdf || miss.preset) add("palette", M("Setările lui Texere pentru PDF++", "Texere's settings for PDF++"), W.T(M(PRE.SUMMARY.ro, PRE.SUMMARY.en))); } });
  if (miss.folders.length) steps.push({ id: "folders", icon: "folder-tree", title: M("Folderele lui Texere", "Texere's folders"), auto: AUTO.coreFolders,
    explain: M("Creez folderele în care Texere ține referințele, PDF-urile, exporturile și șabloanele.", "I'm creating the folders where Texere keeps references, PDFs, exports and templates.") });
  if (miss.links) steps.push({ id: "links", icon: "link", title: M("Linkurile", "Links"), auto: AUTO.links,
    explain: M("Texere redenumește note (de ex. „Autor An – Titlu”); pornesc actualizarea linkurilor, ca să nu se rupă.", "Texere renames notes (e.g. “Author Year – Title”); I'm turning on link updates, so links don't break.") });
  if (miss.bib) steps.push({ id: "bibliography", icon: "book-open", title: M("Bibliografia și stilurile de citare", "Bibliography and citation styles"), auto: AUTO.bibliography,
    explain: M("Din bibliografie se fac citările (@) și lista de referințe de la export.", "Citations (@) and the exported reference list come from the bibliography.") });
  if (miss.notes) steps.push({ id: "notes", icon: "layout-template", title: M("Șabloanele și ghidurile de scris", "Templates and writing guides"), auto: AUTO.notes,
    explain: M("Adaug doar ce lipsește; ce ai rămâne neatins.", "I add only what's missing; what you have stays untouched.") });
  if (miss.pdf || miss.preset) steps.push({ id: "pdfplus", icon: "highlighter", title: M("PDF++", "PDF++"), auto: AUTO.pdfplus,
    explain: miss.pdf ? M("Texere folosește PDF++ pentru adnotările din PDF. Îl instalez din lista oficială Obsidian, îl pornesc și îi pun setările lui Texere.", "Texere uses PDF++ for your PDF annotations. I'm installing it from Obsidian's official list, turning it on and giving it Texere's settings.")
      : M("PDF++ are încă setările lui de început. Îi pun setările lui Texere: culorile ca etichete, auto-copy, auto-paste, formatele de copiere, adnotările în PDF.", "PDF++ still has its default settings. I'm giving it Texere's: colours as tags, auto-copy, auto-paste, copy formats, annotations in the PDF.") });
  steps.push({ id: "done", icon: "check-circle", title: M("Gata", "All done"), info: true, last: true,
    explain: M("Texere are tot ce-i trebuie. Configurarea întreagă o poți rula oricând din Settings → Texere.", "Texere has everything it needs. You can run the full setup any time from Settings → Texere.") });
  return steps;
}

class WizardModal extends Modal {
  constructor(P, opts = {}) { super(P.app); this.P = P; this.i = 0; this.results = {}; this.acted = new Set(); this.finished = false; this.complete = !!opts.complete;
    if (this.complete) { this.missing = opts.missing || missingSetup(P); this.steps = completeSteps(P, this.missing); return; }
    let first = false; try { first = setup.needsConfig(P) && !P.settings.onboarded; } catch (e) {} this.first = first; this.steps = buildSteps(P, first); if (opts.step) this.i = Math.max(0, this.steps.findIndex(s => s.id === opts.step)); }
  get lg() { return C.getLang(this.app); }
  T(m) { return C.tx(m, this.lg); }
  onOpen() { this.modalEl.addClass("texere-wizard"); this.P._wiz = this; this.render(); }
  onClose() {
    clearInterval(this._poll); this._poll = null; this.stepRun = null; if (this.P._wiz === this) this.P._wiz = null; this.contentEl.empty();
    if (!this.finished && !this.complete) { try { this.app.saveLocalStorage(LATER, C.basePath(this.app)); } catch (e) {} }
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
    else if (s.auto) this.drawAuto(s, body, row);
    else this.drawActions(s, row, done);
    if (this.results[s.id] && !s.auto) this.showResult(this.results[s.id]);
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
    if (s.auto && !this.results[s.id]) nb.disabled = true;   // întâi termin ce fac în pasul ăsta
    nb.addEventListener("click", async () => {
      if (this.stepRun) { nb.disabled = true; nb.textContent = "…"; let go = false; try { go = await this.stepRun(); } catch (e) { console.error("Texere: configurarea", s.id, e); }
        if (!go) { nb.disabled = false; nb.textContent = T(fwd); return; } }
      // „Domeniul tău”: ce ai ales rămâne ținut minte (și ce era deja în vault); nu te mai întreabă la o configurare din nou
      if (s.fields) { for (const x of fstat || []) if (x.st?.have) await this.P.chooseField(x.m.id); if (!this.P.settings.fields?.asked) { this.P.settings.fields = { asked: true, chosen: [] }; await this.P.save(); } }
      if (s.last) this.finish(); else { this.i++; this.render(); }
    });
  }
  // un pas care face ceva singur (prima configurare): „lucrez…”, apoi lista cu ce s-a făcut (✓), ce n-a mers (cu ce ai de făcut) și „Înainte”
  drawAuto(s, body, row) {
    const T = m => this.T(m), r = this.results[s.id];
    if (!r) {
      const w = body.createDiv("txw-working"); w.createSpan("txw-spin"); w.createSpan({ text: T(M("Lucrez…", "Working…")) });
      if (this._running !== s.id) {
        this._running = s.id;
        Promise.resolve().then(() => s.auto(this)).catch(e => { console.error("Texere: configurarea", s.id, e); return { ...none(), todo: [{ msg: M(`N-a mers: ${e.message}`, `Didn't work: ${e.message}`) }] }; })
          .then(res => { this.results[s.id] = res || none(); this._running = null; if (this.steps[this.i] === s && this.contentEl.isConnected) this.render(); });
      }
      return;
    }
    const ul = body.createEl("ul", { cls: "txw-done-list" });
    for (const x of r.ok || []) {
      const li = ul.createEl("li"), ic = li.createSpan("txw-done-ic"); icon(ic, "check");
      const t = li.createDiv("txw-done-t"), h = t.createDiv("txw-done-h");
      if (typeof x === "object" && x.label) { h.createSpan({ cls: "txw-done-k", text: T(x.label) }); if (x.state) h.createSpan({ cls: "txw-done-s", text: T(x.state) }); if (x.value) t.createDiv({ cls: "txw-done-v", text: typeof x.value === "string" ? x.value : T(x.value) }); }
      else h.createSpan({ cls: "txw-done-k", text: T(x) });
    }
    for (const x of r.info || []) this.note(x, "info");
    for (const x of r.todo || []) this.note(this.T(x.msg) + (x.you ? " " + this.T(x.you) : ""), "todo");
    // PDF++ n-a putut fi instalat (de ex. fără internet): încă o dată, sau pagina lui din Obsidian
    if (s.id === "pdfplus" && !setup.pdfplus.check(this.P)) {
      row.createEl("button", { cls: "mod-cta", text: T(M("Încearcă din nou", "Try again")) }).addEventListener("click", () => { delete this.results[s.id]; this.render(); });
      row.createEl("button", { text: T(M("Deschide pagina lui", "Open its page")) }).addEventListener("click", () => setup.openPluginPage(this.app, "pdf-plus"));
      this._poll = setInterval(() => { if (setup.pdfplus.check(this.P)) { delete this.results[s.id]; this.render(); } }, 1500);
    }
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
  // locurile: două alegeri.
  //  • Structura Texere (recomandat): Texere face tot, la „Înainte”: folderele vault-ului Texere (din git), bibliografia și stilurile,
  //    exportul, șabloanele și ghidurile, PDF++ (instalat prin Obsidian, din lista oficială).
  //  • Folderele mele: folderele lui Texere (referințele, PDF-urile, Inbox-ul, exportul, șabloanele; bibliografia) se creează oricum,
  //    cu numele alese de tine; celelalte (Notes, Workspace…) sunt ale tale: doar cele bifate. Și aici, PDF++ instalat.
  drawPlaces(body, row) {
    const T = m => this.T(m), P = this.P, app = this.app;
    const cur = PL.current(P), rec = Object.fromEntries(PL.PLACES.map(x => [x.key, PL.recommended(app, x.key)]));
    const fresh = (() => { try { return P.freshVault ? P.freshVault() : true; } catch (e) { return true; } })(), again = !!P.settings.onboarded;
    if (!this.placesVals) this.placesVals = Object.fromEntries(PL.PLACES.map(x => [x.key, (again && cur[x.key]) || rec[x.key]]));
    const others = (() => { try { return P.otherFolders ? P.otherFolders() : []; } catch (e) { return []; } })();
    if (!this.othersPicked) this.othersPicked = new Set();
    const mode = this.placesMode || (again ? (P.settings.structure === "own" ? "own" : "rec") : fresh ? "rec" : "own"), exists = p => !!(p && !PL.isAbs(p) && app.vault.getAbstractFileByPath(p));
    const pdfOn = setup.pdfplus.check(P), bib = (() => { try { const b = P.mod("sources")?.sources?.bibPath?.() || ""; return b.includes("/") ? b.slice(0, b.lastIndexOf("/")) : "Support/Texere/Bibliography"; } catch (e) { return "Support/Texere/Bibliography"; } })();
    const opts = body.createDiv("txw-places");
    const card = (k, title, desc, badge) => {
      const c = opts.createEl("label", { cls: "txw-place-opt" + (mode === k ? " is-on" : "") }), r = c.createEl("input", { type: "radio" }); r.name = "txw-places"; r.checked = mode === k;
      r.addEventListener("change", () => { this.placesMode = k; this.render(); });
      const t = c.createDiv("txw-field-t"), h = t.createDiv({ cls: "txw-field-name", text: T(title) }); if (badge) h.createSpan({ cls: "txw-rec", text: T(badge) });
      t.createDiv({ cls: "txw-field-desc", text: T(desc) }); return t;
    };
    const state = p => T(exists(p) ? M("există", "exists") : M("nou", "new"));
    const t1 = card("rec", M("Structura Texere", "The Texere structure"),
      M("Fac eu tot: folderele vault-ului Texere, bibliografia cu stilurile de citare, exportul, șabloanele și ghidurile de scris" + (pdfOn ? "." : ", plus PDF++ (îl instalez din lista oficială Obsidian).") + " Ce ai deja rămâne cum e.",
        "I set up everything: the Texere vault's folders, the bibliography with citation styles, export, templates and writing guides" + (pdfOn ? "." : ", plus PDF++ (installed from Obsidian's official list).") + " What you already have stays as it is."),
      fresh ? M("Recomandat", "Recommended") : M("Recomandat pentru vault-urile noi", "Recommended for new vaults"));
    if (mode === "rec") {
      const ul = t1.createEl("ul", { cls: "txw-place-list" }), li = (k, v, st) => { const x = ul.createEl("li"); x.createSpan({ cls: "txw-place-k", text: k }); x.createSpan({ cls: "txw-place-v", text: v }); x.createSpan({ cls: "txw-place-s", text: st }); };
      for (const x of PL.PLACES) li(T(x.label), rec[x.key], state(rec[x.key]));
      li(T(M("Bibliografia", "Bibliography")), bib, state(bib));
      li(T(M("Restul structurii", "The rest of the structure")), others.map(p => p.split("/").slice(-1)[0]).join(" · "), "");
      if (!pdfOn) li("PDF++", T(M("instalat și pornit", "installed and turned on")), T(M("nou", "new")));
    }
    const t2 = card("own", M("Folderele mele", "My own folders"),
      M("Texere are nevoie de câteva foldere ale lui (referințele, PDF-urile, exportul, bibliografia): le creez cu numele pe care le alegi. Restul vault-ului e al tău." + (pdfOn ? "" : " Instalez și PDF++."),
        "Texere needs a few folders of its own (references, PDFs, export, bibliography): I create them with the names you choose. The rest of the vault is yours." + (pdfOn ? "" : " I'll install PDF++ too.")),
      !fresh && !again ? M("Pentru vault-ul tău", "For your vault") : null);
    const errs = {};
    if (mode === "own") {
      const box = opts.createDiv("txw-place-own");   // în afara cardului: un clic în câmp nu atinge alegerea
      box.createDiv({ cls: "txw-place-sec", text: T(M("Folderele lui Texere · se creează acum", "Texere's folders · created now")) });
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
      { const r = box.createDiv("txw-place-row"), l = r.createDiv("txw-place-l"); l.createDiv({ cls: "txw-place-k", text: T(M("Bibliografia", "Bibliography")) }); l.createDiv({ cls: "txw-check-d", text: T(M("Lista referințelor și stilurile de citare (APA, Chicago, MLA…). O poți muta apoi din Obsidian.", "The list of references and the citation styles (APA, Chicago, MLA…). You can move it later in Obsidian.")) });
        r.createDiv({ cls: "txw-place-f txw-place-v", text: bib }); }
      if (others.length) {
        box.createDiv({ cls: "txw-place-sec", text: T(M("Celelalte foldere · ale tale, doar dacă le vrei", "Other folders · yours, only if you want them")) });
        box.createDiv({ cls: "txw-check-d", text: T(M("Din structura Texere, pentru notițe și lucrări. Le poți face și tu, cum vrei, oricând.", "From the Texere structure, for notes and work. You can also make your own, any time.")) });
        const grid = box.createDiv("txw-place-others");
        for (const p of others) {
          const lab = grid.createEl("label"), cb = lab.createEl("input", { type: "checkbox" }); cb.checked = this.othersPicked.has(p) || exists(p); cb.disabled = exists(p);
          cb.addEventListener("change", () => { if (cb.checked) this.othersPicked.add(p); else this.othersPicked.delete(p); });
          lab.appendText(" " + p);
        }
      }
    }
    // „Înainte” face alegerea (cu verificarea căilor); o cale greșită te ține pe pas, cu mesajul sub câmp
    this.stepRun = async () => {
      const choice = {}; let bad = false;
      const own = k => { const v = String(this.placesVals[k] || "").trim(); if (v) return v;
        const pdfs = String(this.placesVals.pdfs || "").trim().replace(/\/+$/, "");
        if (k === "inbox" && pdfs) return pdfs + "/Inbox";
        if (k === "templates") { try { const f = app.internalPlugins?.getPluginById?.("templates")?.instance?.options?.folder; if (f) return f; } catch (e) {} return rec.templates; }
        return rec[k]; };
      for (const x of PL.PLACES) {
        const r = PL.clean(mode === "rec" ? rec[x.key] : own(x.key), { outside: !!x.outside, base: (() => { try { return C.basePath(app) || ""; } catch (e) { return ""; } })() });
        if (r.error) { bad = true; errs[x.key]?.setText(T(r.error)); continue; }
        choice[x.key] = r.value; if (x.key === "export") choice.exportAbs = !!r.abs;
      }
      if (bad) return false;
      // alegerea se face în pașii următori, unul câte unul (folderele, bibliografia, șabloanele, PDF++); o alegere nouă îi reia
      const pick = { mode: mode === "rec" ? "recommended" : "own", choice, others: mode === "rec" ? others : [...this.othersPicked] };
      if (JSON.stringify(pick) !== JSON.stringify(this.placesPick || null)) for (const k of ["folders", "bibliography", "notes"]) delete this.results[k];
      this.placesPick = pick; this.acted.add("places");
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
      t.createDiv({ cls: "txw-field-name", text: T(M(`Harta ${m.of?.ro || m.ro}${st ? ` · ${st.total} de note` : ""}`, `The map of ${m.of?.en || m.en}${st ? ` · ${st.total} notes` : ""}`)) });
      if (m.desc) t.createDiv({ cls: "txw-field-desc", text: T(M(m.desc.ro, m.desc.en)) });
      const meta = st ? (full ? M(`Importată · în ${st.folder}`, `Imported · in ${st.folder}`)
        : part ? M(`${st.have} din ${st.total} note sunt deja în ${st.folder}; import doar ce lipsește`, `${st.have} of ${st.total} notes are already in ${st.folder}; I'll import only what's missing`)
        : M(`La „Înainte” o import în ${st.folder}`, `On Next, I'll import it into ${st.folder}`)) : null;
      if (meta) t.createDiv({ cls: "txw-field-meta", text: T(meta) });
    }
    body.createEl("p", { cls: "txw-muted", text: T(M("Nu o vrei? Debifeaz-o. O poți importa oricând din Settings → Texere → General → Foldere → Harta disciplinei. Alte discipline vin în versiunile următoare.", "Don't want it? Untick it. You can import it any time in Settings → Texere → General → Folders → Discipline map. More disciplines are coming in later versions.")) });
    this.stepRun = async () => {
      const ok = []; let bad = false;
      for (const { m } of list || []) if (picked.has(m.id)) {
        try { await P.chooseField(m.id); const n = await P.createMap(m); ok.push(M(`Am importat harta ${m.of?.ro || m.ro}: ${n} de note în ${(await P.mapStatus(m).catch(() => null))?.folder || "vault"}.`, `Imported the map of ${m.of?.en || m.en}: ${n} notes in ${(await P.mapStatus(m).catch(() => null))?.folder || "your vault"}.`)); }
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
    const P = this.P, order = ["language", "places", "folders", "bibliography", "notes", "map", "pdfplus", "export"];
    this.finished = true;
    if (this.complete) { P.settings.completedFor = P.manifest?.version || ""; await P.save(); this.close(); new Notice(this.T(M("Texere: configurarea e completă.", "Texere: your setup is complete.")), 6000); try { P.notify(); } catch (e) {} return; }
    try { setup.markConfigured(P); this.app.saveLocalStorage(LATER, null); } catch (e) {}
    P.settings.onboarded = true; await P.save();
    let report = null;
    // rândurile pașilor automați ({ label, value, state }) devin propoziții, ca restul raportului
    const line = (x, l) => { const v = typeof x.value === "string" ? x.value : x.value?.[l] || ""; return `${x.label[l]}: ${v}${x.state ? ` (${x.state[l]})` : ""}`; };
    const flat = r => r && { ...r, ok: (r.ok || []).map(x => x && typeof x === "object" && x.label ? { ro: line(x, "ro"), en: line(x, "en") } : x) };
    try { report = await setup.writeReport(P, order.map(k => flat(this.results[k])).filter(Boolean)); } catch (e) { console.error("Texere: raportul", e); }
    this.close();
    // pagina de pornire într-un tab nou și iconița Texere prima în ribbon (bara de iconițe din stânga)
    try { P.ribbonFirst?.(); } catch (e) {}
    try { P.openHome?.(); } catch (e) {}
    const frag = document.createDocumentFragment(); frag.append(this.T(M("Texere e configurat. ", "Texere is set up. ")));
    if (report) { const a = document.createElement("a"); a.href = "#"; a.textContent = this.T(M("Vezi ce s-a făcut", "See what was done")); a.addEventListener("click", e => { e.preventDefault(); setup.openReport(P); }); frag.append(a); }
    new Notice(frag, 10000);
  }
}

module.exports = { WizardModal, buildSteps, vaultItems, missingSetup, LATER };
