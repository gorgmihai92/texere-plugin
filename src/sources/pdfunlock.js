// Descuierea unui PDF încuiat de editor (criptat cu parolă de utilizator goală: se deschide oricum, dar nu se poate modifica).
// pdf-lib din PDF++ descifrează fluxurile corect, dar șirurile (titlurile din cuprins, Info, textele adnotărilor) le strică:
// le descifrează împreună cu caracterele de evadare (\( \) \\ \ddd) și le scrie înapoi fără să le evadeze.
// Aici le refacem pe toate din fișierul original: le citim încă cifrate, le descifrăm cu cheia documentului și le punem
// în documentul descifrat ca șiruri evadate corect. Merge pentru RC4 (40/128), AES-128 și AES-256 (R2–R6).
"use strict";

const PAD = Uint8Array.from([0x28, 0xbf, 0x4e, 0x5e, 0x4e, 0x75, 0x8a, 0x41, 0x64, 0x00, 0x4e, 0x56, 0xff, 0xfa, 0x01, 0x08,
  0x2e, 0x2e, 0x00, 0xb6, 0xd0, 0x68, 0x3e, 0x80, 0x2f, 0x0c, 0xa9, 0xfe, 0x64, 0x53, 0x69, 0x7a]);

const cat = (...a) => { const n = a.reduce((s, x) => s + x.length, 0), o = new Uint8Array(n); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };
const le = (v, n) => { const o = new Uint8Array(n); for (let i = 0; i < n; i++) o[i] = (v >>> (8 * i)) & 0xff; return o; };

function rc4(key, data) {
  const s = new Uint8Array(256); for (let i = 0; i < 256; i++) s[i] = i;
  for (let i = 0, j = 0; i < 256; i++) { j = (j + s[i] + key[i % key.length]) & 0xff; const t = s[i]; s[i] = s[j]; s[j] = t; }
  const out = new Uint8Array(data.length);
  for (let k = 0, i = 0, j = 0; k < data.length; k++) { i = (i + 1) & 0xff; j = (j + s[i]) & 0xff; const t = s[i]; s[i] = s[j]; s[j] = t; out[k] = data[k] ^ s[(s[i] + s[j]) & 0xff]; }
  return out;
}

