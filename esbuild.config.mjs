// Texere: un singur main.js (Obsidian instalează doar main.js, manifest.json și styles.css)
//   npm run dev    → main.js lizibil (neminimizat), pentru teste și depanare
//   npm run build  → main.js minimizat, pentru publicare
import esbuild from "esbuild";
import { builtinModules } from "node:module";
import { fileURLToPath } from "node:url";

// Paged.js intră ca text (se pune în pagina din care se tipărește PDF-ul), nu ca modul
const pagedText = {
  name: "paged-text",
  setup(b) {
    b.onResolve({ filter: /^pagedjs\/dist\/paged\.polyfill\.min\.js$/ }, () => ({ path: fileURLToPath(new URL("node_modules/pagedjs/dist/paged.polyfill.min.js", import.meta.url)), namespace: "paged-text" }));
    b.onLoad({ filter: /.*/, namespace: "paged-text" }, async a => ({ contents: await (await import("node:fs/promises")).readFile(a.path, "utf8"), loader: "text" }));
  },
};

const prod = process.argv[2] === "production";

await esbuild.build({
  entryPoints: ["src/main.js"],
  outfile: "main.js",
  bundle: true,
  format: "cjs",
  platform: "node",
  target: "es2020",
  external: ["obsidian", "electron", "@codemirror/*", "@lezer/*", ...builtinModules, ...builtinModules.map(m => `node:${m}`)],
  loader: { ".xml": "text", ".txt": "text", ".md": "text", ".json": "json" },
  plugins: [pagedText],
  minify: prod,
  legalComments: "eof",
  logLevel: "info",
});
