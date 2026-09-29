/* Санҷиши мантиқи протокол бе браузер: DOM-и сохта + ду контексти vm */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const DIR = process.argv[2] || path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
const configSrc = read('config.js');
const authSrc = read('crypto-auth.js');
const i18nSrc = read('i18n.js');
const questionsSrc = read('questions.js');
const questionsJsSrc = read('questions-js.js');
const appSrc = read('app.js');

// ---------- DOM-и минималӣ ----------
function makeDom() {
  class El {
    constructor(tag) {
      this.tagName = (tag || 'div').toUpperCase();
      this.children = [];
      this.parent = null;
      this._cls = new Set();
      this.dataset = {};
      this.style = {};
      this._html = '';
      this.textContent = '';
      this.value = '';
      this.disabled = false;
      this._handlers = {};
      const self = this;
      this.classList = {
        add: (...c) => c.forEach((x) => self._cls.add(x)),
        remove: (...c) => c.forEach((x) => self._cls.delete(x)),
        contains: (c) => self._cls.has(c),
        toggle: (c, force) => {
          const on = force === undefined ? !self._cls.has(c) : !!force;
          if (on) self._cls.add(c); else self._cls.delete(c);
          return on;
        }
      };
    }
    get className() { return [...this._cls].join(' '); }
    set className(v) { this._cls = new Set(String(v).split(/\s+/).filter(Boolean)); }
    get innerHTML() { return this._html; }
    set innerHTML(v) { this._html = String(v); this.children.forEach((c) => (c.parent = null)); this.children = []; }
    appendChild(c) { c.parent = this; this.children.push(c); return c; }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter((x) => x !== this); }
    addEventListener(ev, fn) { (this._handlers[ev] = this._handlers[ev] || []).push(fn); }
    click() { (this._handlers.click || []).forEach((f) => f({ target: this, preventDefault() {} })); }
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
    querySelectorAll(sel) {
      const out = [];
      const want = sel.replace(/^\./, '');
      const isClass = sel.startsWith('.');
      const walk = (n) => n.children.forEach((c) => {
        if (isClass ? c._cls.has(want) : c.tagName === sel.toUpperCase()) out.push(c);
        walk(c);
      });
      walk(this);
      return out;
    }
    closest() { return null; }
    getContext() { return new Proxy({}, { get: () => () => {}, set: () => true }); }
  }

  const root = new El('root');
  const byId = new Map();
  const document = {
    getElementById(id) {
      if (!byId.has(id)) { const e = new El('div'); e.id = id; byId.set(id, e); root.appendChild(e); }
      return byId.get(id);
    },
    createElement: (t) => new El(t),
    querySelector: (s) => root.querySelector(s),
    querySelectorAll: (s) => root.querySelectorAll(s),
    addEventListener() {},
    body: new El('body')
  };
  return { document, El, root };
}

// ---------- Шинаи BroadcastChannel байни контекстҳо ----------
const bus = [];
function makeCtx(label) {
  const { document, root } = makeDom();
  const store = {};
  const stg = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };

  class FakeBC {
    constructor(name) { this.name = name; this.onmessage = null; bus.push(this); }
    postMessage(msg) {
      const copy = JSON.parse(JSON.stringify(msg));
      bus.forEach((c) => { if (c !== this && c.name === this.name && c.onmessage) c.onmessage({ data: copy }); });
    }
  }

  const sandbox = {
    console: { log() {}, warn() {}, error: console.error },
    document,
    localStorage: stg,
    sessionStorage: stg,
    BroadcastChannel: FakeBC,
    URLSearchParams,
    setTimeout, clearTimeout, setInterval, clearInterval,
    requestAnimationFrame: () => 0,
    Math, Date, JSON, Set, Map, Array, Object, String, Number, Blob: function () {}, URL: { createObjectURL: () => '', revokeObjectURL() {} },
    alert() {}, confirm: () => true, prompt: () => '',
    navigator: {},
    TextEncoder, TextDecoder,
    Uint8Array, Uint32Array, DataView, ArrayBuffer, Promise, Buffer,
    btoa: (b) => Buffer.from(b, 'binary').toString('base64'),
    atob: (b) => Buffer.from(b, 'base64').toString('binary'),
    // Диққат: `crypto` дар ин контекст дода НАМЕШАВАД.
    // Бе `crypto.subtle` имзо хомӯш мемонад ва send() синхронӣ кор мекунад —
    // ин ба мо имкон медиҳад, ки мантиқи протоколро бидуни await санҷем.
    // Худи имзо дар test/security.test.js санҷида мешавад.
    __label: label,
    __root: root
  };
  sandbox.window = sandbox;
  sandbox.window.location = { origin: 'http://localhost:8080', pathname: '/index.html', search: '', hash: '', href: 'http://localhost:8080/index.html' };
  sandbox.window.history = { replaceState() {}, pushState() {} };
  sandbox.window.addEventListener = () => {};
  sandbox.window.scrollTo = () => {};

  const ctx = vm.createContext(sandbox);
  vm.runInContext(configSrc, ctx);
  vm.runInContext(authSrc, ctx);
  vm.runInContext(i18nSrc, ctx);
  vm.runInContext(questionsSrc, ctx);
  vm.runInContext(questionsJsSrc, ctx);
  vm.runInContext(appSrc, ctx);
  vm.runInContext('initUI(); checkUrlParams(); globalThis.__S = S; globalThis.__Q = cppQuestions;', ctx);
  return ctx;
}

