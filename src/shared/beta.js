// Eticheta LAB a lui Insights (încă în lucru): aceeași peste tot, cu o culoare a ei. beta(el) o pune la capătul lui el.
function beta(el, title) {
  if (!el) return null;
  const doc = el.ownerDocument || (typeof document !== "undefined" ? document : null); if (!doc) return null;
  const s = doc.createElement("span"); s.className = "tx-beta"; s.textContent = "LAB";
  if (title) s.title = title;
  el.appendChild(s); return s;
}
module.exports = { beta };
