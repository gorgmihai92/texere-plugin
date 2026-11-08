/* Texere · documentele tale în note: lipire curată și import (Word, PDF), pentru un fișier, mai multe sau un folder întreg.
 * Conversia e în convert.js (aceeași și pentru linia de comandă, convert-cli.js); aici doar legătura cu Obsidian.
 *  • lipire curată: ce lipești din Word, Pages, Google Docs sau LibreOffice intră cu titluri, bold/italic, liste și note de subsol;
 *    textul copiat dintr-un PDF intră cu paragrafele refăcute (fără rândurile rupte și cuvintele despărțite). Restul: ca de obicei.
 *  • import: clic dreapta pe un .docx/.doc/.odt/.rtf/.pdf din vault (sau pe un folder, pentru toate), ori din calculator (fișiere sau un folder).
 */
"use strict";
const { Notice, Modal, Setting, TFile, TFolder, normalizePath, loadPdfJs } = require("obsidian");
const { node } = require("../shared/node");
const { existingPrefix, placeFor } = require("../shared/paths");

const DOC_EXT = ["docx", "doc", "odt", "rtf", "pdf"];
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const safeName = s => String(s).replace(/[\\/:*?"<>|#^[\]]/g, " ").replace(/\s+/g, " ").trim() || "Document";

class Importer {
  constructor(S, C) { this.S = S; this.app = S.app; this.C = C; }
  T(a, b) { return this.S.T(a, b); }
  get conf() { const c = this.S.conf(); return (c.import = c.import || { cleanPaste: true, folder: placeFor(this.app, "02. Notes/Imported"), keep: false }); }

  install() {
    const h = this.S.host, T = (a, b) => this.T(a, b);
    // ——— lipirea curată ———
    h.registerEvent(this.app.workspace.on("editor-paste", (evt, editor) => {
      if (evt.defaultPrevented || this.conf.cleanPaste === false) return;
      const cd = evt.clipboardData; if (!cd || (cd.files && cd.files.length)) return;
      const md = this.fromClipboard(cd.getData("text/html") || "", cd.getData("text/plain") || "", false);
      if (md == null) return;
      evt.preventDefault(); this.insert(editor, md);
    }));
    // în paleta de comenzi doar „Lipește ca text curat”; pornirea/oprirea e în Setări → Export, importul (pickFiles) în butonul + din pagina Texere
    h.addCommand({ id: "paste-clean", name: T("Lipește ca text curat", "Paste as clean text"), editorCallback: ed => {
      let html = "", text = ""; try { const { clipboard } = node("electron") || {}; html = clipboard.readHTML(); text = clipboard.readText(); } catch (e) {}
      const md = this.fromClipboard(html, text, true); if (md != null) this.insert(ed, md);
    } });
    // ——— importul ———
    // un document din vault (Word, PDF…): „Importă ca notă” e în meniul „Texere” al fișierului (menuItems); un folder are rândul lui
    h.registerEvent(this.app.workspace.on("file-menu", (menu, f) => {
      if (f instanceof TFolder) { const docs = this.docsIn(f); if (docs.length) menu.addItem(i => i.setTitle(T(`Importă documentele din folder (${docs.length})`, `Import the documents in this folder (${docs.length})`)).setIcon("file-input").onClick(() => this.importVaultFiles(docs))); }
    }));
  }

  // în meniul „Texere” al unui document din vault (Export → meniul notei)
  menuItems(f) {
    if (!(f instanceof TFile) || !DOC_EXT.includes(String(f.extension).toLowerCase())) return [];
    return [{ title: this.T("Importă ca notă", "Import as a note"), icon: "file-input", onClick: () => this.importVaultFiles([f]) }];
  }

  // ——— lipire ———
  // null = lipește Obsidian ca de obicei (pagini web, text din note, imagini)
  fromClipboard(html, text, force) {
    const C = this.C;
    try {
      if (html && (C.isOfficeHtml(html) || (force && /<(p|h[1-6]|li|table|div)\b/i.test(html)))) return C.htmlToMarkdown(html, window.DOMParser);
      const plainHtml = !html || !/<(p|h[1-6]|li|table|ul|ol|blockquote)\b/i.test(html);
      if (text && plainHtml && (force || C.looksLikePdfText(text))) return C.cleanPdfText(text);
    } catch (e) { console.error("Texere: lipirea curată", e); }
    return null;
  }
  // textul la cursor; notele de subsol continuă numerotarea notei și merg la finalul ei
  insert(editor, md) {
    const cur = editor.getValue(); let max = 0; for (const m of cur.matchAll(/\[\^(\d+)\]/g)) max = Math.max(max, +m[1]);
    const map = new Map(); md = md.replace(/\[\^(\d+)\]/g, (x, n) => { if (!map.has(n)) map.set(n, String(max + map.size + 1)); return `[^${map.get(n)}]`; });
    const lines = md.split("\n"), defs = lines.filter(l => /^\[\^\d+\]:/.test(l)), body = lines.filter(l => !/^\[\^\d+\]:/.test(l)).join("\n").replace(/\n+$/, "");
    editor.replaceSelection(body);
    if (defs.length) { const last = editor.lastLine(), end = { line: last, ch: editor.getLine(last).length }; const ll = editor.getLine(last); editor.replaceRange((!ll.trim() || /^\[\^[^\]]+\]:/.test(ll) ? "\n" : "\n\n") + defs.join("\n"), end); }
  }

  // ——— import ———
  docsIn(folder) { const out = []; const walk = f => { for (const c of f.children || []) { if (c instanceof TFolder) walk(c); else if (c instanceof TFile && DOC_EXT.includes(c.extension.toLowerCase())) out.push(c); } }; walk(folder); return out; }
  // din vault: nota lângă fișier, cu același nume
  async importVaultFiles(files) {
    const T = (a, b) => this.T(a, b), ad = this.app.vault.adapter, jobs = [];
    for (const f of files) jobs.push({ name: f.name, base: f.basename, ext: f.extension.toLowerCase(), folder: f.parent?.path || "", read: () => this.app.vault.readBinary(f), abs: ad.getFullPath ? ad.getFullPath(f.path) : null, original: f.name });
    await this.run(jobs);
  }
  // din calculator: fișiere (mai multe deodată) sau un folder întreg, cu subfolderele lui
  pickFiles(folder) {
    const inp = document.createElement("input"); inp.type = "file"; inp.multiple = true;
    if (folder) { inp.webkitdirectory = true; } else inp.accept = DOC_EXT.map(e => "." + e).join(",");
    inp.addEventListener("change", () => { const fs = [...(inp.files || [])].filter(f => DOC_EXT.includes((/\.(\w+)$/.exec(f.name)?.[1] || "").toLowerCase())); if (!fs.length) { new Notice(this.T("Niciun document Word sau PDF.", "No Word or PDF documents."), 4000); return; } this.askTarget(fs, folder); });
    inp.click();
  }
  askTarget(files, folder) {
    const T = (a, b) => this.T(a, b), m = new Modal(this.app), c = this.conf, at = p => existingPrefix(this.app, p) || p;   // „02. Notes/…” când folderul e „2. Notes”
    let target = at(c.folder || "02. Notes/Imported"), keep = !!c.keep;
    m.titleEl.setText(T(`Importă ${files.length} ${files.length === 1 ? "document" : "documente"}`, `Import ${files.length} ${files.length === 1 ? "document" : "documents"}`));
    m.contentEl.createDiv({ cls: "setting-item-description", text: T("Fiecare document devine o notă cu titlurile, bold/italic, listele, tabelele și notele de subsol lui. Originalele rămân neatinse.", "Each document becomes a note with its headings, bold/italic, lists, tables and footnotes. The originals stay untouched.") });
    new Setting(m.contentEl).setName(T("Folderul din vault", "Folder in the vault")).setDesc(folder ? T("Subfolderele se păstrează.", "Subfolders are kept.") : "").addText(t => { t.setValue(target).onChange(v => { target = v; }); try { this.S.folderSuggest?.(t.inputEl); } catch (e) {} });
    new Setting(m.contentEl).setName(T("Păstrează și originalul în vault", "Keep the original in the vault too")).setDesc(T("Lângă notă (ex. ca să deschizi PDF-ul la pagină).", "Next to the note (e.g. to open the PDF at a page).")).addToggle(t => t.setValue(keep).onChange(v => { keep = v; }));
    const bc = m.contentEl.createDiv("modal-button-container");
    bc.createEl("button", { text: T("Renunță", "Cancel") }).addEventListener("click", () => m.close());
    bc.createEl("button", { cls: "mod-cta", text: T("Importă", "Import") }).addEventListener("click", async () => {
      m.close(); c.folder = normalizePath(target || at("02. Notes/Imported")); c.keep = keep; await this.S.save();
      const jobs = files.map(f => { const rel = (folder && f.webkitRelativePath ? f.webkitRelativePath.split("/").slice(1, -1).join("/") : ""); const base = f.name.replace(/\.[^.]+$/, "");
        return { name: f.name, base, ext: (/\.(\w+)$/.exec(f.name)?.[1] || "").toLowerCase(), folder: normalizePath(c.folder + (rel ? "/" + rel : "")), read: async () => new Uint8Array(await f.arrayBuffer()), abs: f.path || null, keep }; });
      await this.run(jobs);
    });
    m.open();
  }
  // pe rând, cu progresul într-un mesaj; la final: câte au intrat, ce n-a mers
  async run(jobs) {
    const T = (a, b) => this.T(a, b), made = [], failed = [];
    const note = new Notice(T("Se importă…", "Importing…"), 0);
    for (let i = 0; i < jobs.length; i++) {
      const j = jobs[i]; note.setMessage(T(`Import ${i + 1} din ${jobs.length}: ${j.name}`, `Importing ${i + 1} of ${jobs.length}: ${j.name}`));
      try { made.push(await this.one(j)); } catch (e) { console.error("Texere: importul", j.name, e); failed.push(`${j.name} (${e.message || e})`); }
    }
    note.hide();
    const parts = [];
    if (made.length) parts.push(made.length === 1 ? T(`Am importat „${made[0].basename}”.`, `Imported “${made[0].basename}”.`) : T(`Am importat ${made.length} documente.`, `Imported ${made.length} documents.`));
    if (failed.length) parts.push(T("Nu au mers: ", "Couldn't import: ") + failed.slice(0, 4).join("; ") + (failed.length > 4 ? "…" : ""));
    new Notice(parts.join(" "), failed.length ? 12000 : 6000);
    if (made.length === 1) this.app.workspace.getLeaf(false).openFile(made[0]);
    return made;
  }
  async one(j) {
    const C = this.C; let data = await j.read(), ext = j.ext, md, title = null, images = [];
    if (["doc", "odt", "rtf"].includes(ext)) { data = await this.toDocx(j, data); ext = "docx"; }
    if (ext === "docx") { const r = C.docxToMarkdown(Buffer.from(data), { imagePrefix: safeName(j.base) }); md = r.md; title = r.title; images = r.images; }
    else if (ext === "pdf") { const r = await C.pdfToMarkdown(await loadPdfJs(), data); md = r.md; title = r.title; if (!md.trim()) throw new Error(this.T("PDF-ul n-are text (e scanat fără OCR)", "the PDF has no text (scanned without OCR)")); }
    else throw new Error(ext);
    await this.S.ensureFolder(j.folder);
    // originalul (din calculator, dacă vrei) lângă notă
    let original = j.original || null;
    if (j.keep) { const p = await this.free(j.folder, safeName(j.base), "." + j.ext); await this.app.vault.createBinary(p, j.ext === ext ? data : await j.read()); original = p.split("/").pop(); }
    const path = await this.free(j.folder, safeName(j.base), ".md");
    // imaginile din Word: în folderul de atașamente ales în Obsidian
    for (const im of images) {
      let p = null; try { p = await this.app.fileManager.getAvailablePathForAttachment(im.name, path); } catch (e) { p = await this.free(j.folder, im.name.replace(/\.\w+$/, ""), /\.\w+$/.exec(im.name)[0]); }
      await this.S.ensureFolder(p.split("/").slice(0, -1).join("/")); await this.app.vault.createBinary(p, im.data); md = md.split(`![[${im.name}]]`).join(`![[${p.split("/").pop()}]]`);
    }
    return this.app.vault.create(path, C.noteFor(md, { title: j.base, source: j.name, date: today(), original: j.keep || j.original ? original : null }));
  }
  async free(folder, base, ext) { let p = normalizePath((folder ? folder + "/" : "") + base + ext), k = 2; while (this.app.vault.getAbstractFileByPath(p)) p = normalizePath((folder ? folder + "/" : "") + `${base} (${k++})` + ext); return p; }
  // .doc, .odt, .rtf → .docx: cu unealta din macOS (textutil) sau cu LibreOffice, dacă e instalat
  async toDocx(j, data) {
    const os = node("os"), path = node("path"), fs = node("fs"), { execFile } = node("child_process") || {};
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "texere-import-")), src = path.join(dir, "in." + j.ext); fs.writeFileSync(src, Buffer.from(data));
    const run = (cmd, args) => new Promise(res => execFile(cmd, args, { timeout: 120000 }, err => res(!err)));
    const out = path.join(dir, "in.docx");
    if (process.platform === "darwin" && await run("/usr/bin/textutil", ["-convert", "docx", "-output", out, src]) && fs.existsSync(out)) return fs.readFileSync(out);
    for (const so of ["/Applications/LibreOffice.app/Contents/MacOS/soffice", "soffice", "C:\\Program Files\\LibreOffice\\program\\soffice.exe"]) if (await run(so, ["--headless", "--convert-to", "docx", "--outdir", dir, src]) && fs.existsSync(out)) return fs.readFileSync(out);
    throw new Error(this.T("salvează-l ca .docx din Word", "save it as .docx from Word"));
  }
}

module.exports = { async install(S) {
  const I = new Importer(S, require("./convert")); I.install(); return I;
} };
