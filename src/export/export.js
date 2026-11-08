// Texere · Export · nota ta → PDF, Word (.docx) sau Markdown, fără alte programe.
// Texere pregătește textul singur:
//  • citările [@cheie, p. 34] ies în stilul ales (stilul notei sau cel implicit), cu același motor ca în editor;
//    stilurile cu note de subsol (Chicago) pun citarea în nota de subsol, numerotată împreună cu notele tale;
//  • bibliografia are doar sursele citate; intră sub titlul „Bibliografie” / „Bibliography” dacă nota îl are, altfel la final;
//  • cuprinsul se face din titlurile notei (sub titlul „Cuprins”, dacă nota îl are), cu numerele paginilor în PDF și Word;
//  • linkurile [[…]] devin text, notele încorporate ![[…]] intră în text, imaginile rămân; etichetele, comentariile și
//    trimiterile spre locul din PDF nu intră (în afara Obsidian nu duc nicăieri); etichetele pot apărea colorate, la cerere.
// Șabloane: Licență și Disertație (Facultatea de Filosofie, Universitatea din București), după ghidul facultății.
const obsidian = require("obsidian");
const { node } = require("../shared/node");
const { vaultFolders, mountIn, pickFolder } = require("../shared/util");
const { placeFor } = require("../shared/paths");
// bibliotecile exportului (din npm, puse în main.js la build; încărcate doar la primul export)
const LIBS = {
  "lib-markdown": () => ({ MarkdownIt: require("markdown-it"), footnote: require("markdown-it-footnote") }),
  "lib-docx": () => require("docx"),
  "lib-paged": () => require("pagedjs/dist/paged.polyfill.min.js"),   // ca text (vezi esbuild.config.mjs): se pune în pagina de tipărit
};
const { Notice, Modal, Setting, PluginSettingTab, TFile, normalizePath } = obsidian;

const DEFAULTS = { format: "pdf", folder: "04. Export", unit: "cm", bibHeading: "", page: "A4", margins: { top: 2.5, right: 2.5, bottom: 2.5, left: 2.5 },
  font: "Times New Roman", size: 12, line: 1.5, indent: 1.25, after: 6, align: "justify", title: true,
  pageNum: { pos: "bottom-center", fmt: "n", first: true, start: 1 }, toc: false, tocDepth: 3, h2Break: false, showTags: false, keepMarks: false, keepColors: false, keepPdfLinks: false, colorLinks: false, presets: {}, defaultPreset: "" };
// ce ține de aspect (fiecare șablon are propria copie)
const VIS = ["page", "margins", "font", "size", "line", "indent", "after", "align", "title", "pageNum", "toc", "tocDepth", "h2Break", "showTags", "keepMarks", "keepColors", "keepPdfLinks", "colorLinks", "bibHeading"];
// Facultatea de Filosofie, UB · Ghid de redactare a lucrărilor de licență și disertație (31 iulie 2023), III.1–III.2
const UB_FF = { page: "A4", margins: { top: 2, right: 2, bottom: 2, left: 2.5 }, font: "Times New Roman", size: 12, line: 1.5, indent: 1.27, after: 0, align: "justify",
  title: false, pageNum: { pos: "bottom-center", fmt: "n", first: false, start: 1 }, toc: true, tocDepth: 3, h2Break: false, showTags: false, keepMarks: false, keepColors: false, keepPdfLinks: false, colorLinks: false, bibHeading: "Bibliografie" };
const UB_LAYOUT = { cover: true, chapterBreak: true, chapterCenter: true, sectionIndent: 1.27, indentAll: true, front: /^(capitolul\s+1\b|introducere|introduction)/i,
  university: "Universitatea din București", faculty: "Facultatea de Filosofie", coordLabel: "Profesor îndrumător:", studentLabel: "Student:" };
const PRESETS = {
  "licenta-ff-ub": { label: ["Licență — Facultatea de Filosofie, UB", "Bachelor's thesis — Faculty of Philosophy, UB"], kind: "Lucrare de licență", settings: UB_FF, layout: UB_LAYOUT },
  "disertatie-ff-ub": { label: ["Disertație — Facultatea de Filosofie, UB", "Master's dissertation — Faculty of Philosophy, UB"], kind: "Lucrare de disertație", settings: UB_FF, layout: UB_LAYOUT },
};
const GUIDE = ["Ghid de redactare a lucrărilor de licență și disertație (31 iulie 2023), Facultatea de Filosofie, Universitatea din București",
  "Writing guide for bachelor's and master's theses (31 July 2023), Faculty of Philosophy, University of Bucharest"];
const FONTS = { serif: ["Times New Roman", "Georgia", "Palatino", "Book Antiqua", "Baskerville", "Garamond", "EB Garamond", "Hoefler Text", "Charter", "Iowan Old Style", "Cambria", "Minion Pro", "Libre Baskerville"],
  sans: ["Helvetica", "Helvetica Neue", "Arial", "Avenir Next", "Gill Sans", "Optima", "Calibri", "Inter", "Source Sans 3", "Verdana"] };
