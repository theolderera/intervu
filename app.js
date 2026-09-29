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
  subject: 'cpp',        // 'cpp' | 'js'

  // Муҳофизат: имзои рақамӣ (ниг. crypto-auth.js)
  keys: null,            // {privateKey, pub} — калидҳои ин дастгоҳ
  hostPubKey: null,      // донишҷӯ: калиди кушоди муаллим (аз линк ё TOFU)
  hostPubB64: null,
  adminOk: false,        // муаллим паролро дуруст ворид кард
  adminTries: 0,
  adminLockUntil: 0,

  peer: null,
  connections: [],       // host → students
  hostConn: null,        // student → host

  relay: null,           // канали эҳтиётии WebSocket (кор мекунад, ҳатто агар WebRTC нашавад)
  relayOk: false,
  relayIdx: 0,
  relayTries: 0,

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

  settings: { duration: 20, count: 0, shuffle: false, auto: false, subject: 'cpp' },

  // Танзими сарборӣ барои синфи калон (50+ донишҷӯ)
  answeredTimer: null,
  answeredPending: false,
  rosterTimer: null,
  rosterPending: false,
  lastRosterHash: '',
  lastLsWrite: 0,

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
/*  Бонкҳои савол (фанҳо)                                              */
/* ------------------------------------------------------------------ */

const SUBJECTS = {
  cpp: { label: 'C++', prefix: 'CPP' },
  js: { label: 'JavaScript', prefix: 'JS' }
};

/** Бонки саволҳои фанни ҷорӣ (ё фанни додашуда). */
function bank(subject) {
  const s = subject || S.subject || 'cpp';
  if (s === 'js') return (typeof jsQuestions !== 'undefined' ? jsQuestions : []);
  return (typeof cppQuestions !== 'undefined' ? cppQuestions : []);
}

/** Саволи рақами `i` аз бонки фанни ҷорӣ. */
function Q(i) {
  const b = bank();
  return b[i];
}

/**
 * Серверҳои ICE.
 * Танҳо STUN кофӣ НЕСТ: донишҷӯёне, ки бо интернети мобилӣ (4G/5G) ҳастанд,
 * пушти NAT-и симметрӣ мемонанд ва пайвасти мустақим сохта наметавонанд.
 * TURN трафикро аз худ мегузаронад ва чунин донишҷӯёнро низ мепайвандад.
 */
const ICE_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'turn:staticauth.openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:staticauth.openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:staticauth.openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' }
  ],
  iceCandidatePoolSize: 2
};
const PEER_OPTS = { config: ICE_CONFIG };
const HOST_PEER_PREFIX = 'cpp-quiz-';

/**
 * РЕЛЕИ ЭҲТИЁТӢ — сабаби асосии «загрузкаи беохир».
 *
 * WebRTC ҳамеша роҳи мустақим сохта наметавонад: донишҷӯёне, ки бо интернети
 * мобилӣ (4G/5G) ё Wi-Fi-и мактаб ҳастанд, пушти NAT-и симметрӣ мемонанд.
 * Барои ҳамин танҳо 3–4 нафар (одатан онҳое, ки дар як шабака буданд) ворид
 * мешуданд, боқимонда то охир дар «Пайвастшавӣ...» мемонданд.
 *
 * Ҳал: ба ғайр аз WebRTC ҳамаи паёмҳо аз як канали оддии WebSocket низ
 * мегузаранд. Ин трафики муқаррарии wss (443/8084) аст — аз ҳар оператор ва
 * ҳар firewall мегузарад ва ба NAT тамоман вобаста нест. Ду роҳ ҳамзамон кор
 * мекунанд, такрори паёмҳо бо `msg.mid` бартараф мешавад.
 */
const RELAY_BROKERS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
  'wss://test.mosquitto.org:8081/mqtt'
];
const RELAY_PREFIX = 'cppquiz/v1/';

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

/**
 * Паём мефиристад. Пеш аз фиристодан онро бо калиди махфии ин дастгоҳ
 * имзо мекунад — тарафи дигар имзоро тафтиш карда, паёмҳои сохтаро
 * рад мекунад (ниг. crypto-auth.js).
 */
function send(msg) {
  msg.room = S.roomCode;
  msg.mid = msg.mid || uid('m');
  rememberMid(msg.mid);

  // Муаллим калиди кушоди худро ҳамроҳ мекунад — донишҷӯе, ки бо коди дастӣ
  // (бе линк) ворид шуд, имзоро бо ҳамин калид тафтиш мекунад.
  // `pub` ба матни имзошаванда дохил намешавад, бинобар ин имзоро вайрон намекунад.
  if (S.role === 'host' && S.keys && S.keys.pub) msg.pub = S.keys.pub;

  if (S.keys && S.keys.privateKey && window.QuizAuth) {
    QuizAuth.signMessage(S.keys.privateKey, msg)
      .then((sig) => { if (sig) msg.sig = sig; dispatch(msg); })
      .catch(() => dispatch(msg));
  } else {
    dispatch(msg);
  }
}

/** Паёми тайёр (имзошуда) аз ҳамаи каналҳо мегузарад. */
function dispatch(msg) {
  if (S.role === 'host') {
    S.connections.forEach((c) => { if (c.open) { try { c.send(msg); } catch (e) {} } });
  } else if (S.hostConn && S.hostConn.open) {
    try { S.hostConn.send(msg); } catch (e) {}
  }

  relaySend(msg);

  if (bc) { try { bc.postMessage(msg); } catch (e) {} }

  // Нусхаи localStorage танҳо барои табҳои ҳамин браузер лозим аст.
  // Дар синфи калон навиштани ҳар паём дискро банд мекунад — маҳдуд мекунем.
  const now = Date.now();
  if (now - S.lastLsWrite > 250) {
    S.lastLsWrite = now;
    try { localStorage.setItem(LS_KEY, JSON.stringify({ ...msg, _t: now })); } catch (e) {}
  }
}

/**
 * Рӯйхати паёмҳои дидашуда. Дар синфи 50-нафара дар як савол садҳо паём
 * мегузарад, бинобар ин ҳаҷм калонтар аст — вагарна паёмҳои кӯҳна аз рӯйхат
 * мебароянд ва такроран коркард мешаванд.
 */
