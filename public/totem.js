// =============================================
//   SONS DE ACERTO / ERRO
// =============================================
const sMatch = new Audio("sounds/match.wav");
const sError = new Audio("sounds/error.wav");
sMatch.volume = 0.5;
sError.volume = 0.5;

// =============================================
//   ENGINE / VARS
// =============================================
let ws, room, modeSelected = "multi";

const GAME_DURATION_SECONDS = 5 * 60; // 5 minutos de jogo

let ctx, W, H, cards = [], matched = [], revealed = [];
let startTime = null, timerInterval = null;
let totalCardsCurrent = 12;
let scoresCurrent = { 1: 0, 2: 0 };

let lastMatchedCount = 0;
let lastRevealedCount = 0;

// partículas e info de vencedor
let particles = [];
let winnerInfo = null;

// cache de imagens das cartas
const cardImages = {};

// =============================================
//   BOARD / CARTAS
// =============================================
function setupBoard(board, totalCards) {
  cards = board || [];
  totalCardsCurrent = totalCards || cards.length;
  matched = [];
  revealed = [];
  lastMatchedCount = 0;
  lastRevealedCount = 0;
  winnerInfo = null;

  const canvas = document.getElementById("board");
  if (!canvas) return;

  ctx = canvas.getContext("2d");
  W = canvas.width;
  H = canvas.height;

  draw();
}

let cols = 4;
let rows = 3;

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
//   IMAGENS / CARTAS
// =============================================
function getCardImage(value) {
  if (!value) return null;
  if (!cardImages[value]) {
    const img = new Image();
    img.src = "cards/" + value + ".jpg";
    img.onload = () => {
      draw();
    };
    cardImages[value] = img;
  }
  return cardImages[value];
}

// =============================================
//   DESENHO
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

function spawnMatchParticles(index) {
  const c = cards[index];
  if (!c) return;

  const pad = 6;
  const cw = (W - pad * (cols + 1)) / cols;
  const ch = (H - pad * (rows + 1)) / rows;

  const x = pad + c.x * (cw + pad) + cw / 2;
  const y = pad + c.y * (ch + pad) + ch / 2;

  for (let i = 0; i < 14; i++) {
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 5,
      vy: (Math.random() - 0.5) * 5,
      life: 1,
      size: 4 + Math.random() * 4,
      color: Math.random() > 0.5 ? "#22c55e" : "#38bdf8"
    });
  }
}

function spawnWinBurst() {
  if (!W || !H) return;
  const x = W / 2;
  const y = 40;

  for (let i = 0; i < 80; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 4;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      size: 6 + Math.random() * 6,
      color: Math.random() > 0.5 ? "#22c55e" : "#38bdf8"
    });
  }
}

function updateParticles(delta) {
  const friction = 0.9;
  particles.forEach(p => {
    p.x += p.vx * delta * 60;
    p.y += p.vy * delta * 60;
    p.vx *= friction;
    p.vy *= friction;
    p.life -= delta * 0.7;
  });
  particles = particles.filter(p => p.life > 0);
}

