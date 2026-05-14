const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(express.static(path.join(__dirname, "public")));

// ─── Game State ───────────────────────────────────────────────────────────────
const ADMIN_PASSWORD = "Seminar5";

const QUESTIONS = [
  {
    id: 1,
    question: "Which of these is a completely FREE, open-source 3D modeling tool?",
    options: ["Blender", "Cinema 4D", "Autodesk Maya", "ZBrush"],
    correct: 0,
    fact: "Blender is free forever. Cinema 4D costs ~$700/year, Maya ~$1,785/year!"
  },
  {
    id: 2,
    question: "Studies show MOOC (online course) dropout rates exceed...",
    options: ["20%", "50%", "70%", "90%"],
    correct: 3,
    fact: "Over 90% of MOOC students never finish. Lack of mentorship and structure is the main reason (Reich & Ruipérez-Valiente, 2019)."
  },
  {
    id: 3,
    question: "Which platform hosts 200,000+ courses in design and 3D graphics?",
    options: ["Skillshare", "Udemy", "Coursera", "LinkedIn Learning"],
    correct: 1,
    fact: "Udemy hosts 200,000+ courses, many available for under $20 during sales — making pro CG education accessible worldwide."
  },
  {
    id: 4,
    question: "What barrier stops most people in developing regions from accessing CG tools?",
    options: [
      "They prefer traditional art",
      "Hardware & internet costs",
      "CG tools are banned",
      "Language barriers only"
    ],
    correct: 1,
    fact: "A capable PC for 3D work can cost several months' wages in developing regions, and limited internet blocks access to online platforms (UNESCO, 2023)."
  },
  {
    id: 5,
    question: "The Blender Artists community forum has how many members?",
    options: ["50,000+", "500,000+", "5 Million+", "50 Million+"],
    correct: 2,
    fact: "Over 5 million people learn CG together on Blender Artists — proof that peer communities are closing the education gap (Blender Foundation, 2024)."
  }
];

let gameState = {
  phase: "lobby",        // lobby | question | results | leaderboard
  players: {},           // socketId -> { name, avatar, score, answers }
  admins: new Set(),
  currentQuestion: -1,
  questionTimer: null,
  answers: {},           // socketId -> answerIndex for current question
  questionStartTime: null
};

function resetGame() {
  if (gameState.questionTimer) clearInterval(gameState.questionTimer);
  const admins = gameState.admins;
  gameState = {
    phase: "lobby",
    players: {},
    admins,
    currentQuestion: -1,
    questionTimer: null,
    answers: {},
    questionStartTime: null
  };
}

function getPublicPlayers() {
  return Object.entries(gameState.players).map(([id, p]) => ({
    id,
    name: p.name,
    avatar: p.avatar,
    score: p.score,
    joinedAt: p.joinedAt
  }));
}

function getLeaderboard() {
  return Object.entries(gameState.players)
    .map(([id, p]) => ({ id, name: p.name, avatar: p.avatar, score: p.score }))
    .sort((a, b) => b.score - a.score);
}

function broadcastToAdmins(event, data) {
  gameState.admins.forEach(adminId => {
    io.to(adminId).emit(event, data);
  });
}

function sendQuestionResults() {
  const q = QUESTIONS[gameState.currentQuestion];
  const tally = [0, 0, 0, 0];
  const playerResults = {};

  Object.entries(gameState.answers).forEach(([pid, ans]) => {
    if (ans >= 0 && ans <= 3) tally[ans]++;
    const isCorrect = ans === q.correct;
    playerResults[pid] = { answer: ans, correct: isCorrect };
  });

  // Award points (correct = 100, speed bonus already applied at answer time)
  Object.entries(gameState.answers).forEach(([pid, ans]) => {
    if (ans === q.correct && gameState.players[pid]) {
      // Base points already added at answer time
    }
  });

  const resultsPayload = {
    questionIndex: gameState.currentQuestion,
    correct: q.correct,
    fact: q.fact,
    tally,
    playerResults,
    leaderboard: getLeaderboard()
  };

  // Send each player their personal result
  Object.keys(gameState.players).forEach(pid => {
    io.to(pid).emit("question_result", {
      ...resultsPayload,
      myAnswer: gameState.answers[pid] ?? -1,
      myCorrect: (gameState.answers[pid] ?? -1) === q.correct
    });
  });

  broadcastToAdmins("question_result", resultsPayload);
  gameState.phase = "results";
}

function startQuestion(index) {
  if (index >= QUESTIONS.length) {
    // Game over
    gameState.phase = "leaderboard";
    const lb = getLeaderboard();
    io.emit("game_over", { leaderboard: lb });
    broadcastToAdmins("game_over", { leaderboard: lb });
    return;
  }

  gameState.currentQuestion = index;
  gameState.answers = {};
  gameState.phase = "question";
  gameState.questionStartTime = Date.now();

  const q = QUESTIONS[index];
  const payload = {
    questionIndex: index,
    total: QUESTIONS.length,
    question: q.question,
    options: q.options,
    timeLimit: 35
  };

  io.emit("new_question", payload);
  broadcastToAdmins("new_question", { ...payload, correct: q.correct });

  let timeLeft = 35;
  gameState.questionTimer = setInterval(() => {
    timeLeft--;
    io.emit("timer_tick", { timeLeft });
    if (timeLeft <= 0) {
      clearInterval(gameState.questionTimer);
      sendQuestionResults();
    }
  }, 1000);
}

