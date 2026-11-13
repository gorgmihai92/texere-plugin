// Pointerul în PDF: ții mouse-ul apăsat și tragi ca să parcurgi pagina, fără să selectezi (deci fără evidențiere).
// Butonul cu pointer din bara PDF-ului (înaintea culorilor PDF++), tasta H într-un PDF sau comanda „Pointer în PDF”.
// Culoarea aleasă în PDF++ nu se schimbă: H (sau butonul) te întoarce la ea; alegi altă culoare și evidențiezi cu ea.
"use strict";
const { Notice, setIcon } = require("obsidian");

const ON = "tx-pdf-hand", GRAB = "tx-pdf-grabbing", BTN = "tx-pdf-hand-btn";

class PdfHand {
  constructor(P) { this.P = P; this.on = false; this.drag = null; this.told = false; }
  get app() { return this.P.app; }
  T(a, b) { return this.P.T(a, b); }

  start() {
    const P = this.P, ws = this.app.workspace, soon = () => setTimeout(() => this.decorate(), 60);
    for (const ev of ["layout-change", "active-leaf-change", "file-open"]) P.registerEvent(ws.on(ev, soon));
    P.registerInterval(window.setInterval(() => this.decorate(), 2000));   // bara PDF-ului apare uneori mai târziu
    P.registerDomEvent(document, "mousedown", e => this.down(e), true);
    P.registerDomEvent(document, "mousemove", e => this.move(e), true);
    P.registerDomEvent(document, "mouseup", e => this.up(e), true);
    P.registerDomEvent(document, "click", e => this.click(e), true);
    P.registerDomEvent(document, "keydown", e => this.key(e), true);
    P.register(() => { this.set(false, true); document.querySelectorAll("." + BTN).forEach(b => b.remove()); });
    this.decorate();
  }

  toggle() { this.set(!this.on); }
  set(v, quiet) {
    this.on = !!v; document.body.classList.toggle(ON, this.on); if (!this.on) document.body.classList.remove(GRAB);
    document.querySelectorAll("." + BTN).forEach(b => { b.classList.toggle("is-active", this.on); b.setAttr("aria-pressed", String(this.on)); });
    if (this.on && !quiet && !this.told) { this.told = true; new Notice(this.T("Pointer: ții apăsat și tragi ca să parcurgi PDF-ul, fără să evidențiezi. H te întoarce la culoarea de dinainte.", "Pointer: hold and drag to move through the PDF without highlighting. H takes you back to the colour you had."), 6000); }
  }

  // butonul cu pointer, în bara fiecărui PDF (înaintea culorilor din PDF++)
  decorate() {
    this.app.workspace.getLeavesOfType("pdf").forEach(l => {
      const bar = l.view?.containerEl?.querySelector(".pdf-toolbar-left"); if (!bar || bar.querySelector(":scope > ." + BTN)) return;
      const b = createDiv({ cls: `clickable-icon ${BTN}` + (this.on ? " is-active" : "") });
      setIcon(b, "mouse-pointer-2");
      b.setAttr("aria-label", this.T("Pointer: tragi ca să parcurgi, fără să evidențiezi (H)", "Pointer: drag to move through, without highlighting (H)"));
      b.setAttr("aria-pressed", String(this.on));
      b.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); this.toggle(); });
      const pal = bar.querySelector(":scope > .pdf-plus-color-palette");
      bar.insertBefore(b, pal || null);
    });
  }

  // tragi: pagina se mișcă după mouse; nimic nu se selectează
  down(e) {
    if (!this.on || e.button !== 0) return;
    const box = e.target?.closest?.(".pdf-viewer-container"); if (!box) return;
    e.preventDefault();
    this.drag = { box, x: e.clientX, y: e.clientY, left: box.scrollLeft, top: box.scrollTop, moved: false };
    document.body.classList.add(GRAB);
  }
  move(e) {
    const d = this.drag; if (!d) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (!d.moved && Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    d.box.scrollLeft = d.left - dx; d.box.scrollTop = d.top - dy;
    e.preventDefault();
  }
  up() { if (!this.drag) return; this.moved = this.drag.moved; this.drag = null; document.body.classList.remove(GRAB); }
  click(e) {
    // după o tragere, clicul de la sfârșit nu deschide linkul sau evidențierea de sub mouse
    if (this.moved) { this.moved = false; if (e.target?.closest?.(".pdf-viewer-container")) { e.preventDefault(); e.stopPropagation(); } return; }
    // alegi o culoare din PDF++: vrei să evidențiezi, pointerul se oprește
    if (this.on && e.target?.closest?.(".pdf-plus-color-palette-item")) this.set(false);
  }
  key(e) {
    if (e.key !== "h" && e.key !== "H") return;
    if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey || e.repeat) return;
    const t = e.target; if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    const v = this.app.workspace.activeLeaf?.view;
    if (v?.getViewType?.() !== "pdf") return;
    if (this.app.plugins?.plugins?.["pdf-plus"]?.settings?.vim) return;   // în modul Vim al PDF++, H e „stânga”
    e.preventDefault(); e.stopPropagation(); this.toggle();
  }
}

module.exports = { PdfHand };