// ---------- Санҷишҳо ----------
let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; console.log('  ❌ ' + name + (extra ? '  → ' + extra : '')); }
}

const host = makeCtx('host');
const s1 = makeCtx('s1');
const s2 = makeCtx('s2');

console.log('\n--- 1. Муаллим ҳуҷра месозад ---');
host.document.getElementById('input-host-name').value = 'Устод Алиев';
vm.runInContext("$('input-host-pass').value = 'ustod-2026'; createRoom();", host);
const room = host.__S.roomCode;
check('коди ҳуҷра сохта шуд', /^CPP-[A-Z0-9]{4}$/.test(room), room);
check('муаллим ба рӯйхати иштирокчиён дохил НАШУД', host.__S.participants.length === 0);
check('панели танзимот кушода аст', !host.document.getElementById('host-settings')._cls.has('hidden'));

console.log('\n--- 2. Донишҷӯён бо линк ворид мешаванд ---');
[s1, s2].forEach((c, i) => {
  c.window.location.search = '?room=' + room;
  c.window.location.href = 'http://localhost:8080/index.html?room=' + room;
  vm.runInContext('checkUrlParams();', c);
});
check('нақш ба донишҷӯ қулф шуд (s1)', s1.__S.lockedToStudent === true && s1.__S.role === 'student');
check('интихоби нақш пинҳон аст (s1)', s1.document.getElementById('role-picker')._cls.has('hidden'));
check('формаи вуруд бо линк кушода аст (s1)', !s1.document.getElementById('join-by-link')._cls.has('hidden'));
vm.runInContext("selectRole('host');", s1);
check('донишҷӯ муаллим шуда НАМЕТАВОНАД', s1.__S.role === 'student');

vm.runInContext(`joinRoom('Сомонӣ Муҳаммад', '${room}');`, s1);
vm.runInContext(`joinRoom('Наргис Раҳимова', '${room}');`, s2);
check('муаллим 2 донишҷӯро мебинад', host.__S.participants.length === 2,
  JSON.stringify(host.__S.participants.map((p) => p.name)));
// Дар синфи калон муаллим снапшотҳоро ~700 мс ҷамъ мекунад (scheduleSnapshot),
// то 50 вуруди ҳамзамон каналро банд накунад. Дар ин тести синхронӣ онро
// дастӣ холӣ мекунем; худи таъхир дар test/scale.test.js санҷида мешавад.
vm.runInContext('sendStateSnapshot();', host);
check('донишҷӯ рӯйхатро гирифт', s1.__S.participants.length === 2);

// Регрессия: ҳалқаи барқарорсозӣ набояд баъди вуруди муваффақ пӯшида шавад
check('ҳалқаи барқарорсозии пайваст фаъол мемонад', s1.__S.joinRetry !== null && s1.__S.joinRetry !== undefined);
check('TURN дар танзимоти ICE ҳаст',
  JSON.stringify(vm.runInContext('ICE_CONFIG', s1)).includes('turn:'));

console.log('\n--- 3. Оғози бозӣ ---');
host.__S.settings.duration = 20;
host.__S.settings.count = 3;
vm.runInContext('hostStartQuiz();', host);
check('муаллим дар ҳолати savol аст', host.__S.phase === 'question');
check('панели админ кушода аст', !host.document.getElementById('admin-panel')._cls.has('hidden'));
check('донишҷӯ саволро гирифт', s1.__S.phase === 'question' && s1.__S.qPos === 0);
check('донишҷӯ 4 вариант дорад', s1.document.querySelectorAll('.option-btn').length === 4);
check('муаллим ҷавоби дурустро мебинад', host.document.getElementById('host-options').innerHTML.includes('ҶАВОБИ ДУРУСТ'));

console.log('\n--- 4. Донишҷӯ ҷавоб медиҳад — дурустӣ НАБОЯД нишон дода шавад ---');
const q0 = host.__Q[host.__S.order[0]];
vm.runInContext(`selectOption(${q0.correct});`, s1);       // дуруст
vm.runInContext(`selectOption(${(q0.correct + 1) % 4});`, s2); // нодуруст

