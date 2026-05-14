// ══════════════════════════════════════════════════════════════════
//  PIXEL QUEST v2 — All 5 Mini-Games
//  Q1: Catcher    Q2: Maze    Q3: Platformer
//  Q4: Breakout   Q5: Space Shooter
// ══════════════════════════════════════════════════════════════════

const socket = io();
const AVATAR_LABELS = { wizard:"The Self-Taught Wizard", artist:"The Digital Artist", coder:"The Open-Source Coder", student:"The MOOC Student" };
const AVATAR_EMOJI  = { wizard:"🧙", artist:"🎨", coder:"💻", student:"📚" };
const OPTION_LETTERS = ["A","B","C","D"];

let myName = "", myAvatar = "wizard", myScore = 0;
let currentGame = null;   // active mini-game instance
let serverTimeLeft = 20;

// ── Screen helper ──────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const el = document.getElementById(id);
  if (el) el.classList.add("active");
}

// ── Avatar picker ──────────────────────────────────────────────
document.querySelectorAll(".avatar-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".avatar-btn").forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    myAvatar = btn.dataset.avatar;
    document.getElementById("avatar-label").textContent = AVATAR_LABELS[myAvatar];
  });
});

document.getElementById("join-btn").addEventListener("click", joinGame);
document.getElementById("name-input").addEventListener("keydown", e => { if (e.key === "Enter") joinGame(); });

function joinGame() {
  const name = document.getElementById("name-input").value.trim();
  if (!name) { showError("Please enter your name!"); return; }
  myName = name;
  socket.emit("player_join", { name, avatar: myAvatar });
}
function showError(msg) {
  const el = document.getElementById("lobby-error");
  el.textContent = msg; el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 3000);
}

// ── Socket events ──────────────────────────────────────────────
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

socket.on("game_starting", ({ countdown }) => {
  showScreen("screen-countdown");
  let n = countdown;
  document.getElementById("countdown-num").textContent = n;
  const t = setInterval(() => {
    n--;
    const el = document.getElementById("countdown-num");
    if (!el) { clearInterval(t); return; }
    el.style.animation = "none"; void el.offsetWidth;
    el.style.animation = "zoomIn 0.4s ease";
    el.textContent = n > 0 ? n : "GO!";
    if (n <= 0) clearInterval(t);
  }, 1000);
});

// ── Mini-game intro then launch ─────────────────────────────────
const GAME_INTROS = [
  { icon:"📦", title:"CATCH IT!", desc:"Crates fall from the sky. Dodge the wrong tools — CATCH the free open-source one! Use ◀ ▶ to move." },
  { icon:"🌀", title:"THE MAZE!", desc:"Navigate the maze and walk through the correct door. Use ◀ ▶ ▲ ▼ arrow keys or on-screen buttons." },
  { icon:"🏃", title:"PLATFORM JUMP!", desc:"Jump across platforms to the correct answer. Use ◀ ▶ to move, ▲ to jump. Don't fall!" },
  { icon:"🏏", title:"BARRIER BREAKER!", desc:"Deflect wrong blocks with your paddle. Let ONLY the correct answer fall through! Use ◀ ▶ to move." },
  { icon:"🚀", title:"SPACE SHOOTER!", desc:"Orbit planets are labelled with numbers. SHOOT the correct one! Use ◀ ▶ to rotate, 🔥 to fire." },
];

socket.on("new_question", ({ questionIndex, total, question, options, timeLimit }) => {
  if (currentGame) { currentGame.destroy(); currentGame = null; }
  serverTimeLeft = timeLimit;

  const intro = GAME_INTROS[questionIndex] || GAME_INTROS[0];
  document.getElementById("mg-intro-icon").textContent = intro.icon;
  document.getElementById("mg-intro-title").textContent = intro.title;
  document.getElementById("mg-intro-desc").textContent  = intro.desc;
  document.getElementById("mg-intro-question").textContent = question;
  showScreen("screen-minigame-intro");

  let sec = 3;
  document.getElementById("mg-intro-timer").textContent = sec;
  document.getElementById("mg-countdown-fill").style.width = "100%";
  const bar = document.getElementById("mg-countdown-fill");

  const tick = setInterval(() => {
    sec--;
    const el = document.getElementById("mg-intro-timer");
    if (el) el.textContent = sec;
    if (bar) bar.style.width = `${(sec / 3) * 100}%`;
    if (sec <= 0) {
      clearInterval(tick);
      launchMiniGame(questionIndex, total, question, options, timeLimit);
    }
  }, 1000);
});

