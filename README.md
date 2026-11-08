# Texere

**Research in one place**, inside [Obsidian](https://obsidian.md).

> **This repository is the Texere plugin**, the base of [Texere – The Researcher's Vault](https://github.com/gorgmihai92/texere). The vault is the easiest start: the plugin, the Philosophy map, templates and guides, ready to open. Install the plugin from here to use Texere in a new or existing vault of your own.

Research is usually scattered across many applications and places: Zotero, Mendeley or EndNote, Word or Google Docs, a laptop, the cloud, a phone, USB sticks and external drives. Moving between them costs time and loses things along the way.

Texere is a plugin for [Obsidian](https://obsidian.md), a free note-taking app, for researchers who want one place for the whole process: finding references, reading PDFs, taking notes, writing, citing and exporting. It comes with a map of philosophy, but you can reshape it for any discipline.

- **Anyone, without technical knowledge.** Install it (or download the ready-made vault), and a short setup does the rest. No code, no command line, no LaTeX.
- **English and Romanian writers.** The interface, the setup, Help and the guide work in both languages. Notes have English names and Romanian aliases: type `[[Etică` and you get **Ethics**.
- **University of Bucharest students.** Export templates for BA and MA theses at the Faculty of Philosophy, following the faculty's writing guide.

## What you can do with it

- **Add references** by title, DOI or ISBN, or import them from Zotero. Each one becomes a note, with its free PDF when there is one.
- **Read and annotate PDFs.** What you highlight goes into the reference's note, with the page and a link back.
- **Cite** by typing `@` and picking the reference, in APA, Chicago, MLA or any other style.
- **Export** your paper or thesis to PDF or Word, with the bibliography and contents made for you.
- **See how you write** (Insights, still experimental): how much you write, and what your notes say about a concept.
- **Get help** inside [Obsidian](https://obsidian.md): the whole guide, in English and Romanian, with a search.

No AI, no account, no subscription. Your notes stay plain files on your computer.

## Get started

You need [Obsidian](https://obsidian.md) on a computer (Mac, Windows or Linux). It's free: [download it here](https://obsidian.md/download).

### The easy way: the ready-made vault

1. Download [Texere – The Researcher's Vault](https://github.com/gorgmihai92/texere/archive/refs/heads/main.zip) and unzip it.
2. Open [Obsidian](https://obsidian.md), choose **Open folder as vault** and pick the unzipped folder.
3. Click **Trust author and enable plugins**. The setup starts by itself.

### Your own vault, even an empty one

1. **Make a vault.** Open [Obsidian](https://obsidian.md) and choose **Create new vault**, give it a name, pick where to keep it and click **Create**. (Already have a vault? Open it and skip this step.)
2. **Turn on community plugins.** **Settings** (the gear, bottom left) → **Community plugins** → **Turn on community plugins**.
3. **Install BRAT**, a free helper that installs plugins from GitHub: in **Community plugins** click **Browse**, search for **BRAT**, then **Install** and **Enable**.
4. **Add Texere.** Press **Ctrl/Cmd + P**, type `BRAT plugin` and choose **Plugins: Add a beta plugin for testing**. Paste `gorgmihai92/texere-plugin`, leave **Latest version**, tick **Enable after installing the plugin** and click **Add plugin**.
5. **Follow the setup.** It opens by itself and takes a minute: your language, where Texere keeps things, your discipline (the Philosophy map), PDF++ for annotations (you click **Install** and **Enable**), and what's missing in your vault. In an empty vault, leave everything ticked and click **Next** at each step: Texere makes the folders, the templates, the bibliography and the Philosophy map.

<details>
<summary>Without BRAT: copy the files yourself</summary>

1. From the [latest release](https://github.com/gorgmihai92/texere-plugin/releases/latest), under **Assets**, download `main.js`, `manifest.json` and `styles.css`.
2. In **Settings → Community plugins**, click the folder icon next to **Installed plugins**: your vault's plugins folder opens. Make a new folder in it called `texere` and move the three files into it.
3. Back in Obsidian, click the refresh icon next to **Installed plugins**, then switch **Texere** on. The setup opens by itself.

</details>

Done. Every new tab now opens Texere's home page. Start with **Add a reference**.

The setup changes nothing without your click, and you can run it again from **Settings → Texere → General**.

## Updates

When there's a new version, Texere's home page shows it with an **Update** button (with BRAT, it can also update itself when Obsidian starts). Nothing installs until you click, and your notes are never touched. You can go back to the previous version from **Settings → Texere → General → Updates**.

## Help

- In [Obsidian](https://obsidian.md): the **?** button on Texere's home page opens the guide and the frequent questions.
- A problem or an idea: **Settings → Texere → About → Report a problem** writes an e-mail to [hi@georgemihai.com](mailto:hi@georgemihai.com).

## Privacy

Texere connects to the internet only when you use a feature that needs it (searching for a reference, downloading a PDF or a citation style, checking for updates), and never sends the content of your notes. No ads, no tracking, nothing sent to the author. The full list is below.

<details>
<summary>Everything Texere connects to and accesses (for [Obsidian](https://obsidian.md)'s plugin review)</summary>

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

</details>

<details>
<summary>For developers: building from source</summary>

```
npm ci
npm run dev     # readable main.js, for testing
npm run build   # minified main.js, for a release
```

A release is built by the GitHub Action in `.github/workflows/release.yml` when a tag equal to the version in `manifest.json` is pushed.

</details>

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

Version 0.4.0 · by [George Mihai](https://www.georgemihai.com/?utm_source=texere&utm_medium=github_plugin&utm_campaign=texere) · code under MIT, guides and the Philosophy map under CC BY 4.0 (see [LICENSE](LICENSE))

## Pe scurt, în română

**Texere** e un plugin pentru [Obsidian](https://obsidian.md) care adună cercetarea într-un singur loc: cauți și citezi referințe, adnotările din PDF ajung în notele de lectură, scrii cu lecturile la îndemână și exporți lucrarea în PDF sau Word. Merge în română și engleză și nu cere cunoștințe tehnice. Cel mai simplu început e vault-ul gata făcut: [Texere – The Researcher's Vault](https://github.com/gorgmihai92/texere).

**Într-un vault al tău, chiar gol:**
1. Instalează [Obsidian](https://obsidian.md/download) (gratuit) și fă un vault: **Create new vault**, un nume, un loc, **Create**.
2. **Settings → Community plugins → Turn on community plugins**.
3. În **Community plugins → Browse**, caută **BRAT**, apoi **Install** și **Enable**.
4. **Ctrl/Cmd + P** → `BRAT plugin` → **Plugins: Add a beta plugin for testing**. Lipești `gorgmihai92/texere-plugin`, lași **Latest version**, bifezi **Enable after installing the plugin** și apeși **Add plugin**.
5. Configurarea pornește singură: limba, folderele, disciplina, PDF++ (apeși tu Install și Enable) și ce lipsește din vault. Într-un vault gol, lași totul bifat și apeși **Înainte** la fiecare pas.

**Ajutor:** butonul **?** de pe pagina de pornire. O problemă: **Settings → Texere → Despre → Semnalează o problemă** (un e-mail la [hi@georgemihai.com](mailto:hi@georgemihai.com)).
