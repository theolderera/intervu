/**
 * C++ Quiz Master — мантиқи барномаи викторинаи вақти воқеӣ
 *
 * Меъморӣ:
 *   • Муаллим (host) = сервери асосӣ ва админ. Ӯ вақт, холҳо ва кушодани
 *     ҷавоби дурустро идора мекунад. Муаллим худаш бозӣ намекунад.
 *   • Донишҷӯ (student) = мизоҷ. Танҳо ҷавоб медиҳад; дурустӣ ба ӯ
 *     ТАНҲО баъди тамом шудани вақт (REVEAL аз муаллим) нишон дода мешавад.
 *   • Транспорт: PeerJS (WebRTC) + BroadcastChannel + localStorage (fallback).
 */

'use strict';

/* ------------------------------------------------------------------ */
/*  Ҳолати умумӣ                                                       */
/* ------------------------------------------------------------------ */

const S = {
  role: null,            // 'host' | 'student'
  myId: null,
  userName: '',
  roomCode: '',
  lockedToStudent: false, // аз линки муаллим омад

  peer: null,
  connections: [],       // host → students
  hostConn: null,        // student → host

  participants: [],      // host: манбаи ҳақиқат
  order: [],             // тартиби индексҳои саволҳо
  phase: 'idle',         // idle | lobby | question | reveal | ended

  qPos: -1,              // ҷойгоҳ дар S.order
  duration: 20,
  endsAt: 0,
  tick: null,

  myAnswer: null,        // {opt, pos}
  answeredIds: [],
  reveal: null,
  standings: [],
  totalQ: 0,

  settings: { duration: 20, count: 0, shuffle: false, auto: false },

  soundEnabled: true,
  audioCtx: null,
  seenMsgs: new Set(),
  lastHostMsgAt: 0,
  joinRetry: null,
  revealTimeout: null
};

const LETTERS = ['A', 'B', 'C', 'D'];
const CHANNEL = 'cpp_quiz_channel';
const LS_KEY = 'cpp_quiz_event';

/* ------------------------------------------------------------------ */
/*  Ёридиҳандаҳо                                                       */
/* ------------------------------------------------------------------ */

const $ = (id) => document.getElementById(id);

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (m) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]
  ));
}

function uid(prefix) {
  return prefix + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

function show(el, visible) {
  if (el) el.classList.toggle('hidden', !visible);
}

function toast(text, kind) {
  const stack = $('toast-stack');
  if (!stack) return;
  const t = document.createElement('div');
  t.className = 'toast ' + (kind || 'info');
  t.textContent = text;
  stack.appendChild(t);
  setTimeout(() => {
    t.classList.add('out');
    setTimeout(() => t.remove(), 300);
  }, 3200);
}

/* ------------------------------------------------------------------ */
/*  Овоз (Web Audio API)                                               */
/* ------------------------------------------------------------------ */

function playSound(type) {
  if (!S.soundEnabled) return;
  try {
    if (!S.audioCtx) S.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = S.audioCtx;
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;

    const beep = (freq, freq2, vol, dur, delay) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      const t0 = now + (delay || 0);
      osc.frequency.setValueAtTime(freq, t0);
      if (freq2) osc.frequency.exponentialRampToValueAtTime(freq2, t0 + dur * 0.7);
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.01, t0 + dur);
      osc.start(t0);
      osc.stop(t0 + dur);
    };

    if (type === 'correct') beep(523.25, 783.99, 0.28, 0.3);
    else if (type === 'incorrect') beep(220, 164.81, 0.32, 0.35);
    else if (type === 'tick') beep(880, null, 0.12, 0.05);
    else if (type === 'lock') beep(660, 880, 0.16, 0.12);
    else if (type === 'join') beep(587.33, 880, 0.14, 0.18);
    else if (type === 'start') { beep(392, null, 0.2, 0.12, 0); beep(523.25, null, 0.2, 0.12, 0.12); beep(659.25, null, 0.22, 0.25, 0.24); }
    else if (type === 'win') [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => beep(f, null, 0.2, 0.3, i * 0.1));
  } catch (e) {
    console.warn('Audio unavailable', e);
  }
}

/* ------------------------------------------------------------------ */
/*  Қабати шабака                                                      */
/* ------------------------------------------------------------------ */

let bc = null;
if (typeof BroadcastChannel !== 'undefined') {
  bc = new BroadcastChannel(CHANNEL);
  bc.onmessage = (e) => handleNetworkMessage(e.data);
}

function send(msg) {
  msg.room = S.roomCode;
  msg.mid = msg.mid || uid('m');
  S.seenMsgs.add(msg.mid);

  if (S.role === 'host') {
    S.connections.forEach((c) => { if (c.open) { try { c.send(msg); } catch (e) {} } });
  } else if (S.hostConn && S.hostConn.open) {
    try { S.hostConn.send(msg); } catch (e) {}
  }

  if (bc) { try { bc.postMessage(msg); } catch (e) {} }
  try { localStorage.setItem(LS_KEY, JSON.stringify({ ...msg, _t: Date.now() })); } catch (e) {}
}

function initPeerHost() {
  if (typeof Peer === 'undefined') return;
  try {
    S.peer = new Peer('cpp-quiz-' + S.roomCode);
    S.peer.on('open', () => console.log('[host] peer ready'));
    S.peer.on('connection', (conn) => {
      S.connections.push(conn);
      conn.on('data', (d) => handleNetworkMessage(d));
      conn.on('close', () => { S.connections = S.connections.filter((c) => c !== conn); });
      conn.on('open', () => sendStateSnapshot());
    });
    S.peer.on('error', (err) => {
      // Агар чунин коди ҳуҷра аллакай банд бошад — коди навро месозем.
      if (err.type === 'unavailable-id' && !S.idRetried) {
        S.idRetried = true;
        try { S.peer.destroy(); } catch (e2) {}
        S.roomCode = generateRoomCode();
        $('display-room-code').textContent = S.roomCode;
        window.history.replaceState({}, '',
          `${window.location.origin}${window.location.pathname}?room=${S.roomCode}`);
        toast('Коди ҳуҷра нав карда шуд: ' + S.roomCode, 'warn');
        initPeerHost();
        return;
      }
      console.warn('[host] peer error', err.type);
    });
  } catch (e) {
    console.warn('PeerJS host init failed', e);
  }
}

