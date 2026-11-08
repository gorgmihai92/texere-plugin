# Texere

**Research in one place.**

> **This repository is the Texere plugin**, the code behind [Texere – The Researcher's Vault](https://github.com/gorgmihai92/texere). To start with everything ready (the plugin, the Philosophy map, templates and guides), download the vault. To add Texere to a vault you already have, install the plugin from here.

Research is usually scattered across many applications and places: Zotero, Mendeley or EndNote, Word or Google Docs, a laptop, the cloud, a phone, USB sticks and external drives. Moving between them costs time and loses things along the way.

Texere is an Obsidian plugin for researchers who want one place for the whole process: finding references, reading PDFs, taking notes, writing, citing and exporting. It comes with a map of philosophy, but you can reshape it for any discipline.

- **Anyone, without technical knowledge.** Install it (or download the ready-made vault), and a short setup does the rest. No code, no command line, no LaTeX.
- **English and Romanian writers.** The interface, the setup, Help and the guide work in both languages. Notes have English names and Romanian aliases: type `[[Etică` and you get **Ethics**.
- **University of Bucharest students.** Export templates for BA and MA theses at the Faculty of Philosophy, following the faculty's writing guide.

Version 0.4.0 · desktop only · by [George Mihai](https://www.georgemihai.com/?utm_source=texere&utm_medium=github_plugin&utm_campaign=texere) · code under MIT, guides and the Philosophy map under CC BY 4.0 (see [LICENSE](LICENSE))

---

## What Texere does

One plugin with three modules; turn each on or off in **Settings → Texere → General**.

**Texere (always on)**
- **Home page** in every new tab (and the braid icon on the left): what needs fixing, your first week, your recent files, and a bar into References, Export, Insights and Help.
- **Setup** on first run, a few short steps (see [First run](#first-run)).
- **Quiet in your notes:** while you write you see only your text; marks appear only if you turn them on; everything Texere can do for a note is under right-click → **Texere**; nothing is written into a note without your click.
- **Edit mode:** try versions of a word, sentence or paragraph right in the note, dim a passage, move text to the note's Cuts; marks for long sentences, hedges and overclaiming. No AI. Based on [Wordplay](https://github.com/ungatedlife/wordplay) by Rob Hardy, after Jason Fried's Write_On.
- **Discipline map:** ready-made notes for the branches, subfields, periods, movements, theories, concepts and authors of a discipline (Philosophy for now), to use in your references' metadata.
- **Help:** the **?** next to **+** on the home page. The whole guide by chapter, with a search that understands your own words.
- **Templates:** New essay, New author, and the BA and MA thesis templates; two getting-started guides for philosophy. Added to your vault only if you want, never over a note you have.

**References**
- **Search catalogs** (OpenAlex, Crossref, Semantic Scholar, Open Library, Google Books, ORCID, Wikipedia's citation service; Google Scholar with your own SerpApi key) and add a reference as a reading note, with its free PDF when there is one.
- **Paste** a citation, BibTeX, RIS or a DOI, or **enter it manually**.
- **Import from Zotero**, with PDFs and annotations; optionally the Zotero browser button saves into Texere when Zotero is closed.
- **Cite** with `@` in any of 10,000+ styles; the bibliography keeps itself up to date.
- **Annotations into notes:** annotate a PDF with PDF++ and the passage lands in the reading note, with its tag, the citation and a link back to the page.
- **Distil:** your annotations in your own words, saved under each one, already cited.
- **Reference stats:** how others cite a reference, whether it was retracted, and how its journal is rated (Norway and Finland's expert panels, ERIH PLUS, DOAJ).

**Export**
- **Export a note** to PDF, Word or Markdown, with citations, bibliography, contents, page layout and thesis templates.
- **Import documents** (Word, PDF, and .doc/.odt/.rtf when a converter is available) as notes.
- **Clean paste** from Word or a PDF.

**Insights** (Lab: experimental, improves with each version)
- **Words:** typed, pasted, inserted and deleted, per day, week and month; word targets and projects (a folder, a tag or a note).
- **How you write:** your prose compared over time, after the writing guides; **Check this draft** for one note.
- **Writing companion:** a side panel for the draft you're writing: what each paragraph does and what it's missing, and what your vault has for it.
- **Links:** concepts mentioned without a link, names without a note, aliases and duplicates; patterns; a weekly review.
- **Concept panel** and **debate map:** everything your references say about a concept, and where you stand; start a note from any mix of your annotations.

Nothing in Insights or edit mode uses AI: every suggestion comes from rules in the code and from your notes.

---

## Install

Texere isn't in Obsidian's community plugin list yet. Two ways to get it:

- **The ready-made vault** ([gorgmihai92/texere](https://github.com/gorgmihai92/texere)): download it, open the folder in Obsidian with **Open folder as vault**, choose **Trust author and enable plugins**. Texere is already there.
- **Into a vault you already have:** download `main.js`, `styles.css` and `manifest.json` from the [latest release](https://github.com/gorgmihai92/texere-plugin/releases/latest), put them in a new folder `.obsidian/plugins/texere/` inside your vault, then turn Texere on in **Settings → Community plugins** (turn off Restricted mode first, if it's on).

You need Obsidian on a computer (Windows, macOS or Linux). For annotations in PDFs, Texere uses one other plugin, **PDF++**: the setup opens its page and you click **Install**, then **Enable**. Texere never installs or turns on another plugin by itself.

## First run

The setup opens by itself, once on each computer. In each step you tick or pick, and **Next** applies it; untick what you don't want.

1. **Language:** English or Romanian.
2. **Where Texere keeps things:** the recommended folders, or your own.
3. **Your discipline:** the Philosophy map, ticked by default.
4. **PDF++:** only if it's missing.
5. **Your vault:** what's missing (folders, templates, bibliography, export folder); nothing you have is moved or overwritten.
6. **Done:** where to find everything. What was done stays in **Help → Your last setup**.

Run it again any time from **Settings → Texere → General** or the home page.

## Updates

Once a day Texere checks this repository's latest release. If it's newer, the home page shows it with an **Update** button; nothing installs until you click. The update goes into the plugin's own folder only (your notes and settings are never touched; the previous version is kept in `previous/`). **Settings → Texere → General → Updates** turns the check off, checks now, updates or goes back to the previous version.

## Help and support

- Inside Obsidian: **Help** (the **?** on the home page) has the whole guide and the frequent questions, in English and Romanian.
- A problem or an idea: **Settings → Texere → About → Report a problem** opens an e-mail to [hi@georgemihai.com](mailto:hi@georgemihai.com).

---

## Disclosures

Obsidian asks plugins to state what they connect to and what they access. Here is everything Texere does.

### Network use

Texere sends requests only when you use a feature that needs them (searching, adding a reference, opening Reference stats…). It sends the words you search for, a DOI, an ISBN, a title or an author name, never the content of your notes, except where stated below.

| Service | Why Texere uses it |
|---|---|
| [OpenAlex](https://openalex.org) (`api.openalex.org`) | Search for works; citation counts, field-normalized impact, top-cited status and retractions in Reference stats; journal ratings; references for the debate map. Works without a key; an optional free key raises the daily limit. |
| [Crossref](https://www.crossref.org) (`api.crossref.org`) | Search for works; metadata from a DOI; a book's DOI from its ISBN. If you enter your e-mail in settings, it is sent as Crossref's recommended `mailto` parameter. |
| [doi.org](https://www.doi.org) | Metadata for a DOI. |
| [Semantic Scholar](https://www.semanticscholar.org) (`api.semanticscholar.org`) | Search for works; "influential citations" in Reference stats. Only with your own key. |
| [scite](https://scite.ai) (`api.scite.ai`) | How many citations support, contrast or mention a work. |
| [Open Library](https://openlibrary.org) | Search for books and look them up by ISBN. |
| [Google Books](https://books.google.com) (`www.googleapis.com/books`) | Search for books. |
| [Wikipedia's citation service](https://www.mediawiki.org/wiki/Citoid) (`en.wikipedia.org`) | Metadata from a URL, ISBN, arXiv or PubMed identifier. |
| [ORCID](https://orcid.org) (`pub.orcid.org`) | The works of an author from their ORCID. |
| [SerpApi](https://serpapi.com) (`serpapi.com`) | Google Scholar search, only with your own SerpApi key. |
| [Europe PMC](https://europepmc.org) (`www.ebi.ac.uk`) | A free PDF for biomedical articles. |
| [Unpaywall](https://unpaywall.org) (`api.unpaywall.org`) | A free, legal PDF for a DOI; only if you enter your e-mail in settings (Unpaywall requires it). |
| Open-access PDF links (arXiv, Europe PMC, PubMed Central, Frontiers, PLOS, Springer, SAGE, Taylor & Francis, Wiley, eLife, the Royal Society) | Download a reference's free PDF when you ask. |
| [Zotero Web API](https://www.zotero.org/support/dev/web_api/v3/start) (`api.zotero.org`) | Import your Zotero library without Zotero open; only with your own Zotero key. |
| Zotero desktop on your computer (`127.0.0.1:23119`) | Import from Zotero while it is open. Never leaves your computer. |
| GitHub (`raw.githubusercontent.com/citation-style-language/styles`) | Download a citation style you choose. |
| GitHub (`api.github.com`, `github.com/gorgmihai92/texere-plugin/releases`) | Check once a day for a new version; download it only when you press **Update** (see [Updates](#updates)). Nothing about you is sent. You can turn the check off. |
| [Wikidata](https://www.wikidata.org), Wikipedia and [MyMemory](https://mymemory.translated.net) | Suggest Romanian titles for your concept notes, only when you press the button; the titles (up to 80 at a time) are sent. |

Links to library catalogs (the National Library of Romania, WorldCat and others) open in your browser; Texere doesn't contact them.

### Files outside your vault

Texere is desktop only because some features read or write files outside the vault, always for a feature you use:

- **Downloads:** after you open a reference's PDF in the browser, Texere watches Downloads for up to 10 minutes and attaches the PDF you save there. Nothing else is read.
- **Your Zotero data and profile folders:** to copy the PDFs of the items you import, read the site translators the browser button needs when Zotero is closed, and notice when Zotero starts.
- **Linked files in Zotero:** copied into the vault when you import their item.
- **A temporary folder** (`texere-zotero`) for PDFs the browser button sends while Zotero is closed.
- **The export folder**, if you choose one outside the vault, and opening exported files with your system's app.
- **Documents you choose to import.**

Programs and local services, only on request: answering the Zotero Connector on `127.0.0.1:23119` while Zotero is closed (off by default; it checks the list of running apps with `ps` or `tasklist`); converting .doc, .odt or .rtf with macOS's `textutil` or LibreOffice; reading the clipboard for clean paste.

### What Texere writes in your vault

Markdown notes and the files of the features you use: reading notes and their PDFs; annotations in reading notes; the bibliography in `Support/Texere/Bibliography`; Cuts in `Support/Texere/Cuts`; exported files; the notes you write in Distil, the debate map or the writing companion; templates and guides when you add them; a weekly review if you turn it on; the suggested folders and the discipline map when you ask. Texere never deletes your notes; where it replaces something you asked it to, it keeps a copy first.

### Other plugins

- **PDF++:** Texere reads its settings (your color palette and copy templates) so the annotations it brings in look like the ones PDF++ pastes. Templates are read, never run. The setup can fix one part of an old copy template, only when you click.
- **The old Texere plugins** (Texere · Sources, Texere · Export, Texere · Insights): if they're still on, Texere asks before turning them off and copies their settings (see [MIGRATION.md](MIGRATION.md)). Nothing is deleted.

### Accounts, ads, data

Everything works without an account, except Google Scholar search (your own SerpApi key). Other keys are optional: OpenAlex, Semantic Scholar, Zotero Web API, and your e-mail for Unpaywall and Crossref. No ads, no paid features, no usage data: nothing about you or your notes is sent to the author. Your files are ordinary Markdown and PDF in your vault; Texere's settings are in `.obsidian/plugins/texere/data.json`; writing counts and the Insights index stay per device in the plugin's folder.

---

## Building from source

```
npm ci
npm run dev     # readable main.js, for testing
npm run build   # minified main.js, for a release
```

A release is built by the GitHub Action in `.github/workflows/release.yml` when a tag equal to the version in `manifest.json` is pushed.

## Credits

Texere bundles these libraries and data in its `main.js`; each keeps its own license:

- [citeproc-js](https://github.com/Juris-M/citeproc-js) by Frank Bennett: citations and bibliographies. CPAL 1.0 or AGPL 3.0.
- [docx](https://github.com/dolanmiu/docx) by Dolan Miu: Word export. MIT. Includes [JSZip](https://stuk.github.io/jszip/) (MIT or GPLv3, used under MIT) and [pako](https://github.com/nodeca/pako) (MIT and Zlib).
- [markdown-it](https://github.com/markdown-it/markdown-it) and [markdown-it-footnote](https://github.com/markdown-it/markdown-it-footnote): PDF export and preview. MIT.
- [Paged.js](https://pagedjs.org): page layout for PDF export. MIT. Includes [CSSTree](https://github.com/csstree/csstree) (MIT) and [mdn-data](https://github.com/mdn/data) (CC0).
- [Citation Style Language](https://citationstyles.org) locales and styles: CC BY-SA 3.0.
- Annotations in PDFs: [PDF++](https://github.com/RyotaUshio/obsidian-pdf-plus) by Ryota Ushio, a separate plugin you install yourself.
- Edit mode: based on [Wordplay](https://github.com/ungatedlife/wordplay) by Rob Hardy (MIT), after Jason Fried's Write_On.
- Journal ratings: from OpenAlex, which collects the Norwegian Register, the Finnish Publication Forum (JUFO), ERIH PLUS and DOAJ.
- The guide (`assets/help`), the templates and guides (`assets/notes`) and the Philosophy map: by George Mihai, CC BY 4.0.

---

## Pe scurt, în română

**Texere** adună cercetarea într-un singur loc: cauți și citezi referințe, adnotările din PDF ajung singure în notele de lectură, scrii cu lecturile la îndemână și exporți lucrarea sau teza în PDF ori Word. Interfața, configurarea și Ajutorul sunt în română și engleză; nu cere cunoștințe tehnice; vine cu șabloanele de export pentru lucrările de licență și disertație ale Facultății de Filosofie, Universitatea din București.

- **Instalare:** vault-ul gata făcut ([gorgmihai92/texere](https://github.com/gorgmihai92/texere)), deschis cu **Open folder as vault** și **Trust author and enable plugins**; sau, într-un vault al tău, cele trei fișiere din [ultima versiune](https://github.com/gorgmihai92/texere-plugin/releases/latest), puse în `.obsidian/plugins/texere/`, apoi Texere pornit din **Settings → Community plugins**.
- **La prima pornire**, configurarea te ghidează în câțiva pași: limba, unde ține Texere lucrurile, disciplina ta, PDF++ (dacă lipsește; apeși tu Install și Enable), ce lipsește din vault. Nimic nu se face fără clicul tău.
- **Module:** Referințe (căutare, citări, adnotări, Zotero), Export (PDF, Word, Markdown, import de documente), Insights (cuvinte, cum scrii, însoțitorul scrisului, linkuri, harta dezbaterii). Le pornești sau le oprești din **Settings → Texere → General**.
- **Modul Editare:** variante ale unei propoziții direct în notă, estompezi un pasaj, muți text în Tăieturi. Fără AI.
- **Ce trimite în afară:** doar când folosești o funcție care are nevoie, către serviciile din tabelul de mai sus; niciodată conținutul notelor (excepție: titlurile notelor-concept, când ceri traduceri).
- **Actualizări:** o versiune nouă apare în pagina de pornire, cu **Actualizează**; nimic nu se instalează fără clicul tău. Verificarea o oprești din **Settings → Texere → General → Actualizări**.
- **Ajutor:** butonul **?** de pe pagina de pornire; o problemă sau o idee: **Settings → Texere → Despre → Semnalează o problemă** (un e-mail la [hi@georgemihai.com](mailto:hi@georgemihai.com)).
- **Doar pe desktop**, fără reclame, fără plată, fără date despre tine.
