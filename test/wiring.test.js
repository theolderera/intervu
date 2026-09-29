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
// `uzl` (ўзбекча лотин) луғати худро надорад — аз `uz` ҳосил мешавад.
const DICTS = ['ru', 'uz'];

DICTS.forEach((lang) => {
  const keys = Object.keys(I18N[lang] || {});
  check(`${lang}: шумораи калид бо тоҷикӣ баробар аст`,
    keys.length === tgKeys.length, `tg=${tgKeys.length} ${lang}=${keys.length}`);

  const missing = tgKeys.filter((k) => !I18N[lang][k]);
  check(`${lang}: ҳар калиди тоҷикӣ тарҷума дорад`, missing.length === 0, missing.join(', '));

  const extra = keys.filter((k) => !I18N.tg[k]);
  check(`${lang}: калиди изофӣ нест`, extra.length === 0, extra.join(', '));
});

const emptyVals = tgKeys.filter((k) =>
  !String(I18N.tg[k]).trim() || DICTS.some((l) => !String(I18N[l][k]).trim()));
check('ҳеҷ тарҷумаи холӣ нест', emptyVals.length === 0, emptyVals.join(', '));

// Тарҷума набояд айнан нусхаи тоҷикӣ бошад.
// Баъзе калимаҳо дар ҳамаи забонҳо айнан якхелаанд — ин хато нест.
const sameAllowed = {
  ru: new Set(['unit.sec', 'stat.online']),
  uz: new Set(['unit.sec', 'stat.online', 'settings.subject', 'csv.q', 'title.sound'])
};
DICTS.forEach((lang) => {
  const identical = tgKeys.filter((k) => !sameAllowed[lang].has(k) && I18N.tg[k] === I18N[lang][k]);
  check(`${lang}: матн нусхаи тоҷикӣ нест`, identical.length === 0, identical.join(', '));
});

// Ҷойгузорҳо ({n}, {p}...) бояд дар ҳамаи забонҳо якхела бошанд
const ph = (s) => uniq([...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1])).sort().join(',');
DICTS.forEach((lang) => {
  const badPh = tgKeys.filter((k) => ph(I18N.tg[k]) !== ph(I18N[lang][k]));
  check(`${lang}: ҷойгузорҳо ({n}, {p}) мувофиқанд`, badPh.length === 0, badPh.join(', '));
});

// Тегҳои HTML (<strong>, <b>) бояд дар ҳамаи забонҳо боқӣ монанд
const tags = (s) => (String(s).match(/<\/?[a-z]+>/g) || []).sort().join('');
DICTS.forEach((lang) => {
  const badTags = tgKeys.filter((k) => tags(I18N.tg[k]) !== tags(I18N[lang][k]));
  check(`${lang}: тегҳои HTML нигоҳ дошта шудаанд`, badTags.length === 0, badTags.join(', '));
});

section('2б. Лотини ӯзбекӣ (худкор аз кирилл)');

const { toUzLatin } = require(path.join(DIR, 'uz-latin.js'));

check('транслитератсия ў → oʻ', toUzLatin('Ўзбек') === 'Oʻzbek', toUzLatin('Ўзбек'));
check('транслитератсия ғ → gʻ', toUzLatin('тўғри') === 'toʻgʻri', toUzLatin('тўғри'));
check('транслитератсия қ → q, ҳ → h', toUzLatin('қаҳрамон') === 'qahramon', toUzLatin('қаҳрамон'));
check('ҳарфи дуҳарфа дар ҲАРФИ КАЛОН', toUzLatin('БОШЛАШ') === 'BOSHLASH', toUzLatin('БОШЛАШ'));
check('ъ → ʼ', toUzLatin('эълон') === 'eʼlon', toUzLatin('эълон'));
check('е дар аввали калима → ye', toUzLatin('Ер') === 'Yer', toUzLatin('Ер'));

// Матни ғайрикириллӣ — код, ҷойгузор, тег, эмодзи — бетағйир мемонад
check('код бетағйир мемонад', toUzLatin('cout << x;') === 'cout << x;');
check('ҷойгузорҳо бетағйир мемонанд',
  toUzLatin('{n} тадан {t}') === '{n} tadan {t}', toUzLatin('{n} тадан {t}'));
check('тегҳо ва эмодзи бетағйир мемонанд',
  toUzLatin('⚙️ <b>Созламалар</b>') === '⚙️ <b>Sozlamalar</b>', toUzLatin('⚙️ <b>Созламалар</b>'));

// Ҳар сатри ӯзбекӣ пас аз табдил бояд бе ҳарфи кириллӣ монад
const leftover = tgKeys.filter((k) => /[Ѐ-ӿ]/.test(toUzLatin(I18N.uz[k])));
check('пас аз табдил ҳарфи кириллӣ намемонад', leftover.length === 0, leftover.slice(0, 5).join(', '));

// Ҳеҷ сатри ӯзбекӣ набояд ҳарфи хоси тоҷикӣ дошта бошад (ӣ ӯ ҷ)
const tjLetters = tgKeys.filter((k) => /[ӣӮӯҶҷӢ]/.test(I18N.uz[k]));
check('матни ӯзбекӣ ҳарфи хоси тоҷикӣ надорад', tjLetters.length === 0, tjLetters.join(', '));

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