function initPeerStudent() {
  if (typeof Peer !== 'undefined') {
    try {
      S.peer = new Peer();
      S.peer.on('open', () => {
        const conn = S.peer.connect('cpp-quiz-' + S.roomCode, { reliable: true });
        S.hostConn = conn;
        conn.on('open', () => { sendJoin(); });
        conn.on('data', (d) => handleNetworkMessage(d));
        conn.on('close', () => showConnState('Пайваст бо муаллим қатъ шуд — кӯшиши барқарорсозӣ...', false));
      });
      S.peer.on('error', (err) => {
        if (err.type === 'peer-unavailable' && !S.participants.some((p) => p.id === S.myId)) {
          showConnState('Ҳуҷра ёфт нашуд — коди ҳуҷраро тафтиш кунед', false);
        }
        console.warn('[student] peer error', err.type);
      });
    } catch (e) {
      console.warn('PeerJS student init failed', e);
    }
  }

  sendJoin();
  let tries = 0;
  S.joinRetry = setInterval(() => {
    tries++;
    if (S.phase !== 'idle' && S.phase !== 'lobby') { clearInterval(S.joinRetry); return; }
    if (S.participants.some((p) => p.id === S.myId)) {
      showConnState('Пайваст барқарор шуд ✓', true);
      clearInterval(S.joinRetry);
      return;
    }
    if (tries > 25) {
      clearInterval(S.joinRetry);
      showConnState('Муаллим ёфт нашуд. Коди ҳуҷраро тафтиш кунед.', false);
      return;
    }
    sendJoin();
  }, 1500);

  setInterval(() => {
    if (S.role !== 'student' || S.phase === 'idle') return;
    send({ type: 'HEARTBEAT', studentId: S.myId });

    // Агар аз муаллим дер боз хабаре набошад — ҳамоҳангсозиро дархост мекунем.
    const silent = S.lastHostMsgAt && Date.now() - S.lastHostMsgAt > 22000;
    if (silent && S.phase !== 'ended') {
      if (!S.warnedLost) {
        S.warnedLost = true;
        toast('Пайваст бо муаллим суст аст — барқарорсозӣ...', 'warn');
      }
      send({ type: 'SYNC_REQ', studentId: S.myId });
    } else if (!silent && S.warnedLost) {
      S.warnedLost = false;
      toast('Пайваст барқарор шуд', 'ok');
    }
  }, 5000);
}

function sendJoin() {
  send({ type: 'JOIN', studentId: S.myId, name: S.userName });
}

function showConnState(text, ok) {
  const el = $('student-conn-state');
  if (!el) return;
  el.classList.remove('hidden');
  el.innerHTML = ok ? '✓ ' + escapeHtml(text) : '<span class="spinner"></span> ' + escapeHtml(text);
  el.classList.toggle('ok', !!ok);
}

/* ------------------------------------------------------------------ */
/*  Роутери паёмҳо                                                     */
/* ------------------------------------------------------------------ */

function handleNetworkMessage(msg) {
  if (!msg || typeof msg !== 'object') return;
  if (!S.roomCode || msg.room !== S.roomCode) return;
  // То он даме ки корбар воқеан ворид нашудааст, ҳодисаҳоро коркард намекунем
  // (масалан, меҳмони линк ҳанӯз номашро нанавиштааст).
  if (S.phase === 'idle') return;
  if (msg.mid) {
    if (S.seenMsgs.has(msg.mid)) return;
    S.seenMsgs.add(msg.mid);
    if (S.seenMsgs.size > 500) S.seenMsgs = new Set([...S.seenMsgs].slice(-200));
  }

  if (S.role === 'host') {
    switch (msg.type) {
      case 'JOIN':      return hostOnJoin(msg);
      case 'ANSWER':    return hostOnAnswer(msg);
      case 'HEARTBEAT': return hostOnHeartbeat(msg);
      case 'SYNC_REQ':  return sendStateSnapshot();
    }
    return;
  }

  S.lastHostMsgAt = Date.now();
  switch (msg.type) {
    case 'ROSTER':   return studentOnRoster(msg);
    case 'QUESTION': return studentOnQuestion(msg);
    case 'ANSWERED': return studentOnAnswered(msg);
    case 'REVEAL':   return studentOnReveal(msg);
    case 'END':      return studentOnEnd(msg);
    case 'KICK':     return studentOnKick(msg);
  }
}

/* ------------------------------------------------------------------ */
/*  Оғоз                                                               */
/* ------------------------------------------------------------------ */

document.addEventListener('DOMContentLoaded', () => {
  initUI();
  checkUrlParams();
});

