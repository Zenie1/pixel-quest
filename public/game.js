// ══════════════════════════════════════════════════════════
//  PIXEL QUEST — Player Client
// ══════════════════════════════════════════════════════════

const socket = io();

// ── State ──
let myName = "";
let myAvatar = "wizard";
let myScore  = 0;
let hasAnswered = false;
let timerInterval = null;

const AVATAR_LABELS = {
  wizard:  "The Self-Taught Wizard",
  artist:  "The Digital Artist",
  coder:   "The Open-Source Coder",
  student: "The MOOC Student"
};
const AVATAR_EMOJI = { wizard:"🧙", artist:"🎨", coder:"💻", student:"📚" };
const OPTION_LETTERS = ["A", "B", "C", "D"];

// ── Screen management ──
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const el = document.getElementById(id);
  if (el) el.classList.add("active");
}

// ── Avatar picker ──
document.querySelectorAll(".avatar-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".avatar-btn").forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    myAvatar = btn.dataset.avatar;
    document.getElementById("avatar-label").textContent = AVATAR_LABELS[myAvatar];
  });
});

// ── Join button ──
document.getElementById("join-btn").addEventListener("click", joinGame);
document.getElementById("name-input").addEventListener("keydown", e => {
  if (e.key === "Enter") joinGame();
});

function joinGame() {
  const name = document.getElementById("name-input").value.trim();
  if (!name) {
    showError("Please enter your name!");
    return;
  }
  myName = name;
  socket.emit("player_join", { name, avatar: myAvatar });
}

function showError(msg) {
  const el = document.getElementById("lobby-error");
  el.textContent = msg;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 3000);
}

// ── Socket events ──
socket.on("join_ok", ({ name }) => {
  document.getElementById("my-name-display").textContent = name;
  document.getElementById("my-avatar-display").textContent = AVATAR_EMOJI[myAvatar];
  showScreen("screen-waiting");
});

socket.on("join_rejected", ({ reason }) => showError(reason));

socket.on("lobby_update", ({ count }) => {
  const el = document.getElementById("player-count");
  if (el) el.textContent = count;
});

// ── Countdown ──
socket.on("game_starting", ({ countdown }) => {
  showScreen("screen-countdown");
  let n = countdown;
  document.getElementById("countdown-num").textContent = n;
  const t = setInterval(() => {
    n--;
    const el = document.getElementById("countdown-num");
    if (el) {
      el.style.animation = "none";
      void el.offsetWidth; // reflow
      el.style.animation = "zoomIn 0.4s ease";
      el.textContent = n > 0 ? n : "GO!";
    }
    if (n <= 0) clearInterval(t);
  }, 1000);
});

// ── New question ──
socket.on("new_question", ({ questionIndex, total, question, options, timeLimit }) => {
  hasAnswered = false;
  myScore = myScore; // keep current

  showScreen("screen-question");

  document.getElementById("q-number").textContent = `Q${questionIndex + 1}`;
  document.getElementById("q-of").textContent = `of ${total}`;
  document.getElementById("question-text").textContent = question;

  // Build options
  const grid = document.getElementById("options-grid");
  grid.innerHTML = "";
  options.forEach((opt, i) => {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.innerHTML = `<span class="opt-letter">${OPTION_LETTERS[i]}</span>${opt}`;
    btn.addEventListener("click", () => submitAnswer(i));
    grid.appendChild(btn);
  });

  document.getElementById("answer-status").classList.add("hidden");

  // Timer
  startTimer(timeLimit);
});

function startTimer(seconds) {
  clearInterval(timerInterval);
  let left = seconds;
  const ring = document.getElementById("timer-ring");
  const txt  = document.getElementById("timer-text");
  const circumference = 163.4;

  const update = () => {
    const frac = left / seconds;
    if (ring) {
      ring.style.strokeDashoffset = circumference * (1 - frac);
      ring.classList.toggle("urgent", left <= 5);
    }
    if (txt) txt.textContent = left;
  };
  update();

  timerInterval = setInterval(() => {
    left--;
    update();
    if (left <= 0) clearInterval(timerInterval);
  }, 1000);
}

function submitAnswer(index) {
  if (hasAnswered) return;
  hasAnswered = true;
  clearInterval(timerInterval);
  socket.emit("submit_answer", { answerIndex: index });

  // Grey out all buttons while waiting
  document.querySelectorAll(".option-btn").forEach(b => b.disabled = true);
  const status = document.getElementById("answer-status");
  status.textContent = "⏳ Answer locked in! Waiting for results...";
  status.className = "answer-status";
  status.classList.remove("hidden");
}

socket.on("answer_received", ({ correct, points, totalScore }) => {
  myScore = totalScore;
  const status = document.getElementById("answer-status");
  if (correct) {
    status.textContent = `✅ Correct! +${points} pts`;
    status.className = "answer-status correct-msg";
  } else {
    status.textContent = `❌ Wrong! No points this round.`;
    status.className = "answer-status wrong-msg";
  }
  status.classList.remove("hidden");
});

// ── Question result (show correct answer + fact) ──
socket.on("question_result", ({ correct, fact, myAnswer, myCorrect }) => {
  clearInterval(timerInterval);

  // Highlight correct/wrong on the options
  const btns = document.querySelectorAll(".option-btn");
  btns.forEach((btn, i) => {
    btn.disabled = true;
    if (i === correct)    btn.classList.add("correct");
    else if (i === myAnswer && !myCorrect) btn.classList.add("wrong");
  });

  // After 1.5 seconds, show the result card
  setTimeout(() => {
    const pointsThisRound = myCorrect ? (myScore - (myScore - (myCorrect ? 100 : 0))) : 0;
    document.getElementById("result-emoji").textContent = myCorrect ? "✅" : "❌";
    document.getElementById("result-title").textContent = myCorrect ? "Correct!" : "Not quite!";
    document.getElementById("result-points").textContent = myCorrect ? `+${Math.round(myScore)}` : "+0 pts";
    document.getElementById("result-fact").textContent = fact;
    document.getElementById("result-total").textContent = `Your total: ${myScore} pts`;
    showScreen("screen-answer-result");
  }, 1500);
});

// ── Game over ──
socket.on("game_over", ({ leaderboard }) => {
  const lb = document.getElementById("final-leaderboard");
  lb.innerHTML = buildLeaderboard(leaderboard, socket.id);
  showScreen("screen-gameover");
});

socket.on("game_reset", () => {
  myScore = 0;
  hasAnswered = false;
  clearInterval(timerInterval);
  showScreen("screen-lobby");
});

socket.on("timer_tick", ({ timeLeft }) => {
  // handled by local timer, but sync if needed
});

// ── Leaderboard builder ──
function buildLeaderboard(lb, myId) {
  const medals = ["🥇", "🥈", "🥉"];
  return lb.map((p, i) => {
    const isMe = p.id === myId;
    return `
      <div class="lb-row rank-${i + 1}${isMe ? ' my-row' : ''}">
        <span class="lb-rank">${medals[i] || `#${i + 1}`}</span>
        <span class="lb-avatar">${AVATAR_EMOJI[p.avatar] || "🎮"}</span>
        <span class="lb-name">${p.name}${isMe ? " (You)" : ""}</span>
        <span class="lb-score">${p.score} pts</span>
      </div>
    `;
  }).join("");
}