function rememberMid(mid) {
  S.seenMsgs.add(mid);
  if (S.seenMsgs.size > 4000) {
    S.seenMsgs = new Set([...S.seenMsgs].slice(-1500));
  }
}

/** Ҳамаи паёмҳо ҳамзамон аз релеи WebSocket низ мераванд. */
function relaySend(msg) {
  if (!S.relay || !S.relayOk) return;
  try {
    S.relay.publish(relayTopics().pub, JSON.stringify(msg), { qos: 0 });
  } catch (e) {}
}

/**
 * Мавзӯъҳо: муаллим ба `/h` менависад ва аз `/s` мехонад, донишҷӯ баръакс.
 * Ҳамин тавр донишҷӯён паёмҳои ҳамдигарро бекора қабул намекунанд.
 */
function relayTopics() {
  const base = RELAY_PREFIX + S.roomCode;
  return S.role === 'host'
    ? { pub: base + '/h', sub: base + '/s' }
    : { pub: base + '/s', sub: base + '/h' };
}

/** Оё ҳадди ақал як роҳи корӣ ба муаллим ҳаст? */
function linkUp() {
  return !!((S.hostConn && S.hostConn.open) || S.relayOk);
}

function initRelay() {
  if (typeof mqtt === 'undefined' || !S.roomCode || !S.role) return;
  if (S.relay) { try { S.relay.end(true); } catch (e) {} S.relay = null; }
  S.relayOk = false;

  const url = RELAY_BROKERS[S.relayIdx % RELAY_BROKERS.length];
  let client;
  try {
    client = mqtt.connect(url, {
      clientId: 'cq_' + Math.random().toString(16).slice(2, 10) + Date.now().toString(36).slice(-4),
      protocolVersion: 4,
      clean: true,
      keepalive: 25,
      connectTimeout: 8000,
      reconnectPeriod: 3000
    });
  } catch (e) {
    return;
  }
  S.relay = client;
  const topics = relayTopics();

  // Агар ин брокер дар 9 сония ҷавоб надиҳад — ба брокери дигар мегузарем.
  const failover = setTimeout(() => {
    if (client !== S.relay || S.relayOk) return;
    try { client.end(true); } catch (e) {}
    S.relayIdx++;
    S.relayTries++;
    if (S.relayTries <= 9) initRelay();
  }, 9000);

  client.on('connect', () => {
    if (client !== S.relay) { try { client.end(true); } catch (e) {} return; }
    clearTimeout(failover);
    S.relayOk = true;
    S.relayTries = 0;
    client.subscribe(topics.sub, { qos: 0 }, () => {
      if (S.role === 'host') {
        setNetState(true, t('conn.roomlive'));
        scheduleSnapshot();
      } else {
        sendJoin();
        send({ type: 'SYNC_REQ', studentId: S.myId });
      }
    });
  });

  client.on('message', (topic, payload) => {
    if (client !== S.relay) return;
    try { handleNetworkMessage(JSON.parse(payload.toString())); } catch (e) {}
  });

  client.on('close', () => { if (client === S.relay) S.relayOk = false; });
  client.on('offline', () => { if (client === S.relay) S.relayOk = false; });
  client.on('error', () => { if (client === S.relay) S.relayOk = false; });
}

/**
 * Ҳуҷраи муаллим дар сервери PeerJS.
 *
 * МУҲИМ: соединенияи муаллим бо сервери PeerJS вақт-вақт канда мешавад
 * (интернети суст, экрани хомӯшшуда, таймаути сервер). Дар он лаҳза
 * донишҷӯёни аллакай пайвастшуда кор мекунанд (алоқаи мустақим), вале
 * коди ҳуҷра дар сервер нест мешавад ва донишҷӯёни НАВ ҳуҷраро ёфта
 * наметавонанд. Барои ҳамин мо ҳатман reconnect мекунем.
 */
function initPeerHost() {
  if (typeof Peer === 'undefined') return;
  try {
    S.peer = new Peer(HOST_PEER_PREFIX + S.roomCode, PEER_OPTS);

    S.peer.on('open', () => {
      S.peerEverOpened = true;
      setNetState(true, t('conn.roomlive'));
    });

    S.peer.on('connection', (conn) => {
      // Пайвасти кӯҳнаи ҳамон донишҷӯро мебандем, то нусхаи мурда намонад.
      S.connections = S.connections.filter((c) => {
        if (c.peer === conn.peer) { try { c.close(); } catch (e) {} return false; }
        return true;
      });
      S.connections.push(conn);
      conn.on('data', (d) => handleNetworkMessage(d));
      conn.on('close', () => { S.connections = S.connections.filter((c) => c !== conn); });
      conn.on('error', () => { S.connections = S.connections.filter((c) => c !== conn); });
      conn.on('open', () => scheduleSnapshot());
    });

    // Алоқа бо сервер канда шуд — фавран барқарор мекунем.
    S.peer.on('disconnected', () => {
      setNetState(false, t('net.lost'));
      setTimeout(() => {
        if (S.peer && !S.peer.destroyed && S.peer.disconnected) {
          try { S.peer.reconnect(); } catch (e) {}
        }
      }, 1000);
    });

    // Peer тамоман пӯшида шуд — аз нав месозем (бо ҲАМОН коди ҳуҷра).
    S.peer.on('close', () => {
      setNetState(false, t('net.rebuild'));
      setTimeout(() => { if (S.role === 'host') initPeerHost(); }, 2000);
    });

    S.peer.on('error', (err) => {
      if (err.type === 'unavailable-id') {
        if (!S.peerEverOpened && !S.idRetried) {
          // Ҳангоми сохтани ҳуҷра чунин код банд буд — коди нав мегирем.
          S.idRetried = true;
          try { S.peer.destroy(); } catch (e) {}
          S.roomCode = generateRoomCode();
          $('display-room-code').textContent = S.roomCode;
          window.history.replaceState({}, '',
            `${window.location.origin}${window.location.pathname}?room=${S.roomCode}`);
          toast(t('msg.newcode', { c: S.roomCode }), 'warn');
          initPeerHost();
          initRelay(); // коди ҳуҷра дигар шуд — мавзӯи релей ҳам бояд дигар шавад
        } else {
          // Барқарорсозӣ: сервер ҳанӯз коди кӯҳнаро нигоҳ дошта истодааст.
          // Коди ҳуҷраро ИВАЗ НАМЕКУНЕМ — линки донишҷӯён бояд кор кунад.
          try { S.peer.destroy(); } catch (e) {}
          setTimeout(() => { if (S.role === 'host') initPeerHost(); }, 3000);
        }
        return;
      }
      if (err.type === 'network' || err.type === 'server-error' || err.type === 'socket-error') {
        setNetState(false, t('net.issue'));
        try { S.peer.destroy(); } catch (e) {}
        setTimeout(() => { if (S.role === 'host') initPeerHost(); }, 2500);
        return;
      }
      console.warn('[host] peer error', err.type);
    });

    // Посбон: ҳар 5 сония ҳолати алоқаро месанҷад.
    if (!S.hostWatchdog) {
      S.hostWatchdog = setInterval(() => {
        if (S.role !== 'host') return;

        // Релей аз нав пайваст мешавад, агар канда шуда бошад.
        if (!S.relay && typeof mqtt !== 'undefined') initRelay();

        if (!S.peer || S.peer.destroyed) { initPeerHost(); return; }
        if (S.peer.disconnected) {
          try { S.peer.reconnect(); } catch (e) {}
          // Агар релей кор кунад, ҳуҷра ҳанӯз ҳам зинда аст — беҳуда натарсонем.
          if (!S.relayOk) setNetState(false, t('net.lost'));
          else setNetState(true, t('conn.roomlive'));
        } else if (S.peer.open || S.relayOk) {
          setNetState(true, t('conn.roomlive'));
        }
      }, 5000);
    }
  } catch (e) {
    console.warn('PeerJS host init failed', e);
  }
}

