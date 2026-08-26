/**
 * C++ Quiz Master - Interactive Real-time Quiz Application Logic
 * Supports PeerJS (WebRTC) + BroadcastChannel / LocalStorage Sync
 */

// Application State
const state = {
  role: null, // 'host' | 'student'
  userName: '',
  roomCode: '',
  peer: null,
  connections: [], // Host connections to students
  hostConn: null,  // Student connection to host
  participants: [], // List of { id, name, score: 0, answers: [] }
  currentQuestionIndex: 0,
  timer: 20,
  timerInterval: null,
  userSelectedOption: null,
  hasAnswered: false,
  soundEnabled: true,
  audioCtx: null
};

// Web Audio API Sound Generator
function playSound(type) {
  if (!state.soundEnabled) return;
  try {
    if (!state.audioCtx) {
      state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    const ctx = state.audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    if (type === 'correct') {
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.15); // E5
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (type === 'incorrect') {
      osc.frequency.setValueAtTime(220, now); // A3
      osc.frequency.exponentialRampToValueAtTime(164.81, now + 0.2); // E3
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (type === 'tick') {
      osc.frequency.setValueAtTime(800, now);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === 'win') {
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, idx) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.value = freq;
        o.connect(g);
        g.connect(ctx.destination);
        g.gain.setValueAtTime(0.2, now + idx * 0.1);
        g.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.1 + 0.3);
        o.start(now + idx * 0.1);
        o.stop(now + idx * 0.1 + 0.3);
      });
    }
  } catch (e) {
    console.warn("Audio context not supported", e);
  }
}

// BroadcastChannel fallback for local multi-window testing
let bc = null;
if (typeof BroadcastChannel !== 'undefined') {
  bc = new BroadcastChannel('cpp_quiz_channel');
  bc.onmessage = (event) => {
    handleNetworkMessage(event.data);
  };
}

// Initialize on DOM Loaded
document.addEventListener('DOMContentLoaded', () => {
  initUI();
  checkUrlParams();
});

function initUI() {
  // Role selector cards
  const cardHost = document.getElementById('card-role-host');
  const cardStudent = document.getElementById('card-role-student');

  if (cardHost && cardStudent) {
    cardHost.addEventListener('click', () => selectRole('host'));
    cardStudent.addEventListener('click', () => selectRole('student'));
  }

  // Buttons
  document.getElementById('btn-create-room')?.addEventListener('click', createRoom);
  document.getElementById('btn-join-room')?.addEventListener('click', joinRoom);
  document.getElementById('btn-start-game')?.addEventListener('click', startQuiz);
  document.getElementById('btn-next-question')?.addEventListener('click', hostNextQuestion);
  document.getElementById('btn-restart-game')?.addEventListener('click', () => window.location.reload());
  document.getElementById('btn-copy-link')?.addEventListener('click', copyShareableLink);
  document.getElementById('btn-sound-toggle')?.addEventListener('click', toggleSound);

  // Storage listener fallback
  window.addEventListener('storage', (e) => {
    if (e.key === 'cpp_quiz_event' && e.newValue) {
      try {
        const data = JSON.parse(e.newValue);
        handleNetworkMessage(data);
      } catch (err) {}
    }
  });
}

function checkUrlParams() {
  const urlParams = new URLSearchParams(window.location.search);
  const room = urlParams.get('room');
  if (room) {
    document.getElementById('input-room-code').value = room;
    selectRole('student');
  }
}

function selectRole(role) {
  state.role = role;
  document.getElementById('card-role-host')?.classList.toggle('active', role === 'host');
  document.getElementById('card-role-student')?.classList.toggle('active', role === 'student');

  if (role === 'host') {
    document.getElementById('form-host')?.classList.remove('hidden');
    document.getElementById('form-student')?.classList.add('hidden');
  } else {
    document.getElementById('form-student')?.classList.remove('hidden');
    document.getElementById('form-host')?.classList.add('hidden');
  }
}

