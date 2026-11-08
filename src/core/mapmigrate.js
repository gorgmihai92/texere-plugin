// Harta Philosophy, de la versiunea 1 la 2 (Texere 0.4), într-un vault care o are deja: totul prin Obsidian, fără să rescrie notele.
//  • folderele: Branch → Branches, Subdomains → Subfields, Historical Periods → Periods;
//  • titlurile: Mind & Body → Mind-Body Problem, Right and wrong → Right and Wrong… (linkurile spre ele se actualizează);
//  • proprietățile, în toate notele: domain → discipline, subdomain → subfield, historical-period → period, author-links → authors;
//    „[[Author/Immanuel Kant]]” → „[[Immanuel Kant]]” (autorii au acum note, în Philosophy/Authors);
//  • aliasurile notelor hărții: scoate doar pe cele greșite sau prea generice din listă, adaugă pe cele noi; restul (și ale tale) rămân;
//  • perioadele fără date în titlu (Ancient Philosophy…), iar „Modern (17th - 19th Century)” împărțită în Early Modern Philosophy și 19th-Century Philosophy;
//  • tipurile proprietăților (.obsidian/types.json): fără cele nefolosite sau dublate.
"use strict";
const { normalizePath, TFile, TFolder } = require("obsidian");
const PLAN = {"periodSplit": {"Philosophy": ["Early Modern Philosophy", "19th-Century Philosophy"], "Marxism": ["19th-Century Philosophy"], "Positivism": ["19th-Century Philosophy"], "Kantianism": ["Early Modern Philosophy", "19th-Century Philosophy"], "Rationalism": ["Early Modern Philosophy"], "Hegelianism": ["19th-Century Philosophy"], "Romanticism": ["Early Modern Philosophy", "19th-Century Philosophy"], "Empiricism": ["Early Modern Philosophy"], "Existentialism": ["19th-Century Philosophy"], "Enlightenment": ["Early Modern Philosophy"], "Transcendentalism": ["19th-Century Philosophy"], "German Idealism": ["19th-Century Philosophy"], "Pragmatism": ["19th-Century Philosophy"]}, "fromPackage": {"Early Modern Philosophy": "From Descartes to Nietzsche: [[Rationalism|rationalism]] and [[Empiricism|empiricism]], the [[Enlightenment]], Kant, [[German Idealism|German idealism]], and the great 19th-century systems and their critics.\n\n## Sub-periods\n- **Age of Reason** (17th century): the search for certain foundations of [[Knowledge|knowledge]]: Descartes, Hobbes, Spinoza, Leibniz, Locke.\n- **Enlightenment** (18th century): reason, science and [[Rights|rights]]: Berkeley, Hume, Voltaire, Rousseau, Smith and Kant.\n- **19th century** (1800–1900): German idealism (Hegel), [[Utilitarianism|utilitarianism]] (Bentham, Mill), [[Positivism|positivism]] (Comte), Marx, Kierkegaard, Schopenhauer and Nietzsche.\n\n## Main themes\n- [[Certainty]] and the foundations of knowledge\n- Reason or experience as the source of knowledge\n- The relation between [[Mind & Body|mind and body]]\n- The [[Social Contract Theory|social contract]] and the [[Legitimacy|legitimacy]] of the state\n- The limits of reason (Kant)\n- History, [[Dialectic|dialectic]] and progress\n- The critique of religion and traditional morality\n\n## Key works\n- [[Author/Francis Bacon|Francis Bacon]], *Novum Organum* (1620)\n- [[Author/René Descartes|Descartes]], *Meditations on First Philosophy* (1641)\n- [[Author/Thomas Hobbes|Hobbes]], *Leviathan* (1651)\n- [[Author/Benedict de Spinoza|Spinoza]], *Ethics* (1677)\n- [[Author/John Locke|Locke]], *An Essay Concerning Human Understanding* (1689)\n- [[Author/Gottfried Wilhelm Leibniz|Leibniz]], *Monadology* (1714)\n- [[Author/David Hume|Hume]], *A Treatise of Human Nature* (1739–1740)\n- [[Author/Jean-Jacques Rousseau|Rousseau]], *The Social Contract* (1762)\n- [[Author/Immanuel Kant|Kant]], *Critique of Pure Reason* (1781)\n- [[Author/G. W. F. Hegel|Hegel]], *Phenomenology of Spirit* (1807)\n- [[Author/Karl Marx|Marx]] and [[Author/Friedrich Engels|Engels]], *The Communist Manifesto* (1848)\n- [[Author/John Stuart Mill|Mill]], *On Liberty* (1859)\n- [[Author/Friedrich Nietzsche|Nietzsche]], *Thus Spoke Zarathustra* (1883–1885)"}, "folders": {"Branch": "Branches", "Subdomains": "Subfields", "Historical Periods": "Periods"}, "keys": {"domain": "discipline", "subdomain": "subfield", "historical-period": "period", "author-links": "authors"}, "titles": {"Ancient (7th Century B.C - 5th Century AD)": "Ancient Philosophy", "Medieval (6th - 14th Century)": "Medieval Philosophy", "Renaissance (15th - 16th Century)": "Renaissance Philosophy", "Modern (17th - 19th Century)": "Early Modern Philosophy", "Contemporary (20th Century - Present)": "Contemporary Philosophy", "Mind & Body": "Mind-Body Problem", "Right and wrong": "Right and Wrong", "Other minds": "Other Minds", "Artificial Intelligence (AI)": "Artificial Intelligence", "Pre-Socratic": "Presocratic Philosophy", "Sophism": "Sophists"}, "authorName": {"St. Augustine": "Augustine of Hippo", "St. Thomas Aquinas": "Thomas Aquinas", "Dancu (Alexandru)": "Alexandru Dancu", "Uszkai (Radu)": "Radu Uszkai", "Voinea (Cristina)": "Cristina Voinea"}, "dropAuthors": ["Vică (Constantin)"], "aliases": {"Ethics": {"remove": ["etică"], "add": ["Etică"]}, "Causation": {"remove": ["Cauzalitate (cauzație)"], "add": ["Cauzație"]}, "Idealism": {"remove": [], "add": []}, "Compatibilism": {"remove": [], "add": ["Soft Determinism"]}, "Reliabilism": {"remove": [], "add": ["Process Reliabilism"]}, "Use Theory of Meaning": {"remove": ["Teoria semnificației ca utilizare"], "add": ["Teoria semnificației ca folosire"]}, "Relativism": {"remove": [], "add": []}, "Eudaimonism": {"remove": [], "add": ["Eudaemonism"]}, "Atheism": {"remove": [], "add": []}, "Socialism": {"remove": [], "add": []}, "Epistemic Externalism": {"remove": ["Externalism"], "add": []}, "Anarchism": {"remove": [], "add": []}, "Epistemic Internalism": {"remove": ["Internalism"], "add": []}, "Determinism": {"remove": [], "add": ["Causal Determinism", "Determinism cauzal"]}, "Renaissance Philosophy": {"remove": ["Renaștere (sec. XV – XVI)"], "add": ["Renaissance (15th - 16th Century)", "Filosofia Renașterii", "Renaștere"]}, "Ancient Philosophy": {"remove": ["Antichitate (sec. VII î.Hr. – sec. V d.Hr.)"], "add": ["Ancient (7th Century B.C - 5th Century AD)", "Antiquity", "Filosofia antică", "Antichitate"]}, "Medieval Philosophy": {"remove": ["Ev Mediu (sec. VI – XIV)"], "add": ["Medieval (6th - 14th Century)", "Middle Ages", "Filosofia medievală", "Ev Mediu"]}, "Contemporary Philosophy": {"remove": ["Contemporan (sec. XX – prezent)"], "add": ["Contemporary (20th Century - Present)", "20th-Century Philosophy", "Filosofia contemporană", "Contemporan"]}, "Early Modern Philosophy": {"remove": ["Modernitate (sec. XVII – XIX)", "Modernitate timpurie (sec. XVII – XVIII)", "Modern"], "add": ["Early Modern", "Age of Reason", "Filosofia modernă timpurie", "Modernitatea timpurie"]}, "Marxism": {"remove": [], "add": []}, "Sophists": {"remove": [], "add": ["Sophism", "Sophist"]}, "Rationalism": {"remove": [], "add": []}, "Hegelianism": {"remove": [], "add": []}, "Aristotelianism": {"remove": [], "add": []}, "Experimental Philosophy": {"remove": ["Filosofie experimentală (X-Phi)"], "add": []}, "Ordinary Language Philosophy": {"remove": ["Ordinary Language", "Limbajul obișnuit"], "add": []}, "Atomism": {"remove": [], "add": ["Atomism antic"]}, "Analytic Philosophy": {"remove": ["Analytic"], "add": []}, "Skepticism": {"remove": [], "add": []}, "Presocratic Philosophy": {"remove": [], "add": ["Pre-Socratic", "Pre-Socratics"]}, "Continental Philosophy": {"remove": ["Continental", "Continentală"], "add": []}, "Buddhist Philosophy": {"remove": [], "add": []}, "Harm": {"remove": ["Prejudiciu"], "add": ["Vătămare"]}, "Right and Wrong": {"remove": ["Bine și greșit"], "add": ["Corect și greșit"]}, "Qualia": {"remove": [], "add": ["Quale"]}, "Reference": {"remove": ["Referință"], "add": ["Referință semantică"]}, "Artificial Intelligence": {"remove": [], "add": ["AI", "Artificial Intelligence (AI)"]}, "Meaning": {"remove": [], "add": ["Sens", "Înțeles"]}, "Tabula Rasa": {"remove": ["Pagină albă"], "add": []}, "Sovereignty": {"remove": ["Sovereign", "Suveran"], "add": []}, "Arche": {"remove": [], "add": ["Archê", "Arhé"]}, "Consent": {"remove": ["content"], "add": []}, "Soundness": {"remove": ["Corectitudine (argument)", "Corectitudine"], "add": ["Argument solid", "Soliditate"]}, "Evidence": {"remove": [], "add": ["Dovadă"]}, "Moral Agency": {"remove": ["Agenție morală"], "add": ["Agentivitate morală"]}, "Dialectic": {"remove": [], "add": []}, "Well-being": {"remove": ["Bunăstare (well-being)"], "add": []}, "Universals": {"remove": ["Universal"], "add": []}, "Mind": {"remove": ["minții", "minți"], "add": []}, "Dogmatism": {"remove": [], "add": []}, "The Sublime": {"remove": ["Sublim"], "add": []}, "A Priori and A Posteriori": {"remove": [], "add": []}, "State of Nature": {"remove": ["Starea naturală"], "add": ["Starea de natură"]}, "Fallacy": {"remove": [], "add": ["Eroare logică"]}, "Belief": {"remove": ["Credință (opinie)"], "add": []}, "Mind-Body Problem": {"remove": [], "add": ["Mind & Body", "Mind and Body"]}, "Cognition": {"remove": [], "add": []}, "Apatheia": {"remove": [], "add": ["Apatie"]}, "Consciousness": {"remove": ["conștiinței"], "add": []}}};
const ORDER = ["dateCreated", "aliases", "discipline", "branch", "subfield", "period", "movements", "theories", "concepts", "authors"];
// proprietăți fără rost în .obsidian/types.json: nefolosite (era, history, periods), vechi (domain, subdomain…) sau cu tipul greșit (author: lista CSL de persoane, nu text)
const DROP_TYPES = ["era", "history", "periods", "domain", "subdomain", "historical-period", "author-links", "author"];
const LIST_TYPES = ["discipline", "branch", "subfield", "period", "movements", "theories", "concepts", "authors"];