function launchMiniGame(qIndex, total, question, options, timeLimit) {
  showScreen("screen-game");
  document.getElementById("hud-qnum").textContent = `Q${qIndex + 1} of ${total}`;

  const canvas = document.getElementById("game-canvas");
  const W = Math.min(window.innerWidth, 600);
  const H = Math.min(window.innerHeight - 120, 420);
  canvas.width  = W;
  canvas.height = H;

  const instructions = [
    "◀ ▶ Move  |  Catch the FREE tool!",
    "Arrow keys / buttons to navigate maze",
    "◀ ▶ Move  |  ▲ Jump to answer platform",
    "◀ ▶ Move paddle  |  Let correct block through!",
    "◀ ▶ Rotate  |  🔥 SHOOT the correct planet"
  ];
  document.getElementById("hud-instruction").textContent = instructions[qIndex] || "";

  // Show mobile controls
  document.getElementById("mobile-controls").classList.remove("hidden");

  // Init timer bar
  let tLeft = timeLimit;
  const timerFill = document.getElementById("hud-timer-fill");
  const timerText = document.getElementById("hud-timer-text");
  const timerInterval = setInterval(() => {
    tLeft--;
    if (timerFill) {
      const pct = Math.max(0, (tLeft / timeLimit) * 100);
      timerFill.style.width = pct + "%";
      timerFill.className = "hud-timer-fill" + (tLeft <= 5 ? " urgent" : "");
    }
    if (timerText) timerText.textContent = tLeft;
    if (tLeft <= 0) clearInterval(timerInterval);
  }, 1000);

  const onAnswer = (idx) => {
    clearInterval(timerInterval);
    if (currentGame) { currentGame.destroy(); currentGame = null; }
    document.getElementById("mobile-controls").classList.add("hidden");
    socket.emit("submit_answer", { answerIndex: idx });
  };

  const GAMES = [catcherGame, mazeGame, platformerGame, breakoutGame, spaceGame];
  const GameFn = GAMES[qIndex] || catcherGame;
  currentGame = GameFn(canvas, options, onAnswer);
}

socket.on("timer_tick", ({ timeLeft }) => { serverTimeLeft = timeLeft; });

socket.on("answer_received", () => { /* handled by mini-game callback */ });

socket.on("question_result", ({ correct, fact, myAnswer, myCorrect }) => {
  if (currentGame) { currentGame.destroy(); currentGame = null; }
  document.getElementById("mobile-controls").classList.add("hidden");

  document.getElementById("result-emoji").textContent  = myCorrect ? "✅" : "❌";
  document.getElementById("result-title").textContent  = myCorrect ? "Correct!" : "Not quite!";
  document.getElementById("result-points").textContent = myCorrect ? "Nice one! 🎉" : "Keep going!";
  document.getElementById("result-fact").textContent   = fact;
  document.getElementById("result-total").textContent  = `Your total: ${myScore} pts`;
  showScreen("screen-answer-result");
});

socket.on("answer_received", ({ correct, points, totalScore }) => {
  myScore = totalScore;
});

socket.on("game_over", ({ leaderboard }) => {
  if (currentGame) { currentGame.destroy(); currentGame = null; }
  document.getElementById("final-leaderboard").innerHTML = buildLeaderboard(leaderboard);
  showScreen("screen-gameover");
});
socket.on("game_reset", () => { myScore = 0; showScreen("screen-lobby"); });

function buildLeaderboard(lb) {
  const medals = ["🥇","🥈","🥉"];
  return lb.map((p, i) => `
    <div class="lb-row rank-${i+1}">
      <span class="lb-rank">${medals[i] || "#"+(i+1)}</span>
      <span class="lb-avatar">${AVATAR_EMOJI[p.avatar]||"🎮"}</span>
      <span class="lb-name">${p.name}${p.id===socket.id?" (You)":""}</span>
      <span class="lb-score">${p.score} pts</span>
    </div>`).join("");
}

// ═══════════════════════════════════════════════════════════════
//  SHARED CANVAS UTILITIES
// ═══════════════════════════════════════════════════════════════
function setupKeys() {
  const keys = {};
  const kd = e => { keys[e.key] = true; };
  const ku = e => { keys[e.key] = false; };
  window.addEventListener("keydown", kd);
  window.addEventListener("keyup",   ku);
  const cleanup = () => { window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); };
  return { keys, cleanup };
}

function setupMobileControls(handlers) {
  const btns = {
    left:   document.getElementById("mc-left"),
    up:     document.getElementById("mc-up"),
    right:  document.getElementById("mc-right"),
    action: document.getElementById("mc-action"),
  };
  const held = {};
  const listeners = [];
  Object.entries(handlers).forEach(([name, fn]) => {
    const btn = btns[name];
    if (!btn) return;
    const ps = () => { held[name] = true; fn && fn("start"); };
    const pe = () => { held[name] = false; fn && fn("end"); };
    btn.addEventListener("pointerdown", ps);
    btn.addEventListener("pointerup",   pe);
    btn.addEventListener("pointerleave",pe);
    listeners.push({ btn, ps, pe });
  });
  return {
    held,
    cleanup: () => listeners.forEach(({ btn, ps, pe }) => {
      btn.removeEventListener("pointerdown", ps);
      btn.removeEventListener("pointerup",   pe);
      btn.removeEventListener("pointerleave",pe);
    })
  };
}