function toggleSound() {
  state.soundEnabled = !state.soundEnabled;
  const btn = document.getElementById('btn-sound-toggle');
  if (btn) {
    btn.textContent = state.soundEnabled ? '🔊' : '🔇';
  }
}

// Generate Room Code
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'CPP-';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Host creates room
function createRoom() {
  const hostNameInput = document.getElementById('input-host-name').value.trim();
  state.userName = hostNameInput || 'Муаллим';
  state.roomCode = generateRoomCode();

  // Show Lobby Screen
  showScreen('screen-lobby');
  document.getElementById('display-room-code').textContent = state.roomCode;
  document.getElementById('host-controls').classList.remove('hidden');
  document.getElementById('student-lobby-msg').classList.add('hidden');

  // Add Host to participants list
  state.participants = [{
    id: 'host_id',
    name: state.userName + ' (Муаллим)',
    score: 0,
    answers: []
  }];
  updateParticipantsUI();

  // Initialize PeerJS Host
  initPeerHost();

  // Update URL
  const newUrl = `${window.location.origin}${window.location.pathname}?room=${state.roomCode}`;
  window.history.pushState({ path: newUrl }, '', newUrl);
}

// Student joins room
function joinRoom() {
  const name = document.getElementById('input-student-name').value.trim();
  const room = document.getElementById('input-room-code').value.trim().toUpperCase();

  if (!name) {
    alert('Лутфан, номи худро ворид кунед!');
    return;
  }
  if (!room) {
    alert('Лутфан, коди ҳуҷраро ворид кунед!');
    return;
  }

  state.userName = name;
  state.roomCode = room;

  showScreen('screen-lobby');
  document.getElementById('display-room-code').textContent = state.roomCode;
  document.getElementById('host-controls').classList.add('hidden');
  document.getElementById('student-lobby-msg').classList.remove('hidden');

  // Connect via PeerJS / Broadcast
  initPeerStudent();
}

function copyShareableLink() {
  const link = `${window.location.origin}${window.location.pathname}?room=${state.roomCode}`;
  navigator.clipboard.writeText(link).then(() => {
    const btn = document.getElementById('btn-copy-link');
    const origText = btn.textContent;
    btn.textContent = '✓ Линка Нусхабардорӣ Шуд!';
    setTimeout(() => btn.textContent = origText, 2500);
  }).catch(() => {
    alert('Линки ҳуҷра: ' + link);
  });
}

// --- Network Layer (PeerJS + Local Broadcast Fallback) ---
function initPeerHost() {
  if (typeof Peer !== 'undefined') {
    try {
      const peerId = 'cpp-quiz-' + state.roomCode;
      state.peer = new Peer(peerId);
      state.peer.on('open', (id) => {
        console.log('Host Peer opened:', id);
      });
      state.peer.on('connection', (conn) => {
        state.connections.push(conn);
        conn.on('data', (data) => handleNetworkMessage(data, conn));
      });
      state.peer.on('error', (err) => {
        console.warn('PeerJS fallback enabled', err);
      });
    } catch (e) {
      console.warn("PeerJS init error", e);
    }
  }
}

function initPeerStudent() {
  let connected = false;
  if (typeof Peer !== 'undefined') {
    try {
      state.peer = new Peer();
      state.peer.on('open', (myId) => {
        const hostPeerId = 'cpp-quiz-' + state.roomCode;
        const conn = state.peer.connect(hostPeerId);
        state.hostConn = conn;

        conn.on('open', () => {
          connected = true;
          sendNetworkMessage({
            type: 'JOIN_ROOM',
            room: state.roomCode,
            studentId: myId,
            name: state.userName
          });
        });

        conn.on('data', (data) => handleNetworkMessage(data));
      });
    } catch (e) {}
  }

  // Send JOIN via Local Broadcast Fallback regardless
  setTimeout(() => {
    sendNetworkMessage({
      type: 'JOIN_ROOM',
      room: state.roomCode,
      studentId: 'student_' + Math.random().toString(36).substr(2, 6),
      name: state.userName
    });
  }, 300);
}

