// The hash of a note's text, for the "was" list of a vault update (src/core/vaultupdates.js):
//   node tools/notehash.js "assets/notes/New essay.md"
// Put the hash of each version you shipped before; a vault that still has one of them is offered "Update",
// a vault where the note was changed is offered "Replace" (keeping a copy of theirs).
const fs = require("fs");
const norm = t => String(t ?? "").replace(/\r\n?/g, "\n").replace(/[ \t]+$/gm, "").replace(/\n+$/, "").trim();
function hash(t) { let h = 0x811c9dc5; const s = norm(t); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, "0"); }
for (const f of process.argv.slice(2)) console.log(hash(fs.readFileSync(f, "utf8")), f);