const FALLBACK = { Palatino: '"Palatino Linotype", "Book Antiqua"', "Book Antiqua": '"Palatino Linotype", Palatino', Helvetica: '"Helvetica Neue", Arial', "Helvetica Neue": "Helvetica, Arial", Garamond: '"EB Garamond", "Adobe Garamond Pro"', "Times New Roman": "Times" };
const isSans = f => FONTS.sans.includes(f) || /sans|arial|helvetica|calibri|verdana|avenir|gill|optima|inter/i.test(f || "");
const fontStack = f => { f = String(f || DEFAULTS.font).replace(/"/g, ""); return `"${f}", ${FALLBACK[f] ? FALLBACK[f] + ", " : ""}${isSans(f) ? "sans-serif" : "serif"}`; };
const PAGES = { A4: [210, 297], A5: [148, 210], Letter: [215.9, 279.4] };
const FORMATS = [["pdf", "PDF", "pdf"], ["docx", "Word", "docx"], ["md", "Markdown", "md"]];
const okFormat = f => (FORMATS.some(x => x[0] === f) ? f : "pdf");   // LaTeX și HTML nu mai sunt: ce era ales devine PDF
const PN_POS = ["none", "bottom-center", "bottom-right", "bottom-left", "top-center", "top-right", "top-left"];
const BIB_HEAD = /^(#{1,6})[ \t]+(bibliography|bibliografie|bibliografie selectiv[ăa]|references|referin[țţ]e|works cited|lucr[ăa]ri citate)[ \t]*$/im;
const TOC_HEAD = /^(#{1,6})[ \t]+(cuprins|cuprinsul|contents|table of contents|sumar)[ \t]*$/im;
const TOC_TEXT = /^(cuprins|cuprinsul|contents|table of contents|sumar)$/i;
const TOC_LANG = /^(cuprins|contents)\b/i;   // blocul de cuprins din notă: ```cuprins … ```
const IMG = /\.(png|jpe?g|gif|svg|webp|bmp)$/i;
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
// alinierea textului: stânga, centrat, dreapta, la ambele margini (setările vechi aveau doar „justify”: da/nu)
// iconițele alinierii (desenate aici: arată la fel în orice temă și versiune de Obsidian)
const ALIGN_LINES = { left: [[3, 21], [3, 15], [3, 18]], center: [[3, 21], [7, 17], [5, 19]], right: [[3, 21], [9, 21], [6, 21]], justify: [[3, 21], [3, 21], [3, 21]] };
const alignIcon = v => {
  const NS = "http://www.w3.org/2000/svg", svg = document.createElementNS(NS, "svg");
  for (const [k, val] of Object.entries({ viewBox: "0 0 24 24", width: "16", height: "16", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round" })) svg.setAttribute(k, val);
  ALIGN_LINES[v].forEach(([x1, x2], i) => { const l = document.createElementNS(NS, "line"); l.setAttribute("x1", x1); l.setAttribute("x2", x2); l.setAttribute("y1", 6 + i * 6); l.setAttribute("y2", 6 + i * 6); svg.appendChild(l); });
  return svg;
};
const alignOf = s => ["left", "center", "right", "justify"].includes(s?.align) ? s.align : (s?.justify === false ? "left" : "justify");
// folderul exportului: unul din vault („04. Export”) sau oricare de pe calculator (/Users/…/Exporturi, ~/Desktop, C:\…)
const isAbsDir = p => /^(\/|~(\/|$)|[A-Za-z]:[\\/]|\\\\)/.test(String(p || "").trim());
const homeDir = p => { const s = String(p || "").trim(); if (!s.startsWith("~")) return s; try { return node("os").homedir() + s.slice(1); } catch (e) { return s; } };
const strip = h => String(h || "").replace(/<[^>]+>/g, "").replace(/&#38;|&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const b64 = buf => { const u = new Uint8Array(buf); let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
const MIME = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", svg: "image/svg+xml", webp: "image/webp", bmp: "image/bmp" };
const clone = o => JSON.parse(JSON.stringify(o));
const rgbHex = c => { const m = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/.exec(String(c || "")); if (!m || (m[4] != null && +m[4] === 0)) return null; return [m[1], m[2], m[3]].map(v => (+v).toString(16).padStart(2, "0")).join("").toUpperCase(); };
// HTML-ul exportului (făcut de markdown-it) pus într-un element al documentului de export, fără innerHTML:
// DOMParser face un document inert (fără scripturi, fără încărcări), iar nodurile lui se mută în element
const setHTML = (el, html) => { const d = new DOMParser().parseFromString(`<!doctype html><html><body>${html}</body></html>`, "text/html"); el.replaceChildren(...d.body.childNodes); };
// o culoare CSS (#rgb, #rrggbb, #rrggbbaa, rgb(), rgba()) → hex pe alb (transparența se amestecă cu albul hârtiei)
// culoarea principală a temei (accentul lui Obsidian), pentru linkurile și citările colorate din export; albastrul clasic dacă nu se poate afla
const accentHex = () => {
  try { const d = document.createElement("span"); d.style.color = "var(--text-accent)"; document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return rgbHex(c) || "0563C1"; } catch (e) { return "0563C1"; }
};
const cssHex = v => {
  v = String(v || "").trim(); let r, g, b, a = 1, m;
  if ((m = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(v))) [r, g, b] = [m[1], m[2], m[3]].map(x => parseInt(x + x, 16));
  else if ((m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})?$/i.exec(v))) { [r, g, b] = [m[1], m[2], m[3]].map(x => parseInt(x, 16)); if (m[4]) a = parseInt(m[4], 16) / 255; }
  else if ((m = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/.exec(v))) { [r, g, b] = [m[1], m[2], m[3]].map(Number); if (m[4] != null) a = +m[4]; }
  else return null;
  return [r, g, b].map(c => Math.round(c * a + 255 * (1 - a)).toString(16).padStart(2, "0")).join("").toUpperCase();
};
// dimensiunile unei imagini (PNG, JPEG, GIF), pentru Word
function imageSize(buf) {
  const u = new Uint8Array(buf), dv = new DataView(u.buffer, u.byteOffset, u.byteLength);
  try {
    if (u[0] === 0x89 && u[1] === 0x50) return { w: dv.getUint32(16), h: dv.getUint32(20), type: "png" };
    if (u[0] === 0x47 && u[1] === 0x49) return { w: dv.getUint16(6, true), h: dv.getUint16(8, true), type: "gif" };
    if (u[0] === 0xff && u[1] === 0xd8) { let i = 2; while (i < u.length) { if (u[i] !== 0xff) { i++; continue; } const m = u[i + 1], len = dv.getUint16(i + 2); if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { h: dv.getUint16(i + 5), w: dv.getUint16(i + 7), type: "jpg" }; i += 2 + len; } }
  } catch (e) {}
  return null;
}

class Exporter {
  constructor(S, dir) { this.S = S; this.app = S.app; this.host = S.host; this.dir = dir; this.libs = {}; }
  T(a, b) { return this.S.T(a, b); }
  // setările generale (și copiile șabloanelor, în presets)
  conf() {
    const c = this.S.conf();
    // prima dată: folderele propuse, cu numele din vault-ul tău („4. Export”, nu „04. Export”)
    if (!c.export) { c.export = clone(DEFAULTS); try { c.export.folder = placeFor(this.app, DEFAULTS.folder) || DEFAULTS.folder; } catch (e) {} }
    const e = c.export;
    if (e.align === undefined && typeof e.justify === "boolean") { e.align = e.justify ? "justify" : "left"; delete e.justify; }
    if (typeof e.pageNumbers === "boolean" && !e.pageNum) { e.pageNum = { pos: e.pageNumbers ? "bottom-center" : "none", fmt: "n", first: true }; delete e.pageNumbers; }
    for (const [k, v] of Object.entries(DEFAULTS)) if (e[k] === undefined) e[k] = clone(v);
    for (const k of Object.keys(DEFAULTS.margins)) if (!Number.isFinite(+e.margins[k])) e.margins[k] = DEFAULTS.margins[k];
    for (const k of Object.keys(DEFAULTS.pageNum)) if (e.pageNum[k] === undefined) e.pageNum[k] = DEFAULTS.pageNum[k];
    e.format = okFormat(e.format);
    return e;
  }
  save() { return this.S.save(); }
  // folderele din vault (pentru selectorul folderului exportului), în ordine
  vaultFolders() { return vaultFolders(this.app); }
  // un folder de pe calculator (fereastra sistemului); unul din vault rămâne cale din vault
  async chooseDir(current) {
    const T = (a, b) => this.T(a, b); let dir = null;
    try { const el = node("electron"), dlg = el.remote?.dialog || el.dialog; const r = await dlg.showOpenDialog({ title: T("Folderul exportului", "Export folder"), properties: ["openDirectory", "createDirectory"], defaultPath: isAbsDir(current) ? homeDir(current) : this.app.vault.adapter.getBasePath?.() }); if (!r.canceled && r.filePaths?.[0]) dir = r.filePaths[0]; }
    catch (e) { new Notice(T("Nu pot deschide fereastra de alegere a folderului.", "Couldn't open the folder picker."), 8000); }
    if (!dir) return null;
    const base = this.app.vault.adapter.getBasePath?.() || "";
    return base && (dir === base || dir.startsWith(base + "/") || dir.startsWith(base + "\\")) ? (dir.slice(base.length + 1).replace(/\\/g, "/") || DEFAULTS.folder) : dir;
  }
  // folderul exportului nu mai e în vault (redenumit, mutat, șters): întreabă unde salvează; null = renunți
  askFolder(missing) { return new Promise(res => new FolderModal(this, missing, res).open()); }
  // ——— șabloanele: cele generale (""), ale facultății (PRESETS) și ale tale (c.custom: { id: { name, base, settings } }) ———
  custom() { const c = this.conf(); return (c.custom = c.custom && typeof c.custom === "object" ? c.custom : {}); }
  isCustom(id) { return !!(id && this.custom()[id]); }
  exists(id) { return id === "" || !!PRESETS[id] || this.isCustom(id); }
  templates() { return ["", ...Object.keys(PRESETS), ...Object.keys(this.custom()).sort((a, b) => String(this.custom()[a].name).localeCompare(String(this.custom()[b].name)))]; }
  baseOf(id) { let b = this.isCustom(id) ? this.custom()[id].base : id; for (let i = 0; i < 5 && this.isCustom(b); i++) b = this.custom()[b].base; return PRESETS[b] ? b : ""; }
  slug(t) { return String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40); }
  // un șablon nou, pornit din altul (setările lui, copiate); id-ul e numele, scris pentru proprietatea export
  async addTemplate(name, from) {
    const c = this.custom(); let id = this.slug(name) || "sablon", n = 2; while (this.exists(id)) id = `${this.slug(name) || "sablon"}-${n++}`;
    c[id] = { name: String(name).trim() || id, base: this.exists(from) ? from : "", settings: clone(this.pickVis(this.target(from))) };
    await this.save(); return id;
  }
  async renameTemplate(id, name) { if (!this.isCustom(id)) return; this.custom()[id].name = String(name).trim() || this.custom()[id].name; await this.save(); }
  async deleteTemplate(id) { if (!this.isCustom(id)) return; const c = this.conf(); delete this.custom()[id]; if (c.defaultPreset === id) c.defaultPreset = ""; await this.save(); }
  pickVis(o) { const r = {}; for (const k of VIS) r[k] = clone(o[k] ?? DEFAULTS[k]); return r; }
  // șablonul notei: proprietatea export (ex. „licenta”, „disertatie” sau numele unui șablon al tău), altfel cel implicit
  presetFor(fm) {
    const v = String(fm?.export || fm?.["export-template"] || "").trim().toLowerCase(), d = this.conf().defaultPreset;
    if (!v) return this.exists(d) ? d : "";   // nota nu spune: șablonul implicit
    if (PRESETS[v] || this.isCustom(v)) return v;
    const mine = Object.keys(this.custom()).find(k => this.slug(this.custom()[k].name) === this.slug(v)); if (mine) return mine;
    if (/licen/.test(v)) return "licenta-ff-ub";
    if (/disert|master/.test(v)) return "disertatie-ff-ub";
    return "";   // „general” sau altceva: setările generale
  }
  // ai schimbat ceva față de valorile de pornire (ghidul, la șabloanele facultății; ale lui Texere, la cele generale)?
  changed(preset) {
    if (this.isCustom(preset)) return false;   // ale tale nu au „valori de pornire”: le schimbi, le dublezi sau le ștergi
    const cur = this.target(preset), base = preset && PRESETS[preset] ? PRESETS[preset].settings : DEFAULTS;
    return VIS.some(k => JSON.stringify(cur[k] ?? null) !== JSON.stringify(base[k] ?? DEFAULTS[k] ?? null));
  }
  async reset(preset) {
    const c = this.conf();
    if (preset && PRESETS[preset]) { if (c.presets) delete c.presets[preset]; }
    else for (const k of VIS) c[k] = clone(DEFAULTS[k]);
    await this.save();
  }
  resetLabel(preset) { return preset && PRESETS[preset] ? this.T("Înapoi la ghid", "Back to the guide") : this.T("Înapoi la valorile implicite", "Reset to defaults"); }
  // setările după care iese documentul: cele generale sau copia șablonului (pornită din ghid; ce schimbi rămâne la șablon)
  target(preset) {
    const c = this.conf();
    if (this.isCustom(preset)) {   // al tău: setările lui; ce lipsește vine din șablonul din care a pornit
      const o = (this.custom()[preset].settings = this.custom()[preset].settings || {}), b = this.baseOf(preset), src = b ? PRESETS[b].settings : c;
      for (const k of VIS) if (o[k] === undefined) o[k] = clone(src[k] ?? DEFAULTS[k]);
      o.unit = c.unit; return o;
    }
    if (!preset || !PRESETS[preset]) return c;
    const p = (c.presets = c.presets || {});
    if (!p[preset]) p[preset] = clone(PRESETS[preset].settings);
    const o = p[preset];
    if (o.align === undefined && typeof o.justify === "boolean") { o.align = o.justify ? "justify" : "left"; delete o.justify; }
    if (o.pageNum && o.pageNum.start === undefined) o.pageNum.start = 1;
    for (const k of VIS) if (o[k] === undefined) o[k] = clone(PRESETS[preset].settings[k] ?? DEFAULTS[k]);
    o.unit = c.unit;   // unitatea e generală
    return o;
  }
  layout(preset) { const b = this.isCustom(preset) ? this.baseOf(preset) : preset; return (b && PRESETS[b]?.layout) || {}; }
  presetLabel(id) { if (this.isCustom(id)) return this.custom()[id].name; const p = PRESETS[id]; return p ? this.T(p.label[0], p.label[1]) : this.T("Setările generale", "General settings"); }
  // ce scrii în proprietatea export ca nota să folosească șablonul
  presetKey(id) { return this.isCustom(id) ? id : id === "licenta-ff-ub" ? "licenta" : id === "disertatie-ff-ub" ? "disertatie" : "general"; }
  // bibliotecile (în pachetul pluginului): docx și markdown-it ca module; Paged.js ca text, pus în pagina de tipărit
  async lib(name) {
    if (!this.libs[name]) this.libs[name] = LIBS[name]();
    return this.libs[name];
  }
  // fonturile instalate pe calculator (cele care nu sunt, nu apar în listă)
  fontOk(name) {
    this._fonts = this._fonts || {};
    if (name in this._fonts) return this._fonts[name];
    let ok = true;
    try {
      const c = document.createElement("canvas").getContext?.("2d");
      if (c) { const txt = "mmmmmmmmmmlli1WQ@#ĂȘȚ", w = f => { c.font = `72px ${f}`; return c.measureText(txt).width; }; ok = ["monospace", "serif", "sans-serif"].some(b => w(`"${name}", ${b}`) !== w(b)); }
    } catch (e) {}
    return (this._fonts[name] = ok);
  }
  // cum arată o etichetă în Obsidian (tema ta și fragmentele CSS), pentru „Etichetele, colorate”
  tagStyle(name) {
    this._tags = this._tags || {};
    if (this._tags[name]) return this._tags[name];
    let st = null;
    try {
      const host = document.createElement("div"); host.className = "markdown-rendered markdown-preview-view tx-offscreen";
      const a = document.createElement("a"); a.className = "tag"; a.href = "#" + name; a.textContent = "#" + name; host.appendChild(a); document.body.appendChild(host);
      const cs = getComputedStyle(a);
      st = { color: rgbHex(cs.color), bg: rgbHex(cs.backgroundColor), border: cs.borderTopStyle && cs.borderTopStyle !== "none" && parseFloat(cs.borderTopWidth) > 0 ? rgbHex(cs.borderTopColor) : null, radius: cs.borderTopLeftRadius || "" };
      host.remove();
    } catch (e) {}
    // pe hârtie albă: o culoare prea deschisă (temă întunecată) → culoarea din paleta PDF++ sau gri
    const pal = this.app.plugins?.plugins?.["pdf-plus"]?.settings?.colors || {}, ph = Object.entries(pal).find(([k]) => k.toLowerCase() === name.toLowerCase())?.[1];
    const light = h => { if (!h) return true; const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); return (0.299 * r + 0.587 * g + 0.114 * b) > 200; };
    if (!st) st = {};
    if (light(st.color)) st.color = ph ? String(ph).replace("#", "").toUpperCase() : "555555";
    if (st.bg && light(st.bg) === false && st.bg === st.color) st.bg = null;
    return (this._tags[name] = st);
  }

  // culoarea evidențierii ==…== în tema ta (pe hârtie: dacă e prea închisă, galbenul obișnuit)
  markColor() {
    if (this._mark) return this._mark;
    let c = null;
    try { const host = document.createElement("div"); host.className = "markdown-rendered markdown-preview-view tx-offscreen"; const m = document.createElement("mark"); m.textContent = "x"; host.appendChild(m); document.body.appendChild(host); c = rgbHex(getComputedStyle(m).backgroundColor); host.remove(); } catch (e) {}
    const dark = h => { const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); return (0.299 * r + 0.587 * g + 0.114 * b) < 140; };
    return (this._mark = c && !dark(c) ? c : "FFF3A3");
  }
  // ——— 1. textul notei, cu notele încorporate (![[…]]) puse în el ———
  async expand(text, from, depth, seen) {
    const mc = this.app.metadataCache, re = /!\[\[([^\]|#^]*)(#\^?[^\]|]*)?(?:\|([^\]]*))?\]\]/g, parts = []; let last = 0, m;
    while ((m = re.exec(text))) {
      parts.push(text.slice(last, m.index)); last = m.index + m[0].length;
      const f = m[1].trim() ? mc.getFirstLinkpathDest(m[1].trim(), from) : this.app.vault.getAbstractFileByPath(from);
      if (!(f instanceof TFile)) { parts.push(""); continue; }
      if (IMG.test(f.name)) { const w = /^(\d+)(?:x\d+)?$/.exec(String(m[3] || "").trim())?.[1]; parts.push(`![${(m[3] && !w ? m[3] : "")}](texere-img:${encodeURIComponent(f.path)}${w ? "#w=" + w : ""})`); continue; }
      if (f.extension !== "md" || depth >= 4 || seen.has(f.path + (m[2] || ""))) { parts.push(""); continue; }
      let t = (await this.app.vault.cachedRead(f)).replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
      const sub = (m[2] || "").slice(1);
      if (sub.startsWith("^")) {   // un bloc: paragraful cu ^id
        const L = t.split("\n"), i = L.findIndex(l => new RegExp("\\s\\^" + sub.slice(1).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*$").test(l));
        if (i < 0) t = ""; else { let a = i, b = i; while (a > 0 && L[a - 1].trim()) a--; while (b < L.length - 1 && L[b + 1].trim()) b++; t = L.slice(a, b + 1).join("\n"); }
      } else if (sub) {             // o secțiune: titlul și ce e sub el, până la următorul titlu de același nivel
        const L = t.split("\n"), norm = s => s.replace(/[\s#]+/g, " ").trim().toLowerCase(), i = L.findIndex(l => /^#{1,6}\s/.test(l) && norm(l.replace(/^#+/, "")) === norm(sub));
        if (i < 0) t = ""; else { const lvl = /^#+/.exec(L[i])[0].length; let e = i + 1; while (e < L.length && !(/^#{1,6}\s/.test(L[e]) && /^#+/.exec(L[e])[0].length <= lvl)) e++; t = L.slice(i + 1, e).join("\n"); }
      }
      parts.push("\n" + await this.expand(t, f.path, depth + 1, new Set([...seen, f.path + (m[2] || "")])) + "\n");
    }
    parts.push(text.slice(last));
    return parts.join("");
  }
  // ——— 2. ce e doar al Obsidian iese din text: comentarii, etichete (sau ⟦T:…⟧ colorate), evidențieri ==…==, linkuri [[…]], legături spre PDF, ^id-uri ———
  clean(text, opts = {}) {
    const out = [], fence = /^(```+|~~~+)([^\n]*)\n[\s\S]*?^\1[ \t]*$/gm; let last = 0, m;
    const prose = s => s
      .replace(/[ \t]*%%[\s\S]*?%%/g, "")
      .replace(/([ \t]*(?:·[ \t]*)?)\[\[([^\]|]+\.pdf)#([^\]|]*)(?:\|([^\]]*))?\]\]/gi, (x, sep, f, sub, a) => opts.pdfLink ? `${sep}[${a || "PDF"}](${opts.pdfLink(f, sub)})` : "")   // legăturile evidențierilor spre PDF
      .replace(/\[\[([^\]|]+?)(?:\|([^\]]*))?\]\]/g, (x, t, a) => a != null ? a : (t.split("#")[0].split("/").pop().replace(/\.md$/i, "") || t.split("#").pop()))
      .replace(/==([^=\n]+)==/g, opts.marks ? "<mark>$1</mark>" : "$1")
      .split(/(<[^<>\n]*>)/).map((part, k) => k % 2 ? part : part   // etichetele: doar în text, nu în HTML (style="color: #d83931" nu e o etichetă)
        .replace(/(^|[\s(\[])#(?![\s#])([\p{L}\p{N}_\/-]*[\p{L}_\/-][\p{L}\p{N}_\/-]*)/gu, (x, pre, name) => opts.tags ? `${pre}⟦T:${name}⟧` : pre)).join("")   // etichete
      .replace(/^(>+)[ \t]*\[![^\]]+\][+-]?[ \t]*(.*)$/gm, (x, q, t) => t.trim() ? `${q} **${t.trim()}**` : q)   // callout → citat
      .replace(/[ \t]+\^[A-Za-z0-9-]+[ \t]*$/gm, "")
      .replace(/^ (?=\S)/gm, "").replace(/([^\s])[ \t]{2,}(?=\S)/g, "$1 ");
    while ((m = fence.exec(text))) {
      out.push(prose(text.slice(last, m.index)));
      if (TOC_LANG.test(m[2].trim())) out.push("\n⟦TOC⟧\n");   // blocul ```cuprins din notă: acolo intră cuprinsul, cu paginile
      else if (!/^(dataview|dataviewjs|tasks|query|excalidraw|mermaid|button|meta-bind)/i.test(m[2].trim())) out.push(m[0]);
      last = m.index + m[0].length;
    }
    out.push(prose(text.slice(last)));
    return out.join("");
  }

  // ——— 3. totul: textul curat, citările, bibliografia, cuprinsul, coperta, HTML-ul documentului ———
  async build(file, opts = {}) {
    const S = this.S, E = this.host.cite, mc = this.app.metadataCache;
    const raw = await this.app.vault.read(file), fm = mc.getFileCache(file)?.frontmatter || {};
    const preset = opts.preset !== undefined ? opts.preset : this.presetFor(fm), s = this.target(preset), L = this.layout(preset);
    const ro = /^ro/i.test(fm.lang || "") || (!fm.lang && !S.en), TT = (a, b) => ro ? a : b;
    let body = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
    // trimiterile spre locul din PDF, dacă le păstrezi: linkuri care deschid PDF-ul la locul acela în Obsidian (doar pe acest calculator)
    const vault = this.app.vault.getName?.() || "", pdfLink = s.keepPdfLinks ? (f, sub) => { const d = mc.getFirstLinkpathDest(f, file.path); return `obsidian://open?vault=${encodeURIComponent(vault)}&file=${encodeURIComponent((d?.path || f) + "#" + sub)}`; } : null;
    body = this.clean(await this.expand(body, file.path, 0, new Set([file.path])), { tags: !!s.showTags, marks: !!s.keepMarks, pdfLink });
    // titlul: primul titlu de nivel 1, dacă nota începe cu el și e chiar titlul (sau nota n-are title); altfel title din proprietăți sau numele notei
    const fmTitle = fm.title != null ? String(fm.title).trim() : "", norm = x => String(x).replace(/⟦T:[^⟧]*⟧/g, "").replace(/\s+/g, " ").trim().toLowerCase();
    let title = fmTitle || file.basename;
    const h1 = /^\s*#[ \t]+(.+?)[ \t]*(?:\n|$)/.exec(body);
    if (h1) { const t = h1[1].trim(); if (!fmTitle || norm(t) === norm(fmTitle) || norm(t) === norm(file.basename)) { title = t; body = body.slice(h1[0].length); } }
    // citările: același motor ca în editor (citările în text și bibliografia ies la fel ca acolo);
    // stilurile cu note de subsol (Chicago) au și un al doilea motor, care știe „Ibid.” și formele scurte de la a doua citare
    const stats = { cites: 0, sources: 0, missing: [] }, inline = [], foot = [], defs = [], citeData = [], order = [];
    let style = null, bibHtml = "";
    if (E?.ready && E.CSL) {
      style = opts.style && E.styles.has(opts.style) ? opts.style : E.current(fm);
      const st = E.styles.get(style), lang = E.locale(fm.lang), scan = S._mods?.cite?.scanCites;
      if (st && scan) {
        const cites = scan(body), known = c => c.items.every(i => E.items[i.id]);
        for (const c of cites) for (const i of c.items) if (!E.items[i.id] && !stats.missing.includes(i.id)) stats.missing.push(i.id);
        for (const c of cites) if (known(c)) for (const i of c.items) if (!order.includes(i.id)) order.push(i.id);
        if (order.length) {
          const sys = { retrieveLocale: l => E.locales[l] || E.locales[/^ro/i.test(l) ? "ro-RO" : "en-US"] || E.locales["en-US"], retrieveItem: id => E.items[id] };
          const mk = () => { const x = new E.CSL.Engine(sys, st.xml, lang); x.updateItems(order); return x; };
          const eB = mk(), note = !!st.note, eN = note ? mk() : null, noteHtml = new Map(), pre = [], res = [];
          const printed = h => !!strip(h).trim() && !/NO_PRINTED_FORM/.test(h);
          const authorOnly = it => { const a = eB.makeCitationCluster([{ id: it.id, "author-only": true }]); return printed(a) ? a : ""; };
          let n = 0;
          for (const c of cites) {
            if (!known(c)) { res.push(null); continue; }
            const r = { c, k: ++n };
            if (note) {   // în notă de subsol; în frază („@cheie”), numele autorului rămâne și în text
              const cit = { citationID: "c" + n, citationItems: c.items, properties: { noteIndex: n } };
              const [, out] = eN.processCitationCluster(cit, pre, []); pre.push([cit.citationID, n]);
              for (const [, h, id] of out) noteHtml.set(id, h);
              r.id = cit.citationID; r.note = true; if (c.kind === "n") r.inline = authorOnly(c.items[0]);
            } else if (c.kind === "n") {   // „@cheie [p. 4]” în frază: Autor (an, p. 4)
              const it = c.items[0], a = authorOnly(it);
              if (!a) r.inline = eB.makeCitationCluster([it]);   // stiluri numerotate (IEEE): doar [1, p. 4]
              else { const rest = eB.makeCitationCluster([{ ...it, "suppress-author": true }]); r.inline = printed(rest) ? a + " " + rest : a; }
            } else r.inline = eB.makeCitationCluster(c.items);
            citeData[n] = { kind: c.kind, items: c.items, note };
            res.push(r);
          }
          // înlocuirile, de la sfârșit spre început (pozițiile rămân bune)
          for (let i = cites.length - 1; i >= 0; i--) {
            const r = res[i]; if (!r) continue; const c = r.c;
            let rep;
            if (r.note) { foot[r.k] = noteHtml.get(r.id) || ""; if (r.inline) inline[r.k] = r.inline; rep = (r.inline ? `⟦I${r.k}⟧` : "") + `[^tc${r.k}]`; defs.unshift(`[^tc${r.k}]: ⟦F${r.k}⟧`); }
            else { inline[r.k] = r.inline || ""; rep = `⟦I${r.k}⟧`; }
            const from = r.note && !r.inline && body[c.from - 1] === " " ? c.from - 1 : c.from;   // nota lipită de cuvânt: „text¹”
            body = body.slice(0, from) + rep + body.slice(c.to);
          }
          stats.cites = n; stats.sources = order.length;
          const bib = eB.makeBibliography();   // bibliografia: doar sursele citate, în ordinea stilului
          if (bib && bib[1]?.length) bibHtml = `<div class="bibliography${bib[0]?.hangingindent ? " hanging" : ""}">${bib[1].join("\n")}</div>`;
        }
      }
    }
    // unde intră bibliografia: imediat sub titlul ei, dacă nota îl are (ce ai scris tu sub el rămâne), altfel la final, sub un titlu nou
    const heading = String(s.bibHeading || "").trim() || (ro ? (/apa/i.test(style || "") ? "Referințe" : "Bibliografie") : (/apa/i.test(style || "") ? "References" : "Bibliography"));
    if (bibHtml) {
      const bm = BIB_HEAD.exec(body);
      if (bm) { const at = bm.index + bm[0].length; body = body.slice(0, at) + "\n\n⟦BIB⟧\n\n" + body.slice(at).replace(/^\s*\n/, ""); }
      else body = body.replace(/\s*$/, "") + `\n\n${L.chapterBreak ? "#" : "##"} ${heading}\n\n⟦BIB⟧\n`;
    }
    // cuprinsul: unde e blocul ```cuprins din notă; altfel sub titlul „Cuprins” / „Contents”, dacă nota îl are
    const tm = /⟦TOC⟧/.test(body) ? null : TOC_HEAD.exec(body);
    if (tm) { const at = tm.index + tm[0].length; body = body.slice(0, at) + "\n\n⟦TOC⟧\n\n" + body.slice(at).replace(/^\s*\n/, ""); }
    if (defs.length) body = body.replace(/\s*$/, "") + "\n\n" + defs.join("\n\n") + "\n";   // notele de subsol ale citărilor (definițiile), la final
    // Markdown → HTML
    const { MarkdownIt, footnote } = await this.lib("lib-markdown");
    const strict = !!this.app.vault.getConfig?.("strictLineBreaks");
    const mdi = new MarkdownIt({ html: true, breaks: !strict, linkify: true, typographer: false }).use(footnote);
    const tagHtml = name => { const t = this.tagStyle(name); return `<span class="tx-tag" data-tag="${esc(name)}" data-color="${t.color || ""}" data-border="${t.border || ""}" data-bg="${t.bg || ""}" style="color:#${t.color || "555555"};${t.border ? `border-color:#${t.border};` : ""}${t.bg ? `background:#${t.bg};` : ""}">#${esc(name)}</span>`; };
    let html = mdi.render(body)
      .replace(/<p>⟦BIB⟧<\/p>/g, bibHtml).replace(/⟦BIB⟧/g, bibHtml)
      .replace(/<p>⟦TOC⟧<\/p>/g, '<nav class="toc"></nav>').replace(/⟦TOC⟧/g, '<nav class="toc"></nav>')
      .replace(/⟦I(\d+)⟧/g, (x, k) => inline[k] ? `<span class="cite" data-k="${k}">${inline[k]}</span>` : "")
      .replace(/⟦F(\d+)⟧/g, (x, k) => foot[k] ? `<span class="cite" data-k="${k}">${foot[k]}</span>` : "")
      .replace(/⟦T:([^⟧]+)⟧/g, (x, n) => tagHtml(n));
    const doc = new DOMParser().parseFromString(`<!doctype html><html><body>${html}</body></html>`, "text/html");
    // notele de subsol: din lista de la final, în textul paginii (acolo unde sunt chemate)
    const fnText = {};
    for (const li of doc.querySelectorAll("section.footnotes li")) { li.querySelectorAll("a.footnote-backref").forEach(a => a.remove()); fnText[li.id] = [...li.children].map(p => p.innerHTML.trim()).join(" ").trim() || li.innerHTML.trim(); }
    for (const sup of doc.querySelectorAll("sup.footnote-ref")) {
      const id = (sup.querySelector("a")?.getAttribute("href") || "").replace(/^#/, ""), span = doc.createElement("span");
      span.className = "footnote"; setHTML(span, fnText[id] || ""); sup.replaceWith(span);
    }
    doc.querySelectorAll("section.footnotes, hr.footnotes-sep").forEach(x => x.remove());
    // HTML-ul scris în notă rămâne (tabele, <sup>, culori…), dar fără scripturi și evenimente: exportul nu rulează cod din note
    doc.querySelectorAll("script, iframe, object, embed, frame, frameset, base, link, meta").forEach(x => x.remove());
    for (const el of doc.body.querySelectorAll("*")) for (const a of [...el.attributes]) if (/^on/i.test(a.name) || (/^(href|src|xlink:href|action|formaction|srcdoc)$/i.test(a.name) && /^\s*(javascript|vbscript|data:text\/html)/i.test(a.value)) || /^srcdoc$/i.test(a.name)) el.removeAttribute(a.name);
    const B = doc.body;
    // evidențierile (==…== și <mark> scrise în notă): păstrate, cu culoarea lor (sau a temei), ori doar textul
    for (const mk of B.querySelectorAll("mark")) { if (!s.keepMarks) { mk.replaceWith(...mk.childNodes); continue; } if (!/background/.test(mk.getAttribute("style") || "")) mk.setAttribute("style", `background:#${this.markColor()}`); }
    // textul colorat din notă (<font color>, style="color:…"): păstrat, cu culoarea lui (în toate formatele), ori doar textul
    for (const el of [...B.querySelectorAll("font[color], [style*='color']")]) {
      if (el.closest(".tx-tag, nav.toc, section.cover")) continue;
      const st = el.getAttribute("style") || "", m = /(?:^|;)\s*color\s*:\s*([^;]+)/i.exec(st), col = el.tagName === "FONT" ? el.getAttribute("color") : m?.[1];
      if (!col) continue;
      const rest = st.replace(/(^|;)\s*color\s*:[^;]*/gi, "$1").replace(/^[;\s]+|[;\s]+$/g, "");
      if (s.keepColors && cssHex(col)) { const sp = doc.createElement("span"); sp.className = "tx-col"; sp.dataset.c = cssHex(col); sp.setAttribute("style", `color:#${cssHex(col)}`); sp.append(...el.childNodes); if (el.tagName === "FONT") el.replaceWith(sp); else { if (rest) el.setAttribute("style", rest); else el.removeAttribute("style"); el.appendChild(sp); } }
      else if (s.keepColors) continue;   // o culoare cu nume („red”): rămâne cum e (în PDF și HTML)
      else if (el.tagName === "FONT") el.replaceWith(...el.childNodes);
      else { if (rest) el.setAttribute("style", rest); else el.removeAttribute("style"); }
    }
    // titlurile: id-uri (pentru cuprins), titlul cuprinsului
    let hn = 0; for (const h of B.querySelectorAll("h1,h2,h3,h4,h5,h6")) { h.id = "h-" + (++hn); if (TOC_TEXT.test(h.textContent.trim()) && h.nextElementSibling?.matches?.("nav.toc")) h.classList.add("toc-title"); }
    let nav = B.querySelector("nav.toc");
    for (const x of [...B.querySelectorAll("nav.toc")].slice(1)) x.remove();   // un singur cuprins
    if (nav && !nav.previousElementSibling?.classList?.contains("toc-title")) {   // blocul ```cuprins fără titlu deasupra: îi pune titlul
      const h = doc.createElement(L.chapterBreak ? "h1" : "h2"); h.className = "toc-title"; h.id = "h-toc"; h.textContent = TT("Cuprins", "Contents"); nav.before(h);
    }
    if (!nav && s.toc) {   // cuprins cerut, dar nota n-are titlul „Cuprins”: îl pune la început
      const h = doc.createElement(L.chapterBreak ? "h1" : "h2"); h.className = "toc-title"; h.id = "h-toc"; h.textContent = TT("Cuprins", "Contents");
      nav = doc.createElement("nav"); nav.className = "toc"; B.prepend(nav); B.prepend(h);
    }
    if (nav) {   // intrările: titlurile de după cuprins (fără titlul lui), până la nivelul ales
      const all = [...B.querySelectorAll("h1,h2,h3,h4,h5,h6")], after = all.filter(h => !h.classList.contains("toc-title") && !h.classList.contains("title") && (nav.compareDocumentPosition(h) & 4));
      const depth = Math.max(1, Math.min(6, +s.tocDepth || 3)), top = Math.min(...after.map(h => +h.tagName[1]), 6);
      const ol = doc.createElement("ol");
      for (const h of after) { const lv = +h.tagName[1] - top + 1; if (lv > depth) continue; const li = doc.createElement("li"); li.className = "l" + lv; setHTML(li, `<a href="#${h.id}"><span class="t">${esc(h.textContent.trim())}</span><span class="d"></span></a>`); ol.appendChild(li); }
      nav.appendChild(ol); nav.setAttribute("data-depth", String(depth));
    }
    if (s.title && title && !L.cover) { const h = doc.createElement("h1"); h.className = "title"; h.textContent = title; B.prepend(h); }
    // coperta (șabloanele facultății): Anexa I din ghid
    if (L.cover) {
      const year = String(fm.an || fm.year || new Date().getFullYear()), who = String(fm.autor || (typeof fm.author === "string" ? fm.author : "") || ""), coord = String(fm.coordonator || fm.coordinator || "");
      const kind = String(fm.tip || PRESETS[this.baseOf(preset)]?.kind || ""), cov = doc.createElement("section"); cov.className = "cover";
      setHTML(cov, `<div class="cv-top">${esc(kind)}</div><div class="cv-title">${esc(title)}</div>` +
        `<div class="cv-people"><div><div class="cv-l">${esc(L.studentLabel)}</div><div class="cv-n">${esc(who || "…")}</div></div><div><div class="cv-l">${esc(L.coordLabel)}</div><div class="cv-n">${esc(coord || "…")}</div></div></div>` +
        `<div class="cv-bottom"><div>${esc(L.faculty)}</div><div>${esc(L.university)}</div><div>${esc(year)}</div></div>`);
      B.prepend(cov);
    }
    // paginile de la început (coperta, rezumatul, cuprinsul) se numără, dar numărul apare de la Introducere
    if (L.front) {
      const first = [...B.children].find(el => /^H[1-3]$/.test(el.tagName) && L.front.test(el.textContent.trim()));
      if (first && first.previousElementSibling) { const fr = doc.createElement("div"); fr.className = "front"; while (B.firstChild && B.firstChild !== first) fr.appendChild(B.firstChild); B.insertBefore(fr, first); first.classList.add("main-start"); }
    }
    const images = [...doc.querySelectorAll('img[src^="texere-img:"]')].map(img => { const [p, w] = img.getAttribute("src").slice(11).split("#w="); img.setAttribute("data-path", decodeURIComponent(p)); if (w) img.setAttribute("data-w", w); img.removeAttribute("src"); return img.getAttribute("data-path"); });
    stats.style = style; stats.title = title;
    return { title, body, html: B.innerHTML, stats, images, inline, foot, bibHtml, file, fm, preset, s, layout: L, citeData, order, ro, style };
  }

  // ——— 4. aspectul paginii (același pentru previzualizare și PDF) ———
  pnContent(fmt, ro) { return { dash: '"– " counter(page) " –"', page: `"${ro ? "Pagina" : "Page"} " counter(page)`, of: 'counter(page) " / " counter(pages)' }[fmt] || "counter(page)"; }
  css(s, mode, built = {}) {
    const L = built.layout || {}, ff = fontStack(s.font), m = s.margins, sz = +s.size || 12, pn = s.pageNum || {}, after = +s.after || 0, ind = +s.indent || 0;
    const box = pn.pos && pn.pos !== "none" ? "@" + pn.pos : "", pnCss = box ? `${box} { content: ${this.pnContent(pn.fmt, built.ro)}; font-family: ${ff}; font-size: ${sz - 2}pt; }` : "";
    const [, ph] = PAGES[s.page] || PAGES.A4;
    const page = `@page { size: ${s.page === "Letter" ? "letter" : s.page || "A4"}; margin: ${m.top}cm ${m.right}cm ${m.bottom}cm ${m.left}cm; ${pnCss} }
${box && !pn.first ? `@page :first { ${box} { content: none; } }` : ""}
${box ? `@page front { ${box} { content: none; } }` : ""}
.front { page: front; }`;
    const hs = L.chapterCenter ? [sz + 2, sz, sz, sz] : [sz + 4, sz + 2, sz + 1, sz];
    return `${page}
html { font-family: ${ff}; font-size: ${sz}pt; line-height: ${+s.line || 1.5}; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; }
p { margin: 0 0 ${after}pt; text-indent: ${ind}cm; text-align: ${alignOf(s)}; hyphens: ${alignOf(s) === "justify" ? "auto" : "manual"}; orphans: 2; widows: 2; }
h1, h2, h3, h4, h5, h6 { font-weight: bold; line-height: 1.25; margin: 1.1em 0 .45em; break-after: avoid; page-break-after: avoid; text-indent: 0; text-align: left; }
h1.title { font-size: ${sz + 6}pt; text-align: center; margin: 0 0 1.4em; }
h1 { font-size: ${hs[0]}pt; } h2 { font-size: ${hs[1]}pt; } h3 { font-size: ${hs[2]}pt; } h4, h5, h6 { font-size: ${hs[3]}pt; font-style: italic; }
${L.indentAll ? "" : "h1 + p, h2 + p, h3 + p, h4 + p, h5 + p, h6 + p, body > p:first-child, "}li p, blockquote p, td p, .bibliography p { text-indent: 0; }
${L.chapterBreak ? "h1:not(.title), section.cover + h1 { break-before: page; }" : ""}
${s.h2Break ? "h2 { break-before: page; } h1 + h2, section.cover + h2 { break-before: auto; }" : ""}
${L.chapterCenter ? "h1:not(.title) { text-align: center; margin: 0 0 1.2em; }" : ""}
${L.sectionIndent ? `h2, h3, h4 { text-indent: ${L.sectionIndent}cm; }` : ""}
blockquote { margin: 0 0 ${after}pt ${(ind || 1)}cm; padding: 0; font-size: ${sz - 1}pt; }
ul, ol { margin: 0 0 ${after}pt; padding-left: 1.6em; } li { margin: 0 0 2pt; } li > p { margin: 0; }
img { max-width: 100%; height: auto; display: block; margin: 8pt auto; }
table { border-collapse: collapse; margin: 0 0 ${after}pt; font-size: ${sz - 1}pt; } td, th { border: .5pt solid #777; padding: 3pt 6pt; text-align: left; vertical-align: top; }
code { font-family: Menlo, Consolas, "Courier New", monospace; font-size: .88em; } pre { white-space: pre-wrap; font-size: ${sz - 2}pt; margin: 0 0 ${after}pt; }
hr { border: 0; border-top: .5pt solid #777; margin: 10pt 0; }
${s.colorLinks ? `a, span.cite { color: #${accentHex()}; } a { text-decoration: none; }` : "a { color: inherit; text-decoration: none; }"}
.bibliography { margin-top: 4pt; } .bibliography .csl-entry { margin: 0 0 ${after || 4}pt; text-align: left; }
.bibliography.hanging .csl-entry { padding-left: 1.27cm; text-indent: -1.27cm; }
.csl-left-margin { float: left; min-width: 2.2em; } .csl-right-inline { margin-left: 2.6em; }
.tx-tag { display: inline-block; font-size: .78em; line-height: 1.3; padding: 0 .55em; border: .6pt solid #ccc; border-radius: 999px; text-indent: 0; vertical-align: .08em; font-weight: 500; }
nav.toc ol { list-style: none; margin: 0 0 ${after}pt; padding: 0; }
nav.toc li { margin: 0 0 3pt; text-indent: 0; } nav.toc li.l2 { padding-left: 1.27cm; } nav.toc li.l3 { padding-left: 2.54cm; } nav.toc li.l4, nav.toc li.l5, nav.toc li.l6 { padding-left: 3.81cm; }
nav.toc a { display: flex; align-items: baseline; color: inherit; text-decoration: none; }
nav.toc a .t { flex: 0 1 auto; } nav.toc li.l1 a .t { font-weight: ${L.chapterCenter ? "bold" : "normal"}; }
nav.toc a .d { flex: 1 1 auto; min-width: 1.5em; height: .7em; margin: 0 .3em; background: radial-gradient(circle, #000 .55pt, transparent .7pt) left bottom / 4.5pt 2pt repeat-x; }
nav.toc a::after { content: target-counter(attr(href), page); flex: 0 0 auto; }
section.cover { height: ${ph - m.top * 10 - m.bottom * 10 - 4}mm; break-after: page; display: flex; flex-direction: column; justify-content: space-between; text-align: center; text-indent: 0; }
section.cover .cv-top { font-size: ${sz + 4}pt; font-weight: bold; text-transform: uppercase; letter-spacing: .04em; margin-top: 2cm; }
section.cover .cv-title { font-size: ${sz + 6}pt; font-weight: bold; line-height: 1.3; padding: 0 1cm; }
section.cover .cv-people { display: flex; justify-content: space-between; text-align: left; font-size: ${sz + 1}pt; }
section.cover .cv-people > div:last-child { text-align: right; } section.cover .cv-l { font-weight: bold; margin-bottom: 4pt; }
section.cover .cv-bottom { font-size: ${sz + 1}pt; line-height: 1.5; }
.footnote { float: footnote; font-size: ${sz - 2}pt; line-height: 1.3; text-indent: 0; text-align: left; font-weight: normal; font-style: normal; }
.footnote[data-footnote-call] { float: none; font-size: 1em; line-height: inherit; color: inherit; text-decoration: none; }
[data-footnote-call]::after { content: counter(footnote); vertical-align: super; font-size: .65em; line-height: 0; font-variant-position: normal; }
.pagedjs_footnote_area { margin-top: 6pt; } .pagedjs_footnote_inner_content::before { content: ""; display: block; width: 33%; border-top: .5pt solid #000; margin-bottom: 4pt; }
`;
  }
  // imaginile: în PDF ca date încorporate (fișierul exportat merge singur)
  async imagesInline(html) {
    const doc = new DOMParser().parseFromString(`<!doctype html><html><body>${html}</body></html>`, "text/html");
    for (const img of doc.querySelectorAll("img[data-path]")) {
      const f = this.app.vault.getAbstractFileByPath(img.getAttribute("data-path"));
      if (f instanceof TFile) { try { img.src = `data:${MIME[f.extension.toLowerCase()] || "image/png"};base64,${b64(await this.app.vault.readBinary(f))}`; } catch (e) {} }
      if (img.getAttribute("data-w")) img.style.width = img.getAttribute("data-w") + "px";
    }
    return doc.body.innerHTML;
  }
  async pagedHtml(built, s, mode) {
    const paged = await this.lib("lib-paged"), body = await this.imagesInline(built.html);
    const start = Math.max(0, parseInt(s.pageNum?.start, 10) || 1);   // numerotarea începe de la pagina N
    const pnFix = start === 1 ? "" : `(function () { var el = document.querySelector('.pagedjs_pages'); if (!el) return; var n = document.querySelectorAll('.pagedjs_page').length, cur = getComputedStyle(el).counterReset; cur = (cur && cur !== 'none' ? cur : '').replace(/\\bpages?\\s+-?\\d+/g, ''); el.style.counterReset = cur + ' page ${start - 1} pages ' + (n + ${start - 1}); })(); `;
    const done = mode === "preview"
      ? `window.PagedConfig = { auto: true, after: (flow) => { ${pnFix}var sc = document.createElement('style'); sc.textContent = ${JSON.stringify("@media screen { html { background: #e9e9e9; } body { margin: 0; padding: 14px 0; } .pagedjs_pages { zoom: var(--z, 1); } .pagedjs_page { background: #fff; margin: 0 auto 14px; box-shadow: 0 1px 6px rgba(0,0,0,.18); } }")}; document.head.appendChild(sc); window.__pagedDone = true; var pw = document.querySelector('.pagedjs_page'); if (pw) { var z = Math.min(1, (window.innerWidth - 28) / pw.getBoundingClientRect().width); document.documentElement.style.setProperty('--z', z); } window.addEventListener('message', function (e) { if (e.data && e.data.texere === 'scrollTo') window.scrollTo(0, e.data.y || 0); if (e.data && e.data.texere === 'print') window.print(); }); var st = 0; window.addEventListener('scroll', function () { clearTimeout(st); st = setTimeout(function () { parent.postMessage({ texere: 'scroll', y: window.scrollY }, '*'); }, 120); }); try { parent.postMessage({ texere: 'paged', pages: document.querySelectorAll('.pagedjs_page').length }, '*'); } catch (e) {} } };`
      : `window.PagedConfig = { auto: true, after: () => { ${pnFix}window.__pagedDone = true; } };`;
    return `<!doctype html><html lang="${built.ro ? "ro" : "en"}"><head><meta charset="utf-8"><title>${esc(built.title)}</title><style>${this.css(s, mode, built)}</style></head><body>${body}<script>${done}</script><script>${paged.replace(/<\/script/gi, "<\\/script")}</script></body></html>`;
  }
  mdFile(built, s) {
    const toMd = h => strip(String(h || "").replace(/<\/?(i|em)>/g, "*").replace(/<\/?(b|strong)>/g, "**").replace(/<br\s*\/?>/g, "  \n")).replace(/\*\*\*\*/g, "");
    let t = built.body.replace(/⟦I(\d+)⟧/g, (x, k) => toMd(built.inline[k])).replace(/⟦F(\d+)⟧/g, (x, k) => toMd(built.foot[k])).replace(/⟦T:([^⟧]+)⟧/g, "#$1")
      .replace(/!\[([^\]]*)\]\(texere-img:([^)#]+)(?:#w=\d+)?\)/g, (x, a, p) => `![${a}](${decodeURIComponent(p).replace(/ /g, "%20")})`);
    const bib = built.bibHtml ? new DOMParser().parseFromString(`<body>${built.bibHtml}</body>`, "text/html") : null;
    t = t.replace(/⟦BIB⟧/g, bib ? [...bib.querySelectorAll(".csl-entry")].map(e => toMd(e.innerHTML).replace(/\s+/g, " ").trim()).join("\n\n") : "");
    const doc = new DOMParser().parseFromString(`<body>${built.html}</body>`, "text/html"), toc = [...doc.querySelectorAll("nav.toc li")].map(li => "  ".repeat(+li.className.slice(1) - 1) + "- " + li.textContent.trim()).join("\n");
    t = t.replace(/⟦TOC⟧/g, toc);
    if (!/⟦TOC⟧/.test(built.body) && toc && s.toc && !TOC_HEAD.test(built.body)) t = `## ${built.ro ? "Cuprins" : "Contents"}\n\n${toc}\n\n` + t;
    return (s.title && !built.layout?.cover ? `# ${built.title}\n\n` : "") + t.replace(/\n{3,}/g, "\n\n").trim() + "\n";
  }

  // ——— 5. Word (.docx), direct din documentul pregătit ———
  async docx(built, s) {
    const D = await this.lib("lib-docx"), L = built.layout || {};
    const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, FootnoteReferenceRun, ExternalHyperlink, ImageRun, Footer, Header, PageNumber, Table, TableRow, TableCell, WidthType, LevelFormat, BorderStyle, LineRuleType, PageBreak, Bookmark, PageReference, InternalHyperlink, TabStopType, LeaderType } = D;
    const AUTO = LineRuleType?.AUTO || "auto";
    const doc = new DOMParser().parseFromString(`<!doctype html><html><body>${built.html}</body></html>`, "text/html");
    const pt = v => Math.round(v * 2), cm = v => Math.round(v * 567), sz = +s.size || 12, [pw, ph] = PAGES[s.page] || PAGES.A4, m = s.margins;
    const textWidthPx = Math.max(200, (pw / 10 - (+m.left) - (+m.right)) * 37.8);
    const footnotes = {}; let fnN = 0, listInst = 0;
    const imgCache = new Map();
    const imageRun = async img => {
      const f = this.app.vault.getAbstractFileByPath(img.getAttribute("data-path") || ""); if (!(f instanceof TFile)) return null;
      let data = imgCache.get(f.path); if (!data) { data = new Uint8Array(await this.app.vault.readBinary(f)); imgCache.set(f.path, data); }
      const dim = imageSize(data); if (!dim) return null;
      let w = +img.getAttribute("data-w") || dim.w, h = dim.h * (w / dim.w); if (w > textWidthPx) { h *= textWidthPx / w; w = textWidthPx; }
      return new ImageRun({ type: dim.type, data, transformation: { width: Math.round(w), height: Math.round(h) } });
    };
    // textul unui element → bucăți de text cu formatare
    // (spațiile de la începutul și sfârșitul paragrafului și din jurul unui rând nou nu se văd în HTML: nici în Word)
    const accent = accentHex();
    const runs = async (node, fmt = {}, top = true) => {
      const out = [];
      for (const ch of node.childNodes) {
        if (ch.nodeType === 3) {
          let t = ch.textContent.replace(/\s+/g, " ");
          if (ch.previousSibling?.nodeName === "BR" || (top && !ch.previousSibling)) t = t.replace(/^ /, "");
          if (ch.nextSibling?.nodeName === "BR" || (top && !ch.nextSibling)) t = t.replace(/ $/, "");
          if (t) out.push(new TextRun({ text: t, ...fmt })); continue;
        }
        if (ch.nodeType !== 1) continue;
        const tag = ch.tagName.toLowerCase(), f = { ...fmt };
        if (tag === "span" && ch.classList.contains("footnote")) {
          fnN++; footnotes[fnN] = { children: [new Paragraph({ style: "FootnoteText", children: await runs(ch, {}, true) })] };
          out.push(new FootnoteReferenceRun(fnN)); continue;
        }
        if (tag === "span" && ch.classList.contains("tx-tag")) {   // eticheta colorată, ca în Obsidian
          const c = ch.getAttribute("data-color") || "555555", b = ch.getAttribute("data-border"), bg = ch.getAttribute("data-bg");
          out.push(new TextRun({ text: ch.textContent, ...fmt, color: c, size: pt(sz - 2), ...(b ? { border: { style: BorderStyle.SINGLE, size: 4, space: 1, color: b } } : {}), ...(bg ? { shading: { type: "clear", fill: bg, color: "auto" } } : {}) })); continue;
        }
        if (tag === "br") { out.push(new TextRun({ text: "", break: 1, ...fmt })); continue; }
        if (tag === "img") { const r = await imageRun(ch); if (r) out.push(r); continue; }
        if (tag === "span" && ch.classList.contains("tx-col") && ch.dataset.c) f.color = ch.dataset.c;   // textul colorat
        if (tag === "mark") f.shading = { type: "clear", fill: cssHex((/background(?:-color)?:\s*([^;]+)/.exec(ch.getAttribute("style") || "") || [])[1]) || "FFF3A3", color: "auto" };   // evidențierea, cu culoarea ei
        if (tag === "b" || tag === "strong") f.bold = true;
        if (tag === "i" || tag === "em" || tag === "cite") f.italics = true;
        if (tag === "u") f.underline = {};
        if (tag === "s" || tag === "del" || tag === "strike") f.strike = true;
        if (tag === "sup") f.superScript = true;
        if (tag === "sub") f.subScript = true;
        if (tag === "code") f.font = "Consolas";
        if (/small-caps/.test(ch.getAttribute("style") || "")) f.smallCaps = true;
        if (/font-style:\s*italic/.test(ch.getAttribute("style") || "")) f.italics = true;
        if (/font-weight:\s*bold/.test(ch.getAttribute("style") || "")) f.bold = true;
        if (tag === "span" && ch.classList.contains("cite") && s.colorLinks) f.color = accent;   // citarea, în culoarea principală
        if (tag === "a" && /^(https?|obsidian):/i.test(ch.getAttribute("href") || "")) { out.push(new ExternalHyperlink({ link: ch.getAttribute("href"), children: await runs(ch, s.colorLinks ? { ...f, color: accent } : f, false) })); continue; }
        out.push(...await runs(ch, f, false));
      }
      return out;
    };
    const justify = { left: AlignmentType.LEFT, center: AlignmentType.CENTER, right: AlignmentType.RIGHT, justify: AlignmentType.JUSTIFIED }[alignOf(s)];
    const blocks = async (el, ctx = {}) => {
      const out = []; let afterHead = true;
      for (const ch of el.children) {
        const tag = ch.tagName.toLowerCase();
        if (tag === "section" && ch.classList.contains("cover")) {   // coperta
          const txt = sel => ch.querySelector(sel)?.textContent || "", people = [...ch.querySelectorAll(".cv-people > div")];
          out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 1200, after: 1800 }, children: [new TextRun({ text: txt(".cv-top").toUpperCase(), bold: true, size: pt(sz + 4) })] }));
          out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 2400 }, children: [new TextRun({ text: txt(".cv-title"), bold: true, size: pt(sz + 6) })] }));
          for (const p of people) out.push(new Paragraph({ alignment: p === people[0] ? AlignmentType.LEFT : AlignmentType.RIGHT, spacing: { after: 240 }, children: [new TextRun({ text: p.querySelector(".cv-l")?.textContent || "", bold: true }), new TextRun({ text: p.querySelector(".cv-n")?.textContent || "", break: 1 })] }));
          const bottom = [...ch.querySelectorAll(".cv-bottom > div")].map(d => d.textContent);
          bottom.forEach((t, i) => out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: i ? 0 : 2400, after: 0 }, children: [new TextRun({ text: t, size: pt(sz + 1) })] })));
          const next = ch.nextElementSibling; if (!(L.chapterBreak && next && /^H1$/.test(next.tagName))) out.push(new Paragraph({ children: [new PageBreak()] }));
          continue;
        }
        if (tag === "nav" && ch.classList.contains("toc")) {   // cuprinsul: un rând pe titlu, cu puncte până la pagină (trimitere la titlu; Word, LibreOffice, Pages)
          const right = Math.round((pw / 10 - (+m.left) - (+m.right)) * 567);
          for (const li of ch.querySelectorAll("li")) {
            const lv = +li.className.replace(/\D/g, "") || 1, id = (li.querySelector("a")?.getAttribute("href") || "").slice(1), bm = "texere_" + id.replace(/[^\w]/g, "_");
            out.push(new Paragraph({ tabStops: [{ type: TabStopType.RIGHT, position: right, leader: LeaderType.DOT }], indent: { left: cm(1.27 * (lv - 1)) }, spacing: { after: 60 }, keepLines: true,
              children: [new InternalHyperlink({ anchor: bm, children: [new TextRun({ text: li.textContent.trim(), bold: lv === 1 && !!L.chapterCenter })] }), new TextRun({ text: "\t" }), new PageReference(bm)] }));
          }
          continue;
        }
        if (/^h[1-6]$/.test(tag)) {
          const lvl = +tag[1], first = ch.classList.contains("main-start"), prev = ch.previousElementSibling;
          const brk2 = lvl === 2 && !!s.h2Break && !!prev && prev.tagName !== "H1" && !prev.matches?.("section.cover");   // fiecare H2 de la o pagină nouă (nu chiar sub titlul capitolului)
          if (ch.classList.contains("title")) out.push(new Paragraph({ style: "Title", children: await runs(ch) }));
          else if (ch.classList.contains("toc-title")) out.push(new Paragraph({ style: "TocTitle", pageBreakBefore: (!!L.chapterBreak && !!prev) || brk2, children: await runs(ch) }));
          else out.push(new Paragraph({ heading: HeadingLevel["HEADING_" + Math.min(lvl, 6)], ...(first ? { pageBreakBefore: false } : {}), ...(brk2 ? { pageBreakBefore: true } : {}), children: ch.id ? [new Bookmark({ id: "texere_" + ch.id.replace(/[^\w]/g, "_"), children: await runs(ch) })] : await runs(ch) }));
          afterHead = true; continue;
        }
        if (tag === "p") {
          const only = ch.childNodes.length === 1 && ch.firstElementChild?.tagName === "IMG";
          out.push(new Paragraph({ style: ctx.quote ? "Quote" : undefined, alignment: only ? AlignmentType.CENTER : ctx.quote ? AlignmentType.LEFT : justify,
            spacing: only ? { line: 240, lineRule: AUTO, before: 120, after: 120 } : undefined,
            indent: !ctx.quote && (!afterHead || L.indentAll) && !only && +s.indent ? { firstLine: cm(+s.indent) } : undefined, children: await runs(ch) }));
          afterHead = false; continue;
        }
        if (tag === "blockquote") { out.push(...await blocks(ch, { ...ctx, quote: true })); afterHead = false; continue; }
        if (tag === "ul" || tag === "ol") {
          const inst = ++listInst, items = async (list, level) => {
            for (const li of list.children) {
              if (li.tagName !== "LI") continue;
              const inl = document.createElement("div"); const subs = [];
              for (const c of li.childNodes) { if (c.nodeType === 1 && /^(UL|OL)$/.test(c.tagName)) subs.push(c); else if (c.nodeType === 1 && c.tagName === "P") { inl.append(...[...c.childNodes].map(x => x.cloneNode(true))); inl.append(document.createTextNode(" ")); } else inl.append(c.cloneNode(true)); }
              out.push(new Paragraph({ numbering: { reference: list.tagName === "OL" ? "texere-num" : "texere-bullet", level: Math.min(level, 4), instance: inst }, spacing: { after: 60 }, children: await runs(inl) }));
              for (const sub of subs) await items(sub, level + 1);
            }
          };
          await items(ch, 0); afterHead = false; continue;
        }
        if (tag === "pre") { for (const line of ch.textContent.replace(/\n$/, "").split("\n")) out.push(new Paragraph({ spacing: { after: 0, line: 240 }, children: [new TextRun({ text: line || " ", font: "Consolas", size: pt(sz - 2) })] })); afterHead = false; continue; }
        if (tag === "hr") { out.push(new Paragraph({ border: { bottom: { color: "777777", space: 1, style: BorderStyle.SINGLE, size: 4 } }, children: [] })); continue; }
        if (tag === "div" && ch.classList.contains("bibliography")) {
          const hang = ch.classList.contains("hanging");
          for (const e of ch.querySelectorAll(".csl-entry")) out.push(new Paragraph({ style: "Bibliography", indent: hang ? { left: cm(1.27), hanging: cm(1.27) } : undefined, children: await runs(e) }));
          continue;
        }
        if (tag === "table") {
          const rows = [];
          for (const tr of ch.querySelectorAll("tr")) rows.push(new TableRow({ children: await Promise.all([...tr.children].map(async td => new TableCell({ children: [new Paragraph({ children: await runs(td, td.tagName === "TH" ? { bold: true } : {}) })] }))) }));
          if (rows.length) out.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }));
          continue;
        }
        if (tag === "img") { const r = await imageRun(ch); if (r) out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { line: 240, lineRule: AUTO, before: 120, after: 120 }, children: [r] })); continue; }
        if (tag === "section" || tag === "div" || tag === "nav") { out.push(...await blocks(ch, ctx)); continue; }
        const r = await runs(ch); if (r.length) out.push(new Paragraph({ children: r }));
      }
      return out;
    };
    // paginile de la început (fără număr) și restul: două secțiuni, numerotarea continuă
    const front = doc.body.querySelector(":scope > div.front");
    const frontKids = front ? await blocks(front) : null; if (front) front.remove();
    const children = await blocks(doc.body);
    const lvl = fmt => Array.from({ length: 5 }, (_, i) => ({ level: i, format: fmt, text: fmt === LevelFormat.DECIMAL ? `%${i + 1}.` : ["•", "◦", "▪", "•", "◦"][i], alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: cm(0.75 * (i + 1)), hanging: cm(0.5) } } } }));
    const pn = s.pageNum || {}, pos = pn.pos || "none";
    const numRuns = () => { const C = PageNumber.CURRENT, N = PageNumber.TOTAL_PAGES, z = pt(sz - 2); return pn.fmt === "dash" ? [new TextRun({ children: ["– ", C, " –"], size: z })] : pn.fmt === "page" ? [new TextRun({ children: [(built.ro ? "Pagina " : "Page "), C], size: z })] : pn.fmt === "of" ? [new TextRun({ children: [C, " / ", N], size: z })] : [new TextRun({ children: [C], size: z })]; };
    const align = pos.endsWith("right") ? AlignmentType.RIGHT : pos.endsWith("left") ? AlignmentType.LEFT : AlignmentType.CENTER;
    const numPara = () => new Paragraph({ alignment: align, children: numRuns() });
    const pageProps = { page: { size: { width: Math.round(pw * 56.7), height: Math.round(ph * 56.7) }, margin: { top: cm(+m.top), right: cm(+m.right), bottom: cm(+m.bottom), left: cm(+m.left) } } };
    const numbered = (first) => pos === "none" ? {} : pos.startsWith("top")
      ? { headers: { default: new Header({ children: [numPara()] }), ...(first ? {} : { first: new Header({ children: [] }) }) } }
      : { footers: { default: new Footer({ children: [numPara()] }), ...(first ? {} : { first: new Footer({ children: [] }) }) } };
    const start = Math.max(0, parseInt(pn.start, 10) || 1), first = { ...pageProps, page: { ...pageProps.page, ...(start !== 1 ? { pageNumbers: { start } } : {}) } };   // numerotarea începe de la N
    const sections = front
      ? [{ properties: first, children: frontKids }, { properties: pageProps, ...numbered(true), children }]
      : [{ properties: { ...first, ...(pn.first === false && pos !== "none" ? { titlePage: true } : {}) }, ...numbered(pn.first !== false), children }];
    const d = new Document({
      creator: "Texere", title: built.title,
      features: { updateFields: built.html.includes('class="toc"') },   // Word face cuprinsul (cu paginile) când deschizi fișierul
      styles: {
        default: { document: { run: { font: s.font, size: pt(sz) }, paragraph: { spacing: { line: Math.round(240 * (+s.line || 1.5)), lineRule: AUTO, after: Math.round((+s.after || 0) * 20) } } } },
        paragraphStyles: [
          { id: "Title", name: "Title", basedOn: "Normal", next: "Normal", run: { font: s.font, size: pt(sz + 6), bold: true }, paragraph: { alignment: AlignmentType.CENTER, spacing: { after: 360 } } },
          { id: "TocTitle", name: "TOC Heading", basedOn: "Normal", next: "Normal", run: { font: s.font, size: pt(L.chapterCenter ? sz + 2 : sz + 4), bold: true }, paragraph: { alignment: L.chapterCenter ? AlignmentType.CENTER : AlignmentType.LEFT, spacing: { before: 240, after: 240 } } },
          ...[1, 2, 3, 4, 5, 6].map(i => ({ id: "Heading" + i, name: "Heading " + i, basedOn: "Normal", next: "Normal", quickFormat: true,
            run: { font: s.font, size: pt(L.chapterCenter ? (i === 1 ? sz + 2 : sz) : (i === 1 ? sz + 4 : i === 2 ? sz + 2 : i === 3 ? sz + 1 : sz)), bold: i <= 3, italics: i > 3, color: "000000" },
            paragraph: { spacing: { before: 240, after: 120 }, keepNext: true, ...(i === 1 && L.chapterCenter ? { alignment: AlignmentType.CENTER } : {}), ...(i === 1 && L.chapterBreak ? { pageBreakBefore: true } : {}), ...(i > 1 && L.sectionIndent ? { indent: { firstLine: cm(L.sectionIndent) } } : {}) } })),
          { id: "Quote", name: "Quote", basedOn: "Normal", next: "Normal", run: { size: pt(sz - 1) }, paragraph: { indent: { left: cm(+s.indent || 1) } } },
          { id: "Bibliography", name: "Bibliography", basedOn: "Normal", next: "Bibliography", paragraph: { alignment: AlignmentType.LEFT } },
          { id: "FootnoteText", name: "footnote text", basedOn: "Normal", run: { size: pt(sz - 2) }, paragraph: { spacing: { line: 240, after: 0 }, alignment: AlignmentType.LEFT } },
        ],
      },
      numbering: { config: [{ reference: "texere-bullet", levels: lvl(LevelFormat.BULLET) }, { reference: "texere-num", levels: lvl(LevelFormat.DECIMAL) }] },
      footnotes, sections,
    });
    if (typeof Packer.toArrayBuffer === "function") return await Packer.toArrayBuffer(d);
    if (typeof Blob !== "undefined" && typeof Packer.toBlob === "function") return await (await Packer.toBlob(d)).arrayBuffer();
    const buf = await Packer.toBuffer(d); return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  }

  // ——— 7. PDF: pagina pregătită (Paged.js) tipărită de Obsidian, fără ferestre ———
  async pdf(built, s) {
    const html = await this.pagedHtml(built, s, "pdf");
    const tmp = normalizePath(`${this.dir}/.export-${Date.now()}.html`), ad = this.app.vault.adapter;
    await ad.write(tmp, html);
    // de unde se încarcă pagina: fișierul temporar (file://), apoi adresa lui din Obsidian, apoi direct din memorie
    const srcs = [];
    try { const full = ad.getFullPath ? ad.getFullPath(tmp) : (ad.getBasePath?.() + "/" + tmp); srcs.push(node("url").pathToFileURL(full).href); } catch (e) {}
    try { srcs.push(ad.getResourcePath(tmp)); } catch (e) {}
    srcs.push("data:text/html;charset=utf-8," + encodeURIComponent(html));
    // vizibil pentru Chromium (altfel poate opri desenarea), invizibil pentru tine
    const wv = document.createElement("webview");
    wv.classList.add("tx-print-view");
    wv.setAttribute("webpreferences", "contextIsolation=yes, javascript=yes");
    const load = src => new Promise((res, rej) => {
      const done = () => { clearTimeout(t); wv.removeEventListener("did-finish-load", ok); wv.removeEventListener("did-fail-load", bad); };
      const ok = () => { done(); res(); }, bad = e => { if (e.errorCode === -3) return; done(); rej(new Error(e.errorDescription || "load failed")); };
      const t = setTimeout(() => { done(); rej(new Error("timeout")); }, 15000);
      wv.addEventListener("did-finish-load", ok); wv.addEventListener("did-fail-load", bad);
      wv.src = src;
    });
    // fără <webview> (Obsidian pe mobil sau o versiune care nu-l are): se deschide tipărirea, cu „Salvează ca PDF”
    if (typeof wv.printToPDF !== "function" || typeof wv.executeJavaScript !== "function") { try { await ad.remove(tmp); } catch (e) {} throw Object.assign(new Error("no printToPDF"), { noPrint: true }); }
    try {
      document.body.appendChild(wv);
      let loaded = false, last = null;
      for (const src of srcs) { try { await load(src); loaded = true; break; } catch (e) { last = e; } }
      if (!loaded) throw last || new Error("load failed");
      const t0 = Date.now(); while (!(await wv.executeJavaScript("window.__pagedDone === true"))) { if (Date.now() - t0 > 90000) throw new Error("layout timeout"); await new Promise(r => setTimeout(r, 250)); }
      const data = await wv.printToPDF({ printBackground: true, preferCSSPageSize: true, margins: { top: 0, bottom: 0, left: 0, right: 0 } });
      return data.buffer ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) : data;
    } finally { wv.remove(); try { await ad.remove(tmp); } catch (e) {} }
  }

  // ——— 8. exportul: fișierul în folderul exportului ———
  async export(file, format, opts = {}) {
    const built = opts.built || await this.build(file, opts), s = built.s || this.conf(), c = this.conf();
    const ext = (FORMATS.find(f => f[0] === format) || FORMATS[0])[2];
    const outside = isAbsDir(c.folder), fs = outside ? node("fs") : null, P = outside ? node("path") : null;
    const dir = outside ? homeDir(c.folder).replace(/[\\/]+$/, "") : normalizePath(String(c.folder || DEFAULTS.folder).replace(/\/+$/, ""));
    if (!outside && !opts.created && !this.app.vault.getAbstractFileByPath(dir)) {   // folderul exportului a dispărut: nu-l refac fără să te întreb
      const pick = await this.askFolder(dir);
      if (!pick) throw Object.assign(new Error("cancelled"), { cancelled: true });
      c.folder = pick; c.folderMoved = null; await this.save();
      return this.export(file, format, { ...opts, built, created: true });
    }
    if (outside) fs.mkdirSync(dir, { recursive: true }); else await this.S.ensureFolder(dir);
    const put = outside   // în afara vault-ului: direct pe disc
      ? async (path, data) => { fs.mkdirSync(P.dirname(path), { recursive: true }); fs.writeFileSync(path, Buffer.from(data)); }
      : async (path, data) => { const have = this.app.vault.getAbstractFileByPath(path); if (have instanceof TFile) await this.app.vault.modifyBinary(have, data); else await this.app.vault.createBinary(path, data); };
    const at = rel => outside ? P.join(dir, rel) : normalizePath(`${dir}/${rel}`);
    const enc = t => new TextEncoder().encode(t).buffer;
    let data;
    if (format === "pdf") data = await this.pdf(built, s);
    else if (format === "docx") data = await this.docx(built, s);
    else data = enc(this.mdFile(built, s));
    // în vault, două fișiere cu același nume (ex. PDF-ul sursei, care are numele notei) încurcă linkurile: Obsidian le poate muta spre export când redenumești folderul.
    // așa că exportul primește „(export)” dacă numele e deja luat de alt fișier din vault
    let base = file.basename;
    if (!outside) {
      const taken = n => (this.app.vault.getFiles?.() || []).some(f => f.name.toLowerCase() === n.toLowerCase() && f.path !== at(n));
      if (taken(`${base}.${ext}`)) { base = `${file.basename} (export)`; for (let i = 2; taken(`${base}.${ext}`); i++) base = `${file.basename} (export ${i})`; }
    }
    const path = at(`${base}.${ext}`);
    await put(path, data);
    return path;
  }
  openFile(path) {
    if (isAbsDir(path)) { try { node("electron").shell.openPath(path); } catch (e) { new Notice(path, 8000); } return; }   // în afara vault-ului
    try { if (typeof this.app.openWithDefaultApp === "function") return this.app.openWithDefaultApp(path); } catch (e) {}
    try { const { shell } = node("electron") || {}; shell.openPath(this.app.vault.adapter.getFullPath(path)); } catch (e) { const f = this.app.vault.getAbstractFileByPath(path); if (f instanceof TFile) this.app.workspace.getLeaf("tab").openFile(f); }
  }
  open(file) { if (!(file instanceof TFile) || file.extension !== "md") { new Notice(this.T("Deschide nota pe care vrei s-o exporți.", "Open the note you want to export.")); return; } new ExportModal(this, file).open(); }
  pick() { new ExportPicker(this).open(); }
  // lista notelor și apoi exportul, desenate într-o pagină (tab-ul nou) în loc de ferestre
  panel(el, done) { const p = new ExportPicker(this); p.choose = f => { if (f instanceof TFile) mountIn(new ExportModal(this, f), el, done); }; return mountIn(p, el, done); }
}

