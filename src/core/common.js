// Texere · ce folosesc împreună Ajutorul, plierea ghidurilor și configurarea (fostele scripturi din vault):
// limba aleasă, ghidurile (găsite și după redenumire) și legăturile spre restul pluginului.
"use strict";

// ---------- limba (ro / en): aceeași alegere în tot Texere ----------
const LANG_KEY = "texere-lang";
const getLang = app => {
  try { const s = app.loadLocalStorage(LANG_KEY); if (s === "ro" || s === "en") return s; } catch (e) {}
  let l = ""; try { l = window.localStorage.getItem("language") || navigator.language || ""; } catch (e) {}
  return !l || /^ro/i.test(l) ? "ro" : "en";
};
const setLang = (app, l) => { try { app.saveLocalStorage(LANG_KEY, l); } catch (e) {} };
// un text în ambele limbi: { ro, en } → textul în limba cerută
const tx = (m, lg) => m == null ? "" : typeof m === "string" ? m : (m[lg] != null ? m[lg] : m.ro);


// ---------- legăturile spre restul Texere (pluginul unit; pe rând, cu rezervă pentru pluginurile vechi separate) ----------
// comenzile vechi „texere-sources:x”, „texere-export:x”, „texere-insights:x” sunt acum „texere:x”
const cmdId = (plugin, id) => {
  if (typeof plugin.commandId === "function") { const r = plugin.commandId(id); if (r) return r; }
  return String(id).replace(/^texere-(sources|export|insights):/, "texere:");
};
// setările: tab-urile vechi ale pluginurilor Texere sunt acum secțiuni ale tab-ului Texere
const SECTION = { "texere": null, "texere-sources": "sources", "texere-export": "export", "texere-insights": "insights" };
const openSettings = (plugin, tab) => {
  const app = plugin.app;
  try {
    if (tab in SECTION) {
      if (typeof plugin.openSettings === "function") return plugin.openSettings(SECTION[tab] || undefined);
      app.setting.open(); app.setting.openTabById(plugin.manifest?.id || "texere"); return;
    }
    app.setting.open(); app.setting.openTabById(tab);
  } catch (e) {}
};
const sourcesApi = plugin => {
  try { if (typeof plugin.sourcesApi === "function") return plugin.sourcesApi() || null; } catch (e) {}
  return plugin.sources || plugin.app.plugins?.plugins?.["texere-sources"]?.sources || null;
};
// setările exportului: { settings, save() } — din pluginul unit sau din pluginul vechi Texere · Export
const exportStore = plugin => {
  try { if (typeof plugin.exportStore === "function") { const s = plugin.exportStore(); if (s) return s; } } catch (e) {}
  const xp = plugin.app.plugins?.plugins?.["texere-export"];
  if (!xp) return null;
  xp.settings = xp.settings || {};
  return { settings: xp.settings, save: () => xp.saveData(xp.settings) };
};
const basePath = app => { const a = app.vault.adapter; return a.getBasePath ? a.getBasePath() : a.basePath; };

module.exports = { LANG_KEY, getLang, setLang, tx, cmdId, openSettings, sourcesApi, exportStore, basePath };
