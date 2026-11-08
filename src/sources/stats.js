// Texere · Sources · panoul de statistici din notele surselor (scite, OpenAlex, Semantic Scholar, evidențierile tale).
// Mutat din main.js fără schimbări de comportament.
const { LANG, isEn } = require("../shared/lang");
const { fold, el } = require("../shared/util");
const { CITE_KEY, fitToText, keepFit } = require("./cite");
// revista, după registrele în care o trec comisiile de specialiști (din OpenAlex, fără cheie): Norvegia (1–2), Finlanda / JUFO (1–3), ERIH PLUS, DOAJ
const journalLevel = (lists = []) => {
  const L = new Set(lists || []), nor = L.has("norway-2") ? 2 : L.has("norway-1") ? 1 : 0, fin = L.has("jufo-3") ? 3 : L.has("jufo-2") ? 2 : L.has("jufo-1") ? 1 : 0;
  return { level: fin === 3 ? "top" : nor === 2 || fin === 2 ? "leading" : nor || fin ? "peer" : null, nor, fin, erih: L.has("erih-plus"), doaj: L.has("doaj") };
};
const LEVEL_LABEL = (T, k) => ({ top: T("Revistă de top în domeniu", "Top journal in its field"), leading: T("Revistă de prim rang în domeniu", "Leading journal in its field"), peer: T("Revistă științifică, cu peer review", "Peer-reviewed scholarly journal") })[k];
const LEVEL_TIP = (T, j) => [[j.nor ? T(`Norvegia: nivelul ${j.nor}`, `Norway: level ${j.nor}`) : "", j.fin ? T(`Finlanda (JUFO): nivelul ${j.fin}`, `Finland (JUFO): level ${j.fin}`) : ""].filter(Boolean).join(" · "),
  T("Comisii de specialiști din fiecare domeniu evaluează revistele. Nivelul 1: științifică, cu peer review. Norvegia 2 și Finlanda 2: revistele de prim rang ale domeniului. Finlanda 3: cele de top.", "Expert panels in each field rate journals. Level 1: scholarly, with peer review. Norway 2 and Finland 2: the leading journals of the field. Finland 3: the top ones.")].join("\n");