/** Нишондиҳандаи ҳолати алоқа (ҳам барои муаллим, ҳам донишҷӯ). */
function setNetState(ok, text) {
  const prev = S.netOk;
  S.netOk = ok;
  showConnState(text, ok);
  if (prev === true && ok === false) toast(text, 'warn');
  if (prev === false && ok === true) toast(t('net.restored'), 'ok');
}

/**
 * Тарафи донишҷӯ.
 * Пештар як кӯшиши нобарор кофӣ буд, ки донишҷӯ то охири дарс беалоқа монад:
 * такрор танҳо JOIN мефиристод, вале худи пайвастро аз нав намесохт.
 * Ҳоло пайваст беохир (бо таваққуфи зиёдшаванда) барқарор карда мешавад —
 * ҳам дар лобби, ҳам дар мобайни бозӣ.
 */
function initPeerStudent() {
  createStudentPeer();
  sendJoin(); // фавран — то ки дар як браузер (BroadcastChannel) дарҳол пайдо шавад

  let tries = 0;
  S.joinRetry = setInterval(() => {
    if (S.role !== 'student') return;

    // Ҳар ду роҳ (WebRTC ё релей) кофист — набояд танҳо WebRTC-ро интизор шавем,
    // вагарна донишҷӯи мобилӣ то охир дар «загрузка» мемонад.
    const linked = linkUp();
    const known = S.participants.some((p) => p.id === S.myId);

    if (linked && known) {
      tries = 0;
      if (!S.netOk) setNetState(true, t('conn.active'));
      return;
    }

    tries++;
    if (!S.relay && typeof mqtt !== 'undefined') initRelay();
    connectToHost();
    sendJoin();

    if (tries === 6) showConnState(t('net.notfound'), false);
    if (tries > 20 && tries % 10 === 0) {
      showConnState(t('net.failed'), false);
    }
  }, 2000);

  setInterval(() => {
    if (S.role !== 'student' || S.phase === 'idle') return;
    send({ type: 'HEARTBEAT', studentId: S.myId });

    // Агар аз муаллим дер боз хабаре набошад — ҳамоҳангсозиро дархост мекунем.
    const silent = S.lastHostMsgAt && Date.now() - S.lastHostMsgAt > 22000;
    if (silent && S.phase !== 'ended') {
      if (!S.warnedLost) {
        S.warnedLost = true;
        toast(t('net.weak'), 'warn');
      }
      send({ type: 'SYNC_REQ', studentId: S.myId });
    } else if (!silent && S.warnedLost) {
      S.warnedLost = false;
      toast(t('net.ok'), 'ok');
    }
  }, 5000);
}

function createStudentPeer() {
  if (typeof Peer === 'undefined') return;
  try {
    S.peer = new Peer(PEER_OPTS);

    S.peer.on('open', () => connectToHost());

    S.peer.on('disconnected', () => {
      if (!S.relayOk) setNetState(false, t('net.cut'));
      try { S.peer.reconnect(); } catch (e) {}
    });

    S.peer.on('close', () => {
      S.hostConn = null;
      setTimeout(() => { if (S.role === 'student') createStudentPeer(); }, 2000);
    });

    S.peer.on('error', (err) => {
      // 'peer-unavailable' = ҳуҷраи муаллим ҳанӯз дар сервер нест.
      // Ин хатои марговар нест — такрор мекунем.
      if (err.type === 'peer-unavailable') { S.hostConn = null; return; }
      if (err.type === 'network' || err.type === 'server-error' || err.type === 'socket-error') {
        S.hostConn = null;
        try { S.peer.destroy(); } catch (e) {}
        setTimeout(() => { if (S.role === 'student') createStudentPeer(); }, 2500);
        return;
      }
      console.warn('[student] peer error', err.type);
    });
  } catch (e) {
    console.warn('PeerJS student init failed', e);
  }
}

