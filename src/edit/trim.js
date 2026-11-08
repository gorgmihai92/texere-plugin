// Scurtările din meniul Lab, fără AI: propune ce se poate tăia sigur, după reguli, și doar ESTOMPEAZĂ (nu șterge nimic).
//   nivelul 1 „Slight trim”    — umplutură și intensificatori (very, really, foarte, de fapt…)
//   nivelul 2 „Tighten more”   — + ezitări și formule care nu fac nicio muncă (perhaps, it is important to note that, probabil, cu alte cuvinte…)
//   nivelul 3 „Even sharper”   — + paranteze și incise între liniuțe, conectori de adăugare la început de frază (Moreover, De asemenea,)
//   nivelul 4 „Cut in half”    — doar cu AI (mai târziu)
// Nu atinge: proprietățile de sus, titlurile, citatele (> și între ghilimele), codul, citările [@…], linkurile.
// Conectorii care poartă argumentul (therefore, thus, prin urmare, deci) rămân mereu.

const W = "[\\p{L}\\p{N}]";
const word = s => s.trim().split(/\s+/).map(x => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+");
const rx = (list, tail = "") => new RegExp(`(?<!${W})(?:${list.map(word).join("|")})${tail}(?!${W})`, "giu");

const LEVELS = [
  { kind: "filler", rxs: [
    rx(["very", "really", "quite", "just", "actually", "basically", "simply", "literally", "totally", "completely", "absolutely", "extremely", "definitely", "truly", "somewhat", "a bit", "kind of", "sort of"]),
    /(?<![\p{L}\p{N}])in order(?=\s+to(?![\p{L}\p{N}]))/giu,
    rx(["foarte", "de fapt", "pur și simplu", "pur si simplu", "absolut", "extrem de", "destul de", "oarecum", "cumva", "efectiv", "practic vorbind"]),
    /(?<![\p{L}\p{N}])chiar(?!\s+(?:dacă|daca|și|si|atunci|acum|aici)(?![\p{L}\p{N}]))(?![\p{L}\p{N}])/giu,
  ] },
  { kind: "hedge", rxs: [
    rx(["perhaps", "possibly", "probably", "maybe", "arguably", "it seems that", "it appears that", "i think that", "i believe that", "i think", "i believe", "in my opinion", "to some extent"]),
    rx(["poate că", "poate ca", "probabil", "s-ar putea ca", "se pare că", "se pare ca", "pare că", "pare ca", "cred că", "cred ca", "consider că", "consider ca", "după părerea mea", "dupa parerea mea", "într-o anumită măsură"]),
  ] },
  { kind: "stock", rxs: [
    rx(["it is important to note that", "it is worth noting that", "it should be noted that", "it goes without saying that", "needless to say", "at the end of the day", "in today's world", "as mentioned above", "as we have seen", "in other words", "the fact that", "all things considered", "last but not least"]),
    rx(["este important de menționat că", "este important de mentionat ca", "este important de subliniat că", "trebuie menționat că", "trebuie mentionat ca", "merită menționat că", "nu în ultimul rând", "nu in ultimul rand", "după cum am văzut", "dupa cum am vazut", "cu alte cuvinte", "în societatea de azi", "în zilele noastre", "la urma urmei"]),
  ] },
  { kind: "aside", rxs: [
    /\s\([^()\n\[\]@]{3,120}\)/gu,                                    // (o paranteză) — nu citări [@…] și nu linkuri
    /\s[–—]\s[^–—\n]{3,120}\s[–—](?=\s)/gu,                            // – o incisă între liniuțe –
    /(?<=^|[.!?]\s+)(?:Moreover|Furthermore|Additionally|In addition|Also|De asemenea|Mai mult|În plus|In plus|Totodată|Totodata),\s/gmu,
  ] },
];
const KINDS_AT = [[], ["filler"], ["filler", "hedge", "stock"], ["filler", "hedge", "stock", "aside"]];

function protectedRanges(line) {
  const out = []; const add = re => { let m; re.lastIndex = 0; while ((m = re.exec(line))) out.push([m.index, m.index + m[0].length]); };
  add(/`[^`]*`/g); add(/\[@[^\]]*\]/g); add(/\[\[[^\]]*\]\]/g); add(/\[[^\]]*\]\([^)]*\)/g); add(/https?:\/\/\S+/g);
  add(/"[^"\n]*"/g); add(/„[^”\n]*”/g); add(/“[^”\n]*”/g); add(/«[^»\n]*»/g);
  return out;
}

// spans: [{ from, to, kind }] în textul întreg; words: înainte / după
function trim(text, level) {
  const kinds = KINDS_AT[Math.max(0, Math.min(3, level | 0))] || [];
  const spans = []; let off = 0, fence = false, front = false, words = 0, cut = 0;
  const lines = String(text).split("\n");
  lines.forEach((line, li) => {
    const start = off; off += line.length + 1;
    if (li === 0 && line.trim() === "---") { front = true; return; }
    if (front) { if (line.trim() === "---") front = false; return; }
    if (/^\s*(```|~~~)/.test(line)) { fence = !fence; return; }
    if (fence || /^\s*(#{1,6}\s|>|\||%%)/.test(line) || !line.trim()) return;
    words += (line.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || []).length;
    const prot = protectedRanges(line), taken = [];
    const free = (a, b) => !prot.some(([f, t]) => a < t && b > f) && !taken.some(([f, t]) => a < t && b > f);
    for (const L of LEVELS) {
      if (!kinds.includes(L.kind)) continue;
      for (const re of L.rxs) {
        re.lastIndex = 0; let m;
        while ((m = re.exec(line))) {
          if (!m[0].length) { re.lastIndex++; continue; }
          let a = m.index, b = a + m[0].length;
          if (/^\s/.test(m[0])) a += m[0].match(/^\s+/)[0].length;            // fără spațiul din față al parantezei / incisei
          else if (line[b] === " ") b += 1;                                   // un cuvânt ia și spațiul de după, ca rândul să se citească fără el
          else if (a > 0 && line[a - 1] === " " && /[,.;:!?]/.test(line[b] || "")) a -= 1;
          if (b <= a || !free(a, b)) continue;
          taken.push([a, b]); spans.push({ from: start + a, to: start + b, kind: L.kind });
          cut += (line.slice(a, b).match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || []).length;
        }
      }
    }
  });
  spans.sort((x, y) => x.from - y.from);
  return { spans, before: words, after: Math.max(0, words - cut) };
}

module.exports = { trim, LEVEL_KINDS: KINDS_AT };
