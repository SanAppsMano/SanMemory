// =============================================
//   SONS DE ACERTO / ERRO (ORIGINAL)
// =============================================
const sMatch = new Audio("sounds/match.wav");
const sError = new Audio("sounds/error.wav");
sMatch.volume = 0.5;
sError.volume = 0.5;

// =============================================
//   VARIÁVEIS ORIGINAIS
// =============================================
let ws, room, modeSelected = "multi";

const GAME_DURATION_SECONDS = 5 * 60; // << NOVO: 5 minutos

let ctx, W, H;
let cards = [];
let matched = [];
let revealed = [];
let totalCardsCurrent = 12;
let scoresCurrent = { 1: 0, 2: 0 };

let startTime = null;
let timerInterval = null;

let lastMatchedCount = 0;
let lastRevealedCount = 0;

let particles = [];
let winnerInfo = null;

let cols = 4;
let rows = 3;

// =============================================
//   FUNÇÃO ORIGINAL: calcular grid por índice
// =============================================
function updateGrid() {
  if (totalCardsCurrent === 24) {
    cols = 6;
    rows = 4;
  } else {
    cols = 4;
    rows = 3;
  }
}

// =============================================
//   FUNÇÃO ORIGINAL: setup do board
// =============================================
function setupBoard(board, totalCards) {
  cards = board || [];
  totalCardsCurrent = totalCards || cards.length;

  matched = [];
  revealed = [];
  winnerInfo = null;
  lastMatchedCount = 0;
  lastRevealedCount = 0;

  updateGrid();

  const canvas = document.getElementById("board");
  ctx = canvas.getContext("2d");
  W = canvas.width;
  H = canvas.height;

  draw(); // << RESTAURADO
}

// =============================================
//   FUNÇÃO ORIGINAL: desenhar o frame
// =============================================
function draw() {
  loop(performance.now());
}

// =============================================
//   FUNÇÕES ORIGINAIS DE DESENHO
// =============================================
function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// =============================================
//   PARTÍCULAS (ORIGINAL)
// =============================================
function spawnMatchParticles(index) {
  const pad = 6;
  const cw = (W - pad * (cols + 1)) / cols;
  const ch = (H - pad * (rows + 1)) / rows;

  const col = index % cols;
  const row = Math.floor(index / cols);

  const cx = pad + col * (cw + pad) + cw / 2;
  const cy = pad + row * (ch + pad) + ch / 2;

  for (let i = 0; i < 14; i++) {
    particles.push({
      x: cx,
      y: cy,
      vx: (Math.random() - 0.5) * 5,
      vy: (Math.random() - 0.5) * 5,
      life: 1,
      size: 4 + Math.random() * 4,
      color: Math.random() > 0.5 ? "#22c55e" : "#38bdf8"
    });
  }
}

function spawnWinBurst() {
  const cx = W / 2;
  const cy = 40;

  for (let i = 0; i < 80; i++) {
    const ang = Math.random() * Math.PI * 2;
    const spd = 2 + Math.random() * 4;
    particles.push({
      x: cx,
      y: cy,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      life: 1,
      size: 6 + Math.random() * 6,
      color: Math.random() > 0.5 ? "#22c55e" : "#38bdf8"
    });
  }
}

function updateParticles(delta) {
  particles.forEach(p => {
    p.x += p.vx * delta * 60;
    p.y += p.vy * delta * 60;
    p.vx *= 0.9;
    p.vy *= 0.9;
    p.life -= delta * 0.7;
  });
  particles = particles.filter(p => p.life > 0);
}

