// PDF-urile „greu de adnotat”: cărți tipărite cu ligaturi (ri, rt, fi, ru desenate ca un singur semn) și cu un font pe care
// stratul de text al lui pdf.js (textul invizibil peste pagină, pe care îl selectezi) nu-l are. Două lucruri merg prost în ele:
//  1. PDF++ calculează dreptunghiul evidențierii din pozițiile literelor (chars) doar dacă sunt cel puțin cât literele din text;
//     cu ligaturi sunt mai puține, așa că estimează din stratul de text și evidențierea se oprește la jumătatea unui cuvânt.
//     alignChars întinde fiecare ligatură peste literele ei, ca PDF++ să folosească pozițiile adevărate.
//  2. Stratul de text e scris cu alt font, întins pe lungimea rândului: în mijlocul rândului literele lui nu stau peste cele
//     din pagină, deci selectezi altceva decât vezi. drifts() recunoaște pagina (măsoară cât de departe sunt literele stratului
//     față de cele desenate), iar fixSelection() mută capetele selecției pe literele de sub mouse, după geometria adevărată.
"use strict";

const VARIANTS = u => [...new Set([u, u.normalize("NFC"), u.normalize("NFD"), u.normalize("NFKC"), u.normalize("NFKD")])].filter(Boolean);

// literele unui rând (item din getTextContent), câte una pentru fiecare caracter din item.str: { c, r: [x0, y0, x1, y1] } (coordonate PDF).
// null dacă nu se pot potrivi sigur
function alignChars(it) {
  const s = String(it?.str || ""), cs = it?.chars; if (!Array.isArray(cs) || !cs.length || !s) return null;
  if (cs.length === s.length && cs.every((g, i) => (g.c ?? g.u) === s[i])) return cs;
  const out = [], gap = () => { const r = out.length ? out[out.length - 1].r : cs[0].r; return [r[2], r[1], r[2], r[3]]; };
  let p = 0;
  for (const g of cs) {
    if (p >= s.length) break;
    const u = String(g.u ?? g.c ?? ""), r = g.r; if (!Array.isArray(r) || r.length < 4) return null;
    let len = 0;
    for (;;) {
      for (const v of VARIANTS(u)) if (s.startsWith(v, p)) { len = v.length; break; }
      if (len || !/\s/.test(s[p])) break;
      out.push({ c: s[p], r: gap() }); p++;   // un spațiu din text fără semn desenat
    }
    if (!len) { if (!u.trim()) continue; return null; }   // un spațiu desenat care nu e în text: îl sărim
    const w = (r[2] - r[0]) / len;
    for (let k = 0; k < len; k++) out.push({ c: s[p + k], r: [r[0] + w * k, r[1], r[0] + w * (k + 1), r[3]] });
    p += len;
  }
  while (p < s.length && /\s/.test(s[p]) && out.length) { out.push({ c: s[p], r: gap() }); p++; }
  return out.length === s.length ? out : null;
}

// stratul de text al unei pagini pdf.js (cum îl citește PDF++): { items, divs }
function layerOf(pageView) { const t = pageView?.textLayer; const L = t && ("textLayer" in t ? t.textLayer : t); return L?.textContentItems && L?.textDivs ? { items: L.textContentItems, divs: L.textDivs } : null; }

// nodul de text și poziția din el pentru al k-lea caracter din div
function nodeAt(div, k) {
  const it = div.ownerDocument.createNodeIterator(div, NodeFilter.SHOW_TEXT); let n, last = null;
  while ((n = it.nextNode())) { last = n; if (k <= n.textContent.length) return { node: n, offset: k }; k -= n.textContent.length; }
  return last ? { node: last, offset: last.textContent.length } : null;
}

// dreptunghiul unei litere (PDF) în pixelii ecranului
function toClient(pageView, r) {
  const v = pageView.viewport, b = pageView.div.getBoundingClientRect(), [x0, y0, x1, y1] = v.convertToViewportRectangle(r);
  return { left: b.left + Math.min(x0, x1), right: b.left + Math.max(x0, x1), top: b.top + Math.min(y0, y1), bottom: b.top + Math.max(y0, y1) };
}