function sendNetworkMessage(msg) {
  // If Host, send to all connected student peers
  if (state.role === 'host') {
    state.connections.forEach(conn => {
      if (conn.open) conn.send(msg);
    });
  } else if (state.hostConn && state.hostConn.open) {
    state.hostConn.send(msg);
  }

  // Send to BroadcastChannel
  if (bc) bc.postMessage(msg);

  // Send to localStorage for multi-tab fallback
  try {
    localStorage.setItem('cpp_quiz_event', JSON.stringify({ ...msg, _t: Date.now() }));
  } catch (e) {}
}

function handleNetworkMessage(msg) {
  if (!msg || msg.room !== state.roomCode) return;

  switch (msg.type) {
    case 'JOIN_ROOM':
      if (state.role === 'host') {
        const exists = state.participants.find(p => p.id === msg.studentId || p.name === msg.name);
        if (!exists) {
          state.participants.push({
            id: msg.studentId,
            name: msg.name,
            score: 0,
            answers: []
          });
          updateParticipantsUI();
          // Broadcast updated participant list to all
          sendNetworkMessage({
            type: 'PARTICIPANTS_UPDATE',
            room: state.roomCode,
            participants: state.participants
          });
        }
      }
      break;

    case 'PARTICIPANTS_UPDATE':
      if (state.role === 'student') {
        state.participants = msg.participants;
        updateParticipantsUI();
      }
      break;

    case 'START_QUIZ':
      state.currentQuestionIndex = msg.questionIndex || 0;
      showQuizScreen();
      loadQuestion(state.currentQuestionIndex);
      break;

    case 'NEXT_QUESTION':
      state.currentQuestionIndex = msg.questionIndex;
      loadQuestion(state.currentQuestionIndex);
      break;

    case 'SUBMIT_ANSWER':
      if (state.role === 'host') {
        handleStudentAnswer(msg.studentId, msg.questionIndex, msg.optionIndex, msg.timeLeft);
      }
      break;

    case 'END_QUIZ':
      showLeaderboard(msg.finalStandings || state.participants);
      break;
  }
}

function updateParticipantsUI() {
  const container = document.getElementById('participants-grid');
  const countSpan = document.getElementById('participant-count');
  if (!container) return;

  if (countSpan) countSpan.textContent = state.participants.length;
  container.innerHTML = '';

  state.participants.forEach(p => {
    const chip = document.createElement('div');
    chip.className = 'participant-chip';
    const firstLetter = p.name.charAt(0).toUpperCase();
    chip.innerHTML = `
      <div class="participant-avatar">${firstLetter}</div>
      <span>${escapeHtml(p.name)}</span>
    `;
    container.appendChild(chip);
  });
}

// --- Quiz Engine ---
function startQuiz() {
  if (state.participants.length === 0) {
    alert('Ҳеҷ иштирокчӣ нест!');
    return;
  }

  sendNetworkMessage({
    type: 'START_QUIZ',
    room: state.roomCode,
    questionIndex: 0
  });

  showQuizScreen();
  loadQuestion(0);
}

function showScreen(screenId) {
  ['screen-welcome', 'screen-lobby', 'screen-quiz', 'screen-leaderboard'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden', id !== screenId);
  });
}

function showQuizScreen() {
  showScreen('screen-quiz');
  if (state.role === 'host') {
    document.getElementById('host-quiz-controls')?.classList.remove('hidden');
  } else {
    document.getElementById('host-quiz-controls')?.classList.add('hidden');
  }
}

