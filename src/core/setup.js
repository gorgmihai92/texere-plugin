// Texere · configurarea pe un laptop nou, ca pași pentru fereastra pas-cu-pas (onboarding).
// Fostul șablon din vault „Support/Templates/New laptop setup.md” (3.0.0), fără ce exista doar pentru rularea lui ca șablon
// (scripturile de pornire, nota temporară, pornirea pluginurilor Texere separate: acum sunt module ale pluginului).
//
// Fiecare pas: { id, icon, label, title, explain, question?, check(plugin), options?(plugin), run(plugin, choice) }
//  • label / title / explain / question: { ro, en }
//  • check(plugin) → boolean sau Promise<boolean>: pasul e deja făcut?
//  • options(plugin) → [{ v, icon, label: {ro,en}, rec?, tip?, desc? }]: alegerile arătate omului (dacă pasul cere o alegere)
//  • run(plugin, choice) → Promise<{ ok: [M], todo: [{ msg: M, you?: M, ref?: {step}|{row: M} }], info: [M], tech: [[M|string, string]], restart? }>
// La final: markConfigured(plugin) și writeReport(plugin, rezultate): ce s-a făcut, în Ajutor → „Ultima configurare” (nu o notă în vault).
//
// Regula marketplace-ului Obsidian: un plugin nu instalează alte pluginuri. Pentru PDF++, pasul deschide pagina lui
// din Obsidian (obsidian://show-plugin?id=pdf-plus, același link ca butonul „Add to Obsidian” din directorul comunității);
// omul apasă Install / Enable. Un plugin instalat, dar oprit, se pornește doar la clicul omului.
"use strict";
const { Platform, moment } = require("obsidian");
const { node } = require("../shared/node");
const C = require("./common");

const M = (ro, en) => ({ ro, en });
const FLAG = "texere-setup";
const pause = ms => new Promise(r => setTimeout(r, ms));
const empty = () => ({ ok: [], todo: [], info: [], tech: [] });
const isOn = (app, id) => !!app.plugins?.enabledPlugins?.has?.(id);
const isInstalled = (app, id) => !!app.plugins?.manifests?.[id];
const fsMod = () => { try { return Platform && Platform.isDesktopApp === false ? null : node("fs"); } catch (e) { return null; } };
const isAbs = p => /^(\/|~(\/|$)|[A-Za-z]:[\\/]|\\\\)/.test(String(p || "").trim());

// pagina unui plugin în Obsidian (Community plugins), unde omul apasă Install; rezervă: tab-ul Community plugins din setări
const openPluginPage = (app, id) => {
  try { window.open("obsidian://show-plugin?id=" + encodeURIComponent(id)); return "uri"; } catch (e) {}
  try { app.setting.open(); app.setting.openTabById("community-plugins"); return "settings"; } catch (e) {}
  return null;
};

// ---------- 1. limba ----------
const language = {
  id: "language", icon: "languages", label: M("Limba", "Language"), title: M("Alege limba", "Choose the language"),
  explain: M("Texere, raportul și Ajutorul folosesc limba aleasă. O schimbi oricând din Settings → Texere.", "Texere, the report and Help use the language you choose. Change it any time in Settings → Texere."),
  question: "Alege limba configurării · Choose the setup language:",
  check: plugin => { try { const s = plugin.app.loadLocalStorage(C.LANG_KEY); return s === "ro" || s === "en"; } catch (e) { return false; } },
  options: () => [{ v: "ro", icon: "languages", label: M("Română", "Română") }, { v: "en", icon: "languages", label: M("English", "English") }],
  async run(plugin, choice) {
    const out = empty();
    if (choice === "ro" || choice === "en") C.setLang(plugin.app, choice);
    const lang = C.getLang(plugin.app);
    out.ok.push(M("Configurarea continuă în română.", "The setup continues in English."));
    // limba Obsidian urmează limba aleasă (română = "ro"; engleză = fără setare, adică limba implicită)
    try {
      const want = lang === "ro" ? "ro" : "", now = window.localStorage.getItem("language") || "";
      if (want !== now) {
        if (want) window.localStorage.setItem("language", want); else window.localStorage.removeItem("language");
        out.restart = true;
        out.ok.push(M("Obsidian va fi în română după repornire.", "Obsidian will be in English after a restart."));
      }
    } catch (e) {}
    return out;
  },
};

