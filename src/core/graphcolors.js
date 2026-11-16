// Culorile hărții disciplinei în graficul Obsidian (Graph view → Groups): câte o culoare pentru fiecare tip de notă din hartă
// (ramuri, subdomenii, concepte, teorii, curente, perioade, autori). Texere adaugă doar grupurile care lipsesc, la sfârșitul listei;
// grupurile tale rămân cum sunt (și primele: dacă o notă e în două grupuri, câștigă al tău).
"use strict";

const GROUPS = [
  ["Branches", 0x7c5cff, "ramuri", "branches"],
  ["Subfields", 0x4a8df0, "subdomenii", "subfields"],
  ["Concepts", 0x23a99a, "concepte", "concepts"],
  ["Theories", 0xe0457b, "teorii", "theories"],
  ["Movements", 0xd99a1e, "curente", "movements"],
  ["Periods", 0x8a8f98, "perioade", "periods"],
  ["Authors", 0xf06a2a, "autori", "authors"],
];

const file = app => `${app.vault.configDir}/graph.json`;
async function readGraph(app) { try { return JSON.parse(await app.vault.adapter.read(file(app))); } catch (e) { return {}; } }

// folderul hărții, dacă e în vault (oriunde l-ai mutat)
async function mapFolder(P) {
  const m = P.maps?.()[0]; if (!m) return null;
  try { const st = await P.mapStatus(m); return st.have ? st.folder : null; } catch (e) { return null; }
}
const groupsFor = folder => GROUPS.map(([d, rgb]) => ({ query: `path:"${folder}/${d}"`, color: { a: 1, rgb } }));

// grupurile care lipsesc (null: harta nu e încă în vault)
async function missing(P) {
  const folder = await mapFolder(P); if (!folder) return null;
  const have = new Set(((await readGraph(P.app)).colorGroups || []).map(g => String(g.query || "").trim()));
  return groupsFor(folder).filter(g => !have.has(g.query));
}

// le adaugă pe cele care lipsesc; graficul deschis se recolorează pe loc
async function apply(P) {
  const add = await missing(P); if (!add?.length) return 0;
  const app = P.app, g = await readGraph(app);
  g.colorGroups = [...(g.colorGroups || []), ...add];
  await app.vault.adapter.write(file(app), JSON.stringify(g, null, 2));
  for (const l of app.workspace.getLeavesOfType("graph")) {
    try { const de = l.view?.dataEngine; if (de?.setOptions) de.setOptions({ ...de.getOptions(), colorGroups: g.colorGroups }); } catch (e) {}
  }
  return add.length;
}

const legend = (P, sep = ", ") => GROUPS.map(([, , ro, en]) => P.T(ro, en)).join(sep);

module.exports = { GROUPS, missing, apply, mapFolder, legend };