// ——— setările de pagină (aceleași în fereastra exportului și în Settings → Texere · Export) ———
// asSettings: pe pagina de setări, rândurile sunt rânduri Obsidian (aceeași grilă ca în Texere · Sources); în fereastra exportului, rânduri compacte
const LAYOUT = { open: false };   // „Aspectul paginii” din fereastra exportului: deschis sau închis, cât e deschis Obsidian
function pageForm(X, el, onChange, T, opts = {}) {
  const s = opts.s || X.conf(), asSettings = !!opts.asSettings, unit = X.conf().unit === "in" ? "in" : "cm", dec = X.S.en ? "." : ",";
  const toU = v => unit === "in" ? v / 2.54 : v, fromU = v => unit === "in" ? v * 2.54 : v;
  const fmt = v => String(Math.round(v * 100) / 100).replace(".", dec), parse = t => parseFloat(String(t).trim().replace(",", "."));
  const rows = [];
  const row = (label, build, tip) => {
    let r;
    if (asSettings) { const st = new Setting(el).setName(label); if (tip) st.nameEl.title = tip; st.controlEl.addClass("tx-ctl"); build(st.controlEl); r = st.settingEl; }
    else { r = el.createDiv("tx-row"); const l = r.createEl("label", { text: label }); if (tip) l.title = tip; const c = r.createDiv("tx-ctl"); build(c); }
    rows.push(r); return r;
  };
  const sec = text => asSettings ? new Setting(el).setName(text).setHeading() : el.createDiv({ cls: "tx-sec", text });
  // numere: același separator zecimal peste tot (virgulă în română, punct în engleză), în unitatea aleasă
  const num = (c, get, set, step, min, max, u, conv) => {
    const i = c.createEl("input", { type: "text", cls: "tx-num" }); i.inputMode = "decimal"; i.value = fmt(conv ? toU(get()) : get());
    i.addEventListener("change", () => { let v = parse(i.value); if (!Number.isFinite(v)) { i.value = fmt(conv ? toU(get()) : get()); return; } v = Math.max(min, Math.min(max, v)); set(conv ? fromU(v) : v); i.value = fmt(v); onChange("num"); });
    if (u) c.createSpan({ cls: "tx-unit", text: u }); return i;
  };
  const sel = (c, list, get, set, key) => { const d = c.createEl("select", { cls: "dropdown" }); for (const [v, t] of list) d.createEl("option", { value: v, text: t }); d.value = String(get()); d.addEventListener("change", () => { set(d.value); onChange(key || "sel"); }); return d; };
  const chk = (c, get, set, text, key) => { const l = c.createEl("label", { cls: "tx-chk" }); const i = l.createEl("input", { type: "checkbox" }); i.checked = !!get(); l.appendText(" " + text); i.addEventListener("change", () => { set(i.checked); onChange(key || "chk"); }); return i; };
  // în fereastra exportului, pagina și textul stau într-un bloc „Aspect” închis (le dă șablonul); rămâne cum l-ai lăsat cât e deschis Obsidian
  let outer = null;
  if (opts.fold) {
    const lay = el.createEl("details", { cls: "tx-layout" }); lay.open = !!LAYOUT.open;
    lay.createEl("summary", { text: T("Aspectul paginii", "Layout") });
    lay.addEventListener("toggle", () => { LAYOUT.open = lay.open; });
    outer = el; el = lay.createDiv("tx-layout-body");
  }
  sec(T("Pagina", "Page"));
  if (asSettings) row(T("Unitatea", "Units"), c => sel(c, [["cm", T("centimetri (cm)", "centimeters (cm)")], ["in", T("țoli (in)", "inches (in)")]], () => unit, v => { X.conf().unit = v; }, "unit"), T("Pentru margini și alineat, aici și în fereastra exportului.", "For margins and indent, here and in the export window."));
  row(T("Format", "Size"), c => sel(c, Object.keys(PAGES).map(k => [k, k]), () => s.page, v => s.page = v));
  row(T(`Margini (${unit})`, `Margins (${unit})`), c => {
    const g = c.createDiv("tx-margins");
    for (const [k, t] of [["top", T("sus", "top")], ["bottom", T("jos", "bottom")], ["left", T("stânga", "left")], ["right", T("dreapta", "right")]]) { const w = g.createDiv("tx-m"); num(w, () => s.margins[k], v => s.margins[k] = v, 0.1, 0, unit === "in" ? 2.5 : 6, null, true); w.createSpan({ cls: "tx-unit", text: t }); }
  }).addClass("tx-wide");
  const pn = s.pageNum = s.pageNum || clone(DEFAULTS.pageNum);
  const POS = { none: T("fără", "none"), "bottom-center": T("jos, la mijloc", "bottom center"), "bottom-right": T("jos, în dreapta", "bottom right"), "bottom-left": T("jos, în stânga", "bottom left"), "top-center": T("sus, la mijloc", "top center"), "top-right": T("sus, în dreapta", "top right"), "top-left": T("sus, în stânga", "top left") };
  const pnRows = [];
  row(T("Numerele paginilor", "Page numbers"), c => sel(c, PN_POS.map(p => [p, POS[p]]), () => pn.pos, v => { pn.pos = v; pnRows.forEach(r => r.toggleClass("tx-hide", v === "none")); }, "pn"));
  pnRows.push(row(T("Cum arată", "Style"), c => { sel(c, [["n", "1"], ["dash", "– 1 –"], ["page", T("Pagina 1", "Page 1")], ["of", "1 / 12"]], () => pn.fmt, v => pn.fmt = v).addClass("tx-small"); const sp = c.createEl("label", { cls: "tx-start" }); sp.appendText(T("începe de la pagina", "starts from page") + " ");
    const si = sp.createEl("input", { type: "text", cls: "tx-num tx-int" }); si.inputMode = "numeric"; si.value = String(pn.start ?? 1);
    si.addEventListener("change", () => { const v = Math.max(0, Math.min(9999, parseInt(si.value, 10))); pn.start = Number.isFinite(v) ? v : 1; si.value = String(pn.start); onChange("pn"); });
    chk(c, () => pn.first !== false, v => pn.first = v, T("și pe prima pagină", "on the first page too")); }, T("„Începe de la pagina”: numărul primei pagini (de ex. 37, dacă nota e capitolul 2 și primul se termină la 36).", "“Starts from page”: the number of the first page (e.g. 37 if this note is chapter 2 and chapter 1 ends at 36).")));
  pnRows.forEach(r => r.toggleClass("tx-hide", pn.pos === "none"));
  sec(T("Textul", "Text"));
  row(T("Font", "Font"), c => {
    const d = c.createEl("select", { cls: "dropdown" }), other = c.createEl("input", { type: "text", cls: "tx-font-other", placeholder: T("numele fontului", "font name") });
    const all = [...FONTS.serif, ...FONTS.sans], cur = s.font || DEFAULTS.font;
    if (!all.includes(cur)) d.createEl("option", { value: cur, text: cur });
    for (const [lab, list] of [[T("Cu serife", "Serif"), FONTS.serif], [T("Fără serife", "Sans serif"), FONTS.sans]]) {
      const og = d.createEl("optgroup"); og.label = lab;
      for (const f of list) if (f === cur || X.fontOk(f)) { const o = og.createEl("option", { value: f, text: f }); o.setCssStyles({ fontFamily: fontStack(f) }); }
    }
    d.createEl("option", { value: "__other", text: T("Alt font…", "Other font…") });
    d.value = cur; other.hide();
    d.addEventListener("change", () => { if (d.value === "__other") { other.show(); other.value = ""; other.focus(); return; } other.hide(); s.font = d.value; onChange("font"); });
    other.addEventListener("change", () => { const v = other.value.trim(); if (!v) return; s.font = v; if (![...d.options].some(o => o.value === v)) d.insertBefore(new Option(v, v), d.firstChild); d.value = v; other.hide(); onChange("font"); });
  }, T("Doar fonturile instalate pe acest calculator; „Alt font…” pentru oricare altul.", "Only fonts installed on this computer; “Other font…” for any other."));
  row(T("Mărime", "Size"), c => sel(c, [10, 10.5, 11, 11.5, 12, 13, 14].map(v => [String(v), String(v).replace(".", dec) + " pt"]), () => s.size, v => s.size = +v));
  row(T("Spațiere între rânduri", "Line spacing"), c => sel(c, [["1", "1"], ["1.15", "1" + dec + "15"], ["1.5", "1" + dec + "5"], ["2", "2"]], () => String(s.line), v => s.line = +v));
  row(T("Alineat", "First-line indent"), c => num(c, () => s.indent, v => s.indent = v, 0.05, 0, unit === "in" ? 1.5 : 3, unit, true));
  row(T("Spațiu după paragraf", "Space after paragraph"), c => num(c, () => s.after, v => s.after = v, 1, 0, 24, "pt"));
  row(T("Aliniere", "Alignment"), c => {   // patru butoane cu iconițe: stânga, centrat, dreapta, la ambele margini
    const g = c.createDiv("tx-seg");
    for (const [v, , tip] of [["left", "align-left", T("la stânga", "left")], ["center", "align-center", T("centrat", "centered")], ["right", "align-right", T("la dreapta", "right")], ["justify", "align-justify", T("la ambele margini", "justified")]]) {
      const b = g.createEl("button", { cls: "clickable-icon tx-seg-b" }); b.setAttribute("aria-label", tip); b.title = tip; b.dataset.v = v;
      b.appendChild(alignIcon(v));
      if (alignOf(s) === v) b.classList.add("is-active");
      b.addEventListener("click", e => { e.preventDefault(); s.align = v; delete s.justify; g.querySelectorAll(".tx-seg-b").forEach(x => x.classList.toggle("is-active", x === b)); onChange("chk"); });
    }
  });
  if (outer) { el = outer; outer = null; }
  sec(T("Documentul", "Document"));
  row(T("Titlul", "Title"), c => chk(c, () => s.title, v => s.title = v, T("titlul notei, sus", "the note's title, on top"), "rebuild"), T("La șabloanele facultății, titlul e pe copertă.", "In the faculty templates, the title is on the cover."));
  row(T("Cuprins", "Table of contents"), c => {
    chk(c, () => s.toc, v => s.toc = v, T("din titlurile notei", "from the note's headings"), "rebuild");
    sel(c, [["1", T("capitole", "chapters")], ["2", T("+ secțiuni", "+ sections")], ["3", T("+ subsecțiuni", "+ subsections")], ["4", T("+ nivelul 4", "+ level 4")]], () => String(s.tocDepth || 3), v => s.tocDepth = +v, "rebuild").addClass("tx-small");
  }, T("Intră unde e blocul ```cuprins din notă (îl vezi și în notă) sau sub titlul „Cuprins” (oricum, și fără bifă), altfel la început. În PDF și Word, cu numerele paginilor.", "Goes where the note's ```contents block is (you see it in the note too) or under its “Contents” heading (even without the tick), otherwise at the start. In PDF and Word, with page numbers."));
  // ce nu intră în export, și opțiunile mai rar folosite
  el.createDiv({ cls: "tx-info", text: T("Etichetele, adnotările și linkurile spre PDF nu intră în export (vezi „Mai multe opțiuni”).", "Tags, annotations and PDF links aren't exported (see “More options”).") });
  const more = el.createEl("details", { cls: "tx-more" }); if (opts.moreOpen) more.open = true;
  more.createEl("summary", { text: T("Mai multe opțiuni", "More options") });
  const inner = more.createDiv("tx-more-body"), keepEl = el; el = inner;
  row(T("Secțiunile (H2)", "Sections (H2)"), c => chk(c, () => s.h2Break, v => s.h2Break = v, T("fiecare de la o pagină nouă", "each starts on a new page"), "rebuild"), T("În PDF și Word. Una pusă chiar sub titlul unui capitol (H1) rămâne lângă el.", "In PDF and Word. One placed right under a chapter heading (H1) stays with it."));
  row(T("Textul evidențiat", "Highlighted text"), c => chk(c, () => s.keepMarks, v => s.keepMarks = v, T("păstrează-le, colorate", "keep them, colored"), "rebuild"), T("Textul marcat cu ==…== (sau colorat) în notă. Fără bifă: doar textul.", "Text marked with ==…== (or colored) in the note. Unticked: just the text."));
  row(T("Textul colorat", "Colored text"), c => chk(c, () => s.keepColors, v => s.keepColors = v, T("păstrează culorile", "keep the colors"), "rebuild"), T("Cuvintele colorate în notă (de ex. din bara de formatare). Fără bifă: textul, în negru.", "Words you colored in the note (e.g. with the formatting toolbar). Unticked: the text, in black."));
  row(T("Linkurile și citările", "Links and citations"), c => chk(c, () => s.colorLinks, v => s.colorLinks = v, T("colorate, în culoarea principală", "colored, in the main color"), "rebuild"), T("În culoarea principală a temei, ca în notă. Fără bifă: ca textul din jur.", "In your theme's main color, as in the note. Unticked: like the surrounding text."));
  row(T("Etichetele", "Tags"), c => chk(c, () => s.showTags, v => s.showTags = v, T("arată-le colorate, ca în Obsidian", "show them colored, as in Obsidian"), "rebuild"), T("Exact cum le vezi în notă (culorile temei și ale paletei PDF++).", "Exactly as you see them in the note (your theme's and PDF++ palette's colors)."));
  row(T("Locul din PDF", "Place in the PDF"), c => chk(c, () => s.keepPdfLinks, v => s.keepPdfLinks = v, T("păstrează linkurile (deschid PDF-ul în Obsidian)", "keep the links (they open the PDF in Obsidian)"), "rebuild"), T("Merg doar pe acest calculator, cu Obsidian. Fără bifă: dispar.", "They only work on this computer, with Obsidian. Unticked: they're removed."));
  row(T("Titlul bibliografiei", "Bibliography heading"), c => { const i = c.createEl("input", { type: "text", placeholder: T("automat", "automatic") }); i.title = T("Gol: „Bibliografie” (sau „Referințe” la APA), în limba notei. Dacă nota are deja un astfel de titlu, bibliografia intră sub el.", "Empty: “Bibliography” (or “References” for APA), in the note's language. If the note already has such a heading, the bibliography goes under it."); i.value = s.bibHeading || ""; i.addEventListener("change", () => { s.bibHeading = i.value.trim(); onChange("rebuild"); }); });
  el = keepEl;
  if (asSettings) more.open = true;
  return rows;
}