// ---------- 2. PDF++ (singurul plugin de care depinde Texere) ----------
const PDFPP = { id: "pdf-plus", name: "PDF++" };
const pdfplus = {
  id: "pdfplus", icon: "highlighter", label: M("PDF++", "PDF++"), title: M("PDF++, pentru adnotările din PDF", "PDF++, for your PDF annotations"),
  explain: M("Texere folosește PDF++ pentru adnotările din PDF. Îl instalezi tu, din pagina lui din Obsidian: Install, apoi Enable.",
    "Texere uses PDF++ for your PDF annotations. You install it from its page in Obsidian: Install, then Enable."),
  question: M("PDF++ lipsește sau e oprit. Ce faci acum?", "PDF++ is missing or off. What now?"),
  check: plugin => isOn(plugin.app, PDFPP.id),
  options(plugin) {
    if (isOn(plugin.app, PDFPP.id)) return [];
    const later = { v: "later", icon: "clock", label: M("Nu acum", "Not now") };
    return isInstalled(plugin.app, PDFPP.id)
      ? [{ v: "enable", icon: "power", label: M("Pornește PDF++", "Turn on PDF++"), rec: true }, later]
      : [{ v: "open", icon: "download", label: M("Deschide PDF++ în Community plugins", "Open PDF++ in Community plugins"), rec: true, desc: M("Apasă Install, apoi Enable.", "Click Install, then Enable.") }, later];
  },
  async run(plugin, choice) {
    const app = plugin.app, out = empty();
    if (isOn(app, PDFPP.id)) { out.ok.push(M("PDF++ e pornit.", "PDF++ is on.")); const v = app.plugins.manifests?.[PDFPP.id]?.version; if (v) out.tech.push(["PDF++", v]); return out; }
    if (choice === "enable" && isInstalled(app, PDFPP.id)) {
      try { await app.plugins.enablePluginAndSave(PDFPP.id); out.ok.push(M("Am pornit PDF++.", "Turned on PDF++.")); }
      catch (e) { out.todo.push({ msg: M(`Nu am putut porni PDF++ (${e.message}).`, `I couldn't turn on PDF++ (${e.message}).`), you: M("pornește-l din Settings → Community plugins.", "turn it on in Settings → Community plugins."), ref: { step: 3 } }); }
      return out;
    }
    if (choice === "open") {
      const how = openPluginPage(app, PDFPP.id);
      if (how) out.info.push(M("Am deschis pagina lui PDF++ din Obsidian. Apasă Install, apoi Enable; Texere vede singur când e gata.", "I opened the PDF++ page in Obsidian. Click Install, then Enable; Texere notices by itself when it's done."));
      else out.todo.push({ msg: M("Nu am putut deschide pagina lui PDF++.", "I couldn't open the PDF++ page."), you: M("caută PDF++ în Settings → Community plugins → Browse, apoi Install și Enable.", "search for PDF++ in Settings → Community plugins → Browse, then Install and Enable."), ref: { step: 3 } });
      return out;
    }
    out.todo.push({ msg: M("Încă de făcut: PDF++.", "Still to do: PDF++."), you: M("Settings → Community plugins → Browse → PDF++ → Install, apoi Enable.", "Settings → Community plugins → Browse → PDF++ → Install, then Enable."), ref: { step: 3 } });
    return out;
  },
};
// așteaptă (cât e deschisă fereastra) până când PDF++ e instalat și pornit; întoarce true dacă s-a întâmplat
const waitForPdfPlus = async (plugin, ms = 120000, alive = () => true) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms && alive()) { if (isOn(plugin.app, PDFPP.id)) return true; await pause(1000); }
  return isOn(plugin.app, PDFPP.id);
};