function make(crypto) {
  const hash = (alg, ...parts) => { const h = crypto.createHash(alg); for (const p of parts) h.update(p); return new Uint8Array(h.digest()); };
  const aesDec = (key, iv, data) => { const d = crypto.createDecipheriv(`aes-${key.length * 8}-cbc`, key, iv); d.setAutoPadding(false); return new Uint8Array(Buffer.concat([d.update(data), d.final()])); };
  const aesEnc = (key, iv, data) => { const c = crypto.createCipheriv(`aes-${key.length * 8}-cbc`, key, iv); c.setAutoPadding(false); return new Uint8Array(Buffer.concat([c.update(data), c.final()])); };

  // Algoritmul 2.B (R6): hash-ul parolei
  function hash2B(pw, salt, udata) {
    let K = hash("sha256", pw, salt, udata);
    for (let i = 0; ; i++) {
      const K1 = new Uint8Array((pw.length + K.length + udata.length) * 64), one = cat(pw, K, udata);
      for (let r = 0; r < 64; r++) K1.set(one, r * one.length);
      const E = aesEnc(K.slice(0, 16), K.slice(16, 32), K1);
      let m = 0; for (let b = 0; b < 16; b++) m += E[b];
      K = hash(["sha256", "sha384", "sha512"][m % 3], E);
      if (i >= 63 && E[E.length - 1] <= i - 32) break;
    }
    return K.slice(0, 32);
  }

  // cheia documentului pentru parola de utilizator goală; null dacă parola goală nu e cea bună
  function fileKey(enc, id0) {
    const { V, R, O, U, P, len, encMeta, UE } = enc, pw = new Uint8Array(0);
    if (R >= 5) {
      const vsalt = U.slice(32, 40), ksalt = U.slice(40, 48);
      const check = R === 5 ? hash("sha256", pw, vsalt) : hash2B(pw, vsalt, new Uint8Array(0));
      if (!check.every((b, i) => b === U[i])) return null;
      const ik = R === 5 ? hash("sha256", pw, ksalt) : hash2B(pw, ksalt, new Uint8Array(0));
      return aesDec(ik, new Uint8Array(16), UE.slice(0, 32));
    }
    const n = R === 2 ? 5 : Math.max(5, Math.min(16, (len || 40) / 8));
    let k = hash("md5", PAD, O.slice(0, 32), le(P, 4), id0, R >= 4 && !encMeta ? Uint8Array.from([255, 255, 255, 255]) : new Uint8Array(0)).slice(0, n);
    if (R >= 3) for (let i = 0; i < 50; i++) k = hash("md5", k).slice(0, n);
    // verificarea parolei goale (algoritmii 4 și 5)
    if (R === 2) { if (!rc4(k, PAD).every((b, i) => b === U[i])) return null; }
    else {
      let x = rc4(k, hash("md5", PAD, id0));
      for (let i = 1; i <= 19; i++) x = rc4(k.map(b => b ^ i), x);
      if (!x.every((b, i) => b === U[i])) return null;
    }
    return k;
  }

  // descifrarea unui șir al obiectului num/gen
  function decryptor(enc, key) {
    if (enc.R >= 5) return (num, gen, data) => aesStrip(key, data);
    const aes = enc.strAes;
    return (num, gen, data) => {
      const ok = hash("md5", key, le(num, 3), le(gen, 2), aes ? Uint8Array.from([0x73, 0x41, 0x6c, 0x54]) : new Uint8Array(0)).slice(0, Math.min(key.length + 5, 16));
      return aes ? aesStrip(ok, data) : rc4(ok, data);
    };
  }
  function aesStrip(key, data) {
    if (data.length < 32 || data.length % 16) return data.length === 16 || data.length === 0 ? new Uint8Array(0) : data;
    const out = aesDec(key, data.slice(0, 16), data.slice(16)), p = out[out.length - 1];
    return p >= 1 && p <= 16 ? out.slice(0, out.length - p) : out;
  }
  return { fileKey, decryptor };
}

// un șir literal PDF, evadat corect (doar ASCII tipăribil rămâne ca atare)
function literal(bytes) {
  let s = "";
  for (const b of bytes) {
    if (b === 0x28 || b === 0x29 || b === 0x5c) s += "\\" + String.fromCharCode(b);
    else if (b >= 0x20 && b < 0x7f) s += String.fromCharCode(b);
    else s += "\\" + b.toString(8).padStart(3, "0");
  }
  return s;
}