function drawPixelText(ctx, text, x, y, size, color, align="center") {
  ctx.fillStyle = color;
  ctx.font = `bold ${size}px 'Inter', sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
}

function drawRoundRect(ctx, x, y, w, h, r, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.lineTo(x+w-r, y); ctx.arcTo(x+w,y, x+w,y+r, r);
  ctx.lineTo(x+w, y+h-r); ctx.arcTo(x+w,y+h, x+w-r,y+h, r);
  ctx.lineTo(x+r, y+h); ctx.arcTo(x,y+h, x,y+h-r, r);
  ctx.lineTo(x, y+r); ctx.arcTo(x,y, x+r,y, r);
  ctx.closePath();
  if (fill)   { ctx.fillStyle = fill;   ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
}

// ═══════════════════════════════════════════════════════════════
//  GAME 1 — CATCHER  (Q1: Free CG Tools → Blender)
//  Crates fall. Player moves a basket. Catch correct crate.
// ═══════════════════════════════════════════════════════════════
function catcherGame(canvas, options, onAnswer) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  let raf, answered = false;

  const { keys, cleanup: cleanKeys } = setupKeys();
  const mobile = setupMobileControls({
    left: () => {}, right: () => {}, up: () => {}, action: () => {}
  });

  const COLORS = ["#3b82f6","#ef4444","#f97316","#a855f7"];
  const CRATE_ICONS = ["📦","📦","📦","📦"];

  // Basket
  const basket = { x: W/2 - 45, y: H - 60, w: 90, h: 22, speed: 5 };

  // Crates – staggered start positions
  const crates = options.map((opt, i) => ({
    x: (W / options.length) * i + 20 + Math.random() * 30,
    y: -80 - i * 90,
    w: 75, h: 50,
    vy: 1.6 + Math.random() * 0.8,
    label: opt,
    idx: i,
    color: COLORS[i],
    caught: false,
    missed: false,
  }));

  let score = 0;
  let particles = [];

  function spawnParticles(x, y, color) {
    for (let i = 0; i < 12; i++) {
      particles.push({ x, y, vx: (Math.random()-0.5)*5, vy: (Math.random()-2)*4, life: 1, color });
    }
  }

  function loop() {
    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = "#0a1520";
    ctx.fillRect(0, 0, W, H);

    // Stars
    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.1+Math.sin(i*1.3+Date.now()/2000)*0.1})`;
      ctx.fillRect((i*137)%W, (i*97)%H, 2, 2);
    }

    // Ground line
    ctx.fillStyle = "rgba(59,130,246,0.3)";
    ctx.fillRect(0, H-35, W, 2);

    // Move basket
    const speed = basket.speed;
    if (keys["ArrowLeft"]  || keys["a"] || mobile.held.left)  basket.x = Math.max(0, basket.x - speed);
    if (keys["ArrowRight"] || keys["d"] || mobile.held.right) basket.x = Math.min(W - basket.w, basket.x + speed);

    // Draw basket
    drawRoundRect(ctx, basket.x, basket.y, basket.w, basket.h, 8, "#1e3a5f", "#3b82f6");
    drawPixelText(ctx, "🧺", basket.x + basket.w/2, basket.y + basket.h/2, 18, "#fff");

    // Move & draw crates
    crates.forEach(c => {
      if (c.caught || c.missed) return;
      c.y += c.vy;
      c.vy += 0.035; // gravity

      // Check catch
      if (
        c.y + c.h >= basket.y &&
        c.y + c.h <= basket.y + basket.h + 10 &&
        c.x + c.w > basket.x + 8 &&
        c.x < basket.x + basket.w - 8 &&
        !answered
      ) {
        c.caught = true;
        answered = true;
        spawnParticles(c.x + c.w/2, c.y, c.color);
        setTimeout(() => onAnswer(c.idx), 400);
      }

      // Missed (fell off screen)
      if (c.y > H + 20) c.missed = true;

      // Draw crate
      drawRoundRect(ctx, c.x, c.y, c.w, c.h, 6, c.color + "33", c.color);
      drawPixelText(ctx, c.label, c.x + c.w/2, c.y + c.h/2 - 6, 10, "#fff");
      // Draw index letter
      ctx.fillStyle = c.color;
      ctx.fillRect(c.x, c.y, 18, 18);
      drawPixelText(ctx, OPTION_LETTERS[c.idx], c.x+9, c.y+9, 11, "#fff");
    });

    // Particles
    particles = particles.filter(p => p.life > 0);
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.life -= 0.04;
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, 5, 5);
      ctx.globalAlpha = 1;
    });

    // Respawn missed crates
    crates.forEach((c, i) => {
      if (c.missed) {
        c.missed = false;
        c.y = -60 - Math.random() * 100;
        c.x = Math.random() * (W - c.w);
        c.vy = 1.6 + Math.random() * 0.8;
      }
    });

    // Instruction
    drawPixelText(ctx, "Catch the FREE tool! 📦", W/2, 20, 13, "rgba(251,191,36,0.8)");

    raf = requestAnimationFrame(loop);
  }

  raf = requestAnimationFrame(loop);
  return { destroy: () => { cancelAnimationFrame(raf); cleanKeys(); mobile.cleanup(); } };
}