function loadQuestion(index) {
  clearInterval(state.timerInterval);
  state.currentQuestionIndex = index;
  state.hasAnswered = false;
  state.userSelectedOption = null;
  state.timer = 20;

  const q = cppQuestions[index];
  if (!q) {
    finishQuiz();
    return;
  }

  // Update UI Elements
  document.getElementById('q-counter').textContent = `Саволи ${index + 1} аз ${cppQuestions.length}`;
  document.getElementById('q-category').textContent = q.category;
  document.getElementById('q-title').textContent = q.question;

  // Code snippet
  const codeBox = document.getElementById('q-code');
  if (q.code) {
    codeBox.textContent = q.code;
    codeBox.classList.remove('hidden');
  } else {
    codeBox.classList.add('hidden');
  }

  // Options
  const optionsGrid = document.getElementById('options-grid');
  optionsGrid.innerHTML = '';
  const optionLetters = ['A', 'B', 'C', 'D'];

  q.options.forEach((optText, i) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.innerHTML = `
      <span class="option-badge">${optionLetters[i]}</span>
      <span>${escapeHtml(optText)}</span>
    `;
    btn.onclick = () => selectOption(i);
    optionsGrid.appendChild(btn);
  });

  // Hide explanation
  document.getElementById('explanation-box')?.classList.add('hidden');

  // Update Progress Bar
  const fill = document.getElementById('progress-bar-fill');
  if (fill) {
    const pct = ((index + 1) / cppQuestions.length) * 100;
    fill.style.width = `${pct}%`;
  }

  // Start Timer
  startTimer();
}

function startTimer() {
  const timerDisplay = document.getElementById('timer-display');
  const timerBox = document.getElementById('timer-box');
  
  if (timerDisplay) timerDisplay.textContent = state.timer;
  timerBox?.classList.remove('urgent');

  state.timerInterval = setInterval(() => {
    state.timer--;
    if (timerDisplay) timerDisplay.textContent = state.timer;

    if (state.timer <= 5) {
      timerBox?.classList.add('urgent');
      playSound('tick');
    }

    if (state.timer <= 0) {
      clearInterval(state.timerInterval);
      handleTimeOut();
    }
  }, 1000);
}

function selectOption(optionIndex) {
  if (state.hasAnswered) return;
  state.hasAnswered = true;
  state.userSelectedOption = optionIndex;
  clearInterval(state.timerInterval);

  const q = cppQuestions[state.currentQuestionIndex];
  const optionBtns = document.querySelectorAll('.option-btn');

  optionBtns.forEach((btn, i) => {
    btn.disabled = true;
    if (i === optionIndex) {
      btn.classList.add('selected');
    }
  });

  // Check correctness
  const isCorrect = (optionIndex === q.correct);
  if (isCorrect) {
    optionBtns[optionIndex].classList.add('correct');
    playSound('correct');
  } else {
    optionBtns[optionIndex].classList.add('incorrect');
    optionBtns[q.correct].classList.add('correct');
    playSound('incorrect');
  }

  // Show explanation
  const expBox = document.getElementById('explanation-box');
  if (expBox) {
    expBox.innerHTML = `<strong>💡 Шарҳ:</strong> ${q.explanation}`;
    expBox.classList.remove('hidden');
  }

  // Submit Answer to Host / State
  sendNetworkMessage({
    type: 'SUBMIT_ANSWER',
    room: state.roomCode,
    studentId: state.peer?.id || 'host_id',
    questionIndex: state.currentQuestionIndex,
    optionIndex: optionIndex,
    timeLeft: state.timer
  });
}

function handleTimeOut() {
  if (state.hasAnswered) return;
  state.hasAnswered = true;

  const q = cppQuestions[state.currentQuestionIndex];
  const optionBtns = document.querySelectorAll('.option-btn');

  optionBtns.forEach((btn, i) => {
    btn.disabled = true;
    if (i === q.correct) {
      btn.classList.add('correct');
    }
  });

  playSound('incorrect');

  const expBox = document.getElementById('explanation-box');
  if (expBox) {
    expBox.innerHTML = `<strong>⏰ Вақт ба охир расид!</strong> ${q.explanation}`;
    expBox.classList.remove('hidden');
  }
}