/** Пайвасти нав ба муаллим, агар пайвасти ҷорӣ мурда бошад. */
function connectToHost() {
  if (typeof Peer === 'undefined' || !S.peer) return;
  if (S.peer.destroyed) { createStudentPeer(); return; }
  if (S.peer.disconnected) { try { S.peer.reconnect(); } catch (e) {} return; }
  if (!S.peer.open) return;
  if (S.hostConn && S.hostConn.open) return;
  if (S.connecting && Date.now() - S.connecting < 6000) return;

  S.connecting = Date.now();

  // Кӯшиши пешинаи нобарор бояд пӯшида шавад: вагарна ҳар 6 сония як
  // RTCPeerConnection-и мурда ҷамъ мешуд ва браузери телефон банд мемонд.
  if (S.pendingConn) { try { S.pendingConn.close(); } catch (e) {} S.pendingConn = null; }

  try {
    const conn = S.peer.connect(HOST_PEER_PREFIX + S.roomCode, { reliable: true });
    if (!conn) { S.connecting = 0; return; }
    S.pendingConn = conn;
    conn.on('open', () => {
      S.connecting = 0;
      if (S.pendingConn === conn) S.pendingConn = null;
      S.hostConn = conn;
      setNetState(true, t('net.hostback'));
      sendJoin();
      send({ type: 'SYNC_REQ', studentId: S.myId });
    });
    conn.on('data', (d) => handleNetworkMessage(d));
    conn.on('close', () => {
      if (S.hostConn === conn) S.hostConn = null;
      if (S.pendingConn === conn) S.pendingConn = null;
      // Агар релей кор кунад, бозӣ давом дорад — донишҷӯро бе сабаб натарсонем.
      if (!linkUp()) setNetState(false, t('net.hostlost'));
    });
    conn.on('error', () => {
      if (S.hostConn === conn) S.hostConn = null;
      if (S.pendingConn === conn) S.pendingConn = null;
      S.connecting = 0;
    });
  } catch (e) {
    S.connecting = 0;
  }
}

function sendJoin() {
  // Калиди кушоди донишҷӯ дар JOIN меравад ва дар тарафи муаллим «мехкӯб»
  // мешавад — баъд аз ин ҳеҷ кас бо номи ин донишҷӯ ҷавоб фиристода наметавонад.
  send({
    type: 'JOIN',
    studentId: S.myId,
    name: S.userName,
    spub: (S.keys && S.keys.pub) || null
  });
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
    rememberMid(msg.mid);
  }

  // `authorize` ё ҷавоби омодаи boolean медиҳад (вақте тафтиш лозим нест),
  // ё Promise. Дар ҳолати аввал фавран роҳнамоӣ мекунем — то паём як такти
  // иловагӣ дер накунад ва мантиқ синхронӣ монад.
  const verdict = authorize(msg);
  if (verdict === true) { route(msg); return; }
  if (verdict === false) return;
  verdict.then((ok) => { if (ok) route(msg); });
}

/**
 * Оё ин паём воқеан аз касе, ки худро вонамуд мекунад, омадааст?
 *
 * • Донишҷӯ: ҳамаи паёмҳои муаллим бояд бо калиди муаллим имзо шуда бошанд.
 *   Калид аз линк (`#k=...`) гирифта мешавад; агар донишҷӯ бо коди дастӣ
 *   ворид шуда бошад, калиди аввалин муаллим «мехкӯб» мешавад ва баъд
 *   иваз намешавад.
 * • Муаллим: ҳар донишҷӯ ҳангоми JOIN калиди худро медиҳад; баъдтар
 *   ҳамаи паёмҳояш бо ҳамон калид тафтиш мешаванд — то як донишҷӯ ба ҷои
 *   дигаре ҷавоб фиристода натавонад.
 */
function authorize(msg) {
  if (!window.QuizAuth || !QuizAuth.cryptoAvailable()) return true;

  if (S.role === 'student') {
    if (!S.hostPubKey) {
      // TOFU: калиди аввалинро қабул мекунем, баъд дигар иваз намешавад.
      if (!msg.pub) return false;
      return QuizAuth.importPublicKey(msg.pub).then((key) => {
        if (!key) return false;
        return QuizAuth.verifyMessage(key, msg).then((ok) => {
          if (ok) { S.hostPubKey = key; S.hostPubB64 = msg.pub; }
          return ok;
        });
      });
    }
    if (msg.pub && msg.pub !== S.hostPubB64) return false;
    return QuizAuth.verifyMessage(S.hostPubKey, msg);
  }

  if (S.role === 'host') {
    if (msg.type === 'JOIN') {
      if (!msg.spub) return true; // браузери бе крипто
      const known = S.participants.find((x) => x.id === msg.studentId);
      // Агар ин ID аллакай калиди дигар дошта бошад — касе худро ба ҷои
      // донишҷӯи мавҷуда вонамуд мекунад. Рад мекунем.
      if (known && known.pub && known.pub !== msg.spub) return false;
      return QuizAuth.importPublicKey(msg.spub).then((key) => {
        if (!key) return false;
        return QuizAuth.verifyMessage(key, msg).then((ok) => {
          if (ok) msg._key = key;
          return ok;
        });
      });
    }
    const p = S.participants.find((x) => x.id === msg.studentId);
    if (!p) return false;
    if (!p.key) return true; // донишҷӯи бе крипто (браузери кӯҳна)
    return QuizAuth.verifyMessage(p.key, msg);
  }

  return true;
}