// ─── Socket.IO Events ─────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`[+] Connected: ${socket.id}`);

  // ── Admin auth ──
  socket.on("admin_auth", ({ password }) => {
    if (password === ADMIN_PASSWORD) {
      gameState.admins.add(socket.id);
      socket.emit("admin_auth_ok", {
        players: getPublicPlayers(),
        phase: gameState.phase,
        currentQuestion: gameState.currentQuestion,
        totalQuestions: QUESTIONS.length
      });
      console.log(`[ADMIN] Authenticated: ${socket.id}`);
    } else {
      socket.emit("admin_auth_fail");
    }
  });

  // ── Player join ──
  socket.on("player_join", ({ name, avatar }) => {
    if (gameState.phase !== "lobby") {
      socket.emit("join_rejected", { reason: "Game already in progress" });
      return;
    }
    const trimmedName = (name || "").trim().slice(0, 20);
    if (!trimmedName) return;

    gameState.players[socket.id] = {
      name: trimmedName,
      avatar: avatar || "wizard",
      score: 0,
      answers: [],
      joinedAt: new Date().toISOString()
    };

    socket.emit("join_ok", { name: trimmedName, avatar });
    broadcastToAdmins("player_joined", {
      id: socket.id,
      name: trimmedName,
      avatar,
      joinedAt: gameState.players[socket.id].joinedAt,
      totalPlayers: Object.keys(gameState.players).length
    });
    // Tell all players updated count
    io.emit("lobby_update", { count: Object.keys(gameState.players).length });
    console.log(`[PLAYER] ${trimmedName} joined`);
  });

  // ── Admin: start game ──
  socket.on("admin_start", () => {
    if (!gameState.admins.has(socket.id)) return;
    if (Object.keys(gameState.players).length === 0) {
      socket.emit("admin_error", { msg: "No players have joined yet!" });
      return;
    }
    gameState.phase = "starting";
    io.emit("game_starting", { countdown: 3 });
    setTimeout(() => startQuestion(0), 3000);
  });

  // ── Admin: next question ──
  socket.on("admin_next", () => {
    if (!gameState.admins.has(socket.id)) return;
    if (gameState.phase !== "results") return;
    startQuestion(gameState.currentQuestion + 1);
  });

  // ── Admin: reset ──
  socket.on("admin_reset", () => {
    if (!gameState.admins.has(socket.id)) return;
    resetGame();
    io.emit("game_reset");
    broadcastToAdmins("game_reset");
    socket.emit("admin_auth_ok", {
      players: [],
      phase: "lobby",
      currentQuestion: -1,
      totalQuestions: QUESTIONS.length
    });
    console.log("[ADMIN] Game reset");
  });

  // ── Player answer ──
  socket.on("submit_answer", ({ answerIndex }) => {
    if (gameState.phase !== "question") return;
    if (!gameState.players[socket.id]) return;
    if (gameState.answers[socket.id] !== undefined) return; // already answered

    const elapsed = (Date.now() - gameState.questionStartTime) / 1000;
    const timeBonus = Math.max(0, Math.round((20 - elapsed) * 5)); // up to 100 speed bonus
    const q = QUESTIONS[gameState.currentQuestion];
    const correct = answerIndex === q.correct;
    const points = correct ? 100 + timeBonus : 0;

    gameState.answers[socket.id] = answerIndex;
    gameState.players[socket.id].score += points;
    gameState.players[socket.id].answers.push({ q: gameState.currentQuestion, a: answerIndex, correct, points });

    socket.emit("answer_received", { correct, points, totalScore: gameState.players[socket.id].score });
    broadcastToAdmins("player_answered", {
      id: socket.id,
      name: gameState.players[socket.id].name,
      answerIndex,
      correct,
      answeredCount: Object.keys(gameState.answers).length,
      totalPlayers: Object.keys(gameState.players).length
    });
  });

  // ── Disconnect ──
  socket.on("disconnect", () => {
    if (gameState.admins.has(socket.id)) {
      gameState.admins.delete(socket.id);
    }
    if (gameState.players[socket.id]) {
      const name = gameState.players[socket.id].name;
      delete gameState.players[socket.id];
      broadcastToAdmins("player_left", {
        id: socket.id,
        name,
        totalPlayers: Object.keys(gameState.players).length
      });
      if (gameState.phase === "lobby") {
        io.emit("lobby_update", { count: Object.keys(gameState.players).length });
      }
    }
    console.log(`[-] Disconnected: ${socket.id}`);
  });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🎮 Pixel Quest running on port ${PORT}`);
  console.log(`   Game:  http://localhost:${PORT}`);
  console.log(`   Admin: http://localhost:${PORT}/admin.html\n`);
});
