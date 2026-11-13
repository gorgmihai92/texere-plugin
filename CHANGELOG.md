# Changelog

Version numbers: a big new feature raises the middle number (0.4 → 0.5), a change that alters how Texere works raises the first (0.x → 1.0), fixes raise the last (0.4.0 → 0.4.1). Earlier versions were renumbered: 4.0.0 is now 0.4.0, 3.x is 0.3.x, 2.x is 0.2.x, 1.x is 0.1.x.

## 0.4.18 (13 November 2026)

- **Install new versions by itself** (setting, on by default; `updates.autoInstall`): when a check finds a newer published release (not one you said "Not now" to), `install()` runs right away with the same checks (Texere's manifest, the release's version, a whole main.js) and the current files in `previous/`; the new version starts at the next reload, with the usual "installed, Reload now" notice and Reload on the home page. Off: only announced, as before.

## 0.4.17 (13 November 2026)

- Closing the "Reference only / Reference and PDF" menu (Esc, click outside) now cancels: nothing is added, and the line goes back to what you typed (`@denn`); if the line changed meanwhile, only the `[@key]` is put back to the typed text. Enter still picks "Reference only".

## 0.4.16 (13 November 2026)

- **@ from Zotero, PDF on request** (`cite.pickZotero`, `askPdf`): after picking a Zotero item, Texere asks Zotero for its PDF attachment (2.5 s limit) and annotation count (1.5 s); with a PDF, a menu under the citation offers "Reference only" (preselected, Enter, also on Esc) or "Reference and PDF · n annotations"; without one, the reference is added directly. `add(..., { silent, noFreePdf: true, noZoteroPdf, zoteroHl: true })`; `pdfToVault({ highlights: true })` now forces the Zotero annotations even if the import default is off. One closing notice says what came in.
- **Pointer in PDF selects without copying** (`pdfhand.js`): instead of panning, the pointer turns PDF++'s auto-copy off in memory (PDF++'s mouseup handler checks `settings.autoCopy`), so a selection stays as a reading marker and nothing is written to the PDF or pasted; H / a palette colour restores it. A flag in Texere's settings restores auto-copy if Obsidian closes with the pointer on.
- **Faster highlight placement** (`highlights.docOf`): `positions` and `headSpots` use the PDF document already open in the viewer (falling back to reading the file only for an annotation the viewer doesn't have yet) instead of re-reading and re-parsing the whole file for every paste; one `getTextContent` instead of two; the heading index is kept while the page count stays the same (PDF++ rewrites the file on every highlight, which used to throw it away). On a 20 MB, 300-page PDF Texere's part went from ~770 ms to ~390 ms per highlight.
- **Update checks**: every 20 minutes, on window focus and on the home page, at most once every 2 minutes (was hourly / 10 minutes).

## 0.4.15 (13 November 2026)

- **@ citations from Zotero** (`src/sources/cite.js`): under the vault's matches, the `@` suggester lists Zotero items not yet in the vault (`Zotero.search`, local API with Zotero open, web API with a key; cached per query for a minute; 1.5 s / 3 s timeout so the list never waits on a slow Zotero; stale responses dropped). Picking one writes `[@key]` at once (`sources.keyFor`, the same key rule as new references) and adds the reference in the background (`add(x, { csl, key, stay: true })`: note, bibliography, PDF from Zotero; the note isn't opened). If the reference turned out to be in the vault under another key, the citation is rewritten. No Better BibTeX anywhere: Texere makes the citation keys.
- **"…Better BibTeX plugin is installed"** notices from other plugins (Zotero Integration) get a Texere line and a **How to fix it** button (`hintNotices`, a MutationObserver on the notice container): a dialog with Zotero's live state (closed / open / Better BibTeX probed at `/better-bibtex/cayw?probe=true`), citing with Texere's `@`, turning the other plugin off, or installing Better BibTeX step by step.
- **Bibliography right after the text** in Live Preview / Source mode: CodeMirror's scroll-past-end padding (`.cm-content` padding-bottom, ~half the window) sat between the last line and the panel; with a panel the padding moves under it (`.cm-sizer.tx-has-biblio`).
- **Pointer in PDF** (`src/core/pdfhand.js`): a pointer button in every PDF toolbar (before PDF++'s palette), the **H** key in a PDF (not in PDF++'s Vim mode) and the command "Pointer in PDF": arrow cursor, drag pans the `.pdf-viewer-container`, the text layer can't be selected (so PDF++ copies/pastes nothing), the click after a drag is swallowed. PDF++'s selected colour is left as it was (only dimmed), so H brings back the same colour; picking a colour also turns it off.
- **No new pane per highlight** (`highlights.showNote`): a note open in a sidebar, a popout window or a background tab didn't count as open, so every pasted highlight split a new pane. Now any leaf already showing the note (or holding it, deferred included) is used; a background tab in the main area is brought forward unless it sits behind the PDF itself.
- **No more "Article 1"**: a note stores a journal's issue in `number`; it was copied to `issue` but also left in `number`, which APA prints as an article number (replacing the pages). Now moved, for the note's bibliography and for export.

