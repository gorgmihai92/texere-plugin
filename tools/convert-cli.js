#!/usr/bin/env node
/* Texere · import din linia de comandă: aceleași note ca „Importă ca notă”, pentru multe documente deodată.
 *   node convert-cli.js <fișiere sau foldere>… --out <folder> [--keep]
 * Word (.docx; .doc/.odt/.rtf prin LibreOffice sau textutil), PDF (cu pdfjs-dist: PDFJS=/cale/pdf.mjs, dacă nu-l găsește singur).
 * Imaginile din Word merg în <out>/attachments. Folderele se parcurg cu subfolderele lor, care se păstrează în <out>.
 */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os"), { execFileSync } = require("child_process");
const C = require("./convert.js");
const EXT = ["docx", "doc", "odt", "rtf", "pdf"];
const args = process.argv.slice(2), outI = args.indexOf("--out"), out = outI >= 0 ? args[outI + 1] : "imported", keep = args.includes("--keep");
const inputs = args.filter((a, i) => !a.startsWith("--") && i !== outI + 1);
if (!inputs.length) { console.log("usage: node convert-cli.js <files or folders>… --out <folder> [--keep]"); process.exit(1); }
const safe = s => String(s).replace(/[\\/:*?"<>|#^[\]]/g, " ").replace(/\s+/g, " ").trim() || "Document";
const today = new Date().toISOString().slice(0, 10);
const jobs = [];
for (const inp of inputs) {
  const st = fs.statSync(inp);
  if (st.isDirectory()) { const walk = (d, rel) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p, path.join(rel, e.name)); else if (EXT.includes(path.extname(e.name).slice(1).toLowerCase())) jobs.push({ file: p, rel }); } }; walk(inp, ""); }
  else jobs.push({ file: inp, rel: "" });
}
let pdfjs = null;
async function getPdfjs() {
  if (pdfjs) return pdfjs;
  for (const p of [process.env.PDFJS, "pdfjs-dist/legacy/build/pdf.mjs", "/opt/npm-tools/node_modules/pdfjs-dist/legacy/build/pdf.mjs"].filter(Boolean)) { try { pdfjs = await import(p.startsWith("/") ? "file://" + p : p); return pdfjs; } catch (e) {} }
  throw new Error("pdfjs-dist not found (set PDFJS=/path/to/pdf.mjs)");
}
function toDocx(file) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "texere-cli-")), outF = path.join(dir, path.basename(file).replace(/\.\w+$/, ".docx"));
  try { execFileSync("soffice", ["--headless", "--convert-to", "docx", "--outdir", dir, file], { stdio: "ignore", timeout: 180000 }); } catch (e) {}
  if (!fs.existsSync(outF) && process.platform === "darwin") try { execFileSync("/usr/bin/textutil", ["-convert", "docx", "-output", outF, file], { stdio: "ignore" }); } catch (e) {}
  if (!fs.existsSync(outF)) throw new Error("cannot convert to .docx (no LibreOffice/textutil)");
  return fs.readFileSync(outF);
}
const free = (dir, base, ext) => { let p = path.join(dir, base + ext), k = 2; while (fs.existsSync(p)) p = path.join(dir, `${base} (${k++})${ext}`); return p; };
(async () => {
  let ok = 0; const bad = [];
  for (const j of jobs) {
    const name = path.basename(j.file), base = name.replace(/\.[^.]+$/, ""), ext = path.extname(name).slice(1).toLowerCase(), dir = path.join(out, j.rel);
    try {
      fs.mkdirSync(dir, { recursive: true }); let md;
      if (ext === "pdf") md = (await C.pdfToMarkdown(await getPdfjs(), fs.readFileSync(j.file))).md;
      else {
        const r = C.docxToMarkdown(ext === "docx" ? fs.readFileSync(j.file) : toDocx(j.file), { imagePrefix: safe(base) }); md = r.md;
        if (r.images.length) { const ad = path.join(out, "attachments"); fs.mkdirSync(ad, { recursive: true }); for (const im of r.images) { const p = free(ad, im.name.replace(/\.\w+$/, ""), path.extname(im.name)); fs.writeFileSync(p, im.data); md = md.split(`![[${im.name}]]`).join(`![[${path.basename(p)}]]`); } }
      }
      let original = null; if (keep) { const p = free(dir, safe(base), "." + ext); fs.copyFileSync(j.file, p); original = path.basename(p); }
      const p = free(dir, safe(base), ".md"); fs.writeFileSync(p, C.noteFor(md, { title: base, source: name, date: today, original }));
      ok++; console.log("✓", path.relative(out, p));
    } catch (e) { bad.push(name); console.log("✗", name, "—", e.message); }
  }
  console.log(`\n${ok} imported${bad.length ? `, ${bad.length} failed` : ""} → ${out}`);
  process.exit(bad.length ? 1 : 0);
})();