// ═══════════════════════════════════════════════════════════════
//  GAME 2 — MAZE  (Q2: MOOC Dropout → 90%)
//  Navigate a simple grid maze and walk through the right door
// ═══════════════════════════════════════════════════════════════
function mazeGame(canvas, options, onAnswer) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  let raf, answered = false;

  const CELL = 36;
  // Simple fixed maze layout (1 = wall, 0 = path)
  const MAZE = [
    [1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,1,0,0,0,0,0,0,0,1],
    [1,0,1,0,1,0,1,1,1,1,1,0,1],
    [1,0,1,0,0,0,0,0,0,0,1,0,1],
    [1,0,1,1,1,1,1,0,1,0,1,0,1],
    [1,0,0,0,0,0,1,0,1,0,0,0,1],
    [1,1,1,0,1,0,1,0,1,1,1,0,1],
    [1,0,0,0,1,0,0,0,0,0,1,0,1],
    [1,0,1,1,1,1,1,1,1,0,1,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1],
  ];
  const ROWS = MAZE.length, COLS = MAZE[0].length;
  const MAZE_W = COLS * CELL, MAZE_H = ROWS * CELL;
  const offX = Math.floor((W - MAZE_W) / 2);
  const offY = Math.floor((H - MAZE_H) / 2) + 10;

  // Doors at bottom row columns
  const doorCols = [2, 4, 8, 10];
  const doors = options.map((opt, i) => ({
    col: doorCols[i], row: ROWS - 1,
    label: opt, idx: i,
    color: ["#3b82f6","#ef4444","#f97316","#a855f7"][i],
    x: offX + doorCols[i] * CELL, y: offY + (ROWS-1) * CELL
  }));

  // Open bottom wall for doors
  doors.forEach(d => { MAZE[d.row][d.col] = 0; MAZE[d.row-1][d.col] = 0; });

  // Player starts top-center
  const player = { col: 1, row: 1, px: 0, py: 0, size: CELL - 8, moveDelay: 0 };
  player.px = offX + player.col * CELL + 4;
  player.py = offY + player.row * CELL + 4;

  const { keys, cleanup: cleanKeys } = setupKeys();
  const mobile = setupMobileControls({ left:()=>{}, right:()=>{}, up:()=>{}, action:()=>{} });

  function tryMove(dc, dr) {
    const nc = player.col + dc, nr = player.row + dr;
    if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) return;
    if (MAZE[nr][nc] === 1) return;
    player.col = nc; player.row = nr;
    player.px = offX + nc * CELL + 4;
    player.py = offY + nr * CELL + 4;

    // Check door
    const door = doors.find(d => d.col === nc && d.row === nr);
    if (door && !answered) {
      answered = true;
      setTimeout(() => onAnswer(door.idx), 300);
    }
  }

  let lastMoveTime = 0;
  const MOVE_DELAY = 160;

  function loop(ts) {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#0a1520";
    ctx.fillRect(0, 0, W, H);

    // Move player
    if (ts - lastMoveTime > MOVE_DELAY) {
      if (keys["ArrowLeft"]  || mobile.held.left)  { tryMove(-1, 0); lastMoveTime = ts; }
      if (keys["ArrowRight"] || mobile.held.right) { tryMove( 1, 0); lastMoveTime = ts; }
      if (keys["ArrowUp"]    || mobile.held.up)    { tryMove( 0,-1); lastMoveTime = ts; }
      if (keys["ArrowDown"])                       { tryMove( 0, 1); lastMoveTime = ts; }
    }

    // Draw maze
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = offX + c * CELL, y = offY + r * CELL;
        if (MAZE[r][c] === 1) {
          ctx.fillStyle = "#1e3a5f";
          ctx.fillRect(x, y, CELL, CELL);
          ctx.strokeStyle = "#3b82f6";
          ctx.lineWidth = 1;
          ctx.strokeRect(x+0.5, y+0.5, CELL-1, CELL-1);
        } else {
          ctx.fillStyle = "#0d1b2a";
          ctx.fillRect(x, y, CELL, CELL);
        }
      }
    }

    // Draw doors
    doors.forEach(d => {
      drawRoundRect(ctx, d.x, d.y, CELL, CELL, 4, d.color+"44", d.color);
      ctx.font = "bold 9px Inter";
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const maxW = CELL - 4;
      const words = d.label.split(" ");
      let line = "", lines = [];
      words.forEach(w => {
        const test = line + (line?" ":"") + w;
        if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
        else line = test;
      });
      lines.push(line);
      lines.forEach((l, li) => ctx.fillText(l, d.x + CELL/2, d.y + CELL/2 + (li - (lines.length-1)/2) * 12));
    });

    // Draw player
    const px = player.px, py = player.py, ps = player.size;
    ctx.fillStyle = "#fbbf24";
    ctx.fillRect(px, py, ps, ps);
    ctx.fillStyle = "#1e3a5f";
    ctx.fillRect(px+4, py+4, 6, 6);  // eye L
    ctx.fillRect(px+ps-10, py+4, 6, 6); // eye R

    // Instruction
    drawPixelText(ctx, "Walk through the correct door!", W/2, offY - 16, 12, "rgba(251,191,36,0.9)");

    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);
  return { destroy: () => { cancelAnimationFrame(raf); cleanKeys(); mobile.cleanup(); } };
}

