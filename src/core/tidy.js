// Folderele lui Texere și căile din setările lui.
//  • followRename: redenumești sau muți ceva în Obsidian → setările lui Texere care arată spre el îl urmează (nu mai rămân căi vechi);
//  • stalePaths / repairPaths: căile din setări care nu mai există, dar au un echivalent („02. Notes/…” → „2. Notes/…”, și când capătul nu există încă);
//  • tidyPlan / TidyModal: ce ține de Texere, la un loc în Support/Texere (ghidurile, bibliografia), iar harta domeniilor lângă notele tale.
//    Mută doar prin Obsidian (linkurile se actualizează), doar ce bifezi, doar după clicul tău. Nu șterge nimic, în afară de un folder rămas gol.
const { Modal, Notice } = require("obsidian");
const { existing, existingPrefix, walkPaths, looksLikePath } = require("../shared/paths");
const { GUIDE_SOURCES, GUIDE_SOURCES_DIR, GUIDE_NOTE } = require("../shared/guide-sources");

const HOME = "Support/Texere";
const MOD_KEYS = ["sources", "export", "insights"];
const isDir = f => !!f && Array.isArray(f.children);

// setările care pot avea căi: ale modulelor (cele vii, dacă modulul e pornit) și ale modului Editare
function stores(P) {
  const out = [];
  for (const key of MOD_KEYS) {
    const M = P.mod?.(key);
    if (M?.settings) out.push({ key, obj: M.settings, save: () => (typeof M.saveData === "function" ? M.saveData(M.settings) : M.saveSettings?.()) });
    else if (P.settings?.modules?.[key]) out.push({ key, obj: P.settings.modules[key], save: () => P.save() });
  }
  if (P.settings?.edit) out.push({ key: "edit", obj: P.settings.edit, save: () => P.save() });
  return out;
}

// ——— căile urmează redenumirile ———
const pending = new Map(); let timer = 0;
function saveSoon(list) {
  for (const st of list) pending.set(st.key, st);
  clearTimeout(timer);
  timer = setTimeout(() => { const all = [...pending.values()]; pending.clear(); for (const st of all) { try { Promise.resolve(st.save()).catch(e => console.error("Texere: căile", e)); } catch (e) { console.error("Texere: căile", e); } } }, 300);
}
function followRename(P, f, old) {
  const now = f?.path; if (!old || !now || old === now) return 0;
  const fn = s => (s === old ? now : s.startsWith(old + "/") ? now + s.slice(old.length) : null);
  const dirty = []; let n = 0;
  for (const st of stores(P)) { const ch = walkPaths(st.obj, fn); if (ch.length) { n += ch.length; dirty.push(st); } }
  if (dirty.length) saveSoon(dirty);
  return n;
}

// ——— căile vechi din setări ———
function staleFix(P, s) {
  if (!looksLikePath(s)) return null;
  const V = P.app.vault, slash = /\/$/.test(s); let p = s.replace(/\/+$/, ""); if (!p) return null;
  let tail = "";
  const i = p.indexOf("{{"); if (i >= 0) { const head = p.slice(0, i).replace(/\/[^/]*$/, "").replace(/\/+$/, ""); tail = p.slice(head.length); p = head; if (!p) return null; }
  if (V.getAbstractFileByPath(p)) return null;
  const e = existing(P.app, p) || existingPrefix(P.app, p);   // și o cale al cărei capăt nu există încă („02. Notes/Weekly reviews”)
  return e && e !== p ? e + tail + (slash ? "/" : "") : null;
}
function stalePaths(P) {
  const out = [];
  for (const st of stores(P)) for (const c of walkPaths(st.obj, s => staleFix(P, s), false)) out.push({ ...c, store: st.key });
  return out;
}
async function repairPaths(P) {
  let n = 0; const dirty = [];
  for (const st of stores(P)) { const ch = walkPaths(st.obj, s => staleFix(P, s)); if (ch.length) { n += ch.length; dirty.push(st); } }
  for (const st of dirty) await st.save();
  return n;
}