// ——— fereastra exportului: formatul (file sus), previzualizarea, șablonul și setările paginii, butonul în subsol ———

// ——— aspectul ferestrelor și al setărilor: același ca la Texere · Sources, dar al lui (merge și fără Sources) ———
// dacă Sources e pornit, stilurile lui sunt deja în pagină; altfel le punem pe acestea (o copie identică)

class ExportModal extends Modal {
  constructor(X, file) { super(X.app); this.X = X; this.file = file; this.format = okFormat(X.conf().format); this.style = null; this.built = null; }
  T(a, b) { return this.X.T(a, b); }
  onOpen() {
    const X = this.X, T = (a, b) => this.T(a, b), E = X.host.cite;
    this.modalEl.addClass("texere-src"); this.modalEl.addClass("texere-export"); this.titleEl.empty();
    this.titleEl.createSpan({ cls: "ts-head-t", text: T("Exportă", "Export") });
    const sw = this.titleEl.createDiv("ts-modes"); this.tabs = {};
    for (const [id, label] of FORMATS) { const b = sw.createSpan({ cls: "ts-mode", text: label }); b.title = { docx: "Word (.docx)", md: "Markdown (.md)" }[id] || "." + id; this.tabs[id] = b; b.addEventListener("click", () => this.setFormat(id)); }
    this.titleEl.createSpan({ cls: "tx-file", text: this.file.basename });
    const body = this.contentEl.createDiv("tx-body");
    this.prev = body.createDiv("tx-prev");
    const side = this.side = body.createDiv("tx-side");
    const fm = this.app.metadataCache.getFileCache(this.file)?.frontmatter || {};
    // șablonul: al notei (proprietatea export) sau cel general
    this.preset = X.presetFor(fm);
    const pr = side.createDiv("tx-row"); pr.createEl("label", { text: T("Șablonul", "Template") });
    const pd = this.presetSel = pr.createDiv("tx-ctl").createEl("select", { cls: "dropdown" });
    for (const id of X.templates()) pd.createEl("option", { value: id, text: X.presetLabel(id) });
    pd.value = this.preset; pd.addEventListener("change", () => { this.preset = pd.value; this.renderForm(); this.refresh(true); });
    this.presetInfo = side.createDiv("tx-preset-info");
    // stilul citărilor pentru acest export (implicit: al notei, altfel cel implicit)
    this.style = E?.ready ? E.current(fm) : null;
    if (!E?.ready) {   // fără Texere · Sources: exportul merge, dar citările rămân cum le-ai scris
      const r = side.createDiv("tx-row"); r.createEl("label", { text: T("Citările", "Citations") });
      r.createDiv({ cls: "tx-ctl tx-hint", text: T("Pornește modulul Referințe pentru citări în stilul ales.", "Turn on the References module for citations in your style.") });
    }
    if (E?.ready) {
      const r = side.createDiv("tx-row"); r.createEl("label", { text: T("Stilul citărilor", "Citation style") });
      const d = r.createDiv("tx-ctl").createEl("select", { cls: "dropdown" }); for (const st of E.list()) d.createEl("option", { value: st.id, text: st.label }); d.value = this.style || "";
      d.addEventListener("change", () => { this.style = d.value; this.refresh(true); });
    }
    this.formEl = side.createDiv();
    this.mdNote = side.createDiv({ cls: "tx-note", text: T("Markdown păstrează doar textul, cu citările și bibliografia.", "Markdown keeps only the text, with citations and bibliography.") });
    this.renderForm();
    const ft = this.contentEl.createDiv("ts-foot"); this.footL = ft.createDiv("ts-foot-l"); this.footR = ft.createDiv("ts-foot-r");
    this.status = this.footL.createSpan({ cls: "ts-foot-q", text: T("Pregătesc…", "Preparing…") });
    const sl = this.footL.createEl("a", { text: T("Setări", "Settings") }); sl.addEventListener("click", () => { this.close(); this.host?.core?.openSettings?.("export"); });
    this.go = this.footR.createEl("button", { cls: "mod-cta" }); this.go.addEventListener("click", () => this.run());
    // previzualizarea e izolată (fără acces la Obsidian): vorbește doar prin mesaje (câte pagini, unde ai derulat)
    this.scrollY = 0;
    this.onMsg = e => {
      if (!this.frame || e.source !== this.frame.contentWindow) return;
      if (e.data?.texere === "scroll") this.scrollY = +e.data.y || 0;
      if (e.data?.texere === "paged") { this.pages = e.data.pages; this.showStatus(); if (this.scrollY) e.source.postMessage({ texere: "scrollTo", y: this.scrollY }, "*"); }
    };
    window.addEventListener("message", this.onMsg);
    this.setFormat(this.format);
  }
  renderForm() {
    const X = this.X, T = (a, b) => this.T(a, b), open = this.formEl.querySelector("details.tx-more")?.open;
    this.formEl.empty();
    const s = X.target(this.preset);
    const info = () => {
      this.presetInfo.empty();
      this.presetInfo.createSpan({ text: X.isCustom(this.preset) ? T(`Pornit din „${X.presetLabel(X.custom()[this.preset].base)}”. `, `Started from “${X.presetLabel(X.custom()[this.preset].base)}”. `) : this.preset ? T("După ", "Following the ") + T(GUIDE[0], GUIDE[1]) + ". " : "" });
      if (X.changed(this.preset)) { const a = this.presetInfo.createEl("a", { text: X.resetLabel(this.preset) }); a.addEventListener("click", async () => { await X.reset(this.preset); this.renderForm(); this.refresh(true); }); }
    };
    info();
    pageForm(X, this.formEl, key => { X.save(); info(); this.refresh(key === "rebuild"); }, T, { s, moreOpen: open, fold: true });
    this.applyFormat();
  }
  applyFormat() { if (!this.formEl) return; const md = this.format === "md"; this.formEl.toggle(!md); if (this.mdNote) this.mdNote.toggle(md); }
  setFormat(f) {
    this.format = f; const X = this.X, s = X.conf(); if (s.format !== f) { s.format = f; X.save(); }
    for (const [k, b] of Object.entries(this.tabs)) b.toggleClass("on", k === f);
    const lbl = { pdf: "PDF", docx: "Word", md: "Markdown" }[f];
    this.go.setText(this.T(`Exportă ${lbl}`, `Export ${lbl}`));
    this.applyFormat();
    this.refresh(!this.built);
  }
  showStatus() {
    const T = (a, b) => this.T(a, b), st = this.built?.stats; if (!st) return;
    const parts = [];
    if (this.pages && (this.format === "pdf" || this.format === "docx")) parts.push(this.pages === 1 ? T("1 pagină", "1 page") : T(`${this.pages} pagini`, `${this.pages} pages`));
    parts.push(st.cites ? T(`${st.cites} citări · ${st.sources} referințe`, `${st.cites} citations · ${st.sources} references`) : T("fără citări", "no citations"));
    if (st.missing.length) parts.push(T(`negăsite: @${st.missing.join(", @")}`, `not found: @${st.missing.join(", @")}`));
    if (this.format === "docx") parts.push(this.built?.html.includes('class="toc"') ? T("Word face cuprinsul când deschizi fișierul (apasă Da la actualizare)", "Word builds the contents when you open the file (say Yes to updating)") : T("Word poate rupe paginile puțin altfel", "Word may break pages slightly differently"));
    this.status.setText(parts.join(" · ")); this.status.toggleClass("tx-warn", !!st.missing.length);
  }
  // previzualizarea: refăcută la orice schimbare (cu o mică pauză, ca să nu clipească la fiecare tastă)
  refresh(rebuild) {
    clearTimeout(this._t);
    this._t = setTimeout(async () => {
      const X = this.X, id = (this._id = (this._id || 0) + 1);
      try {
        if (rebuild || !this.built || this.built.preset !== this.preset) this.built = await X.build(this.file, { style: this.style, preset: this.preset });
        if (id !== this._id) return;
        const s = this.built.s;
        this.pages = null; this.showStatus();
        if (this.format === "md") {
          this.prev.empty(); this.frame = null;
          const text = X.mdFile(this.built, s);
          this.prev.createEl("pre", { cls: "tx-md", text }); return;
        }
        const html = await X.pagedHtml(this.built, s, "preview");
        if (id !== this._id) return;
        const fr = document.createElement("iframe"); fr.className = "tx-frame"; fr.setAttribute("sandbox", "allow-scripts allow-modals"); fr.srcdoc = html;
        this.prev.empty(); this.prev.appendChild(fr); this.frame = fr;
      } catch (e) { console.error("Texere Export: previzualizarea", e); this.status.setText(this.T("Nu pot pregăti documentul: ", "Couldn't prepare the document: ") + e.message); }
    }, rebuild ? 0 : 350);
  }
  async run() {
    const T = (a, b) => this.T(a, b), X = this.X; this.go.disabled = true; const old = this.go.getText(); this.go.setText(T("Se exportă…", "Exporting…"));
    try {
      const path = await X.export(this.file, this.format, { built: this.built || undefined, style: this.style, preset: this.preset });
      const frag = document.createDocumentFragment(); frag.append(T("Exportat: ", "Exported: ") + path.split(/[\\/]/).pop() + (isAbsDir(path) ? T(" (în afara vault-ului)", " (outside the vault)") : "") + " · ");
      const a = document.createElement("a"); a.textContent = T("Deschide", "Open"); a.href = "#"; frag.append(a);
      const n = new Notice(frag, 10000); a.addEventListener("click", e => { e.preventDefault(); n.hide(); X.openFile(path); });
      this.close();
    } catch (e) {
      if (e.cancelled) return;
      console.error("Texere Export", e);
      if (e.noPrint && this.frame?.contentWindow) { new Notice(T("Obsidian nu poate salva PDF-ul direct aici: în fereastra de tipărire alege „Salvează ca PDF”.", "Obsidian can't save the PDF directly here: in the print window choose “Save as PDF”."), 10000); this.frame.contentWindow.postMessage({ texere: "print" }, "*"); }
      else new Notice(T("Exportul nu a mers: ", "The export didn't work: ") + e.message, 10000);
    } finally { this.go.disabled = false; this.go.setText(old); }
  }
  onClose() { window.removeEventListener("message", this.onMsg); clearTimeout(this._t); this.contentEl.empty(); }
}