// ═══════════════════════════════════════════════════════════════
//  GAME 3 — PLATFORMER  (Q3: Udemy → 200k courses)
//  Jump between floating platforms labelled with answers
// ═══════════════════════════════════════════════════════════════
function platformerGame(canvas, options, onAnswer) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  let raf, answered = false;

  const COLORS = ["#3b82f6","#ef4444","#f97316","#a855f7"];

  // Platforms: spread across width, at different heights
  const PW = 110, PH = 20;
  const platforms = options.map((opt, i) => ({
    x: 20 + (i % 2) * (W/2 - 30) + (i > 1 ? W/2 - PW/2 : 0),
    y: i < 2 ? H - 100 : H - 210,
    w: PW, h: PH,
    label: opt, idx: i,
    color: COLORS[i],
  }));
  // Rearrange for nice layout
  platforms[0].x = 30;           platforms[0].y = H - 90;
  platforms[1].x = W - PW - 30;  platforms[1].y = H - 90;
  platforms[2].x = 30;           platforms[2].y = H - 220;
  platforms[3].x = W - PW - 30;  platforms[3].y = H - 220;

  // Ground platform
  const ground = { x: 0, y: H - 30, w: W, h: 30 };

  // Player
  const player = {
    x: W/2 - 16, y: H - 70,
    w: 32, h: 36,
    vx: 0, vy: 0,
    onGround: false, speed: 4, jumpForce: -13,
    coyoteTime: 0,
  };

  const { keys, cleanup: cleanKeys } = setupKeys();
  const mobile = setupMobileControls({ left:()=>{}, up:()=>{}, right:()=>{}, action:()=>{} });

  function loop() {
    ctx.clearRect(0, 0, W, H);

    // Sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#0a1520"); sky.addColorStop(1, "#1a2f50");
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

    // Stars
    for (let i=0;i<20;i++) {
      ctx.fillStyle=`rgba(255,255,255,${0.15+Math.sin(i*2.1+Date.now()/3000)*0.1})`;
      ctx.fillRect((i*173)%W, (i*91)%(H/2), 2, 2);
    }

    // Input
    player.vx = 0;
    if (keys["ArrowLeft"]  || mobile.held.left)  player.vx = -player.speed;
    if (keys["ArrowRight"] || mobile.held.right) player.vx =  player.speed;
    if ((keys["ArrowUp"] || keys[" "] || mobile.held.up) && player.coyoteTime > 0) {
      player.vy = player.jumpForce;
      player.coyoteTime = 0;
    }

    // Physics
    player.vy += 0.55;
    player.x += player.vx;
    player.y += player.vy;
    player.x = Math.max(0, Math.min(W - player.w, player.x));
    player.onGround = false;

    // Collision with ground
    if (player.y + player.h >= ground.y) {
      player.y = ground.y - player.h;
      player.vy = 0; player.onGround = true; player.coyoteTime = 6;
    }

    // Collision with answer platforms
    platforms.forEach(p => {
      if (player.vy >= 0 &&
          player.y + player.h >= p.y && player.y + player.h <= p.y + p.h + 10 &&
          player.x + player.w > p.x + 4 && player.x < p.x + p.w - 4) {
        player.y = p.y - player.h;
        player.vy = 0; player.onGround = true; player.coyoteTime = 6;

        // Land on platform = answer
        if (!answered) {
          answered = true;
          // Glitter effect flash
          setTimeout(() => onAnswer(p.idx), 350);
        }
      }
    });

    if (player.coyoteTime > 0) player.coyoteTime--;

    // Death / respawn
    if (player.y > H + 50) {
      player.x = W/2 - 16; player.y = H - 80; player.vy = 0;
      answered = false;
    }

    // Draw ground
    drawRoundRect(ctx, ground.x, ground.y, ground.w, ground.h, 0, "#1e3a5f", "#3b82f6");

    // Draw platforms
    platforms.forEach(p => {
      drawRoundRect(ctx, p.x, p.y, p.w, p.h, 6, p.color+"55", p.color);
      // Label
      ctx.font = "bold 10px Inter";
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const words = p.label.split(" ");
      let lines = [], line = "";
      words.forEach(w => {
        const t = line + (line?" ":"") + w;
        if (ctx.measureText(t).width > p.w - 8 && line) { lines.push(line); line = w; }
        else line = t;
      });
      lines.push(line);
      lines.forEach((l, li) => ctx.fillText(l, p.x+p.w/2, p.y-10-(lines.length-1-li)*13));
      // Letter badge
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, 18, 18);
      ctx.fillStyle = "#fff"; ctx.font = "bold 11px Inter";
      ctx.fillText(OPTION_LETTERS[p.idx], p.x+9, p.y+9);
    });

    // Draw player (little pixel person)
    ctx.fillStyle = "#fbbf24";
    ctx.fillRect(player.x+6, player.y, 20, 14); // head
    ctx.fillStyle = "#3b82f6";
    ctx.fillRect(player.x+4, player.y+14, 24, 14); // body
    ctx.fillStyle = "#1e3a5f";
    ctx.fillRect(player.x+4, player.y+28, 9, 8);  // leg L
    ctx.fillRect(player.x+19, player.y+28, 9, 8); // leg R
    // eyes
    ctx.fillStyle = "#0d1b2a";
    ctx.fillRect(player.x+9, player.y+4, 4, 4);
    ctx.fillRect(player.x+19, player.y+4, 4, 4);

    // Instruction
    drawPixelText(ctx, "Jump to the correct platform!", W/2, 22, 12, "rgba(251,191,36,0.9)");
    drawPixelText(ctx, "▲ JUMP  ◀ ▶ MOVE", W/2, 40, 10, "rgba(96,165,250,0.8)");

    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);
  return { destroy: () => { cancelAnimationFrame(raf); cleanKeys(); mobile.cleanup(); } };
}

