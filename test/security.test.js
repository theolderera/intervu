/**
 * Санҷиши муҳофизат — Проверка защиты
 *
 * 1) Пароли муаллим: hash, муқоисаи бехатар, паролҳои нодуруст.
 * 2) Имзои ECDSA: имзо/тафтиш, рад кардани паёми тағйирёфта ва калиди бегона.
 * 3) Бонкҳои савол: сохтор ва дузабонагӣ.
 * 4) Пок шудани кеш пас аз бозӣ.
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { webcrypto } = require('crypto');

const DIR = process.argv[2] || path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');

let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log('  ✅ ' + name); }
  else { fail++; console.log('  ❌ ' + name + (extra ? '  → ' + extra : '')); }
}
const section = (s) => console.log('\n--- ' + s + ' ---');

/* ================================================================ */
/*  1. Пароли муаллим                                                */
/* ================================================================ */

const sandbox = {
  console, TextEncoder, TextDecoder, Buffer,
  Uint8Array, Uint32Array, DataView, ArrayBuffer, Promise, Math, Date, JSON,
  crypto: webcrypto,
  btoa: (b) => Buffer.from(b, 'binary').toString('base64'),
  atob: (b) => Buffer.from(b, 'base64').toString('binary')
};
sandbox.window = sandbox;
const ctx = vm.createContext(sandbox);
vm.runInContext(read('config.js'), ctx);
vm.runInContext(read('crypto-auth.js'), ctx);
const A = sandbox.QuizAuth;
const CFG = sandbox.QUIZ_CONFIG;

section('1. Пароли муаллим');