// ---------- 3. harta domeniilor (Fields/Philosophy), din pluginul Texere ----------
const mapItems = async plugin => { try { return typeof plugin.todo === "function" ? (await plugin.todo()).filter(x => x.kind === "map") : []; } catch (e) { return []; } };
const fieldsMap = {
  id: "map", icon: "network", label: M("Harta disciplinei", "Discipline map"), title: M("Creez harta disciplinei", "Creating the discipline map"),
  explain: M("Notele din Disciplines/Philosophy (ramuri, subdomenii, concepte, teorii, curente, perioade, autori) sunt valorile pentru metadatele referințelor tale. Le creez doar pe cele care lipsesc; nu ating ce ai deja.",
    "The notes in Disciplines/Philosophy (branches, subfields, concepts, theories, movements, periods, authors) are the values for your references' metadata. I only create the missing ones; I don't touch what you already have."),
  check: async plugin => !(await mapItems(plugin)).length,
  async run(plugin) {
    const out = empty(), items = await mapItems(plugin);
    if (!items.length) { out.ok.push(M("Harta disciplinei e creată.", "The discipline map is created.")); return out; }
    for (const it of items) {
      try { await plugin.doItem(it); out.ok.push(M(`Gata: ${C.tx(it.label, "ro") || it.label}.`, `Done: ${C.tx(it.label, "en") || it.label}.`)); }
      catch (e) { out.todo.push({ msg: M(`Nu a mers: ${it.label} (${e.message}).`, `Didn't work: ${it.label} (${e.message}).`), you: M("urmează pasul 3 din Ajutor → 6.3 Configurarea manuală.", "follow step 3 in Help → 6.3 Manual setup."), ref: { step: 3 } }); }
    }
    return out;
  },
};

// ---------- 4. bibliografia (Texere · Sources o ține la zi din notele de literatură) ----------
const { GUIDE_SOURCES } = require("../shared/guide-sources");
const { EXAMPLE_SOURCES: EXAMPLES } = require("../shared/guide-sources");
const litCount = (app, src) => { const dir = src.litDir(); return app.vault.getMarkdownFiles().filter(f => f.path.startsWith(dir)).length; };
const bibliography = {
  id: "bibliography", icon: "book-open", label: M("Bibliografie", "Bibliography"), title: M("Verific bibliografia", "Checking the bibliography"),
  explain: M("Adun referințele din Reading Notes într-o listă. Din ea se fac citările și bibliografia.", "I gather the references in Reading Notes into one list. Citations and the bibliography come from it."),
  check(plugin) { const src = C.sourcesApi(plugin); try { return !!src?.lib && src.lib.all().length >= litCount(plugin.app, src); } catch (e) { return false; } },
  async run(plugin) {
    const app = plugin.app, out = empty(), src = C.sourcesApi(plugin);
    if (!src?.rebuildFromNotes) { out.info.push(M("Sărit: Texere · Referințe nu e pornit.", "Skipped: Texere · References isn't on.")); return out; }
    try {
      const n = await src.rebuildFromNotes(true), notes = litCount(app, src);
      // sursele-exemplu din vault (păstrate ca model; se pot șterge după configurare)
      // sursele ghidurilor de scriere (lângă ghiduri, nu în Literature Notes): nu sunt ale tale și nu sunt exemple de șters
      const nG = src.lib.all().filter(e => GUIDE_SOURCES.includes(e.id)).length;
      const nEx = src.lib.all().filter(e => EXAMPLES.includes(e.id)).length;
      out.tech.push([M("Bibliografia", "Bibliography"), "`" + src.bibPath() + "`"]);
      const own = n - nG, join = (x, y) => y ? { ro: x.ro + y.ro, en: x.en + y.en } : x;
      const tail = nG ? M(` Încă ${nG} referințe țin de ghidurile de scriere și stau lângă ele (Support/Texere/Guides); nu le șterge, ghidurile le citează.`, ` Another ${nG} references belong to the writing guides and sit next to them (Support/Texere/Guides); keep them, the guides cite them.`) : null;
      if (n >= notes) out.ok.push(join(nEx && own <= nEx
        ? M(`Lista referințelor e gata: ${own} referințe-exemplu, păstrate ca să vezi cum arată o notă de lectură. Le poți șterge după configurare.`, `The reference list is ready: ${own} example references, kept to show what a reading note looks like. You can delete them after setup.`)
        : nEx ? M(`Lista referințelor tale e gata: ${own} referințe, dintre care ${nEx} exemple (le poți șterge).`, `Your reference list is ready: ${own} references, ${nEx} of them examples (you can delete those).`)
        : M(`Lista referințelor tale e gata: ${own} ${own === 1 ? "referință" : "referințe"}, pe care le poți cita.`, `Your reference list is ready: ${own} ${own === 1 ? "reference" : "references"} you can cite.`), tail));
      else out.todo.push({ msg: M(`Am găsit ${n} referințe, dar în Reading Notes sunt ${notes} note.`, `I found ${n} references, but Reading Notes has ${notes} notes.`),
        you: M("adaugă eticheta literature_note notelor care nu o au, apoi rulează din nou configurarea.", "add the literature_note tag to the notes that lack it, then run the setup again."), ref: { step: 4 } });
    } catch (e) { out.todo.push({ msg: M(`Nu am putut verifica bibliografia (${e.message}).`, `I couldn't check the bibliography (${e.message}).`), you: M("urmează pasul 4 din Ajutor → 6.3 Configurarea manuală.", "follow step 4 in Help → 6.3 Manual setup."), ref: { step: 4 } }); }
    return out;
  },
};