function route(msg) {
  if (S.role === 'host') {
    switch (msg.type) {
      case 'JOIN':      return hostOnJoin(msg);
      case 'ANSWER':    return hostOnAnswer(msg);
      case 'HEARTBEAT': return hostOnHeartbeat(msg);
      case 'SYNC_REQ':  return scheduleSnapshot();
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
  applyI18n();
  initUI();
  checkUrlParams();
});

/**
 * Пок кардани ҳамаи осори бозӣ аз ин дастгоҳ.
 *
 * Донишҷӯён одатан дар компютери умумии синфхона кор мекунанд. Пас аз
 * тамом шудани бозӣ ному ID-и онҳо набояд дар браузер монад — вагарна
 * донишҷӯи навбатӣ бо номи ҳамсинфи худ ворид мешавад.
 * Танзими забон нигоҳ дошта мешавад.
 */
function clearQuizStorage() {
  const keep = (typeof LANG_KEY !== 'undefined') ? LANG_KEY : 'quiz_lang';
  try {
    Object.keys(sessionStorage)
      .filter((k) => k.indexOf('cppquiz_') === 0 || k.indexOf('quiz_') === 0)
      .forEach((k) => { if (k !== keep) sessionStorage.removeItem(k); });
  } catch (e) {}
  try {
    Object.keys(localStorage)
      .filter((k) => k !== keep && (k === LS_KEY || k.indexOf('cppquiz_') === 0 || k.indexOf('quiz_') === 0))
      .forEach((k) => localStorage.removeItem(k));
  } catch (e) {}
  S.seenMsgs = new Set();
}

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
    if (confirm(t('msg.endconfirm'))) hostEndQuiz();
  });
  $('btn-restart-game')?.addEventListener('click', () => {
    // Осори бозии гузашта тоза мешавад — то донишҷӯи навбатӣ дар ҳамин
    // компютер бо номи ҳамсинфи худ ворид нашавад.
    clearQuizStorage();
    // Донишҷӯе, ки бо линки муаллим омадааст, дар ҳамон ҳуҷра мемонад —
    // ӯ ҳеҷ гоҳ ба экрани интихоби нақш барнамегардад.
    window.location.href = S.lockedToStudent
      ? window.location.href
      : window.location.origin + window.location.pathname;
  });

  // Забон: ТҶ / РУ
  $('lang-switch')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-lang-btn]');
    if (!btn) return;
    setLang(btn.getAttribute('data-lang-btn'), reRenderAfterLangChange);
  });

  $('input-host-pass')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('btn-create-room').click();
  });
  $('input-student-name')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('input-room-code')?.focus();
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

  // Донишҷӯ табро мебандад — осори бозӣ дар ин компютер намемонад.
  window.addEventListener('pagehide', () => {
    if (S.role === 'student') clearQuizStorage();
  });
}

function onHotkey(e) {
  if (S.role !== 'student' || S.phase !== 'question' || S.myAnswer) return;
  if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
  const map = { '1': 0, '2': 1, '3': 2, '4': 3, 'a': 0, 'b': 1, 'c': 2, 'd': 3 };
  const idx = map[e.key.toLowerCase()];
  if (idx !== undefined) selectOption(idx);
}

function initSegments() {
  const bind = (id, key, parse, after) => {
    const box = $(id);
    if (!box) return;
    box.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const prev = S.settings[key];
      [...box.querySelectorAll('button')].forEach((b) => b.classList.toggle('active', b === btn));
      S.settings[key] = parse(btn.dataset.val);
      if (after && S.settings[key] !== prev) after();
    });
  };
  bind('seg-subject', 'subject', (v) => (v === 'js' ? 'js' : 'cpp'), () => {
    // Фан дар лобби иваз шуд — коди ҳуҷра ва линк низ бояд нав шаванд,
    // вагарна донишҷӯён аз рӯи префикси кӯҳна бонки нодуруст мекушоянд.
    if (S.role !== 'host' || S.phase !== 'lobby') return;
    S.subject = S.settings.subject;
    S.roomCode = generateRoomCode();
    $('display-room-code').textContent = S.roomCode;
    updateShareLink();
    initPeerHost();
    initRelay();
    toast(t('msg.newcode', { c: S.roomCode }), 'warn');
  });
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
  S.subject = /^JS-/i.test(S.roomCode) ? 'js' : 'cpp';

  // Калиди кушоди муаллим дар қисми `#` аст — он ба ҳеҷ сервер намеравад.
  const hash = (window.location.hash || '').replace(/^#/, '');
  const k = new URLSearchParams(hash).get('k');
  if (k) {
    S.hostPubB64 = k;
    if (window.QuizAuth) {
      QuizAuth.importPublicKey(k).then((key) => { S.hostPubKey = key; });
    }
  }

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
  if (role === 'host') setTimeout(() => $('input-host-pass')?.focus(), 120);
}

/**
 * Дарвозаи муаллим. Бе пароли дуруст ҳуҷра сохта намешавад.
 * Баъди чанд кӯшиши нодуруст майдон муваққатан баста мешавад — то паролро
 * бо роҳи озмоиш ёфта натавонанд.
 */
function adminGateOk() {
  const cfg = window.QUIZ_CONFIG || {};
  const now = Date.now();

  if (S.adminLockUntil > now) {
    toast(t('host.locked', { n: Math.ceil((S.adminLockUntil - now) / 1000) }), 'warn');
    return false;
  }

  const pass = ($('input-host-pass')?.value || '');
  if (!pass) { toast(t('host.passempty'), 'warn'); $('input-host-pass')?.focus(); return false; }

  if (!window.QuizAuth || !QuizAuth.checkAdminPassword(pass)) {
    S.adminTries += 1;
    const left = Math.max(0, (cfg.maxAdminTries || 5) - S.adminTries);
    if (left <= 0) {
      S.adminLockUntil = now + (cfg.lockoutMs || 60000);
      S.adminTries = 0;
      toast(t('host.locked', { n: Math.ceil((cfg.lockoutMs || 60000) / 1000) }), 'bad');
    } else {
      toast(t('host.passwrong', { n: left }), 'bad');
    }
    const el = $('input-host-pass');
    if (el) { el.value = ''; el.focus(); }
    return false;
  }

  S.adminTries = 0;
  S.adminOk = true;
  // Паролро дар ҳеҷ ҷо нигоҳ намедорем ва аз майдон фавран пок мекунем.
  const el = $('input-host-pass');
  if (el) el.value = '';
  return true;
}