function drawParticles() {
  ctx.save();
  particles.forEach(p => {
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

// =============================================
//   LOOP ORIGINAL
// =============================================
let lastFrameTime = null;
function loop(timestamp) {
  if (!ctx) return requestAnimationFrame(loop);

  if (lastFrameTime === null) lastFrameTime = timestamp;
  const delta = (timestamp - lastFrameTime) / 1000;
  lastFrameTime = timestamp;

  ctx.clearRect(0, 0, W, H);

  const pad = 6;
  const cw = (W - pad * (cols + 1)) / cols;
  const ch = (H - pad * (rows + 1)) / rows;

  // desenhar cartas (ORIGINAL)
  for (let i = 0; i < cards.length; i++) {
    const colIdx = i % cols;
    const rowIdx = Math.floor(i / cols);

    const x = pad + colIdx * (cw + pad);
    const y = pad + rowIdx * (ch + pad);

    const card = cards[i];
    const isMatched = matched.includes(card.id);
    const isRevealed = revealed.includes(i);

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 16;

    let grad = ctx.createLinearGradient(x, y, x + cw, y + ch);
    grad.addColorStop(0, isMatched ? "#22c55e" : isRevealed ? "#0ea5e9" : "#1e293b");
    grad.addColorStop(1, isMatched ? "#16a34a" : isRevealed ? "#0369a1" : "#020617");

    roundedRect(ctx, x, y, cw, ch, 18);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.shadowColor = "transparent";
    ctx.lineWidth = isMatched ? 4 : 2;
    ctx.strokeStyle = isMatched
      ? "rgba(34,197,94,0.7)"
      : isRevealed
      ? "rgba(56,189,248,0.7)"
      : "rgba(148,163,184,0.8)";
    ctx.stroke();

    ctx.fillStyle = "#e5e7eb";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${Math.floor(ch * 0.3)}px system-ui`;

    ctx.fillText(isRevealed || isMatched ? card.label : "?", x + cw / 2, y + ch / 2);

    ctx.restore();
  }

  // partículas e banner
  updateParticles(delta);
  drawParticles();
  drawWinnerBanner(delta);

  requestAnimationFrame(loop);
}

// =============================================
//   BANNER DE VENCEDOR (ORIGINAL + TIMER)
// =============================================
function drawWinnerBanner(delta) {
  if (!winnerInfo) return;

  winnerInfo.anim = Math.min(1, winnerInfo.anim + delta * 1.2);
  const a = winnerInfo.anim;

  const h = 80;
  const y = -h + (40 + h) * a;

  ctx.save();
  ctx.globalAlpha = a * 0.95;

  const text = winnerInfo.text;
  const timeLabel = winnerInfo.timeLabel;

  ctx.font = "bold 28px system-ui";
  const wText = ctx.measureText(text).width;
  ctx.font = "16px system-ui";
  const wTime = ctx.measureText(timeLabel).width;

  const w = Math.max(wText, wTime) + 60;
  const x = (W - w) / 2;

  ctx.fillStyle = "rgba(15,23,42,0.92)";
  ctx.strokeStyle = "rgba(148,163,184,0.8)";
  ctx.lineWidth = 2.5;

  roundedRect(ctx, x, y, w, h, 18);
  ctx.fill();
  ctx.stroke();

  ctx.globalAlpha = 1;
  ctx.textAlign = "center";

  ctx.font = "bold 28px system-ui";
  ctx.fillStyle = "#fff";
  ctx.fillText(text, x + w / 2, y + 30);

  ctx.font = "16px system-ui";
  ctx.fillStyle = "#a5b4fc";
  ctx.fillText(timeLabel, x + w / 2, y + 55);

  ctx.restore();
}

// =============================================
//   HUD ORIGINAL + TIMER 5:00
// =============================================
function resetHUD() {
  document.getElementById("timer").textContent = "05:00";
  document.getElementById("scoreP1").textContent = "0";
  document.getElementById("scoreP2").textContent = "0";

  if (timerInterval) clearInterval(timerInterval);
  startTime = null;

  scoresCurrent = { 1: 0, 2: 0 };
}

// =============================================
//   TIMER REGRESSIVO (NOVO)
// =============================================
function startTimer() {
  if (timerInterval) clearInterval(timerInterval);
  startTime = Date.now();

  timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const remaining = GAME_DURATION_SECONDS - elapsed;

    const t = Math.max(0, remaining);
    const m = String(Math.floor(t / 60)).padStart(2, "0");
    const s = String(t % 60).padStart(2, "0");

    document.getElementById("timer").textContent = `${m}:${s}`;

    if (remaining <= 0) {
      const p1 = scoresCurrent[1] || 0;
      const p2 = scoresCurrent[2] || 0;

      let winner =
        modeSelected === "multi"
          ? p1 > p2 ? 1 : p2 > p1 ? 2 : 0
          : 1;

      showWinner({ winner });
    }
  }, 1000);
}

// =============================================
//   EXIBIR VENCEDOR (ORIGINAL + TIMER)
// =============================================
function showWinner(msg) {
  if (timerInterval) clearInterval(timerInterval);

  const sec = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;
  const m = String(Math.floor(sec / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");

  const w = msg.winner;

  winnerInfo = {
    winner: w,
    text:
      w === 0 && modeSelected === "multi"
        ? "Empate!"
        : `Jogador ${w} venceu!`,
    timeLabel: `${m}:${s}`,
    anim: 0
  };

  spawnWinBurst();
}

// =============================================
//   WEBSOCKET ORIGINAL
// =============================================
function applyState(state) {
  matched = state.matched || [];
  revealed = state.revealed || [];
  scoresCurrent = state.scores || { 1: 0, 2: 0 };

  const newMatches = matched.length - lastMatchedCount;
  const newReveals = revealed.length - lastRevealedCount;

  if (newMatches > 0) {
    sMatch.play();
    spawnMatchParticles(revealed[revealed.length - 1]);
  } else if (newReveals > 0) {
    sError.play();
  }

  lastMatchedCount = matched.length;
  lastRevealedCount = revealed.length;

  draw();
}

function startGame(mode) {
  modeSelected = mode;
  room = crypto.randomUUID().slice(0, 5);

  if (ws) ws.close();

  resetHUD();
  winnerInfo = null;

  const wsUrl = location.origin.replace("http", "ws") + "/ws/" + room;

  ws = createResilientWebSocket(wsUrl, {
    onOpen() {
      ws.send(JSON.stringify({
        type: "start",
        mode: modeSelected,
        totalCards: 12
      }));
      renderQRs();
      startTimer();
    },
    onMessage(ev) {
      const msg = JSON.parse(ev.data);

      if (msg.type === "board") setupBoard(msg.board, msg.totalCards);
      if (msg.type === "state") applyState(msg);
      if (msg.type === "end" && !winnerInfo) showWinner(msg);
    }
  });
}

// =============================================
//   QR ORIGINAL
// =============================================
function renderQRs() {
  const url = new URL(location.href);
  url.searchParams.set("room", room);

  const controller = url.toString().replace("totem.html", "controller.html");

  new QRious({
    element: document.getElementById("qrcode1"),
    value: controller,
    size: 200
  });

  new QRious({
    element: document.getElementById("qrcode2"),
    value: controller,
    size: 200
  });
}

// =============================================
//   INIT ORIGINAL
// =============================================
window.onload = () => {
  const canvas = document.getElementById("board");
  ctx = canvas.getContext("2d");
  W = canvas.width;
  H = canvas.height;

  loop(performance.now());
};

// =============================================
//   CLIQUE ORIGINAL
// =============================================
document.getElementById("board").addEventListener("click", () => {
  const info = document.getElementById("status");
  if (info) info.textContent = "Aguardando jogada dos celulares...";
});