// ---------- Statistici pentru surse: un panou mic în fiecare notă din Literature Notes ----------
// În literatură: scite (citări care susțin / contrazic / doar menționează, publicații care citează) — pentru surse cu DOI.
// Impact: OpenAlex (citări, FWCI, percentilă, referințe, acces deschis, citări pe an) și Semantic Scholar (citări influente).
// În vault: evidențierile pe tipuri, paginile, notele tale care citează sursa, statutul lecturii.
// Datele din internet se păstrează 7 zile în data.json al pluginului (butonul ⟳ le reîncarcă); nota nu se modifică.
const StatsMixin = {
  async statsPanel() {
    await this.settingsReady();
    if (!this.settings.stats) this.settings.stats = {};
    this.register(() => { document.querySelectorAll(".texere-stats").forEach(e => e.remove()); });

    const tick = this.statsTick = () => this.app.workspace.iterateAllLeaves(l => { if (l.view?.getViewType?.() === "markdown") { try { this.renderStats(l.view); } catch (e) { console.error("Texere: statistici", e); } } });
    let t = null; const soon = (ms = 60) => { clearTimeout(t); t = setTimeout(tick, ms); };
    this.registerEvent(this.app.workspace.on("file-open", () => soon()));
    this.registerEvent(this.app.workspace.on("layout-change", () => soon()));
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => soon()));
    this.registerEvent(this.app.metadataCache.on("changed", () => soon(300)));
    this.registerEvent(this.app.workspace.on("editor-change", () => soon(800)));   // evidențieri noi → numărul se actualizează
    this.registerEvent(this.app.vault.on("modify", f => { if (f.extension === "md" && !this.litKey(f)) this._citedAt = 0; }));
    this.registerInterval(window.setInterval(tick, 2000));   // Obsidian redesenează uneori antetul notei
    tick();
  },

  litDir() { try { if (this.sources?.litDir) return this.sources.litDir(); } catch (e) {} return ("01. References/Reading Notes/").replace(/\/?$/, "/"); },   // folderul notelor din Texere · Sources (Setări → Notă → Foldere)
  // citekey-ul unei note de sursă (null pentru alte note)
  litKey(file) {
    if (!file || file.extension !== "md") return null;
    // în Literature Notes, cu „@” în nume, sau oriunde altundeva dacă e în bibliografie (ex. sursele ghidurilor, lângă ghiduri)
    if (!file.path.startsWith(this.litDir()) && !file.basename.startsWith("@")) { let inLib = false; try { inLib = !!this.sources?.lib?.all?.().some(e => e.obsidianPath === file.path); } catch (e) {} if (!inLib) return null; }
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter || {};
    return fm.id || fm["citation-key"] || (file.basename.startsWith("@") ? file.basename.slice(1) : null);
  },

  // notele tale (în afara Literature Notes) care citează sursa: [@key] sau @key
  citedIn(key) {
    const now = Date.now();
    if (this._citedMap && now - (this._citedAt || 0) < 300000) return this._citedMap.get(key) || [];
    if (!this._citedBusy) {
      this._citedBusy = (async () => {
        const map = new Map(), lit = this.litDir();
        for (const f of this.app.vault.getMarkdownFiles()) {
          if (f.path.startsWith(lit) || f.path.startsWith("Support/")) continue;
          let s = ""; try { s = await this.app.vault.cachedRead(f); } catch (e) { continue; }
          if (!s.includes("@")) continue;
          const re = new RegExp("@(" + CITE_KEY + ")", "g"); let m; const seen = new Set();
          while ((m = re.exec(s))) if (!seen.has(m[1])) { seen.add(m[1]); if (!map.has(m[1])) map.set(m[1], []); map.get(m[1]).push(f); }
        }
        this._citedMap = map; this._citedAt = Date.now(); this._citedBusy = null; this.statsTick?.();
      })();
    }
    return this._citedMap?.get(key) || [];
  },

  // datele din internet (scite, OpenAlex, Semantic Scholar), păstrate 7 zile
  remoteStats(key, fm, force) {
    const c = this.settings.stats[key], DAY = 864e5;
    this._statsBusy = this._statsBusy || new Set();
    const failed = c && [c.scite, c.oa, c.s2].some(x => x?.err);   // un serviciu n-a răspuns: se reîncearcă după o oră
    if ((force || !c || c.v !== 3 || Date.now() - c.t > (failed ? 36e5 : DAY)) && !this._statsBusy.has(key)) {
      this._statsBusy.add(key);
      this.fetchStats(fm).then(async r => { this.settings.stats[key] = r; await this.saveData(this.settings); })
        .catch(e => console.error("Texere: statistici", e))
        .finally(() => { this._statsBusy.delete(key); this.statsTick?.(); });
    }
    return c;
  },

  async fetchStats(fm) {
    const { requestUrl } = require("obsidian");
    const J = async url => {
      try { const r = await requestUrl({ url, throw: false, headers: { Accept: "application/json" } }); return r.status === 200 ? r.json : r.status === 404 ? null : undefined; }
      catch (e) { return undefined; }
    };
    const title = String(fm.title || "").trim(), fam = fold((fm.author || fm.editor || [])[0]?.family || "");
    let doi = String(fm.DOI || fm.doi || "").trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").replace(/^doi:\s*/i, ""), doiFrom = doi ? "note" : null;
    // cărți fără DOI: îl căutăm în Crossref după ISBN (multe cărți academice au DOI)
    if (!doi && fm.ISBN) {
      for (const isbn of String(fm.ISBN).split(/[\s,;]+/).map(x => x.replace(/[^0-9Xx]/g, "")).filter(x => x.length >= 10)) {
        const r = await J(`https://api.crossref.org/works?filter=isbn:${isbn}&rows=10&select=DOI,title,type,author`);
        const its = (r?.message?.items || []).filter(x => !fam || (x.author || []).some(a => fold(a.family).includes(fam)));
        const it = its.find(x => /^(book|monograph|edited-book|reference-book)$/.test(x.type)) || its[0];
        if (it?.DOI) { doi = it.DOI; doiFrom = "isbn"; break; }
      }
    }
    const out = { v: 3, t: Date.now(), doi: doi || null, doiFrom, scite: null, oa: null, s2: null };
    const tasks = [];
    // scite: doar cu DOI
    if (doi) tasks.push(J(`https://api.scite.ai/tallies/${doi}`).then(r => {
      out.scite = r ? { s: r.supporting || 0, c: r.contradicting || 0, m: r.mentioning || 0, u: r.unclassified || 0, cp: r.citingPublications ?? null, tot: r.total || 0 } : r === null ? { none: true } : { err: true };
    }));
    // OpenAlex: după DOI; cărțile fără DOI, după titlu + primul autor
    const key = this.settings.openalexKey ? `&api_key=${encodeURIComponent(this.settings.openalexKey)}` : "";
    const SEL = "id,display_name,is_retracted,publication_year,cited_by_count,fwci,citation_normalized_percentile,referenced_works_count,open_access,counts_by_year,primary_topic,authorships,primary_location";
    tasks.push((async () => {
      let w = null, byTitle = false;
      if (doi) w = await J(`https://api.openalex.org/works/doi:${doi}?select=${SEL}${key}`);
      if (!w && w !== undefined && title && fam) {
        const r = await J(`https://api.openalex.org/works?filter=title.search:${encodeURIComponent(title.replace(/[,:;|]/g, " ").replace(/\s+/g, " ").trim())}&per-page=10&select=${SEL}${key}`);
        if (r === undefined) w = undefined;
        else {
          const hits = (r?.results || []).filter(x => (x.authorships || []).some(a => fold(a.author?.display_name).includes(fam)));
          w = hits.sort((a, b) => (b.cited_by_count || 0) - (a.cited_by_count || 0))[0] || null; byTitle = !!w;
        }
      }
      if (w === undefined) { out.oa = { err: true }; return; }
      if (!w) { out.oa = { none: true }; return; }
      const p = w.citation_normalized_percentile || {};
      out.oa = { id: String(w.id || "").replace(/^https?:\/\/openalex\.org\//, ""), cited: w.cited_by_count ?? null, fwci: typeof w.fwci === "number" ? w.fwci : null,
        pct: typeof p.value === "number" ? p.value : null, top1: !!p.is_in_top_1_percent, top10: !!p.is_in_top_10_percent,
        refs: w.referenced_works_count ?? null, isOa: !!w.open_access?.is_oa, oaStatus: w.open_access?.oa_status || null, oaUrl: w.open_access?.oa_url || null,
        years: (w.counts_by_year || []).map(y => [y.year, y.cited_by_count]).sort((a, b) => a[0] - b[0]),
        topic: w.primary_topic?.display_name || null, retracted: !!w.is_retracted, byTitle };
      const src = w.primary_location?.source; if (src?.type === "journal" && src.display_name) out.oa.journal = { name: src.display_name, publisher: src.host_organization_name || null, lists: src.listed_in || [] };
    })());
    // Semantic Scholar: citări influente
    tasks.push((async () => {
      const F = "fields=title,authors,year,citationCount,influentialCitationCount,referenceCount,url";
      let p = doi ? await J(`https://api.semanticscholar.org/graph/v1/paper/DOI:${doi}?${F}`) : null, byTitle = false;
      if (!p && p !== undefined && title && fam) {
        const r = await J(`https://api.semanticscholar.org/graph/v1/paper/search/match?query=${encodeURIComponent(title)}&${F}`);
        if (r === undefined) p = undefined;
        else { p = (r?.data || []).find(x => (x.authors || []).some(a => fold(a.name).includes(fam))) || null; byTitle = !!p; }
      }
      out.s2 = p === undefined ? { err: true } : !p ? { none: true } : { cited: p.citationCount ?? null, infl: p.influentialCitationCount ?? null, refs: p.referenceCount ?? null, url: p.url || null, byTitle };
    })());
    await Promise.all(tasks);
    return out;
  },

  renderStats(view) {
    const file = view.file, key = this.litKey(file), root = view.containerEl;
    const targets = [root.querySelector(".markdown-source-view .cm-sizer"), root.querySelector(".markdown-reading-view .markdown-preview-sizer .mod-header")].filter(Boolean);
    if (!key) { root.querySelectorAll(".texere-stats").forEach(e => e.remove()); return; }
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter || {};
    const remote = this.remoteStats(key, fm, false), busy = this._statsBusy?.has(key);
    const text = (() => { try { return view.getViewData?.() || view.data || ""; } catch (e) { return ""; } })();
    const cited = this.citedIn(key);
    const sig = JSON.stringify([key, remote?.t, busy, this.settings.statsOpen, text.length, text.split("#").length, cited.map(f => f.path), fm["reading-status"], this.app.loadLocalStorage(LANG)]);
    for (const tg of targets) {
      let p = tg.querySelector(":scope > .texere-stats");
      if (p && p.dataset.sig === sig) { fitToText?.(p); continue; }
      const fresh = this.buildStats(key, fm, remote, busy, text, cited, view);
      fresh.dataset.sig = sig;
      if (p) p.replaceWith(fresh);
      else if (tg.classList.contains("cm-sizer")) tg.insertBefore(fresh, tg.querySelector(":scope > .cm-contentContainer"));
      else tg.appendChild(fresh);
      keepFit?.(fresh);   // lățimea textului notei, în orice temă
    }
  },

  buildStats(key, fm, remote, busy, text, cited, view) {
    const { setIcon, Menu } = require("obsidian");
    const en = isEn(this.app), T = (ro, e) => en ? e : ro;
    const num = n => (n == null ? "—" : Number(n).toLocaleString(en ? "en-US" : "ro-RO"));
    const chip = (row, n, label, color, tip) => {
      const c = el("span", "ts-chip"); if (color) { const d = el("span", "ts-dot"); d.setCssStyles({ background: color }); c.appendChild(d); }
      c.appendChild(el("b", null, num(n))); c.appendChild(document.createTextNode(label)); if (tip) c.title = tip; row.appendChild(c); return c;
    };
    const link = (row, text, url) => { const a = el("a", "ts-link", text + " ↗"); a.href = url; a.target = "_blank"; a.rel = "noopener"; row.appendChild(a); };
    const muted = (row, s) => row.appendChild(el("span", "ts-muted", s));
    const pal = this.app.plugins.plugins["pdf-plus"]?.settings?.colors || {};
    const colorOf = n => { for (const [k, v] of Object.entries(pal)) if (k.toLowerCase() === n) return v; return null; };

    const box = el("div", "texere-stats" + (this.settings.statsOpen ? " is-open" : ""));
    box.addEventListener("mousedown", e => e.stopPropagation());   // clicurile din panou nu mută cursorul în notă
    const head = el("div", "ts-head"), ttl = el("span", "ts-title"), ic = el("span");
    try { setIcon(ic, "bar-chart-3"); } catch (e) {}
    ttl.append(ic, T("Statisticile referinței", "Reference stats")); head.appendChild(ttl);
    const ago = t => { const d = Math.floor((Date.now() - t) / 864e5); return d < 1 ? T("azi", "today") : d === 1 ? T("ieri", "yesterday") : en ? `${d} days ago` : `acum ${d} zile`; };
    { const sc0 = remote?.scite, oa0 = remote?.oa, parts = [];
      if (sc0 && !sc0.err && !sc0.none) parts.push(`${num(sc0.s)} ${T("susțin", "supporting")}`, `${num(sc0.c)} ${T("contrazic", "contrasting")}`);
      const cit0 = oa0 && !oa0.err && !oa0.none ? oa0.cited : remote?.s2?.cited;
      if (cit0 != null) parts.push(`${num(cit0)} ${T("citări", "cited by")}`);
      const hl0 = (text.match(/(?:^|\s)#[\w-]+/gm) || []).filter(t => Object.keys(this.app.plugins.plugins["pdf-plus"]?.settings?.colors || {}).map(n => n.toLowerCase()).includes(t.trim().slice(1).toLowerCase())).length;
      parts.push(`${num(hl0)} ${T("adnotări", "annotations")}`);
      head.appendChild(el("span", "ts-sum", parts.join("  ·  "))); }
    if (remote?.oa?.retracted) { const b = el("span", "ts-retracted", T("Retrasă", "Retracted")); b.title = T("Lucrarea a fost retrasă de editor (OpenAlex). Verifică înainte s-o citezi.", "The publisher retracted this work (OpenAlex). Check before citing it."); head.appendChild(b); }
    head.appendChild(el("span", "ts-meta", busy ? T("se încarcă…", "loading…") : remote?.t ? T("actualizat ", "updated ") + ago(remote.t) : ""));
    const rb = el("span", "ts-btn"); try { setIcon(rb, "refresh-cw"); } catch (e) {}
    rb.title = T("Reîncarcă statisticile", "Refresh the stats");
    rb.addEventListener("click", e => { e.stopPropagation(); this._citedAt = 0; this.remoteStats(key, fm, true); this.statsTick(); });
    const cb = el("span", "ts-btn ts-chev"); try { setIcon(cb, "chevron-down"); } catch (e) {}
    head.append(rb, cb);
    head.addEventListener("click", async () => { this.settings.statsOpen = !this.settings.statsOpen; await this.saveData(this.settings); this.statsTick(); });
    box.appendChild(head);
    const body = el("div", "ts-body"); box.appendChild(body);
    const row = label => { body.appendChild(el("span", "ts-label", label)); const r = el("div", "ts-row"); body.appendChild(r); return r; };
    const loading = !remote && busy;

    // 1. În literatură (scite)
    const r1 = row(T("În literatură", "In the literature")), sc = remote?.scite, doi = remote?.doi || fm.DOI || fm.doi;
    if (loading) muted(r1, "…");
    else if (!doi && fm.ISBN) muted(r1, T("Cărțile fără DOI nu sunt în scite.", "Books without a DOI aren't in scite."));
    else if (!doi) muted(r1, T("Adaugă un DOI în metadatele referinței ca să vezi asta.", "Add a DOI to the reference's metadata to see this."));
    else if (!sc || sc.err) muted(r1, T("scite nu răspunde acum.", "scite isn't responding right now."));
    else if (sc.none) muted(r1, T("scite nu are încă date.", "scite has no data yet."));
    else {
      chip(r1, sc.s, T(" susțin", " supporting"), "#00A896", T("Citări care aduc dovezi în favoarea referinței", "Citation statements that provide evidence for this reference"));
      chip(r1, sc.c, T(" contrazic", " contrasting"), "#F45B5B", T("Citări care aduc dovezi împotriva referinței", "Citation statements that provide evidence against this reference"));
      chip(r1, sc.m, T(" menționează", " mentioning"), "#8a8a8a", T("Citări care doar menționează referința", "Citation statements that only mention this reference"));
      if (sc.cp != null) chip(r1, sc.cp, T(" publicații care citează", " citing publications"), null, T("Publicații distincte care citează referința", "Distinct publications that cite this reference"));
      link(r1, "scite", `https://scite.ai/reports/${encodeURIComponent(String(doi))}`);
      if (remote?.doiFrom === "isbn") muted(r1, T(`· DOI găsit după ISBN: ${doi}`, `· DOI found from the ISBN: ${doi}`));
    }

    // 2. Impact (OpenAlex + Semantic Scholar)
    const r2 = row("Impact"), oa = remote?.oa, s2 = remote?.s2;
    if (loading) muted(r2, "…");
    else {
      const okOa = oa && !oa.err && !oa.none, okS2 = s2 && !s2.err && !s2.none;
      if (!okOa && !okS2) muted(r2, (oa?.err || s2?.err) ? T("OpenAlex sau Semantic Scholar nu răspunde acum.", "OpenAlex or Semantic Scholar isn't responding right now.") : T("Referința nu apare în OpenAlex sau Semantic Scholar.", "This reference isn't in OpenAlex or Semantic Scholar."));
      if (okOa) {
        chip(r2, oa.cited, T(" citări", " cited by"), null, T("Lucrări care citează referința (OpenAlex)", "Works that cite this reference (OpenAlex)"));
        if (oa.fwci != null) { const c = chip(r2, null, "", null, T("Field-Weighted Citation Impact: 1 = media domeniului; 2 = de două ori mai citată decât media", "Field-Weighted Citation Impact: 1 = field average; 2 = cited twice as much as the average")); c.querySelector("b").textContent = "FWCI " + oa.fwci.toFixed(2); }
        if (oa.top1 || oa.top10 || oa.pct != null) { const c = el("span", "ts-chip"); c.appendChild(el("b", null, oa.top1 ? "Top 1%" : oa.top10 ? "Top 10%" : `${Math.round(oa.pct * 100)}%`));
          c.appendChild(document.createTextNode(oa.top1 || oa.top10 ? "" : T(" percentilă", " percentile"))); c.title = T("Cât de citată e față de lucrările din același domeniu și an", "How cited it is compared with works of the same field and year"); r2.appendChild(c); }
      }
      if (okS2 && s2.infl != null) chip(r2, s2.infl, T(" citări influente", " influential citations"), "#9254DE", T("Citări în care referința a influențat semnificativ lucrarea care citează (Semantic Scholar)", "Citations where this reference significantly influenced the citing work (Semantic Scholar)"));
      if (okS2 && !okOa && s2.cited != null) chip(r2, s2.cited, T(" citări", " cited by"), null, "Semantic Scholar");
      if (okOa) {
        if (oa.isOa) { const c = el("span", "ts-chip"); const d = el("span", "ts-dot tx-oa-dot"); c.append(d, T("Acces deschis", "Open access") + (oa.oaStatus ? ` (${oa.oaStatus})` : ""));
          if (oa.oaUrl) { c.classList.add("ts-click"); c.title = T("Deschide versiunea gratuită", "Open the free version"); c.addEventListener("click", () => window.open(oa.oaUrl)); } r2.appendChild(c); }
        if (oa.id) link(r2, "OpenAlex", `https://openalex.org/works/${oa.id}`);
      }
      if (okS2 && s2.url) link(r2, "Semantic Scholar", s2.url);
      if ((okOa && oa.byTitle) || (okS2 && s2.byTitle && !okOa)) muted(r2, T("· găsită după titlu", "· matched by title"));
    }

    // 2a. Revista: nivelul dat de comisiile de specialiști (Norvegia, Finlanda), ERIH PLUS, DOAJ — fără cifre de citare, care în filosofie nu spun mult
    const jr = remote?.oa?.journal;
    if (!loading && jr) {
      const rJ = row(T("Revista", "Journal")), j = journalLevel(jr.lists);
      rJ.appendChild(el("span", "ts-jname", jr.name)); if (jr.publisher) muted(rJ, jr.publisher);
      if (j.level) { const c = el("span", "ts-chip ts-jlevel is-" + j.level); c.appendChild(el("b", null, LEVEL_LABEL(T, j.level))); c.title = LEVEL_TIP(T, j); rJ.appendChild(c); }
      if (j.erih) { const c = chip(rJ, null, "", null, T("Indexată în ERIH PLUS, indexul european al revistelor de științe umaniste și sociale", "Indexed in ERIH PLUS, the European index of humanities and social sciences journals")); c.querySelector("b").textContent = "ERIH PLUS"; }
      if (j.doaj) { const c = chip(rJ, null, "", null, T("Revistă cu acces deschis verificată de Directory of Open Access Journals", "Open-access journal vetted by the Directory of Open Access Journals")); c.querySelector("b").textContent = "DOAJ"; }
      if (!j.level && !j.erih && !j.doaj) muted(rJ, T("nu apare în registrele Norvegiei și Finlandei, în ERIH PLUS sau în DOAJ", "not in the Norwegian or Finnish journal registers, ERIH PLUS or DOAJ"));
    }

    // 2b. Citări pe an (OpenAlex), cu anii fără citări completați cu 0
    const yrs = remote?.oa?.years || [];
    if (!loading && yrs.length) {
      const now = new Date().getFullYear(), m = new Map(yrs), y0 = Math.max(Math.min(...yrs.map(y => y[0])), now - 9);
      const ys = []; for (let y = y0; y <= now; y++) ys.push([y, m.get(y) || 0]);
      const rY = row(T("Citări pe an", "Citations per year")), max = Math.max(1, ...ys.map(y => y[1]));
      const ch = el("div", "ts-years");
      for (const [y, n] of ys) {
        const col = el("div", "ts-yr" + (y === now ? " is-now" : ""));
        col.appendChild(el("span", "ts-yn", n ? String(n) : ""));
        const bar = el("span", "ts-yb"); bar.setCssStyles({ height: Math.max(n ? 3 : 1, Math.round(n / max * 30)) + "px" }); col.appendChild(bar);
        col.appendChild(el("span", "ts-yy", "’" + String(y).slice(2)));
        col.title = `${y}: ${n}` + (y === now ? T(" (anul în curs)", " (so far this year)") : ""); ch.appendChild(col);
      }
      rY.appendChild(ch);
    }

    // 3. În vault: evidențieri pe tipuri, pagini, note care citează, lectura
    const r3 = row(T("În vault", "In your vault")), names = Object.keys(pal).map(n => n.toLowerCase());
    const counts = new Map(), pages = new Set(); let total = 0;
    for (const line of text.split("\n")) {
      const m = /(?:^|\s)#([\w-]+)/.exec(line);
      if (m && names.includes(m[1].toLowerCase())) { const n = m[1].toLowerCase(); counts.set(n, (counts.get(n) || 0) + 1); total++; }
      const pm = /\.pdf#page=(\d+)/i.exec(line); if (pm) pages.add(pm[1]);
    }
    const hc = chip(r3, total, T(" adnotări", " annotations"));
    if (pages.size) hc.appendChild(document.createTextNode(T(` pe ${pages.size} pagini`, ` on ${pages.size} pages`)));
    for (const n of names) if (counts.get(n)) chip(r3, counts.get(n), " " + n, colorOf(n), "#" + n);
    const ci = chip(r3, cited.length, cited.length === 1 ? T(" notă a ta o citează", " of your notes cites it") : T(" note ale tale o citează", " of your notes cite it"));
    if (cited.length) {
      ci.classList.add("ts-click"); ci.title = cited.map(f => f.basename).join("\n");
      ci.addEventListener("click", e => { const m = new Menu(); for (const f of cited) m.addItem(i => i.setTitle(f.basename).setIcon("file-text").onClick(() => this.app.workspace.getLeaf(true).openFile(f))); m.showAtMouseEvent(e); });
    }
    const rs = String(fm["reading-status"] || "").replace(/^#/, "");
    if (rs) { const L = { unread: T("necitită", "unread"), reading: T("în lectură", "reading"), read: T("citită", "read"), toread: T("de citit", "to read") }; muted(r3, "· " + (L[rs.toLowerCase()] || rs)); }
    return box;
  },
};

module.exports = { async install(host) { Object.assign(host, StatsMixin); await host.statsPanel(); } };
