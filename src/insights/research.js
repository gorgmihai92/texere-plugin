// Texere · Insights · lectura și scrisul, legate între ele (fără AI: doar etichetele, linkurile, citările, titlurile și cuvintele din note)
//  1. Pagina conceptului: un panou în fiecare notă-concept, cu ce spun sursele tale despre el, notițele tale de sub evidențieri,
//     unde îl folosești în scrisul tău și dacă îl definești acolo.
//  2. Harta dezbaterii: evidențierile despre un concept din toate sursele, grupate după gânditorul numit (sau capitol),
//     cu poziția ta (agree / disagree / question), notițele tale, ce n-ai scris încă și lucrările citate de mai multe surse.
//  3. Însoțitorul scrisului: un panou lateral pentru nota deschisă: scheletul argumentului (rolul fiecărui paragraf și ce lipsește)
//     și, pentru paragraful în care ești, ce ai în vault despre el.
// Indexul se face la trecerea prin vault (aceeași trecere ca linkurile): nimic nu se scrie în note fără un clic.
const { ItemView, Notice, TFile, setIcon, MarkdownView, FuzzySuggestModal, requestUrl } = require("obsidian");
const { beta } = require("../shared/beta");
const X = require("./text");
const V = require("./voice");
const { CLAIM_RX } = require("./links");
const { el } = require("../shared/util");

const RV = "r1";   // versiunea indexului: când se schimbă, prima trecere citește tot vault-ul din nou
const MAP_VIEW = "texere-map", CMP_VIEW = "texere-companion";
const stanceOf = tag => tag === "agree" || tag === "disagree" || tag === "question" ? tag : tag === "definition" ? "definition" : tag === "word" ? "word" : "claim";
const TAG_RANK = { definition: 0, claim: 1, disagree: 1, agree: 2, fact: 2, connection: 3, question: 3, idea: 3, important: 2, quote: 2, summary: 3 };