// ——— Texere · Export din bara din stânga: cauți nota pe care o exporți (același aspect ca „Caută surse”) ———
class ExportPicker extends Modal {
  constructor(X) { super(X.app); this.X = X; this.sel = 0; this.items = []; }
  T(a, b) { return this.X.T(a, b); }
  onOpen() {
    const T = (a, b) => this.T(a, b);
    this.modalEl.addClass("texere-src"); this.modalEl.addClass("texere-xpick"); this.titleEl.empty();
    this.titleEl.createSpan({ cls: "ts-head-t", text: T("Exportă", "Export") });
    const pane = this.contentEl.createDiv("ts-pane");
    const qb = pane.createDiv("ts-q"); try { obsidian.setIcon(qb.createSpan(), "search"); } catch (e) {}
    this.inp = qb.createEl("input", { type: "text", placeholder: T("Caută nota pe care o exporți: titlu, folder…", "Search the note to export: title, folder…") });
    this.inp.addEventListener("input", () => { this.sel = 0; this.render(); });
    this.inp.addEventListener("keydown", e => {
      if (e.key === "ArrowDown") { e.preventDefault(); this.sel = Math.min(this.items.length - 1, this.sel + 1); this.render(true); }
      else if (e.key === "ArrowUp") { e.preventDefault(); this.sel = Math.max(0, this.sel - 1); this.render(true); }
      else if (e.key === "Enter") { e.preventDefault(); this.choose(this.items[this.sel]); }
    });
    this.list = pane.createDiv("ts-list");
    const ft = this.contentEl.createDiv("ts-foot"); const fl = ft.createDiv("ts-foot-l"), fr = ft.createDiv("ts-foot-r");
    this.info = fl.createSpan({ cls: "ts-foot-q" });
    this.go = fr.createEl("button", { cls: "mod-cta", text: T("Exportă…", "Export…") }); this.go.addEventListener("click", () => this.choose(this.items[this.sel]));
    this.render(); setTimeout(() => this.inp.focus(), 30);
  }
  // toate notele, cele schimbate de curând primele (căutarea le găsește și pe celelalte)
  pool() {
    const skip = f => /^(\.trash|Support\/(Admin|Templates))\//.test(f.path);
    return this.app.vault.getMarkdownFiles().filter(f => !skip(f)).sort((a, b) => b.stat.mtime - a.stat.mtime);
  }
  render(keepScroll) {
    const T = (a, b) => this.T(a, b), q = this.inp.value.trim();
    let pool = this.pool(), total = pool.length;
    if (q) {
      const fz = obsidian.prepareFuzzySearch ? obsidian.prepareFuzzySearch(q) : null;
      pool = pool.map(f => ({ f, s: fz ? fz(f.path.replace(/\.md$/, ""))?.score : (f.path.toLowerCase().includes(q.toLowerCase()) ? 0 : null) })).filter(x => x.s != null).sort((a, b) => b.s - a.s || b.f.stat.mtime - a.f.stat.mtime).map(x => x.f).slice(0, 80);
    } else pool = pool.slice(0, 100);
    this.items = pool; this.sel = Math.min(this.sel, Math.max(0, pool.length - 1));
    this.list.empty();
    if (!pool.length) { this.list.createDiv({ cls: "ts-hint", text: T("Nicio notă găsită.", "No note found.") }); }
    const mc = this.app.metadataCache, ago = t => { const d = (Date.now() - t) / 60000; return d < 60 ? T(`acum ${Math.max(1, Math.round(d))} min`, `${Math.max(1, Math.round(d))} min ago`) : d < 1440 ? T(`acum ${Math.round(d / 60)} h`, `${Math.round(d / 60)} h ago`) : new Date(t).toLocaleDateString(this.X.S.en ? "en-GB" : "ro-RO", { day: "numeric", month: "short" }); };
    pool.forEach((f, i) => {
      const row = this.list.createDiv("ts-item" + (i === this.sel ? " sel" : ""));
      const t = row.createDiv({ cls: "ts-title", text: f.basename });
      const fm = mc.getFileCache(f)?.frontmatter || {}, preset = this.X.presetFor(fm);
      if (preset) t.createSpan({ cls: "tx-chip", text: this.X.presetLabel(preset).split(" — ")[0] });
      row.createDiv({ cls: "ts-meta", text: [f.parent?.path && f.parent.path !== "/" ? f.parent.path : T("vault", "vault"), ago(f.stat.mtime)].join(" · ") });
      row.addEventListener("click", () => { if (this.sel === i) return this.choose(f); this.sel = i; this.render(true); });
      row.addEventListener("dblclick", () => this.choose(f));
    });
    const more = !q && total > pool.length ? T(` (ultimele ${pool.length} din ${total}; caută pentru celelalte)`, ` (latest ${pool.length} of ${total}; search for the rest)`) : "";
    this.info.setText(pool.length ? T(`${q ? pool.length : total} note`, `${q ? pool.length : total} notes`) + more + T(" · ↑↓ alegi · Enter exporți", " · ↑↓ choose · Enter exports") : "");
    this.go.disabled = !pool.length;
    if (keepScroll) this.list.querySelector(".ts-item.sel")?.scrollIntoView({ block: "nearest" });
  }
  choose(f) { if (!(f instanceof TFile)) return; this.close(); this.X.open(f); }
  onClose() { this.contentEl.empty(); }
}

