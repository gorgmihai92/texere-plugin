/* Gazda unui modul Texere (Sources, Export, Insights) — înainte, fiecare era un plugin separat.
 * Modulul își păstrează codul de plugin (onload, this.addCommand, this.registerEvent…), dar totul trece prin pluginul Texere:
 *  • comenzile, vizualizările, extensiile editorului, iconițele, bara de jos, procesoarele de note se înregistrează o singură
 *    dată în Texere și se pot opri și porni din setări fără repornire (fără dubluri);
 *  • setările stau în data.json-ul lui Texere, sub modules.<cheie>; folderul (manifest.dir) e al lui Texere;
 *  • fila de setări nu apare separat: o arată fila Texere, la secțiunea modulului.
 */
const obsidian = require("obsidian");
const { Component } = obsidian;

class ModuleHost {
  constructor(core, key) {
    this.core = core; this.key = key; this.app = core.app; this.manifest = core.manifest;
    this.settingTabs = []; this._cmds = []; this._exts = []; this._els = []; this._suggests = []; this._pp = [];
    this._comp = null;
  }
  // ——— pornire / oprire (le cheamă Texere) ———
  async _start() {
    this._comp = new Component(); this.core.addChild?.(this._comp); this._comp.load?.();
    this._extArr = this.core._extArrFor(this.key); this._extArr.length = 0;
    await this.onload?.();
  }
  // sincron: când Obsidian oprește Texere (onunload), totul dispare pe loc
  _stop() {
    let r; try { r = this.onunload?.(); } catch (e) { console.error(`Texere · ${this.key}`, e); }
    if (r?.catch) r.catch(e => console.error(`Texere · ${this.key}`, e));
    try { if (this._comp) { if (this.core.removeChild) this.core.removeChild(this._comp); else this._comp.unload?.(); } } catch (e) {}
    this._comp = null;
    const fullId = id => `${this.manifest.id}:${id}`;
    for (const c of this._cmds.splice(0)) { try { if (this.core.removeCommand) this.core.removeCommand(c.id); else this.app.commands?.removeCommand?.(fullId(c.id)); } catch (e) {} }
    for (const el of this._els.splice(0)) { try { el.remove(); } catch (e) {} }
    for (const s of this._suggests.splice(0)) { try { const es = this.app.workspace?.editorSuggest; if (es?.removeSuggest) es.removeSuggest(s); else if (Array.isArray(es?.suggests)) { const i = es.suggests.indexOf(s); if (i >= 0) es.suggests.splice(i, 1); } } catch (e) {} }
    for (const p of this._pp.splice(0)) p.off = true;
    if (this._extArr) { this._extArr.length = 0; try { this.app.workspace?.updateOptions?.(); } catch (e) {} }
    this._exts.length = 0;
    for (const t of this.core._viewTypesOf(this.key)) { try { this.app.workspace?.detachLeavesOfType?.(t); } catch (e) {} }
    this.core._dropModuleRegs(this.key);
    this.settingTabs = [];
  }
  // ——— ciclul de viață (Component) ———
  register(cb) { return this._comp ? this._comp.register(cb) : this.core.register(cb); }
  registerEvent(ref) { return this._comp ? this._comp.registerEvent(ref) : this.core.registerEvent(ref); }
  registerDomEvent(el, type, cb, opts) { return this._comp ? this._comp.registerDomEvent(el, type, cb, opts) : this.core.registerDomEvent(el, type, cb, opts); }
  registerInterval(id) { return this._comp ? this._comp.registerInterval(id) : this.core.registerInterval(id); }
  addChild(c) { return this._comp ? this._comp.addChild(c) : this.core.addChild(c); }
  removeChild(c) { return this._comp ? this._comp.removeChild(c) : this.core.removeChild(c); }
  // ——— ce se vede în Obsidian (prin Texere) ———
  addCommand(cmd) {
    const c = { ...cmd, id: this.core.cmdId(this.key, cmd.id) };
    const r = this.core.addCommand(c); this._cmds.push(c); return r || c;
  }
  ownsCommand(fullId) { const pre = this.manifest.id + ":"; return this._cmds.some(c => fullId === pre + c.id); }
  // în bara din stânga Texere are o singură iconiță (pagina de pornire, din care deschizi Sursele, Exportul, Insights și Ajutorul);
  // iconițele modulelor nu se mai adaugă (aceleași acțiuni sunt în bara de jos a paginii de pornire)
  addRibbonIcon() { return null; }
  addStatusBarItem() { const el = this.core.addStatusBarItem(); if (el) this._els.push(el); return el; }
  addSettingTab(tab) { if (tab) { tab.texereSection = this.key; this.settingTabs.push(tab); } }
  registerView(type, creator) { this.core._moduleView(this.key, type, creator); }
  registerEditorExtension(ext) { this._exts.push(ext); if (this._extArr) { this._extArr.push(ext); try { this.app.workspace?.updateOptions?.(); } catch (e) {} } }
  registerEditorSuggest(s) { this.core.registerEditorSuggest(s); this._suggests.push(s); }
  registerMarkdownPostProcessor(fn, order) {
    const h = { off: false }; this._pp.push(h);
    return this.core.registerMarkdownPostProcessor((el, ctx) => { if (!h.off) return fn(el, ctx); }, order);
  }
  registerMarkdownCodeBlockProcessor(lang, fn, order) { this.core._moduleBlock(this.key, lang, fn, order); }
  registerObsidianProtocolHandler(action, fn) { this.core._moduleProtocol(this.key, action, fn); }
  registerHoverLinkSource(id, info) { return this.core.registerHoverLinkSource?.(id, info); }
  registerExtensions(exts, viewType) { return this.core.registerExtensions?.(exts, viewType); }
  // ——— setările modulului: în data.json-ul lui Texere, la modules.<cheie> ———
  async loadData() { const d = this.core.settings?.modules?.[this.key]; return d == null ? null : JSON.parse(JSON.stringify(d)); }
  async saveData(d) { await this.core.saveModuleData(this.key, d); }
}

module.exports = { ModuleHost };
