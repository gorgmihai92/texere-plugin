// Texere · Sources · citările: sugestiile „@”, afișarea [@citekey, p. 61] în stilul ales, alegerea stilului, exportul în același stil.
// Mutat din main.js fără schimbări de comportament; bibliografia vine din biblioteca comună (library.js).
const { Notice, EditorSuggest } = require("obsidian");
const { LANG, isEn } = require("../shared/lang");

// litere mici, fără diacritice: „Vică” se găsește și cu „vica”
const fold = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
// distanța de editare, oprită devreme (ne interesează doar 0, 1 sau 2)
function lev(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]; let low = i;
    for (let j = 1; j <= b.length; j++) { cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); if (cur[j] < low) low = cur[j]; }
    if (low > max) return max + 1; prev = cur;
  }
  return prev[b.length];
}
// cât de bine se potrivește un cuvânt scris cu o referință: 0 începutul unui cuvânt, 1 în interior, 2 cu o greșeală, 3 deloc
function matchWord(it, w) {
  if (!it.words) it.words = String(it.hay || "").split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  if (it.words.some(x => x.startsWith(w))) return 0;
  if (it.hay.includes(w)) return 1;
  if (w.length >= 3) {
    const max = w.length >= 7 ? 2 : 1;
    for (const x of it.words) {
      if (x.length < 3) continue;
      if (lev(w, x.slice(0, w.length), max) <= max || lev(w, x.slice(0, w.length + 1), max) <= max || lev(w, x, max) <= max) return 2;
    }
  }
  return 3;
}