function drawParticles() {
  if (!particles.length) return;
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

function drawWinnerBanner(delta) {
  if (!winnerInfo) return;

  winnerInfo.anim = Math.min(1, winnerInfo.anim + delta * 1.2);
  const alpha = winnerInfo.anim;

  const bannerH = 80;
  const targetY = 30;
  const startY = -bannerH;
  const t = 1 - Math.pow(1 - alpha, 3);
  const y = startY + (targetY - startY) * t;

  const text = winnerInfo.text;
  const timeLabel = winnerInfo.timeLabel || "";

  ctx.save();
  ctx.globalAlpha = alpha * 0.95;

  const paddingX = 32;
  ctx.font = "bold 28px system-ui, sans-serif";
  const textW = ctx.measureText(text).width;
  ctx.font = "16px system-ui, sans-serif";
  const timeW = ctx.measureText(timeLabel).width;
  const totalW = Math.max(textW, timeW) + paddingX * 2;
  const x = (W - totalW) / 2;

  ctx.fillStyle = "rgba(15,23,42,0.92)";
  ctx.strokeStyle = "rgba(148,163,184,0.8)";
  ctx.lineWidth = 2.5;

  roundedRect(ctx, x, y, totalW, bannerH, 18);
  ctx.fill();
  ctx.stroke();

  ctx.globalAlpha = 1;
  ctx.textAlign = "center";

  ctx.font = "bold 28px system-ui, sans-serif";
  ctx.fillStyle = "#e5e7eb";
  ctx.fillText(text, x + totalW / 2, y + 30);

  ctx.font = "16px system-ui, sans-serif";
  ctx.fillStyle = "#a5b4fc";
  ctx.fillText(timeLabel, x + totalW / 2, y + 54);

  ctx.restore();
}

// =============================================
//   LOOP PRINCIPAL
// =============================================
let lastFrameTime = null;
function loop(timestamp) {
  if (!ctx) {
    requestAnimationFrame(loop);
    return;
  }

  if (lastFrameTime === null) lastFrameTime = timestamp;
  const delta = (timestamp - lastFrameTime) / 1000;
  lastFrameTime = timestamp;

  ctx.clearRect(0, 0, W, H);

  const pad = 6;
  const cw = (W - pad * (cols + 1)) / cols;
  const ch = (H - pad * (rows + 1)) / rows;

  // 1 — cartas
  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];

    let x = pad + c.x * (cw + pad);
    let y = pad + c.y * (ch + pad);

    const isMatched = matched.includes(c.id);
    const isRevealed = revealed.includes(i);

    ctx.save();

    // sombra
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 16;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 6;

    // fundo
    let grad = ctx.createLinearGradient(x, y, x + cw, y + ch);
    if (isMatched) {
      grad.addColorStop(0, "#22c55e");
      grad.addColorStop(1, "#16a34a");
    } else if (isRevealed) {
      grad.addColorStop(0, "#0ea5e9");
      grad.addColorStop(1, "#0369a1");
    } else {
      grad.addColorStop(0, "#1e293b");
      grad.addColorStop(1, "#020617");
    }

    roundedRect(ctx, x, y, cw, ch, 18);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;

    ctx.lineWidth = isMatched ? 4 : 2;
    ctx.strokeStyle = isMatched
      ? "rgba(34,197,94,0.7)"
      : isRevealed
      ? "rgba(56,189,248,0.7)"
      : "rgba(148,163,184,0.8)";
    ctx.stroke();

    // conteúdo
    const img = isMatched || isRevealed ? getCardImage(c.value) : null;
    if (img && img.complete) {
      const paddingImg = cw * 0.12;
      const iw = cw - paddingImg * 2;
      const ih = ch - paddingImg * 2;
      ctx.drawImage(img, x + paddingImg, y + paddingImg, iw, ih);
    } else {
      ctx.fillStyle = "#e5e7eb";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `${Math.floor(ch * 0.3)}px system-ui, sans-serif`;
      const label = isMatched || isRevealed ? (c.label || "?") : "?";
      ctx.fillText(label, x + cw / 2, y + ch / 2);
    }

    ctx.restore();
  }

  // 2 — partículas e banner
  updateParticles(delta);
  drawParticles();
  drawWinnerBanner(delta);

  requestAnimationFrame(loop);
}

// =============================================
//   ESTADO / WS
// =============================================
function applyState(state) {
  matched = state.matched || [];
  revealed = state.revealed || [];
  scoresCurrent = state.scores || { 1: 0, 2: 0 };

  updateGrid();

  const matchedCount = matched.length;
  const revealedCount = revealed.length;

  const newMatches = matchedCount - lastMatchedCount;
  const newReveals = revealedCount - lastRevealedCount;

  if (newMatches > 0) {
    try {
      sMatch.currentTime = 0;
      sMatch.play();
    } catch {}
    const lastIndex = revealed[revealed.length - 1];
    if (typeof lastIndex === "number") {
      spawnMatchParticles(lastIndex);
    }
  } else if (newReveals > 0) {
    try {
      sError.currentTime = 0;
      sError.play();
    } catch {}
  }

  lastMatchedCount = matchedCount;
  lastRevealedCount = revealedCount;

  draw();
}

function updateScores() {
  document.getElementById("scoreP1").textContent =
    scoresCurrent[1] || 0;

  const p2wrap = document.getElementById("scoreP2Wrapper");
  if (modeSelected === "multi") {
    p2wrap.style.display = "inline";
    document.getElementById("scoreP2").textContent =
      scoresCurrent[2] || 0;
  } else {
    p2wrap.style.display = "none";
  }
}

function showTurn(t, scores) {
  if (scores) scoresCurrent = scores;
  updateScores();
  document.getElementById("status").textContent =
    "Sala " + room + " — vez do jogador " + t;
}

function resetHUD() {
  document.getElementById("timer").textContent = "05:00";
  document.getElementById("scoreP1").textContent = "0";
  document.getElementById("scoreP2").textContent = "0";
  const recordEl = document.getElementById("record");
  if (recordEl) recordEl.textContent = "";
  document.getElementById("scoreP2Wrapper").style.display =
    modeSelected === "multi" ? "inline" : "none";

  if (timerInterval) clearInterval(timerInterval);
  startTime = null;
  scoresCurrent = { 1: 0, 2: 0 };
}