function handleStudentAnswer(studentId, questionIndex, optionIndex, timeLeft) {
  const participant = state.participants.find(p => p.id === studentId);
  if (!participant) return;

  const q = cppQuestions[questionIndex];
  if (!q) return;

  const isCorrect = (optionIndex === q.correct);
  let points = 0;

  if (isCorrect) {
    // 1000 base points + speed bonus
    points = 1000 + (timeLeft * 25);
  }

  participant.score += points;
  participant.answers.push({
    questionIndex,
    optionIndex,
    isCorrect,
    points
  });
}

function hostNextQuestion() {
  if (state.currentQuestionIndex + 1 < cppQuestions.length) {
    const nextIdx = state.currentQuestionIndex + 1;
    sendNetworkMessage({
      type: 'NEXT_QUESTION',
      room: state.roomCode,
      questionIndex: nextIdx
    });
    loadQuestion(nextIdx);
  } else {
    finishQuiz();
  }
}

function finishQuiz() {
  clearInterval(state.timerInterval);

  // Sort participants by score descending
  state.participants.sort((a, b) => b.score - a.score);

  sendNetworkMessage({
    type: 'END_QUIZ',
    room: state.roomCode,
    finalStandings: state.participants
  });

  showLeaderboard(state.participants);
}

// --- Leaderboard & Podium Rendering ---
function showLeaderboard(standings) {
  showScreen('screen-leaderboard');
  playSound('win');

  // Trigger Confetti Effect
  triggerConfetti();

  // Render Podium (1st, 2nd, 3rd)
  const podiumContainer = document.getElementById('podium-container');
  if (podiumContainer) {
    podiumContainer.innerHTML = '';

    const top3 = [
      standings[1] || null, // 2nd Place (Left)
      standings[0] || null, // 1st Place (Center)
      standings[2] || null  // 3rd Place (Right)
    ];

    const classes = ['second', 'first', 'third'];
    const medals = ['🥈', '🥇', '🥉'];

    top3.forEach((p, idx) => {
      if (!p) return;
      const step = document.createElement('div');
      step.className = `podium-step ${classes[idx]}`;
      step.innerHTML = `
        <div class="podium-avatar">${medals[idx]}</div>
        <div class="podium-name">${escapeHtml(p.name)}</div>
        <div class="podium-score">${p.score} бал</div>
        <div class="podium-pillar">${idx === 1 ? '1' : idx === 0 ? '2' : '3'}</div>
      `;
      podiumContainer.appendChild(step);
    });
  }

  // Render Rankings Table
  const tableBody = document.getElementById('rankings-table-body');
  if (tableBody) {
    tableBody.innerHTML = '';
    standings.forEach((p, idx) => {
      const tr = document.createElement('tr');
      const rankClass = idx === 0 ? 'rank-1' : idx === 1 ? 'rank-2' : idx === 2 ? 'rank-3' : '';
      
      const correctCount = p.answers ? p.answers.filter(a => a.isCorrect).length : 0;
      const totalAnswered = p.answers ? p.answers.length : 0;
      const accuracy = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;

      tr.innerHTML = `
        <td><span class="rank-badge ${rankClass}">${idx + 1}</span></td>
        <td><strong>${escapeHtml(p.name)}</strong></td>
        <td>${p.score} бал</td>
        <td>${correctCount} / ${cppQuestions.length} (${accuracy}%)</td>
      `;
      tableBody.appendChild(tr);
    });
  }
}

// Confetti Particle Generator
function triggerConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = [];
  const colors = ['#00f2fe', '#6366f1', '#a855f7', '#10b981', '#f59e0b', '#f43f5e'];

  for (let i = 0; i < 120; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      vy: Math.random() * 3 + 2,
      vx: Math.random() * 2 - 1,
      rotation: Math.random() * 360
    });
  }

  let animationFrame;
  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.y += p.vy;
      p.x += p.vx;
      p.rotation += 2;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    });

    if (particles.some(p => p.y < canvas.height)) {
      animationFrame = requestAnimationFrame(render);
    }
  }
  render();
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, match => {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return map[match];
  });
}
