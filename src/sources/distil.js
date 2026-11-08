// Texere · Sources · Distilează: evidențierile sub care n-ai scris încă nimic, una câte una.
// Scrii una-două propoziții cu cuvintele tale; Texere le pune în nota sursei, chiar sub evidențiere (locul în care
// scrii de obicei comentariul), cu citarea ei: „… [@citekey, p. 61]”. O evidențiere e „folosită” când sub ea e un paragraf
// al tău (nu altă evidențiere, nu un titlu) — nu e nevoie de alte marcaje.
// „Șterge evidențierea”: rândul iese din notă, iar evidențierea iese din pagina PDF-ului (prin PDF++; rămâne în fișier,
// așa că „Anulează” o pune înapoi). Fără PDF++, Texere ține minte că ai șters-o și n-o mai aduce din PDF.
// Evidențierile #word (cuvinte de reținut) nu intră: n-au nevoie de reformulare.
const { Modal, Notice, TFile, setIcon } = require("obsidian");
const { GUIDE_SOURCES, EXAMPLE_SOURCES } = require("../shared/guide-sources");
const { fold, mountIn } = require("../shared/util");

const LINKG = /\[\[([^\]|#]+\.pdf)#([^\]|]*annotation=[^\]|]+)(?:\|[^\]]*)?\]\]/gi;
const CITE = /\[@[^\]]+\]/;
const SKIP_TAGS = new Set(["word", "words", "vocab", "vocabulary", "cuvant", "cuvânt", "cuvinte"]);

// paragrafele notei (rânduri despărțite de rânduri goale; un titlu e paragraful lui), fără proprietăți
function paragraphs(L) {
  let start = 0; if (L[0] === "---") { const e = L.indexOf("---", 1); if (e > 0) start = e + 1; }
  const out = []; let s = -1, fence = false;
  for (let i = start; i <= L.length; i++) {
    const line = i < L.length ? L[i] : "";
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    const blank = !fence && !line.trim(), head = !fence && /^#{1,6}\s/.test(line);
    if (blank || head || i === L.length) { if (s >= 0) { out.push({ s, e: i - 1 }); s = -1; } if (head) out.push({ s: i, e: i, head: true }); continue; }
    if (s < 0) s = i;
  }
  return out;
}
// textul evidențierii, fără etichete, citare și link
function clean(body) {
  return body.replace(LINKG, " ").replace(/\[@[^\]]*\]/g, " ").replace(/^>\s?/gm, "").replace(/\[![^\]]*\][+-]?/g, " ")
    .replace(/!?\[\[[^\]|]+\|([^\]]+)\]\]/g, "$1").replace(/!?\[\[([^\]]+)\]\]/g, "$1").replace(/(^|\s)#[^\s#\[\]]+/g, " ").replace(/\s+/g, " ").replace(/\s*·\s*$/, "").replace(/^\s*·\s*/, "").trim();
}
// toate evidențierile dintr-o notă: { ids:[{link,id,page}], tag, text, cite, s, e, used }
function parse(text) {
  const L = String(text).split("\n"), P = paragraphs(L), out = [];
  for (const p of P) {
    if (p.head) continue;
    let last = -1; for (let i = p.s; i <= p.e; i++) { LINKG.lastIndex = 0; if (LINKG.test(L[i])) last = i; }
    if (last < 0) continue;
    // rândurile de după linkul evidențierii, în același paragraf, sunt comentariul tău (scris fără rând gol)
    const quoted = L.slice(p.s, p.e + 1).every(l => /^\s*>/.test(l));   // callout-ul PDF++ ([!PDF|…]): textul vine după link, tot în callout
    const own = !quoted && last < p.e; if (!quoted) p.e = last;
    const body = L.slice(p.s, p.e + 1).join("\n"); LINKG.lastIndex = 0;
    const links = [...body.matchAll(LINKG)];
    p.hl = true; p.own = own;
    const ids = links.map(m => { const q = new URLSearchParams(m[2]); return { link: m[1], id: q.get("annotation"), page: +q.get("page") || 0 }; }).filter(x => x.id);
    if (!ids.length) { p.hl = false; continue; }
    const tag = (/^(?:>\s*)?(?:\[![^\]]*\][+-]?\s*)?#([^\s#\[\]]+)/.exec(body) || [])[1] || "";
    p.item = { ids, tag: tag.toLowerCase(), text: clean(body), cite: (CITE.exec(body) || [])[0] || "", s: p.s, e: p.e };
  }
  P.forEach((p, k) => { if (!p.item) return; const nx = P[k + 1]; p.item.used = !!(p.own || (nx && !nx.head && !nx.hl)); out.push(p.item); });
  return out;
}
const pending = items => items.filter(it => !it.used && it.text && !SKIP_TAGS.has(fold(it.tag)));
// unde intră textul tău: chiar după paragraful evidențierii, despărțit de rânduri goale
function insertAfter(text, id, sentence) {
  const L = String(text).split("\n"), it = parse(text).find(x => x.ids.some(i => i.id === id)); if (!it) return null;
  const add = ["", sentence]; if (it.e + 1 < L.length && L[it.e + 1].trim() !== "") add.push("");
  L.splice(it.e + 1, 0, ...add); return L.join("\n");
}
// scoate paragraful evidențierii (și un rând gol de lângă el); întoarce și ce trebuie pus înapoi la „Anulează”
function removeAt(text, id) {
  const L = String(text).split("\n"), it = parse(text).find(x => x.ids.some(i => i.id === id)); if (!it) return null;
  let s = it.s, e = it.e;
  if (e + 1 < L.length && !L[e + 1].trim()) e++; else if (s > 0 && !L[s - 1].trim()) s--;
  const lines = L.splice(s, e - s + 1);
  return { text: L.join("\n"), undo: { at: s, prev: s > 0 ? L[s - 1] : null, lines }, item: it };
}
function restore(text, u) {
  const L = String(text).split("\n"); let at = u.at;
  if (u.prev !== null && L[at - 1] !== u.prev) { const k = L.indexOf(u.prev); at = k >= 0 ? k + 1 : Math.min(at, L.length); }
  L.splice(Math.min(at, L.length), 0, ...u.lines); return L.join("\n");
}
// textul tău, cu citarea evidențierii la sfârșit (dacă n-ai pus deja una)
function withCite(sentence, cite) {
  const t = String(sentence || "").replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim(); if (!t) return "";
  return !cite || CITE.test(t) ? t : t + " " + cite;
}