// ---------- 5. folderul exportului: un folder din vault (04. Export) sau oricare de pe laptop ----------
const EXPORT_DIR = "04. Export";
const exportPrev = plugin => {
  const app = plugin.app, s = C.exportStore(plugin)?.settings?.export || {}, fs = fsMod();
  const exists = p => { try { return !!fs && fs.existsSync(String(p).replace(/^~(?=\/|$)/, () => node("os").homedir())); } catch (e) { return false; } };
  return s.folder && (isAbs(s.folder) ? exists(s.folder) : !!app.vault.getAbstractFileByPath(s.folder)) ? s.folder : "";
};
// fereastra sistemului pentru alegerea unui folder (doar pe desktop, dacă Obsidian o lasă deschisă din plugin)
const folderDialog = () => {
  for (const get of [() => node("electron").remote?.dialog, () => node("@electron/remote")?.dialog, () => node("electron")?.remote?.dialog]) {
    try { const d = get(); if (d) return d; } catch (e) {}
  }
  return null;
};
const canPick = () => !!folderDialog();
// întoarce calea, "" dacă ai închis-o, null dacă nu se poate deschide
const pickFolder = async lg => {
  const dlg = folderDialog();
  if (!dlg) return null;
  try {
    const r = await dlg.showOpenDialog({ title: C.tx(M("Alege folderul pentru fișierele exportate", "Choose the folder for exported files"), lg), properties: ["openDirectory", "createDirectory"] });
    return (!r.canceled && r.filePaths && r.filePaths[0]) || "";
  } catch (e) { return null; }
};
const exportFolder = {
  id: "export", icon: "download", label: M("Export", "Export"), title: M("Aleg folderul exportului", "Choosing the export folder"),
  explain: M("Exportul nu are nevoie de alte programe. Tu alegi doar folderul în care apar fișierele exportate.", "Export needs no other program. You only choose the folder where exported files appear."),
  question: M("Selectează locația unde salvez fișierele exportate:", "Select the location where I save exported files:"),
  check: plugin => !!exportPrev(plugin),
  options(plugin) {
    const prev = exportPrev(plugin), sep = Platform?.isWin ? "\\" : "/";
    const opts = [{ v: "export", icon: "folder-open", label: M("Folderul 04. Export din Obsidian", "The 04. Export folder in Obsidian"), rec: true }];
    // „Alege un folder” doar dacă fereastra sistemului se poate deschide pe acest laptop
    if (canPick()) opts.push({ v: "pick", icon: "folder-open", label: M("Alege un folder", "Choose a folder") });
    // „același folder ca data trecută” apare doar dacă e altul decât folderul Export
    const prevName = String(prev).replace(/[\\/]+$/, "").split(/[\\/]/).pop();
    if (prev && prev.replace(/[\\/]+$/, "") !== EXPORT_DIR) opts.unshift({ v: "keep", icon: "folder-open", label: M(`Folderul de data trecută: ${prevName}`, `Last time's folder: ${prevName}`), tip: isAbs(prev) ? prev : C.basePath(plugin.app) + sep + prev });
    return opts;
  },
  // choice: "keep" | "export" | "pick" | null (fereastra închisă înainte de alegere) | o cale deja aleasă (pentru teste / alt UI)
  async run(plugin, choice) {
    const app = plugin.app, out = empty(), store = C.exportStore(plugin), lg = C.getLang(app);
    if (!store) { out.info.push(M("Sărit: Texere · Export nu e pornit.", "Skipped: Texere · Export isn't on.")); return out; }
    const s = store.settings.export = store.settings.export || {}, fs = fsMod();
    const base = C.basePath(app) || "", sep = Platform?.isWin ? "\\" : "/";
    const exists = p => { try { return !!fs && fs.existsSync(p); } catch (e) { return false; } };
    // „4. Export” e același cu „04. Export”: îl folosește pe cel care există; unul nou, după cum numerotează vault-ul
    const P_ = require("../shared/paths"), dirEx = P_.existing(app, EXPORT_DIR) || P_.placeFor(app, EXPORT_DIR);
    const useExport = async () => { if (!app.vault.getAbstractFileByPath(dirEx)) await app.vault.createFolder(dirEx); s.folder = dirEx; };
    try {
      let picked = choice === "pick" ? await pickFolder(lg) : (choice && !["keep", "export", "pick"].includes(choice) ? choice : "");
      if (choice === "pick" && picked === null) {   // fereastra de alegere nu e disponibilă pe acest laptop
        await useExport();
        out.todo.push({ msg: M("Nu pot deschide fereastra pentru alegerea unui folder, așa că folosesc folderul 04. Export.", "I can't open the folder picker here, so I'm using the 04. Export folder."), you: M("dacă vrei alt folder, scrie-l în setările exportului.", "if you want another folder, type it in the export settings."), ref: { step: 5 } });
      } else if (choice === "pick" && !picked) {
        return Object.assign(out, { cancelled: true });   // ai închis fereastra fără să alegi: arată din nou opțiunile
      } else if (picked) {
        if (fs && !exists(picked)) { try { fs.mkdirSync(picked, { recursive: true }); } catch (e) {} }
        if (!fs || exists(picked)) {
          // un folder din vault se ține ca folder din vault (merge și pe alt laptop)
          const b = base.replace(/[\\/]+$/, "");
          s.folder = b && picked.startsWith(b + sep) ? picked.slice(b.length + 1).split(sep).join("/") : picked;
        } else {
          await useExport();
          out.todo.push({ msg: M("Nu am putut crea folderul ales, așa că folosesc folderul 04. Export.", "I couldn't create the chosen folder, so I'm using the 04. Export folder."), you: M("dacă vrei alt folder, rulează din nou configurarea.", "if you want another folder, run the setup again."), ref: { step: 5 } });
        }
      } else if (choice === "keep" && exportPrev(plugin)) s.folder = exportPrev(plugin);
      else {
        await useExport();
        // fereastra a fost închisă înainte de alegere: folderul Export e doar o variantă provizorie, iar raportul o spune
        if (choice == null) out.todo.push({ msg: M("Nu ai ales folderul pentru export (ai închis fereastra), așa că am folosit folderul 04. Export.", "You didn't choose the export folder (you closed the window), so I used the 04. Export folder."), you: M("dacă vrei alt folder, rulează din nou configurarea și alege-l.", "if you want another folder, run the setup again and choose it.") });
      }
      await store.save();
      const outName = String(s.folder || "").replace(/[\\/]+$/, "").split(/[\\/]/).pop();
      out.ok.push(M(`Fișierele exportate apar în folderul **${outName}**.`, `Exported files appear in the **${outName}** folder.`));
      out.tech.push([M("Folderul pentru export", "Export folder"), "`" + (isAbs(s.folder) ? s.folder : base + sep + String(s.folder).split("/").join(sep)) + "`"]);
      try {
        const cite = plugin.cite || app.plugins?.plugins?.["texere-sources"]?.cite, id = cite?.defaultId?.();
        if (id) out.tech.push([M("Stil de citare implicit", "Default citation style"), `${cite.label?.(id) || id.toUpperCase()} (\`${id}.csl\`)`]);
      } catch (e) {}
    } catch (e) { out.todo.push({ msg: M(`Nu am putut alege folderul exportului (${e.message}).`, `I couldn't set the export folder (${e.message}).`), you: M("urmează pasul 5 din Ajutor → 6.3 Configurarea manuală.", "follow step 5 in Help → 6.3 Manual setup."), ref: { step: 5 } }); }
    return out;
  },
};

