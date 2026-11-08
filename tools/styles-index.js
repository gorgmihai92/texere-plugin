#!/usr/bin/env node
// Reface assets/styles-index.json (lista stilurilor CSL în care caută „Add a style”).
//   node tools/styles-index.js <folder cu stilurile CSL>   (o copie a github.com/citation-style-language/styles: *.csl și dependent/*.csl)
//   node tools/styles-index.js <styles-index.json vechi>     (convertește forma veche, v1, în cea scurtă, v2)
const fs = require("fs"), path = require("path");
const { encode } = require("../src/sources/styles-index");
const src = process.argv[2], out = path.join(__dirname, "..", "assets", "styles-index.json");
if (!src) { console.error("usage: node tools/styles-index.js <styles folder | old styles-index.json>"); process.exit(1); }
let rows, date = new Date().toISOString().slice(0, 10);
if (fs.statSync(src).isFile()) {
  const old = JSON.parse(fs.readFileSync(src, "utf8")); date = old.date || date;
  rows = old.v === 2 ? require("../src/sources/styles-index").decode(old)
    : old.styles.map(([name, title, f, parent]) => ({ name, title: title || "", format: old.formats[f], dep: parent !== undefined }));
} else {
  const files = [...fs.readdirSync(src).map(f => path.join(src, f)), ...(fs.existsSync(path.join(src, "dependent")) ? fs.readdirSync(path.join(src, "dependent")).map(f => path.join(src, "dependent", f)) : [])]
    .filter(f => f.endsWith(".csl"));
  const unxml = s => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
  rows = files.map(f => {
    const x = fs.readFileSync(f, "utf8"), info = (/<info>([\s\S]*?)<\/info>/.exec(x) || [, ""])[1];
    return { name: path.basename(f, ".csl"), title: unxml(((/<title>([^<]*)<\/title>/.exec(info)) || [, ""])[1].trim()),
      format: ((/citation-format="([^"]+)"/.exec(info)) || [, "author-date"])[1], dep: /rel="independent-parent"/.test(info) };
  });
}
const json = JSON.stringify(encode(rows, date));
fs.writeFileSync(out, json + "\n");
console.log(`${rows.length} styles → ${path.relative(process.cwd(), out)} (${json.length} bytes)`);