function startTimer() {
  if (timerInterval) clearInterval(timerInterval);
  startTime = Date.now();
  document.getElementById("timer").textContent = "05:00";

  timerInterval = setInterval(() => {
    if (!startTime) return;

    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const remaining = GAME_DURATION_SECONDS - elapsed;
    const clamped = Math.max(0, remaining);

    const m = String(Math.floor(clamped / 60)).padStart(2, "0");
    const s = String(clamped % 60).padStart(2, "0");
    document.getElementById("timer").textContent = `${m}:${s}`;

    if (remaining <= 0) {
      const p1 = scoresCurrent[1] || 0;
      const p2 = scoresCurrent[2] || 0;

      let winner;
      if (modeSelected === "multi") {
        if (p1 > p2) winner = 1;
        else if (p2 > p1) winner = 2;
        else winner = 0; // empate
      } else {
        winner = 1;
      }

      showWinner({ winner });
      return;
    }
  }, 1000);
}

// =============================================
//   INICIAR JOGO
// =============================================
function startGame(mode) {
  modeSelected = mode;
  room = crypto.randomUUID().slice(0, 5);

  if (ws) {
    ws.close();
    ws = null;
  }

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

      if (msg.type === "state") {
        applyState(msg);
        if (typeof msg.turn !== "undefined") showTurn(msg.turn, msg.scores);
      }

      if (msg.type === "turn") showTurn(msg.turn, msg.scores);

      if (msg.type === "end" && !winnerInfo) showWinner(msg);
    },
    onClose(ev) { console.log("[TOTEM] WS fechado", ev.code, ev.reason); },
    onError(err) { console.error("[TOTEM] WS erro", err); }
  });

  document.getElementById("status").textContent =
    "Sala " + room + " — " + mode;
}

// =============================================
//   QR CODE
// =============================================
function renderQRs() {
  const url = new URL(location.href);
  url.searchParams.set("room", room);

  const base = url.toString().replace(/totem\.html.*/, "controller.html");

  const el1 = document.getElementById("qrcode1");
  const el2 = document.getElementById("qrcode2");

  if (el1 && !el1._qr) {
    el1._qr = new QRious({
      element: el1,
      value: base,
      size: 200,
      background: "transparent"
    });
  }
  if (el2 && !el2._qr) {
    el2._qr = new QRious({
      element: el2,
      value: base,
      size: 200,
      background: "transparent"
    });
  }
}

// =============================================
//   VENCEDOR
// =============================================
function showWinner(msg) {
  if (timerInterval) clearInterval(timerInterval);

  const sec = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;
  const m = String(Math.floor(sec / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");

  let textoStatus;
  let textoBanner;

  if (msg.winner === 0 && modeSelected === "multi") {
    textoStatus = "Fim do jogo — Empate!";
    textoBanner = "Empate!";
  } else {
    const w = msg.winner || 1;
    textoStatus = `Fim do jogo — Vencedor: Jogador ${w}`;
    textoBanner = `Jogador ${w} venceu!`;
  }

  document.getElementById("status").textContent =
    `${textoStatus} · Tempo: ${m}:${s}`;

  winnerInfo = {
    winner: msg.winner,
    text: textoBanner,
    timeLabel: `${m}:${s}`,
    anim: 0
  };

  spawnWinBurst();
}

// =============================================
//   INIT
// =============================================
window.addEventListener("load", () => {
  const canvas = document.getElementById("board");
  if (!canvas) return;

  ctx = canvas.getContext("2d");
  W = canvas.width;
  H = canvas.height;

  updateGrid();
  loop(performance.now());
});

// =============================================
//   CLIQUE NO BOARD (FEEDBACK VISUAL)
// =============================================
document.getElementById("board").addEventListener("click", (ev) => {
  const rect = ev.target.getBoundingClientRect();
  const x = ev.clientX - rect.left;
  const y = ev.clientY - rect.top;

  const pad = 6;
  const cw = (W - pad * (cols + 1)) / cols;
  const ch = (H - pad * (rows + 1)) / rows;

  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    const cx = pad + c.x * (cw + pad);
    const cy = pad + c.y * (ch + pad);

    if (x >= cx && x <= cx + cw && y >= cy && y <= cy + ch) {
      const info = document.getElementById("status");
      if (info) info.textContent = "Aguardando jogada dos celulares...";
      break;
    }
  }
});
