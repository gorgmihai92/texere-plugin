// Un meniu mic, în același limbaj ca meniul „Texere” din modul Editare (card rotunjit, titlu, rânduri), deschis deasupra butonului care l-a cerut.
// popMenu(buton, { title, hint, items: [{ label, onClick }] }) · se închide la clic în afară, Esc sau după o alegere; ↑ ↓ trec prin rânduri.
function popMenu(anchor, { title, hint, items, width = 280 }) {
  const doc = anchor.ownerDocument || document, win = doc.defaultView || window;
  doc.querySelectorAll(".tx-menu").forEach(m => m._close?.());
  const box = doc.createElement("div"); box.className = "tx-edit-lab tx-menu"; box.setAttribute("role", "menu");
  if (title) {
    const h = doc.createElement("div"); h.className = "tx-edit-lab-h"; box.appendChild(h);
    const t = doc.createElement("span"); t.textContent = title; h.appendChild(t);
    if (hint) { const s = doc.createElement("span"); s.className = "tx-edit-lab-hint"; s.textContent = hint; h.appendChild(s); }
  }
  const rows = items.filter(Boolean).map(it => {
    const r = doc.createElement("button"); r.className = "tx-edit-lab-row"; r.setAttribute("role", "menuitem"); r.textContent = it.label; box.appendChild(r);
    r.addEventListener("click", () => { close(); try { it.onClick(); } catch (e) { console.error("Texere: meniu", e); } });
    return r;
  });
  const outside = e => { if (!box.contains(e.target) && !anchor.contains(e.target)) close(); };
  const keys = e => {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); anchor.focus?.(); return; }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); const i = rows.indexOf(doc.activeElement), n = rows.length; rows[(i + (e.key === "ArrowDown" ? 1 : -1) + n) % n]?.focus(); }
  };
  function close() { if (!box.isConnected) return; box.remove(); doc.removeEventListener("mousedown", outside, true); doc.removeEventListener("keydown", keys, true); }
  box._close = close;
  doc.body.appendChild(box);
  const rb = anchor.getBoundingClientRect(), bw = Math.min(width, win.innerWidth - 24);
  box.style.setProperty("--tx-lab-w", bw + "px");
  box.style.setProperty("--tx-lab-left", Math.max(12, Math.min(win.innerWidth - bw - 12, rb.left + rb.width / 2 - bw / 2)) + "px");
  box.style.setProperty("--tx-lab-bottom", (win.innerHeight - rb.top + 10) + "px");   // deasupra butonului
  setTimeout(() => { doc.addEventListener("mousedown", outside, true); doc.addEventListener("keydown", keys, true); rows[0]?.focus({ preventScroll: true }); }, 0);
  return { close, el: box };
}
module.exports = { popMenu };
