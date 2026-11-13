// Texere · Sources (modulul Sources al lui Texere)
// Caută surse în mai multe cataloage dintr-o singură bară și creează nota de literatură, cu PDF-ul gratuit dacă există.
// Primește gazda modulului (host) și folosește doar API-ul Obsidian.
// Fiecare catalog e un fișier în providers/ (vezi README.md din acel folder), trecut în providers/index.js.
const { Modal, Notice, Setting, PluginSettingTab, requestUrl, setIcon, TFile, normalizePath } = require("obsidian");
const { node } = require("../shared/node");

const { LANG, isEn } = require("../shared/lang");
const { fold, later, vaultFolders, mountIn, advanced, openAdvanced } = require("../shared/util");
const { status } = require("../shared/status");
const { noteMenu } = require("../shared/notemenu");
// fișierele modulului, încărcate la cerere (în ordinea în care le pornește load())
const MODS = {
  template: () => require("./template"), library: () => require("./library"), cite: () => require("./cite"), stats: () => require("./stats"),
  highlights: () => require("./highlights"), distil: () => require("./distil"), zotero: () => require("./zotero"),
};
const PROVIDERS = require("./providers");
const PDF_PAGE_OLD = "p. {{pageLabel}}]";   // forma veche a paginii în șablonul PDF++ al lui Texere
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const stripTags = s => String(s || "").replace(/<[^>]+>/g, "")
  .replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (m, e) => e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENT[e.toLowerCase()])
  .replace(/\s+/g, " ").trim();
const normTitle = s => fold(stripTags(s)).replace(/[^a-z0-9]+/g, " ").trim();
const cleanDoi = d => { const m = /10\.\d{4,9}\/\S+/i.exec(String(d || "")); return m ? m[0].replace(/[.,;)\]]+$/, "") : null; };
const today = () => { const d = new Date(); return [d.getFullYear(), d.getMonth() + 1, d.getDate()]; };

// ISBN: doar cifre; ISBN-10 → ISBN-13 (ca dublurile să se recunoască)
function isbn13(s) {
  const d = String(s || "").replace(/[^0-9Xx]/g, "").toUpperCase();
  if (d.length === 13) return d;
  if (d.length !== 10) return null;
  const core = "978" + d.slice(0, 9); let sum = 0;
  for (let i = 0; i < 12; i++) sum += +core[i] * (i % 2 ? 3 : 1);
  return core + ((10 - (sum % 10)) % 10);
}
// „Simon Blackburn” → { given: "Simon", family: "Blackburn" }; „Blackburn, Simon” la fel; particule (van, de, von) rămân la nume
function splitName(n) {
  n = stripTags(n); if (!n) return null;
  if (n.includes(",")) { const [f, g] = n.split(",", 2); return { family: f.trim(), given: (g || "").trim() }; }
  const p = n.split(/\s+/); if (p.length === 1) return { family: p[0] };
  let i = p.length - 1; while (i > 1 && /^(van|von|der|den|de|del|della|di|da|du|la|le|ter|bin|al)$/i.test(p[i - 1])) i--;
  return { family: p.slice(i).join(" "), given: p.slice(0, i).join(" ") };
}
// primul cuvânt important din titlu ({{title|titleword}})
const STOP = new Set(["a", "an", "the", "and", "or", "but", "on", "in", "at", "to", "for", "with", "of", "from", "by", "as", "into", "like", "near", "over", "past", "since", "upon"]);
function titleWord(t) {
  const w = fold(stripTags(t)).split(/\s+/).map(x => x.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "")).filter(x => x && !STOP.has(x));
  return (w[0] || "").replace(/[^a-z0-9]/g, "");
}

