# Moving to Texere 0.4 (one plugin)

Until now Texere came as four plugins: **Texere** (`texere`), **Texere · Sources** (`texere-sources`, now the References module), **Texere · Export** (`texere-export`) and **Texere · Insights** (`texere-insights`). From version 0.4.0 there is a single plugin, **Texere**, and References, Export and Insights are its modules. Each module can be turned off and on in **Settings → Texere** without restarting Obsidian.

## What happens the first time Texere 0.4 starts

It happens once, and Texere marks it as done in its `data.json` (`migrated3`, a name kept from the development versions).

1. **If the old plugins are still on**, Texere asks before doing anything else: *Turn them off and continue* or *Not now*. The old plugins are turned off but stay installed. With *Not now*, nothing moves and the modules wait: they would otherwise run twice. Texere asks again the next time Obsidian starts.
2. **Settings.** Each old `.obsidian/plugins/<old id>/data.json` is copied into Texere's `data.json`, under `modules.sources`, `modules.export` and `modules.insights`. A module that already has settings there is not overwritten.
3. **Modules you had turned off.** If an old plugin was installed but turned off, its module starts turned off too.
4. **Insights data.** The files in `.obsidian/plugins/texere-insights/stats/` and `cache/` are copied into `.obsidian/plugins/texere/stats/` and `cache/`. A file that already exists there is not overwritten.
5. **Hotkeys.** In `.obsidian/hotkeys.json`, each hotkey set on an old command is also set on the new command (table below). A hotkey you already set on the new command is kept. The old entries are left as they were.

**Nothing is deleted.** The old plugin folders and their files stay where they were. Once you have checked that everything works, you can uninstall the three old plugins from **Settings → Community plugins**.

## Command IDs

The command palette keeps 13 Texere commands (the 11 below, plus **Help** and **Edit mode**), with the same IDs as before without the old plugin's prefix (`texere-<module>:<id>` becomes `texere:<id>`), so hotkeys you set on them keep working. The other actions are buttons, the **Texere** entry when you right-click a note, or settings now; Help's links still run them.

| Old command ID | In the command palette | Otherwise, where it is now |
|---|---|---|
| `texere:setup` | — | **Settings → Texere → General → Run the setup again**, the home page |
| `texere:set-up-plugins` | — | removed earlier: the setup does it |
| `texere:open-home` | — | the braid icon in the left sidebar, or any new tab |
| `texere-sources:citation-style-add` | — | **Add a citation style…** in the Texere item at the bottom right; **Settings → Texere → References → Notes & citations** |
| `texere-sources:citation-style-default` | — | **Default for all notes…** in the Texere item at the bottom right; **Settings → Texere → References → Notes & citations → Citation style** |
| `texere-sources:citation-style-note` | `texere:citation-style-note` |  |
| `texere-sources:sources-add-selection` | — | right-click a selection → **Texere** → **Add to References** |
| `texere-sources:sources-bibtex` | `texere:sources-bibtex` |  |
| `texere-sources:sources-catalog` | `texere:sources-catalog` |  |
| `texere-sources:sources-distil` | `texere:sources-distil` |  |
| `texere-sources:sources-find-pdf` | — | right-click a reading note → **Texere** → **Find the free PDF** |
| `texere-sources:sources-import-highlights` | — | right-click a reading note or its PDF → **Texere** → **Import annotations from PDF** |
| `texere-sources:sources-rebuild-bib` | — | **Settings → Texere → References → Notes & citations → Advanced → Bibliography** |
| `texere-sources:sources-search` | `texere:sources-search` |  |
| `texere-sources:sources-tidy` | — | **Settings → Texere → References → Notes & citations → Advanced → Rename to the rule**, and a card on the home page |
| `texere-sources:sources-uncataloged` | — | **PDFs without a reference** in **Add a reference** and in the Texere item at the bottom right |
| `texere-sources:sources-zotero-import` | `texere:sources-zotero-import` |  |
| `texere-export:export-insert-toc` | — | right-click in the note → **Texere** → **Insert the contents here** |
| `texere-export:export-note` | `texere:export-note` | with no note open, it asks which note |
| `texere-export:export-pick` | — | `texere:export-note` with no note open; **Export** on the home page |
| `texere-export:import-files` | — | the **+** button on the home page |
| `texere-export:import-folder` | — | the **+** button on the home page |
| `texere-export:paste-clean` | `texere:paste-clean` |  |
| `texere-export:paste-clean-toggle` | — | **Settings → Texere → Export → Advanced → Clean paste** |
| `texere-insights:claims-toggle` | — | Insights → **Writing** → **While you write**; **Settings → Texere → Insights** |
| `texere-insights:companion` | — | Insights → **Writing** → **While you write**, or right-click a note → **Texere** → **Writing companion** |
| `texere-insights:concept-panels` | — | Insights → **Writing** → **While you write**; **Settings → Texere → Insights** |
| `texere-insights:debate-map` | — | Insights → **Reading** → **Debate map…**, or the concept panel |
| `texere-insights:open` | `texere:open` |  |
| `texere-insights:review` | `texere:review` |  |
| `texere-insights:scan` | — | **Scan now**, at the top of the Insights panel |
| `texere-insights:voice-baseline` | — | Insights → **Writing** → **How you write** (starting point) |
| `texere-insights:voice-check` | `texere:voice-check` |  |
| `texere-insights:voice-inline` | — | Insights → **Writing** → **While you write**; **Settings → Texere → Insights** |
| `texere-insights:voice-stats` | — | right-click a note → **Texere** → **Writing stats in this note**, or the Texere item at the bottom right |
| `texere-insights:word-target` | — | right-click a note → **Texere** → **Set a word target…** |

Views (`texere-insights`, `texere-map`, `texere-companion`), code blocks (`cuprins`, `contents`) and `obsidian://` links keep their names, so notes and saved layouts that use them keep working. A view whose module is turned off shows a short message instead of an error.

## Where things are now

| | Before | Now |
|---|---|---|
| Settings | four tabs | one tab, **Texere**, with the sections General · References · Export · Insights · About; rarely used settings under **Advanced** |
| Module settings | `.obsidian/plugins/<old id>/data.json` | `.obsidian/plugins/texere/data.json` → `modules.<module>` |
| Insights stats and cache | `.obsidian/plugins/texere-insights/` | `.obsidian/plugins/texere/` |
| References logs (`pdf-log.txt`, `sources-test.log`) | `.obsidian/plugins/texere-sources/` | `.obsidian/plugins/texere/` |
| Citation locales, the list of citation styles, discipline maps, export libraries | files read from the plugin folders | inside `main.js` (the `.csl` styles you add stay in your vault, as before) |

## Templater and the vault scripts

Help, guide folding and the new-laptop setup used to be Templater scripts in the vault (`Support/Admin/Scripts/Help.md`, `Support/Admin/Scripts/Guide folding.md`, `Support/Templates/New laptop setup.md`). They are now part of Texere, so Texere no longer needs Templater. If you only used Templater for Texere, you can remove those startup templates from Templater's settings, or turn Templater off; the script notes can stay or go, Texere doesn't read them.

## The guide and templates

The Texere guide now lives inside Help (not in your vault); the getting-started guides and the templates come with the plugin. Texere never overwrites a note you already have: to get the new versions, use **Settings → Texere → General → Advanced → Templates and writing guides → Replace with Texere's version…** (it keeps a copy of each old note). New article is now **New essay**.
