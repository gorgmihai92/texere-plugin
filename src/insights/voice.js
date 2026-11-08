// Texere · Insights · cum scrii: punctul de plecare (câteva texte alese de tine) și ce s-a schimbat de atunci.
// Doar semnale pe care calculatorul le poate număra sigur (cel puțin 8 din 10 corecte), fără AI, fără scor:
// lungimea și varietatea propozițiilor, cuvintele tale față de citate, citările, mărcile raționamentului
// (pentru că / prin urmare / de exemplu / totuși / la fel ca), cât nuanțezi și cât afirmi apăsat, persoana I,
// cuvintele repetate aproape unele de altele, teza și obiecțiile spuse explicit.
// Pentru scrisul filosofic (după ghidurile citate în Primii pași în filosofie: Pryor, Rippon, Huemer, Millgram, Cartaya, Tooley…): teza spusă devreme, termenii definiți,
// obiecțiile la care răspunzi, experimentele mentale și contraexemplele, indicatoarele („voi începe prin…”),
// începuturile grandioase („de-a lungul istoriei…”, definiția din dicționar) și cuvintele pe care filosofii le folosesc
// precis („afirmație validă”, „argument adevărat”, „begs the question of”, „e logic că”, „textul deduce”).
// Se măsoară doar proza ta: fără liste, citate, titluri, cod; în notele în care ai scris tu (nu ai lipit).
const { Modal, Notice, TFile, MarkdownView } = require("obsidian");
const { fold, el } = require("../shared/util");
const TOK = /[\p{L}\p{N}]+(?:[-'’.][\p{L}\p{N}]+)*/gu;

// ——— mărcile, pe limbi (fără diacritice; se caută ca expresii întregi) ———
const M = {
  en: {
    reason: ["because", "given that", "due to the fact that", "for the reason that", "owing to the fact", "in view of the fact", "inasmuch as", "since", "after all", "on the grounds that", "the reason is that", "the reason for this is", "for one thing", "in light of the fact that"],
    concl: ["therefore", "thus", "hence", "consequently", "it follows that", "as a result", "for this reason", "that is why", "this is why", "which means that", "so", "accordingly", "in conclusion", "this shows that", "which shows that", "this means that", "which implies that", "which entails that", "we can conclude", "we may conclude", "we must conclude", "one can conclude", "we conclude that", "i conclude that", "the conclusion is that", "for these reasons", "it follows from this"],
    example: ["for example", "for instance", "e.g", "such as", "to illustrate", "a case in point", "take the case of", "an example of", "another example", "a good example", "to take an example", "to give an example", "one example is", "take as an illustration"],
    contrast: ["however", "but", "although", "even though", "even if", "whereas", "nevertheless", "nonetheless", "on the other hand", "in contrast", "by contrast", "instead", "despite", "in spite of", "yet", "conversely", "on the contrary", "though", "still", "even so", "that said", "having said that", "admittedly", "notwithstanding", "unlike", "rather than", "albeit"],
    analogy: ["similarly", "likewise", "just as", "in the same way", "analogously", "analogous to", "similar to", "similar with", "much like", "akin to", "in a similar way", "in a similar fashion", "in a similar manner", "by analogy", "an analogy", "analogy with", "analogy between", "comparable to", "the same is true of", "the same holds for", "the same applies to", "so too", "as is the case with"],
    hedge: ["perhaps", "possibly", "probably", "maybe", "might", "may", "it seems", "seems to", "seem to", "appears to", "appear to", "it appears", "arguably", "somewhat", "to some extent", "to a certain extent", "likely", "unlikely", "presumably", "apparently", "i think", "i believe", "tend to", "tends to"],
    commit: ["clearly", "obviously", "undoubtedly", "definitely", "without doubt", "no doubt", "evidently", "it is clear that", "it is evident that", "it is obvious that", "indisputably", "unquestionably", "surely", "this proves", "which proves", "proves that", "i have proved", "i have proven", "i will prove", "it is proven", "it has been proven", "conclusively refuted"],
    first: ["me", "my", "mine", "myself", "in my view"],
    thesis: ["i argue", "i will argue", "i shall argue", "i claim that", "i contend", "my thesis", "my argument is", "my claim is", "this essay argues", "this paper argues", "this chapter argues", "this article argues", "i will show", "i aim to show", "i defend the view", "i want to argue", "i propose that", "we argue that", "we will argue", "we shall argue", "we will show that", "we shall show that"],
    objection: ["one might object", "one could object", "one may object", "it might be objected", "it could be objected", "it may be objected", "an objection", "one objection", "this objection", "the objection that", "critics argue", "critics might", "critics would", "critics may", "some might argue", "some would argue", "some may argue", "some might say", "it could be argued", "it might be argued", "it may be argued", "a counterargument", "counter-argument", "counterargument", "opponents argue"],
    stance: ["in my view", "my view is", "i would say", "i suggest", "i hold that", "i maintain", "i doubt", "i agree", "i disagree", "my position is"],
    opinion: ["i feel", "i feel that", "in my opinion", "in my personal opinion", "my personal opinion", "my opinion is", "i personally", "personally", "i strongly believe", "i strongly feel", "just my opinion"],
    stock: ["delve", "delves", "delving", "shed light on", "sheds light on", "shedding light on", "basically", "incredibly", "totally", "it is important to note", "it is worth noting", "it should be noted", "needless to say", "in today's society", "in this day and age", "at the end of the day", "plays a crucial role", "plays a key role", "plays a vital role"],
    thought: ["suppose", "imagine", "suppose that", "imagine that", "imagine a", "imagine someone", "let us imagine", "let's imagine", "consider the case", "consider a case", "consider someone", "thought experiment", "thought-experiment", "counterexample", "counter-example", "a case in which", "a case where"],
    signpost: ["i will begin by", "i begin by", "i will start by", "i will first", "first i will", "next i will", "then i will", "i will then", "in what follows", "in this paper", "in this essay", "in this section", "in the next section", "in section", "before i say", "before i turn", "before i discuss", "before i explain", "before i argue", "before i answer", "before i consider", "i now turn to", "i turn now to", "let me turn to", "let us turn to", "i will conclude", "to conclude", "further support for", "i have argued", "so far i have", "having shown", "having argued", "my plan is", "the rest of this paper", "this paper is structured", "i will now", "i shall now"],
    define: ["i mean by", "what i mean by", "i use the term", "i will use the term", "i use the word", "i will use the word", "i will call", "let us call", "let's call", "call this", "i define", "is defined as", "can be defined as", "in the sense of"],
    reply: ["in reply", "i reply", "my reply", "in response", "my response", "i respond", "to this i", "this objection fails", "the objection fails", "this objection misses", "this objection rests on", "this objection overlooks", "i grant that", "even if we grant", "even if we assume", "even if this is true", "even if this is right", "the problem with this objection", "this does not show", "but this does not show"],
    opening: ["since the dawn of time", "since the beginning of time", "from the beginning of time", "throughout history", "throughout human history", "down through the ages", "since time immemorial", "for centuries", "for thousands of years", "humans have always", "people have always", "man has always", "mankind has always", "philosophers have always", "according to the dictionary", "the dictionary defines", "dictionary defines", "merriam-webster", "oxford english dictionary", "webster's dictionary"],
    attrib: /\b(according to|argues that|claims that|says that|writes that|believes that|thinks that|maintains that|holds that|suggests that|insists that|in (?:his|her|their) view)\b/,
  },
  ro: {
    reason: ["pentru ca", "deoarece", "intrucat", "fiindca", "dat fiind ca", "avand in vedere ca", "din moment ce", "din cauza ca", "din cauza", "datorita faptului ca", "caci", "de vreme ce", "pe motiv ca", "motivul este ca", "ca urmare a", "datorita", "avand in vedere", "dat fiind faptul", "tinand cont de", "tinand cont ca", "tinand seama de", "pornind de la faptul ca", "din pricina"],
    concl: ["prin urmare", "asadar", "in consecinta", "rezulta ca", "de aceea", "din acest motiv", "ceea ce inseamna ca", "astfel ca", "in concluzie", "deci", "de aici rezulta", "rezulta de aici", "de unde rezulta", "ceea ce arata ca", "aceasta arata ca", "asta arata ca", "acest lucru arata ca", "ceea ce implica faptul ca", "asta inseamna ca", "aceasta inseamna ca", "acest lucru inseamna ca", "putem conchide", "putem concluziona", "concluzia este ca", "drept urmare", "ca urmare", "iata de ce", "din aceste motive"],
    example: ["de exemplu", "de pilda", "spre exemplu", "cum ar fi", "bunaoara", "sa luam cazul", "un exemplu", "ca exemplu", "drept exemplu", "un bun exemplu", "spre ilustrare", "pentru a ilustra", "sa luam exemplul", "exemplul lui", "exemplul cu"],
    contrast: ["dar", "insa", "totusi", "desi", "cu toate acestea", "pe de alta parte", "in schimb", "spre deosebire de", "in ciuda", "ci", "or", "cu toate ca", "chiar daca", "in pofida", "dimpotriva", "din contra", "numai ca", "doar ca", "in timp ce", "pe cand", "chiar si asa"],
    analogy: ["la fel ca", "la fel cum", "asemenea lui", "asemenea unui", "asemenea unei", "in mod similar", "similar cu", "similara cu", "similare cu", "similari cu", "in acelasi fel", "analog cu", "intocmai ca", "in mod analog", "prin analogie", "asemanator cu", "asemanatoare cu", "asemanatori cu", "la fel si", "tot astfel", "tot asa", "in acelasi mod", "intocmai cum", "analogia cu", "o analogie", "analogie cu", "analogia dintre"],
    hedge: ["poate ca", "s-ar putea ca", "s-ar putea spune", "probabil", "este posibil", "e posibil", "posibil ca", "pare ca", "se pare", "pare sa", "oarecum", "intr-o anumita masura", "intr-o oarecare masura", "as spune", "mi se pare", "cred ca", "aparent", "presupun", "s-ar parea"],
    commit: ["este evident", "e evident", "evident ca", "in mod evident", "fara indoiala", "cu siguranta", "este clar ca", "e clar ca", "in mod clar", "indiscutabil", "incontestabil", "cu certitudine", "categoric", "dovedeste ca", "am dovedit", "voi dovedi", "este dovedit", "am demonstrat", "voi demonstra", "demonstreaza ca", "este limpede ca", "evident"],
    first: ["eu", "meu", "mea", "mei", "mele", "mie", "mi se pare", "ma gandesc", "as spune", "argumentez", "consider", "cred ca", "sustin ca", "propun sa", "voi arata", "voi argumenta", "voi sustine", "am aratat", "imi propun"],
    thesis: ["sustin ca", "voi argumenta", "voi sustine", "argumentez ca", "teza mea", "argumentul meu", "in acest eseu sustin", "lucrarea de fata sustine", "voi arata ca", "imi propun sa arat", "apar ideea", "sustin ideea", "vom arata ca", "vom sustine ca", "vom argumenta"],
    objection: ["s-ar putea obiecta", "ar putea obiecta", "s-ar putea spune ca", "o obiectie", "aceasta obiectie", "obiectia ca", "criticii ar putea", "criticii sustin", "criticii ar spune", "unii ar putea spune", "unii ar spune", "unii sustin", "s-ar putea argumenta", "un contraargument", "contraargumentul"],
    stance: ["consider ca", "as spune", "ma indoiesc", "sunt de acord", "nu sunt de acord", "pozitia mea este", "eu sustin"],
    opinion: ["simt ca", "dupa parerea mea", "in opinia mea", "parerea mea este", "parerea mea personala", "eu personal", "personal", "dupa mine"],
    stock: ["este important de mentionat", "este important de subliniat", "trebuie mentionat ca", "merita mentionat", "in societatea de azi", "in societatea actuala", "nu in ultimul rand", "joaca un rol crucial", "joaca un rol esential", "joaca un rol cheie"],
    thought: ["sa presupunem", "presupunem ca", "sa ne imaginam", "imaginati-va", "imagineaza-ti", "experiment mental", "experimentul mental", "experiment de gandire", "contraexemplu", "contraexemplul", "contra-exemplu", "un caz in care", "sa consideram cazul"],
    signpost: ["voi incepe prin", "incep prin", "mai intai voi", "in primul rand voi", "apoi voi", "in continuare voi", "in cele ce urmeaza", "in aceasta lucrare", "in acest eseu", "in aceasta sectiune", "in sectiunea urmatoare", "in sectiunea", "inainte de a trece", "inainte de a discuta", "inainte de a arata", "inainte de a raspunde", "trec acum la", "sa trecem la", "voi incheia", "pentru a incheia", "pana acum am", "am argumentat", "dupa ce am aratat", "planul meu", "restul lucrarii", "lucrarea este structurata", "in capitolul urmator", "in acest capitol"],
    define: ["inteleg prin", "folosesc termenul", "voi folosi termenul", "folosesc cuvantul", "voi folosi cuvantul", "voi numi", "sa numim", "numesc", "definesc", "este definit ca", "este definita ca", "poate fi definit ca", "in sensul de", "termenul desemneaza"],
    reply: ["raspunsul meu", "ca raspuns", "raspund ca", "la aceasta raspund", "as raspunde", "aceasta obiectie nu", "obiectia nu", "obiectia aceasta nu", "admit ca", "concedez ca", "chiar daca admitem", "chiar daca acceptam", "chiar daca presupunem", "problema cu aceasta obiectie", "asta nu arata ca", "aceasta nu arata ca", "obiectia trece cu vederea"],
    opening: ["dintotdeauna", "de-a lungul istoriei", "de-a lungul timpului", "din cele mai vechi timpuri", "de la inceputurile omenirii", "de la inceputul timpurilor", "inca din antichitate", "de secole", "de mii de ani", "oamenii s-au intrebat", "conform dictionarului", "dictionarul defineste", "dex", "dexonline", "potrivit dex"],
    attrib: /\b(potrivit lui|conform lui|in opinia (?:lui|ei|lor)|dupa parerea (?:lui|ei|lor)|zice|spune ca|afirma ca|sustine ca|crede ca|considera ca|argumenteaza ca|scrie ca|arata ca)\b/,
  },
};
// „cred că”, „susțin că”, „propun”: la persoana I doar fără un subiect la persoana a III-a înainte (ei cred că = ei, nu tu)
const THIRD = new Set(["care", "ei", "ele", "acestia", "acestea", "autorii", "unii", "multi", "criticii", "filosofii", "cercetatorii", "oamenii", "toti", "altii", "adeptii", "sustinatorii", "el", "ea"]);
const AMBIG_RO = new Set(["cred ca", "sustin ca", "propun sa", "numesc", "definesc", "admit ca"]);
const KINDS = ["reason", "concl", "example", "thought", "contrast", "analogy", "signpost", "hedge", "commit", "first", "opinion", "stock"];
const EXTRA = ["thesis", "objection", "define", "reply", "opening", "stance"];
// ce face un paragraf: cine vorbește (alții), ce analizează (concepte), ce ilustrează (exemple) — după cuvinte, fără diacritice
// verbele cu care relatezi un autor: cele „de dezbatere” (argumentează, susține, respinge) contează oricum;
// cele „de gând și vorbă” (crede, spune, scrie) doar după un nume propriu („Descartes crede că…”), nu în exemple („El crede că e amiază”)
const ATTR = {
  en: / (argues|argued|claims that|claimed that|maintains|maintained|insists|insisted|contends|contended|asserts|asserted|proposes|proposed that|defends|defended|rejects|rejected|denies|denied|criticizes|criticises|criticized|criticised|according to|in (his|her|their) view|on (his|her|their) view) /,
  ro: / (sustine|a sustinut|afirma|a afirmat|argumenteaza|a argumentat|propune|a propus|respinge|a respins|neaga|a negat|critica pe|criticat|il critica|o critica|potrivit lui|potrivit ei|conform lui|conform ei|in opinia (lui|ei|lor)|dupa parerea (lui|ei|lor)) /,
};
const ATTR_WEAK = {
  en: ["believes", "believed", "thinks", "says", "said", "writes", "wrote", "observes", "observed", "suggests", "suggested", "notes", "noted", "mentions", "mentioned", "describes", "described", "explains", "explained"],
  ro: ["crede", "credea", "considera", "spune", "spunea", "zice", "scrie", "scria", "observa", "noteaza", "mentioneaza", "descrie", "explica"],
};
const AUTHOR_SUBJ = new Set(["author", "authors", "autorul", "autoarea", "autorii"]);
const PRON = new Set(["he", "she", "it", "they", "we", "i", "you", "one", "el", "ea", "ei", "ele", "noi", "voi", "eu", "tu", "cineva", "nimeni"]);
// cine e relatat într-o propoziție: verbul de relatare găsit, sau null
function attribution(sent, lang) {
  const raw = sent.match(TOK) || [], tok = raw.map(fold), tj = " " + tok.join(" ") + " ", strong = ATTR[lang].exec(tj); if (strong) return strong[1];
  for (let i = 1; i < tok.length; i++) if (ATTR_WEAK[lang].includes(tok[i]) && ((/^\p{Lu}/u.test(raw[i - 1]) && !PRON.has(tok[i - 1])) || AUTHOR_SUBJ.has(tok[i - 1]))) return tok[i];
  return null;
}
const ANALYSIS = {
  en: / (distinguish between|distinction between|a distinction|the difference between|in the sense (of|that)|two senses|different senses|necessary condition|sufficient condition|necessary and sufficient|if and only if|consists in|what it is (for|to)|by definition|is defined as|be defined|means to|is called|are called|we call|is the (doctrine|view|theory|position|thesis) (that|of)|an? (kind|type|form|species) of|are (kinds|types|forms) of|is categori[sz]ed as|falls under|the concept of|the notion of) /,
  ro: / (distinge intre|distinctia dintre|distinctie intre|o distinctie|diferenta dintre|diferenta intre|deosebirea dintre|in sensul|doua sensuri|sensuri diferite|conditie necesara|conditie suficienta|conditia necesara|conditia suficienta|necesar si suficient|daca si numai daca|consta in|ce inseamna (sa|a)|inseamna (sa|a)|prin definitie|este definit|este definita|fi definit|fi definita|se numeste|se numesc|sunt numite|este numit|este numita|numim|este (doctrina|teoria|conceptia|pozitia|teza) (ca|care|potrivit)|este un (tip|fel) de|este o (forma|specie) de|se incadreaza in|tipuri de|feluri de|conceptul de|notiunea de) /,
};
const TYPES = ["argue", "present", "analyse", "illustrate", "none"];
// tipul paragrafului, în ordinea de mai jos (prima regulă care se potrivește):
// 1. o poziție a ta spusă explicit (teză, obiecție, răspuns, „cred că”) → argumentezi
// 2. relatezi pe altcineva („X susține că”, „potrivit lui”), fără „eu” → prezinți alți autori; la fel dacă jumătate e citat
// 3. definiții, distincții, condiții, mai multe decât motivele → analizezi concepte
// 4. motive sau concluzii → argumentezi;  5. exemple, experimente mentale → ilustrezi
// 6. doar citări → prezinți alți autori;  altfel: fără mărci clare (descriere, narațiune sau argument nespus)
function paraType(f) {
  if (f.S > 0) return "argue";
  if ((f.A > 0 && f.F === 0) || f.Q >= 0.5) return "present";
  if (f.D > 0 && f.D >= f.R) return "analyse";
  if (f.R > 0) return "argue";
  if (f.X > 0) return "illustrate";
  if (f.C > 0) return "present";
  return "none";
}
const RO_FN = new Set(["si", "in", "ca", "este", "nu", "pe", "cu", "care", "pentru", "sunt", "mai", "din", "la", "se", "un", "o", "sa", "ce", "sau", "dar", "fi", "au", "lui", "ei", "acest", "aceasta"]);
const EN_FN = new Set(["the", "and", "of", "to", "is", "that", "in", "it", "for", "not", "with", "as", "are", "be", "this", "on", "but", "or", "by", "which", "was", "an", "have", "from"]);
const STOP = new Set(("which there their would could should about these those being where while other every because however something nothing anything everything another before after again against between through during without within among under above below since until still first second third people really always never often" +
  " pentru acest aceasta aceste acestea acesta acestui acestei despre dintre dupa fiind foarte toate toata toti unei unui trebuie astfel atunci acolo fiecare orice nimic cineva ceva cumva decat pana intre catre asupra fara impreuna aceeasi acelasi acele acela aceea cand unde dacă daca nici chiar inca doar totul prea mult multe multi putin numai").split(" "));
const ABBR = /\b(e\.g|i\.e|cf|p|pp|nr|dr|etc|vs|vol|ed|art|fig|ex|resp|aprox|prof|univ|op|ibid|sec|d\.hr|î\.hr|ș\.a|s\.a)\./gi;

// un text Markdown → paragrafele de proză (cu rândul lor) și cuvintele din citate/blocuri citate
function proseOf(md) {
  const lines = String(md || "").split("\n"); let i0 = 0;
  if (lines[0] === "---") { const e = lines.indexOf("---", 1); if (e > 0) i0 = e + 1; }
  const paras = [], blocks = []; let cur = null, fence = false, quotedBlock = 0, blk = null;
  const end = () => { if (cur) { paras.push(cur); cur = null; } };
  const endB = () => { if (blk) { blocks.push(blk); blk = null; } };
  for (let i = i0; i <= lines.length; i++) {
    const l = i < lines.length ? lines[i] : "";
    if (/^\s*(```|~~~)/.test(l)) { fence = !fence; end(); continue; }
    if (fence) continue;
    if (!l.trim() || /^#{1,6}\s/.test(l) || /^\s*(\||---+\s*$|\*\*\*+\s*$)/.test(l)) { end(); continue; }
    if (/^\s*>/.test(l)) { end(); const t = l.replace(/^\s*>\s?(\[![^\]]*\][+-]?)?/, ""), n = words(t).length; quotedBlock += n; if (!blk) blk = { line: i, n: 0, text: "" }; blk.n += n; blk.text += (blk.text ? " " : "") + t.trim(); continue; }
    endB();
    if (/^\s*([-*+]|\d+[.)])\s/.test(l)) { end(); continue; }   // listele nu sunt proză (notițe de curs, enumerări)
    if (!cur) cur = { line: i, raw: [] };
    cur.raw.push(l);
  }
  endB();
  return { paras: paras.map(p => ({ line: p.line, raw: p.raw.join(" ") })), quotedBlock, blocks };
}
function words(s) { return String(s || "").match(/\p{L}[\p{L}\p{M}'’-]*/gu) || []; }
// curățarea unui paragraf: linkuri → textul lor, fără încorporări, cod, URL-uri, etichete, comentarii, marcaje
function clean(raw) {
  return raw.replace(/%%[\s\S]*?%%|<!--[\s\S]*?-->/g, " ").replace(/!\[\[[^\]]*\]\]/g, " ").replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g, "$1").replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/`[^`]*`/g, " ").replace(/https?:\/\/\S+/g, " ").replace(/\[\^[^\]]*\]/g, " ").replace(/<[^>]+>/g, " ")
    .replace(/(^|\s)#[\p{L}\p{N}_/\-]+/gu, " ").replace(/==|\*\*|__|(?<!\w)[*_](?=\S)|(?<=\S)[*_](?!\w)/g, "").replace(/\s+/g, " ").trim();
}
const QUOTE = /„[^”"]{1,800}?[”"]|“[^”]{1,800}?”|«[^»]{1,800}?»|"[^"\n]{1,800}?"/g;
// limba paragrafului, după cuvintele mărunte (și, în, că / the, of, is); literele românești doar cântăresc puțin în plus
// (un nume propriu românesc într-un paragraf englezesc nu-l face românesc)
function langOf(s) {
  let r = 0, e = 0;
  for (const raw of String(s).match(TOK) || []) { const t = fold(raw); if (RO_FN.has(t)) r++; if (EN_FN.has(t)) e++; if (/[ăâîșşțţ]/i.test(raw)) r += 0.5; }
  return r > e ? "ro" : "en";
}
function sentences(text) {
  const prot = text.replace(ABBR, m => m.replace(/\./g, "․"));
  return prot.split(/(?<=[.!?…])["”»)]?\s+(?=["„“«(]?[\p{Lu}\p{N}])/u).map(s => s.replace(/․/g, ".").trim()).filter(s => /\p{L}/u.test(s));
}
// o expresie din listă, în propoziție: pozițiile în care apare (ca cuvinte întregi)
function findAll(tokens, phrase) {
  const p = phrase.split(" "), out = [];
  for (let i = 0; i + p.length <= tokens.length; i++) { let ok = true; for (let k = 0; k < p.length; k++) if (tokens[i + k] !== p[k]) { ok = false; break; } if (ok) out.push(i); }
  return out;
}
// mărcile unei propoziții (fără citate), după limbă și regulile de precizie
// cuvinte după „since” care îl fac temporal („since then”, „since 1990”, „since the war”), nu cauzal
const SINCE_NOT = new Set(["then", "when", "about", "around", "last", "before", "after", "ancient", "antiquity", "childhood", "birth", "yesterday", "today", "long"]);
const TIME_N = new Set("beginning start time times days dawn war wars age ages century centuries decade decades year years advent rise fall death end publication appearance middle invention emergence era period renaissance enlightenment introduction early late childhood youth birth then reign revolution founding creation".split(" "));
const DET = new Set("his her their its my our your the that this those these".split(" "));
// după „so” concluziv vine un subiect („so we…”, „, so the…”); nu „so far”, „so-called”, „so much”, „and so on”
const SO_SUBJ = new Set("we it the this that there i you they he she one a an any no his her their our its these those such all both each".split(" "));
const SO_NOT = new Set(["far", "called", "much", "many", "long", "as", "that", "on", "forth", "to", "too", "be", "do", "does", "did"]);
const ACC_PREV = new Set(["act", "acts", "acted", "behave", "behaves", "adjust", "respond", "change", "vary", "varies", "differ", "treat", "treated", "named", "modified"]);
// „voi arăta că”, „voi susține că”, „aș spune că”, „aceasta arată că” sunt vocea ta, nu relatarea altcuiva
// (infinitivul „arăta”, „susține” arată ca persoana a III-a: „Kant arată că”, „Popescu susține că”)
const OWN_RO = / (voi|vom|as|am|pot|putem|putea|ce|aceasta|asta|lucru) (spune|sustine|arata|afirma|crede|considera|scrie|argumenteaza)(?= ca )/g;
const ownVerbs = (tj, lang) => (lang === "ro" ? tj.replace(OWN_RO, " $1 $2_") : tj);
function markers(sent, lang, withPos) {
  const L = M[lang], ms = [...String(sent).matchAll(TOK)], raw = ms.map(m => m[0]), pos = ms.map(m => m.index), tok = raw.map(x => fold(x).replace(/’/g, "'")), out = {};
  const commaB = i => /[,;:—–(]\s*$/.test(sent.slice(0, pos[i]));          // o virgulă (sau ; : —) chiar înainte
  const after = i => i < raw.length ? sent.charAt(pos[i] + raw[i].length) : "";   // semnul de imediat după cuvânt
  for (const k of KINDS) out[k] = [];
  for (const k of EXTRA) out[k] = [];
  // ce spun alții nu e vocea ta: nu numărăm nuanțele / afirmațiile / persoana I („Craig argues that…”, „Pentru Hinton este evident…”)
  const w0 = (raw[0] || "").toLowerCase(), w1 = raw[1] || "";
  const reported = L.attrib.test(ownVerbs(" " + tok.join(" ") + " ", lang)) || (["pentru", "for", "după", "dupa"].includes(w0) && (/^\p{Lu}/u.test(w1) || /^(el|ea|ei|ele|him|her|them)$/i.test(w1)));
  const notOnly = i => { const before = " " + tok.slice(0, i).join(" ") + " "; return / (nu doar|nu numai|not only) /.test(before); };
  const third = i => i > 0 && (THIRD.has(tok[i - 1]) || (/^\p{Lu}/u.test(raw[i - 1] || "") && i - 1 > 0));
  // o expresie lungă o acoperă pe cea scurtă din ea („este evident că” nu e și „evident că”; „mi se pare” nu e și „se pare”)
  if (withPos) out.pos = [];
  const used = {}; const add = (k, phrase, i) => { const u = used[k] = used[k] || new Set(), n = phrase.split(" ").length; for (let j = i; j < i + n; j++) if (u.has(j)) return; for (let j = i; j < i + n; j++) u.add(j); out[k].push(phrase); if (withPos) out.pos.push({ kind: k, phrase, from: pos[i], to: pos[i + n - 1] + raw[i + n - 1].length }); };
  for (const k of [...KINDS, ...EXTRA]) {
    if (reported && (k === "hedge" || k === "commit" || k === "first" || k === "thesis" || k === "stance" || k === "opinion")) continue;
    for (const ph of [...(L[k] || [])].sort((a, b) => b.split(" ").length - a.split(" ").length)) {
      for (const i of findAll(tok, ph)) {
        if (lang === "en") {
          if (ph === "may" && raw[i] !== "may") continue;                            // „May” la început = luna sau permisiunea
          if (ph === "yet" && (!(i === 0 || commaB(i) || tok[i - 1] === "and") || ["another", "again", "more", "to"].includes(tok[i + 1]) || tok[i - 1] === "not")) continue;   // „Yet, …”, „…, yet it…”, „and yet”; nu „not (yet)”, „yet another”
          if (ph === "but" && (tok[i + 1] === "also" || notOnly(i))) continue;          // „not only… but (also)” adaugă
          if (ph === "such as" && k === "example" && i === 0) continue;
          if ((ph === "suppose" || ph === "imagine") && i !== 0) continue;             // „Suppose…” / „Imagine…” la început de propoziție
          if (ph.startsWith("suppose") && tok[i - 1] === "i") continue;                // „I suppose” = nuanțare, nu experiment mental
          if (ph === "in section" && !/^(\d|[ivx]+$|two|three|four|five|six|next|previous)/.test(tok[i + 2] || "")) continue;   // „in section 2”, nu „in section Outlet”
          if (ph === "in response" && tok[i + 2] === "to") continue;                     // „in response to a wrong” e o expresie, nu un răspuns
          if (ph === "since") { const nx = tok[i + 1] || "", nx2 = tok[i + 2] || "";    // cauzal doar la început sau după virgulă, nu „since then / 1990 / Kant / the war”
            if (!(i === 0 || commaB(i)) || SINCE_NOT.has(nx) || /^\d/.test(nx) || ["ever", "long"].includes(tok[i - 1]) || (/^\p{Lu}/u.test(raw[i + 1] || "") && raw[i + 1] !== "I") || (DET.has(nx) && (TIME_N.has(nx2) || /^\d/.test(nx2)))) continue; }
          if (ph === "after all" && !((i === 0 || commaB(i)) && after(i + 1) === ",")) continue;   // „After all, …” / „…, after all, …”, nu „after all the evidence”
          if (ph === "so") { const nx = tok[i + 1] || "";                                // „So, …” / „, so we…” / „and so the…”; nu „just as…, so…” (analogie)
            if (SO_NOT.has(nx) || tok[0] === "as" || / just as /.test(" " + tok.slice(0, i).join(" ") + " ")) continue;
            if (!(i === 0 ? (after(i) === "," || SO_SUBJ.has(nx)) : ((commaB(i) || tok[i - 1] === "and") && SO_SUBJ.has(nx)))) continue; }
          if (ph === "accordingly" && (i >= tok.length - 1 || ACC_PREV.has(tok[i - 1]))) continue;   // „act accordingly” nu e o concluzie
          if (ph === "though" && (tok[i - 1] === "even" || tok[i - 1] === "as")) continue;   // „as though” = ca și cum
          if (ph === "still" && !(i === 0 && after(i) === ",")) continue;                   // doar „Still, …” (altfel: „încă”)
          if (ph === "that said" && !(i === 0 && after(i + 1) === ",")) continue;
          if (ph === "having said that" && after(i + 2) !== ",") continue;                 // „Having said that, …”, nu „having said that X is Y”
          if (ph === "unlike" && !(i === 0 || commaB(i) || tok[i - 1] === "but")) continue;
          if (ph === "personally" && !(i === 0 && after(i) === ",")) continue;            // „Personally, …”, nu „personally responsible”
          if (ph === "clearly" && !(i === 0 || commaB(i) || ["is", "are", "was", "were", "be", "been", "it", "this", "that", "which", "so", "and"].includes(tok[i - 1]) || ["false", "true", "wrong", "right", "mistaken", "incorrect", "correct", "absurd", "untenable", "implausible", "not", "the", "a", "an"].includes(tok[i + 1]))) continue;   // „Clearly, …”, „is clearly false”; nu „explain clearly”   // „Unlike X, …”, nu „quite unlike one another”
        } else {
          if (ph === "pentru ca" && !/pentru că/i.test(sent) && tok.slice(i + 2, i + 6).includes("sa")) continue;   // „pentru ca … să” = scop, nu cauză
          if (ph === "ci" && (!tok.slice(0, i).includes("nu") || notOnly(i))) continue;   // „nu X, ci Y” (dar „nu doar X, ci Y” adaugă)
          if (ph === "dar" && notOnly(i)) continue;
          if (ph === "cum ar fi" && ["fost", "daca", "sa", "oare"].includes(tok[i + 3])) continue;   // „cum ar fi fost dacă…” nu e „de exemplu”
          if (AMBIG_RO.has(ph) && third(i)) continue;                                  // „ei cred că” nu e persoana I
          if (ph === "consider" && third(i)) continue;
          if (ph === "dar" && tok[i + 1] === "si") continue;                        // „nu doar…, dar și” adaugă
          if (ph === "in sectiunea" && !/^(\d|[ivx]+$|urmatoare|anterioara|precedenta|finala|a)$/.test(tok[i + 2] || "")) continue;   // „în secțiunea 2 / următoare”, nu „în secțiunea Outlet”
          if (ph === "ca raspuns" && tok[i + 2] === "la") continue;                        // „ca răspuns la criză” e o expresie
          if ((ph === "deci" || ph === "or") && !(i === 0 || commaB(i))) continue;          // „Deci, …” / „…, deci …”; „Or, …” (adversativ)
          if (ph === "ca urmare" && !(i === 0 && after(i + 1) === ",")) continue;          // „Ca urmare, …” = concluzie („ca urmare a” = cauză)
          if ((ph === "numai ca" || ph === "doar ca") && (!(i === 0 || commaB(i)) || !/^c[ăã]$/i.test(raw[i + 1] || "") || tok[i - 1] === "nu")) continue;   // „Numai că…” (dar), nu „numai ca efect” / „știe doar că”
          if ((ph === "in timp ce" || ph === "pe cand") && !commaB(i)) continue;            // „…, în timp ce …” (contrast), nu „În timp ce mergeam”
          if (ph === "prin analogie" && /^(rationament|argument|inferent)/.test(tok[i - 1] || "")) continue;   // „raționamentul prin analogie” vorbește despre analogie
          if (ph === "tot asa" && tok[i - 1] === "si") continue;                            // „și tot așa” = și așa mai departe
          if (ph === "personal" && !(i === 0 && after(i) === ",")) continue;               // „Personal, cred…”, nu „experiența personală”
          if (ph === "simt ca" && (!/^c[ăã]$/i.test(raw[i + 1] || "") || ["se", "ma", "te", "ne", "va", "il", "o"].includes(tok[i - 1]))) continue;   // „simt că…”, nu „mă simt ca un străin”
          if (ph === "dupa mine" && !(i === 0 && after(i + 1) === ",")) continue;          // „După mine, …” = după părerea mea
          if ((ph === "voi arata ca" || ph === "vom arata ca") && !/^c[ăã]$/i.test(raw[i + 2] || "") && ["un", "o", "si", "niste", "cineva", "ceva"].includes(tok[i + 3])) continue;   // „voi arăta că…”, nu „voi arăta ca un…” (a arăta ca = a semăna cu)
          if (ph === "evident" && !((i === 0 || commaB(i)) && after(i) === ",")) continue;   // „Evident, …” / „…, evident, …”; nu „cazul evident”, „e evident în”
          if (ph === "in mod clar" && !(i === 0 || commaB(i) || ["este", "e", "sunt", "era", "erau", "fost", "fi", "si"].includes(tok[i - 1]))) continue;   // „În mod clar, …”, „este în mod clar fals”; nu „a arăta în mod clar cum”
        }
        add(k, ph, i);
      }
    }
  }
  // persoana I în engleză: „I” (nu cifra romană: World War I, Chapter I)
  if (lang === "en" && !reported) raw.forEach((t, i) => { if (/^I(?:'m|’m|'ve|’ve|'d|’d|'ll|’ll)?$/.test(t) && !/^\p{Lu}/u.test(raw[i + 1] || "a") && !/^(war|chapter|part|book|volume|section|act|henry|louis|elizabeth|james|charles|george)$/i.test(raw[i - 1] || "")) out.first.push("I"); });
  // „, poate,” (= poate că), nu „poate” (= se poate)
  if (lang === "ro" && !reported && /,\s*poate\s*,/i.test(sent)) out.hedge.push("poate");
  // definiția cu termenul la mijloc: „By X I mean…” / „Prin X înțeleg…”
  const joined = " " + tok.join(" ") + " ";
  if (!out.define.length && lang === "en" && / by( \S+){1,4} i mean /.test(joined)) out.define.push("by … I mean");
  if (!out.define.length && lang === "ro" && / prin( \S+){1,4} inteleg /.test(joined)) out.define.push("prin … înțeleg");
  return out;
}

// ——— cuvintele pe care filosofii le folosesc precis (Pryor: valid, true, sound, begging the question, logical, infer) ———
const VALID_N = {
  en: new Set(["claim", "claims", "statement", "statements", "point", "points", "premise", "premises", "belief", "beliefs", "thesis", "opinion", "opinions", "proposition", "propositions", "objection", "objections", "question", "questions", "worry", "worries", "concern", "concerns", "idea", "ideas", "view", "views", "position", "positions", "assumption", "assumptions"]),
  ro: new Set(["afirmatie", "afirmatia", "afirmatii", "afirmatiile", "propozitie", "propozitia", "propozitii", "premisa", "premise", "premisele", "teza", "opinie", "opinia", "opinii", "idee", "ideea", "idei", "obiectie", "obiectia", "obiectii", "intrebare", "intrebarea", "intrebari", "punct", "observatie", "observatia", "pozitie", "pozitia", "credinta", "convingere", "presupozitie", "ipoteza"]),
};
const SOUND_N = new Set(["claim", "claims", "premise", "premises", "statement", "statements", "point", "points", "belief", "beliefs", "thesis", "assumption", "assumptions"]);
const INFER_N = {
  en: new Set(["text", "passage", "argument", "premise", "premises", "quote", "quotation", "sentence", "statement", "claim", "evidence", "data", "article", "book", "paper", "theory", "conclusion"]),
  ro: new Set(["textul", "pasajul", "argumentul", "premisa", "citatul", "fraza", "propozitia", "afirmatia", "articolul", "cartea", "lucrarea", "teoria", "concluzia"]),
};
function slips(sent, lang) {
  const raw = sent.match(TOK) || [], tok = raw.map(fold), out = [], at = (i, ...ws) => ws.every((w, k) => tok[i + k] === w);
  const put = (kind, i, n) => out.push({ kind, phrase: raw.slice(i, i + n).join(" ") });
  for (let i = 0; i < tok.length; i++) {
    const t = tok[i];
    if (lang === "en") {
      if (t === "valid" && VALID_N.en.has(tok[i + 1])) put("valid", i, 2);
      if (t === "sound" && SOUND_N.has(tok[i + 1])) put("sound", i, 2);
      if (t === "false" && /^arguments?$/.test(tok[i + 1] || "")) put("trueArg", i, 2);
      if (/^arguments?$/.test(t) && ["is", "are", "was", "were"].includes(tok[i + 1]) && ["true", "false"].includes(tok[i + 2])) put("trueArg", i, 3);
      if (/^(begs|beg|begging|begged)$/.test(t) && at(i + 1, "the", "question") && ["of", "whether", "why", "how", "what", "if", "about", "as"].includes(tok[i + 3])) put("begs", i, 4);
      if (at(i, "it", "is", "logical") || at(i, "it", "seems", "logical") || at(i, "is", "only", "logical") || at(i, "makes", "logical", "sense")) put("logical", i, 3);
      if (at(i, "it's", "logical") || at(i, "it’s", "logical")) put("logical", i, 2);
      if (INFER_N.en.has(t) && /^infers?$/.test(tok[i + 1] || "")) put("infer", i, 2);
    } else {
      if (VALID_N.ro.has(t)) { let j = i + 1; if (["este", "e", "sunt", "pare"].includes(tok[j])) j++; if (/^(valid|valida|valide)$/.test(tok[j] || "")) put("valid", i, j - i + 1); }
      if (/^argument(ul|e|ele)?$/.test(t)) {
        if (["este", "e", "sunt", "era"].includes(tok[i + 1]) && /^(adevarat|adevarate|fals|false|falsa)$/.test(tok[i + 2] || "")) put("trueArg", i, 3);
        else if (/^(fals|false)$/.test(tok[i + 1] || "")) put("trueArg", i, 2);
      }
      if (at(i, "este", "logic", "ca") || at(i, "e", "logic", "ca") || at(i, "este", "logic", "sa") || at(i, "e", "logic", "sa")) put("logical", i, 3);
      if (at(i, "pare", "logic")) put("logical", i, 2);
      if (INFER_N.ro.has(t) && /^(deduce|infera|infereaza)$/.test(tok[i + 1] || "")) put("infer", i, 2);
    }
  }
  return out;
}
// pozițiile cuvintelor folosite imprecis într-un fragment de text (pentru sublinierea din editor): fără citate, fără rânduri citate sau cod
function slipRanges(text) {
  const out = []; let off = 0, fence = false;
  for (const line of String(text).split("\n")) {
    const L = line.length;
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    if (!fence && !/^\s*>/.test(line) && /\p{L}/u.test(line)) {
      const masked = line.replace(QUOTE, q => " ".repeat(q.length)).replace(/`[^`]*`/g, q => " ".repeat(q.length)), lang = langOf(masked);
      for (const sl of slips(masked, lang)) {
        const rx = new RegExp("(?<![\\p{L}\\p{N}])" + sl.phrase.split(" ").map(t => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[^\\p{L}\\p{N}]+") + "(?![\\p{L}\\p{N}])", "gu");
        let m; while ((m = rx.exec(masked))) { out.push({ from: off + m.index, to: off + m.index + m[0].length, kind: sl.kind, phrase: sl.phrase }); if (!m[0].length) rx.lastIndex++; }
      }
    }
    off += L + 1;
  }
  const seen = new Set(); return out.sort((a, b) => a.from - b.from).filter(h => { const k = h.from + ":" + h.to; if (seen.has(k)) return false; seen.add(k); return true; });
}
const PHRASE_TIP = T => ({
  opinion: T("O opinie nu e un argument: spune afirmația și motivul ei (Jones et al.; Roberts; American University).", "An opinion is not an argument: state the claim and give its reason (Jones et al.; Roberts; American University)."),
  stock: T("O formulă care nu face nicio muncă: taie-o sau spune lucrul însuși (Millgram; Huemer).", "A phrase that does no work: cut it, or say the thing itself (Millgram; Huemer)."),
  commit: T("Spune doar cât arată argumentul: „evident” și „cu siguranță” ascund adesea un pas lipsă; „dovedește” presupune că argumentul reușește (Huemer; Cartaya; Pryor).", "Claim only as much as the argument shows: “obviously” and “surely” often hide a missing step; “proves” presupposes the argument succeeds (Huemer; Cartaya; Pryor)."),
});
function phraseRanges(text, kinds) {
  const out = []; let off = 0, fence = false;
  for (const line of String(text).split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    if (!fence && !/^\s*>/.test(line) && /\p{L}/u.test(line)) {
      const masked = line.replace(QUOTE, q => " ".repeat(q.length)).replace(/`[^`]*`/g, q => " ".repeat(q.length)), lang = langOf(masked);
      let cur = 0;
      for (const sn of sentences(masked)) {
        const at = masked.indexOf(sn, cur); if (at < 0) continue; cur = at + sn.length;
        for (const h of markers(sn, lang, true).pos) if (kinds.includes(h.kind)) out.push({ from: off + at + h.from, to: off + at + h.to, kind: h.kind, phrase: sn.slice(h.from, h.to) });
      }
    }
    off += line.length + 1;
  }
  return out.sort((a, b) => a.from - b.from);
}
// la trecerea mouse-ului, doar prima frază, fără sursele din paranteză (explicația întreagă e în „Verifică ciorna”)
const shortTip = t => { let x = String(t || "").replace(/\s*\([^()]*\)\.?\s*$/, "."); const m = /^(.{20,}?[.!?])\s/.exec(x); if (m) x = m[1]; return x; };
const SLIP_TIP = T => ({
  valid: T("Doar argumentele (și inferențele) sunt valide. Afirmațiile sunt adevărate sau false; observațiile și obiecțiile sunt întemeiate, plauzibile sau nu.", "Only arguments (and inferences) are valid. Claims are true or false; points and objections are well-supported, plausible or not."),
  sound: T("„Sound” se spune despre argumente: valide și cu toate premisele adevărate. O premisă e adevărată sau plauzibilă.", "“Sound” belongs to arguments: valid, with all premises true. A premise is true or plausible."),
  trueArg: T("Argumentele sunt valide sau nevalide, solide sau nu; propozițiile sunt adevărate sau false.", "Arguments are valid or invalid, sound or unsound; statements are true or false."),
  begs: T("În filosofie, „begs the question” înseamnă a presupune ce trebuie dovedit. Pentru „ridică întrebarea”, scrie „raises the question”.", "In philosophy, “begs the question” means assuming what you set out to prove. For “raises the question”, write “raises”."),
  logical: T("„Logic” e un termen tehnic în filosofie; spune „rezonabil” sau „plauzibil”.", "“Logical” is a technical term in philosophy; say “reasonable” or “plausible”."),
  infer: T("Doar oamenii deduc (inferă); textele și argumentele implică.", "Only people infer; texts and arguments imply."),
});

// ——— un document ———
function analyse(md, opts = {}) {
  const { paras, quotedBlock, blocks } = proseOf(md), key = opts.keyTerms || new Set(), titleW = new Set(words(opts.title || "").map(fold)), names = opts.names || new Set();
  const r = { path: opts.path || "", title: opts.title || "", words: quotedBlock, own: 0, quoted: quotedBlock, sents: [], longS: [], paras: 0, cites: 0, keys: {}, c: {}, ex: {}, rep: [], thesis: [], objection: [], lang: { ro: 0, en: 0 },
    thesisEarly: false, defs: [], replies: [], hasReply: false, opening: [], slips: [], longQ: [], types: { argue: 0, present: 0, analyse: 0, illustrate: 0, none: 0 }, paraTypes: [], questions: 0, roadmap: [], longP: 0 };
  for (const k of KINDS) { r.c[k] = 0; r.ex[k] = []; }
  for (const b of blocks) if (b.n > 50) r.longQ.push({ text: b.text.length > 200 ? b.text.slice(0, 200) + "…" : b.text, n: b.n, line: b.line, path: r.path });
  let si = 0, firstObj = -1;
  for (const p of paras) {
    for (const m of p.raw.matchAll(/\[(?:[^\]]*?)@[^\]]+\]/g)) { r.cites++; for (const k of m[0].matchAll(/@([\w:.#$%&\-+?<>~/]+)/g)) { const id = k[1].replace(/[.,;]+$/, ""); r.keys[id] = (r.keys[id] || 0) + 1; } }
    const pcites = (p.raw.match(/\[(?:[^\]]*?)@[^\]]+\]/g) || []).length;
    const text = clean(p.raw.replace(/\[(?:[^\]]*?)@[^\]]+\]/g, " ")); const all = words(text); if (all.length < 12) continue;
    const F = { S: 0, R: 0, D: 0, X: 0, F: 0, A: 0, Q: 0, C: pcites }, hits = { argue: [], present: [], analyse: [], illustrate: [] };
    const pi = r.paras++; if (all.length > 200) r.longP++;
    const quotes = text.match(QUOTE) || []; let q = 0; for (const x of quotes) { const n = words(x).length; q += n; if (n > 50) r.longQ.push({ text: x.length > 200 ? x.slice(0, 200) + "…" : x, n, line: p.line, path: r.path }); }
    const own = text.replace(QUOTE, " «citat» "), lang = langOf(own), ownW = words(own).filter(w => w !== "citat");
    r.words += all.length; r.quoted += q; r.own += Math.max(0, all.length - q); r.lang[lang] += ownW.length;
    for (const s of sentences(own)) {
      const n = words(s).length; if (!n) continue; r.sents.push(n);
      if (n > 40) r.longS.push({ text: s.replace(/«citat»/g, "„…”"), n, line: p.line, path: r.path });
      const mk = markers(s.replace(/«citat»/g, " "), lang), tj = " " + (s.replace(/«citat»/g, " ").match(TOK) || []).map(fold).join(" ") + " ";
      const exs = mk.example.filter(x => x !== "such as" && x !== "cum ar fi");   // „such as” / „cum ar fi” doar enumeră în treacăt
      F.S += mk.thesis.length + mk.objection.length + mk.reply.length + mk.stance.length; F.R += mk.reason.length + mk.concl.length; F.X += exs.length + mk.thought.length + mk.analogy.length; F.F += mk.first.length; F.D += mk.define.length;
      hits.argue.push(...mk.thesis, ...mk.objection, ...mk.reply, ...mk.stance, ...mk.reason, ...mk.concl); hits.illustrate.push(...exs, ...mk.thought, ...mk.analogy); hits.analyse.push(...mk.define);
      const am = attribution(s.replace(/«citat»/g, " "), lang); if (am && !mk.first.length) { F.A++; hits.present.push(am); }
      const an = ANALYSIS[lang].exec(tj); if (an) { F.D++; hits.analyse.push(an[1]); }
      for (const k of KINDS) if (mk[k].length) { r.c[k] += mk[k].length; if (r.ex[k].length < 5) r.ex[k].push({ text: s.replace(/«citat»/g, "„…”"), hit: [...new Set(mk[k])].join(", "), line: p.line, path: r.path }); }
      const it = { text: s.replace(/«citat»/g, "„…”"), line: p.line, path: r.path };
      if (/\?\s*["”»)]*\s*$/.test(s)) r.questions++;                                   // o întrebare în proza ta
      if (mk.signpost.length && pi <= 1) r.roadmap.push({ ...it, hit: mk.signpost[0] });   // planul, spus în primele două paragrafe
      if (mk.thesis.length) { r.thesis.push(it); if (pi <= 1) r.thesisEarly = true; }
      if (mk.objection.length) { r.objection.push(it); if (firstObj < 0) firstObj = si; }
      if (mk.reply.length) { r.replies.push(it); if (firstObj >= 0) r.hasReply = true; }
      if (mk.define.length) r.defs.push({ ...it, hit: mk.define[0] });
      if (pi === 0 && mk.opening.length && !/\?\s*$/.test(s)) r.opening.push({ ...it, hit: mk.opening.join(", ") });   // nu în întrebări („Lumea există dintotdeauna?”)
      for (const sl of slips(s.replace(/«citat»/g, " "), lang)) r.slips.push({ ...it, ...sl });
      si++;
    }
    if (names.size) {
      const lead = /^\s*([\p{Lu}][\p{L}'’-]+)\s*:/u.exec(text), tail = /—\s*((?:[\p{Lu}][\p{L}'’.-]*\s*){1,3})(?:\(|$)/u.exec(text);
      const nm = [lead?.[1], ...(tail ? tail[1].trim().split(/\s+/) : [])].filter(Boolean).map(fold).find(w => names.has(w));
      if (nm) { F.A++; hits.present.push(nm); }
    }
    F.Q = all.length ? q / all.length : 0;
    const ty = paraType(F); r.types[ty] += all.length;
    const why = ty === "none" ? "" : ty === "present" && !hits.present.length ? (F.Q >= 0.5 ? "citat" : "citare") : [...new Set(hits[ty])].slice(0, 3).join(", ");
    r.paraTypes.push({ type: ty, text: text.length > 180 ? text.slice(0, 180) + "…" : text, line: p.line, path: r.path, n: all.length, hit: why });
    // același cuvânt (nu un termen-cheie al tău, nu din titlu) de 3+ ori în același paragraf
    const cnt = {}; for (const w of ownW) { const f = fold(w); if (f.length < 5 || STOP.has(f) || key.has(f) || titleW.has(f)) continue; cnt[f] = (cnt[f] || 0) + 1; }
    for (const [w, n] of Object.entries(cnt)) if (n >= 3) r.rep.push({ w, n, line: p.line, path: r.path });
  }
  return r;
}
function combine(list) {
  const a = { docs: list.length, words: 0, own: 0, quoted: 0, sents: [], longS: [], cites: 0, keys: {}, c: {}, ex: {}, rep: [], thesis: [], objection: [], defs: [], replies: [], opening: [], slips: [], longQ: [], types: { argue: 0, present: 0, analyse: 0, illustrate: 0, none: 0 }, paraTypes: [],
    thesisDocs: 0, objDocs: 0, thesisEarlyDocs: 0, defDocs: 0, replyDocs: 0, openingDocs: 0, slipDocs: 0, paths: list.map(d => d.path), questions: 0, roadmap: [], roadmapDocs: 0, longP: 0, paras: 0 };
  for (const k of KINDS) { a.c[k] = 0; a.ex[k] = []; }
  for (const d of list) {
    a.words += d.words; a.own += d.own; a.quoted += d.quoted; a.sents.push(...d.sents); a.longS.push(...d.longS); a.cites += d.cites; a.rep.push(...d.rep);
    for (const [k, n] of Object.entries(d.keys)) a.keys[k] = (a.keys[k] || 0) + n;
    for (const k of KINDS) { a.c[k] += d.c[k]; a.ex[k].push(...d.ex[k]); }
    a.thesis.push(...d.thesis); a.objection.push(...d.objection); if (d.thesis.length) a.thesisDocs++; if (d.objection.length) a.objDocs++;
    a.defs.push(...d.defs); a.replies.push(...d.replies); a.opening.push(...d.opening); a.slips.push(...d.slips); a.longQ.push(...d.longQ);
    for (const t of TYPES) a.types[t] += (d.types || {})[t] || 0; a.paraTypes.push(...(d.paraTypes || []));
    a.questions += d.questions || 0; a.roadmap.push(...(d.roadmap || [])); if ((d.roadmap || []).length) a.roadmapDocs++; a.longP += d.longP || 0; a.paras += d.paras || 0;
    if (d.thesisEarly) a.thesisEarlyDocs++; if (d.defs.length) a.defDocs++; if (d.objection.length && d.hasReply) a.replyDocs++; if (d.opening.length) a.openingDocs++; if (d.slips.length) a.slipDocs++;
  }
  return a;
}
function metrics(a) {
  const n = a.sents.length, mean = n ? a.sents.reduce((x, y) => x + y, 0) / n : 0, sd = n ? Math.sqrt(a.sents.reduce((x, y) => x + (y - mean) ** 2, 0) / n) : 0, own = Math.max(1, a.own);
  const m = { docs: a.docs, words: a.words, own: a.own, sentAvg: mean, sentSd: sd, longPct: n ? 100 * a.longS.length / n : 0, ownPct: a.words ? 100 * a.own / a.words : 0, cites: a.words ? 1000 * a.cites / a.words : 0,
    rep: 1000 * a.rep.length / own, thesisDocs: a.thesisDocs, objDocs: a.objDocs, thesisEarlyDocs: a.thesisEarlyDocs, defDocs: a.defDocs, replyDocs: a.replyDocs, openingDocs: a.openingDocs, slipDocs: a.slipDocs };
  for (const k of KINDS) m[k] = 1000 * a.c[k] / own;
  m.questions = 1000 * (a.questions || 0) / own; m.roadmapDocs = a.roadmapDocs || 0; m.longParaPct = a.paras ? 100 * (a.longP || 0) / a.paras : 0;
  const tw = TYPES.reduce((x, t) => x + (a.types[t] || 0), 0);
  for (const t of TYPES) m["t_" + t] = tw ? 100 * (a.types[t] || 0) / tw : 0;
  const tot = Object.values(a.keys).reduce((x, y) => x + y, 0), top = Object.entries(a.keys).sort((x, y) => y[1] - x[1])[0];
  m.topSource = tot >= 5 && top ? { id: top[0], pct: 100 * top[1] / tot } : null;
  return m;
}

// ——— în plugin ———
const VoiceMixin = {
  voiceInit() {
    // în paleta de comenzi: doar Verifică ciorna; punctul de plecare e în panoul Insights (fila Scrisul), restul în meniul notei
    this.addCommand({ id: "voice-check", name: this.T("Verifică ciorna", "Check this draft"), checkCallback: chk => { const f = this.app.workspace.getActiveFile?.(); if (!(f instanceof TFile) || f.extension !== "md" || !this.voicePathOk(f.path)) return false; if (!chk) this.draftCheck(f); return true; } });
    // modul fiecărei note (text general / eseu filosofic) o urmează când o redenumești
    this.registerEvent(this.app.vault.on("rename", (f, old) => { const vm = this.settings.voiceMode; if (vm && vm[old] !== undefined) { vm[f.path] = vm[old]; delete vm[old]; this.saveSettings(); } }));
    this.voiceStatusInit(); this.voiceSlipsInit(); this.wsInit();
    this.app.workspace.onLayoutReady(() => { setTimeout(() => this.voiceRefreshLine().catch(() => {}), 25000); this.registerInterval(window.setInterval(() => this.voiceRefreshLine().catch(() => {}), 1800000)); });
  },
  // text general sau eseu filosofic, pentru o notă: alegerea ta pentru ea, altfel ultima alegere (la început: eseu filosofic)
  voiceModeOf(path) { const vm = this.settings.voiceMode || {}; return vm[path] || this.settings.voiceModeLast || "phil"; },
  async setVoiceMode(path, mode) { (this.settings.voiceMode = this.settings.voiceMode || {})[path] = mode; this.settings.voiceModeLast = mode; await this.saveSettings(); this.refreshSlips(); this.voiceStatusSoon(0); },

  // ——— linia din Acasă: cele mai mari 2–3 schimbări față de punctul de plecare (păstrată, ca Acasă să n-o aștepte) ———
  voiceStoreLine(base, now) {
    const keys = base && now && now.m.own >= 300 ? topChanges(base.m, base.docs.length, now.m, now.m.docs, (a, b) => b) : [];
    if (JSON.stringify(keys) === JSON.stringify(this.settings.voiceLine?.keys || [])) return;
    this.settings.voiceLine = { keys, at: Date.now() }; this.saveSettings(); this.changed();
  },
  async voiceRefreshLine() { const base = this.settings.voice; if (!base) return; this.voiceStoreLine(base, await this.voiceNow(30)); },
  voiceLineText() {
    const keys = this.settings.voiceLine?.keys || []; if (!keys.length || !this.settings.voice) return "";
    const T = (a, b) => this.T(a, b), C = CHANGE(T);
    return T("Față de punctul de plecare: ", "Since your starting point: ") + keys.map(k => C[k.key]?.[k.d]).filter(Boolean).join(" · ");
  },

  // ——— bara de jos: ce fac paragrafele notei deschise, teza, obiecțiile; clic → Verifică ciorna ———
  voiceStatusInit() {
    // ce fac paragrafele notei deschise (doar cu „Analiza scrisului” pornită) stă în meniul elementului Texere din bara de jos
    this._vst$ = require("../shared/status").status(this.core || this);
    this.register(() => { clearTimeout(this._vst); this._vst$?.remove("voice"); });
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.voiceStatusSoon(300)));
    // altă notă în același tab (nu schimbă tabul) și nota deja deschisă la pornire: altfel bara rămâne veche sau ascunsă
    this.registerEvent(this.app.workspace.on("file-open", () => this.voiceStatusSoon(300)));
    this.registerEvent(this.app.workspace.on("editor-change", () => this.voiceStatusSoon(1500)));
    this.app.workspace.onLayoutReady(() => this.voiceStatusSoon(1000));
  },
  voiceStatusSoon(ms) { clearTimeout(this._vst); this._vst = setTimeout(() => this.voiceStatusUpdate().catch(() => {}), ms); },
  async voiceStatusUpdate() {
    const st = this._vst$; if (!st) return;
    const seq = this._vseq = (this._vseq || 0) + 1;   // doar ultima cerere scrie (dacă schimbi repede notele)
    const view = this.app.workspace.getActiveViewOfType?.(MarkdownView), f = view?.file;
    if (!f || !this.voicePathOk(f.path)) { st.remove("voice"); this._vsText = ""; this._vsFor = null; return; }
    const T = (a, b) => this.T(a, b); let sum = "";
    if (this.settings.voiceInline !== false) {
      const text = view.editor?.getValue?.() ?? await this.app.vault.cachedRead(f); if (seq !== this._vseq) return;
      const r = analyse(text, { path: f.path, title: f.basename, keyTerms: this.keyTerms(), names: this.authorNames() });
      if (r.own >= 150) {
        const m = metrics(combine([r])), lab = { argue: T("argumentezi", "arguing"), present: T("prezinți alți autori", "presenting others"), analyse: T("analizezi concepte", "analyzing concepts"), illustrate: T("ilustrezi", "illustrating"), none: T("fără mărci clare", "no clear marks") };
        // cel mai mare procent, oricare ar fi (și „fără mărci clare”, când el e cel mai mare)
        const top = byShare(m)[0], parts = [];
        if (m["t_" + top] >= 1) parts.push(`${lab[top]} ${Math.round(m["t_" + top])}%`);
        // teza și obiecțiile țin de eseul filosofic: la textul general doar ce fac paragrafele
        if (this.voiceModeOf(f.path) === "phil") {
          parts.push(r.thesis.length ? T("teză ✓", "thesis ✓") : T("teză —", "thesis —"));
          if (r.objection.length) parts.push(r.objection.length === 1 ? T("1 obiecție", "1 objection") : T(`${r.objection.length} obiecții`, `${r.objection.length} objections`));
        }
        sum = parts.join(" · ");
      }
    }
    if (seq !== this._vseq) return;
    this._vsText = sum; this._vsFor = f.path;   // îl arată „Verifică ciorna · …” din meniul notei (bara de jos și clic dreapta: aceeași listă)
    st.refresh?.();
  },

  // ——— sublinierea punctată sub cuvintele folosite imprecis (doar la eseul filosofic), cu explicația la trecerea mouse-ului ———
  voiceSlipsInit() {
    let VP, Decoration, StateEffect, RangeSetBuilder, editorInfoField;
    try { ({ ViewPlugin: VP, Decoration } = require("@codemirror/view")); ({ StateEffect, RangeSetBuilder } = require("@codemirror/state")); ({ editorInfoField } = require("obsidian")); } catch (e) { return; }
    if (!VP || !Decoration || !RangeSetBuilder) return;
    const P = this, fx = this._slipFx = StateEffect.define();
    const build = view => {
      let file = null; try { file = view.state.field(editorInfoField)?.file; } catch (e) {}
      if (!file || P.settings.voiceInline === false || !P.voicePathOk(file.path)) return Decoration.none;
      const phil = P.voiceModeOf(file.path) === "phil", ptips = PHRASE_TIP((a, b) => P.T(a, b));
      const doc = view.state.doc, head = doc.sliceString(0, Math.min(doc.length, 4000)), fm = /^---\n[\s\S]*?\n---(\n|$)/.exec(head), fmEnd = fm ? fm[0].length : 0, tips = SLIP_TIP((a, b) => P.T(a, b)), b = new RangeSetBuilder();
      for (const { from, to } of view.visibleRanges) {
        const start = Math.max(from, fmEnd); if (start >= to) continue;
        const chunk = doc.sliceString(start, to), hs = [...(phil ? slipRanges(chunk).map(h => ({ ...h, tip: tips[h.kind] })) : []), ...phraseRanges(chunk, phil ? ["opinion"] : ["opinion", "stock"]).map(h => ({ ...h, tip: ptips[h.kind] }))].sort((x, y) => x.from - y.from || x.to - y.to);
        let last = -1; for (const h of hs) { if (h.from < last) continue; b.add(start + h.from, start + h.to, Decoration.mark({ class: "txi-slip", attributes: { title: `${h.phrase} · ${shortTip(h.tip)}` } })); last = h.to; }
      }
      return b.finish();
    };
    this.registerEditorExtension(VP.fromClass(class { constructor(v) { this.decorations = build(v); } update(u) { if (u.docChanged || u.viewportChanged || u.transactions.some(t => t.effects.some(e => e.is(fx)))) this.decorations = build(u.view); } }, { decorations: v => v.decorations }));
    // în margine, o linie subțire în culoarea a ceea ce face fiecare paragraf (aceleași culori ca bara din „Verifică ciorna”)
    const END = /^\s*(#{1,6}\s|[-*+]\s|\d+[.)]\s|>|```|~~~|\||---+\s*$|\*\*\*+\s*$)/;
    const strips = view => {
      let file = null; try { file = view.state.field(editorInfoField)?.file; } catch (e) {}
      if (!file || P.settings.voiceInline === false || !P.voicePathOk(file.path)) return Decoration.none;
      const doc = view.state.doc; if (doc.length > 600000) return Decoration.none;
      const r = analyse(doc.toString(), { path: file.path, title: file.basename, keyTerms: P.keyTerms(), names: P.authorNames() }); if (r.own < 150) return Decoration.none;
      const b = new RangeSetBuilder(); let lastLine = 0;
      for (const p of r.paraTypes) {
        for (let n = p.line + 1; n <= doc.lines; n++) { if (n <= lastLine) continue; const L = doc.line(n); if (!L.text.trim() || (n > p.line + 1 && END.test(L.text))) break; b.add(L.from, L.from, Decoration.line({ class: "txi-pt txi-pt-" + p.type })); lastLine = n; }
      }
      return b.finish();
    };
    this.registerEditorExtension(VP.fromClass(class {
      constructor(v) { this.decorations = strips(v); this.t = 0; }
      update(u) {
        if (u.transactions.some(t => t.effects.some(e => e.is(fx)))) { clearTimeout(this.t); this.decorations = strips(u.view); return; }
        if (!u.docChanged) return;
        let whole = false; u.changes.iterChangedRanges((a, b) => { if (a === 0 && b === u.startState.doc.length && b > 0) whole = true; });   // altă notă în același editor
        this.decorations = whole ? Decoration.none : this.decorations.map(u.changes);
        clearTimeout(this.t); this.t = setTimeout(() => { try { u.view.dispatch({ effects: fx.of(null) }); } catch (e) {} }, whole ? 150 : 800);
      }
      destroy() { clearTimeout(this.t); }
    }, { decorations: v => v.decorations }));
  },
  // ce merită privit a doua oară într-o ciornă, cu poziții: pentru „Verifică” din modul Editare (src/edit), care doar le arată.
  // Aceleași reguli ca „Verifică ciorna”, fără AI: propozițiile foarte lungi, opiniile spuse ca argumente, afirmațiile mai tari
  // decât arată argumentul, formulele care nu fac nicio muncă și (în filosofie) cuvintele de verificat. Nu schimbă nimic.
  // kinds (opțional): doar aceste feluri (Lab-ul din modul Editare: „long”, „hedge”, „stock”, „commit”, „opinion”, „slip”)
  // opts.long (opțional): de la câte cuvinte e „lungă” o propoziție (implicit 40; modul Editare cere 25)
  weakSpots(text, path, kinds, opts) {
    const T = (a, b) => this.T(a, b), md = String(text || ""), fm = /^---\n[\s\S]*?\n---(\n|$)/.exec(md), off = fm ? fm[0].length : 0, body = md.slice(off);
    const phil = this.voiceModeOf(path || "") === "phil", out = [], want = k => !kinds || kinds.includes(k);
    let pos = 0, fence = false;
    for (const line of body.split("\n")) {
      if (/^\s*(```|~~~)/.test(line)) fence = !fence;
      if (!fence && !/^\s*(>|#)/.test(line) && /\p{L}/u.test(line)) {
        const masked = line.replace(QUOTE, q => " ".repeat(q.length)).replace(/`[^`]*`/g, q => " ".repeat(q.length));
        let cur = 0;
        for (const sn of sentences(masked)) {
          const at = masked.indexOf(sn, cur); if (at < 0) continue; cur = at + sn.length;
          const n = words(sn).length; if (n <= (opts?.long || 40) || !want("long")) continue;
          out.push({ from: off + pos + at, to: off + pos + at + sn.replace(/\s+$/, "").length, kind: "long", why: T(`O propoziție de ${n} de cuvinte: o poți spune în două?`, `A ${n}-word sentence: could it be two?`) });
        }
      }
      pos += line.length + 1;
    }
    const pt = { ...PHRASE_TIP(T), hedge: T("O nuanțare: bună când chiar o crezi; altfel spune lucrul direct (Pryor).", "A hedge: fine when you mean it; otherwise say it plainly (Pryor).") };
    const pk = kinds ? ["opinion", "stock", "commit", "hedge"].filter(want) : phil ? ["opinion", "commit"] : ["opinion", "stock", "commit"];
    if (pk.length) for (const h of phraseRanges(body, pk)) out.push({ from: off + h.from, to: off + h.to, kind: h.kind, why: shortTip(pt[h.kind]) });
    if (kinds ? want("slip") : phil) { const st = SLIP_TIP(T); for (const h of slipRanges(body)) out.push({ from: off + h.from, to: off + h.to, kind: "slip", sub: h.kind, why: shortTip(st[h.kind]) }); }
    const seen = new Set();
    return out.sort((a, b) => a.from - b.from || b.to - a.to).filter(m => { const k = m.from + ":" + m.to; if (seen.has(k) || m.to <= m.from) return false; seen.add(k); return true; });
  },
  // analiza din note (culorile din margine, sublinierea, bara de jos): pornită sau oprită, pentru toate notele
  // pornit / oprit din panoul Insights (fila Scrisul) și din setări; fără argument: comută
  async voiceInlineToggle(on) {
    this.settings.voiceInline = on === undefined ? this.settings.voiceInline === false : !!on; await this.saveSettings();
    this.refreshSlips(); this.voiceStatusSoon(0);
  },
  // ——— statisticile scrisului: un panou sus în notă (ca „Statistici sursă”), calculat din text de fiecare dată; nota păstrează doar „writing-stats: true” ———
  wsOn(f) { return !!this.app.metadataCache.getFileCache(f)?.frontmatter?.["writing-stats"]; },
  async voiceStats(f) {
    const T = (a, b) => this.T(a, b), on = this.wsOn(f);
    await this.app.fileManager.processFrontMatter(f, fm => {
      if (on) delete fm["writing-stats"]; else fm["writing-stats"] = true;
      if (fm["writing-checked"] !== undefined) { delete fm["writing-checked"]; if (Array.isArray(fm.writing)) delete fm.writing; }   // vechile etichete puse de Texere
    });
    if (!on) { let text = ""; try { text = await this.app.vault.read(f); } catch (e) {}
      const r = analyse(text, { path: f.path, title: f.basename, keyTerms: this.keyTerms(), names: this.authorNames() });
      new Notice(r.own < 150 ? T(`Panoul apare sus în notă când are cel puțin 150 de cuvinte de proză (acum: ${r.own}).`, `The panel appears at the top of the note once it has at least 150 words of prose (now: ${r.own}).`) : T("Statisticile scrisului sunt sus în notă și se actualizează pe măsură ce scrii.", "The writing stats are at the top of the note and update as you write."), 5000); }
    this.wsSoon?.(80);
  },
  wsInit() {
    this.register(() => { document.querySelectorAll(".txi-ws").forEach(e => e.remove()); });
    const tick = () => this.app.workspace.iterateAllLeaves(l => { if (l.view?.getViewType?.() === "markdown") { try { this.wsRender(l.view); } catch (e) { console.error("Texere · Insights: statisticile scrisului", e); } } });
    this.wsSoon = ms => { clearTimeout(this._wsT); this._wsT = setTimeout(tick, ms ?? 300); };
    for (const ev of ["file-open", "layout-change", "active-leaf-change"]) this.registerEvent(this.app.workspace.on(ev, () => this.wsSoon(150)));
    this.registerEvent(this.app.workspace.on("editor-change", () => this.wsSoon(1500)));
    this.registerEvent(this.app.metadataCache.on("changed", () => this.wsSoon(300)));
    this.app.workspace.onLayoutReady(() => this.wsSoon(500));
  },
  wsRender(view) {
    const f = view.file, root = view.containerEl; if (!f) return;
    const targets = [root.querySelector(".markdown-source-view .cm-sizer"), root.querySelector(".markdown-reading-view .markdown-preview-sizer .mod-header")].filter(Boolean);
    if (!this.wsOn(f) || !this.voicePathOk(f.path)) { root.querySelectorAll(".txi-ws").forEach(e => e.remove()); return; }
    let text = ""; try { text = view.getViewData?.() || ""; } catch (e) {}
    let h = 0; for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
    const mode = this.voiceModeOf(f.path), sig = JSON.stringify([f.path, text.length, h, mode, this.settings.wsOpen !== false, this.en, this.settings.voice?.at || this.settings.voice?.docs?.length || 0]);
    let box = null;
    for (const tg of targets) {
      const p = tg.querySelector(":scope > .txi-ws"); if (p && p.dataset.sig === sig) { this.fitPanel(p); continue; }
      box = this.wsBuild(f, text, mode); box.dataset.sig = sig;
      if (p) p.replaceWith(box); else if (tg.classList.contains("cm-sizer")) tg.insertBefore(box, tg.querySelector(":scope > .cm-contentContainer")); else tg.appendChild(box);
      this.fitPanel(box, true);
    }
  },
  wsBuild(f, text, mode) {
    const T = (a, b) => this.T(a, b), en = this.en, phil = mode === "phil", n = v => fmtN(v, en);
    const r = analyse(text, { path: f.path, title: f.basename, keyTerms: this.keyTerms(), names: this.authorNames() });
    const box = el("div", "txi-ws" + (this.settings.wsOpen !== false ? " is-open" : ""));
    box.addEventListener("mousedown", e => e.stopPropagation());
    const head = el("div", "txi-ws-head"), ttl = el("span", "txi-ws-title"), ic = el("span");
    try { require("obsidian").setIcon(ic, "bar-chart-3"); } catch (e) {}
    ttl.append(ic, T("Statisticile scrisului", "Writing stats")); head.appendChild(ttl);
    const body = el("div", "txi-ws-body");
    const row = label => { body.appendChild(el("span", "txi-ws-label", label)); const x = el("div", "txi-ws-row"); body.appendChild(x); return x; };
    const chip = (rw, v, label, color, tip, bad) => { const c = el("span", "txi-ws-chip" + (bad ? " is-bad" : "")); if (color) { const d = el("span", "txi-ws-dot"); d.setCssStyles({ background: color }); c.appendChild(d); } if (v != null) c.appendChild(el("b", null, typeof v === "number" ? n(v) : v)); c.appendChild(document.createTextNode(label)); if (tip) c.title = tip; rw.appendChild(c); return c; };
    const mutedTo = (rw, s) => rw.appendChild(el("span", "txi-ws-muted", s));
    const lab = TYPE_LABEL(T), sum = [];
    if (r.own < 150) {
      head.appendChild(el("span", "txi-ws-sum", T(`${n(r.own)} cuvinte de proză`, `${n(r.own)} words of prose`)));
      mutedTo(row(T("Proză", "Prose")), T(`Încă prea puțină proză de măsurat (${n(r.own)} din 150 de cuvinte). Listele, citatele și titlurile nu se numără.`, `Not enough prose to measure yet (${n(r.own)} of 150 words). Lists, quotes and headings don't count.`));
    } else {
      const m = metrics(combine([r])), order = byShare(m), top = order[0];
      sum.push(`${lab[top].toLowerCase()} ${Math.round(m["t_" + top] || 0)}%`);
      if (phil) sum.push(r.thesis.length ? T("teză ✓", "thesis ✓") : T("teză —", "thesis —"));
      sum.push(T(`${n(r.own)} cuvinte`, `${n(r.own)} words`));
      head.appendChild(el("span", "txi-ws-sum", sum.join("  ·  ")));
      // în notă: rezumatul de sus și ce e de verificat; restul (paragrafele, argumentul, raționamentul, proza) e în „Verifică ciorna”
      // 4. de verificat
      const r4 = row(T("De verificat", "To check")); let any = false;
      const warn = (v, one, many, tip) => { if (!v) return; any = true; chip(r4, v, v === 1 ? one : many, null, tip, true); };
      warn(r.c.opinion || 0, T(" opinie în loc de argument", " opinion instead of argument"), T(" opinii în loc de argument", " opinions instead of argument"), T("„simt că”, „după părerea mea”", "“I feel”, “in my opinion”"));
      warn(r.c.commit || 0, T(" afirmație prea apăsată", " overclaim"), T(" afirmații prea apăsate", " overclaims"), T("„evident”, „cu siguranță”, „dovedește”", "“obviously”, “surely”, “proves”"));
      if (phil) { warn(r.slips.length, T(" cuvânt imprecis", " loose word"), T(" cuvinte imprecise", " loose words")); warn(r.opening.length, T(" început grandios", " grand opening"), T(" începuturi grandioase", " grand openings")); }
      else warn(r.c.stock || 0, T(" formulă goală", " stock phrase"), T(" formule goale", " stock phrases"));
      warn(r.longQ.length, T(" citat lung", " long quotation"), T(" citate lungi", " long quotations"));
      if (!any) mutedTo(r4, T("nimic de semnalat", "nothing to flag"));
      const more = el("a", "txi-ws-more", T("Toată verificarea: Verifică ciorna", "The full check: Check this draft")); more.href = "#";
      more.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); this.draftCheck(f); });
      body.appendChild(more);
    }
    head.appendChild(el("span", "txi-ws-meta", phil ? T("eseu filosofic", "philosophical essay") : T("text general", "general text")));
    const cb = el("span", "txi-ws-btn"); try { require("obsidian").setIcon(cb, "pen-line"); } catch (e) {}
    cb.title = T("Însoțitorul scrisului: scheletul, ce lipsește și ce ai în vault pentru fiecare paragraf", "Writing companion: the skeleton, what's missing and what your vault has for each paragraph");
    cb.addEventListener("click", e => { e.stopPropagation(); if (this.openCompanion) this.openCompanion(); else this.draftCheck(f); });
    const ch = el("span", "txi-ws-btn txi-ws-chev"); try { require("obsidian").setIcon(ch, "chevron-down"); } catch (e) {}
    head.append(cb, ch);
    head.addEventListener("click", async () => { this.settings.wsOpen = this.settings.wsOpen === false; await this.saveSettings(); this.wsSoon(0); });
    box.append(head, body);
    return box;
  },
  refreshSlips() { const fx = this._slipFx; if (!fx) return; this.app.workspace.iterateAllLeaves(l => { try { l.view?.editor?.cm?.dispatch({ effects: fx.of(null) }); } catch (e) {} }); },
  // notele care pot fi scrisul tău: nu de literatură, nu din șabloane / Support, nu recenziile săptămânii
  voicePathOk(path) {
    if (this.isLit(path) || this.scanExcluded(path)) return false;
    const wk = String(this.settings.weeklyFolder || this.weeklyDefault?.() || "").replace(/\/+$/, ""); if (wk && path.startsWith(wk + "/")) return false;
    return !path.startsWith(this.manifest.dir + "/");
  },
  keyTerms() {
    if (this._kt && Date.now() - this._ktAt < 600000) return this._kt;
    const out = new Set();
    for (const f of this.app.vault.getMarkdownFiles()) {
      if (!this.isTarget(f.path)) continue; const al = this.fmOf(f).aliases ?? this.fmOf(f).alias;
      for (const t of [f.basename, ...(Array.isArray(al) ? al : al ? [al] : [])]) for (const w of words(String(t))) { const x = fold(w); if (x.length >= 5) out.add(x); }
    }
    this._kt = out; this._ktAt = Date.now(); return out;
  },
  // numele autorilor (din notele de literatură și din folderele „Authors”): „Leibniz: …”, „— Copernic” = îl prezinți pe el
  authorNames() {
    if (this._an && Date.now() - this._anAt < 600000) return this._an;
    const out = new Set(), add = v => { for (const a of Array.isArray(v) ? v : [v]) { const fam = typeof a === "string" ? a.replace(/^\[\[|\]\]$/g, "").split(/[,;]/)[0].trim().split(/\s+/).pop() : a?.family; if (fam && fam.length > 2) out.add(fold(fam)); } };
    for (const f of this.app.vault.getMarkdownFiles()) {
      if (this.isLit(f.path)) { const fm = this.fmOf(f); add(fm.author ?? fm.authors ?? []); }
      else if (/(^|\/)(Authors?|Autori)\//i.test(f.path)) add(f.basename);
    }
    this._an = out; this._anAt = Date.now(); return out;
  },
  async analyseFile(f) {
    const k = f.path + "|" + (f.stat?.mtime || 0); this._va = this._va || new Map(); if (this._va.has(k)) return this._va.get(k);
    let t = ""; try { t = await this.app.vault.cachedRead(f); } catch (e) {}
    const r = analyse(t, { path: f.path, title: f.basename, keyTerms: this.keyTerms(), names: this.authorNames() }); this._va.set(k, r); return r;
  },
  // cât din notă ai scris tu (din numărătoare): { t, p, x } de când se numără, sau doar în ultimele zile
  ownership(path, days) {
    const from = days ? X_dayKey(new Date(Date.now() - days * 864e5)) : "", o = { t: 0, p: 0, x: 0 };
    for (const [k, D] of Object.entries(this.merged())) { if (from && k < from) continue; const v = D.n?.[path]; if (v) { o.t += v.t || 0; o.p += v.p || 0; o.x += v.x || 0; } }
    return o;
  },
  // notele în care ai scris tu în ultimele zile (mai mult scris decât lipit sau inserat), cu proză destulă
  async recentDocs(days = 30) {
    const out = [];
    const seen = new Set(); for (const [k, D] of Object.entries(this.merged())) if (k >= X_dayKey(new Date(Date.now() - days * 864e5))) for (const p of Object.keys(D.n || {})) seen.add(p);
    for (const p of seen) {
      const f = this.app.vault.getAbstractFileByPath(p); if (!(f instanceof TFile) || f.extension !== "md" || !this.voicePathOk(p)) continue;
      const o = this.ownership(p, days); if (o.t < 20 || o.t < o.p + o.x) continue;
      const r = await this.analyseFile(f); if (r.own >= 80) out.push(r);
    }
    return out;
  },
  async voiceNow(days = 30) {
    const docs = await this.recentDocs(days), a = combine(docs), m = metrics(a);
    if (m.own >= 300) { const mk = new Date().toISOString().slice(0, 7), h = this.settings.voiceHist = this.settings.voiceHist || {}; const prev = JSON.stringify(h[mk] || null); h[mk] = roundM(m); if (JSON.stringify(h[mk]) !== prev) this.saveSettings(); }
    return { docs, a, m };
  },
  async setBaseline(files) {
    const docs = []; for (const f of files) docs.push(await this.analyseFile(f));
    const a = combine(docs), m = metrics(a);
    this.settings.voice = { at: Date.now(), docs: files.map(f => f.path), m: roundM(m) }; await this.saveSettings(); this.changed();
    this.voiceRefreshLine().catch(() => {});
    return m;
  },
  chooseBaseline(done) { new BaselineModal(this, done).open(); },
  // „Verifică ciorna”: în panoul însoțitorului scrisului, sus, deschisă (un singur loc pentru o ciornă)
  async draftCheck(f) {
    try {
      this.settings.cmpDraft = true; await this.saveSettings();
      const leaf = await this.openCompanion?.(); const v = leaf?.view;
      if (v?.update) { await v.update(true); v.showDraft?.(); }
    } catch (e) { console.error("Texere: verifică ciorna", e); }
  },
  // verificarea întregii ciorne, desenată în el (o folosește panoul însoțitorului scrisului)
  drawDraft(f, el, ctl) { return drawDraft(this, f, el, ctl); },
  jumpTo(path, line) { const f = this.app.vault.getAbstractFileByPath(path); if (f instanceof TFile) this.app.workspace.getLeaf(false).openFile(f, { eState: { line: line || 0 } }); },

  // ——— secțiunea din pagina Insights: compari A cu B ———
  // A și B pot fi: punctul de plecare, scrisul tău recent (30 / 90 de zile, tot) sau note alese (una, două, mai multe)
  voiceCmp() {
    const c = this.settings.voiceCmp = this.settings.voiceCmp || {};
    if (!c.a) c.a = { kind: "base" }; if (!c.b) c.b = { kind: "recent", days: 30 };
    if (!["compare", "time", "table"].includes(c.view)) c.view = "compare";
    if (!["gen", "phil"].includes(c.mode)) c.mode = "phil";
    return c;
  },
  async voiceSet(sel) {
    const T = (a, b) => this.T(a, b);
    if (sel.kind === "base") {
      const b = this.settings.voice, label = T("Punctul de plecare", "Starting point");
      if (!b) return { ok: false, why: "nobase", kind: "base", label };
      return { ok: true, kind: "base", label, m: b.m, docs: b.docs.length, paths: b.docs, at: b.at };
    }
    if (sel.kind === "notes") {
      const files = (sel.paths || []).map(p => this.app.vault.getAbstractFileByPath(p)).filter(f => f instanceof TFile), list = [];
      for (const f of files) list.push(await this.analyseFile(f));
      const a = combine(list), m = metrics(a);
      return { ok: list.length > 0 && m.own >= 150, why: "notes", kind: "notes", label: files.length === 1 ? files[0].basename : T(`${files.length} note alese`, `${files.length} chosen notes`), m, docs: list.length, list, a, paths: files.map(f => f.path) };
    }
    const d = sel.days || 30, list = await this.recentDocs(d), a = combine(list), m = metrics(a);
    return { ok: m.own >= 300, why: "few", kind: "recent", days: d, label: d >= 3650 ? T("Tot scrisul tău", "All your writing") : T(`Ultimele ${d} de zile`, `Last ${d} days`), m, docs: list.length, list, a };
  },
  // data unei note: din proprietăți (dateCreated / created / date), altfel când a fost creat fișierul
  noteDate(path) {
    const f = this.app.vault.getAbstractFileByPath(path), fm = f instanceof TFile ? (this.fmOf?.(f) || {}) : {};
    const d = Date.parse(String(fm.dateCreated || fm.created || fm.date || "")); return isNaN(d) ? (f?.stat?.ctime || 0) : d;
  },
  // luna în care ai scris cel mai mult într-o notă (din numărătoare)
  homeMonth(path) {
    const by = {}; for (const [k, D] of Object.entries(this.merged())) { const t = D.n?.[path]?.t; if (t) by[k.slice(0, 7)] = (by[k.slice(0, 7)] || 0) + t; }
    let best = null, bt = 0; for (const [k, t] of Object.entries(by)) if (t > bt) { bt = t; best = k; } return best;
  },
  // punctele din „În timp”: notele alese, în ordinea datei (peste 12: pe luni); scrisul tău: pe luni, ultimul an
  // (fiecare notă o singură dată, în luna în care ai scris cel mai mult în ea)
  async voiceSeries(S) {
    const loc = this.en ? "en-GB" : "ro-RO", T = (a, b) => this.T(a, b);
    const list = S.kind === "recent" ? await this.recentDocs(Math.max(S.days || 30, 366)) : (S.list || []);
    if (!list.length) return [];
    const ym = t => { const d = new Date(t || Date.now()); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
    const day = t => new Date(t).toLocaleDateString(loc, { day: "numeric", month: "short", year: "numeric" });
    if (S.kind === "notes" && list.length <= 12)
      return list.map(r => ({ r, t: this.noteDate(r.path) })).sort((x, y) => x.t - y.t).map(({ r, t }) => ({ label: r.title, sub: day(t), m: metrics(combine([r])), n: 1, one: true }));
    const by = new Map(); for (const r of list) { const k = (S.kind === "recent" && this.homeMonth(r.path)) || ym(this.noteDate(r.path)); if (!by.has(k)) by.set(k, []); by.get(k).push(r); }
    return [...by.entries()].sort((x, y) => (x[0] < y[0] ? -1 : 1)).slice(-12).map(([k, l]) => ({ label: new Date(k + "-15T12:00:00").toLocaleDateString(loc, { month: "short", year: "2-digit" }), sub: l.length === 1 ? l[0].title : T(`${l.length} note`, `${l.length} notes`), m: metrics(combine(l)), n: l.length })).filter(p => p.m.own >= 150);
  },
  // alegerea notelor pentru A sau B (aceeași listă ca la punctul de plecare)
  pickNotes(paths, title, onPick, onCancel) {
    const T = (a, b) => this.T(a, b);
    new BaselineModal(this, null, { title, sel: paths, min: 150, cta: T("Compară", "Compare"), onPick, onCancel,
      intro: T("Alege una, două sau mai multe note. Contează doar proza lor (fără liste, citate și titluri). Pentru progres: o ciornă veche în A, cea nouă în B.", "Choose one, two or more notes. Only their prose counts (no lists, quotes or headings). For progress: an old draft in A, the new one in B.") }).open();
  },
  async voiceSection(view, w) {
    const P = this, T = (a, b) => P.T(a, b), en = P.en, loc = en ? "en-GB" : "ro-RO";
    const s = view.sec(w, T("Cum scrii", "How you write"), T("Proza ta, comparată: punctul de plecare, scrisul recent sau note alese.", "Your prose, compared: your starting point, recent writing or notes you pick."), T("Doar din proza ta (fără liste, citate și text lipit), cu semnale corecte de cel puțin 8 ori din 10, după ghidurile de scris citate în Primii pași în filosofie. Compari două lucruri: punctul de plecare, scrisul tău recent sau note alese de tine. Fără scor.", "Only from your prose (no lists, quotes or pasted text), with signals that are right at least 8 times in 10, after the writing guides cited in Getting started in philosophy. You compare two things: your starting point, your recent writing, or notes you choose. No score."));
    // un punct de plecare salvat înainte de semnalele noi: aceleași texte, măsurate din nou (data rămâne)
    let base = P.settings.voice;
    if (base && base.m && (base.m.t_argue === undefined || base.m.opinion === undefined)) {
      const files = (base.docs || []).map(p => P.app.vault.getAbstractFileByPath(p)).filter(f => f instanceof TFile);
      if (files.length) { const at = base.at; await P.setBaseline(files); P.settings.voice.at = at; await P.saveSettings(); base = P.settings.voice; }
    }
    const cmp = P.voiceCmp(), save = async () => { await P.saveSettings(); view.render(); };
    // 1. un singur rând cu tot ce schimbă vederea: Compară [A] cu [B] · Text general | Eseu filosofic · Comparație | În timp | Cifre
    const bar = s.createDiv("txi-v-cmp"), pair = bar.createDiv("txi-v-pair");
    const pickSel = (side, label) => {
      const cur = cmp[side], wrap = pair.createDiv("txi-v-slot"); wrap.createSpan({ cls: "txi-v-ab", text: side.toUpperCase() });
      const el = wrap.createEl("select", { cls: "dropdown txi-v-sel" }), val = cur.kind === "base" ? "base" : cur.kind === "notes" ? "notes" : (cur.days >= 3650 ? "all" : cur.days >= 90 ? "r90" : "r30");
      const opts = [["base", T("Punctul de plecare", "Starting point")], ["r30", T("Ultimele 30 de zile", "Last 30 days")], ["r90", T("Ultimele 90 de zile", "Last 90 days")], ["all", T("Tot scrisul tău", "All your writing")]];
      if (cur.kind === "notes") { const n = (cur.paths || []).length, first = (cur.paths || [])[0]?.split("/").pop().replace(/\.md$/, "") || ""; opts.push(["notes", n === 1 ? first : T(`${n} note: ${first}…`, `${n} notes: ${first}…`)]); }
      opts.push(["pick", T("Alege note…", "Choose notes…")]);
      for (const [v, l] of opts) { const o = el.createEl("option", { text: l }); o.value = v; if (v === val) { o.selected = true; o.setAttribute("selected", ""); } }
      setTip(wrap, label);
      el.addEventListener("change", () => {
        const v = el.value;
        if (v === "pick") return P.pickNotes(cur.kind === "notes" ? cur.paths : [], side === "a" ? T("Ce compari (A)", "What you compare (A)") : T("Cu ce compari (B)", "What you compare it with (B)"), async paths => { cmp[side] = { kind: "notes", paths }; await save(); }, () => { el.value = val; });
        cmp[side] = v === "base" ? { kind: "base" } : v === "notes" ? cur : { kind: "recent", days: v === "r90" ? 90 : v === "all" ? 3650 : 30 }; save();
      });
    };
    // o propoziție: „Compară [B] cu [A]” (A e reperul, de obicei punctul de plecare)
    pair.createSpan({ cls: "txi-v-word", text: T("Compară", "Compare") });
    pickSel("b", T("B: ce vrei să vezi (scrisul recent sau note alese)", "B: what you want to look at (recent writing or chosen notes)"));
    pair.createSpan({ cls: "txi-v-word", text: T("cu", "with") });
    pickSel("a", T("A: reperul (de obicei, punctul de plecare)", "A: the reference (usually your starting point)"));
    const sw = (opts, cur, on) => { const g = bar.createDiv("txi-v-mode"); for (const [id, l] of opts) { const b = g.createSpan({ cls: "txi-v-mopt" + (id === cur ? " on" : ""), text: l }); b.addEventListener("click", () => { if (id !== cur) on(id); }); } return g; };
    sw([["gen", T("Text general", "General text")], ["phil", T("Eseu filosofic", "Philosophical essay")]], cmp.mode, id => { cmp.mode = id; save(); }).addClass("txi-v-filter");
    sw([["compare", T("Comparație", "Compare")], ["time", T("În timp", "Over time")], ["table", T("Cifre", "Numbers")]], cmp.view, id => { cmp.view = id; save(); });
    const A = await P.voiceSet(cmp.a), B = await P.voiceSet(cmp.b), mode = cmp.mode;
    // 2. ce e A și ce e B, pe scurt
    const sum = s.createDiv("txi-v-sum"), desc = S => !S.ok ? "" : S.kind === "base" ? T(`${new Date(S.at).toLocaleDateString(loc, { day: "numeric", month: "short", year: "numeric" })} · ${S.docs} ${S.docs === 1 ? "text" : "texte"} · ${fmtN(S.m.own, en)} cuvinte`, `${new Date(S.at).toLocaleDateString(loc, { day: "numeric", month: "short", year: "numeric" })} · ${S.docs} ${S.docs === 1 ? "document" : "documents"} · ${fmtN(S.m.own, en)} words`) : T(`${S.docs} ${S.docs === 1 ? "notă" : "note"} · ${fmtN(S.m.own, en)} cuvinte`, `${S.docs} ${S.docs === 1 ? "note" : "notes"} · ${fmtN(S.m.own, en)} words`);
    for (const [k, S] of [["A", A], ["B", B]]) if (S.ok) sum.createSpan({ text: `${k} · ${S.label}: ${desc(S)}` });
    const acts = sum.createSpan("txi-v-acts");
    if (base) { const again = acts.createEl("a", { text: T("Alege din nou punctul de plecare", "Choose your starting point again") }); again.addEventListener("click", () => P.chooseBaseline(() => view.render())); }
    const act = P.app.workspace.getActiveFile?.();
    if (act instanceof TFile && act.extension === "md" && P.voicePathOk(act.path)) { const ck = acts.createEl("a", { text: T(`Verifică „${act.basename}”`, `Check “${act.basename}”`) }); ck.addEventListener("click", () => P.draftCheck(act)); }
    // A sau B nu se pot măsura încă: spune de ce și ce poți face
    const why = S => S.why === "nobase" ? T("Alege 3–5 texte scrise de tine (eseuri, ciorne, capitole): ele sunt punctul de plecare.", "Choose 3–5 pieces you wrote yourself (essays, drafts, chapters): they become your starting point.")
      : S.why === "few" ? T(`${S.label}: încă prea puțin scris de tine (cel puțin 300 de cuvinte de proză).`, `${S.label}: not enough of your own writing yet (at least 300 words of prose).`)
      : T("Alege note cu cel puțin 150 de cuvinte de proză.", "Choose notes with at least 150 words of prose.");
    const missing = [A, B].filter(S => !S.ok);
    if (missing.length) {
      const c = s.createDiv("txi-card txi-v-start");
      for (const S of missing) c.createEl("p", { text: why(S) });
      if (missing.some(S => S.why === "nobase")) c.createEl("button", { cls: "mod-cta", text: T("Alege textele", "Choose your documents") }).addEventListener("click", () => P.chooseBaseline(() => view.render()));
      return;
    }
    if (A.kind === "base" && B.kind === "recent" && B.days === 30) P.voiceStoreLine(base, { m: B.m, docs: B.list, a: B.a });
    // 3. legenda: ce înseamnă semnele (o dată, deasupra tuturor cardurilor)
    const lg = s.createDiv("txi-v-legend");
    const key = (cls, text) => { lg.createEl("i", { cls }); lg.appendText(text + "   "); };
    if (cmp.view === "compare") { key("txi-v-k0", "A"); key("txi-v-k1", "B"); key("txi-v-key good", T("în direcția bună", "the good way")); key("txi-v-key bad", T("în cea rea", "the bad way")); key("txi-v-key flat", T("nicio schimbare reală, sau fără direcție", "no real change, or no direction")); }
    if (cmp.view === "time") { key("txi-v-key flat", T("B în timp", "B over time")); key("txi-v-key ref", "A"); key("txi-v-k1 good", T("ultimul punct mai bun decât primul", "last point better than the first")); key("txi-v-k1 bad", T("mai rău", "worse")); }
    if (cmp.view === "table") lg.remove();
    const ak = s.createDiv("txi-v-legend"); for (const [a, l] of [["+", T("ghidurile cer mai mult", "the guides ask for more")], ["-", T("ghidurile cer mai puțin", "the guides ask for less")], ["~", T("echilibrat", "keep it balanced")]]) { aimMark(ak, a, T); ak.appendText(` ${l}   `); } ak.appendText(mode === "phil" ? T("· pentru eseul filosofic, după ghidurile de scris", "· for a philosophical essay, after the writing guides") : T("· pentru orice text", "· for any text"));
    // 4. cardurile, în vederea aleasă
    const pts = cmp.view === "time" ? await P.voiceSeries(B) : null;
    if (pts && pts.length < 2) { s.createDiv({ cls: "txi-card txi-v-start" }).createEl("p", { text: T("„În timp” are nevoie de cel puțin două puncte: alege două sau mai multe note în B, sau scrie în cel puțin două luni.", "“Over time” needs at least two points: choose two or more notes in B, or write over at least two months.") }); return; }
    const g = s.createDiv("txi-grid txi-v-grid");
    view._vOpen = view._vOpen || null;
    // 8 măsurători-cheie (plus paragrafele); „Arată tot” le arată pe toate
    const all = !!view._vAll; let hidden = 0;
    for (const grp of GROUPS(T)) {
      const rows0 = rowsIn(grp, mode), rows = all || grp.id === "types" ? rows0 : rows0.filter(r => (VOICE_KEYS[mode] || VOICE_KEYS.phil).has(r.key)); hidden += rows0.length - rows.length; if (!rows.length) continue;
      const c = view.card(g, grp.title, cmp.view === "time" ? (pts[0].one ? T("notă cu notă", "note by note") : T("lună cu lună", "month by month")) : grp.hint);
      if (cmp.view === "time") {
        if (grp.id === "types") { typeColumns(c, pts, T); continue; }
        const tb = c.createDiv("txi-v-tab"); for (const row of rows) sparkRow(tb, row, pts, A, mode, T); continue;
      }
      if (grp.id === "types") { typeBar(c, A.m, "A", T); typeBar(c, B.m, "B", T); }
      const tb = c.createDiv("txi-v-tab");
      if (cmp.view === "table") { const hd = tb.createDiv("txi-v-r txi-v-h"); hd.createSpan(); hd.createSpan(); hd.createSpan({ text: "A" }); hd.createSpan({ text: "B" }); hd.createSpan(); }
      for (const row of rows) {
        const e = cmp.view === "table" ? tableRow(tb, row, A, B, mode, T) : dumbbell(tb, row, A, B, mode, T);
        if (grp.id === "types") { const dot = Object.assign(document.createElement("i"), { className: "txi-v-dot" }); dot.setCssStyles({ background: TYPE_COLOR[row.key.slice(2)] }); e.querySelector(".txi-v-l")?.prepend(dot); }
        if (row.ex && B.a) {
          const id = grp.id + "|" + row.key; e.addClass("click");
          e.addEventListener("click", () => { view._vOpen = view._vOpen === id ? null : id; view.render(); });
          if (view._vOpen === id) { const d = tb.createDiv("txi-detail txi-v-ex"), items = row.ex(B.a); if (!items.length) d.createSpan({ text: T("Niciun exemplu în B.", "No example in B.") }); for (const it of items.slice(0, 6)) { const x = d.createDiv("txi-v-e"); x.createSpan({ text: it.text }); x.createSpan({ cls: "txi-v-in", text: (it.hit ? it.hit + " · " : "") + P.nameOf(it.path) }); x.addEventListener("click", ev => { ev.stopPropagation(); P.jumpTo(it.path, it.line); }); } }
        }
      }
    }
    if (hidden || all) { const a = s.createDiv("txi-actions"); a.createEl("button", { text: all ? T("Arată doar măsurătorile-cheie", "Show only the key measures") : T(`Arată tot (încă ${hidden})`, `Show all (${hidden} more)`) }).addEventListener("click", () => { view._vAll = !all; view.render(); }); }
  },
};
const X_dayKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fmtN = (n, en) => Math.round(n || 0).toLocaleString(en ? "en-GB" : "ro-RO");
const r1 = n => Math.round((n || 0) * 10) / 10;
function roundM(m) { const o = {}; for (const [k, v] of Object.entries(m)) o[k] = typeof v === "number" ? r1(v) : v; return o; }
// direcția: doar dacă schimbarea e reală (cel puțin 15% și peste un prag absolut), altfel „≈”
function arrow(b, n, abs = 0.5) { if (b == null || n == null) return ""; const d = n - b; if (Math.abs(d) < abs || Math.abs(d) < Math.abs(b) * 0.15) return "≈"; return d > 0 ? "↑" : "↓"; }
const per = v => r1(v).toLocaleString();
// rândurile tabelului, pe grupe; get(m, docs) → număr; fmt → text; ex(a) → exemple din „acum”
const share = key => ({ share: true, get: (m, d) => d ? 100 * (m[key] || 0) / d : 0, fmt: (v, d) => `${Math.round(v * d / 100)} / ${d}`, abs: 10 });
const pct = v => Math.round(v || 0) + "%";
// culorile tipurilor de paragraf (bara din „Paragrafele” și din „Verifică ciorna”)
const TYPE_COLOR = { argue: "var(--color-purple, #8a5cf5)", present: "var(--color-base-50, #8f98a8)", analyse: "var(--color-blue, #0080ff)", illustrate: "var(--color-orange, #f59f00)", none: "var(--background-modifier-border)" };
const TYPE_LABEL = T => ({ argue: T("Argumentezi", "Arguing"), present: T("Prezinți alți autori", "Presenting others"), analyse: T("Analizezi concepte", "Analyzing concepts"), illustrate: T("Ilustrezi", "Illustrating"), none: T("Fără mărci clare", "No clear marks") });
// rândurile tabelului: întâi ce fac paragrafele, apoi în ordinea ghidului lui Pryor (argumentul, raționamentul, claritatea, vocea)
// key: numele cifrei (pentru linia din Acasă)
// aim: încotro e mai bine în eseul filosofic (după ghidurile de scris): + mai mult, - mai puțin, ~ echilibrat, "" doar informație; aimGen: la textul general, când diferă
// pc: procent (0–100%), pentru scala graficelor
// phi: specific eseului filosofic (apare doar acolo); gen: doar la textul general (nu e specific filosofiei, așa că eseul filosofic,
// care e un filtru, îl ascunde); fără niciuna: la amândouă. Pe un grup, phi se aplică tuturor rândurilor lui.
const GROUPS = T => {
  const L = TYPE_LABEL(T), tex = t => a => a.paraTypes.filter(x => x.type === t);
  return [
  { id: "types", title: T("Paragrafele", "Paragraphs"), hint: T("din cuvintele de proză", "share of prose words"), rows: [
    { key: "t_argue", aim: "+", aimGen: "", pc: true, label: L.argue, get: m => m.t_argue, fmt: pct, abs: 5, ex: tex("argue"), tip: T("Un paragraf cu teza, o obiecție, un răspuns sau o poziție a ta („susțin că”, „sunt de acord”), ori cu motive și concluzii („pentru că”, „prin urmare”). „Cred că” singur nu ajunge: o opinie nu e un argument.", "A paragraph with your thesis, an objection, a reply or a position (“I argue that”, “I agree”), or with reasons and conclusions (“because”, “therefore”). “I think” alone isn't enough: an opinion is not an argument.") },
    { key: "t_present", aim: "~", aimGen: "", pc: true, band: [0, 33], label: L.present, get: m => m.t_present, fmt: pct, abs: 5, ex: tex("present"), tip: T("Relatezi pe altcineva („X susține că”, „potrivit lui”), fără „eu”, sau paragraful e mai mult citat. Tooley: cel mult o treime din text; Millgram: doar cât îi trebuie argumentului tău.", "You report someone (“X argues that”, “according to”), without “I”, or the paragraph is mostly quotation. Tooley: at most a third of the text; Millgram: only as much as your argument needs.") },
    { key: "t_analyse", aim: "+", aimGen: "", pc: true, label: L.analyse, get: m => m.t_analyse, fmt: pct, abs: 5, ex: tex("analyse"), tip: T("Definiții, distincții, condiții necesare sau suficiente, „în sensul de”, „este un tip de”.", "Definitions, distinctions, necessary or sufficient conditions, “in the sense of”, “is a kind of”.") },
    { key: "t_illustrate", aim: "~", aimGen: "", pc: true, label: L.illustrate, get: m => m.t_illustrate, fmt: pct, abs: 5, ex: tex("illustrate"), tip: T("Exemple și experimente mentale, fără motive sau definiții în același paragraf.", "Examples and thought experiments, without reasons or definitions in the same paragraph.") },
    { key: "t_none", aim: "-", aimGen: "", pc: true, label: L.none, get: m => m.t_none, fmt: pct, abs: 5, ex: tex("none"), tip: T("Nicio marcă sigură: poate fi descriere, narațiune sau un argument nespus. Nu e o greșeală; doar nu se poate încadra fără să ghicim.", "No reliable mark: it may be description, narration or an unspoken argument. Not a mistake; it just can't be classified without guessing.") },
  ] },
  { id: "argument", phi: true, title: T("Argumentul", "Argument"), hint: T("în câte texte", "in how many texts"), rows: [
    { ...share("thesisDocs"), key: "thesisDocs", aim: "+", label: T("Teza spusă explicit", "Thesis stated explicitly"), tip: T("O propoziție spune teza: „susțin că…”, „voi argumenta că…”, „I argue that…”.", "A sentence states the thesis: “I argue that…”, “susțin că…”."), ex: a => a.thesis },
    { ...share("thesisEarlyDocs"), key: "thesisEarlyDocs", aim: "+", label: T("Teza la început", "Thesis in the opening"), tip: T("În primele două paragrafe. Pryor: spune devreme problema și teza, apoi ține-le la vedere.", "In the first two paragraphs. Pryor: state the problem and your thesis early, then keep them in view."), ex: a => a.thesis },
    { ...share("roadmapDocs"), key: "roadmapDocs", aim: "+", label: T("Planul spus la început", "Roadmap in the opening"), tip: T("În primele două paragrafe: „Mai întâi voi…”, „În secțiunea 2…”. Rippon, Cartaya, Mendelovici: introducerea spune teza și cum vei argumenta.", "In the first two paragraphs: “First, I will…”, “In section 2…”. Rippon, Cartaya, Mendelovici: the introduction gives the thesis and how you will argue for it."), ex: a => a.roadmap },
    { ...share("defDocs"), key: "defDocs", aim: "+", label: T("Termeni definiți", "Key terms defined"), tip: T("O definiție explicită: „prin X înțeleg…”, „folosesc termenul…”. Pryor: definește termenii-cheie, chiar și pe cei familiari.", "An explicit definition: “By X I mean…”, “I use the term…”. Pryor: define key terms, even familiar ones."), ex: a => a.defs },
    { ...share("objDocs"), key: "objDocs", aim: "+", label: T("Obiecții luate în seamă", "Objections considered"), tip: T("O obiecție spusă explicit: „s-ar putea obiecta…”, „one might object…”. Pryor: ridică tu obiecțiile cele mai puternice.", "An objection raised explicitly: “one might object…”, “s-ar putea obiecta…”. Pryor: raise the strongest objections yourself."), ex: a => a.objection },
    { ...share("replyDocs"), key: "replyDocs", aim: "+", label: T("Obiecții la care răspunzi", "Objections answered"), tip: T("După obiecție, răspunsul tău: „răspunsul meu…”, „chiar dacă admitem…”, „I reply…”.", "After the objection, your reply: “I reply…”, “even if we grant…”, “răspunsul meu…”."), ex: a => a.replies },
  ] },
  { id: "reasoning", title: T("Raționamentul", "Reasoning"), hint: T("la 1000 de cuvinte", "per 1000 words"), rows: [
    { key: "reason", aim: "+", aimGen: "", label: T("Motive (pentru că)", "Reasons (because)"), get: m => m.reason, fmt: per, ex: a => a.ex.reason, tip: T("Premisele vin după „pentru că”, „deoarece”, „dat fiind că”.", "Premises come after “because”, “since”, “given that”.") },
    { key: "concl", aim: "~", aimGen: "", label: T("Concluzii (prin urmare)", "Conclusions (therefore)"), get: m => m.concl, fmt: per, ex: a => a.ex.concl, tip: T("Pryor: folosește „prin urmare” doar unde chiar urmează ceva, nu ca să întărești un raționament slab.", "Pryor: use “therefore” only where something really follows, not to make weak reasoning look strong.") },
    { key: "example", aim: "+", aimGen: "", label: T("Exemple (de exemplu)", "Examples (for example)"), get: m => m.example, fmt: per, ex: a => a.ex.example },
    { key: "thought", aim: "+", phi: true, label: T("Experimente mentale, contraexemple", "Thought experiments, counterexamples"), get: m => m.thought, fmt: per, ex: a => a.ex.thought, tip: T("„Să presupunem…”, „să ne imaginăm…”, „un contraexemplu…”: metoda obișnuită a filosofiei.", "“Suppose…”, “imagine…”, “a counterexample…”: philosophy's usual method.") },
    { key: "contrast", aim: "", gen: true, label: T("Contraste (totuși)", "Contrasts (however)"), get: m => m.contrast, fmt: per, ex: a => a.ex.contrast },
    { key: "analogy", aim: "", gen: true, label: T("Analogii (la fel ca)", "Analogies (just as)"), get: m => m.analogy, fmt: per, ex: a => a.ex.analogy, tip: T("O analogie e bună cât timp diferențele dintre cazuri nu contează. Verifică diferențele.", "An analogy holds only while the differences between the cases don't matter. Check the differences.") },
  ] },
  { id: "clarity", title: T("Claritatea", "Clarity"), rows: [
    { key: "signpost", aim: "+", aimGen: "", label: T("Indicatoare (voi începe prin)", "Signposts (I will begin by)"), get: m => m.signpost, fmt: per, ex: a => a.ex.signpost, tip: T("La 1000 de cuvinte. Pryor: anunță ce faci („Voi începe prin…”, „Înainte de a arăta ce e greșit…”), ca structura să fie evidentă.", "Per 1000 words. Pryor: announce what you are doing (“I will begin by…”, “Before I say what is wrong…”) so the structure is obvious.") },
    { key: "sentAvg", aim: "~", gen: true, label: T("Lungimea medie a propoziției", "Average sentence"), get: m => m.sentAvg, fmt: v => T(`${Math.round(v)} cuvinte`, `${Math.round(v)} words`), abs: 1.5, tip: T("Pryor: propoziții și paragrafe scurte, cuvinte obișnuite.", "Pryor: short sentences and paragraphs, familiar words.") },
    { key: "sentSd", aim: "~", gen: true, label: T("Varietatea (±)", "Variety (±)"), get: m => m.sentSd, fmt: v => "±" + Math.round(v), abs: 1.5, tip: T("Cât de mult diferă propozițiile între ele ca lungime.", "How much your sentences differ from each other in length.") },
    { key: "longPct", aim: "-", pc: true, gen: true, label: T("Propoziții lungi (peste 40)", "Long sentences (over 40)"), get: m => m.longPct, fmt: v => Math.round(v) + "%", abs: 2, ex: a => a.longS.map(x => ({ ...x, hit: T(`${x.n} cuvinte`, `${x.n} words`) })) },
    { key: "rep", aim: "-", gen: true, label: T("Cuvinte repetate aproape", "Words repeated close together"), get: m => m.rep, fmt: per, tip: T("Același cuvânt de 3+ ori în același paragraf (fără termenii-cheie ai tăi), la 1000 de cuvinte.", "The same word 3+ times in one paragraph (your key terms excluded), per 1000 words."), ex: a => a.rep.map(r => ({ text: `${r.w} ×${r.n}`, path: r.path, line: r.line })) },
    { key: "questions", phi: true, aim: "-", label: T("Întrebări în proza ta", "Questions in your prose"), get: m => m.questions, fmt: per, tip: T("La 1000 de cuvinte. Pune întrebarea o dată, apoi răspunde la ea; întrebările retorice nu țin locul unui argument (Jones et al.; Huemer).", "Per 1000 words. Ask the question once, then answer it; rhetorical questions don't replace an argument (Jones et al.; Huemer).") },
    { key: "longParaPct", gen: true, aim: "-", pc: true, label: T("Paragrafe lungi (peste 200 de cuvinte)", "Long paragraphs (over 200 words)"), get: m => m.longParaPct, fmt: v => Math.round(v || 0) + "%", abs: 5, tip: T("Pryor: propoziții și paragrafe scurte; Tooley: un singur argument pe paragraf.", "Pryor: short sentences and paragraphs; Tooley: one argument per paragraph.") },
    { key: "stock", gen: true, aim: "-", label: T("Formule goale (este important de menționat, în ziua de azi)", "Stock phrases (delve, basically, it is important to note)"), get: m => m.stock, fmt: per, ex: a => a.ex.stock, tip: T("La 1000 de cuvinte. Millgram, Huemer: taie cuvintele care nu fac nicio muncă.", "Per 1000 words. Millgram, Huemer: cut the words that do no work.") },
    { ...share("openingDocs"), key: "openingDocs", aim: "-", phi: true, label: T("Începuturi grandioase", "Grand openings"), tip: T("În primul paragraf: „de-a lungul istoriei…”, „dintotdeauna…”, definiția din dicționar. Pryor: începe direct cu ideea ta.", "In the first paragraph: “throughout history…”, “since the dawn of time…”, a dictionary definition. Pryor: begin directly with your point."), ex: a => a.opening },
    { ...share("slipDocs"), key: "slipDocs", aim: "-", phi: true, label: T("Cuvinte folosite imprecis", "Words used loosely"), tip: T("„Afirmație validă”, „argument adevărat”, „e logic că”, „textul deduce” (și, în engleză, „begs the question of”). Pryor: în filosofie aceste cuvinte au un sens precis.", "“Valid claim”, “true argument”, “begs the question of”, “it's logical that”, “the text infers”. Pryor: in philosophy these words have a precise sense."), ex: a => a.slips.map(x => ({ ...x, hit: x.phrase })) },
  ] },
  { id: "voice", title: T("Vocea ta și referințele", "Your voice and references"), rows: [
    { key: "ownPct", aim: "+", aimGen: "", pc: true, label: T("Cuvintele tale (nu citate)", "Your words (not quoted)"), get: m => m.ownPct, fmt: v => Math.round(v) + "%", abs: 3, tip: T("Pryor: citează puțin și explică fiecare citat cu cuvintele tale.", "Pryor: quote sparingly and explain every quotation in your own words.") },
    { key: "cites", aim: "", gen: true, label: T("Citări (la 1000 de cuvinte)", "Citations (per 1000 words)"), get: m => m.cites, fmt: per },
    { key: "first", aim: "", gen: true, label: T("Persoana I (la 1000)", "First person (per 1000)"), get: m => m.first, fmt: per, ex: a => a.ex.first, tip: T("Pryor: „eu” e în regulă, mai ales când spui ce faci.", "Pryor: “I” is fine, especially for saying what you are doing.") },
    { key: "hedge", aim: "~", gen: true, label: T("Nuanțezi (poate, pare)", "Hedging (perhaps, seems)"), get: m => m.hedge, fmt: per, ex: a => a.ex.hedge, tip: T("La 1000 de cuvinte. Pryor: fii modest, nu promite mai mult decât arăți.", "Per 1000 words. Pryor: be modest; don't claim more than you show.") },
    { key: "commit", aim: "-", label: T("Afirmi prea apăsat (evident, cu siguranță, dovedește)", "Overclaiming (clearly, obviously, surely, proves)"), get: m => m.commit, fmt: per, ex: a => a.ex.commit, tip: T("La 1000 de cuvinte. Spune doar cât arată argumentul (Huemer); „evident” și „cu siguranță” ascund adesea un pas lipsă (Cartaya). Pryor: „dovedește” presupune că argumentul reușește.", "Per 1000 words. Claim only what your argument shows (Huemer); “clearly” and “surely” often hide a missing step (Cartaya). Pryor: “proves” presupposes the argument succeeds.") },
    { key: "opinion", aim: "-", label: T("Opinie în loc de argument (simt că, după părerea mea)", "Opinion instead of argument (I feel, in my opinion)"), get: m => m.opinion, fmt: per, ex: a => a.ex.opinion, tip: T("La 1000 de cuvinte. O opinie nu e un argument: spune afirmația și motivul ei (Jones et al.; Roberts; American University).", "Per 1000 words. An opinion is not an argument: state the claim and give its reason (Jones et al.; Roberts; American University).") },
  ] },
  ];
};
// schimbările față de punctul de plecare, spuse în cuvinte (linia din Acasă): [crește, scade]
const CHANGE = T => ({
  t_argue: [T("mai mult argument", "more arguing"), T("mai puțin argument", "less arguing")],
  t_present: [T("mai multă prezentare a altora", "more presenting others"), T("mai puțină prezentare a altora", "less presenting others")],
  t_analyse: [T("mai multă analiză de concepte", "more conceptual analysis"), T("mai puțină analiză de concepte", "less conceptual analysis")],
  t_illustrate: [T("mai multe exemple", "more illustration"), T("mai puține exemple", "less illustration")],
  thesisDocs: [T("teza spusă explicit mai des", "thesis stated explicitly more often"), T("teza spusă explicit mai rar", "thesis stated explicitly less often")],
  thesisEarlyDocs: [T("teza mai devreme", "thesis earlier"), T("teza mai târziu", "thesis later")],
  defDocs: [T("mai mulți termeni definiți", "more terms defined"), T("mai puțini termeni definiți", "fewer terms defined")],
  objDocs: [T("mai multe obiecții luate în seamă", "more objections considered"), T("mai puține obiecții", "fewer objections")],
  replyDocs: [T("răspunzi mai des la obiecții", "answering objections more often"), T("răspunzi mai rar la obiecții", "answering objections less often")],
  reason: [T("mai multe motive", "more reasons"), T("mai puține motive", "fewer reasons")],
  concl: [T("mai multe concluzii", "more conclusions"), T("mai puține concluzii", "fewer conclusions")],
  example: [T("mai multe exemple", "more examples"), T("mai puține exemple", "fewer examples")],
  thought: [T("mai multe experimente mentale", "more thought experiments"), T("mai puține experimente mentale", "fewer thought experiments")],
  contrast: [T("mai multe contraste", "more contrasts"), T("mai puține contraste", "fewer contrasts")],
  analogy: [T("mai multe analogii", "more analogies"), T("mai puține analogii", "fewer analogies")],
  signpost: [T("mai multe indicatoare", "more signposts"), T("mai puține indicatoare", "fewer signposts")],
  sentAvg: [T("propoziții mai lungi", "longer sentences"), T("propoziții mai scurte", "shorter sentences")],
  longPct: [T("mai multe propoziții lungi", "more long sentences"), T("mai puține propoziții lungi", "fewer long sentences")],
  rep: [T("mai multe repetiții", "more repetition"), T("mai puține repetiții", "less repetition")],
  openingDocs: [T("mai multe începuturi grandioase", "more grand openings"), T("mai puține începuturi grandioase", "fewer grand openings")],
  slipDocs: [T("mai multe cuvinte imprecise", "more loose words"), T("mai puține cuvinte imprecise", "fewer loose words")],
  ownPct: [T("mai mult din cuvintele tale", "more of your own words"), T("mai multe citate", "more quotation")],
  cites: [T("mai multe citări", "more citations"), T("mai puține citări", "fewer citations")],
  first: [T("mai mult la persoana I", "more first person"), T("mai puțin la persoana I", "less first person")],
  hedge: [T("nuanțezi mai mult", "more hedging"), T("nuanțezi mai puțin", "less hedging")],
  commit: [T("afirmi mai apăsat", "more overclaiming"), T("afirmi mai puțin apăsat", "less overclaiming")],
  opinion: [T("mai multă opinie fără argument", "more opinion without argument"), T("mai puțină opinie fără argument", "less opinion without argument")],
  roadmapDocs: [T("planul spus mai des la început", "roadmap in the opening more often"), T("planul spus mai rar la început", "roadmap in the opening less often")],
  questions: [T("mai multe întrebări în proză", "more questions in your prose"), T("mai puține întrebări în proză", "fewer questions in your prose")],
  longParaPct: [T("mai multe paragrafe lungi", "more long paragraphs"), T("mai puține paragrafe lungi", "fewer long paragraphs")],
  stock: [T("mai multe formule goale", "more stock phrases"), T("mai puține formule goale", "fewer stock phrases")],
});
const WEIGHT = { types: 1.3, argument: 1.3, reasoning: 1, clarity: 1, voice: 0.8 };
// cele mai mari 2–3 schimbări reale (săgeată, nu „≈”), cântărite: întâi paragrafele și argumentul
function topChanges(bm, bdocs, nm, ndocs, T, n = 3) {
  const out = [];
  for (const g of GROUPS(T)) for (const row of g.rows) {
    if (!CHANGE(T)[row.key]) continue;
    const b = row.get(bm, bdocs), v = row.get(nm, ndocs), a = arrow(b, v, row.abs); if (!a || a === "≈" || b == null) continue;
    const rel = Math.min(3, Math.abs(v - b) / Math.max(Math.abs(b), row.share || row.key.startsWith("t_") ? 10 : 1));
    out.push({ key: row.key, d: a === "↑" ? 0 : 1, w: rel * (WEIGHT[g.id] || 1) });
  }
  return out.sort((x, y) => y.w - x.w).slice(0, n).map(({ key, d }) => ({ key, d }));
}

// tipurile de la cel mai mare procent la cel mai mic (la egalitate, în ordinea obișnuită)
const byShare = m => [...TYPES].sort((x, y) => (m["t_" + y] || 0) - (m["t_" + x] || 0));
// o bară cu ce fac paragrafele (procente din cuvintele de proză), cu eticheta ei la stânga; order: ordinea segmentelor
function typeBar(parent, m, label, T, order = TYPES) {
  const row = parent.createDiv("txi-v-bar"); row.createSpan({ cls: "txi-v-bl", text: label }); const bar = row.createDiv("txi-v-stack"), L = TYPE_LABEL(T);
  for (const t of order) { const v = m["t_" + t] || 0; if (v < 0.5) continue; const seg = bar.createDiv("txi-v-seg"); seg.setCssStyles({ width: v + "%", background: TYPE_COLOR[t] }); seg.title = `${L[t]}: ${Math.round(v)}%`; }
  return row;
}

// ——— semnele de direcție și graficele din „Cum scrii” ———
// eseul filosofic e un filtru: doar rândurile care contează acolo; textul general: fără cele specifice filosofiei
// măsurătorile-cheie, câte 8, la vedere de la început (restul, la „Arată tot”)
//  eseu filosofic: teza, termenii definiți, răspunsul la obiecții, motivele, exemplele, cuvintele imprecise, opiniile, afirmațiile prea apăsate
//  text general: motivele, exemplele, lungimea frazei, frazele lungi, paragrafele lungi, citările, ezitările, afirmațiile prea apăsate
const VOICE_KEYS = { phil: new Set(["thesisDocs", "defDocs", "replyDocs", "reason", "example", "slipDocs", "opinion", "commit"]), gen: new Set(["reason", "example", "sentAvg", "longPct", "longParaPct", "cites", "hedge", "commit"]) };
const rowsIn = (grp, mode) => grp.rows.filter(r => (mode === "phil" ? !r.gen : !(r.phi || grp.phi)));
const aimOf = (row, mode) => (mode === "gen" && row.aimGen !== undefined ? row.aimGen : row.aim || "");
// 1: s-a mișcat în direcția bună; -1: în cea rea; 0: nicio schimbare reală, sau semnalul n-are o direcție (echilibru, informație)
function goodness(aim, b, n, abs, band) {
  const ar = arrow(b, n, abs); if (!ar || ar === "≈") return 0;
  if (band) { const d = v => (v < band[0] ? band[0] - v : v > band[1] ? v - band[1] : 0), db = d(b), dn = d(n); return db === dn ? 0 : dn < db ? 1 : -1; }
  if (!aim || aim === "~") return 0; return (aim === "+") === (ar === "↑") ? 1 : -1;
}
const bandOf = (row, mode) => (mode === "phil" ? row.band || null : null);
const AIM_TXT = T => ({ "+": T("Mai mult e mai bine", "More is better"), "-": T("Mai puțin e mai bine", "Less is better"), "~": T("Echilibrat: nici prea mult, nici prea puțin", "Keep it balanced: neither too much nor too little"), "": T("Doar informație: nici bine, nici rău în sine", "Just information: neither good nor bad in itself") });
const OB = (() => { try { return require("obsidian"); } catch (e) { return {}; } })();
const setTip = (el, text) => { try { if (OB.setTooltip) return OB.setTooltip(el, text, { delay: 250 }); } catch (e) {} el.setAttribute("aria-label", text); };
// ce înseamnă „+” / „−” pe rândul acela: mai mult din ce, față de ce
function aimTip(T, aim, row) {
  if (!row || !aim || aim === "~") return AIM_TXT(T)[aim];
  if (row.share) return aim === "+"
    ? T("Ghidurile de scris cer asta în fiecare eseu. „1 / 1”: textul tău îl are; ținta e ca toate textele tale să-l aibă.", "The writing guides ask for this in every essay. “1 / 1”: your one text has it; the aim is for all your texts to have it.")
    : T("Mai bine să nu apară în niciun text.", "Better if none of your texts has it.");
  if (row.pc) return aim === "+"
    ? T("Un procent mai mare e mai bine. ↑ față de A înseamnă că ai crescut.", "A higher percentage is better. ↑ against A means it went up.")
    : T("Un procent mai mic e mai bine. ↓ față de A înseamnă că ai scăzut.", "A lower percentage is better. ↓ against A means it went down.");
  return aim === "+"
    ? T("Ghidurile de scris recomandă să faci asta mai des. Cifra e de câte ori apare la 1000 de cuvinte; ↑ față de A (de obicei punctul tău de plecare) înseamnă că o faci mai des decât de obicei.", "The writing guides recommend doing this more often. The number is how many times it appears per 1,000 words; ↑ against A (usually your starting point) means you do it more often than you usually do.")
    : T("Ghidurile de scris recomandă să faci asta mai rar. Cifra e de câte ori apare la 1000 de cuvinte; ↓ față de A înseamnă că o faci mai rar decât de obicei.", "The writing guides recommend doing this less often. The number is how many times it appears per 1,000 words; ↓ against A means you do it less often than you usually do.");
}
function aimMark(parent, aim, T, row) {
  const s = parent.createSpan({ cls: "txi-v-aim" + (aim === "+" ? " up" : aim === "-" ? " down" : aim === "~" ? " mid" : ""), text: aim === "+" ? "+" : aim === "-" ? "−" : aim === "~" ? "◦" : "" });
  setTip(s, aimTip(T, aim, row)); return s;
}
// scala unui rând: procentele 0–100%; restul de la 0 la o valoare rotundă peste cea mai mare (cinstit: pornește de la zero)
function scaleMax(row, ...vals) {
  if (row.pc || row.share) return 100;
  const mx = Math.max(0, ...vals.map(v => +v || 0)); if (mx <= 0) return 1;
  const raw = mx * 1.15, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}
const gcls = g => (g > 0 ? " good" : g < 0 ? " bad" : "");
// un rând „de la A la B”: cercul gol e A, cel plin e B; linia dintre ele e verde (direcția bună), portocalie (cea rea) sau gri
function dumbbell(tb, row, A, B, mode, T) {
  const a = row.get(A.m, A.docs), b = row.get(B.m, B.docs), aim = aimOf(row, mode), g = goodness(aim, a, b, row.abs, bandOf(row, mode)), mx = scaleMax(row, a, b);
  const x = v => Math.max(0, Math.min(100, (100 * (+v || 0)) / mx)), lo = Math.min(x(a), x(b)), hi = Math.max(x(a), x(b));
  const e = tb.createDiv("txi-v-db"); aimMark(e, aim, T, row); e.createSpan({ cls: "txi-v-l", text: row.label });
  const ty = row.key.startsWith("t_") ? TYPE_COLOR[row.key.slice(2)] : null, gc = ty ? "" : gcls(g);
  const tr = e.createDiv("txi-v-track"), ln = tr.createDiv("txi-v-link" + gc); ln.setCssStyles({ left: lo + "%", width: hi - lo + "%" });
  const d0 = tr.createDiv("txi-v-d0"); d0.setCssStyles({ left: x(a) + "%" });
  const d1 = tr.createDiv("txi-v-d1" + gc); d1.setCssStyles({ left: x(b) + "%" });
  if (ty) { ln.setCssStyles({ background: ty }); d1.setCssStyles({ background: ty }); }
  e.createSpan({ cls: "txi-v-n now", text: row.fmt(b, B.docs) });
  setTip(e, `A · ${A.label}: ${row.fmt(a, A.docs)}\nB · ${B.label}: ${row.fmt(b, B.docs)}\n${AIM_TXT(T)[aim]}` + (row.tip ? `\n\n${row.tip}` : ""));
  return e;
}
// același rând, în cifre (vederea „Cifre”): A, B și săgeata, colorată după direcție
function tableRow(tb, row, A, B, mode, T) {
  const a = row.get(A.m, A.docs), b = row.get(B.m, B.docs), aim = aimOf(row, mode), g = goodness(aim, a, b, row.abs, bandOf(row, mode));
  const e = tb.createDiv("txi-v-r"); aimMark(e, aim, T, row); e.createSpan({ cls: "txi-v-l", text: row.label });
  e.createSpan({ cls: "txi-v-n", text: row.fmt(a, A.docs) }); e.createSpan({ cls: "txi-v-n now", text: row.fmt(b, B.docs) }); e.createSpan({ cls: "txi-v-d" + gcls(g), text: arrow(a, b, row.abs) });
  setTip(e, AIM_TXT(T)[aim] + (row.tip ? `\n\n${row.tip}` : ""));
  return e;
}
const SVGNS = "http://www.w3.org/2000/svg";
const svgEl = (tag, attrs, parent) => { const e = document.createElementNS(SVGNS, tag); for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v); if (parent) parent.appendChild(e); return e; };
// o linie mică pentru un semnal în timp (fiecare cu scala lui, de la zero); punctată: valoarea lui A; punctul de la capăt: verde/portocaliu
// după direcția de la primul la ultimul punct. „În câte texte” notă cu notă: pătrățele pline (da) sau goale (nu)
function sparkRow(tb, row, pts, A, mode, T) {
  const vals = pts.map(p => row.get(p.m, p.n)), aim = aimOf(row, mode), n = vals.length, last = vals[n - 1], ref = A && A.ok ? row.get(A.m, A.docs) : null;
  const g = goodness(aim, vals[0], last, row.abs, bandOf(row, mode)), e = tb.createDiv("txi-v-sp"); aimMark(e, aim, T, row); e.createSpan({ cls: "txi-v-l", text: row.label });
  const box = e.createDiv("txi-v-spk"), fmt = (v, p) => row.fmt(v, p.n);
  if (row.share && pts[0].one) {
    box.addClass("strip"); pts.forEach((p, i) => { const q = box.createDiv("txi-v-sq" + (vals[i] >= 50 ? " on" + gcls(aim === "-" ? -1 : 1) : "")); setTip(q, `${p.label} · ${p.sub}\n${vals[i] >= 50 ? T("da", "yes") : T("nu", "no")}`); });
  } else {
    const mx = scaleMax(row, ...vals, ref ?? 0), H = 30, pad = 5, X = i => (n === 1 ? 50 : 3 + (i * 94) / (n - 1)), Y = v => H - pad - ((H - 2 * pad) * Math.max(0, Math.min(1, (+v || 0) / mx)));
    const svg = svgEl("svg", { viewBox: `0 0 100 ${H}`, preserveAspectRatio: "none", class: "txi-v-svg" }, box);
    if (ref != null) svgEl("line", { x1: 0, x2: 100, y1: Y(ref), y2: Y(ref), class: "txi-v-ref", "vector-effect": "non-scaling-stroke" }, svg);
    svgEl("polyline", { points: vals.map((v, i) => `${X(i)},${Y(v)}`).join(" "), class: "txi-v-pl", "vector-effect": "non-scaling-stroke" }, svg);
    pts.forEach((p, i) => { const d = box.createDiv("txi-v-pt" + (i === n - 1 ? " end" + gcls(g) : "")); d.setCssStyles({ left: X(i) + "%", top: Y(vals[i]) + "px" }); setTip(d, `${p.label}${p.sub ? " · " + p.sub : ""}\n${fmt(vals[i], p)}` + (ref != null ? `\nA · ${A.label}: ${row.fmt(ref, A.docs)}` : "")); });
  }
  e.createSpan({ cls: "txi-v-n now", text: fmt(last, pts[n - 1]) });
  setTip(e.querySelector(".txi-v-l"), AIM_TXT(T)[aim] + (row.tip ? `\n\n${row.tip}` : ""));
  return e;
}
// ce fac paragrafele, în timp: o coloană pe punct (100%), cu legenda dedesubt
function typeColumns(parent, pts, T) {
  const L = TYPE_LABEL(T), wrap = parent.createDiv("txi-v-cols"), used = new Set();
  for (const p of pts) {
    const col = wrap.createDiv("txi-v-col"), st = col.createDiv("txi-v-cst");
    for (const t of TYPES) { const v = p.m["t_" + t] || 0; if (v < 0.5) continue; used.add(t); const seg = st.createDiv("txi-v-cseg"); seg.setCssStyles({ height: `calc(${v}% - 2px)`, background: TYPE_COLOR[t] }); }
    col.createDiv({ cls: "txi-v-clab", text: p.label });
    setTip(col, `${p.label}${p.sub ? " · " + p.sub : ""}\n` + TYPES.filter(t => (p.m["t_" + t] || 0) >= 0.5).map(t => `${L[t]}: ${Math.round(p.m["t_" + t])}%`).join("\n"));
  }
  const lg = parent.createDiv("txi-v-tlegend flat");
  for (const t of TYPES) if (used.has(t)) { const it = lg.createDiv("txi-v-titem"); it.createEl("i", { cls: "txi-v-dot" }).setCssStyles({ background: TYPE_COLOR[t] }); it.createSpan({ text: L[t] }); }
}

// ——— alegerea punctului de plecare ———
class BaselineModal extends Modal {
  // o: { title, intro, cta, min, sel, onPick(paths), onCancel } când alegi note de comparat (altfel: punctul de plecare)
  constructor(P, done, o = {}) { super(P.app); this.P = P; this.done = done; this.o = o; this.sel = new Set(o.sel || (o.onPick ? [] : P.settings.voice?.docs || [])); this.q = ""; this.list = null; }
  async onOpen() {
    const P = this.P, T = (a, b) => P.T(a, b); this.modalEl.addClass("txi-v-modal"); this.titleEl.setText(this.o.title || T("Punctul tău de plecare", "Your starting point"));
    this.contentEl.createDiv({ cls: "txi-v-intro", text: this.o.intro || T("Alege 3–5 texte scrise de tine (eseuri, ciorne, capitole). Contează doar proza; apoi vezi cum se schimbă scrisul tău față de ele.", "Choose 3–5 pieces you wrote yourself (essays, drafts, chapters). Only prose counts; then you see how your writing changes against them.") });
    const q = this.contentEl.createEl("input", { type: "search" }); q.placeholder = T("Caută o notă…", "Search a note…"); q.addEventListener("input", () => { this.q = q.value; this.draw(); });
    this.body = this.contentEl.createDiv("txi-v-list"); this.body.createDiv({ cls: "txi-empty", text: "…" });
    this.foot = this.contentEl.createDiv("txi-v-foot");
    const files = P.app.vault.getMarkdownFiles().filter(f => P.voicePathOk(f.path)).sort((a, b) => (b.stat?.mtime || 0) - (a.stat?.mtime || 0)).slice(0, 400);
    const out = []; for (const f of files) { const r = await P.analyseFile(f); if (r.own >= 150) { const o = P.ownership(f.path); out.push({ f, r, pasted: o.p + o.x >= 50 && o.p + o.x > o.t }); } }
    this.list = out; this.draw(); setTimeout(() => q.focus(), 30);
  }
  draw() {
    const P = this.P, T = (a, b) => P.T(a, b), en = P.en, b = this.body; b.empty();
    const q = fold(this.q.trim()), items = (this.list || []).filter(x => !q || fold(x.f.path).includes(q));
    if (!items.length) b.createDiv({ cls: "txi-empty", text: this.list?.length ? T("Nicio notă nu se potrivește.", "No note matches.") : T("N-am găsit note cu proză scrisă de tine (cel puțin 150 de cuvinte).", "No notes with prose of your own found (at least 150 words).") });
    for (const x of items) {
      const r = b.createEl("label", { cls: "txi-v-item" }), cb = r.createEl("input", { type: "checkbox" }); cb.checked = this.sel.has(x.f.path);
      cb.addEventListener("change", () => { cb.checked ? this.sel.add(x.f.path) : this.sel.delete(x.f.path); this.drawFoot(); });
      const t = r.createDiv("txi-v-it"); t.createSpan({ cls: "txi-v-name", text: x.f.basename });
      const meta = t.createSpan({ cls: "txi-v-in", text: (x.f.parent && x.f.parent.path !== "/" ? x.f.parent.path + " · " : "") + T(`${fmtN(x.r.own, en)} cuvinte`, `${fmtN(x.r.own, en)} words`) });
      if (x.pasted) r.createSpan({ cls: "txi-why", text: T("mai mult lipit", "mostly pasted") }).title = T("Numărătoarea arată că în nota asta s-a lipit sau inserat mai mult decât ai scris.", "The count shows more was pasted or inserted in this note than you typed.");
    }
    this.drawFoot();
  }
  drawFoot() {
    const P = this.P, T = (a, b) => P.T(a, b), en = P.en, f = this.foot; f.empty();
    const chosen = (this.list || []).filter(x => this.sel.has(x.f.path)), w = chosen.reduce((a, x) => a + x.r.own, 0);
    f.createSpan({ cls: "txi-muted", text: chosen.length ? T(`${chosen.length} alese · ${fmtN(w, en)} cuvinte`, `${chosen.length} chosen · ${fmtN(w, en)} words`) + (w < 1000 && !this.o.onPick ? T(" · peste 1.000 de cuvinte dau un punct de plecare mai stabil", " · over 1,000 words give a steadier starting point") : "") : T("Nicio notă aleasă", "No note chosen") });
    f.createEl("button", { text: T("Renunță", "Cancel") }).addEventListener("click", () => this.close());
    const ok = f.createEl("button", { cls: "mod-cta", text: this.o.cta || T("Păstrează ca punct de plecare", "Set as starting point") }); ok.disabled = !chosen.length || w < (this.o.min ?? 300);
    ok.addEventListener("click", async () => { ok.disabled = true; if (this.o.onPick) { this.picked = true; this.close(); return this.o.onPick(chosen.map(x => x.f.path)); } await P.setBaseline(chosen.map(x => x.f)); new Notice(T("Punctul de plecare e salvat.", "Starting point saved."), 4000); this.saved = true; this.close(); });
  }
  onClose() { this.contentEl.empty(); if (this.saved) this.done?.(); if (this.o.onPick && !this.picked) this.o.onCancel?.(); }
}

// ——— verificarea unei ciorne ———
// ——— verificarea întregii ciorne (fostul „Verifică ciorna”), desenată în panoul însoțitorului scrisului, deasupra paragrafelor ———
// ctl: { jump(it) — mergi la propoziție, redraw() — desenează din nou, state: { open_ } — tipul de paragraf deschis }
// Felul textului (general sau eseu filosofic) îl alegi din panou; aici se folosește cel ales pentru nota asta.
async function drawDraft(P, f, c, ctl = {}) {
  {
    if (!ctl.jump) ctl.jump = it => P.jumpTo(f.path, it.line);
    if (!ctl.redraw) ctl.redraw = () => drawDraft(P, f, c, ctl);
    const T = (a, b) => P.T(a, b), phil = P.voiceModeOf(f.path) === "phil", st = ctl.state || (ctl.state = { open_: null });
    const pr = t => phil ? t : t.replace(/Pryor: /g, "");   // în modul general, aceleași sfaturi, fără trimiterea la Pryor
    c.empty(); c.addClass("txi-v-embed");
    const r = await P.analyseFile(f), a = combine([r]), m = metrics(a), base = P.settings.voice;
    if (r.own < 150) { c.createDiv({ cls: "txi-empty", text: T(`Nota are prea puțină proză de măsurat (${r.own} cuvinte). Listele, citatele și titlurile nu se numără.`, `This note has too little prose to measure (${r.own} words). Lists, quotes and headings aren't counted.`) }); return; }
    const box = c.createDiv("txi-v-body");
    const go = it => ctl.jump(it);
    const sec = t => { const s = box.createDiv("txi-v-sec"); s.createEl("h4", { text: t }); return s; };
    const item = (parent, label, list, none, extra) => {
      const d = parent.createDiv("txi-v-arg"); d.createSpan({ cls: "txi-v-k", text: label });
      if (list.length) for (const it of list.slice(0, 3)) { const e = d.createDiv("txi-v-e"); e.createSpan({ text: it.text }); if (it.hit) e.createSpan({ cls: "txi-v-in", text: it.hit }); e.addEventListener("click", () => go(it)); }
      else d.createDiv({ cls: "txi-v-none", text: none });
      if (extra) d.createDiv({ cls: "txi-v-none", text: extra });
    };
    // 1. ce fac paragrafele (la amândouă): bara și legenda, de la cel mai mare procent (clic pe un tip → paragrafele lui)
    const s0 = sec(T("Ce fac paragrafele", "What the paragraphs do")), L = TYPE_LABEL(T), ord = byShare(m);
    typeBar(s0, m, "", T, ord).addClass("solo");
    const lg = s0.createDiv("txi-v-tlegend");
    for (const t of ord) {
      const list = r.paraTypes.filter(x => x.type === t); if (!list.length) continue;
      const it = lg.createDiv("txi-v-titem" + (st.open_ === t ? " on" : "")); aimMark(it, aimOf(GROUPS(T)[0].rows.find(x => x.key === "t_" + t), phil ? "phil" : "gen"), T); const dot = it.createEl("i", { cls: "txi-v-dot" }); dot.setCssStyles({ background: TYPE_COLOR[t] });
      it.createSpan({ text: `${L[t]} ${Math.round(m["t_" + t])}%` }); it.createSpan({ cls: "txi-v-in", text: list.length === 1 ? T("1 paragraf", "1 paragraph") : T(`${list.length} paragrafe`, `${list.length} paragraphs`) });
      it.addEventListener("click", () => { st.open_ = st.open_ === t ? null : t; ctl.redraw(); });
      if (st.open_ === t) { const d = lg.createDiv("txi-detail txi-v-ex"); for (const x of list) { const e = d.createDiv("txi-v-e"); e.createSpan({ text: x.text }); e.createSpan({ cls: "txi-v-in", text: x.hit ? T(`după: ${x.hit}`, `from: ${x.hit}`) : T("nicio marcă sigură", "no reliable mark") }); e.addEventListener("click", () => go(x)); } }
    }
    if (phil && (m.t_present || 0) > 33) s0.createDiv({ cls: "txi-v-none", text: T(`Prezinți alți autori în ${Math.round(m.t_present)}% din text: mai mult de o treime. Tooley: fundalul, cel mult o treime; restul, argumentele tale și obiecțiile.`, `Presenting others takes ${Math.round(m.t_present)}% of the text: more than a third. Tooley: background at most a third; the rest, your own arguments and objections.`) });
    // 2–3. doar la eseul filosofic: argumentul spus explicit (teză, termeni, obiecții, răspunsuri), începutul și cuvintele precise
    if (phil) {
      const s1 = sec(T("Argumentul", "Argument"));
      item(s1, T("Teza", "Thesis"), r.thesis, T(`Nicio propoziție nu spune teza explicit („susțin că…”, „I argue that…”). Poate o poartă titlul: „${f.basename}”.`, `No sentence states the thesis explicitly (“I argue that…”, “susțin că…”). The title may carry it: “${f.basename}”.`),
        r.thesis.length && !r.thesisEarly ? T("Apare abia mai târziu în text. Pryor: spune teza devreme, în primele paragrafe.", "It only appears later in the text. Pryor: state your thesis early, in the first paragraphs.") : "");
      item(s1, T("Planul", "Roadmap"), r.roadmap, T("Nimic nu anunță planul în primele două paragrafe („Mai întâi voi…”, „First, I will…”). Rippon, Mendelovici: după teză, spune pe scurt cum vei argumenta.", "Nothing announces the plan in the first two paragraphs (“First, I will…”, “Mai întâi voi…”). Rippon, Mendelovici: after the thesis, say briefly how you will argue for it."));
      item(s1, T("Termeni definiți", "Key terms defined"), r.defs, T("Niciun termen definit explicit („prin X înțeleg…”, „By X I mean…”). Pryor: spune ce înțelegi prin termenii de care depinde argumentul.", "No term is defined explicitly (“By X I mean…”, “prin X înțeleg…”). Pryor: say what you mean by the terms your argument depends on."));
      item(s1, T("Obiecții", "Objections"), r.objection, T("Nicio obiecție luată în seamă explicit („s-ar putea obiecta…”, „one might object…”).", "No objection is considered explicitly (“one might object…”, “s-ar putea obiecta…”)."));
      if (r.objection.length) item(s1, T("Răspunsuri", "Replies"), r.replies, T("Ridici o obiecție, dar nu urmează un răspuns explicit („răspunsul meu…”, „chiar dacă admitem…”, „I reply…”).", "You raise an objection, but no explicit reply follows (“I reply…”, “even if we grant…”, “răspunsul meu…”)."));
      if (r.slips.length || r.opening.length || r.ex.opinion.length || r.ex.commit.length) {
        const s2 = sec(T("Cuvinte și formule de verificat", "Words and phrases to check")), tips = SLIP_TIP(T), pt = PHRASE_TIP(T);
        for (const it of r.ex.opinion.slice(0, 4)) { const e = s2.createDiv("txi-v-e"); e.createSpan({ text: it.text }); e.createSpan({ cls: "txi-v-in", text: `„${it.hit}” · ${pt.opinion}` }); e.addEventListener("click", () => go(it)); }
        for (const it of r.ex.commit.slice(0, 3)) { const e = s2.createDiv("txi-v-e"); e.createSpan({ text: it.text }); e.createSpan({ cls: "txi-v-in", text: `„${it.hit}” · ${pt.commit}` }); e.addEventListener("click", () => go(it)); }
        for (const it of r.opening.slice(0, 2)) { const e = s2.createDiv("txi-v-e"); e.createSpan({ text: it.text }); e.createSpan({ cls: "txi-v-in", text: `„${it.hit}” · ` + T("Pryor: începe direct cu ideea ta; fără istoria omenirii, fără definiția din dicționar (dicționarul descrie uzul obișnuit, nu pe cel filosofic).", "Pryor: begin directly with your point; no history of humankind, no dictionary definition (dictionaries record everyday use, not the philosophical one).") }); e.addEventListener("click", () => go(it)); }
        for (const it of r.slips.slice(0, 8)) { const e = s2.createDiv("txi-v-e"); e.createSpan({ text: it.text }); e.createSpan({ cls: "txi-v-in", text: `„${it.phrase}” · ${tips[it.kind]}` }); e.addEventListener("click", () => go(it)); }
      }
    }
    if (!phil && (r.ex.opinion.length || r.ex.stock.length)) {
      const s2 = sec(T("Formule de reconsiderat", "Phrases to reconsider")), pt = PHRASE_TIP(T);
      for (const k of ["opinion", "stock"]) for (const it of r.ex[k].slice(0, 4)) { const e = s2.createDiv("txi-v-e"); e.createSpan({ text: it.text }); e.createSpan({ cls: "txi-v-in", text: `„${it.hit}” · ${pr(pt[k])}` }); e.addEventListener("click", () => go(it)); }
    }
    // 4. cifrele, față de punctul de plecare: la eseul filosofic doar cele care contează acolo (fără „gen”), la textul general fără cele φ
    const s3 = sec(base ? T("Față de punctul tău de plecare", "Against your starting point") : T("Cifrele", "The numbers"));
    if (!base) s3.createDiv({ cls: "txi-v-none", text: T("Alege un punct de plecare (Insights → Cum scrii) ca să vezi și comparația.", "Choose a starting point (Insights → How you write) to see the comparison too.") });
    const md = phil ? "phil" : "gen", ak = s3.createDiv("txi-v-legend"); for (const [x, l] of [["+", T("ghidurile cer mai mult", "the guides ask for more")], ["-", T("ghidurile cer mai puțin", "the guides ask for less")], ["~", T("echilibrat", "keep it balanced")]]) { aimMark(ak, x, T); ak.appendText(` ${l}   `); } ak.appendText(T("· fără semn: doar informație", "· no mark: just information"));
    const tb = s3.createDiv("txi-v-tab"), hd = tb.createDiv("txi-v-r txi-v-h"); hd.createSpan(); hd.createSpan(); hd.createSpan({ text: base ? T("plecare", "start") : "" }); hd.createSpan({ text: T("ciorna", "draft") }); hd.createSpan();
    for (const grp of GROUPS(T)) for (const row of grp.rows) {
      if (row.share || grp.id === "types" || (phil ? row.gen : row.phi || grp.phi)) continue;   // „în câte texte” și paragrafele sunt mai sus
      const b = base ? row.get(base.m, base.docs.length) : null, n = row.get(m, 1), e = tb.createDiv("txi-v-r"), aim = aimOf(row, md), g = b == null ? 0 : goodness(aim, b, n, row.abs, bandOf(row, md));
      aimMark(e, aim, T, row); e.createSpan({ cls: "txi-v-l", text: row.label });
      e.createSpan({ cls: "txi-v-n", text: b == null ? "" : row.fmt(b, base.docs.length) }); e.createSpan({ cls: "txi-v-n now", text: row.fmt(n, 1) }); e.createSpan({ cls: "txi-v-d" + gcls(g), text: b == null ? "" : arrow(b, n, row.abs) });
      setTip(e, AIM_TXT(T)[aim] + (row.tip ? "\n\n" + pr(row.tip) : ""));
    }
    // 5. unde să te uiți (sigure: doar numărate): propozițiile lungi și cuvintele repetate la textul general, citatele lungi la amândouă
    if (!phil && r.longS.length) { const s4 = sec(T(`Propoziții lungi (${r.longS.length})`, `Long sentences (${r.longS.length})`)); for (const it of r.longS.slice(0, 8)) { const e = s4.createDiv("txi-v-e"); e.createSpan({ text: it.text.length > 220 ? it.text.slice(0, 220) + "…" : it.text }); e.createSpan({ cls: "txi-v-in", text: T(`${it.n} cuvinte`, `${it.n} words`) }); e.addEventListener("click", () => go(it)); } }
    if (r.longQ.length) { const s5 = sec(T(`Citate lungi (${r.longQ.length})`, `Long quotations (${r.longQ.length})`)); s5.createDiv({ cls: "txi-v-none", text: pr(T("Pryor: citează puțin și spune după fiecare citat, cu cuvintele tale, ce afirmă și de ce contează.", "Pryor: quote sparingly, and after each quotation say in your own words what it claims and why it matters.")) }); for (const it of r.longQ.slice(0, 6)) { const e = s5.createDiv("txi-v-e"); e.createSpan({ text: it.text }); e.createSpan({ cls: "txi-v-in", text: T(`${it.n} cuvinte`, `${it.n} words`) }); e.addEventListener("click", () => go(it)); } }
    if (!phil && r.rep.length) { const s6 = sec(T("Cuvinte repetate în același paragraf", "Words repeated within a paragraph")); const l = s6.createDiv("txi-v-chips"); for (const it of r.rep.sort((x, y) => y.n - x.n).slice(0, 12)) { const ch = l.createSpan({ cls: "txi-why", text: `${it.w} ×${it.n}` }); ch.addEventListener("click", () => go(it)); } }
    const ft = c.createDiv("txi-v-foot");
    ft.createSpan({ cls: "txi-muted", text: phil ? P.T("Doar ce contează în eseul filosofic, după ghidurile de scris, numărat sigur; validitatea, premisele și caritatea le judeci tu. Propozițiile, repetițiile și vocea: la Text general.", "Only what matters in a philosophical essay, after the writing guides, counted reliably; validity, premises and charity are yours to judge. Sentences, repetition and voice: under General text.") : P.T("Doar semnale numărate sigur; tu judeci ce înseamnă. Teza, obiecțiile și cuvintele folosite precis: la Eseu filosofic.", "Only signals that can be counted reliably; you judge what they mean. Thesis, objections and precise wording: under Philosophical essay.") });
  }
}


module.exports = { VoiceMixin, drawDraft, analyse, combine, metrics, markers, slips, slipRanges, sentences, proseOf, langOf, arrow, GROUPS, paraType, topChanges, CHANGE, TYPES, clean, words, TYPE_LABEL, TYPE_COLOR, SLIP_TIP, PHRASE_TIP, phraseRanges };
