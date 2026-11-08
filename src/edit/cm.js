// Modul Editare, în editor (CodeMirror 6): variantele, estomparea, semnele „Verifică” și tot ce se vede doar cât e pornit.
// Pornit pe o notă: o bară jos, în mijlocul notei („✎ Editare · … · Gata”), o bară mică la selecție (Variante · Estompează · Pune deoparte),
// fereastra variantelor, sublinierea locurilor cu variante și „‹ 2/3 ›”. Oprit: nota arată doar textul tău.
// Variantele și estompările nu se scriu în notă: stau în datele lui Texere (vezi index.js); nota se schimbă doar prin ce alegi.
// Schimbările făcute de aici poartă userEvent "texere.edit" (Insights nu le numără ca scris).
// După Wordplay de Rob Hardy (MIT), după Write_On al lui Jason Fried; aici, mai simplu: fără variante în variante, fără AI.

const EV = "texere.edit";
const WORDISH = /^[\p{L}\p{N}'’-]+$/u;
const isWordChar = c => !!c && /[\p{L}\p{N}'’-]/u.test(c);
const vis = (el, on) => el.classList.toggle("tx-edit-hide", !on);
let seq = 0; const newId = p => `${p}${Date.now().toString(36)}${(seq = (seq + 1) % 1e6).toString(36)}`;
const { trim: trimText } = require("./trim");
const TRIM_NAME = T => ["", T("Scurtare ușoară", "Slight trim"), T("Mai strâns", "Tighten more"), T("Și mai tăios", "Even sharper"), T("Pe jumătate", "Cut in half")];
const TRIM_WHY = T => ({
  filler: T("Umplutură: rândul se citește la fel și fără. Clic ca să rămână.", "Filler: the line reads the same without it. Click to keep it."),
  hedge: T("Ezitare: păstreaz-o doar dacă chiar o crezi. Clic ca să rămână.", "A hedge: keep it only if you mean it. Click to keep it."),
  stock: T("O formulă care nu face nicio muncă. Clic ca să rămână.", "A phrase that does no work. Click to keep it."),
  aside: T("O incisă sau un conector de adăugare: fraza merge și fără. Clic ca să rămână.", "An aside or an add-on connector: the sentence works without it. Click to keep it."),
});

function makeEdit(E) {
  const { StateField, StateEffect, Prec, EditorState } = require("@codemirror/state");
  const ART = require("./article");
  const { EditorView, Decoration, WidgetType, ViewPlugin, showPanel, showTooltip, keymap } = require("@codemirror/view");
  const { editorInfoField, Menu, Notice, setIcon } = require("obsidian");
  const T = (a, b) => E.T(a, b);
  const pathOf = state => { try { return state.field(editorInfoField, false)?.file?.path || null; } catch (e) { return null; } };

  // ——— efectele ———
  const setOn = StateEffect.define();        // pornit / oprit, pe nota din acest editor
  const setPop = StateEffect.define();       // fereastra variantelor: { id } (un loc cu variante) sau { from, to } (încă fără variante) sau null
  const setMarks = StateEffect.define();     // semnele „Verifică”: [{ id, from, to, kind, why }] sau null
  const dropMark = StateEffect.define();     // „E în regulă”: un semn dispare
  const loadItems = StateEffect.define();    // variantele și estompările notei, din datele lui Texere
  const mapItem = (it, m) => { if (!it) return it; const from = m.mapPos(it.from, 1), to = m.mapPos(it.to, -1); return to > from ? { ...it, from, to } : null; };
  const putSpot = StateEffect.define({ map: (v, m) => ({ id: v.id, spot: mapItem(v.spot, m) }) });   // { id, spot | null } (pozițiile, în textul de după schimbare)
  const putDim = StateEffect.define({ map: (v, m) => ({ id: v.id, dim: mapItem(v.dim, m) }) });       // { id, dim | null }
  const setPick = StateEffect.define();      // un loc cu variante ales cu un clic → { id } sau null; tastele îl schimbă
  const setTrims = StateEffect.define();     // scurtarea propusă din Lab: { level, before, after, spans: [{ id, from, to, kind }] } sau null (doar estompată, nimic șters)
  const keepTrim = StateEffect.define();     // clic pe un cuvânt estompat: rămâne

  // un loc urmează textul cât scrii; scrisul la margine rămâne afară, dacă nu continui același cuvânt;
  // o schimbare care înlocuiește exact locul (o variantă, sau ⌘Z peste ea) îl lasă pe loc, cu varianta pe care o arată acum textul
  const follow = (it, changes, shown) => {
    let from = changes.mapPos(it.from, 1), to = changes.mapPos(it.to, -1), exact = false;
    changes.iterChanges((fA, tA, fB, tB, ins) => {
      if (fA === it.from && tA === it.to && tA > fA) { from = fB; to = tB; exact = true; return; }
      if (fA !== tA || !ins.length) return;
      const s = ins.toString(); if (!WORDISH.test(s)) return;
      if (fA === it.to && isWordChar(shown[shown.length - 1])) to = tB;
      if (fA === it.from && isWordChar(shown[0])) from = fB;
    });
    return to > from ? { from, to, exact } : null;
  };

  // ——— variantele și estompările acestei note ———
  const itemsField = StateField.define({
    create: state => ({ path: pathOf(state), loaded: false, spots: [], dims: [] }),
    update(v, tr) {
      const path = pathOf(tr.state);
      if (path !== v.path) return { path, loaded: false, spots: [], dims: [] };
      let { spots, dims, loaded } = v;
      for (const e of tr.effects) if (e.is(loadItems) && e.value.path === path) { spots = e.value.spots; dims = e.value.dims; loaded = true; }
      if (tr.docChanged && (spots.length || dims.length)) {
        const doc = tr.state.doc;
        spots = spots.flatMap(s => {
          const shown = s.options[s.cur] ?? "", m = follow(s, tr.changes, shown); if (!m) return [];
          const text = doc.sliceString(m.from, m.to); let cur = s.options.indexOf(text), options = s.options;
          if (cur < 0) { cur = s.cur; options = s.options.map((o, i) => (i === s.cur ? text : o)); }   // ai scris în varianta arătată: ea se schimbă
          return [{ ...s, from: m.from, to: m.to, cur, options }];
        });
        dims = dims.flatMap(d => { const m = follow(d, tr.changes, d.text); return m ? [{ ...d, from: m.from, to: m.to, text: doc.sliceString(m.from, m.to) }] : []; });
      }
      let touched = false;
      for (const e of tr.effects) {
        if (e.is(putSpot)) { if (!touched) { spots = spots.slice(); dims = dims.slice(); touched = true; } spots = spots.filter(s => s.id !== e.value.id); if (e.value.spot) spots.push(e.value.spot); }
        if (e.is(putDim)) { if (!touched) { spots = spots.slice(); dims = dims.slice(); touched = true; } dims = dims.filter(d => d.id !== e.value.id); if (e.value.dim) dims.push(e.value.dim); }
      }
      if (touched) { spots.sort((a, b) => a.from - b.from); dims.sort((a, b) => a.from - b.from); }
      return spots === v.spots && dims === v.dims && loaded === v.loaded ? v : { path, loaded, spots, dims };
    },
  });

  // ——— ce se vede doar în modul Editare ———
  const uiField = StateField.define({
    create: state => { const path = pathOf(state); return { path, on: E.isOn(path), pop: null, marks: [], trim: null, pick: null }; },
    update(v, tr) {
      const path = pathOf(tr.state);
      if (path !== v.path) return { path, on: E.isOn(path), pop: null, marks: [], trim: null, pick: null };
      let { on, pop, marks, trim, pick } = v;
      for (const e of tr.effects) {
        if (e.is(setTrims)) trim = e.value && e.value.spans.length ? e.value : null;
        if (e.is(keepTrim) && trim) {
          const k = trim.spans.find(x => x.id === e.value), back = k ? (tr.startState.doc.sliceString(k.from, k.to).match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || []).length : 0;
          const spans = trim.spans.filter(x => x.id !== e.value); trim = spans.length ? { ...trim, spans, after: trim.after + back } : null;
        }
        if (e.is(setOn)) { on = e.value; if (!on) { pop = null; marks = []; trim = null; pick = null; } }
        if (e.is(setPick)) pick = e.value;
        if (e.is(setPop)) pop = e.value;
        if (e.is(setMarks)) marks = e.value || [];
        if (e.is(dropMark)) marks = marks.filter(m => m.id !== e.value);
      }
      if (tr.docChanged && trim) { const spans = trim.spans.flatMap(m => { const f = tr.changes.mapPos(m.from, 1), t = tr.changes.mapPos(m.to, -1); return t > f ? [{ ...m, from: f, to: t }] : []; }); trim = spans.length ? { ...trim, spans } : null; }
      if (tr.docChanged && marks.length) marks = marks.flatMap(m => { const f = tr.changes.mapPos(m.from, 1), t = tr.changes.mapPos(m.to, -1); return t > f ? [{ ...m, from: f, to: t }] : []; });
      if (tr.docChanged && pop && pop.from != null) { const f = tr.changes.mapPos(pop.from, 1), t = tr.changes.mapPos(pop.to, -1); pop = t > f ? { from: f, to: t } : null; }
      if (pop?.id && !tr.state.field(itemsField).spots.some(s => s.id === pop.id)) pop = null;
      // fereastra variantelor se închide când muți cursorul în afara locului (clic în altă parte a notei, săgeți)
      if (pop && tr.selection && tr.isUserEvent("select")) {
        const sp = pop.id ? tr.state.field(itemsField).spots.find(x => x.id === pop.id) : pop, h = tr.state.selection.main.head;
        if (tr.isUserEvent("select.pointer") || !sp || h < sp.from || h > sp.to) pop = null;   // orice clic în notă: înapoi la pagină
      }
      // ales cu un clic; pleacă dacă se deschide fereastra, dacă locul nu mai are variante sau dacă selectezi text
      if (pick && (pop || !tr.state.field(itemsField).spots.some(s => s.id === pick.id && s.options.length > 1) || (tr.selection && !tr.state.selection.main.empty))) pick = null;
      return on === v.on && pop === v.pop && marks === v.marks && trim === v.trim && pick === v.pick ? v : { path, on, pop, marks, trim, pick };
    },
  });

  // ——— acțiunile (din bară, fereastră, semne, banda de sus) ———
  const A = {
    spotAt(state, pos) { return state.field(itemsField).spots.find(s => pos >= s.from && pos <= s.to) || null; },
    // cât cuprinde o variantă, în jurul cursorului: cuvântul, propoziția sau paragraful (fără selecție)
    rangeAt(state, pos, scope) {
      const line = state.doc.lineAt(pos), t = line.text, lead = (t.match(/^(\s*(?:#{1,6}\s+|[-*+]\s+|\d+[.)]\s+|>\s*)?)/) || ["", ""])[0].length;
      let a = pos - line.from, b = a;
      if (scope === "word") { while (a > lead && isWordChar(t[a - 1])) a--; while (b < t.length && isWordChar(t[b])) b++; if (b === a) return null; }
      else if (scope === "sentence") {
        a = Math.max(lead, a); for (let i = a - 1; i >= lead; i--) { if (/[.!?…]/.test(t[i]) && /\s/.test(t[i + 1] || "")) { a = i + 1; break; } if (i === lead) a = lead; }
        while (a < t.length && /\s/.test(t[a])) a++;
        b = t.length; for (let i = Math.max(a, pos - line.from); i < t.length; i++) if (/[.!?…]/.test(t[i]) && (i + 1 >= t.length || /\s/.test(t[i + 1]))) { b = i + 1; while (/["”»)]/.test(t[b] || "")) b++; break; }
      } else { a = lead; b = t.replace(/\s+$/, "").length; }
      return b > a ? { from: line.from + a, to: line.from + b } : null;
    },
    // fereastra variantelor: pentru selecție, pentru locul cu variante în care ești, sau (doar cursor) pentru cuvântul de sub el
    openVersions(view, from, to, scope) {
      const st = view.state, anchor = from, hit = st.field(itemsField).spots.find(x => from < x.to && to > x.from) || A.spotAt(st, from);
      if (hit && !scope) { view.dispatch({ effects: setPop.of({ id: hit.id, anchor }) }); return; }
      if (from === to || scope) { const r = A.rangeAt(st, anchor, scope || "word"); if (!r) return; from = r.from; to = r.to; scope = scope || "word"; } else scope = "sel";
      const same = st.field(itemsField).spots.find(x => x.from === from && x.to === to);
      view.dispatch({ effects: setPop.of(same ? { id: same.id, anchor, scope } : { from, to, anchor, scope }) });
    },
    // scrii în ultimul rând al ferestrei: textul din notă se schimbă pe loc (o variantă nouă, care rămâne după Enter sau Esc)
    draft(view, text) {
      const pop = view.state.field(uiField).pop; if (!pop) return;
      let s = pop.id ? view.state.field(itemsField).spots.find(x => x.id === pop.id) : null;
      if (!text) {   // ai șters tot: varianta în lucru pleacă, revine cea de dinainte
        if (s && pop.draft != null) { const prev = pop.prev ?? 0, options = s.options.filter((_, k) => k !== pop.draft), cur = Math.min(prev, options.length - 1), shown = options[cur];
          view.dispatch({ changes: { from: s.from, to: s.to, insert: shown }, effects: [putSpot.of({ id: s.id, spot: options.length > 1 ? { ...s, options, cur, to: s.from + shown.length } : null }), setPop.of(options.length > 1 ? { ...pop, draft: null } : { from: s.from, to: s.from + shown.length, anchor: pop.anchor, scope: pop.scope })], userEvent: EV, scrollIntoView: false }); }
        return;
      }
      if (!s) { const orig = view.state.doc.sliceString(pop.from, pop.to); if (!orig) return; s = { id: newId("v"), from: pop.from, to: pop.to, options: [orig], cur: 0 }; }
      let options = s.options.slice(), d = pop.draft, prev = pop.prev;
      if (d == null) { prev = s.cur; options.push(text); d = options.length - 1; } else options[d] = text;
      view.dispatch({ changes: { from: s.from, to: s.to, insert: text }, effects: [putSpot.of({ id: s.id, spot: { ...s, options, cur: d, to: s.from + text.length } }), setPop.of({ id: s.id, anchor: pop.anchor, scope: pop.scope, draft: d, prev })], userEvent: EV, scrollIntoView: false });
    },
    // Enter: varianta scrisă rămâne în listă; câmpul se golește pentru următoarea
    settleDraft(view) { const pop = view.state.field(uiField).pop; if (pop && pop.draft != null) view.dispatch({ effects: setPop.of({ ...pop, draft: null, prev: null }) }); },
    // arată varianta i în notă
    show(view, id, i) {
      const s = view.state.field(itemsField).spots.find(x => x.id === id); if (!s || i < 0 || i >= s.options.length || i === s.cur) return;
      const text = s.options[i];
      view.dispatch({ changes: { from: s.from, to: s.to, insert: text }, effects: putSpot.of({ id, spot: { ...s, to: s.from + text.length, cur: i } }), userEvent: EV, scrollIntoView: false });
    },
    cycle(view, id, d) { const s = view.state.field(itemsField).spots.find(x => x.id === id); if (s) A.show(view, id, (s.cur + d + s.options.length) % s.options.length); },
    // o variantă nouă (scrisă de tine): intră în listă și se arată în notă
    add(view, text) {
      text = String(text || "").replace(/\s+$/, ""); if (!text.trim()) return;
      const ui = view.state.field(uiField), pop = ui.pop; if (!pop) return;
      let s = pop.id ? view.state.field(itemsField).spots.find(x => x.id === pop.id) : null;
      if (!s) {
        const orig = view.state.doc.sliceString(pop.from, pop.to); if (!orig) return;
        s = { id: newId("v"), from: pop.from, to: pop.to, options: [orig], cur: 0 };
      }
      if (s.options.includes(text)) { A.show(view, s.id, s.options.indexOf(text)); return; }
      const options = [...s.options, text], i = options.length - 1;
      view.dispatch({ changes: { from: s.from, to: s.to, insert: text }, effects: [putSpot.of({ id: s.id, spot: { ...s, options, to: s.from + text.length, cur: i } }), setPop.of({ id: s.id })], userEvent: EV, scrollIntoView: false });
    },
    // scoate o variantă (niciodată originalul); dacă era arătată, revine originalul
    remove(view, id, i) {
      if (i <= 0) return; let s = view.state.field(itemsField).spots.find(x => x.id === id); if (!s) return;
      if (s.cur === i) { A.show(view, id, 0); s = view.state.field(itemsField).spots.find(x => x.id === id); if (!s) return; }
      const options = s.options.filter((_, k) => k !== i), cur = s.cur > i ? s.cur - 1 : s.cur;
      view.dispatch({ effects: putSpot.of({ id, spot: options.length > 1 ? { ...s, options, cur } : null }) });
    },
    // Enter în fereastră: varianta scrisă intră în listă; în notă rămâne ce era ales (nu se schimbă cât scrii)
    addQuiet(view, text) {
      text = String(text || "").replace(/\s+/g, " ").trim(); if (!text) return;
      const pop = view.state.field(uiField).pop; if (!pop) return;
      let s = pop.id ? view.state.field(itemsField).spots.find(x => x.id === pop.id) : null;
      if (!s) { const orig = view.state.doc.sliceString(pop.from, pop.to); if (!orig) return; s = { id: newId("v"), from: pop.from, to: pop.to, options: [orig], cur: 0 }; }
      if (s.options.includes(text)) return;
      view.dispatch({ effects: [putSpot.of({ id: s.id, spot: { ...s, options: [...s.options, text] } }), setPop.of({ id: s.id, anchor: pop.anchor ?? s.from, scope: pop.scope })] });
    },
    // editezi o variantă din listă; dacă e cea din notă, se schimbă și în notă
    editOption(view, id, i, text) {
      text = String(text || "").replace(/\s+/g, " ").trim(); const s = view.state.field(itemsField).spots.find(x => x.id === id);
      if (!s || !text || s.options[i] === text || s.options.some((o, k) => k !== i && o === text)) return;
      const options = s.options.map((o, k) => (k === i ? text : o));
      if (i === s.cur) view.dispatch({ changes: { from: s.from, to: s.to, insert: text }, effects: putSpot.of({ id, spot: { ...s, options, to: s.from + text.length } }), userEvent: EV, scrollIntoView: false });
      else view.dispatch({ effects: putSpot.of({ id, spot: { ...s, options } }) });
    },
    // ⌃⌘⌫: șterge varianta care se vede; se arată cea dinaintea ei (originalul nu se șterge niciodată)
    drop(view, id) {
      const s = view.state.field(itemsField).spots.find(x => x.id === id); if (!s) return false;
      if (s.cur === 0) { new Notice(T("Originalul rămâne. Arată o variantă ca s-o ștergi.", "The original stays. Show a version to delete it."), 2500); return false; }
      const i = s.cur, options = s.options.filter((_, k) => k !== i), text = options[i - 1];
      view.dispatch({ changes: { from: s.from, to: s.to, insert: text }, effects: putSpot.of({ id, spot: options.length > 1 ? { ...s, options, cur: i - 1, to: s.from + text.length } : null }), userEvent: EV, scrollIntoView: false });
      return true;
    },
    // „Păstrează”: rămâne ce se vede; celelalte variante pleacă
    keep(view, id) { view.dispatch({ effects: [putSpot.of({ id, spot: null }), setPop.of(null)] }); view.focus(); },
    // estompează (sau adu înapoi, dacă e deja estompat)
    dim(view, from, to) {
      const ds = view.state.field(itemsField).dims, hit = ds.filter(d => from < d.to && to > d.from);
      if (hit.length) view.dispatch({ effects: hit.map(d => putDim.of({ id: d.id, dim: null })) });
      else if (to > from) view.dispatch({ effects: putDim.of({ id: newId("d"), dim: { from, to, text: view.state.doc.sliceString(from, to) } }), selection: { anchor: to } });
    },
    undimAt(view, pos) { const d = view.state.field(itemsField).dims.find(x => pos >= x.from && pos <= x.to); if (d) view.dispatch({ effects: putDim.of({ id: d.id, dim: null }) }); return !!d; },
    async setAside(view, from, to) {
      const text = view.state.doc.sliceString(from, to); if (!text.trim()) return;
      const ok = await E.stash(view, text); if (!ok) return;
      view.dispatch({ changes: { from, to, insert: "" }, selection: { anchor: from }, userEvent: EV });
    },
    putBack(view, text) { const h = view.state.selection.main.head; view.dispatch({ changes: { from: h, insert: text }, selection: { anchor: h + text.length }, userEvent: EV }); view.focus(); },
    markMenu(view, m, ev) {
      const menu = new Menu();
      menu.addItem(i => i.setTitle(T("Variante", "Versions")).setIcon("layers").onClick(() => { view.dispatch({ selection: { anchor: m.from, head: m.to } }); A.openVersions(view, m.from, m.to); }));
      menu.addItem(i => i.setTitle(T("Estompează", "Dim")).setIcon("eye-off").onClick(() => { A.dim(view, m.from, m.to); view.dispatch({ effects: dropMark.of(m.id) }); }));
      menu.addItem(i => i.setTitle(T("E în regulă", "Fine as is")).setIcon("check").onClick(() => view.dispatch({ effects: dropMark.of(m.id) })));
      menu.showAtMouseEvent(ev);
    },
  };

  // ——— semnele: linia trasă ca de mână și punctele (● varianta arătată, ○ celelalte), ca în Write_On ———
  // cuvânt: punctele sub el, la mijloc; propoziție / titlu: linia mai jos, punctele la capăt; paragraf: o linie pe margine, punctele pe verticală
  const dotsOf = s => s.options.slice(0, 9).map((_, i) => (i === s.cur ? "●" : "○")).join("");
  // scurtăturile (nefolosite la scris): pe Mac ⌃⌘ + săgeți, altfel Ctrl+Alt+Shift + săgeți
  const MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || "");
  const KEYS = MAC ? { lr: "⌃⌘← →", ud: "⌃⌘↑ ↓", del: "⌃⌘⌫" } : { lr: "Ctrl+Alt+Shift+← →", ud: "Ctrl+Alt+Shift+↑ ↓", del: "Ctrl+Alt+Shift+⌫" };
  const isCycleKey = e => (MAC ? e.ctrlKey && e.metaKey && !e.altKey : e.ctrlKey && e.altKey && e.shiftKey && !e.metaKey);
  const DOT = 4, GAP = 2;   // punctele: cercuri de 4px, cu 2px între ele; linia se oprește cu atât înainte (linie + puncte = lățimea textului)
  const dotsW = s => Math.min(9, s.options.length) * (DOT + GAP) + 3;
  const kindOf = (state, s) => {
    const text = state.doc.sliceString(s.from, s.to), line = state.doc.lineAt(s.from);
    if (/^#{1,6}\s/.test(line.text)) return "heading";
    if (!/\s/.test(s.options?.[0] ?? text)) return "word";
    const last = state.doc.lineAt(s.to);
    if (s.from <= line.from + (line.text.match(/^\s*/)[0].length) && s.to >= last.to && /[.!?…]["”»)]?\s+\S/.test(text + " x")) return "para";
    return "sentence";
  };
  class Dots extends WidgetType {
    constructor(id, dots, cls) { super(); this.id = id; this.dots = dots; this.cls = cls; }
    eq(o) { return o.id === this.id && o.dots === this.dots && o.cls === this.cls; }
    toDOM(view) {
      const w = document.createElement("span"); w.className = "tx-edit-dots " + this.cls; w.setAttribute("contenteditable", "false");
      const d = document.createElement("span"); d.className = "tx-edit-dots-in"; d.setAttribute("aria-label", T("Variantele (clic)", "Versions (click)")); w.appendChild(d);
      for (const c of this.dots) { const x = document.createElement("span"); x.className = "tx-edit-dot" + (c === "●" ? " is-on" : ""); d.appendChild(x); }
      d.addEventListener("mousedown", e => { e.preventDefault(); e.stopPropagation(); const s = view.state.field(itemsField).spots.find(x => x.id === this.id); if (s) view.dispatch({ effects: setPop.of({ id: s.id, anchor: s.from }) }); });
      return w;
    }
    ignoreEvent() { return true; }
  }
  const decorations = EditorView.decorations.compute([uiField, itemsField, "selection"], state => {
    const ui = state.field(uiField); if (!ui.on) return Decoration.none;
    const it = state.field(itemsField), head = state.selection.main.head, rs = [];
    for (const s of it.spots) {
      if (s.to <= s.from) continue;
      const k = kindOf(state, s), alt = s.cur > 0 ? " is-alt" : "", title = T(`${s.options.length} variante · clic pe puncte le arată · ${KEYS.lr} le schimbă · ${KEYS.del} o șterge · ${KEYS.ud} alt loc`, `${s.options.length} versions · click the dots to see them · ${KEYS.lr} to switch · ${KEYS.del} to delete · ${KEYS.ud} next place`);
      if (k === "para") {
        const active = (head >= s.from && head <= s.to ? " is-active" : "") + (ui.pick?.id === s.id ? " is-picked" : "");
        for (let ln = state.doc.lineAt(s.from).number, end = state.doc.lineAt(s.to).number; ln <= end; ln++) rs.push(Decoration.line({ class: "tx-edit-para" + alt + active, attributes: { title } }).range(state.doc.line(ln).from));
        rs.push(Decoration.widget({ widget: new Dots(s.id, dotsOf(s), "is-para"), side: -1 }).range(s.from));
        continue;
      }
      const on_ = (head >= s.from && head <= s.to ? " is-active" : "") + (ui.pick?.id === s.id ? " is-picked" : "");   // locul în care ești: ușor luminat, ca în Write_On; ales cu un clic: mai tare
      rs.push(Decoration.mark({ class: "tx-edit-spot is-" + k + alt + on_, attributes: { title, style: `--tx-dw:${dotsW(s)}px` } }).range(s.from, s.to));
      rs.push(Decoration.widget({ widget: new Dots(s.id, dotsOf(s), "is-end is-" + k), side: 1 }).range(s.to));
    }
    for (const d of it.dims) if (d.to > d.from) rs.push(Decoration.mark({ class: "tx-edit-dim", attributes: { title: T("Estompat: clic ca să-l aduci înapoi", "Dimmed: click to bring it back") } }).range(d.from, d.to));
    if (ui.trim) for (const x of ui.trim.spans) if (x.to > x.from) rs.push(Decoration.mark({ class: "tx-edit-trim", attributes: { "data-tx-trim": x.id, title: TRIM_WHY(T)[x.kind] || "" } }).range(x.from, x.to));
    for (const m of ui.marks) if (m.to > m.from) rs.push(Decoration.mark({ class: "tx-edit-mark", attributes: { "data-tx-mark": m.id, title: m.why || "" } }).range(m.from, m.to));
    return Decoration.set(rs, true);
  });
  const theme = EditorView.editorAttributes.compute([uiField], state => (state.field(uiField).on ? { class: "tx-editing" } : {}));

  // ——— banda de sus: „✎ Editare” ———
  const panelFor = view => {
    const dom = document.createElement("div"); dom.className = "tx-edit-panel";
    const left = document.createElement("div"); left.className = "tx-edit-pl"; dom.appendChild(left);
    const ic = document.createElement("span"); ic.className = "tx-edit-pi"; try { setIcon(ic, "pencil"); } catch (e) { ic.textContent = "✎"; } left.appendChild(ic);
    const lab = document.createElement("span"); lab.className = "tx-edit-plab"; lab.textContent = T("Editare", "Edit mode"); left.appendChild(lab);
    const t = document.createElement("span"); t.className = "tx-edit-pt"; left.appendChild(t);
    const right = document.createElement("div"); right.className = "tx-edit-pr"; dom.appendChild(right);
    const mk = (label, cls, fn) => { const b = document.createElement("button"); b.className = "tx-edit-pb" + (cls ? " " + cls : ""); b.textContent = label; b.addEventListener("mousedown", e => e.preventDefault()); b.addEventListener("click", e => fn(e, b)); right.appendChild(b); return b; };
    mk("Texere", "tx-edit-pb-tx", (ev, btn) => openLab(view, btn));
    const clear = mk(T("Curăță", "Clear"), "", () => view.dispatch({ effects: [setMarks.of(null), setTrims.of(null)] }));
    const ovB = mk(T("Tăieturi", "Cuts"), "tx-edit-pb-ov", () => { E.toggleOverflow().then(() => render()).catch(() => {}); });
    mk(T("Gata", "Done"), "mod-cta", () => E.toggle(view.state.field(uiField).path, false));
    const render = () => {
      const ui = view.state.field(uiField), n = view.state.field(itemsField).spots.length;
      const tr0 = ui.trim;
      t.textContent = ui.pick ? T(`← → variante · ⌫ șterge · ${MAC ? "⌘Z" : "Ctrl+Z"} înapoi · Esc gata`, `← → versions · ⌫ delete · ${MAC ? "⌘Z" : "Ctrl+Z"} undo · Esc done`) : tr0 ? `${TRIM_NAME(T)[tr0.level]} · ${tr0.before} → ${tr0.after} ${T("cuvinte", "words")} · −${Math.round(100 * (tr0.before - tr0.after) / Math.max(1, tr0.before))}% · ${T("clic pe un cuvânt estompat ca să rămână", "click a faded word to keep it")}` : (ui.marks.length ? (ui.marks.length === 1 ? T("un loc de verificat: clic pe el", "1 spot to check: click it") : T(`${ui.marks.length} locuri de verificat: clic pe unul`, `${ui.marks.length} spots to check: click one`))
        : n ? T(`${n} ${n === 1 ? "loc" : "locuri"} cu variante`, `${n} ${n === 1 ? "spot" : "spots"} with versions`) : T("selectează text → Variante", "select text → Versions"));
      vis(clear, !!(ui.marks.length || ui.trim));
      const ov = E.overflowOpen(); ovB.classList.toggle("is-on", ov); ovB.setAttribute("aria-pressed", ov ? "true" : "false");
      ovB.setAttribute("aria-label", ov ? T("Închide Tăieturi", "Close Cuts") : T("Deschide Tăieturi (doar pentru nota asta)", "Open Cuts (just for this note)"));
    };
    render();
    return { dom, top: false, update: () => render(), destroy: () => closeLab() };   // jos, în mijloc: nu o acoperă barele de unelte de sus (Editing Toolbar)
  };
  // ——— meniul „Texere” din bară (Lab-ul din Write_On): verificările (fără AI, din Insights) și scurtările care doar estompează ———
  const PASSES = () => [
    { kinds: ["long"], label: T("Marchează propozițiile lungi (peste 25 de cuvinte)", "Mark sentences that run long (25+ words)") },
    { kinds: ["hedge", "stock"], label: T("Marchează ezitările și umplutura", "Mark hedges and filler") },
    { kinds: ["slip"], label: T("Marchează cuvintele care nu se potrivesc tonului", "Mark words that don't fit the tone") },
    { kinds: ["commit"], label: T("Marchează afirmațiile prea tari", "Mark claims stated too strongly") },
    { kinds: ["opinion"], label: T("Marchează opiniile personale", "Mark personal opinions") },
  ];
  const AI_LATER = () => [T("Corectează punctuația și greșelile de tipar", "Fix punctuation and typos"), T("Marchează propozițiile cele mai slabe", "Mark the weakest sentences"), T("Marchează propozițiile încâlcite", "Mark convoluted sentences")];
  let labEl = null;
  const closeLab = () => { if (labEl) { labEl.remove(); labEl = null; document.removeEventListener("mousedown", outside, true); document.removeEventListener("keydown", escLab, true); } };
  const outside = e => { if (labEl && !labEl.contains(e.target) && !e.target.closest?.(".tx-edit-panel")) closeLab(); };
  const escLab = e => { if (e.key === "Escape" && labEl) { e.preventDefault(); e.stopPropagation(); closeLab(); } };
  function openLab(view, btn) {
    if (labEl) { closeLab(); return; }
    const ui = view.state.field(uiField), doc = view.state.doc.toString();
    const box = document.createElement("div"); box.className = "tx-edit-lab"; labEl = box;
    const h = document.createElement("div"); h.className = "tx-edit-lab-h"; box.appendChild(h);
    const ht = document.createElement("span"); ht.textContent = "Texere"; h.appendChild(ht);
    const hs = document.createElement("span"); hs.className = "tx-edit-lab-hint"; hs.textContent = T("Texere doar arată; tu decizi", "Texere points, you decide"); h.appendChild(hs);
    const row = (label, fn, cls) => { const r = document.createElement("button"); r.className = "tx-edit-lab-row" + (cls ? " " + cls : ""); r.textContent = label; if (fn) r.addEventListener("click", fn); else r.disabled = true; box.appendChild(r); return r; };
    if (E.canCheck()) for (const p of PASSES()) row(p.label, async () => {
      closeLab(); const marks = await E.check(view.state.doc.toString(), view.state.field(uiField).path, p.kinds); if (!marks) return;
      view.dispatch({ effects: [setTrims.of(null), setMarks.of(marks.map(m => ({ ...m, id: newId("m") })))] });
    });
    const ai = document.createElement("div"); ai.className = "tx-edit-lab-sub"; ai.textContent = T("Cu AI · mai târziu", "With AI · later"); box.appendChild(ai);
    for (const l of AI_LATER()) row(l, null, "is-later");
    const trims = document.createElement("div"); trims.className = "tx-edit-lab-trims"; box.appendChild(trims);
    const cur = ui.trim ? ui.trim.level : 0;
    [[0, T("Originalul", "Original"), ""], [1, TRIM_NAME(T)[1], "~10%"], [2, TRIM_NAME(T)[2], "~20%"], [3, TRIM_NAME(T)[3], "~30%"], [4, TRIM_NAME(T)[4], "~50%"]].forEach(([lv, name, pct]) => {
      const b = document.createElement("button"); b.className = "tx-edit-trim-b" + (lv === cur ? " is-on" : ""); trims.appendChild(b);
      const n = document.createElement("span"); n.textContent = name; b.appendChild(n);
      const sp = document.createElement("small"); sp.textContent = lv === 4 ? T("cu AI, mai târziu", "with AI, later") : pct; b.appendChild(sp);
      if (lv === 4) { b.disabled = true; return; }
      b.addEventListener("click", () => {
        closeLab();
        if (!lv) { view.dispatch({ effects: setTrims.of(null) }); return; }
        const r = trimText(view.state.doc.toString(), lv);
        if (!r.spans.length) { new Notice(T("N-am găsit nimic de scurtat după reguli. Scurtările mai mari vor veni cu AI.", "Nothing to trim by the rules here. Bigger trims will come with AI."), 4000); return; }
        view.dispatch({ effects: [setMarks.of(null), setTrims.of({ level: lv, before: r.before, after: r.after, spans: r.spans.map(x => ({ ...x, id: newId("t") })) })] });
      });
    });
    document.body.appendChild(box);
    const rb = btn.getBoundingClientRect(), bw = Math.min(460, window.innerWidth - 24);
    box.style.setProperty("--tx-lab-w", bw + "px");
    box.style.setProperty("--tx-lab-left", Math.max(12, Math.min(window.innerWidth - bw - 12, rb.left + rb.width / 2 - bw / 2)) + "px");
    box.style.setProperty("--tx-lab-bottom", (window.innerHeight - rb.top + 10) + "px");
    setTimeout(() => { document.addEventListener("mousedown", outside, true); document.addEventListener("keydown", escLab, true); }, 0);
  }

  const panel = showPanel.compute([uiField], state => (state.field(uiField).on ? panelFor : null));

  // ——— bara de la selecție și fereastra variantelor (tooltips) ———
  const createBar = view => {
    const dom = document.createElement("div"); dom.className = "tx-edit-bar";
    dom.addEventListener("mousedown", e => { e.preventDefault(); e.stopPropagation(); });
    const mk = (icon, label, fn) => { const b = document.createElement("button"); b.className = "tx-edit-bb"; const i = document.createElement("span"); i.className = "tx-edit-bi"; try { setIcon(i, icon); } catch (e) {} b.appendChild(i); const l = document.createElement("span"); l.textContent = label; b.appendChild(l); b.addEventListener("click", e => { e.preventDefault(); fn(); }); dom.appendChild(b); return { b, l }; };
    const sel = () => view.state.selection.main;
    mk("layers", T("Variante", "Versions"), () => { const s = sel(); A.openVersions(view, s.from, s.to); });
    const dim = mk("eye-off", T("Estompează", "Dim"), () => { const s = sel(); A.dim(view, s.from, s.to); });
    mk("archive", T("Mută în Tăieturi", "Move to Cuts"), () => { const s = sel(); A.setAside(view, s.from, s.to); });
    const render = () => { const s = sel(), on = view.state.field(itemsField).dims.some(d => s.from < d.to && s.to > d.from); dim.l.textContent = on ? T("Adu înapoi", "Bring back") : T("Estompează", "Dim"); };
    render();
    return { dom, update: () => render() };
  };
  // fereastra variantelor, ca în Write_On. Fără variante încă: alegi ce rescrii (Cuvânt · Propoziție · Paragraf), cu o explicație;
  // cu variante: doar lista lor (● cea din notă, ○ celelalte; primul rând e originalul). Ultimul rând scrie pe loc în notă și crește cu textul.
  const SCOPE_WHY = { word: T("Doar cuvântul pe care stai.", "Only the word you're on."), sentence: T("Toată propoziția în care ești, până la punct.", "The whole sentence you're in, up to the full stop."), para: T("Tot paragraful în care ești.", "The whole paragraph you're in."), sel: T("Exact ce ai selectat.", "Exactly what you selected.") };
  const VERS_OF = { word: T("Variantele acestui cuvânt", "Versions of this word"), sentence: T("Variantele acestei propoziții", "Versions of this sentence"), para: T("Variantele acestui paragraf", "Versions of this paragraph"), heading: T("Variantele acestui titlu", "Versions of this heading") };
  const createPop = view => {
    const dom = document.createElement("div"); dom.className = "tx-edit-pop";
    dom.addEventListener("mousedown", e => { if (e.target.tagName !== "TEXTAREA") e.preventDefault(); e.stopPropagation(); });
    const head = document.createElement("div"); head.className = "tx-edit-pop-head"; dom.appendChild(head);
    const ask = document.createElement("div"); ask.className = "tx-edit-pop-ask"; head.appendChild(ask);
    const askL = document.createElement("span"); askL.className = "tx-edit-pop-askl"; askL.textContent = T("Ce rescrii:", "Rewrite:"); ask.appendChild(askL);
    const tabs = document.createElement("div"); tabs.className = "tx-edit-pop-tabs"; tabs.setAttribute("role", "radiogroup"); ask.appendChild(tabs);
    const SC = [["word", T("Cuvântul", "Word")], ["sentence", T("Propoziția", "Sentence")], ["para", T("Paragraful", "Paragraph")]];
    const tabEls = SC.map(([k, label]) => { const b = document.createElement("button"); b.className = "tx-edit-pop-tab"; b.textContent = label; b.setAttribute("role", "radio"); tabs.appendChild(b);
      b.addEventListener("click", () => { const p = view.state.field(uiField).pop; if (!p) return; A.openVersions(view, p.anchor ?? p.from ?? 0, p.anchor ?? p.from ?? 0, k); setTimeout(() => ta.focus(), 0); }); return [k, b]; });
    const why = document.createElement("div"); why.className = "tx-edit-pop-why"; head.appendChild(why);
    const title = document.createElement("div"); title.className = "tx-edit-pop-title"; head.appendChild(title);
    const list = document.createElement("div"); list.className = "tx-edit-pop-list"; dom.appendChild(list);
    const inRow = document.createElement("div"); inRow.className = "tx-edit-pop-inrow"; dom.appendChild(inRow);
    const bullet = document.createElement("span"); bullet.className = "tx-edit-pop-b is-in"; bullet.textContent = "+"; inRow.appendChild(bullet);
    const ta = document.createElement("textarea"); ta.className = "tx-edit-pop-in"; ta.rows = 1; ta.placeholder = T("scrie o variantă…", "write a version…"); inRow.appendChild(ta);
    const grow = () => { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 180) + "px"; };
    const foot = document.createElement("div"); foot.className = "tx-edit-pop-f"; dom.appendChild(foot);
    const hint = document.createElement("span"); hint.className = "tx-edit-pop-hint"; foot.appendChild(hint);
    const keepB = document.createElement("button"); keepB.className = "tx-edit-pop-keep"; keepB.textContent = T("Păstrează ce se vede", "Keep what's showing"); foot.appendChild(keepB);
    const close = () => { view.dispatch({ effects: setPop.of(null) }); view.focus(); };
    const spot = () => { const p = view.state.field(uiField).pop; return p?.id ? view.state.field(itemsField).spots.find(s => s.id === p.id) : null; };
    keepB.addEventListener("click", () => { const s = spot(); if (s) A.keep(view, s.id); else close(); });
    ta.addEventListener("input", () => grow());
    ta.addEventListener("keydown", e => {
      const s = spot();
      if (e.key === "Escape") { e.preventDefault(); close(); return; }
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (ta.value.trim()) { A.addQuiet(view, ta.value); ta.value = ""; grow(); } else close(); return; }
      if ((e.key === "ArrowUp" || e.key === "ArrowDown") && s && !ta.value) { e.preventDefault(); A.cycle(view, s.id, e.key === "ArrowUp" ? -1 : 1); return; }
      if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && s && isCycleKey(e)) { e.preventDefault(); A.cycle(view, s.id, e.key === "ArrowLeft" ? -1 : 1); return; }
      if ((e.key === "Backspace" || e.key === "Delete") && s && isCycleKey(e) && !ta.value) { e.preventDefault(); A.drop(view, s.id); }
    });
    let editing = false, clickT = 0;
    const editRow = (tx, s, i) => {
      if (editing) return; editing = true; const before = tx.textContent;
      tx.setAttribute("contenteditable", "plaintext-only"); tx.classList.add("is-editing"); tx.focus();
      const r = document.createRange(); r.selectNodeContents(tx); const sel = tx.ownerDocument.getSelection(); sel.removeAllRanges(); sel.addRange(r);
      const done = save => { if (!editing) return; editing = false; tx.removeAttribute("contenteditable"); tx.classList.remove("is-editing"); tx.removeEventListener("keydown", keys); tx.removeEventListener("blur", blur);
        const t = tx.textContent; if (save && t.trim() && t !== before) A.editOption(view, s.id, i, t); else tx.textContent = before; render(); };
      const keys = e => { e.stopPropagation(); if (e.key === "Enter") { e.preventDefault(); done(true); setTimeout(() => ta.focus(), 0); } else if (e.key === "Escape") { e.preventDefault(); done(false); setTimeout(() => ta.focus(), 0); } };
      const blur = () => done(true);
      tx.addEventListener("keydown", keys); tx.addEventListener("blur", blur);
    };
    const render = () => {
      if (editing) return;   // cât editezi un rând, lista nu se redesenează
      const s = spot(), p = view.state.field(uiField).pop; while (list.firstChild) list.removeChild(list.firstChild);
      const has = !!(s && s.options.length > 1), kind = s ? kindOf(view.state, s) : null;
      const scope = p?.scope && p.scope !== "sel" ? p.scope : p?.scope === "sel" && !s ? "sel" : kind === "para" ? "para" : kind === "word" ? "word" : kind ? "sentence" : "word";
      // fără variante: alegerea, cu explicația; cu variante: doar titlul
      ask.classList.toggle("tx-edit-hide", has); why.classList.toggle("tx-edit-hide", has); title.classList.toggle("tx-edit-hide", !has);
      for (const [k, b] of tabEls) { b.classList.toggle("is-on", k === scope); b.setAttribute("aria-checked", k === scope ? "true" : "false"); }
      why.textContent = (SCOPE_WHY[scope] || "") + " " + T("În notă rămâne luminos doar ce rescrii.", "Only what you rewrite stays bright in the note.");
      title.textContent = VERS_OF[kind === "heading" ? "heading" : scope === "sel" ? "sentence" : scope] || VERS_OF.sentence;
      const opts = s ? s.options : p?.from != null ? [view.state.doc.sliceString(p.from, p.to)] : [];
      const cur = s ? s.cur : 0, draft = p?.draft;
      opts.forEach((o, i) => {
        if (i === draft) return;   // varianta în lucru e chiar rândul de scris
        const r = document.createElement("div"); r.className = "tx-edit-opt" + (cur === i ? " is-on" : ""); list.appendChild(r);
        const bl = document.createElement("span"); bl.className = "tx-edit-pop-b"; bl.textContent = cur === i ? "●" : "○"; r.appendChild(bl);
        const tx = document.createElement("span"); tx.className = "tx-edit-opt-t" + (i === 0 ? " is-orig" : ""); tx.textContent = o; r.appendChild(tx);
        if (i === 0 && has) { const tg = document.createElement("span"); tg.className = "tx-edit-opt-tag"; tg.textContent = T("original", "original"); r.appendChild(tg); }
        // un clic alege (după o clipă, ca dublu clicul să editeze fără să schimbe ce e în notă)
        if (s) r.addEventListener("click", e => { if (editing || e.detail > 1) return; clearTimeout(clickT); clickT = setTimeout(() => { if (!editing) A.show(view, s.id, i); }, 220); });
        if (s) { tx.addEventListener("dblclick", e => { e.stopPropagation(); clearTimeout(clickT); editRow(tx, s, i); });
          const ed = document.createElement("button"); ed.className = "tx-edit-opt-x tx-edit-opt-ed"; ed.textContent = "✎"; ed.setAttribute("aria-label", T("Editează varianta", "Edit this version")); ed.addEventListener("click", e => { e.stopPropagation(); editRow(tx, s, i); }); r.appendChild(ed); }
        if (s && i > 0) { const x = document.createElement("button"); x.className = "tx-edit-opt-x"; x.textContent = "✕"; x.setAttribute("aria-label", T("Scoate varianta", "Remove this version")); x.addEventListener("click", e => { e.stopPropagation(); A.remove(view, s.id, i); }); r.appendChild(x); }
      });
      const drafting = draft != null && cur === draft;
      bullet.textContent = drafting ? "●" : "+"; bullet.classList.toggle("is-cur", drafting);
      hint.textContent = has ? T("↑ ↓ sau clic alegi · dublu clic editezi · Enter adaugă · Esc înapoi", "↑ ↓ or click to pick · double-click to edit · Enter adds · Esc back") : T("Scrie o variantă · Enter o adaugă în listă · Esc înapoi", "Write a version · Enter adds it to the list · Esc back");
      keepB.classList.toggle("tx-edit-hide", !has);
    };
    render();
    return { dom, mount: () => setTimeout(() => { ta.focus(); grow(); }, 0), update: () => render() };
  };
  // cât e deschisă fereastra variantelor, restul notei se estompează, ca să iasă în față locul la care lucrezi
  const focusFade = EditorView.decorations.compute([uiField, itemsField], state => {
    const ui = state.field(uiField); if (!ui.on || !ui.pop) return Decoration.none;
    const s = ui.pop.id ? state.field(itemsField).spots.find(x => x.id === ui.pop.id) : null, from = s ? s.from : ui.pop.from, to = s ? s.to : ui.pop.to;
    if (from == null) return Decoration.none;
    const rs = [], fade = Decoration.mark({ class: "tx-edit-fade" });
    if (from > 0) rs.push(fade.range(0, from)); if (to < state.doc.length) rs.push(fade.range(to, state.doc.length));
    return Decoration.set(rs);
  });
  const tips = showTooltip.computeN([uiField, itemsField, "selection"], state => {
    const ui = state.field(uiField); if (!ui.on) return [];
    if (ui.pop) {
      // sub capătul locului (nu sub început): o propoziție lungă rămâne toată la vedere cât scrii
      const s = ui.pop.id ? state.field(itemsField).spots.find(x => x.id === ui.pop.id) : null, pos = s ? s.from : ui.pop.from, end = s ? s.to : ui.pop.to;
      return pos == null ? [] : [{ pos, end, above: false, arrow: false, create: createPop }];   // stă pe loc: la începutul locului, sub capătul lui
    }
    const sel = state.selection.main; if (sel.empty) return [];
    return [{ pos: sel.from, end: sel.to, above: true, arrow: false, create: createBar }];
  });

  // alegi cu un clic un cuvânt, o propoziție sau un paragraf cu variante: ← → (sau ↑ ↓) le schimbă, ⌫ o șterge pe cea care se vede, ⌘Z o aduce înapoi.
  // Încă un clic pe el, Esc sau scrisul te întorc la scris (cursorul rămâne unde ai dat clic).
  const spotFromDom = (view, el) => {
    const hit = el?.closest?.(".tx-edit-spot, .cm-line.tx-edit-para"); if (!hit) return null;
    let pos; try { pos = view.posAtDOM(hit); } catch (e) { return null; }
    const st = view.state, spots = st.field(itemsField).spots.filter(x => x.options.length > 1);
    if (!hit.classList.contains("tx-edit-spot")) { const ln = st.doc.lineAt(pos).number; return spots.find(x => kindOf(st, x) === "para" && st.doc.lineAt(x.from).number <= ln && ln <= st.doc.lineAt(x.to).number) || null; }
    return spots.find(x => pos >= x.from && pos < x.to) || spots.find(x => pos >= x.from && pos <= x.to) || null;
  };
  const unpick = view => { if (view.state.field(uiField).pick) view.dispatch({ effects: setPick.of(null) }); };
  const OURS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Backspace", "Delete"]);
  // clic pe un pasaj estompat: revine; clic pe un semn „Verifică”: trei acțiuni
  const events = EditorView.domEventHandlers({
    keydown(e, view) {
      const ui = view.state.field(uiField); if (!ui.pick) return false;
      const undoKey = (e.metaKey || e.ctrlKey) && /^[zy]$/i.test(e.key), lone = ["Shift", "Meta", "Control", "Alt", "CapsLock"].includes(e.key);
      if (!undoKey && !lone && !(OURS.has(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey)) unpick(view);   // scrii: înapoi la scris (tasta merge mai departe)
      return false;
    },
    mousedown(e, view) {
      if (!view.state.field(uiField).on || e.button !== 0) return false;
      if (!e.target?.closest?.(".tx-edit-dots") && !e.shiftKey) {   // un clic pe un loc cu variante îl alege; încă unul (sau în altă parte) te întoarce la scris
        const s = spotFromDom(view, e.target), cur = view.state.field(uiField).pick?.id || null;
        if (s && s.id !== cur) view.dispatch({ effects: setPick.of({ id: s.id }) }); else if (cur) unpick(view);
      }
      const tk = e.target?.closest?.(".tx-edit-trim");
      if (tk) { e.preventDefault(); view.dispatch({ effects: keepTrim.of(tk.getAttribute("data-tx-trim")) }); return true; }
      const mk = e.target?.closest?.(".tx-edit-mark");
      if (mk) { const m = view.state.field(uiField).marks.find(x => x.id === mk.getAttribute("data-tx-mark")); if (m) { e.preventDefault(); A.markMenu(view, m, e); return true; } }
      if (e.target?.closest?.(".tx-edit-dim")) { let pos = null; try { pos = view.posAtDOM(e.target); } catch (err) {} if (pos != null && A.undimAt(view, pos)) return false; }
      return false;
    },
  });

  // încarcă variantele notei când o deschizi; le salvează când se schimbă
  const io = ViewPlugin.fromClass(class {
    constructor(view) { this.view = view; this.t = 0; this.load(); }
    load() {
      const it = this.view.state.field(itemsField); if (it.loaded || !it.path) return;
      const path = it.path; setTimeout(() => { try { if (this.view.state.field(itemsField).path !== path || this.view.state.field(itemsField).loaded) return; const d = E.load(path, this.view.state.doc.toString()); this.view.dispatch({ effects: loadItems.of({ path, ...d }) }); } catch (e) { console.warn("Texere: editarea, încărcarea", e); } }, 0);
    }
    update(u) {
      const a = u.startState.field(itemsField), b = u.state.field(itemsField);
      if (!b.loaded) { this.load(); return; }
      if (a === b || !a.loaded || a.path !== b.path) return;
      clearTimeout(this.t); const path = b.path; this.t = setTimeout(() => { try { E.save(path, this.view.state.field(itemsField), this.view.state.doc.toString()); } catch (e) { console.warn("Texere: editarea, salvarea", e); } }, 600);
    }
    destroy() { clearTimeout(this.t); }
  });

  // Esc închide fereastra variantelor și când cursorul e în notă (înaintea tastelor lui Obsidian)
  // ⌃⌘← → (pe Windows / Linux Ctrl+Alt+Shift+← →): varianta anterioară / următoare a locului în care ești
  // ⌃⌘↑ ↓: sari la locul anterior / următor din notă care are variante. ⌃⌘⌫: șterge varianta care se vede. Combinații pe care scrisul nu le folosește (⌥← → rămâne „cuvânt cu cuvânt”).
  const cycleKey = d => view => { if (!view.state.field(uiField).on) return false; const s = A.spotAt(view.state, view.state.selection.main.head); if (!s) return false; A.cycle(view, s.id, d); return true; };
  const dropKey = view => { if (!view.state.field(uiField).on) return false; const s = A.spotAt(view.state, view.state.selection.main.head); if (!s) return false; A.drop(view, s.id); return true; };
  const jumpKey = d => view => {
    const ui = view.state.field(uiField); if (!ui.on) return false;
    const spots = view.state.field(itemsField).spots.filter(s => s.options.length > 1); if (!spots.length) return false;
    const h = view.state.selection.main.head, here = A.spotAt(view.state, h);
    const next = d > 0 ? spots.find(s => s.from > (here ? here.to : h)) : [...spots].reverse().find(s => s.to < (here ? here.from : h));
    if (!next) { new Notice(d > 0 ? T("Nu mai sunt variante mai jos.", "No more versions below.") : T("Nu mai sunt variante mai sus.", "No more versions above."), 1500); return true; }
    view.dispatch({ selection: { anchor: next.from }, effects: [setPop.of(ui.pop ? { id: next.id, anchor: next.from } : null), EditorView.scrollIntoView(next.from, { y: "center" })] });
    return true;
  };
  const pickKey = fn => view => { const ui = view.state.field(uiField); if (!ui.on || !ui.pick || ui.pop) return false; const s = view.state.field(itemsField).spots.find(x => x.id === ui.pick.id); if (!s) return false; fn(view, s); return true; };
  const pickKeys = [
    { key: "ArrowLeft", run: pickKey((v, s) => A.cycle(v, s.id, -1)) }, { key: "ArrowUp", run: pickKey((v, s) => A.cycle(v, s.id, -1)) },
    { key: "ArrowRight", run: pickKey((v, s) => A.cycle(v, s.id, 1)) }, { key: "ArrowDown", run: pickKey((v, s) => A.cycle(v, s.id, 1)) },
    { key: "Backspace", run: pickKey((v, s) => A.drop(v, s.id)) }, { key: "Delete", run: pickKey((v, s) => A.drop(v, s.id)) },
  ];
  const escKey = Prec.highest(keymap.of([
    { key: "Escape", run: view => { const ui = view.state.field(uiField); if (ui.pick && !ui.pop) { unpick(view); return true; } if (!ui.pop) return false; view.dispatch({ effects: setPop.of(null) }); return true; } },
    ...pickKeys,
    { key: "Ctrl-Alt-Shift-ArrowLeft", mac: "Ctrl-Cmd-ArrowLeft", run: cycleKey(-1) }, { key: "Ctrl-Alt-Shift-ArrowRight", mac: "Ctrl-Cmd-ArrowRight", run: cycleKey(1) },
    { key: "Ctrl-Alt-Shift-ArrowUp", mac: "Ctrl-Cmd-ArrowUp", run: jumpKey(-1) }, { key: "Ctrl-Alt-Shift-ArrowDown", mac: "Ctrl-Cmd-ArrowDown", run: jumpKey(1) },
    { key: "Ctrl-Alt-Shift-Backspace", mac: "Ctrl-Cmd-Backspace", run: dropKey }, { key: "Ctrl-Alt-Shift-Delete", mac: "Ctrl-Cmd-Delete", run: dropKey },   // ⌃⌘⌫: șterge varianta care se vede
  ]));

  let undoable = [];
  try {
    const { invertedEffects } = require("@codemirror/commands");
    undoable = [invertedEffects.of(tr => {
      const out = [], before = tr.startState.field(itemsField, false); if (!before) return out;
      for (const e of tr.effects) {
        if (e.is(putSpot)) out.push(putSpot.of({ id: e.value.id, spot: before.spots.find(x => x.id === e.value.id) || null }));
        if (e.is(putDim)) out.push(putDim.of({ id: e.value.id, dim: before.dims.find(x => x.id === e.value.id) || null }));
      }
      return out;
    })];
  } catch (e) { /* fără istoric: ⌘Z aduce înapoi doar textul */ }
  // o variantă aleasă pentru un cuvânt: „a”/„an” de dinainte se potrivește singur (doar în engleză), în aceeași tranzacție (un singur Ctrl+Z)
  const articles = EditorState.transactionFilter.of(tr => {
    if (!tr.docChanged || !tr.isUserEvent?.(EV)) return tr;
    const fixes = [];
    tr.changes.iterChanges((fromA, toA, fromB, toB, ins) => {
      const text = ins.toString(); if (!text || /^\s/.test(text)) return;
      const line = tr.newDoc.lineAt(fromB), f = ART.fix(line.text, line.from, fromB, text);
      if (f && !fixes.some(x => x.from === f.from)) fixes.push(f);
    });
    return fixes.length ? [tr, { changes: fixes, sequential: true, userEvent: EV }] : tr;
  });
  return { extension: [itemsField, uiField, decorations, focusFade, theme, panel, tips, events, io, escKey, articles, ...undoable], fields: { itemsField, uiField }, effects: { setOn, setPop, setMarks, dropMark, loadItems, putSpot, putDim, setTrims, keepTrim, setPick }, actions: A, keys: { cycleKey, jumpKey, dropKey, pickKeys, KEYS }, EV };
}

module.exports = { makeEdit, EV };
