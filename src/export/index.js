/* Texere · Export — modulul Export al pluginului Texere (până la 3.0, plugin separat)
 * Nota ta → PDF, Word (.docx) sau Markdown, cu cuprins, pagină și șabloanele facultății.
 * Citările și bibliografia vin din modulul Sources, dacă e pornit; fără el, exportul merge, iar citările rămân cum le-ai scris.
 * Codul e în export.js (bibliotecile vin din npm, vezi package.json); importul și lipirea curată în import.js și convert.js; aici doar le pornim.
 * Setările stau în data.json-ul lui Texere (modules.export); prima dată, din locul vechi (sources.export).
 */
const { normalizePath } = require("obsidian");
const { isEn } = require("../shared/lang");
const { ModuleHost } = require("../shared/host");

module.exports = class TexereExport extends ModuleHost {
  async onload() {
    await this.settingsReady();
    this.app.workspace.onLayoutReady(() => this.boot().catch(e => console.error("Texere · Export", e)));
  }
  // modulul Sources (dacă e pornit): motorul citărilor, sugestiile de foldere, aspectul paginii de setări
  get src() { return this.core?.mod?.("sources") || null; }
  get cite() { return this.src?.cite || null; }
  // importul documentelor tale (Word, PDF…) în note: butonul + din pagina Texere
  importFiles() { return this.importer?.pickFiles(false); }
  importFolder() { return this.importer?.pickFiles(true); }
  // acțiunile care nu mai sunt în paleta de comenzi, pentru butoanele din Help: alegi nota de exportat; cuprinsul în nota deschisă
  pickNote() { return this.exporter?.pick(); }
  insertToc() {
    const ed = this.app.workspace.activeEditor?.editor || this.app.workspace.getActiveViewOfType?.(require("obsidian").MarkdownView)?.editor;
    if (ed && this.exporter?.insertToc) return this.exporter.insertToc(ed);
    new (require("obsidian").Notice)(isEn(this.app) ? "Open a note first." : "Deschide întâi o notă.");
  }

  async settingsReady() {
    let d = await this.loadData();
    if (!d || !d.export) {   // prima dată: setările exportului din locul vechi
      for (const p of ["texere-sources", "texere"]) {
        try { const old = JSON.parse(await this.app.vault.adapter.read(`${this.app.vault.configDir}/plugins/${p}/data.json`)); if (old?.sources?.export) { d = { ...(d || {}), export: old.sources.export }; await this.saveData(d); break; } } catch (e) {}
      }
    }
    this.settings = d || {};
  }

  async boot() {
    // Texere · Sources pornește după ce se încarcă interfața: îl așteptăm puțin (citările lui), apoi pornim oricum
    for (let i = 0; i < 40 && this.core?.modOn?.("sources") && !this.cite?.ready; i++) await new Promise(r => setTimeout(r, 250));
    if (!this.core?.running?.(this)) return;   // modulul a fost oprit între timp
    const plugin = this, dir = this.manifest.dir, m = { exports: require("./export") };
    const S = {   // ce folosea exportul din Texere · Sources, acum și fără el
      app: this.app, host: this,
      get en() { return isEn(plugin.app); },
      T(a, b) { return this.en ? b : a; },
      conf: () => plugin.settings,
      save: () => plugin.saveData(plugin.settings),
      async ensureFolder(p) {
        if (!p || plugin.app.vault.getAbstractFileByPath(p)) return;
        let cur = ""; for (const part of normalizePath(p).split("/")) { cur = cur ? cur + "/" + part : part; if (!plugin.app.vault.getAbstractFileByPath(cur)) { try { await plugin.app.vault.createFolder(cur); } catch (e) {} } }
      },
      get _mods() { return plugin.src?.sources?._mods; },
      get settingTab() { return plugin.src?.sources?.settingTab; },
      folderSuggest(el, f) { return plugin.src?.sources?.folderSuggest?.(el, f) ?? null; },
    };
    this.S = S;
    this.exporter = await m.exports.install(S, dir);
    // documentele tale în note: lipirea curată și importul din Word și PDF (import.js + convert.js)
    try { this.importer = await require("./import").install(S, dir); }
    catch (e) { console.error("Texere · Export: importul", e); }
  }
};