function toggleSound() {
  S.soundEnabled = !S.soundEnabled;
  const btn = $('btn-sound-toggle');
  if (btn) btn.textContent = S.soundEnabled ? '🔊' : '🔇';
}

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  // Префикс фанро нишон медиҳад: донишҷӯ аз рӯи код мефаҳмад,
  // ки кадом бонки савол лозим аст (CPP-.... ё JS-....).
  let code = (SUBJECTS[S.subject] || SUBJECTS.cpp).prefix + '-';
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
  // Касе, ки бо линки даъват омадааст, дар ҳеҷ ҳолат муаллим шуда
  // наметавонад — ҳатто агар функсияро аз консол даъват кунад.
  // Муаллим барои ҳуҷраи нав саҳифаи асосиро (бе ?room=) мекушояд.
  if (S.lockedToStudent) return;

  // Дарвоза: бе пароли дуруст пеш намеравем.
  if (!S.adminOk && !adminGateOk()) return;

  S.role = 'host';
  S.myId = 'host';
  S.userName = ($('input-host-name').value || '').trim() || t('role.host.title');
  S.subject = S.settings.subject || 'cpp';
  S.roomCode = generateRoomCode();
  S.phase = 'lobby';
  S.participants = [];

  // Ҷуфти калид барои имзои паёмҳо. Калиди махфӣ аз ин дастгоҳ берун намеравад.
  if (window.QuizAuth && QuizAuth.cryptoAvailable()) {
    QuizAuth.generateKeyPair().then((kp) => {
      S.keys = kp;
      updateShareLink();
      broadcastRoster();
    });
  } else {
    console.warn('[quiz] crypto.subtle нест — имзо хомӯш. Сайтро аз https:// кушоед.');
  }

  showScreen('screen-lobby');
  $('display-room-code').textContent = S.roomCode;
  show($('host-share-tools'), true);
  show($('host-settings'), true);
  show($('host-controls'), true);
  show($('student-lobby-msg'), false);
  updateParticipantsUI();

  initPeerHost();
  initRelay();
  updateShareLink();

  setInterval(() => {
    if (S.role !== 'host') return;
    pruneOffline();
    broadcastRoster();
  }, 5000);
}

/**
 * Линки даъват. Калиди кушоди муаллим пас аз `#` меравад — қисми `#`-и URL
 * ба ҳеҷ сервер фиристода намешавад ва танҳо дар браузери донишҷӯ мемонад.
 */
function shareLink() {
  const base = `${window.location.origin}${window.location.pathname}?room=${S.roomCode}`;
  return S.keys && S.keys.pub ? `${base}#k=${S.keys.pub}` : base;
}

function updateShareLink() {
  if (S.role !== 'host') return;
  try { window.history.replaceState({}, '', shareLink()); } catch (e) {}
}

function copyShareableLink() {
  const link = shareLink();
  const done = () => {
    const btn = $('btn-copy-link');
    const orig = btn.innerHTML;
    btn.textContent = t('btn.copied');
    setTimeout(() => (btn.innerHTML = orig), 2500);
  };
  if (navigator.clipboard) {
    navigator.clipboard.writeText(link).then(done).catch(() => prompt(t('btn.copylink'), link));
  } else {
    prompt(t('btn.copylink'), link);
  }
}

/* ------------------------------------------------------------------ */
/*  Донишҷӯ — ворид шудан                                              */
/* ------------------------------------------------------------------ */

function joinRoom(rawName, rawRoom) {
  const name = (rawName || '').trim();
  const room = (rawRoom || '').trim().toUpperCase();

  if (name.length < 2) { toast(t('msg.badname'), 'warn'); return; }
  if (!room) { toast(t('msg.badroom'), 'warn'); return; }

  S.role = 'student';
  S.userName = name;
  S.roomCode = room;
  S.subject = /^JS-/i.test(room) ? 'js' : 'cpp';
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
  showConnState(t('conn.joining'), false);

  // Калиди шахсии донишҷӯ — то касе ба ҷои ӯ ҷавоб фиристода натавонад.
  // Пайвастшавӣ пас аз тайёр шудани калид оғоз мешавад.
  const start = () => { initRelay(); initPeerStudent(); };
  if (window.QuizAuth && QuizAuth.cryptoAvailable()) {
    QuizAuth.generateKeyPair().then((kp) => { S.keys = kp; start(); }).catch(start);
  } else {
    start();
  }
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
    if (msg._key && !p.key) { p.key = msg._key; p.pub = msg.spub; }
  } else {
    const limit = (window.QUIZ_CONFIG && QUIZ_CONFIG.maxStudents) || 120;
    if (S.participants.length >= limit) { toast(t('msg.roomfull'), 'warn'); return; }

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
      lastSeen: Date.now(),
      key: msg._key || null,   // калиди кушоди ин донишҷӯ (мехкӯб мешавад)
      pub: msg.spub || null
    };
    S.participants.push(p);
    playSound('join');
    toast(t('msg.joined', { n: p.name }), 'ok');
  }

  updateParticipantsUI();
  updateAdminPanel();
  scheduleSnapshot(); // вуруди нав — ҳама бояд бинанд (бо танзими сарборӣ)
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
  if (!confirm(t('msg.kickconfirm', { n: p.name }))) return;
  S.participants = S.participants.filter((x) => x.id !== id);
  send({ type: 'KICK', studentId: id });
  updateParticipantsUI();
  updateAdminPanel();
  broadcastRoster();
  toast(t('msg.kicked', { n: p.name }), 'warn');
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

/**
 * Рӯйхати иштирокчиён.
 *
 * Дар синфи 50-нафара ин рӯйхат ~6 КБ аст. Агар онро ҳар дафъа фиристем,
 * канал банд мешавад ва ҷавобҳои донишҷӯён дер мерасанд. Бинобар ин:
 *   • танҳо ҳангоми воқеан тағйир ёфтан фиристода мешавад;
 *   • на бештар аз як маротиба дар 1.2 сония.
 */
function broadcastRoster(force) {
  if (S.role !== 'host') return;

  const payload = rosterPayload();
  const hash = JSON.stringify(payload) + '|' + S.phase;

  // `force` — вуруди нав ё синхронизатсияи дастӣ: бояд фавран равад,
  // ҳатто агар рӯйхат тағйир наёфта бошад ё таймер фаъол бошад.
  if (!force) {
    if (hash === S.lastRosterHash) return;
    if (S.rosterTimer) { S.rosterPending = true; return; }
  }

  S.lastRosterHash = hash;
  clearTimeout(S.rosterTimer);
  send({ type: 'ROSTER', participants: payload, phase: S.phase });

  S.rosterTimer = setTimeout(() => {
    S.rosterTimer = null;
    if (S.rosterPending) { S.rosterPending = false; broadcastRoster(); }
  }, 1200);
}

