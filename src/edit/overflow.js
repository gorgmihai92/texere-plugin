// Panoul „Overflow” (RO „Deoparte”), în dreapta, ca în Write_On: ce ai pus deoparte dintr-o notă, ca text liber în care poți și scrie.
// E al fiecărei note, nu unul general: arată doar Deoparte-ul notei din față, și doar cât ea e în modul Editare.
// Ctrl/⌘+Enter pune la loc în pagină (la cursor) paragraful pe care stai, și îl scoate de aici; tragerea în pagină pune o copie.
// Se păstrează în „Support/Texere/Cuts/<nota> · cuts.md” (până la 0.4: Overflow/„· overflow”, redenumite singure) (via Vault API), cu un link înapoi la notă. Folderul e ținut în setări: dacă îl muți sau îl redenumești în Obsidian, Texere îl urmează.
// Cele de dinainte, „<nota> · overflow.md” de lângă notă, se mută acolo (via Obsidian, nimic șters); vechea „<nota> · set aside.md” se citește, nu se atinge.
const { ItemView, Notice, Scope, TFile, normalizePath } = require("obsidian");

const VIEW = "texere-overflow";
const FOLDER = "Support/Texere/Cuts";
const SUFFIX = " · cuts";
const OLD_SUFFIX = " · overflow";   // până la 0.4: „Overflow”; se redenumesc singure, prin Obsidian, când le deschizi
const OLD_FOLDER = "Support/Texere/Overflow";
const KEY_RX = /^(---\n[\s\S]*?)(?:overflow|cuts)-for:\s*"?\[\[[^\]]*\]\]"?/;
const FRONT = /^---\n[\s\S]*?\n---\n?/;
const noExt = p => p.replace(/\.md$/i, "");
const linkOf = f => `[[${noExt(f.path)}|${f.basename}]]`;
const ownerLink = text => { const m = /^---\n[\s\S]*?(?:overflow|cuts)-for:\s*"?\[\[([^\]|#]+)/.exec(text || ""); return m ? m[1].trim() : null; };
const relink = (t, f) => t.replace(KEY_RX, `$1cuts-for: "${linkOf(f)}"`);
const sibling = (f, suffix) => normalizePath((f.parent && f.parent.path && f.parent.path !== "/" ? f.parent.path + "/" : "") + `${f.basename} · ${suffix}.md`);
const overflowPath = f => normalizePath(`${FOLDER}/${f.basename}${SUFFIX}.md`);

function makeOverflow(P, E, { parseAside, asidePath, EV }) {
  const T = (a, b) => P.T(a, b);
  const V = P.app.vault;
  const fileOf = path => { const f = path && V.getAbstractFileByPath(path); return f instanceof TFile ? f : null; };
  // folderul notelor Deoparte (implicit Support/Texere/Overflow), din setări: așa îl urmează Texere când îl muți în Obsidian
  const DIR = () => {
    const S = P.settings; if (!S || typeof S !== "object") return FOLDER;
    if (!S.edit || typeof S.edit !== "object") S.edit = {};
    if (typeof S.edit.overflowFolder !== "string" || !S.edit.overflowFolder.replace(/\/+$/, "").trim()) S.edit.overflowFolder = FOLDER;
    if (S.edit.overflowFolder === OLD_FOLDER && !V.getAbstractFileByPath(OLD_FOLDER)) S.edit.overflowFolder = FOLDER;
    return normalizePath(S.edit.overflowFolder.replace(/\/+$/, ""));
  };
  DIR();
  // a cui e o notă Deoparte: după linkul din proprietăți (calea întreagă; la cele vechi, doar numele)
  const ownerOf = (link, from) => {
    if (!link) return null;
    const hit = P.app.metadataCache?.getFirstLinkpathDest?.(link, from || "");
    return hit ? hit.path : (/\//.test(link) ? link + ".md" : null);
  };
  const belongs = async (of, f) => {
    const link = ownerLink(await V.cachedRead(of));
    if (!link) return true;   // fără link: după nume
    const o = ownerOf(link, of.path); return o ? o === f.path : link === f.basename;
  };
  // locul notei Deoparte a lui f: „Support/Texere/Overflow/<nume> · overflow.md”; dacă numele e luat de altă notă, „<nume> (<folder>) · overflow.md”, apoi cu număr
  async function locate(f) {
    const base = `${DIR()}/${f.basename}`, par = f.parent && f.parent.name ? ` (${f.parent.name})` : "";
    const names = [base + SUFFIX, base + par + SUFFIX]; for (let i = 2; i < 10; i++) names.push(`${base}${par} ${i}${SUFFIX}`);
    let free = null;
    for (const n of names) {
      const p = normalizePath(n + ".md"), of = fileOf(p);
      if (!of) { if (!free) free = p; continue; }
      if (await belongs(of, f)) return { path: p, file: of };
    }
    // una de dinainte de 0.4 („<nume> · overflow.md”, aici sau în vechiul folder Overflow): o redenumim prin Obsidian
    for (const dir of [DIR(), OLD_FOLDER]) for (const n of names) {
      const op = normalizePath(n.replace(DIR(), dir).slice(0, -SUFFIX.length) + OLD_SUFFIX + ".md"), of = fileOf(op);
      if (!of || !free || !(await belongs(of, f))) continue;
      try {
        await ensureFolder(DIR());
        if (P.app.fileManager?.renameFile) await P.app.fileManager.renameFile(of, free); else await V.rename(of, free);
        const moved = fileOf(free); if (moved) { await V.process(moved, t => relink(t, f)); return { path: free, file: moved }; }
      } catch (e) { console.warn("Texere: Tăieturi, redenumirea", op, e); return { path: op, file: of }; }
    }
    return { path: free, file: null };
  }
  async function ensureFolder(path) {
    let acc = "";
    for (const part of path.split("/")) { acc = acc ? acc + "/" + part : part; const x = V.getAbstractFileByPath(acc); if (!x) await V.createFolder(acc).catch(() => {}); else if (x instanceof TFile) throw new Error(acc + " e o notă, nu un folder"); }
  }
  // o notă Deoparte veche, de lângă notă: se mută în Support/Texere/Overflow (prin Obsidian, ca linkurile să urmeze), cu linkul pe calea întreagă
  async function adopt(old, f) {
    const at = await locate(f); if (at.file || !at.path) return at.file;
    await ensureFolder(DIR());
    const fix = text => relink(text, f);
    if (P.app.fileManager?.renameFile) await P.app.fileManager.renameFile(old, at.path); else await V.rename(old, at.path);
    const moved = fileOf(at.path); if (moved) await V.process(moved, fix);
    return moved;
  }
  async function find(f) {
    const at = await locate(f); if (at.file) return at.file;
    const old = fileOf(sibling(f, "cuts")) || fileOf(sibling(f, "overflow"));
    if (old && ownerLink(await V.cachedRead(old)) !== null) { try { return await adopt(old, f); } catch (e) { console.warn("Texere: Tăieturi, mutarea", e); return old; } }
    return null;
  }

  // textul din Deoparte al unei note (fără proprietățile de sus); dacă nu există încă, ce era în vechea notă „· set aside”
  async function read(path) {
    const f = fileOf(path); if (!f) return "";
    const of = await find(f);
    if (of) return (await V.cachedRead(of)).replace(FRONT, "").replace(/^\n+/, "");
    const old = fileOf(asidePath(f));
    if (old) return parseAside(await V.cachedRead(old)).map(x => x.text).join("\n\n");
    return "";
  }
  async function write(path, body) {
    const f = fileOf(path); if (!f) return;
    const text = `---\ncuts-for: "${linkOf(f)}"\n---\n${body.replace(/\s+$/, "")}\n`;
    const of = await find(f);
    if (of) { await V.process(of, () => text); return; }
    if (!body.trim()) return;
    const at = await locate(f); if (!at.path) return;
    await ensureFolder(DIR()); await V.create(at.path, text);
  }

  class OverflowView extends ItemView {
    constructor(leaf) {
      super(leaf); this.path = null; this.t = 0;
      // Ctrl/⌘+Enter prin tastele lui Obsidian (altfel le ia „Toggle checkbox” înaintea panoului)
      if (typeof Scope === "function") { this.scope = new Scope(this.app?.scope); this.scope.register(["Mod"], "Enter", () => { this.use(); return false; }); }
    }
    getViewType() { return VIEW; }
    getDisplayText() { return this.path ? `${T("Tăieturi", "Cuts")} · ${this.path.split("/").pop().replace(/\.md$/, "")}` : T("Tăieturi", "Cuts"); }
    getIcon() { return "archive"; }
    async onOpen() {
      const c = this.contentEl; c.empty(); c.addClass("tx-overflow");
      this.head = c.createDiv("tx-overflow-h");
      this.note = this.head.createDiv("tx-overflow-n");
      this.sub = this.head.createDiv({ cls: "tx-overflow-t", text: T("Tăieturi · doar pentru nota asta", "Cuts · just for this note") });
      this.empty = c.createDiv("tx-overflow-empty");
      this.emptyT = this.empty.createDiv();
      this.emptyB = this.empty.createEl("button", { text: T("Pornește Editarea în ea", "Turn on edit mode in it") });
      this.emptyB.addEventListener("click", () => { const p = E.current(); if (p) E.toggle(p, true); });
      this.ta = c.createEl("textarea", { cls: "tx-overflow-ta", attr: { placeholder: T("Scrie aici, sau mută aici text din notă…", "Write here, or move text here from the note…"), spellcheck: "true" } });
      this.foot = c.createDiv({ cls: "tx-overflow-f", text: T("Ctrl/⌘+↵ sau trage-l în pagină ca să-l folosești", "Ctrl/⌘+↵ or drag it into the page to use it") });
      this.ta.addEventListener("input", () => { clearTimeout(this.t); const path = this.path, v = this.ta.value; this.t = setTimeout(() => write(path, v).catch(e => console.warn("Texere: Tăieturi", e)), 600); });
      this.ta.addEventListener("keydown", e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); this.use(); } });
      await this.follow();
    }
    async onClose() { clearTimeout(this.t); if (this.path && this.ta) await write(this.path, this.ta.value).catch(() => {}); }
    // urmează nota din față: îi arată Deoparte-ul dacă e în modul Editare; altfel spune asta (nu arată Deoparte-ul altei note)
    async follow(path) {
      path = path || E.target();
      const on = !!path && E.isOn(path), cur = path || E.current();
      if (this.path && this.path !== path) { clearTimeout(this.t); await write(this.path, this.ta.value).catch(() => {}); }
      this.empty.toggleClass("tx-edit-hide", on); this.ta.toggleClass("tx-edit-hide", !on); this.foot.toggleClass("tx-edit-hide", !on);
      this.note.setText(cur ? cur.split("/").pop().replace(/\.md$/, "") : "");
      if (!on) {
        this.path = null; this.ta.value = "";
        this.emptyT.setText(cur ? T("Fiecare notă are Tăieturile ei. Nota asta nu e în modul Editare.", "Each note has its own Cuts. This note isn't in edit mode.") : T("Deschide o notă: fiecare are Tăieturile ei.", "Open a note: each one has its own Cuts."));
        this.emptyB.toggleClass("tx-edit-hide", !cur);
        this.leaf?.updateHeader?.(); return;
      }
      if (path === this.path) return;   // aceeași notă: textul din panou e deja cel bun (nu-l reîncărca peste o salvare în curs)
      this.path = path; this.ta.value = await read(path);
      this.leaf?.updateHeader?.();
    }
    // adaugă la sfârșit (din „Pune deoparte”)
    async append(path, text) {
      if (path !== this.path) await this.follow(path);
      this.ta.value = (this.ta.value.replace(/\s+$/, "") + "\n\n" + text.replace(/\s+$/, "")).replace(/^\n+/, "");
      clearTimeout(this.t); await write(path, this.ta.value);
    }
    // Ctrl/⌘+Enter: paragraful pe care stai trece în pagină, la cursor
    use() {
      const v = this.ta.value, at = this.ta.selectionStart;
      const a = v.lastIndexOf("\n\n", Math.max(0, at - 1)), b = v.indexOf("\n\n", at);
      const from = a < 0 ? 0 : a + 2, to = b < 0 ? v.length : b, para = v.slice(from, to).trim(); if (!para) return;
      const view = E.targetView(); const cm = view?.editor?.cm; if (!cm) { new Notice(T("Deschide nota în care vrei să-l pui.", "Open the note you want to put it in.")); return; }
      const h = cm.state.selection.main.head;
      cm.dispatch({ changes: { from: h, insert: para }, selection: { anchor: h + para.length }, userEvent: EV });
      this.ta.value = (v.slice(0, from) + v.slice(to)).replace(/\n{3,}/g, "\n\n").replace(/^\n+/, "");
      clearTimeout(this.t); write(this.path, this.ta.value).catch(() => {}).finally(() => cm.focus());
    }
  }

  P.registerView(VIEW, leaf => new OverflowView(leaf));
  const leaves = () => P.app.workspace.getLeavesOfType?.(VIEW) || [];
  let ours = false, wasCollapsed = false;   // dacă bara din dreapta era strânsă când l-am deschis, o strânge la loc când îl închizi
  const O = {
    VIEW, FOLDER, folder: DIR, overflowPath, read, write, locate,
    view: () => leaves()[0]?.view || null,
    async show(reveal = true) {
      let leaf = leaves()[0];
      if (!leaf) { wasCollapsed = !!P.app.workspace.rightSplit?.collapsed; leaf = P.app.workspace.getRightLeaf?.(false); if (!leaf) return null; await leaf.setViewState({ type: VIEW, active: false }); ours = true; }
      if (reveal) P.app.workspace.revealLeaf?.(leaf);
      await leaf.view?.follow?.();
      return leaf.view;
    },
    hideIfOurs() { if (ours && !E.anyOn()) O.close(); },
    close() { const back = ours && wasCollapsed; for (const l of leaves()) l.detach(); ours = false; wasCollapsed = false; if (back) P.app.workspace.rightSplit?.collapse?.(); },
    async stash(path, text) {
      let v = null; try { v = await O.show(false); } catch (e) {}
      if (v?.append && E.target() === path) await v.append(path, text); else await write(path, ((await read(path)).replace(/\s+$/, "") + "\n\n" + text).replace(/^\n+/, ""));
    },
    follow: () => { const v = O.view(); if (v) v.follow().catch(() => {}); },
    // notele Deoparte de lângă note (de dinainte) se mută în folderul Deoparte (Support/Texere/Overflow); o dată, la pornire
    async adoptAll() {
      let n = 0;
      for (const of of V.getMarkdownFiles?.() || []) {
        const suf = of.basename.endsWith(SUFFIX) ? SUFFIX : of.basename.endsWith(OLD_SUFFIX) ? OLD_SUFFIX : null;
        if (!suf || of.path.startsWith(DIR() + "/") || of.path.startsWith(OLD_FOLDER + "/")) continue;
        const text = await V.cachedRead(of), link = ownerLink(text); if (link === null) continue;
        const f = fileOf(ownerOf(link, of.path)) || fileOf(sibling({ parent: of.parent, basename: of.basename.slice(0, -suf.length) }, "x").replace(/ · x\.md$/, ".md"));
        if (!f) continue;
        try { if (await adopt(of, f)) n++; } catch (e) { console.warn("Texere: Tăieturi, mutarea", of.path, e); }
      }
      return n;
    },
    // nota redenumită: Deoparte-ul ei o urmează (numele și linkul)
    async renamed(f, oldPath) {
      const oldBase = oldPath.split("/").pop().replace(/\.md$/, ""), oldPar = oldPath.split("/").slice(-2, -1)[0];
      const cands = [SUFFIX, OLD_SUFFIX].flatMap(sf => [`${DIR()}/${oldBase}${sf}.md`, `${DIR()}/${oldBase} (${oldPar})${sf}.md`]);
      for (const c of cands) {
        const of = fileOf(normalizePath(c)); if (!of) continue;
        const link = ownerLink(await V.cachedRead(of)); if (!(link === noExt(oldPath) || link === noExt(f.path) || link === oldBase)) continue;
        await V.process(of, t => relink(t, f));
        const at = await locate(f); if (at.path && at.path !== of.path && !at.file) await (P.app.fileManager?.renameFile ? P.app.fileManager.renameFile(of, at.path) : V.rename(of, at.path));
        return;
      }
    },
  };
  return O;
}

module.exports = { makeOverflow, overflowPath, OVERFLOW_VIEW: VIEW, OVERFLOW_FOLDER: FOLDER };
