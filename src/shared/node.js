// modulele Node și Electron (fs, os, path, child_process, electron…): cerute abia când e nevoie de ele și doar pe desktop
// (Texere e doar pentru desktop: pe mobil, funcțiile care au nevoie de ele nu apar sau spun că nu se poate)
const { Platform } = require("obsidian");
const node = name => { try { if (Platform && Platform.isDesktopApp === false) return null; return require(name); } catch (e) { return null; } };
module.exports = { node };