/**
 * Хабари «кӣ ҷавоб дод». Ҳангоми савол 50 донишҷӯ дар чанд сония ҷавоб
 * медиҳанд — агар ба ҳар ҷавоб як паёми алоҳида фиристем, 50 паёми калон
 * мешавад. Онҳоро дар 400 мс ҷамъ карда, яктоӣ мефиристем.
 */
function broadcastAnswered() {
  if (S.role !== 'host') return;
  if (S.answeredTimer) { S.answeredPending = true; return; }

  sendAnsweredNow();
  S.answeredTimer = setTimeout(() => {
    S.answeredTimer = null;
    if (S.answeredPending) { S.answeredPending = false; broadcastAnswered(); }
  }, 400);
}

function sendAnsweredNow() {
  send({ type: 'ANSWERED', pos: S.qPos, ids: S.answeredIds, total: onlineCount() });
}

/**
 * Ҳангоми оғози дарс даҳҳо донишҷӯ якбора пайваст мешаванд ва ҳар кадом
 * SYNC_REQ мефиристад. Агар ба ҳар яке алоҳида snapshot фиристем, канал банд
 * мешавад ва вурудҳои нав ҷой намемонанд. Дархостҳои такрориро дар 400 мс
 * ҷамъ карда, ЯК snapshot мефиристем (аввалинаш — фавран).
 */
function scheduleSnapshot() {
  if (S.role !== 'host') return;
  const now = Date.now();
  const wait = 700 - (now - (S.lastSnapshotAt || 0));

  if (wait <= 0) {
    S.lastSnapshotAt = now;
    sendStateSnapshot();
    return;
  }
  if (S.snapshotTimer) return;
  S.snapshotTimer = setTimeout(() => {
    S.snapshotTimer = null;
    S.lastSnapshotAt = Date.now();
    sendStateSnapshot();
  }, wait);
}