function initUI() {
  $('card-role-host')?.addEventListener('click', () => selectRole('host'));
  $('card-role-student')?.addEventListener('click', () => selectRole('student'));

  $('btn-create-room')?.addEventListener('click', createRoom);
  $('btn-join-room')?.addEventListener('click', () => joinRoom(
    $('input-student-name').value, $('input-room-code').value
  ));
  $('btn-join-by-link')?.addEventListener('click', () => joinRoom(
    $('input-link-name').value, S.roomCode
  ));
  $('input-link-name')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('btn-join-by-link').click();
  });
  $('input-room-code')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('btn-join-room').click();
  });

  $('btn-start-game')?.addEventListener('click', hostStartQuiz);
  $('btn-next-question')?.addEventListener('click', hostNext);
  $('btn-reveal-now')?.addEventListener('click', () => { if (S.phase === 'question') hostReveal(); });
  $('btn-end-quiz')?.addEventListener('click', () => {
    if (confirm('Бозиро ҳозир анҷом диҳем?')) hostEndQuiz();
  });
  $('btn-restart-game')?.addEventListener('click', () => {
    // Донишҷӯе, ки бо линки муаллим омадааст, дар ҳамон ҳуҷра мемонад —
    // ӯ ҳеҷ гоҳ ба экрани интихоби нақш барнамегардад.
    window.location.href = S.lockedToStudent
      ? window.location.href
      : window.location.origin + window.location.pathname;
  });
  $('btn-copy-link')?.addEventListener('click', copyShareableLink);
  $('btn-sound-toggle')?.addEventListener('click', toggleSound);
  $('btn-export-csv')?.addEventListener('click', exportCsv);

  initSegments();

  window.addEventListener('storage', (e) => {
    if (e.key === LS_KEY && e.newValue) {
      try { handleNetworkMessage(JSON.parse(e.newValue)); } catch (err) {}
    }
  });

  document.addEventListener('keydown', onHotkey);
}

function onHotkey(e) {
  if (S.role !== 'student' || S.phase !== 'question' || S.myAnswer) return;
  if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
  const map = { '1': 0, '2': 1, '3': 2, '4': 3, 'a': 0, 'b': 1, 'c': 2, 'd': 3 };
  const idx = map[e.key.toLowerCase()];
  if (idx !== undefined) selectOption(idx);
}

function initSegments() {
  const bind = (id, key, parse) => {
    const box = $(id);
    if (!box) return;
    box.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      [...box.querySelectorAll('button')].forEach((b) => b.classList.toggle('active', b === btn));
      S.settings[key] = parse(btn.dataset.val);
    });
  };
  bind('seg-duration', 'duration', (v) => parseInt(v, 10));
  bind('seg-count', 'count', (v) => parseInt(v, 10));
  bind('seg-shuffle', 'shuffle', (v) => v === '1');
  bind('seg-auto', 'auto', (v) => v === '1');
}

/**
 * Агар дар URL ?room= бошад — ин линки муаллим аст.
 * Интихоби нақш комилан пӯшида мешавад: корбар танҳо донишҷӯ шуда метавонад.
 */
function checkUrlParams() {
  const room = new URLSearchParams(window.location.search).get('room');
  if (!room) return;

  S.lockedToStudent = true;
  S.role = 'student';
  S.roomCode = room.trim().toUpperCase();

  show($('role-picker'), false);
  show($('join-by-link'), true);
  $('link-room-code').textContent = S.roomCode;

  const saved = sessionStorage.getItem('cppquiz_name_' + S.roomCode);
  if (saved) $('input-link-name').value = saved;
  setTimeout(() => $('input-link-name')?.focus(), 150);
}

function selectRole(role) {
  if (S.lockedToStudent) return;
  S.role = role;
  $('card-role-host')?.classList.toggle('active', role === 'host');
  $('card-role-student')?.classList.toggle('active', role === 'student');
  show($('form-host'), role === 'host');
  show($('form-student'), role === 'student');
}

function toggleSound() {
  S.soundEnabled = !S.soundEnabled;
  const btn = $('btn-sound-toggle');
  if (btn) btn.textContent = S.soundEnabled ? '🔊' : '🔇';
}

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'CPP-';
  for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