class Distil {
  constructor(S) { this.S = S; this.app = S.app; this.cache = new Map(); }
  T(a, b) { return this.S.T(a, b); }
  get H() { return this.S.highlights; }

  // în meniul „Texere” al notei (Sources → menuItems): doar când nota are evidențieri fără cuvintele tale
  menuItems(f) {
    if (!(f instanceof TFile) || f.extension !== "md") return [];
    const c = this.cache.get(f.path); if (!c || c.mtime !== f.stat?.mtime || !c.items.length) return [];
    return [{ title: this.T("Distilează adnotările", "Distil annotations"), icon: "sparkle", onClick: () => this.open({ only: f }) }];
  }
  start() {
    const host = this.S.host;
    host.addCommand?.({ id: "sources-distil", name: this.T("Distilează adnotările", "Distil annotations"), callback: () => this.open() });

  }
  // notele cu evidențieri din PDF (după linkurile pe care le știe deja Obsidian, fără să citim tot vault-ul)
  candidates() {
    const mc = this.app.metadataCache;
    return this.app.vault.getMarkdownFiles().filter(f => (mc.getFileCache(f)?.links || []).some(l => /\.pdf#/i.test(l.link || "") && /annotation=/.test(l.link || "")));
  }
  async itemsOf(f) {
    const c = this.cache.get(f.path); if (c && c.mtime === f.stat?.mtime) return c.items;
    let text = ""; try { text = await this.app.vault.cachedRead(f); } catch (e) { return []; }
    const items = pending(parse(text)); this.cache.set(f.path, { mtime: f.stat?.mtime, items }); return items;
  }
  // toate evidențierile de distilat: nota deschisă întâi, apoi notele schimbate cel mai recent; în fiecare, în ordinea din notă
  // pick: doar anumite evidențieri, [{ path, ln }] (de ex. din harta dezbaterii), în ordinea dată
  async queue(only, pick) {
    const act = this.app.workspace.getActiveFile?.();
    if (pick?.length) {
      const out = [], seen = new Set();
      for (const p of pick) {
        const f = this.app.vault.getAbstractFileByPath(p.path); if (!(f instanceof TFile)) continue;
        for (const it of await this.itemsOf(f)) { const k = f.path + "#" + it.s; if (p.ln >= it.s && p.ln <= it.e && !seen.has(k)) { seen.add(k); out.push({ ...it, note: f }); } }
      }
      return out;
    }
    const files = only ? [only] : this.candidates().sort((a, b) => (b === act) - (a === act) || (b.stat?.mtime || 0) - (a.stat?.mtime || 0));
    const out = []; for (const f of files) for (const it of await this.itemsOf(f)) out.push({ ...it, note: f });
    return out;
  }
  // pe pagina de pornire: doar lecturile tale (sursele ghidurilor și exemplele vin cu Texere; în Distilează rămân, ca să încerci)
  async count() {
    const mc = this.app.metadataCache, notMine = f => { const id = String(mc.getFileCache(f)?.frontmatter?.id || ""); return GUIDE_SOURCES.includes(id) || EXAMPLE_SOURCES.includes(id); };
    let n = 0; for (const f of this.candidates()) if (!notMine(f)) n += (await this.itemsOf(f)).length; return n;
  }
  open(opts = {}) { new DistilModal(this, opts).open(); }
  // aceeași fereastră, desenată în pagina din tab-ul nou (Acasă → Distilează); „Înapoi” = done()
  panel(el, done) {
    return mountIn(new DistilModal(this, { embedded: true }), el, done);
  }

  // scrie în notă: în editor dacă e deschisă (ca să nu se bată cu ce scrii), altfel direct în fișier
  async edit(note, fn) {
    const run = async () => {
      const ed = this.H?.editorOf?.(note);
      if (ed) {
        const cur = ed.getValue(), next = fn(cur); if (next == null) return false; if (next === cur) return true;
        // doar bucata care s-a schimbat (rândurile la fel la început și la sfârșit rămân), ca editorul să nu sară
        const A = cur.split("\n"), B = next.split("\n"); let a = 0; while (a < A.length && a < B.length && A[a] === B[a]) a++;
        let z = 0; while (z < A.length - a && z < B.length - a && A[A.length - 1 - z] === B[B.length - 1 - z]) z++;
        const from = { line: a, ch: 0 }, toLine = A.length - z, to = toLine < A.length ? { line: toLine, ch: 0 } : { line: A.length - 1, ch: A[A.length - 1].length };
        let ins = B.slice(a, B.length - z).join("\n");
        if (toLine < A.length) { if (B.length - z > a) ins += "\n"; } else if (a > 0 && B.length - z > a) { from.line = a - 1; from.ch = A[a - 1].length; ins = "\n" + ins; } else if (a > 0) { from.line = a - 1; from.ch = A[a - 1].length; }
        ed.replaceRange(ins, from, to); return true;
      }
      let ok = false; await this.app.vault.process(note, t => { const next = fn(t); if (next == null) return t; ok = true; return next; }); return ok;
    };
    const r = this.H?.queue ? await this.H.queue(note.path, run) : await run();
    this.cache.delete(note.path); return r;
  }
  async save(it, sentence) {
    const s = withCite(sentence, it.cite || this.citeFor(it)); if (!s) return false;
    return this.edit(it.note, t => insertAfter(t, it.ids[0].id, s));
  }
  citeFor(it) {
    const fm = this.app.metadataCache.getFileCache(it.note)?.frontmatter || {}, key = String(fm.id || fm["citation-key"] || fm.citekey || "").replace(/^@/, "");
    return key ? `[@${key}${it.ids[0].page ? ", p. " + it.ids[0].page : ""}]` : "";
  }
  // șterge: din notă, apoi din pagina PDF-ului (rămâne în fișier, de unde „Anulează” o pune înapoi)
  async remove(it) {
    let undo = null;
    const ok = await this.edit(it.note, t => { const r = removeAt(t, it.ids[0].id); if (!r) return null; undo = r.undo; return r.text; });
    if (!ok || !undo) return null;
    const pdfs = [];
    for (const x of it.ids) {
      const pdf = this.app.metadataCache.getFirstLinkpathDest(x.link, it.note.path); if (!(pdf instanceof TFile)) continue;
      const elsewhere = this.H?.linkedAnywhere?.(pdf)?.has(x.id);   // altă notă trimite la ea: rămâne în PDF
      let fromPdf = false;
      if (!elsewhere) {
        try { const io = this.app.plugins.plugins["pdf-plus"]?.lib?.highlight?.writeFile?.getPdfIo?.(); if (io?.deleteAnnotation && x.page) { await io.deleteAnnotation(pdf, x.page, x.id); fromPdf = true; } } catch (e) { console.warn("Texere: adnotarea din PDF", e); }
      }
      if (!fromPdf) { const c = this.S.conf(), g = (c.hlGone = c.hlGone || {}); g[pdf.path] = [...new Set([...(g[pdf.path] || []), x.id])]; await this.S.save(); }
      this.H?.cache?.delete(pdf.path);
      pdfs.push({ pdf, id: x.id, page: x.page, fromPdf });
    }
    return { note: it.note, undo, pdfs };
  }
  async unremove(r) {
    await this.edit(r.note, t => restore(t, r.undo));
    for (const p of r.pdfs) {
      if (p.fromPdf) { try { this.H?.noHeal?.delete(p.pdf.path + "|" + p.id); await this.H?.heal?.(p.pdf, [[p.id, p.page]]); } catch (e) { console.warn("Texere: adnotarea înapoi în PDF", e); } }
      const c = this.S.conf(); if (c.hlGone?.[p.pdf.path]) { c.hlGone[p.pdf.path] = c.hlGone[p.pdf.path].filter(x => x !== p.id); if (!c.hlGone[p.pdf.path].length) delete c.hlGone[p.pdf.path]; await this.S.save(); }
      this.H?.cache?.delete(p.pdf.path);
    }
  }
  tagColor(tag) { const c = this.app.plugins.plugins["pdf-plus"]?.settings?.colors || {}; const k = Object.keys(c).find(n => n.toLowerCase() === tag); return k ? c[k] : null; }
  async openAt(it, pdfToo) {
    if (pdfToo) {
      const x = it.ids[0], pdf = this.app.metadataCache.getFirstLinkpathDest(x.link, it.note.path);
      if (pdf) { await this.app.workspace.openLinkText(`${x.link}#page=${x.page}&annotation=${x.id}`, it.note.path, "tab"); return; }
    }
    const leaf = this.app.workspace.getLeaf("tab"); await leaf.openFile(it.note, { eState: { line: it.s } });
  }

}

class DistilModal extends Modal {
  constructor(D, opts) { super(D.app); this.D = D; this.only = opts.only || null; this.pick = opts.pick || null; this.onDone = opts.onDone || null; this.embedded = !!opts.embedded; this.items = []; this.i = 0; this.wrote = 0; this.last = null; }
  T(a, b) { return this.D.T(a, b); }
  async onOpen() {
    this.modalEl.addClass("texere-distil"); this.titleEl.empty();
    this.titleEl.createSpan({ text: this.T("Distilează", "Distil") }); this.nEl = this.titleEl.createSpan("td-n");
    this.contentEl.createDiv({ cls: "td-done", text: "…" });
    this.items = await this.D.queue(this.only, this.pick); this.draw();
  }
  draw() {
    const T = (a, b) => this.T(a, b), c = this.contentEl; c.empty();
    const it = this.items[this.i];
    this.nEl.setText(it ? `${this.i + 1} / ${this.items.length}` : "");
    if (!it) {
      const d = c.createDiv("td-done");
      d.createEl("b", { text: this.items.length ? T("Gata pentru acum.", "Done for now.") : T("Toate adnotările au deja cuvintele tale.", "Every annotation already has your words.") });
      d.createSpan({ text: this.wrote ? T(`Ai scris sub ${this.wrote} ${this.wrote === 1 ? "adnotare" : "adnotări"}.`, `You wrote under ${this.wrote} ${this.wrote === 1 ? "annotation" : "annotations"}.`) : T("Adnotările #word nu intră aici.", "Annotations tagged #word aren't included.") });
      this.foot(c, null); return;
    }
    const src = c.createDiv("td-src");
    if (it.tag) { const t = src.createSpan("td-tag"), dot = t.createSpan("td-dot"), col = this.D.tagColor(it.tag); if (col) dot.setCssStyles({ background: col }); t.createSpan({ text: it.tag }); }
    const p = it.ids[0].page; src.createSpan({ cls: "td-src-n", text: it.note.basename.split(" – ")[0] + (p ? " · p. " + p : "") }).title = it.note.basename;
    const links = src.createDiv("td-links");
    links.createEl("a", { text: T("Deschide în PDF", "Open in PDF") }).addEventListener("click", () => this.D.openAt(it, true));
    links.createEl("a", { text: T("Deschide nota", "Open note") }).addEventListener("click", () => this.D.openAt(it, false));
    c.createDiv({ cls: "td-quote", text: it.text });
    const ta = c.createEl("textarea"); ta.placeholder = T("Cu cuvintele tale: ce spune și ce crezi despre asta?", "In your own words: what does it say, and what do you think?");
    const cite = it.cite || this.D.citeFor(it); c.createDiv({ cls: "td-cite", text: cite ? T(`Se salvează sub adnotare, cu ${cite}`, `Saved under the annotation, with ${cite}`) : T("Se salvează sub adnotare.", "Saved under the annotation.") });
    this.foot(c, it, ta);
    ta.addEventListener("keydown", e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); this.saveBtn?.click(); } });
    setTimeout(() => ta.focus(), 30);
  }
  foot(c, it, ta) {
    const T = (a, b) => this.T(a, b), f = c.createDiv("td-foot");
    if (it) { const del = f.createEl("button", { cls: "td-del", text: T("Șterge adnotarea", "Delete annotation") }); del.addEventListener("click", () => this.del(it, del)); }
    if (this.last) { const m = f.createDiv("td-msg"); m.createSpan({ text: T("Adnotare ștearsă.", "Annotation deleted.") }); const a = m.createEl("a", { text: T("Anulează", "Undo") }); a.addEventListener("click", () => this.undo()); }
    f.createDiv("td-sp");
    if (!it) { f.createEl("button", { text: this.embedded ? T("Înapoi", "Back") : T("Închide", "Close") }).addEventListener("click", () => this.close()); return; }
    f.createEl("button", { text: T("Sari peste", "Skip") }).addEventListener("click", () => { this.last = null; this.i++; this.draw(); });
    const sv = this.saveBtn = f.createEl("button", { cls: "mod-cta", text: T("Salvează", "Save") }); sv.disabled = true;
    ta.addEventListener("input", () => { sv.disabled = !ta.value.trim(); });
    sv.addEventListener("click", async () => {
      if (!ta.value.trim()) return; sv.disabled = true;
      try { if (await this.D.save(it, ta.value)) { this.wrote++; this.last = null; this.items.splice(this.i, 1); this.draw(); } else { new Notice(T("N-am găsit adnotarea în notă (s-a schimbat între timp?).", "Couldn't find the annotation in the note (did it change meanwhile?)."), 7000); sv.disabled = false; } }
      catch (e) { new Notice(T("N-am putut salva: ", "Couldn't save: ") + (e?.message || e), 8000); sv.disabled = false; }
    });
  }
  async del(it, btn) {
    btn.disabled = true;
    try { const r = await this.D.remove(it); if (!r) { new Notice(this.T("N-am găsit adnotarea în notă.", "Couldn't find the annotation in the note."), 6000); btn.disabled = false; return; }
      this.last = { r, it, i: this.i }; this.items.splice(this.i, 1); this.draw(); }
    catch (e) { new Notice(this.T("N-am putut șterge: ", "Couldn't delete: ") + (e?.message || e), 8000); btn.disabled = false; }
  }
  async undo() {
    const l = this.last; if (!l) return; this.last = null;
    try { await this.D.unremove(l.r); this.items.splice(l.i, 0, l.it); this.i = l.i; } catch (e) { new Notice(this.T("N-am putut anula: ", "Couldn't undo: ") + (e?.message || e), 8000); }
    this.draw();
  }
  onClose() { this.contentEl.empty(); this.D.S.host.app?.workspace?.trigger?.("texere:changed"); try { this.onDone?.(this.wrote); } catch (e) { console.error(e); } }
}

module.exports = { install(S) { const D = new Distil(S); S.distil = D; D.start(); return D; }, Distil, parse, pending, insertAfter, removeAt, restore, withCite, paragraphs, clean };