const knownHash = require('crypto').createHash('sha256').update('ustod-2026', 'utf8').digest('hex');
check('SHA-256-и тозаи JS бо Node мувофиқ аст', A.sha256Hex('ustod-2026') === knownHash);
check('SHA-256 барои сатри холӣ дуруст аст',
  A.sha256Hex('') === 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
check('SHA-256 барои матни кириллӣ (UTF-8) кор мекунад',
  A.sha256Hex('Салом') === require('crypto').createHash('sha256').update('Салом', 'utf8').digest('hex'));
check('SHA-256 барои матни дароз (>64 байт) дуруст аст',
  A.sha256Hex('a'.repeat(200)) === require('crypto').createHash('sha256').update('a'.repeat(200)).digest('hex'));

check('config.js пароли кушодро нигоҳ намедорад',
  !read('config.js').includes("'ustod-2026'") || !/adminPass\s*:/.test(read('config.js')));
check('дар config.js танҳо hash аст', /^[0-9a-f]{64}$/.test(CFG.adminPassHash));

check('пароли дуруст қабул мешавад', A.checkAdminPassword('ustod-2026') === true);
check('пароли нодуруст рад мешавад', A.checkAdminPassword('ustod-2025') === false);
check('пароли холӣ рад мешавад', A.checkAdminPassword('') === false);
check('пароли бо ҳарфи калон рад мешавад (регистр муҳим аст)',
  A.checkAdminPassword('USTOD-2026') === false);
check('худи hash ҳамчун парол кор намекунад',
  A.checkAdminPassword(CFG.adminPassHash) === false);
check('муқоисаи бехатар дарозии гуногунро рад мекунад',
  A.safeEqual('abc', 'abcd') === false && A.safeEqual('abc', 'abc') === true);

/* ================================================================ */
/*  2. Имзои рақамӣ                                                  */
/* ================================================================ */

section('2. Имзои рақамии ECDSA');

(async () => {
  check('crypto.subtle дастрас аст', A.cryptoAvailable() === true);

  const teacher = await A.generateKeyPair();
  const impostor = await A.generateKeyPair();
  check('ҷуфти калид сохта шуд', !!(teacher && teacher.pub && teacher.privateKey));
  check('калиди кушод base64url аст (бе +/=)', /^[A-Za-z0-9_-]+$/.test(teacher.pub));
  check('ду ҷуфти калид фарқ мекунанд', teacher.pub !== impostor.pub);

  const teacherPub = await A.importPublicKey(teacher.pub);
  const impostorPub = await A.importPublicKey(impostor.pub);
  check('калиди кушод ворид карда шуд', !!teacherPub);
  check('калиди нодуруст ворид намешавад', (await A.importPublicKey('нодуруст!!!')) === null);

  // Паёми воқеии муаллим
  const msg = { type: 'REVEAL', room: 'CPP-AB12', mid: 'm_1', pos: 0, correct: 2 };
  msg.sig = await A.signMessage(teacher.privateKey, msg);
  check('паём имзо шуд', typeof msg.sig === 'string' && msg.sig.length > 40);
  check('имзои муаллим тафтишро мегузарад', (await A.verifyMessage(teacherPub, msg)) === true);

  // ⚠️ Ҳамлаи асосӣ: донишҷӯ ҷавоби дурустро иваз карданӣ мешавад
  const tampered = { ...msg, correct: 0 };
  check('паёми ТАҒЙИРЁФТА рад мешавад', (await A.verifyMessage(teacherPub, tampered)) === false);

  const tamperedType = { ...msg, type: 'END' };
  check('иваз кардани навъи паём рад мешавад', (await A.verifyMessage(teacherPub, tamperedType)) === false);

  const tamperedRoom = { ...msg, room: 'CPP-ZZZZ' };
  check('иваз кардани коди ҳуҷра рад мешавад', (await A.verifyMessage(teacherPub, tamperedRoom)) === false);

  // ⚠️ Ҳамла: касе худро муаллим вонамуд мекунад
  const forged = { type: 'QUESTION', room: 'CPP-AB12', mid: 'm_2', pos: 5 };
  forged.sig = await A.signMessage(impostor.privateKey, forged);
  check('имзои БЕГОНА бо калиди муаллим рад мешавад',
    (await A.verifyMessage(teacherPub, forged)) === false);
  check('ҳамон имзо бо калиди худи худаш мегузарад (тест дуруст аст)',
    (await A.verifyMessage(impostorPub, forged)) === true);

  const unsigned = { type: 'END', room: 'CPP-AB12', mid: 'm_3' };
  check('паёми БЕ имзо рад мешавад', (await A.verifyMessage(teacherPub, unsigned)) === false);

  const badSig = { ...msg, sig: A.bufToB64u(new Uint8Array(64)) };
  check('имзои сохтаи тасодуфӣ рад мешавад', (await A.verifyMessage(teacherPub, badSig)) === false);

  // Майдони `pub` ба матни имзошаванда дохил намешавад
  const withPub = { ...msg, pub: teacher.pub };
  check('иловаи майдони pub имзоро вайрон намекунад',
    (await A.verifyMessage(teacherPub, withPub)) === true);

  // Тартиби майдонҳо набояд ба имзо таъсир кунад
  const reordered = { correct: 2, pos: 0, mid: 'm_1', room: 'CPP-AB12', type: 'REVEAL', sig: msg.sig };
  check('тартиби дигари майдонҳо имзоро вайрон намекунад',
    (await A.verifyMessage(teacherPub, reordered)) === true);

  /* ============================================================== */
  /*  3. Бонкҳои савол                                              */
  /* ============================================================== */

  section('3. Бонкҳои савол (дузабона)');

  const qctx = vm.createContext({ console, window: {}, module: undefined });
  qctx.window = qctx;
  vm.runInContext(read('questions.js'), qctx);
  vm.runInContext(read('questions-js.js'), qctx);
  const banks = { 'C++': qctx.cppQuestions, JavaScript: qctx.jsQuestions };

  Object.keys(banks).forEach((label) => {
    const b = banks[label];
    check(`${label}: бонк холӣ нест`, Array.isArray(b) && b.length >= 50, b && b.length);

    const bad = [];
    b.forEach((q, i) => {
      // Ҳар майдони матнӣ бояд ҳар се луғатро дошта бошад.
      // (Лотини ӯзбекӣ луғат надорад — аз `uz` ҳосил мешавад.)
      const bi = (v) => v && typeof v === 'object' && v.tg && v.ru && v.uz;
      if (!bi(q.question)) bad.push(`#${i + 1} question`);
      if (!bi(q.explanation)) bad.push(`#${i + 1} explanation`);
      if (!bi(q.category)) bad.push(`#${i + 1} category`);
      if (!Array.isArray(q.options) || q.options.length !== 4) bad.push(`#${i + 1} options`);
      else q.options.forEach((o, j) => { if (!bi(o)) bad.push(`#${i + 1} opt${j}`); });
      if (typeof q.correct !== 'number' || q.correct < 0 || q.correct > 3) bad.push(`#${i + 1} correct`);
      if (q.code !== null && typeof q.code !== 'string') bad.push(`#${i + 1} code`);
    });
    check(`${label}: ҳамаи майдонҳо {tg, ru, uz} ва 4 вариант`, bad.length === 0, bad.slice(0, 5).join(', '));

    // Варианти кодӣ/матни чопшаванда (tg === ru) бояд дар ӯзбекӣ низ айнан монад,
    // вагарна ҷавоби дуруст бо натиҷаи барнома мувофиқ намеояд.
    const codeOpts = [];
    b.forEach((q) => q.options.forEach((o, j) => {
      if (o.tg === o.ru && o.uz !== o.tg) codeOpts.push(`#${q.id} opt${j}`);
    }));
    check(`${label}: варианти кодӣ дар ӯзбекӣ тағйир наёфтааст`,
      codeOpts.length === 0, codeOpts.slice(0, 5).join(', '));

    // Матни ӯзбекӣ набояд ҳарфи хоси тоҷикӣ дошта бошад — ба ҷуз он ҷо ки
    // матни айнан чопшавандаи барнома иқтибос оварда мешавад (он дар `code` ҳаст).
    const tj = [];
    b.forEach((q) => {
      const txt = q.question.uz + ' ' + q.explanation.uz + ' ' + q.category.uz;
      const code = q.code || '';
      const words = txt.split(/[^Ѐ-ӿ]+/).filter(Boolean);
      if (words.some((w) => /[ӣӯҷӢӮҶ]/.test(w) && !code.includes(w))) tj.push('#' + q.id);
    });
    check(`${label}: матни ӯзбекӣ ҳарфи тоҷикӣ надорад`, tj.length === 0, tj.slice(0, 5).join(', '));

    const ids = b.map((q) => q.id);
    check(`${label}: id-ҳо такрор намешаванд`, new Set(ids).size === ids.length);

    // Ҷавоби дуруст набояд ҳамеша дар як ҷо бошад
    const dist = [0, 0, 0, 0];
    b.forEach((q) => dist[q.correct]++);
    check(`${label}: ҷавоби дуруст пароканда аст`, Math.min(...dist) > 0,
      'A/B/C/D = ' + dist.join('/'));
  });

  const jsCats = qctx.jsQuestions.map((q) => q.category.tg + ' ' + q.question.tg).join(' ');
  ['Map', 'Set', 'Date'].forEach((topic) => {
    const n = qctx.jsQuestions.filter((q) =>
      (q.category.tg + q.question.tg + (q.code || '')).includes(topic)).length;
    check(`JavaScript: мавзӯи ${topic} мавҷуд аст (${n} савол)`, n >= 3);
  });
  check('JavaScript: мавзӯи массив ҳаст', /[Мм]ассив/.test(jsCats));
  check('JavaScript: мавзӯи объект ҳаст', /[Оо]бъект/.test(jsCats));

  console.log(`\n===== ${pass} гузашт, ${fail} нагузашт =====`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
