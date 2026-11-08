// „a” sau „an” în engleză, după cuvântul care urmează (pentru variantele unui cuvânt: „a specific” → „an anthropological”).
// Doar în text englezesc: în română „a” e alt cuvânt („a fost”), deci nu se atinge.
"use strict";

// cuvinte care încep cu vocală, dar se citesc cu consoană („a university”), și invers („an hour”)
const YOO = /^(uni(?!m|n|dent|ron)|use|usa|usu|uti|ure|urin|uro|eu|ewe|one\b|once\b|ouija)/i;
const SILENT_H = /^(hour|honest|honou?r|heir|herb(?!al|ert))/i;
const LETTER_AN = /^[AEFHILMNORSX]$/;   // literele care se citesc cu vocală: „an FBI agent”, „an MA thesis”

// „an” sau „a” pentru un cuvânt; null dacă nu e un cuvânt (semn, spațiu)
function articleFor(word) {
  const w = String(word || "").replace(/^[\s"'“‘(«*_]+/, ""); if (!w) return null;
  const m = /^[A-Za-z0-9][A-Za-z0-9'’-]*/.exec(w); if (!m) return null;
  const t = m[0];
  if (/^\d/.test(t)) return /^(8|11(?!\d)|18(?!\d)|8\d)/.test(t) ? "an" : "a";
  // o abreviere scrisă cu majuscule (FBI, MA, UN): după cum se citește prima literă
  if (t.length > 1 && t === t.toUpperCase() && /[A-Z]{2}/.test(t) && !/^[AEIOU][a-z]/.test(t)) return LETTER_AN.test(t[0]) ? "an" : "a";
  if (SILENT_H.test(t)) return "an";
  if (YOO.test(t)) return "a";
  return /^[aeiou]/i.test(t) ? "an" : "a";
}

// e englezesc paragraful? fără diacritice românești și cu cuvinte englezești obișnuite
const RO = /[ăâîșțşţĂÂÎȘȚ]|\b(și|să|că|este|sunt|pentru|care|fost|într|despre|mai|nu)\b/i;
const EN = /\b(the|and|of|is|are|to|in|that|with|for|this|it|was)\b/i;
function looksEnglish(text) { const s = String(text || ""); return !RO.test(s) && EN.test(s); }

// articolul de dinaintea poziției `at` din textul `before` (ce e înainte, pe același paragraf), dacă e „a”/„an”: { from, to, word }
function articleBefore(before) {
  const m = /(^|[^A-Za-z0-9'’-])(a|an|A|An|AN)(\s+)$/.exec(before); if (!m) return null;
  const to = before.length - m[3].length, from = to - m[2].length;
  return { from, to, word: m[2] };
}
// păstrează majusculele: „A” → „An”, „AN” → „A”
function withCase(want, old) {
  if (old === old.toUpperCase() && old.length > 1) return want.toUpperCase();
  if (old[0] === old[0].toUpperCase()) return want[0].toUpperCase() + want.slice(1);
  return want;
}
// pentru un text pus la poziția `from` într-un paragraf: schimbarea articolului de dinainte, sau null
//   para: textul paragrafului; off: unde începe paragraful în document; from: unde începe textul nou; inserted: textul nou
function fix(para, off, from, inserted) {
  if (!looksEnglish(para)) return null;
  const art = articleBefore(para.slice(0, from - off)); if (!art) return null;
  const want = articleFor(inserted); if (!want) return null;
  const put = withCase(want, art.word); if (put === art.word) return null;
  return { from: off + art.from, to: off + art.to, insert: put };
}

module.exports = { articleFor, looksEnglish, articleBefore, fix };