// ——— Settings → Texere · Export ———
// ——— Settings → Texere · Export: întâi șablonul (General, Licență, Disertație), apoi setările lui; fișierele exportate la final ———
// ——— „Unde salvez exportul?”: folderul exportului a fost redenumit, mutat sau șters ———
// aceleași variante ca în Setări: un folder din vault (din listă) sau, cu „Alege…”, oricare folder de pe calculator
class FolderModal extends Modal {
  constructor(X, missing, done) { super(X.app); this.X = X; this.missing = missing; this.done = done; this.val = null; this.picked = null; }
  onOpen() {
    const X = this.X, T = (a, b) => X.T(a, b), el = this.contentEl;
    this.modalEl.addClass("tx-folder-ask"); this.titleEl.setText(T("Unde salvez exportul?", "Where should I save the export?"));
    const moved = X.conf().folderMoved;
    folderAlert(el, X, T, this.missing, moved, async to => { this.picked = to; this.close(); }, true);
    const folders = X.vaultFolders(), ren = moved && moved.from === this.missing && X.app.vault.getAbstractFileByPath(moved.to) ? moved.to : null;
    this.val = ren || folders.find(f => /export/i.test(f.split("/").pop())) || folders[0] || this.missing;
    const s1 = new Setting(el).setName(T("Alt folder din vault", "Another folder in your vault"));
    s1.addDropdown(d => { for (const f of folders) d.addOption(f, f); d.setValue(this.val).onChange(v => { this.val = v; s2.setDesc(T("Și în afara vault-ului.", "Outside the vault too.")); }); d.selectEl.addClass("tx-sel-200"); });
    const s2 = new Setting(el).setName(T("Sau un folder de pe calculator", "Or a folder on this computer")).setDesc(T("Și în afara vault-ului.", "Outside the vault too."));
    s2.addButton(b => b.setButtonText(T("Alege…", "Choose…")).onClick(async () => { const dir = await X.chooseDir(this.val); if (!dir) return; this.val = dir; s2.setDesc(dir); }));
    const bc = el.createDiv("modal-button-container");
    bc.createEl("button", { text: T("Renunță", "Cancel") }).addEventListener("click", () => this.close());
    bc.createEl("button", { cls: "mod-cta", text: T("Salvează aici", "Save here") }).addEventListener("click", () => { this.picked = this.val; this.close(); });
  }
  onClose() { this.contentEl.empty(); const d = this.done; this.done = null; d?.(this.picked); }
}

