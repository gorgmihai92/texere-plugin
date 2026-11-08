// Lista stilurilor CSL din assets/styles-index.json, într-o formă scurtă (cam jumătate din mărime):
//   { v: 2, date, formats: [...], styles: [[titlu, cod, nume?], ...] }
//   cod = indicele formatului în `formats` (+8 dacă stilul e varianta unei reviste, adică are „independent-parent”);
//   nume lipsește când e chiar titlul transformat cu slug() (așa e la ~87% din stiluri).
// Fără Obsidian: îl folosesc și cite.js (decode), și tools/styles-index.js (encode, la refacerea listei).
const slug = t => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  .replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// rows: [{ name, title, format, dep }]
function encode(rows, date) {
  const formats = [...new Set(rows.map(r => r.format))].sort();
  const styles = rows.map(r => {
    const e = [r.title || "", formats.indexOf(r.format) + (r.dep ? 8 : 0)];
    if (!r.title || slug(r.title) !== r.name) e.push(r.name);
    return e;
  });
  return { v: 2, date, formats, styles };
}

function decode(raw) {
  return raw.styles.map(([title, c, id]) => {
    const name = id || slug(title);
    return { name, title: title || name, format: raw.formats[c & 7], dep: c >= 8 };
  });
}

module.exports = { slug, encode, decode };
