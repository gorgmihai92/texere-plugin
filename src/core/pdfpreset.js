// Setările lui Texere pentru PDF++ (ca în vault-ul Texere): paleta de culori care devin etichete (fact, claim, disagree, agree,
// connection, question, definition, word), auto-copy și auto-paste pornite, formatele de copiere (citat în callout, paragraf, referință @),
// adnotările scrise în fișierul PDF, PDF-ul legat de nota de lectură prin proprietatea „attachment”.
// Se pun doar peste setările de început ale lui PDF++ (paleta lui: Yellow, Red, Note, Important): ce ți-ai setat tu rămâne.
"use strict";

const PRESET = () => require("../../assets/pdfplus-preset.json");
const ID = "pdf-plus";
const DEFAULT_COLORS = ["yellow", "red", "note", "important"];

const plugin = app => app.plugins?.plugins?.[ID] || null;
const file = app => `${app.vault.configDir || ".obsidian"}/plugins/${ID}/data.json`;

async function read(app) {
  const pp = plugin(app); if (pp?.settings) return pp.settings;
  try { const ad = app.vault.adapter, f = file(app); if (await ad.exists(f)) return JSON.parse(await ad.read(f)); } catch (e) {}
  return null;
}
// paleta lui Texere e deja acolo
const hasTexere = s => { const c = Object.keys(s?.colors || {}).map(k => k.toLowerCase()); return ["fact", "claim", "question"].every(k => c.includes(k)); };
// setările de început ale lui PDF++ (sau niciun fișier încă): aici punem setările lui Texere
const isFresh = s => !s || !s.colors || (Object.keys(s.colors).map(k => k.toLowerCase()).sort().join() === [...DEFAULT_COLORS].sort().join() && !hasTexere(s));

// e nevoie: PDF++ e instalat și are încă setările lui de început
async function needs(app) { if (!app.plugins?.manifests?.[ID]) return false; const s = await read(app); return isFresh(s); }

// pune setările; force: și peste ce e acolo (doar la cererea ta). Întoarce true dacă le-a pus.
async function apply(app, opts = {}) {
  if (!app.plugins?.manifests?.[ID]) return false;
  const cur = await read(app);
  if (!opts.force && !isFresh(cur)) return false;
  const preset = PRESET(), merged = { ...(cur || {}), ...preset, author: cur?.author || "" };
  const pp = plugin(app), ad = app.vault.adapter;
  if (pp?.settings) {
    Object.assign(pp.settings, merged);
    try { if (typeof pp.saveSettings === "function") await pp.saveSettings(); else await pp.saveData(pp.settings); } catch (e) { await ad.write(file(app), JSON.stringify(merged, null, 2)); }
    // PDF++ citește unele setări doar la pornire (iconițele auto-copy / auto-paste, bara de culori): îl repornim
    if (opts.reload !== false && app.plugins.enabledPlugins?.has(ID)) { try { await app.plugins.disablePlugin(ID); await app.plugins.enablePlugin(ID); } catch (e) { console.warn("Texere: PDF++ repornit", e); } }
  } else await ad.write(file(app), JSON.stringify(merged, null, 2));
  return true;
}

// ce înseamnă, în cuvinte (pentru pasul din configurare)
const SUMMARY = {
  ro: "culorile devin etichete (fact, claim, disagree, agree, connection, question, definition, word) · auto-copy și auto-paste pornite · formatele de copiere ale lui Texere · adnotările scrise în PDF",
  en: "colours become tags (fact, claim, disagree, agree, connection, question, definition, word) · auto-copy and auto-paste on · Texere's copy formats · annotations written into the PDF",
};

module.exports = { needs, apply, hasTexere, isFresh, SUMMARY, PRESET };