function showScreen(id) {
  ['screen-welcome', 'screen-lobby', 'screen-quiz', 'screen-leaderboard'].forEach((s) => {
    show($(s), s === id);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ------------------------------------------------------------------ */
/*  Муаллим — сохтани ҳуҷра                                            */
/* ------------------------------------------------------------------ */

function createRoom() {
  S.role = 'host';
  S.myId = 'host';
  S.userName = ($('input-host-name').value || '').trim() || 'Муаллим';
  S.roomCode = generateRoomCode();
  S.phase = 'lobby';
  S.participants = [];

  showScreen('screen-lobby');
  $('display-room-code').textContent = S.roomCode;
  show($('host-share-tools'), true);
  show($('host-settings'), true);
  show($('host-controls'), true);
  show($('student-lobby-msg'), false);
  updateParticipantsUI();

  initPeerHost();

  const url = `${window.location.origin}${window.location.pathname}?room=${S.roomCode}`;
  window.history.replaceState({}, '', url);

  setInterval(() => {
    if (S.role !== 'host') return;
    pruneOffline();
    broadcastRoster();
  }, 5000);
}

function copyShareableLink() {
  const link = `${window.location.origin}${window.location.pathname}?room=${S.roomCode}`;
  const done = () => {
    const btn = $('btn-copy-link');
    const orig = btn.textContent;
    btn.textContent = '✓ Линк нусхабардорӣ шуд!';
    setTimeout(() => (btn.textContent = orig), 2500);
  };
  if (navigator.clipboard) {
    navigator.clipboard.writeText(link).then(done).catch(() => prompt('Линки ҳуҷра:', link));
  } else {
    prompt('Линки ҳуҷра:', link);
  }
}

/* ------------------------------------------------------------------ */
/*  Донишҷӯ — ворид шудан                                              */
/* ------------------------------------------------------------------ */

function joinRoom(rawName, rawRoom) {
  const name = (rawName || '').trim();
  const room = (rawRoom || '').trim().toUpperCase();

  if (name.length < 2) { toast('Лутфан, номи худро дуруст нависед!', 'warn'); return; }
  if (!room) { toast('Лутфан, коди ҳуҷраро ворид кунед!', 'warn'); return; }

  S.role = 'student';
  S.userName = name;
  S.roomCode = room;
  S.phase = 'lobby';

  const key = 'cppquiz_id_' + room;
  S.myId = sessionStorage.getItem(key) || uid('st');
  sessionStorage.setItem(key, S.myId);
  sessionStorage.setItem('cppquiz_name_' + room, name);

  showScreen('screen-lobby');
  $('display-room-code').textContent = S.roomCode;
  show($('host-share-tools'), false);
  show($('host-settings'), false);
  show($('host-controls'), false);
  show($('student-lobby-msg'), true);
  showConnState('Пайвастшавӣ ба ҳуҷра...', false);

  initPeerStudent();
}

/* ------------------------------------------------------------------ */
/*  Муаллим — идораи иштирокчиён                                       */
/* ------------------------------------------------------------------ */

function hostOnJoin(msg) {
  if (!msg.studentId || !msg.name) return;

  let p = S.participants.find((x) => x.id === msg.studentId);
  if (p) {
    p.online = true;
    p.lastSeen = Date.now();
    p.name = String(msg.name).slice(0, 28);
  } else {
    let name = String(msg.name).slice(0, 28);
    let n = 2;
    while (S.participants.some((x) => x.name === name)) name = `${String(msg.name).slice(0, 24)} (${n++})`;

    p = {
      id: msg.studentId,
      name,
      score: 0,
      streak: 0,
      answers: [],
      online: true,
      lastSeen: Date.now()
    };
    S.participants.push(p);
    playSound('join');
    toast(`${p.name} ворид шуд`, 'ok');
  }

  updateParticipantsUI();
  updateAdminPanel();
  sendStateSnapshot();
}

function hostOnHeartbeat(msg) {
  const p = S.participants.find((x) => x.id === msg.studentId);
  if (p) { p.online = true; p.lastSeen = Date.now(); }
}

function pruneOffline() {
  const now = Date.now();
  let changed = false;
  S.participants.forEach((p) => {
    const off = now - (p.lastSeen || 0) > 16000;
    if (p.online === off) { p.online = !off; changed = true; }
  });
  if (changed) { updateParticipantsUI(); updateAdminPanel(); }
}

function hostKick(id) {
  const p = S.participants.find((x) => x.id === id);
  if (!p) return;
  if (!confirm(`"${p.name}"-ро аз ҳуҷра берун кунем?`)) return;
  S.participants = S.participants.filter((x) => x.id !== id);
  send({ type: 'KICK', studentId: id });
  updateParticipantsUI();
  updateAdminPanel();
  broadcastRoster();
  toast(`${p.name} хориҷ шуд`, 'warn');
}

function rosterPayload() {
  return S.participants.map((p) => ({
    id: p.id,
    name: p.name,
    score: p.score,
    online: p.online,
    correct: p.answers.filter((a) => a.ok).length,
    answered: p.answers.length
  }));
}

function broadcastRoster() {
  send({ type: 'ROSTER', participants: rosterPayload(), phase: S.phase });
}

/** Ба донишҷӯи нав/бозпайвастшуда ҳолати ҷориро мефиристад. */
function sendStateSnapshot() {
  if (S.role !== 'host') return;
  broadcastRoster();

  if (S.phase === 'question') {
    send({
      type: 'QUESTION',
      pos: S.qPos,
      qIndex: S.order[S.qPos],
      total: S.order.length,
      duration: S.duration,
      remaining: Math.max(0, S.endsAt - Date.now())
    });
    send({ type: 'ANSWERED', pos: S.qPos, ids: S.answeredIds, total: onlineCount() });
  } else if (S.phase === 'reveal' && S.reveal) {
    send(S.reveal);
  } else if (S.phase === 'ended') {
    send({ type: 'END', standings: S.standings });
  }
}

function onlineCount() {
  return S.participants.filter((p) => p.online).length;
}

/* ------------------------------------------------------------------ */
/*  Лобби UI                                                           */
/* ------------------------------------------------------------------ */

function updateParticipantsUI() {
  const box = $('participants-grid');
  const count = $('participant-count');
  if (!box) return;

  if (count) count.textContent = S.participants.length;
  show($('lobby-empty-msg'), S.participants.length === 0);
  box.innerHTML = '';

  S.participants.forEach((p) => {
    const chip = document.createElement('div');
    chip.className = 'participant-chip' + (p.online === false ? ' offline' : '');
    chip.innerHTML = `
      <div class="participant-avatar">${escapeHtml(p.name.charAt(0).toUpperCase())}</div>
      <span class="participant-name">${escapeHtml(p.name)}</span>
      ${S.role === 'host' ? `<button class="kick-btn" title="Хориҷ кардан" data-id="${escapeHtml(p.id)}">✕</button>` : ''}
    `;
    const kick = chip.querySelector('.kick-btn');
    if (kick) kick.addEventListener('click', () => hostKick(p.id));
    box.appendChild(chip);
  });
}

function studentOnRoster(msg) {
  S.participants = msg.participants || [];
  updateParticipantsUI();
  if (S.participants.some((p) => p.id === S.myId)) {
    showConnState('Пайваст фаъол — мунтазири муаллим', true);
    if (S.joinRetry) { clearInterval(S.joinRetry); S.joinRetry = null; }
  }
}

function studentOnKick(msg) {
  if (msg.studentId !== S.myId) return;
  clearInterval(S.tick);
  document.body.innerHTML = '<div class="kicked-screen"><div style="font-size:3rem">🚪</div>' +
    '<h2>Шумо аз ҳуҷра хориҷ шудед</h2>' +
    '<p>Барои бозгашт бо муаллим тамос гиред.</p></div>';
}

/* ------------------------------------------------------------------ */
/*  Муаллим — ҷараёни бозӣ                                             */
/* ------------------------------------------------------------------ */

function hostStartQuiz() {
  if (S.participants.length === 0) {
    if (!confirm('Ҳанӯз ягон донишҷӯ ворид нашудааст. Ба ҳар ҳол оғоз кунем?')) return;
  }

  S.duration = S.settings.duration;
  let idx = cppQuestions.map((_, i) => i);
  if (S.settings.shuffle) {
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
  }
  if (S.settings.count > 0) idx = idx.slice(0, S.settings.count);
  S.order = idx;

  S.participants.forEach((p) => { p.score = 0; p.streak = 0; p.answers = []; });

  playSound('start');
  hostStartQuestion(0);
}

function hostStartQuestion(pos) {
  clearTimeout(S.revealTimeout);
  S.phase = 'question';
  S.qPos = pos;
  S.answeredIds = [];
  S.reveal = null;
  S.endsAt = Date.now() + S.duration * 1000;

  send({
    type: 'QUESTION',
    pos,
    qIndex: S.order[pos],
    total: S.order.length,
    duration: S.duration,
    remaining: S.duration * 1000
  });

  renderQuestion(S.order[pos], pos, S.order.length);
  startCountdown(() => hostReveal());
  updateAdminPanel();
}

function hostOnAnswer(msg) {
  if (S.phase !== 'question' || msg.pos !== S.qPos) return;
  const p = S.participants.find((x) => x.id === msg.studentId);
  if (!p) return;
  if (S.answeredIds.includes(p.id)) return;
  if (typeof msg.opt !== 'number' || msg.opt < 0 || msg.opt > 3) return;

  p.online = true;
  p.lastSeen = Date.now();

  const q = cppQuestions[S.order[S.qPos]];
  const totalMs = S.duration * 1000;
  const remaining = Math.max(0, S.endsAt - Date.now());
  const ratio = Math.max(0, Math.min(1, remaining / totalMs));
  const ok = msg.opt === q.correct;

  let points = 0;
  if (ok) {
    points = Math.round(1000 * (0.6 + 0.4 * ratio)) + Math.min(p.streak, 5) * 50;
    p.streak += 1;
  } else {
    p.streak = 0;
  }

  p.score += points;
  p.answers.push({
    pos: S.qPos,
    qIndex: S.order[S.qPos],
    opt: msg.opt,
    ok,
    points,
    ms: totalMs - remaining
  });

  S.answeredIds.push(p.id);
  send({ type: 'ANSWERED', pos: S.qPos, ids: S.answeredIds, total: onlineCount() });
  updateAdminPanel();

  const online = S.participants.filter((x) => x.online);
  if (online.length > 0 && online.every((x) => S.answeredIds.includes(x.id))) {
    clearTimeout(S.revealTimeout);
    S.revealTimeout = setTimeout(() => { if (S.phase === 'question') hostReveal(); }, 800);
  }
}

function hostReveal() {
  if (S.phase !== 'question') return;
  clearInterval(S.tick);
  clearTimeout(S.revealTimeout);
  S.phase = 'reveal';

  const q = cppQuestions[S.order[S.qPos]];
  const counts = [0, 0, 0, 0];
  const results = {};

  S.participants.forEach((p) => {
    const a = p.answers.find((x) => x.pos === S.qPos);
    if (a) {
      counts[a.opt]++;
      results[p.id] = { opt: a.opt, ok: a.ok, points: a.points };
    }
  });

  S.standings = [...S.participants].sort((a, b) => b.score - a.score)
    .map((p, i) => ({ id: p.id, name: p.name, score: p.score, rank: i + 1 }));

  S.reveal = {
    type: 'REVEAL',
    pos: S.qPos,
    qIndex: S.order[S.qPos],
    correct: q.correct,
    counts,
    results,
    standings: S.standings,
    isLast: S.qPos + 1 >= S.order.length
  };
  send(S.reveal);

  renderReveal(S.reveal);
  updateAdminPanel();

  if (S.settings.auto) {
    S.revealTimeout = setTimeout(() => { if (S.phase === 'reveal') hostNext(); }, 5000);
  }
}

function hostNext() {
  if (S.role !== 'host') return;
  if (S.phase === 'question') { hostReveal(); return; }
  if (S.qPos + 1 < S.order.length) hostStartQuestion(S.qPos + 1);
  else hostEndQuiz();
}

function hostEndQuiz() {
  clearInterval(S.tick);
  clearTimeout(S.revealTimeout);
  S.phase = 'ended';

  S.standings = [...S.participants]
    .sort((a, b) => b.score - a.score)
    .map((p, i) => ({
      id: p.id,
      name: p.name,
      score: p.score,
      rank: i + 1,
      correct: p.answers.filter((a) => a.ok).length,
      answered: p.answers.length,
      answers: p.answers
    }));

  send({ type: 'END', standings: S.standings, total: S.order.length });
  showLeaderboard(S.standings, S.order.length);
}

/* ------------------------------------------------------------------ */
/*  Донишҷӯ — қабули ҳодисаҳо                                          */
/* ------------------------------------------------------------------ */

function studentOnQuestion(msg) {
  const resync = S.phase === 'question' && S.qPos === msg.pos;
  S.phase = 'question';
  S.duration = msg.duration;
  S.endsAt = Date.now() + (msg.remaining != null ? msg.remaining : msg.duration * 1000);

  if (!resync) {
    S.qPos = msg.pos;
    S.myAnswer = null;
    S.answeredIds = [];
    S.reveal = null;
    renderQuestion(msg.qIndex, msg.pos, msg.total);
  }
  startCountdown(() => onStudentTimeUp());
}

function studentOnAnswered(msg) {
  if (msg.pos !== S.qPos) return;
  S.answeredIds = msg.ids || [];
  const pill = $('answered-pill');
  if (pill) {
    show(pill, true);
    $('answered-count').textContent = `${S.answeredIds.length}/${msg.total || S.answeredIds.length}`;
  }
}

function onStudentTimeUp() {
  if (S.phase !== 'question') return;
  const box = $('answer-status');
  if (box && !S.myAnswer) {
    box.className = 'answer-status neutral';
    box.innerHTML = '⏰ <strong>Вақт тамом шуд.</strong> Шумо ҷавоб надодед — мунтазири натиҷа бошед...';
    show(box, true);
  } else if (box) {
    box.className = 'answer-status neutral';
    box.innerHTML = '⏳ Вақт тамом — муаллим натиҷаро мекушояд...';
  }
  document.querySelectorAll('.option-btn').forEach((b) => (b.disabled = true));
}

function studentOnReveal(msg) {
  if (msg.pos !== S.qPos) {
    S.qPos = msg.pos;
    renderQuestion(msg.qIndex, msg.pos, S.totalQ || msg.pos + 1);
  }
  S.phase = 'reveal';
  clearInterval(S.tick);
  S.reveal = msg;
  renderReveal(msg);
}

function studentOnEnd(msg) {
  S.phase = 'ended';
  clearInterval(S.tick);
  showLeaderboard(msg.standings || [], msg.total || 0);
}

/* ------------------------------------------------------------------ */
/*  Ҳисобкунаки вақт                                                   */
/* ------------------------------------------------------------------ */

function startCountdown(onEnd) {
  clearInterval(S.tick);
  const disp = $('timer-display');
  const box = $('timer-box');
  box?.classList.remove('urgent');

  const paint = () => {
    const left = Math.max(0, Math.ceil((S.endsAt - Date.now()) / 1000));
    if (disp) disp.textContent = left;
    if (left <= 5) {
      box?.classList.add('urgent');
      if (left > 0) playSound('tick');
    }
    if (left <= 0) {
      clearInterval(S.tick);
      onEnd();
    }
  };
  paint();
  S.tick = setInterval(paint, 1000);
}

/* ------------------------------------------------------------------ */
/*  Рендери савол                                                      */
/* ------------------------------------------------------------------ */

function renderQuestion(qIndex, pos, total) {
  const q = cppQuestions[qIndex];
  if (!q) return;

  showScreen('screen-quiz');
  const isHost = S.role === 'host';

  $('q-counter').textContent = `Саволи ${pos + 1} аз ${total}`;
  $('q-category').textContent = q.category;
  $('q-title').textContent = q.question;

  const code = $('q-code');
  if (q.code) { code.textContent = q.code; show(code, true); } else { show(code, false); }

  S.totalQ = total;
  const fill = $('progress-bar-fill');
  if (fill) fill.style.width = `${((pos + 1) / total) * 100}%`;
  $('answered-count').textContent = '0/' + (S.participants.length || 0);

  show($('explanation-box'), false);
  show($('answer-status'), false);
  show($('admin-panel'), isHost);
  show($('answered-pill'), true);
  document.querySelector('.quiz-body')?.classList.toggle('with-admin', isHost);

  if (isHost) {
    show($('options-grid'), false);
    show($('host-options'), true);
    renderHostOptions(q, false);
  } else {
    show($('host-options'), false);
    show($('options-grid'), true);
    renderStudentOptions(q);
  }
}

function renderStudentOptions(q) {
  const grid = $('options-grid');
  grid.innerHTML = '';
  q.options.forEach((text, i) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.dataset.idx = i;
    btn.innerHTML = `<span class="option-badge">${LETTERS[i]}</span><span>${escapeHtml(text)}</span>`;
    btn.addEventListener('click', () => selectOption(i));
    grid.appendChild(btn);
  });
}

/** Муаллим саволро бо ҷавоби дуруст ва оморро мебинад. */
function renderHostOptions(q, revealed) {
  const box = $('host-options');
  const counts = (S.reveal && S.reveal.counts) || liveCounts();
  const totalAns = counts.reduce((a, b) => a + b, 0) || 1;

  box.innerHTML = q.options.map((text, i) => {
    const isCorrect = i === q.correct;
    const pct = Math.round((counts[i] / totalAns) * 100);
    return `
      <div class="host-option ${isCorrect ? 'is-correct' : ''} ${revealed && !isCorrect && counts[i] ? 'is-wrong' : ''}">
        <span class="option-badge">${LETTERS[i]}</span>
        <span class="host-option-text">${escapeHtml(text)}</span>
        ${isCorrect ? '<span class="correct-tag">ҶАВОБИ ДУРУСТ</span>' : ''}
        <span class="host-option-count">${counts[i]}</span>
        <div class="host-option-bar" style="width:${counts[i] ? pct : 0}%"></div>
      </div>`;
  }).join('');
}

function liveCounts() {
  const c = [0, 0, 0, 0];
  S.participants.forEach((p) => {
    const a = p.answers && p.answers.find((x) => x.pos === S.qPos);
    if (a) c[a.opt]++;
  });
  return c;
}

/* ------------------------------------------------------------------ */
/*  Интихоби ҷавоб (донишҷӯ) — БЕ нишон додани дурустӣ                 */
/* ------------------------------------------------------------------ */

function selectOption(optionIndex) {
  if (S.role !== 'student' || S.phase !== 'question' || S.myAnswer) return;
  if (Date.now() > S.endsAt) return;

  S.myAnswer = { opt: optionIndex, pos: S.qPos };

  document.querySelectorAll('.option-btn').forEach((btn, i) => {
    btn.disabled = true;
    btn.classList.toggle('selected', i === optionIndex);
    if (i !== optionIndex) btn.classList.add('dimmed');
  });

  const box = $('answer-status');
  box.className = 'answer-status pending';
  box.innerHTML = `
    <span class="pending-badge">${LETTERS[optionIndex]}</span>
    <div>
      <strong>Ҷавоби шумо қабул шуд.</strong>
      <p>Дурустии ҷавоб пас аз тамом шудани вақт нишон дода мешавад — сабр кунед.</p>
    </div>
    <span class="spinner"></span>`;
  show(box, true);

  playSound('lock');
  send({ type: 'ANSWER', studentId: S.myId, pos: S.qPos, opt: optionIndex });
}

/* ------------------------------------------------------------------ */
/*  Кушодани ҷавоб (REVEAL)                                            */
/* ------------------------------------------------------------------ */

function renderReveal(rev) {
  const q = cppQuestions[rev.qIndex];
  if (!q) return;

  if (S.role === 'host') {
    renderHostOptions(q, true);
    const exp = $('explanation-box');
    exp.innerHTML = `<strong>💡 Шарҳ:</strong> ${escapeHtml(q.explanation)}`;
    show(exp, true);
    updateAdminPanel();
    const btn = $('btn-next-question');
    if (btn) btn.textContent = rev.isLast ? '🏁 Ҷадвали рейтинг' : 'Навбатӣ ➔';
    return;
  }

  const mine = rev.results ? rev.results[S.myId] : null;
  document.querySelectorAll('.option-btn').forEach((btn, i) => {
    btn.disabled = true;
    btn.classList.remove('dimmed');
    if (i === rev.correct) btn.classList.add('correct');
    if (mine && i === mine.opt && !mine.ok) btn.classList.add('incorrect');
  });

  const box = $('answer-status');
  const myStanding = (rev.standings || []).find((s) => s.id === S.myId);
  const rankTxt = myStanding ? ` · Ҷои ${myStanding.rank} · ${myStanding.score} бал` : '';

  if (!mine) {
    box.className = 'answer-status neutral';
    box.innerHTML = `<span class="pending-badge">—</span><div><strong>Шумо ҷавоб надодед.</strong>
      <p>Ҷавоби дуруст: <b>${LETTERS[rev.correct]}</b>${escapeHtml(rankTxt)}</p></div>`;
  } else if (mine.ok) {
    box.className = 'answer-status good';
    box.innerHTML = `<span class="pending-badge">✓</span><div><strong>Офарин! Ҷавоб дуруст аст.</strong>
      <p>+${mine.points} бал${escapeHtml(rankTxt)}</p></div>`;
    playSound('correct');
  } else {
    box.className = 'answer-status bad';
    box.innerHTML = `<span class="pending-badge">✕</span><div><strong>Ҷавоб нодуруст.</strong>
      <p>Ҷавоби дуруст: <b>${LETTERS[rev.correct]}</b>${escapeHtml(rankTxt)}</p></div>`;
    playSound('incorrect');
  }
  show(box, true);

  const exp = $('explanation-box');
  exp.innerHTML = `<strong>💡 Шарҳ:</strong> ${escapeHtml(q.explanation)}`;
  show(exp, true);

  const disp = $('timer-display');
  if (disp) disp.textContent = '0';
}

/* ------------------------------------------------------------------ */
/*  Панели админ (муаллим)                                             */
/* ------------------------------------------------------------------ */

function updateAdminPanel() {
  if (S.role !== 'host') return;

  const online = onlineCount();
  $('stat-online').textContent = online;
  $('stat-answered').textContent = `${S.answeredIds.length}/${S.participants.length}`;
  $('answered-count').textContent = `${S.answeredIds.length}/${S.participants.length}`;

  const counts = S.phase === 'reveal' && S.reveal ? S.reveal.counts : liveCounts();
  const q = cppQuestions[S.order[S.qPos]];
  if (q) {
    const okCount = counts[q.correct] || 0;
    const totalAns = counts.reduce((a, b) => a + b, 0);
    $('stat-correct').textContent = totalAns ? `${Math.round((okCount / totalAns) * 100)}%` : '—';

    const distBox = $('dist-box');
    if (distBox) {
      const max = Math.max(1, ...counts);
      distBox.innerHTML = counts.map((c, i) => `
        <div class="dist-row ${i === q.correct ? 'is-correct' : ''}">
          <span class="dist-letter">${LETTERS[i]}</span>
          <div class="dist-track"><div class="dist-bar" style="width:${(c / max) * 100}%"></div></div>
          <span class="dist-num">${c}</span>
        </div>`).join('');
    }
    if (S.phase !== 'reveal') renderHostOptions(q, false);
  }

  const body = $('monitor-body');
  if (body) {
    const sorted = [...S.participants].sort((a, b) => b.score - a.score);
    body.innerHTML = sorted.map((p) => {
      const a = p.answers.find((x) => x.pos === S.qPos);
      let cell;
      if (!a) cell = '<span class="chip waiting">интизор</span>';
      else if (S.phase === 'reveal') cell = `<span class="chip ${a.ok ? 'ok' : 'bad'}">${LETTERS[a.opt]} ${a.ok ? '✓' : '✕'}</span>`;
      else cell = `<span class="chip picked">${LETTERS[a.opt]}</span>`;

      return `<tr class="${p.online ? '' : 'row-offline'}">
        <td><span class="dot ${p.online ? 'on' : 'off'}"></span>${escapeHtml(p.name)}</td>
        <td>${cell}</td>
        <td class="num">${p.score}</td>
        <td><button class="kick-btn sm" data-id="${escapeHtml(p.id)}" title="Хориҷ кардан">✕</button></td>
      </tr>`;
    }).join('') || '<tr><td colspan="4" class="empty-row">Ҳанӯз донишҷӯ нест</td></tr>';

    body.querySelectorAll('.kick-btn').forEach((b) => {
      b.addEventListener('click', () => hostKick(b.dataset.id));
    });
  }
}

/* ------------------------------------------------------------------ */
/*  Ҷадвали рейтинг                                                    */
/* ------------------------------------------------------------------ */

function showLeaderboard(standings, totalQuestions) {
  showScreen('screen-leaderboard');
  playSound('win');
  triggerConfetti();

  const total = totalQuestions || S.order.length || S.totalQ || cppQuestions.length;

  const podium = $('podium-container');
  if (podium) {
    podium.innerHTML = '';
    const order = [standings[1], standings[0], standings[2]];
    const cls = ['second', 'first', 'third'];
    const medals = ['🥈', '🥇', '🥉'];
    const nums = ['2', '1', '3'];
    order.forEach((p, i) => {
      if (!p) return;
      const step = document.createElement('div');
      step.className = `podium-step ${cls[i]}`;
      step.innerHTML = `
        <div class="podium-avatar">${medals[i]}</div>
        <div class="podium-name">${escapeHtml(p.name)}</div>
        <div class="podium-score">${p.score} бал</div>
        <div class="podium-pillar">${nums[i]}</div>`;
      podium.appendChild(step);
    });
  }

  const tbody = $('rankings-table-body');
  if (tbody) {
    tbody.innerHTML = standings.map((p, i) => {
      const correct = p.correct != null ? p.correct : 0;
      const acc = total ? Math.round((correct / total) * 100) : 0;
      const rankClass = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : '';
      const isMe = p.id === S.myId ? ' class="me-row"' : '';
      return `<tr${isMe}>
        <td><span class="rank-badge ${rankClass}">${i + 1}</span></td>
        <td><strong>${escapeHtml(p.name)}</strong>${p.id === S.myId ? ' <span class="you-tag">шумо</span>' : ''}</td>
        <td>${p.score} бал</td>
        <td>${correct} / ${total} (${acc}%)</td>
      </tr>`;
    }).join('') || '<tr><td colspan="4" class="empty-row">Маълумот нест</td></tr>';
  }

  const me = standings.find((p) => p.id === S.myId);
  const card = $('my-result-card');
  if (card && S.role === 'student' && me) {
    card.innerHTML = `
      <div class="my-rank">#${me.rank || standings.indexOf(me) + 1}</div>
      <div>
        <strong>${escapeHtml(me.name)}</strong>
        <p>${me.score} бал · ${me.correct != null ? me.correct : 0} ҷавоби дуруст аз ${total}</p>
      </div>`;
    show(card, true);
  }

  show($('host-report'), S.role === 'host');
  if (S.role === 'host') renderHostReport(total);
}

function renderHostReport(total) {
  const body = $('report-body');
  if (!body) return;

  const rows = [...S.participants].sort((a, b) => b.score - a.score);
  body.innerHTML = rows.map((p) => {
    const correct = p.answers.filter((a) => a.ok).length;
    const acc = p.answers.length ? Math.round((correct / p.answers.length) * 100) : 0;
    const avg = p.answers.length
      ? (p.answers.reduce((s, a) => s + a.ms, 0) / p.answers.length / 1000).toFixed(1)
      : '—';

    const dots = S.order.map((_, pos) => {
      const a = p.answers.find((x) => x.pos === pos);
      const cls = !a ? 'none' : a.ok ? 'ok' : 'bad';
      return `<span class="qdot ${cls}" title="Саволи ${pos + 1}"></span>`;
    }).join('');

    return `<tr>
      <td><strong>${escapeHtml(p.name)}</strong></td>
      <td class="num">${p.score}</td>
      <td class="num">${correct}/${total}</td>
      <td class="num">${acc}%</td>
      <td class="num">${avg}с</td>
      <td><div class="qdots">${dots}</div></td>
    </tr>`;
  }).join('') || '<tr><td colspan="6" class="empty-row">Донишҷӯ нест</td></tr>';
}

function exportCsv() {
  const total = S.order.length;
  const head = ['Ном', 'Бал', 'Дуруст', 'Ҷавобдода', 'Дақиқӣ %', 'Вақти миёна (с)'];
  for (let i = 1; i <= total; i++) head.push('С' + i);

  const lines = [head.join(';')];
  [...S.participants].sort((a, b) => b.score - a.score).forEach((p) => {
    const correct = p.answers.filter((a) => a.ok).length;
    const acc = p.answers.length ? Math.round((correct / p.answers.length) * 100) : 0;
    const avg = p.answers.length ? (p.answers.reduce((s, a) => s + a.ms, 0) / p.answers.length / 1000).toFixed(1) : '';
    const row = [p.name, p.score, correct, p.answers.length, acc, avg];
    S.order.forEach((_, pos) => {
      const a = p.answers.find((x) => x.pos === pos);
      row.push(!a ? '-' : a.ok ? '1' : '0');
    });
    lines.push(row.join(';'));
  });

  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `natijaho_${S.roomCode}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('Ҳисобот боргирӣ шуд', 'ok');
}

/* ------------------------------------------------------------------ */
/*  Конфетти                                                           */
/* ------------------------------------------------------------------ */

function triggerConfetti() {
  const canvas = $('confetti-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const colors = ['#00f2fe', '#6366f1', '#a855f7', '#10b981', '#f59e0b', '#f43f5e'];
  const particles = Array.from({ length: 130 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height - canvas.height,
    size: Math.random() * 8 + 4,
    color: colors[Math.floor(Math.random() * colors.length)],
    vy: Math.random() * 3 + 2,
    vx: Math.random() * 2 - 1,
    rot: Math.random() * 360
  }));

  (function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach((p) => {
      p.y += p.vy; p.x += p.vx; p.rot += 2;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rot * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    });
    if (particles.some((p) => p.y < canvas.height)) requestAnimationFrame(render);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  })();
}