const opts1 = s1.document.querySelectorAll('.option-btn');
check('ҳеҷ тугма "correct" нашуд', opts1.every((b) => !b._cls.has('correct')));
check('ҳеҷ тугма "incorrect" нашуд', opts1.every((b) => !b._cls.has('incorrect')));
check('тугмаҳо қулф шуданд', opts1.every((b) => b.disabled === true));
const st1 = s1.document.getElementById('answer-status');
check('ҳолат = "pending"', st1._cls.has('pending'), st1.className);
check('матн дурустиро ошкор намекунад',
  !/дуруст аст|нодуруст/.test(st1.innerHTML) && st1.innerHTML.includes('қабул шуд'));
check('шарҳ ҳанӯз пинҳон аст', s1.document.getElementById('explanation-box')._cls.has('hidden'));

console.log('\n--- 5. Муаллим ҳама чизро дар вақти воқеӣ мебинад ---');
check('ҳар ду ҷавоб ба муаллим расид', host.__S.answeredIds.length === 2, JSON.stringify(host.__S.answeredIds));
const mon = host.document.getElementById('monitor-body').innerHTML;
check('ҷадвали назорат интихоби донишҷӯёнро нишон медиҳад', /chip picked/.test(mon));
check('назорат дурустиро ҳанӯз ошкор намекунад', !/chip ok|chip bad/.test(mon));

console.log('\n--- 6. Кушодани ҷавоб (REVEAL) ---');
vm.runInContext('hostReveal();', host);
check('муаллим дар ҳолати reveal', host.__S.phase === 'reveal');
check('донишҷӯ низ reveal гирифт', s1.__S.phase === 'reveal');
const opts1b = s1.document.querySelectorAll('.option-btn');
check('ҷавоби дуруст ҳоло сабз аст', opts1b[q0.correct]._cls.has('correct'));
check('s1 (дуруст) — ҳолати good', s1.document.getElementById('answer-status')._cls.has('good'));
check('s2 (нодуруст) — ҳолати bad', s2.document.getElementById('answer-status')._cls.has('bad'));
check('s2 варианти худро сурх мебинад',
  s2.document.querySelectorAll('.option-btn')[(q0.correct + 1) % 4]._cls.has('incorrect'));
check('шарҳ кушода шуд', !s1.document.getElementById('explanation-box')._cls.has('hidden'));

const p1 = host.__S.participants.find((p) => p.name === 'Сомонӣ Муҳаммад');
const p2 = host.__S.participants.find((p) => p.name === 'Наргис Раҳимова');
check('донишҷӯи дуруст бал гирифт (600..1000+)', p1.score >= 600 && p1.score <= 1250, 'score=' + p1.score);
check('донишҷӯи нодуруст 0 бал', p2.score === 0);
check('назорат ҳоло ✓/✕ нишон медиҳад', /chip ok/.test(host.document.getElementById('monitor-body').innerHTML));

console.log('\n--- 7. Саволи навбатӣ ва анҷом ---');
vm.runInContext('hostNext();', host);
check('савол 2 оғоз шуд', host.__S.qPos === 1 && host.__S.phase === 'question');
check('донишҷӯ синхрон шуд', s1.__S.qPos === 1 && s1.__S.myAnswer === null);
check('тугмаҳои нав фаъоланд', s1.document.querySelectorAll('.option-btn').every((b) => !b.disabled));

vm.runInContext('hostReveal(); hostNext(); hostReveal(); hostNext();', host);
check('бозӣ анҷом ёфт', host.__S.phase === 'ended');
check('донишҷӯ ҷадвали рейтингро гирифт', s1.__S.phase === 'ended');
check('рейтинг мураттаб аст', host.__S.standings[0].score >= host.__S.standings[1].score);
check('ҳисоботи муаллим сохта шуд', host.document.getElementById('report-body').innerHTML.includes('qdot'));
check('донишҷӯ ҳисоботи муаллимро НАМЕБИНАД', s1.document.getElementById('host-report')._cls.has('hidden'));
check('донишҷӯ корти натиҷаи худро мебинад', !s1.document.getElementById('my-result-card')._cls.has('hidden'));

console.log('\n--- 8. Хориҷ кардани донишҷӯ ---');
vm.runInContext(`hostKick('${p2.id}');`, host);
check('донишҷӯ аз рӯйхат хориҷ шуд', !host.__S.participants.some((p) => p.id === p2.id));

console.log(`\n===== ${pass} гузашт, ${fail} нагузашт =====`);
process.exit(fail ? 1 : 0);
