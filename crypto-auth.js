/**
 * Муҳофизати ҳуҷра — Защита комнаты
 * ---------------------------------
 * Масъала: канали релей (MQTT) ва коди ҳуҷра ошкоранд. Ҳар кас, ки линкро
 * дорад, метавонад ба мавзӯи `/h` паёми сохта фиристад ва худро муаллим
 * вонамуд кунад — бозӣ оғоз кунад, ҷавоби дурустро кушояд ё бозиро вайрон кунад.
 *
 * Ҳал: имзои рақамии ECDSA (P-256).
 *   • Муаллим ҳангоми сохтани ҳуҷра як ҷуфти калид месозад.
 *   • Калиди КУШОД дар линк (дар қисми `#k=...`) ба донишҷӯён меравад.
 *     Қисми `#` ба сервер фиристода намешавад — танҳо дар браузер мемонад.
 *   • Калиди МАХФӢ ҳеҷ гоҳ аз дастгоҳи муаллим берун намебарояд.
 *   • Ҳар паёми муаллим имзо мешавад; донишҷӯ имзоро тафтиш мекунад.
 *     Бе калиди махфӣ имзои дуруст сохтан имконнопазир аст.
 *
 * Ҳамчунин ҳар донишҷӯ калиди худро дорад — то як донишҷӯ ба ҷои
 * донишҷӯи дигар ҷавоб фиристода натавонад.
 */
'use strict';

/* ------------------------------------------------------------------ */
/*  Base64URL                                                          */
/* ------------------------------------------------------------------ */

function bufToB64u(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const b64 = (typeof btoa === 'function')
    ? btoa(bin)
    : Buffer.from(bytes).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64uToBuf(str) {
  const b64 = String(str).replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64 + '==='.slice((b64.length + 3) % 4);
  if (typeof atob === 'function') {
    const bin = atob(pad);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  return new Uint8Array(Buffer.from(pad, 'base64'));
}

function utf8Bytes(str) {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str);
  return new Uint8Array(Buffer.from(str, 'utf8'));
}

/* ------------------------------------------------------------------ */
/*  SHA-256 — барои пароли муаллим                                     */
/* ------------------------------------------------------------------ */

/**
 * Татбиқи тозаи JS. Лозим аст, чунки `crypto.subtle` танҳо дар контексти
 * бехатар (https ё localhost) кор мекунад — агар файл бо `file://` кушода
 * шавад, он нест. Тафтиши парол бояд ҳамеша кор кунад.
 */
const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
];

function sha256Hex(message) {
  const msg = utf8Bytes(message);
  const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];

  const bitLen = msg.length * 8;
  const withPad = new Uint8Array(((msg.length + 9 + 63) >> 6) << 6);
  withPad.set(msg);
  withPad[msg.length] = 0x80;
  const dv = new DataView(withPad.buffer);
  dv.setUint32(withPad.length - 4, bitLen >>> 0, false);
  dv.setUint32(withPad.length - 8, Math.floor(bitLen / 0x100000000), false);

  const w = new Uint32Array(64);
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));

  for (let off = 0; off < withPad.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0;
      d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
  }
  return H.map((x) => x.toString(16).padStart(8, '0')).join('');
}

/** Муқоисаи вақташ доимӣ — то парол аз рӯи вақти ҷавоб фаҳмида нашавад. */
function safeEqual(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function checkAdminPassword(plain) {
  const cfg = (typeof QUIZ_CONFIG !== 'undefined') ? QUIZ_CONFIG
    : (typeof window !== 'undefined' ? window.QUIZ_CONFIG : null);
  if (!cfg || !cfg.adminPassHash) return false;
  return safeEqual(sha256Hex(String(plain)), String(cfg.adminPassHash).toLowerCase());
}

/* ------------------------------------------------------------------ */
/*  Имзои ECDSA                                                        */
/* ------------------------------------------------------------------ */

const SUBTLE = (function () {
  try {
    if (typeof crypto !== 'undefined' && crypto && crypto.subtle) return crypto.subtle;
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) return window.crypto.subtle;
  } catch (e) {}
  return null;
})();

const SIGN_ALGO = { name: 'ECDSA', namedCurve: 'P-256' };
const SIGN_PARAMS = { name: 'ECDSA', hash: { name: 'SHA-256' } };

/** Оё имзо дар ин муҳит дастрас аст? (https ё localhost лозим) */
function cryptoAvailable() { return !!SUBTLE; }

/**
 * Матни каноникӣ барои имзо: ҳамаи майдонҳо ғайр аз худи `sig`,
 * бо тартиби ҳарфӣ — то ду тараф айнан як сатрро имзо/тафтиш кунанд.
 */
function canonical(msg) {
  const keys = Object.keys(msg).filter((k) => k !== 'sig' && k !== 'pub').sort();
  return JSON.stringify(keys.map((k) => [k, msg[k]]));
}

async function generateKeyPair() {
  if (!SUBTLE) return null;
  const pair = await SUBTLE.generateKey(SIGN_ALGO, false, ['sign', 'verify']);
  const raw = await SUBTLE.exportKey('raw', pair.publicKey);
  return { privateKey: pair.privateKey, publicKey: pair.publicKey, pub: bufToB64u(raw) };
}

async function importPublicKey(pubB64u) {
  if (!SUBTLE || !pubB64u) return null;
  try {
    return await SUBTLE.importKey('raw', b64uToBuf(pubB64u), SIGN_ALGO, false, ['verify']);
  } catch (e) {
    return null;
  }
}

async function signMessage(privateKey, msg) {
  if (!SUBTLE || !privateKey) return null;
  try {
    const sig = await SUBTLE.sign(SIGN_PARAMS, privateKey, utf8Bytes(canonical(msg)));
    return bufToB64u(sig);
  } catch (e) {
    return null;
  }
}

async function verifyMessage(publicKey, msg) {
  if (!SUBTLE || !publicKey || !msg || !msg.sig) return false;
  try {
    return await SUBTLE.verify(SIGN_PARAMS, publicKey, b64uToBuf(msg.sig), utf8Bytes(canonical(msg)));
  } catch (e) {
    return false;
  }
}

const QuizAuth = {
  sha256Hex, safeEqual, checkAdminPassword,
  cryptoAvailable, canonical,
  generateKeyPair, importPublicKey, signMessage, verifyMessage,
  bufToB64u, b64uToBuf
};

if (typeof window !== 'undefined') window.QuizAuth = QuizAuth;
if (typeof module !== 'undefined') module.exports = QuizAuth;