const linkName = v => { const m = /^\[\[([^\]|#]+)/.exec(String(v || "")); return m ? m[1] : null; };
function fixLink(v) {
  let n = linkName(v); if (n == null) return v;
  if (n.startsWith("Author/")) { n = n.slice(7); if (PLAN.dropAuthors.includes(n)) return null; n = PLAN.authorName[n] || n; }
  n = PLAN.titles[n] || n;
  return `[[${n}]]`;
}
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function migrateMap2(P) {
  const app = P.app, V = app.vault, FM = app.fileManager, out = { folders: 0, titles: 0, props: 0, aliases: 0, authors: 0, types: 0, fail: [] };
  const m = (P.maps?.() || []).find(x => x.id === "philosophy"); if (!m) return out;
  const root = P.mapRoot(m), base = normalizePath(root ? `${root}/${m.folder}` : m.folder);
  if (!(V.getAbstractFileByPath(base) instanceof TFolder)) return out;
  const { parseYaml } = require("obsidian");
  const bodyOf = t => t.replace(/^---\n[\s\S]*?\n---\n?/, "").trim();
  // notele pe care le înlocuim din pachet (doar dacă textul lor e cel original, nescris de tine): ex. perioada modernă
  const fromPkg = [];
  for (const [t, body] of Object.entries(PLAN.fromPackage || {})) {
    const old = Object.keys(PLAN.titles).find(k => PLAN.titles[k] === t) || t;
    const f = V.getMarkdownFiles().find(x => x.path.startsWith(base + "/") && x.basename === old);
    if (f && bodyOf(await V.read(f)) === body) fromPkg.push(t);
  }
  // 1. folderele
  for (const [a, b] of Object.entries(PLAN.folders)) {
    const f = V.getAbstractFileByPath(`${base}/${a}`), to = `${base}/${b}`;
    if (f instanceof TFolder && !V.getAbstractFileByPath(to)) { try { await FM.renameFile(f, to); out.folders++; } catch (e) { out.fail.push(`${a}: ${e.message}`); } }
  }
  // 2. titlurile (linkurile din text se repară după proprietăți, la pasul 3b)
  const notes = () => V.getMarkdownFiles().filter(f => f.path.startsWith(base + "/")), renamed = [];
  for (const [a, b] of Object.entries(PLAN.titles)) {
    const f = notes().find(x => x.basename === a); if (!f || notes().some(x => x.basename === b)) continue;
    try { await FM.renameFile(f, normalizePath(`${f.parent.path}/${b}.md`)); out.titles++; renamed.push([a, b]); } catch (e) { out.fail.push(`${a}: ${e.message}`); }
  }
  // 3. proprietățile, în toate notele (doar unde e ceva de schimbat)
  const OLD = Object.keys(PLAN.keys), oldTitles = Object.keys(PLAN.titles);
  // după redenumiri, indexul lui Obsidian poate întârzia: citim textul notei, nu indexul
  await new Promise(r => setTimeout(r, 1500));
  const oldKey = new RegExp(`^(${OLD.map(esc).join("|")}):`, "m");
  for (const f of V.getMarkdownFiles()) {
    let head = ""; try { const t = await V.cachedRead(f); const mm = /^---\n([\s\S]*?)\n---/.exec(t); head = mm ? mm[1] : ""; } catch (e) { continue; }
    if (!head || (!oldKey.test(head) && !head.includes("[[Author/") && !oldTitles.some(t => head.includes(`[[${t}]]`)))) continue;
    try {
      await FM.processFrontMatter(f, o => {
        const entries = Object.entries(o).map(([k, v]) => [PLAN.keys[k] || k, Array.isArray(v) && k !== "aliases" ? v.map(fixLink).filter(x => x != null) : (typeof v === "string" && k !== "aliases" ? fixLink(v) : v)]);
        for (const k of Object.keys(o)) delete o[k];
        const map = new Map(); for (const [k, v] of entries) { if (map.has(k) && Array.isArray(map.get(k)) && Array.isArray(v)) map.set(k, [...new Set([...map.get(k), ...v])]); else if (!map.has(k)) map.set(k, v); }
        // ordinea hărții doar pentru notele ei; celelalte (ex. notele de lectură) își păstrează ordinea, cu cheile redenumite pe loc
        const own = f.path.startsWith(base + "/"), keys = own ? [...ORDER.filter(k => map.has(k)), ...[...map.keys()].filter(k => !ORDER.includes(k))] : [...map.keys()];
        for (const k of keys) o[k] = map.get(k);
      });
      out.props++;
    } catch (e) { out.fail.push(`${f.path}: ${e.message}`); }
  }
  // 3b. linkurile din text spre titlurile vechi (dacă Obsidian nu le-a actualizat deja): [[Mind & Body]] → [[Mind-Body Problem|Mind & Body]]
  for (const [a, b] of renamed) {
    const same = a.toLowerCase() === b.toLowerCase(), rx = new RegExp(`\\[\\[${esc(a)}(\\]\\]|\\|)`, "g");
    for (const g of V.getMarkdownFiles()) {
      const t = await V.cachedRead(g); if (!t.includes(`[[${a}`)) continue;
      try { await V.process(g, s => s.replace(rx, (all, end) => end === "|" ? `[[${b}|` : (same ? `[[${b}]]` : `[[${b}|${a}]]`))); } catch (e) { out.fail.push(`${g.path}: ${e.message}`); }
    }
  }
  // 3c. linkurile spre autori din text: [[Author/Immanuel Kant|Kant]] → [[Immanuel Kant|Kant]]
  for (const g of V.getMarkdownFiles()) {
    const t = await V.cachedRead(g); if (!t.includes("[[Author/")) continue;
    try { await V.process(g, s => s.replace(/\[\[Author\/([^\]|#]+)(\||\]\])/g, (all, n, end) => `[[${PLAN.authorName[n] || n}${end}`)); } catch (e) { out.fail.push(`${g.path}: ${e.message}`); }
  }
  // 3d. perioada modernă, împărțită: fiecare notă care o avea primește perioada (sau perioadele) potrivite
  for (const [t, pers] of Object.entries(PLAN.periodSplit || {})) {
    const f = notes().find(x => x.basename === t); if (!f) continue;
    try {
      await FM.processFrontMatter(f, o => {
        if (!Array.isArray(o.period)) return;
        const per = [];
        for (const x of o.period) for (const y of (String(x) === "[[Early Modern Philosophy]]" ? pers.map(p => `[[${p}]]`) : [String(x)])) if (!per.includes(y)) per.push(y);
        o.period = per;
      });
    } catch (e) { out.fail.push(`${t}: ${e.message}`); }
  }
  // 4. aliasurile notelor hărții
  for (const [t, ch] of Object.entries(PLAN.aliases)) {
    const f = notes().find(x => x.basename === t); if (!f) continue;
    try {
      await FM.processFrontMatter(f, o => {
        let al = Array.isArray(o.aliases) ? o.aliases.map(String) : o.aliases ? [String(o.aliases)] : [];
        const before = JSON.stringify(al);
        al = al.filter(a => !ch.remove.includes(a));
        for (const a of ch.add) if (a.toLowerCase() !== t.toLowerCase() && !al.some(x => x.toLowerCase() === a.toLowerCase())) al.push(a);
        const seen = new Set([t.toLowerCase()]); al = al.filter(a => { const k = a.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });   // fără titlul însuși și fără dubluri de majuscule
        if (JSON.stringify(al) !== before) { o.aliases = al; out.aliases++; }
      });
    } catch (e) { out.fail.push(`${t}: ${e.message}`); }
  }
  // 5. tipurile proprietăților
  try {
    const M = app.metadataTypeManager;
    if (M) {
      for (const k of DROP_TYPES) if (M.types?.[k] || M.properties?.[k]) { try { if (typeof M.unsetType === "function") M.unsetType(k); else { delete M.types[k]; } out.types++; } catch (e) {} }
      for (const k of LIST_TYPES) { try { if (typeof M.setType === "function") M.setType(k, "multitext"); } catch (e) {} }
      if (typeof M.save === "function") await M.save();
    }
  } catch (e) { out.fail.push("types: " + e.message); }
  // 5b. notele înlocuite din pachet (perioada modernă timpurie), cu aliasurile tale păstrate
  if (fromPkg.length) {
    const d = await P.mapData(m);
    for (const t of fromPkg) {
      const rel = Object.keys(d.files).find(k => k.endsWith(`/${t}.md`)), f = notes().find(x => x.basename === t); if (!rel || !f) continue;
      try {
        const mine = (app.metadataCache.getFileCache(f)?.frontmatter?.aliases || []).map(String);
        await V.modify(f, d.files[rel]);
        await FM.processFrontMatter(f, o => { const al = Array.isArray(o.aliases) ? o.aliases.map(String) : []; for (const a of mine) if (a.toLowerCase() !== t.toLowerCase() && !al.some(x => x.toLowerCase() === a.toLowerCase()) && !(PLAN.aliases[t]?.remove || []).includes(a)) al.push(a); o.aliases = al; });
        out.replaced = (out.replaced || 0) + 1;
      } catch (e) { out.fail.push(`${t}: ${e.message}`); }
    }
  }
  // 6. notele care lipsesc (autorii, secolul al XIX-lea): doar cele noi, nimic suprascris
  try { out.authors = await P.createMap(m); } catch (e) { out.fail.push("authors: " + e.message); }
  return out;
}

module.exports = { migrateMap2, PLAN };