// literele stratului de text stau peste cele desenate? Măsoară pe câteva rânduri, la un sfert, la jumătate și la trei sferturi;
// „alunecă” dacă cel puțin o cincime dintre măsurători sunt la peste un sfert de literă depărtare. Ținut minte pe pagină.
const DRIFT = new WeakMap();
function drifts(pageView) {
  const L = layerOf(pageView); if (!L) return false;
  const key = L.items; if (DRIFT.has(key)) return DRIFT.get(key);
  let n = 0, far = 0;
  for (let i = 0; i < L.items.length && n < 24; i++) {
    const it = L.items[i], div = L.divs[i], ch = it.str?.length > 12 ? alignChars(it) : null; if (!ch || !div) continue;
    for (const f of [0.25, 0.5, 0.75]) {
      const k = Math.floor(ch.length * f); if (!ch[k]?.c?.trim()) continue;
      const a = nodeAt(div, k), b = a && nodeAt(div, k + 1); if (!a || !b) continue;
      const rg = div.ownerDocument.createRange(); rg.setStart(a.node, a.offset); rg.setEnd(b.node, b.offset);
      const t = rg.getBoundingClientRect(), g = toClient(pageView, ch[k].r), w = Math.max(1, g.right - g.left);
      if (!t.width) continue;
      n++; if (Math.abs((t.left + t.right) / 2 - (g.left + g.right) / 2) > w / 4) far++;
    }
  }
  const res = n >= 6 && far / n >= 0.2; DRIFT.set(key, res); return res;
}
// o pagină „greu de adnotat”: cu ligaturi (mai puține semne desenate decât litere în text) sau cu stratul de text care alunecă
function hard(pageView) {
  const L = layerOf(pageView); if (!L) return false;
  const long = L.items.filter(it => String(it.str || "").length > 12 && Array.isArray(it.chars));
  const lig = long.filter(it => it.chars.length < it.str.length).length;
  return (long.length >= 3 && lig / long.length >= 0.1) || drifts(pageView);
}

// locul din text (rândul și poziția) de sub un punct de pe ecran, după literele desenate; „caret”: înainte sau după literă
function caretAt(pageView, x, y) {
  const L = layerOf(pageView); if (!L) return null;
  const v = pageView.viewport, pb = pageView.div.getBoundingClientRect();
  const rect = r => { const [x0, y0, x1, y1] = v.convertToViewportRectangle(r); return { left: pb.left + Math.min(x0, x1), right: pb.left + Math.max(x0, x1), top: pb.top + Math.min(y0, y1), bottom: pb.top + Math.max(y0, y1) }; };
  let best = null;
  L.items.forEach((it, i) => {
    const ch = alignChars(it); if (!ch) return;
    ch.forEach((g, k) => {
      const c = rect(g.r), dy = y < c.top ? c.top - y : y > c.bottom ? y - c.bottom : 0, dx = x < c.left ? c.left - x : x > c.right ? x - c.right : 0;
      const d = dy * 4 + dx;   // întâi rândul, apoi litera
      if (!best || d < best.d) best = { d, i, k: x > (c.left + c.right) / 2 ? k + 1 : k };
    });
  });
  return best;
}

// după ce ai tras cu mouse-ul peste o pagină greu de adnotat: selecția începe și se termină la literele pe care le-ai văzut
function fixSelection(pageView, down, up) {
  const L = layerOf(pageView); if (!L || !hard(pageView)) return false;
  let a = caretAt(pageView, down.x, down.y), b = caretAt(pageView, up.x, up.y); if (!a || !b || a.d > 6 || b.d > 6) return false;   // doar cu mouse-ul pe un rând de text
  if (b.i < a.i || (b.i === a.i && b.k < a.k)) [a, b] = [b, a];
  if (a.i === b.i && a.k === b.k) return false;
  const s = nodeAt(L.divs[a.i], a.k), e = nodeAt(L.divs[b.i], b.k); if (!s || !e) return false;
  const sel = pageView.div.ownerDocument.getSelection(); if (!sel) return false;
  sel.setBaseAndExtent(s.node, s.offset, e.node, e.offset);
  return true;
}

module.exports = { alignChars, layerOf, drifts, hard, caretAt, fixSelection };