// ——— lucrurile lui Texere la un loc ———
async function ensureDir(app, dir) {
  let cur = "";
  for (const part of String(dir || "").split("/").filter(Boolean)) { cur = cur ? `${cur}/${part}` : part; if (!app.vault.getAbstractFileByPath(cur)) { try { await app.vault.createFolder(cur); } catch (e) {} } }
}
// ce s-ar muta: [{ id, from, to, label, kind, checked }]; doar ce există și nu e deja la locul lui
function tidyPlan(P) {
  const app = P.app, V = app.vault, T = (a, b) => P.T(a, b), items = [], has = p => !!(p && V.getAbstractFileByPath(p));
  const add = (from, to, label, kind) => { if (!has(from) || from === to || has(to) || to.startsWith(from + "/") || items.some(x => x.from === from)) return; items.push({ id: "t" + items.length, from, to, label, kind: kind || "move", checked: true }); };
  // 1. harta domeniilor (Fields), lângă notele tale
  const notes = existing(app, "02. Notes");
  for (const m of P.maps?.() || []) {
    const root = P.mapRoot?.(m);
    if (root && notes && !root.includes("/") && isDir(V.getAbstractFileByPath(root))) add(root, `${notes}/${root}`, T("Harta disciplinei, lângă notele tale", "The discipline map, next to your notes"), "map");
  }
  // 2. bibliografia și stilurile de citare
  const bib = String(P.mod?.("sources")?.settings?.sources?.bibPath || P.settings?.modules?.sources?.sources?.bibPath || ""), bdir = bib.includes("/") ? bib.slice(0, bib.lastIndexOf("/")) : "";
  if (bdir && !bdir.startsWith(HOME + "/")) add(bdir, `${HOME}/Bibliography`, T("Bibliografia și stilurile de citare", "The bibliography and the citation styles"), "bib");
  // 3. ghidurile și ce mai e al lui Texere în Support
  add(existing(app, "Support/About"), `${HOME}/About`, T("Ghidul lui Texere", "Texere's guide"));
  add(existing(app, "Support/Guides"), `${HOME}/Guides`, T("Ghidurile (metodologie, primii pași)", "The guides (methodology, getting started)"));
  add(existing(app, "Support/Admin/Scripts"), `${HOME}/Scripts`, T("Scripturile vechi ale vault-ului", "The vault's old scripts"));
  // 4. notele puse direct în Support (în afara subfolderelor)
  const sup = V.getAbstractFileByPath("Support");
  for (const c of (isDir(sup) ? sup.children : []) || []) if (!isDir(c) && c.name && !c.name.startsWith(".")) add(c.path, `${HOME}/${c.name}`, T("O notă pusă direct în Support", "A note sitting directly in Support"));
  // 5. sursele ghidurilor de scriere (Pryor, Huemer…): din Literature Notes, lângă ghiduri; doar cele încă în Literature Notes
  const gs = guideSourceFiles(P);
  if (gs.length) {
    const guides = items.find(x => x.from === existing(app, "Support/Guides")) ? `${HOME}/Guides` : guidesDir(P);
    const names = gs.map(f => (f.basename || "").split(/\s+[0-9–(-]/)[0]).filter(Boolean);
    items.push({ id: "t" + items.length, kind: "group", paths: gs.map(f => f.path), from: gs[0].parent?.path || "", to: `${guides}/${GUIDE_SOURCES_DIR}`, checked: true,
      fromLabel: T(`${gs[0].parent?.path || ""} (${gs.length} note)`, `${gs[0].parent?.path || ""} (${gs.length} notes)`),
      label: T(`Referințele ghidurilor de scriere, lângă ghiduri (${names.slice(0, 3).join(", ")}${names.length > 3 ? "…" : ""})`, `The writing guides' references, next to the guides (${names.slice(0, 3).join(", ")}${names.length > 3 ? "…" : ""})`) });
  }
  return items;
}
// notele surselor ghidurilor care sunt încă în folderul notelor de literatură (le găsim după id)
function guideSourceFiles(P) {
  const app = P.app, mc = app.metadataCache; let lit = "";
  try { lit = String(P.mod?.("sources")?.sources?.litDir?.() || ""); } catch (e) {}
  if (!lit) lit = (existing(app, "01. References/Reading Notes") || "01. References/Reading Notes") + "/";
  return app.vault.getMarkdownFiles().filter(f => f.path.startsWith(lit) && GUIDE_SOURCES.includes(String(mc.getFileCache(f)?.frontmatter?.id || "")));
}
// folderul ghidurilor: unde e acum ghidul „Getting started / Primii pași” (după nume), altfel Support/Texere/Guides
function guidesDir(P) {
  const g = P.app.vault.getMarkdownFiles().find(f => GUIDE_NOTE.test(f.basename || "") && f.parent?.path);
  return g ? g.parent.path : `${HOME}/Guides`;
}
async function tidyRun(P, items) {
  const app = P.app, V = app.vault, done = [], fail = [];
  P._tidying = true;
  try {
    // harta se mută lângă notele tale: Insights trebuie să știe în continuare unde sunt notele-concept (altfel ar crede că toate notele tale sunt concepte)
    const map = items.find(x => x.kind === "map");
    if (map) for (const st of stores(P)) if (st.key === "insights") {
      const s = st.obj; if (!(s.targetFolders || []).filter(Boolean).length) {
        let auto = []; try { auto = P.mod?.("insights")?.autoConceptFolders?.() || []; } catch (e) {}
        s.targetFolders = auto.length ? auto.slice() : [map.from]; await st.save();
      }
    }
    for (const it of items) {
      if (it.kind === "group") {   // mai multe note, într-un folder (calculat acum: ghidurile s-ar fi putut muta mai sus)
        const dir = V.getAbstractFileByPath(it.to) ? it.to : `${guidesDir(P)}/${GUIDE_SOURCES_DIR}`; let n = 0;
        await ensureDir(app, dir);
        for (const p of it.paths) {
          try {
            const f = V.getAbstractFileByPath(p), to = `${dir}/${p.split("/").pop()}`;
            if (!f || V.getAbstractFileByPath(to)) { fail.push({ ...it, from: p, to, why: !f ? "gone" : "exists" }); continue; }
            await app.fileManager.renameFile(f, to); done.push({ ...it, from: p, to }); n++;
          } catch (e) { console.error("Texere: mutarea", p, e); fail.push({ ...it, from: p, why: e?.message || String(e) }); }
        }
        continue;
      }
      try {
        const f = V.getAbstractFileByPath(it.from);
        if (!f || V.getAbstractFileByPath(it.to)) { fail.push({ ...it, why: !f ? "gone" : "exists" }); continue; }
        await ensureDir(app, it.to.slice(0, it.to.lastIndexOf("/")));
        await app.fileManager.renameFile(f, it.to);
        done.push(it);
      } catch (e) { console.error("Texere: mutarea", it.from, e); fail.push({ ...it, why: e?.message || String(e) }); }
    }
    // Support/Admin rămas gol (bibliografia și scripturile au plecat): îl scot, prin coșul lui Obsidian
    const adm = V.getAbstractFileByPath("Support/Admin");
    if (done.length && isDir(adm) && !adm.children.length) { try { await V.trash(adm, false); done.push({ from: "Support/Admin", to: null, label: P.T("Folderul gol", "The empty folder") }); } catch (e) {} }
  } finally { P._tidying = false; }
  return { done, fail };
}

class TidyModal extends Modal {
  constructor(P, items, after) { super(P.app); this.P = P; this.items = items; this.after = after; }
  onOpen() {
    const P = this.P, T = (a, b) => P.T(a, b), c = this.contentEl; c.empty(); c.addClass("tx-tidy");
    this.titleEl.setText(T("Folderele lui Texere, la un loc", "Texere's folders, together"));
    c.createEl("p", { cls: "tx-tidy-intro", text: T("Ce ține de Texere ajunge în Support/Texere, iar harta disciplinei lângă notele tale. Obsidian le mută și actualizează toate linkurile. Nu se șterge nimic. Bifează ce vrei să muți:", "What belongs to Texere goes into Support/Texere, and the discipline map next to your notes. Obsidian moves them and updates every link. Nothing is deleted. Tick what you want to move:") });
    const list = c.createDiv("tx-tidy-list");
    const go = c.createDiv("modal-button-container");
    const cancel = go.createEl("button", { text: T("Renunță", "Cancel") }); cancel.addEventListener("click", () => this.close());
    const ok = go.createEl("button", { cls: "mod-cta" });
    const upd = () => { const n = this.items.filter(x => x.checked).length; ok.setText(T(`Mută (${n})`, `Move (${n})`)); ok.disabled = !n; };
    for (const it of this.items) {
      const r = list.createEl("label", { cls: "tx-tidy-row" });
      const cb = r.createEl("input", { type: "checkbox" }); cb.checked = it.checked; cb.addEventListener("change", () => { it.checked = cb.checked; upd(); });
      const t = r.createDiv("tx-tidy-t"); t.createDiv({ cls: "tx-tidy-l", text: it.label });
      const p = t.createDiv("tx-tidy-p"); p.createSpan({ text: it.fromLabel || it.from }); p.createSpan({ cls: "tx-tidy-arrow", text: " → " }); p.createSpan({ text: it.to });
    }
    upd();
    ok.addEventListener("click", async () => {
      ok.disabled = true; cancel.disabled = true; ok.setText("…");
      const r = await tidyRun(P, this.items.filter(x => x.checked));
      this.close();
      const moved = r.done.filter(x => x.to).length;
      new Notice(r.fail.length ? T(`Am mutat ${moved}; ${r.fail.length} n-au putut fi mutate (vezi consola).`, `Moved ${moved}; ${r.fail.length} couldn't be moved (see the console).`) : T(`Gata: am mutat ${moved}. Linkurile s-au actualizat.`, `Done: moved ${moved}. Links are updated.`), 6000);
      try { this.after?.(r); } catch (e) {}
      P.notify?.();
    });
  }
  onClose() { this.contentEl.empty(); }
}

module.exports = { HOME, stores, followRename, stalePaths, repairPaths, tidyPlan, tidyRun, TidyModal, guideSourceFiles };