class ExportSettingTab extends PluginSettingTab {
  constructor(X) { super(X.app, X.host); this.X = X; this.id = "texere-export"; this.name = "Texere · Export"; this.editing = null; }
  // o singură pagină: formatul, șabloanele, lipirea curată. Pagina, textul și documentul unui șablon apar doar când îl editezi
  // („Editează” pe rândul lui) sau când faci unul nou; „Gata” le închide. Aceleași reglaje sunt și în fereastra exportului.
  display() {
    const X = this.X, T = (a, b) => X.T(a, b), c = this.containerEl, s = X.conf();
    if (this.editing && !X.exists(this.editing)) this.editing = null;
    const keep = this._top ? 0 : c.scrollTop; this._top = false; c.empty(); c.addClass("texere-settings"); c.addClass("texere-xsettings");
    const head = c.createDiv("ts-head"); head.createSpan({ cls: "ts-head-t", text: "Export" });
    const body = c.createDiv("ts-body");
    if (!X.host.cite?.ready) body.createEl("p", { cls: "ts-intro", text: T("Fără modulul Referințe, citările rămân [@cheie] și nu se face bibliografia.", "Without the References module, citations stay [@key] and there's no bibliography.") });
    this.filesRows(body, X, T, s);
    this.templatesRows(body, X, T, s);
    this.importRows(body, X, T);
    const grid = root => { for (const it of root.querySelectorAll(".setting-item:not(.setting-item-heading)")) if (it.querySelector(".setting-item-control input[type='text'], .setting-item-control select")) it.addClass("ts-grid-row"); };
    grid(body);
    const jump = this._jump; this._jump = false;
    if (jump) requestAnimationFrame(() => body.querySelector(".tx-tpl-edit")?.scrollIntoView({ block: "start" })); else c.scrollTop = keep;
  }
  edit(id) { this.editing = id; this._jump = true; this.display(); }
  // ——— șabloanele: fiecare pe un rând; „Editează” deschide sub el pagina, textul și documentul lui; dedesubt, „Un șablon nou” ———
  templatesRows(body, X, T, s) {
    new Setting(body).setName(T("Șabloane", "Templates")).setDesc(T("O notă își alege unul cu proprietatea export.", "A note picks one with its export property.")).setHeading();
    const def = X.exists(s.defaultPreset) ? s.defaultPreset : "";
    for (const id of X.templates()) {
      const mine = X.isCustom(id), open = this.editing === id, st = new Setting(body).setName(X.presetLabel(id) + (id === def ? T(" · implicit", " · default") : ""));
      st.setDesc(T("În notă: ", "In a note: ") + "export: " + X.presetKey(id));
      st.addButton(b => { b.setButtonText(open ? T("Gata", "Done") : T("Editează", "Edit")).onClick(() => { if (open) { this.editing = null; this.display(); } else this.edit(id); }); if (open) b.setCta?.(); });
      if (id !== def) st.addExtraButton(b => b.setIcon("star").setTooltip(T("Fă-l implicit", "Make it the default")).onClick(async () => { s.defaultPreset = id; await X.save(); this.display(); }));
      st.addExtraButton(b => b.setIcon("copy").setTooltip(T("Dublează", "Duplicate")).onClick(() => new NameModal(X, T("Șablon nou", "New template"), T(`${X.presetLabel(id)} (copie)`, `${X.presetLabel(id)} (copy)`), async name => this.edit(await X.addTemplate(name, id))).open()));
      if (mine) {
        st.addExtraButton(b => b.setIcon("pencil").setTooltip(T("Redenumește", "Rename")).onClick(() => new NameModal(X, T("Redenumește șablonul", "Rename the template"), X.presetLabel(id), async name => { await X.renameTemplate(id, name); this.display(); }).open()));
        st.addExtraButton(b => b.setIcon("trash-2").setTooltip(T("Șterge", "Delete")).onClick(() => new ConfirmModal(X, T(`Ștergi șablonul „${X.presetLabel(id)}”?`, `Delete the template “${X.presetLabel(id)}”?`), T("Notele care îl folosesc vor folosi șablonul implicit.", "Notes that use it will use the default template."), async () => { await X.deleteTemplate(id); if (this.editing === id) this.editing = null; this.display(); }).open()));
      } else if (X.changed(id)) st.addExtraButton(b => b.setIcon("rotate-ccw").setTooltip(X.resetLabel(id)).onClick(async () => { await X.reset(id); this.display(); }));
      if (open) this.pageRows(body, X, T, id);
    }
    const nw = new Setting(body).setName(T("Un șablon nou", "A new template")).setDesc(T("Pornește dintr-unul existent; apoi îl reglezi aici.", "It starts from an existing one; then you adjust it here."));
    let from = def;
    nw.addDropdown(d => { for (const id of X.templates()) d.addOption(id, T("din ", "from ") + X.presetLabel(id)); d.setValue(from).onChange(v => { from = v; }); d.selectEl.addClass("tx-sel-max260"); });
    nw.addButton(b => b.setButtonText(T("Creează…", "Create…")).onClick(() => new NameModal(X, T("Șablon nou", "New template"), "", async name => this.edit(await X.addTemplate(name, from))).open()));
  }
  // ——— pagina, textul și documentul șablonului pe care îl editezi (sub rândul lui) ———
  pageRows(body, X, T, id) {
    const box = body.createDiv("tx-tpl-edit");
    const about = box.createDiv("tx-tpl-about");
    const upd = () => {
      about.empty(); const mine = X.isCustom(id);
      about.createSpan({ text: mine ? T(`Al tău, pornit din „${X.presetLabel(X.custom()[id].base)}”. `, `Yours, started from “${X.presetLabel(X.custom()[id].base)}”. `) : id ? T("După ", "Following the ") + T(GUIDE[0], GUIDE[1]) + ". " : "" });
      about.createSpan({ text: T("Ce schimbi aici rămâne la acest șablon.", "Changes stay with this template.") + " " });
      if (X.changed(id)) { const a = about.createEl("a", { text: X.resetLabel(id), href: "#" }); a.addEventListener("click", async e => { e.preventDefault(); await X.reset(id); this.display(); }); }
    };
    upd();
    const form = box.createDiv("tx-form");
    pageForm(X, form, async key => { await X.save(); if (key === "unit") return this.display(); upd(); }, T, { asSettings: true, s: X.target(id) });
  }
  // ——— formatul exportului (sus pe pagină) ———
  filesRows(body, X, T, s) {
    new Setting(body).setName(T("Formatul", "Format")).setDesc(T("Cel cu care se deschide exportul. Folderul exportului e în Settings → Texere → Foldere.", "The one the export opens with. The export folder is in Settings → Texere → Folders."))
      .addDropdown(d => { for (const [id, l] of FORMATS) d.addOption(id, id === "docx" ? "Word (.docx)" : l); d.setValue(okFormat(s.format || DEFAULTS.format)).onChange(async v => { s.format = v; await X.save(); }); });
  }
  // ——— folderele exportului, desenate în Settings → Texere → Foldere: unde ajung exporturile și documentele importate ———
  folderRows(body, redraw) {
    const X = this.X, T = (a, b) => X.T(a, b), s = X.conf();
    const cur = String(s.folder || DEFAULTS.folder).replace(/\/+$/, ""), outside = isAbsDir(cur), gone = !outside && !X.app.vault.getAbstractFileByPath(cur);
    const fset = new Setting(body).setName(T("Exportul", "Export")).setDesc(outside ? T(`Pe calculator: ${cur}`, `On this computer: ${cur}`) : T("Unde ajung PDF-urile și fișierele Word exportate: în vault sau oriunde pe calculator.", "Where exported PDF and Word files go: in the vault or anywhere on this computer."));
    // un singur buton: un folder din vault sau, ca prim rând, oricare folder de pe calculator
    fset.descEl.createDiv({ cls: "tx-mt6 ts-cur", text: outside ? "" : gone ? T(`${cur} (nu mai e în vault)`, `${cur} (not in the vault anymore)`) : cur });
    fset.addButton(b => b.setButtonText(T("Schimbă…", "Change…")).onClick(() => pickFolder(X.app, { placeholder: T("Unde ajung fișierele exportate?", "Where should exported files go?"), exclude: [cur],
      extra: [{ text: T("💻 Alt folder de pe calculator, și în afara vault-ului…", "💻 Another folder on this computer, outside the vault too…"), run: async () => { const picked = await X.chooseDir(s.folder); if (!picked) return; s.folder = picked; s.folderMoved = null; await X.save(); redraw(); } }] },
      async v => { s.folder = v; s.folderMoved = null; await X.save(); redraw(); })));
    // folderul a fost redenumit sau șters: spune-o chiar sub el, cu ce poți face
    if (gone) folderAlert(body, X, T, cur, s.folderMoved, async to => { s.folder = to; s.folderMoved = null; await X.save(); redraw(); });
    const c = X.S.conf(), im = (c.import = c.import || { cleanPaste: true, folder: placeFor(X.app, "02. Notes/Imported"), keep: false });
    const imS = new Setting(body).setName(T("Documentele importate", "Imported documents")).setDesc(T("Unde devin note documentele Word sau PDF pe care le imporți.", "Where Word or PDF documents you import become notes."));
    imS.descEl.createDiv({ cls: "tx-mt6 ts-cur", text: im.folder || placeFor(X.app, "02. Notes/Imported") });
    imS.addButton(b => b.setButtonText(T("Schimbă…", "Change…")).onClick(() => pickFolder(X.app, { placeholder: T("Unde devin note documentele importate?", "Where should imported documents go?"), exclude: [im.folder] }, async v => { im.folder = v; await X.save(); redraw(); })));
  }
  // ——— importul documentelor și lipirea curată (Avansat) ———
  importRows(body, X, T) {
    const c = X.S.conf(), im = (c.import = c.import || { cleanPaste: true, folder: placeFor(X.app, "02. Notes/Imported"), keep: false });
    new Setting(body).setName(T("Import și lipire", "Import and paste")).setHeading();
    new Setting(body).setName(T("Lipirea curată", "Clean paste")).setDesc(T("Textul lipit din Word, Google Docs sau PDF devine text curat.", "Text pasted from Word, Google Docs or a PDF becomes clean text."))
      .addToggle(t => t.setValue(im.cleanPaste !== false).onChange(async v => { im.cleanPaste = v; await X.save(); }));
    new Setting(body).setName(T("Păstrează și originalul", "Keep the original too")).setDesc(T("Lângă notă, în vault.", "Next to the note, in the vault."))
      .addToggle(t => t.setValue(!!im.keep).onChange(async v => { im.keep = v; await X.save(); }));
  }
}

