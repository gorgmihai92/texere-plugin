// Un singur loc al lui Texere în bara de jos (în loc de câte unul pentru fiecare modul).
// Modulele pun în el intrări: un text scurt (de exemplu stilul citărilor notei) și rânduri în meniul care se deschide la clic.
//   const st = status(core);
//   st.set("cite", { order: 10, text: () => "APA", menu: m => m.addItem(i => i.setTitle("Citation style…").onClick(...)) });
//   st.remove("cite");   // la oprirea modulului
// Textul afișat e al primei intrări (după order) care are text; fără text, doar iconița Texere. Fără intrări, se ascunde.
const { Menu, setIcon } = require("obsidian");

function status(core) {
  if (core._txStatus) return core._txStatus;
  const entries = new Map();
  let el = null;
  const isShown = e => { try { return e.show === undefined || (typeof e.show === "function" ? !!e.show() : !!e.show); } catch (err) { return false; } };
  const sorted = () => [...entries.entries()].sort((a, b) => (a[1].order ?? 50) - (b[1].order ?? 50));
  const render = () => {
    if (!el) {
      el = core.addStatusBarItem(); el.addClass("mod-clickable"); el.addClass("tx-status");
      el.setAttr?.("aria-label", "Texere"); el.setAttr?.("data-tooltip-position", "top");
      el.addEventListener("click", ev => {
        // doar intrările vizibile acum; un separator apare doar între module care chiar au pus ceva în meniu
        const menu = new Menu(); let n = 0, sep = false;
        const wrap = { addItem(f) { if (sep) { menu.addSeparator(); sep = false; } menu.addItem(f); n++; return wrap; }, addSeparator() { if (n) sep = true; return wrap; } };
        for (const [, e] of sorted()) { if (!e.menu || !isShown(e)) continue; if (n) sep = true; try { e.menu(wrap); } catch (err) { console.warn("Texere: bara de jos", err); } }
        if (n) menu.showAtMouseEvent(ev);
      });
    }
    el.empty();
    const visible = sorted().filter(([, e]) => isShown(e));
    if (!visible.length) { el.hide(); return; }
    el.show();
    const ic = el.createSpan("tx-status-ic"); try { setIcon(ic, "texere"); } catch (e) {}
    for (const [, e] of visible) { const t = typeof e.text === "function" ? e.text() : e.text; if (t) { el.createSpan({ cls: "tx-status-text", text: t }); break; } }
  };
  core._txStatus = {
    set(key, entry) { entries.set(key, entry); render(); },
    remove(key) { if (entries.delete(key)) render(); },
    refresh: render,
    get el() { return el; },
  };
  return core._txStatus;
}

module.exports = { status };