/** Ба донишҷӯи нав/бозпайвастшуда ҳолати ҷориро мефиристад. */
function sendStateSnapshot() {
  if (S.role !== 'host') return;
  broadcastRoster(true);

  if (S.phase === 'question') {
    send({
      type: 'QUESTION',
      pos: S.qPos,
      qIndex: S.order[S.qPos],
      total: S.order.length,
      duration: S.duration,
      remaining: Math.max(0, S.endsAt - Date.now())
    });
    sendAnsweredNow();
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
      ${S.role === 'host' ? `<button class="kick-btn" title="${escapeHtml(t('title.kick'))}" data-id="${escapeHtml(p.id)}">✕</button>` : ''}
    `;
    const kick = chip.querySelector('.kick-btn');
    if (kick) kick.addEventListener('click', () => hostKick(p.id));
    box.appendChild(chip);
  });
}

function studentOnRoster(msg) {
  S.participants = msg.participants || [];
  updateParticipantsUI();
  // Диққат: ҳалқаи такрорро НАМЕбандем — агар алоқа баъдтар канда шавад,
  // худи ҳамон ҳалқа пайвастро барқарор мекунад.
  if (S.participants.some((p) => p.id === S.myId) && !S.netOk) {
    setNetState(true, t('conn.active'));
  }
}

function studentOnKick(msg) {
  if (msg.studentId !== S.myId) return;
  clearInterval(S.tick);
  clearQuizStorage();
  document.body.innerHTML = '<div class="kicked-screen"><div style="font-size:3rem">🚪</div>' +
    '<h2>' + escapeHtml(t('kick.title')) + '</h2>' +
    '<p>' + escapeHtml(t('kick.sub')) + '</p></div>';
}

/* ------------------------------------------------------------------ */
/*  Муаллим — ҷараёни бозӣ                                             */
/* ------------------------------------------------------------------ */

function hostStartQuiz() {
  if (S.participants.length === 0) {
    if (!confirm(t('msg.nostudents'))) return;
  }

  S.duration = S.settings.duration;
  const QB = bank();
  let idx = QB.map((_, i) => i);
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

  const q = Q(S.order[S.qPos]);
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
  broadcastAnswered();
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

  const q = Q(S.order[S.qPos]);
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
    box.innerHTML = t('q.timeup');
    show(box, true);
  } else if (box) {
    box.className = 'answer-status neutral';
    box.innerHTML = t('q.waitreveal');
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

  // Бозӣ тамом шуд — ному ID-и донишҷӯ дигар лозим нест ва аз ин дастгоҳ
  // тоза мешавад. Натиҷаҳо дар экран мемонанд (дар хотираи саҳифа).
  clearQuizStorage();
}

/** Забон иваз шуд — ҳамаи қисмҳои динамикӣ аз нав кашида мешаванд. */
function reRenderAfterLangChange() {
  if (S.phase === 'lobby' || S.phase === 'idle') {
    updateParticipantsUI();
    return;
  }
  if (S.phase === 'question' || S.phase === 'reveal') {
    const qIndex = S.order[S.qPos];
    if (qIndex !== undefined) {
      renderQuestion(qIndex, S.qPos, S.order.length || S.totalQ);
      if (S.phase === 'reveal' && S.reveal) renderReveal(S.reveal);
      else if (S.role === 'student' && S.myAnswer) restoreMyAnswerUI();
    }
    updateAdminPanel();
    return;
  }
  if (S.phase === 'ended') showLeaderboard(S.standings || [], S.totalQ);
}

/** Пас аз аз нав кашидани савол ҳолати «ҷавоб додам»-ро барқарор мекунад. */
function restoreMyAnswerUI() {
  if (!S.myAnswer) return;
  const idx = S.myAnswer.opt;
  document.querySelectorAll('.option-btn').forEach((btn, i) => {
    btn.disabled = true;
    btn.classList.toggle('selected', i === idx);
    if (i !== idx) btn.classList.add('dimmed');
  });
  const box = $('answer-status');
  if (!box) return;
  box.className = 'answer-status pending';
  box.innerHTML = `
    <span class="pending-badge">${LETTERS[idx]}</span>
    <div>
      <strong>${escapeHtml(t('ans.accepted'))}</strong>
      <p>${escapeHtml(t('ans.acceptedsub'))}</p>
    </div>
    <span class="spinner"></span>`;
  show(box, true);
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
  const q = Q(qIndex);
  if (!q) return;

  showScreen('screen-quiz');
  const isHost = S.role === 'host';

  $('q-counter').textContent = t('q.counter', { n: pos + 1, t: total });
  $('q-category').textContent = L(q.category);
  $('q-title').textContent = L(q.question);

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
    btn.innerHTML = `<span class="option-badge">${LETTERS[i]}</span><span>${escapeHtml(L(text))}</span>`;
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
        <span class="host-option-text">${escapeHtml(L(text))}</span>
        ${isCorrect ? `<span class="correct-tag">${escapeHtml(t('tag.correct'))}</span>` : ''}
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
      <strong>${escapeHtml(t('ans.accepted'))}</strong>
      <p>${escapeHtml(t('ans.acceptedsub'))}</p>
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
  const q = Q(rev.qIndex);
  if (!q) return;

  if (S.role === 'host') {
    renderHostOptions(q, true);
    const exp = $('explanation-box');
    exp.innerHTML = `<strong>${escapeHtml(t('rev.explain'))}</strong> ${escapeHtml(L(q.explanation))}`;
    show(exp, true);
    updateAdminPanel();
    const btn = $('btn-next-question');
    if (btn) btn.textContent = rev.isLast ? t('btn.tolb') : t('btn.next');
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
  const rankTxt = myStanding
    ? t('rev.rank', { r: myStanding.rank, s: myStanding.score })
    : '';
  const rightTxt = t('rev.right', { l: LETTERS[rev.correct] });

  if (!mine) {
    box.className = 'answer-status neutral';
    box.innerHTML = `<span class="pending-badge">—</span><div><strong>${escapeHtml(t('rev.none'))}</strong>
      <p>${rightTxt}${escapeHtml(rankTxt)}</p></div>`;
  } else if (mine.ok) {
    box.className = 'answer-status good';
    box.innerHTML = `<span class="pending-badge">✓</span><div><strong>${escapeHtml(t('rev.good'))}</strong>
      <p>${escapeHtml(t('rev.points', { p: mine.points }))}${escapeHtml(rankTxt)}</p></div>`;
    playSound('correct');
  } else {
    box.className = 'answer-status bad';
    box.innerHTML = `<span class="pending-badge">✕</span><div><strong>${escapeHtml(t('rev.bad'))}</strong>
      <p>${rightTxt}${escapeHtml(rankTxt)}</p></div>`;
    playSound('incorrect');
  }
  show(box, true);

  const exp = $('explanation-box');
  exp.innerHTML = `<strong>${escapeHtml(t('rev.explain'))}</strong> ${escapeHtml(L(q.explanation))}`;
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
  const q = Q(S.order[S.qPos]);
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
      if (!a) cell = `<span class="chip waiting">${escapeHtml(t('chip.waiting'))}</span>`;
      else if (S.phase === 'reveal') cell = `<span class="chip ${a.ok ? 'ok' : 'bad'}">${LETTERS[a.opt]} ${a.ok ? '✓' : '✕'}</span>`;
      else cell = `<span class="chip picked">${LETTERS[a.opt]}</span>`;

      return `<tr class="${p.online ? '' : 'row-offline'}">
        <td><span class="dot ${p.online ? 'on' : 'off'}"></span>${escapeHtml(p.name)}</td>
        <td>${cell}</td>
        <td class="num">${p.score}</td>
        <td><button class="kick-btn sm" data-id="${escapeHtml(p.id)}" title="${escapeHtml(t('title.kick'))}">✕</button></td>
      </tr>`;
    }).join('') || `<tr><td colspan="4" class="empty-row">${escapeHtml(t('monitor.empty'))}</td></tr>`;

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

  const total = totalQuestions || S.order.length || S.totalQ || bank().length;

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
        <div class="podium-score">${escapeHtml(t('lb.points', { p: p.score }))}</div>
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
        <td><strong>${escapeHtml(p.name)}</strong>${p.id === S.myId ? ` <span class="you-tag">${escapeHtml(t('lb.you'))}</span>` : ''}</td>
        <td>${escapeHtml(t('lb.points', { p: p.score }))}</td>
        <td>${correct} / ${total} (${acc}%)</td>
      </tr>`;
    }).join('') || `<tr><td colspan="4" class="empty-row">${escapeHtml(t('lb.empty'))}</td></tr>`;
  }

  const me = standings.find((p) => p.id === S.myId);
  const card = $('my-result-card');
  if (card && S.role === 'student' && me) {
    card.innerHTML = `
      <div class="my-rank">#${me.rank || standings.indexOf(me) + 1}</div>
      <div>
        <strong>${escapeHtml(me.name)}</strong>
        <p>${escapeHtml(t('lb.myline', { p: me.score, c: me.correct != null ? me.correct : 0, t: total }))}</p>
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
      return `<span class="qdot ${cls}" title="${escapeHtml(t('title.question', { n: pos + 1 }))}"></span>`;
    }).join('');

    return `<tr>
      <td><strong>${escapeHtml(p.name)}</strong></td>
      <td class="num">${p.score}</td>
      <td class="num">${correct}/${total}</td>
      <td class="num">${acc}%</td>
      <td class="num">${avg}${escapeHtml(t('unit.sec'))}</td>
      <td><div class="qdots">${dots}</div></td>
    </tr>`;
  }).join('') || `<tr><td colspan="6" class="empty-row">${escapeHtml(t('report.empty'))}</td></tr>`;
}

function exportCsv() {
  const total = S.order.length;
  const head = [t('csv.name'), t('csv.score'), t('csv.right'), t('csv.answered'), t('csv.acc'), t('csv.avgtime')];
  for (let i = 1; i <= total; i++) head.push(t('csv.q') + i);

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
  toast(t('msg.csvok'), 'ok');
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