// ═══════════════════════════════════════════════════════════════
//  GAME 4 — BREAKOUT / BARRIER BREAKER  (Q4: Barriers)
//  Deflect wrong blocks, let ONLY the correct one through
// ═══════════════════════════════════════════════════════════════
function breakoutGame(canvas, options, onAnswer) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  let raf, answered = false;

  const COLORS = ["#3b82f6","#ef4444","#f97316","#a855f7"];
  const GAP_W = 100;

  // Paddle
  const paddle = { x: W/2 - 55, y: H - 50, w: 110, h: 16, speed: 6 };

  // Gap marker (correct answer falls through here)
  let gapX = W/2 - GAP_W/2;

  // Falling blocks
  const blocks = options.map((opt, i) => ({
    x: 40 + i * (W - 80) / options.length,
    y: -50 - i * 70,
    w: 90, h: 38,
    vy: 1.2 + Math.random() * 0.6,
    label: opt, idx: i,
    color: COLORS[i],
    deflected: false,
    gone: false,
  }));

  const { keys, cleanup: cleanKeys } = setupKeys();
  const mobile = setupMobileControls({ left:()=>{}, right:()=>{}, up:()=>{}, action:()=>{} });

  let particles = [];
  function spawnParticles(x, y, color) {
    for (let i=0;i<10;i++) particles.push({ x, y, vx:(Math.random()-0.5)*6, vy:-Math.random()*5, life:1, color });
  }

  function loop() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#0a1520";
    ctx.fillRect(0, 0, W, H);

    // Stars
    for (let i=0;i<25;i++) {
      ctx.fillStyle=`rgba(255,255,255,${0.1+Math.sin(i*1.7+Date.now()/2500)*0.1})`;
      ctx.fillRect((i*151)%W,(i*83)%(H-80),2,2);
    }

    // Move paddle
    if (keys["ArrowLeft"]  || mobile.held.left)  paddle.x = Math.max(0, paddle.x - paddle.speed);
    if (keys["ArrowRight"] || mobile.held.right) paddle.x = Math.min(W - paddle.w, paddle.x + paddle.speed);

    // Gap indicator (below paddle)
    const gapCX = paddle.x + paddle.w/2;
    gapX = gapCX - GAP_W/2;

    // Draw gap zone
    ctx.fillStyle = "rgba(34,197,94,0.12)";
    ctx.fillRect(gapX, paddle.y - 10, GAP_W, H - paddle.y + 10);
    ctx.strokeStyle = "#22c55e";
    ctx.setLineDash([5,4]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(gapX, 0); ctx.lineTo(gapX, H);
    ctx.moveTo(gapX + GAP_W, 0); ctx.lineTo(gapX + GAP_W, H);
    ctx.stroke();
    ctx.setLineDash([]);

    // Label gap
    drawPixelText(ctx, "Let correct fall through", gapX + GAP_W/2, H - 15, 10, "#22c55e");

    // Draw paddle
    drawRoundRect(ctx, paddle.x, paddle.y, paddle.w, paddle.h, 6, "#3b82f6", "#60a5fa");

    // Update blocks
    blocks.forEach(b => {
      if (b.gone) return;
      b.y += b.vy;

      // Hit paddle?
      if (!b.deflected &&
          b.y + b.h >= paddle.y &&
          b.y < paddle.y + paddle.h &&
          b.x + b.w > paddle.x + 4 &&
          b.x < paddle.x + paddle.w - 4) {
        // Check if it's in the gap (should fall through)
        const bCX = b.x + b.w / 2;
        if (bCX > gapX && bCX < gapX + GAP_W) {
          // Falls through — this is the answer
          if (!answered) {
            answered = true;
            spawnParticles(bCX, b.y, b.color);
            setTimeout(() => onAnswer(b.idx), 300);
            b.gone = true;
          }
        } else {
          // Deflect: bounce up
          b.vy = -(b.vy + 0.5);
          b.deflected = true;
          spawnParticles(b.x + b.w/2, b.y + b.h, b.color);
          setTimeout(() => { b.deflected = false; }, 200);
        }
      }

      // Reset if off screen
      if (b.y > H + 60) {
        b.y = -60 - Math.random() * 80;
        b.x = Math.random() * (W - b.w);
        b.vy = 1.2 + Math.random() * 0.6;
        b.deflected = false;
      }
      if (b.y < -200) {
        b.y = -50;
        b.vy = Math.abs(b.vy);
        b.deflected = false;
      }

      // Draw block
      if (!b.gone) {
        drawRoundRect(ctx, b.x, b.y, b.w, b.h, 6, b.color+"44", b.color);
        ctx.font = "bold 10px Inter";
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const maxW = b.w - 8;
        const words = b.label.split(" ");
        let lines = [], line = "";
        words.forEach(w => {
          const t = line+(line?" ":"")+w;
          if (ctx.measureText(t).width > maxW && line) { lines.push(line); line=w; }
          else line = t;
        });
        lines.push(line);
        lines.forEach((l,li)=>ctx.fillText(l, b.x+b.w/2, b.y+b.h/2+(li-(lines.length-1)/2)*13));
        // Letter
        ctx.fillStyle = b.color;
        ctx.fillRect(b.x, b.y, 18, 18);
        ctx.fillStyle="#fff"; ctx.font="bold 10px Inter";
        ctx.textAlign="center"; ctx.textBaseline="middle";
        ctx.fillText(OPTION_LETTERS[b.idx], b.x+9, b.y+9);
      }
    });

    // Particles
    particles = particles.filter(p=>p.life>0);
    particles.forEach(p=>{
      p.x+=p.vx; p.y+=p.vy; p.vy+=0.2; p.life-=0.05;
      ctx.globalAlpha=p.life;
      ctx.fillStyle=p.color;
      ctx.fillRect(p.x,p.y,6,6);
      ctx.globalAlpha=1;
    });

    drawPixelText(ctx, "Move paddle. Let ONLY the correct answer fall through!", W/2, 22, 11, "rgba(251,191,36,0.9)");
    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);
  return { destroy: () => { cancelAnimationFrame(raf); cleanKeys(); mobile.cleanup(); } };
}

