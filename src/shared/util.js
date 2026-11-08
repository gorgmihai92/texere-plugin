// Unelte mici folosite de mai multe module (o singură definiție pentru toate).
const { node } = require("./node");

// fără diacritice, cu litere mici: „Știință” → „stiinta”
const fold = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// ceasurile lui Node (doar pe desktop): merg normal și când Obsidian e în fundal (salvezi din browser, lucrezi în Zotero),
// pe când cele ale ferestrei încetinesc; fără Node, cele ale ferestrei
const NT = (() => { const t = node("timers"); return typeof t?.setTimeout === "function" ? t : null; })();
const later = (f, ms) => (NT ? NT.setTimeout(f, ms) : setTimeout(f, ms));
const unlater = h => { if (h == null) return; try { if (NT) NT.clearTimeout(h); else clearTimeout(h); } catch (e) {} };
const sleep = ms => new Promise(r => later(r, ms));

// un element HTML cu clasă și text (fără innerHTML)
const el = (tag, cls, txt) => { const x = document.createElement(tag); if (cls) x.className = cls; if (txt != null) x.textContent = txt; return x; };

// folderele din vault, în ordine, fără cele ascunse (.obsidian, .trash…)
function vaultFolders(app) {
  const v = app.vault, out = new Set(), walk = f => { for (const c of f.children || []) if (Array.isArray(c.children)) { out.add(c.path); walk(c); } };
  try { if (v.getAllFolders) for (const f of v.getAllFolders()) out.add(f.path); else if (v.getRoot) walk(v.getRoot()); else for (const f of v.getAllLoadedFiles?.() || []) if (Array.isArray(f.children)) out.add(f.path); } catch (e) {}
  return [...out].filter(p => p && p !== "/" && !p.split("/").some(x => x.startsWith("."))).sort((a, b) => a.localeCompare(b));
}

// o fereastră a pluginului desenată într-o pagină (tab-ul Texere) în loc de fereastră: aceeași clasă, alt loc; „Închide” = done()
function mountIn(m, host, done) {
  host.empty(); const frame = host.createDiv("tx-embedded");
  m.containerEl = host; m.modalEl = frame; m.titleEl = frame.createDiv("modal-title"); m.contentEl = frame.createDiv("modal-content");
  let closed = false; m.open = () => {}; m.close = () => { if (closed) return; closed = true; try { m.onClose?.(); } catch (e) {} done?.(); };
  Promise.resolve().then(() => m.onOpen?.()).catch(e => console.error("Texere: ecranul în pagină", e));
  return m;
}

// „Avansat” în setări: rândurile folosite rar, într-un bloc închis; întoarce locul în care se pun rândurile.
// Rămâne deschis/închis cum l-ai lăsat, cât e deschisă fereastra setărilor (key = numele secțiunii).
const advOpen = new Set();
function advanced(parent, label, key) {
  const d = parent.createEl("details", { cls: "tx-adv" }); if (key && advOpen.has(key)) d.open = true;
  d.createEl("summary", { text: label });
  if (key) d.addEventListener("toggle", () => { if (d.open) advOpen.add(key); else advOpen.delete(key); });
  return d.createDiv("tx-adv-body");
}

// deschide dinainte un „Avansat” (de exemplu când un buton din altă secțiune trimite la un rând din el)
const openAdvanced = key => { if (key) advOpen.add(key); };

// alegi un folder din vault, cu căutare (același selector pentru toate rândurile „Schimbă…” din setări)
//   o: { placeholder, exclude: [căi], extra: [{ text, run }] (rânduri în plus, ex. „Alt folder de pe calculator…”) }
function pickFolder(app, o, onPick) {
  const { FuzzySuggestModal } = require("obsidian");
  const ex = new Set(o?.exclude || []), items = [...(o?.extra || []).map(x => ({ t: x.text, run: x.run })), ...vaultFolders(app).filter(f => !ex.has(f)).map(f => ({ t: "📁 " + f, v: f }))];
  const M = class extends FuzzySuggestModal { getItems() { return items; } getItemText(x) { return x.t; } onChooseItem(x) { if (x.run) x.run(); else onPick(x.v); } };
  const m = new M(app); if (o?.placeholder) m.setPlaceholder(o.placeholder); m.open(); return m;
}

module.exports = { fold, later, unlater, sleep, el, vaultFolders, mountIn, advanced, openAdvanced, pickFolder };
