// Căile din vault, așa cum le folosește Texere.
//  • „01. Sources” și „1. Sources” sunt același folder (numerotarea cu sau fără zero în față): Texere îl găsește pe cel care există;
//  • un folder nou se face după cum numerotează vault-ul tău (fără zero, dacă așa ai folderele);
//  • walkPaths trece prin setările lui Texere și schimbă textele (și cheile) care sunt căi din vault.
const norm = s => String(s || "").replace(/^0+(\d+\.\s)/, "$1").toLowerCase();
// bibliografia și stilurile de citare: în Support/Texere/Bibliography (vault-urile mai vechi le aveau în Support/Admin/Bibliography)
const BIB_DEFAULT = "Support/Texere/Bibliography/bibliography.json", BIB_OLD = "Support/Admin/Bibliography/bibliography.json";
const trimPath = p => String(p || "").replace(/^\/+|\/+$/g, "");

// calea din vault pentru p: aceeași, sau una care diferă doar prin zerourile din numerotare; null dacă nu există
function existing(app, p) {
  const V = app.vault; p = trimPath(p); if (!p) return null;
  if (V.getAbstractFileByPath(p)) return p;
  let cur = V.getRoot?.(); const out = [];
  for (const seg of p.split("/")) {
    const kids = cur?.children || [];
    const hit = kids.find(c => c.name === seg) || kids.find(c => norm(c.name) === norm(seg));
    if (!hit) return null; out.push(hit.name); cur = hit;
  }
  return out.join("/");
}
// ca existing, dar și pentru o cale care nu există încă: partea de la început care există (cu numele din vault) + restul, neschimbat.
// „02. Notes/Weekly reviews” → „2. Notes/Weekly reviews” (fără folderul Weekly reviews încă); null dacă nu se schimbă nimic
function existingPrefix(app, p) {
  p = trimPath(p); if (!p) return null;
  let cur = app.vault.getRoot?.(); const out = [], segs = p.split("/");
  for (let i = 0; i < segs.length; i++) {
    const kids = cur?.children || [], seg = segs[i];
    const hit = kids.find(c => c.name === seg) || kids.find(c => norm(c.name) === norm(seg));
    if (!hit) { out.push(...segs.slice(i)); break; }
    out.push(hit.name); cur = hit;
  }
  const r = out.join("/"); return r !== p ? r : null;
}
// vault-ul numerotează folderele fără zero („1. Sources”)? atunci și cele noi se fac așa
function unpadded(app) {
  const kids = app.vault.getRoot?.()?.children || [];
  const num = kids.filter(c => Array.isArray(c.children) && /^\d+\.\s/.test(c.name));
  return num.length > 0 && num.every(c => !/^0\d/.test(c.name));
}
// unde s-ar face p: părțile care există, cu numele lor din vault; restul cum sunt scrise (fără zero, dacă vault-ul numerotează fără zero)
function placeFor(app, p) {
  p = trimPath(p); if (!p) return p;
  const strip = unpadded(app); let cur = app.vault.getRoot?.(); const out = [];
  for (const seg of p.split("/")) {
    const kids = cur?.children || [];
    const hit = cur && (kids.find(c => c.name === seg) || kids.find(c => norm(c.name) === norm(seg)));
    if (hit) { out.push(hit.name); cur = hit; } else { out.push(strip ? seg.replace(/^0+(\d+\.\s)/, "$1") : seg); cur = null; }
  }
  return out.join("/");
}
// un text care ar putea fi o cale din vault (nu un link web, o etichetă sau o propoziție)
const looksLikePath = s => typeof s === "string" && s.length < 400 && !/^(https?:|#|\[|\{|@)/.test(s) && !/\n/.test(s) && (/\//.test(s) || /^\d+\.\s/.test(s));

// trece prin obiect: fn(text) → textul nou (sau null); aceeași funcție și pentru chei. Întoarce lista schimbărilor [{ from, to }]
function walkPaths(obj, fn, apply = true) {
  const changes = [];
  const visit = x => {
    if (Array.isArray(x)) {
      for (let i = 0; i < x.length; i++) {
        const v = x[i];
        if (typeof v === "string") { const n = fn(v); if (n != null && n !== v) { changes.push({ from: v, to: n }); if (apply) x[i] = n; } }
        else if (v && typeof v === "object") visit(v);
      }
      return;
    }
    if (!x || typeof x !== "object") return;
    for (const k of Object.keys(x)) {
      const v = x[k];
      if (typeof v === "string") { const n = fn(v); if (n != null && n !== v) { changes.push({ from: v, to: n }); if (apply) x[k] = n; } }
      else if (v && typeof v === "object") visit(v);
      const nk = fn(k);
      if (nk != null && nk !== k && !(nk in x)) { changes.push({ from: k, to: nk, key: true }); if (apply) { x[nk] = x[k]; delete x[k]; } }
    }
  };
  visit(obj);
  return changes;
}

module.exports = { existing, existingPrefix, placeFor, unpadded, looksLikePath, walkPaths, norm, trimPath, BIB_DEFAULT, BIB_OLD };
