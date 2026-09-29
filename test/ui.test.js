/**
 * Санҷиши интерфейс: токенҳо, классҳо, дастрасӣ (a11y) ва рафтори рендер.
 * Проверка интерфейса: токены, классы, доступность и поведение рендера.
 *
 * Манбаи ҳақиқат — docs/UI-SPEC.md. Ҳар санҷиш ба як банди он ишора мекунад.
 *
 * Эзоҳ: DOM-и харнес хеле содда аст (test/harness.js) — `querySelectorAll`
 * танҳо `tag` ва `.class`-ро мефаҳмад ва `innerHTML` танҳо сатр аст.
 * Аз ин рӯ ҳар чизе, ки дар он ҷо санҷида намешавад, бар зидди матни
 * манбаъ (статикӣ) санҷида мешавад — дар ҷои худ шарҳ дода шудааст.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { makeRunner } = require('./harness');

const DIR = process.argv[2] || path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
const css = read('style.css');
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
const run = (ctx, code) => vm.runInContext(code, ctx);

/** Класс ҳамчун токени пурра: `.btn` ба `.btn-sm` мувофиқ намеояд. */
const hasClass = (c) => new RegExp('\\.' + c.replace(/[-]/g, '\\-') + '(?![\\w-])').test(css);
/** Токени CSS дар ягон блоки `:root` эълон шудааст. */
const rootBlocks = [...css.matchAll(/:root[^{]*\{([^}]*)\}/g)].map((m) => m[1]).join('\n');
const hasToken = (t) => new RegExp('(^|[^\\w-])' + t + '\\s*:').test(rootBlocks);
/** Теги кушодаи элемент бо id-и додашуда. */
const tagById = (id) => {
  const m = html.match(new RegExp('<[a-zA-Z][^>]*\\bid="' + id + '"[^>]*>'));
  return m ? m[0] : '';
};
const head = (html.match(/<head[\s\S]*?<\/head>/i) || [''])[0];
const countOf = (s, re) => (s.match(re) || []).length;

