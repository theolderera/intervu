/**
 * Санҷиши синфи калон, муҳофизат дар амал ва тозагии кеш.
 * Проверка большого класса, защиты в действии и очистки кэша.
 *
 * 1) 50 донишҷӯ: вуруд, ҷавоб, баҳо, рейтинг — бе гум шудани касе.
 * 2) Имзо дар ҷараёни воқеӣ: «муаллими қалбакӣ» бозиро идора карда наметавонад.
 * 3) Кеш: пас аз бозӣ ному ID-и донишҷӯ дар дастгоҳ намемонад.
 * 4) Забон: тоҷикӣ ⇄ русӣ бе кандашавии бозӣ.
 */
const path = require('path');
const vm = require('vm');
const { makeRunner, sleep } = require('./harness');

const DIR = process.argv[2] || path.join(__dirname, '..');
const { makeCtx } = makeRunner(DIR);

let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log('  ✅ ' + name); }
  else { fail++; console.log('  ❌ ' + name + (extra !== undefined ? '  → ' + extra : '')); }
}
const section = (s) => console.log('\n--- ' + s + ' ---');
const run = (ctx, code) => vm.runInContext(code, ctx);

const N = 50; // шумораи донишҷӯён

(async () => {

  /* ============================================================== */
  section(`1. Синфи ${N}-нафара (бе имзо — суръати соф)`);
  /* ============================================================== */

  const host = makeCtx('host');
  run(host, "$('input-host-pass').value = 'ustod-2026'; createRoom();");
  const room = host.__S.roomCode;
  check('муаллим ҳуҷра сохт', !!room, room);

  const t0 = Date.now();
  const students = [];
  for (let i = 0; i < N; i++) {
    const c = makeCtx('s' + i, { search: '?room=' + room });
    run(c, `joinRoom('Донишҷӯ ${i + 1}', '${room}');`);
    students.push(c);
  }
  const joinMs = Date.now() - t0;

  check(`ҳамаи ${N} донишҷӯ ба муаллим расиданд`,
    host.__S.participants.length === N, host.__S.participants.length);
  check('ҳеҷ ном такрор нашуд',
    new Set(host.__S.participants.map((p) => p.name)).size === N);
  check('ҳеҷ ID такрор нашуд',
    new Set(host.__S.participants.map((p) => p.id)).size === N);
  check(`вуруди ${N} нафар зуд гузашт (< 5000 мс)`, joinMs < 5000, joinMs + ' мс');

  // Снапшотҳо ҷамъ мешаванд — пас аз тирезаи ҷамъоварӣ ҳама рӯйхати пурра доранд
  await sleep(900);
  const gotRoster = students.filter((c) => c.__S.participants.length === N).length;
  check(`баъди тирезаи ҷамъоварӣ ҳама рӯйхати пурра доранд (${gotRoster}/${N})`, gotRoster === N);

  section('2. Савол ва ҷавоби ҳамзамони ҳамаи донишҷӯён');

  run(host, 'hostStartQuiz();');
  check('бозӣ оғоз шуд', host.__S.phase === 'question');
  const started = students.filter((c) => c.__S.phase === 'question').length;
  check(`савол ба ҳамаи ${N} донишҷӯ расид (${started}/${N})`, started === N);

  const q0 = host.__S.order[0];
  const correct = host.cppQuestions[q0].correct;

  // 30 нафар дуруст, 20 нафар нодуруст — ҳама дар як лаҳза
  const tAns = Date.now();
  students.forEach((c, i) => {
    const opt = i < 30 ? correct : (correct + 1) % 4;
    run(c, `selectOption(${opt});`);
  });
  const ansMs = Date.now() - tAns;

  check(`ҳамаи ${N} ҷавоб ба муаллим расид`,
    host.__S.answeredIds.length === N, host.__S.answeredIds.length);
  check(`${N} ҷавоб зуд коркард шуд (< 3000 мс)`, ansMs < 3000, ansMs + ' мс');
  check('ҳеҷ ҷавоб дубора ҳисоб нашуд',
    host.__S.participants.every((p) => p.answers.length === 1));

  const counts = [0, 0, 0, 0];
  host.__S.participants.forEach((p) => counts[p.answers[0].opt]++);
  check('тақсимот дуруст: 30 дуруст / 20 нодуруст',
    counts[correct] === 30 && counts.reduce((a, b) => a + b, 0) === N, counts.join('/'));

  check('дурустӣ то REVEAL ба донишҷӯ ошкор нашуд',
    students.every((c) => c.__S.reveal === null));

  run(host, 'hostReveal();');
  const revealed = students.filter((c) => c.__S.reveal !== null).length;
  check(`REVEAL ба ҳамаи ${N} расид (${revealed}/${N})`, revealed === N);

  const okScored = host.__S.participants.filter((p) => p.score > 0).length;
  check('маҳз 30 нафар бал гирифт', okScored === 30, okScored);

  section('3. Анҷом ва рейтинг');

  run(host, 'hostEndQuiz();');
  check('муаллим бозиро анҷом дод', host.__S.phase === 'ended');
  const ended = students.filter((c) => c.__S.phase === 'ended').length;
  check(`ҳамаи ${N} донишҷӯ рейтингро гирифт (${ended}/${N})`, ended === N);
  check('рейтинг ҳамаи донишҷӯёнро дар бар мегирад',
    host.__S.standings.length === N, host.__S.standings.length);
  check('рейтинг аз рӯи бал мураттаб аст',
    host.__S.standings.every((s, i, a) => i === 0 || a[i - 1].score >= s.score));

  section('4. Кеш пас аз бозӣ пок мешавад');

  const s0 = students[0];
  const sess = s0.sessionStorage;
  const local = s0.localStorage;
  const leftover = Object.keys(sess).filter((k) => k.indexOf('cppquiz_') === 0);
  check('ному ID-и донишҷӯ дар sessionStorage намондааст',
    leftover.length === 0, leftover.join(', '));
  check('калиди мубодилаи паёмҳо аз localStorage тоза шуд',
    !Object.keys(local).includes('cpp_quiz_event'), Object.keys(local).join(', '));
  check('танзими забон нигоҳ дошта шуд (набояд пок шавад)',
    run(s0, "typeof getLang() === 'string'"));

  // Ҳамаи донишҷӯён, на танҳо якум
  const dirty = students.filter((c) =>
    Object.keys(c.sessionStorage).some((k) => k.indexOf('cppquiz_') === 0)).length;
  check(`дар ҳеҷ яке аз ${N} дастгоҳ осори донишҷӯ намонд`, dirty === 0, dirty);

  /* ============================================================== */
  section('5. Муҳофизат: «муаллими қалбакӣ» бо имзои воқеӣ');
  /* ============================================================== */

  const h2 = makeCtx('host2', { crypto: true });
  run(h2, "$('input-host-pass').value = 'ustod-2026'; createRoom();");
  await sleep(120); // мунтазири сохта шудани ҷуфти калид
  const room2 = h2.__S.roomCode;
  const hostPub = h2.__S.keys && h2.__S.keys.pub;
  check('калиди муаллим сохта шуд', !!hostPub);
  check('калиди махфӣ дар линк НЕСТ',
    !run(h2, 'shareLink()').includes('priv') && run(h2, 'shareLink()').includes('#k='));

  const learner = makeCtx('real-student', { crypto: true, search: '?room=' + room2, hash: '#k=' + hostPub });
  run(learner, `joinRoom('Донишҷӯи ҳақиқӣ', '${room2}');`);
  await sleep(250);
  check('донишҷӯ калиди муаллимро аз линк гирифт', !!learner.__S.hostPubKey);
  check('донишҷӯ ба ҳуҷра ворид шуд', h2.__S.participants.length === 1, h2.__S.participants.length);

  run(h2, 'hostStartQuiz();');
  await sleep(250);
  check('саволи имзошуда қабул шуд', learner.__S.phase === 'question');
  const posBefore = learner.__S.qPos;

  // ⚠️ Ҳамла: «муаллими қалбакӣ» паёми имзонашуда мефиристад
  const attacker = makeCtx('attacker', { crypto: true, search: '?room=' + room2 });
  run(attacker, `S.roomCode = '${room2}'; S.role = 'host'; S.phase = 'question';`);
  run(attacker, `handleNetworkMessage({ room: '${room2}', mid: 'fake_1', type: 'QUESTION', pos: 99, qIndex: 3, total: 50, duration: 20, remaining: 20000 });`);
  run(learner, `handleNetworkMessage({ room: '${room2}', mid: 'fake_1', type: 'QUESTION', pos: 99, qIndex: 3, total: 50, duration: 20, remaining: 20000 });`);
  await sleep(200);
  check('саволи БЕ ИМЗО аз ҳамлагар рад шуд', learner.__S.qPos === posBefore, learner.__S.qPos);

  // ⚠️ Ҳамла: REVEAL-и қалбакӣ — ҷавоби дурустро пеш аз вақт кушодан
  run(learner, `handleNetworkMessage({ room: '${room2}', mid: 'fake_2', type: 'REVEAL', pos: ${posBefore}, qIndex: 0, correct: 0, counts: [1,0,0,0], results: {}, standings: [] });`);
  await sleep(200);
  check('REVEAL-и қалбакӣ рад шуд (ҷавоб пеш аз вақт кушода нашуд)',
    learner.__S.reveal === null);

  // ⚠️ Ҳамла: END-и қалбакӣ — бозиро зӯран қатъ кардан
  run(learner, `handleNetworkMessage({ room: '${room2}', mid: 'fake_3', type: 'END', standings: [] });`);
  await sleep(200);
  check('END-и қалбакӣ рад шуд (бозӣ қатъ нашуд)', learner.__S.phase === 'question');

  // ⚠️ Ҳамла: KICK-и қалбакӣ
  run(learner, `handleNetworkMessage({ room: '${room2}', mid: 'fake_4', type: 'KICK', studentId: '${learner.__S.myId}' });`);
  await sleep(200);
  check('KICK-и қалбакӣ рад шуд', learner.__S.phase === 'question');

  // ⚠️ Ҳамла: ҷавоб ба ҷои донишҷӯи дигар
  const victim = h2.__S.participants[0];
  const before = victim.score;
  run(h2, `handleNetworkMessage({ room: '${room2}', mid: 'fake_5', type: 'ANSWER', studentId: '${victim.id}', pos: ${h2.__S.qPos}, opt: 0 });`);
  await sleep(200);
  check('ҷавоби имзонашуда ба ҷои донишҷӯи дигар рад шуд',
    h2.__S.participants[0].score === before && h2.__S.answeredIds.length === 0);

  section('6. Дарвозаи парол');

  const guest = makeCtx('guest');
  run(guest, "$('input-host-pass').value = 'парол-нодуруст'; createRoom();");
  check('бе пароли дуруст ҳуҷра сохта НАМЕШАВАД',
    guest.__S.role === null && !guest.__S.roomCode, guest.__S.roomCode);
  check('кӯшиши нодуруст ҳисоб мешавад', guest.__S.adminTries === 1);

  run(guest, "$('input-host-pass').value = ''; createRoom();");
  check('пароли холӣ ҳуҷра намесозад', !guest.__S.roomCode);

  for (let i = 0; i < 6; i++) run(guest, "$('input-host-pass').value = 'x'; createRoom();");
  check('пас аз кӯшишҳои зиёд муваққатан баста мешавад', guest.__S.adminLockUntil > Date.now());
  run(guest, "$('input-host-pass').value = 'ustod-2026'; createRoom();");
  check('ҳангоми басташавӣ ҳатто пароли дуруст кор намекунад', !guest.__S.roomCode);

  const real = makeCtx('real-host');
  run(real, "$('input-host-pass').value = 'ustod-2026'; createRoom();");
  check('бо пароли дуруст ҳуҷра сохта мешавад', !!real.__S.roomCode, real.__S.roomCode);

  const viaLink = makeCtx('link-guest', { search: '?room=' + real.__S.roomCode });
  run(viaLink, "selectRole('host'); $('input-host-pass').value = 'ustod-2026'; createRoom();");
  check('меҳмони линк ҳатто бо пароли дуруст муаллим шуда наметавонад',
    viaLink.__S.role === 'student' && viaLink.__S.lockedToStudent === true);

  section('7. Ду забон ва ду фан');

  const bi = makeCtx('bi');
  run(bi, "$('input-host-pass').value = 'ustod-2026'; createRoom();");
  check('забони пешфарз тоҷикӣ аст', run(bi, "getLang()") === 'tg');
  check('коди ҳуҷраи C++ бо CPP- оғоз мешавад', /^CPP-/.test(bi.__S.roomCode), bi.__S.roomCode);

  run(bi, "S.settings.subject = 'js'; S.subject = 'js'; S.roomCode = generateRoomCode();");
  check('коди ҳуҷраи JavaScript бо JS- оғоз мешавад', /^JS-/.test(bi.__S.roomCode), bi.__S.roomCode);
  check('бонки JavaScript интихоб шуд', run(bi, 'bank().length') === bi.jsQuestions.length);

  const jsStudent = makeCtx('js-student', { search: '?room=' + bi.__S.roomCode });
  check('донишҷӯ аз рӯи коди ҳуҷра фанро мефаҳмад', jsStudent.__S.subject === 'js');

  run(bi, "setLang('ru');");
  check('забон ба русӣ иваз шуд', run(bi, "getLang()") === 'ru');
  check('матни русӣ бармегардад', run(bi, "t('btn.start')") === '▶️ НАЧАТЬ ИГРУ');
  check('саволи русӣ бармегардад',
    run(bi, "L(bank()[0].question)") === bi.jsQuestions[0].question.ru);
  run(bi, "setLang('tg');");
  check('бозгашт ба тоҷикӣ кор мекунад',
    run(bi, "L(bank()[0].question)") === bi.jsQuestions[0].question.tg);
  check('калиди номаълум барномаро вайрон намекунад',
    run(bi, "t('чунин.калид.нест')") === 'чунин.калид.нест');

  console.log(`\n===== ${pass} гузашт, ${fail} нагузашт =====`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