// sub un folder care a dispărut: ce s-a întâmplat și ce poți face (folosește numele nou · pune-l la loc · creează-l din nou · alege altul, din lista de deasupra)
function folderAlert(el, X, T, cur, moved, use, ask) {
  const to = moved && moved.from === cur && X.app.vault.getAbstractFileByPath(moved.to) ? moved.to : null;
  const box = el.createDiv("tx-falert");
  // ce se întâmplă de acum: exportul nu ajunge în folderul tău; următorul export se oprește și te întreabă (în fereastra „Unde salvez exportul?”: de ce întreabă acum)
  box.createDiv({ cls: "tx-falert-t", text: T("Exporturile nu ajung în folderul tău de export", "Exports don't go into your export folder") });
  const then = ask ? T("așa că Texere nu știe unde să salveze exportul.", "so Texere doesn't know where to save the export.") : null, where = ask ? T("mai jos", "below") : T("din lista de deasupra", "from the list above");
  box.createDiv({ cls: "tx-falert-d", text: to ? T(`Ai redenumit folderul exportului: „${cur}” e acum „${to}”, ${ask ? then : `dar Texere încă salvează în „${cur}”. Până alegi, următorul export se oprește și te întreabă unde să ajungă.`} Folosește numele nou, pune-i înapoi numele vechi sau alege alt folder ${where}.`, `You renamed the export folder: “${cur}” is now “${to}”, ${ask ? then : `but Texere still saves to “${cur}”. Until you choose, the next export will stop and ask where to go.`} Use the new name, put the old name back, or pick another folder ${where}.`)
    : T(`Folderul exportului, „${cur}”, nu mai e în vault (l-ai redenumit, mutat sau șters), ${ask ? then : `iar Texere încă salvează acolo. Până alegi, următorul export se oprește și te întreabă unde să ajungă.`} Creează-l din nou sau alege alt folder ${where}.`, `The export folder, “${cur}”, isn't in your vault anymore (renamed, moved or deleted), ${ask ? then : `but Texere still saves there. Until you choose, the next export will stop and ask where to go.`} Create it again, or pick another folder ${where}.`) });
  const bt = box.createDiv("tx-falert-b");
  if (to) {
    bt.createEl("button", { cls: "mod-cta", text: T(`Folosește „${to}”`, `Use “${to}”`) }).addEventListener("click", () => use(to));
    bt.createEl("button", { text: T(`Pune-i înapoi numele „${cur}”`, `Put back the name “${cur}”`) }).addEventListener("click", async () => {
      try { const f = X.app.vault.getAbstractFileByPath(to); const parent = cur.includes("/") ? cur.slice(0, cur.lastIndexOf("/")) : ""; if (parent) await X.S.ensureFolder(parent); await X.app.fileManager.renameFile(f, cur); await use(cur); }
      catch (e) { new Notice(T("N-am putut redenumi folderul: ", "Couldn't rename the folder: ") + e.message, 8000); }
    });
  } else bt.createEl("button", { cls: "mod-cta", text: T(`Creează din nou „${cur}”`, `Create “${cur}” again`) }).addEventListener("click", async () => { await X.S.ensureFolder(cur); await use(cur); });
  return box;
}

// un nume (șablon nou, redenumire): câmp + Renunț / Salvează
class NameModal extends Modal {
  constructor(X, title, value, done) { super(X.app); this.X = X; this.t = title; this.v = value; this.done = done; }
  onOpen() {
    const T = (a, b) => this.X.T(a, b); this.titleEl.setText(this.t); this.modalEl.addClass("tx-name-modal");
    const inp = this.contentEl.createEl("input", { type: "text", cls: "tx-name-in" }); inp.value = this.v; inp.placeholder = T("Numele șablonului", "Template name");
    const bc = this.contentEl.createDiv("modal-button-container");
    bc.createEl("button", { text: T("Renunță", "Cancel") }).addEventListener("click", () => this.close());
    const ok = bc.createEl("button", { cls: "mod-cta", text: T("Salvează", "Save") });
    const go = () => { const v = inp.value.trim(); if (!v) return inp.focus(); this.close(); this.done(v); };
    ok.addEventListener("click", go); inp.addEventListener("keydown", e => { if (e.key === "Enter") go(); });
    setTimeout(() => { inp.focus(); inp.select(); }, 0);
  }
  onClose() { this.contentEl.empty(); }
}
class ConfirmModal extends Modal {
  constructor(X, title, text, yes) { super(X.app); this.X = X; this.t = title; this.x = text; this.yes = yes; }
  onOpen() {
    const T = (a, b) => this.X.T(a, b); this.titleEl.setText(this.t); this.contentEl.createEl("p", { text: this.x });
    const bc = this.contentEl.createDiv("modal-button-container");
    bc.createEl("button", { text: T("Renunță", "Cancel") }).addEventListener("click", () => this.close());
    bc.createEl("button", { cls: "mod-warning", text: T("Șterge", "Delete") }).addEventListener("click", () => { this.close(); this.yes(); });
  }
  onClose() { this.contentEl.empty(); }
}

// ——— cuprinsul în notă: blocul ```cuprins arată titlurile de sub el, se actualizează când le schimbi; un clic te duce la titlu ———
const RenderChild = obsidian.MarkdownRenderChild || class { constructor(el) { this.containerEl = el; } registerEvent() {} };
const plainHeading = t => String(t || "")
  .replace(/\[\[([^\]|]+?)(?:\|([^\]]*))?\]\]/g, (x, a, b) => b != null ? b : a.split("#")[0].split("/").pop())
  .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/(\*\*|__|==|~~|`|\*)/g, "").replace(/\s+/g, " ").trim();
class TocView extends RenderChild {
  constructor(X, src, el, ctx) { super(el); this.X = X; this.src = src || ""; this.ctx = ctx; this.el = el; this.n = 0; }
  onload() {
    this.render();
    const mc = this.X.app.metadataCache;
    if (mc.on) this.registerEvent(mc.on("changed", f => { if (f?.path === this.ctx.sourcePath) this.render(); }));
  }
  // titlurile de după bloc, ca în export: fără titlul cuprinsului și fără titlul lucrării, până la nivelul ales
  async entries() {
    const X = this.X, app = X.app, path = this.ctx.sourcePath, file = app.vault.getAbstractFileByPath?.(path);
    const cache = file ? app.metadataCache.getFileCache(file) : null, fm = cache?.frontmatter || {};
    let line = this.ctx.getSectionInfo?.(this.el)?.lineStart;
    if (line == null && file) { const txt = await app.vault.cachedRead(file); line = txt.split("\n").findIndex(l => /^\s*(```+|~~~+)\s*(cuprins|contents)\b/i.test(l)); }
    const m = /(?:depth|nivel|niveluri|levels)\s*[:=]\s*(\d)/i.exec(this.src);
    const s = X.target(X.presetFor(fm)), depth = Math.max(1, Math.min(6, m ? +m[1] : (+s.tocDepth || 3)));
    const title = fm.title != null ? plainHeading(fm.title).toLowerCase() : "";
    const after = (cache?.headings || []).filter(h => h.position.start.line > (line ?? -1) && !TOC_TEXT.test(plainHeading(h.heading)) && !(h.level === 1 && title && plainHeading(h.heading).toLowerCase() === title));
    const top = Math.min(...after.map(h => h.level), 6);
    return after.map(h => ({ text: plainHeading(h.heading), lv: h.level - top + 1, line: h.position.start.line })).filter(e => e.lv <= depth);
  }
  go(line) {
    const app = this.X.app, ws = app.workspace, path = this.ctx.sourcePath;
    const leaf = ws.getLeavesOfType?.("markdown").find(l => l.view?.file?.path === path);
    if (!leaf) { ws.openLinkText?.(path, "", false, { eState: { line } }); return; }
    ws.setActiveLeaf?.(leaf, { focus: true });
    const v = leaf.view, ed = v.editor;
    if (v.getMode?.() === "source" && ed) { const p = { line, ch: 0 }; ed.setCursor(p); ed.scrollIntoView({ from: p, to: p }, true); ed.focus?.(); }
    else v.setEphemeralState?.({ line });
  }
  async render() {
    const n = ++this.n, list = await this.entries(); if (n !== this.n) return;   // doar ultima actualizare
    const T = (a, b) => this.X.S.T(a, b), el = this.el;
    if (el.empty) el.empty(); else el.replaceChildren(); el.classList.add("tx-toc-live");
    if (!list.length) { el.createDiv({ cls: "tx-toc-empty", text: T("Cuprins: scrie titluri dedesubt.", "Contents: write headings below.") }); return; }
    const ol = el.createEl("ol");
    for (const e of list) {
      const a = ol.createEl("li", { cls: "l" + e.lv }).createEl("a", { text: e.text, href: "#" });
      a.addEventListener("click", ev => { ev.preventDefault(); ev.stopPropagation(); this.go(e.line); });
    }
  }
}


module.exports = {
  Exporter, imageSize, PRESETS,
  async install(S, dir) {
    const X = new Exporter(S, dir), h = S.host, T = (a, b) => S.T(a, b);
    // o singură comandă: nota deschisă; fără una, alegi nota (X.pick; exportul e și în pagina Texere și în meniul din bara de jos)
    const exportActive = () => { const f = S.app.workspace.getActiveFile?.(); if (f instanceof TFile && f.extension === "md") X.open(f); else X.pick(); };
    h.addCommand({ id: "export-note", name: T("Exportă nota…", "Export this note…"), callback: exportActive });
    // cuprinsul în notă: ```cuprins (sau ```contents); comanda îl pune unde e cursorul
    for (const lang of ["cuprins", "contents"]) try { h.registerMarkdownCodeBlockProcessor?.(lang, (src, el, ctx) => ctx.addChild(new TocView(X, src, el, ctx))); } catch (e) { console.warn("Texere Export: blocul " + lang, e); }
    // cuprinsul: din meniul editorului (clic dreapta în notă), nu din paleta de comenzi
    const insertToc = X.insertToc = ed => {
      const c = ed.getCursor(), pre = ed.getLine(c.line).trim() ? "\n\n" : "";
      ed.replaceRange(`${pre}\`\`\`${S.en ? "contents" : "cuprins"}\n\`\`\`\n`, { line: c.line, ch: ed.getLine(c.line).length });
    };
    // meniul „Texere” al notei (shared/notemenu.js): exportul; cuprinsul, doar în notă și doar dacă nu are deja unul; importul unui document din vault
    const nm = require("../shared/notemenu").noteMenu(h.core);
    nm.add("export", ctx => {
      const f = ctx.file, out = [];
      if (f instanceof TFile && f.extension === "md") out.push({ title: T("Exportă nota…", "Export this note…"), icon: "file-output", onClick: () => X.open(f) });
      if (ctx.kind === "editor" && ctx.editor && !/^\s*(```+|~~~+)\s*(cuprins|contents)\b/im.test(ctx.editor.getValue?.() || "")) out.push({ title: T("Pune cuprinsul aici", "Insert the contents here"), icon: "list-ordered", onClick: () => insertToc(ctx.editor) });
      try { out.push(...(h.importer?.menuItems?.(f) || [])); } catch (e) {}
      return out;
    }, 20);
    h.register(() => nm.remove("export"));
    h.addSettingTab(new ExportSettingTab(X));
    return X;
  },
};