(async () => {

/* ================================================================== */
section('1. Токенҳои нави §2 дар :root');
/* ================================================================== */

const SPEC_TOKENS = [
  '--bg-0', '--bg-1', '--bg-2', '--bg-3',
  '--line', '--line-strong',
  '--fg', '--fg-muted', '--fg-dim',
  '--brand', '--brand-soft',
  '--ok', '--ok-soft', '--bad', '--bad-soft', '--warn', '--warn-soft',
  '--s1', '--s2', '--s3', '--s4', '--s5', '--s6', '--s7',
  '--r-sm', '--r-md', '--r-lg', '--r-full',
  '--shadow-1', '--shadow-2', '--shadow-3',
  '--t-fast', '--t-base'
];
const missingTokens = SPEC_TOKENS.filter((t) => !hasToken(t));
check('ҳамаи токенҳои §2 дар :root эълон шудаанд',
  missingTokens.length === 0, missingTokens.join(', '));

/* ================================================================== */
section('2. Токенҳои кӯҳна ҳамчун alias нигоҳ дошта шудаанд');
/* ================================================================== */

// Агар яке аз инҳо нест шавад, қоидаҳои кӯҳна хомӯшона мешикананд.
const LEGACY_TOKENS = [
  '--bg-primary', '--bg-secondary', '--card-bg', '--card-border',
  '--accent-cyan', '--accent-indigo', '--accent-purple', '--accent-emerald',
  '--accent-rose', '--accent-amber',
  '--text-main', '--text-muted',
  '--font-sans', '--font-mono',
  '--radius-lg', '--radius-md', '--radius-sm',
  '--shadow-glow', '--transition', '--primary'
];
const missingLegacy = LEGACY_TOKENS.filter((t) => !hasToken(t));
check('ҳамаи токенҳои кӯҳна ҳанӯз эълон шудаанд',
  missingLegacy.length === 0, missingLegacy.join(', '));

// Ҳар токене, ки БЕ қимати эҳтиётӣ хонда мешавад, бояд эълон шуда бошад.
const usedVars = uniq([...(css + html + app).matchAll(/var\(\s*(--[\w-]+)\s*\)/g)].map((m) => m[1]));
const undeclared = usedVars.filter((t) => !hasToken(t));
check('ҳар var(--x)-и бе қимати эҳтиётӣ эълон шудааст',
  undeclared.length === 0, undeclared.join(', '));

/* ================================================================== */
section('3. Классҳои шартномавии §4');
/* ================================================================== */

const CONTRACT_CLASSES = [
  'glass-card', 'btn', 'btn-primary', 'btn-secondary', 'btn-success', 'btn-danger', 'btn-sm',
  'input-field', 'form-group', 'field-hint', 'role-card', 'role-cards',
  'seg-control', 'participants-grid', 'participant-chip', 'participant-avatar',
  'option-btn', 'option-badge', 'options-grid', 'host-options', 'host-option',
  'host-option-bar', 'host-option-count', 'correct-tag',
  'answer-status', 'pending', 'good', 'bad', 'neutral', 'explanation-box',
  'admin-panel', 'panel-title', 'panel-subtitle', 'stat-row', 'stat-tile', 'stat-value',
  'stat-label', 'dist-box', 'dist-row', 'dist-bar', 'monitor-table', 'monitor-wrap',
  'chip', 'ok', 'picked', 'waiting', 'timer-box', 'progress-bar-fill',
  'podium-step', 'ranking-table', 'report-table', 'qdot', 'rank-badge', 'my-result-card',
  'toast', 'toast-stack', 'lang-switch', 'top-tools', 'sound-toggle', 'lock-badge',
  'room-code-badge', 'copy-link-btn', 'conn-state', 'spinner', 'live-dot', 'kick-btn',
  'question-counter', 'category-tag', 'code-block', 'question-title', 'waiting-note'
];
const missingOld = CONTRACT_CLASSES.filter((c) => !hasClass(c));
check('ҳамаи классҳои мавҷудаи §4 дар style.css ҳастанд',
  missingOld.length === 0, missingOld.join(', '));

const NEW_CLASSES = [
  'u-visually-hidden', 'is-urgent', 'is-locked', 'is-top', 'is-alert',
  'skeleton', 'empty-state', 'badge', 'badge-ok', 'badge-bad', 'badge-muted',
  'card-section', 'toolbar'
];
const missingNew = NEW_CLASSES.filter((c) => !hasClass(c));
check('ҳамаи классҳои НАВи §4 дар style.css ҳастанд',
  missingNew.length === 0, missingNew.join(', '));

/* ================================================================== */
section('4. Тандурустии style.css');
/* ================================================================== */

const opens = countOf(css, /\{/g), closes = countOf(css, /\}/g);
check('қавсҳои { } мувозинанд', opens === closes, `{=${opens} }=${closes}`);

// `outline: none` танҳо дар сурате раво аст, ки дар ҳамин наздикӣ
// ивазкунандаи `:focus-visible` навишта шуда бошад (§3).
const badOutline = [];
[...css.matchAll(/outline\s*:\s*(none|0)\s*[;}]/g)].forEach((m) => {
  const win = css.slice(Math.max(0, m.index - 600), m.index + 600);
  if (!/:focus-visible/.test(win)) badOutline.push(css.slice(Math.max(0, m.index - 60), m.index + 20).replace(/\s+/g, ' ').trim());
});
check('`outline:none` бе ивазкунандаи :focus-visible нест',
  badOutline.length === 0, badOutline.slice(0, 3).join(' | '));
check(':focus-visible умуман муайян шудааст', /:focus-visible/.test(css));

check('блоки @media (prefers-reduced-motion: reduce) ҳаст',
  /@media[^{]*prefers-reduced-motion\s*:\s*reduce/.test(css));
check('блоки @media print ҳаст', /@media[^{]*\bprint\b/.test(css));
['480', '768', '1024'].forEach((bp) => check(`нуқтаи канорӣ ${bp}px ҳаст`,
  new RegExp('@media[^{]*' + bp + 'px').test(css)));

/* ================================================================== */
section('5. HTML — сохтор ва дастрасӣ');
/* ================================================================== */

const h1count = countOf(html, /<h1\b/gi);
check('дақиқан як <h1> дар саҳифа ҳаст', h1count === 1, h1count);

const toastTag = tagById('toast-stack');
check('#toast-stack role="status" дорад', /role="status"/.test(toastTag), toastTag);
check('#toast-stack aria-live дорад', /aria-live="/.test(toastTag), toastTag);

const optTag = tagById('options-grid');
check('#options-grid role="group" дорад', /role="group"/.test(optTag), optTag);
check('#options-grid aria-label дорад', /aria-label="/.test(optTag), optTag);

const timerTag = tagById('timer-display');
check('#timer-display aria-live="off" дорад', /aria-live="off"/.test(timerTag), timerTag);

// Ҳар input бояд <label for="..."> дошта бошад (§5).
const inputIds = uniq([...html.matchAll(/<input\b[^>]*\bid="([^"]+)"/g)].map((m) => m[1]));
const labelFor = uniq([...html.matchAll(/<label\b[^>]*\bfor="([^"]+)"/g)].map((m) => m[1]));
const unlabeled = inputIds.filter((id) => !labelFor.includes(id));
check('ҳар <input> label-и худро дорад', unlabeled.length === 0, unlabeled.join(', '));
check('ҳар label="for" ба input-и мавҷуд ишора мекунад',
  labelFor.every((id) => html.includes('id="' + id + '"')),
  labelFor.filter((id) => !html.includes('id="' + id + '"')).join(', '));

// Тугмаҳои танҳо-аломат бояд номи хонданӣ дошта бошанд.
const iconBtns = [tagById('btn-sound-toggle'), ...[...html.matchAll(/<button[^>]*data-lang-btn="[^"]*"[^>]*>/g)].map((m) => m[0])];
const namelessBtns = iconBtns.filter((tag) => !tag || !/(aria-label=|data-i18n-title=)/.test(tag));
check('тугмаҳои танҳо-аломат aria-label ё data-i18n-title доранд',
  namelessBtns.length === 0, namelessBtns.join(' | ') || (iconBtns.length ? '' : 'тугма ёфт нашуд'));
check('тугмаҳои забон ёфт шуданд', iconBtns.length >= 3, iconBtns.length);

/* ================================================================== */
section('6. Тартиб ва defer-и скриптҳо дар <head>');
/* ================================================================== */

const ORDER = ['config.js', 'crypto-auth.js', 'i18n.js', 'questions.js', 'questions-js.js', 'app.js'];
const positions = ORDER.map((f) => head.indexOf('src="' + f + '"'));
check('ҳамаи шаш скрипт дар <head> ҳастанд',
  positions.every((p) => p >= 0), ORDER.filter((_, i) => positions[i] < 0).join(', '));
check('тартиб: config → crypto-auth → i18n → questions → questions-js → app',
  positions.every((p, i) => i === 0 || (p > positions[i - 1] && p >= 0)), positions.join(' < '));
const noDefer = ORDER.filter((f) => {
  const m = head.match(new RegExp('<script[^>]*src="' + f.replace('.', '\\.') + '"[^>]*>'));
  return !m || !/\bdefer\b/.test(m[0]);
});
check('ҳар шаш скрипт defer доранд', noDefer.length === 0, noDefer.join(', '));

/* ================================================================== */
section('7. HTML ⇄ app.js ⇄ i18n');
/* ================================================================== */

const htmlIds = uniq([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
check('ягон id такрор нашудааст',
  htmlIds.length === countOf(html, /\bid="/g),
  `беназир=${htmlIds.length} ҳама=${countOf(html, /\bid="/g)}`);

const usedIds = uniq([...app.matchAll(/\$\(\s*'([^']+)'\s*\)/g)].map((m) => m[1]));
const missIds = usedIds.filter((id) => !htmlIds.includes(id));
check('ҳар id-и дар app.js истифодашаванда дар HTML ҳаст',
  missIds.length === 0, missIds.join(', '));

const htmlKeys = uniq([
  ...[...html.matchAll(/data-i18n="([^"]+)"/g)].map((m) => m[1]),
  ...[...html.matchAll(/data-i18n-ph="([^"]+)"/g)].map((m) => m[1]),
  ...[...html.matchAll(/data-i18n-title="([^"]+)"/g)].map((m) => m[1]),
  ...[...html.matchAll(/data-i18n-aria="([^"]+)"/g)].map((m) => m[1])
]);
const unknownHtml = htmlKeys.filter((k) => !I18N.tg[k]);
check('ҳар калиди data-i18n* дар i18n.js ҳаст', unknownHtml.length === 0, unknownHtml.join(', '));

const appKeys = uniq([...app.matchAll(/\bt\(\s*'([a-z][\w.]*)'/g)].map((m) => m[1]));
const unknownApp = appKeys.filter((k) => !I18N.tg[k]);
check('ҳар калиди t(...)-и app.js дар i18n.js ҳаст', unknownApp.length === 0, unknownApp.join(', '));

/* ================================================================== */
section('8. Рафтори рендер (DOM-и харнес)');
/* ================================================================== */

const { makeCtx } = makeRunner(DIR);

const host = makeCtx('host');
run(host, "$('input-host-pass').value = 'ustod-2026'; createRoom();");
const room = host.__S.roomCode;
check('муаллим ҳуҷра сохт', !!room, room);

const stu = makeCtx('s1', { search: '?room=' + room });
run(stu, `joinRoom('Сомонӣ Муҳаммад', '${room}');`);
run(host, 'hostStartQuiz();');
check('донишҷӯ ба фазаи савол гузашт', stu.__S.phase === 'question', stu.__S.phase);

/* --- 8а. Қулф кардани ҷавоб --- */
const q = host.cppQuestions ? host.cppQuestions[host.__S.order[0]] : null;
const correct = q ? q.correct : 0;
const picked = (correct + 1) % 4;
run(stu, `selectOption(${picked});`);

const optBtns = stu.__root.querySelectorAll('.option-btn');
check('тугмаҳои вариант рендер шудаанд', optBtns.length === 4, optBtns.length);
const chosen = optBtns[picked];
check('тугмаи интихобшуда aria-pressed="true" дорад',
  !!chosen && chosen.getAttribute('aria-pressed') === 'true',
  chosen && chosen.getAttribute('aria-pressed'));
check('тугмаи интихобшуда класси is-locked дорад',
  !!chosen && chosen.classList.contains('is-locked'),
  chosen && chosen.className);
check('тугмаҳои дигар aria-pressed="false" доранд',
  optBtns.every((b, i) => i === picked || b.getAttribute('aria-pressed') === 'false'),
  optBtns.map((b) => b.getAttribute('aria-pressed')).join(','));

// Пеш аз REVEAL ҳеҷ тугма дурустиро ошкор намекунад.
const REVEALERS = ['correct', 'is-correct', 'wrong', 'is-wrong', 'good', 'bad'];
const leaked = optBtns.filter((b) => REVEALERS.some((c) => b.classList.contains(c)));
check('пеш аз REVEAL ҳеҷ тугма дурустиро ошкор намекунад',
  leaked.length === 0, leaked.map((b) => b.className).join(' | '));
check('гриди вариантҳо нишонаи дурустӣ надорад',
  !/correct-tag|is-correct/.test(run(stu, "$('options-grid').innerHTML")));

/* --- 8б. timer-box.is-urgent --- */
// Сар: ~20 сония — набояд is-urgent бошад.
check('timer-box дар оғози саволи 20-сония is-urgent надорад',
  !run(stu, "$('timer-box').classList.contains('is-urgent')"));
// ≤6 сония — бояд is-urgent пайдо шавад (§4: «вақт < 6 сония»).
run(stu, "S.endsAt = Date.now() + 5200; startCountdown(function(){});");
check('timer-box дар ≤6 сония is-urgent мегирад',
  run(stu, "$('timer-box').classList.contains('is-urgent')"),
  run(stu, "$('timer-box').className"));
run(stu, 'clearInterval(S.tick);');
// Ҳадди остона дар манбаъ: 5 ё 6 (spec «< 6 сония»).
check('остонаи is-urgent дар app.js 5 ё 6 аст',
  /left\s*<=\s*[56]/.test(app), (app.match(/left\s*<=\s*\d+/) || ['—'])[0]);

/* --- 8в. host-option.is-top --- */
// innerHTML дар харнес танҳо сатр аст — is-top-ро дар матни рендершуда мешуморем.
const hostHtml = run(host, `renderHostOptions(Q(S.order[S.qPos]), false); $('host-options').innerHTML`);
check('муаллим 4 варианти host-option мебинад',
  countOf(hostHtml, /class="[^"]*host-option[ "]/g) === 4,
  countOf(hostHtml, /class="[^"]*host-option[ "]/g));
check('дақиқан як host-option.is-top ҳаст (овозҳо мавҷуданд)',
  countOf(hostHtml, /is-top(?![\w-])/g) === 1, countOf(hostHtml, /is-top(?![\w-])/g));

/* --- 8г. Маҳдудияти toast --- */
// DOM-и харнес селектори `:not(...)`-ро намефаҳмад, вале худи маҳдудкунанда
// дар браузер маҳз бо ҳамин селектор кор мекунад. Барои он ки санҷиш
// маҳдудкунандаро санҷад (на камбудии харнесро), ба ҳамин як элемент
// дастгирии `.a` ва `.a:not(.b)`-ро дохил мекунем.
run(stu, String.raw`
  var st = $('toast-stack');
  st.querySelectorAll = function (sel) {
    var m = String(sel).match(/^\.([\w-]+)(?::not\(\.([\w-]+)\))?$/);
    if (!m) return [];
    return st.children.filter(function (c) {
      return c.classList.contains(m[1]) && !(m[2] && c.classList.contains(m[2]));
    });
  };
`);
const toastCount = run(stu, "for (var i=0;i<50;i++) toast('t'+i,'info'); $('toast-stack').children.filter(function(c){return !c.classList.contains('out');}).length");
check('пас аз 50 toast беш аз 3 намоён намемонад', toastCount <= 3, toastCount);
// Статикӣ: маҳдудият дар худи манбаи toast() навишта шудааст.
check('toast() маҳдудияти стекро дорад (статикӣ)',
  /function toast[\s\S]{0,800}?MAX_TOASTS|function toast[\s\S]{0,800}?length\s*-\s*\d/.test(app));

/* --- 8ғ. Тугмаҳои забон: aria-pressed бояд ҳамроҳи забон нав шавад --- */
// DOM-и харнес селектори атрибутӣ `[data-lang-btn]`-ро намефаҳмад, бинобар ин
// ду тугмаи воқеиро месозем ва танҳо ҳамин як селекторро ҷавобгӯ мекунем.
run(stu, String.raw`
  var _lb = ['tg', 'ru'].map(function (code) {
    var b = document.createElement('button');
    b.setAttribute('data-lang-btn', code);
    b.setAttribute('aria-pressed', code === 'tg' ? 'true' : 'false');
    return b;
  });
  globalThis.__lb = _lb;
  var _qsa = document.querySelectorAll;
  document.querySelectorAll = function (sel) {
    return sel === '[data-lang-btn]' ? _lb : _qsa.call(document, sel);
  };
`);
run(stu, "setLang('ru');");
check('баъди иваз кардани забон тугмаи РУ aria-pressed="true" мегирад',
  run(stu, "__lb[1].getAttribute('aria-pressed')") === 'true',
  run(stu, "__lb[1].getAttribute('aria-pressed')"));
check('баъди иваз кардани забон тугмаи ТҶ aria-pressed="false" мегирад',
  run(stu, "__lb[0].getAttribute('aria-pressed')") === 'false',
  run(stu, "__lb[0].getAttribute('aria-pressed')"));
check('класси active низ ҳамроҳи ARIA нав мешавад',
  run(stu, "__lb[1].classList.contains('active') && !__lb[0].classList.contains('active')"));
run(stu, "setLang('tg');");
check('бозгашт ба тоҷикӣ ҳолати ARIA-ро дуруст бармегардонад',
  run(stu, "__lb[0].getAttribute('aria-pressed')") === 'true' &&
  run(stu, "__lb[1].getAttribute('aria-pressed')") === 'false');
// HTML бояд ҳолати ибтидоиро низ дуруст дошта бошад.
const langBtnTags = [...html.matchAll(/<button[^>]*data-lang-btn="[^"]*"[^>]*>/g)].map((m) => m[0]);
check('тугмаҳои забон дар HTML aria-pressed-и ибтидоӣ доранд',
  langBtnTags.length >= 2 && langBtnTags.every((tg) => /aria-pressed="(true|false)"/.test(tg)),
  langBtnTags.join(' | '));

/* --- 8д. Номи донишҷӯ escape мешавад --- */
const EVIL = '<img src=x onerror=alert(1)>';
const host2 = makeCtx('host2');
run(host2, "$('input-host-pass').value = 'ustod-2026'; createRoom();");
const room2 = host2.__S.roomCode;
const evil = makeCtx('evil', { search: '?room=' + room2 });
run(evil, `joinRoom(${JSON.stringify(EVIL)}, '${room2}');`);
check('донишҷӯи «бад» ба муаллим расид', host2.__S.participants.length === 1, host2.__S.participants.length);

run(host2, 'hostStartQuiz();');
run(evil, 'selectOption(0);');
run(host2, 'updateParticipantsUI(); updateAdminPanel(); hostReveal();');
run(host2, 'hostEndQuiz();');

const collect = (el, out) => {
  if (el.innerHTML) out.push(el.innerHTML);
  el.children.forEach((c) => collect(c, out));
  return out;
};
const allHtml = collect(host2.__root, []).concat(collect(evil.__root, [])).join('\n');
check('ном дар рендер escape шудааст (ягон <img хом нест)',
  !/<img/i.test(allHtml), (allHtml.match(/.{0,50}<img.{0,50}/i) || [''])[0]);
check('номи бад воқеан ба рендер расидааст (санҷиш бемаъно нест)',
  /&lt;img/i.test(allHtml));
// Эзоҳ: `onerror=` ҳамчун МАТНИ escape-шуда мемонад ва безарар аст —
// аз ин рӯ мо мавҷудияти сатри хоми ҳамлаварро месанҷем, на калимаи онро.
check('сатри хоми ҳамлавар дар ягон рендер нест', !allHtml.includes(EVIL));

console.log(`\n===== ${pass} гузашт, ${fail} нагузашт =====`);
process.exit(fail ? 1 : 0);

})().catch((e) => { console.error(e); process.exit(1); });
