// Pointerul în PDF: selectezi text ca să urmărești pe unde citești, fără să se copieze în nota de lectură
// (auto-copy din PDF++ e oprit cât timp e pornit: nimic nu se scrie în PDF, nimic nu se lipește în notă).
// Butonul cu pointer din bara PDF-ului (înaintea culorilor PDF++), tasta H într-un PDF sau comanda „Pointer în PDF”.
// Culoarea aleasă în PDF++ nu se schimbă: H (sau butonul) te întoarce la ea; alegi altă culoare și evidențiezi cu ea.
"use strict";
const { Notice, setIcon } = require("obsidian");

const ON = "tx-pdf-hand", BTN = "tx-pdf-hand-btn";

class PdfHand {
  constructor(P) { this.P = P; this.on = false; this.told = false; this.held = null; }
  get app() { return this.P.app; }
  get pp() { return this.app.plugins?.plugins?.["pdf-plus"] || null; }
  T(a, b) { return this.P.T(a, b); }

  start() {
    const P = this.P, ws = this.app.workspace, soon = () => setTimeout(() => this.decorate(), 60);
    // Obsidian închis cu pointerul pornit: auto-copy revine cum era
    const st = P.settings || {};
    if (st.pdfPointer?.held && this.pp?.settings && this.pp.settings.autoCopy === false) { this.pp.settings.autoCopy = true; try { this.pp.saveSettings?.(); } catch (e) {} }
    if (st.pdfPointer) { delete st.pdfPointer; P.save?.(); }
    for (const ev of ["layout-change", "active-leaf-change", "file-open"]) P.registerEvent(ws.on(ev, soon));
    P.registerInterval(window.setInterval(() => this.decorate(), 2000));   // bara PDF-ului apare uneori mai târziu
    P.registerDomEvent(document, "click", e => this.click(e), true);
    P.registerDomEvent(document, "keydown", e => this.key(e), true);
    P.register(() => { this.set(false, true); document.querySelectorAll("." + BTN).forEach(b => b.remove()); });
    this.decorate();
  }

  toggle() { this.set(!this.on); }
  set(v, quiet) {
    v = !!v; if (v === this.on) return;
    const s = this.pp?.settings, P = this.P;
    if (v) {
      // auto-copy oprit doar în memorie (setările PDF++ de pe disc rămân cum sunt); ținem minte, ca să revină și după o închidere bruscă
      this.held = s ? !!s.autoCopy : null;
      if (s) s.autoCopy = false;
      if (this.held) { P.settings.pdfPointer = { held: true }; P.save?.(); }
    } else {
      if (s && this.held) s.autoCopy = true;
      this.held = null;
      if (P.settings?.pdfPointer) { delete P.settings.pdfPointer; P.save?.(); }
    }
    this.on = v; document.body.classList.toggle(ON, v);
    document.querySelectorAll("." + BTN).forEach(b => { b.classList.toggle("is-active", v); b.setAttr("aria-pressed", String(v)); });
    if (v && !quiet && !this.told) { this.told = true; new Notice(this.T("Pointer: selectezi ca să urmărești pe unde citești; nimic nu se copiază în notă. H te întoarce la culoarea de dinainte.", "Pointer: select to follow where you're reading; nothing is copied into the note. H takes you back to the colour you had."), 6000); }
  }

  // butonul cu pointer, în bara fiecărui PDF (înaintea culorilor din PDF++)
  decorate() {
    this.app.workspace.getLeavesOfType("pdf").forEach(l => {
      const bar = l.view?.containerEl?.querySelector(".pdf-toolbar-left"); if (!bar || bar.querySelector(":scope > ." + BTN)) return;
      const b = createDiv({ cls: `clickable-icon ${BTN}` + (this.on ? " is-active" : "") });
      setIcon(b, "mouse-pointer-2");
      b.setAttr("aria-label", this.T("Pointer: selectezi fără să copiezi în notă (H)", "Pointer: select without copying into the note (H)"));
      b.setAttr("aria-pressed", String(this.on));
      b.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); this.toggle(); });
      const pal = bar.querySelector(":scope > .pdf-plus-color-palette");
      bar.insertBefore(b, pal || null);
    });
  }

  // alegi o culoare din PDF++: vrei să evidențiezi, pointerul se oprește (înainte ca PDF++ să-și salveze setările)
  click(e) { if (this.on && e.target?.closest?.(".pdf-plus-color-palette-item")) this.set(false); }
  key(e) {
    if (e.key !== "h" && e.key !== "H") return;
    if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey || e.repeat) return;
    const t = e.target; if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    const v = this.app.workspace.activeLeaf?.view;
    if (v?.getViewType?.() !== "pdf") return;
    if (this.pp?.settings?.vim) return;   // în modul Vim al PDF++, H e „stânga”
    e.preventDefault(); e.stopPropagation(); this.toggle();
  }
}

module.exports = { PdfHand };
