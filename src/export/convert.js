/* Texere · documentele tale în Markdown curat: Word (.docx), PDF, ce lipești din Word/Pages/Google Docs și textul copiat dintr-un PDF.
 * Fără Obsidian aici: același cod îl folosesc importul, lipirea curată și varianta din linia de comandă (convert-cli.js).
 *
 *  docxToMarkdown(buffer)            → { md, images: [{ name, data }], title }
 *  pdfToMarkdown(pdfjs, data)        → { md, title, pages }
 *  htmlToMarkdown(html, DOMParser)   → Markdown (din clipboard: Word, Pages, Google Docs, LibreOffice, pagini web)
 *  cleanPdfText(text)                → textul copiat dintr-un PDF, cu paragrafele refăcute
 *  looksLikePdfText(text), isOfficeHtml(html)
 */
"use strict";

// ——— comune ———
const LIG = { "ﬀ": "ff", "ﬁ": "fi", "ﬂ": "fl", "ﬃ": "ffi", "ﬄ": "ffl", "ﬅ": "st", "ﬆ": "st" };
const fixChars = s => String(s).replace(/[ﬀ-ﬆ]/g, c => LIG[c] || c).replace(/\u00AD(?=\p{L})/gu, "").replace(/\u00A0/g, " ").replace(/[\u200B-\u200D\uFEFF]/g, "");
// română: ş ţ cu sedilă → ș ț cu virgulă (doar dacă textul arată a română)
const roCommas = s => (/[ăâîĂÂÎșțȘȚşţ]/.test(s) && /\b(și|şi|să|că|în|este|pentru)\b/i.test(s) ? s.replace(/ş/g, "ș").replace(/ţ/g, "ț").replace(/Ş/g, "Ș").replace(/Ţ/g, "Ț") : s);
// semnele care ar schimba textul în Markdown
const escMd = s => String(s).split(/(https?:\/\/\S+|www\.\S+)/).map((x, k) => (k % 2 ? x : x.replace(/([\\`*_])/g, "\\$1"))).join("").replace(/\[\[/g, "\\[\\[").replace(/\]\(/g, "\\](").replace(/^(\s*)(#{1,6}\s|>|[-+]\s|\d+[.)]\s)/, (m, a, b) => a + "\\" + b);
// despărțirea în silabe la capăt de rând: „cunoaș-” + „tere” → „cunoaștere”; dar „într-” + „o”, „s-” + „a” rămân cu cratimă
const KEEP_HY = /^(într|dintr|printr|despr|nu|s|n|m|l|i|c|v|ne|te|mi|ți|să|şi|și|de|pe)$/i;
function joinLines(a, b) {
  if (!a) return b; if (!b) return a;
  if (/\u00AD\s*$/.test(a)) return a.replace(/\u00AD\s*$/, "") + b;   // cratima „moale” de la capăt de rând
  if (/(https?:\/\/|doi\.org\/|www\.)\S*[\/._\-=?&#]$/i.test(a) && /^[\w%~/.\-=?&#]+/.test(b)) return a + b;   // un link rupt la capăt de rând
  if (/(https?:\/\/|www\.)\S+$/i.test(a) && !/[.,;)]$/.test(a) && /^[^\s]*(\\?_|\/|%|=)/.test(b)) return a + b;
  const m = /([\p{L}]+)[-‐]$/u.exec(a);
  if (m && /^\p{Ll}/u.test(b)) {
    const next = (/^[\p{L}]+/u.exec(b) || [""])[0];
    if (KEEP_HY.test(m[1]) || next.length <= 2) return a + b;   // cratimă adevărată
    return a.slice(0, -1) + b;
  }
  return a + " " + b;
}
const tidy = s => s.replace(/[ \t]+/g, " ").replace(/ +([,.;:!?»”)\]])/g, "$1").replace(/([«„“(\[]) +/g, "$1").trim();

// ——— ZIP (fișierele .docx sunt arhive): doar citire, cu zlib din Node (Obsidian desktop) ———
function unzip(buf) {
  const zlib = require("zlib"), b = Buffer.from(buf), out = new Map();
  let e = b.length - 22; while (e >= 0 && b.readUInt32LE(e) !== 0x06054b50) e--;
  if (e < 0) throw new Error("not a zip");
  const n = b.readUInt16LE(e + 10); let p = b.readUInt32LE(e + 16);
  for (let i = 0; i < n; i++) {
    if (b.readUInt32LE(p) !== 0x02014b50) break;
    const method = b.readUInt16LE(p + 10), csize = b.readUInt32LE(p + 20), nl = b.readUInt16LE(p + 28), xl = b.readUInt16LE(p + 30), cl = b.readUInt16LE(p + 32), off = b.readUInt32LE(p + 42);
    const name = b.toString("utf8", p + 46, p + 46 + nl);
    const lnl = b.readUInt16LE(off + 26), lxl = b.readUInt16LE(off + 28), start = off + 30 + lnl + lxl, raw = b.subarray(start, start + csize);
    out.set(name, method === 8 ? zlib.inflateRawSync(raw) : method === 0 ? raw : null);
    p += 46 + nl + xl + cl;
  }
  return out;
}

// ——— XML mic (Word scrie XML curat): { n: nume, a: atribute, c: copii } sau text ———
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const unent = s => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENT[e] ?? m);
function xml(s) {
  const root = { n: "#root", a: {}, c: [] }, st = [root], re = /<!\[CDATA\[([\s\S]*?)\]\]>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<(\/?)([\w:.-]+)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(s))) {
    const top = st[st.length - 1];
    if (m[1] != null) top.c.push(m[1]);
    else if (m[3]) {
      if (m[2]) { st.pop(); continue; }
      const el = { n: m[3], a: {}, c: [] }; let am; const ar = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
      while ((am = ar.exec(m[4] || ""))) el.a[am[1]] = unent(am[2] ?? am[3] ?? "");
      top.c.push(el); if (!m[5]) st.push(el);
    } else if (m[6] != null && st.length > 1) top.c.push(unent(m[6]));
  }
  return root;
}
const kids = (el, name) => (el?.c || []).filter(x => typeof x === "object" && (!name || x.n === name));
const kid = (el, name) => (el?.c || []).find(x => typeof x === "object" && x.n === name) || null;
const find = (el, name, out = []) => { for (const x of el?.c || []) if (typeof x === "object") { if (x.n === name) out.push(x); find(x, name, out); } return out; };
const on = el => !!el && !/^(0|false|off|none)$/i.test(el.a["w:val"] ?? "1");

// ——— Word (.docx) → Markdown ———
function docxToMarkdown(buffer, opts = {}) {
  const z = unzip(buffer), txt = p => (z.get(p) ? z.get(p).toString("utf8") : "");
  const doc = xml(txt("word/document.xml")), body = find(doc, "w:body")[0];
  if (!body) throw new Error("no word/document.xml");
  // stilurile: titlurile (heading 1…, Title) și cele cu liste
  const styles = {}, sx = xml(txt("word/styles.xml"));
  for (const s of find(sx, "w:style")) {
    const id = s.a["w:styleId"], name = (kid(s, "w:name")?.a["w:val"] || "").toLowerCase(), ppr = kid(s, "w:pPr");
    const ol = kid(ppr, "w:outlineLvl"), np = kid(ppr, "w:numPr"), based = kid(s, "w:basedOn")?.a["w:val"];
    let h = 0; const hm = /^(heading|titlu|überschrift|titre)\s*(\d)$/.exec(name); if (hm) h = +hm[2]; else if (name === "title") h = -1; else if (ol) h = +ol.a["w:val"] + 1;
    styles[id] = { name, h, based, num: np ? { id: kid(np, "w:numId")?.a["w:val"], lvl: +(kid(np, "w:ilvl")?.a["w:val"] || 0) } : null };
  }
  const styleOf = id => { let s = styles[id], k = 0; const r = { h: 0, num: null }; while (s && k++ < 10) { if (!r.h && s.h) r.h = s.h; if (!r.num && s.num) r.num = s.num; s = styles[s.based]; } return r; };
  // listele: numId → nivel → cu buline sau numerotată
  const nums = {}, abs = {}, nx = xml(txt("word/numbering.xml"));
  for (const a of find(nx, "w:abstractNum")) abs[a.a["w:abstractNumId"]] = Object.fromEntries(kids(a, "w:lvl").map(l => [l.a["w:ilvl"], kid(l, "w:numFmt")?.a["w:val"] || "bullet"]));
  for (const n of find(nx, "w:num")) nums[n.a["w:numId"]] = abs[kid(n, "w:abstractNumId")?.a["w:val"]] || {};
  // legăturile și imaginile
  const rels = {}; for (const r of find(xml(txt("word/_rels/document.xml.rels")), "Relationship")) rels[r.a.Id] = r.a;
  const images = [], imgName = new Map();
  const image = rid => {
    const t = rels[rid]?.Target; if (!t) return "";
    const path = "word/" + t.replace(/^\/?word\//, "").replace(/^\.\//, ""), data = z.get(path); if (!data) return "";
    if (!imgName.has(path)) { const base = (opts.imagePrefix || "image") + "-" + (images.length + 1) + (/\.\w+$/.exec(t)?.[0] || ".png"); imgName.set(path, base); images.push({ name: base, data }); }
    return `![[${imgName.get(path)}]]`;
  };
  const anyHeading = Object.values(styles).some(s => s.h) && find(body, "w:pStyle").some(p => styleOf(p.a["w:val"]).h);
  // textul unei bucăți de paragraf, cu bold/italic; notele de subsol → [^n]
  const runs = (el, segs, link) => {
    for (const x of el.c || []) {
      if (typeof x !== "object") continue;
      if (x.n === "w:r") {
        const rp = kid(x, "w:rPr"), f = { b: on(kid(rp, "w:b")), i: on(kid(rp, "w:i")), s: on(kid(rp, "w:strike")), link };
        if (kid(rp, "w:vanish")) continue;
        for (const y of x.c || []) {
          if (typeof y !== "object") continue;
          if (y.n === "w:t") segs.push({ ...f, t: y.c.filter(c => typeof c === "string").join("") });
          else if (y.n === "w:tab") segs.push({ ...f, t: " " });
          else if (y.n === "w:br" || y.n === "w:cr") segs.push({ ...f, t: y.a["w:type"] === "page" ? " " : "\n" });
          else if (y.n === "w:noBreakHyphen") segs.push({ ...f, t: "-" });
          else if (y.n === "w:sym") segs.push({ ...f, t: y.a["w:char"] ? String.fromCharCode(parseInt(y.a["w:char"], 16) & 0xffff) : "" });
          else if (y.n === "w:footnoteReference") segs.push({ raw: `[^${y.a["w:id"]}]` });
          else if (y.n === "w:endnoteReference") segs.push({ raw: `[^e${y.a["w:id"]}]` });
          else if (y.n === "w:drawing" || y.n === "w:pict") { const bl = find(y, "a:blip")[0] || find(y, "v:imagedata")[0]; const rid = bl?.a["r:embed"] || bl?.a["r:id"]; if (rid) segs.push({ raw: image(rid) }); }
        }
      } else if (x.n === "w:hyperlink") { const url = x.a["r:id"] ? rels[x.a["r:id"]]?.Target : null; runs(x, segs, url || link); }
      else if (/^w:(smartTag|ins|sdt|sdtContent|fldSimple|customXml|bdo|dir)$/.test(x.n)) runs(x, segs, link);
    }
    return segs;
  };
  // bucățile cu același format se unesc; spațiile ies din afara semnelor (**text** , nu ** text**)
  const render = segs => {
    let out = "", cur = null, buf = "";
    const flush = () => { if (!buf) return; let t = escMd(roCommas(fixChars(buf))); if (cur && (cur.b || cur.i || cur.s) && t.trim()) { const mk = (cur.s ? "~~" : "") + (cur.b ? "**" : "") + (cur.i ? "*" : ""); const lead = /^\s*/.exec(t)[0], trail = /\s*$/.exec(t)[0]; t = lead + mk + t.trim() + [...mk].reverse().join("") + trail; } if (cur?.link && t.trim()) t = `[${t.trim()}](${cur.link})`; out += t; buf = ""; };
    for (const s of segs) {
      if (s.raw != null) { flush(); cur = null; out += s.raw; continue; }
      const same = cur && cur.b === s.b && cur.i === s.i && cur.s === s.s && cur.link === s.link;
      if (!same) { flush(); cur = s; }
      buf += s.t;
    }
    flush();
    return out.replace(/[ \t]+\n/g, "\n").replace(/ {2,}/g, " ").trim();
  };
  const paraText = p => render(runs(p, []));
  const blocks = [];
  const para = p => {
    const ppr = kid(p, "w:pPr"), sid = kid(ppr, "w:pStyle")?.a["w:val"], st = styleOf(sid), segs = runs(p, []);
    let text = render(segs); if (!text) return;
    const ol = kid(ppr, "w:outlineLvl"); let h = st.h || (ol ? +ol.a["w:val"] + 1 : 0);
    if (h === -1) h = 1;
    const np = kid(ppr, "w:numPr") ? { id: kid(kid(ppr, "w:numPr"), "w:numId")?.a["w:val"], lvl: +(kid(kid(ppr, "w:numPr"), "w:ilvl")?.a["w:val"] || 0) } : st.num;
    // fără stiluri de titlu în document: un paragraf scurt, tot îngroșat, fără punct la final = un titlu
    const plain = segs.filter(s => s.t && s.t.trim());
    if (!h && !anyHeading && plain.length && plain.every(s => s.b) && text.split(/\s+/).length <= 12 && !/[.,;:]$/.test(text.replace(/\*+$/, ""))) { h = 2; text = text.replace(/\*\*/g, ""); }
    if (h) { blocks.push({ k: "h", t: "#".repeat(Math.min(6, h)) + " " + text.replace(/^\*\*(.*)\*\*$/, "$1") }); return; }
    if (np && np.id && np.id !== "0") { const fmt = (nums[np.id] || {})[String(np.lvl)] || "bullet"; blocks.push({ k: "li", t: "    ".repeat(np.lvl) + (fmt === "bullet" || fmt === "none" ? "- " : "1. ") + text }); return; }
    blocks.push({ k: "p", t: text });
  };
  const table = tb => {
    const rows = kids(tb, "w:tr").map(tr => kids(tr, "w:tc").map(tc => kids(tc, "w:p").map(paraText).filter(Boolean).join("<br>").replace(/\|/g, "\\|")));
    if (!rows.length) return; const w = Math.max(...rows.map(r => r.length)); const fill = r => [...r, ...Array(w - r.length).fill("")];
    blocks.push({ k: "t", t: [fill(rows[0]), Array(w).fill("---"), ...rows.slice(1).map(fill)].map(r => "| " + r.join(" | ") + " |").join("\n") });
  };
  const walk = el => { for (const x of el.c || []) { if (typeof x !== "object") continue; if (x.n === "w:p") para(x); else if (x.n === "w:tbl") table(x); else if (/^w:(sdt|sdtContent|customXml)$/.test(x.n)) walk(x); } };
  walk(body);
  // notele de subsol și de final
  const notes = [];
  for (const [file, pre] of [["word/footnotes.xml", ""], ["word/endnotes.xml", "e"]]) {
    for (const fn of find(xml(txt(file)), pre ? "w:endnote" : "w:footnote")) {
      const id = fn.a["w:id"]; if (fn.a["w:type"] || +id <= 0) continue;
      const t = kids(fn, "w:p").map(paraText).filter(Boolean).join(" ").replace(/^\s*\d+\s*/, "").trim(); if (t) notes.push(`[^${pre}${id}]: ${t}`);
    }
  }
  let md = "";
  for (let i = 0; i < blocks.length; i++) { const b = blocks[i], prev = blocks[i - 1]; md += i ? (b.k === "li" && prev.k === "li" ? "\n" : "\n\n") : ""; md += b.t; }
  if (notes.length) md += "\n\n" + notes.join("\n");
  md = renumberNotes(md);
  const title = (blocks.find(b => b.k === "h")?.t || "").replace(/^#+\s*/, "").replace(/[*_\\]/g, "") || null;
  return { md: md.trim() + "\n", images, title };
}

// notele numerotate 1, 2, 3… în ordinea în care apar în text (Word le ține cu numerele lui interne)
function renumberNotes(md) {
  const map = new Map(); let k = 0;
  const body = md.replace(/^\[\^[^\]]+\]:.*$/gm, "");
  for (const m of body.matchAll(/\[\^([^\]]+)\]/g)) if (!map.has(m[1])) map.set(m[1], String(++k));
  return md.replace(/\[\^([^\]]+)\]/g, (x, id) => (map.has(id) ? `[^${map.get(id)}]` : x));
}

// ——— PDF → Markdown (cu pdf.js) ———
// Pe pagini: rândurile (bucățile de text la aceeași înălțime), cu bold/italic după numele fontului.
// Titlurile: din cuprinsul PDF-ului (semnele de carte puse de Word la export), altfel după mărimea literei.
// Cuprinsul din document devine blocul Texere ```contents``` (se refăcea singur în notă și la export).
// Fără antete, subsoluri și numere de pagină; paragrafele refăcute (și peste pagini); bibliografia, o intrare pe paragraf
// (rândurile de continuare sunt indentate); notele de subsol ca [^n].
const escIn = s => String(s).split(/(https?:\/\/\S+|www\.\S+)/).map((x, k) => (k % 2 ? x : escIn0(x))).join("");
const escIn0 = s => String(s).replace(/([\\`*_])/g, "\\$1").replace(/\[\[/g, "\\[\\[").replace(/\]\(/g, "\\](");
const normT = s => String(s || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/\[\^\d+\]/g, "").replace(/[^\p{L}\p{N}]+/gu, "");
const REFS = /^(references|bibliography|bibliografie|referin[țţt]e( bibliografice)?|works cited|literature cited|surse|sources)\b/i;
const TOCH = /^(table of contents|contents|cuprins|sumar|index of contents)$/i;
async function outlineFlat(doc) {
  const out = []; let items = null; try { items = await doc.getOutline(); } catch (e) { return out; }
  const walk = async (list, depth) => {
    for (const it of list || []) {
      try { let d = it.dest; if (typeof d === "string") d = await doc.getDestination(d);
        if (Array.isArray(d) && d[0] != null) { const idx = typeof d[0] === "object" ? await doc.getPageIndex(d[0]) : Number(d[0]); const t = String(it.title || "").replace(/[\u200B-\u200D\uFEFF]/g, "").trim(); if (Number.isFinite(idx) && t) out.push({ title: t, depth, page: idx + 1, n: normT(t) }); } } catch (e) {}
      if (it.items?.length) await walk(it.items, depth + 1);
    }
  };
  await walk(items, 0); return out;
}
async function pdfToMarkdown(pdfjs, data, opts = {}) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data), isEvalSupported: false }).promise;
  const pages = []; let outline = [];
  try {
    outline = await outlineFlat(doc);
    const N = Math.min(doc.numPages, opts.maxPages || 2000);
    for (let p = 1; p <= N; p++) {
      const page = await doc.getPage(p);
      try {
        const v = page.view, top = Math.max(v[1], v[3]), bottom = Math.min(v[1], v[3]), left = Math.min(v[0], v[2]), right = Math.max(v[0], v[2]);
        try { await page.getOperatorList(); } catch (e) {}   // încarcă fonturile: numele lor spune bold/italic
        const fontOf = id => { try { const f = page.commonObjs.get(id); return f ? { b: !!(f.bold || f.black || /bold|black|heavy|semibold|demi/i.test(f.name || "")), i: !!(f.italic || /italic|oblique/i.test(f.name || "")) } : {}; } catch (e) { return {}; } };
        const fcache = new Map(), tc = await page.getTextContent(), items = [];
        for (const it of tc.items) {
          if (typeof it.str !== "string" || !it.transform) continue; const [a, b, , d, e, f] = it.transform; const size = Math.hypot(a, b) || Math.abs(d) || it.height || 10;
          const s = fixChars(it.str); if (!s.trim()) continue;
          if (!fcache.has(it.fontName)) fcache.set(it.fontName, fontOf(it.fontName));
          items.push({ s, x: e, y: f, w: it.width || 0, size, ...fcache.get(it.fontName) });
        }
        const lines = [];   // în ordinea din PDF (literele dintr-un font de rezervă pot avea poziții ciudate)
        for (const it of items) {
          const L = lines.find(l => Math.abs(l.base - it.y) <= Math.max(l.size, it.size) * 0.5);
          if (L) { L.items.push(it); if (it.size >= L.size * 0.85) L.size = Math.max(L.size, it.size); } else lines.push({ base: it.y, size: it.size, items: [it] });
        }
        lines.sort((a, b) => b.base - a.base);
        for (const L of lines) {
          if (L.items.some((it, k) => k && it.x < L.items[k - 1].x - Math.max(20, it.size * 3))) L.items.sort((a, b) => a.x - b.x);
          const big = Math.max(...L.items.map(i => i.size)), cs = []; for (const it of L.items) for (let k = 0; k < it.s.length; k++) cs.push(it.size); cs.sort((a, b) => a - b); L.msize = cs[Math.floor(cs.length / 2)] || L.size;
          // bucățile rândului: textul, cu stilul lor; un număr mic, ridicat = trimitere la o notă de subsol
          const segs = []; let end = null, last = null;
          for (const it of L.items) {
            let s = it.s, raw = false;
            if (it.size < big * 0.8 && /^\s*\d{1,3}\s*$/.test(s) && it.y > L.base + big * 0.15) { s = `[^${s.trim()}]`; raw = true; }
            if (!raw && last && last.w > 0 && s.trim().length <= 2 && it.x < last.x + last.w - 1 && it.x > last.x && !last.raw) {   // literă din font de rezervă, peste golul din cuvânt
              const seg = last.seg, at = Math.round((it.x - last.x) / last.w * last.s.length); let j = -1;
              for (let dd = 0; dd <= 2 && j < 0; dd++) for (const q of [at + dd, at - dd]) if (q >= 0 && q < seg.t.length && seg.t[q] === " ") { j = q; break; }
              if (j >= 0) { seg.t = seg.t.slice(0, j) + s.trim() + seg.t.slice(j + 1); continue; }
            }
            if (end != null && it.x - end > big * 0.15 && segs.length && !/\s$/.test(segs[segs.length - 1].t) && !/^\s/.test(s)) segs.push({ t: " ", b: it.b, i: it.i });
            const seg = { t: s, b: !!it.b, i: !!it.i, raw }; segs.push(seg); last = { x: it.x, w: it.w, s, seg, raw }; end = it.x + it.w;
          }
          L.plain = tidy(segs.map(x => x.t).join(""));
          const letters = segs.filter(x => !x.raw && /\p{L}/u.test(x.t));
          L.bold = letters.length > 0 && letters.every(x => x.b); L.ital = letters.length > 0 && letters.every(x => x.i);
          // textul cu bold/italic (bucățile cu același stil împreună; spațiile ies din afara semnelor)
          let txt = "", cur = null, buf = "";
          const flush = () => { if (!buf) return; let t = cur?.raw ? buf : escIn(buf); if (cur && !cur.raw && (cur.b || cur.i) && t.trim() && !L.bold) { const mk = (cur.b ? "**" : "") + (cur.i ? "*" : ""); t = /^\s*/.exec(t)[0] + mk + t.trim() + mk + /\s*$/.exec(t)[0]; } else if (cur && !cur.raw && cur.i && t.trim() && L.bold) t = /^\s*/.exec(t)[0] + "*" + t.trim() + "*" + /\s*$/.exec(t)[0]; txt += t; buf = ""; };
          for (const sg of segs) { const same = cur && cur.b === sg.b && cur.i === sg.i && !!cur.raw === !!sg.raw && !sg.raw; if (!same || /^\s+$/.test(sg.t)) { if (/^\s+$/.test(sg.t) && cur && !cur.raw) { buf += sg.t; continue; } flush(); cur = sg; } buf += sg.t; }
          flush();
          L.text = tidy(txt); L.x0 = L.items[0].x; L.x1 = Math.max(...L.items.map(i => i.x + i.w)); L.page = p;
          L.zone = L.base > top - (top - bottom) * 0.09 ? "head" : L.base < bottom + (top - bottom) * 0.08 ? "foot" : "body";
        }
        pages.push({ p, lines: lines.filter(l => l.plain), left, right, width: right - left });
      } finally { try { page.cleanup(); } catch (e) {} }
    }
  } finally { try { await doc.destroy(); } catch (e) {} }
  // antetele și subsolurile care se repetă și numerele de pagină
  const key = t => t.toLowerCase().replace(/[\d\s.,|–—-]+/g, "");
  const rep = new Map(); for (const pg of pages) for (const k of new Set(pg.lines.filter(l => l.zone !== "body").map(l => key(l.plain)))) if (k) rep.set(k, (rep.get(k) || 0) + 1);
  const minRep = Math.max(3, Math.ceil(pages.length * 0.25));
  const sz0 = []; for (const pg of pages) for (const l of pg.lines) if (l.zone === "body") sz0.push(l.msize); sz0.sort((a, b) => a - b); const body0 = sz0.length ? sz0[Math.floor(sz0.length / 2)] : 10;
  const outlineN = new Set(outline.map(o => o.n));
  const near = (k, n) => { for (const [x] of rep) if (x !== k && x.length >= 4 && k.length >= 4 && x.slice(0, 5) === k.slice(0, 5)) n += rep.get(x); return n; };
  for (const pg of pages) {
    const bodyL = pg.lines.filter(l => l.zone === "body"), hi = bodyL.length ? Math.max(...bodyL.map(l => l.base)) : -1e9, lo = bodyL.length ? Math.min(...bodyL.map(l => l.base)) : 1e9;
    pg.lines = pg.lines.filter(l => {
      if (l.zone === "body") return true;
      if (pg.p === 1 && /^(19|20)\d\d$/.test(l.plain.trim())) return true;   // anul de pe copertă
      const k = key(l.plain); if (/^[\divxlcdm\s.\-–—|/]+$/i.test(l.plain) || (k && near(k, rep.get(k) || 0) >= minRep)) return false;
      if (l.bold || l.msize > body0 * 1.05 || outlineN.has(normT(l.plain))) return true;   // un titlu sus pe pagină nu e antet
      if (pages.length < 3) return true;
      const isolated = l.zone === "head" ? l.base - hi > l.size * 2 : lo - l.base > l.size * 2;
      return !(isolated && l.plain.split(/\s+/).length <= 6 && !/[.!?]$/.test(l.plain) && !/\[\^\d+\]/.test(l.text));
    });
  }
  const sizes = []; for (const pg of pages) for (const l of pg.lines) for (let k = 0; k < Math.min(l.plain.length, 200); k += 10) sizes.push(Math.round(l.size * 2) / 2);
  sizes.sort((a, b) => a - b); const body = sizes.length ? sizes[Math.floor(sizes.length / 2)] : 10;
  // româna: după cuvintele obișnuite și diacritice, nu după un singur nume („Vică”) dintr-o lucrare în engleză
  const head5 = pages.slice(0, 5).map(pg => pg.lines.map(l => l.plain).join(" ")).join(" ").toLowerCase(), w5 = head5.match(/\p{L}+/gu) || [];
  const roW = w5.filter(w => /[ăâîșțşţ]/.test(w) || /^(și|si|în|cu|pe|la|din|care|este|sunt|nu|mai|sau|pentru|această|acest|despre|prin)$/.test(w)).length;
  const enW = w5.filter(w => /^(the|and|of|to|in|is|are|that|this|for|with|which|by|as|on|not|or)$/.test(w)).length;
  const ro = roW > enW;
  // ——— titlurile ———
  const head = new Map();   // rândul → nivelul (1–6)
  const tocPages = new Set();
  const useOutline = outline.filter(o => o.n.length >= 2).length >= 3;
  if (useOutline) {
    for (const o of outline) {
      if (o.n.length < 2) continue;
      for (const pn of [o.page, o.page + 1]) {
        const pg = pages[pn - 1]; if (!pg) continue; let hit = false;
        for (let i = 0; i < pg.lines.length && !hit; i++) {
          const a = normT(pg.lines[i].plain), b = i + 1 < pg.lines.length ? a + normT(pg.lines[i + 1].plain) : null;
          const ok = s => s && (s === o.n || (s.startsWith(o.n) && /^\d{0,3}$/.test(s.slice(o.n.length))) || (o.n.startsWith(s) && s.length >= 4 && /^\d{1,3}$/.test(o.n.slice(s.length))));   // „Oath1”: nota de subsol e și în semnul de carte
          if (ok(a) && !head.has(pg.lines[i])) { head.set(pg.lines[i], o); hit = true; }
          else if (ok(b) && !head.has(pg.lines[i])) { head.set(pg.lines[i], o); pg.lines[i + 1].join = true; hit = true; }
        }
        if (hit) { if (TOCH.test(o.title.trim())) tocPages.add(pn); break; }
      }
    }
  }
  // cuprinsul din document, și fără semne de carte: o pagină cu multe rânduri care se termină cu numărul paginii
  for (const pg of pages.slice(0, Math.min(pages.length, 15))) {
    const numEnd = pg.lines.filter(l => /\S\s*(\.{2,}|…|\s)\s*\d{1,3}$/.test(l.plain) && l.zone === "body").length;
    if (numEnd >= 6 && numEnd >= pg.lines.filter(l => l.zone === "body").length * 0.6) tocPages.add(pg.p);
  }
  // titlul documentului: cel mai mare rând de pe prima pagină
  const first = pages[0]; let titleLine = null;
  if (first) { const cand = first.lines.filter(l => l.msize >= body * 1.25); if (cand.length) titleLine = cand.reduce((x, y) => (y.msize > x.msize ? y : x)); }
  const isHead = l => (l.msize || l.size) >= body * 1.1 && l.plain.split(/\s+/).length <= 14 && !/[,;-]$/.test(l.plain);
  const hs = [...new Set(pages.flatMap(pg => pg.lines.filter(isHead).map(l => Math.round(l.msize || l.size))))].sort((a, b) => b - a).slice(0, 3);
  const capsHead = (l, prevL) => { const lt = l.plain.replace(/[^\p{L}]/gu, ""); return lt.length >= 4 && lt === lt.toUpperCase() && lt !== lt.toLowerCase() && l.plain.split(/\s+/).length <= 8 && !/[.,;:]$/.test(l.plain) && (!prevL || prevL.page !== l.page || prevL.base - l.base > l.size * 2); };
  const levelOf = (l, prevL) => {
    if (l === titleLine) return 1;
    if (useOutline) { const o = head.get(l); if (!o) return 0; if (titleLine && o.page === titleLine.page) return 0; return Math.min(6, o.depth + 2); }
    if (isHead(l)) { const i = hs.indexOf(Math.round(l.msize || l.size)); if (i >= 0) return i + 1; }
    return capsHead(l, prevL) ? Math.min(6, hs.length + 1) : 0;
  };
  // ——— paragrafele ———
  const xs = new Map(); for (const pg of pages) for (const l of pg.lines) if (l.zone === "body") { const k = Math.round(l.x0); xs.set(k, (xs.get(k) || 0) + 1); }
  const docLeft = xs.size ? +[...xs].sort((a, b) => b[1] - a[1])[0][0] : 0;   // marginea din stânga a textului
  const out = [], notes = []; let para = null, prev = null, refs = false;
  const endPara = () => { if (para != null) { const t = tidy(para); if (t && !/^\d{1,3}$/.test(t)) out.push(t); } para = null; };
  for (const pg of pages) {
    const ls = pg.lines; let fnStart = ls.length;
    for (let i = ls.length - 1; i >= 0; i--) { const l = ls[i]; if (l.size > body * 0.92) break; if (/^(\[\^)?\d{1,3}(\])?[\s.)]/.test(l.plain) || /^\[\^\d+\]/.test(l.plain)) fnStart = i; }
    if (fnStart < ls.length && ls.slice(fnStart).every(l => l.size <= body * 0.92)) {
      let cur = null;
      for (const l of ls.slice(fnStart)) { const m = /^(?:\\?\[\^)?(\d{1,3})(?:\\?\])?[\s.)]+(.*)$/.exec(l.text); if (m) { if (cur) notes.push(cur); cur = { n: m[1], t: m[2] }; } else if (cur) cur.t = joinLines(cur.t, l.text); }
      if (cur) notes.push(cur);
    }
    let body0 = ls.slice(0, fnStart); const mid = pg.left + pg.width / 2;
    const Lc = body0.filter(l => l.x1 < mid - 6).length, Rc = body0.filter(l => l.x0 > mid + 6).length;
    if (Lc >= 6 && Rc >= 6 && Lc + Rc >= body0.length * 0.7) body0 = [...body0.filter(l => l.x0 <= mid + 6), ...body0.filter(l => l.x0 > mid + 6)];
    if (!body0.length) continue;
    const colLeft = Math.min(...body0.map(l => l.x0)), colRight = Math.max(...body0.map(l => l.x1)), width = colRight - colLeft;
    const toc = tocPages.has(pg.p);
    for (let i = 0; i < body0.length; i++) {
      const l = body0[i]; if (l.join) continue;
      const h = levelOf(l, i ? body0[i - 1] : null);
      if (toc && !h) continue;   // rândurile cuprinsului: le face blocul ```contents```
      if (h) {
        endPara();
        let t = (l.join === undefined && body0[i + 1]?.join ? l.text + " " + body0[i + 1].text : l.text).replace(/\*+/g, "").replace(/\\\[\^/g, "[^").trim();
        t = t.replace(/(\S)(\[\^\d+\])/g, "$1$2");
        out.push("#".repeat(h) + " " + t); refs = REFS.test(l.plain);
        if (toc) out.push("```" + (ro ? "cuprins" : "contents") + "\n```");
        prev = l; continue;
      }
      if (para != null && prev) {
        const samePage = prev.page === l.page, lineH = l.size * 1.2, gap = samePage ? prev.base - l.base : null;
        const bullet = /^([•·▪◦–—-]|\d{1,2}[.)]|\[[ivx]+\])\s/.test(l.plain);
        let brk;
        if (refs) brk = l.x0 <= colLeft + l.size * 0.6 || (gap != null && gap > lineH * 1.6);   // bibliografia: o intrare începe la margine; continuarea e indentată
        else {
          const indent = l.x0 > (samePage ? prev.x0 : colLeft) + l.size * 1.2 && l.x0 < colLeft + width / 3;
          const ends = /[.!?:]["”»')\]]*$/.test(prev.plain);   // sfârșit de frază (nu „humans,”)
          const shortPrev = samePage ? (prev.x1 < colLeft + width * 0.6 || (ends && prev.x1 < colRight - Math.max(prev.size * 4, width * 0.2))) : (ends || prev.x1 < (prev.colRight || colRight) - prev.size * 4);
          const newIndented = l.x0 > docLeft + l.size * 1.2 && Math.abs(l.x0 - prev.x0) < 2 && ends && prev.x1 < colRight - prev.size * 2;   // două paragrafe de un rând, cu primul rând indentat
          const centered = samePage && l.x0 > colLeft + width * 0.15 && prev.x0 > colLeft + width * 0.15 && Math.abs((l.x0 + l.x1) - (prev.x0 + prev.x1)) < l.size * 3 && Math.abs(l.x0 - prev.x0) > 2;   // rânduri centrate (copertă)
          brk = (gap != null && gap > lineH * 1.6) || indent || shortPrev || bullet || newIndented || centered;
        }
        if (brk) endPara();
      }
      para = para != null ? joinLines(para, l.text) : l.text; prev = l; l.colRight = colRight;
    }
    if (prev) prev.colRight = colRight;
  }
  endPara();
  const items = out.map(x => (x.startsWith("#") || x.startsWith("```") ? x : x.replace(/^([•·▪◦])\s+/, "- ").replace(/^[–—]\s+/, "    - ")));
  let md = items.map((x, i) => (i ? (/^\s*(-|\d+[.)])\s/.test(x) && /^\s*(-|\d+[.)])\s/.test(items[i - 1]) ? "\n" : "\n\n") : "") + x).join("");
  // un stil întrerupt doar de un capăt de rând se unește: *titlul* *continuă* → *titlul continuă*
  md = md.replace(/([^*\s])(\*{1,3}) \2(?=[^*\s])/g, "$1 ");
  if (notes.length) { const seen = new Set(); md += "\n\n" + notes.filter(n => !seen.has(n.n) && seen.add(n.n)).map(n => `[^${n.n}]: ${tidy(n.t)}`).join("\n"); }
  md = roCommas(md).replace(/\u00AD/g, "").replace(/(https?:\/\/[^\s)>\]]+)/g, u => u.replace(/\\([_*`])/g, "$1"));   // linkurile, fără semne de escape
  const title = titleLine ? titleLine.plain : null;
  return { md: md.trim() + "\n", title, pages: pages.length };
}

// ——— textul copiat dintr-un PDF (din clipboard) ———
function looksLikePdfText(text) {
  const s = String(text || "").replace(/\r\n?/g, "\n"); if (s.length < 80) return /[ﬀ-ﬆ\u00AD]/.test(s);
  const L = s.split("\n").filter(l => l.trim()); if (L.length < 3) return false;
  // text cu structură de Markdown (liste, titluri, citate, tabele, linkuri): e din note, nu dintr-un PDF
  if (L.filter(l => /^\s*([-*+]\s|\d+[.)]\s|#{1,6}\s|>|\||```)/.test(l) || /\[\[|\]\(/.test(l)).length >= Math.max(1, L.length * 0.3)) return false;
  const blanks = s.split("\n").filter(l => !l.trim()).length;
  const mid = L.filter((l, i) => i < L.length - 1 && !/[.!?:;»”"')\]]\s*$/.test(l)).length / (L.length - 1);
  const hy = L.filter((l, i) => i < L.length - 1 && /\p{L}[-‐]$/u.test(l.trim()) && /^\s*\p{Ll}/u.test(L[i + 1])).length;
  const lens = L.map(l => l.length).sort((a, b) => a - b), med = lens[Math.floor(lens.length / 2)];
  return /[ﬀ-ﬆ\u00AD]/.test(s) || hy > 0 || (mid >= 0.5 && med >= 25 && med <= 130 && blanks <= L.length * 0.5);
}
function cleanPdfText(text) {
  const raw = fixChars(String(text || "").replace(/\r\n?/g, "\n")).split("\n").map(l => l.replace(/\s+$/, ""));
  const L = raw.filter(l => !/^\s*\d{1,4}\s*$/.test(l));   // numerele de pagină singure pe rând
  const max = Math.max(...L.map(l => l.trim().length), 1), out = []; let para = "";
  for (let i = 0; i < L.length; i++) {
    const l = L[i].trim();
    if (!l) { if (para) out.push(tidy(para)); para = ""; continue; }
    if (para) {
      const prev = L[i - 1]?.trim() || "", bullet = /^([•·▪◦–—-]|\d{1,2}[.)])\s/.test(l);
      if (bullet || (/[.!?:»”"')]$/.test(prev) && prev.length < max * 0.8)) { out.push(tidy(para)); para = ""; }
    }
    para = para ? joinLines(para, l) : l;
  }
  if (para) out.push(tidy(para));
  return roCommas(out.map(x => x.replace(/^([•·▪◦])\s+/, "- ")).join("\n\n"));
}

// ——— HTML din clipboard → Markdown ———
const isOfficeHtml = html => /urn:schemas-microsoft-com:office:word|content="?Microsoft Word|mso-|class="?Mso|docs-internal-guid|Cocoa HTML Writer|content="?LibreOffice|content="?OpenOffice|<meta[^>]+Pages/i.test(String(html || ""));
function htmlToMarkdown(html, DOMParserCtor) {
  const DP = DOMParserCtor || (typeof DOMParser !== "undefined" ? DOMParser : null); if (!DP) throw new Error("DOMParser missing");
  let src = String(html || "").replace(/<!--\[if[\s\S]*?<!\[endif\]-->/gi, "").replace(/<!\[if !supportLists\]>|<!\[endif\]>/gi, "").replace(/<o:p>[\s\S]*?<\/o:p>/gi, "");
  const d = new DP().parseFromString(src, "text/html"), root = d.body || d.documentElement;
  root.querySelectorAll("style,script,xml,meta,link,title,head").forEach(e => e.remove());
  // notele de subsol din Word: corpul lor (div mso-element:footnote) și trimiterile (a href="#_ftn1")
  const notes = [];
  root.querySelectorAll("div[style*='mso-element:footnote'],div[id^='ftn'],div[id^='edn']").forEach(div => {
    if (/footnote-list|endnote-list/.test(div.getAttribute("style") || "")) return;
    const id = (div.id || "").replace(/^\D*/, ""); const a = div.querySelector("a[href*='_ftnref'],a[href*='_ednref']"); if (a) a.remove();
    const t = (div.textContent || "").replace(/\s+/g, " ").replace(/^\s*\[?\d+\]?\s*/, "").trim(); if (id && t) notes.push(`[^${id}]: ${t}`); div.remove();
  });
  root.querySelectorAll("div[style*='mso-element:footnote-list'],div[style*='mso-element:endnote-list']").forEach(e => e.remove());
  const isBold = el => { const tg = el.tagName; if (tg === "B" || tg === "STRONG") { const fw = el.style?.fontWeight; return !(fw && /^(normal|[1-5]00)$/.test(fw)); } const fw = el.style?.fontWeight; return !!fw && (fw === "bold" || +fw >= 600); };
  const isItal = el => el.tagName === "I" || el.tagName === "EM" || el.style?.fontStyle === "italic";
  // textul în linie, cu bold/italic/legături; spațiile HTML se strâng
  const inline = (node, f = {}) => {
    let out = "";
    for (const n of node.childNodes) {
      if (n.nodeType === 3) { const t = n.nodeValue.replace(/\s+/g, " "); if (!t) continue; out += mark(escMd(fixChars(t)), f); continue; }
      if (n.nodeType !== 1) continue;
      const tg = n.tagName, st = n.getAttribute("style") || "";
      if (/mso-list:\s*Ignore/i.test(st)) continue;                     // marcajul de listă al lui Word (îl punem noi)
      if (tg === "BR") { out += "\n"; continue; }
      if (tg === "IMG") continue;
      if (tg === "A") {
        const href = n.getAttribute("href") || "", m = /#_(ftn|edn)(\d+)$/.exec(href);
        if (m) { out += `[^${m[1] === "edn" ? "e" : ""}${m[2]}]`; continue; }
        const t = inline(n, f).trim(); if (href && /^(https?:|mailto:)/i.test(href) && t) out += `[${t.replace(/\*+/g, "")}](${href})`; else out += t; continue;
      }
      if (tg === "SUP" && /^\s*\[?\d+\]?\s*$/.test(n.textContent || "") && n.querySelector("a")) { out += inline(n, f); continue; }
      const g = { ...f }; if (isBold(n)) g.b = true; if (isItal(n)) g.i = true; if (n.style && /line-through/.test(n.style.textDecoration || "")) g.s = true;
      if (tg === "B" && /font-weight:\s*normal/i.test(st)) g.b = f.b;     // Google Docs: <b style="font-weight:normal">
      out += inline(n, g);
    }
    return out;
  };
  const mark = (t, f) => { if (!(f.b || f.i || f.s) || !t.trim()) return t; const mk = (f.s ? "~~" : "") + (f.b ? "**" : "") + (f.i ? "*" : ""); const a = /^\s*/.exec(t)[0], z = /\s*$/.exec(t)[0]; return a + mk + t.trim() + [...mk].reverse().join("") + z; };
  const clean = t => t.replace(/\*\*\*\*|\*\*(\s*)\*\*/g, "$1").replace(/\*\*([ \t]*)\*\*/g, "$1").replace(/[ \t]+\n/g, "\n").replace(/\n[ \t]+/g, "\n").replace(/ {2,}/g, " ").trim();
  const blocks = [];
  const push = (k, t) => { const ind = k === "li" ? /^ */.exec(t)[0] : ""; t = clean(roCommas(t)); if (t) blocks.push({ k, t: ind + t }); };
  const walk = node => {
    for (const n of node.childNodes) {
      if (n.nodeType === 3) { if (n.nodeValue.trim()) push("p", escMd(fixChars(n.nodeValue))); continue; }
      if (n.nodeType !== 1) continue;
      const tg = n.tagName, cls = n.getAttribute("class") || "", st = n.getAttribute("style") || "";
      if (/^H[1-6]$/.test(tg)) { push("h", "#".repeat(+tg[1]) + " " + inline(n).replace(/\*\*/g, "")); continue; }
      if (/MsoTitle/.test(cls)) { push("h", "# " + inline(n).replace(/\*\*/g, "")); continue; }
      if (tg === "P" && /mso-list:\s*l\d+\s+level(\d+)/i.test(st)) {   // lista din Word: paragrafe cu marcajul în față
        const lvl = +/level(\d+)/i.exec(st)[1] - 1, mk = (n.querySelector("span[style*='mso-list:Ignore'],span[style*='mso-list: Ignore']")?.textContent || "").trim();
        push("li", "    ".repeat(Math.max(0, lvl)) + (/^[\divxlcdm]+[.)]|^[a-z][.)]/i.test(mk) ? "1. " : "- ") + inline(n).trim()); continue;
      }
      if (tg === "UL" || tg === "OL") { list(n, 0); continue; }
      if (tg === "TABLE") { table(n); continue; }
      if (tg === "BLOCKQUOTE") { const t = inline(n).trim(); if (t) push("q", t.split("\n").map(x => "> " + x).join("\n")); continue; }
      if (tg === "PRE") { push("pre", "```\n" + n.textContent.replace(/\n$/, "") + "\n```"); continue; }
      if (tg === "HR") { push("hr", "---"); continue; }
      if (/^(DIV|SECTION|ARTICLE|MAIN|BODY|SPAN|FONT|CENTER|B|I|EM|STRONG)$/.test(tg) && n.querySelector("p,div,h1,h2,h3,h4,h5,h6,ul,ol,table,blockquote,li")) { walk(n); continue; }
      push("p", inline(n));
    }
  };
  const list = (el, lvl) => {
    let k = 0; const num = el.tagName === "OL";
    for (const li of el.children) {
      if (li.tagName !== "LI") { if (li.tagName === "UL" || li.tagName === "OL") list(li, lvl + 1); continue; }
      const own = li.cloneNode(true); own.querySelectorAll("ul,ol").forEach(x => x.remove());
      push("li", "    ".repeat(lvl) + (num ? `${++k}. ` : "- ") + inline(own).replace(/\n+/g, " ").trim());
      for (const sub of li.children) if (sub.tagName === "UL" || sub.tagName === "OL") list(sub, lvl + 1);
    }
  };
  const table = tb => {
    const rows = [...tb.querySelectorAll("tr")].map(tr => [...tr.children].filter(c => /^T[DH]$/.test(c.tagName)).map(c => clean(inline(c)).replace(/\n+/g, "<br>").replace(/\|/g, "\\|")));
    if (!rows.length) return; const w = Math.max(...rows.map(r => r.length)), fill = r => [...r, ...Array(w - r.length).fill("")];
    blocks.push({ k: "t", t: [fill(rows[0]), Array(w).fill("---"), ...rows.slice(1).map(fill)].map(r => "| " + r.join(" | ") + " |").join("\n") });
  };
  walk(root);
  let md = ""; for (let i = 0; i < blocks.length; i++) { const b = blocks[i], p = blocks[i - 1]; md += i ? (b.k === "li" && p.k === "li" ? "\n" : "\n\n") : ""; md += b.t; }
  if (notes.length) md += "\n\n" + notes.join("\n");
  return md.trim();
}

// nota importată: proprietățile (de unde vine, când) și textul
function noteFor(md, { title, source, date, original } = {}) {
  const q = v => JSON.stringify(String(v));
  const fm = ["---", title ? `title: ${q(title)}` : null, source ? `imported-from: ${q(source)}` : null, `imported: ${date || new Date().toISOString().slice(0, 10)}`, original ? `original: ${q("[[" + original + "]]")}` : null, "---", ""].filter(x => x != null);
  return fm.join("\n") + "\n" + md.replace(/^\s+/, "");
}

module.exports = { noteFor, renumberNotes, docxToMarkdown, pdfToMarkdown, htmlToMarkdown, cleanPdfText, looksLikePdfText, isOfficeHtml, unzip, joinLines };
