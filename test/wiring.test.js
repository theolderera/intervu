/**
 * Санҷиши васлшавӣ: HTML ⇄ JS ⇄ i18n.
 * Проверка связности: HTML ⇄ JS ⇄ i18n.
 *
 * Ин тест хатоҳои «ҳарфӣ»-ро мегирад, ки мантиқ онҳоро намебинад:
 * калиди тарҷумаи набуда, id-и элементи нест, скрипти пайваст нашуда.
 */
const fs = require('fs');
const path = require('path');

const DIR = process.argv[2] || path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
const html = read('index.html');
const app = read('app.js');
const { I18N } = require(path.join(DIR, 'i18n.js'));

let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log('  ✅ ' + name); }
  else { fail++; console.log('  ❌ ' + name + (extra !== undefined ? '  → ' + extra : '')); }
}
const section = (s) => console.log('\n--- ' + s + ' ---');
const uniq = (a) => [...new Set(a)];
const matches = (src, re) => uniq([...src.matchAll(re)].map((m) => m[1]));

section('1. Скриптҳо ва сохтори саҳифа');

['config.js', 'crypto-auth.js', 'i18n.js', 'questions.js', 'questions-js.js', 'app.js']
  .forEach((f) => check(`${f} ба index.html пайваст аст`, html.includes(`src="${f}"`)));

check('ҳамаи файлҳои скрипт воқеан мавҷуданд',
  ['config.js', 'crypto-auth.js', 'i18n.js', 'questions.js', 'questions-js.js', 'app.js', 'style.css']
    .every((f) => fs.existsSync(path.join(DIR, f))));
check('style.css пайваст аст', html.includes('style.css'));
check('тартиб дуруст аст: config пеш аз app',
  html.indexOf('config.js') < html.indexOf('app.js'));
check('тартиб дуруст аст: i18n пеш аз app',
  html.indexOf('i18n.js') < html.indexOf('app.js'));

section('2. Калидҳои тарҷума');

const tgKeys = Object.keys(I18N.tg);
const ruKeys = Object.keys(I18N.ru);
check('тоҷикӣ ва русӣ шумораи баробари калид доранд',
  tgKeys.length === ruKeys.length, `tg=${tgKeys.length} ru=${ruKeys.length}`);

const missingRu = tgKeys.filter((k) => !I18N.ru[k]);
check('ҳар калиди тоҷикӣ тарҷумаи русӣ дорад', missingRu.length === 0, missingRu.join(', '));
const extraRu = ruKeys.filter((k) => !I18N.tg[k]);
check('калиди изофии русӣ нест', extraRu.length === 0, extraRu.join(', '));

const emptyVals = tgKeys.filter((k) => !String(I18N.tg[k]).trim() || !String(I18N.ru[k]).trim());
check('ҳеҷ тарҷумаи холӣ нест', emptyVals.length === 0, emptyVals.join(', '));

// Тарҷумаи русӣ набояд айнан нусхаи тоҷикӣ бошад (ғайр аз чанд ҳолати табиӣ)
// Баъзе калимаҳо дар ҳар ду забон айнан якхелаанд — ин хато нест.
const sameAllowed = new Set(['unit.sec', 'stat.online']);
const identical = tgKeys.filter((k) => !sameAllowed.has(k) && I18N.tg[k] === I18N.ru[k]);
check('матни русӣ нусхаи тоҷикӣ нест', identical.length === 0, identical.join(', '));

// Ҷойгузорҳо ({n}, {p}...) бояд дар ҳар ду забон якхела бошанд
const ph = (s) => uniq([...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1])).sort().join(',');
const badPh = tgKeys.filter((k) => ph(I18N.tg[k]) !== ph(I18N.ru[k]));
check('ҷойгузорҳо ({n}, {p}) дар ҳар ду забон мувофиқанд', badPh.length === 0, badPh.join(', '));

section('3. data-i18n дар HTML');

const htmlKeys = uniq([
  ...matches(html, /data-i18n="([^"]+)"/g),
  ...matches(html, /data-i18n-ph="([^"]+)"/g),
  ...matches(html, /data-i18n-title="([^"]+)"/g)
]);
check('HTML калидҳои i18n дорад', htmlKeys.length > 30, htmlKeys.length);
const unknownHtml = htmlKeys.filter((k) => !I18N.tg[k]);
check('ҳар калиди HTML дар i18n.js мавҷуд аст', unknownHtml.length === 0, unknownHtml.join(', '));

section('4. Калидҳои t(...) дар app.js');

const appKeys = matches(app, /\bt\(\s*'([a-z][\w.]*)'/g);
check('app.js калидҳои i18n истифода мебарад', appKeys.length > 30, appKeys.length);
const unknownApp = appKeys.filter((k) => !I18N.tg[k]);
check('ҳар калиди app.js дар i18n.js мавҷуд аст', unknownApp.length === 0, unknownApp.join(', '));

section('5. Элементҳои $(...) дар app.js');

const htmlIds = uniq(matches(html, /\bid="([^"]+)"/g));
const usedIds = matches(app, /\$\(\s*'([^']+)'\s*\)/g);
const missingIds = usedIds.filter((id) => !htmlIds.includes(id));
check('ҳар элементи дар app.js истифодашаванда дар HTML ҳаст',
  missingIds.length === 0, missingIds.join(', '));

['input-host-pass', 'seg-subject', 'lang-switch', 'btn-create-room', 'btn-start-game']
  .forEach((id) => check(`элементи нав #${id} дар HTML ҳаст`, htmlIds.includes(id)));

section('6. Матни сахт (hardcoded) дар app.js');

// Сатрҳои интерфейс бояд аз i18n гиранд, на дар код сахт навишта шаванд.
const codeNoComments = app
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')
  // паёмҳои console.* барои барномасоз доранд, на барои корбар
  .replace(/console\.\w+\([^)]*\)/g, '');
const cyrillicLiterals = uniq([
  ...[...codeNoComments.matchAll(/'([^'\n]*[А-Яа-яЁёӢӣӮӯҚқҒғҲҳҶҷ][^'\n]*)'/g)].map((m) => m[1]),
  ...[...codeNoComments.matchAll(/"([^"\n]*[А-Яа-яЁёӢӣӮӯҚқҒғҲҳҶҷ][^"\n]*)"/g)].map((m) => m[1])
]).filter((s) => s.trim().length > 2);
check('дар мантиқи app.js матни интерфейси сахт намондааст',
  cyrillicLiterals.length === 0, cyrillicLiterals.slice(0, 6).join(' | '));

section('7. Муҳофизат дар код');

check('пароли кушод дар ҳеҷ файл нест',
  !app.includes('ustod-2026') && !read('config.js').match(/adminPass\s*:\s*'ustod/));
check('линк калиди кушодро пас аз # мебарад', app.includes('#k=${S.keys.pub}'));
check('createRoom дарвозаи паролро дорад', /function createRoom[\s\S]{0,400}adminGateOk/.test(app));
check('createRoom меҳмони линкро рад мекунад',
  /function createRoom[\s\S]{0,300}S\.lockedToStudent/.test(app));
check('паёмҳо пеш аз коркард тафтиш мешаванд', app.includes('authorize(msg)'));
check('кеш пас аз анҷоми бозӣ пок мешавад',
  /function studentOnEnd[\s\S]{0,400}clearQuizStorage/.test(app));

console.log(`\n===== ${pass} гузашт, ${fail} нагузашт =====`);
process.exit(fail ? 1 : 0);