## 0.4.14 (12 November 2026)

- Focus mode's default hotkey is now **Mod+Shift+D**: Mod+Alt+F is Obsidian's editor Find and replace (an editor keymap, not a command, so it wins and doesn't show as a conflict in Hotkeys). Checked free in Obsidian's commands and the common plugins.

## 0.4.13 (12 November 2026)

- **Focus mode** (`src/core/focus.js`), command "Focus mode: only the open files", default hotkey Mod+Alt+F (0.4.14: Mod+Shift+D): collapses both sidebars (remembering their state) and hides the ribbon, tab headers and view headers of the main area, and the status bar; split panes stay. On macOS (frameless window) a 32 px strip stays at the top to drag the window and keep the traffic lights off the text. The same hotkey restores everything; leaving Texere also restores it.

## 0.4.12 (11 November 2026)

- **Reload** (home page, settings, the "installed" notice, rollback) now reloads the whole app (`app:reload`, fallback `location.reload()`), instead of disabling and re-enabling the plugin, which kept the old manifest in memory: the new version didn't start and "Texere x is installed. It starts after a reload" stayed.

## 0.4.11 (11 November 2026)

- Home → **First steps** redesigned, minimal: "First steps · n of 4" with a thin progress line; the next step highlighted (soft background, accent number) with one line on how and a link to the place (Open References / Open the PDF / New note / Open Export); done steps checked in the accent colour, the first one with the reference you added; later steps faded, still clickable. "Annotate it" → "Annotate its PDF".

## 0.4.10 (11 November 2026)

- **Setup copy, shorter:** "Where Texere keeps things" — two one-line cards, no list (the next steps show what was done); the Texere structure is always preselected and just "Recommended"; "My own folders" — fields without per-place explanations, "Other folders (optional)". Results: top-level folders with what each holds; bibliography and "6 citation styles"; templates and guides counted; the map card "The map of philosophy" + "435 notes · folder"; PDF++ "installed and on" + "Texere's settings". Done: three short lines.
- **Map fields:** fix — a second Next on the map step while it was importing un-chose the map (stale status) and dropped its fields from the reading-note template; the un-choose now checks the live status. Choosing a map also sets its fields' Obsidian property type to *List* (multitext) unless you set another. After an update, a vault with the map but without its fields (and not declined) gets them in the completion window. Declining a map is remembered (`fields.declined`).

## 0.4.9 (11 November 2026)

- Setup, discipline step reworded: title "Your discipline's map"; it says the map is imported into the vault (one note per branch, concept, theory, movement, period and author, linked, like a small dictionary of the field) and what it's for; the card reads "The map of philosophy · 435 notes" with "On Next, I'll import it into …" / "Imported · in …"; how to skip or import later; result "Imported the map of philosophy: 435 notes in …". Settings and home: "Import the map".

## 0.4.8 (11 November 2026)

- **Emptied vault → start over:** at startup, if Texere was set up but the vault has no notes of yours and none of Texere's folders exist (bibliography, reading notes, PDFs, export), the setup state is reset (onboarded, structure, seen folders, presets, completion, field map, folders) and the setup opens as in a new vault — instead of "isn't in the vault anymore" alerts. Language, modules and update state stay.

## 0.4.7 (11 November 2026)

- **Tag colours from PDF++** (`src/core/tagcolors.js`): one `<style>` built from PDF++'s palette, like the ready-made vault's `highlight-tags.css` snippet (text in the tag's colour, grey outline, transparent background; reading view, Live Preview, source mode). Rebuilt when the palette changes (checked every 3 s), removed when PDF++ is gone.
- **Update check:** at start (8 s after), every hour, and when the home page renders — at most once every 10 minutes; immediately if Texere's version changed since the last check (e.g. BRAT updated it). Was: at most once an hour, so a release published soon after a check stayed invisible.

## 0.4.6 (11 November 2026)

- Fix: with Texere's PDF++ settings (write highlights to the PDF on), highlighting failed with "PDF++: An error occurred while attempting to add an annotation" — PDF++ refuses to write an annotation without `author`, which the 0.4.5 preset left empty. The preset now sets it to the computer account's name (`id -F` on macOS, else the username); at startup, a PDF++ with Texere's palette and no author gets one (nothing else is changed).

## 0.4.5 (11 November 2026)

- **PDF++ preset** (`assets/pdfplus-preset.json`, from the ready-made vault's `.obsidian/plugins/pdf-plus/data.json`, without the author): the Texere palette (colours as tags), auto-copy, auto-paste, auto-focus targets, copy commands (Quote in callout, Paragraf, …), display formats (Referință `@id, p.`), `defaultWriteFileToggle`, `proxyMDProperty: attachment`, `enablePDFEdit`. Applied when PDF++ is installed or turned on by Texere (written before it starts), in the setup's PDF++ step, in the completion window after an update, and from the home page (**Apply**) — only when PDF++ still has its default palette (Yellow, Red, Note, Important). PDF++ is restarted after the settings change so its toolbar and ribbon icons follow.
- Home: **Install** for a missing PDF++ installs it through Obsidian (with the preset); its page opens only if that fails.
- Updates: the automatic check runs at startup (at most once an hour; was once a day) and every 6 hours. **What's new** shows after any update (Texere's own, BRAT's or by hand): Texere remembers the last version it ran.
- After an update, the completion window also turns on *Automatically update internal links* if it's off.

## 0.4.4 (11 November 2026)

The setup does everything, one step at a time.

- **The Texere structure** (recommended): after you choose it, each thing is its own step that runs, shows what it did (✓ list), then waits for **Next**: folders (the whole structure of the ready-made vault), bibliography and citation styles, templates and writing guides, the discipline map (your choice), **PDF++**.
- **PDF++ installed by Texere:** through Obsidian's own installer (`app.plugins.installPlugin`, the same as Community plugins → Install, with Obsidian's checks), from the repo in Obsidian's official plugin list, then turned on. If it can't (offline), the step says so, with **Try again** and **Open its page**. In a setup run again, PDF++ is a step with **Install and turn on PDF++** / **Open its page**.
- **My own folders:** Texere's folders (reading notes, PDFs, inbox, export, templates) are filled in with the recommended names and created; the bibliography is shown; the other folders of the structure (Notes, Workspace, Media) are unticked, created only if you tick them. PDF++ is installed too.
- **Finish** opens the home page in a new tab and puts the Texere icon first in the ribbon.
- **After an update, in a vault set up before:** if one of Texere's folders, the bibliography or its styles, a template or writing guide, or PDF++ is missing, a short window adds them, one step at a time (once per version). A folder that was moved or renamed is not recreated empty; the home page offers to use the new one. Your other folders are never recreated.
- **Put it back** for the bibliography only takes a folder with `bibliography.json` and Texere's citation styles (never another plugin's, e.g. BibLib).
- **Home → Recent** lists files you opened or edited, not the notes the setup created.

## 0.4.3 (11 November 2026)

Texere works from the first start, in a new vault and in one you already have.

- **Citations and the bibliography work at once:** if the bibliography folder was never in the vault, Texere creates it with an empty `bibliography.json` and six citation styles (APA, Chicago author-date, Chicago notes, MLA, Harvard, IEEE; CSL, CC BY-SA 3.0) bundled in the plugin. A `bibliography.json` that belongs to another plugin (e.g. BibLib) is never touched.
- **No false alarms on a new vault:** Texere remembers which of its folders were ever in the vault (`seen` in its settings; follows renames in Obsidian). Only a folder that was there and disappeared gives **Put it back** / **Choose…**; one that was never there is created when first needed (reading notes, PDFs, export). Vaults set up before this version keep their alerts as they were. While Texere isn't set up, the home page shows only **Set up**.
- **New vault:** the home page in the new tab, the Texere icon first in the ribbon, links update on rename; the setup proposes the Texere structure, numbered like the ready-made vault (`1. References`, `2. Notes/{Essays, Personal, Imported, Disciplines}`, `3. Workspace/…`, `4. Export`, `Support/{Media, Templates}`), with attachments in `Support/Media`.
- **Existing vault:** the setup selects **My own folders** (empty fields, examples as hints; inbox and templates optional) and marks the Texere structure "Recommended for new vaults"; the ribbon, sidebar and Obsidian settings stay as they are.
- The discipline map goes in `2. Notes/Disciplines` (was `Fields` when the notes folder didn't exist yet). The suggested folders: `Imported` instead of `Poetry`.
- Includes 0.4.2 (not published separately).

## 0.4.2 (9 November 2026)

Smoother, and a few fixes.

- **Performance:** with the Zotero button on and Zotero closed, Texere checked the running programs (`ps`) every second; each check blocked Obsidian for about 50 ms, so scrolling a PDF, typing and closing tabs stuttered. Now the check runs only while Obsidian is in the background (at most every 1.5 s) or once a minute; Zotero starting is still caught at once by watching its files.
- **Citations with @:** the list forgives a typo (`@ascombe` finds Anscombe) and missing diacritics (`@vica` finds Vică), and shows the references you added most recently first.
- **Distil** shows the printed page of an annotation (from its citation), not the PDF's page index.
- **Pasted citations:** an APA book (publisher after the title, no volume or pages) is read as a book, not as a journal article.
- **Help:** the citation example uses `[@citekey, p. 29]`.

## 0.4.1 (9 November 2026)

What a new version brings for your vault is offered, never imposed.

- **Vault updates through the plugin:** new templates, notes and reading-note fields, new versions of Texere's templates, Texere's new settings, settings and minimum versions for other plugins. Templates, notes and fields are only offered on the home page (**Add** / **Not now**, nothing ticked for you) and wait in **Settings → Texere → General → From updates**; a template you changed is never overwritten (**Replace** keeps yours next to it). For developers: `src/core/vaultupdates.js`, and `tools/notehash.js` for the hashes of earlier versions.
- **Install with BRAT** in a vault of your own; the guide and the README say how.
- **Examples:** Descartes' *Meditations on First Philosophy* and Mill's *Utilitarianism* replace the old examples in the guide and in the ready-made vault; Distil and Home no longer count them as yours.

## 0.4.0 (8 November 2026)

One plugin instead of four, a guided setup, Help inside Texere, and the words researchers use.

### One plugin
- **Texere** replaces Texere · Sources, Texere · Export and Texere · Insights. **References**, **Export** and **Insights** are modules you turn on or off in **Settings → Texere → General**. On first start Texere asks before turning the old plugins off, copies their settings and keeps their commands (see MIGRATION.md).
- **No more Templater** and no scripts in the vault: everything the scripts did is in the plugin.
- **Updates when you choose:** a new GitHub release shows up on the home page with an **Update** button; it installs into the plugin's folder only, and **Settings → Texere → General → Updates** can go back to the previous version.

### The words researchers use
- **References** (was Sources), **reading notes** (literature notes), **annotations** (highlights), **PDFs** (Documents), **Cuts** (Overflow) and the **discipline map** (map of fields). Folders and notes were renamed through Obsidian, so links follow.
- Reading notes keep their metadata in the import order: the reference's data, then the template's fields, then the fields you added.

### Setup
- A few short steps: language, where Texere keeps things (the recommended folders or your own), your discipline (Philosophy ticked), PDF++ (only if missing), what's missing in your vault. Each step has one **Next**; untick what you don't want.
- The discipline map's fields (discipline, branch, subfield, period, movements, theories, concepts) come with the map; without Philosophy, they aren't added.
- What the setup did stays in **Help → Your last setup**.

### Help
- Help opens on the guide's contents, under a search that understands your own words; each chapter has its questions folded into one line, and the previous and next chapter on the title's line.
- The guide lives in the plugin and updates with it; the answers are shorter, with lists where they were long.
- **Report a problem** (Settings → Texere → About) opens an e-mail with your versions filled in.

### Folders
- Texere follows the folders you move or rename in Obsidian; its own things sit in **Support/Texere** (Guides with Writing guide references, Bibliography, Cuts).
- **Settings → Texere → General → Folders**: one line per folder saying what goes there, and one **Change…** button with a searchable picker (the export folder can also be anywhere on your computer).

### The Philosophy map
- Folders **Branches**, **Subfields**, **Theories**, **Periods**, **Movements**, **Concepts** and **Authors**; reading notes link to them with **discipline**, **branch**, **subfield**, **period**, **movements**, **theories**, **concepts** and **authors**.
- A note for every author, periods without dates in their titles, Modern split into **Early Modern Philosophy** and **19th-Century Philosophy**, better aliases, unused property types removed. Your own notes and aliases are kept.

### References
- **Add a reference** has its title on one line and its tabs (Search, Zotero, Paste, Enter manually) underneath.
- Citations show in your theme's main color (**Settings → Texere → References → Notes & citations** can make them plain).
- The reading note's fields (discipline, branch…) are edited in their own block in Notes & citations: add, move or remove them.

### Writing and export
- **New essay** replaces New article: title and author, abstract, contents that build themselves, Introduction, Background, Argument, Objections and replies, Limitations, Conclusion, Bibliography, with hints that stay out of the export.
- **Edit mode**: try versions of a word, sentence or paragraph in the note, dim a passage, move text to the note's Cuts; marks and trims without AI. Based on Wordplay by Rob Hardy, after Jason Fried's Write_On.
- **a/an** follows the word when you pick a version (English text).
- Export: **Links and citations: colored** (off by default) colors them with the theme's main color in PDF and Word.

### Insights (Lab)
- Four tabs: Writing, Reading, Links, Projects. Every screen and section has the same layout: title and subtitle on the left, buttons on the right.
- Simpler: one number for how much you wrote, eight key measures first (**Show all** for the rest), one **To tidy** card, empty cards hidden, the Lab note shown once.
- **Projects** can be a folder, a tag or a single note; they're set in one place (**Settings → Texere → Insights**), with one searchable picker.
- **Debate map**: filters combine (e.g. You disagree + Claims and definitions), and **Start a note from these** (or **from all**) makes an outline grouped by kind, with citations, your notes and a prompt for each.

## Earlier (0.3.x, October–November 2026)

### Writing
- **Writing companion**: one side panel for a draft: the skeleton of the argument, what each paragraph is missing, definitions and highlights you can insert, a source you could cite (only when the paragraph names its author or someone its highlights discuss), words to check, writing stats and the full check, with a switch between Philosophical essay and General text.
- Inserting a citation now goes before the final full stop, or after the word the cursor is in, instead of at the start of the paragraph.
- Fewer things on by default: the orange line for uncited claims, the coloured margin lines and the status bar are off until you turn them on; the concept panel and the in-note writing stats start folded; the weekly review is off in new vaults.
- "Surprise me" was removed.

### Concepts and reading
- **Concept panel** at the end of concept notes, with a **To tidy** section for unlinked mentions, aliases you could add and possible duplicates.
- **Debate map** for a concept: who agrees and who disagrees, from tagged highlights; **Start a note from these** turns disagreements into an outline; **Distil them** and **Write your note** send the highlights you have not commented on to Distil.
- **Home page**: the Texere ribbon icon opens the Texere home.

### Sources
- **Source stats** shows how an article's journal is rated: Norway's and Finland's expert-panel levels, ERIH PLUS and DOAJ; search results show "Leading journal" or "Top journal" and ERIH PLUS. No journal citation numbers (unreliable in philosophy).
- Select a reference in a note and add it as a source.

### Writing counts
- Highlights that PDF++ pastes into a note (auto-paste) count as pasted words, passage only, without the tag, citation and PDF link.
- Words typed right after a paste count as typed, not pasted.

### Fixes
- An empty code block no longer hides the rest of a note from Insights.
- Several false positives removed from the writing checks (poems, keyword lines, bibliographies, PDF page breaks).