// YAML în stilul notelor de literatură (liste cu „-”, șiruri între ghilimele doar când e nevoie)
function yScalar(v) {
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  const s = String(v ?? "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^[A-Za-zÀ-ž(][^:#\n"'{}\[\],&*!|>%@`]*$/.test(s) && !/\s$/.test(s) && !/^(true|false|null|yes|no|on|off)$/i.test(s)) return s;
  return JSON.stringify(s);
}
const P = n => "  ".repeat(n);
function yItem(v, ind) {
  if (v === null || typeof v !== "object") return [`${P(ind)}- ${yScalar(v)}`];
  const sub = Array.isArray(v) ? v.flatMap(x => yItem(x, ind + 1)) : Object.entries(v).filter(([, x]) => x != null).flatMap(([k, x]) => yKey(k, x, ind + 1));
  if (!sub.length) return [`${P(ind)}- []`];
  sub[0] = `${P(ind)}- ` + sub[0].slice(P(ind + 1).length);
  return sub;
}
function yKey(k, v, ind) {
  if (v == null) return [];
  if (Array.isArray(v)) return v.length ? [`${P(ind)}${k}:`, ...v.flatMap(x => yItem(x, ind + 1))] : [`${P(ind)}${k}: []`];
  if (typeof v === "object") return [`${P(ind)}${k}:`, ...Object.entries(v).flatMap(([a, b]) => yKey(a, b, ind + 1))];
  return [`${P(ind)}${k}: ${yScalar(v)}`];
}
const toYaml = o => Object.entries(o).flatMap(([k, v]) => yKey(k, v, 0)).join("\n");

// câmpurile CSL păstrate în notă (restul, ex. lista de referințe din Crossref, se aruncă)
const CSL_KEYS = ["type", "title", "title-short", "container-title", "container-title-short", "collection-title", "collection-number", "publisher", "publisher-place",
  "issued", "original-date", "edition", "volume", "issue", "number", "page", "number-of-pages", "URL", "DOI", "ISBN", "ISSN", "language", "abstract", "genre",
  "author", "editor", "translator", "container-author", "event-title", "original-title", "accessed"];
// fișierele pe care le poți cataloga (PDF și EPUB)
const DOC_EXT = /^(pdf|epub)$/i;
// câmpurile standard ale notei (în ordinea lor) și cele suplimentare
const CITEKEY_DEFAULT = "{{author|lowercase}}_{{title|titleword}}_{{year}}";   // regula cheii de citare
const { BIB_DEFAULT, BIB_OLD, existingPrefix } = require("../shared/paths");   // bibliografia; stilurile de citare (.csl) stau în același folder
const NOTE_STD = ["type", "title", "issued", "title-short", "page", "URL", "DOI", "container-title", "publisher", "publisher-place", "edition", "volume", "number", "language", "abstract"];
const NOTE_EXTRA = [["ISSN", "standard"], ["ISBN", "standard"], ["collection-title", "standard"], ["collection-number", "standard"], ["number-of-pages", "standard"],
  ["original-title", "standard"], ["original-date", "date"], ["genre", "standard"], ["container-title-short", "standard"], ["event-title", "standard"]];
function cleanCsl(c) {
  const o = {};
  for (const k of CSL_KEYS) {
    let v = c[k]; if (v == null || v === "" || (Array.isArray(v) && !v.length)) continue;
    if (Array.isArray(v) && /^(title|container-title|container-title-short|publisher|ISBN|ISSN|URL|collection-title)$/.test(k)) v = k === "ISBN" || k === "ISSN" ? v.join(", ") : v[0];
    if (/^(author|editor|translator|container-author)$/.test(k)) v = v.map(a => a.family || a.given ? { family: stripTags(a.family || ""), ...(a.given ? { given: stripTags(a.given) } : {}) } : a.literal ? { literal: stripTags(a.literal) } : null).filter(Boolean);
    if (k === "issued" || k === "original-date") { const dp = v["date-parts"]?.[0]?.filter(x => x != null && x !== ""); if (!dp?.length) continue; v = { "date-parts": [dp.map(Number)] }; }
    if (typeof v === "number") v = String(v);
    if (typeof v === "string") v = k === "abstract" ? stripTags(v.replace(/<\/?jats:p>/g, "\n")).replace(/^Abstract\s+/i, "") : stripTags(v);
    if (v === "" || (Array.isArray(v) && !v.length)) continue;
    o[k] = v;
  }
  if (o.DOI) o.DOI = cleanDoi(o.DOI) || o.DOI;
  if (o.URL && o.DOI && /^https?:\/\/(dx\.)?doi\.org\//i.test(o.URL)) o.URL = "https://doi.org/" + o.DOI;
  const TY = { "journal-article": "article-journal", "book-chapter": "chapter", "book-section": "chapter", "proceedings-article": "paper-conference", "posted-content": "article",
    monograph: "book", "edited-book": "book", "reference-book": "book", "reference-entry": "entry-encyclopedia", dissertation: "thesis", component: "document", other: "document" };
  if (TY[o.type]) o.type = TY[o.type];
  return o;
}

// diacriticele scrise în LaTeX: Vic{\u{a}} → Vică, \c{s} → ş, {\'e} → é
const ACC = { "`": "\u0300", "'": "\u0301", "^": "\u0302", "~": "\u0303", "=": "\u0304", u: "\u0306", ".": "\u0307", '"': "\u0308", r: "\u030A", H: "\u030B", v: "\u030C", c: "\u0327", k: "\u0328" };
const latex = s => String(s).replace(/\\([`'^~=."]|[uvHckr](?=[\s{]|[a-zA-Z](?![a-zA-Z])))\s*\{?\s*(\\?[a-zA-Z])(?:\s*\})?/g, (m, a, ch) => (ch === "\\i" ? (ACC[a] ? "i" : "ı") : ch.replace("\\", "")) + (ACC[a] || "")).normalize("NFC")
  // și forma scurtă, fără acolade: „Vic\ua” → Vică (PhilPapers exportă așa)
  .replace(/\\([uvHckr])([a-zA-Z])(?![a-zA-Z])/g, (m, a, ch) => ch + ACC[a])
  .replace(/\\ss\b/g, "ß").replace(/\\(ae|oe|o|l)\b/gi, (m, x) => ({ ae: "æ", AE: "Æ", oe: "œ", OE: "Œ", o: "ø", O: "Ø", l: "ł", L: "Ł" })[x] || x).normalize("NFC");
// textele românești din BibTeX: sedila veche → virgulă (ş → ș, ţ → ț); literele pierdute la export („?” în loc de ș/ț) se refac după regulile limbii:
// „?i” singur = „și”; înainte de „t” = ș (București, știință); după „n” = ț (știință, ființă); înainte de „i” + vocală/sfârșit = ț (-ție, -ții); altfel ș
const RO_SIGN = /[ăâîșțĂÂÎȘȚ]/;   // nu ş/ţ cu sedilă: le folosește și turca
function roFix(v) {
  let s = String(v).replace(/ş/g, "ș").replace(/Ş/g, "Ș").replace(/ţ/g, "ț").replace(/Ţ/g, "Ț");
  s = s.replace(/(^|[.!:]\s+)\?(?=\p{L})/gu, "$1\u0001?");   // „?” la începutul titlului sau după punct → va fi majusculă
  s = s.replace(/(^|[^\p{L}])\?([iI])(?!\p{L})/gu, (m, a, i) => a + (i === "I" ? "ȘI" : "și"))
    .replace(/(^|[^\p{L}])\?(?=t\p{L})/gu, "$1ș")
    .replace(/(\p{L})\?(?=t)/gu, "$1ș")
    .replace(/([nN])\?(?=\p{L}|$|[^\p{L}])/gu, "$1ț")
    .replace(/(\p{L})\?(?=i(?:[aeiouăâî]|[^\p{L}]|$))/gu, "$1ț")
    .replace(/(\p{L})\?(?=\p{L})/gu, "$1ș");
  // la începutul titlului sau după punct: majusculă (Știință, Ție) — doar unde lipsea litera
  return s.replace(/\u0001(\S)/g, (m, c) => c.toUpperCase()).replace(/\u0001/g, "");
}
// BibTeX (ex. Google Scholar → Cite → BibTeX) → CSL
function parseBibtex(src) {
  const out = []; const re = /@(\w+)\s*\{\s*([^,\s]*)\s*,/g; let m;
  while ((m = re.exec(src))) {
    const type = m[1].toLowerCase(); if (/^(comment|preamble|string)$/.test(type)) continue;
    let i = re.lastIndex, depth = 1; const start = i;
    while (i < src.length && depth > 0) { if (src[i] === "{") depth++; else if (src[i] === "}") depth--; i++; }
    const body = src.slice(start, i - 1), f = {};
    const fr = /(\w[\w-]*)\s*=\s*/g; let fm;
    while ((fm = fr.exec(body))) {
      let j = fr.lastIndex, val = "";
      if (body[j] === "{") { let d = 0, k = j; for (; k < body.length; k++) { if (body[k] === "{") d++; else if (body[k] === "}") { d--; if (!d) break; } } val = body.slice(j + 1, k); fr.lastIndex = k + 1; }
      else if (body[j] === '"') { const k = body.indexOf('"', j + 1); val = body.slice(j + 1, k); fr.lastIndex = k + 1; }
      else { const k = body.slice(j).search(/[,}\n]/); val = body.slice(j, k < 0 ? undefined : j + k); fr.lastIndex = j + (k < 0 ? body.length : k); }
      f[fm[1].toLowerCase()] = latex(val).replace(/[{}]/g, "").replace(/\\&/g, "&").replace(/\s+/g, " ").trim();
    }
    // un text românesc (diacritice sau „?” în mijlocul cuvintelor): refacem ce s-a pierdut și ținem minte, ca să-ți cerem să verifici
    const vals = Object.values(f), ro = vals.some(v => RO_SIGN.test(v)) || vals.some(v => /\p{L}\?\p{L}/u.test(v)) || vals.some(v => /(^|\s)\?i(\s|$)/.test(v));
    let fixed = false;
    if (ro) for (const k of Object.keys(f)) { const r = roFix(f[k]); if (r !== f[k]) { if (/\?/.test(f[k])) fixed = true; f[k] = r; } }
    const names = s => (s || "").split(/\s+and\s+/i).map(splitName).filter(Boolean);
    const T = { article: "article-journal", book: "book", inbook: "chapter", incollection: "chapter", inproceedings: "paper-conference", conference: "paper-conference", phdthesis: "thesis", mastersthesis: "thesis", techreport: "report", misc: "document", online: "webpage" };
    const csl = { type: T[type] || "document", title: f.title, author: names(f.author), editor: f.editor ? names(f.editor) : undefined,
      "container-title": f.journal || f.booktitle, publisher: f.publisher || f.school || f.institution, "publisher-place": f.address,
      volume: f.volume, issue: f.number, page: f.pages?.replace(/-+/g, "-"), DOI: f.doi, ISBN: f.isbn, URL: f.url, edition: f.edition, abstract: f.abstract,
      issued: f.year ? { "date-parts": [[+f.year]] } : undefined };
    out.push({ csl: cleanCsl(csl), bibkey: m[2], fixed });
  }
  return out;
}

// RIS (Zotero, Mendeley, EndNote, baze de date) → CSL
function parseRis(src) {
  const out = []; let cur = null;
  const TY = { JOUR: "article-journal", BOOK: "book", CHAP: "chapter", CONF: "paper-conference", CPAPER: "paper-conference", THES: "thesis", RPRT: "report", ELEC: "webpage", NEWS: "article-newspaper", MGZN: "article-magazine", ENCYC: "entry-encyclopedia", GEN: "document" };
  for (const line of String(src).split(/\r?\n/)) {
    const m = /^([A-Z][A-Z0-9])  -\s?(.*)$/.exec(line); if (!m) continue;
    const [, tag, v] = m;
    if (tag === "TY") { cur = { type: TY[v.trim()] || "document", author: [], editor: [] }; continue; }
    if (!cur) continue;
    if (tag === "ER") { const sp = cur.sp, ep = cur.ep; delete cur.sp; delete cur.ep; if (sp) cur.page = ep ? `${sp}-${ep}` : sp; out.push({ csl: cleanCsl(cur), bibkey: null }); cur = null; continue; }
    const name = x => { const [f, g] = x.split(/,\s*/); return g ? { family: f.trim(), given: g.trim() } : splitName(x); };
    if (/^(AU|A1)$/.test(tag)) cur.author.push(name(v)); else if (/^(ED|A2|A3)$/.test(tag)) cur.editor.push(name(v));
    else if (/^(TI|T1)$/.test(tag)) cur.title = v; else if (/^(T2|JO|JF|BT)$/.test(tag)) cur["container-title"] = cur["container-title"] || v;
    else if (/^(PY|Y1|DA)$/.test(tag)) { const y = /\d{4}/.exec(v); if (y && !cur.issued) cur.issued = { "date-parts": [[+y[0]]] }; }
    else if (tag === "VL") cur.volume = v; else if (tag === "IS") cur.issue = v; else if (tag === "SP") cur.sp = v; else if (tag === "EP") cur.ep = v;
    else if (tag === "PB") cur.publisher = v; else if (tag === "CY") cur["publisher-place"] = v; else if (tag === "DO") cur.DOI = v; else if (tag === "SN") cur.ISBN = cur.ISBN || v;
    else if (tag === "UR") cur.URL = cur.URL || v; else if (tag === "AB") cur.abstract = v; else if (tag === "LA") cur.language = v; else if (tag === "ET") cur.edition = v;
  }
  return out;
}
// ce fel de text ai lipit: BibTeX, RIS, sau referințe scrise (una pe paragraf; sau una pe rând, dacă fiecare rând arată ca o referință)
// un rând de bibliografie: autor + an + DOI/link (ex. „Clark, A. (2025). … https://doi.org/…”)
function isRefLine(line) {
  const l = String(line || ""); if (!/(doi|https?:\/\/|isbn)/i.test(l)) return false;
  return /\(\s*(1[5-9]|20)\d{2}[a-z]?[,)]/.test(l) || /\b[A-Z][\p{L}'’-]+,\s+(?:[A-Z]\.\s*){1,3}/u.test(l) || /\b(1[5-9]|20)\d{2}\b.*\b\d+\(\d+\)/.test(l);
}
// datele de pe coperta unei teze sau a unei lucrări proprii: titlul (cel mai mare text), autorul (sub „Student”, „Autor”, „Masterand”…),
// anul, universitatea, tipul tezei; rezumatul de pe pagina a doua
function coverGuess(info, file) {
  const C = info?.cover; if (!C || !C.length) return null;
  const all = C.map(i => i.s).join(" "), fname = file?.basename || "", text = all + " " + fname + " " + (info.title || "");
  const sizes = [...C.map(i => i.size)].sort((a, b) => a - b), body = sizes[Math.floor(sizes.length / 2)] || 10;
  const big = C.filter(i => i.size >= body * 1.4).sort((a, b) => b.size - a.size || b.y - a.y);
  if (!big.length) return null;
  const top = big[0].size, title = big.filter(i => i.size >= top * 0.95).sort((a, b) => b.y - a.y).map(i => i.s).join(" ").trim();
  const sub = big.filter(i => i.size < top * 0.95).sort((a, b) => b.y - a.y).map(i => i.s).join(" ").trim();
  const genre = /doctora|ph\.?\s?d|doctoral/i.test(text) ? ["Teză de doctorat", "PhD thesis"] : /master|disertați|disertati|dissertation|masterand/i.test(text) ? ["Lucrare de disertație", "Master's thesis"] : /licen[țţt]|bachelor|absolvent/i.test(text) ? ["Lucrare de licență", "Bachelor's thesis"] : null;
  const ro = /[ăâîșțşţ]/i.test(all) && !/university|faculty/i.test(all);
  // autorul: rândul de sub eticheta „Student”, „Autor”, „Masterand”…, în aceeași coloană
  let author = null;
  const lab = C.find(i => /^(student|studentă|autor|author|absolvent|absolventă|masterand|masterandă|doctorand|doctorandă|candidat|candidate|by|de)\s*:?$/i.test(i.s));
  if (lab) { const below = C.filter(i => i.y < lab.y && lab.y - i.y < lab.size * 3 && Math.abs(i.x - lab.x) < lab.size * 4 && /\p{L}/u.test(i.s)).sort((a, b) => b.y - a.y)[0]; if (below) author = below.s.replace(/^(drd\.|stud\.|lect\.|prof\.|conf\.|univ\.|dr\.)\s*/gi, "").trim(); }
  if (!author && info.author && !/microsoft|adobe|user|admin|owner/i.test(info.author)) author = info.author.trim();
  const year = (all.match(/\b(19[5-9]\d|20\d{2})\b/g) || []).pop();
  const uni = C.map(i => i.s).find(s => /universit|university|academia|academy|institut/i.test(s));
  if (!genre && !author) return { type: "book", title: sub ? title + ": " + sub : title, ...(year ? { issued: { "date-parts": [[+year]] } } : {}) };
  const csl = { type: genre ? "thesis" : "book", title: sub ? title + ": " + sub : title };
  if (author) csl.author = [splitName(author)].filter(Boolean);
  if (year) csl.issued = { "date-parts": [[+year]] };
  if (genre) csl.genre = ro ? genre[0] : genre[1];
  if (uni) { csl.publisher = uni.trim(); if (/bucure[șşs]ti|bucharest/i.test(uni)) csl["publisher-place"] = ro ? "București" : "Bucharest"; }
  csl.language = ro ? "ro" : "en";
  if (C.abstract) csl.abstract = C.abstract;
  return csl;
}
function pastedKind(text) {
  const t = String(text || "").trim(); if (!t) return { kind: "none", refs: [] };
  if (/@\w+\s*\{/.test(t)) return { kind: "bibtex", refs: parseBibtex(t) };
  if (/^TY  - /m.test(t)) return { kind: "ris", refs: parseRis(t) };
  let parts = t.split(/\n\s*\n/).map(x => x.trim()).filter(Boolean);
  if (parts.length === 1) {
    const lines = t.split(/\n/).map(x => x.trim()).filter(Boolean);
    const refLike = l => /\b10\.\d{4,9}\/\S+/.test(l) || /ISBN|97[89][\d-]{10,}/i.test(l) || /^https?:\/\//.test(l) || (l.length > 40 && /\b(1[5-9]\d\d|20\d\d)\b/.test(l));
    if (lines.length > 1 && lines.every(refLike)) parts = lines;
  }
  return { kind: "text", refs: parts.map(p => p.replace(/\s*\n\s*/g, " ")) };
}
// text lipit în Căutare care e de fapt o referință întreagă (sau mai multe): merge în „Lipește”, unde e citit ca referință
function looksLikeRef(text) {
  const s = String(text || "").trim(); if (!s) return false;
  if (/@\w+\s*\{/.test(s) || /^TY {1,2}- /m.test(s)) return true;                 // BibTeX, RIS
  const one = s.replace(/\s*\n\s*/g, " "), id = l => /\b10\.\d{4,9}\/\S+/.test(l) || /ISBN|97[89][\d-]{10,}/i.test(l) || /^https?:\/\//.test(l.trim());
  const lines = s.split(/\n/).filter(l => l.trim());
  if (lines.length >= 2 && lines.filter(id).length >= 2) return true;               // mai mulți identificatori, câte unul pe rând
  if (one.length < 50) return false;
  const year = /\b(1[5-9]\d\d|20\d\d)[a-z]?\b/.test(one);
  const names = /[A-ZĂÂÎȘȚ][\p{L}'’-]+,\s*[A-ZĂÂÎȘȚ]/u.test(one) || /\bet al\b/i.test(one) || /\(\s*(1[5-9]|20)\d\d[a-z]?\s*\)/.test(one) || /\b[A-ZĂÂÎȘȚ][\p{L}'’-]+ [A-Z]{1,3}\b[,;]/u.test(one);
  return year && names && (one.match(/[.,;:]/g) || []).length >= 3;
}
// o referință scrisă (APA, Chicago, Vancouver, Frontiers…) citită cât se poate: autori, an, titlu, revistă
function guessRef(text) {
  const t = String(text).replace(/\s+/g, " ").trim();
  const ym = /\((1[5-9]\d\d|20\d\d)[a-z]?\)|\b(1[5-9]\d\d|20\d\d)[a-z]?\b/.exec(t), year = ym ? +(ym[1] || ym[2]) : null;
  let auth = ym ? t.slice(0, ym.index) : "", rest = ym ? t.slice(ym.index + ym[0].length) : t;
  rest = rest.replace(/^[\s.,:)]+/, "");
  const q = /^[“"«„]([^”"»]+)[”"»]/.exec(rest), tm = q ? [null, q[1], rest.slice(q[0].length)] : /^(.+?[.?!])\s+(.*)$/.exec(rest);
  const title = (tm ? tm[1] : rest).replace(/[.\s]+$/, "").trim(), after = (tm ? tm[2] : "").replace(/^[\s.,]+/, "");
  // după titlu: „Loc: Editură” (carte) sau „Revista, volum(număr), pagini”
  const pub = /^([A-ZĂÂÎȘȚ][^:.,\d]{1,40}):\s*([^.]+)/.exec(after);
  const cont = pub ? [] : (/^(?:In:?\s+)?([^\d][^,]*?)(?:,\s*|\.\s+|\s+)(\d+)/.exec(after) || /^(?:In:?\s+)?([^\d][^.,]*)/.exec(after) || []);
  const initials = x => /^(?:[A-ZĂÂÎȘȚ]\.?\s?-?){1,4}$/.test(x.trim());
  const toks = auth.replace(/\s*&\s*|\s+(?:and|și|et)\s+/g, ", ").replace(/\bet al\.?/g, "").split(/\s*[,;]\s*/).map(x => x.trim()).filter(Boolean);
  const authors = [];
  // Chicago: primul autor inversat („Blackburn, Simon”), ceilalți normal
  if (toks.length >= 2 && !/\s/.test(toks[0]) && /^[A-ZĂÂÎȘȚ][\p{L}'-]+\.?$/u.test(toks[1]) && !initials(toks[1]) && (toks.length === 2 || /\s/.test(toks[2]))) {
    authors.push({ family: toks[0], given: toks[1].replace(/\.$/, "") }); toks.splice(0, 2);
  }
  for (let i = 0; i < toks.length; i++) {
    const a = toks[i], nx = toks[i + 1];
    if (nx && initials(nx) && !initials(a)) { authors.push({ family: a.replace(/[.]$/, ""), given: nx.trim() }); i++; continue; }   // APA: „Felber, N. A.”
    const w = a.split(/\s+/);
    if (w.length > 1 && initials(w[w.length - 1])) { authors.push({ family: w.slice(0, -1).join(" "), given: w[w.length - 1] }); continue; }   // Vancouver: „Felber NA”
    if (initials(a)) continue;
    const n = splitName(a); if (n) authors.push(n);
  }
  const isPub = x => /\b(editura|press|publishing|publishers|verlag|éditions|edizioni|humanitas|polirom|nemira)\b/i.test(x || "");
  // APA book: „Title. Publisher.” (nothing after it with a volume, issue or pages) is a book, not a journal
  const bookish = cont[1] && !cont[2] && !/\d/.test(after);
  if (cont[1] && (isPub(cont[1]) || bookish)) return cleanCsl({ type: "book", title, author: authors, issued: year ? { "date-parts": [[year]] } : undefined, publisher: cont[1].trim() });
  return cleanCsl({ type: cont[1] ? "article-journal" : "book", title, author: authors, issued: year ? { "date-parts": [[year]] } : undefined,
    "container-title": cont[1]?.trim(), volume: cont[2], "publisher-place": pub?.[1]?.trim(), publisher: pub?.[2]?.trim() });
}

// miezul nopții UTC (OpenAlex își reface bugetul atunci) și al Californiei (Google Books)
const nextUtcMidnight = () => { const d = new Date(); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1); };
const nextPacificMidnight = () => { try { const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", minute: "numeric", second: "numeric", hourCycle: "h23" }).formatToParts(new Date()).map(x => [x.type, x.value])); return Date.now() + ((23 - +p.hour) * 3600 + (59 - +p.minute) * 60 + (60 - +p.second)) * 1000; } catch (e) { return Date.now() + 86400000; } };

// câmpurile cu foldere din vault: lista folderelor apare cât scrii (ca să fie clar că e un folder din vault, nu text oarecare)
const _obs = require("obsidian");
const FolderSuggest = _obs.AbstractInputSuggest ? class extends _obs.AbstractInputSuggest {
  constructor(app, inputEl, onPick) { super(app, inputEl); this.inp = inputEl; this.onPick = onPick; }
  getSuggestions(q) {
    const v = this.app.vault, all = v.getAllFolders ? v.getAllFolders(false) : v.getAllLoadedFiles().filter(f => f.children);
    q = String(q || "").toLowerCase();
    return all.map(f => f.path).filter(p => p && p !== "/" && !/^\.trash(\/|$)/.test(p) && !/(^|\/)\./.test(p) && p.toLowerCase().includes(q)).sort((a, b) => a.localeCompare(b)).slice(0, 60);
  }
  renderSuggestion(p, el) { el.setText(p); }
  selectSuggestion(p) { this.inp.value = p; this.inp.dispatchEvent(new Event("input")); this.inp.dispatchEvent(new Event("change")); this.onPick?.(p); this.close(); }
} : null;

class Sources {
  constructor(host, dir) { this.host = host; this.app = host.app; this.dir = dir; this.providers = []; }
  get en() { return isEn(this.app); }
  T(ro, en) { return this.en ? en : ro; }
  conf() {
    const s = this.host.settings; if (!s.sources) s.sources = {};
    const c = s.sources, d = { disabled: [], openalexKey: "", s2Key: "", serpapiKey: "", email: "", pdf: true };
    for (const k in d) if (!(k in c)) c[k] = d[k];
    // Semantic Scholar fără cheie răspunde aproape mereu „prea multe cereri”: pornit doar cu cheie
    if (!c.v) { c.v = 1; if (!c.s2Key && !c.disabled.includes("semanticscholar")) c.disabled.push("semanticscholar"); }
    return c;
  }
  save() { return this.host.saveData(this.host.settings); }
  // șablonul notei de literatură: cel implicit al vault-ului Texere, apoi îl schimbi în Settings → Texere · Sources → Șablonul notei
  template() {
    const c = this.conf();
    // un șablon nou: câmpurile de bază, plus câmpurile hărților pe care le ai (ex. Filosofia: discipline, branch…); fără hartă, fără ele
    if (!c.template) {
      c.template = JSON.parse(JSON.stringify(this.T_.DEFAULT)); c.template.maps = [];
      for (const id of Object.keys(this.T_.MAP_FIELDS)) if (this.mapOn(id)) { for (const n of this.T_.MAP_FIELDS[id]) c.template.fields.push(this.T_.mapField(n)); c.template.maps.push(id); }
      this.save();
    }
    // un șablon de dinainte: hărțile ale căror câmpuri le are deja (ca să nu le mai adăugăm o dată)
    if (!Array.isArray(c.template.maps)) { c.template.maps = Object.keys(this.T_.MAP_FIELDS).filter(id => this.T_.MAP_FIELDS[id].some(n => (c.template.fields || []).some(f => f.name === n))); this.save(); }
    if (c.template.filename === this.T_.FILENAME_V1) { c.template.filename = this.T_.FILENAME; this.save(); }
    if (c.template.from) { delete c.template.from; this.save(); }   // urma vechiului punct de pornire
    // câmpurile cu numele de dinainte de 0.4 (domain, subdomain, historical-period, author-links) și autorii fără „Author/”
    if ((c.template.fields || []).some(f => this.T_.FIELD_V1[f.name] || /\[\[Author\//.test(f.template || ""))) {
      const seen = new Set(); c.template.fields = c.template.fields.map(f => ({ ...f, name: this.T_.FIELD_V1[f.name] || f.name, template: String(f.template || "").replace(/\[\[Author\//g, "[[") })).filter(f => !seen.has(f.name) && seen.add(f.name));
      this.save();
    }   // numele primesc și anul original (traduceri)
    return c.template;
  }
  // ai harta? după configurare: dacă ai ales-o; înainte (vault-urile vechi): dacă e în vault
  mapOn(id) {
    const core = this.host.core, f = core?.settings?.fields;
    if (f?.asked) return (f.chosen || []).includes(id);
    const m = (core?.maps?.() || []).find(x => x.id === id); if (!m) return false;
    const tail = `${m.folder}/${m.folder}.md`;
    return (this.app.vault.getMarkdownFiles?.() || []).some(x => x.path === tail || x.path.endsWith("/" + tail));
  }
  // harta a intrat în vault: câmpurile ei intră în șablon (o singură dată; dacă le-ai șters după, nu le mai punem la loc)
  async addMapFields(id) {
    const names = this.T_.MAP_FIELDS[id]; if (!names) return 0;
    const t = this.template(); if (t.maps.includes(id)) return 0;
    let n = 0; for (const name of names) if (!t.fields.some(f => f.name === name)) { t.fields.push(this.T_.mapField(name)); n++; }
    t.maps.push(id); await this.save(); return n;
  }
  // n-ai ales harta: câmpurile ei ies din șablon, doar cele neschimbate (încă „[]”) și pe care nicio notă de lectură nu le folosește
  async dropMapFields(id) {
    const names = this.T_.MAP_FIELDS[id]; if (!names) return 0;
    const t = this.template(); if (!t.maps.includes(id)) return 0;
    const mc = this.app.metadataCache, notes = (this.app.vault.getMarkdownFiles?.() || []).filter(f => f.path.startsWith(this.litDir()));
    const used = name => notes.some(f => { const v = mc?.getFileCache?.(f)?.frontmatter?.[name]; return Array.isArray(v) ? v.length : v != null && v !== ""; });
    const before = t.fields.length;
    t.fields = t.fields.filter(f => !(names.includes(f.name) && String(f.template || "").trim() === "[]" && !used(f.name)));
    t.maps = t.maps.filter(x => x !== id); await this.save(); return before - t.fields.length;
  }
  // deschide Settings → Texere · Sources, la o anumită filă
  openSettings(tab) {
    try { this.host.core.openSettings("sources", tab); } catch (e) { console.warn(e); }
  }
  // valorile pe care le are deja câmpul în notele de literatură (pentru sugestii) și dacă sunt linkuri [[…]]
  fieldUsage(name) {
    const vals = new Map(); let links = 0, plain = 0;
    let files = []; try { files = this.app.vault.getMarkdownFiles(); } catch (e) {}
    for (const f of files) {
      if (!f.path.startsWith(this.litDir())) continue;
      const v = this.app.metadataCache?.getFileCache?.(f)?.frontmatter?.[name];
      for (const x of Array.isArray(v) ? v : v != null && v !== "" ? [v] : []) {
        const s = String(x), m = /^\[\[([^\]|]+)(?:\|[^\]]*)?\]\]$/.exec(s.trim());
        if (m) links++; else plain++;
        const k = (m ? m[1] : s).trim(); if (k) vals.set(k, (vals.get(k) || 0) + 1);
      }
    }
    return { values: [...vals.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(e => e[0]), links: links >= plain };
  }
  // de unde vin valorile câmpurilor de completat: notele dintr-un folder cu același nume (ex. Disciplines/Philosophy/Branches pentru branch,
  // Periods pentru period) și valorile folosite deja în orice notă din vault. Se poate alege alt folder în Setări → Șablonul notei.
  fieldIndex(names) {
    const norm = x => fold(x).replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim().replace(/ies$/, "y").replace(/(ch|sh|x|ss)es$/, "$1").replace(/s$/, "");
    const link = x => { const m = /^\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]$/.exec(String(x).trim()); return (m ? m[1].split("/").pop() : String(x)).trim(); };
    const arr = v => Array.isArray(v) ? v : v != null && v !== "" ? [v] : [];
    const tpl = this.template(), idx = { byName: new Map(), link, arr, fields: {} };
    for (const n of names) idx.fields[n] = { opts: new Map(), folders: new Set(), src: (tpl.fields.find(f => f.name === n)?.source || "").replace(/\/+$/, "") };
    let files = []; try { files = this.app.vault.getMarkdownFiles(); } catch (e) {}
    const add = (n, name, aliases, folder, used) => {
      if (!name) return; const F = idx.fields[n]; let o = F.opts.get(name);
      if (!o) F.opts.set(name, o = { name, aliases: [], inFolder: false, count: 0 });
      if (aliases) o.aliases = [...new Set([...o.aliases, ...arr(aliases).map(String)])];
      if (folder) o.inFolder = true; if (used) o.count++;
    };
    for (const f of files) {
      const fm = this.app.metadataCache?.getFileCache?.(f)?.frontmatter || {};
      idx.byName.set(f.basename, fm);
      const parts = (f.parent?.path || "").split("/");
      for (const n of names) {
        const F = idx.fields[n];
        // „discipline”: nota cu numele folderului ei (Disciplines/Philosophy/Philosophy.md), nu toate notele de sub Disciplines
        const disc = norm(n) === "discipline", hit = F.src ? f.path.startsWith(F.src + "/") : disc ? (parts[parts.length - 1] === f.basename && norm(parts[parts.length - 2] || "") === "discipline") : parts.some(p => p && norm(p) === norm(n));
        if (hit) { add(n, f.basename, fm.aliases, true); if (!F.src && !disc) F.folders.add(parts.slice(0, parts.findIndex(p => norm(p) === norm(n)) + 1).join("/")); }
        for (const v of arr(fm[n])) add(n, link(v), null, false, true);
      }
    }
    return idx;
  }
  // sugestiile pentru un câmp: întâi cele legate de ce ai ales deja (ex. teoriile ramurii alese), apoi cele din folderul câmpului, apoi după cât sunt folosite
  fieldOptions(idx, name, chosen) {
    const F = idx.fields[name]; if (!F) return [];
    const rel = new Set();
    for (const [other, vals] of Object.entries(chosen || {})) if (other !== name) for (const v of vals) for (const x of idx.arr(idx.byName.get(v)?.[name])) rel.add(idx.link(x));
    const related = o => rel.has(o.name) || Object.entries(chosen || {}).some(([other, vals]) => other !== name && vals.length && idx.arr(idx.byName.get(o.name)?.[other]).map(idx.link).some(x => vals.includes(x)));
    return [...F.opts.values()].map(o => ({ ...o, related: related(o) }))
      .sort((a, b) => (b.related - a.related) || (b.inFolder - a.inFolder) || (b.count - a.count) || a.name.localeCompare(b.name));
  }
  // tipul unui câmp: „links” (listă de linkuri), „list”, „text” sau „auto” (se calculează din datele sursei)
  fieldKind(f) {
    if (!this.T_.isFill(f)) return "auto";
    if (f.kind) return f.kind;
    if (!this.T_.isList(f)) return "text";
    return this.fieldUsage(f.name).links ? "links" : "list";
  }
  // câmpurile notei pentru o sursă: valorile din șablon, peste care se pun cele scrise de tine în formular
  noteFields(csl, key, attachments, custom) {
    const vars = this.tplVars(csl, key, attachments);
    const out = [];
    for (const f of this.template().fields) {
      if (!f.enabled || !f.name) continue;
      const v = custom && Object.prototype.hasOwnProperty.call(custom, f.name) ? custom[f.name] : this.T_.fieldValue(f, vars);
      if (v !== undefined) out.push([f.name, v]);
    }
    return out;
  }
  // numele notei și al PDF-ului: „Autor An – Titlu scurt” (șablonul din Setări → Nume și foldere); citarea rămâne [@citekey]
  // variabilele șablonului pentru o sursă: datele ei plus cele suplimentare (anul și titlul originalului, ISBN…)
  tplVars(csl, key, attachments) {
    const { citation, contributors, additionalFields } = this.noteData(csl, key), extra = {};
    for (const f of additionalFields) if (!(f.name in citation)) extra[f.name] = f.value;
    return this.T_.variables({ ...extra, ...citation }, contributors, attachments || [], []);
  }
  fileBase(csl, key) {
    const t = this.template(), vars = this.tplVars(csl, key);
    return this.T_.fileBase(t.filename || this.T_.FILENAME, vars) || "@" + key;
  }
  // ce s-ar redenumi: fiecare notă de literatură după șablon, iar PDF-urile ei cu același nume (doar cele atașate unei singure note)
  tidyPlan() {
    const mc = this.app.metadataCache, arr = v => Array.isArray(v) ? v : v ? [v] : [], used = new Set(), plan = [];
    const notes = this.app.vault.getMarkdownFiles().filter(f => f.path.startsWith(this.litDir()));
    const target = (dir, base, ext, self) => {
      let p = normalizePath(`${dir}/${base}.${ext}`), n = 2;
      while ((p !== self && this.app.vault.getAbstractFileByPath(p)) || used.has(p)) p = normalizePath(`${dir}/${base} (${n++}).${ext}`);
      used.add(p); return p;
    };
    const att = f => arr(mc.getFileCache(f)?.frontmatter?.attachment).map(x => /\[\[([^\]|#]+)/.exec(String(x))?.[1]).filter(Boolean)
      .map(l => mc.getFirstLinkpathDest(l, f.path)).filter(p => p && /^(pdf|epub)$/i.test(p.extension));
    const owners = new Map(); for (const f of notes) for (const p of att(f)) owners.set(p.path, (owners.get(p.path) || 0) + 1);
    // numele de acum e bun dacă e cel din șablon, sau acesta urmat de subtitlu („Titlu. Subtitlu”, „Titlu: Subtitlu”), în același folder
    const fine = (file, to) => { const dir = to.slice(0, to.lastIndexOf("/")), want = to.slice(to.lastIndexOf("/") + 1).replace(/\.[^.]+$/, ""), cur = file.basename || ""; return (file.parent?.path || "") === dir && (cur === want || (cur.startsWith(want) && /^[.:]\s/.test(cur.slice(want.length)))); };
    for (const f of notes) {
      const fm = mc.getFileCache(f)?.frontmatter; if (!fm?.id) continue;
      const csl = this.cslOfFm(fm);
      const base = this.fileBase(csl, fm.id);
      const to = target(this.notesDir(csl, fm.id), base, "md", f.path);
      if (to !== f.path && !fine(f, to)) plan.push({ kind: "note", file: f, to, key: fm.id });
      const pb = this.pdfBase(csl, fm.id, base);
      // PDF-urile din folderul de documente (sau din Inbox) se mută în folderul sursei; cele ținute în altă parte rămân acolo
      const docRoot = this.docDir() + "/", pdir = this.pdfDir(csl, fm.id);
      att(f).forEach((p, i) => {
        if (owners.get(p.path) > 1) return;
        const dir = p.path.startsWith(docRoot) || p.path.startsWith(this.inboxDir() + "/") ? pdir : (p.parent?.path || ""), name = pb ? (i ? `${pb} (${i + 1})` : pb) : p.basename;
        const t = target(dir, name, p.extension, p.path); if (t !== p.path && !fine(p, t)) plan.push({ kind: "pdf", file: p, to: t, key: fm.id });
      });
    }
    return plan;
  }
  // calculează ceva ca și cum folderele ar fi altele (pentru previzualizare), fără să schimbe setarea
  withFiles(cfg, fn) { const c = this.conf(), old = c.files; c.files = { ...old, ...cfg }; try { return fn(); } finally { c.files = old; } }
  // previzualizarea folderelor noi: unde ar ajunge o sursă nouă și ce fișiere existente s-ar muta; abia apoi se aplică
  previewFiles(draft, onDone) {
    const S = this, T = (a, b) => this.T(a, b);
    const ex = { type: "book", title: "Think: A compelling introduction to philosophy", author: [{ family: "Blackburn", given: "Simon" }], issued: { "date-parts": [[2001]] } }, exk = "blackburn_think_2001";
    const sample = this.withFiles(draft, () => { const nb = this.fileBase(ex, exk), pb = this.pdfBase(ex, exk, nb); return { note: `${this.notesDir(ex, exk)}/${nb}.md`, pdf: `${this.pdfDir(ex, exk)}/${pb || "Think.pdf"}${pb ? ".pdf" : ""}`, inbox: String(draft.inbox || "").replace(/\/+$/, "") }; });
    const plan = this.withFiles(draft, () => this.tidyPlan());
    const M = class extends Modal {
      onOpen() {
        this.modalEl.addClass("texere-tidy"); this.titleEl.setText(T("Folderele noi: previzualizare", "New folders: preview"));
        const c = this.contentEl;
        c.createEl("p", { cls: "ts-hint", text: T("Nimic nu s-a schimbat încă. Așa ar arăta:", "Nothing has changed yet. This is what it would look like:") });
        const ex = c.createDiv("ts-tidy-list");
        for (const [lab, val] of [[T("O referință nouă · nota", "A new reference · note"), sample.note], [T("O referință nouă · PDF-ul", "A new reference · PDF"), sample.pdf], ["Inbox", sample.inbox + "/"]]) {
          const r = ex.createDiv("ts-tidy-row"); const tx = r.createDiv(); tx.createDiv({ cls: "ts-tidy-old", text: lab }); tx.createDiv({ cls: "ts-tidy-new", text: val });
        }
        c.createEl("p", { cls: "ts-hint", text: plan.length ? T(`Fișierele existente care s-ar muta (${plan.length}). Linkurile și adnotările se actualizează singure; citările rămân la fel.`, `Existing files that would move (${plan.length}). Links and annotations update themselves; citations stay the same.`)
          : T("Niciun fișier existent nu trebuie mutat.", "No existing file needs to move.") });
        const checks = [];
        if (plan.length) {
          const list = c.createDiv("ts-tidy-list ts-tidy-scroll");
          for (const it of plan) {
            const row = list.createEl("label", { cls: "ts-tidy-row" + (it.kind === "pdf" ? " pdf" : "") });
          row.addEventListener("mousedown", e => e.preventDefault());   // bifa se schimbă, dar lista nu sare (fără focus/scroll)
            const cb = row.createEl("input", { type: "checkbox" }); cb.checked = true; checks.push([cb, it]);
            const tx = row.createDiv(); tx.createDiv({ cls: "ts-tidy-old", text: it.file.path }); tx.createDiv({ cls: "ts-tidy-new", text: "→ " + it.to });
          }
        }
        const bar = c.createDiv("ts-tidy-bar");
        const no = bar.createEl("button", { text: T("Renunță", "Cancel") }); no.addEventListener("click", () => this.close());
        const only = bar.createEl("button", { text: plan.length ? T("Doar pentru referințele noi", "For new references only") : T("Aplică", "Apply") });
        only.addEventListener("click", async () => { Object.assign(S.filesConf(), draft); await S.save(); this.close(); onDone?.(); new Notice(T("Folderele noi se folosesc de acum.", "The new folders are used from now on.")); });
        if (plan.length) {
          const go = bar.createEl("button", { cls: "mod-cta" });
          const count = () => { const n = checks.filter(([cb]) => cb.checked).length; go.setText(T(`Aplică și mută ${n} fișiere`, `Apply and move ${n} files`)); go.disabled = !n; };
          checks.forEach(([cb]) => cb.addEventListener("change", count)); count();
          go.addEventListener("click", async () => {
            go.disabled = true; Object.assign(S.filesConf(), draft); await S.save();
            let ok = 0, bad = 0;
            for (const [cb, it] of checks) {
              if (!cb.checked) continue;
              try { const dir = it.to.slice(0, it.to.lastIndexOf("/")); await S.ensureFolder(dir); await S.app.fileManager.renameFile(it.file, S.freePath(dir, it.to.split("/").pop().replace(/\.[^.]+$/, ""), it.file.extension, it.file.path)); ok++; }
              catch (e) { bad++; console.error("Texere References: mutare", it.file.path, e); }
            }
            this.close(); onDone?.();
            new Notice(T(`Mutate: ${ok}`, `Moved: ${ok}`) + (bad ? T(` · nu s-au putut muta: ${bad} (vezi consola)`, ` · couldn't move: ${bad} (see the console)`) : ""), 8000);
          });
        }
      }
      onClose() { this.contentEl.empty(); }
    };
    new M(this.app).open();
  }
  // fereastra de previzualizare: bifezi ce vrei și redenumești prin Obsidian (linkurile din note și din evidențieri se actualizează)
  tidy(firstTime) {
    const S = this, T = (a, b) => this.T(a, b), plan = this.tidyPlan();
    if (!plan.length) { new Notice(T("Toate referințele au deja nume „Autor An – Titlu”.", "All references already have “Author Year – Title” names.")); return; }
    const M = class extends Modal {
      onOpen() {
        this.modalEl.addClass("texere-tidy"); this.titleEl.setText(T("Redenumește referințele", "Rename references"));
        const c = this.contentEl;
        c.createEl("p", { cls: "ts-hint", text: T("Notele și PDF-urile primesc numele „Autor An – Titlu”. Citările [@citekey] rămân la fel, iar Obsidian actualizează toate linkurile, inclusiv cele din adnotări.",
          "Notes and PDFs get “Author Year – Title” names. Citations [@citekey] stay the same, and Obsidian updates every link, including those in your annotations.") });
        const list = c.createDiv("ts-tidy-list ts-tidy-scroll"), checks = [];
        for (const it of plan) {
          const row = list.createEl("label", { cls: "ts-tidy-row" + (it.kind === "pdf" ? " pdf" : "") });
          row.addEventListener("mousedown", e => e.preventDefault());   // bifa se schimbă, dar lista nu sare (fără focus/scroll)
          const cb = row.createEl("input", { type: "checkbox" }); cb.checked = true; checks.push([cb, it]);
          const tx = row.createDiv(); tx.createDiv({ cls: "ts-tidy-old", text: (it.kind === "pdf" ? "PDF · " : "") + it.file.name });
          tx.createDiv({ cls: "ts-tidy-new", text: "→ " + it.to.split("/").pop() });
        }
        const bar = c.createDiv("ts-tidy-bar");
        const later = bar.createEl("button", { text: T("Nu acum", "Not now") }); later.addEventListener("click", () => this.close());
        const go = bar.createEl("button", { cls: "mod-cta" });
        const count = () => { const n = checks.filter(([cb]) => cb.checked).length; go.setText(T(`Redenumește ${n} fișiere`, `Rename ${n} files`)); go.disabled = !n; };
        checks.forEach(([cb]) => cb.addEventListener("change", count)); count();
        go.addEventListener("click", async () => {
          go.disabled = true; let ok = 0, bad = 0;
          for (const [cb, it] of checks) {
            if (!cb.checked) continue;
            try {
              await S.ensureFolder(it.to.slice(0, it.to.lastIndexOf("/")));
              const to = S.app.vault.getAbstractFileByPath(it.to) ? S.freePath(it.to.slice(0, it.to.lastIndexOf("/")), it.to.split("/").pop().replace(/\.[^.]+$/, ""), it.file.extension) : it.to;
              await S.app.fileManager.renameFile(it.file, to); ok++;
              if (it.kind === "note") await S.app.fileManager.processFrontMatter(it.file, fm => { const al = Array.isArray(fm.aliases) ? fm.aliases : fm.aliases ? [fm.aliases] : []; if (!al.includes("@" + it.key)) fm.aliases = [...al, "@" + it.key]; });
            } catch (e) { bad++; console.error("Texere References: redenumire", it.file.path, e); }
          }
          this.close();
          new Notice(T(`Redenumite: ${ok}`, `Renamed: ${ok}`) + (bad ? T(` · nu s-au putut redenumi: ${bad} (vezi consola)`, ` · couldn't rename: ${bad} (see the console)`) : ""), 8000);
        });
      }
      onClose() { this.contentEl.empty(); if (firstTime) { S.conf().tidyOffered = 2; S.save(); } }
    };
    new M(this.app).open();
  }
  // numele PDF-ului: ca nota (implicit), după alt șablon, sau păstrat cum vine (null)
  pdfBase(csl, key, noteBase) {
    const t = this.template(), mode = t.pdfMode || "note";
    if (mode === "keep") return null;
    if (mode === "custom") { const vars = this.tplVars(csl, key); return this.T_.fileBase(t.pdfName || this.T_.FILENAME, vars) || key; }
    return noteBase || this.fileBase(csl, key);
  }
  // un nume liber în folder: „…2001”, apoi „…2001 (2)”
  freePath(dir, base, ext, self) {
    let p = normalizePath(`${dir}/${base}.${ext}`), n = 2;
    while (this.app.vault.getAbstractFileByPath(p) && p !== self) p = normalizePath(`${dir}/${base} (${n++}).${ext}`);
    return p;
  }
  noteHeader(csl, key) {
    const t = this.template(), vars = this.tplVars(csl, key);
    const tpl = csl.type === "chapter" && csl["container-title"] && t.chapterHeader ? t.chapterHeader : t.header;
    return this.T_.render(tpl || "# {{title}}", vars);
  }
  // notele de literatură: au cheie (id) și eticheta din șablon
  isLitNote(fm) {
    if (!fm?.id) return false;
    const want = (this.T_?.tags(this.template().tag) || ["literature_note"]).map(t => String(t).replace(/^#/, "").toLowerCase());
    const has = (Array.isArray(fm.tags) ? fm.tags : fm.tags ? String(fm.tags).split(/[,\s]+/) : []).map(t => String(t).replace(/^#/, "").toLowerCase());
    return want.some(t => has.includes(t));
  }
  entryOf(fm, path) { const { tags, position, ...e } = fm; return JSON.parse(JSON.stringify({ ...e, obsidianPath: path })); }
  // bibliografia (bibliography.json) urmează notele: schimbi ceva în proprietățile unei note de literatură → intrarea ei se schimbă la fel
  syncFromNotes(h) {
    const mc = this.app.metadataCache, pend = new Map(), same = (a, b) => JSON.stringify(a, Object.keys(a).sort()) === JSON.stringify(b, Object.keys(b).sort());
    const run = async file => {
      const fm = mc.getFileCache(file)?.frontmatter; if (!this.isLitNote(fm)) return;
      const entry = this.entryOf(fm, file.path), all = this.lib.all();
      const i = all.findIndex(e => e.obsidianPath === file.path), j = all.findIndex(e => e.id === entry.id);
      if (i < 0 && j < 0) { await this.lib.add(entry); return; }
      const k = i >= 0 ? i : j; if (same(all[k], entry)) return;
      all[k] = entry; await this.lib.save();
    };
    if (mc.on) h.registerEvent(mc.on("changed", file => {
      if (!(file instanceof TFile) || file.extension !== "md") return;
      clearTimeout(pend.get(file.path)); pend.set(file.path, setTimeout(() => { pend.delete(file.path); run(file).catch(e => console.warn("Texere Referințe: bibliografia din notă", e)); }, 600));
    }));
  }
  // refă bibliografia din toate notele de literatură
  async rebuildFromNotes(quiet) {
    const mc = this.app.metadataCache, out = [], seen = new Set();
    for (const f of this.app.vault.getMarkdownFiles()) { const fm = mc.getFileCache(f)?.frontmatter; if (this.isLitNote(fm) && !seen.has(fm.id)) { seen.add(fm.id); out.push(this.entryOf(fm, f.path)); } }
    this.lib.entries = out; await this.lib.save();
    if (!quiet) new Notice(this.T(`Bibliografia e refăcută din note: ${out.length} referințe.`, `The bibliography was rebuilt from your notes: ${out.length} references.`), 5000);
    return out.length;
  }
  // setările de bază (o singură dată): bibliografia, regula cheii de citare, nota deschisă după adăugare, butonul Zotero
  async ownSettings() {
    const c = this.conf(); let ch = false;
    // fără o cale: cea veche, dacă bibliografia e deja acolo; altfel locul nou (Support/Texere/Bibliography)
    if (!c.bibPath) { const V = this.app.vault; c.bibPath = V.getAbstractFileByPath(BIB_OLD) || V.getAbstractFileByPath(BIB_OLD.slice(0, BIB_OLD.lastIndexOf("/"))) ? BIB_OLD : BIB_DEFAULT; ch = true; }
    if (!c.citekey) { c.citekey = CITEKEY_DEFAULT; ch = true; }
    if (c.openNote === undefined) { c.openNote = true; ch = true; }
    if (c.zoteroConnector === undefined) { c.zoteroConnector = false; ch = true; }
    // folderul foarte vechi al bibliografiei („Support/Admin/biblib”) ajunge în Support/Texere/Bibliography, prin Obsidian (linkurile urmează)
    const OLD = "Support/Admin/biblib", dir = c.bibPath.slice(0, c.bibPath.lastIndexOf("/"));
    if (dir === OLD) {
      const NEW = BIB_DEFAULT.slice(0, BIB_DEFAULT.lastIndexOf("/")), from = this.app.vault.getAbstractFileByPath(OLD);
      try {
        if (from && !this.app.vault.getAbstractFileByPath(NEW)) {
          let cur = ""; for (const part of NEW.split("/").slice(0, -1)) { cur = cur ? `${cur}/${part}` : part; if (!this.app.vault.getAbstractFileByPath(cur)) { try { await this.app.vault.createFolder(cur); } catch (e) {} } }
          await this.app.fileManager.renameFile(from, NEW);
        }
        if (this.app.vault.getAbstractFileByPath(NEW + c.bibPath.slice(OLD.length)) || !from) { c.bibPath = NEW + c.bibPath.slice(OLD.length); ch = true; }
      } catch (e) { console.warn("Texere References: mutarea bibliografiei", e); }
    }
    if (ch) await this.save();
  }
  // folderele: note, PDF-uri, Inbox (Setări → Nume și foldere); pot folosi variabile, ex. „Documents/{{authorsShort}}”
  filesConf() {
    const c = this.conf();
    if (!c.files) {
      const at = p => existingPrefix(this.app, p) || p;   // „1. Sources”, dacă așa e în vault
      c.files = { notes: at("01. References/Reading Notes"), pdfs: at("01. References/PDFs"), inbox: at("01. References/PDFs/Inbox") };
      this.save();
    }
    return c.files;
  }
  // partea fixă a unui folder cu variabile: „Documents/{{authorsShort}}” → „Documents”
  rootOf(p) { p = String(p || "").replace(/\/+$/, ""); const i = p.indexOf("{{"); if (i < 0) return p; return p.slice(0, i).replace(/\/[^/]*$/, "").replace(/\/+$/, ""); }
  litDir() { return this.rootOf(this.filesConf().notes || "01. References/Reading Notes") + "/"; }
  docDir() { return this.rootOf(this.filesConf().pdfs || "01. References/PDFs"); }
  inboxDir() { return String(this.filesConf().inbox || this.docDir() + "/Inbox").replace(/\/+$/, ""); }
  // folderul unei surse anume: variabilele șablonului; fiecare parte a căii fără caractere interzise
  dirFor(tpl, csl, key) {
    const vars = this.tplVars(csl, key); vars.noteName = this.fileBase(csl, key);
    const out = this.T_.render(String(tpl || ""), vars).split("/").map(x => x.replace(/[\\:*?"<>|#^[\]]+/g, " ").replace(/\s+/g, " ").trim()).filter(Boolean).join("/");
    return normalizePath(out || this.rootOf(tpl));
  }
  notesDir(csl, key) { return this.dirFor(this.filesConf().notes, csl, key); }
  pdfDir(csl, key) { return this.dirFor(this.filesConf().pdfs, csl, key); }
  async ensureFolder(dir, force) {
    if (!dir || this.app.vault.getAbstractFileByPath(dir)) return;
    // folderul surselor (notele sau PDF-urile) a fost redenumit sau șters: nu-l refacem pe ascuns cu numele vechi, altfel sursa ar ajunge în alt folder decât al tău
    if (!force) { const g = Object.values(this.goneSafe()).find(r => dir === r || dir.startsWith(r + "/")); if (g) throw new Error(this.T(`folderul „${g}” nu mai e în vault; alege în Texere · Referințe unde se salvează referințele`, `the folder “${g}” isn't in your vault anymore; choose in Texere · References where references are saved`)); }
    let cur = ""; for (const part of dir.split("/")) { cur = cur ? cur + "/" + part : part; if (!this.app.vault.getAbstractFileByPath(cur)) { try { await this.app.vault.createFolder(cur); } catch (e) {} } }
    try { this.host?.core?.trackSeen?.(); } catch (e) {}   // de acum, dacă dispare, Texere te întreabă
  }
  // datele unei note de literatură, cât trebuie pentru nume și foldere
  cslOfFm(fm) { return { type: fm.type, title: fm.title, "title-short": fm["title-short"], author: fm.author, editor: fm.editor, issued: fm.issued, "original-date": fm["original-date"], DOI: fm.DOI, ISBN: fm.ISBN }; }
  bibPath() { return this.conf().bibPath || BIB_DEFAULT; }
  // lista folderelor din vault sub un câmp (Obsidian ≥ 1.4; altfel o listă simplă de sugestii a browserului)
  folderSuggest(inputEl, onPick) {
    try { if (FolderSuggest) return new FolderSuggest(this.app, inputEl, onPick); } catch (e) {}
    try {
      const id = "texere-folders-" + Math.random().toString(36).slice(2), dl = document.createElement("datalist"); dl.id = id;
      for (const f of this.app.vault.getAllLoadedFiles?.() || []) if (f.children && f.path && f.path !== "/" && !/(^|\/)\./.test(f.path)) { const o = document.createElement("option"); o.value = f.path; dl.appendChild(o); }
      inputEl.after(dl); inputEl.setAttribute("list", id);
    } catch (e) {}
    return null;
  }
  enabled() { const c = this.conf(), off = new Set(c.disabled); return this.providers.filter(p => !off.has(p.id) && (!p.requires || c[p.requires])); }

  // un fișier al modulului (sunt toate în pachet); _mods îi ține pe cei încărcați, pentru Export
  async mod(name) {
    this._mods = this._mods || {};
    if (this._mods[name]) return this._mods[name];
    const load = MODS[name]; if (!load) throw new Error("Texere References: " + name + " nu există");
    return (this._mods[name] = load());
  }

  // numele comenzilor: „Texere · Surse · acțiunea” / „Texere · Export · acțiunea” (doar cele generale păstrează „Texere – The Researcher's Vault”)

  async load() {
    const h = this.host;
    // biblioteca comună: o singură copie a bibliografiei, pentru căutare, citări, sugestii @ și statistici
    this.T_ = await this.mod("template");   // șablonul notei (câmpurile tale, eticheta, titlul)
    await this.ownSettings();
    setTimeout(() => this.renameAttachLinks().catch(e => console.warn("Texere References: attachment", e)), 5000);
    const Library = await this.mod("library");
    this.lib = h.lib = new Library(this.app, () => this.bibPath());
    await this.lib.load(); this.lib.watch(h);
    this.syncFromNotes(h);
    // citările (sugestiile @, afișarea în stilul ales, butonul de stil) și panoul de statistici, fiecare separat, ca o eroare într-unul să nu le oprească pe celelalte
    try { await (await this.mod("cite")).install(h); } catch (e) { console.error("Texere Referințe: citările", e); }
    try { await (await this.mod("stats")).install(h); } catch (e) { console.error("Texere References: statisticile", e); }
    try { (await this.mod("highlights")).install(this); } catch (e) { console.error("Texere Referințe: adnotările", e); }
    try { (await this.mod("distil")).install(this); } catch (e) { console.error("Texere Referințe: Distilează", e); }
    try { (await this.mod("zotero")).install(this); } catch (e) { console.error("Texere References: Zotero", e); }
    for (const p of PROVIDERS) { if (p?.id && typeof p.search === "function") this.providers.push(p); }
    this.providers.sort((a, b) => (a.order ?? 50) - (b.order ?? 50));
    // în paleta de comenzi: doar ce folosești des; restul e în meniul notei (clic dreapta), în bara de jos și în setări
    const T = (a, b) => this.T(a, b), isLit = f => f instanceof TFile && f.extension === "md" && f.path.startsWith(this.litDir());
    h.addCommand({ id: "sources-search", name: T("Adaugă o referință", "Add a reference"), callback: () => this.open() });
    h.addCommand({ id: "sources-bibtex", name: T("Lipește o referință", "Paste a reference"), callback: () => this.open("", "bibtex") });
    // meniul notei (clic dreapta în notă sau pe numele ei): un singur rând „Texere”, cu ce se poate face acolo (shared/notemenu.js)
    const nm = noteMenu(h.core);
    nm.add("sources", ctx => this.menuItems(ctx, isLit), 10);
    h.register(() => nm.remove("sources"));
    h.registerEvent(this.app.vault.on("delete", async f => {
      if (!(f instanceof TFile) || f.extension !== "md" || !f.path.startsWith(this.litDir())) return;
      await this.lib.removePath(f.path);
    }));
    h.addSettingTab(this.settingTab = new SourcesSettingTab(this));
    this.selfTest().catch(e => console.error("Texere References: test", e));
    // catalogarea unui PDF fără sursă: din meniul PDF-ului (clic dreapta), din comenzi, sau când apare unul în Inbox
    h.addCommand({ id: "sources-catalog", name: T("Adaugă acest PDF ca referință", "Add this PDF as a reference"), checkCallback: chk => { const f = this.app.workspace.getActiveFile(); if (!f || !DOC_EXT.test(f.extension)) return false; if (!chk) this.catalog(f); return true; } });
    this.app.workspace.onLayoutReady?.(() => {
      const inInbox = p => String(p || "").startsWith(this.inboxDir() + "/");
      h.registerEvent(this.app.vault.on("create", f => { if (f instanceof TFile && DOC_EXT.test(f.extension) && inInbox(f.path)) this.inboxNotice(f); }));
      h.registerEvent(this.app.vault.on("rename", (f, old) => { if (f instanceof TFile && DOC_EXT.test(f.extension) && inInbox(f.path) && !inInbox(old)) this.inboxNotice(f); }));
      // (un folder al surselor redenumit în Obsidian: setările îl urmează singure, din core/tidy.js)
    });
    // bara de jos (locul comun al lui Texere): pentru un PDF/EPUB, „Vezi nota” sau „Adaugă ca sursă”; pentru nota unei surse, „Vezi PDF-ul”
    try { this.catalogStatus(h); } catch (e) { console.warn("Texere References: bara de jos", e); }
    // refacerea bibliografiei și redenumirea surselor după regulă: butoane în Settings → Texere → Sources → Avansat (rebuildFromNotes, tidy);
    // redenumirea nu mai apare singură la pornire: pagina Texere o propune (tidyPlan)
  }

  open(q, mode) { const m = new SearchModal(this, q); m.mode0 = mode; m.open(); }
  // același ecran „Adaugă o sursă”, desenat într-o pagină (tab-ul nou) în loc de fereastră
  panel(el, done) { return mountIn(new SearchModal(this, ""), el, done); }

  // cerere HTTP prin Obsidian (fără limitările browserului); { status, json, text, bytes }
  async http(url, opts = {}) {
    try {
      const ms = opts.timeout || 20000;
      const r = await Promise.race([requestUrl({ url, method: opts.method || "GET", headers: opts.headers || {}, throw: false }), new Promise((_, no) => later(() => no(new Error("timeout")), ms))]);
      try { this.track(url, r); } catch (e) {}
      return { status: r.status, get json() { try { return r.json; } catch (e) { return null; } }, get text() { return r.text; }, bytes: () => r.arrayBuffer, headers: r.headers };
    } catch (e) { return { status: 0, error: e }; }
  }
  // ——— limitele cataloagelor: câte căutări mai ai și când se refac (din răspunsurile lor; SerpApi și OpenAlex le spun exact, gratuit) ———
  track(url, r) {
    let host = ""; try { host = new URL(url).hostname; } catch (e) { return; }
    const c = this.conf(), u = c.usage || (c.usage = {}), now = Date.now(), h = r.headers || {}, get = k => h[k] ?? h[k.toLowerCase()] ?? h[k.replace(/(^|-)([a-z])/g, (m, a, b) => a + b.toUpperCase())];
    let ch = false;
    if (host === "api.openalex.org" && !/\/rate-limit/.test(url)) {
      const rem = parseFloat(get("x-ratelimit-remaining")), lim = parseFloat(get("x-ratelimit-limit")), used = parseFloat(get("x-ratelimit-credits-used")), reset = parseFloat(get("x-ratelimit-reset"));
      const o = u.openalex || (u.openalex = {});
      if (Number.isFinite(rem)) { o.left = rem; if (Number.isFinite(lim)) o.limit = lim; if (/[?&]search=/.test(url) && used > 0) o.cost = used; o.at = now; o.resetAt = Number.isFinite(reset) ? now + reset * 1000 : nextUtcMidnight(); ch = true; }
      if (r.status === 429) { o.left = 0; o.at = now; if (!(o.resetAt > now)) o.resetAt = nextUtcMidnight(); ch = true; }
    } else if (host === "serpapi.com" && /\/search/.test(url)) {
      let out = false; try { out = r.status === 429 || /run out of searches/i.test(r.text || ""); } catch (e) {}
      if (out) { u.googlescholar = { ...(u.googlescholar || {}), left: 0, at: now }; ch = true; }
      clearTimeout(this._serpT); this._serpT = setTimeout(() => this.refreshUsage("googlescholar"), 1500);   // SerpApi spune exact câte mai ai (fără să consume o căutare)
    } else if (host === "api.semanticscholar.org" && r.status === 429) { u.semanticscholar = { busyUntil: now + 60000, at: now }; ch = true; }
    else if (host === "www.googleapis.com" && /\/books\//.test(url)) {
      if (r.status === 429) { u.googlebooks = { left: 0, at: now, resetAt: nextPacificMidnight() }; ch = true; }
      else if (r.status === 200 && u.googlebooks) { delete u.googlebooks; ch = true; }
    }
    if (ch) { clearTimeout(this._usageSave); this._usageSave = setTimeout(() => this.save(), 2000); for (const f of [...(this._usageHooks || [])]) { try { f(); } catch (e) {} } }
  }
  // întreabă direct (gratuit): SerpApi → account.json; OpenAlex (cu cheie) → /rate-limit
  async refreshUsage(id) {
    const c = this.conf(), u = c.usage || (c.usage = {}), now = Date.now();
    try {
      if ((!id || id === "googlescholar") && c.serpapiKey) {
        const r = await requestUrl({ url: `https://serpapi.com/account.json?api_key=${encodeURIComponent(c.serpapiKey)}`, throw: false });
        const j = r.status === 200 ? r.json : null;
        if (j && j.total_searches_left != null) u.googlescholar = { left: +j.total_searches_left, limit: +j.searches_per_month || null, used: +j.this_month_usage || 0, renew: j.plan_renewal_date || null, at: now };
      }
      if ((!id || id === "openalex") && c.openalexKey) {
        const r = await requestUrl({ url: `https://api.openalex.org/rate-limit?api_key=${encodeURIComponent(c.openalexKey)}`, throw: false });
        const j = r.status === 200 ? (r.json?.rate_limit || r.json) : null;
        if (j && j.daily_remaining_usd != null) u.openalex = { ...(u.openalex || {}), usd: true, left: +j.daily_remaining_usd, limit: +j.daily_budget_usd || null, at: now, resetAt: j.resets_in_seconds != null ? now + j.resets_in_seconds * 1000 : nextUtcMidnight() };
      }
    } catch (e) { console.warn("Texere References: limitele", e); }
    for (const f of [...(this._usageHooks || [])]) { try { f(); } catch (e) {} }
  }
  // OpenAlex: bugetul zilei, în căutări (o căutare costă cât a costat ultima, altfel 1/1000 din bugetul cu cheie)
  oaSearches(o) {
    if (!o || o.left == null) return null;
    if (o.usd || (o.limit != null && o.limit <= 10)) return Math.floor(o.left / 0.001);
    return Math.floor(o.left / (o.cost || 10));
  }
  limited(id) {
    const u = this.conf().usage?.[id], now = Date.now(); if (!u) return null;
    if (id === "semanticscholar") return u.busyUntil > now ? u : null;
    if (id === "openalex") return u.resetAt > now && this.oaSearches(u) <= 0 ? u : null;
    if (u.left === 0) { if (u.resetAt && u.resetAt <= now) return null; if (u.renew && Date.parse(u.renew) <= now) return null; return u; }
    return null;
  }
  // eticheta din Setări și motivul din căutare: { text, cls, title } sau null (cataloagele fără limite)
  usageInfo(id) {
    const T = (a, b) => this.T(a, b), c = this.conf(), u = c.usage?.[id], now = Date.now(), loc = this.en ? "en-GB" : "ro-RO";
    const at = t => new Date(t).toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" }), day = t => new Date(t).toLocaleDateString(loc, { day: "numeric", month: "short" });
    // cât mai e până se reface: „3 h 20 min”, „45 min”
    const left = t => { const m = Math.max(1, Math.ceil((t - Date.now()) / 60000)), h = Math.floor(m / 60), r = m % 60; return h ? (r ? `${h} h ${r} min` : `${h} h`) : `${r} min`; };
    if (id === "openalex") {
      const per = c.openalexKey ? 1000 : 100;
      if (!u || u.left == null || !(u.resetAt > now)) return { cls: "", text: T(`≈ ${per} căutări pe zi`, `≈ ${per} searches a day`), title: c.openalexKey ? T("Cu cheia ta: un buget de 1 $ pe zi (≈ 1.000 de căutări). Se reface la miezul nopții UTC.", "With your key: a $1 daily budget (≈ 1,000 searches). Resets at midnight UTC.") : T("Fără cheie: ≈ 100 de căutări pe zi. Cu o cheie gratuită: ≈ 1.000.", "Without a key: ≈ 100 searches a day. With a free key: ≈ 1,000.") };
      const n = this.oaSearches(u);
      if (n <= 0) return { cls: "bad", text: T(`limită atinsă · se reface în ${left(u.resetAt)}`, `limit reached · resets in ${left(u.resetAt)}`), title: T(`Se reface la ${at(u.resetAt)}.`, `Resets at ${at(u.resetAt)}.`) + (c.openalexKey ? "" : " " + T("Cu o cheie gratuită ai de 10 ori mai multe.", "A free key gives you 10 times more.")) };
      return { cls: n < per * 0.1 ? "warn" : "ok", text: T(`≈ ${n.toLocaleString(loc)} căutări rămase azi`, `≈ ${n.toLocaleString(loc)} searches left today`), title: T(`Se reface la ${at(u.resetAt)}.`, `Resets at ${at(u.resetAt)}.`) };
    }
    if (id === "googlescholar") {
      if (!c.serpapiKey) return null;
      if (!u || u.left == null) return { cls: "", text: T("250 de căutări pe lună (plan gratuit)", "250 searches a month (free plan)") };
      const renew = u.renew ? T(` · se reînnoiește pe ${day(u.renew)}`, ` · renews ${day(u.renew)}`) : "";
      if (u.left <= 0) return { cls: "bad", text: T("limită atinsă", "limit reached") + renew };
      return { cls: u.limit && u.left < u.limit * 0.1 ? "warn" : "ok", text: u.limit ? T(`${u.left} din ${u.limit} rămase luna asta`, `${u.left} of ${u.limit} left this month`) : T(`${u.left} căutări rămase`, `${u.left} searches left`), title: renew.replace(/^ · /, "") };
    }
    if (id === "semanticscholar" && u?.busyUntil > now) return { cls: "warn", text: T("prea multe cereri · încearcă peste un minut", "too many requests · try again in a minute"), title: c.s2Key ? "" : T("Fără cheie, toți utilizatorii împart aceeași limită.", "Without a key, everyone shares the same limit.") };
    if (id === "googlebooks" && u?.left === 0 && u.resetAt > now) return { cls: "bad", text: T(`limită atinsă azi · se reface în ${left(u.resetAt)}`, `daily limit reached · resets in ${left(u.resetAt)}`), title: T(`Se reface la ${at(u.resetAt)}.`, `Resets at ${at(u.resetAt)}.`) };
    return null;
  }
  // un PDF gratuit pentru o notă tocmai creată (fără mesaje): numele lui sau null
  async freePdfFor(file, x) {
    const e = this.lib.all().find(v => v.obsidianPath === file.path), key = e?.id || file.basename.replace(/^@/, "");
    const csl = x.zotero?.csl || this.cslOfFm(this.app.metadataCache.getFileCache(file)?.frontmatter || {});
    const y = { ...x, pdf: x.pdf || [] }; if (!y.doi) { try { y.doi = await this.findDoi(y); } catch (err) {} }
    if (!y.doi && !y.pdf.length) return null;
    const name = await this.onePdf(file, () => this.fetchPdf(y, this.pdfBase(csl, key, file.basename.replace(/^@/, "")), key, this.pdfDir(csl, key)));
    if (y._pdfUrl) x._pdfUrl = y._pdfUrl;
    if (!name) return null;
    await this.attachPdf(this.app.vault.getAbstractFileByPath(file.path) || file, key, name);
    return name;
  }
  ctx() {
    const self = this;
    return {
      conf: this.conf(), fold, stripTags, normTitle, cleanDoi, isbn13, splitName, zotero: this.zotero,
      // „constantin vică” arată ca un nume (2–4 cuvinte, fără cifre și fără „of”, „and”…); atunci cataloagele caută și după autor
      looksLikeName: q => { const w = normTitle(q).split(" ").filter(Boolean); return w.length >= 2 && w.length <= 4 && !/\d/.test(q) && !w.some(x => STOP.has(x) || /^(si|de|la|in|cu|pe|din|al|ale)$/.test(x)); },
      sameName: (name, q) => { const n = normTitle(name).split(" "), t = normTitle(q).split(" ").filter(Boolean); return t.every(x => n.includes(x) || (x.length === 1 && n.some(y => y.startsWith(x)))); },
      async json(url, headers) {
        const r = await self.http(url, { headers: Object.assign({ Accept: "application/json" }, headers || {}) });
        if (r.status === 200) return r.json;
        if (r.status === 404) return null;   // nu există (ex. un DOI necunoscut acestui catalog)
        const e = new Error("HTTP " + r.status); e.status = r.status; e.limit = r.status === 429 || r.status === 409 || r.status === 403; throw e;
      },
    };
  }

  // caută în toate cataloagele deodată; onUpdate primește rezultatele pe măsură ce sosesc
  search(q, filters, onUpdate) {
    let ps = this.enabled().filter(p => !filters.providers || filters.providers.has(p.id)).filter(p => filters.type === "all" || !p.types || p.types.includes(filters.type));
    // un link de profil (Google Scholar) sau un ORCID iD se caută doar în catalogul lui
    if (/scholar\.google\.[a-z.]+\/citations/i.test(q)) ps = ps.filter(p => p.id === "googlescholar");
    else if (/^\s*(https?:\/\/|pmc\d+\s*$|pmid:?\s*\d+\s*$|q\d+\s*$|arxiv:)/i.test(q) && !this.ctx().cleanDoi(q)) ps = ps.filter(p => p.id === "citoid");
    else if (/\d{4}-\d{4}-\d{4}-\d{3}[\dX]/i.test(q)) ps = ps.filter(p => p.id === "orcid");
    const lists = {}, status = {}, cards = {}; const ctx = this.ctx();
    for (const p of ps) status[p.id] = "busy";
    const done = () => { const m = this.merge(lists); onUpdate(this.rank(m, q, filters), { ...status }, Object.values(cards), m); };
    onUpdate([], { ...status }, []);
    return Promise.all(ps.map(async p => {
      if (this.limited(p.id)) { status[p.id] = "limit"; (this.errors = this.errors || {})[p.id] = this.usageInfo(p.id)?.text || "limit"; done(); return; }   // limita atinsă: nu-l mai întreb până se reface
      try {
        const t = new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error("timeout"), { timeout: true })), 30000));
        const items = await Promise.race([p.search(q, filters, ctx), t]);
        if (items?.card) cards[p.id] = { ...items.card, source: p.id };
        lists[p.id] = (items || []).filter(x => x && x.title).map((x, i) => ({ ...x, source: p.id, rank: i }));
        status[p.id] = "ok";
      } catch (e) { status[p.id] = e.limit ? "limit" : "err"; (this.errors = this.errors || {})[p.id] = e.timeout ? "timeout" : e.status ? "HTTP " + e.status : String(e.message || e).slice(0, 60); console.warn("Texere References:", p.id, e); }
      done();
    }));
  }
  // scite pentru un DOI: { s, c, m } sau null; păstrat cât e deschis Obsidian
  async scite(doi) {
    this.sciteCache = this.sciteCache || new Map();
    const k = doi.toLowerCase(); if (this.sciteCache.has(k)) return this.sciteCache.get(k);
    const p = this.http(`https://api.scite.ai/tallies/${doi}`, { headers: { Accept: "application/json" } }).then(r => {
      const j = r.status === 200 ? r.json : null;
      return j ? { s: j.supporting || 0, c: j.contradicting || 0, m: j.mentioning || 0 } : null;
    });
    this.sciteCache.set(k, p); const v = await p; this.sciteCache.set(k, v); return v;
  }
  key(x) {
    const d = cleanDoi(x.doi); if (d) return "doi:" + d.toLowerCase();
    const i = isbn13(x.isbn); if (i) return "isbn:" + i;
    return "t:" + normTitle(x.title).slice(0, 90) + "|" + (x.year || "");
  }
  merge(lists) {
    const map = new Map();
    for (const [pid, items] of Object.entries(lists)) for (const x of items) {
      const k = this.key(x), cur = map.get(k);
      const score = 1 / (x.rank + 3);
      if (!cur) { map.set(k, { ...x, doi: cleanDoi(x.doi), isbn: isbn13(x.isbn) || null, pdf: [...(x.pdf || [])], sources: [pid], score }); continue; }
      for (const f of ["title", "year", "type", "venue", "publisher", "volume", "issue", "page", "url", "isbn", "abstract", "lang"]) if (!cur[f] && x[f]) cur[f] = f === "isbn" ? isbn13(x[f]) : x[f];
      if ((!cur.authors || !cur.authors.length) && x.authors?.length) cur.authors = x.authors;
      if (x.cited != null) cur.cited = Math.max(cur.cited || 0, x.cited);
      cur.oa = cur.oa || x.oa; for (const u of x.pdf || []) if (!cur.pdf.includes(u)) cur.pdf.push(u);
      if (cur.fwci == null && x.fwci != null) cur.fwci = x.fwci;
      if (!cur.csl && x.csl) cur.csl = x.csl;
      if (!cur.zotero && x.zotero) cur.zotero = x.zotero;
      cur.top1 = cur.top1 || x.top1; cur.top10 = cur.top10 || x.top10; cur.retracted = cur.retracted || x.retracted; if (x.lists?.length) cur.lists = [...new Set([...(cur.lists || []), ...x.lists])];
      if (!cur.sources.includes(pid)) cur.sources.push(pid); cur.score += score;
    }
    // o carte fără DOI dintr-un catalog și aceeași carte cu DOI din altul: le unim după titlu + an
    const byT = new Map();
    for (const [k, v] of map) if (!k.startsWith("t:")) byT.set(normTitle(v.title).slice(0, 90) + "|" + (v.year || ""), k);
    for (const [k, v] of [...map]) if (k.startsWith("t:")) {
      const tk = byT.get(k.slice(2)); if (!tk) continue;
      const cur = map.get(tk); for (const s of v.sources) if (!cur.sources.includes(s)) cur.sources.push(s); if (!cur.zotero && v.zotero) cur.zotero = v.zotero;
      cur.score += v.score; for (const u of v.pdf || []) if (!cur.pdf.includes(u)) cur.pdf.push(u); map.delete(k);
    }
    return [...map.values()];
  }
  // relevanță: câte dintre cuvintele căutate apar în titlu sau la autori (ex. „constantin vică” = un autor),
  // apoi titlul/numele întreg, acordul mai multor cataloage, locul în fiecare catalog și citările
  rank(items, q, f) {
    const STOPQ = new Set(["the", "and", "of", "in", "on", "a", "an", "to", "for", "de", "si", "la", "in", "cu", "pe", "din", "al", "ale", "lui"]);
    const toks = [...new Set(normTitle(q).split(" ").filter(w => w.length > 1 && !STOPQ.has(w)))];
    const ok = x => (f.type === "all" || this.kind(x.type) === f.type) && (!f.from || !x.year || x.year >= +f.from) && (!f.to || !x.year || x.year <= +f.to);
    const phrase = toks.join(" ");
    for (const x of items) {
      const t = " " + normTitle(x.title) + " ", tw = new Set(t.trim().split(" "));
      const people = (x.authors || []).map(a => normTitle([a.given, a.family, a.literal].filter(Boolean).join(" ")));
      const aw = new Set(people.join(" ").split(" ").filter(Boolean)), vw = new Set(normTitle(x.venue || "").split(" "));
      let hit = 0;
      for (const w of toks) { if (aw.has(w)) hit += 1; else if (tw.has(w) || (w.length > 4 && t.includes(" " + w))) hit += 1; else if (vw.has(w)) hit += 0.3; }
      const cover = toks.length ? hit / toks.length : 0;
      let s = cover * cover * 4;                                                        // toate cuvintele găsite contează cel mai mult
      if (toks.length > 1 && t.includes(" " + phrase + " ")) s += 1.2;                   // titlul conține exact ce ai scris
      if (toks.length > 1 && people.some(p => toks.every(w => p.split(" ").includes(w)))) s += 1.5;   // un singur autor are tot numele căutat
      // impactul, corectat cu vechimea (citări pe an) și cu domeniul (FWCI), ca o lucrare nouă să nu piardă în fața uneia vechi
      const age = Math.max(1, new Date().getFullYear() - (x.year || new Date().getFullYear()) + 1), perYear = (x.cited || 0) / age;
      s += Math.min(x.sources.length - 1, 2) * 0.3 + x.score * 0.5 + Math.log10(1 + perYear) * 0.7 + Math.min(x.fwci || 0, 10) * 0.04;
      if (!x.authors?.length) s -= 0.4;                                                  // fără autori: de obicei intrări de dicționar, recenzii
      if (/^(entry|entry-encyclopedia|entry-dictionary|document)$/.test(x.type) || /dictionary|encyclopedia|lexikon/i.test(x.venue || "")) s -= 0.6;
      x._s = s; x._cover = cover;
      // influența: FWCI (citări față de media domeniului și a anului), locul între cele mai citate (top 1% / 10%),
      // citările pe an și, dacă există, ce spun citările (susțin / contrazic); pentru cărți fără FWCI contează citările pe an
      const sc = x.scite && (x.scite.s + x.scite.c) ? (x.scite.s - x.scite.c) / (x.scite.s + x.scite.c) : 0;
      // fără FWCI (des la cărți) îl estimăm din citările pe an, ca o carte citată să nu ajungă la coadă
      x._impact = Math.log2(1 + Math.min(x.fwci != null ? x.fwci : perYear / 2, 50)) * 2 + (x.top1 ? 1.5 : x.top10 ? 0.8 : 0) + Math.log10(1 + perYear) * 1.5 + sc * 0.3;
    }
    // dacă sunt destule rezultate cu toate cuvintele căutate, celelalte dispar din listă
    const full = items.filter(x => ok(x) && x._cover >= 1).length, min = full >= 5 ? 1 : full ? 0.5 : 0;
    const by = f.sort === "impact" ? (a, b) => b._impact - a._impact || b._s - a._s : f.sort === "cited" ? (a, b) => (b.cited || 0) - (a.cited || 0) || b._s - a._s : f.sort === "newest" ? (a, b) => (b.year || 0) - (a.year || 0) || b._s - a._s : (a, b) => b._s - a._s;
    return items.filter(ok).filter(x => x._cover >= min).sort(by).slice(0, 100);
  }
  kind(t) { return /^(book)$/.test(t) ? "book" : /^(chapter|entry|entry-encyclopedia|entry-dictionary)$/.test(t) ? "chapter" : "article"; }

  // sursele deja în vault (după DOI, ISBN sau titlu)
  library() {
    const dois = new Map(), isbns = new Map(), titles = new Map(), keys = new Set();
    for (const f of this.app.vault.getMarkdownFiles()) {
      if (!f.path.startsWith(this.litDir())) continue;
      const fm = this.app.metadataCache.getFileCache(f)?.frontmatter; if (!fm) continue;
      if (fm.id) keys.add(String(fm.id));
      const d = cleanDoi(fm.DOI); if (d) dois.set(d.toLowerCase(), f);
      for (const i of String(fm.ISBN || "").split(/[\s,;]+/)) { const n = isbn13(i); if (n) isbns.set(n, f); }
      if (fm.title) titles.set(normTitle(fm.title), f);
    }
    return { keys, find: x => (x.doi && dois.get(x.doi.toLowerCase())) || (x.isbn && isbns.get(x.isbn)) || titles.get(normTitle(x.title)) || null };
  }

  // datele complete: după DOI din registrul DOI (Crossref, DataCite…), altfel din ce a dat catalogul
  async findDoi(x) {
    if (!x.title || x.type === "book") return null;
    const fam = x.authors?.[0]?.family || "";
    const r = await this.http(`https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(x.title + " " + fam)}&rows=5&select=DOI,title,author,issued`);
    const it = (r.status === 200 ? r.json?.message?.items : []) || [];
    const hit = it.find(i => normTitle(i.title?.[0]) === normTitle(x.title) && (!fam || (i.author || []).some(a => fold(a.family) === fold(fam))));
    return hit ? cleanDoi(hit.DOI) : null;
  }
  async fullCsl(x) {
    if (x.zotero?.csl?.title) return cleanCsl({ ...x.zotero.csl });   // din biblioteca ta Zotero: datele tale, așa cum le-ai pus acolo
    if (!x.doi) { try { x.doi = await this.findDoi(x); } catch (e) {} }
    if (x.doi) {
      const r = await this.http(`https://doi.org/${x.doi}`, { headers: { Accept: "application/vnd.citationstyles.csl+json" } });
      let c = r.status === 200 ? r.json : null;
      if (!c) { const r2 = await this.http(`https://api.crossref.org/works/${x.doi}/transform/application/vnd.citationstyles.csl+json`); c = r2.status === 200 ? r2.json : null; }
      if (c && c.title) { const o = cleanCsl(c); if (!o.abstract && x.abstract) o.abstract = x.abstract; return o; }
    }
    const p = this.providers.filter(p => x.sources?.includes(p.id) && typeof p.full === "function").sort((a, b) => (a.id === "citoid" ? -1 : 0) - (b.id === "citoid" ? -1 : 0))[0];
    if (p) { try { const c = await p.full(x, this.ctx()); if (c?.title) return cleanCsl(c); } catch (e) {} }
    return cleanCsl({ type: x.type || "document", title: x.title, author: x.authors, "container-title": x.venue, publisher: x.publisher,
      issued: x.year ? { "date-parts": [[x.year]] } : undefined, DOI: x.doi, ISBN: x.isbn, URL: x.url, volume: x.volume, issue: x.issue, page: x.page, abstract: x.abstract });
  }

  // cheia pe care o va primi o referință nouă (ca s-o scrii în [@cheie] înainte să existe nota)
  keyFor(csl) { const lib = this.library(); return this.citekey(csl, new Set([...lib.keys, ...this.lib.all().map(e => e.id)])); }
  // cheia de citare după regula din Setări → Nume și foldere (implicit: {{author|lowercase}}_{{title|titleword}}_{{year}})
  citekey(csl, taken) {
    const base = this.citekeyBase(csl);
    let k = base, n = 1;
    const exists = k => taken.has(k) || this.app.vault.getAbstractFileByPath(normalizePath(this.litDir() + "@" + k + ".md"));
    while (exists(k)) k = base + String.fromCharCode(97 + n++);   // ex. smith_mind_2001b
    return k;
  }
  citekeyBase(csl, tpl) {
    const a = csl.author?.[0] || csl.editor?.[0] || {};
    const fam = String(a.family || a.literal || "anon").trim() || "anon", y = csl.issued?.["date-parts"]?.[0]?.[0] || "nd";
    const plain = v => String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");   // fără diacritice (Gândește → Gandeste), cu literele mari păstrate
    const vars = { ...this.tplVars(csl, ""), author: plain(fam), authors: (csl.author || []).map(p => plain(p.family || p.literal)).filter(Boolean).join(" "), year: String(y), title: plain(csl.title) };
    let out = ""; try { out = this.T_.render(tpl || this.conf().citekey || CITEKEY_DEFAULT, vars); } catch (e) {}
    // doar litere fără diacritice, cifre și _ - : (cheile merg în [@cheie] și în nume de fișiere)
    out = plain(out).replace(/\s+/g, "_").replace(/[^A-Za-z0-9_:\-]+/g, "").replace(/_+/g, "_").replace(/^[_\-:]+|[_\-:]+$/g, "");
    if (!out) out = [fold(fam).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "anon", titleWord(csl.title), y].filter(Boolean).join("_");
    return out;
  }

  // PDF gratuit: adună toate adresele cunoscute, din toate sursele, și le încearcă pe rând
  async pdfCandidates(x) {
    const urls = [], landing = [], add = (u, l) => { if (u && !urls.includes(u) && !landing.includes(u)) (l ? landing : urls).push(u); };
    for (const u of x.pdf || []) add(u);
    const doi = x.doi, c = this.conf(), tasks = [];
    if (doi) {
      // OpenAlex: toate copiile cu acces deschis (arhive instituționale, PubMed Central, preprinturi), nu doar cea a editurii
      const key = c.openalexKey ? `&api_key=${encodeURIComponent(c.openalexKey)}` : "";
      tasks.push(this.http(`https://api.openalex.org/works/doi:${doi}?select=best_oa_location,locations,open_access,ids${key}`).then(r => {
        const j = r.status === 200 ? r.json : null; if (!j) return;
        const locs = [j.best_oa_location, ...(j.locations || [])].filter(l => l && (l.is_oa || l.pdf_url));
        locs.sort((a, b) => (a.source?.type === "repository" ? 0 : 1) - (b.source?.type === "repository" ? 0 : 1));   // arhivele întâi: editurile blochează des descărcările automate
        for (const l of locs) { add(l.pdf_url); add(l.landing_page_url, true); }
        add(j.open_access?.oa_url, true);
        if (j.ids?.pmcid) x.pmcid = String(j.ids.pmcid).split("/").pop();
      }));
      // Europe PMC: articolele din PubMed Central (multe articole de bioetică, medicină, psihologie)
      tasks.push(this.http(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:%22${encodeURIComponent(doi)}%22&format=json&resultType=core`).then(r => {
        const it = r.status === 200 ? r.json?.resultList?.result?.[0] : null; if (!it) return;
        if (it.pmcid) x.pmcid = it.pmcid;
        for (const f of it.fullTextUrlList?.fullTextUrl || []) if (f.availabilityCode === "OA" || f.availabilityCode === "F") add(f.url, f.documentStyle !== "pdf");
      }));
      if (c.email) tasks.push(this.http(`https://api.unpaywall.org/v2/${doi}?email=${encodeURIComponent(c.email)}`).then(r => {
        const j = r.status === 200 ? r.json : null;
        for (const l of [j?.best_oa_location, ...(j?.oa_locations || [])]) { add(l?.url_for_pdf); add(l?.url_for_landing_page, true); }
      }));
      if (c.s2Key) tasks.push(this.http(`https://api.semanticscholar.org/graph/v1/paper/DOI:${doi}?fields=openAccessPdf`, { headers: { "x-api-key": c.s2Key } }).then(r => add(r.status === 200 ? r.json?.openAccessPdf?.url : null)));
      tasks.push(this.http(`https://api.crossref.org/works/${doi}`).then(r => {
        const m = r.status === 200 ? r.json?.message : null;
        if (m && (m.license || []).some(l => /creativecommons\.org/.test(l.URL || ""))) for (const l of m.link || []) if (/pdf/i.test(l["content-type"] || "")) add(l.URL);
      }));
      const ax = /^10\.48550\/arxiv\.(.+)$/i.exec(doi); if (ax) add(`https://arxiv.org/pdf/${ax[1]}`);
      // adresa PDF-ului la editurile mari (merge pentru articolele lor cu acces deschis; la celelalte primim o pagină web, care se ignoră)
      const PUB = [[/^10\.3389\//, d => `https://www.frontiersin.org/articles/${d}/pdf`], [/^10\.1371\//, d => `https://journals.plos.org/plosone/article/file?id=${d}&type=printable`],
        [/^10\.(1007|1186)\//, d => `https://link.springer.com/content/pdf/${d}.pdf`], [/^10\.1177\//, d => `https://journals.sagepub.com/doi/pdf/${d}?download=true`],
        [/^10\.1080\//, d => `https://www.tandfonline.com/doi/pdf/${d}?download=true`], [/^10\.(1111|1002)\//, d => `https://onlinelibrary.wiley.com/doi/pdfdirect/${d}?download=true`],
        [/^10\.7554\//, d => `https://elifesciences.org/articles/${d.split(".").pop()}.pdf`], [/^10\.1098\//, d => `https://royalsocietypublishing.org/doi/pdf/${d}`]];
      for (const [re, f] of PUB) if (re.test(doi)) add(f(doi));
    }
    await Promise.all(tasks.map(t => t.catch(() => {})));
    if (x.pmcid) { const id = String(x.pmcid).replace(/^PMC/i, ""); add(`https://europepmc.org/articles/PMC${id}?pdf=render`); add(`https://pmc.ncbi.nlm.nih.gov/articles/PMC${id}/pdf/`); }
    if (doi) add(`https://doi.org/${doi}`, true);
    return { urls, landing };
  }
  async fetchPdf(x, key, fallback, dirArg) {
    const { urls, landing } = await this.pdfCandidates(x);
    const isPdf = buf => { try { return String.fromCharCode(...new Uint8Array(buf.slice(0, 5))) === "%PDF-"; } catch (e) { return false; } };
    const log = [];
    const t0 = Date.now(), late = () => Date.now() - t0 > 40000;
    const get = async (u, page) => {
      if (late()) return null;
      const r = await this.http(u, { headers: { Accept: "application/pdf,text/html;q=0.9,*/*;q=0.8" }, timeout: page ? 12000 : 30000 });
      let buf = null; try { buf = r.status === 200 ? r.bytes() : null; } catch (e) {}
      let head = ""; try { head = buf ? String.fromCharCode(...new Uint8Array(buf.slice(0, 12))).replace(/[^\x20-\x7e]/g, ".") : ""; } catch (e) {}
      log.push(`${r.status} ${(r.headers?.["content-type"] || r.headers?.["Content-Type"] || "").split(";")[0]} ${head} ${u}`);
      return buf ? { buf, r } : null;
    };
    const tried = new Set();
    let found = null;
    let foundUrl = null;
    for (const u of urls) { if (late()) break; if (tried.has(u)) continue; tried.add(u); const g = await get(u); if (g && isPdf(g.buf)) { found = g.buf; foundUrl = u; break; } }
    // pagini de prezentare (arhive, edituri): multe își anunță PDF-ul în <meta name="citation_pdf_url">, pentru motoarele de căutare academice
    if (!found) for (const u of landing) {
      if (late()) break; if (tried.has(u)) continue; tried.add(u);
      const g = await get(u, true); if (!g) continue;
      if (isPdf(g.buf)) { found = g.buf; foundUrl = u; break; }
      let html = ""; try { html = g.r.text || ""; } catch (e) {}
      const m = /<meta[^>]+name=["']?citation_pdf_url["']?[^>]*?content=(?:"([^"]+)"|'([^']+)'|([^\s"'>]+))/i.exec(html) || /<meta[^>]+content=(?:"([^"]+)"|'([^']+)'|([^\s"'>]+))[^>]*?name=["']?citation_pdf_url\b/i.exec(html);   // cu sau fără ghilimele (PhilPapers: fără)
      if (!m) continue;
      const pu = new URL((m[1] || m[2] || m[3]).replace(/&amp;/g, "&"), u).href; if (!x._pdfUrl) x._pdfUrl = pu; if (tried.has(pu)) continue; tried.add(pu);
      const p = await get(pu); if (p && isPdf(p.buf)) { found = p.buf; foundUrl = pu; break; }
    }
    this.lastPdfPage = landing.find(u => !/doi\.org/.test(u)) || urls[0] || (x.doi ? `https://doi.org/${x.doi}` : null);
    if (!found && x.pdf?.length) x._pdfUrl = x.pdf[0];   // adresa PDF-ului anunțată de pagina sursei: situl n-a lăsat descărcarea automată
    try {
      const p = this.dir + "/pdf-log.txt", ad = this.app.vault.adapter;
      const old = (await ad.exists(p)) ? (await ad.read(p)).split("\n") : [];
      const add = [`--- ${new Date().toISOString()} ${x.doi || x.title} → ${found ? "OK" : "no PDF"}`, ...log];
      await ad.write(p, [...old, ...add].slice(-400).join("\n"));
    } catch (e) {}
    if (!found) return null;
    const dir = await this.liveDir(dirArg || this.docDir()); if (!dir) return null; await this.ensureFolder(dir);
    // „păstrează numele”: numele fișierului de pe site (dacă e unul adevărat, nu „pdf” sau „download”)
    if (!key) { let n = ""; try { n = decodeURIComponent(new URL(foundUrl).pathname.split("/").filter(Boolean).pop() || ""); } catch (e) {}
      n = n.replace(/\.pdf$/i, "").replace(/[\\/:*?"<>|#^[\]]+/g, " ").trim();
      key = n && !/^(pdf|download|content|fulltext|view|file|article|epdf|\d{1,6})$/i.test(n) ? n.slice(0, 120) : (fallback || "document"); }
    let path = this.freePath(dir, key, "pdf");
    await this.app.vault.createBinary(path, found);
    return path.split("/").pop();
  }

  // „Caută PDF-ul gratuit” pentru o notă existentă (ex. una adăugată înainte sau când editura n-a permis descărcarea)
  async findPdfForNote(file) {
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter || {}, T = (a, b) => this.T(a, b);
    const key = fm.id || file.basename.replace(/^@/, "");
    const base = this.pdfBase(this.cslOfFm(fm), key, file.basename.replace(/^@/, ""));
    const x = { doi: cleanDoi(fm.DOI), title: fm.title, authors: fm.author, type: fm.type, pdf: [] };
    if (/philpapers\.org\/rec\/|philarchive\.org\/rec\//.test(String(fm.URL || ""))) x.pdf.push(String(fm.URL).replace(/\/rec\//, "/archive/").replace(/[#?].*$/, ""));   // arhiva PhilPapers / PhilArchive
    if (!x.doi) { try { x.doi = await this.findDoi(x); } catch (e) {} }
    if (!x.doi) { new Notice(T("Nota nu are DOI, iar fără DOI nu pot căuta un PDF gratuit.", "The note has no DOI, and without one I can't look for a free PDF.")); return; }
    const wait = new Notice(T("Caut PDF-ul gratuit în toate referințele…", "Looking for the free PDF in all references…"), 0);
    let name = null; try { name = await this.fetchPdf(x, base, key, this.pdfDir(this.cslOfFm(fm), key)); } catch (e) {}
    wait.hide();
    if (!name) { this.noPdfNotice({ note: file, x }); return; }
    await this.attachPdf(file, key, name);
    new Notice(T(`PDF găsit și atașat: ${name}`, `PDF found and attached: ${name}`), 6000);
  }
  // formatul de evidențiere din PDF++ scria „p. {{pageLabel}}”: numărul din bara PDF-ului. Îl înlocuim cu o expresie care dă pagina tipărită:
  // 1) dacă PDF-ul are deja numerotarea tipărită (eticheta diferă de pagina din fișier) → eticheta;
  // 2) altfel, dacă nota are intervalul de pagini (ex. page: 503-519) și PDF-ul are exact atâtea pagini → 503 + pagina − 1
  //    (sau o pagină în plus = copertă adăugată de editură/JSTOR → pagina 2 din PDF e 503);
  // 3) altfel → eticheta, ca până acum (cărți, scanuri: se corectează cu „Edit page labels” din PDF++).
  pdfPageExpr() {
    return `((p, lab, n, rng) => { lab = String(lab ?? p); if (/^\\d+$/.test(lab) && +lab !== p) return lab; const m = /^\\s*(\\d+)\\s*[-–—]\\s*(\\d+)/.exec(String(rng ?? "")); if (m) { const a = +m[1], len = +m[2] - a + 1; if (len > 0 && n === len) return String(a + p - 1); if (len > 0 && n === len + 1 && p > 1) return String(a + p - 2); } return lab; })(page, pageLabel, pageCount, properties.page)`;
  }
  // pagina din citare = pagina tipărită: șabloanele de copiere din PDF++ care au încă „p. {{pageLabel}}]” se schimbă doar când apeși
  // butonul din pasul PDF++ al ghidului de pornire (Texere nu schimbă singur setările altui plugin)
  pdfPageOld() { const c = this.app.plugins.plugins["pdf-plus"]?.settings?.copyCommands; return Array.isArray(c) ? c.filter(x => typeof x.template === "string" && x.template.includes(PDF_PAGE_OLD)).length : 0; }
  async patchPdfPage() {
    const pp = this.app.plugins.plugins["pdf-plus"], cmds = pp?.settings?.copyCommands; if (!Array.isArray(cmds)) return 0;
    const NEW = "p. {{" + this.pdfPageExpr() + "}}]"; let n = 0;
    for (const c of cmds) if (typeof c.template === "string" && c.template.includes(PDF_PAGE_OLD)) { c.template = c.template.split(PDF_PAGE_OLD).join(NEW); n++; }
    if (n) await pp.saveSettings?.();
    return n;
  }
  // ce oferă Sources în meniul „Texere” al unei note (doar ce are sens acolo):
  // o referință selectată → sursă; un PDF fără sursă → „Adaugă ca sursă”; nota unei surse fără PDF → „Caută PDF-ul gratuit”;
  // evidențieri noi în PDF → „Importă evidențierile”; evidențieri fără cuvintele tale → „Distilează”
  menuItems(ctx, isLit) {
    const T = (a, b) => this.T(a, b), f = ctx.file, out = [];
    if (ctx.kind === "editor") { const sel = ctx.selection || "", n = sel ? this.refCount(sel) : 0;
      if (n) out.push({ title: n === 1 ? T("Adaugă în Referințe", "Add to References") : T(`Adaugă ${n} în Referințe`, `Add ${n} to References`), icon: "library", onClick: () => this.addSelection(sel) }); }
    if (f instanceof TFile && DOC_EXT.test(f.extension) && ctx.kind === "file") out.push({ title: T("Adaugă ca referință", "Add as reference"), icon: "library", onClick: () => this.catalog(f) });
    if (isLit(f)) {
      const arr = v => Array.isArray(v) ? v : v ? [v] : [], fm = this.app.metadataCache.getFileCache(f)?.frontmatter || {};
      const hasPdf = arr(fm.attachment).some(x => /\.(pdf|epub)\b/i.test(String(x)));
      if (!hasPdf) out.push({ title: T("Caută PDF-ul gratuit", "Find the free PDF"), icon: "file-search", onClick: () => this.findPdfForNote(f) });
    }
    try { out.push(...(this.highlights?.menuItems?.(f) || [])); } catch (e) {}
    try { out.push(...(this.distil?.menuItems?.(f) || [])); } catch (e) {}
    return out.slice(0, 4);
  }

  // în bara de jos (locul comun al lui Texere, shared/status.js), după fișierul deschis:
  // nota unei surse → „Vezi PDF-ul”; PDF-ul unei surse → „Vezi nota”; un PDF fără sursă → „Adaugă ca sursă”; oricând sunt, „PDF-uri fără sursă…”
  catalogStatus(h) {
    const T = (a, b) => this.T(a, b), mc = this.app.metadataCache, arr = v => Array.isArray(v) ? v : v ? [v] : [];
    const open = (f, e) => {
      const leaf = this.app.workspace.getLeavesOfType(f.extension === "md" ? "markdown" : f.extension).find(l => l.view?.file === f);
      if (leaf && !(e?.metaKey || e?.ctrlKey)) { this.app.workspace.setActiveLeaf(leaf, { focus: true }); return; }   // deja deschis: doar îl arătăm
      this.app.workspace.getLeaf(e?.metaKey || e?.ctrlKey ? "split" : "tab").openFile(f);   // Cmd/Ctrl+clic: alături
    };
    // ce se poate face cu fișierul deschis: { text (doar pentru PDF), items: [[titlu, iconiță, acțiune]] }
    const what = () => {
      const f = this.app.workspace.getActiveFile?.(); if (!(f instanceof TFile)) return null;
      if (DOC_EXT.test(f.extension)) {
        const e = this.lib.all().find(x => arr(x.attachment).some(a => typeof a === "string" && a.includes(f.name)));
        const note = e?.obsidianPath ? this.app.vault.getAbstractFileByPath(e.obsidianPath) : null;
        return note ? { text: T("Vezi nota", "View note"), items: [[T("Vezi nota", "View note") + ` · @${e.id}`, "file-text", ev => open(note, ev)]] }
          : { text: T("Adaugă ca referință", "Add as reference"), items: [[T("Adaugă acest PDF ca referință", "Add this PDF as a reference"), "library", () => this.catalog(f)]] };
      }
      if (f.extension !== "md") return null;
      const fm = mc.getFileCache(f)?.frontmatter; if (!fm?.id) return null;
      const files = arr(fm.attachment).map(x => /\[\[([^\]|#]+)/.exec(String(x))?.[1]).filter(Boolean).map(l => mc.getFirstLinkpathDest(l, f.path)).filter(p => p && DOC_EXT.test(p.extension));
      const kind = p => p.extension === "pdf" ? "PDF" : p.extension.toUpperCase();
      return { items: files.map(p => [files.length === 1 ? T(`Vezi ${kind(p)}-ul`, `View ${kind(p)}`) : p.name, "paperclip", ev => open(p, ev)]) };
    };
    const st = status(this.host.core);
    // în bara de jos, doar ce ține de nota (sau PDF-ul) deschis: „Vezi PDF-ul” / „Vezi nota”. „Adaugă o sursă” și „PDF-uri fără sursă”
    // sunt pe pagina Surse (și în +, în paleta de comenzi)
    st.set("sources", { order: 20,
      show: () => { const w = what(); return !!(w && (w.text || w.items?.length)); },
      text: () => what()?.text,
      menu: m => { for (const [title, icon, fn] of what()?.items || []) m.addItem(i => i.setTitle(title).setIcon(icon).onClick(ev => fn(ev))); } });
    h.register(() => st.remove("sources"));
    const upd = () => st.refresh();
    for (const ev of ["file-open", "active-leaf-change"]) if (this.app.workspace.on) h.registerEvent(this.app.workspace.on(ev, upd));
    if (mc.on) h.registerEvent(mc.on("changed", f => { if (f === this.app.workspace.getActiveFile?.()) upd(); }));
    h.registerEvent(this.app.vault.on("rename", () => setTimeout(upd, 300)));
    this.lib.onChange(upd); upd();
  }
  // o referință lipită → sursa ei: { x, csl, how: "doi" | "id" | "matched" | "guess" }
  async resolveRef(text) {
    const t = String(text).replace(/\s+/g, " ").trim();
    const doi = cleanDoi(t), isbn = (() => { const m = /(?:ISBN[^0-9X]{0,8})?((?:97[89][\s-]?)?(?:\d[\s-]?){9}[\dX])/i.exec(t); return m && /ISBN|97[89]/i.test(m[0]) ? isbn13(m[1]) : null; })();
    const find = async q => { const f = { type: "all", from: "", to: "", sort: "relevance", providers: new Set(this.enabled().filter(p => !["semanticscholar", "googlescholar", "orcid"].includes(p.id)).map(p => p.id)) };
      let last = []; await Promise.race([this.search(q, f, items => { last = items || []; }), new Promise(r => setTimeout(r, 10000))]); return last; };
    if (doi) { try { const csl = await this.fullCsl({ doi }); if (csl?.title) return { x: { doi, title: csl.title, authors: csl.author, year: csl.issued?.["date-parts"]?.[0]?.[0], sources: ["crossref"] }, csl, how: "doi" }; } catch (e) {} }
    const url = /https?:\/\/\S+/.exec(t)?.[0], ax = /arXiv:\s?\d{4}\.\d{4,5}/i.exec(t)?.[0], pm = /\bPMID:?\s*\d+/i.exec(t)?.[0];
    for (const id of [isbn, ax, pm, t.length < 200 ? url : null].filter(Boolean)) {
      const hit = (await find(id))[0];
      if (hit) { try { const csl = await this.fullCsl({ ...hit }); if (csl?.title) return { x: hit, csl, how: "id" }; } catch (e) {} }
    }
    const g = guessRef(t), yr = g.issued?.["date-parts"]?.[0]?.[0];
    // Crossref recunoaște referințe scrise: o acceptăm doar dacă aproape toate cuvintele titlului găsit apar în ce ai lipit
    const covered = title => { const w = normTitle(title).split(" ").filter(x => x.length > 2), hay = " " + normTitle(t) + " "; return w.length && w.filter(x => hay.includes(" " + x + " ")).length / w.length >= 0.85; };
    try {
      const r = await this.http(`https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(t.slice(0, 600))}&rows=3&select=DOI,title,issued`);
      const it = ((r.status === 200 ? r.json?.message?.items : []) || []).find(i => i.title?.[0] && covered(i.title[0]) && (!yr || !i.issued?.["date-parts"]?.[0]?.[0] || Math.abs(i.issued["date-parts"][0][0] - yr) <= 1));
      if (it) { const d = cleanDoi(it.DOI), csl = await this.fullCsl({ doi: d }); if (csl?.title) return { x: { doi: d, title: csl.title, authors: csl.author, year: csl.issued?.["date-parts"]?.[0]?.[0], sources: ["crossref"] }, csl, how: "matched" }; }
    } catch (e) {}
    // cărți (nu sunt în Crossref): cataloagele, după titlu și primul autor
    if (g.title) {
      const hit = (await find(`${g.title} ${g.author?.[0]?.family || ""}`)).find(x => x.title && normTitle(x.title) === normTitle(g.title) && (!yr || !x.year || Math.abs(+x.year - yr) <= 1));
      if (hit) { try { const csl = await this.fullCsl({ ...hit }); if (csl?.title) return { x: hit, csl: { ...g, ...csl }, how: "matched" }; } catch (e) {} }
    }
    return { x: { title: g.title, authors: g.author || [], year: yr, type: g.type, sources: [] }, csl: g, how: "guess" };
  }
  // aceeași sursă în cataloage (titlu fără diacritice identic, anul ±1): pentru textele cu litere refăcute
  async verifyCsl(csl) {
    if (!csl?.title) return null;
    const fam = csl.author?.[0]?.family || csl.editor?.[0]?.family || "", q = `${csl.title} ${fam}`.trim();
    const f = { type: "all", from: "", to: "", sort: "relevance", providers: new Set(this.enabled().filter(p => !["semanticscholar", "googlescholar", "orcid"].includes(p.id)).map(p => p.id)) };
    let last = [];
    await Promise.race([this.search(q, f, items => { last = items || []; }), new Promise(r => setTimeout(r, 9000))]);
    const want = normTitle(csl.title), yr = csl.issued?.["date-parts"]?.[0]?.[0];
    const hit = last.find(x => x.title && !/\?/.test(x.title) && normTitle(x.title) === want && (!yr || !x.year || Math.abs(+x.year - yr) <= 1));
    if (!hit) return null;
    const names = Object.fromEntries(this.providers.map(p => [p.id, p.name]));
    return { ...hit, sourceName: (hit.sources || []).map(s => names[s] || s)[0] };
  }
  // ——— catalogare: un PDF fără sursă → nota lui ———
  inboxNotice(f) {
    if (this.zotero?.quietInbox?.has(f.path)) { this.zotero.quietInbox.delete(f.path); return; }
    if (this._dlWatch && Date.now() < this._dlWatch.until) return;   // Texere așteaptă PDF-ul unei surse: îl atașează singur
  
    const T = (a, b) => this.T(a, b), frag = document.createDocumentFragment();
    frag.append(T("PDF nou în Inbox: ", "New PDF in Inbox: ") + f.basename + " · ");
    const a = document.createElement("a"); a.textContent = T("Adaugă ca referință", "Add as reference"); a.href = "#"; frag.append(a);
    const n = new Notice(frag, 15000);
    a.addEventListener("click", e => { e.preventDefault(); n.hide(); this.catalog(f); });
  }
  // câte referințe sunt în textul selectat (0 = nu arată a referință: un an, un DOI, un ISBN sau un link și destul text)
  refCount(sel) {
    const t = String(sel || "").trim(); if (t.length < 12 || t.length > 60000) return 0;
    let k; try { k = pastedKind(t); } catch (e) { return 0; }
    if (k?.kind !== "text") return (k?.refs || []).length;
    // text simplu: fiecare paragraf trebuie să arate a referință (autor, an, titlu, punctuație de citare) sau să fie un identificator
    const id = r => /^\s*(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)?10\.\d{4,9}\/\S+\s*$/i.test(r) || /^\s*(ISBN[:\s]*)?97[89][\d -]{10,}\s*$/i.test(r) || /^\s*arXiv:\s*\d{4}\.\d{4,5}/i.test(r);
    // o referință începe cu autorul („Clark, A.”, „Clark A,”, „Dennett, Daniel”) sau cu un număr de listă, are un an și cel puțin trei bucăți
    // despărțite de punct (autor. titlu. editură / revistă); o frază care citează pe cineva („As Clark (2008) argues…”) nu e referință
    const ref = r => { const x = r.replace(/^\s*(\[\d+\]|\d{1,3}[.)])\s*/, ""); if (x.length < 25 || x.length > 1500) return false;
      const head = /^[\p{Lu}][\p{L}'’-]+(?:\s+[\p{Lu}][\p{L}'’-]+)*(?:,\s*[\p{Lu}]|\s+[\p{Lu}]{1,3}[,.]|\.\s*\(\s*(1[5-9]|20)\d{2})/u.test(x);
      const year = /\b(1[5-9]\d\d|20\d\d)[a-z]?\b/.test(x), segs = x.split(/[.;:]["”’»]?\s+(?=["“„«(]?[\p{Lu}\d])/u).filter(z => z.trim()).length;
      return head && year && segs >= 3; };
    const refs = (k.refs || []).filter(r => id(r) || ref(r) || /\b10\.\d{4,9}\/\S+/.test(r) && looksLikeRef(r));
    return refs.length === (k.refs || []).length ? refs.length : 0;
  }
  addSelection(sel) {
    const m = new SearchModal(this, ""); m.open(); m.setMode("bibtex");
    const n = this.refCount(sel);
    m.bib?.fill(sel, n > 1 ? this.T(`Am luat cele ${n} referințe selectate în notă; le caut acum.`, `I took the ${n} references you selected in the note; looking them up now.`) : this.T("Am luat referința selectată în notă; o caut acum.", "I took the reference you selected in the note; looking it up now."));
    m.setFoot?.("bibtex"); setTimeout(() => m.bib?.submit?.(), 60);
  }
  // textul primelor pagini (și al ultimei), plus metadatele PDF-ului
  async readPdf(file) {
    const { loadPdfJs } = require("obsidian"), pdfjs = await loadPdfJs();
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await this.app.vault.readBinary(file)) }).promise;
    let meta = {}; try { meta = await doc.getMetadata(); } catch (e) {}
    let xmp = ""; try { xmp = meta.metadata?.getRaw?.() || ""; } catch (e) {}
    let text = "", front = "", cover = null;
    for (const n of [...new Set([1, 2, 3, 4, 5, 6, doc.numPages])].filter(n => n >= 1 && n <= doc.numPages)) {
      try {
        const tc = await (await doc.getPage(n)).getTextContent(), t = tc.items.map(i => (i.str || "") + (i.hasEOL ? "\n" : " ")).join("");
        text += "\n" + t;
        // identificatorii documentului: din primele pagini, fără bibliografie (DOI-urile lucrărilor citate nu sunt ale lui)
        if (n <= 6 && n !== doc.numPages || doc.numPages === 1) { let inRefs = false; for (const line of t.split("\n")) { if (/^\s*(references|bibliography|bibliografie|referin[țţt]e|works cited)\s*$/i.test(line)) inRefs = true; if (inRefs || isRefLine(line)) continue; front += line + "\n"; } }
        if (n === 1) cover = tc.items.filter(i => i.str && i.str.replace(/[\u200B-\u200D\uFEFF]/g, "").trim() && i.transform).map(i => ({ s: i.str.replace(/[\u200B-\u200D\uFEFF]/g, "").trim(), x: i.transform[4], y: i.transform[5], size: Math.hypot(i.transform[0], i.transform[1]) || i.height || 10 }));
        if (n === 2 && !cover?.abstract) { const m = /\b(abstract|rezumat)\b\s*[.:]?\s*([\s\S]{80,2500}?)(?:\n\s*\n|\bkeywords?\b|\bcuvinte[- ]cheie\b|$)/i.exec(t); if (m && cover) cover.abstract = m[2].replace(/\s+/g, " ").trim(); }
      } catch (e) {}
    }
    try { doc.destroy(); } catch (e) {}
    return { title: String(meta.info?.Title || ""), author: String(meta.info?.Author || ""), xmp: String(xmp), text, front, cover };
  }
  // EPUB = arhivă zip: citim META-INF/container.xml → fișierul .opf → titlu, autori, identificatori (ISBN, DOI)
  async readEpub(file) {
    const buf = new Uint8Array(await this.app.vault.readBinary(file)), dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    let eocd = -1; for (let i = buf.length - 22; i >= Math.max(0, buf.length - 66000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error("not a zip");
    const entries = new Map(); let p = dv.getUint32(eocd + 16, true); const n = dv.getUint16(eocd + 10, true), dec = new TextDecoder();
    for (let k = 0; k < n && dv.getUint32(p, true) === 0x02014b50; k++) {
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
      entries.set(dec.decode(buf.subarray(p + 46, p + 46 + nl)), { method, csize, off }); p += 46 + nl + xl + cl;
    }
    const read = async name => {
      const e = entries.get(name); if (!e) return null;
      const start = e.off + 30 + dv.getUint16(e.off + 26, true) + dv.getUint16(e.off + 28, true), data = buf.subarray(start, start + e.csize);
      if (e.method === 0) return dec.decode(data);
      const out = await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer();
      return dec.decode(out);
    };
    const container = await read("META-INF/container.xml") || "", opfPath = (/full-path="([^"]+)"/.exec(container) || [])[1];
    const opf = (opfPath && await read(opfPath)) || "";
    const doc = new DOMParser().parseFromString(opf, "application/xml"), tag = t => [...doc.getElementsByTagName("dc:" + t)].map(x => x.textContent.trim()).filter(Boolean);
    const idText = tag("identifier").map(x => /^\d[\d-]{8,}[\dX]$/i.test(x) ? "ISBN " + x : x.replace(/^urn:isbn:/i, "ISBN ").replace(/^urn:doi:/i, "doi:")).join("\n");
    return { title: tag("title")[0] || "", author: tag("creator").join("; "), xmp: idText, text: [tag("publisher")[0], tag("date")[0]].filter(Boolean).join(" ") };
  }
  // DOI, ISBN (cu cifra de control verificată), arXiv
  findIds({ text = "", xmp = "" }) {
    const all = xmp + "\n" + text, out = {};
    const d = /\b(10\.\d{4,9}\/[^\s"'<>]+)/i.exec(all.replace(/https?:\/\/(dx\.)?doi\.org\//gi, " ")); if (d) out.doi = cleanDoi(d[1]);
    const ok13 = s => s.length === 13 && /^97[89]/.test(s) && (10 - [...s.slice(0, 12)].reduce((a, c, i) => a + +c * (i % 2 ? 3 : 1), 0) % 10) % 10 === +s[12];
    const ok10 = s => s.length === 10 && [...s].reduce((a, c, i) => a + (c === "X" ? 10 : +c) * (10 - i), 0) % 11 === 0;
    const re = /ISBN(?:-1[03])?[^0-9X\n]{0,8}((?:[0-9][ \t\-–—]{0,2}){9,12}[0-9X])/gi; let m;   // și „0–19–285421–6”, „973-35- 1838- 7”
    while ((m = re.exec(all))) { const v = m[1].replace(/[^0-9X]/gi, "").toUpperCase(), v13 = v.slice(0, 13), v10 = v.slice(0, 10);
      if (ok13(v13)) { out.isbn = v13; break; } if (ok10(v10)) { out.isbn = isbn13(v10); break; } }
    const ax = /arXiv:\s?(\d{4}\.\d{4,5})/i.exec(all); if (ax) out.arxiv = ax[1];
    return out;
  }
  // fără identificator: titlul din metadate (dacă e unul adevărat) sau numele fișierului
  guessTitle(info, file) {
    const t = (info.title || "").trim();
    if (t.length > 5 && !/untitled|microsoft word|^document\d*$|\.(docx?|pdf|indd)$|^[\d\W_]+$/i.test(t)) return t + (info.author ? " " + info.author.split(/[,;&]| and /)[0].trim().split(/\s+/).pop() : "");
    const parts = file.basename.split(/\s+--\s+/); if (parts.length >= 3) return parts[0].trim() + " " + (parts[1].split(/[;,]/)[0].trim().split(/\s+/).pop() || "");
    return file.basename.replace(/\s+(by|de)\s+.*$/i, "").replace(/[_]+/g, " ").replace(/\s+[—–-]\s+/g, " ").trim();
  }
  async catalog(file, opts = {}) {
    const T = (a, b) => this.T(a, b), wait = new Notice(T("Citesc fișierul…", "Reading the file…"), 0);
    let info = { text: "", xmp: "", title: "" };
    try { info = file.extension === "epub" ? await this.readEpub(file) : file.extension === "pdf" ? await this.readPdf(file) : info; } catch (e) { console.warn("Texere Referințe: citirea fișierului", e); }
    wait.hide();
    // un ISBN fără „ISBN” în față se acceptă doar în numele fișierului (ex. „… -- 9780140135152 -- …”), unde nu poate fi un număr de telefon
    const fm = /(?:^|\D)(97[89](?:[\s-]?\d){10})(?!\d)/.exec(file.basename), fnIsbn = fm ? fm[1].replace(/\D/g, "") : "";
    const ids = this.findIds({ ...info, text: info.front ?? info.text, xmp: (info.xmp || "") + (fnIsbn ? "\nISBN " + fnIsbn : "") });
    // o teză sau o lucrare a ta (fără identificator): datele de pe copertă, în „Introdu manual”, de verificat
    const guess = !(ids.doi || ids.isbn || ids.arxiv) ? coverGuess(info, file) : null;
    const q = ids.doi || ids.isbn || (ids.arxiv ? "arXiv:" + ids.arxiv : "") || (guess?.title ? guess.title + (guess.author?.[0]?.family ? " " + guess.author[0].family : "") : this.guessTitle(info, file));
    const m = new SearchModal(this, q, { pdf: file, auto: ids.doi || ids.isbn || ids.arxiv ? ids : null, after: opts.after, guess }); m.open();
    if (guess?.type === "thesis") m.setMode("manual");
  }
  // PDF-urile din Inbox și cele din Documents pe care nu le are nicio notă
  uncatalogedFiles() {
    const mc = this.app.metadataCache, arr = v => Array.isArray(v) ? v : v ? [v] : [];
    const used = new Set();
    for (const f of this.app.vault.getMarkdownFiles()) for (const x of arr(mc.getFileCache(f)?.frontmatter?.attachment)) { const l = /\[\[([^\]|#]+)/.exec(String(x))?.[1]; const p = l && mc.getFirstLinkpathDest(l, f.path); if (p) used.add(p.path); }
    return this.app.vault.getFiles().filter(f => DOC_EXT.test(f.extension) && (f.path.startsWith(this.inboxDir() + "/") || (f.path.startsWith(this.docDir() + "/") && !used.has(f.path))));
  }
  uncataloged() {
    const T = (a, b) => this.T(a, b), pdfs = this.uncatalogedFiles();
    if (!pdfs.length) { new Notice(T("Toate PDF-urile au o referință. Inbox-ul e gol.", "Every PDF has a reference. The Inbox is empty.")); return; }
    const { FuzzySuggestModal } = require("obsidian"), S = this, inbox = this.inboxDir() + "/";
    const M = class extends FuzzySuggestModal {
      getItems() { return pdfs; }
      getItemText(f) { return (f.path.startsWith(inbox) ? "Inbox · " : "") + f.basename; }
      onChooseItem(f) { S.catalog(f); }
    };
    const m = new M(this.app); m.setPlaceholder(T("Alege PDF-ul pe care îl adaugi ca referință", "Choose the PDF to add as a reference")); m.open();
  }
  // un PDF pe care îl ai deja (din Inbox sau de oriunde) ajunge în folderul sursei, cu numele după regulă, și se atașează notei
  async placePdf(note, csl, key, pdf, noteBase) {
    const dir = await this.liveDir(this.pdfDir(csl, key)), name = this.pdfBase(csl, key, noteBase) || pdf.basename;
    if (!dir) { new Notice(this.T(`PDF-ul a rămas în „${pdf.parent?.path || "/"}”: n-ai ales un folder pentru PDF-uri.`, `The PDF stayed in “${pdf.parent?.path || "/"}”: you didn't choose a folder for PDFs.`), 8000); return; }
    await this.ensureFolder(dir);
    const to = this.freePath(dir, name, pdf.extension, pdf.path);
    if (to !== pdf.path) await this.app.fileManager.renameFile(pdf, to);
    await this.attachPdf(note, key, pdf.name);
    try { await this.highlights?.flushPending(pdf, note); } catch (e) { console.error("Texere Referințe: adnotările păstrate", e); }   // evidențierile făcute înainte de notă
    // și toate celelalte evidențieri scrise deja în PDF (făcute înainte, sau în altă aplicație), fiecare la locul ei
    if (pdf.extension === "pdf" && this.highlights?.importFromPdf) {
      try { const r = await this.highlights.importFromPdf(pdf, note); this.highlights.report([{ ...r, note }]); } catch (e) { console.error("Texere Referințe: adnotările din PDF", e); }
    }
  }
  // ——— folderele surselor: unul redenumit, mutat sau șters ———
  // ce folder lipsește: { notes, pdfs } → calea (partea fixă, fără variabile); Inbox se creează singur, la nevoie
  goneFolders() {
    const f = this.filesConf(), out = {};
    // doar un folder care a fost în vault și a dispărut; unul care n-a fost niciodată aici (vault nou) se creează la prima referință
    const core = this.host?.core, seen = r => typeof core?.seen === "function" ? core.seen(r) : true;
    for (const k of ["notes", "pdfs"]) { const r = this.rootOf(f[k]); if (r && !this.app.vault.getAbstractFileByPath(r) && seen(r)) out[k] = r; }
    return out;
  }
  goneSafe() { try { return this.goneFolders(); } catch (e) { return {}; } }
  // un folder redenumit în afara lui Obsidian (Finder, Explorer) arată ca unul șters; ghicim noul nume după ce e înăuntru:
  // notele surselor (cu id și citation-key) sau PDF-urile, adunate la aceeași adâncime ca vechiul folder. Ghidurile lui Texere nu contează.
  guessFolder(key, old) {
    old = String(old || "").replace(/\/+$/, ""); if (!old || (key !== "notes" && key !== "pdfs")) return null;
    const depth = old.split("/").length, mc = this.app.metadataCache, f = this.filesConf(), other = this.rootOf(f[key === "notes" ? "pdfs" : "notes"]);
    let bib = ""; try { bib = String(this.bibPath?.() || this.conf().bibPath || ""); } catch (e) {}
    const tx = bib.split("/").slice(0, -2).join("/");   // „Support/Texere”: ghidurile și exemplele lui Texere
    const skip = p => p.startsWith(".") || (tx && p.startsWith(tx + "/")), count = {};
    for (const file of this.app.vault.getFiles()) {
      const p = file.path; if (skip(p)) continue;
      const ok = key === "pdfs" ? file.extension === "pdf" : file.extension === "md" && (() => { const fm = mc.getFileCache(file)?.frontmatter; return fm && fm.id && (fm["citation-key"] || fm.type); })();
      if (!ok) continue;
      const parts = p.split("/"); if (parts.length <= depth) continue;
      const at = parts.slice(0, depth).join("/"); if (at === old || at === other) continue;
      count[at] = (count[at] || 0) + 1;
    }
    const best = Object.entries(count).sort((a, b) => b[1] - a[1])[0];
    return best && this.app.vault.getAbstractFileByPath(best[0]) ? best[0] : null;
  }
  // redenumirea știută (făcută în Obsidian) sau, dacă nu e, cea ghicită: { from, to, guess }
  movedFor(key, cur) {
    const m = (this.conf().folderMoved || {})[key];
    if (m && m.from === cur && this.app.vault.getAbstractFileByPath(m.to)) return m;
    let g = null; try { g = this.guessFolder(key, cur); } catch (e) {}
    return g ? { from: cur, to: g, guess: true } : null;
  }
  vaultFolders() { return vaultFolders(this.app); }
  // folderul unei setări schimbat direct (fără să muți notele: ele sunt deja acolo): partea fixă se înlocuiește, variabilele rămân
  async setFolderRoot(key, to) {
    const f = this.filesConf(), old = this.rootOf(f[key]);
    f[key] = old && String(f[key]).startsWith(old) ? to + String(f[key]).slice(old.length) : to;
    // celelalte foldere care stau în cel schimbat (ex. Inbox în Documents, PDF-urile lângă note) îl urmează
    const m = this.conf().folderMoved || {};
    for (const k of ["notes", "pdfs", "inbox"]) { if (k === key || !old) continue; const v = String(f[k] || ""); if (v === old || v.startsWith(old + "/") || (v.startsWith(old) && v.slice(old.length).startsWith("/{{"))) { f[k] = to + v.slice(old.length); delete m[k]; } }
    delete m[key];
    await this.save();
    try { this.app.workspace.trigger?.("texere:changed"); } catch (e) {}   // tab-ul nou și setările se redesenează
  }
  // redenumești în Obsidian un folder al surselor: îl ținem minte (și după repornire), ca să-ți propunem numele nou

  // înainte să salvezi o sursă: dacă folderul notelor sau al PDF-urilor a dispărut, te întreabă unde le pune; false = renunți
  async checkFolders() {
    const gone = this.goneFolders(); if (!Object.keys(gone).length) return true;
    if (this._askFolders) return this._askFolders;   // o singură întrebare, oricâte salvări așteaptă (ex. sursa și PDF-ul ei)
    this._askFolders = new Promise(res => new SourceFoldersModal(this, gone, res).open()).finally(() => { this._askFolders = null; });
    return this._askFolders;
  }
  // calea în care se salvează ceva acum: dacă folderul ei a dispărut, întâi te întreabă, apoi dă calea din folderul ales; null = ai renunțat
  async liveDir(dir) {
    dir = String(dir || "").replace(/\/+$/, "");
    const hit = Object.entries(this.goneSafe()).find(([, r]) => dir === r || dir.startsWith(r + "/"));
    if (!hit) return dir;
    if (!(await this.checkFolders())) return null;
    const [k, old] = hit, now = this.rootOf(this.filesConf()[k]);
    return now ? now + dir.slice(old.length) : dir;
  }

  // PDF-ul pe care îl salvezi din browser (după „Deschide PDF-ul”): când apare în Downloads (cel mult 10 minute), o copie intră lângă celelalte PDF-uri și se atașează
  watchDownload(note, x) {
    let fs = null, path = null, os = null; try { fs = node("fs"); path = node("path"); os = node("os"); } catch (e) {}
    let dir = null, before = new Set();
    try { dir = path.join(os.homedir(), "Downloads"); before = new Set(fs.readdirSync(dir)); } catch (e) { dir = null; }   // fără acces la Downloads: rămâne Inbox
    const T = (a, b) => this.T(a, b), t0 = Date.now(), sizes = {}, inbox = (() => { try { return this.inboxDir() + "/"; } catch (e) { return null; } })();
    const watch = (this._dlWatch = { note: note.path, until: t0 + 10 * 60000 });
    const id = normTitle(decodeURIComponent(String(x._pdfUrl || "").split(/[?#]/)[0].split("/").filter(Boolean).pop() || "").replace(/\.pdf$/i, ""));
    const words = normTitle(x.title || "").split(" ").filter(w => w.length > 3).slice(0, 8), doi = x.doi ? normTitle(String(x.doi).split("/").pop()) : "";
    const fits = n => { const b = normTitle(n.replace(/\.pdf$/i, "")); return (id.length >= 4 && b.includes(id)) || (doi.length >= 4 && b.includes(doi)) || (words.length >= 2 && words.filter(w => b.includes(w)).length >= 2); };
    const tick = async () => {
      if (Date.now() - t0 > 10 * 60000 || this._dlWatch !== watch) return;
      // un PDF tras în Inbox între timp: merge direct la notă
      const dropped = inbox && this.app.vault.getFiles().find(f => f.extension === "pdf" && f.path.startsWith(inbox) && (f.stat?.ctime || 0) >= t0);
      if (dropped) {
        try { const f = this.app.vault.getAbstractFileByPath(note.path) || note; if (!this.attachedPdfs(f).length) { await this.placeLater(f, dropped); new Notice(T(`PDF-ul din Inbox e atașat la @${f.basename}.`, `The PDF from Inbox is attached to @${f.basename}.`), 6000); } }
        catch (err) { console.warn("Texere Referințe: PDF-ul din Inbox", err); }
        this._dlWatch = null; return;
      }
      let hit = null;
      if (dir) try {
        for (const n of fs.readdirSync(dir)) {
          if (before.has(n) || !/\.pdf$/i.test(n) || !fits(n)) continue;
          const st = fs.statSync(path.join(dir, n)); if (st.size > 1000 && sizes[n] === st.size) { hit = path.join(dir, n); break; } sizes[n] = st.size;   // descărcarea s-a terminat: mărimea nu se mai schimbă
        }
      } catch (e) {}
      if (!hit) return void later(tick, 1500);
      try {
        const b = fs.readFileSync(hit); if (b.subarray(0, 5).toString("latin1") !== "%PDF-") { before.add(path.basename(hit)); return void later(tick, 1500); }
        const f = this.app.vault.getAbstractFileByPath(note.path) || note; if (this.attachedPdfs(f).length) return;
        const csl = this.cslOfFm(this.app.metadataCache.getFileCache(f)?.frontmatter || {}), e = this.lib.all().find(v => v.obsidianPath === f.path), key = e?.id || f.basename.replace(/^@/, "");
        const to = await this.liveDir(this.pdfDir(csl, key)); if (!to) return; await this.ensureFolder(to);
        const pdf = await this.app.vault.createBinary(this.freePath(to, this.pdfBase(csl, key, f.basename.replace(/^@/, "")) || key, "pdf"), b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
        await this.placeLater(f, pdf, csl);
        new Notice(T(`PDF-ul din Downloads e atașat la @${key}.`, `The PDF from Downloads is attached to @${key}.`), 6000);
      } catch (err) { console.warn("Texere Referințe: PDF-ul din Downloads", err); }
      this._dlWatch = null;
    };
    later(tick, 1500);
  }
  async logLine(line) {
    try { const p = this.dir + "/pdf-log.txt", ad = this.app.vault.adapter; const old = (await ad.exists(p)) ? (await ad.read(p)).split("\n") : []; await ad.write(p, [...old, `--- ${new Date().toISOString()} ${line}`].slice(-400).join("\n")); } catch (e) {}
  }
  // PDF-urile deja atașate notei (în notă sau în bibliografie)
  attachedPdfs(note) {
    const mc = this.app.metadataCache, fm = mc.getFileCache(note)?.frontmatter || {}, e = this.lib.all().find(v => v.obsidianPath === note.path) || {};
    const list = [].concat(fm.attachment || [], e.attachment || []);
    return [...new Set(list.map(x => /\[\[([^\]|#]+)/.exec(String(x))?.[1]).filter(Boolean))].map(n => mc.getFirstLinkpathDest(n, note.path)).filter(f => f && f.extension === "pdf");
  }
  // o singură căutare de PDF pe notă; dacă între timp a primit un PDF (de la Zotero, de la buton), cel găsit nu se mai atașează
  async onePdf(note, run) {
    const jobs = (this._pdfJobs = this._pdfJobs || new Set());
    if (jobs.has(note.path) || this.attachedPdfs(note).length) return null;
    jobs.add(note.path);
    try {
      const name = await run(); if (!name) return null;
      const f = this.app.vault.getAbstractFileByPath(note.path) || note;
      if (this.attachedPdfs(f).length) {   // între timp a venit altul: cel abia descărcat merge la coș
        const dup = this.app.vault.getFiles().filter(x => x.name === name && x.extension === "pdf" && Date.now() - (x.stat?.ctime || 0) < 120000).sort((p, q) => q.stat.ctime - p.stat.ctime)[0];
        if (dup && !this.attachedPdfs(f).includes(dup)) { try { await (this.app.fileManager.trashFile ? this.app.fileManager.trashFile(dup) : this.app.vault.trash(dup, true)); } catch (e) {} }
        return null;
      }
      return name;
    } finally { jobs.delete(note.path); }
  }
  async placeLater(note, pdf, csl) {
    const f = this.app.vault.getAbstractFileByPath(note.path) || note, e = this.lib.all().find(v => v.obsidianPath === f.path), key = e?.id || f.basename.replace(/^@/, "");
    await this.placePdf(f, csl || this.cslOfFm(this.app.metadataCache.getFileCache(f)?.frontmatter || {}), key, pdf, f.basename.startsWith("@") ? key : f.basename);
  }
  async attachToNote(note, pdf) {
    const fm = this.app.metadataCache.getFileCache(note)?.frontmatter || {}, key = fm.id || note.basename.replace(/^@/, "");
    await this.placePdf(note, this.cslOfFm(fm), key, pdf, note.basename.replace(/^@/, ""));
    new Notice(this.T(`PDF-ul a fost atașat la @${key}`, `The PDF was attached to @${key}`), 5000);
  }
  // PDF-ul găsit intră în attachment (în notă și în bibliografie)
  // linkul arată numele PDF-ului ([[nume.pdf]]), nu doar „PDF”; Obsidian îl ține la zi când redenumești fișierul
  async attachPdf(file, key, name) {
    const link = `[[${name}]]`, same = x => /\[\[([^\]|#]+)/.exec(String(x))?.[1] === name;
    await this.app.fileManager.processFrontMatter(file, f => { const a = Array.isArray(f.attachment) ? f.attachment.filter(Boolean) : f.attachment ? [f.attachment] : []; if (!a.some(same)) a.push(link); f.attachment = a; });
    await this.lib.update(key, e => { const a = (Array.isArray(e.attachment) ? e.attachment : []).filter(Boolean); if (!a.some(same)) a.push(link); e.attachment = a; });
  }
  // o singură dată: [[x.pdf|PDF]] → [[x.pdf]] în notele de literatură (aliasurile tale, altele decât PDF/EPUB…, rămân)
  async renameAttachLinks() {
    const c = this.conf(); if (c.attachNames === 1) return;
    const mc = this.app.metadataCache, OLD = /^\[\[([^\]|#]+?)\|(PDF|EPUB|DJVU|MOBI|DOCX?|FILE)\]\]$/;
    let n = 0, bad = 0;
    for (const f of this.app.vault.getMarkdownFiles()) {
      const fm = mc.getFileCache(f)?.frontmatter; if (!fm || fm.attachment == null) continue;
      const list = Array.isArray(fm.attachment) ? fm.attachment : [fm.attachment];
      if (!list.some(x => OLD.test(String(x).trim()))) continue;
      try {
        await this.app.fileManager.processFrontMatter(f, o => { const a = Array.isArray(o.attachment) ? o.attachment : [o.attachment]; const b = a.map(x => { const m = OLD.exec(String(x ?? "").trim()); return m ? `[[${m[1]}]]` : x; }); o.attachment = Array.isArray(o.attachment) ? b : b[0]; });
        n++;
      } catch (e) { bad++; console.warn("Texere Referințe: numele PDF-ului în attachment", f.path, e); }
    }
    if (!bad) { c.attachNames = 1; await this.save(); }
    if (n) setTimeout(() => this.rebuildFromNotes?.(true), 1500);
  }
  // fără PDF descărcabil: un buton care deschide versiunea gratuită în browser, ca să-l salvezi tu în Documents
  noPdfNotice(ctx) {
    const T = (a, b) => this.T(a, b), url = this.lastPdfPage, frag = document.createDocumentFragment();
    const pdfUrl = ctx?.x?._pdfUrl;
    if (pdfUrl && ctx.note) {   // PDF-ul există, dar situl nu lasă descărcarea automată (ex. PhilPapers): îl iei tu din browser, Texere îl atașează
      frag.append(T("Situl nu lasă Texere să descarce PDF-ul. ", "The site doesn't let Texere download the PDF. "));
      const a = document.createElement("a"); a.textContent = T("Deschide PDF-ul ↗", "Open the PDF ↗"); a.href = pdfUrl; frag.append(a);
      const save = process.platform === "darwin" ? "⌘S" : "Ctrl+S";
      frag.append(T(`, apoi salvează-l (${save}) în Downloads sau trage-l în Inbox: Texere îl atașează la referință.`, `, then save it (${save}) to Downloads, or drag it into Inbox: Texere attaches it to the reference.`));
      const n = new Notice(frag, 25000);
      a.addEventListener("click", e => { e.preventDefault(); n.hide(); window.open(pdfUrl); try { this.watchDownload(ctx.note, ctx.x); } catch (err) { console.warn("Texere References: Downloads", err); } });
      return;
    }
    frag.append(T("Nu am putut descărca un PDF gratuit: editura nu permite descărcarea automată sau nu există o copie liberă. ", "I couldn't download a free PDF: the publisher blocks automatic downloads or there's no free copy. "));
    if (url) { const a = document.createElement("a"); a.textContent = T("Deschide pagina referinței ↗", "Open the reference's page ↗"); a.href = url; a.addEventListener("click", e => { e.preventDefault(); window.open(url); }); frag.append(a);
      frag.append(T(" — dacă are PDF, salvează-l în PDFs și pune-l în attachment.", " — if it has a PDF, save it in PDFs and add it to attachment.")); }
    new Notice(frag, 15000);
  }

  // datele sursei pentru notă: câmpurile standard (numărul revistei = „number”), apoi persoanele, apoi câmpurile suplimentare
  noteData(csl, key) {
    const citation = { id: key };
    const yr = csl.issued?.["date-parts"]?.[0]?.[0]; if (yr) citation.year = String(yr);   // pentru {{year}} (nu apare ca atare în notă)
    const std = { ...csl }; if (std.number == null && std.issue != null) std.number = std.issue;
    for (const k of NOTE_STD) if (std[k] != null && std[k] !== "") citation[k] = std[k];
    const contributors = [];
    for (const role of ["author", "editor", "translator", "container-author"]) for (const p of csl[role] || []) contributors.push({ role, ...p });
    const additionalFields = [{ name: "accessed", value: csl.accessed || { "date-parts": [today()] }, type: "date" }, { name: "citation-key", value: key, type: "standard" }];
    for (const [k, type] of NOTE_EXTRA) if (csl[k] != null && csl[k] !== "") additionalFields.push({ name: k, value: csl[k], type });
    return { citation, contributors, additionalFields };
  }
  // textul notei de literatură: proprietățile în ordinea de mai sus, apoi titlul notei din șablon
  noteText(csl, key, pdfName, custom, opts) {
    const { citation, contributors, additionalFields } = this.noteData(csl, key);
    const { year, ...std } = citation;
    const fm = { ...std, tags: this.T_.tags(this.template().tag) };
    for (const { role, ...p } of contributors) (fm[role] = fm[role] || []).push(p);
    for (const f of additionalFields) fm[f.name] = f.value;
    for (const [k, v] of this.noteFields(csl, key, pdfName ? [`${this.docDir()}/${pdfName}`] : [], custom)) if (!(k in fm)) fm[k] = v;
    if (opts?.alias && Array.isArray(fm.aliases) && !fm.aliases.includes("@" + key)) fm.aliases = [...fm.aliases, "@" + key];
    return { text: `---\n${toYaml(fm)}\n---\n\n${this.noteHeader(csl, key)}\n`, fm };
  }

  // ordinea metadatelor unei note de lectură, ca la import: datele referinței (id, tip, titlu…, etichete, persoane, accessed, citation-key, ISSN…),
  // apoi câmpurile din șablon (Setări → Șablonul notei), în ordinea lor, apoi orice altceva ai adăugat tu, în ordinea în care e
  fmOrder(keys) {
    const data = ["id", ...NOTE_STD, "tags", "author", "editor", "translator", "container-author", "accessed", "citation-key", ...NOTE_EXTRA.map(e => e[0])];
    const tpl = this.template().fields.map(f => f.name).filter(Boolean), has = new Set(keys), seen = new Set(), out = [];
    for (const k of [...data, ...tpl, ...keys]) if (has.has(k) && !seen.has(k)) { seen.add(k); out.push(k); }
    return out;
  }
  // pune metadatele notelor de lectură în ordinea de la import (o dată, după ce o actualizare le-a amestecat); valorile rămân neatinse
  async reorderNotes() {
    const mc = this.app.metadataCache, FM = this.app.fileManager, out = { done: 0, fail: [] };
    for (const f of this.app.vault.getMarkdownFiles().filter(f => f.path.startsWith(this.litDir().replace(/\/*$/, "/")))) {
      const fm = mc.getFileCache(f)?.frontmatter; if (!fm?.id) continue;
      const keys = Object.keys(fm).filter(k => k !== "position"), want = this.fmOrder(keys);
      if (want.every((k, i) => k === keys[i])) continue;
      try {
        await FM.processFrontMatter(f, o => { const cur = Object.keys(o), vals = { ...o }; for (const k of cur) delete o[k]; for (const k of this.fmOrder(cur)) o[k] = vals[k]; });
        out.done++;
      } catch (e) { out.fail.push(`${f.path}: ${e.message}`); }
    }
    return out;
  }

  // adaugă sursa: nota de literatură + PDF + intrarea în bibliografie
  async add(x, opts = {}) {
    if (!(await this.checkFolders())) return null;   // un folder al surselor a dispărut și ai renunțat
    opts.submitted?.();
    const lib = this.library(), have = lib.find(x);
    if (have && !opts.force) { if (opts.silent) { opts.after?.(have); return have; } if (opts.pdfFile) await this.attachToNote(have, opts.pdfFile); if (opts.after) opts.after(have); else if (!opts.stay) await this.app.workspace.getLeaf("tab").openFile(have); return have; }
    const quiet = { hide() {}, setMessage() { return this; } };
    const wait = opts.silent ? quiet : new Notice(this.T("Adaug referința…", "Adding the reference…"), 0);
    const notice = (m, t) => { if (!opts.silent) new Notice(m, t); };
    try {
      const csl = opts.csl || await this.fullCsl(x);
      if (!x.doi && csl.DOI) x.doi = cleanDoi(csl.DOI);
      const again = lib.find({ ...x, title: csl.title, doi: x.doi, isbn: isbn13(csl.ISBN) });
      if (again && !opts.force) { wait.hide(); if (opts.silent) { opts.after?.(again); return again; } if (opts.pdfFile) await this.attachToNote(again, opts.pdfFile); if (opts.after) opts.after(again); else if (!opts.stay) await this.app.workspace.getLeaf("tab").openFile(again); return again; }
      const taken = new Set([...lib.keys, ...this.lib.all().map(e => e.id)]);
      const key = opts.key && !taken.has(opts.key) && !this.app.vault.getAbstractFileByPath(normalizePath(this.litDir() + "@" + opts.key + ".md")) ? opts.key : this.citekey(csl, taken);   // key: cheia scrisă deja în [@cheie] (citarea din Zotero)
      // nota se creează imediat; PDF-ul se caută după, în fundal, și se atașează când e gata
      const base = this.fileBase(csl, key), readable = !base.startsWith("@");
      const { text, fm } = this.noteText(csl, key, null, opts.custom, { alias: readable });
      wait.setMessage(this.T("Creez nota…", "Creating the note…"));
      // nota o scrie Texere, cu șablonul și folderele tale
      const dir = this.notesDir(csl, key); await this.ensureFolder(dir);
      const file = await this.app.vault.create(this.freePath(dir, base, "md"), text);
      // în bibliografie intră aceleași date ca în notă („Refă bibliografia din note” o reface la fel)
      { const { tags, ...entry } = fm; await this.lib.add({ ...entry, obsidianPath: file.path }); }
      if (opts.pdfFile && !opts.silent) { if (!opts.after) { try { await (this.highlights?.showNote(file, opts.pdfFile) ?? this.app.workspace.getLeaf("tab").openFile(file)); } catch (e) {} } }   // lângă PDF, nu în locul lui
      else if (!opts.silent && !opts.stay && this.conf().openNote !== false) await this.app.workspace.getLeaf("tab").openFile(file);   // stay: rămâi în nota în care scrii
      // din Zotero: PDF-ul vine din biblioteca ta Zotero (nu se mai caută pe internet)
      if (!opts.pdfFile && !opts.noZoteroPdf && x.zotero && this.zotero) {
        wait.setMessage(this.T(`Referință adăugată: @${key}. Aduc PDF-ul din Zotero…`, `Reference added: @${key}. Bringing the PDF from Zotero…`));
        try { const zf = await this.zotero.pdfToVault(x, { highlights: opts.zoteroHl }); if (zf) { await this.placePdf(file, csl, key, zf, readable ? base : key); wait.hide(); notice(this.T(`Referință adăugată din Zotero, cu PDF-ul: @${key}`, `Reference added from Zotero, with its PDF: @${key}`), 5000); opts.after?.(file); return file; } }
        catch (e) { console.warn("Texere Referințe: PDF-ul din Zotero", e); }
      }
      if (opts.pdfFile) {   // catalogare: PDF-ul pe care îl ai deja se mută lângă celelalte și se atașează
        try { await this.placePdf(file, csl, key, opts.pdfFile, readable ? base : key); } catch (e) { console.error("Texere References: PDF-ul catalogat", e); }
        wait.hide(); notice(this.T(`Referință adăugată, cu PDF-ul tău: @${key}`, `Reference added, with your PDF: @${key}`), 5000);
      } else if (!opts.silent && !opts.noFreePdf && this.conf().pdf && (x.doi || x.pdf?.length)) {
        wait.setMessage(this.T(`Referință adăugată: @${key}. Caut PDF-ul gratuit…`, `Reference added: @${key}. Looking for the free PDF…`));
        this.pdfLater(x, key, file, wait, this.pdfBase(csl, key, readable ? base : key), this.pdfDir(csl, key));   // fără await: nota e deja gata de lucru
      } else { wait.hide(); notice(opts.addedMsg ? opts.addedMsg(key) : this.T(`Referință adăugată: @${key}`, `Reference added: @${key}`), 5000); }
      opts.after?.(file);
      return file;
    } catch (e) { wait.hide(); console.error("Texere Referințe: adăugare", e); if (opts.silent) throw e; new Notice(this.T("Nu am putut adăuga referința: ", "Couldn't add the reference: ") + e.message, 8000); opts.after?.(null); return null; }
  }
  // căutarea PDF-ului după ce nota există: îl atașează dacă îl găsește, altfel arată unde îl poți lua de mână
  async pdfLater(x, key, file, wait, base, dir) {
    const T = (a, b) => this.T(a, b);
    let name = null; try { name = await this.onePdf(file, () => this.fetchPdf(x, base, key, dir)); } catch (e) { console.warn("Texere References: PDF", e); }
    wait.hide();
    if (!name) { if ((x.oa || x.doi || x._pdfUrl) && !this.attachedPdfs(this.app.vault.getAbstractFileByPath(file.path) || file).length) this.noPdfNotice({ note: file, x }); return; }
    try {
      const f = this.app.vault.getAbstractFileByPath(file.path) || file;   // poate ai redenumit-o între timp
      await this.attachPdf(f, key, name);
      new Notice(T(`PDF găsit și atașat la @${key}`, `PDF found and attached to @${key}`), 5000);
    } catch (e) { console.error("Texere Referințe: atașarea PDF-ului", e); new Notice(T(`PDF-ul e în PDFs (${name}), dar nu l-am putut pune în attachment.`, `The PDF is in PDFs (${name}), but I couldn't add it to attachment.`), 8000); }
  }


  // test la prima pornire: rezultatul fiecărui catalog se scrie în sources-test.log (în folderul pluginului)
  async selfTest() {
    const c = this.conf(); if (c.selftest === 2) return;
    const lines = [`Texere References self-test ${new Date().toISOString()}`], ctx = this.ctx();
    const f = { type: "all", from: "", to: "" };
    for (const p of this.providers) {
      for (const q of ["responsibility artificial intelligence virtue", "Think Blackburn"]) {
        const t0 = Date.now();
        try { const r = await p.search(q, f, ctx); lines.push(`${p.id} | ${q} | ${r.length} results | ${Date.now() - t0}ms`); if (r[0]) lines.push("  first: " + JSON.stringify(r[0]).slice(0, 600)); }
        catch (e) { lines.push(`${p.id} | ${q} | ERROR ${e.status || ""} ${e.message}`); }
      }
    }
    try {
      const x = { doi: "10.1007/s10676-021-09616-9", title: "Understanding responsibility in Responsible AI", sources: [] };
      const csl = await this.fullCsl(x); lines.push("doi.org CSL: " + JSON.stringify(csl).slice(0, 800));
      lines.push("note:\n" + this.noteText(csl, "test_key_2021", null).text.slice(0, 1500));
    } catch (e) { lines.push("fullCsl ERROR " + e.message); }
    await this.app.vault.adapter.write(this.dir + "/sources-test.log", lines.join("\n"));
    c.selftest = 2; await this.save();
  }

}

// sub un folder al surselor care a dispărut: ce s-a întâmplat și ce poți face
function sourceFolderAlert(el, S, T, cur, moved, use, key, ask) {
  const to = moved && moved.from === cur && S.app.vault.getAbstractFileByPath(moved.to) ? moved.to : null;
  const box = el.createDiv("ts-falert"), w = folderWords(T, key), what = w.what;
  box.createDiv({ cls: "ts-falert-t", text: w.breaks });
  // în setări: ce se întâmplă de acum (următoarea salvare se oprește și întreabă); în fereastra „Unde salvez sursa?”: de ce întreabă acum
  const then = ask ? T("așa că Texere nu știe unde să salveze.", "so Texere doesn't know where to save.") : null, where = ask ? T("mai jos", "below") : T("din lista de deasupra", "from the list above"), What = what.charAt(0).toUpperCase() + what.slice(1);
  const g = to && moved.guess;
  box.createDiv({ cls: "ts-falert-d", text: g ? T(`${What}, „${cur}”, nu mai e în vault. Pare că l-ai redenumit în afara lui Obsidian: referințele tale sunt acum în „${to}”. Folosește „${to}”, pune-i înapoi numele vechi sau alege alt folder ${where}.`, `${What}, “${cur}”, isn't in your vault anymore. It looks like you renamed it outside Obsidian: your references are now in “${to}”. Use “${to}”, put back the old name, or pick another folder ${where}.`)
    : to ? T(`Ai redenumit ${what}: „${cur}” e acum „${to}”, ${ask ? then : `dar Texere încă îl caută pe „${cur}”. Până alegi, ${w.nextRo} se oprește și te întreabă unde să ajungă.`} Folosește numele nou, pune-i înapoi numele vechi sau alege alt folder ${where}.`, `You renamed ${what}: “${cur}” is now “${to}”, ${ask ? then : `but Texere still looks for “${cur}”. Until you choose, ${w.nextEn} will stop and ask where to go.`} Use the new name, put the old name back, or pick another folder ${where}.`)
    : T(`${What}, „${cur}”, nu mai e în vault (l-ai redenumit, mutat sau șters), ${ask ? then : `iar Texere încă îl caută. Până alegi, ${w.nextRo} se oprește și te întreabă unde să ajungă.`} Creează-l din nou sau alege alt folder ${where}.`, `${What}, “${cur}”, isn't in your vault anymore (renamed, moved or deleted), ${ask ? then : `but Texere still looks for it. Until you choose, ${w.nextEn} will stop and ask where to go.`} Create it again, or pick another folder ${where}.`) });
  const bt = box.createDiv("ts-falert-b");
  if (to) {
    bt.createEl("button", { cls: "mod-cta", text: T(`Folosește „${to}”`, `Use “${to}”`) }).addEventListener("click", () => use(to));
    bt.createEl("button", { text: T(`Pune-i înapoi numele „${cur}”`, `Put back the name “${cur}”`) }).addEventListener("click", async () => {
      try { const f = S.app.vault.getAbstractFileByPath(to), parent = cur.includes("/") ? cur.slice(0, cur.lastIndexOf("/")) : ""; if (parent) await S.ensureFolder(parent); await S.app.fileManager.renameFile(f, cur); await use(cur); }
      catch (e) { new Notice(T("N-am putut redenumi folderul: ", "Couldn't rename the folder: ") + e.message, 8000); }
    });
  } else bt.createEl("button", { cls: "mod-cta", text: T(`Creează din nou „${cur}”`, `Create “${cur}” again`) }).addEventListener("click", async () => { await S.ensureFolder(cur, true); await use(cur); });
  return box;
}
// ce nu mai merge când un folder al surselor e redenumit sau șters (aceleași cuvinte în setări, în tab-ul nou și în mesaje)
function folderWords(T, key) {
  if (key === "pdfs") return { what: T("folderul PDF-urilor", "the PDF folder"), breaks: T("PDF-urile noi nu ajung în folderul tău de PDF-uri", "New PDFs don't go into your PDF folder"),
    nextRo: "următorul PDF (al unei referințe noi, din Zotero sau din Downloads)", nextEn: "the next PDF (from a new reference, Zotero or Downloads)" };
  if (key === "inbox") return { what: T("Inbox-ul", "the Inbox"), breaks: T("PDF-urile fără referință nu ajung în Inbox-ul tău", "PDFs without a reference don't go into your Inbox"), nextRo: "următorul PDF fără referință", nextEn: "the next PDF without a reference" };
  return { what: T("folderul notelor de lectură", "the reading notes folder"), breaks: T("Referințele noi nu ajung în folderul tău de note", "New references don't go into your notes folder"), nextRo: "următoarea referință pe care o salvezi", nextEn: "the next reference you save" };
}
// „Unde salvez sursa?”: folderul notelor sau al PDF-urilor a dispărut; pentru fiecare: folosește numele nou, pune-l la loc, creează-l din nou sau alege altul
class SourceFoldersModal extends Modal {
  constructor(S, gone, done) { super(S.app); this.S = S; this.gone = gone; this.done = done; this.ok = false; }
  onOpen() {
    const S = this.S, T = (a, b) => S.T(a, b), el = this.contentEl, moved = S.conf().folderMoved || {}, folders = S.vaultFolders();
    this.modalEl.addClass("ts-folder-ask"); this.titleEl.setText(T("Unde salvez referința?", "Where should I save the reference?"));
    const names = { notes: T("Notele de lectură", "Reading notes"), pdfs: T("PDF-urile", "PDFs") }, pick = {};
    for (const [k, cur] of Object.entries(this.gone)) {
      new Setting(el).setName(names[k]).setHeading();
      sourceFolderAlert(el, S, T, cur, S.movedFor(k, cur), async to => { await S.setFolderRoot(k, to); delete this.gone[k]; if (!Object.keys(this.gone).length) { this.ok = true; this.close(); } else { this.contentEl.empty(); this.onOpen(); } }, k, true);
      const mk = S.movedFor(k, cur), ren = mk ? mk.to : null;
      pick[k] = ren || folders.find(f => f.split("/").pop().toLowerCase() === cur.split("/").pop().toLowerCase()) || folders[0];
      new Setting(el).setName(T("Alt folder din vault", "Another folder in your vault")).addDropdown(d => { for (const f of folders) d.addOption(f, f); d.setValue(pick[k]).onChange(v => { pick[k] = v; }); d.selectEl.addClass("tx-sel-200"); });
    }
    const bc = el.createDiv("modal-button-container");
    bc.createEl("button", { text: T("Renunță", "Cancel") }).addEventListener("click", () => this.close());
    bc.createEl("button", { cls: "mod-cta", text: T("Salvează acolo", "Save there") }).addEventListener("click", async () => { for (const k of Object.keys(this.gone)) await S.setFolderRoot(k, pick[k]); this.ok = true; this.close(); });
  }
  onClose() { this.contentEl.empty(); const d = this.done; this.done = null; d?.(this.ok); }
}


class SearchModal extends Modal {
  constructor(src, q, opts = {}) {
    super(src.app); this.src = src; this.q0 = q || ""; this.pdf = opts.pdf || null; this.auto = opts.auto || null; this.guess = opts.guess || null;
    // „after” se cheamă o singură dată: cu nota creată sau găsită, ori cu null dacă închizi fereastra fără să adaugi
    if (opts.after) { let called = false; this.after = n => { if (called) return; called = true; try { opts.after(n); } catch (e) { console.error(e); } }; } this.items = []; this.sel = -1; this.status = {}; this.lib = src.library();
    this.f = { type: "all", from: "", to: "", sort: "relevance", providers: new Set(src.enabled().filter(p => p.id !== "zotero").map(p => p.id)) }; this.cards = [];   // Zotero are fila lui
  }
  onOpen() {
    const S = this.src, T = (a, b) => S.T(a, b);
    this.modalEl.addClass("texere-src"); this.titleEl.empty();
    // titlul + filele: Caută · Lipește · Introdu manual — de la cel mai automat la cel mai manual (aceeași fereastră, aceeași mărime)
    this.titleEl.createSpan({ cls: "ts-head-t", text: this.pdf ? T("Adaugă un PDF ca referință", "Add a PDF as a reference") : T("Adaugă o referință", "Add a reference") });
    // filele sub titlu, pe rândul lor, ca în Insights (titlul sus, filele dedesubt)
    const sw = this.contentEl.createDiv("ts-modes ts-pnav"); this.modeBtns = {};
    const mod = /Mac|iPhone|iPad/.test(navigator.platform || "") ? "⌘" : "Ctrl+";
    [["search", T("Caută", "Search"), T("Caută în cataloage după titlu, autor sau un identificator (DOI, ISBN, link…)", "Search catalogs by title, author or an identifier (DOI, ISBN, link…)")],
     ...(S.zotero && S.ZoteroPane && !this.pdf ? [["zotero", "Zotero", T("Biblioteca ta din Zotero: colecțiile tale, cu PDF-urile și adnotările", "Your Zotero library: your collections, with their PDFs and annotations")]] : []),
     ["bibtex", T("Lipește", "Paste"), T("Ai deja referința: o citare, BibTeX, RIS, un DOI sau un link. Una sau mai multe deodată.", "You already have the reference: a citation, BibTeX, RIS, a DOI or a link. One or several at once.")],
     ["manual", T("Introdu manual", "Enter manually"), T("Referința nu e în niciun catalog: completezi tu datele.", "The reference isn't in any catalog: you fill in the details.")]].forEach(([m, label, tip], i) => {
      const b = sw.createSpan({ cls: "ts-mode", text: label }); b.title = `${tip}  (${mod}${i + 1})`;
      this.modeBtns[m] = b; b.addEventListener("click", () => this.setMode(m));
      try { this.scope?.register(["Mod"], String(i + 1), e => { e.preventDefault?.(); this.setMode(m); return false; }); } catch (e) {}
    });
    this.panes = { search: this.contentEl.createDiv("ts-pane"), bibtex: this.contentEl.createDiv("ts-pane"), manual: this.contentEl.createDiv("ts-pane") };
    if (this.modeBtns.zotero) this.panes.zotero = this.contentEl.createDiv("ts-pane");
    const c = this.panes.search;
    const qb = c.createDiv("ts-q"); try { setIcon(qb.createSpan(), "search"); } catch (e) {}
    const clr = qb.createEl("button", { cls: "ts-clear" }); try { setIcon(clr, "x"); } catch (e) { clr.textContent = "✕"; }
    clr.title = T("Golește căutarea", "Clear the search"); clr.hide();
    const inp = this.inp = qb.createEl("input", { type: "text", placeholder: T("Titlu, autor sau un identificator: DOI, ISBN, arXiv, link, PMID, PMCID…", "Title, author or an identifier: DOI, ISBN, arXiv, link, PMID, PMCID…") }); inp.value = this.q0;
    // un singur rând discret: tipul (file) în stânga; anii, ordinea și sursele în dreapta
    const fl = c.createDiv("ts-filters");
    const tabs = fl.createDiv("ts-tabs");
    for (const [v, a, b] of [["all", "Toate", "All"], ["article", "Articole", "Articles"], ["book", "Cărți", "Books"], ["chapter", "Capitole", "Chapters"]]) {
      const tb = tabs.createSpan({ cls: "ts-tab" + (v === "all" ? " on" : ""), text: T(a, b) });
      tb.addEventListener("click", () => { this.f.type = v; tabs.querySelectorAll(".ts-tab").forEach(e => e.toggleClass("on", e === tb)); this.run(); });
    }
    fl.createDiv("ts-spacer");
    const yr = fl.createEl("input", { cls: "ts-years", type: "text", placeholder: T("Ani, ex. 2015–2024", "Years, e.g. 2015–2024") });
    yr.title = T("Un an (2020), un interval (2015–2024), sau doar început (2015–) / sfârșit (–2010)", "One year (2020), a range (2015–2024), or only a start (2015–) / end (–2010)");
    yr.addEventListener("change", () => {
      const m = /^\s*(\d{4})?\s*([-–—]\s*(\d{4})?)?\s*$/.exec(yr.value);
      if (!m) { yr.addClass("bad"); return; } yr.removeClass("bad");
      this.f.from = m[1] || ""; this.f.to = m[2] ? (m[3] || "") : (m[1] || ""); this.run();
    });
    const so = fl.createEl("select", { cls: "ts-sel" });
    for (const [v, a, b] of [["relevance", "Relevante", "Relevant"], ["impact", "Cele mai influente", "Most influential"], ["cited", "Cele mai citate", "Most cited"], ["newest", "Cele mai noi", "Newest"]]) so.createEl("option", { value: v, text: T(a, b) });
    so.title = T("Relevante: cât de bine se potrivesc cu ce ai scris, apoi impactul.\nCele mai influente: citări față de media domeniului (FWCI), top 1% / 10%, citări pe an și ce spun citările (scite).\nCele mai citate: numărul total de citări.\nCele mai noi: anul.",
      "Relevant: how well they match what you typed, then impact.\nMost influential: citations compared with the field's average (FWCI), top 1% / 10%, citations per year and what citations say (scite).\nMost cited: total citations.\nNewest: year.");
    this.sortEl = so;
    so.addEventListener("change", () => { this.f.sort = so.value; this.sortChosen = true; this.resort(); });
    const sb = this.srcBtn = fl.createEl("button", { cls: "ts-srcbtn" });
    sb.addEventListener("click", e => { e.stopPropagation(); if (this.srcMenu) this.closeSrcMenu(); else this.openSrcMenu(sb); });
    this.statusEl = c.createDiv("ts-status");
    this.list = c.createDiv("ts-list");
    // celelalte moduri de a adăuga o sursă: la început, ca alternative vizibile; după căutare, în subsol („Nu găsești?”)
    this.openBibtex = () => this.setMode("bibtex");
    this.openManual = () => this.setMode("manual");
    this.openOther = e => {
      const { Menu } = require("obsidian"), m = new Menu(), q = encodeURIComponent(inp.value.trim());
      m.addItem(i => i.setTitle("Google Scholar").setIcon("external-link").onClick(() => window.open("https://scholar.google.com/scholar?q=" + q)));
      for (const [name, url] of [["Biblioteca Națională a României", `https://aleph.bibnat.ro/F?func=find-b&request=${q}`], ["Biblioteca Seminarului Teologic București", "https://www.catalog.bibseminarbuc.ro/"],
        ["WorldCat", `https://search.worldcat.org/search?q=${q}`], ["Google Books", `https://www.google.com/search?tbm=bks&q=${q}`]])
        m.addItem(i => i.setTitle(name).setIcon("external-link").onClick(() => window.open(url)));
      m.showAtMouseEvent(e);
    };
    // subsolul e același pe toate ecranele: stânga = acțiuni secundare, dreapta = acțiunea principală (setFoot)
    const ft = this.foot = this.contentEl.createDiv("ts-foot");
    this.footL = ft.createDiv("ts-foot-l"); this.footR = ft.createDiv("ts-foot-r");
    let t = null;
    const syncClr = () => { clr.toggle(!!(inp.value)); };
    clr.addEventListener("click", () => { inp.value = ""; syncClr(); clearTimeout(t); this.reqId = (this.reqId || 0) + 1; this.merged = []; this.run(); inp.focus(); });
    inp.addEventListener("input", () => { syncClr(); clearTimeout(t); t = setTimeout(() => this.run(), 650); });
    inp.addEventListener("paste", e => {
      const txt = e.clipboardData?.getData("text/plain") || "";
      if (looksLikeRef(txt)) { e.preventDefault(); clearTimeout(t); this.toPaste(txt); return; }
      if (/\n/.test(txt)) { e.preventDefault(); inp.setRangeText(txt.replace(/\s*\n\s*/g, " ").trim(), inp.selectionStart ?? inp.value.length, inp.selectionEnd ?? inp.value.length, "end"); inp.dispatchEvent(new window.Event("input")); }
    });
    this.toPaste = txt => {
      this.setMode("bibtex");
      this.bib?.fill(txt, T("Ce ai lipit arată ca o referință întreagă, așa că e aici: Texere o caută după DOI, ISBN sau după text, apoi o verifici.", "What you pasted looks like a full reference, so it's here: Texere looks it up by DOI, ISBN or its text, then you check it."));
      this.setFoot("bibtex");
    };
    syncClr();
    inp.addEventListener("keydown", e => {
      if (e.key === "ArrowDown") { e.preventDefault(); this.move(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); this.move(-1); }
      else if (e.key === "Enter") { e.preventDefault(); clearTimeout(t); const x = this.items[this.sel];
        const same = this.lastQ === inp.value.trim();
        if (x && same) { if (e.metaKey || e.ctrlKey) { this.close(); this.src.add(x, this.extra()); } else this.pick(x); }
        else if (same && this.items.length) this.move(1);   // nimic ales încă: Enter alege primul rezultat
        else this.run(); }
    });
    this.render();
    this.setMode(this.mode0 || "search");
    // catalogare: o bandă discretă sus, ca să știi ce PDF se atașează
    if (this.pdf) { const b = document.createElement("div"); b.className = "ts-catalog"; b.createSpan({ cls: "ts-catalog-f", text: this.pdf.name });
      b.appendText(T(" · alege referința potrivită; PDF-ul se atașează notei și se mută în PDFs.", " · choose the matching reference; the PDF is attached to its note and moved to PDFs.")); this.contentEl.prepend(b); }
    if (this.q0) this.run();
  }
  // comută între căutare, adăugare manuală și BibTeX fără să închidă fereastra
  setMode(m) {
    this.mode = m;
    for (const [k, el] of Object.entries(this.panes)) el.toggle(!!(k === m));
    for (const [k, b] of Object.entries(this.modeBtns)) b.toggleClass("on", k === m);
    if (m === "search") this.modalEl.toggleClass("is-loading", Object.values(this.status || {}).includes("busy"));
    const p = this.panes[m];
    if (m === "zotero" && !p.childElementCount) {
      const S = this.src;
      this.zpane = new S.ZoteroPane(S.zotero, { close: () => this.close(), refreshFoot: () => { if (this.mode === "zotero") this.setFoot("zotero"); }, settings: () => { this.close(); S.host.core.openSettings("sources"); } });
      this.zpane.build(p);
    } else if (m !== "search" && m !== "zotero" && !p.childElementCount) {
      const done = () => this.close();
      if (m === "manual") this.manualSubmit = new ManualModal(this.src, this.inp.value.trim(), { noBar: true, extra: this.extra(), csl: this.guess || undefined }).build(p, done);
      else this.bib = new BibtexModal(this.src, { noBar: true, onCount: () => this.setFoot("bibtex"), onOne: (x, csl) => this.review(x, csl) }).build(p, done);
    }
    this.setFoot(m);
    if (m === "zotero") { setTimeout(() => this.zpane?.inp?.focus(), 30); return; }
    setTimeout(() => (m === "search" ? this.inp : m === "manual" ? p.querySelector('input[type="text"], input:not([type]), textarea') : p.querySelector("textarea, input, select"))?.focus(), 30);
  }
  // „Surse ▾”: lista cataloagelor rămâne deschisă cât timp bifezi (rezultatele se reîncarcă în spate); se închide la clic în afară, Esc sau din nou pe buton
  openSrcMenu(anchor) {
    const S = this.src, T = (a, b) => S.T(a, b);
    const menu = this.srcMenu = document.body.createDiv("texere-src-menu"), r = anchor.getBoundingClientRect();
    menu.setCssStyles({ top: Math.round(r.bottom + 4) + "px", right: Math.max(8, Math.round(window.innerWidth - r.right)) + "px" });
    const rows = [];
    for (const p of S.enabled().filter(p => p.id !== "zotero")) {
      const it = menu.createDiv("ts-sm-item"), ck = it.createSpan("ts-sm-ck"), _name = it.createSpan({ cls: "ts-sm-name", text: p.name }), nt = it.createSpan("ts-sm-note");
      it.addEventListener("mousedown", e => e.preventDefault());
      it.addEventListener("click", e => { e.stopPropagation(); if (this.f.providers.has(p.id)) { if (this.f.providers.size > 1) this.f.providers.delete(p.id); } else this.f.providers.add(p.id); this.updateSrcMenu(); clearTimeout(this._srcT); this._srcT = setTimeout(() => this.run(), 350); });
      rows.push({ p, it, ck, nt });
    }
    menu.createDiv("ts-sm-sep");
    const more = menu.createDiv({ cls: "ts-sm-item ts-sm-more", text: T("Alte referințe și chei…", "More references and keys…") });
    more.addEventListener("click", () => { this.closeSrcMenu(); this.close(); S.host.core.openSettings("sources"); });
    this._srcRows = rows; this.updateSrcMenu();
    this._srcOut = e => { if (!menu.contains(e.target) && e.target !== anchor && !anchor.contains(e.target)) this.closeSrcMenu(); };
    this._srcKey = e => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); this.closeSrcMenu(); } };
    setTimeout(() => { document.addEventListener("mousedown", this._srcOut, true); window.addEventListener("keydown", this._srcKey, true); }, 0);
  }
  updateSrcMenu() {
    if (!this.srcMenu) return; const S = this.src, T = (a, b) => S.T(a, b);
    for (const { p, it, ck, nt } of this._srcRows || []) {
      const on = this.f.providers.has(p.id), st = this.status[p.id], n = this.items.filter(x => x.sources.includes(p.id)).length, why = S.errors?.[p.id] ? ` (${S.errors[p.id]})` : "";
      it.toggleClass("on", on); ck.setText(on ? "✓" : "");
      nt.setText(!on ? "" : st === "ok" ? `· ${n}` : st === "busy" ? "· …" : st === "limit" ? `· ${S.usageInfo(p.id)?.text || T("limită atinsă", "limit reached")}` : st ? T("· nu răspunde", "· not responding") + why : "");
    }
  }
  closeSrcMenu() {
    if (!this.srcMenu) return; this.srcMenu.remove(); this.srcMenu = null;
    document.removeEventListener("mousedown", this._srcOut, true); window.removeEventListener("keydown", this._srcKey, true);
  }
  // subsolul pentru fiecare ecran
  setFoot(m) {
    const S = this.src, T = (a, b) => S.T(a, b), L = this.footL, Rr = this.footR; if (!L) return;
    L.empty(); Rr.empty();
    const link = (txt, fn, tip) => { const a = L.createEl("a", { text: txt }); if (tip) a.title = tip; a.addEventListener("click", fn); return a; };
    const btn = (txt, fn) => { const b = Rr.createEl("button", { cls: "mod-cta", text: txt }); b.addEventListener("click", fn); return b; };
    const note = txt => L.createSpan({ cls: "ts-foot-q", text: txt });
    if (m === "search") {
      if ((this.inp?.value.trim() || "").length >= 3) {
        note(T("Nu găsești?", "Can't find it?"));
        link(T("Lipește referința", "Paste the reference"), () => this.setMode("bibtex"), T("O citare, BibTeX sau RIS (de ex. din Google Scholar)", "A citation, BibTeX or RIS (e.g. from Google Scholar)"));
        link(T("Introdu manual", "Enter manually"), () => this.setMode("manual"));
        link(T("Alte cataloage ↗", "Other catalogs ↗"), e => this.openOther(e));
      }
      Rr.createSpan({ cls: "ts-keys", text: T("↑↓ alegi · Enter vezi datele · ⌘/Ctrl+Enter adaugi direct", "↑↓ choose · Enter review · ⌘/Ctrl+Enter add directly") });
    } else if (m === "manual") {
      note(T("Doar titlul e obligatoriu.", "Only the title is required."));
      btn(T("Adaugă în vault", "Add to vault"), () => this.manualSubmit?.());
    } else if (m === "bibtex") {
      if (this.bib?.state?.() === "list") {
        link(T("← Editează textul", "← Edit the text"), () => this.bib.back());
        const k = this.bib.checked(), b = btn(this.bib.pending() ? T("Caut…", "Looking up…") : (k === 1 ? T("Adaugă 1 referință", "Add 1 reference") : T(`Adaugă ${k} referințe`, `Add ${k} references`)), () => this.bib?.submit()); b.disabled = this.bib.pending() || !k;
      } else {
        const n = this.bib?.count() || 0;
        note(!n ? T("Lipește una sau mai multe referințe.", "Paste one or more references.") : n > 1 ? T(`${n} referințe: le caut pe toate, apoi alegi ce adaugi.`, `${n} references: I'll look them all up, then you choose what to add.`) : T("O referință: o verifici înainte s-o adaugi.", "One reference: you check it before adding it."));
        btn(n > 1 ? T(`Caută ${n} referințe`, `Look up ${n} references`) : T("Continuă", "Continue"), () => this.bib?.submit());
      }
    } else if (m === "zotero") {
      this.zpane?.foot(L, Rr);
    } else if (m === "review") {
      link(T("← Înapoi", "← Back"), () => this.setMode(this.reviewFrom || "search"));
      btn(T("Adaugă în vault", "Add to vault"), () => this.reviewSubmit?.());
    }
  }
  // citările care susțin / contrazic (scite) pentru primele 15 rezultate cu DOI, câte 4 deodată
  async loadScite(id) {
    const todo = this.items.slice(0, 15).filter(x => x.doi && x.scite === undefined);
    let t = null; const redraw = () => { clearTimeout(t); t = setTimeout(() => { if (id !== this.reqId) return; if (this.f.sort === "impact") this.items = this.src.rank(this.merged?.length ? this.merged : this.items, this.lastQ, this.f); this.render(); }, 150); };
    const run = async () => { while (todo.length && id === this.reqId) { const x = todo.shift(); try { x.scite = await this.src.scite(x.doi); } catch (e) { x.scite = null; } redraw(); } };
    await Promise.all([run(), run(), run(), run()]);
  }
  move(d) { if (!this.items.length) return; this.sel = this.sel < 0 ? (d > 0 ? 0 : this.items.length - 1) : (this.sel + d + this.items.length) % this.items.length; this.render(); this.list.querySelectorAll(".ts-item")[this.sel]?.scrollIntoView({ block: "nearest" }); }
  run() {
    const q = this.inp.value.trim(); this.lastQ = q;
    if (q.length < 3) { this.items = []; this.status = {}; this.loading = false; this.render(); return; }
    const id = (this.reqId = (this.reqId || 0) + 1), t0 = Date.now();
    this.loading = true; this.items = []; this.cards = []; this.sel = -1; this.render();
    let shown = false, pend = null;
    this.src.search(q, this.f, (items, status, cards, merged) => {
      if (id !== this.reqId) return;
      this.status = status; this.merged = merged || []; const busy = Object.values(status).includes("busy");
      const show = () => {
        if (id !== this.reqId) return; shown = true; this.cards = cards || [];
        // un autor căutat: lista pornește de la lucrările lui cele mai influente (dacă n-ai ales tu altă ordine)
        if (!this.sortChosen) { const want = this.cards.length ? "impact" : "relevance"; if (this.f.sort !== want) { this.f.sort = want; if (this.sortEl) this.sortEl.value = want; } }
        this.items = this.merged.length ? this.src.rank(this.merged, q, this.f) : items; this.loading = busy; if (this.sel >= this.items.length) this.sel = -1; this.render();
        if (!busy && this.auto && this.mode === "search") {   // catalogare după DOI/ISBN: sursa găsită se deschide direct în verificare
          const a = this.auto; this.auto = null;
          const hit = this.items.find(x => (a.doi && cleanDoi(x.doi)?.toLowerCase() === a.doi.toLowerCase()) || (a.isbn && isbn13(x.isbn) === a.isbn)) || (this.items.length === 1 ? this.items[0] : null);
          if (hit) this.pick(hit);
        }
        if (!busy) this.loadScite(id);
      };
      clearTimeout(pend);
      if (!busy || shown) show();
      else { if (Object.values(status).some(s => s !== "busy")) pend = setTimeout(show, Math.max(0, 3000 - (Date.now() - t0))); this.render(); }
    });
  }
  // altă ordine = aceleași rezultate, reordonate pe loc (fără să caute din nou)
  resort() { if (!this.merged?.length) return this.run(); this.items = this.src.rank(this.merged, this.lastQ, this.f); this.sel = -1; this.render(); }
  render() {
    const S = this.src, T = (a, b) => S.T(a, b);
    const busy = Object.values(this.status).includes("busy"), q = this.inp?.value.trim() || "";
    const on = S.enabled().filter(p => this.f.providers.has(p.id)), bad = on.filter(p => this.status[p.id] === "err" || this.status[p.id] === "limit");
    if (this.srcBtn) { this.srcBtn.setText(T(`Referințe: ${on.length}`, `References: ${on.length}`) + (bad.length ? " ⚠" : "") + " ▾");
      this.srcBtn.title = on.map(p => p.name).join(", "); }
    const waiting = on.filter(p => this.status[p.id] === "busy").map(p => p.name);
    let line = q.length < 3 ? "" : busy ? T(`Caut în ${waiting.join(", ")}…`, `Searching ${waiting.join(", ")}…`) + (this.items.length ? T(` · ${this.items.length} rezultate până acum`, ` · ${this.items.length} results so far`) : "") : T(`${this.items.length} rezultate`, `${this.items.length} results`);
    if (!busy && q.length >= 3 && this.cards.length && this.f.sort === "impact" && !this.sortChosen) line += T(" · ordonate după influență, pentru că ai căutat un autor", " · ordered by influence, since you searched an author");
    this.modalEl.toggleClass("is-loading", busy && q.length >= 3);
    const lim = bad.filter(p => this.status[p.id] === "limit"), err = bad.filter(p => this.status[p.id] !== "limit");
    if (err.length && q.length >= 3) line += T(` · ${err.map(p => p.name).join(", ")} nu răspunde acum`, ` · ${err.map(p => p.name).join(", ")} not responding right now`);
    if (lim.length && q.length >= 3) line += " · " + lim.map(p => `${p.name}: ${S.usageInfo(p.id)?.text || T("limită atinsă", "limit reached")}`).join(" · ");
    this.statusEl.setText(line); this.updateSrcMenu?.();
    this.list.empty();
    if (this.mode === "search") this.setFoot("search");
    if (q.length < 3) {
      const st = this.list.createDiv("ts-start");
      // ce scrii în câmp e explicat de câmp; aici, un rând: ce se întâmplă când lipești o referință întreagă
      st.createDiv({ cls: "ts-start-alt", text: T("Poți lipi și o citare întreagă, un BibTeX sau un DOI.", "You can also paste a full citation, BibTeX or a DOI.") });
      // PDF-urile din vault care n-au încă o sursă (numărate o dată pe fereastră)
      if (this._unc === undefined) { try { this._unc = S.uncatalogedFiles().length; } catch (e) { this._unc = 0; } }
      if (this._unc) { const a = st.createEl("a", { cls: "ts-start-unc", href: "#", text: T(`PDF-uri fără referință (${this._unc})`, `PDFs without a reference (${this._unc})`) }); a.addEventListener("click", e => { e.preventDefault(); this.close(); S.uncataloged(); }); }
      return;
    }
    if (/scholar\.google\.[a-z.]+\/citations/i.test(q) && !S.conf().serpapiKey) { this.list.createDiv({ cls: "ts-empty", text: T("Pentru profilurile Google Scholar e nevoie de o cheie SerpApi (Settings → Texere → Referințe → Cataloage). Până atunci, caută numele autorului: Texere caută în OpenAlex, Crossref și ORCID.", "Google Scholar profiles need a SerpApi key (Settings → Texere → References → Catalogs). Until then, search the author's name: Texere looks in OpenAlex, Crossref and ORCID.") }); return; }
    if (!this.items.length && busy && q.length >= 3) {
      for (let i = 0; i < 4; i++) { const sk = this.list.createDiv("ts-item ts-skel"); sk.createDiv("sk sk-t"); sk.createDiv("sk sk-m"); sk.createDiv("sk sk-b"); }
      return;
    }
    if (!this.items.length && q.length >= 3 && !busy) {
      const em = this.list.createDiv({ cls: "ts-empty", text: T("Nimic găsit. Încearcă alte cuvinte, un DOI sau ISBN. Multe cărți de la edituri mici nu sunt în niciun catalog public: ", "Nothing found. Try other words, a DOI or ISBN. Many books from small publishers aren't in any public catalog: ") });
      const a1 = em.createEl("a", { text: T("lipește referința", "paste the reference") }); a1.addClass("tx-pointer"); a1.addEventListener("click", () => this.setMode("bibtex"));
      em.appendChild(document.createTextNode(T(" sau ", " or ")));
      const a = em.createEl("a", { cls: "tx-pointer", text: T("introdu-o manual", "enter it manually") });
      a.addEventListener("click", () => this.setMode("manual")); em.appendChild(document.createTextNode("."));
      return;
    }
    const kindLabel = { article: T("Articol", "Article"), book: T("Carte", "Book"), chapter: T("Capitol", "Chapter") };
    const toks = normTitle(q).split(" ").filter(w => w.length > 1);
    // cuvintele căutate apar îngroșate în titlu și la autori
    const hl = (el, text) => { for (const part of String(text).split(/(\s+)/)) { const w = normTitle(part); if (w && toks.some(t => w === t || (t.length > 3 && w.startsWith(t)))) el.createSpan({ cls: "ts-hl", text: part }); else el.appendChild(document.createTextNode(part)); } };
    const nf = n => Number(n).toLocaleString(S.en ? "en-US" : "ro-RO");
    for (const c of this.cards) {
      const card = this.list.createDiv("ts-card");
      const top = card.createDiv("ts-card-name"); top.createSpan({ text: c.name });
      if (c.inst) top.createSpan({ cls: "ts-card-inst", text: " · " + c.inst });
      const st = card.createDiv("ts-badges");
      st.createSpan({ cls: "ts-b", text: T(`${nf(c.works)} lucrări`, `${nf(c.works)} works`) });
      st.createSpan({ cls: "ts-b", text: T(`${nf(c.cited)} citări`, `${nf(c.cited)} citations`) });
      if (c.h) { const h = st.createSpan({ cls: "ts-b", text: "h-index " + c.h }); h.title = T("h lucrări citate de cel puțin h ori fiecare", "h works cited at least h times each"); }
      if (c.profiles > 1) st.createSpan({ cls: "ts-b", text: T(`${c.profiles} profiluri OpenAlex unite`, `${c.profiles} OpenAlex profiles joined`) });
      const lk = (txt, url) => { const a = st.createEl("a", { cls: "ts-b ts-link", text: txt + " ↗" }); a.addEventListener("click", e => { e.stopPropagation(); window.open(url); }); };
      if (c.orcid) lk("ORCID", c.orcid); if (c.url) lk("OpenAlex", c.url);
      card.title = T("Lucrările lui sunt mai jos; pentru o ordine anume, alege „Cele mai citate” sau „Cele mai noi”.", "Their works are below; for a specific order choose “Most cited” or “Newest”.");
    }
    const names = Object.fromEntries(S.providers.map(p => [p.id, p.name]));
    this.items.forEach((x, i) => {
      const row = this.list.createDiv("ts-item" + (i === this.sel ? " sel" : ""));
      const tl = row.createDiv("ts-title"); hl(tl, stripTags(x.title));
      const go = x.doi ? `https://doi.org/${x.doi}` : x.url;
      if (go) { const a = tl.createEl("a", { cls: "ts-open", text: " ↗" }); a.title = T("Deschide pagina referinței, fără s-o adaugi", "Open the reference's page without adding it"); a.addEventListener("click", e => { e.stopPropagation(); window.open(go); }); }
      // autorii: primii trei, iar dacă autorul căutat e mai departe în listă, apare și el, cu locul lui (ex. „Mihailov (6/9)”)
      const ppl = (x.authors || []).map(a => a.literal || a.family).filter(Boolean), full = (x.authors || []).map(a => [a.given, a.family, a.literal].filter(Boolean).join(" "));
      const who = toks.length > 1 ? full.findIndex(n => toks.every(t => normTitle(n).split(" ").some(w => w === t || w.startsWith(t)))) : -1;
      let byline = ppl.slice(0, 3).join(", ");
      if (ppl.length > 3) byline += who >= 3 ? ` … ${ppl[who]} (${who + 1}/${ppl.length})` : " et al.";
      const meta = row.createDiv("ts-meta");
      if (byline) hl(meta, byline);
      const rest = [x.year, x.venue || x.publisher].filter(Boolean).join(" · ");
      if (rest) meta.appendChild(document.createTextNode((byline ? " · " : "") + rest));
      if (x.abstract) row.createDiv({ cls: "ts-abs", text: stripTags(x.abstract).replace(/^(abstract|rezumat|résumé|zusammenfassung)[\s.:]+/i, "") });
      const b = row.createDiv("ts-badges");
      const have = this.lib.find(x);
      b.createSpan({ cls: "ts-b kind", text: kindLabel[S.kind(x.type)] });
      if (have) b.createSpan({ cls: "ts-b have", text: T("✓ deja în vault", "✓ already in your vault") });
      if (x.retracted) { const r = b.createSpan({ cls: "ts-b retracted", text: T("Retrasă", "Retracted") }); r.title = T("Lucrarea a fost retrasă de editor", "The publisher retracted this work"); }
      if (x.cited != null) b.createSpan({ cls: "ts-b", text: T(`${x.cited.toLocaleString("ro-RO")} citări`, `${x.cited.toLocaleString("en-US")} citations`) });
      if (x.scite && (x.scite.s || x.scite.c)) {
        const sc = b.createSpan({ cls: "ts-b" }); sc.title = T("Citări care susțin / contrazic / menționează (scite)", "Citations that support / contrast / mention it (scite)");
        for (const [n, col, a, e] of [[x.scite.s, "#00A896", "susțin", "supporting"], [x.scite.c, "#F45B5B", "contrazic", "contrasting"]]) {
          const d = sc.createSpan({ cls: "ts-dot" }); d.setCssStyles({ background: col }); sc.appendText ? sc.appendText(` ${n} ${T(a, e)}  `) : sc.appendChild(document.createTextNode(` ${n} ${T(a, e)}  `)); }
      }
      // revista: nivelul dat de comisiile de specialiști (Norvegia, Finlanda) și ERIH PLUS, din OpenAlex
      if (x.lists?.length) { const L = new Set(x.lists), fin = L.has("jufo-3") ? 3 : L.has("jufo-2") ? 2 : L.has("jufo-1") ? 1 : 0, nor = L.has("norway-2") ? 2 : L.has("norway-1") ? 1 : 0;
        if (fin >= 2 || nor === 2) { const jb = b.createSpan({ cls: "ts-b top", text: fin === 3 ? T("Revistă de top", "Top journal") : T("Revistă de prim rang", "Leading journal") }); jb.title = [nor ? T(`Norvegia: nivelul ${nor}`, `Norway: level ${nor}`) : "", fin ? T(`Finlanda (JUFO): nivelul ${fin}`, `Finland (JUFO): level ${fin}`) : ""].filter(Boolean).join(" · ") + "\n" + T("Evaluată de comisii de specialiști din domeniu", "Rated by expert panels in its field"); }
        if (L.has("erih-plus")) { const eb = b.createSpan({ cls: "ts-b", text: "ERIH PLUS" }); eb.title = T("Indexată în ERIH PLUS, indexul european al revistelor de științe umaniste și sociale", "Indexed in ERIH PLUS, the European index of humanities and social sciences journals"); } }
      if (x.top1 || x.top10) { const tp = b.createSpan({ cls: "ts-b top", text: x.top1 ? "Top 1%" : "Top 10%" }); tp.title = T("Printre cele mai citate lucrări din domeniu și an (OpenAlex)", "Among the most cited works of its field and year (OpenAlex)"); }
      if (x.fwci != null && x.fwci > 0) { const fw = b.createSpan({ cls: "ts-b", text: "FWCI " + x.fwci.toFixed(1) }); fw.title = T("1 = media domeniului; 2 = de două ori mai citată decât media", "1 = field average; 2 = cited twice as much as the average"); }
      if (x.oa) b.createSpan({ cls: "ts-b oa", text: x.pdf?.length ? T("Acces deschis · PDF", "Open access · PDF") : T("Acces deschis", "Open access") });
      if (x.lang && !/^en/i.test(x.lang)) b.createSpan({ cls: "ts-b lang", text: String(x.lang).slice(0, 2).toUpperCase() });
      if (x.doi) b.createSpan({ cls: "ts-b", text: "DOI" });
      else if (x.isbn) b.createSpan({ cls: "ts-b", text: "ISBN " + x.isbn });
      b.createSpan({ cls: "ts-b", text: x.sources.map(s => names[s] || s).join(" · ") });
      row.title = have ? T("Enter: deschide nota", "Enter: open the note") : T("Enter: vezi toate datele și adaugă referința", "Enter: see all the data and add the reference");
      row.addEventListener("click", () => { this.sel = i; this.pick(x); });
    });
  }
  onClose() { this.closeSrcMenu?.(); this.zpane?.destroy?.(); if (this.after) setTimeout(() => { if (!this._submitted) this.after(null); }, 0); }
  extra() { return this.pdf ? { pdfFile: this.pdf, after: this.after, submitted: () => { this._submitted = true; } } : {}; }
  async pick(x) {
    const have = this.lib.find(x);
    if (have) { this._submitted = true; this.close(); if (this.pdf) await this.src.attachToNote(have, this.pdf); if (this.after) { this.after(have); return; } await this.app.workspace.getLeaf("tab").openFile(have); return; }
    this.review(x);
  }
  async review(x, cslGiven) {
    const S = this.src, T = (a, b) => S.T(a, b);
    this.reviewFrom = this.mode === "review" ? this.reviewFrom : this.mode || "search";
    const p = this.panes.review || (this.panes.review = this.contentEl.insertBefore(Object.assign(document.createElement("div"), { className: "ts-pane" }), this.foot));
    p.empty(); this.mode = "review"; this.reviewSubmit = null;
    for (const [k, el] of Object.entries(this.panes)) el.toggle(!!(k === "review"));
    for (const b of Object.values(this.modeBtns)) b.toggleClass("on", false);
    this.setFoot("review");
    const names = Object.fromEntries(S.providers.map(pr => [pr.id, pr.name]));
    const info = p.createDiv({ cls: "ts-hint", text: T("Încarc toate datele referinței…", "Loading all of the reference's data…") });
    let csl = cslGiven;
    if (!csl) { this.modalEl.toggleClass("is-loading", true); try { csl = await S.fullCsl(x); } catch (e) { csl = null; } this.modalEl.toggleClass("is-loading", false); }
    if (this.mode !== "review") return;   // ai plecat între timp
    const found = x.sources?.length ? T(" Găsit în: ", " Found in: ") + x.sources.map(s => names[s] || s).join(" · ") + "." : "";
    info.setText(T("Verifică datele și corectează ce e nevoie.", "Check the data and fix anything that needs it.") + found
      + (S.conf().pdf && (x.doi || x.pdf?.length) ? T(" PDF-ul gratuit, dacă există, se descarcă automat.", " The free PDF, if there is one, is downloaded automatically.") : "") + (x.fixNote || ""));
    this.reviewSubmit = new ManualModal(S, "", { csl: csl || {}, noBar: true,
      onSubmit: async (c, custom) => { await S.add({ ...x, title: c.title, doi: cleanDoi(c.DOI) || x.doi, isbn: isbn13(c.ISBN) || x.isbn, sources: x.sources || [] }, { csl: c, custom, ...this.extra() }); } })
      .build(p, () => this.close());
  }
}

// rând de acțiuni fixat jos în panou (butonul rămâne vizibil oricât de lung e formularul)
function actions(c, label, fn) {
  const bar = c.createDiv("ts-actions"); const b = bar.createEl("button", { cls: "mod-cta", text: label }); b.addEventListener("click", fn); return bar;
}

class BibtexModal extends Modal {
  constructor(src, opts) { super(src.app); this.src = src; this.opts = opts || {}; }
  onOpen() { this.modalEl.addClass("texere-src"); this.titleEl.setText(this.src.T("Lipește o referință", "Paste a reference")); const p = this.contentEl.createDiv("ts-pane"); const api = this.build(p, () => this.close()); actions(p, this.src.T("Adaugă în vault", "Add to vault"), api.submit); }
  build(c, done) {
    const S = this.src, T = (a, b) => S.T(a, b);
    const hint = c.createDiv({ cls: "ts-hint", text: T("Lipește o referință în orice formă: o citare (APA, Chicago, Frontiers…), BibTeX, RIS, un DOI, un ISBN sau un link. Mai multe deodată: câte una pe paragraf (sau pe rând).",
      "Paste a reference in any form: a citation (APA, Chicago, Frontiers…), BibTeX, RIS, a DOI, an ISBN or a link. Several at once: one per paragraph (or per line).") });
    const ta = c.createEl("textarea", { attr: { placeholder: T("ex. Felber NA, Mihailov E and Wangmo T (2025) Virtual reality as a possible aged care technology… doi: 10.3389/frvir.2025.1502450\n\n@article{…}", "e.g. Felber NA, Mihailov E and Wangmo T (2025) Virtual reality as a possible aged care technology… doi: 10.3389/frvir.2025.1502450\n\n@article{…}") } });
    ta.addClass("ts-bib-ta");
    const list = c.createDiv("ts-paste-list"); list.hide();
    let state = "input", rows = [];
    const kind = () => pastedKind(ta.value), count = () => kind().refs.length;
    ta.addEventListener("input", () => this.opts.onCount?.());
    const toX = e => ({ title: e.csl.title, authors: e.csl.author, year: e.csl.issued?.["date-parts"]?.[0]?.[0], doi: cleanDoi(e.csl.DOI), isbn: isbn13(e.csl.ISBN), type: e.csl.type, sources: [] });
    const HOW = { doi: T("găsită după DOI", "found by DOI"), id: T("găsită după identificator", "found by identifier"), matched: T("găsită după text: verifică dacă e aceeași", "matched by text: check it's the same one"),
      bibtex: T("din BibTeX", "from BibTeX"), guess: T("negăsită în cataloage: am completat ce am putut citi", "not found in catalogs: I filled in what I could read") };
    // o intrare BibTeX/RIS → completăm din Crossref dacă se poate (ca până acum)
    const fromEntry = async e => {
      const x = toX(e); let csl = e.csl;
      if (e.fixed) {
        x.fixNote = T(" Unele litere lipseau din BibTeX (apăreau „?”); le-am refăcut (ș/ț) după regulile limbii: verifică titlul, autorii și editura.", " Some letters were missing in the BibTeX (shown as “?”); I filled them in (ș/ț) using Romanian spelling rules: check the title, authors and publisher.");
        try { const hit = await S.verifyCsl(csl); if (hit) { csl = { ...csl, title: hit.title || csl.title, ...(hit.isbn && !csl.ISBN ? { ISBN: hit.isbn } : {}), ...(hit.publisher ? { publisher: hit.publisher } : {}) }; x.title = csl.title; x.isbn = isbn13(csl.ISBN) || x.isbn;
          x.fixNote = T(` Unele litere lipseau din BibTeX; titlul l-am luat din ${hit.sourceName || "catalog"}, unde referința apare corect.`, ` Some letters were missing in the BibTeX; I took the title from ${hit.sourceName || "a catalog"}, where the reference is spelled correctly.`); } } catch (e2) {}
      }
      if (!x.doi && x.title) { try { x.doi = await S.findDoi(x); } catch (e2) {} }
      if (x.doi) { try { const full = await S.fullCsl({ ...x }); if (full?.title) csl = { ...csl, ...full }; } catch (e2) {} }
      return { x, csl, how: "bibtex" };
    };
    const resolveAll = async (k, onEach) => { const out = []; for (const [i, r] of k.refs.entries()) { const v = k.kind === "text" ? await S.resolveRef(r) : await fromEntry(r); out.push(v); onEach?.(i, v); } return out; };
    const showList = (k) => {
      state = "list"; hint.setText(T("Am căutat fiecare referință. Bifează ce adaugi; cele negăsite le poți deschide cu „Verifică”.", "I looked up each reference. Tick what to add; the ones not found you can open with “Check”."));
      ta.hide(); list.show(); list.empty(); rows = [];
      k.refs.forEach((r, i) => {
        const row = list.createEl("label", { cls: "ts-paste-row" }); row.addEventListener("mousedown", e => { if (e.target.tagName !== "A") e.preventDefault(); });
        const cb = row.createEl("input", { type: "checkbox" }); cb.disabled = true;
        const box = row.createDiv("ts-paste-main"); box.createDiv({ cls: "ts-paste-t", text: typeof r === "string" ? r.slice(0, 160) : (r.csl.title || "") }); const st = box.createDiv({ cls: "ts-paste-st", text: T("caut…", "looking it up…") });
        rows.push({ cb, box, st, v: null }); cb.addEventListener("change", () => this.opts.onCount?.());
      });
      this.opts.onCount?.();
      return (i, v) => {
        const r = rows[i]; r.v = v; r.cb.disabled = false; r.cb.checked = v.how !== "guess";
        const a = (v.csl.author || []).map(p => p.family || p.literal).filter(Boolean), yr = v.csl.issued?.["date-parts"]?.[0]?.[0];
        r.box.querySelector(".ts-paste-t").setText(v.csl.title || T("(fără titlu)", "(no title)"));
        r.st.empty(); r.st.appendText([a.length > 2 ? a[0] + " et al." : a.join(" & "), yr, v.csl["container-title"] || v.csl.publisher].filter(Boolean).join(" · ") + " — ");
        r.st.createSpan({ cls: "ts-paste-how " + v.how, text: HOW[v.how] });
        if (this.opts.onOne) { r.st.appendText(" · "); const ed = r.st.createEl("a", { text: T("Verifică", "Check") }); ed.addEventListener("click", e => { e.preventDefault(); this.opts.onOne(v.x, v.csl); }); }
        this.opts.onCount?.();
      };
    };
    const submit = async () => {
      if (state === "list") {   // adaugă ce e bifat
        const pick = rows.filter(r => r.v && r.cb.checked); if (!pick.length) return;
        done(); for (const r of pick) await S.add(r.v.x, { csl: r.v.csl });
        return;
      }
      const k = kind();
      if (!k.refs.length) { new Notice(T("Lipește cel puțin o referință.", "Paste at least one reference.")); return; }
      if (k.refs.length === 1 && this.opts.onOne) {   // una singură: direct în ecranul de verificare
        const wait = new Notice(T("Caut referința…", "Looking up the reference…"), 0);
        let v; try { v = (await resolveAll(k))[0]; } finally { wait.hide(); }
        if (v.how !== "bibtex") v.x.fixNote = " " + T("Referința a fost ", "The reference was ") + HOW[v.how] + ".";
        this.opts.onOne(v.x, v.csl); return;
      }
      const upd = showList(k); await resolveAll(k, upd);
    };
    const back = () => { state = "input"; ta.show(); list.hide(); hint.setText(T("Lipește o referință în orice formă: o citare (APA, Chicago, Frontiers…), BibTeX, RIS, un DOI, un ISBN sau un link. Mai multe deodată: câte una pe paragraf (sau pe rând).", "Paste a reference in any form: a citation (APA, Chicago, Frontiers…), BibTeX, RIS, a DOI, an ISBN or a link. Several at once: one per paragraph (or per line).")); this.opts.onCount?.(); setTimeout(() => ta.focus(), 30); };
    setTimeout(() => ta.focus(), 30);
    // textul lipit în Căutare ajunge aici, cu o explicație scurtă
    const fill = (txt, why) => { if (state === "list") back(); ta.value = String(txt).trim(); if (why) hint.setText(why); this.opts.onCount?.(); setTimeout(() => { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }, 30); };
    return { submit, count, back, fill, state: () => state, checked: () => rows.filter(r => r.v && r.cb.checked).length, pending: () => rows.some(r => !r.v) };
  }
}

// adăugare manuală: pentru cărți care nu sunt în niciun catalog public. Câmpurile depind de tip (carte, capitol, articol),
// iar cele mai rare stau sub „Mai multe detalii”.
class ManualModal extends Modal {
  constructor(src, q, opts) { super(src.app); this.src = src; this.q = q || ""; this.opts = opts || {}; }
  onOpen() { this.modalEl.addClass("texere-src"); this.titleEl.setText(this.src.T("Adaugă o referință manual", "Add a reference manually")); const p = this.contentEl.createDiv("ts-pane"); this.build(p, () => this.close()); }
  build(c, done) {
    const S = this.src, T = (a, b) => S.T(a, b);
    const v = { type: "book" }, inputs = {};
    const qi = isbn13(this.q.replace(/^isbn[:\s]*/i, "")), qd = cleanDoi(this.q);
    const grid = c.createDiv("ts-form");
    // [cheie, etichetă, exemplu, tipuri la care apare, avansat]
    const B = "book", C = "chapter", A = "article-journal", E = "entry-encyclopedia", TH = "thesis", P = "paper-conference", N = "article-newspaper", W = "webpage", R = "report";
    const ALL = [B, C, A, E, TH, P, N, W, R];
    // eticheta unor câmpuri depinde de tip (ex. „Revista” la articol, „Enciclopedia” la o intrare de enciclopedie)
    const LBL = {
      container: { [C]: T("Volumul (cartea)", "Book title"), [A]: T("Revista", "Journal"), [E]: T("Enciclopedia", "Encyclopedia"), [P]: T("Volumul conferinței", "Proceedings"), [N]: T("Ziarul / revista", "Newspaper / magazine"), [W]: T("Site-ul", "Website") },
      publisher: { [TH]: T("Universitatea", "University"), [R]: T("Instituția", "Institution") },
      title: { [C]: T("Titlul capitolului", "Chapter title"), [E]: T("Titlul intrării", "Entry title") },
    };
    const PH = {
      container: { [C]: T("titlul cărții în care apare capitolul", "the book the chapter is in"), [A]: T("ex. Revista de Filosofie", "e.g. Revista de Filosofie"), [E]: T("ex. Stanford Encyclopedia of Philosophy", "e.g. Stanford Encyclopedia of Philosophy"), [N]: T("ex. Dilema veche", "e.g. The Guardian"), [W]: T("ex. Aeon", "e.g. Aeon") },
      publisher: { [TH]: T("ex. Universitatea din București", "e.g. University of Bucharest"), [B]: T("ex. Polirom", "e.g. Polirom") },
    };
    const F = [
      ["title", T("Titlu", "Title"), "", ALL],
      ["authors", T("Autori", "Authors"), T("ex. Dumitru Stăniloae; Ioan Ică", "e.g. Dumitru Stăniloae; Ioan Ică"), ALL],
      ["container", "", "", [C, A, E, P, N, W]],
      ["editors", T("Coordonatori", "Editors"), T("ex. Ioan Ică jr.", "e.g. Ioan Ică jr."), [B, C, E, P]],
      ["genre", T("Tipul tezei", "Thesis type"), T("ex. Teză de doctorat", "e.g. PhD thesis"), [TH]],
      ["year", T("An", "Year"), "2019", ALL],
      ["volume", T("Volum", "Volume"), "12", [A]],
      ["issue", T("Număr", "Issue"), "3", [A]],
      ["number", T("Numărul raportului", "Report number"), "", [R]],
      ["pages", T("Pagini", "Pages"), "45–67", [C, A, P, N]],
      ["publisher", T("Editură", "Publisher"), "", [B, C, E, TH, P, R]],
      ["place", T("Loc", "Place"), T("ex. București", "e.g. Bucharest"), [B, C, TH, P, R]],
      ["isbn", "ISBN", "978…", [B, C, P]],
      ["doi", "DOI", "10.…", [C, A, P, R]],
      ["url", "Link", "https://…", [E, W, N]],
      ["accessed", T("Accesat la", "Accessed"), T("ex. 2026-10-31", "e.g. 2026-10-31"), [E, W]],
      ["translators", T("Traducere", "Translators"), T("ex. Maria Ivănescu", "e.g. Maria Ivănescu"), [B, C, E], 1],
      ["edition", T("Ediția", "Edition"), T("ex. a 2-a, revăzută / Spring 2024", "e.g. 2nd, revised / Spring 2024"), [B, C, E], 1],
      ["series", T("Colecția", "Series"), T("ex. Biblioteca Filosofică", "e.g. Very Short Introductions"), [B, C, R], 1],
      ["origTitle", T("Titlul original", "Original title"), T("pentru traduceri", "for translations"), [B, C], 1],
      ["origYear", T("Anul ediției originale", "Original year"), T("pentru traduceri", "for translations"), [B, C], 1],
      ["numPages", T("Număr de pagini", "Number of pages"), "312", [B, TH], 1],
      ["issn", "ISSN", "1234-5678", [A], 1],
      ["language", T("Limba", "Language"), "ro", ALL, 1],
      ["url2", "Link", "https://…", [B, C, A, TH, P, R], 1],
    ];
    const tr = grid.createDiv("ts-row"); tr.createEl("label", { text: T("Tip", "Type") });
    const sel = tr.createEl("select", { cls: "dropdown" });
    for (const [val, a, b] of [[B, "Carte", "Book"], [C, "Capitol dintr-o carte", "Book chapter"], [A, "Articol de revistă", "Journal article"], [E, "Intrare de enciclopedie sau dicționar", "Encyclopedia or dictionary entry"],
      [TH, "Teză (doctorat, master, licență)", "Thesis (PhD, master's, bachelor's)"], [P, "Lucrare la o conferință", "Conference paper"], [N, "Articol de ziar sau de revistă culturală", "Newspaper or magazine article"],
      [W, "Pagină web", "Web page"], [R, "Raport", "Report"]]) sel.createEl("option", { value: val, text: T(a, b) });
    sel.addEventListener("change", () => { v.type = sel.value; show(); });
    const rows = {};
    let adv = false;
    const moreRow = grid.createDiv("ts-row ts-more-row");
    for (const [k, label, ph, kinds, isAdv] of F) {
      const r = grid.createDiv("ts-row"); const lab = r.createEl("label", { text: label });
      const i = r.createEl("input", { type: "text" }); i.placeholder = ph || ""; i.addEventListener("input", () => v[k] = i.value);
      inputs[k] = i; rows[k] = { r, kinds, isAdv, lab, label, ph: ph || "" };
      if (isAdv && !moreRow.dataset.placed) { grid.insertBefore(moreRow, r); moreRow.dataset.placed = "1"; }
    }
    const more = moreRow.createEl("a", { text: T("Mai multe detalii (traducere, ediție, colecție…)", "More details (translation, edition, series…)") });
    moreRow.createEl("label"); moreRow.insertBefore(moreRow.lastChild, more);
    more.addEventListener("click", () => { adv = !adv; show(); });
    const show = () => {
      for (const [k, { r, kinds, isAdv, lab, label, ph }] of Object.entries(rows)) {
        r.toggle(!!(kinds.includes(v.type) && (!isAdv || adv)));
        lab.textContent = LBL[k]?.[v.type] || label || T("Publicat în", "Published in"); inputs[k].placeholder = PH[k]?.[v.type] || ph;
      }
      more.textContent = adv ? T("Mai puține detalii", "Fewer details") : [B, C].includes(v.type) ? T("Mai multe detalii (traducere, ediție, colecție…)", "More details (translation, edition, series…)") : T("Mai multe detalii", "More details");
    };
    const set = (k, val) => { if (!inputs[k] || inputs[k].value) return; inputs[k].value = val; v[k] = val; };
    if (qi) set("isbn", qi); else if (qd) { set("doi", qd); v.type = A; sel.value = A; } else set("title", this.q);
    // completat din rezultatul ales în căutare: toate datele găsite, de verificat sau corectat înainte de adăugare
    const pre = this.opts.csl;
    if (pre) {
      const ty = ALL.includes(pre.type) ? pre.type : /^article-(magazine|newspaper)/.test(pre.type) ? N : /^article/.test(pre.type) ? A : /^entry/.test(pre.type) ? E : /weblog|webpage/.test(pre.type) ? W : B;
      v.type = ty; sel.value = ty;
      const ppl = a => (a || []).map(p => p.literal || [p.given, p.family].filter(Boolean).join(" ")).filter(Boolean).join("; ");
      const yr = d => d?.["date-parts"]?.[0]?.[0] ? String(d["date-parts"][0][0]) : "";
      const ymd2 = d => { const p = d?.["date-parts"]?.[0]; return p?.length ? p.map((x, i) => i ? String(x).padStart(2, "0") : x).join("-") : ""; };
      const fill = { title: pre.title, authors: ppl(pre.author), editors: ppl(pre.editor), translators: ppl(pre.translator), container: pre["container-title"], year: yr(pre.issued),
        volume: pre.volume, issue: pre.issue, number: pre.number, pages: pre.page, publisher: pre.publisher, place: pre["publisher-place"], isbn: pre.ISBN, doi: pre.DOI,
        url: pre.URL, url2: pre.URL, accessed: ymd2(pre.accessed), edition: pre.edition, series: pre["collection-title"], origTitle: pre["original-title"], origYear: yr(pre["original-date"]),
        numPages: pre["number-of-pages"], issn: pre.ISSN, language: pre.language, genre: pre.genre };
      for (const [k, val] of Object.entries(fill)) if (inputs[k] && val != null && val !== "") { inputs[k].value = String(val); v[k] = String(val); }
      v.abstract = pre.abstract;
      if (F.some(f => f[4] && f[3].includes(ty) && inputs[f[0]].value)) adv = true;   // are și detalii (traducere, ediție…): le arătăm
    }
    show();
    const people = s => String(s || "").split(/;|\n|\s+și\s+|\s+and\s+/).map(x => x.trim()).filter(Boolean).map(splitName).filter(Boolean);
    const buildCsl = () => {
      const ty = v.type, has = k => F.find(f => f[0] === k)[3].includes(ty), val = k => has(k) ? v[k] : undefined, num = x => (/\d+/.exec(x || "") || [])[0];
      const acc = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(val("accessed") || "");
      const csl = cleanCsl({
        type: ty, title: (v.title || "").trim(), author: people(v.authors), editor: people(val("editors")), translator: people(adv || v.translators ? val("translators") : ""),
        "container-title": val("container"), genre: val("genre"), issued: num(v.year) ? { "date-parts": [[+num(v.year)]] } : undefined,
        "original-date": num(val("origYear")) ? { "date-parts": [[+num(val("origYear"))]] } : undefined, "original-title": val("origTitle"),
        publisher: val("publisher"), "publisher-place": val("place"), edition: val("edition"), "collection-title": val("series"), "number-of-pages": num(val("numPages")),
        volume: val("volume"), issue: val("issue"), number: val("number"), page: (val("pages") || "").replace(/\s*[–—]\s*/g, "-") || undefined,
        ISBN: has("isbn") ? (isbn13(v.isbn) || v.isbn || undefined) : undefined, ISSN: val("issn"), DOI: has("doi") ? cleanDoi(v.doi) || undefined : undefined,
        language: v.language, URL: val("url") || val("url2"),
      });
      if (acc) csl.accessed = { "date-parts": [[+acc[1], +acc[2], +acc[3]]] };
      if (v.abstract) csl.abstract = v.abstract;
      return csl;
    };
    // câmpurile notei din șablon (ale tale: domain, branch…; și cele automate: an, aliases…), ca să le vezi și să le completezi înainte să adaugi
    const noteVals = this.noteFields(grid, buildCsl);
    const submit = async () => {
      if (!(v.title || "").trim()) { new Notice(T("Scrie cel puțin titlul.", "Type at least the title.")); inputs.title.focus(); return; }
      const csl = buildCsl(), custom = noteVals(), num = x => (/\d+/.exec(x || "") || [])[0];
      if (this.opts.onSubmit) { done(); await this.opts.onSubmit(csl, custom); return; }
      done();
      await S.add({ title: csl.title, authors: csl.author || [], year: +num(v.year) || null, isbn: isbn13(v.isbn), doi: csl.DOI || null, type: v.type, sources: [] }, { csl, custom, ...(this.opts.extra || {}) });
    };
    if (!this.opts.noBar) actions(c, this.opts.label || T("Adaugă în vault", "Add to vault"), submit);
    // Enter într-un câmp = adaugă
    grid.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.tagName === "INPUT" && !e.defaultPrevented) { e.preventDefault(); submit(); } });
    return submit;
  }

  // secțiunea „În notă”: un rând pentru fiecare câmp din șablon. Întoarce o funcție care dă valorile schimbate de tine.
  noteFields(grid, buildCsl) {
    const S = this.src, T = (a, b) => S.T(a, b), tpl = S.template(), custom = {}, previews = [];
    const fields = tpl.fields.filter(f => f.enabled && f.name);
    if (!fields.length) return () => ({});
    const head = grid.createDiv("ts-row ts-sec"); head.createEl("label");
    const ht = head.createDiv("ts-sec-t"); ht.createSpan({ text: T("În notă", "In the note") });
    const ed = ht.createEl("a", { text: T("Schimbă câmpurile", "Change fields") });
    ed.addEventListener("click", () => { try { require("../shared/util").openAdvanced("sources-fields"); } catch (e) {} S.openSettings("notes"); });
    const pretty = n => { const t = n.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[-_]+/g, " ").trim().toLowerCase(); return t.charAt(0).toUpperCase() + t.slice(1); };
    const key = () => { const c = buildCsl(); return { c, k: S.citekey(c, new Set()) }; };
    const listNames = fields.filter(f => ["links", "list"].includes(S.fieldKind(f))).map(f => f.name);
    let idx = null; try { idx = S.fieldIndex(listNames); } catch (e) { console.warn("Texere Referințe: valorile câmpurilor", e); }
    const chosen = {};
    for (const f of fields) {
      const kind = S.fieldKind(f), r = grid.createDiv("ts-row"); r.createEl("label", { text: pretty(f.name) }); r.title = f.name;
      if (kind === "links" || kind === "list") {
        // valorile din șablon (ex. o listă fixă) pornesc ca etichete; le poți scoate
        let start = []; try { const { c, k } = key(); const x = S.noteFields(c, k, [], null).find(e => e[0] === f.name)?.[1]; if (Array.isArray(x)) start = x.map(y => String(y).replace(/^\[\[([^\]|]+)(?:\|[^\]]*)?\]\]$/, "$1")); } catch (e) {}
        chosen[f.name] = [...start];
        const all = idx ? S.fieldOptions(idx, f.name, {}) : [];
        const top = all.slice(0, 2).map(o => o.name);
        chipInput(r, { getOptions: () => idx ? S.fieldOptions(idx, f.name, chosen) : [], start,
          placeholder: top.length ? T("ex. ", "e.g. ") + top.join(", ") + (all.length > 2 ? T(` · ${all.length} valori`, ` · ${all.length} values`) : "") : T("scrie și apasă Enter", "type and press Enter"),
          relatedLabel: T("legat", "related"),
          onChange: arr => { chosen[f.name] = arr; custom[f.name] = kind === "links" ? arr.map(x => `[[${x}]]`) : arr; } });
        if (start.length) custom[f.name] = kind === "links" ? start.map(x => `[[${x}]]`) : start;
      } else if (kind === "text") {
        const i = r.createEl("input", { type: "text" }); i.value = f.template || ""; i.addEventListener("input", () => { custom[f.name] = i.value; });
      } else {
        // automat: vezi valoarea calculată; dacă scrii ceva, al tău are prioritate
        const i = r.createEl("input", { type: "text" }); i.addClass("ts-auto");
        const fmt = x => Array.isArray(x) ? x.join(", ") : x == null ? "" : typeof x === "object" ? JSON.stringify(x) : String(x);
        const upd = () => { let x; try { const { c, k } = key(); x = S.noteFields(c, k, [], null).find(e => e[0] === f.name)?.[1]; } catch (e) {}
          i.placeholder = f.name === "attachment" && (!x || (Array.isArray(x) && !x.length)) ? T("se adaugă singur când găsesc PDF-ul", "added automatically when the PDF is found") : fmt(x) || T("(gol)", "(empty)"); };
        upd(); previews.push(upd);
        i.addEventListener("input", () => {
          if (!i.value.trim()) { delete custom[f.name]; return; }
          if (S.T_.isList(f)) { const ex = i.placeholder.includes("[["); custom[f.name] = i.value.split(",").map(x => x.trim()).filter(Boolean).map(x => ex && !x.startsWith("[[") ? `[[${x}]]` : x); }
          else custom[f.name] = i.value;
        });
      }
    }
    let t = null; grid.addEventListener("input", e => { if (e.target.closest(".ts-sec ~ .ts-row")) return; clearTimeout(t); t = setTimeout(() => previews.forEach(p => p()), 250); });
    grid.querySelector("select")?.addEventListener("change", () => previews.forEach(p => p()));
    return () => ({ ...custom });
  }
}

// etichete cu sugestii: scrii, alegi din valorile folosite deja (sau una nouă) cu Enter sau virgulă; Backspace scoate ultima
function chipInput(row, { options = [], getOptions, start = [], placeholder = "", relatedLabel = "related", onChange }) {
  const box = row.createDiv("ts-chips"), vals = [...start];
  const inp = box.createEl("input", { type: "text" }); inp.placeholder = placeholder;
  // lista plutește deasupra ferestrei (nu e tăiată de derulare) și se deschide în sus când jos nu e loc
  const menu = document.createElement("div"); menu.className = "texere-chip-menu"; menu.hide();
  const place = () => {
    if (menu.style.display === "none") return;
    const r = box.getBoundingClientRect(), H = window.innerHeight, below = H - r.bottom - 10, above = r.top - 10;
    const need = Math.min(260, menu.scrollHeight + 2), up = below < need && above > below;
    Object.assign(menu.style, { left: r.left + "px", width: r.width + "px", maxHeight: Math.max(100, Math.min(260, up ? above : below)) + "px",
      top: up ? "auto" : r.bottom + 3 + "px", bottom: up ? H - r.top + 3 + "px" : "auto" });
  };
  const open = () => { if (!menu.isConnected) document.body.appendChild(menu); menu.show(); place(); window.addEventListener("scroll", place, true); window.addEventListener("resize", place); };
  const close = () => { menu.hide(); menu.remove(); window.removeEventListener("scroll", place, true); window.removeEventListener("resize", place); };
  let hi = 0;
  const draw = () => {
    box.querySelectorAll(".ts-chip").forEach(x => x.remove());
    for (const val of vals) {
      const ch = document.createElement("span"); ch.className = "ts-chip"; ch.textContent = val;
      const x = document.createElement("span"); x.className = "ts-chip-x"; x.textContent = "×"; x.addEventListener("mousedown", e => { e.preventDefault(); vals.splice(vals.indexOf(val), 1); draw(); onChange([...vals]); });
      ch.appendChild(x); box.insertBefore(ch, inp);
    }
    inp.placeholder = vals.length ? "" : placeholder;
  };
  // fiecare opțiune: { name, aliases, related }; cauți și după alias (ex. „Metafizică” → Metaphysics), fără diacritice
  const list = () => (getOptions ? getOptions() : options.map(name => ({ name, aliases: [] })));
  const matches = () => {
    const q = fold(inp.value.trim());
    return list().filter(o => !vals.includes(o.name)).map(o => {
      if (!q) return o;
      if (fold(o.name).includes(q)) return { ...o, rank: fold(o.name).startsWith(q) ? 0 : 1 };
      const al = (o.aliases || []).find(a => fold(a).includes(q)); return al ? { ...o, via: al, rank: 2 } : null;
    }).filter(Boolean).sort((a, b) => q ? (a.rank - b.rank) || (b.related - a.related) : 0).slice(0, 80);
  };
  const showMenu = () => {
    const m = matches(); menu.empty(); hi = Math.min(hi, Math.max(m.length - 1, 0));
    if (!m.length || document.activeElement !== inp) { close(); return; }
    m.forEach((o, i) => {
      const it = menu.createDiv({ cls: "ts-chip-opt" + (i === hi ? " on" : "") }); it.createSpan({ text: o.name });
      const note = o.via || (o.related ? relatedLabel : ""); if (note) it.createSpan({ cls: "ts-chip-note", text: note });
      it.addEventListener("mousedown", e => { e.preventDefault(); add(o.name); });
    });
    open();
    const cur = menu.children[hi]; if (cur) { const t = cur.offsetTop, b = t + cur.offsetHeight; if (t < menu.scrollTop) menu.scrollTop = t; else if (b > menu.scrollTop + menu.clientHeight) menu.scrollTop = b - menu.clientHeight; }
  };
  const add = val => { val = String(val || "").trim().replace(/^\[\[|\]\]$/g, ""); if (val && !vals.includes(val)) { vals.push(val); draw(); onChange([...vals]); } inp.value = ""; hi = 0; showMenu(); };
  inp.addEventListener("input", () => { if (inp.value.includes(",")) { inp.value.split(",").slice(0, -1).forEach(add); inp.value = inp.value.split(",").pop(); } hi = 0; showMenu(); });
  inp.addEventListener("focus", showMenu);
  inp.addEventListener("blur", () => { if (inp.value.trim()) add(inp.value); close(); });
  inp.addEventListener("keydown", e => {
    const m = matches();
    if (e.key === "ArrowDown" && m.length) { e.preventDefault(); e.stopPropagation(); hi = (hi + 1) % m.length; showMenu(); }
    else if (e.key === "ArrowUp" && m.length) { e.preventDefault(); e.stopPropagation(); hi = (hi - 1 + m.length) % m.length; showMenu(); }
    else if (e.key === "Enter" && (inp.value.trim() || (menu.style.display !== "none" && m.length))) { e.preventDefault(); e.stopPropagation(); add(menu.style.display !== "none" && m[hi] ? m[hi].name : inp.value); }
    else if (e.key === "Backspace" && !inp.value && vals.length) { vals.pop(); draw(); onChange([...vals]); }
  });
  box.addEventListener("mousedown", e => { if (e.target === box) { e.preventDefault(); inp.focus(); } });
  draw();
  return { get: () => [...vals] };
}

class SourcesSettingTab extends PluginSettingTab {
  constructor(src) { super(src.app, src.host); this.src = src; this.tab = "search"; }
  hide() { const h = this.src.host; h._citeHooks = (h._citeHooks || []).filter(f => f !== this._hook); }
  display() {
    const S = this.src, T = (a, b) => S.T(a, b), c = this.containerEl, conf = S.conf(), host = S.host;
    // pagina se redesenează (ex. după o alegere): rămâi exact unde erai; doar schimbarea filei te duce sus
    const keep = this._top ? 0 : c.scrollTop; this._top = false;
    c.empty(); c.addClass("texere-settings");
    // pagina se redesenează singură când se instalează sau se șterge un stil
    if (!this._hook) this._hook = () => { if (this.tab === "notes" && c.isConnected) this.display(); };
    host._citeHooks = [...(host._citeHooks || []).filter(f => f !== this._hook), this._hook];
    // antetul, ca în fereastra „Adaugă o sursă”: titlul și filele subliniate, pe același rând
    const head = c.createDiv("ts-head");
    head.createSpan({ cls: "ts-head-t", text: T("Referințe", "References") }).title = T("Cauți referințe în mai multe cataloage, le adaugi în vault cu PDF-ul gratuit și le citezi în stilul ales.", "Search several catalogs for references, add them to your vault with the free PDF, and cite them in the style you choose.");
    const nav = head.createDiv("ts-nav");
    // fiecare filă spune ce reglezi acolo
    const tabs = [["search", T("Cataloage", "Catalogs"), T("Unde caută „Adaugă o referință”", "Where “Add a reference” searches")],
      ["zotero", "Zotero", T("Biblioteca ta din Zotero", "Your Zotero library")],
      ["notes", T("Note și citări", "Notes & citations"), T("Stilul citărilor, nota fiecărei referințe și PDF-urile", "Citation style, each reading note and PDFs")]];
    if (!tabs.some(([id]) => id === this.tab)) this.tab = "search";
    for (const [id, label, tip] of tabs) {
      const b = nav.createSpan({ cls: "ts-navbtn" + (this.tab === id ? " on" : ""), text: label }); b.title = tip;
      b.addEventListener("click", () => { if (this.tab === id) return; this.tab = id; this._top = true; this.display(); });
    }
    const body = c.createDiv("ts-body");
    if (this.tab === "search") this.searchTab(body, S, T, conf);
    else if (this.tab === "zotero") this.zoteroTab(body, S, T, conf);
    else this.notesTab(body, S, T, conf, host);
    // rândurile cu câmpuri de completat (text, listă) au aceeași grilă pe toate filele: eticheta într-o coloană, câmpul începe mereu în același loc
    for (const it of body.querySelectorAll(".setting-item:not(.setting-item-heading)")) {
      const ctl = it.querySelector(".setting-item-control");
      if (ctl && ctl.querySelector('input[type="text"], input[type="password"], input[type="email"], input:not([type]), select, textarea')) it.addClass("ts-grid-row");
    }
    c.scrollTop = keep; requestAnimationFrame(() => { if (c.scrollTop !== keep) c.scrollTop = keep; });
  }

  // câmpul unei chei, cu (i) care arată pașii
  keyField(el, S, T, conf, field, name, desc, steps, placeholder, after, inline) {
    const st = new Setting(el).setName(name).setDesc(desc); st.settingEl.addClass("ts-sub");
    const help = el.createDiv({ cls: "texere-keyhelp" }); help.toggle(!!(inline));
    const ol = help.createEl("ol");
    for (const [txt, url] of steps) { const li = ol.createEl("li"); li.appendText(txt + (url ? " " : "")); if (url) { const a = li.createEl("a", { text: url.replace(/^https?:\/\//, ""), href: url }); a.addEventListener("click", e => { e.preventDefault(); window.open(url); }); } }
    if (!inline) st.addExtraButton(b => b.setIcon("info").setTooltip(T("Cum obțin cheia", "How to get the key")).onClick(() => { help.toggle(!!(help.style.display === "none")); }));
    st.addText(t => { t.setPlaceholder(placeholder || T("lipește cheia aici", "paste the key here")).setValue(conf[field]).onChange(async v => { conf[field] = v.trim(); await S.save(); after && after(); }); if (field !== "email") t.inputEl.type = "password"; });
    st.settingEl.after(help);
    return st;
  }

  // cheile cataloagelor (și a lui Zotero): câmpul, numele, ce aduce, pașii prin care o obții
  keyInfo(T) {
    return {
      zotero: ["zoteroKey", T("Cheie Zotero (recomandată)", "Zotero key (recommended)"), T("Texere îți folosește biblioteca și când Zotero e închis.", "Texere uses your library even when Zotero is closed."), [
        [T("Intră în contul tău pe zotero.org și deschide pagina pentru o cheie nouă:", "Sign in to zotero.org and open the page for a new key:"), "https://www.zotero.org/settings/keys/new"],
        [T("Bifează „Allow library access” (doar citire e destul) și salvează.", "Tick “Allow library access” (read-only is enough) and save.")],
        [T("Copiază cheia și lipește-o în câmpul alăturat.", "Copy the key and paste it into the field next to this.")]]],
      openalex: ["openalexKey", T("Cheie OpenAlex (recomandată)", "OpenAlex key (recommended)"), T("Cam 1.000 de căutări pe zi, nu câteva zeci.", "About 1,000 searches a day instead of a few dozen."), [
        [T("Fă-ți un cont gratuit pe", "Create a free account at"), "https://openalex.org"],
        [T("Deschide pagina cheii:", "Open the key page:"), "https://openalex.org/settings/api"],
        [T("Copiază cheia și lipește-o în câmpul alăturat.", "Copy the key and paste it into the field next to this.")]]],
      semanticscholar: ["s2Key", T("Cheie Semantic Scholar", "Semantic Scholar key"), T("Necesară: fără ea, refuză aproape orice căutare.", "Required: without it, almost every search is refused."), [
        [T("Completează formularul de cerere (nume, e-mail, la ce o folosești, ex. „cercetare doctorală, bibliografie în Obsidian”):", "Fill in the request form (name, e-mail, what it's for, e.g. “PhD research, references in Obsidian”):"), "https://www.semanticscholar.org/product/api#api-key-form"],
        [T("Cheia vine pe e-mail; aprobarea poate dura câteva zile.", "The key arrives by e-mail; approval can take a few days.")],
        [T("Lipește cheia în câmpul alăturat, apoi pornește Semantic Scholar.", "Paste the key into the field next to this, then turn Semantic Scholar on.")]]],
      googlescholar: ["serpapiKey", T("Cheie SerpApi", "SerpApi key"), T("Necesară: un serviciu separat care caută în Google Scholar (250 de căutări gratuite pe lună).", "Required: a separate service that searches Google Scholar (250 free searches a month)."), [
        [T("Fă-ți un cont gratuit (confirmi e-mailul și telefonul):", "Create a free account (confirm your e-mail and phone):"), "https://serpapi.com/users/sign_up"],
        [T("Cheia e în panoul tău, la „Your Private API Key”:", "The key is on your dashboard, under “Your Private API Key”:"), "https://serpapi.com/dashboard"],
        [T("Lipește-o în câmpul alăturat. Poți lipi apoi în căutare și linkul profilului Google Scholar al unui autor (un profil întreg consumă 1–3 căutări).", "Paste it into the field next to this. You can then paste an author's Google Scholar profile link into the search (a full profile uses 1–3 searches).")]]],
    };
  }

  // cataloagele: câte un rând scurt (numele și comutatorul); ce face fiecare, în balonul numelui; cheia, doar unde e nevoie
  searchTab(el, S, T, conf) {
    const KEYS = this.keyInfo(T);
    S._usageHooks = [];   // limitele se refac când vin cifrele exacte
    S.refreshUsage().catch(() => {});
    { const iv = window.setInterval(() => { if (!el.isConnected) return window.clearInterval(iv); for (const f of S._usageHooks || []) { try { f(); } catch (e) {} } }, 60000); }   // „se reface în …” numără minutele
    this._keys = this._keys || new Set();   // cheile deschise rămân deschise după redesenare
    for (const p of S.providers) {
      if (p.id === "zotero") continue;   // Zotero are fila lui
      const k = KEYS[p.id], needs = p.requires && !conf[p.requires], has = k && conf[k[0]];
      const st = new Setting(el).setName(p.name); st.settingEl.addClass("ts-cat");
      const about = S.en ? (p.desc?.en || "") : (p.desc?.ro || p.desc?.en || ""); if (about) st.nameEl.title = about;
      if (["openalex", "googlescholar", "semanticscholar", "googlebooks"].includes(p.id)) {   // câte căutări mai ai (și când se refac), doar când se știe
        const upd = () => { if (!st.settingEl.isConnected && st._seen) return; st._seen = true; const ui = S.usageInfo(p.id); st.setDesc(ui ? ui.text : ""); st.descEl.title = ui?.title || ""; st.descEl.toggleClass("ts-warn", !!(ui && /warn|bad|err/.test(ui.cls || ""))); };
        upd(); (S._usageHooks = S._usageHooks || []).push(upd);
      }
      let box = null;
      if (k) {   // cheia: un buton „Adaugă cheia” când e obligatorie și lipsește; altfel, iconița cheii
        const toggleBox = () => { const open = box.style.display === "none"; box.toggle(!!open); this._keys[open ? "add" : "delete"](p.id); if (open) box.querySelector("input")?.focus(); };
        if (needs) st.addButton(b => b.setButtonText(T("Adaugă cheia", "Add key")).onClick(toggleBox));
        else st.addExtraButton(b => b.setIcon("key-round").setTooltip(has ? T("Cheia ta", "Your key") : T("Adaugă o cheie gratuită", "Add a free key")).onClick(toggleBox));
      }
      st.addToggle(t => { t.setValue(!conf.disabled.includes(p.id) && !needs).onChange(async v => { conf.disabled = conf.disabled.filter(x => x !== p.id); if (!v) conf.disabled.push(p.id); await S.save(); }); if (needs) t.setDisabled(true); });
      if (!k) continue;
      box = el.createDiv("ts-keybox"); box.toggle(!!(this._keys.has(p.id)));
      this.keyField(box, S, T, conf, k[0], k[1], k[2], k[3], null, () => { if (p.requires) { clearTimeout(this._rt); this._rt = setTimeout(() => this.display(), 800); } }, true);
    }
  }

  // Zotero: starea (ce merge, pe înțeles), importul și butonul din browser; se reface singură la câteva secunde. Cheia și culorile: în Avansat.
  zoteroTab(el, S, T, conf) {
    const Z = S.zotero; if (!Z) { el.createEl("p", { cls: "ts-intro", text: T("Zotero se încarcă; redeschide pagina peste o clipă.", "Zotero is loading; reopen this page in a moment.") }); return; }
    const box = el.createDiv("ts-zsec"); let sig = null;
    const render = () => {
      if (!box.isConnected && sig !== null) return;
      const d = Z.describe(Z.st), s2 = JSON.stringify(d); if (s2 === sig) return; sig = s2; box.empty();
      const stat = new Setting(box).setName(d.head).setDesc(d.detail); stat.settingEl.addClass("ts-zstat"); stat.settingEl.addClass("is-" + (d.dot || "warn"));
      const dot = document.createElement("span"); dot.className = "ts-zdot " + (d.dot || "warn"); stat.nameEl.prepend(dot);
      stat.addExtraButton(b => b.setIcon("refresh-cw").setTooltip(T("Verifică din nou", "Check again")).onClick(async () => { sig = null; await Z.refresh(); render(); }));
      stat.addButton(b => { b.setButtonText(T("Importă…", "Import…")).setCta().onClick(() => Z.openImport()); if (!d.import.ok) { b.setDisabled(true); if (b.buttonEl) b.buttonEl.title = d.import.text || ""; } });
      new Setting(box).setName(T("Butonul Zotero din browser", "Zotero browser button")).setDesc(T("Salvezi din browser direct în Texere.", "Save from your browser straight into Texere."))
        .addToggle(t => t.setValue(!!conf.zoteroConnector).onChange(async v => { t.setDisabled(true); try { await Z.setWanted(v); } finally { sig = null; render(); } }));
    };
    render();
    const off = Z.onChange(() => { if (!box.isConnected) return off(); render(); });
    Z.refresh().then(render).catch(() => {});
    // cât timp pagina e deschisă: starea se verifică și când butonul e oprit (când e pornit, o verifică Texere oricum)
    const iv = window.setInterval(() => { if (!box.isConnected) { window.clearInterval(iv); off(); return; } if (!Z.wantConnector()) Z.refresh().catch(() => {}); }, 4000);
    // Avansat: cheia (biblioteca ta și cu Zotero închis) și culorile evidențierilor → etichete
    const adv = advanced(el, T("Avansat", "Advanced"), "sources-zotero"), k = this.keyInfo(T).zotero;
    this.keyField(adv, S, T, conf, k[0], k[1], k[2], k[3], null, () => { Z.refresh().catch(() => {}); });
    const pal = Object.keys(this.plugin?.app?.plugins?.plugins?.["pdf-plus"]?.settings?.colors || Z.palette()), map = Z.colorMap();
    const cs = new Setting(adv).setName(T("Culorile din Zotero → etichete", "Zotero colors → tags")).setDesc(pal.length ? T("Eticheta pe care o primește fiecare culoare în notă.", "The tag each color gets in the note.") : T("Setează întâi paleta de culori în PDF++.", "Set up the color palette in PDF++ first."));
    cs.settingEl.addClass("ts-zcol-row");
    if (pal.length) {
      const g = (cs.controlEl || cs.settingEl).createDiv("ts-zcolors");
      for (const [hex, ro, en] of (Z.zcolors?.() || [])) {
        const w = g.createDiv("ts-zc"); const sw = w.createSpan({ cls: "ts-zsw" }); sw.setCssStyles({ background: hex }); sw.title = T(ro, en);
        const sel = w.createEl("select", { cls: "dropdown" }); sel.createEl("option", { value: "", text: T("fără etichetă", "no tag") });
        for (const n of pal) sel.createEl("option", { value: n.toLowerCase(), text: "#" + n.toLowerCase() });
        sel.value = map[hex] || ""; sel.title = T(ro, en);
        sel.addEventListener("change", async () => { (conf.zoteroColors = conf.zoteroColors || {})[hex] = sel.value; await S.save(); });
      }
    }
  }

  // Note și citări: sus ce folosești des (stilul, PDF-ul gratuit, eticheta, numele); în Avansat, restul
  notesTab(el, S, T, conf, host) {
    const E = host.cite, tpl = S.template(), save = async (redraw) => { await S.save(); if (redraw) this.display(); };
    if (E?.ready) new Setting(el).setName(T("Stilul citărilor", "Citation style")).setDesc(T("Pentru notele care nu-și aleg altul.", "For notes that don't choose another."))
      .addDropdown(d => { for (const st of E.list()) d.addOption(st.id, st.label); d.setValue(E.defaultId() || "apa").onChange(async v => { await host.setDefaultStyle(v); this.display(); }); })
      .addButton(b => b.setButtonText(T("Adaugă un stil de citare…", "Add a citation style…")).onClick(() => host.citeAdd(true)));
    else el.createEl("p", { cls: "ts-intro", text: T("Citările se încarcă; redeschide pagina peste o clipă.", "Citations are loading; reopen this page in a moment.") });
    new Setting(el).setName(T("Citările colorate", "Colored citations")).setDesc(T("În notă, citările apar în culoarea principală a temei. Fără bifă: ca textul din jur. Pentru export, alegi separat.", "In your notes, citations show in the theme's main color. Unticked: like the text around them. For export you choose separately."))
      .addToggle(t => t.setValue(conf.citeColor !== false).onChange(async v => { conf.citeColor = v; document.body.toggleClass("tx-cite-plain", !v); await S.save(); }));
    new Setting(el).setName(T("Descarcă PDF-ul gratuit", "Download the free PDF")).setDesc(T("Când adaugi o referință, dacă există o copie gratuită.", "When you add a reference, if there's a free copy."))
      .addToggle(t => t.setValue(conf.pdf).onChange(async v => { conf.pdf = v; await S.save(); }));
    new Setting(el).setName(T("Eticheta notei", "Note tag")).setDesc(T("Se pune pe fiecare notă de lectură.", "Added to every reading note."))
      .addText(t => t.setValue((S.T_.tags(tpl.tag) || []).join(", ")).setPlaceholder("literature_note").onChange(async v => { tpl.tag = v; await save(); }));
    this.namesRows(el, S, T, tpl, save);
    // câmpurile notei de lectură (ce apare și în „Adaugă o referință”): un bloc al lor, la vedere, nu în Avansat
    this.templateRows(advanced(el, T(`Câmpurile notei · ${tpl.fields.length}`, `Note fields · ${tpl.fields.length}`), "sources-fields"), S, T, tpl, save);
    const adv = advanced(el, T("Avansat", "Advanced"), "sources-notes");
    if (E?.ready) this.citationsTab(adv, S, T, host);
    this.templateRest(adv, S, T, tpl, save);
    this.foldersSection(adv, S, T);
    new Setting(adv).setName(T("PDF-uri gratuite", "Free PDFs")).setHeading();
    this.keyField(adv, S, T, conf, "email", T("E-mail pentru Unpaywall (opțional)", "E-mail for Unpaywall (optional)"), T("Găsește mai multe PDF-uri gratuite.", "Finds more free PDFs."), [
      [T("Nu trebuie cont: Unpaywall cere doar o adresă de e-mail la fiecare căutare, ca să te poată contacta dacă ceva nu merge.", "No account needed: Unpaywall only asks for an e-mail address with each request, so it can contact you if something goes wrong.")],
      [T("Scrie adresa ta în câmpul alăturat. Se trimite doar către Unpaywall și Crossref.", "Type your address into the field next to this. It's sent only to Unpaywall and Crossref.")]], "name@example.com");
    this.existingRows(adv, S, T);
  }

  // stilurile instalate (în Avansat): fă-l implicit, șterge-l, importă un .csl
  citationsTab(el, S, T, host) {
    const E = host.cite; if (!E?.ready) return;
    const hd = new Setting(el).setName(T("Stilurile de citare", "Citation styles")).setHeading();
    hd.addExtraButton(b => b.setIcon("help-circle").setTooltip(T("Cum îmi fac propriul stil", "How to make your own style")).onClick(() => host.citeGuide(null)));
    hd.addButton(b => b.setButtonText(T("Importă un stil (.csl)…", "Import a style (.csl)…")).onClick(() => host.citeImport(null)));
    hd.addButton(b => b.setButtonText(T("Adaugă un stil de citare…", "Add a citation style…")).setCta().onClick(() => host.citeAdd(true)));
    const def = E.defaultId();
    for (const st of E.list()) {
      const row = new Setting(el).setName(st.label + (st.id === def ? T(" · implicit", " · default") : "")).setDesc(st.title + (st.note ? T(" · note de subsol", " · footnotes") : ""));
      if (st.id !== def) {
        row.addButton(b => b.setButtonText(T("Fă-l implicit", "Make default")).onClick(async () => { await host.setDefaultStyle(st.id); this.display(); }));
        row.addExtraButton(b => b.setIcon("trash-2").setTooltip(T("Șterge stilul", "Remove the style")).onClick(() => host.removeStyle(st.id)));
      }
    }
  }

  // șablonul notei de literatură (în Avansat): câmpurile tale, titlul notei, cheia de citare
  templateRows(el, S, T, tpl, save) {
    new Setting(el).setName(T("Câmpurile notei", "Note fields")).setDesc(T("În ordinea din notă, după datele referinței. Le adaugi, le muți sau le ștergi aici; cele ale hărții disciplinei vin cu harta.", "In the note's order, after the reference's data. Add, move or remove them here; the discipline map's fields come with the map.")).setHeading();
    const KIND = { links: T("linkuri", "links"), list: T("listă", "list"), text: "text", auto: T("automat", "automatic") };
    const TIP = { links: T("O completezi tu, cu linkuri [[…]]", "You fill it in, with links [[…]]"), list: T("O completezi tu, ca listă", "You fill it in, as a list"), text: T("O completezi tu, ca text", "You fill it in, as text"), auto: T("Se completează singur, din datele referinței", "Filled in by itself, from the reference's details") };
    tpl.fields.forEach((f, i) => {
      const kind = S.fieldKind(f);
      const row = new Setting(el).setName(f.name).setDesc("");
      row.settingEl.addClass("ts-field-row"); row.settingEl.addClass("ts-grid-row"); if (!f.enabled) row.settingEl.addClass("is-off");
      row.nameEl.title = KIND[kind] + " · " + TIP[kind];
      if (kind === "auto" || kind === "text") row.addText(t => { t.setValue(f.template).setPlaceholder(kind === "text" ? T("valoarea de pornire", "starting value") : "{{…}}").onChange(async v => { f.template = v; await save(); }); t.inputEl.addClass("ts-mono"); });
      else {
        // valorile propuse vin din notele din orice folder cu numele câmpului (ex. „Concepts”, în oricare domeniu) și din ce ai folosit deja;
        // un folder ales aici le restrânge la el
        let tip = ""; try {
          const ix = S.fieldIndex([f.name]).fields[f.name], dirs = [...ix.folders];
          row.setDesc(ix.opts.size === 1 ? T("1 valoare", "1 value") : T(`${ix.opts.size} valori`, `${ix.opts.size} values`));
          tip = f.source ? T(`Valorile vin din ${f.source} și din notele tale.`, `Values come from ${f.source} and your notes.`)
            : dirs.length ? T(`Valorile vin din folderele „${f.name}” (${dirs.join(", ")}) și din notele tale.`, `Values come from the “${f.name}” folders (${dirs.join(", ")}) and your notes.`)
            : T("Valorile vin din notele tale.", "Values come from your notes.");
          row.descEl.title = tip;
        } catch (e) {}
        row.addText(t => { t.setValue(f.source || "").setPlaceholder(T("orice folder", "any folder")).onChange(async v => { f.source = v.trim() || undefined; await save(); }); t.inputEl.addClass("ts-src-in"); S.folderSuggest(t.inputEl);
          t.inputEl.title = T(`Gol: valorile vin din orice folder numit „${f.name}”, din oricare domeniu. Scrie un folder ca să le iei doar de acolo.`, `Empty: values come from any folder named “${f.name}”, in any discipline. Type a folder to take them only from there.`) + (tip ? "\n" + tip : ""); });
        row.addDropdown(d => d.addOption("links", T("Linkuri [[…]]", "Links [[…]]")).addOption("list", T("Listă", "List")).setValue(kind).onChange(async v => { f.kind = v; await save(true); }));
      }
      if (i) row.addExtraButton(b => b.setIcon("arrow-up").setTooltip(T("Mai sus", "Move up")).onClick(async () => { tpl.fields.splice(i - 1, 0, tpl.fields.splice(i, 1)[0]); await save(true); }));
      else row.addExtraButton(b => { b.setIcon("arrow-up"); if (b.extraSettingsEl) { b.extraSettingsEl.addClass("tx-invisible"); b.extraSettingsEl.setAttribute("aria-hidden", "true"); } });   // aliniere
      row.addToggle(t => { t.setValue(f.enabled).onChange(async v => { f.enabled = v; row.settingEl.toggleClass("is-off", !v); await save(); }); t.toggleEl?.setAttribute?.("aria-label", T("În notă", "In the note")); });
      row.addExtraButton(b => b.setIcon("trash-2").setTooltip(T("Șterge câmpul", "Remove the field")).onClick(async () => { tpl.fields.splice(i, 1); await save(true); }));
    });
    // câmp nou: numele și tipul
    const add = new Setting(el).setName(T("Câmp nou", "New field")).setDesc(T("Ex. „concepts”, „seminar”, „curs”.", "E.g. “concepts”, “seminar”, “course”.")); add.settingEl.addClass("ts-grid-row"); add.settingEl.addClass("ts-new-field");
    let nm = "", kd = "links";
    add.addText(t => t.setPlaceholder(T("numele câmpului", "field name")).onChange(v => { nm = v; }));
    add.addDropdown(d => d.addOption("links", T("Listă de linkuri", "List of links")).addOption("list", T("Listă", "List")).addOption("text", "Text").addOption("auto", T("Automat (șablon)", "Automatic (template)")).setValue(kd).onChange(v => { kd = v; }));
    add.addButton(b => b.setButtonText(T("+ Adaugă", "+ Add")).setCta().onClick(async () => {
      const name = nm.trim().replace(/\s+/g, "-"); if (!name) { new Notice(T("Scrie numele câmpului.", "Type the field's name.")); return; }
      if (tpl.fields.some(f => f.name === name)) { new Notice(T("Există deja un câmp cu acest nume.", "There's already a field with this name.")); return; }
      tpl.fields.push(kd === "auto" ? { name, template: "{{title}}", enabled: true } : { name, template: kd === "text" ? "" : "[]", enabled: true, kind: kd === "text" ? undefined : kd });
      await save(true);
    }));
    // câmpurile hărții disciplinei (ex. Filosofia): vin cu harta; dacă ai șters unele, le pui la loc dintr-un clic
    for (const [id, names] of Object.entries(S.T_.MAP_FIELDS)) {
      const miss = names.filter(n => !tpl.fields.some(f => f.name === n)); if (!miss.length || !S.mapOn(id)) continue;
      const m = (S.host.core?.maps?.() || []).find(x => x.id === id), mn = m ? T(m.ro, m.en) : id;
      new Setting(el).setName(T(`Câmpurile hărții ${mn}`, `The ${mn} map's fields`)).setDesc(T(`Lipsesc: ${miss.join(", ")}.`, `Missing: ${miss.join(", ")}.`))
        .addButton(b => b.setButtonText(T("Pune-le la loc", "Put them back")).onClick(async () => { for (const n of miss) tpl.fields.push(S.T_.mapField(n)); if (!tpl.maps.includes(id)) tpl.maps.push(id); await save(true); }));
    }
    const vh = el.createEl("details", { cls: "ts-vars" }); vh.createEl("summary", { text: T("Ce poți scrie într-un câmp automat", "What you can write in an automatic field") });
    vh.createEl("p", { text: T("Exemple:", "Examples:") });
    const ul = vh.createEl("ul");
    for (const [code, d] of [["{{title}}", T("titlul", "the title")], ["{{year}} · {{currentDate}}", T("anul referinței · data de azi", "the reference's year · today's date")], ["{{citekey}}", T("cheia de citare", "the citation key")],
      ["{{container-title}} · {{publisher}} · {{DOI}}", T("revista · editura · DOI", "journal · publisher · DOI")], ['[{{#authors}}"[[{{.}}]]",{{/authors}}]', T("o listă de linkuri, câte unul pentru fiecare autor", "a list of links, one per author")],
      ["{{title|lowercase}} · {{title|titleword}}", T("cu filtre: lowercase, sentence, titleword, truncate:20…", "with filters: lowercase, sentence, titleword, truncate:20…")]]) { const li = ul.createEl("li"); li.createEl("code", { text: code }); li.appendText(" — " + d); }
  }
  // restul șablonului (în Avansat): începutul notei, cheia de citare
  templateRest(el, S, T, tpl, save) {
    new Setting(el).setName(T("Începutul notei", "Note heading")).setHeading();
    const ta = el.createEl("textarea", { cls: "ts-header-ta" }); ta.value = tpl.header || ""; ta.rows = 8;
    ta.addEventListener("change", async () => { tpl.header = ta.value; await save(); });
    // cheia de citare: regula după care se face [@cheie] pentru sursele noi (cele existente își păstrează cheia)
    const EX = { title: "Understanding responsibility in Responsible AI. Dianoetic virtues and the hard problem of context", author: [{ family: "Constantinescu", given: "Mihaela" }, { family: "Voinea", given: "Cristina" }, { family: "Vică", given: "Constantin" }], issued: { "date-parts": [[2021]] } };
    const conf = S.conf(), ckSet = new Setting(el).setName(T("Cheia de citare", "Citation key"));
    const ckPrev = () => { try { ckSet.setDesc(T("Pentru referințele noi. Ex.: ", "For new references. E.g.: ") + "@" + S.citekeyBase({ ...EX, type: "article-journal" })); } catch (e) {} };
    ckSet.addText(t => { t.setValue(conf.citekey || "").setPlaceholder("{{author|lowercase}}_{{title|titleword}}_{{year}}").onChange(async v => { conf.citekey = v.trim() || undefined; await save(); ckPrev(); }); t.inputEl.addClass("ts-mono"); });
    ckSet.addExtraButton(b => b.setIcon("rotate-ccw").setTooltip(T("Înapoi la autor_cuvânt_an", "Back to author_word_year")).onClick(async () => { conf.citekey = "{{author|lowercase}}_{{title|titleword}}_{{year}}"; await save(true); }));
    ckPrev();
  }

  // numele notei și al PDF-ului (sus pe pagină): un exemplu sub fiecare
  namesRows(el, S, T, tpl, save) {
    const EX = { title: "Understanding responsibility in Responsible AI. Dianoetic virtues and the hard problem of context", author: [{ family: "Constantinescu", given: "Mihaela" }, { family: "Voinea", given: "Cristina" }, { family: "Vică", given: "Constantin" }], issued: { "date-parts": [[2021]] } }, EXK = "constantinescu_understanding_2021";
    const fnSet = new Setting(el).setName(T("Numele notei", "Note name"));
    const pdSet = new Setting(el).setName(T("Numele PDF-ului", "PDF name"));
    const prev = () => { try {
      fnSet.setDesc(T("Ex.: ", "E.g.: ") + S.fileBase(EX, EXK) + ".md");
      const pb = S.pdfBase(EX, EXK);
      pdSet.setDesc(pb ? T("Ex.: ", "E.g.: ") + pb + ".pdf" : T("PDF-ul își păstrează numele.", "The PDF keeps its name."));
    } catch (e) {} };
    fnSet.addText(t => { t.setValue(tpl.filename || S.T_.FILENAME).setPlaceholder(S.T_.FILENAME).onChange(async v => { tpl.filename = v.trim() || S.T_.FILENAME; await save(); prev(); }); t.inputEl.addClass("ts-mono"); });
    fnSet.addExtraButton(b => b.setIcon("rotate-ccw").setTooltip(T("Înapoi la „Autor An – Titlu”", "Back to “Author Year – Title”")).onClick(async () => { tpl.filename = S.T_.FILENAME; await save(true); }));
    pdSet.addDropdown(d => d.addOption("note", T("La fel ca nota", "Same as the note")).addOption("keep", T("Păstrează numele PDF-ului", "Keep the PDF's own name")).addOption("custom", T("Alt șablon…", "Another template…"))
      .setValue(tpl.pdfMode || "note").onChange(async v => { tpl.pdfMode = v; if (v === "custom" && !tpl.pdfName) tpl.pdfName = tpl.filename || S.T_.FILENAME; await save(true); }));
    if (tpl.pdfMode === "custom") pdSet.addText(t => { t.setValue(tpl.pdfName || "").setPlaceholder(S.T_.FILENAME).onChange(async v => { tpl.pdfName = v.trim() || S.T_.FILENAME; await save(); prev(); }); t.inputEl.addClass("ts-mono"); });
    prev();
  }

  // sursele existente (în Avansat): redenumirea după regulă, bibliografia și folderul ei
  existingRows(el, S, T) {
    new Setting(el).setName(T("Referințele existente", "Existing references")).setHeading();
    new Setting(el).setName(T("Redenumește după regulă", "Rename to the rule")).setDesc(T("Arată ce note și PDF-uri au alt nume; alegi ce redenumești.", "Shows the notes and PDFs with other names; you pick what to rename."))
      .addButton(b => b.setButtonText(T("Verifică…", "Check…")).onClick(() => S.tidy()));
    new Setting(el).setName(T("Bibliografia", "Bibliography")).setDesc(T(`Se ține la zi singură (${S.lib.all().length} referințe).`, `Keeps itself up to date (${S.lib.all().length} references).`))
      .addButton(b => b.setButtonText(T("Refă din note", "Rebuild from notes")).onClick(async () => { await S.rebuildFromNotes(); this.display(); }));
  }

  // folderele surselor, desenate în Settings → Texere → Foldere: unde sunt notele, PDF-urile și bibliografia.
  // Notele și PDF-urile se schimbă tot aici, în Sources (cu previzualizarea a ce se mută): „Schimbă…” duce acolo.
  folderRows(el, redraw, show) {
    const S = this.src, T = (a, b) => S.T(a, b), f = S.filesConf();
    const s = new Setting(el).setName(T("Referințele", "References")).setDesc(T("Notele de lectură, PDF-urile lor și Inbox-ul pentru PDF-uri noi.", "Reading notes, their PDFs, and the Inbox for new PDFs."));
    s.descEl.createDiv({ cls: "tx-mt6 ts-cur", text: [S.rootOf(f.notes), S.rootOf(f.pdfs), S.rootOf(f.inbox)].map(x => x || "—").join(" · ") });
    s.addButton(b => b.setButtonText(T("Schimbă…", "Change…")).onClick(() => { this.tab = "notes"; this._jumpFolders = true; openAdvanced("sources-notes"); show?.("sources"); }));
    const bdir = S.bibPath().slice(0, S.bibPath().lastIndexOf("/"));
    const core0 = S.app.plugins.plugins.texere;
    const bS = new Setting(el).setName(T("Bibliografia", "Bibliography")).setDesc(T("Tot ce poți cita, și stilurile de citare.", "Everything you can cite, and the citation styles."));
    bS.descEl.createDiv({ cls: "tx-mt6 ts-cur", text: bdir });
    bS.addButton(b => b.setButtonText(T("Schimbă…", "Change…")).setDisabled(!S.app.vault.getAbstractFileByPath(bdir) || !core0?.moveFolder).onClick(() => core0.moveFolder(bdir, redraw)));
    if (!S.app.vault.getAbstractFileByPath(bdir)) { const core = S.app.plugins.plugins.texere; const box = el.createDiv("ts-falert");
      box.createDiv({ cls: "ts-falert-t", text: T(`Folderul bibliografiei nu mai e la locul lui (${bdir}).`, `The bibliography folder isn't in its place anymore (${bdir}).`) });
      box.createDiv({ cls: "ts-falert-d", text: T("Până nu-l pui la loc, citările și bibliografia nu merg.", "Until you put it back, citations and the bibliography don't work.") });
      if (core?.putBack) { const b = box.createDiv("ts-falert-b").createEl("button", { cls: "mod-cta", text: T("Pune-l la loc", "Put it back") }); b.addEventListener("click", async () => { await core.putBack(bdir); redraw(); }); } }
  }

  // folderele: întâi le schimbi aici (ciornă), apoi „Previzualizează” arată exact ce s-ar întâmpla; abia acolo le aplici
  foldersSection(el, S, T) {
    const cur = S.filesConf(), K = ["notes", "pdfs", "inbox"];
    let d = this.filesDraft;
    if (!d) d = this.filesDraft = { ...cur };
    // dacă folderele s-au schimbat în altă parte (din tab-ul nou, o redenumire), ciorna le preia — în afară de ce ai schimbat tu aici
    else if (this.filesBase) for (const k of K) if ((d[k] || "") === (this.filesBase[k] || "") && (cur[k] || "") !== (this.filesBase[k] || "")) d[k] = cur[k];
    this.filesBase = { ...cur };
    const changed = () => ["notes", "pdfs", "inbox"].some(k => (d[k] || "") !== (cur[k] || ""));
    const fh = new Setting(el).setName(T("Foldere", "Folders")).setDesc(T("Unde ajung notele și PDF-urile.", "Where notes and PDFs go.")).setHeading();
    if (this._jumpFolders) { this._jumpFolders = false; requestAnimationFrame(() => fh.settingEl.scrollIntoView({ block: "start" })); }
    const root = () => S.rootOf(d.pdfs) || "01. References/PDFs";
    const PRESETS = [["one", T("Un singur folder pentru toate PDF-urile", "One folder for all PDFs"), () => root()], ["source", T("Un folder pentru fiecare referință", "A folder per reference"), () => root() + "/{{noteName}}"],
      ["author", T("Pe autori", "By author"), () => root() + "/{{authorsShort}}"], ["type", T("Pe tipuri (cărți, articole…)", "By type (books, articles…)"), () => root() + "/{{typeName}}"],
      ["notes", T("Lângă notă", "Next to the note"), () => d.notes]];
    const which = () => (PRESETS.find(([, , f]) => f() === d.pdfs) || ["custom"])[0];
    const lay = new Setting(el).setName(T("Așezarea PDF-urilor", "PDF layout"));
    lay.addDropdown(dd => { for (const [k, l] of PRESETS) dd.addOption(k, l); dd.addOption("custom", T("Altfel (scriu eu calea)", "Custom (I'll type the path)"));
      dd.setValue(which()).onChange(v => { const p = PRESETS.find(([k]) => k === v); if (p) d.pdfs = p[2](); this.filesDraft = d; this.display(); }); });
    if (which() === "custom") lay.addText(t => { t.setValue(d.pdfs || "").setPlaceholder(root() + "/{{authorsShort}}").onChange(v => { d.pdfs = v.trim().replace(/\/+$/, ""); upd(); }); t.inputEl.addClass("ts-mono"); t.inputEl.addClass("tx-min240"); });
    const inputs = {};
    const inVault = "";
    const folders = S.vaultFolders(), moved = S.conf().folderMoved || {};
    // un selector cu folderele din vault; la PDF-uri, folderul de bază (variabilele vin din „Așezarea PDF-urilor”)
    const row = (key, name, desc) => {
      const st = new Setting(el).setName(name).setDesc(desc), cur = key === "pdfs" ? root() : (d[key] || "").replace(/\/+$/, ""), gone = cur && !S.app.vault.getAbstractFileByPath(cur);
      st.addDropdown(dd => {
        if (gone) dd.addOption(cur, T(`${cur} (nu mai e în vault)`, `${cur} (not in the vault anymore)`));
        for (const f of folders) dd.addOption(f, f);
        if (cur && !gone && !folders.includes(cur)) dd.addOption(cur, cur);
        dd.setValue(cur).onChange(v => { if (key === "pdfs") { const suf = String(d.pdfs || "").slice(root().length); d.pdfs = v + suf; } else d[key] = v; upd(); });
        dd.selectEl.addClass("tx-sel-220"); inputs[key] = dd.selectEl;
      });
      if (gone && cur === S.rootOf((S.filesConf() || {})[key])) sourceFolderAlert(el, S, T, cur, S.movedFor(key, cur), async to => { await S.setFolderRoot(key, to); this.filesDraft = null; this.display(); }, key);
      return st;
    };
    row("notes", T("Notele de lectură", "Reading notes"), inVault);
    row("pdfs", T("PDF-urile", "PDFs"), inVault);
    row("inbox", "Inbox", T("PDF-urile fără referință încă.", "PDFs without a reference yet."));
    const bar = new Setting(el).setName(T("Aplică folderele", "Apply the folders"));
    let btn = null;
    bar.addButton(b => { btn = b; b.setButtonText(T("Previzualizează…", "Preview…")).setCta().onClick(() => S.previewFiles({ ...d }, () => { this.filesDraft = null; this.display(); })); });
    bar.addExtraButton(b => b.setIcon("rotate-ccw").setTooltip(T("Renunță la modificări", "Discard changes")).onClick(() => { this.filesDraft = null; this.display(); }));
    const upd = () => {
      const ch = changed(); btn?.setDisabled(!ch);
      bar.setDesc(ch ? T("Previzualizarea arată ce se mută, înainte să aplici.", "The preview shows what moves, before you apply.") : "");
    };
    upd();
  }


}

module.exports = Sources;
module.exports.SearchModal = SearchModal;
module.exports.helpers = { latex, parseBibtex, parseRis, pastedKind, guessRef, toYaml, splitName, isbn13, titleWord, cleanCsl, cleanDoi, normTitle };
