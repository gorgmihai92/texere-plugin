// Unde ține Texere lucrurile: notele surselor, PDF-urile, Inbox-ul, exportul, șabloanele și ghidurile.
// La prima configurare alegi structura recomandată (cu numele pe care le are deja vault-ul: „1. Sources” = „01. Sources”)
// sau folderele tale. Texere doar ține minte unde pune lucrurile noi: nu mută și nu suprascrie nimic; un folder care lipsește
// se creează gol. Doar exportul poate fi în afara vault-ului (o cale absolută, pe macOS sau Windows).
"use strict";
const P_ = require("../shared/paths");

const M = (ro, en) => ({ ro, en });
const isAbs = p => /^(\/|~(\/|$)|[A-Za-z]:[\\/]|\\\\)/.test(String(p || "").trim());

// locurile, cu recomandarea fiecăruia (calea „canonică”; în vault se folosește forma care există deja)
const PLACES = [
  { key: "notes", icon: "file-text", rec: "01. References/Reading Notes",
    label: M("Notele de lectură", "Reading notes"), desc: M("O notă pentru fiecare carte sau articol: datele lui, PDF-ul și adnotările tale.", "One note per book or article: its data, its PDF and your annotations.") },
  { key: "pdfs", icon: "file", rec: "01. References/PDFs",
    label: M("PDF-urile", "PDFs"), desc: M("PDF-urile referințelor, descărcate sau aduse de tine.", "The references' PDFs, downloaded or added by you.") },
  { key: "inbox", icon: "inbox", rec: "01. References/PDFs/Inbox",
    label: M("Inbox pentru PDF-uri", "Inbox for PDFs"), desc: M("Unde pui PDF-urile care încă nu au o referință; Texere te întreabă cărei referințe le aparțin.", "Where you drop PDFs that don't have a reference yet; Texere asks which reference they belong to.") },
  { key: "export", icon: "download", rec: "04. Export", outside: true,
    label: M("Exportul", "Export"), desc: M("Unde ajung fișierele exportate (PDF, Word). Poate fi și în afara vault-ului.", "Where exported files (PDF, Word) go. It can be outside the vault too.") },
  { key: "templates", icon: "layout-template", rec: "Support/Templates",
    label: M("Șabloanele", "Templates"), desc: M("Șabloanele pentru un articol și pentru lucrarea de licență sau de disertație.", "The templates for an article and for a BA or MA thesis.") },
];

// recomandarea, cu numele din vault-ul tău (sau cum ar fi numerotată acolo, dacă nu există încă)
function recommended(app, key) {
  const p = PLACES.find(x => x.key === key); if (!p) return "";
  return P_.existing(app, p.rec) || P_.placeFor(app, p.rec);
}

