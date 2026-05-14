// ══════════════════════════════════════════════════════════
//  PIXEL QUEST — Admin Client
// ══════════════════════════════════════════════════════════

const socket = io();

const OPTION_LETTERS = ["A", "B", "C", "D"];
const AVATAR_EMOJI = { wizard:"🧙", artist:"🎨", coder:"💻", student:"📚" };
let answeredThisRound = new Set();
let currentQuestionData = null;
let totalPlayers = 0;

// ── Auth ──
document.getElementById("admin-login-btn").addEventListener("click", doLogin);
document.getElementById("admin-password").addEventListener("keydown", e => {
  if (e.key === "Enter") doLogin();
});

function doLogin() {
  const pw = document.getElementById("admin-password").value;
  socket.emit("admin_auth", { password: pw });
}

socket.on("admin_auth_ok", ({ players, phase, currentQuestion, totalQuestions }) => {
  document.getElementById("admin-login").classList.remove("active");
  document.getElementById("admin-dashboard").classList.add("active");
  document.getElementById("game-link").textContent = window.location.origin;
  setPhase(phase);
  // Restore existing players if reconnecting
  players.forEach(p => addPlayerRow(p));
  document.getElementById("player-total-badge").textContent = players.length;
  totalPlayers = players.length;
  log("admin", "🔑 Admin dashboard connected");
});

socket.on("admin_auth_fail", () => {
  document.getElementById("login-error").classList.remove("hidden");
  setTimeout(() => document.getElementById("login-error").classList.add("hidden"), 3000);
});

// ── Copy link ──
document.getElementById("copy-link-btn").addEventListener("click", () => {
  const link = document.getElementById("game-link").textContent;
  navigator.clipboard.writeText(link).then(() => {
    const btn = document.getElementById("copy-link-btn");
    btn.textContent = "✅ Copied!";
    setTimeout(() => btn.textContent = "📋 Copy", 2000);
  });
});

// ── Admin controls ──
document.getElementById("btn-start").addEventListener("click", () => {
  socket.emit("admin_start");
});
document.getElementById("btn-next").addEventListener("click", () => {
  socket.emit("admin_next");
  document.getElementById("btn-next").classList.add("hidden");
  document.getElementById("stats-result").classList.add("hidden");
  document.getElementById("stats-question").classList.remove("hidden");
  answeredThisRound.clear();
});
document.getElementById("btn-reset").addEventListener("click", () => {
  if (!confirm("Reset the game? This will clear all players and scores.")) return;
  socket.emit("admin_reset");
});
document.getElementById("clear-log-btn").addEventListener("click", () => {
  document.getElementById("activity-log").innerHTML = "";
});

// ── Phase management ──
function setPhase(phase) {
  const badge = document.getElementById("phase-badge");
  const btnStart = document.getElementById("btn-start");
  const btnNext  = document.getElementById("btn-next");

  badge.textContent = phase.toUpperCase();

  if (phase === "lobby") {
    btnStart.classList.remove("hidden");
    btnNext.classList.add("hidden");
    showStatsPanel("waiting");
  } else if (phase === "question") {
    btnStart.classList.add("hidden");
    btnNext.classList.add("hidden");
    showStatsPanel("question");
  } else if (phase === "results") {
    btnStart.classList.add("hidden");
    btnNext.classList.remove("hidden");
    showStatsPanel("result");
  } else if (phase === "leaderboard") {
    btnStart.classList.add("hidden");
    btnNext.classList.add("hidden");
    showStatsPanel("leaderboard");
  }
}

function showStatsPanel(which) {
  ["stats-waiting","stats-question","stats-result","stats-leaderboard"].forEach(id => {
    document.getElementById(id).classList.add("hidden");
  });
  document.getElementById(`stats-${which}`).classList.remove("hidden");
}

// ── Players ──
socket.on("player_joined", ({ id, name, avatar, joinedAt, totalPlayers: tp }) => {
  totalPlayers = tp;
  addPlayerRow({ id, name, avatar, joinedAt });
  document.getElementById("player-total-badge").textContent = tp;
  log("join", `👤 ${name} joined (${AVATAR_EMOJI[avatar] || "🎮"}) — ${tp} total`);
});

socket.on("player_left", ({ id, name, totalPlayers: tp }) => {
  totalPlayers = tp;
  const el = document.getElementById(`player-${id}`);
  if (el) el.remove();
  const list = document.getElementById("players-list");
  if (list.children.length === 0) list.innerHTML = '<p class="empty-hint">No players yet. Share the game link!</p>';
  document.getElementById("player-total-badge").textContent = tp;
  log("leave", `👋 ${name} disconnected — ${tp} remaining`);
});

function addPlayerRow({ id, name, avatar, joinedAt }) {
  const list = document.getElementById("players-list");
  // Remove empty hint
  const hint = list.querySelector(".empty-hint");
  if (hint) hint.remove();

  const timeStr = new Date(joinedAt).toLocaleTimeString();
  const div = document.createElement("div");
  div.className = "player-row";
  div.id = `player-${id}`;
  div.innerHTML = `
    <span class="player-row-avatar">${AVATAR_EMOJI[avatar] || "🎮"}</span>
    <span class="player-row-name">${name}</span>
    <span class="player-row-time">${timeStr}</span>
    <span class="player-row-answered" id="ans-${id}"></span>
  `;
  list.appendChild(div);
}

