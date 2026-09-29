/**
 * Санҷиши ҷавобҳои C++ бо компилятори воқеӣ.
 * Проверка ответов C++ настоящим компилятором.
 *
 * Чӣ кор мекунад:
 *   1) Ҳар порчаи коди бонкро мегирад ва онро дар контейнери gcc компилятсия мекунад.
 *   2) Барномаҳои компилятсияшударо иҷро карда, натиҷаи чопро мегирад.
 *   3) Натиҷаро бо вариантҳои ҷавоб муқоиса мекунад.
 *   4) Агар натиҷаи воқеӣ ба варианти дигар мувофиқ ояд, на ба он ки
 *      ҳамчун дуруст нишон шудааст — ХАТО эълон мекунад.
 *
 * Истифода / Использование:
 *   node tools/verify-cpp.js            # бонки асосӣ
 *   node tools/verify-cpp.js file.js    # файли дигар (ҳангоми таҳия)
 *
 * Талабот: Docker. Тасвир: gcc:13.
 * Порчаҳое, ки барнома нестанд (масалан `#include <...>`), компилятсия
 * намешаванд — ин хато нест, онҳо саволи назариявӣ мебошанд.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const IMAGE = 'gcc:13';

/* ---------- бор кардани саволҳо ---------- */

function loadBank(file) {
  const mod = require(path.join(ROOT, file));
  const arr = mod.cppQuestions || mod.cppQuestionsPart1 || mod.cppQuestionsPart2
    || (Array.isArray(mod) ? mod : null);
  if (!arr) throw new Error('Бонки савол дар ' + file + ' ёфт нашуд');
  return arr;
}

const files = process.argv.slice(2);
const banks = (files.length ? files : ['questions.js']).map((f) => ({ file: f, qs: loadBank(f) }));

/* ---------- кадом савол «чӣ чоп мекунад?» аст ---------- */

// Диққат: калимаи умумии «вывод» истифода намешавад — он ба ибораи
// «ввода и вывода» мувофиқ омада, саволи назариявиро хато нишон медод.
const OUTPUT_HINTS = [
  'чоп мекунад', 'чоп менамояд', 'барорад', 'мебарорад', 'натиҷаи', 'натиҷа чист',
  'нишон медиҳад', 'чӣ мешавад',
  'выведет', 'напечатает', 'что будет', 'результат'
];

/** Оё ҷавоби дуруст маҳз «хатои компилятор» аст? */
function expectsCompileError(q) {
  const right = q.options[q.correct];
  if (!right) return false;
  return /хато|ошибк/.test((right.tg + ' ' + right.ru).toLowerCase());
}

function isOutputQuestion(q) {
  const text = (q.question.tg + ' ' + q.question.ru).toLowerCase();
  return OUTPUT_HINTS.some((h) => text.includes(h));
}

/* ---------- сохтани барномаи пурра аз порча ---------- */

function wrap(code) {
  if (/\bint\s+main\s*\(/.test(code)) {
    const heads = [];
    if (!code.includes('#include')) {
      heads.push('#include <iostream>', '#include <string>', '#include <cmath>', 'using namespace std;');
    }
    return heads.concat(code).join('\n') + '\n';
  }
  return [
    '#include <iostream>',
    '#include <string>',
    '#include <cmath>',
    '#include <algorithm>',
    'using namespace std;',
    'int main() {',
    code,
    '  return 0;',
    '}',
    ''
  ].join('\n');
}

/* ---------- омода кардани папкаи муваққатӣ ---------- */

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'cppverify-'));
const jobs = [];

banks.forEach((b) => {
  b.qs.forEach((q) => {
    if (!q.code || typeof q.code !== 'string') return;
    const name = `${b.file.replace(/\W/g, '_')}__${q.id}`;
    fs.writeFileSync(path.join(work, name + '.cpp'), wrap(q.code), 'utf8');
    jobs.push({ name, q, file: b.file });
  });
});

if (!jobs.length) {
  console.log('Порчаи код барои санҷиш нест.');
  process.exit(0);
}

/* ---------- як контейнер: ҳамаро компилятсия ва иҷро мекунад ---------- */

const script = `
cd /w
for f in *.cpp; do
  b="\${f%.cpp}"
  echo "@@BEGIN $b"
  if g++ -std=c++17 -w -o "$b.out" "$f" 2> "$b.err"; then
    echo "@@COMPILED"
    timeout 5 "./$b.out" < /dev/null 2>&1 | head -c 2000
    echo ""
    echo "@@EXIT $?"
  else
    echo "@@CXXFAIL"
    head -c 300 "$b.err"
    echo ""
  fi
  echo "@@END $b"
done
`;

console.log(`Компилятсияи ${jobs.length} порчаи код дар ${IMAGE}...\n`);

let raw;
try {
  raw = execFileSync('docker', [
    'run', '--rm', '-i',
    '--network', 'none',
    '-v', `${work}:/w`,
    IMAGE, 'bash', '-s'
  ], { input: script, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 600000 });
} catch (e) {
  console.error('Docker иҷро нашуд:', e.message);
  console.error('Docker кор мекунад? Тасвири ' + IMAGE + ' ҳаст?');
  process.exit(2);
}

/* ---------- таҷзияи натиҷа ---------- */