// ═══════════════════════════════════════════════════════════════
//  GAME 5 — SPACE SHOOTER  (Q5: Blender community 5M+)
//  Orbiting planets labelled with numbers. Shoot the right one.
// ═══════════════════════════════════════════════════════════════
function spaceGame(canvas, options, onAnswer) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  let raf, answered = false;

  const CX = W/2, CY = H/2;
  const COLORS = ["#3b82f6","#ef4444","#f97316","#a855f7"];
  const ORBIT_RADII = [80, 130, 175, 215];

  // Planets orbiting the sun
  const planets = options.map((opt, i) => ({
    angle: (Math.PI * 2 / options.length) * i,
    orbitR: ORBIT_RADII[i] || 80 + i * 45,
    r: 22,
    speed: (0.012 - i * 0.002) * (i % 2 === 0 ? 1 : -1),
    label: opt, idx: i,
    color: COLORS[i],
    hit: false,
  }));

  // Ship on outer ring
  const ship = {
    angle: -Math.PI/2,
    orbitR: (ORBIT_RADII[options.length-1] || 215) + 50,
    x: CX, y: CY,
    rotSpeed: 0.055,
  };
  ship.x = CX + Math.cos(ship.angle) * ship.orbitR;
  ship.y = CY + Math.sin(ship.angle) * ship.orbitR;

  // Bullets
  let bullets = [];

  const { keys, cleanup: cleanKeys } = setupKeys();

  let lastFire = 0;
  const mobile = setupMobileControls({
    left:  () => {},
    right: () => {},
    action: (state) => { if (state === "start") fireBullet(); }
  });

  function fireBullet() {
    const now = Date.now();
    if (now - lastFire < 400) return;
    lastFire = now;
    // Fire inward toward center
    const dx = CX - ship.x, dy = CY - ship.y;
    const dist = Math.sqrt(dx*dx+dy*dy);
    bullets.push({ x: ship.x, y: ship.y, vx: (dx/dist)*9, vy: (dy/dist)*9, life: 1 });
  }

  function loop() {
    ctx.clearRect(0, 0, W, H);

    // Space background
    ctx.fillStyle = "#020810";
    ctx.fillRect(0, 0, W, H);
    // Stars
    for (let i=0;i<60;i++) {
      const st = 0.2+Math.sin(i*3.1+Date.now()/4000)*0.15;
      ctx.fillStyle=`rgba(255,255,255,${st})`;
      ctx.fillRect((i*197+7)%W,(i*113+3)%H,i%3===0?2:1,i%3===0?2:1);
    }

    // Orbit rings
    planets.forEach(p => {
      ctx.beginPath();
      ctx.arc(CX, CY, p.orbitR, 0, Math.PI*2);
      ctx.strokeStyle = "rgba(59,130,246,0.15)";
      ctx.lineWidth = 1;
      ctx.stroke();
    });
    // Ship orbit ring
    ctx.beginPath();
    ctx.arc(CX, CY, ship.orbitR, 0, Math.PI*2);
    ctx.strokeStyle = "rgba(251,191,36,0.2)";
    ctx.lineWidth = 1; ctx.setLineDash([4,6]); ctx.stroke(); ctx.setLineDash([]);

    // Update planets
    planets.forEach(p => {
      if (!p.hit) p.angle += p.speed;
      p.x = CX + Math.cos(p.angle) * p.orbitR;
      p.y = CY + Math.sin(p.angle) * p.orbitR;
    });

    // Rotate ship
    if (keys["ArrowLeft"]  || mobile.held.left)  ship.angle -= ship.rotSpeed;
    if (keys["ArrowRight"] || mobile.held.right) ship.angle += ship.rotSpeed;
    if (keys["ArrowUp"] || keys[" "] || keys["f"]) fireBullet();
    ship.x = CX + Math.cos(ship.angle) * ship.orbitR;
    ship.y = CY + Math.sin(ship.angle) * ship.orbitR;

    // Move bullets
    bullets = bullets.filter(b => b.life > 0);
    bullets.forEach(b => {
      b.x += b.vx; b.y += b.vy;
      b.life -= 0.025;
      // Hit planet?
      planets.forEach(p => {
        if (p.hit) return;
        const dx = b.x - p.x, dy = b.y - p.y;
        if (Math.sqrt(dx*dx+dy*dy) < p.r + 6) {
          b.life = 0;
          p.hit = true;
          if (!answered) { answered = true; setTimeout(() => onAnswer(p.idx), 350); }
        }
      });
      // Draw bullet
      if (b.life > 0) {
        ctx.globalAlpha = b.life;
        ctx.fillStyle = "#fbbf24";
        ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, Math.PI*2); ctx.fill();
        ctx.globalAlpha = 1;
      }
    });

    // Draw sun
    const sunGrad = ctx.createRadialGradient(CX,CY,2,CX,CY,20);
    sunGrad.addColorStop(0,"#fff7aa"); sunGrad.addColorStop(1,"#f97316");
    ctx.fillStyle = sunGrad;
    ctx.beginPath(); ctx.arc(CX, CY, 18, 0, Math.PI*2); ctx.fill();

    // Draw planets
    planets.forEach(p => {
      if (p.hit) {
        // Explosion
        for (let i=0;i<8;i++) {
          ctx.fillStyle = p.color;
          ctx.globalAlpha = 0.6;
          ctx.fillRect(p.x-12+Math.random()*24, p.y-12+Math.random()*24, 5, 5);
          ctx.globalAlpha = 1;
        }
        return;
      }
      const grad = ctx.createRadialGradient(p.x-p.r/3, p.y-p.r/3, 2, p.x, p.y, p.r);
      grad.addColorStop(0, "#fff"); grad.addColorStop(1, p.color);
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2; ctx.stroke();

      // Label (split long text)
      ctx.font = "bold 9px Inter";
      ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const words = p.label.split(" ");
      let lines=[], line="";
      words.forEach(w=>{
        const t=line+(line?" ":"")+w;
        if(ctx.measureText(t).width>p.r*2-4&&line){lines.push(line);line=w;}else line=t;
      });
      lines.push(line);
      lines.forEach((l,li)=>ctx.fillText(l,p.x,p.y+(li-(lines.length-1)/2)*11));

      // Letter
      ctx.fillStyle = "#fff2"; ctx.font = "bold 8px Inter";
      ctx.fillText(OPTION_LETTERS[p.idx], p.x + p.r - 7, p.y - p.r + 7);
    });

    // Draw ship (triangle pointing inward)
    const angle = ship.angle + Math.PI; // point toward center
    ctx.save();
    ctx.translate(ship.x, ship.y);
    ctx.rotate(angle + Math.PI/2);
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(-9, 10);
    ctx.lineTo(9, 10);
    ctx.closePath(); ctx.fill();
    // Thruster
    ctx.fillStyle = "#3b82f6";
    ctx.fillRect(-4, 10, 8, 5);
    ctx.restore();

    // Aim line
    ctx.strokeStyle = "rgba(251,191,36,0.25)";
    ctx.lineWidth = 1; ctx.setLineDash([3,5]);
    ctx.beginPath();
    ctx.moveTo(ship.x, ship.y);
    ctx.lineTo(CX + Math.cos(ship.angle+Math.PI)*ship.orbitR*2, CY + Math.sin(ship.angle+Math.PI)*ship.orbitR*2);
    ctx.stroke(); ctx.setLineDash([]);

    // Instructions
    drawPixelText(ctx, "◀ ▶ Rotate   SPACE/🔥 Fire", W/2, 18, 11, "rgba(251,191,36,0.85)");

    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);
  return { destroy: () => { cancelAnimationFrame(raf); cleanKeys(); mobile.cleanup(); } };
}