// ── New question ──
socket.on("new_question", ({ questionIndex, total, question, options, correct, timeLimit }) => {
  answeredThisRound.clear();
  currentQuestionData = { questionIndex, total, question, options, correct };
  setPhase("question");

  document.getElementById("admin-q-num").textContent = `Q${questionIndex + 1} of ${total}`;
  document.getElementById("admin-q-text").textContent = question;
  document.getElementById("admin-answered-count").textContent = "0 answered";

  // Options list
  const optList = document.getElementById("admin-options-list");
  optList.innerHTML = "";
  options.forEach((opt, i) => {
    const div = document.createElement("div");
    div.className = `admin-option-row${i === correct ? " correct-opt" : ""}`;
    div.innerHTML = `<span class="opt-idx">${OPTION_LETTERS[i]}</span>${opt}${i === correct ? " ✅" : ""}`;
    optList.appendChild(div);
  });

  // Clear bars
  document.getElementById("answer-bars").innerHTML = "";
  renderBars([0,0,0,0], options, correct);

  log("admin", `📝 Question ${questionIndex + 1} started`);
});

// ── Player answered ──
socket.on("player_answered", ({ id, name, answerIndex, correct, answeredCount, totalPlayers: tp }) => {
  answeredThisRound.add(id);
  document.getElementById("admin-answered-count").textContent = `${answeredCount}/${tp} answered`;

  // Update player row indicator
  const ans = document.getElementById(`ans-${id}`);
  if (ans) ans.textContent = correct ? "✅" : "❌";

  log("answer", `${correct ? "✅" : "❌"} ${name} answered ${OPTION_LETTERS[answerIndex]}`);
});

// ── Question result ──
socket.on("question_result", ({ questionIndex, correct, tally, leaderboard }) => {
  setPhase("results");

  // Results panel
  document.getElementById("result-q-num").textContent = questionIndex + 1;
  const opts = currentQuestionData ? currentQuestionData.options : [];
  renderResultBars(tally, opts, correct);

  // Mini leaderboard top 5
  const lbEl = document.getElementById("result-leaderboard");
  lbEl.innerHTML = "<h4>🏆 Top Players</h4>" + buildMiniLB(leaderboard.slice(0, 5));

  log("admin", `📊 Q${questionIndex + 1} results: tally ${JSON.stringify(tally)}`);
});

// ── Game over ──
socket.on("game_over", ({ leaderboard }) => {
  setPhase("leaderboard");
  document.getElementById("final-lb-admin").innerHTML = buildFullLB(leaderboard);
  log("admin", "🏁 Game over! Final leaderboard shown.");
});

socket.on("game_starting", () => {
  setPhase("question");
  log("admin", "🚀 Game starting!");
});

socket.on("game_reset", () => {
  document.getElementById("players-list").innerHTML = '<p class="empty-hint">No players yet. Share the game link!</p>';
  document.getElementById("player-total-badge").textContent = "0";
  totalPlayers = 0;
  setPhase("lobby");
  showStatsPanel("waiting");
  log("admin", "↺ Game was reset");
});

socket.on("admin_error", ({ msg }) => {
  alert("⚠️ " + msg);
});

// ── Bar charts ──
function renderBars(tally, options, correct) {
  const container = document.getElementById("answer-bars");
  container.innerHTML = "";
  const max = Math.max(...tally, 1);
  tally.forEach((count, i) => {
    const pct = Math.round((count / max) * 100);
    const div = document.createElement("div");
    div.className = "bar-row";
    div.innerHTML = `
      <span class="bar-label">${OPTION_LETTERS[i]}</span>
      <div class="bar-track">
        <div class="bar-fill${i === correct ? " correct-bar" : ""}" style="width:${pct}%"></div>
      </div>
      <span class="bar-count">${count}</span>
    `;
    container.appendChild(div);
  });
}

function renderResultBars(tally, options, correct) {
  const container = document.getElementById("result-bars");
  container.innerHTML = "";
  const max = Math.max(...tally, 1);
  tally.forEach((count, i) => {
    const pct = Math.round((count / max) * 100);
    const div = document.createElement("div");
    div.className = "bar-row";
    div.innerHTML = `
      <span class="bar-label">${OPTION_LETTERS[i]}</span>
      <div class="bar-track">
        <div class="bar-fill${i === correct ? " correct-bar" : ""}" style="width:${pct}%"></div>
      </div>
      <span class="bar-count">${count}</span>
    `;
    container.appendChild(div);
  });
}

// ── Leaderboard builders ──
function buildMiniLB(lb) {
  const medals = ["🥇","🥈","🥉"];
  return lb.map((p, i) => `
    <div class="lb-row rank-${i+1}">
      <span class="lb-rank">${medals[i] || `#${i+1}`}</span>
      <span class="lb-avatar">${AVATAR_EMOJI[p.avatar] || "🎮"}</span>
      <span class="lb-name">${p.name}</span>
      <span class="lb-score">${p.score} pts</span>
    </div>
  `).join("");
}

function buildFullLB(lb) {
  const medals = ["🥇","🥈","🥉"];
  return lb.map((p, i) => `
    <div class="lb-row rank-${i+1}">
      <span class="lb-rank">${medals[i] || `#${i+1}`}</span>
      <span class="lb-avatar">${AVATAR_EMOJI[p.avatar] || "🎮"}</span>
      <span class="lb-name">${p.name}</span>
      <span class="lb-score">${p.score} pts</span>
    </div>
  `).join("");
}

// ── Activity log ──
function log(type, msg) {
  const log = document.getElementById("activity-log");
  const now = new Date().toLocaleTimeString();
  const entry = document.createElement("div");
  entry.className = `log-entry log-${type}`;
  entry.innerHTML = `<span class="log-time">${now}</span><span>${msg}</span>`;
  log.appendChild(entry);
  log.scrollTop = log.scrollHeight;
}
