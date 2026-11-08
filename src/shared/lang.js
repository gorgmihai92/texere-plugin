// limba Texere: cea aleasă în Settings → Texere; dacă n-a fost aleasă, limba lui Obsidian (o singură definiție pentru toate modulele)
const LANG = "texere-lang";
const isEn = app => {
  const l = app?.loadLocalStorage?.(LANG); if (l === "en" || l === "ro") return l === "en";
  let o = ""; try { o = window.localStorage.getItem("language") || ""; } catch (e) {}
  return !/^ro/i.test(o);
};
module.exports = { LANG, isEn };