// ——— evidențierile din notele de literatură ———
const CITE_RX = /\[@[^\]\n]*\]/g;
const PAGE_RX = /\[@[^\],;\]\n]+,\s*(?:pp?\.|s\.)?\s*([0-9ivxlcdm]+(?:\s*[-–]\s*[0-9ivxlcdm]+)?)/i;
const PDFPAGE_RX = /\.pdf#page=(\d+)/i;
const ID_RX = /\[@([^\],;\s\]]+)/;
// textul unei evidențieri sau notițe: fără citare, link spre PDF, HTML și sintaxa linkurilor
function plain(s) {
  return String(s || "")
    .replace(/\s*·?\s*!?\[\[[^\]]*\.pdf(?:#[^\]]*)?\]\]/gi, " ")
    .replace(CITE_RX, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/!?\[\[([^\]|]*)\|([^\]]*)\]\]/g, "$2").replace(/!?\[\[([^\]]*)\]\]/g, (m, a) => a.split("#")[0].split("/").pop())
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/==|\*\*|__/g, "").replace(/(?<!\w)[*_](?=\S)|(?<=\S)[*_](?!\w)/g, "")
    .replace(/\s+/g, " ").replace(/^\s*·\s*|\s*·\s*$/g, "").trim();
}
const linksIn = s => { const out = []; const r = /\[\[([^\]|#]+)/g; let m; while ((m = r.exec(String(s || "")))) if (!/\.pdf$/i.test(m[1].trim())) out.push(m[1].trim()); return out; };
// tags: etichetele evidențierilor (set, litere mici). Întoarce { hls, loose }: evidențierile (cu notițele tale de sub ele) și notițele de sine stătătoare
function parseHighlights(text, tags) {
  const lines = String(text || "").split("\n"); let i0 = 0;
  if (lines[0] === "---") { const e = lines.indexOf("---", 1); if (e > 0) i0 = e + 1; }
  const hls = [], loose = [], heads = []; let cur = null, last = null, fence = false;
  const tagOf = l => { const m = /^#([\p{L}\p{N}_\-]+)(?:\s+(.*))?$/u.exec(l); return m && tags.has(m[1].toLowerCase()) ? { tag: m[1].toLowerCase(), rest: m[2] || "" } : null; };
  const citeOf = (h, s) => { const id = ID_RX.exec(s); if (id && !h.id) h.id = id[1].replace(/[.,;:]+$/, ""); const pg = PAGE_RX.exec(s) || PDFPAGE_RX.exec(s); if (pg && !h.p) h.p = pg[1].replace(/\s+/g, ""); if (/\[@|\.pdf#/i.test(s)) h.cited = true; };
  const onlyCite = s => /^\s*(\[@[^\]]*\])?\s*·?\s*(!?\[\[[^\]]*\.pdf[^\]]*\]\])?\s*$/i.test(s) && /\[@|\.pdf/i.test(s);
  for (let i = i0; i < lines.length; i++) {
    const l = lines[i];
    if (/^\s*(```|~~~)/.test(l)) { fence = !fence; cur = null; continue; }
    if (fence) continue;
    const h = /^(#{1,6})\s+(.*)$/.exec(l);
    if (h) { const lv = h[1].length; while (heads.length && heads[heads.length - 1].lv >= lv) heads.pop(); heads.push({ lv, t: plain(h[2]) }); cur = null; last = null; continue; }
    if (!l.trim()) { cur = null; continue; }
    const tg = tagOf(l.trim());
    if (tg) {
      // aceeași evidențiere pe două rânduri: al doilea are doar citarea
      if (cur && cur.tag === tg.tag && !cur.cited && onlyCite(tg.rest)) { citeOf(cur, tg.rest); continue; }
      cur = { ln: i, tag: tg.tag, raw: tg.rest, notes: [], tlinks: linksIn(tg.rest), nlinks: [], heads: heads.map(x => x.t) };
      citeOf(cur, tg.rest); hls.push(cur); last = cur; continue;
    }
    // un rând care nu e evidențiere: notița ta (sub evidențiere, în același bloc; altfel după ultima evidențiere din secțiune)
    const bare = l.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, "").replace(/^\s*#[\p{L}\p{N}_\-]+\s+/u, ""), note = plain(bare);
    if (!note || /^\[@[^\]]*\]$/.test(bare.trim())) continue;
    const target = cur || last;
    if (target) { target.notes.push(note); target.nlinks.push(...linksIn(bare)); }
    else loose.push({ ln: i, t: note.slice(0, 400), links: linksIn(bare), heads: heads.map(x => x.t) });
  }
  for (const h of hls) { h.t = plain(h.raw); delete h.raw; }
  return { hls: hls.filter(h => h.t), loose };
}

// ——— paragrafele de proză ale unei note, cu rândurile lor (aceleași reguli ca la analiza scrisului) ———
function paraRanges(md) {
  const lines = String(md || "").split("\n"); let i0 = 0;
  if (lines[0] === "---") { const e = lines.indexOf("---", 1); if (e > 0) i0 = e + 1; }
  const out = []; let cur = null, fence = false;
  const end = () => { if (cur) { out.push(cur); cur = null; } };
  for (let i = i0; i <= lines.length; i++) {
    const l = i < lines.length ? lines[i] : "";
    if (/^\s*(```|~~~)/.test(l)) { fence = !fence; end(); continue; }
    if (fence) continue;
    if (!l.trim() || /^#{1,6}\s/.test(l) || /^\s*(\||---+\s*$|\*\*\*+\s*$)/.test(l) || /^\s*>/.test(l) || /^\s*([-*+]|\d+[.)])\s/.test(l)) { end(); continue; }
    if (!cur) cur = { line: i, end: i, raw: [] };
    cur.raw.push(l); cur.end = i;
  }
  return out.map(p => ({ line: p.line, end: p.end, raw: p.raw.join("\n") }));
}
// text cu linkurile înlocuite de textul lor (rândurile rămân aceleași)
const flat = t => String(t || "").replace(/!?\[\[([^\]|]*)\|([^\]]*)\]\]/g, "$2").replace(/!?\[\[([^\]]*)\]\]/g, (m, a) => a.split("#")[0].split("/").pop());
// textul fără sintaxa linkurilor și, pentru fiecare literă, poziția ei în rândul original
function flatMap(s) {
  let out = "", i = 0; const map = [], re = /!?\[\[([^\]|]*)(?:\|([^\]]*))?\]\]/g; let m;
  while ((m = re.exec(s))) {
    for (let k = i; k < m.index; k++) { map.push(k); out += s[k]; }
    const disp = m[2] != null ? m[2] : m[1].split("#")[0].split("/").pop(), at = m[2] != null ? m.index + m[0].length - 2 - m[2].length : m.index + m[0].length - 2 - disp.length;
    for (let k = 0; k < disp.length; k++) { map.push(at + k); out += disp[k]; }
    i = m.index + m[0].length;
  }
  for (let k = i; k < s.length; k++) { map.push(k); out += s[k]; }
  map.push(s.length); return { text: out, map };
}
const lineAt = (t, off) => { let n = 0; for (let i = 0; i < off && i < t.length; i++) if (t.charCodeAt(i) === 10) n++; return n; };
const quote = s => (V.langOf(s) === "ro" ? `„${s}”` : `“${s}”`);
const shorten = (s, n) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : s; };

// cercetare invocată fără citare (în paragraf: nicio citare, notă de subsol, link sau „(Autor, an)”)
const RESEARCH = {
  en: /\b(research(?:ers)?\s+(?:show|shows|showed|has shown|have shown|suggest|suggests|indicate|indicates|confirm|confirms|demonstrate|demonstrates|found|finds|find|reveal|reveals|revealed)|researchers\s+(?:have\s+)?(?:found|shown|show|discovered|argue|suggest|demonstrated|observed|concluded)|research studies|(?:recent|previous|scientific|empirical|clinical|ample|extensive)\s+research\s+(?:shows|suggests|indicates|has|confirms)|(?:recent|several|many|numerous|previous|multiple|various)\s+studies|stud(?:y|ies)\s+(?:show|shows|showed|have shown|has shown|find|finds|found|suggest|suggests|confirm|confirms|indicate|indicates|demonstrate|demonstrates|prove|proves|reveal|reveals)|scientists\s+(?:have\s+)?(?:show|shown|found|discovered|agree)|according to (?:research|studies|scientists|experts)|(?:the\s+)?(?:data|evidence)\s+(?:show|shows|suggest|suggests|indicate|indicates))\b/,
  ro: /\b(cercetari(?:le)?\s+(?:arata|au aratat|sugereaza|confirma|indica|demonstreaza|dezvaluie)|cercetatorii\s+(?:au aratat|arata|au descoperit|sustin|au constatat|au demonstrat|confirma)|(?:mai multe|numeroase|diverse)\s+studii|studii(?:le)?\s+(?:arata|au aratat|sugereaza|confirma|indica|demonstreaza|recente)|un studiu\s+(?:arata|a aratat)|studiul\s+(?:arata|a aratat)|potrivit (?:cercetarilor|studiilor|specialistilor|expertilor|oamenilor de stiinta)|oamenii de stiinta\s+(?:au aratat|arata|au descoperit)|datele arata|dovezile arata)\b/,
};
const HAS_CITE = /\[@|\[\^|\]\(https?:|https?:\/\/|\(\s*\p{Lu}[\p{L}'’\-]+(?:\s+(?:et al\.?|și|and|&)\s*(?:\p{Lu}[\p{L}'’\-]+)?)?,?\s+\d{4}[a-z]?\s*[,):;]/u;
// ce urmează imediat după termen ca să fie o definiție („X înseamnă…”, „X refers to…”)
const DEF_AFTER = /^\s*,?\s*(?:means|refers to|denotes|designates|(?:is |are |can be |may be )?defined as|(?:is |are |can be )?understood as|encompasses|consists (?:in|of)|(?:is|are) (?:the|a|an) (?:ability|capacity|power|freedom|right|process|state|quality|condition|property|form|kind|type|set) (?:to|of|that|in)|inseamna|reprezinta|se refera la|denota|desemneaza|(?:este |sunt |poate fi )?definit[aei]? (?:ca|drept)|(?:este |e )?inteles[aei]? (?:ca|drept)|cuprinde|consta in|(?:este|e|sunt) (?:capacitatea|abilitatea|puterea|libertatea|dreptul|procesul|starea|calitatea|conditia|proprietatea|forma|tipul) (?:de|sa|prin|in))\b/;

// o definiție e a termenului doar dacă termenul stă lângă expresie: „I define X”, „X, as I define it”, „by X I mean”
function defNear(fs, phrases, m) {
  return (phrases || []).some(ph => {
    const k = X.fold(ph).trim();
    if (k.includes("…")) { const [a, b] = k.split("…").map(x => x.trim()); const r = new RegExp(`(?:^|[^\\p{L}])${a}\\s+(.{1,48}?)\\s+${b}(?![\\p{L}])`, "u").exec(fs); return !!r && m.from >= r.index && m.to <= r.index + r[0].length; }
    const needAs = /^(i define|we define|definesc|definim)$/.test(k);
    let i = fs.indexOf(k);
    while (i >= 0) {
      const e = i + k.length;
      if (m.from >= e && m.from - e <= 25 && (!needAs || /^\s*(?:[^\s.;:]+\s+){0,3}?(?:as|ca|drept)\s/.test(fs.slice(m.to, m.to + 50)))) return true;
      if (!needAs && m.to <= i && i - m.to <= 25) return true;
      i = fs.indexOf(k, i + 1);
    }
    return false;
  });
}

// cuvinte de zi cu zi care sunt și titluri de concepte („no matter”, „the reason why”, „being late”): fără link, nu leagă paragraful de concept
const AMBIG = new Set(["being", "matter", "reason", "power", "self", "will", "act", "action", "state", "form", "nature", "end", "good", "right", "sense", "case", "fact", "sine", "fiind", "putere", "materie", "forma", "natura", "stare", "fapt", "caz", "bine", "drept", "sens", "vointa"]);

const ResearchMixin = {
  researchInit() {
    this.register(() => { document.querySelectorAll(".txr-cp").forEach(e => e.remove()); });
    // indexul: aceeași trecere prin vault, cu evidențierile, menționările și definițiile; o versiune nouă citește tot din nou
    const loadC = this.loadScanCache, scanN = this.scanNote;
    this.loadScanCache = async function () { await loadC.call(this); if (this.scanCache && this.scanCache.rv !== RV) { this.scanCache.sig = "research:" + RV; this.scanCache.rv = RV; } };
    this.scanNote = async function (f, idx) { const ent = await scanN.call(this, f, idx); try { await this.researchNote(f, idx, ent); } catch (e) { console.error("Texere · Insights: index", f.path, e); } return ent; };
    this.cpInit(); this.mapInit(); this.companionInit();
  },
  // ——— indexul unei note ———
  async researchNote(f, idx, ent) {
    const text = await this.app.vault.cachedRead(f), cache = this.app.metadataCache.getFileCache(f) || {};
    const resolve = l => { const t = this.app.metadataCache.getFirstLinkpathDest(String(l).split("#")[0].split("|")[0], f.path); return t ? t.path : null; };
    const concepts = (s, links) => { const set = new Set(); for (const m of X.matchAll(idx, s)) m.g.paths.forEach(p => set.add(p)); for (const l of links || []) { const p = resolve(l); if (p && this.isTarget(p)) set.add(p); } set.delete(f.path); return [...set]; };
    if (ent.kind === "lit") {
      const tags = new Set([...this.hlTags(), ...X.HL_TAGS]), { hls, loose } = parseHighlights(text, tags);
      ent.hls = hls.map(h => {
        const notes = h.notes.slice(0, 8).map(n => n.slice(0, 400)), hc = concepts(h.heads.join(" · "));
        const c = concepts(h.t, h.tlinks), nc = concepts(notes.join(" "), h.nlinks);
        return { ln: h.ln, tag: h.tag, t: h.t.slice(0, 900), p: h.p || "", id: h.id || "", h: h.heads.slice(-2), n: notes, c, nc: nc.filter(x => !c.includes(x)), hc: hc.filter(x => !c.includes(x)), lg: V.langOf(h.t) };
      });
      ent.ln = loose.slice(0, 200).map(n => ({ ln: n.ln, t: n.t, h: n.heads.slice(-2), c: concepts(n.t, n.links) })).filter(n => n.c.length);
      return;
    }
    if (ent.kind !== "own") return;
    // menționările conceptelor (cu sau fără link), cu propoziția primei menționări
    const F = flat(text), skip = X.skipRanges(F), cm = {};
    for (const m of X.matchAll(idx, F, skip)) for (const p of m.g.paths) {
      if (p === f.path) continue;
      const o = cm[p] || (cm[p] = { n: 0, ln: lineAt(F, m.from), s: "" }); o.n++;
      if (!o.s) { const ls = F.lastIndexOf("\n", m.from) + 1, le = F.indexOf("\n", m.to); const line = F.slice(ls, le < 0 ? F.length : le); const sent = V.sentences(V.clean(line)).find(x => X.fold(x).includes(X.fold(F.slice(m.from, m.to)))) || V.clean(line); o.s = shorten(sent, 240); }
    }
    // un termen-cheie al notei: folosit în primele trei paragrafe, într-un titlu sau cu link
    const prs = paraRanges(F).filter(x => V.words(V.clean(x.raw)).length >= 12), early = prs[Math.min(2, prs.length - 1)]?.end ?? -1, linked = new Set((cache.links || []).map(l => resolve(l.link)).filter(Boolean));
    const headTerms = new Set(); F.split("\n").forEach(l => { if (/^#{1,6}\s/.test(l)) for (const m of X.matchAll(idx, l)) m.g.paths.forEach(x => headTerms.add(x)); });
    for (const [p, o] of Object.entries(cm)) if (o.ln <= early || headTerms.has(p) || linked.has(p)) o.k = 1;
    ent.cm = cm;
    // definițiile: o propoziție cu „prin X înțeleg”, „X refers to”… în care apare conceptul
    const df = new Set();
    for (const p of paraRanges(F)) {
      const lang = V.langOf(p.raw);
      for (const s of V.sentences(V.clean(p.raw))) {
        const ms = X.matchAll(idx, s); if (!ms.length) continue;
        const mk = V.markers(s, lang), fs = X.fold(s);
        for (const m of ms) if (defNear(fs, mk.define, m) || DEF_AFTER.test(fs.slice(m.to))) m.g.paths.forEach(x => df.add(x));
      }
    }
    ent.df = [...df];
    // citările cu pagină ([@id, p. 14]) și notele de literatură spre care trimit linkurile
    const cp = []; const cr = /\[([^\]\n]*@[^\]\n]*)\]/g; let cm2;
    while ((cm2 = cr.exec(text))) for (const part of cm2[1].split(";")) { const id = /@([^\],;\s]+)/.exec(part); if (!id) continue; const pg = /(?:,|\s)\s*(?:pp?\.|s\.)?\s*([0-9ivxlcdm]+(?:[-–][0-9ivxlcdm]+)?)\s*$/i.exec(part.replace(/@[^\s,;]+/, "")); cp.push(id[1].replace(/[.,;:]+$/, "") + "|" + (pg ? pg[1] : "")); }
    ent.cp = [...new Set(cp)];
    ent.ll = [...new Set((cache.links || []).map(l => resolve(l.link)).filter(p => p && this.isLit(p)))];
  },
  // ——— indexul pe concepte, din trecerea prin vault ———
  researchIndex() {
    const C = this.scanCache; if (!C) return { by: new Map(), cites: new Map(), lit: {} };
    const n = Object.keys(C.notes).length;
    if (this._rx && this._rxAt === C.at && this._rxN === n) return this._rx;
    const by = new Map(), cites = new Map(), get = c => { let o = by.get(c); if (!o) by.set(c, o = { hls: [], heads: [], notes: [], own: [], co: {} }); return o; };
    for (const [path, e] of Object.entries(C.notes)) {
      if (e.kind === "lit" && e.hls) {
        e.hls.forEach((h, i) => {
          const ref = { path, i, h };
          for (const c of h.c || []) get(c).hls.push(ref);
          for (const c of h.hc || []) get(c).heads.push(ref);
          for (const c of h.nc || []) get(c).notes.push({ path, h, i });
        });
        for (const l of e.ln || []) for (const c of l.c || []) get(c).notes.push({ path, loose: l });
      } else if (e.kind === "own") {
        for (const [c, m] of Object.entries(e.cm || {})) get(c).own.push({ path, n: m.n, ln: m.ln, s: m.s, k: !!m.k, def: (e.df || []).includes(c) });
        for (const k of e.cp || []) { const [id, pg] = k.split("|"); const l = cites.get(id) || []; l.push({ path, p: pg }); cites.set(id, l); }
        for (const lp of e.ll || []) { const id = C.notes[lp]?.id; if (!id) continue; const l = cites.get(id) || []; l.push({ path, p: "" }); cites.set(id, l); }
      }
      for (const p of e.paras || []) for (const a of p.c || []) { const o = get(a).co; for (const b of p.c) if (b !== a) o[b] = (o[b] || 0) + 1; }
    }
    this._rx = { by, cites }; this._rxAt = C.at; this._rxN = n;
    return this._rx;
  },
  conceptEntry(path) { return this.researchIndex().by.get(path) || { hls: [], heads: [], notes: [], own: [], co: {} }; },
  // datele unei surse pentru afișare: eticheta (Autor an), limba, DOI
  litInfo(path) {
    const e = this.scanCache?.notes?.[path] || {}, id = e.id || "", meta = this.sourceMeta(id, path) || {}, fm = this.fmOf(path);
    const l = String(meta.language || fm.language || "").toLowerCase();
    const lang = l.startsWith("ro") ? "ro" : l.startsWith("en") ? "en" : (() => { let r = 0, en = 0; for (const h of e.hls || []) h.lg === "ro" ? r++ : en++; return r > en ? "ro" : "en"; })();
    return { id, label: this.citeLabel(id, path), lang, doi: String(meta.DOI || fm.DOI || fm.doi || "").replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").trim(), title: meta.title || fm.title || "" };
  },
  // unde ai citat sursa (cu pagina, dacă e aceeași): în scrisul tău
  citedWhere(id, page) {
    const l = (id && this.researchIndex().cites.get(id)) || []; if (!l.length) return null;
    const same = page ? l.find(x => x.p && x.p.split(/[-–]/)[0] === String(page).split(/[-–]/)[0]) : null;
    return same ? { path: same.path, exact: true } : { path: l[0].path, exact: false };
  },
  // definiția din nota-concept: primul paragraf de proză (fără „Read more”)
  async conceptDef(path) {
    const f = this.app.vault.getAbstractFileByPath(path); if (!(f instanceof TFile)) return "";
    const t = await this.app.vault.cachedRead(f);
    for (const p of paraRanges(t)) { const s = plain(p.raw); if (s && !/^(read more|citește mai mult|vezi|see also)\b/i.test(s)) return shorten(s, 320); }
    return "";
  },
  termOf(path) { const f = this.app.vault.getAbstractFileByPath(path); return f ? f.basename : String(path).split("/").pop().replace(/\.md$/, ""); },
  // numele scurt al unei note cu titlu lung: până la primul „. ” sau „ – ” / „ - ”
  shortOf(path) { const n = this.termOf(path); if (n.length <= 42) return n; const m = /^(.{8,}?)(?:\.\s| [–-] )/.exec(n); return m ? m[1] : n.slice(0, 40).replace(/\s+\S*$/, "") + "…"; },
  async openAt(path, line, newTab = true) {
    const f = this.app.vault.getAbstractFileByPath(path); if (!(f instanceof TFile)) return;
    const leaf = this.app.workspace.getLeaf(newTab ? "tab" : false);
    await leaf.openFile(f, { active: true, eState: line != null ? { line } : undefined });
  },

  // ════════ 1. Panoul din nota-concept ════════
  cpInit() {
    const tick = () => this.app.workspace.iterateAllLeaves(l => { if (l.view?.getViewType?.() === "markdown") { try { this.cpRender(l.view); } catch (e) { console.error("Texere · Insights: panoul conceptului", e); } } });
    this.cpSoon = ms => { clearTimeout(this._cpT); this._cpT = setTimeout(tick, ms ?? 300); };
    for (const ev of ["file-open", "layout-change", "active-leaf-change"]) this.registerEvent(this.app.workspace.on(ev, () => this.cpSoon(200)));
    this.registerEvent(this.app.workspace.on("texere:changed", () => this.cpSoon(400)));
    this.app.workspace.onLayoutReady(() => this.cpSoon(800));
  },
  // panourile conceptelor: pornite / oprite din panoul Insights (fila Scrisul) și din setări; fără argument: comută
  async cpToggle(on) { this.settings.cpOn = on === undefined ? !this.settings.cpOn : !!on; await this.saveSettings(); this.cpSoon(0); },
  cpRender(view) {
    const f = view.file, root = view.containerEl; if (!f || !root) return;
    if (!this.settings.cpOn || !this.isTarget(f.path) || !this.scanCache) { root.querySelectorAll(".txr-cp").forEach(e => e.remove()); return; }
    const targets = [root.querySelector(".markdown-source-view .cm-sizer"), root.querySelector(".markdown-reading-view .markdown-preview-sizer")].filter(Boolean);
    const td = this.cpTidy(f.path), sig = JSON.stringify([f.path, this.scanCache.at || 0, this.settings.cpOpen !== false, this.en, (this._cpMore || {})[f.path] || 0, td.un.length, td.al.length, td.du.length]);
    for (const tg of targets) {
      const old = tg.querySelector(":scope > .txr-cp, :scope > .mod-footer > .txr-cp");
      if (old && old.dataset.sig === sig) { this.fitPanel?.(old); continue; }
      const box = this.cpBuild(f); box.dataset.sig = sig;
      if (old) old.replaceWith(box);
      else if (tg.classList.contains("cm-sizer")) { const cc = tg.querySelector(":scope > .cm-contentContainer"); if (cc?.nextSibling) tg.insertBefore(box, cc.nextSibling); else tg.appendChild(box); }
      else { const foot = tg.querySelector(":scope > .mod-footer"); if (foot) foot.insertBefore(box, foot.firstChild); else tg.appendChild(box); }
      this.fitPanel?.(box, true);
    }
  },
  cpBuild(f) {
    const T = (a, b) => this.T(a, b), en = this.en, E = this.conceptEntry(f.path), name = f.basename;
    const icon = (x, n) => { try { setIcon(x, n); } catch (e) {} return x; };
    const box = el("div", "txr-cp" + (this.settings.cpOpen !== false ? " is-open" : ""));
    box.addEventListener("mousedown", e => e.stopPropagation());
    const head = el("div", "txr-cp-head"), ttl = el("span", "txr-cp-title");
    ttl.append(icon(el("span", "txr-ic"), "book-open"), T(`${name} în vault-ul tău`, `${name} in your vault`)); head.appendChild(ttl);
    const srcPaths = new Set([...E.hls.map(r => r.path), ...E.notes.map(r => r.path)]), ownPaths = new Set(E.own.map(o => o.path));
    const langs = new Set([...[...srcPaths].map(p => this.litInfo(p).lang), ...E.own.map(o => V.langOf(o.s || ""))].filter(Boolean));
    head.appendChild(el("span", "txr-cp-meta", srcPaths.size + ownPaths.size ? [srcPaths.size ? this.plural(srcPaths.size, "referință", "referințe", "reference", "references") : "", ownPaths.size ? T(`${ownPaths.size} ${ownPaths.size === 1 ? "notă de-a ta" : "note ale tale"}`, `${ownPaths.size} of your notes`) : ""].filter(Boolean).join(" · ") + (langs.size > 1 ? " · RO + EN" : "") : T("încă nimic", "nothing yet")));
    const undefinedIn = E.own.filter(o => o.n >= 10 && o.k && !o.def).sort((a, b) => b.n - a.n).slice(0, 2), tidy = this.cpTidy(f.path);
    if (undefinedIn.length || tidy.n) head.appendChild(el("span", "txr-cp-badge", [undefinedIn.length ? T(`${undefinedIn.length} de verificat`, `${undefinedIn.length} to check`) : "", tidy.n ? T(`${tidy.n} de pus în ordine`, `${tidy.n} to tidy`) : ""].filter(Boolean).join(" · ")));
    const mapHls = E.hls.length + E.heads.length;
    if (mapHls) { const mb = el("button", "txr-mini", T("Harta dezbaterii", "Debate map")); icon(mb.insertBefore(el("span", "txr-ic"), mb.firstChild), "map"); mb.title = T("Adnotările despre acest concept, din toate referințele, cu poziția ta", "Annotations on this concept from all your references, with where you stand"); mb.addEventListener("click", e => { e.stopPropagation(); this.openMap(f.path); }); head.appendChild(mb); }
    head.appendChild(icon(el("span", "txr-chev"), "chevron-down"));
    head.addEventListener("click", async () => { this.settings.cpOpen = this.settings.cpOpen === false; await this.saveSettings(); this.cpSoon(0); });
    box.appendChild(head);
    const body = el("div", "txr-cp-body"); box.appendChild(body);
    const sec = (title, meta) => { const s = el("div", "txr-sec"), h = el("div", "txr-sec-h"); h.append(el("b", null, title)); if (meta) h.append(el("span", null, meta)); s.appendChild(h); body.appendChild(s); return s; };
    const meta = parts => el("div", "txr-meta", parts.filter(Boolean).join(" · "));
    const langB = l => { const b = el("span", "txr-lang", (l || "").toUpperCase()); return b; };
    const tagB = tag => el("span", "txr-tag is-" + stanceOf(tag), "#" + tag);
    if (!E.hls.length && !E.notes.length && !E.own.length && !E.heads.length && !tidy.n) {
      body.appendChild(el("div", "txr-empty", this.scanCache?.at ? T(`Încă nimic despre ${name}: apare aici când scrii sau adnotezi ceva despre el.`, `Nothing about ${name} yet: it shows up here once you write or annotate something about it.`) : T("Se citește vault-ul…", "Reading your vault…")));
      return box;
    }
    // 1. termenul folosit des și nedefinit într-o notă de-a ta
    for (const o of undefinedIn) {
      const c = el("div", "txr-check"); c.appendChild(icon(el("span", "txr-ic txr-flag"), "flag"));
      const t = el("div"); t.append(el("b", null, T(`„${name}” apare de ${o.n} ori în ${this.shortOf(o.path)}. Texere n-a găsit acolo nicio propoziție care să-l definească.`, `“${name}” appears ${o.n} times in ${this.shortOf(o.path)}. Texere found no sentence there that defines it.`)), el("span", null, T("Definiția din nota aceasta ar putea sta la prima folosire.", "The definition on this note could go at its first use.")));
      const b = el("button", "txr-btn-o", T("Arată prima folosire", "Show first use")); b.addEventListener("click", e => { e.stopPropagation(); this.openAt(o.path, o.ln); });
      c.append(t, b); body.appendChild(c);
    }
    const more = (this._cpMore || {})[f.path] || 0, cap = n => (more ? n * 6 : n);
    // 2. de pus în ordine: menționările fără link, aliasurile pe care le-ai putea adăuga, o notă care pare același concept
    if (tidy.n) {
      const s = sec(T("De pus în ordine", "To tidy"), ""), act = (b, fn) => b.addEventListener("click", async e => { e.stopPropagation(); b.disabled = true; try { await fn(); } catch (er) { console.error(er); } this.cpSoon(0); });
      if (tidy.un.length) {
        const notes = new Set(tidy.un.map(u => u.note)).size, ok = tidy.un.filter(u => !u.amb), h = el("div", "txr-tidy-h");
        h.append(el("span", null, T(`Menționat fără link în ${notes} ${notes === 1 ? "notă" : "note"}`, `Mentioned without a link in ${notes} ${notes === 1 ? "note" : "notes"}`)));
        if (ok.length > 1) { const b = el("button", "txr-btn-o", T(`Leagă-le pe toate (${ok.length})`, `Link all (${ok.length})`)); b.title = T("Prima menționare din fiecare notă devine link; cuvintele tale rămân", "The first mention in each note becomes a link; your words stay"); act(b, async () => { const r = await this.applyLinks(ok); new Notice(T(`${r.done} linkuri puse.`, `${r.done} links added.`), 4000); }); h.append(b); }
        s.appendChild(h);
        for (const u of tidy.un.slice(0, cap(4))) {
          const row = el("div", "txr-row"), left = el("div", "txr-row-l"); left.appendChild(el("span", "txr-doc", this.shortOf(u.note))); row.appendChild(left);
          const right = el("div", "txr-row-r"), q = el("div", "txr-mine"); q.append(document.createTextNode(u.b || ""), el("mark", "txr-hit", u.hit), document.createTextNode(u.a || "")); right.appendChild(q);
          const acts = el("div", "txr-acts"), l1 = el("button", "txr-btn-o", T("Leagă", "Link")), l2 = el("a", null, T("Nu aici", "Not here")), l3 = el("a", null, T("Deschide", "Open"));
          act(l1, () => this.applyLinks([u])); act(l2, () => this.notHereAdd(u.note, u.target)); l3.addEventListener("click", e => { e.stopPropagation(); this.openAt(u.note, null); });
          acts.append(l1, l2, l3); right.appendChild(acts); row.appendChild(right); s.appendChild(row);
        }
      }
      if (tidy.al.length) {
        s.appendChild(el("div", "txr-tidy-h", T("Aliasuri pe care le-ai putea adăuga", "Aliases you could add")));
        const why = { link: T("din textul linkurilor tale", "from your link text"), spelling: T("o variantă pe care o scrii", "a spelling you use"), short: T("o formă scurtă pe care o folosești", "a short form you use"), wikidata: T("traducere din Wikidata", "a translation from Wikidata"), wikipedia: T("traducere din Wikipedia", "a translation from Wikipedia"), mymemory: T("traducere din MyMemory", "a translation from MyMemory") };
        const ch = el("div", "txr-chips");
        for (const a of tidy.al.slice(0, 8)) {
          const c = el("span", "txr-chip"), add = el("a", "txr-lk", "+ " + a.alias), x = el("a", "txr-x", "×");
          c.title = (a.why || []).map(k => why[k] || k).join("; "); x.title = T("Nu-l mai sugera", "Don't suggest it again");
          act(add, () => this.addAlias(f.path, a.alias)); act(x, () => this.ignoreAlias(f.path, a.alias)); c.append(add, x); ch.appendChild(c);
        }
        s.appendChild(ch);
      }
      for (const d of tidy.du) {
        const other = d.a === f.path ? d.b : d.a, row = el("div", "txr-tidy-dup");
        row.append(el("span", null, T(`Pare același concept ca ${this.termOf(other)}`, `Looks like the same concept as ${this.termOf(other)}`) + ((d.why || []).length ? ` (${d.why.slice(0, 2).join(", ")})` : "")));
        const acts = el("span", "txr-acts"), o = el("a", null, T("Deschide", "Open")), n = el("a", null, T("Nu e același", "Not the same"));
        o.addEventListener("click", e => { e.stopPropagation(); this.openAt(other, null); }); act(n, () => this.notDuplicate(d.a, d.b)); acts.append(o, n); row.appendChild(acts); s.appendChild(row);
      }
    }
    const hlRow = (parent, r) => {
      const h = r.h, info = this.litInfo(r.path), row = el("div", "txr-row is-click"); row.title = T("Deschide adnotarea", "Open the annotation");
      const left = el("div", "txr-row-l"); left.appendChild(tagB(h.tag)); row.appendChild(left);
      const right = el("div", "txr-row-r"); right.appendChild(el("div", "txr-q", shorten(h.t, 260)));
      const m = meta([info.label, h.p ? "p. " + h.p : ""]); m.appendChild(langB(h.lg || info.lang)); right.appendChild(m); row.appendChild(right);
      row.addEventListener("click", () => this.openAt(r.path, h.ln)); parent.appendChild(row);
    };
    // 2. definițiile din surse, apoi cum îl folosesc sursele
    const defs = E.hls.filter(r => r.h.tag === "definition"), uses = E.hls.filter(r => r.h.tag !== "definition" && r.h.tag !== "word");
    if (defs.length) { const s = sec(T("Definiții în referințele tale", "Definitions in your references"), String(defs.length)); defs.slice(0, cap(4)).forEach(r => hlRow(s, r)); }
    // ce spun referințele și notițele tale de sub adnotări: în harta dezbaterii (acolo, grupate și cu poziția ta); aici, doar un rând spre ea
    if (uses.length || E.notes.length) {
      const s = sec(T("În referințele tale", "In your references"), this.counts(new Set(uses.map(r => r.path)).size, uses.length));
      const row = el("div", "txr-row is-click"), right = el("div", "txr-row-r");
      right.appendChild(el("div", null, (E.notes.length ? T(`Și ${E.notes.length} ${E.notes.length === 1 ? "notiță de-a ta" : "notițe de-ale tale"} sub adnotări. `, `And ${E.notes.length} ${E.notes.length === 1 ? "note" : "notes"} of yours under annotations. `) : "") + T("Le vezi pe toate, grupate, în harta dezbaterii →", "See them all, grouped, in the debate map →")));
      row.appendChild(right); row.addEventListener("click", e => { e.stopPropagation(); this.openMap(f.path); }); s.appendChild(row);
    }
    // 4. scrisul tău
    if (E.own.length) {
      const own = E.own.slice().sort((a, b) => b.n - a.n), s = sec(T("În scrisul tău", "In your writing"), this.plural(own.length, "notă", "note", "note", "notes"));
      for (const o of own.slice(0, cap(5))) {
        const row = el("div", "txr-row is-click"), left = el("div", "txr-row-l"); left.appendChild(el("span", "txr-doc", this.shortOf(o.path))); row.appendChild(left);
        const right = el("div", "txr-row-r"); if (o.s) right.appendChild(el("div", "txr-mine", quote(o.s)));
        right.appendChild(meta([T(`${o.n} ${o.n === 1 ? "folosire" : "folosiri"}`, `${o.n} ${o.n === 1 ? "use" : "uses"}`), o.def ? T("definit acolo", "defined there") : ""]));
        row.appendChild(right); row.addEventListener("click", () => this.openAt(o.path, o.ln)); s.appendChild(row);
      }
    }
    // 5. conceptele cu care apare
    const co = Object.entries(E.co || {}).filter(([p]) => p !== f.path && this.app.vault.getAbstractFileByPath(p) && !AMBIG.has(X.fold(this.termOf(p)))).sort((a, b) => b[1] - a[1]).slice(0, 8);
    if (co.length) {
      const s = sec(T("Apare împreună cu", "Appears with"), T("paragrafe comune", "shared paragraphs")), ch = el("div", "txr-chips");
      for (const [p, n] of co) { const c = el("span", "txr-chip is-click"); c.append(el("span", "txr-lk", this.termOf(p)), el("i", null, String(n))); c.addEventListener("click", e => { e.stopPropagation(); this.openAt(p, null, false); }); ch.appendChild(c); }
      s.appendChild(ch);
    }
    const total = defs.length + E.own.length;
    if (!more && (defs.length > 4 || E.own.length > 5)) {
      const b = el("button", "txr-more", T(`Arată tot (${total})`, `Show all (${total})`)); b.addEventListener("click", e => { e.stopPropagation(); this._cpMore = Object.assign(this._cpMore || {}, { [f.path]: 1 }); this.cpSoon(0); }); body.appendChild(b);
    }
    return box;
  },
  plural(n, ro1, roN, en1, enN) { return `${n} ${this.en ? (n === 1 ? en1 : enN) : (n === 1 ? ro1 : roN)}`; },
  counts(src, hl) { return this.plural(src, "referință", "referințe", "reference", "references") + " · " + this.plural(hl, "adnotare", "adnotări", "annotation", "annotations"); },
  distilApi() { const S = this.core?.mod?.("sources"); const D = S?.sources?.distil || S?.distil; return D?.open ? D : null; },
  // ce e de pus în ordine pentru un concept: menționările fără link, aliasurile sugerate, notele care par același concept
  cpTidy(path) {
    const un = (this.visibleUnlinked?.() || []).filter(u => u.target === path), al = (this.aliasSugg || []).filter(a => a.target === path), du = (this.duplicates || []).filter(d => d.a === path || d.b === path);
    return { un, al, du, n: un.length + al.length + du.length };
  },
  mentions(text, conceptPath) { const idx = this.termIndex(); return X.matchAll(idx, text).some(m => m.g.paths.includes(conceptPath)); },

  // ════════ 2. Harta dezbaterii ════════
  mapInit() {
    this.registerView(MAP_VIEW, leaf => new MapView(leaf, this));
    this.registerEvent(this.app.workspace.on("texere:changed", () => { for (const l of this.app.workspace.getLeavesOfType(MAP_VIEW)) if (l.view?.at !== this.scanCache?.at) l.view?.render?.(); this.cmpSoon(500, true); }));
  },
  // harta dezbaterii (din panoul Insights, fila Linkuri): conceptul deschis acum sau unul ales
  debateMap() {
    const f = this.app.workspace.getActiveFile?.();
    if (f && this.isTarget(f.path)) return this.openMap(f.path);
    new ConceptPicker(this, p => this.openMap(p)).open();
  },
  async openMap(path) {
    const ex = this.app.workspace.getLeavesOfType(MAP_VIEW)[0], leaf = ex || this.app.workspace.getLeaf("tab");
    await leaf.setViewState({ type: MAP_VIEW, active: true, state: { concept: path } });
    this.app.workspace.revealLeaf(leaf);
    return leaf;
  },
  // cartea „cele mai dese nume”: un gânditor numit în cel puțin două evidențieri devine grup; altfel capitolul, apoi „altele”
  mapGroups(items, conceptPath) {
    const T = (a, b) => this.T(a, b), bad = new Set();
    for (const it of items) for (const a of (this.sourceMeta(it.info.id, it.path)?.author || [])) { const fam = X.fold(a.family || a.literal || ""); if (fam) bad.add(fam); }
    for (const t of this.termEntries().flatMap(e => e.terms)) bad.add(X.fold(t).split(/\s+/).pop());
    const keyOf = n => X.fold(n).split(/\s+/).pop();
    const names = items.map(it => [...new Set(Object.keys(this.nameCandidates(it.h.t, [])).map(n => ({ n, k: keyOf(n) })).filter(x => x.k.length >= 4 && !bad.has(x.k)).map(x => JSON.stringify(x)))].map(s => JSON.parse(s)));
    const cnt = new Map(), label = new Map();
    names.forEach(list => { for (const x of new Map(list.map(x => [x.k, x])).values()) { cnt.set(x.k, (cnt.get(x.k) || 0) + 1); const cur = label.get(x.k); if (!cur || x.n.length < cur.length) label.set(x.k, x.n); } });
    const groups = new Map(), add = (k, lab, it) => { const g = groups.get(k) || { key: k, label: lab, items: [] }; g.items.push(it); groups.set(k, g); };
    const rest = [];
    items.forEach((it, i) => {
      const best = names[i].filter(x => (cnt.get(x.k) || 0) >= 2).sort((a, b) => cnt.get(b.k) - cnt.get(a.k))[0];
      if (best) add("n:" + best.k, label.get(best.k), it); else rest.push(it);
    });
    const byHead = new Map(); for (const it of rest) { const h = it.h.h?.[it.h.h.length - 1] || ""; const l = byHead.get(h) || []; l.push(it); byHead.set(h, l); }
    const other = [];
    for (const [h, l] of byHead) { if (h && l.length >= 2) l.forEach(it => add("h:" + h, h.replace(/^(capitolul|chapter|cap\.)\s*\d+\s*[:.]\s*/i, ""), it)); else other.push(...l); }
    const out = [...groups.values()].sort((a, b) => b.items.length - a.items.length);
    if (other.length) out.push({ key: "other", label: T("Altele", "Other"), items: other });
    return out;
  },
  mapData(conceptPath) {
    const E = this.conceptEntry(conceptPath), seen = new Set(), items = [];
    for (const r of [...E.hls, ...E.heads]) {
      const k = r.path + "#" + r.i; if (seen.has(k) || r.h.tag === "word") continue; seen.add(k);
      items.push({ ...r, info: this.litInfo(r.path), stance: stanceOf(r.h.tag), direct: E.hls.includes(r) });
    }
    items.sort((a, b) => a.info.label.localeCompare(b.info.label) || a.h.ln - b.h.ln);
    return items;
  },
  // o notă nouă din dezacordurile tale: un titlu pentru fiecare, pasajul citat cu sursa, notițele tale și un loc pentru răspunsul tău
  async outlineFrom(conceptPath, items) {
    const T = (a, b) => this.T(a, b), name = this.termOf(conceptPath), dir = String(this.app.fileManager.getNewFileParent?.("")?.path || "").replace(/^\/$/, "").replace(/\/+$/, "");
    const kindOf = it => it.stance === "definition" ? "claim" : ["disagree", "agree", "question", "claim"].includes(it.stance) ? it.stance : "other";
    const KINDS = [["disagree", T("Unde nu sunt de acord", "Where I disagree"), T("Răspunsul meu: ", "My reply: ")], ["agree", T("Unde sunt de acord", "Where I agree"), T("De ce: ", "Why: ")],
      ["question", T("Întrebări", "Questions"), T("Răspunsul meu: ", "My answer: ")], ["claim", T("Afirmații și definiții", "Claims and definitions"), T("Ce cred eu: ", "What I think: ")], ["other", T("Altele", "Other"), T("Ce cred eu: ", "What I think: ")]];
    const used = KINDS.filter(([k]) => items.some(it => kindOf(it) === k)), one = used.length === 1;
    const base = (one && used[0][0] === "disagree" ? T(`${name} – unde nu sunt de acord`, `${name} – where I disagree`) : T(`${name} – din lecturile mele`, `${name} – from my reading`)).replace(/[\\/:*?"<>|#^[\]]/g, " ");
    let path = (dir ? dir + "/" : "") + base + ".md", k = 2; while (this.app.vault.getAbstractFileByPath(path)) path = (dir ? dir + "/" : "") + `${base} (${k++}).md`;
    if (dir && !this.app.vault.getAbstractFileByPath(dir)) await this.app.vault.createFolder(dir).catch(() => {});
    const cf = this.app.vault.getAbstractFileByPath(conceptPath), lk = cf ? this.app.metadataCache.fileToLinktext(cf, path, true) : name;
    const lines = ["---", `dateCreated: ${X.dayKey()}`, "type: essay", "status: draft", "---", `[[${lk}]]`, ""];
    // câte un titlu pe fel (când sunt mai multe), apoi fiecare pasaj: citatul cu citarea, notițele tale, loc pentru ce scrii tu
    for (const [k, label, prompt] of used) {
      if (!one) lines.push(`## ${label}`, "");
      for (const it of items.filter(x => kindOf(x) === k)) {
        const h = it.h, ttl = shorten(h.t.replace(/[„“"”«»]/g, ""), 70);
        lines.push(`${one ? "##" : "###"} ${ttl}`, "", `> ${h.t} ${h.id ? `[@${h.id}${h.p ? ", p. " + h.p : ""}]` : `(${it.info.label}${h.p ? ", p. " + h.p : ""})`}`, "");
        for (const n of h.n || []) lines.push(`- ${n}`);
        lines.push(`- ${prompt}`, "");
      }
    }
    const f = await this.app.vault.create(path, lines.join("\n"));
    await this.app.workspace.getLeaf("tab").openFile(f);
    return f;
  },
  // lucrările citate de mai multe surse din hartă (din datele de citare OpenAlex ale articolelor cu DOI) și care nu sunt în vault
  async citedTogether(items) {
    const dois = [...new Set(items.map(it => it.info.doi).filter(Boolean))], cache = (this.settings.refsCache = this.settings.refsCache || {});
    const out = { withData: 0, works: [], failed: false };
    if (!dois.length) return out;
    const now = Date.now(), want = dois.filter(d => !cache[d] || now - cache[d].at > 30 * 864e5);
    for (const d of want) {
      try { const r = await requestUrl({ url: `https://api.openalex.org/works/doi:${encodeURIComponent(d)}?select=id,referenced_works`, method: "GET" }); cache[d] = { at: now, refs: (r.json?.referenced_works || []).map(u => String(u).split("/").pop()) }; }
      catch (e) { if (!cache[d]) out.failed = true; }
    }
    const cnt = new Map();
    for (const d of dois) { const refs = cache[d]?.refs; if (!refs) continue; if (refs.length) out.withData++; for (const w of new Set(refs)) cnt.set(w, (cnt.get(w) || 0) + 1); }
    const top = [...cnt.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 25);
    if (top.length) {
      try {
        const r = await requestUrl({ url: `https://api.openalex.org/works?filter=openalex:${top.map(t => t[0]).join("|")}&select=id,doi,display_name,publication_year,authorships&per-page=50`, method: "GET" });
        const have = new Set(), haveT = new Set();
        for (const [p, e] of Object.entries(this.scanCache?.notes || {})) if (e.kind === "lit") { const i = this.litInfo(p); if (i.doi) have.add(i.doi.toLowerCase()); if (i.title) haveT.add(X.fold(i.title).replace(/[^a-z0-9]+/g, " ").trim()); }
        for (const w of r.json?.results || []) {
          const id = String(w.id).split("/").pop(), doi = String(w.doi || "").replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").toLowerCase(), tt = X.fold(w.display_name || "").replace(/[^a-z0-9]+/g, " ").trim();
          if ((doi && have.has(doi)) || (tt && haveT.has(tt))) continue;
          const au = (w.authorships || []).map(a => a.author?.display_name).filter(Boolean);
          out.works.push({ id, doi, title: w.display_name || "", year: w.publication_year || "", authors: au, n: cnt.get(id) || 0 });
        }
        out.works.sort((a, b) => b.n - a.n);
      } catch (e) { out.failed = true; }
    }
    await this.saveSettings();
    return out;
  },

  // ════════ 3. Însoțitorul scrisului ════════
  companionInit() {
    this.registerView(CMP_VIEW, leaf => new CompanionView(leaf, this));
    this.registerEvent(this.app.workspace.on("active-leaf-change", leaf => { if (leaf?.view instanceof MarkdownView) { this._cmpMd = leaf.view; this.cmpSoon(120, true); } }));
    this.registerEvent(this.app.workspace.on("editor-change", () => this.cmpSoon(900, true)));
    try {
      const { EditorView } = require("@codemirror/view");
      this.registerEditorExtension(EditorView.updateListener.of(u => { if (u.selectionSet && !u.docChanged) this.cmpSoon(250, false); }));
    } catch (e) {}
  },
  async openCompanion() {
    const W = this.app.workspace, ex = W.getLeavesOfType(CMP_VIEW)[0];
    if (ex) { W.revealLeaf(ex); return ex; }
    const leaf = W.getRightLeaf(false); await leaf.setViewState({ type: CMP_VIEW, active: true }); W.revealLeaf(leaf); return leaf;
  },
  cmpSoon(ms, full) { if (!this.app.workspace.getLeavesOfType(CMP_VIEW).length) return; this._cmpFull = this._cmpFull || full; clearTimeout(this._cmpT); this._cmpT = setTimeout(() => { const f = this._cmpFull; this._cmpFull = false; for (const l of this.app.workspace.getLeavesOfType(CMP_VIEW)) { try { l.view.update(f); } catch (e) { console.error("Texere · Insights: însoțitorul", e); } } }, ms); },
  // scheletul unei note: paragrafele de proză, rolul și propoziția-cheie a fiecăruia, ce lipsește
  companionData(text, path) {
    const T = (a, b) => this.T(a, b), idx = this.termIndex(), phil = this.voiceModeOf(path) === "phil";
    const r = V.analyse(text, { path, title: this.termOf(path), keyTerms: this.keyTerms?.() || new Set(), names: this.authorNames?.() || new Set() });
    const types = new Map(r.paraTypes.map(p => [p.line, p])), lab = V.TYPE_LABEL(T);
    const lines = text.split("\n"), refLine = lines.findIndex(l => /^#{1,6}\s+(?:\*\*)?(references|bibliography|bibliografie|works cited|referin[țţt]e|literatur[ăa]|sources|surse|note)(?:\*\*)?\s*$/i.test(l.trim()));
    const paras = paraRanges(text).filter(p => refLine < 0 || p.line < refLine).map(p => ({ ...p, clean: V.clean(p.raw) })).filter(p => V.words(p.clean).length >= 12);
    const which = line => paras.findIndex(p => line >= p.line && line <= p.end);
    const keyC = new Set(); for (const l of linksIn(text)) { const t = this.app.metadataCache.getFirstLinkpathDest(l, path); if (t && this.isTarget(t.path)) keyC.add(t.path); }
    lines.forEach((l, i) => { if (/^#{1,6}\s/.test(l) && (refLine < 0 || i < refLine)) for (const m of X.matchAll(idx, l)) m.g.paths.forEach(c => keyC.add(c)); });
    const out = paras.map((p, i) => {
      const pt = types.get(p.line), sents = V.sentences(p.clean), hits = (pt?.hit || "").split(",").map(s => X.fold(s.trim())).filter(Boolean);
      const key = (hits.length && sents.find(s => hits.some(h => X.fold(s).includes(h)))) || sents[0] || p.clean;
      const F = flat(p.raw), cs = new Set(); for (const m of X.matchAll(idx, F, X.skipRanges(F))) { const w = X.fold(F.slice(m.from, m.to)); if (!/\s/.test(w) && AMBIG.has(w.replace(/(ul|ului|a|ii|ile|s)$/, ''))) continue; m.g.paths.forEach(x => cs.add(x)); }
      for (const l of linksIn(p.raw)) { const t = this.app.metadataCache.getFirstLinkpathDest(l, path); if (t && this.isTarget(t.path)) cs.add(t.path); }
      cs.delete(path);
      return { i, line: p.line, end: p.end, raw: p.raw, clean: p.clean, n: V.words(p.clean).length, type: pt?.type || "none", role: pt && pt.type !== "none" ? lab[pt.type] : T("Fără un rol clar", "No clear role"), key: shorten(key, 120), lang: V.langOf(p.clean), concepts: [...cs], flags: [] };
    });
    // ce lipsește, pe paragraf
    for (const p of out) {
      const f = X.fold(V.clean(p.raw)), lang = p.lang, rx = RESEARCH[lang] || RESEARCH.en;
      const litLink = linksIn(p.raw).some(l => { const t = this.app.metadataCache.getFirstLinkpathDest(l, path); return t && this.isLit(t.path); });
      const rm = rx.exec(f) || (lang === "ro" ? RESEARCH.en.exec(f) : RESEARCH.ro.exec(f));
      if (rm && !HAS_CITE.test(p.raw) && !litLink) { p.flags.push({ k: "research", msg: T("Invocă cercetări, fără nicio citare", "Mentions research, cites none") }); p.research = V.sentences(p.clean).find(s => (rx.exec(X.fold(s)) || RESEARCH.en.exec(X.fold(s)) || RESEARCH.ro.exec(X.fold(s)))) || p.clean; }
      const tail = p.raw.replace(/\s+$/, ""), pl = p.raw.split("\n"), verse = pl.length >= 3 && pl.reduce((a, l) => a + l.length, 0) / pl.length < 60;
      const keywords = /^\s*(?:\*\*|__)?(key ?words|cuvinte[- ]cheie|tags|etichete)\b/i.test(p.raw);
      if (p.i === out.length - 1 && p.n >= 15 && !verse && !keywords && /[\p{L}\p{N},]$/u.test(tail) && !/\[\[[^\]]*\]\]$|https?:\/\/\S+$|(^|\s)#[\p{L}\p{N}_\/-]+$|\^[\w-]+$/u.test(tail)) p.flags.push({ k: "unfinished", msg: T("Se oprește la jumătatea propoziției", "Stops mid-sentence") });
    }
    const TURN = /^["„“«(]?(however|but|yet|nevertheless|nonetheless|still|on the contrary|in fact|this (?:objection|argument|view|claim) (?:fails|ignores|overlooks|misses)|totusi|dar|insa|cu toate acestea|numai ca|in realitate|aceasta obiectie)\b/;
    const turns = (k, otext) => { const ss = V.sentences(out[k].clean), key = X.fold(otext.replace(/„…”/g, " ")).replace(/\s+/g, " ").trim().split(" ").slice(0, 4).join(" "), at = ss.findIndex(x => X.fold(x).replace(/\s+/g, " ").includes(key)); const after = (at >= 0 ? ss.slice(at + 1) : []).concat(out[k + 1] ? V.sentences(out[k + 1].clean).slice(0, 1) : []); return after.some(x => TURN.test(X.fold(x))); };
    const MENTION = new Set(["an objection", "this objection", "the objection that", "a counterargument", "counter-argument", "counterargument", "o obiectie", "aceasta obiectie", "obiectia ca", "un contraargument", "contraargumentul"]);
    for (const o of r.objection) { const k = which(o.line); if (k < 0) continue; if (!V.markers(o.text.replace(/„…”/g, " "), out[k].lang).objection.some(x => !MENTION.has(x))) continue; const answered = r.replies.some(x => { const j = which(x.line); return j === k || j === k + 1; }) || turns(k, o.text); if (!answered && !out[k].flags.some(f => f.k === "objection")) out[k].flags.push({ k: "objection", msg: T("O obiecție fără răspuns încă", "Objection with no reply yet") }); }
    const defined = new Set(), defAt = []; for (const d of r.defs) { const fd = X.fold(d.text); for (const m of X.matchAll(idx, d.text)) if (defNear(fd, [d.hit], m)) m.g.paths.forEach(c => { defined.add(c); defAt.push({ c, line: d.line }); }); }
    // formulările mai largi („X encompasses…”, „X, defined as…”) spun doar că termenul e definit (nu-ți mai propunem definiția);
    // „folosit înainte de definiție” vine numai din definițiile explicite de mai sus
    for (const p of out) { const fp = X.fold(V.clean(p.raw)); for (const m of X.matchAll(idx, V.clean(p.raw))) if (DEF_AFTER.test(fp.slice(m.to))) m.g.paths.forEach(c => defined.add(c)); }
    // un termen folosit înainte de definiția lui
    for (const d of defAt) {
      const k = which(d.line); if (k < 1) continue;
      if (!keyC.has(d.c)) continue;   // doar termenii-cheie ai notei (cu link sau în titluri): „being”, „reason” sunt și cuvinte obișnuite
      const j = out.findIndex((p, x) => x < k && p.concepts.includes(d.c)); if (j < 2) continue;
      if (!out[j].flags.some(f => f.k === "before" && f.c === d.c)) out[j].flags.push({ k: "before", c: d.c, msg: T(`Folosește „${this.termOf(d.c)}” înainte să-l definească (¶${k + 1})`, `Uses “${this.termOf(d.c)}” before defining it (¶${k + 1})`) });
    }
    const top = [];
    if (phil && out.length >= 2) {
      if (!r.thesis.length) top.push({ k: "thesis", msg: T("Nicio propoziție nu spune încă ce susții („Susțin că…”, „Voi arăta că…”).", "No sentence says what you argue yet (“I argue that…”, “I will show…”).") });
      else if (!r.thesisEarly) { const k = which(r.thesis[0].line); top.push({ k: "late", msg: T(`Teza apare abia în ¶${k + 1}; ghidurile o vor la început.`, `Your thesis first appears in ¶${k + 1}; the guides want it in the opening.`) }); }
    }
    return { paras: out, top, phil, words: r.own, defined: [...defined] };
  },
  // ce ai în vault pentru un paragraf: definițiile conceptelor lui și evidențierile din surse despre ele
  async forParagraph(p, path) {
    const out = { defs: [], hls: [], search: null };
    for (const c of p.concepts.slice(0, 3)) { const d = await this.conceptDef(c); if (d) out.defs.push({ c, term: this.termOf(c), def: d, lang: V.langOf(d) }); }
    const seen = new Set(), cand = [];
    for (const c of p.concepts) for (const r of this.conceptEntry(c).hls) { const k = r.path + "#" + r.i; if (seen.has(k) || r.h.tag === "word") continue; seen.add(k); cand.push({ ...r, c, info: this.litInfo(r.path) }); }
    const cited = new Set((p.raw.match(/@([^\],;\s]+)/g) || []).map(s => s.slice(1)));
    cand.sort((a, b) => (TAG_RANK[a.h.tag] ?? 4) - (TAG_RANK[b.h.tag] ?? 4) || (b.h.lg === p.lang) - (a.h.lg === p.lang) || (cited.has(b.info.id) - cited.has(a.info.id)));
    out.hls = cand.slice(0, 4);
    if (p.research) { const ws = V.words(p.research).filter(w => w.length >= 5 && !X.STOP.has(X.fold(w)) && !/^(research|studies|study|confirm|cercet|studii|studiu|which|there|these|those|acest|aceste)/i.test(X.fold(w))); out.search = [...new Set(ws.map(w => w.toLowerCase()))].slice(0, 6).join(" "); }
    return out;
  },
};

// ——— alegerea unui concept (pentru hartă) ———
class ConceptPicker extends FuzzySuggestModal {
  constructor(P, onPick) { super(P.app); this.P = P; this.onPick = onPick; this.setPlaceholder(P.T("Un concept…", "A concept…")); }
  getItems() { const by = this.P.researchIndex().by; return this.P.termEntries().map(e => ({ path: e.path, name: this.P.termOf(e.path), n: (by.get(e.path)?.hls.length || 0) + (by.get(e.path)?.heads.length || 0) })).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name)); }
  getItemText(it) { return it.n ? `${it.name}  (${it.n})` : it.name; }
  onChooseItem(it) { this.onPick(it.path); }
}

// ——— pagina hărții ———
class MapView extends ItemView {
  constructor(leaf, P) { super(leaf); this.P = P; this.concept = null; this.filter = "all"; this.outline = false; this.refs = null; }
  getViewType() { return MAP_VIEW; }
  getDisplayText() { return this.concept ? this.P.T("Harta · ", "Map · ") + this.P.termOf(this.concept) : this.P.T("Harta dezbaterii", "Debate map"); }
  getIcon() { return "map"; }
  getState() { return { concept: this.concept }; }
  async setState(st, res) { if (st?.concept && st.concept !== this.concept) { this.concept = st.concept; this.sel = new Set(); this.refs = null; } await this.render(); try { this.leaf.updateHeader?.(); } catch (e) {} return super.setState?.(st, res); }
  async onOpen() { this.contentEl.addClass("txr-view"); await this.render(); }
  async render() {
    const P = this.P, T = (a, b) => P.T(a, b), c = this.contentEl; c.empty(); this.at = P.scanCache?.at;
    const w = c.createDiv("txr-map");
    if (!this.concept) { w.createEl("p", { cls: "txr-empty", text: T("Alege un concept: Insights → Lectura → Harta dezbaterii…, sau butonul din panoul unei note-concept.", "Pick a concept: Insights → Reading → Debate map…, or the button in a concept note's panel.") }); return; }
    const name = P.termOf(this.concept), items = P.mapData(this.concept), info = new Set(items.map(it => it.path));
    // același cap ca pagina Insights: titlul și subtitlul în stânga, butoanele în dreapta
    const ph = w.createDiv("txi-head txr-phead"), pt = ph.createDiv("txi-head-t");
    pt.createDiv({ cls: "txi-title", text: name });
    const langs = new Set(items.map(it => it.h.lg || it.info.lang));
    pt.createDiv({ cls: "txi-head-sub", text: T("Harta dezbaterii · ", "Debate map · ") + P.counts(info.size, items.length) + (langs.size > 1 ? T(" · 2 limbi", " · 2 languages") : "") });
    const pa = ph.createDiv("txi-sub"); pa.createEl("button", { text: T("Deschide nota", "Open the note") }).addEventListener("click", () => P.openAt(this.concept, null, false));
    const head = w.createDiv("txr-map-h");
    const co = Object.entries(P.conceptEntry(this.concept).co || {}).filter(([p]) => p !== this.concept && P.app.vault.getAbstractFileByPath(p) && !AMBIG.has(X.fold(P.termOf(p)))).sort((a, b) => b[1] - a[1]).slice(0, 6);
    if (co.length) { const r = head.createDiv("txr-chips"); r.createSpan({ cls: "txr-chips-l", text: T("Hărți apropiate:", "Nearby maps:") }); for (const [p] of co) { const x = r.createSpan({ cls: "txr-chip is-click" }); x.createSpan({ cls: "txr-lk", text: P.termOf(p) }); x.addEventListener("click", () => { this.concept = p; this.sel = new Set(); this.refs = null; this.render(); try { this.leaf.updateHeader?.(); } catch (e) {} }); } }
    if (!items.length) { w.createEl("p", { cls: "txr-empty", text: T(`Încă nicio adnotare despre ${name}.`, `No annotations on ${name} yet.`) }); return; }
    // filtrele
    // filtrele: mai multe deodată (ex. „Nu ești de acord” + „Afirmații”); „Toate” le șterge. Ce se vede e și din ce pornește nota.
    const sel = this.sel instanceof Set ? this.sel : (this.sel = new Set());
    const inK = (it, k) => it.stance === k || (k === "claim" && it.stance === "definition");
    const n = k => items.filter(it => k === "all" || inK(it, k)).length;
    const fl = w.createDiv("txr-filters");
    for (const [k, l] of [["all", T("Toate", "All")], ["disagree", T("Nu ești de acord", "You disagree")], ["agree", T("Ești de acord", "You agree")], ["question", T("Întrebări", "Questions")], ["claim", T("Afirmații și definiții", "Claims and definitions")]]) {
      const cnt = n(k); if (!cnt && k !== "all") continue;
      const on = k === "all" ? !sel.size : sel.has(k);
      const b = fl.createEl("button", { cls: "txr-fbtn" + (on ? " is-on" : "") }); b.createSpan({ text: l }); b.createEl("i", { text: String(cnt) });
      b.addEventListener("click", () => { if (k === "all") sel.clear(); else if (sel.has(k)) sel.delete(k); else sel.add(k); this.render(); });
    }
    const shown = items.filter(it => !sel.size || [...sel].some(k => inK(it, k)));
    // o notă din ce se vede: toate (fără filtru) sau ce ai ales; sus ce intră, pe feluri, butonul în dreapta
    {
      const cl = w.createDiv("txr-callout"), t = cl.createDiv();
      const KN = { disagree: [T("dezacord", "disagreement"), T("dezacorduri", "disagreements")], agree: [T("acord", "agreement"), T("acorduri", "agreements")], question: [T("întrebare", "question"), T("întrebări", "questions")], claim: [T("afirmație sau definiție", "claim or definition"), T("afirmații și definiții", "claims and definitions")] };
      const keys = sel.size ? [...sel] : Object.keys(KN);
      const parts = keys.map(k => { const c = shown.filter(it => inK(it, k)).length; return c ? `${c} ${KN[k][c === 1 ? 0 : 1]}` : null; }).filter(Boolean);
      const rest = shown.filter(it => !Object.keys(KN).some(k => inK(it, k))).length; if (rest) parts.push(T(`${rest} altele`, `${rest} other`));
      t.createEl("b", { text: parts.join(" · ") + ". " });
      t.createSpan({ text: sel.size ? T("Fiecare intră cu citarea și notițele tale de dedesubt, grupate pe feluri.", "Each goes in with its citation and the notes you wrote under it, grouped by kind.")
        : T("Toate intră în notă, grupate pe feluri; ca să iei doar unele, alege filtrele de sus (mai multe deodată).", "All go into the note, grouped by kind; to take only some, pick filters above (several at once).") });
      const b = cl.createEl("button", { cls: "mod-cta", text: sel.size ? T(`Începe o notă din ${shown.length === 1 ? "ea" : `cele ${shown.length}`}`, `Start a note from ${shown.length === 1 ? "it" : `these ${shown.length}`}`) : T(`Începe o notă din toate ${shown.length}`, `Start a note from all ${shown.length}`) });
      b.title = T("O notă nouă: câte un titlu pe fel (dezacorduri, acorduri…), apoi fiecare pasaj cu citarea, notițele tale și loc pentru ce scrii tu", "A new note: one heading per kind (disagreements, agreements…), then each passage with its citation, your notes and room for your own text");
      b.addEventListener("click", async () => { b.disabled = true; try { await P.outlineFrom(this.concept, shown); } catch (e) { new Notice(T("N-am putut crea nota: ", "Couldn't create the note: ") + (e?.message || e)); } b.disabled = false; });
    }
    // evidențierile sub care n-ai scris încă nimic: Distilează (Texere · Sources), apoi harta se reface cu notițele tale
    // doar cele pe care Distilează le poate lua (o evidențiere din PDF, fără nimic dedesubt, după cum citește el nota); se află o dată, apoi harta se redesenează
    const D = P.distilApi(), key = this.concept + "|" + (P.scanCache?.at || 0);
    if (D?.queue && this.dOk?.key !== key && this._dAsk !== key) {
      this._dAsk = key; const cand = items.filter(it => !(it.h.n || []).length);
      D.queue(null, cand.map(it => ({ path: it.path, ln: it.h.ln }))).then(q => { this.dOk = { key, set: new Set(cand.filter(it => q.some(x => x.note?.path === it.path && it.h.ln >= x.s && it.h.ln <= x.e)).map(it => it.path + "#" + it.h.ln)) }; this.render(); }).catch(e => { console.error(e); this.dOk = { key, set: new Set() }; });
    }
    const okD = it => !!D?.queue && this.dOk?.key === key && this.dOk.set.has(it.path + "#" + it.h.ln);
    this.okD = okD;
    const bare = items.filter(okD);
    if (bare.length) {
      const cl = w.createDiv("txr-callout is-soft"), t = cl.createDiv();
      t.createEl("b", { text: P.plural(bare.length, "adnotare", "adnotări", "annotation", "annotations") + T(" fără nimic de-al tău dedesubt.", " with nothing of yours under them.") });
      t.createSpan({ text: " " + T("Câte o propoziție cu cuvintele tale, și apar aici ca notițe.", "One sentence each in your own words, and they show up here as notes.") });
      const b = cl.createEl("button", { text: T("Distilează-le", "Distil them") }); b.addEventListener("click", () => this.distil(bare));
    }
    // grupurile
    for (const g of P.mapGroups(shown, this.concept)) {
      const gs = w.createDiv("txr-group"), gh = gs.createDiv("txr-group-h"); gh.createSpan({ text: g.label }); gh.createSpan({ cls: "txr-faint", text: ` · ${g.items.length}` + (new Set(g.items.map(x => x.path)).size > 1 ? " · " + P.plural(new Set(g.items.map(x => x.path)).size, "referință", "referințe", "reference", "references") : "") });
      const cards = gs.createDiv("txr-cards");
      for (const it of g.items) this.card(cards, it);
    }
    // lucrările citate de mai multe surse
    const ref = w.createDiv("txr-refs"), rh = ref.createDiv("txr-sec-h"); rh.createEl("b", { text: T("Citate de mai multe referințe de aici, dar nu în vault", "Cited by several references here, not in your vault") });
    const rb = ref.createDiv();
    const dois = new Set(items.map(it => it.info.doi).filter(Boolean)).size;
    if (dois < 2) { rb.createDiv({ cls: "txr-faint", text: T("Lucrările citate de amândouă apar când cel puțin două referințe au DOI.", "Works they both cite show up once at least two references have a DOI.") }); }
    else if (!this.refs) { rb.createDiv({ cls: "txr-faint", text: T("Se citesc listele de referințe…", "Reading the reference lists…") }); P.citedTogether(items).then(r => { this.refs = r; this.render(); }).catch(() => { this.refs = { works: [], withData: 0, failed: true }; this.render(); }); }
    else if (!this.refs.works.length) rb.createDiv({ cls: "txr-faint", text: this.refs.failed ? T("N-am putut citi datele de citare acum (fără internet?).", "Couldn't read the citation data right now (offline?).") : T("Nicio lucrare citată de cel puțin două dintre ele, în afara celor din vault.", "No work cited by at least two of them that isn't already in your vault.") });
    else for (const wk of this.refs.works.slice(0, 8)) {
      const row = rb.createDiv("txr-row"), l = row.createDiv("txr-row-r");
      const t = l.createDiv(); t.createEl("b", { text: (wk.authors[0] || "").split(" ").pop() + (wk.authors.length > 1 ? " et al." : "") }); t.appendText(` · ${wk.title}${wk.year ? ` (${wk.year})` : ""}`);
      l.createDiv({ cls: "txr-meta", text: T(`citată de ${wk.n} dintre referințele de aici`, `cited by ${wk.n} of the references here`) });
      const b = row.createEl("button", { cls: "txr-btn-o", text: T("Adaugă ca referință", "Add as reference") });
      b.addEventListener("click", () => { const S = P.core?.mod?.("sources")?.sources; if (S?.open) S.open(wk.doi || wk.title); else new Notice(T("Pornește Texere · Referințe ca să adaugi referința.", "Turn on Texere · References to add the reference.")); });
    }
  }
  card(parent, it) {
    const P = this.P, T = (a, b) => P.T(a, b), h = it.h, c = parent.createDiv("txr-card is-" + it.stance);
    const top = c.createDiv("txr-card-top"); top.createSpan({ cls: "txr-tag is-" + it.stance, text: "#" + h.tag });
    if (!it.direct) top.createSpan({ cls: "txr-faint", text: T("din capitol", "from the chapter") }).title = T("Nu numește conceptul, dar stă într-un capitol despre el", "It doesn't name the concept, but it sits in a chapter about it");
    const q = c.createDiv({ cls: "txr-q", text: shorten(h.t, 420) }); if (h.t.length > 420) { q.addClass("is-click"); q.title = T("Arată tot", "Show all"); q.addEventListener("click", () => { q.setText(h.t); q.removeClass("is-click"); }); }
    const m = c.createDiv("txr-meta"); m.appendText([it.info.label, h.p ? "p. " + h.p : ""].filter(Boolean).join(" · ")); m.createSpan({ cls: "txr-lang", text: (h.lg || it.info.lang || "").toUpperCase() });
    if (h.n?.length) { const nt = c.createDiv("txr-note"); nt.createEl("small", { text: T("Notița ta", "Your note") }); for (const x of h.n.slice(0, 4)) nt.createEl("p", { text: x }); }
    if (it.stance === "disagree" || it.stance === "question") {
      const wh = P.citedWhere(it.info.id, h.p), st = c.createDiv("txr-st" + (wh ? " is-done" : ""));
      st.setText(wh ? (wh.exact ? T(`Citat în ${P.shortOf(wh.path)}`, `Cited in ${P.shortOf(wh.path)}`) : T(`Referința e citată în ${P.shortOf(wh.path)}`, `The reference is cited in ${P.shortOf(wh.path)}`)) : T("Încă nu e în scrisul tău", "Not in your writing yet"));
      if (wh) { st.addClass("is-click"); st.addEventListener("click", () => P.openAt(wh.path, null)); }
    }
    const go = c.createDiv("txr-card-go"); const a = go.createEl("a", { text: T("Deschide în referință", "Open in the reference") }); a.addEventListener("click", () => P.openAt(it.path, h.ln));
    if (this.okD?.(it)) { go.appendText(" · "); const d = go.createEl("a", { text: T("Scrie notița ta", "Write your note") }); d.addEventListener("click", () => this.distil([it])); }
  }
  distil(list) {
    const P = this.P, D = P.distilApi(); if (!D) return;
    D.open({ pick: list.map(it => ({ path: it.path, ln: it.h.ln })), onDone: async wrote => { if (!wrote) return; try { await P.scan(false, true); } catch (e) {} this.render(); } });
  }
}

// ——— panoul lateral: însoțitorul scrisului ———
class CompanionView extends ItemView {
  constructor(leaf, P) { super(leaf); this.P = P; this.sel = null; this.data = null; this.path = null; }
  getViewType() { return CMP_VIEW; }
  getDisplayText() { return this.P.T("Însoțitorul scrisului", "Writing companion"); }
  getIcon() { return "pen-line"; }
  async onOpen() { this.contentEl.addClass("txr-view", "txr-cmp-view"); this.update(true); }
  md() {
    const P = this.P, W = P.app.workspace; let v = P._cmpMd;
    if (!v || !v.file || !v.leaf || !document.body.contains(v.containerEl)) { v = null; W.iterateAllLeaves?.(l => { if (!v && l.view instanceof MarkdownView && l.view.file) v = l.view; }); P._cmpMd = v; }
    return v;
  }
  async update(full) {
    const P = this.P, T = (a, b) => P.T(a, b), v = this.md(), c = this.contentEl;
    if (!v || !v.file || !P.voicePathOk(v.file.path)) { c.empty(); const w = c.createDiv("txr-cmp"); w.createDiv({ cls: "txr-cmp-h", text: T("Însoțitorul scrisului", "Writing companion") }); w.createEl("p", { cls: "txr-empty", text: v?.file ? T("Nota deschisă nu e scrisul tău (o referință, un concept, un șablon). Deschide un eseu, un capitol sau o ciornă.", "The open note isn't your writing (a reference, a concept, a template). Open an essay, a chapter or a draft.") : T("Deschide o notă pe care o scrii: aici vezi scheletul argumentului și ce ai în vault pentru paragraful în care ești.", "Open a note you're writing: here you'll see the skeleton of your argument and what your vault has for the paragraph you're in.") }); this.path = null; return; }
    const text = v.editor?.getValue?.() ?? (await P.app.vault.cachedRead(v.file));
    let redraw = false;
    if (full || this.path !== v.file.path || !this.data) { this.data = P.companionData(text, v.file.path); if (this.path !== v.file.path) this.sel = null; this.path = v.file.path; this.drawAll(v, text); redraw = true; }
    // paragraful în care e cursorul
    const ln = v.editor?.getCursor?.()?.line, k = ln != null ? this.data.paras.findIndex(p => ln >= p.line && ln <= p.end) : -1;
    if (k >= 0 && k !== this.sel) { this.sel = k; redraw = true; }
    else if (this.sel == null || this.sel >= this.data.paras.length) { const first = this.data.paras.findIndex(p => p.flags.length); this.sel = first >= 0 ? first : (this.data.paras.length ? 0 : null); redraw = true; }
    if (redraw) { this.mark(); await this.drawFor(v); }
  }
  drawAll(v, text) {
    const P = this.P, T = (a, b) => P.T(a, b), d = this.data, c = this.contentEl; c.empty();
    const w = c.createDiv("txr-cmp"), head = w.createDiv("txr-cmp-h"); beta(head.createSpan({ text: T("Însoțitorul scrisului", "Writing companion") }));
    head.createSpan({ cls: "txr-faint", text: P.plural(d.paras.length, "paragraf", "paragrafe", "paragraph", "paragraphs") + " · " + P.plural(d.words, "cuvânt", "cuvinte", "word", "words") });
    w.createDiv({ cls: "txr-cmp-file", text: v.file.basename });
    // felul textului: un eseu filosofic are și verificările argumentului (teza, obiecțiile, termenii folosiți imprecis)
    const modes = w.createDiv("txr-modes");
    for (const [k, l] of [["phil", T("Eseu filosofic", "Philosophical essay")], ["gen", T("Text general", "General text")]]) {
      const b = modes.createEl("button", { cls: "txr-mode" + ((d.phil ? "phil" : "gen") === k ? " is-on" : ""), text: l });
      b.addEventListener("click", async () => { const vm = (P.settings.voiceMode = P.settings.voiceMode || {}); vm[v.file.path] = k; P.settings.voiceModeLast = k; await P.saveSettings(); P.wsSoon?.(0); this.update(true); });
    }
    // sus: verificarea întregii ciorne (fostul „Verifică ciorna”), restrânsă până o deschizi; dedesubt, fiecare paragraf
    const dr = w.createDiv("txr-sec txr-draft"), dh = dr.createDiv("txr-sec-h is-click"), dl = dh.createEl("b");
    const dc = dl.createSpan("txr-chev"); try { setIcon(dc, "chevron-down"); } catch (e) {} dl.appendText(" " + T("Verifică ciorna", "Check this draft"));
    if (P._vsFor === v.file.path && P._vsText) dh.createSpan({ text: P._vsText });
    const db = dr.createDiv("txr-draft-b"), dst = { open_: null };
    const fillD = async () => { try { await P.drawDraft(v.file, db, { jump: it => P.jumpTo(v.file.path, it.line), redraw: fillD, state: dst }); } catch (e) { console.error("Texere: verificarea ciornei", e); } };
    dr.classList.toggle("is-open", P.settings.cmpDraft === true); if (P.settings.cmpDraft === true) fillD();
    dh.addEventListener("click", async () => { P.settings.cmpDraft = P.settings.cmpDraft !== true; await P.saveSettings(); dr.classList.toggle("is-open", P.settings.cmpDraft); if (P.settings.cmpDraft && !db.childElementCount) fillD(); });
    this.draftEl = dr;
    const sk = w.createDiv("txr-sec"), sh = sk.createDiv("txr-sec-h"); sh.createEl("b", { text: T("Scheletul", "Skeleton") }); sh.createSpan({ text: T("un rând pe paragraf", "one line per paragraph") });
    if (!d.paras.length) sk.createDiv({ cls: "txr-empty", text: T("Încă niciun paragraf de proză (măcar 12 cuvinte). Listele și titlurile nu se numără.", "No prose paragraph yet (at least 12 words). Lists and headings don't count.") });
    for (const f of d.top) { const r = sk.createDiv("txr-flagrow"); const ic = r.createSpan("txr-ic txr-flag"); try { setIcon(ic, "flag"); } catch (e) {} r.createSpan({ text: f.msg }); }
    const ol = sk.createEl("ol", { cls: "txr-skel" }); this.rows = [];
    d.paras.forEach((p, i) => {
      const li = ol.createEl("li"), b = li.createEl("button", { cls: "txr-sk is-" + p.type }); this.rows.push(b);
      b.createSpan({ cls: "txr-pn", text: "¶" + (i + 1) }); const r = b.createSpan("txr-skr");
      r.createSpan({ cls: "txr-role", text: p.role }); r.createSpan({ cls: "txr-key", text: p.key });
      for (const f of p.flags) { const fl = r.createSpan("txr-fl"); const ic = fl.createSpan("txr-ic"); try { setIcon(ic, "flag"); } catch (e) {} fl.appendText(f.msg); }
      b.addEventListener("click", () => { this.sel = i; this.mark(); this.drawFor(v); this.jump(v, p); });
    });
    this.forEl = w.createDiv("txr-sec txr-for");
  }
  mark() { (this.rows || []).forEach((b, i) => b.classList.toggle("is-sel", i === this.sel)); }
  showDraft() { try { this.draftEl?.scrollIntoView({ block: "start" }); } catch (e) {} }
  jump(v, p) { try { v.editor.setCursor({ line: p.line, ch: 0 }); v.editor.scrollIntoView({ from: { line: p.line, ch: 0 }, to: { line: p.end, ch: 0 } }, true); v.leaf && this.P.app.workspace.setActiveLeaf?.(v.leaf, { focus: true }); } catch (e) {} }
  async drawFor(v) {
    const P = this.P, T = (a, b) => P.T(a, b), el = this.forEl; if (!el) return; el.empty();
    const p = this.data?.paras?.[this.sel]; const h = el.createDiv("txr-sec-h"); h.createEl("b", { text: p ? T(`Pentru ¶${this.sel + 1}, din vault-ul tău`, `For ¶${this.sel + 1}, from your vault`) : T("Din vault-ul tău", "From your vault") });
    if (!p) return;
    const tok = (this._tok = (this._tok || 0) + 1), r = await P.forParagraph(p, v.file.path); if (tok !== this._tok) return;
    let any = false;
    for (const d of r.defs) {
      any = true; const s = el.createDiv("txr-sug"), t = s.createDiv("txr-sug-t"); t.createSpan({ cls: "txr-lk", text: d.term }); t.createSpan({ cls: "txr-tag is-definition", text: T("nota-concept", "concept note") });
      s.createDiv({ cls: "txr-q", text: d.def }); s.createDiv({ cls: "txr-why", text: T(`De ce: ${d.term} apare în acest paragraf.`, `Why: ${d.term} appears in this paragraph.`) });
      const a = s.createDiv("txr-acts");
      if (d.lang === p.lang && !(this.data.defined || []).includes(d.c)) { const b = a.createEl("button", { cls: "mod-cta", text: T("Pune-o ca definiție", "Insert as a definition") }); b.addEventListener("click", () => this.insertDef(v, p, d, b)); }
      const o = a.createEl("button", { cls: "txr-btn-o", text: T("Deschide nota", "Open the note") }); o.addEventListener("click", () => P.openAt(d.c, null, true));
    }
    for (const x of r.hls) {
      any = true; const s = el.createDiv("txr-sug"), t = s.createDiv("txr-sug-t"); t.createSpan({ cls: "txr-tag is-" + stanceOf(x.h.tag), text: "#" + x.h.tag }); t.appendText(` ${x.info.label}${x.h.p ? ", p. " + x.h.p : ""}`);
      s.createDiv({ cls: "txr-q", text: shorten(x.h.t, 240) });
      if (x.h.n?.[0]) s.createDiv({ cls: "txr-mine", text: T("Notița ta: ", "Your note: ") + shorten(x.h.n[0], 160) });
      s.createDiv({ cls: "txr-why", text: T(`De ce: e despre ${P.termOf(x.c)}.`, `Why: it is about ${P.termOf(x.c)}.`) });
      const a = s.createDiv("txr-acts");
      if (x.h.id) {
        const cite = ` [@${x.h.id}${x.h.p ? ", p. " + x.h.p : ""}]`;
        const b1 = a.createEl("button", { cls: "txr-btn-o", text: T("Pune citarea", "Insert citation") }); b1.addEventListener("click", () => this.insertAt(v, p, cite, b1));
        if (x.h.t.length <= 320) { const q = p.lang === "ro" ? `„${x.h.t}”` : `“${x.h.t}”`; const b2 = a.createEl("button", { cls: "txr-btn-o", text: T("Pune citatul", "Insert quote") }); b2.addEventListener("click", () => this.insertAt(v, p, " " + q + cite, b2)); }
      }
      const o = a.createEl("a", { text: T("Deschide", "Open") }); o.addEventListener("click", () => P.openAt(x.path, x.h.ln));
    }
    // o sursă pe care ai putea-o cita: paragraful numește autorul ei (sau pe cineva despre care vorbesc evidențierile ei) și n-are nicio citare
    if (!HAS_CITE.test(p.raw) && P.suggestCitations) {
      const names = Object.keys(P.nameCandidates?.(p.raw, X.skipRanges(p.raw)) || {});
      if (CLAIM_RX.test(p.clean) || names.length) {
        const why = { author: T("îi numești autorul", "you name its author"), concepts: T("are concepte comune cu paragraful", "it shares concepts with this paragraph"), words: T("are cuvinte comune cu adnotările ei", "it shares words with its annotations") };
        for (const sg of P.suggestCitations({ names, concepts: p.concepts }, p.clean, 2).filter(x => !r.hls.some(y => y.info.id === x.id))) {
          any = true; const s = el.createDiv("txr-sug"); s.createDiv({ cls: "txr-sug-t", text: T("O referință pe care ai putea-o cita: ", "A reference you could cite: ") + sg.label });
          s.createDiv({ cls: "txr-why", text: T("De ce: ", "Why: ") + sg.why.map(k => k === "discusses" ? T(`adnotările ei vorbesc despre ${sg.who}, pe care îl numești`, `its annotations discuss ${sg.who}, whom you name`) : why[k] || k).join("; ") + "." });
          const a = s.createDiv("txr-acts"), b = a.createEl("button", { cls: "txr-btn-o", text: T("Pune citarea", "Insert citation") }); b.addEventListener("click", () => this.insertAt(v, p, ` [@${sg.id}]`, b));
          const o = a.createEl("a", { text: T("Deschide referința", "Open the reference") }); o.addEventListener("click", () => P.openAt(sg.path, null));
        }
      }
    }
    if (r.search != null) {
      any = true; const s = el.createDiv("txr-sug"); s.createDiv({ cls: "txr-sug-t", text: r.hls.length ? T("Nicio referință citată pentru cercetarea invocată", "No reference cited for the research it mentions") : T("Nicio referință în vault pentru cercetarea invocată", "No reference in your vault for the research it mentions") });
      s.createDiv({ cls: "txr-why", text: T("De ce: paragraful invocă cercetări, fără nicio citare.", "Why: the paragraph mentions research but cites none.") });
      const a = s.createDiv("txr-acts"), b = a.createEl("button", { cls: "txr-btn-o", text: T("Caută în Texere · Referințe", "Search in Texere · References") });
      b.addEventListener("click", () => { const S = P.core?.mod?.("sources")?.sources; if (S?.open) S.open(r.search); else new Notice(T("Pornește Texere · Referințe ca să cauți referințe.", "Turn on Texere · References to search for references.")); });
    }
    // cuvintele de verificat din paragraf (aceleași ca sublinierile punctate din notă, când sunt pornite)
    const tips = V.SLIP_TIP(T), pt = V.PHRASE_TIP(T), hs = [...(this.data.phil ? V.slipRanges(p.raw).map(h => ({ ...h, tip: tips[h.kind] })) : []), ...V.phraseRanges(p.raw, this.data.phil ? ["opinion"] : ["opinion", "stock"]).map(h => ({ ...h, tip: pt[h.kind] }))].sort((a, b) => a.from - b.from);
    if (hs.length) {
      any = true; const s = el.createDiv("txr-sug"); s.createDiv({ cls: "txr-sug-t", text: T("Cuvinte de verificat", "Words to check") });
      for (const h of hs.slice(0, 6)) {
        const row = s.createDiv("txr-word"), ph = p.raw.slice(h.from, h.to), a = row.createEl("a", { text: quote(ph) }); row.createSpan({ cls: "txr-why", text: " " + (h.tip || "") });
        a.title = T("Arată în notă", "Show in the note");
        a.addEventListener("click", () => { try { const before = p.raw.slice(0, h.from), ln = p.line + (before.match(/\n/g) || []).length, ch = h.from - (before.lastIndexOf("\n") + 1); v.editor.setSelection({ line: ln, ch }, { line: ln, ch: ch + ph.length }); v.editor.scrollIntoView({ from: { line: ln, ch }, to: { line: ln, ch } }, true); P.app.workspace.setActiveLeaf?.(v.leaf, { focus: true }); } catch (e) {} });
      }
    }
    if (!any) el.createDiv({ cls: "txr-empty", text: p.concepts.length ? T("Conceptele acestui paragraf n-au încă adnotări în referințele tale.", "This paragraph's concepts have no annotations in your references yet.") : T("Niciun concept din vault în acest paragraf încă. Un link spre o notă-concept (sau numele ei) îl leagă de lecturile tale.", "No concept from your vault in this paragraph yet. A link to a concept note (or its name) connects it to your reading.") });
  }
  // unde se pune: la cursor, dacă e în paragraf (la capătul cuvântului în care e); la începutul rândului (de ex. după un clic în schelet)
  // sau în afara paragrafului: la finalul paragrafului, înaintea punctului final
  insertAt(v, p, txt, btn) {
    const ed = v.editor, cur = ed.getCursor(); let pos;
    if (cur && cur.line >= p.line && cur.line <= p.end && cur.ch > 0) { const line = ed.getLine(cur.line) || ""; let ch = Math.min(cur.ch, line.length); while (ch < line.length && /[\p{L}\p{N}]/u.test(line[ch])) ch++; pos = { line: cur.line, ch }; }
    else { const line = ed.getLine(p.end), m = /([.!?…]["”»)]*)\s*$/.exec(line); pos = { line: p.end, ch: m ? m.index : line.replace(/\s+$/, "").length }; }
    ed.replaceRange(txt, pos); ed.setCursor({ line: pos.line, ch: pos.ch + txt.length });
    if (btn) { btn.disabled = true; btn.setText(this.P.T("Pus", "Inserted")); }
    this.P.cmpSoon(300, true);
  }
  // o definiție, după propoziția în care apare termenul prima dată: „By X I mean …” / „Prin X înțeleg …”
  insertDef(v, p, d, btn) {
    const ed = v.editor, T = (a, b) => this.P.T(a, b), body = d.def.replace(/\s*\.$/, ""), first = body.charAt(0).toLowerCase() + body.slice(1);
    const sentence = p.lang === "ro" ? ` Prin ${d.term.toLowerCase()} înțeleg ${first}.` : ` By ${d.term.toLowerCase()} I mean ${first}.`;
    // capătul propoziției cu termenul: căutăm în rândurile paragrafului
    const idx = this.P.termIndex();
    for (let ln = p.line; ln <= p.end; ln++) {
      const line = ed.getLine(ln), fm = flatMap(line), m = X.matchAll(idx, fm.text).find(x => x.g.paths.includes(d.c));
      if (!m) continue;
      // capătul propoziției în care e termenul, în rândul original (după linkul care îl conține, dacă e într-unul)
      let from = fm.map[m.to] ?? line.length; const close = line.indexOf("]]", from); if (close >= 0 && line.lastIndexOf("[[", from) > line.lastIndexOf("]]", from - 1)) from = close + 2;
      const e = /[.!?…]["”»)]*(?=\s|$)/.exec(line.slice(from)), ch = e ? from + e.index + e[0].length : line.length;
      ed.replaceRange(sentence, { line: ln, ch }); ed.setCursor({ line: ln, ch: ch + sentence.length });
      if (btn) { btn.disabled = true; btn.setText(T("Pusă", "Inserted")); }
      this.P.cmpSoon(300, true); return;
    }
    this.insertAt(v, p, sentence, btn);
  }
}


module.exports = { ResearchMixin, parseHighlights, paraRanges, plain, MAP_VIEW, CMP_VIEW, RESEARCH, HAS_CITE };
