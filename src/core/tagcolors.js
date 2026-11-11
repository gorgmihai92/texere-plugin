// Etichetele evidențierilor (#fact, #claim…) în culorile din paleta PDF++, legate: schimbi o culoare în PDF++, se schimbă și eticheta.
// Ca fragmentul highlight-tags.css din vault-ul Texere: textul în culoarea etichetei, contur gri, fundal transparent;
// în Reading view, Live Preview și Source mode. Un singur <style>, refăcut doar când se schimbă paleta.
"use strict";

const ID = "texere-tag-colors";

function css(colors) {
  const esc = s => (window.CSS?.escape ? window.CSS.escape(s) : String(s).replace(/[^\w-]/g, "\\$&"));
  const names = Object.keys(colors || {}).map(n => [n.toLowerCase(), colors[n]]).filter(([n, c]) => /^[\p{L}\p{N}_/-]+$/u.test(n) && /^#?[0-9a-f]{3,8}$|^rgb/i.test(String(c || "").trim()));
  if (!names.length) return "";
  const sel = n => `a.tag[href="#${n.replace(/"/g, "")}" i], .cm-hashtag.cm-tag-${esc(n)}`;
  const base = `${names.map(([n]) => sel(n)).join(",\n")} {
  --tag-color: var(--tx-tag-color) !important; --tag-color-hover: var(--tx-tag-color) !important;
  --tag-background: transparent !important; --tag-background-hover: transparent !important;
  --tag-border-color: var(--divider-color) !important; --tag-border-color-hover: var(--divider-color) !important;
  --tag-border-width: 1px !important; --tag-radius: 999px; --tag-decoration: none; --tag-decoration-hover: none;
  color: var(--tx-tag-color) !important; background-color: transparent !important; border-color: var(--divider-color) !important; text-decoration: none !important;
}`;
  const each = names.map(([n, c]) => `${sel(n)} { --tx-tag-color: ${String(c).trim().startsWith("#") || /^rgb/i.test(String(c).trim()) ? String(c).trim() : "#" + String(c).trim()}; }`).join("\n");
  return `/* Texere: etichetele evidențierilor, în culorile paletei PDF++ */\n${base}\n${each}\n`;
}

// pune / actualizează stilul; fără PDF++ (sau fără paletă), îl scoate
function refresh(P) {
  try {
    const colors = P.app.plugins?.plugins?.["pdf-plus"]?.settings?.colors || null, key = JSON.stringify(colors || {});
    if (key === P._tagKey && document.getElementById(ID)) return;
    P._tagKey = key;
    let el = document.getElementById(ID); const text = colors ? css(colors) : "";
    if (!text) { el?.remove(); return; }
    if (!el) { el = document.createElement("style"); el.id = ID; document.head.appendChild(el); }
    el.textContent = text;
  } catch (e) { console.warn("Texere: culorile etichetelor", e); }
}

// la pornire, apoi la câteva secunde (paleta se schimbă din setările PDF++, fără vreun eveniment)
function start(P) {
  refresh(P);
  const t = window.setInterval(() => refresh(P), 3000);
  P.register(() => { window.clearInterval(t); document.getElementById(ID)?.remove(); });
}

module.exports = { start, refresh, css };
