# Changelog

Version numbers: a big new feature raises the middle number (0.4 → 0.5), a change that alters how Texere works raises the first (0.x → 1.0), fixes raise the last (0.4.0 → 0.4.1). Earlier versions were renumbered: 4.0.0 is now 0.4.0, 3.x is 0.3.x, 2.x is 0.2.x, 1.x is 0.1.x.

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