// ---------- Citări din mers: scrii „@” (sau „[@”) și alegi sursa din bibliografie ----------
class CiteSuggest extends EditorSuggest {
  constructor(plugin) {
    super(plugin.app); this.plugin = plugin; this.items = null; this.mtime = 0; this.limit = 10;
  }
  bibPath() { return this.plugin?.sources?.bibPath?.() || require("../shared/paths").BIB_DEFAULT; }
  async load() {
    const lib = this.plugin.lib;
    if (this.items && this.ver === lib.version) return this.items;
    try {
      const data = lib.all(); this.ver = lib.version;
      this.items = data.map(e => {
        const au = (e.author || e.editor || []).map(a => a.family || a.literal || "").filter(Boolean);
        const year = e.issued?.["date-parts"]?.[0]?.[0] || "";
        const who = au.length > 2 ? au[0] + " et al." : au.join(" & ");
        const hay = fold([e.id, au.join(" "), year, e.title].join(" "));
        const added = (e.accessed?.["date-parts"]?.[0] || []).map(n => String(n).padStart(2, "0")).join("-");
        return { key: e.id, who, year: String(year), title: e.title || "", first: fold(au[0] || ""), hay, words: hay.split(/[^\p{L}\p{N}]+/u).filter(Boolean), added };
      });
      // cele adăugate de curând întâi (lista fără nimic scris și, la egalitate, oricând)
      this.items = this.items.map((it, i) => [it, i]).sort((a, b) => (b[0].added || "").localeCompare(a[0].added || "") || a[1] - b[1]).map(x => x[0]);
    } catch (err) { this.items = []; }
    return this.items;
  }
  onTrigger(cursor, editor) {
    const line = editor.getLine(cursor.line).slice(0, cursor.ch);
    const m = /(^|[\s\[;(])@([\w:.\-]*)$/.exec(line);
    if (!m) return null;
    // citekey deja complet (ex. imediat după ce l-ai ales): lista nu se mai deschide, poți scrie mai departe
    if (m[2] && (this.items || []).some(it => it.key === m[2])) return null;
    this.load();   // se încarcă în fundal; lista apare la tasta următoare dacă nu e gata
    return { start: { line: cursor.line, ch: cursor.ch - m[2].length - 1 }, end: cursor, query: m[2] };
  }
  // cel mult 10, cele mai potrivite întâi: cheia sau primul autor care încep cu ce ai scris, apoi restul;
  // iartă diacriticele (vica → Vică) și o greșeală de tastare (ascombe → Anscombe).
  // Sub ele, referințele din Zotero care nu sunt încă în vault (cu Zotero deschis sau cu cheia ta Zotero)
  async getSuggestions(ctx) {
    const tok = this.tok = (this.tok || 0) + 1;
    const items = await this.load(), q = fold(ctx.query).split(/[\s_]+/).filter(Boolean), q0 = q[0] || "";
    const score = list => list.map((it, i) => {
      let worst = 0;
      for (const w of q) { const m = matchWord(it, w); if (m > worst) worst = m; if (worst > 2) break; }
      const start = !q0 || (it.key || "").toLowerCase().startsWith(q0) || it.first.startsWith(q0) ? 0 : 1;
      return [worst, start, i, it];
    }).sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
    const found = score(items).filter(x => x[0] <= 2).map(x => x[3]);
    const z = await this.fromZotero(ctx.query);
    if (tok !== this.tok) return new Promise(() => {});   // între timp ai mai scris: contează doar lista nouă
    const zs = score(z).map(x => x[3]), mine = found.slice(0, zs.length ? 6 : this.limit), out = [...mine, ...zs.slice(0, this.limit - mine.length)];
    return out;   // nimic potrivit: lista nu apare, iar Enter rămâne rând nou (un rând „Adaugă o referință” ar fura Enter-ul după orice „@nume”)
  }
  // Zotero, căutat din mers: prin API-ul local (Zotero deschis) sau prin cheia ta (Zotero închis). Better BibTeX nu trebuie: cheia o face Texere.
  // Fiecare căutare se ține minte un minut; un Zotero care răspunde încet nu ține lista pe loc (răspunsul lui intră la tasta următoare).
  async fromZotero(query) {
    const S = this.plugin?.sources, Z = S?.zotero, q = String(query || "").replace(/[_]+/g, " ").trim();
    if (!Z || q.length < 2) return [];
    const cache = this.zc || (this.zc = new Map()), hit = cache.get(q.toLowerCase());
    let res = hit && Date.now() - hit.at < 60000 ? hit.items : null;
    if (!res) {
      const run = Z.search(q).then(items => { cache.set(q.toLowerCase(), { at: Date.now(), items }); if (cache.size > 60) cache.delete(cache.keys().next().value); return items; });
      run.catch(() => {});
      try { res = await Promise.race([run, new Promise(r => setTimeout(() => r(null), Z.state?.local === "on" ? 1500 : 3000))]); } catch (e) { res = null; }
      if (!res) return [];
    }
    if (!this.libIdx || Date.now() - this.libIdx.at > 5000) this.libIdx = { at: Date.now(), lib: S.library() };
    const lib = this.libIdx.lib;
    return res.filter(x => x?.zotero?.csl && x.title && !lib.find(x)).map(x => {
      const au = (x.authors || []).map(a => a.family || a.literal || "").filter(Boolean), year = x.year ? String(x.year) : "";
      const hay = fold([au.join(" "), year, x.title].join(" "));
      return { z: x, key: "", who: au.length > 2 ? au[0] + " et al." : au.join(" & "), year, title: x.title || "", first: fold(au[0] || ""), hay, words: hay.split(/[^\p{L}\p{N}]+/u).filter(Boolean) };
    });
  }
  // un singur rând pe sursă: „Autor An – Titlu” (titlul se taie dacă e lung); cheia, în balon
  renderSuggestion(it, el) {
    el.addClass("tx-cite-sug"); el.title = "@" + it.key + (it.title ? "\n" + it.title : "");
    el.createSpan({ cls: "tx-cite-sug-who", text: `${it.who || it.key || it.title}${it.year ? " " + it.year : ""}` });
    if (it.title) el.createSpan({ cls: "tx-cite-sug-title", text: " – " + it.title });
    if (it.z) { el.addClass("is-zotero"); el.title = (isEn() ? "From Zotero: chosen, it comes into your vault (note, bibliography, PDF)" : "Din Zotero: aleasă, intră în vault (notă, bibliografie, PDF)") + (it.title ? "\n" + it.title : ""); el.createSpan({ cls: "tx-cite-sug-z", text: "Zotero" }); }
  }
  selectSuggestion(it, evt) {
    const ctx = this.context; if (!ctx) return;
    if (it.z) return this.pickZotero(it, ctx);
    this.put(it.key, ctx);
  }
  // o referință din Zotero: citarea se scrie imediat. Dacă în Zotero are PDF, alegi: doar referința (nota de lectură și bibliografia)
  // sau referința și PDF-ul, cu evidențierile și adnotările din Zotero. Fără PDF în Zotero: doar referința, fără întrebare.
  async pickZotero(it, ctx) {
    const S = this.plugin.sources, Z = S.zotero, x = it.z, csl = x.zotero.csl, ed = ctx.editor, en = isEn();
    const T = (a, b) => (en ? b : a);
    let key; try { key = S.keyFor(csl); } catch (e) { key = null; }
    if (!key) { new Notice(T("N-am putut face cheia de citare pentru această referință.", "Couldn't make a citation key for this reference.")); return; }
    // unde apare alegerea: sub citare
    let at = null; try { const off = ed.posToOffset(ctx.start), c = ed.cm?.coordsAtPos?.(off); if (c) at = { x: c.left, y: c.bottom + 4 }; } catch (e) {}
    const ln = ctx.start.line, before = ed.getLine(ln), typed = "@" + (ctx.query || ""), end0 = { ...ctx.end };
    this.put(key, ctx);
    const placed = ed.getLine(ln);
    // renunți (Esc, clic în altă parte): nu se adaugă nimic, iar în text rămâne ce scriseseși („@ethic”)
    const undo = () => {
      try {
        if (ed.getLine(ln) === placed) { ed.replaceRange(before, { line: ln, ch: 0 }, { line: ln, ch: placed.length }); ed.setCursor(end0); }
        else this.rekey(ed, key, null, typed);
      } catch (e) {}
    };
    // ce are în Zotero (PDF? câte adnotări?); un Zotero lent nu ține pe loc: după 2,5 s întrebăm fără numărul adnotărilor
    const zk = x.zotero.key, timeout = ms => new Promise(r => setTimeout(() => r(undefined), ms));
    let att = null; try { att = await Promise.race([Z.attachment({ key: zk }), timeout(2500)]); } catch (e) { att = null; }
    let withPdf = false;
    if (att !== null) {
      let hl; if (att) { try { hl = await Promise.race([Z.annotations(att).then(a => a.length), timeout(1500)]); } catch (e) {} }
      withPdf = await this.askPdf(at, hl, T);
      if (withPdf === null) { undo(); return; }
    }
    const wait = new Notice(withPdf ? T(`Din Zotero: @${key}, cu PDF-ul și adnotările…`, `From Zotero: @${key}, with its PDF and annotations…`) : T(`Din Zotero: @${key}…`, `From Zotero: @${key}…`), 0);
    try {
      const file = await S.add(x, { csl, key, stay: true, silent: true, noFreePdf: true, noZoteroPdf: !withPdf, zoteroHl: true });
      wait.hide(); if (!file) return;
      const real = (this.plugin.lib.all() || []).find(e => e.obsidianPath === file.path)?.id || this.app.metadataCache.getFileCache(file)?.frontmatter?.id;
      if (real && real !== key) { this.rekey(ed, key, String(real)); key = String(real); }   // era deja în vault, sub altă cheie
      const f = this.app.vault.getAbstractFileByPath(file.path) || file, has = !!S.attachedPdfs?.(f)?.length, n = x.zotero.hl?.written || 0;
      new Notice(withPdf && has ? T(`Adăugată din Zotero: @${key}, cu PDF-ul`, `Added from Zotero: @${key}, with its PDF`) + (n ? T(` și ${Z.hlText(n)}.`, ` and ${Z.hlText(n)}.`) : ".")
        : withPdf ? T(`Adăugată din Zotero: @${key}. PDF-ul n-a venit din Zotero.`, `Added from Zotero: @${key}. The PDF didn't come from Zotero.`)
        : T(`Adăugată din Zotero: @${key} (nota de lectură și bibliografia).`, `Added from Zotero: @${key} (reading note and bibliography).`) + (att === null && Z.state?.local === "on" ? T(" În Zotero nu are PDF.", " It has no PDF in Zotero.") : ""), 6000);
    } catch (e) { wait.hide(); console.error("Texere: referința din Zotero", e); new Notice(T("Referința din Zotero n-a intrat: ", "The reference from Zotero didn't come in: ") + (e?.message || e), 8000); }
  }
  // „Doar referința” (Enter) / „Referința și PDF-ul · 12 adnotări”; Esc sau clic în altă parte: null (nimic). hl: undefined = nu știm încă
  askPdf(at, hl, T) {
    return new Promise(res => {
      const { Menu } = require("obsidian"); let done = false; const end = v => { if (!done) { done = true; res(v); } };
      const m = new Menu();
      m.addItem(i => i.setTitle(T("Doar referința", "Reference only")).setIcon("quote").onClick(() => end(false)));
      const pdfT = hl === undefined ? T("Referința și PDF-ul, cu adnotările", "Reference and PDF, with annotations")
        : hl ? T(`Referința și PDF-ul · ${hl === 1 ? "1 adnotare" : hl + " adnotări"}`, `Reference and PDF · ${hl === 1 ? "1 annotation" : hl + " annotations"}`)
        : T("Referința și PDF-ul (fără adnotări)", "Reference and PDF (no annotations)");
      m.addItem(i => i.setTitle(pdfT).setIcon("file-text").onClick(() => end(true)));
      // clicul pe o variantă închide meniul înainte să-și ruleze acțiunea: „renunțarea” vine doar dacă nicio variantă n-a fost aleasă între timp
      m.onHide(() => setTimeout(() => end(null), 400));
      if (at) m.showAtPosition(at); else m.showAtPosition({ x: window.innerWidth / 2, y: window.innerHeight / 3 });
      try { m.select?.(0); } catch (e) {}   // Enter = doar referința
    });
  }
  // @veche → @nouă în notă (doar citările întregi)
  // plain: în locul citării întregi [@cheie] pune textul ăsta (renunțarea la o referință din Zotero)
  rekey(ed, from, to, plain) {
    try {
      const k = from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = plain != null ? new RegExp("\\[@" + k + "\\]", "g") : new RegExp("@" + k + "(?![\\w:.\\-])", "g");
      for (let l = 0; l < ed.lineCount(); l++) {
        const line = ed.getLine(l), hits = [...line.matchAll(re)];
        for (const m of hits.reverse()) ed.replaceRange(plain != null ? plain : "@" + to, { line: l, ch: m.index }, { line: l, ch: m.index + m[0].length });
      }
    } catch (e) {}
  }
  put(key, ctx) {
    const ed = ctx.editor, line = ed.getLine(ctx.start.line);
    const inBracket = ctx.start.ch > 0 && /[\[;]\s*$/.test(line.slice(0, ctx.start.ch));
    const after = line.slice(ctx.end.ch);
    // după alegere, cursorul trece după „]” și urmează un spațiu, ca să scrii mai departe
    const closes = /^\s*\]/.test(after);
    let text = inBracket ? "@" + key + (closes ? "" : "]") : "[@" + key + "]";
    ed.replaceRange(text, ctx.start, ctx.end);
    let ch = ctx.start.ch + text.length;
    if (closes) ch += after.indexOf("]") + 1;
    const rest = ed.getLine(ctx.start.line).slice(ch);
    if (/^[\p{L}\p{N}]/u.test(rest)) { ed.replaceRange(" ", { line: ctx.start.line, ch }); ed.setCursor({ line: ctx.start.line, ch: ch + 1 }); }
    else ed.setCursor({ line: ctx.start.line, ch: rest.startsWith(" ") ? ch + 1 : ch });
  }
}

// ---------- Stilul citărilor: [@citekey, p. 61] se afișează ca în stilul ales (APA, Chicago, MLA…) ----------

// Textul notei rămâne [@citekey, p. 61] (formatul obișnuit al citărilor în Markdown); se schimbă doar afișarea. Cu cursorul pe citare apare textul sursă.
// Stilul: proprietatea „csl” a notei (ex. csl: chicago-author-date), altfel stilul implicit al vault-ului.
// Același „csl” îl folosește Texere · Export. Orice fișier .csl pus în folderul bibliografiei apare în listă.
const CITE_LABELS = {
  "apa": "APA", "chicago-author-date": "Chicago (author-date)", "chicago-notes-bibliography": "Chicago (notes)",
  "modern-language-association": "MLA", "harvard-cite-them-right": "Harvard", "ieee": "IEEE",
};
const CITE_ORDER = Object.keys(CITE_LABELS);
const CITE_KEY = "[\\w](?:[\\w:.#$%&\\-+?<>~/]*[\\w])?";
const LOC_TERMS = {
  p: "page", pp: "page", pg: "page", pag: "page", page: "page", pages: "page",
  ch: "chapter", chap: "chapter", chapter: "chapter", chapters: "chapter", cap: "chapter",
  sec: "section", section: "section", par: "paragraph", para: "paragraph", paragraph: "paragraph",
  vol: "volume", volume: "volume", fig: "figure", figure: "figure", n: "note", nn: "note", note: "note",
  l: "line", ll: "line", line: "line", bk: "book", book: "book", pt: "part", part: "part", col: "column",
  v: "verse", vv: "verse", fol: "folio", op: "opus", no: "issue",
};

// „p. 61”, „pp. 3–5”, „61”, „chap. 2, see also” → { label, locator, suffix }
function parseLocator(s) {
  let r = (s || "").trim().replace(/^,\s*/, ""); if (!r) return {};
  const NUM = "(?:[\\divxlcdm]+[a-z]?)(?:\\s*[-–—,&]\\s*[\\divxlcdm]+[a-z]?)*";
  let m = new RegExp("^([A-Za-z]+)\\.?\\s*(" + NUM + ")(.*)$", "i").exec(r), out = {};
  if (m && LOC_TERMS[m[1].toLowerCase()]) { out.label = LOC_TERMS[m[1].toLowerCase()]; out.locator = m[2]; r = m[3]; }
  else if ((m = /^(\d+[a-z]?(?:\s*[-–—,&]\s*\d+[a-z]?)*)(.*)$/i.exec(r))) { out.label = "page"; out.locator = m[1]; r = m[2]; }
  r = r.trim();
  if (r) out.suffix = /^[,;.]/.test(r) ? r : ", " + r;
  return out;
}
// interiorul unei paranteze [ … ]: „see @a, p. 3; -@b” → elementele citării (null dacă nu e o citare)
function parseCluster(body) {
  const out = [];
  for (const part of body.split(";")) {
    const m = new RegExp("^([^@]*?)(-?)@(" + CITE_KEY + ")(.*)$", "s").exec(part);
    if (!m) return null;
    const it = { id: m[3] };
    if (m[2]) it["suppress-author"] = true;
    if (m[1].trim()) it.prefix = m[1].trim() + " ";
    const loc = parseLocator(m[4]);
    if (loc.locator) { it.locator = loc.locator; it.label = loc.label; }
    if (loc.suffix) it.suffix = loc.suffix;
    out.push(it);
  }
  return out.length ? out : null;
}
// toate citările dintr-un text, în ordine: [@a, p. 1] (kind "c") și @a [p. 1] în frază (kind "n")
function scanCites(text) {
  const out = [], RE = /\[([^\[\]\n]*?@[^\[\]\n]*?)\](?![(\[:])/g; let m;
  while ((m = RE.exec(text))) {
    const from = m.index; if (from > 0 && /[\[!\]]/.test(text[from - 1])) continue;
    const items = parseCluster(m[1]); if (!items) continue;
    const to = from + m[0].length, dot = text.slice(to, to + 5) === " · [[";
    out.push({ kind: "c", from, to, end: dot ? to + 3 : to, items });
  }
  const inC = p => out.some(c => p >= c.from && p < c.to);
  const RN = new RegExp("(^|[\\s(\"“„'])@(" + CITE_KEY + ")(?:\\s\\[([^\\[\\]\\n@]*)\\](?![(\\[:]))?", "g");
  const narr = [];
  while ((m = RN.exec(text))) {
    const from = m.index + m[1].length; if (inC(from)) continue;
    const it = { id: m[2] }, loc = parseLocator(m[3]);
    if (loc.locator) { it.locator = loc.locator; it.label = loc.label; }
    if (loc.suffix) it.suffix = loc.suffix;
    const to = m.index + m[0].length; narr.push({ kind: "n", from, to, end: to, items: [it] });
  }
  return out.concat(narr).sort((a, b) => a.from - b.from);
}
// proprietățile csl și lang din antetul notei (citite direct din text, ca afișarea să se schimbe pe loc)
function citeFm(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text), o = { end: 0 };
  if (!m) return o; o.end = m[0].length;
  for (const k of ["csl", "lang"]) {
    const r = new RegExp("^" + k + ":[ \\t]*[\"']?([^\"'\\n#]*?)[\"']?[ \\t]*$", "m").exec(m[1]);
    if (r && r[1]) o[k] = r[1].trim();
  }
  return o;
}
// panourile Texere din notă (bibliografia, statisticile sursei) au lățimea textului notei, oricare ar fi tema (Minimal, implicită…):
// o măsurăm pe un rând de text al notei și o copiem; se refac când se schimbă lățimea (bara laterală, fereastra, „lățime de citire”)
const TEXT_REF = [":scope > .cm-contentContainer .cm-line:not(.HyperMD-table-row)", ":scope > .inline-title", ":scope > .metadata-container",
  ":scope > div:not(.mod-header):not(.mod-footer):not(.texere-biblio):not(.markdown-preview-pusher) > :is(p, h1, h2, h3, h4, h5, h6, ul, ol, blockquote)",
  ":scope > .mod-header .inline-title", ":scope > .mod-header .metadata-container"];
function textColumn(sizer) {
  for (const q of TEXT_REF) { let els = []; try { els = sizer.querySelectorAll(q); } catch (e) {}
    for (const el of els) { if (!el.offsetParent) continue; const r = el.getBoundingClientRect(); if (r.width > 120) return r; } }
  return null;
}
function fitToText(box) {
  const sizer = box?.isConnected && box.closest(".cm-sizer, .markdown-preview-sizer"); if (!sizer) return;
  const r = textColumn(sizer); if (!r) return;
  box.addClass("tx-fitbox");
  if (box.style.width !== r.width + "px") box.setCssStyles({ width: r.width + "px" });
  const b = box.getBoundingClientRect(); if (!b.width) return;
  const cur = parseFloat(box.style.marginLeft) || 0, ml = Math.round((cur + r.left - b.left) * 10) / 10;
  if (Math.abs(ml - cur) > 0.5) box.setCssStyles({ marginLeft: ml + "px" });
}
function keepFit(box) {
  fitToText(box); requestAnimationFrame(() => fitToText(box));
  const sizer = box?.isConnected && box.closest(".cm-sizer, .markdown-preview-sizer"); if (!sizer || sizer._txFit || typeof ResizeObserver === "undefined") return;
  let w = 0;
  sizer._txFit = new ResizeObserver(en => { const nw = Math.round(en[0]?.contentRect?.width || 0); if (nw === w) return; w = nw; sizer.querySelectorAll(".texere-biblio, .texere-stats").forEach(fitToText); });
  sizer._txFit.observe(sizer);
}
const stripTags = h => String(h || "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#38;/g, "&").replace(/&quot;/g, '"');

class CiteEngine {
  constructor(plugin) {
    this.plugin = plugin; this.app = plugin.app; this.ready = false;
    this.CSL = null; this.items = {}; this.raw = {}; this.styles = new Map(); this.locales = {};
    this.engines = new Map(); this.cache = new Map(); this.scanMemo = { text: null, res: null };
  }
  bibPath() { return this.plugin?.sources?.bibPath?.() || require("../shared/paths").BIB_DEFAULT; }
  styleDir() { const p = this.bibPath(); return p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : ""; }
  async load() {
    // citeproc-js (din npm) și limbile lui vin în pachetul pluginului
    if (!this.CSL) this.CSL = require("citeproc");
    this.locales["en-US"] = require("../../assets/locales/locales-en-US.xml");
    this.locales["ro-RO"] = require("../../assets/locales/locales-ro-RO.xml");
    await this.loadBib(); await this.loadStyles();
    this.ready = true;
  }
  async loadBib() {
    this.items = {}; this.raw = {};
    try {
      const data = this.plugin.lib.all();
      for (const e of data) {
        // notele au și câmpuri proprii (liste de linkuri, etichete); citeproc vrea doar câmpurile CSL, cu numere ca text
        const o = {};
        for (const [k, v] of Object.entries(e)) {
          if (typeof v === "number") o[k] = String(v);
          else if (Array.isArray(v) && !/^(author|editor|translator|container-author|collection-editor|director|interviewer|recipient|reviewed-author|composer|illustrator)$/.test(k)) continue;
          else o[k] = v;
        }
        // nota ține numărul revistei în „number”; citeproc îl caută în „issue”
        // (lăsat și în „number”, APA l-ar mai scrie o dată, ca „Article 1”)
        if (o.number && /^(article-journal|article-magazine|article-newspaper|article)$/.test(o.type) && (!o.issue || String(o.issue) === String(o.number))) { o.issue = o.number; delete o.number; }
        this.items[e.id] = o; this.raw[e.id] = e;
      }
    } catch (e) { console.error("Texere: bibliografia", e); }
    this.engines.clear(); this.cache.clear();
  }
  async loadStyles() {
    this.styles = new Map();
    const dir = this.styleDir(), f = this.app.vault.getAbstractFileByPath(dir || "/");
    const files = (f?.children || []).filter(x => x.extension === "csl");
    for (const x of files) {
      try {
        const xml = await this.app.vault.adapter.read(x.path);
        const title = (/<title>([^<]*)<\/title>/.exec(xml) || [])[1] || x.basename;
        const label = CITE_LABELS[x.basename] || title.replace(/\s*\d+(st|nd|rd|th)\s+edition/i, "").replace(/\s+/g, " ").trim();
        this.styles.set(x.basename, { id: x.basename, xml, title, label, note: /class="note"/.test(xml) });
      } catch (e) {}
    }
    this.engines.clear(); this.cache.clear();
  }
  list() {
    return [...this.styles.values()].sort((a, b) => {
      const i = CITE_ORDER.indexOf(a.id), j = CITE_ORDER.indexOf(b.id);
      return (i < 0 ? 99 : i) - (j < 0 ? 99 : j) || a.label.localeCompare(b.label);
    });
  }
  // „chicago-author-date”, „chicago-author-date.csl” sau o cale → id-ul stilului (null dacă nu există)
  styleId(v) { if (!v) return null; const id = String(v).trim().split(/[\\/]/).pop().replace(/\.csl$/i, ""); return this.styles.has(id) ? id : null; }
  defaultId() { return this.styleId(this.plugin.settings?.citationStyle) || (this.styles.has("apa") ? "apa" : this.list()[0]?.id) || null; }
  current(fm) { return this.styleId(fm?.csl) || this.defaultId(); }
  label(id) { return this.styles.get(id)?.label || id || "—"; }
  // încearcă un stil nou pe o carte de probă: întoarce citarea și intrarea din bibliografie, sau aruncă o eroare dacă stilul e stricat
  sample(xml) {
    const item = { id: "texere-sample", type: "book", title: "Think: A compelling introduction to philosophy", author: [{ family: "Blackburn", given: "Simon" }],
      issued: { "date-parts": [[1999]] }, publisher: "Oxford University Press", "publisher-place": "Oxford" };
    const sys = { retrieveLocale: l => this.locales[l] || this.locales[/^ro/i.test(l) ? "ro-RO" : "en-US"] || this.locales["en-US"], retrieveItem: () => item };
    const e = new this.CSL.Engine(sys, xml, "en-US"); e.updateItems([item.id]);
    const cite = e.makeCitationCluster([{ id: item.id, locator: "34", label: "page" }]);
    const bib = e.makeBibliography();
    const strip = h => String(h || "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#38;/g, "&").replace(/\s+/g, " ").trim();
    return { cite: strip(cite), bib: bib ? strip(bib[1].join(" ")) : "" };
  }
  locale(lang) { return /^ro/i.test(lang || "") ? "ro-RO" : "en-US"; }
  scan(text) { if (this.scanMemo.text !== text) this.scanMemo = { text, res: scanCites(text) }; return this.scanMemo.res; }
  known(c) { return c.items.every(i => this.items[i.id]); }
  engine(style, lang, order) {
    const k = style + "|" + lang; let e = this.engines.get(k);
    if (!e) {
      const sys = {
        retrieveLocale: l => this.locales[l] || this.locales[/^ro/i.test(l) ? "ro-RO" : "en-US"] || this.locales["en-US"],
        retrieveItem: id => this.items[id],
      };
      e = new this.CSL.Engine(sys, this.styles.get(style).xml, lang);
      e.__ord = null; this.engines.set(k, e);
    }
    const ord = order.join("|");
    if (e.__ord !== ord) { e.updateItems(order.length ? order : Object.keys(this.items).slice(0, 1)); e.__ord = ord; }
    return e;
  }
  authors(id) {
    const a = (this.items[id]?.author || this.items[id]?.editor || []).map(x => x.family || x.literal || "").filter(Boolean);
    return a.length > 2 ? a[0] + " et al." : a.join(" & ") || id;
  }
  tip(c) {
    const en = isEn(this.app);
    const lines = c.items.map(i => { const r = this.items[i.id]; const y = r?.issued?.["date-parts"]?.[0]?.[0] || ""; return `${this.authors(i.id)}${y ? " (" + y + ")" : ""}. ${r?.title || ""}`; });
    return lines.join("\n") + "\n" + (en ? "⌘/Ctrl + click: open the reading note" : "⌘/Ctrl + clic: deschide nota de lectură");
  }
  // o citare → { html, title } în stilul dat; n = numărul notei de subsol (pentru stilurile cu note)
  render(style, lang, order, c, n) {
    const key = [style, lang, order.join("|"), c.kind, JSON.stringify(c.items), n].join("§");
    if (this.cache.has(key)) return this.cache.get(key);
    if (this.cache.size > 3000) this.cache.clear();
    let res;
    try {
      const e = this.engine(style, lang, order), note = this.styles.get(style).note, tip = this.tip(c);
      if (c.kind === "c") {
        const html = e.makeCitationCluster(c.items);
        res = note ? { html: `<sup>${n}</sup>`, title: stripTags(html) + "\n\n" + tip, note } : { html, title: tip };
      } else {
        const it = c.items[0];
        let a = e.makeCitationCluster([{ id: it.id, "author-only": true }]);
        if (!stripTags(a).trim() || /NO_PRINTED_FORM/.test(a)) res = { html: e.makeCitationCluster([it]), title: tip };   // stiluri numerotate (IEEE): doar [1, p. 4]
        else if (note) res = { html: `${a}<sup>${n}</sup>`, title: stripTags(e.makeCitationCluster([it])) + "\n\n" + tip, note };
        else { const rest = e.makeCitationCluster([{ ...it, "suppress-author": true }]);   // MLA fără pagină: doar autorul
          res = { html: !stripTags(rest).trim() || /NO_PRINTED_FORM/.test(rest) ? a : a + " " + rest, title: tip }; }
      }
    } catch (err) { console.error("Texere: citarea", err); res = null; }
    this.cache.set(key, res); return res;
  }
  // ordinea surselor în notă (pentru stilurile numerotate, ex. IEEE) și numerele notelor de subsol
  // bibliografia unei note: { html: [intrări], hanging, missing: [citekey-uri necunoscute] }
  bibliography(text) {
    const fm = citeFm(text), style = this.current(fm); if (!style) return null;
    const lang = this.locale(fm.lang), order = [], missing = [];
    // toate sursele citate (și cele dintr-o citare care mai conține un citekey greșit), în ordinea apariției
    for (const c of this.scan(text)) if (c.from >= fm.end) for (const i of c.items) { const l = this.items[i.id] ? order : missing; if (!l.includes(i.id)) l.push(i.id); }
    if (!order.length) return missing.length ? { html: [], hanging: false, missing, style } : null;
    const key = ["bib", style, lang, order.join("|")].join("§");
    let res = this.cache.get(key);
    if (!res) {
      try { const e = this.engine(style, lang, order), [meta, entries] = e.makeBibliography(); res = { html: entries, hanging: !!meta?.hangingindent, style }; }
      catch (err) { console.error("Texere: bibliografia notei", err); res = { html: [], hanging: false, style }; }
      this.cache.set(key, res);
    }
    return { ...res, missing };
  }
  plan(text, style) {
    const fm = citeFm(text), cites = this.scan(text).filter(c => c.from >= fm.end && this.known(c));
    const order = []; for (const c of cites) for (const i of c.items) if (!order.includes(i.id)) order.push(i.id);
    const nums = new Map(); let n = 0; if (this.styles.get(style)?.note) for (const c of cites) nums.set(c.from, ++n);
    return { fm, order, nums };
  }
}

function makeCiteWidget(plugin) {
  const { WidgetType } = require("@codemirror/view");
  return class CiteWidget extends WidgetType {
    constructor(r, ids, trail) { super(); this.r = r; this.ids = ids; this.trail = trail; }
    eq(o) { return o.r.html === this.r.html && o.r.title === this.r.title && o.trail === this.trail; }
    toDOM(view) { return plugin.citeEl(this.r, this.ids, this.trail, view); }
    ignoreEvent(e) { return e.type === "mousedown" && (e.metaKey || e.ctrlKey); }   // clic simplu: cursorul intră în citare
  };
}

const CiteStyleMixin = {
  async citations() {
    const { MarkdownView, setIcon, editorLivePreviewField } = require("obsidian");
    const { ViewPlugin, Decoration } = require("@codemirror/view");
    const { RangeSetBuilder, StateEffect } = require("@codemirror/state");
    let syntaxTree = null; try { syntaxTree = require("@codemirror/language").syntaxTree; } catch (e) {}
    const E = this.cite = new CiteEngine(this);
    const CiteWidget = makeCiteWidget(this);
    const refreshFx = this.citeRefreshFx = StateEffect.define();

    // aspect: citarea arată ca textul din jur; la trecerea cu mouse-ul se vede că e o citare

    const skipNode = (st, pos) => {
      if (!syntaxTree) return false;
      try { for (let n = syntaxTree(st).resolveInner(pos, 1); n; n = n.parent) if (/code|math|frontmatter|internal-link|url/i.test(n.name)) return true; } catch (e) {}
      return false;
    };
    const build = view => {
      const st = view.state;
      if (!E.ready || !st.field(editorLivePreviewField, false)) return Decoration.none;
      const text = st.doc.toString(), style0 = E.current(citeFm(text));
      if (!style0) return Decoration.none;
      const { fm, order, nums } = E.plan(text, style0), lang = E.locale(fm.lang);
      const b = new RangeSetBuilder(), sel = st.selection.ranges;
      for (const c of E.scan(text)) {
        if (c.from < fm.end || skipNode(st, c.from)) continue;
        if (!E.known(c)) {
          if (c.kind === "c") b.add(c.from, c.to, Decoration.mark({ class: "texere-cite-missing",
            attributes: { title: (isEn(this.app) ? "Not in the bibliography: " : "Nu e în bibliografie: ") + c.items.filter(i => !E.items[i.id]).map(i => "@" + i.id).join(", ") } }));
          continue;
        }
        if (sel.some(r => r.from <= c.end && r.to >= c.from)) continue;   // cursorul e pe citare: se vede textul sursă
        const r = E.render(style0, lang, order, c, nums.get(c.from)); if (!r) continue;
        b.add(c.from, c.end, Decoration.replace({ widget: new CiteWidget(r, c.items.map(i => i.id), c.end > c.to) }));
      }
      return b.finish();
    };
    const safe = view => { try { return build(view); } catch (e) { console.error("Texere: afișarea citărilor", e); return Decoration.none; } };
    this.registerEditorExtension(ViewPlugin.fromClass(class {
      constructor(view) { this.decorations = safe(view); }
      update(u) {
        const lp = f => { try { return f.field(editorLivePreviewField, false); } catch (e) { return false; } };
        if (u.docChanged || u.selectionSet || lp(u.state) !== lp(u.startState) || u.transactions.some(t => t.effects.some(e => e.is(refreshFx))))
          this.decorations = safe(u.view);
      }
    }, { decorations: v => v.decorations }));

    // modul Citire (Reading view)
    this.registerMarkdownPostProcessor((el, ctx) => { try { readCites(el, ctx); } catch (e) { console.error("Texere: citările (Citire)", e); } });
    const readCites = (el, ctx) => {
      if (!E.ready) return;
      const info = ctx.getSectionInfo?.(el), full = info?.text || "";
      const style0 = E.styleId(ctx.frontmatter?.csl) || E.current(citeFm(full)); if (!style0) return;
      const { order, nums } = E.plan(full || el.textContent, style0), lang = E.locale(ctx.frontmatter?.lang || citeFm(full).lang);
      // numărul primei note din această secțiune (citările de dinainte de secțiune)
      let n = 0;
      if (E.styles.get(style0).note && info) { const off = full.split("\n").slice(0, info.lineStart).join("\n").length; for (const k of nums.keys()) if (k < off) n++; }
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: t => t.parentElement?.closest("code, pre, a, .frontmatter, .math") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
      const nodes = []; while (walker.nextNode()) if (walker.currentNode.nodeValue.includes("@")) nodes.push(walker.currentNode);
      for (const t of nodes) {
        const s = t.nodeValue, cites = scanCites(s).filter(c => E.known(c)); if (!cites.length) continue;
        const frag = document.createDocumentFragment(); let at = 0;
        for (const c of cites) {
          const nx = t.nextSibling, dot = c.kind === "c" && s.slice(c.to) === " · " && nx?.nodeName === "A";
          const r = E.render(style0, lang, order, c, E.styles.get(style0).note ? ++n : 0); if (!r) continue;
          frag.append(s.slice(at, c.from), this.citeEl(r, c.items.map(i => i.id), dot));
          at = dot ? s.length : c.to;
        }
        frag.append(s.slice(at)); t.replaceWith(frag);
      }
    };

    // bara de jos (locul comun al lui Texere, shared/status.js): stilul notei deschise (ex. APA); clic → stilurile, în meniu
    const { status } = require("../shared/status"), st = status(this.core);
    const noteStyle = () => {
      const v = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (!E.ready || !v?.file || !E.styles.size) return null;
      return E.current(citeFm(v.editor?.getValue?.().slice(0, 4000) || ""));
    };
    st.set("cite", { order: 10, show: () => !!noteStyle(), text: () => { const id = noteStyle(); return id ? E.label(id) : null; }, menu: m => this.citeMenuItems(m) });
    this.register(() => st.remove("cite"));
    this.updateCiteStatus = () => st.refresh();
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.updateCiteStatus()));
    this.registerEvent(this.app.workspace.on("file-open", () => this.updateCiteStatus()));
    this.registerEvent(this.app.metadataCache.on("changed", () => this.updateCiteStatus()));

    // în paleta de comenzi doar stilul notei; adăugarea unui stil (citeAdd) și stilul implicit (citePicker(true)) sunt în meniul din bara de jos și în setări
    const T = (a, b) => isEn(this.app) ? b : a;
    this.addCommand({ id: "citation-style-note", name: T("Stilul citărilor din notă…", "Citation style for this note…"), checkCallback: chk => {
      const v = this.app.workspace.getActiveViewOfType(MarkdownView); if (!v?.file) return false;
      if (!chk) this.citePicker(false); return true; } });

    // bibliografia sau stilurile se schimbă → afișarea se actualizează
    let t = null;
    const watch = f => {
      if (!E.ready || !f?.path) return;
      const isCsl = f.extension === "csl" && f.path.startsWith(E.styleDir());   // bibliografia o urmărește biblioteca comună (lib)
      if (!isCsl) return;
      clearTimeout(t); t = setTimeout(async () => { await E.loadStyles(); this.refreshCites(); }, 300);
    };
    for (const ev of ["modify", "create", "delete", "rename"]) this.registerEvent(this.app.vault.on(ev, watch));

    await this.settingsReady();
    try { await E.load(); } catch (e) { console.error("Texere: citările", e); return; }
    this.lib.onChange(async () => { await E.loadBib(); this.refreshCites(); });   // sursă nouă, ștearsă sau bibliografie refăcută
    this.refreshCites();
  },

  // la finalul fiecărei note cu citări: bibliografia, în stilul notei (ca la export; nota nu se modifică)
  bibliographyPanel() {
    this.register(() => { document.querySelectorAll(".texere-biblio").forEach(e => e.remove()); document.querySelectorAll(".tx-has-biblio").forEach(e => e.removeClass("tx-has-biblio")); document.querySelectorAll(".cm-sizer, .markdown-preview-sizer").forEach(s => { s._txFit?.disconnect(); delete s._txFit; }); });
    const tick = this.bibTick = () => this.app.workspace.iterateAllLeaves(l => { if (l.view?.getViewType?.() === "markdown") { try { this.renderBiblio(l.view); } catch (e) { console.error("Texere: bibliografia notei", e); } } });
    let t = null; const soon = (ms = 80) => { clearTimeout(t); t = setTimeout(tick, ms); };
    for (const ev of ["file-open", "layout-change", "active-leaf-change"]) this.registerEvent(this.app.workspace.on(ev, () => soon()));
    this.registerEvent(this.app.workspace.on("editor-change", () => soon(700)));
    this.registerInterval(window.setInterval(tick, 2000));   // modul Citire își redesenează uneori conținutul
    tick();
  },
  renderBiblio(view) {
    const E = this.cite, root = view.containerEl; if (!E?.ready) return;
    let text = ""; try { text = view.getViewData?.() || view.data || ""; } catch (e) {}
    const b = E.bibliography(text);
    const targets = [root.querySelector(".markdown-source-view .cm-sizer"), root.querySelector(".markdown-reading-view .markdown-preview-sizer")].filter(Boolean);
    // liniște cât scrii: fără nicio sursă găsită nu apare panoul; o cheie pe care încă o scrii (începutul unei chei cunoscute) nu e „negăsită”
    if (b) b.missing = b.missing.filter(k => !Object.keys(E.items || {}).some(id => id !== k && id.startsWith(k)));
    if (!b || !b.html.length) { root.querySelectorAll(".texere-biblio").forEach(e => e.remove()); root.querySelectorAll(".tx-has-biblio").forEach(e => e.removeClass("tx-has-biblio")); return; }
    const en = isEn(this.app);
    // dacă nota are deja un titlu „Bibliografie” (ex. șablonul New essay), panoul nu-l mai repetă
    const hasHead = /^#{1,6}\s*(bibliography|bibliografie|references|referințe|referinte|works cited)\s*$/im.test(text);
    const sig = JSON.stringify([b.style, b.html, b.missing, hasHead, en]);
    for (const tg of targets) {
      let p = tg.querySelector(":scope > .texere-biblio");
      if (p && p.dataset.sig === sig) { fitToText(p); continue; }
      const box = document.createElement("div"); box.className = "texere-biblio" + (b.hanging ? " hang" : ""); box.dataset.sig = sig;
      box.addEventListener("mousedown", e => e.stopPropagation());
      if (!hasHead) { const h = document.createElement("div"); h.className = "tb-h"; h.textContent = en ? "Bibliography" : "Bibliografie"; box.appendChild(h); }
      const { sanitizeHTMLToDom } = require("obsidian");
      for (const html of b.html) { try { box.appendChild(sanitizeHTMLToDom(html)); } catch (e) { const d = document.createElement("div"); d.className = "csl-entry"; d.textContent = stripTags(html); box.appendChild(d); } }
      if (b.missing.length) { const m = document.createElement("div"); m.className = "tb-miss";
        m.title = en ? "Add the reference, or fix the citekey" : "Adaugă referința sau corectează citekey-ul";
        m.textContent = (en ? "Not found: " : "Negăsite: ") + b.missing.map(k => "@" + k).join(", "); box.appendChild(m); }
      const n = document.createElement("div"); n.className = "tb-note";
      n.textContent = E.label(b.style); n.title = en ? "Made from this note's citations; it updates by itself, and the export adds it the same way." : "Făcută din citările notei; se actualizează singură, iar exportul o adaugă la fel."; box.appendChild(n);
      if (p) p.replaceWith(box);
      else if (tg.classList.contains("cm-sizer")) { const cc = tg.querySelector(":scope > .cm-contentContainer"); tg.insertBefore(box, cc ? cc.nextSibling : null); }
      // spațiul de sub ultimul rând (cât să poți derula textul până sus) trece sub bibliografie: ea vine imediat după text
      if (tg.classList.contains("cm-sizer")) tg.addClass("tx-has-biblio");
      else { const ft = tg.querySelector(":scope > .mod-footer"); tg.insertBefore(box, ft || null); }
      keepFit(box);
    }
  },

  citeEl(r, ids, trail, view) {
    const { sanitizeHTMLToDom } = require("obsidian");
    // arată ca un link: un clic deschide un mic meniu (nota sursei, PDF-ul, editarea citării); Cmd/Ctrl+clic deschide direct nota, într-un tab nou
    const s = document.createElement("span"); s.className = "texere-cite";
    const a = s.appendChild(document.createElement("span")); a.className = "texere-cite-link"; a.title = r.title;
    try { a.appendChild(sanitizeHTMLToDom(r.html)); } catch (e) { a.textContent = stripTags(r.html); }
    if (trail) s.appendChild(document.createTextNode(" "));
    const path = () => this.cite.raw[ids[0]]?.obsidianPath;
    a.addEventListener("mousedown", e => { if (e.button === 0 && path()) { e.preventDefault(); e.stopPropagation(); } });
    a.addEventListener("click", e => {
      const p = path(); if (!p) return;
      e.preventDefault(); e.stopPropagation();
      if (e.metaKey || e.ctrlKey) { this.app.workspace.openLinkText(p, this.app.workspace.getActiveFile()?.path || "", true); return; }
      this.citePopover(e, ids, s, view);
    });
    return s;
  },
  // clic pe o citare: cel mult trei acțiuni — nota sursei (sau notele, la o citare cu mai multe surse), PDF-ul, editarea citării
  citePopover(evt, ids, el, view) {
    const { Menu } = require("obsidian"), en = isEn(this.app), T = (a, b) => en ? b : a, ws = this.app.workspace, from = ws.getActiveFile()?.path || "";
    const m = new Menu(), raw = id => this.cite.raw[id] || {};
    const label = id => { const e = raw(id), au = (e.author || e.editor || [])[0], y = e.issued?.["date-parts"]?.[0]?.[0]; return [au?.family || au?.literal || id, y].filter(Boolean).join(" "); };
    const open = ids.filter(id => raw(id).obsidianPath).slice(0, view ? 2 : 3);
    for (const id of open) m.addItem(i => i.setTitle(open.length === 1 ? T("Deschide nota de lectură", "Open the reading note") : T("Deschide ", "Open ") + label(id)).setIcon("file-text").onClick(() => ws.openLinkText(raw(id).obsidianPath, from, false)));
    if (open.length === 1) {   // PDF-ul sursei, dacă are unul
      const att = (Array.isArray(raw(open[0]).attachment) ? raw(open[0]).attachment : [raw(open[0]).attachment]).filter(x => typeof x === "string");
      const pdf = att.map(x => /\[\[([^\]|#]+)/.exec(x)?.[1] || x).map(x => this.app.metadataCache.getFirstLinkpathDest(x.trim(), raw(open[0]).obsidianPath || "")).find(f => f && /^(pdf|epub)$/i.test(f.extension));
      if (pdf) m.addItem(i => i.setTitle(T("Deschide PDF-ul", "Open the PDF")).setIcon("paperclip").onClick(() => ws.getLeaf("tab").openFile(pdf)));
    }
    if (view?.posAtDOM) m.addItem(i => i.setTitle(T("Editează citarea", "Edit the citation")).setIcon("pencil").onClick(() => {
      try { const pos = view.posAtDOM(el); view.dispatch({ selection: { anchor: pos + 1 } }); view.focus(); } catch (e) {}
    }));
    m.showAtMouseEvent(evt);
  },

  refreshCites() {
    for (const f of this._citeHooks || []) { try { f(); } catch (e) {} }   // ex. pagina de setări deschisă se actualizează
    try { this.bibTick?.(); } catch (e) {}
    this.app.workspace.iterateAllLeaves(l => {
      const v = l.view; if (v?.getViewType?.() !== "markdown") return;
      try { v.editor?.cm?.dispatch({ effects: this.citeRefreshFx.of(null) }); } catch (e) {}
      try { if (v.getMode?.() === "preview") v.previewMode?.rerender(true); } catch (e) {}
    });
    this.updateCiteStatus?.();
  },

  // meniul din bara de jos: stilurile, cel curent bifat
  // stilurile, în meniul din bara de jos: al notei (bifat), apoi stilul implicit, adăugarea și ștergerea unui stil
  citeMenuItems(m) {
    const { MarkdownView } = require("obsidian");
    const E = this.cite, en = isEn(this.app); if (!E?.ready) return;
    const v = this.app.workspace.getActiveViewOfType(MarkdownView), def = E.defaultId();
    if (v?.file) {
      const cur = E.current(citeFm(v.editor.getValue().slice(0, 4000)));
      m.addItem(i => { i.setTitle(en ? "Citation style for this note" : "Stilul citărilor din notă"); i.setDisabled?.(true); });
      for (const s of E.list()) m.addItem(i => { i.setTitle(s.label + (s.id === def ? (en ? "  · default" : "  · implicit") : "")); i.setChecked?.(s.id === cur); i.onClick(() => this.setNoteStyle(v.file, s.id)); });
      m.addSeparator();
    }
    m.addItem(i => i.setTitle(en ? "Add a citation style…" : "Adaugă un stil de citare…").setIcon("plus").onClick(() => this.citeAdd()));
  },
  citeMenu(evt) {
    const { Menu } = require("obsidian"), m = new Menu();
    this.citeMenuItems(m);
    m.showAtMouseEvent(evt);
  },

  citePicker(isDefault) {
    const { FuzzySuggestModal, MarkdownView } = require("obsidian");
    const E = this.cite, en = isEn(this.app), plugin = this;
    const v = this.app.workspace.getActiveViewOfType(MarkdownView);
    const M = class extends FuzzySuggestModal {
      getItems() { return E.list(); }
      getItemText(s) { return s.label + "  —  " + s.title; }
      onChooseItem(s) { if (isDefault) plugin.setDefaultStyle(s.id); else if (v?.file) plugin.setNoteStyle(v.file, s.id); }
    };
    const md = new M(this.app);
    md.setPlaceholder(isDefault ? (en ? "Default citation style for all notes" : "Stilul implicit al citărilor, pentru toate notele") : (en ? "Citation style for this note" : "Stilul citărilor din notă"));
    md.open();
  },

  // stilul notei = proprietatea csl (o citește și Texere · Export); stilul implicit nu mai are nevoie de proprietate
  // „Adaugă un stil”: caută printre cele ~10.000 de stiluri CSL (indexul vine în pachetul pluginului) și îl instalează dintr-un clic
  async citeIndex() {
    if (this._citeIdx) return this._citeIdx;
    const rows = require("./styles-index").decode(require("../../assets/styles-index.json"));   // forma listei: styles-index.js
    return (this._citeIdx = rows.map(r => ({ ...r, hay: (r.name + " " + r.title).toLowerCase() })));
  },

  async citeAdd(noNote) {
    const { SuggestModal, MarkdownView } = require("obsidian");
    const E = this.cite, en = isEn(this.app), plugin = this;
    let idx; try { idx = await this.citeIndex(); } catch (e) { new Notice(en ? "I can't find the list of styles (styles-index.json in the Texere plugin)." : "Nu găsesc lista stilurilor (styles-index.json din pluginul Texere)."); return; }
    const file = noNote ? null : this.app.workspace.getActiveViewOfType(MarkdownView)?.file;   // din Settings: doar instalează, nu schimbă nota deschisă
    const FMT = { "author-date": en ? "Author–date · (Smith, 2020)" : "Autor–an · (Smith, 2020)", numeric: en ? "Numbered · [1]" : "Numerotat · [1]",
      note: en ? "Footnotes" : "Note de subsol", author: en ? "Author · (Smith 12)" : "Autor · (Smith 12)", label: en ? "Label · [Smi20]" : "Etichetă · [Smi20]" };
    const POPULAR = ["apa", "chicago-author-date", "chicago-notes-bibliography", "modern-language-association", "harvard-cite-them-right", "ieee",
      "nlm-citation-sequence", "american-medical-association", "american-sociological-association", "american-political-science-association", "turabian-author-date", "nature", "elsevier-harvard", "springer-basic-author-date", "iso690-author-date-en"];
    const M = class extends SuggestModal {
      getSuggestions(q) {
        const w = q.toLowerCase().split(/\s+/).filter(Boolean);
        const st = x => (x.title.toLowerCase().startsWith(w[0]) || x.name.startsWith(w[0]) || x.title.toLowerCase().includes("/" + w[0])) ? 0 : 1;   // titlul începe cu ce ai scris
        if (!w.length) return POPULAR.map(n => idx.find(x => x.name === n)).filter(Boolean);
        // întâi stilurile principale (nu variantele unei reviste), apoi titlurile scurte
        return idx.filter(x => w.every(t => x.hay.includes(t))).sort((a, b) => (st(a) - st(b)) || (a.dep - b.dep) || (a.title.length - b.title.length)).slice(0, 60);
      }
      renderSuggestion(x, el) {
        el.createDiv({ cls: "tx-fw500", text: x.title });
        const has = E.styles.has(x.name);
        el.createDiv({ cls: "tx-sub tx-sub-82", text: [FMT[x.format] || x.format, x.name, has ? (en ? "✓ installed" : "✓ instalat") : ""].filter(Boolean).join("  ·  ") });
      }
      onChooseSuggestion(x) { plugin.citeInstall(x, file); }
    };
    const md = new M(this.app);
    md.setPlaceholder(en ? "Search a style: APA, Vancouver, a journal's name…" : "Caută un stil: APA, Vancouver, numele unei reviste…");
    md.setInstructions([{ command: "↵", purpose: file ? (en ? "install and use in this note" : "instalează și folosește în notă") : (en ? "install" : "instalează") }]);
    md.limit = 60; md.open();
    // stilul tău nu e un rezultat al căutării: un rând discret, sub listă
    const ft = md.modalEl.createDiv("texere-csl-own");
    ft.createSpan({ text: en ? "Your own style? " : "Ai un stil propriu? " });
    const a1 = ft.createEl("a", { text: en ? "Import a style (.csl)…" : "Importă un stil (.csl)…" }); a1.addEventListener("click", () => { md.close(); this.citeImport(file); });
    ft.createSpan({ text: " · " });
    const a2 = ft.createEl("a", { text: en ? "How to make one" : "Cum îl faci" }); a2.addEventListener("click", () => { md.close(); this.citeGuide(file); });
  },

  async citeInstall(x, file) {
    const { requestUrl } = require("obsidian");
    const E = this.cite, en = isEn(this.app), ad = this.app.vault.adapter;
    const path = (E.styleDir() ? E.styleDir() + "/" : "") + x.name + ".csl";
    if (!(await ad.exists(path))) {
      const get = async (name, dep) => {
        for (const url of [`https://raw.githubusercontent.com/citation-style-language/styles/master/${dep ? "dependent/" : ""}${name}.csl`, `https://www.zotero.org/styles/${name}`]) {
          try { const r = await requestUrl({ url, throw: false }); if (r.status === 200 && /<style[\s>]/.test(r.text)) return r.text; } catch (e) {}
        }
        throw new Error(name);
      };
      const wait = new Notice((en ? "Installing " : "Instalez ") + x.title + "…", 0);
      try {
        let xml = await get(x.name, x.dep);
        // stilul unei reviste (dependent) folosește regulile altui stil: le copiem, cu titlul revistei, ca să meargă și fără internet
        const par = /href="https?:\/\/www\.zotero\.org\/styles\/([^"]+)"\s+rel="independent-parent"/.exec(xml);
        if (par) {
          let p = await get(par[1], false);
          const title = (/<title>([^<]*)<\/title>/.exec(xml) || [])[1], loc = (/default-locale="([^"]+)"/.exec(xml) || [])[1];
          if (title) p = p.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
          if (loc) p = /default-locale="/.test(p) ? p.replace(/default-locale="[^"]*"/, `default-locale="${loc}"`) : p.replace(/<style\b/, `<style default-locale="${loc}"`);
          xml = p;
        }
        await ad.write(path, xml);
      } catch (e) {
        wait.hide();
        new Notice(en ? `I couldn't download ${x.title}. Check the internet connection and try again.` : `Nu am putut descărca ${x.title}. Verifică conexiunea la internet și încearcă din nou.`, 8000);
        return;
      }
      wait.hide();
    }
    await E.loadStyles(); this.refreshCites();
    if (file) { await this.setNoteStyle(file, x.name); new Notice((en ? "Installed and used in this note: " : "Instalat și folosit în această notă: ") + E.label(x.name)); }
    else new Notice((en ? "Installed: " : "Instalat: ") + E.label(x.name));
  },

  // stilul tău: o fereastră mică în care alegi fișierul .csl, îl tragi din Finder sau lipești codul
  citeImport(file) {
    const { Modal } = require("obsidian");
    const en = isEn(this.app), T = (ro, e) => en ? e : ro, plugin = this;
    const M = class extends Modal {
      onOpen() {
        this.titleEl.setText(T("Importă un stil (.csl)…", "Import a style (.csl)…"));
        const c = this.contentEl; c.addClass("texere-csl-import");
        const err = c.createDiv("texere-csl-err"); err.hide();
        const run = async (text) => {
          err.hide();
          try { await plugin.citeImportText(text, file); this.close(); }
          catch (e) { console.error("Texere: stilul importat", e); err.setText(T("Nu pot folosi acest stil: ", "I can't use this style: ") + e.message); err.show(); }
        };
        // zona în care tragi fișierul; „Alege un fișier” e chiar câmpul de fișier (clicul ajunge direct la el)
        const drop = c.createDiv("texere-csl-drop");
        drop.createDiv({ text: T("Trage aici fișierul .csl", "Drag the .csl file here") });
        drop.createDiv({ cls: "texere-csl-or", text: T("sau", "or") });
        const lab = drop.createEl("label", { cls: "texere-csl-pick mod-cta", text: T("Alege un fișier…", "Choose a file…") });
        const inp = lab.createEl("input", { type: "file" }); inp.accept = ".csl,.xml,application/xml,text/xml";
        inp.addEventListener("change", async () => { const f = inp.files?.[0]; if (f) await run(await f.text()); inp.value = ""; });
        for (const ev of ["dragenter", "dragover"]) drop.addEventListener(ev, e => { e.preventDefault(); drop.addClass("on"); });
        for (const ev of ["dragleave", "drop"]) drop.addEventListener(ev, () => drop.removeClass("on"));
        drop.addEventListener("drop", async e => { e.preventDefault(); const f = e.dataTransfer?.files?.[0]; if (f) await run(await f.text()); });
        // sau codul lipit (ex. copiat din Visual CSL Editor → Style → View CSL code)
        const det = c.createEl("details", { cls: "texere-csl-paste" }); det.createEl("summary", { text: T("Sau lipește codul stilului", "Or paste the style's code") });
        const ta = det.createEl("textarea", { attr: { placeholder: '<?xml version="1.0" encoding="utf-8"?>\n<style xmlns="http://purl.org/net/xbiblio/csl" …' } });
        const go = det.createEl("button", { cls: "mod-cta", text: T("Importă", "Import") });
        go.addEventListener("click", () => { if (ta.value.trim()) run(ta.value); });
        const help = c.createEl("p", { cls: "texere-csl-tip" }); help.appendText(T("Nu ai încă un stil? ", "No style yet? "));
        const g = help.createEl("a", { text: T("Vezi cum îl faci, fără cod", "See how to make one, without code") }); g.addEventListener("click", () => { this.close(); plugin.citeGuide(file); });
      }
      onClose() { this.contentEl.empty(); }
    };
    new M(this.app).open();
  },
  async citeImportText(xml, file) {
    const { requestUrl } = require("obsidian");
    const E = this.cite, en = isEn(this.app), ad = this.app.vault.adapter;
    xml = String(xml).replace(/^\uFEFF/, "");
    if (!/<style\b[^>]*xmlns="http:\/\/purl\.org\/net\/xbiblio\/csl"/.test(xml)) throw new Error(en ? "this isn't a CSL style file (.csl)." : "acesta nu e un fișier de stil CSL (.csl).");
    // stilul unei reviste care doar trimite la alt stil: aducem regulile acelui stil, ca la „+ Adaugă un stil”
    const par = /href="https?:\/\/www\.zotero\.org\/styles\/([^"]+)"\s+rel="independent-parent"/.exec(xml) || /rel="independent-parent"\s+href="https?:\/\/www\.zotero\.org\/styles\/([^"]+)"/.exec(xml);
    if (par && !/<citation\b/.test(xml)) {
      let p = null;
      for (const url of [`https://raw.githubusercontent.com/citation-style-language/styles/master/${par[1]}.csl`, `https://www.zotero.org/styles/${par[1]}`]) {
        try { const r = await requestUrl({ url, throw: false }); if (r.status === 200 && /<style[\s>]/.test(r.text)) { p = r.text; break; } } catch (e) {}
      }
      if (!p) throw new Error(en ? `it relies on the “${par[1]}” style, which I couldn't download. Check the internet connection.` : `se bazează pe stilul „${par[1]}”, pe care nu l-am putut descărca. Verifică conexiunea la internet.`);
      const t = (/<title>([^<]*)<\/title>/.exec(xml) || [])[1]; if (t) p = p.replace(/<title>[^<]*<\/title>/, `<title>${t}</title>`);
      xml = p;
    }
    // fișierul trebuie să fie XML corect și să aibă regulile pentru citare
    try { const doc = new window.DOMParser().parseFromString(xml, "application/xml"); const pe = doc.getElementsByTagName("parsererror")[0];
      if (pe) throw new Error((pe.textContent || "").split("\n").find(Boolean)?.slice(0, 140) || "XML"); } catch (e) { throw new Error((en ? "the file is damaged (" : "fișierul e deteriorat (") + e.message + ")."); }
    if (!/<citation\b/.test(xml)) throw new Error(en ? "the style has no citation rules (<citation>)." : "stilul nu are regulile pentru citare (<citation>).");
    let title = ((/<title>([^<]*)<\/title>/.exec(xml) || [])[1] || "").trim();
    if (!title) throw new Error(en ? "the style has no title (Style Info → Title in the Visual CSL Editor)." : "stilul nu are titlu (Style Info → Title în Visual CSL Editor).");
    // același titlu ca un stil instalat, dar alt fișier (ex. o copie a APA nemodificată la nume): îl marcăm ca al tău, ca să nu le confunzi
    const slug = t => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "my-style";
    let id = slug(title);
    const twin = [...E.styles.values()].find(st => st.title === title && st.id !== id);
    if (twin) { title += en ? " (mine)" : " (al meu)"; xml = xml.replace(/<title>[^<]*<\/title>/, `<title>${title.replace(/&/g, "&amp;")}</title>`); id = slug(title); }
    const old = E.styles.get(id);
    if (old && old.title !== title) { let n = 2; while (E.styles.has(`${id}-${n}`)) n++; id = `${id}-${n}`; }
    // îl încercăm înainte să-l copiem: un stil stricat nu trebuie să strice citările din note
    let probe;
    try { probe = E.sample(xml); } catch (e) { throw new Error((en ? "citeproc can't read it (" : "citeproc nu îl poate citi (") + String(e.message || e).slice(0, 160) + ")."); }
    const path = (E.styleDir() ? E.styleDir() + "/" : "") + id + ".csl";
    if (E.styleDir() && !(await ad.exists(E.styleDir()))) await this.app.vault.createFolder(E.styleDir());
    await ad.write(path, xml);
    await E.loadStyles(); this.refreshCites();
    if (file) await this.setNoteStyle(file, id);
    const msg = document.createDocumentFragment(), line = (t, cls) => { const d = document.createElement("div"); d.textContent = t; if (cls) d.className = cls; msg.appendChild(d); };
    line((old ? (en ? "Updated: " : "Actualizat: ") : (en ? "Added: " : "Adăugat: ")) + E.label(id) + (file ? (en ? " (used in this note)" : " (folosit în această notă)") : ""));
    line(probe.cite, "tx-mt6 tx-dim"); if (probe.bib) line(probe.bib, "tx-dim");
    new Notice(msg, 10000);
    return id;
  },
  // ghidul pentru un stil propriu: pașii, cu butoanele pentru editor și pentru import
  citeGuide(file) {
    const { Modal } = require("obsidian");
    const en = isEn(this.app), plugin = this, T = (ro, e) => en ? e : ro, dir = this.cite.styleDir();
    const M = class extends Modal {
      onOpen() {
        this.titleEl.setText(T("Propriul tău stil de citare", "Your own citation style"));
        const c = this.contentEl; c.addClass("texere-csl-guide");
        c.createEl("p", { text: T("Un stil de citare e un fișier .csl. Nu trebuie scris de mână: îl faci în Visual CSL Editor, gratuit, în browser, fără cont, pornind de la stilul cel mai apropiat.",
          "A citation style is a .csl file. You don't have to write it by hand: you make it in the Visual CSL Editor, free, in the browser, no account, starting from the closest style.") });
        const ol = c.createEl("ol");
        const step = (b, t) => { const li = ol.createEl("li"); li.createEl("strong", { text: b }); li.appendText(" " + t); };
        step(T("Pornește de la un stil.", "Start from a style."), T("În editor: Search by Name (ex. APA) sau Search by Example: scrii cum vrei să arate o citare și găsește stilul cel mai apropiat. Apoi Edit Style.",
          "In the editor: Search by Name (e.g. APA) or Search by Example: you type how a citation should look and it finds the closest style. Then Edit Style."));
        step(T("Dă-i numele tău.", "Give it your name."), T("Style Info → Title (ex. „APA – departamentul de filosofie”), ca să nu înlocuiască stilul de la care ai pornit.",
          "Style Info → Title (e.g. “APA – philosophy department”), so it doesn't replace the style you started from."));
        step(T("Schimbă ce ai nevoie.", "Change what you need."), T("Dai clic pe o parte din exemplu (autor, an, titlu, pagină) și îi schimbi ordinea, punctuația, cursivele. Exemplul se actualizează pe loc.",
          "Click a part of the example (author, year, title, page) and change its order, punctuation, italics. The example updates as you go."));
        step(T("Salvează.", "Save it."), T("Style → Save Style descarcă fișierul .csl.", "Style → Save Style downloads the .csl file."));
        step(T("Adaugă-l aici.", "Add it here."), T("„Importă fișierul .csl”, mai jos. Apare la Stilurile instalate și în meniul din bara de jos, iar exportul îl folosește la fel.",
          "“Import the .csl file”, below. It appears under Installed styles and in the menu at the bottom of the window, and the export uses it too."));
        c.createEl("p", { cls: "texere-csl-tip", text: T(`Ca să-l modifici mai târziu: în editor, Style → Load Style și alegi fișierul din ${dir}. Îl imporți din nou cu același titlu și îl înlocuiește pe cel vechi. Un stil primit de la universitate sau de la o revistă (.csl) se importă la fel.`,
          `To change it later: in the editor, Style → Load Style and pick the file in ${dir}. Import it again with the same title and it replaces the old one. A style you got from your university or a journal (.csl) is imported the same way.`) });
        const bar = c.createDiv("texere-csl-bar");
        const open = bar.createEl("button", { text: T("Deschide Visual CSL Editor ↗", "Open the Visual CSL Editor ↗") });
        open.addEventListener("click", () => window.open("https://editor.citationstyles.org/searchByName/"));
        const imp = bar.createEl("button", { cls: "mod-cta", text: T("Importă un stil (.csl)…", "Import a style (.csl)…") });
        imp.addEventListener("click", () => { this.close(); plugin.citeImport(file); });
      }
      onClose() { this.contentEl.empty(); }
    };
    new M(this.app).open();
  },

  // „Șterge un stil”: fișierul .csl merge la coșul de gunoi; notele care îl foloseau trec la stilul implicit
  // șterge un stil: fișierul .csl merge la coșul de gunoi; notele care îl foloseau trec la stilul implicit
  async removeStyle(id) {
    const E = this.cite, en = isEn(this.app);
    if (id === E.defaultId()) { new Notice(en ? "The default style can't be removed; choose another default first." : "Stilul implicit nu se poate șterge; alege întâi alt stil implicit."); return; }
    const f = this.app.vault.getAbstractFileByPath((E.styleDir() ? E.styleDir() + "/" : "") + id + ".csl"); if (!f) return;
    const label = E.label(id);
    await (this.app.fileManager?.trashFile ? this.app.fileManager.trashFile(f) : this.app.vault.trash(f, true)); await E.loadStyles(); this.refreshCites();
    new Notice((en ? "Removed: " : "Șters: ") + label);
  },

  citeRemove() {
    const { FuzzySuggestModal } = require("obsidian");
    const E = this.cite, en = isEn(this.app), plugin = this, def = E.defaultId();
    const M = class extends FuzzySuggestModal {
      getItems() { return E.list().filter(s => s.id !== def); }
      getItemText(s) { return s.label + "  —  " + s.title; }
      async onChooseItem(s) { await plugin.removeStyle(s.id); }
    };
    const md = new M(this.app);
    md.setPlaceholder(en ? "Which style do you want to remove? (the default style can't be removed)" : "Ce stil vrei să ștergi? (stilul implicit nu se poate șterge)");
    md.open();
  },

  async setNoteStyle(file, id) {
    await this.app.fileManager.processFrontMatter(file, fm => { if (id === this.cite.defaultId()) delete fm.csl; else fm.csl = id; });
  },

  async setDefaultStyle(id) {
    this.settings.citationStyle = id; await this.saveData(this.settings);
    this.refreshCites();
    new Notice((isEn(this.app) ? "Default citation style: " : "Stilul implicit al citărilor: ") + this.cite.label(id));
  },
};


// instalează citările pe pluginul gazdă (metodele rulează cu „this” = pluginul, ca înainte)
module.exports = {
  async install(host) {
    Object.assign(host, CiteStyleMixin);
    host.registerEditorSuggest(new CiteSuggest(host));   // scrii @ → alegi sursa → [@citekey]
    await host.citations();                                // [@citekey, p. 61] → (Autor, an, p. 61) în stilul ales
    host.bibliographyPanel();                              // bibliografia la finalul fiecărei note cu citări
  },
  CITE_KEY, scanCites, citeFm, fitToText, keepFit,
};
