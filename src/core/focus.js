// Modul concentrare: rămân doar fișierele deschise (și cele puse unul lângă altul); dispar barele laterale, ribbonul,
// tab-urile, bara de sus a notei și bara de stare. Aceeași scurtătură le readuce, cum erau.
"use strict";
const { Notice } = require("obsidian");

const CLS = "texere-focus";

class Focus {
  constructor(P) { this.P = P; this.on = false; this.prev = null; this.bar = null; }
  get app() { return this.P.app; }

  toggle() { this.on ? this.exit() : this.enter(); }

  enter() {
    const W = this.app.workspace;
    // ce era deschis, ca să revină la fel
    this.prev = { left: !!W.leftSplit?.collapsed, right: !!W.rightSplit?.collapsed };
    try { W.leftSplit?.collapse(); } catch (e) {}
    try { W.rightSplit?.collapse(); } catch (e) {}
    document.body.classList.add(CLS);
    // pe macOS (fereastra fără ramă) rămâne o fâșie sus: de ea muți fereastra, iar butoanele ferestrei nu acoperă textul
    if (!this.bar) { this.bar = document.body.createDiv({ cls: "texere-focus-bar" }); this.bar.setAttr("aria-hidden", "true"); }
    this.on = true;
    new Notice(this.P.T(`Mod concentrare. ${this.keys()} ca să ieși.`, `Focus mode. ${this.keys()} to leave.`), 2500);
  }

  exit() {
    const W = this.app.workspace, p = this.prev || {};
    document.body.classList.remove(CLS);
    this.bar?.remove(); this.bar = null;
    try { if (!p.left) W.leftSplit?.expand(); } catch (e) {}
    try { if (!p.right) W.rightSplit?.expand(); } catch (e) {}
    this.on = false; this.prev = null;
  }

  // scurtătura, cum e setată acum (o poți schimba din Settings → Hotkeys)
  keys() {
    try {
      const id = `${this.P.manifest.id}:focus-mode`, hm = this.app.hotkeyManager;
      const hk = (hm?.getHotkeys?.(id) || hm?.getDefaultHotkeys?.(id) || [])[0];
      if (hk) { const mac = /Mac/.test(navigator.platform); return [...(hk.modifiers || []).map(m => m === "Mod" ? (mac ? "⌘" : "Ctrl") : m === "Alt" ? (mac ? "⌥" : "Alt") : m === "Shift" ? (mac ? "⇧" : "Shift") : m), String(hk.key).toUpperCase()].join(mac ? "" : "+"); }
    } catch (e) {}
    return this.P.T("aceeași scurtătură", "the same shortcut");
  }

  unload() { if (this.on) this.exit(); }
}

module.exports = { Focus, CLS };
