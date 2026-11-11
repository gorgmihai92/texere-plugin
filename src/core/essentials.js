// Texere · ce trebuie ca Texere să meargă din prima, în orice vault (nou sau existent):
// folderul bibliografiei, o bibliografie goală (bibliography.json) și stilurile de citare (APA, Chicago, MLA, Harvard, IEEE).
// Se creează doar ce n-a fost niciodată în vault; un folder care a fost și a dispărut (mutat în afara lui Obsidian) rămâne o alertă cu „Pune-l la loc”.
// Nu mută și nu suprascrie nimic din ce ai.
// Stilurile CSL vin din citation-style-language/styles (licența CC BY-SA 3.0 e în fiecare fișier).
"use strict";

const STYLES = {
  "apa": () => require("../../assets/styles/apa.csl"),
  "chicago-author-date": () => require("../../assets/styles/chicago-author-date.csl"),
  "chicago-notes-bibliography": () => require("../../assets/styles/chicago-notes-bibliography.csl"),
  "modern-language-association": () => require("../../assets/styles/modern-language-association.csl"),
  "harvard-cite-them-right": () => require("../../assets/styles/harvard-cite-them-right.csl"),
  "ieee": () => require("../../assets/styles/ieee.csl"),
};

async function mkdirs(V, dir) {
  let cur = "";
  for (const part of dir.split("/")) { cur = cur ? `${cur}/${part}` : part; if (!V.getAbstractFileByPath(cur)) { try { await V.createFolder(cur); } catch (e) {} } }
}

// { made: [căi create] }; nimic dacă modulul Referințe e oprit
async function ensure(P) {
  const H = P.mod?.("sources"), S = H?.sources; if (!S?.bibPath) return { made: [] };
  const V = P.app.vault, bib = S.bibPath(), dir = bib.includes("/") ? bib.slice(0, bib.lastIndexOf("/")) : "", made = [];
  if (dir && !V.getAbstractFileByPath(dir)) {
    if (P.seen?.(dir)) return { made };   // a fost aici și a dispărut: „Pune-l la loc” (nu-l refacem gol peste bibliografia ta mutată)
    // n-a fost niciodată aici: Texere își face bibliografia lui; un bibliography.json din altă parte (de ex. al pluginului BibLib) nu e atins
    await mkdirs(V, dir); made.push(dir);
  }
  if (!V.getAbstractFileByPath(bib)) { try { await V.create(bib, "[]\n"); made.push(bib); } catch (e) { console.warn("Texere: bibliografia", e); } }
  const folder = dir ? V.getAbstractFileByPath(dir) : V.getRoot();
  if (!(folder?.children || []).some(x => x.extension === "csl")) {
    for (const [id, xml] of Object.entries(STYLES)) {
      const p = (dir ? dir + "/" : "") + id + ".csl";
      if (!V.getAbstractFileByPath(p)) { try { await V.create(p, xml()); made.push(p); } catch (e) { console.warn("Texere: stilul", id, e); } }
    }
  }
  if (made.length) {
    try { P.markSeen?.([dir]); } catch (e) {}
    try { await S.lib?.load?.(); } catch (e) {}
    try { await H.loadStyles?.(); H.refreshCites?.(); } catch (e) {}
  }
  return { made };
}

module.exports = { ensure, STYLES };
