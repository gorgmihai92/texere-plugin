// Un singur loc al lui Texere în meniul unei note: clic dreapta în notă (editor-menu) sau pe numele ei (file-menu)
// → un singur rând „Texere” cu un submeniu, în loc de câte un rând pentru fiecare acțiune a fiecărui modul.
//   const nm = noteMenu(core);
//   nm.add("sources", ctx => [{ title: "Find the free PDF", icon: "file-search", onClick: () => ... }]);
//   nm.remove("sources");   // la oprirea modulului
// ctx = { kind: "editor" | "file", file, editor?, selection? }; un furnizor întoarce [] când n-are nimic de oferit acolo.
const { Platform } = require("obsidian");

function noteMenu(core) {
  if (core._txNoteMenu) return core._txNoteMenu;
  const providers = new Map();
  const collect = ctx => {
    const out = [];
    for (const [key, f] of [...providers.entries()].sort((a, b) => (a[1].order ?? 50) - (b[1].order ?? 50))) {
      let items = []; try { items = f.items(ctx) || []; } catch (e) { console.warn("Texere: meniul notei", key, e); }
      if (items.length && out.length) out.push(null);   // separator între module
      out.push(...items);
    }
    return out;
  };
  const fill = (menu, ctx) => {
    const items = collect(ctx); if (!items.some(Boolean)) return;
    let sub = null;
    menu.addItem(it => {
      it.setTitle("Texere").setIcon("texere");
      if (typeof it.setSubmenu === "function") sub = it.setSubmenu(); else it.setDisabled?.(true);   // fără submeniuri: „Texere” e doar titlul rândurilor de dedesubt
    });
    const add = (m, x, prefix) => m.addItem(s => { s.setTitle(x.title); if (x.icon) s.setIcon(x.icon); s.onClick(x.onClick); });
    for (const x of items) { if (!x) { sub?.addSeparator?.(); continue; } add(sub || menu, x); }
  };
  let hooked = false;
  const hook = () => {
    if (hooked) return; hooked = true;
    const ws = core.app.workspace;
    core.registerEvent(ws.on("editor-menu", (menu, editor, view) => {
      if (Platform?.isMobile && !menu.addItem) return;
      fill(menu, { kind: "editor", file: view?.file || null, editor, selection: editor?.getSelection?.() || "" });
    }));
    core.registerEvent(ws.on("file-menu", (menu, file, source) => {
      if (source === "link-context-menu") return;
      if (!file || file.children) return;   // doar fișiere, nu foldere
      fill(menu, { kind: "file", file });
    }));
  };
  core._txNoteMenu = {
    add(key, items, order) { providers.set(key, { items, order }); hook(); },
    remove(key) { providers.delete(key); },
    items: collect,   // pentru teste
  };
  return core._txNoteMenu;
}

module.exports = { noteMenu };