// o cale aleasă de tine: în vault (cu „/”, fără „..”, fără foldere ascunse) sau, doar la export, o cale absolută de pe calculator
function clean(value, { outside = false, base = "" } = {}) {
  let v = String(value || "").trim();
  if (!v) return { error: M("Alege un folder.", "Choose a folder.") };
  // o cale din vault lipită întreagă (/Users/ana/Vault/Refs sau C:\…\Vault\Refs): o facem relativă la vault
  const b = String(base || "").replace(/[\\/]+$/, "");
  if (b && (v + "/").replace(/\\/g, "/").startsWith(b.replace(/\\/g, "/") + "/")) { v = v.replace(/\\/g, "/").slice(b.replace(/\\/g, "/").length).replace(/^\/+/, ""); if (!v) return { error: M("Alege un folder din vault (nu chiar rădăcina lui).", "Choose a folder inside the vault (not its root).") }; }
  // „/Refs” scris cu bară la început e tot un folder din vault; o cale de calculator (/Users/…, /home/…, /Volumes/…, C:\…, ~/…) nu
  else if (!outside && /^\/(?!(Users|home|Volumes|mnt|tmp|private|var|opt|media)(\/|$))/.test(v)) v = v.replace(/^\/+/, "");
  if (isAbs(v)) {
    if (!outside) return { error: M("Alege un folder din vault (nu o cale de pe calculator).", "Choose a folder inside the vault (not a path on your computer).") };
    return { value: v.replace(/[\\/]+$/, "") || v, abs: true };
  }
  v = v.replace(/\\/g, "/").replace(/\/{2,}/g, "/").replace(/^\/+|\/+$/g, "");
  if (!v) return { error: M("Alege un folder din vault (nu chiar rădăcina lui).", "Choose a folder inside the vault (not its root).") };
  const segs = v.split("/");
  if (segs.some(s => s === ".." || s === ".")) return { error: M("Calea nu poate conține „..”.", "The path can't contain “..”.") };
  if (segs.some(s => s.startsWith("."))) return { error: M("Folderele ascunse (care încep cu „.”) nu se pot folosi.", "Hidden folders (starting with “.”) can't be used.") };
  if (segs.some(s => /[<>:"|?*]/.test(s))) return { error: M("Numele unui folder nu poate conține < > : \" | ? *", "A folder name can't contain < > : \" | ? *") };
  return { value: segs.join("/") };
}

// ce e acum în setări (ca punct de plecare pentru „Folderele mele”)
function current(P) {
  const src = P.mod?.("sources")?.sources, f = (() => { try { return src?.filesConf?.() || {}; } catch (e) { return {}; } })();
  const ex = P.mod?.("export")?.settings?.export?.folder || P.settings?.modules?.export?.export?.folder || "";
  const root = p => String(p || "").replace(/\/+$/, "").replace(/\/?\{\{.*$/, "");
  // cu numele din vault („04. Export” → „4. Export”, dacă așa e acolo); o cale de pe calculator rămâne cum e
  const inVault = p => { p = root(p); return !p || isAbs(p) ? p : (P_.existing(P.app, p) || P_.existingPrefix(P.app, p) || p); };
  return { notes: inVault(f.notes), pdfs: inVault(f.pdfs), inbox: inVault(f.inbox), export: inVault(ex), templates: inVault(P.settings?.dirs?.templates || "") };
}

// aplică alegerea: { notes, pdfs, inbox, export, templates } (căi deja curățate); creează folderele care lipsesc, goale
async function apply(P, choice, mode) {
  const app = P.app, V = app.vault, done = [], fail = [];
  const mk = async dir => { let cur = ""; for (const part of dir.split("/")) { cur = cur ? `${cur}/${part}` : part; if (!V.getAbstractFileByPath(cur)) { try { await V.createFolder(cur); } catch (e) {} } } };
  for (const k of ["notes", "pdfs", "inbox", "templates"]) if (choice[k]) { await mk(choice[k]); done.push(k); }
  // Sources: notele, PDF-urile, Inbox-ul (dacă aveai variabile în nume, ex. „Documents/{{authorsShort}}”, rămân după folderul nou)
  const S = P.mod?.("sources")?.sources;
  if (S?.conf) {
    const c = S.conf(), old = c.files || {}, tail = p => { const s = String(p || ""), i = s.indexOf("{{"); return i < 0 ? "" : s.slice(s.lastIndexOf("/", i)); };
    c.files = { ...old, notes: choice.notes + tail(old.notes), pdfs: choice.pdfs + tail(old.pdfs), inbox: choice.inbox };
    try { await S.save(); } catch (e) { fail.push("sources"); }
  } else {   // Sources oprit: alegerea așteaptă în setările lui, pentru când îl pornești
    const mods = (P.settings.modules = P.settings.modules || {}), m = (mods.sources = mods.sources || {}), c = (m.sources = m.sources || {});
    c.files = { ...(c.files || {}), notes: choice.notes, pdfs: choice.pdfs, inbox: choice.inbox };
  }
  // Exportul: prin pasul lui (merge și pentru o cale de pe calculator, pe macOS și Windows)
  if (choice.export) {
    try {
      const store0 = require("./common").exportStore(P);
      if (choice.exportAbs && store0) { const r = await require("./setup").exportFolder.run(P, choice.export); if (r?.todo?.length) fail.push("export"); else done.push("export"); }
      else if (choice.exportAbs) {   // Export oprit: creăm folderul de pe calculator și îl lăsăm în setările lui
        let ok = true; try { const fs = require("fs"); if (!fs.existsSync(choice.export)) fs.mkdirSync(choice.export, { recursive: true }); } catch (e) { ok = false; }
        const mods = (P.settings.modules = P.settings.modules || {}), m = (mods.export = mods.export || {}); m.export = { ...(m.export || {}), folder: choice.export };
        (ok ? done : fail).push("export");
      }
      else {
        await mk(choice.export);
        const store = require("./common").exportStore(P);
        if (store) { const s = store.settings.export = store.settings.export || {}; s.folder = choice.export; await store.save(); }
        else { const mods = (P.settings.modules = P.settings.modules || {}), m = (mods.export = mods.export || {}); m.export = { ...(m.export || {}), folder: choice.export }; }   // Export oprit
        done.push("export");
      }
    } catch (e) { console.error("Texere: exportul", e); fail.push("export"); }
  }
  P.settings.dirs = { ...(P.settings.dirs || {}), templates: choice.templates || P.settings.dirs?.templates };
  P.settings.structure = mode === "own" ? "own" : "recommended";
  // vault nou, structura Texere: atașamentele (imagini lipite, fișiere) în Support/Media, ca în vault-ul Texere; doar dacă n-ai ales tu alt loc
  try { if (mode !== "own" && P.freshVault?.() && ["", "/", "./"].includes(String(V.getConfig?.("attachmentFolderPath") ?? ""))) { const m = P_.placeFor(app, "Support/Media"); await mk(m); V.setConfig?.("attachmentFolderPath", m); done.push("attachments"); } } catch (e) {}
  await P.save();
  return { done, fail };
}

module.exports = { PLACES, recommended, clean, current, apply, isAbs };