const isRef = o => o && typeof o.objectNumber === "number" && typeof o.generationNumber === "number";
// un șir (literal „(…)” sau hex „<…>”); PDFName are și el asBytes/decodeText, dar se scrie „/Nume”
const isStr = o => o && typeof o.asBytes === "function" && !o.dict && !Array.isArray(o.array) && /^(\(|<(?!<))/.test(String(o));
const isDict = o => o && o.dict instanceof Map && typeof o.get === "function";
const isArr = o => o && Array.isArray(o.array);
const num = o => typeof o?.asNumber === "function" ? o.asNumber() : (typeof o?.numberValue === "number" ? o.numberValue : undefined);
const bytesOf = o => (isStr(o) ? o.asBytes() : null);

// citește dicționarul /Encrypt (din documentul încărcat fără descifrare)
function readEncrypt(raw) {
  const tr = raw.context.trailerInfo, encRef = tr.Encrypt, d = isRef(encRef) ? raw.context.lookup(encRef) : encRef;
  if (!isDict(d)) return null;
  const g = k => { for (const [n, v] of d.dict) if (String(n) === "/" + k) return isRef(v) ? raw.context.lookup(v) : v; return undefined; };
  if (String(g("Filter")) !== "/Standard") return null;
  const enc = { ref: isRef(encRef) ? encRef : null, V: num(g("V")) || 0, R: num(g("R")) || 2, O: bytesOf(g("O")), U: bytesOf(g("U")), OE: bytesOf(g("OE")), UE: bytesOf(g("UE")),
    P: num(g("P")) | 0, len: num(g("Length")) || 40, encMeta: String(g("EncryptMetadata")) !== "false", strAes: false };
  if (enc.V >= 4) {
    const cf = g("CF"), strf = String(g("StrF") || "/Identity").slice(1);
    let cfm = "";
    if (isDict(cf)) for (const [n, v] of cf.dict) if (String(n) === "/" + strf) { const vd = isRef(v) ? raw.context.lookup(v) : v; if (isDict(vd)) for (const [n2, v2] of vd.dict) { if (String(n2) === "/CFM") cfm = String(v2); if (String(n2) === "/Length" && enc.V === 4) enc.len = (num(v2) || 16) * (num(v2) > 32 ? 1 : 8); } }
    if (strf === "Identity") enc.identity = true;
    enc.strAes = /AESV/.test(cfm);
  }
  const id = tr.ID, id0 = isArr(id) ? bytesOf(id.array[0]) : null;
  enc.id0 = id0 || new Uint8Array(0);
  return enc.O && enc.U ? enc : null;
}

// pune în `dec` (documentul descifrat de PDF++) șirurile descifrate corect din `raw` (același fișier, încărcat fără descifrare).
// Str: clasa PDFString a lui pdf-lib (PDF++ nu o exportă; o ia apelantul dintr-un document mic)
function fixStrings(raw, dec, crypto, Str) {
  const enc = readEncrypt(raw); if (!enc) throw new Error("dicționarul /Encrypt nu e de tip Standard");
  if (enc.identity) return 0;   // șirurile nu sunt cifrate
  const C = make(crypto), key = C.fileKey(enc, enc.id0); if (!key) throw new Error("parola goală nu deschide documentul");
  const dek = C.decryptor(enc, key), mk = b => Str.of(literal(b));
  let n = 0;
  const fix = (num, gen, r, d) => {
    if (isArr(r) && isArr(d) && r.array.length === d.array.length) r.array.forEach((x, i) => { if (isStr(x)) { d.set(i, mk(dek(num, gen, x.asBytes()))); n++; } else fix(num, gen, x, d.array[i]); });
    else if (isDict(r) && isDict(d)) {
      if (isSig(r)) return;
      for (const [k, v] of r.dict) { const dv = d.get(k); if (dv === undefined) continue; if (isStr(v)) { d.set(k, mk(dek(num, gen, v.asBytes()))); n++; } else fix(num, gen, v, dv); }
    }
  };
  // pdf-lib pierde /Info din trailer când e într-un flux de obiecte; îl punem la loc (titlul, autorul, datele documentului)
  const ri = raw.context.trailerInfo.Info;
  if (!dec.context.trailerInfo.Info && isRef(ri) && isDict(dec.context.lookup(ri))) dec.context.trailerInfo.Info = ri;
  for (const [ref, obj] of raw.context.enumerateIndirectObjects()) {
    if (enc.ref && ref.objectNumber === enc.ref.objectNumber) continue;
    const d = dec.context.lookup(ref); if (!d) continue;
    const ro = obj.contents && obj.dict ? obj.dict : obj, dd = d.contents && d.dict ? d.dict : d;   // la fluxuri: doar dicționarul lor
    if (isStr(ro)) { if (isStr(d)) dec.context.assign(ref, mk(dek(ref.objectNumber, ref.generationNumber, ro.asBytes()))); n++; continue; }
    fix(ref.objectNumber, ref.generationNumber, ro, dd);
  }
  return n;
}
const isSig = d => { for (const [k, v] of d.dict) if (String(k) === "/ByteRange" || (String(k) === "/Type" && String(v) === "/Sig")) return true; return false; };

module.exports = { fixStrings, literal, rc4, _make: make, readEncrypt };
