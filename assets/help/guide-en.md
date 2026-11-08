---
title: Texere
subtitle: The Researcher's Vault
author: George Mihai
lang: en
version: "0.4.0"
date: "Version 0.4.0 · 8 November 2026"
---
## 1. Start

Research is usually scattered across many applications and places: Zotero, Mendeley or EndNote, Word or Google Docs, a laptop, the cloud, a phone, USB sticks and external drives. Moving between them costs time and loses things along the way.

Texere is a ready-made Obsidian vault for researchers who want one place for the whole process: finding references, reading PDFs, taking notes, writing, citing and exporting. This version comes with a map of philosophy, but you can reshape it for any discipline.

#### Who it's for

- **Anyone, without technical knowledge.** Download the vault, open it in Obsidian, and a short setup does the rest. No code, no command line, no LaTeX.
- **English and Romanian writers.** The interface, the setup, Help and the guide work in both languages. Notes have English names and Romanian aliases: type `[[Etică` and you get **Ethics**.
- **University of Bucharest students.** Export templates for BA and MA theses at the Faculty of Philosophy, following the faculty's writing guide.

![[Without and with Obsidian.png]]

**Step 1. Set up the vault (once)**

1. Install [Obsidian](https://obsidian.md/download) (free).
2. Copy the vault folder to your computer; in Obsidian, choose **Open folder as vault**.
3. Click **Trust author and enable plugins**.
4. The setup opens by itself. In each step, tick or pick what you want; **Next** applies it.
5. At the end, **See what was done** shows a summary (later: **Help → Your last setup**).

> [!warning] Clicked "Restricted mode" by mistake?
> The plugins are off. Turn them on in **Settings → Community plugins**.

> [!note] One plugin to install yourself
> Texere needs **PDF++** for annotations. The setup opens its page: **Install**, then **Enable**.

**Step 2. Work:** add a reference ([[#2. References and reading]]), read and annotate ([[#2.5 Reading and annotations]]), write and cite ([[#3. Writing]]), export ([[#4. Export]]).

#### The home page

Every new tab opens Texere's home page: your last files, the main actions, anything that needs fixing (with a button) and, in a new vault, **your first week**, four steps that tick themselves off.

Stuck? The **?** button next to **+**, at the bottom, opens Help: type your question in your own words. New to Obsidian? Start with [[#1.4 Obsidian in five minutes]].

### 1.1 Terms

| Term | Meaning |
| --- | --- |
| **Vault** | The folder with your notes and settings (including the hidden `.obsidian`). |
| **Link** | `[[Note name]]` points to another note. **Backlinks** shows who links to the open note. |
| **Tag** | A word with `#` in front, like `#claim`. |
| **Properties (metadata)** | The fields at the top of a note. For a reference: author, year, title, DOI, branch… |
| **Reading note** | One per reference: its data, its PDF and your annotations. |
| **Citekey** | A reference's code, like `craig_philosophy_2002`: the note's `id`. |
| **Citation** | `[@citekey, p. 34]`, shown as (Craig, 2002, p. 34). |
| **Bibliography** | `bibliography.json`, in **Support/Texere/Bibliography**, kept up to date by Texere. |
| **Command palette** | Every command, with **Ctrl/Cmd + P**. |

### 1.2 The Texere plugin and its modules

Texere is one plugin with three modules. Turn them on or off in **Settings → Texere → General**.

| Module | What it does | Where |
| --- | --- | --- |
| **References** | Adds references, shows citations in your style, brings annotations into notes, keeps the bibliography | bottom bar |
| **Export** | PDF, Word or Markdown, with citations, bibliography and contents | bottom bar, or the Texere item at the bottom right |
| **Insights** `LAB` | How much and how you write, links and patterns | bottom bar |

Each module also works alone. Without References, Export still works, but citations stay `[@citekey]` and there is no bibliography.

Texere stays quiet in your notes: while you write you see only your text, marks appear only if you turn them on, and nothing is written into a note without your click. Everything it can do for a note: right-click the note → **Texere**.

### 1.3 Vault structure

| Folder | What's in it |
| --- | --- |
| **1. References** | **Reading Notes** (one per reference) and **PDFs** |
| **2. Notes** | **Essays**, **Personal**, **Poetry**, and **Disciplines** (the discipline maps) |
| **3. Workspace** | **Courses**, **Thesis**, **Articles**, **Projects** |
| **4. Export** | the exported files |
| **Support** | **Media** (images), **Templates**, and **Texere**: **Guides** (with **Writing guide references**), **Bibliography** (and citation styles), **Cuts** (what you cut from each note) |

#### Changing the structure

- **Move or rename in Obsidian**, not in Finder or Explorer, and Texere follows. Moved something in Finder? A new tab helps you find it.
- **Where each folder is**, and where new references go: **Settings → Texere → General → Folders**.
- **A suggested folder missing?** Create it there with one click. Texere never puts back a folder you deleted.
- **The one rule:** don't change a reading note's `id` (its citekey).

#### The map of philosophy

**2. Notes/Disciplines/Philosophy** has a note for each branch, theory, concept, movement, period and author, starting from [[Philosophy]], each with a Romanian alias.

Use them in your references' metadata. [[Craig 2002 – Philosophy. A very short introduction]] has [[Introduction]] as **branch**: open [[Introduction]] and **Backlinks** lists every reference in that branch.

No **Disciplines** folder? **Settings → Texere → General → Folders → Discipline map → Create the map**. A map for another discipline? Write to [hi@georgemihai.com](mailto:hi@georgemihai.com).

### 1.4 Obsidian in five minutes

Obsidian is free and works with plain text files on your computer: no account, nothing in the cloud unless you put it there. Each note is a `.md` file you can open in any editor.

- **Left sidebar:** **Files**, **Search**, **Bookmarks**; above them, the icons for Texere, the graph and other plugins.
- **Middle:** your notes, in tabs, like a browser.
- **Right sidebar:** about the open note: **Outline**, **Backlinks**, the writing companion.
- **Bottom right:** the status bar, with the **Texere** item (export, citation style…).
- **Settings:** the gear at the bottom left.

**Writing.** Markdown, shown as you type: `**bold**`, `# Heading`, `- list`. The ⋯ menu at the top of a note switches to **Reading view**.

**Links.** Type `[[` and pick a note; a link to a note that doesn't exist yet creates it when clicked. Click a tag to see every place you used it.

**Graph view.** Notes as dots, links as lines. The whole vault: the graph icon on the left. Around one note: ⋯ → **Open local graph**. References linked to the map (by branch, concept or author) gather into clusters, so you see what you read most. The graph's settings filter by folder or tag, e.g. `path:"1. References"`.

**Plugins.** The vault comes with Texere and PDF++, plus Style Settings, Omnisearch, Excalidraw and Editing Toolbar. You don't need anything else.

[This video](https://www.youtube.com/watch?v=z4AbijUCoKU) shows the interface in a few minutes.

## 2. References and reading

Each reference has a note in **Reading Notes**, named *Author Year – Title*, and its PDF in **PDFs**. The ones already there are examples: delete them whenever you like. References with other names (from an older vault): the home page offers to rename them.

### 2.1 Search and add

1. Open **References** in the bottom bar (or **Ctrl/Cmd + P** → **Texere: Add a reference**).
2. Type a title, an author, a DOI, an ISBN or a link.
3. Pick the reference and click **Add to vault**. The free PDF comes with it, when there is one.

Already have the citation, BibTeX, RIS or DOI? **Paste**. No catalog has it? **Enter manually**. "Limit reached"? Add a free key in **Settings → Texere → References → Catalogs**.

### 2.2 From Zotero

1. Open Zotero. **First time only:** **Settings → Advanced** → tick **Allow other applications on this computer to communicate with Zotero**.
2. In Texere: **References** → **Zotero**. ✎ marks items with annotations.
3. Tick what you want and click **Import**.

You get the note, the PDF and the annotations, each tagged by its color.

- **Nothing is doubled:** a reference already in the vault only gets what's missing.
- **A PDF without title or authors** goes to **PDFs/Inbox**, and Texere asks which reference it belongs to.
- **Which color becomes which tag:** **Settings → Texere → References → Zotero → Advanced**.

> [!tip] Recommended: a Zotero key
> Add it in the same place. Import then works with Zotero closed.

### 2.3 From the browser, with the Zotero button

1. Install [Zotero Connector](https://www.zotero.org/download/connectors) in your browser.
2. Turn on **Settings → Texere → References → Zotero → Zotero browser button**.
3. On an article's page, click the Zotero button (Obsidian must be open). With Zotero open, the reference goes to Zotero, then to the vault; with Zotero closed, straight to the vault.

> [!warning]- It saved a web page instead of the article?
> On a Mac, closing Zotero's window doesn't quit it: press **Cmd + Q**. Then **Zotero Connector → Preferences → Advanced → Reset Translators**, and try again.

### 2.4 A PDF you already have

1. Open the PDF in Obsidian.
2. **Ctrl/Cmd + P** → **Texere: Add this PDF as a reference**.
3. Pick the reference. The PDF is attached and moved to **PDFs**.

PDFs still without a reference: **PDFs without a reference**, in **References** or the Texere item. A reference without a PDF: right-click its note → **Texere** → **Find the free PDF**.

### 2.5 Reading and annotations

1. Open the reading note and click the PDF in **attachment**.
2. Select a passage and pick a color from the **PDF++** palette.
3. Paste it in the note (**Ctrl/Cmd + V**). It starts with the color's tag and ends with the citation and **· PDF**, a link back to the exact place.

| Color | Tag | You mark |
| --- | --- | --- |
| pink | `#fact` | facts, dates, figures |
| yellow | `#claim` | the author's claims |
| red | `#disagree` | what you disagree with |
| teal | `#agree` | what you agree with |
| blue | `#connection` | links to other texts or ideas |
| purple | `#question` | questions |
| orange | `#definition` | definitions |
| gray | `#word` | terms to remember |

**Annotations made elsewhere** (Zotero, Preview, Acrobat) come into the note by themselves, with the tag of the closest color. Made after adding the reference: right-click the PDF or the note → **Texere** → **Import annotations from PDF**. Made under another name: Texere asks whether they're yours.

> [!example] From a real note
> In [[Craig 2002 – Philosophy. A very short introduction]]:
> ```
> #claim In fact philosophy is extremely hard to avoid, even with a conscious effort.
> [@craig_philosophy_2002, p. 12] · PDF
> Even sceptics who said that philosophy is useless have a certain set of values…
> ```
> The annotation, then your comment under it.

**After reading:** search a tag (`tag:#disagree`) across all your readings, and fill in **Thesis**, **Arguments**, **Counterarguments** and **Conclusions** in the note.

#### Distil: your annotations in your own words

Open it from **Home → Distil**, or right-click a reading note → **Texere**. Texere shows one annotation at a time; you write a sentence or two, saved right under it, already cited: `… [@craig_philosophy_2002, p. 34]`.

- An annotation counts as used once something of yours sits under it; `#word` annotations are skipped.
- **Delete annotation** removes it from the note and the PDF; **Undo** brings both back.
- From a debate map, **Distil them** takes only that concept's annotations you haven't written about.

#### Reference stats

At the top of each reading note, refreshed daily: how others cite it ([scite](https://scite.ai), [OpenAlex](https://openalex.org), [Semantic Scholar](https://www.semanticscholar.org)), what you annotated and, for an article, how expert panels in Norway and Finland rate its journal and whether it's in ERIH PLUS or DOAJ.

## 3. Writing

### 3.1 Start from a template (optional)

| Template | For |
| --- | --- |
| [[New essay]] | a paper or an article, with contents and a simple structure (introduction, sections, objections, limitations, conclusion): duplicate it, fill in **title** and **author**, leave **Bibliography** empty (the export fills it) |
| [[Licență – Facultatea de Filosofie UB]] | a BA thesis, by the faculty's rules |
| [[Disertație – Facultatea de Filosofie UB]] | an MA thesis, by the faculty's rules |

For the theses, fill in **title**, **autor**, **coordonator** and **an**. The rules: [[Ghid de redactare – Licență și disertație (Facultatea de Filosofie, Universitatea din București)]].

### 3.2 Citing references

1. Type `@` and a word from the author or the title.
2. Pick the reference: Texere writes `[@citekey]`.
3. Add the page: `[@citekey, p. 34]`. Always give it when you quote or paraphrase.

In the note, the citation reads like text: (Craig, 2002, p. 34). Click it to open the reference or the PDF, or to edit it.

| You write | You get (APA) |
| --- | --- |
| `[@craig_philosophy_2002]` | (Craig, 2002) |
| `[@craig_philosophy_2002, p. 34]` | (Craig, 2002, p. 34) |
| `[@craig_philosophy_2002, pp. 34-36]` | (Craig, 2002, pp. 34–36) |
| `[@craig_philosophy_2002; @dummett_origins_1996]` | (Craig, 2002; Dummett, 1996) |
| `@craig_philosophy_2002 [p. 34]` | Craig (2002, p. 34) |
| `[see @craig_philosophy_2002, ch. 2]` | (see Craig, 2002, ch. 2) |

**The citation style** shows in the Texere item at the bottom right (e.g. **APA**). Click it to pick another for this note (saved in its `csl` property; the export follows), or **Add a citation style…** from 10,000+.

### 3.3 Writing guides

- [[Getting started in philosophy – reading, arguing, writing]]: from a seminar essay to a PhD: the shape of a good text, the words for each move, red flags and a checklist. Its fourteen references are in **Writing guide references**.
- [Guidelines on Writing a Philosophy Paper](https://www.jimpryor.net/teaching/guidelines/writing.html), by Jim Pryor
- [LEADERSHIP LAB: The Craft of Writing Effectively](https://www.youtube.com/watch?v=vtIzMaLkCaM) (video)
- [[Metodologia cercetării - Literature Review]] and [[Metodologia cercetării - Structura unei lucrări științifice]] (in Romanian)

### 3.4 Edit mode: try versions

For reworking a written draft.

- **On:** ✎ at the top of the note, or right-click → **Texere** → **Edit mode**. A bar at the bottom says **✎ Edit mode** and the note's edge is colored.
- **Off:** **Done**, in that bar.

#### Versions

1. Select a word, a sentence or a paragraph and press **Versions**.
2. Type a version in the last line and press Enter; add as many as you like.
3. Try them with ↑ ↓ or a click. ✕ removes one; the original always stays.
4. **Keep what's showing** settles it.

Text with versions gets a hand-drawn line ending in dots (● the one in the note, ○ the others); click the dots to reopen them. Click the text: **← →** switch, **⌫** deletes the one showing, **⌘Z** undoes. Without clicking: **⌃⌘← →** switches, **⌃⌘↑ ↓** jumps to the next spot (Windows and Linux: **Ctrl + Alt + Shift**). Esc, or typing, takes you back to writing.

#### Dim, Cuts, checks and trims

- **Dim:** the selected passage fades, so you read the page without it. Click it to bring it back.
- **Move to Cuts:** the passage goes to this note's Cuts (**Support/Texere/Cuts**), opened with **Cuts** in the bar; **Ctrl/⌘ + Enter** puts a paragraph back at the cursor. Nothing is deleted.
- **Marks** (from **Texere** in the bar, no AI): long sentences, hedges and filler, words off in tone, claims stated too strongly, personal opinions. Click one: **Versions**, **Dim** or **Fine as is**.
- **Trims:** **Slight trim**, **Tighten more** and **Even sharper** only fade the words they'd cut. Click a word to keep it; **Original** undoes it all.

Versions and dims are kept in Texere's settings on this computer, not in the note, and switching versions doesn't count as words written. Edit mode is based on Wordplay by Rob Hardy, after Jason Fried's Write_On.

## 4. Export

1. Open the note, then the Texere item at the bottom right → **Export this note…** (or **Export** in the bottom bar).
2. Choose **PDF**, **Word** or **Markdown**; the preview shows the result.
3. Click **Export**. The message has an **Open** button.

The bibliography makes itself from the references you cite, under the **Bibliography** heading or at the end.

In the export window: the **template** (general, or the faculty's), the **citation style**, contents and a few options (each H2 on a new page, colors, tags, colored links), and the **layout** (page and text), set by the template until you open it. Your choices are kept for next time.

#### Your own templates

1. **Settings → Texere → Export → A new template** (it starts from an existing one).
2. Set the page, the text and the document there. **Done** closes them; **Edit** reopens them.
3. A note uses it with the property `export: <its name>`.

#### Good to know

- **Contents:** right-click in the note → **Texere** → **Insert the contents here**. It updates as you write and gets page numbers in PDF and Word (when Word asks to update the fields, say **Yes**).
- **Images** must be in the vault, linked with `![[image.png]]`.
- **The export folder** (inside or outside the vault): **Settings → Texere → General → Folders**.

## 5. Insights: your writing, links and patterns

> [!lab] Lab
> Insights is experimental and improves with each version; some counts may change. What it counts stays in your vault. It goes online only when you ask (to translate a concept's title, or to look up the works your references cite).

**Insights**, in the bottom bar, has four tabs: **Writing** (how much and how you write), **Reading** (what you annotate and cite), **Links** (what connects, what's missing a link), **Projects** (how far your thesis or article is). **Scan now** reads the vault again. Settings: **Settings → Texere → Insights**.

#### Words, targets and projects

- **Words:** written today, this week or this month; pasted, inserted and deleted in one line underneath; your streak and a calendar of the last year. **How you work** shows the hours and days you write, and your reading next to your writing. Undo isn't counted; each computer keeps its own count and the totals add them up.
- **Word target:** right-click a note → **Texere** → **Set a word target…**. A thin bar above the text shows how far you are.
- **Projects:** a folder, a tag or a note (your thesis, an article, a course), with an optional target and deadline: words, weekly pace and when you'll get there. **Add a project** is on the **Projects** tab.

#### Writing companion and Check this draft

The companion is a side panel for the draft you're working on: right-click the note → **Texere** → **Writing companion**.

- **At the top:** **Philosophical essay** or **General text**, and **Check this draft**.
- **One line per paragraph:** what it does and what's missing (a thesis, a citation, a reply to an objection, a definition).
- **For the paragraph you're in:** definitions and annotations from your vault, and a reference to cite, inserted with one click.

**Check this draft** reads a note after the guides in [[Getting started in philosophy – reading, arguing, writing|Getting started in philosophy]]: what your paragraphs do (argue, present others, analyze, illustrate), the argument (an early thesis, a roadmap, defined terms, objections and replies), the reasoning (reasons, examples, thought experiments, signposts), and the prose (sentence length, hedging, overclaiming, "I feel", stock phrases, loose words). **+** more is better, **−** less is better, **◦** keep it balanced. Only text you typed counts, only signals right at least 8 times in 10, and there is no score.

#### How you write (Insights → Writing)

The same signals across notes: **Compare [B] with [A]**, each your **starting point**, your last 30 or 90 days, all your writing, or notes you pick (an old draft against the new one shows your progress). Eight key measures first; **Show all** for the rest. The switches above the cards choose the signals (**General text / Philosophical essay**) and the picture (**Compare / Over time / Numbers**): a line from A to B (**blue** better, **orange** worse), small charts over time, or a table.

#### While you write (off to start with)

Each has its switch in **Insights → Writing → While you write**:

- **Writing insights:** a thin margin line in the color of what each paragraph does, and a dotted underline under opinion phrases and loose words.
- **Uncited claims:** a paragraph that argues but cites nothing gets an orange line and **cite?**. Click it: **Cite…** offers a reference, **Not a claim** hides it.
- **Concept panels:** at the top of a concept note, its definitions and where you use it.

A summary inside the note: right-click → **Texere** → **Writing stats in this note** (one line, and what to check); **Remove writing stats** takes it out.

#### Concepts, links and patterns

- **Concept panel:** the definitions from your references, where you use the concept, what it appears with, and a warning when you use it often without defining it.
- **Debate map:** your annotations on one concept from all references, grouped by thinker, with where you stand (`#agree`, `#disagree`, `#question`). Pick one or more filters (e.g. **You disagree** + **Claims and definitions**) and **Start a note from these** makes an outline from what's shown, grouped by kind, with citations and your notes.
- **To tidy** (the **Links** tab): concepts you wrote without a link (in your notes and your own lines in reading notes, never in quotes), names without a note (**Create note**), possible aliases and duplicates. **Review** groups them; **Link selected** links the first mention in each note and keeps your words: `[[Action|acțiunii]]`.
- **Patterns:** what you read but don't write about, rising topics, concepts that appear together without a link, forgotten notes that matter now, who you cite.
- **Weekly review:** turn it on in **Settings → Texere → Insights → Weekly review**: every Monday, a short note in **2. Notes/Weekly reviews**.

## 6. Problems and questions

### 6.1 Backups

Now and then, copy the vault folder to an external drive. No sensitive data? A cloud copy works too.

### 6.2 If something isn't working

1. Open a new tab, or **Settings → Texere**: both show what's missing, with a button to fix it.
2. Still not right? **Settings → Texere → General → Run the setup again**.
3. Look up the message in [[#6.4 If an error appears]].

### 6.3 Manual setup

The setup does steps 3, 4, 5 and 7 with you. By hand:

1. **Copy the whole vault**, with the hidden `.obsidian` folder (on a Mac, **Cmd + Shift + .** shows it).
2. **Turn on plugins:** **Settings → Community plugins → Turn on community plugins**.
3. **Texere and PDF++:** **Settings → Texere → General → Modules**: turn on References and Export. Under **Advanced**, PDF++: **Open its page** (then **Install** and **Enable**) or **Turn on**.
4. **Bibliography:** **Settings → Texere → References → Notes & citations → Note tag** must be `literature_note`; then **Advanced → Bibliography → Rebuild from notes**.
5. **Export folder:** **Settings → Texere → General → Folders → Export folder**.
6. **Font:** **Text → Font** in the export window (only installed fonts are listed).
7. **Templates and guides:** the setup's **Your vault** step, or **Settings → Texere → General → Advanced → Templates and writing guides**, adds the missing ones without touching yours.

### 6.4 If an error appears

| What you see | Why | What to do |
| --- | --- | --- |
| "Restricted mode", no plugins | you didn't trust the author | step 2 |
| the setup doesn't start | you closed it, or Texere is off | **Run the setup again**; otherwise step 2 |
| Texere or PDF++ commands are missing | plugins off, or `.obsidian` missing | steps 1 and 3 |
| citations stay `[@citekey]` | the References module is off | step 3 |
| "not found: @…" on export | the citekey isn't in your bibliography | type `@` and pick the reference |
| fewer references than notes | notes without the `literature_note` tag | step 4 |
| no exported file | the export folder doesn't exist on this computer | step 5 |
| another font in the export | the font isn't installed | step 6 |
| a template or writing guide is missing | it was moved or deleted | step 7 |
| "Zotero is closed" | Zotero isn't running | open it, or add a Zotero key |
| Zotero "doesn't let Texere in" | Zotero blocks other apps | Zotero **Settings → Advanced** → allow other applications |
| the Zotero button saves only to Zotero | the browser button is off | [[#2.3 From the browser, with the Zotero button]] |
| annotations missing from the note | made after the reference was added | right-click the PDF → **Texere** → **Import annotations from PDF** |
| "limit reached" in search | a catalog's daily limit | add a free key in **Catalogs** |

The step numbers are those in [[#6.3 Manual setup]].

## 7. What's new

When there's a new version, the home page shows it with an **Update** button; nothing installs without your click. Fixes raise the last number (0.4.0 → 0.4.1), new features the middle one (0.4 → 0.5), a change in how Texere works the first (0.x → 1.0).

**0.4.0** · 8 November 2026
One plugin instead of four, a guided setup, and Help inside Texere.

- **One plugin, Texere.** References, Export and Insights are modules you turn on or off in **Settings → Texere → General**; your settings came over.
- **A guided setup:** where Texere keeps things, your discipline, and what's missing.
- **The words researchers use:** **References**, **reading notes**, **annotations**, **PDFs**, **Cuts** and the **discipline map** (before: Sources, literature notes, highlights, Documents, Overflow, map of fields). Folders renamed in Obsidian, so links follow.
- **Help** has the frequent questions and the whole guide; the guide updates with the plugin.
- **Edit mode** (section 3.4): versions of a sentence, dim a passage, move text to Cuts.
- **Folders.** Texere follows the folders you move or rename in Obsidian; its own things sit in **Support/Texere**.
- **Insights is in Lab:** it works, and keeps getting better.

---

**0.3.3** · 3 November 2026
Your annotations in your own words.

- **Distil**: write each annotation in your own words, saved under it, already cited.
- **Your first week** on the new tab.
- **How you write** and **Check this draft** in Insights, for philosophical writing.
- A new guide: [[Getting started in philosophy – reading, arguing, writing]].
- References, Export, Insights and Help open inside the new tab, with a bar at the bottom and a (+) for a new note.

---

**0.3.2** · 3 November 2026
Insights arrives.

- Words typed, pasted, inserted and deleted; word targets.
- Unlinked mentions linked in one click; alias suggestions.
- Uncited claims while you write; patterns, thesis pace and a weekly review.

---

**0.3.1** · 1 November 2026
A shorter guide and a smoother Zotero.

- Texere creates the suggested folders and guards the ones it needs.
- Your own export templates; a dashboard in every new tab.
- Zotero: filters by annotations without doubling them, restores lost letters (ș, ț), adds one PDF and doesn't wait for it, always finds a free port.
- A PDF the site won't hand over: **Open the PDF**, save it or drag it into Inbox, and Texere attaches it.

---

**0.3.0** · 1 November 2026
References, citations and export without BibLib, Pandoc or LaTeX.

- Zotero import with annotations.
- Export with a preview and the faculty's thesis templates.

---

**0.2.0 – 0.2.3** · 27–30 October 2026
One vault for both languages, and the folder structure.

- English and Romanian guides; setup and Help in your language; English note names with Romanian aliases.
- The folders: References, Notes, Workspace, Export, Support.

---

**0.1.0 – 0.1.6** · 26–27 October 2026
The beginning.

- The first guide, the automatic setup, the Help button and the map of philosophy.
- The project was called Topos, then Texere (Latin, *to weave*).

<!--
For whoever maintains the vault:
1. Raise version and date (x.x.x): last digit for fixes, middle for new features, first for big changes. Add a line above.
2. Changed the plugin? Update its manifest.json, versions.json and CHANGELOG.md (the guide in the plugin's assets/help, the notes in assets/notes).
3. Keep both guides in step: same section numbers, same version. Help and the setup find answers by section number.
-->