const STEPS = [language, pdfplus, fieldsMap, bibliography, exportFolder];

// ---------- configurat pe acest laptop ----------
const markConfigured = plugin => { const app = plugin.app; try { app.saveLocalStorage(FLAG, { version: String(plugin.manifest?.version || ""), base: C.basePath(app), date: moment().format("YYYY-MM-DD") }); } catch (e) {} };
// niciodată configurat pe acest laptop, sau vault mutat / copiat în alt folder
const needsConfig = plugin => { const app = plugin.app, f = app.loadLocalStorage(FLAG); return !f || f.base !== C.basePath(app); };

// ---------- ultima configurare: ce s-a făcut și ce mai e de făcut, în Ajutor (plugin.settings.lastSetup), cu legături spre ghidul din Ajutor ----------
const START = [["2", M("Adaugi o referință", "Add a reference")], ["2.5", M("Citești și adnotezi pasajele importante", "Read and annotate the key passages")], ["3", M("Scrii și citezi", "Write and cite")], ["4", M("Exporți în PDF sau Word", "Export to PDF or Word")]];
const secLines = (txt, num) => {
  const A = txt.split("\n"), i = A.findIndex(l => new RegExp("^#{2,6}\\s+" + num.replace(".", "\\.") + "[.\\s]").test(l));
  if (i < 0) return [];
  let j = i + 1; while (j < A.length && !/^#{1,6}\s/.test(A[j])) j++;
  return A.slice(i + 1, j);
};
// results: rezultatele pașilor (run), în ordine; întoarce ce s-a păstrat ({ at, lang, md }) sau null
async function writeReport(plugin, results) {
  const app = plugin.app, lang = C.getLang(app), tx = m => C.tx(m, lang);
  let ghid = ""; try { ghid = require("./help").guideText(lang); } catch (e) {}
  const ok = [], todo = [], tech = [];
  for (const r of results || []) { if (!r) continue; ok.push(...(r.ok || [])); todo.push(...(r.todo || [])); tech.push(...(r.tech || [])); }
  // ce nu s-a putut face, cu pasul din ghid care îl rezolvă ({ step: n } = configurarea manuală, 6.3; { row } = tabelul de erori, 6.4)
  const guideFix = ref => {
    if (!ref || !ghid) return "";
    if (ref.step) {
      const A = secLines(ghid, "6.3"), i = A.findIndex(l => l.startsWith(ref.step + ". "));
      if (i < 0) return "";
      let j = i + 1; while (j < A.length && /^(\t|  )/.test(A[j])) j++;
      return `**${tx(M(`Pasul ${ref.step} din configurarea manuală`, `Step ${ref.step} of the manual setup`))}**\n\n` + [A[i].replace(/^\d+\.\s*/, "")].concat(A.slice(i + 1, j).map(l => l.replace(/^(\t|    |  )/, ""))).join("\n");
    }
    if (ref.row) {
      const row = secLines(ghid, "6.4").find(l => l.startsWith("|") && l.includes(tx(ref.row)));
      if (!row) return "";
      const c = row.split("|").map(x => x.trim()).filter(Boolean);
      const head = c[0].replace(/\*\*/g, ""); return `**${head.charAt(0).toUpperCase() + head.slice(1)}**\n- ${tx(M("De ce", "Why"))}: ${c[1]}\n- ${tx(M("Ce faci", "What to do"))}: ${c[2]}`;
    }
    return "";
  };
  const refLabel = ref => tx(ref?.step ? M(`pasul ${ref.step} din ghid`, `step ${ref.step} in the guide`) : ref?.row ? M("tabelul de erori din ghid", "the error table in the guide") : "");
  const secHead = num => (ghid.match(new RegExp("^#{2,3}\\s+(" + num.replace(".", "\\.") + "\\.?\\s[^\\n]+?)\\s*$", "m")) || [])[1];
  const refs = []; todo.forEach(t => { if (t.ref && !refs.some(r => JSON.stringify(r) === JSON.stringify(t.ref))) refs.push(t.ref); });
  const howTo = refs.map(guideFix).filter(Boolean).join("\n\n");
  const h8 = secHead("6") || tx(M("6. Probleme și întrebări", "6. Problems and questions"));
  const setupHow = tx(M("**Settings → Texere** → **Rulează configurarea din nou**", "**Settings → Texere** → **Run the setup again**"));
  const os = Platform?.isWin ? "Windows" : (Platform?.isMacOS ? "Mac" : "Linux"), base = C.basePath(app);
  const md = `### ${tx(M("Începe aici", "Start here"))}\n\n`
    + START.map(([num, label], i) => { const h = secHead(num); return `${i + 1}. **${tx(label)}**` + (h ? ` → {{sec:${num}|${h}}}` : ""); }).join("\n")
    + "\n\n" + tx(M("Ai o întrebare? Scrie-o aici, în **Ajutor**, cu cuvintele tale.", "Have a question? Type it here, in **Help**, in your own words."))
    + (todo.length ? `\n\n### ${tx(M("Ce ai de făcut", "What you need to do"))}\n`
        + todo.map(t => `- ${tx(t.msg)}${t.you ? ` **${tx(M("Tu:", "You:"))}** ${tx(t.you)}` : ""}${t.ref ? " " + tx(M("Vezi mai jos", "See below")) + ` (${refLabel(t.ref)}).` : ""}`).join("\n") : "")
    + (howTo ? `\n\n### ${tx(M("Cum rezolvi (din ghid)", "How to fix it (from the guide)"))}\n\n${howTo}\n\n{{sec:6|${tx(M("Deschide în ghid", "Open in the guide"))}: ${h8.replace(/^6\.\s*/, "")}}}` : "")
    + (todo.length ? "\n\n" + tx(M(`După ce rezolvi, rulează din nou configurarea: ${setupHow}.`, `Once fixed, run the setup again: ${setupHow}.`)) : "")
    + `\n\n### ${tx(M("Ce s-a făcut", "What was done"))}\n`
    + (ok.length ? ok.map(x => `- ${tx(x)}`).join("\n") : `- ${tx(M("Nimic.", "Nothing."))}`)
    + `\n\n> [!info]- ${tx(M("Detalii tehnice", "Technical details"))}\n`
    + [[M("Sistem", "System"), os], ["Vault", "`" + base + "`"], ...tech].map(([k, v]) => `> - ${tx(k)}: ${v}`).join("\n");
  const rec = { at: new Date().toISOString(), lang, md };
  plugin.settings.lastSetup = rec; await plugin.save?.();
  return rec;
}
// ultima configurare se deschide în Ajutor
const openReport = async plugin => { plugin.help?.ask?.(null, { page: "setup" }); };

module.exports = { STEPS, language, pdfplus, fieldsMap, bibliography, exportFolder, openPluginPage, waitForPdfPlus, canPick, pickFolder, markConfigured, needsConfig, writeReport, openReport, FLAG, M };