const results = {};
raw.split('@@BEGIN ').slice(1).forEach((block) => {
  const name = block.split('\n')[0].trim();
  const body = block.slice(block.indexOf('\n') + 1);
  const endAt = body.indexOf('@@END');
  const inner = (endAt >= 0 ? body.slice(0, endAt) : body);

  if (inner.includes('@@CXXFAIL')) {
    results[name] = { ok: false, err: inner.replace('@@CXXFAIL', '').trim() };
  } else {
    let out = inner.replace('@@COMPILED', '');
    out = out.replace(/@@EXIT \d+\s*$/, '');
    results[name] = { ok: true, out: out.replace(/^\n/, '').replace(/\s+$/, '') };
  }
});

/* ---------- муқоиса ---------- */

const norm = (s) => String(s).replace(/\s+/g, ' ').trim().toLowerCase();

let compiled = 0, fragments = 0, checked = 0, mismatched = 0, unmatched = 0;
let compileErrOk = 0, needsInput = 0;
const problems = [];

jobs.forEach(({ name, q, file }) => {
  const r = results[name];
  if (!r) return;

  if (!r.ok) {
    // Баъзе саволҳо маҳз хатои компилятсияро меомӯзонанд (масалан `const`-ро
    // иваз кардан ё номи нодуруст навиштан). Барои онҳо нокомпилятсия
    // ҷавоби ДУРУСТ аст — яъне бонк рост мегӯяд.
    if (expectsCompileError(q)) { compileErrOk++; return; }

    fragments++;
    // Порчаи ғайрибарномавӣ — танҳо вақте муҳим аст, ки савол «чӣ чоп мекунад?» бошад
    if (isOutputQuestion(q)) {
      problems.push({
        kind: 'НОКОМПИЛЯТСИЯ',
        file, id: q.id,
        q: q.question.tg,
        detail: r.err.split('\n')[0]
      });
    }
    return;
  }

  compiled++;

  // Агар ҷавоби дуруст «хатои компилятор» бошад, вале код бе хато
  // компилятсия шавад — ин хатои бонк аст.
  if (expectsCompileError(q)) {
    mismatched++;
    problems.push({
      kind: '⚠️ ҶАВОБИ НОДУРУСТ',
      file, id: q.id,
      q: q.question.tg,
      detail: 'ҳамчун дуруст «хатои компилятор» нишон шудааст, вале код бе хато компилятсия шуд'
    });
    return;
  }

  if (!isOutputQuestion(q)) return;

  // Барнома вуруди корбарро интизор аст — натиҷаро худкор санҷида намешавад.
  if (/\bcin\s*>>|getline\s*\(/.test(q.code) && !r.out) { needsInput++; return; }

  checked++;

  const out = norm(r.out);
  // Муқоиса ду зина дорад: аввал айнан, баъд нарм — вариант метавонад
  // натиҷаро бо шарҳ дошта бошад, масалан натиҷаи «0» ва варианти «0 (false)».
  const opts = q.options.map((o, i) => ({ i, tg: norm(o.tg), ru: norm(o.ru) }));
  const exact = opts.filter((o) => o.tg === out || o.ru === out);
  const loose = opts.filter((o) =>
    [o.tg, o.ru].some((v) => v !== out && v.startsWith(out) && /^[^\p{L}\p{N}]/u.test(v.slice(out.length))));
  const hits = exact.length ? exact : loose;

  if (hits.length === 1) {
    if (hits[0].i !== q.correct) {
      mismatched++;
      problems.push({
        kind: '⚠️ ҶАВОБИ НОДУРУСТ',
        file, id: q.id,
        q: q.question.tg,
        detail: `барнома чоп мекунад «${r.out}» → ин варианти ${hits[0].i}, ` +
                `вале ҳамчун дуруст варианти ${q.correct} («${q.options[q.correct].tg}») нишон шудааст`
      });
    }
  } else if (hits.length === 0) {
    unmatched++;
    problems.push({
      kind: 'муқоиса нашуд',
      file, id: q.id,
      q: q.question.tg,
      detail: `натиҷа «${r.out}» ба ҳеҷ як вариант мувофиқ наомад ` +
              `(вариантҳо: ${q.options.map((o) => o.tg).join(' | ')})`
    });
  }
});

/* ---------- ҳисобот ---------- */

const hard = problems.filter((p) => p.kind.includes('НОДУРУСТ') || p.kind === 'НОКОМПИЛЯТСИЯ');
const soft = problems.filter((p) => !hard.includes(p));

if (problems.length) {
  console.log('─'.repeat(70));
  [...hard, ...soft].forEach((p) => {
    console.log(`\n[${p.kind}] ${p.file} #${p.id}`);
    console.log('  савол: ' + p.q.slice(0, 90));
    console.log('  ' + p.detail);
  });
  console.log('\n' + '─'.repeat(70));
}

console.log(`\nПорчаҳо: ${jobs.length}`);
console.log(`  компилятсия шуд:      ${compiled}`);
console.log(`  порчаи назариявӣ:     ${fragments} (барнома нест — ин хато нест)`);
console.log(`  хатои компилятсия интизор: ${compileErrOk} ✅ тасдиқ шуд`);
console.log(`  вуруди корбар лозим:  ${needsInput} (худкор санҷида намешавад)`);
console.log(`  саволи «чӣ чоп мекунад»: ${checked}`);
console.log(`  ✅ дуруст:            ${checked - mismatched - unmatched}`);
console.log(`  ⚠️  ҷавоби нодуруст:   ${mismatched}`);
console.log(`  ℹ️  муқоиса нашуд:     ${unmatched}`);

try { fs.rmSync(work, { recursive: true, force: true }); } catch (e) {}

process.exit(hard.length ? 1 : 0);
