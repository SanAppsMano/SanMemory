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

  // o HTML original define width/height do canvas (ex.: 350x350)
  ctx = canvas.getContext("2d");
  W = canvas.width;
  H = canvas.height;

  draw();
}

function getGridConfig() {
  // 12 cartas = 4x3, 24 cartas = 6x4 (mesma lógica do original)
  if (totalCardsCurrent === 24) {
    return { cols: 6, rows: 4 };
  }
  return { cols: 4, rows: 3 };
}

function cardRect(index) {
  const { cols, rows } = getGridConfig();

  const padding = 20;
  const cardW = (W - padding * (cols + 1)) / cols;
  const cardH = (H - padding * (rows + 1)) / rows;

  const col = index % cols;
  const row = Math.floor(index / cols);

  const x = padding + col * (cardW + padding);
  const y = padding + row * (cardH + padding);

  return { x, y, w: cardW, h: cardH };
}

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

function drawCard(index) {
  const card = cards[index];
  if (!card) return;

  const rect = cardRect(index);
  const isMatched = matched.includes(card.id);
  const isRevealed = revealed.includes(index);

  ctx.save();

  // sombra
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 6;

  // fundo gradiente
  let grad = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
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

  const radius = 18;
  roundedRect(ctx, rect.x, rect.y, rect.w, rect.h, radius);
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
  const img = isMatched || isRevealed ? getCardImage(card.value) : null;

  if (img && img.complete) {
    const paddingImg = rect.w * 0.12;
    const iw = rect.w - paddingImg * 2;
    const ih = rect.h - paddingImg * 2;
    ctx.drawImage(img, rect.x + paddingImg, rect.y + paddingImg, iw, ih);
  } else {
    // fallback com texto
    ctx.fillStyle = "#e5e7eb";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${Math.floor(rect.h * 0.3)}px system-ui, sans-serif`;
    const label = isMatched || isRevealed ? (card.label || "?") : "?";
    ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2);
  }

  ctx.restore();
}

// =============================================
//   PARTÍCULAS / ANIMAÇÃO
// =============================================
function spawnMatchParticles(index) {
  const rect = cardRect(index);
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;

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
  if (!W || !H) return;
  const cx = W / 2;
  const cy = 60;

  for (let i = 0; i < 80; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 4;
    particles.push({
      x: cx,
      y: cy,
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
  const { anim, text, timeLabel } = winnerInfo;

  winnerInfo.anim = Math.min(1, winnerInfo.anim + delta * 1.2);
  const alpha = winnerInfo.anim;

  const bannerH = 80;
  const targetY = 40;
  const startY = -bannerH;
  const t = 1 - Math.pow(1 - alpha, 3);
  const y = startY + (targetY - startY) * t;

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

  for (let i = 0; i < cards.length; i++) {
    drawCard(i);
  }

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

  const matchedCount = matched.length;
  const revealedCount = revealed.length;

  const newMatches = matchedCount - lastMatchedCount;
  const newReveals = revealedCount - lastRevealedCount;

  if (newMatches > 0) {
    try {
      sMatch.currentTime = 0;
      sMatch.play();
    } catch {}
    // pega o último índice revelado como referência para partículas
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

function showTurn(turn, scores) {
  const p1 = scores?.[1] ?? 0;
  const p2 = scores?.[2] ?? 0;

  document.getElementById("scoreP1").textContent = p1;
  document.getElementById("scoreP2").textContent = p2;

  let texto = "";
  if (modeSelected === "single") {
    texto = "Modo 1 Jogador";
  } else {
    texto = "Vez do Jogador " + turn;
  }

  document.getElementById("status").textContent = texto;
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

function initWebSocket(mode) {
  if (!room) return;

  if (ws) {
    ws.close();
    ws = null;
  }

  resetHUD();
  winnerInfo = null;

  const wsUrl = location.origin.replace("http", "ws") + "/ws/" + room;

  ws = createResilientWebSocket(wsUrl, {
    onOpen() {
      ws.send(
        JSON.stringify({
          type: "start",
          mode: modeSelected,
          totalCards: 12
        })
      );
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
    onClose(ev) {
      console.log("[TOTEM] WS fechado", ev.code, ev.reason);
    },
    onError(err) {
      console.error("[TOTEM] WS erro", err);
    }
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
  const params = new URLSearchParams(location.search);
  room = params.get("room") || "sala-1";
  modeSelected = params.get("mode") || "multi";

  const canvas = document.getElementById("board");
  if (!canvas) return;

  ctx = canvas.getContext("2d");
  W = canvas.width;
  H = canvas.height;

  loop(performance.now());
  initWebSocket(modeSelected);
});

// =============================================
//   CLIQUE NO BOARD (FEEDBACK VISUAL)
// =============================================
document.getElementById("board").addEventListener("click", (ev) => {
  const rect = ev.target.getBoundingClientRect();
  const x = ev.clientX - rect.left;
  const y = ev.clientY - rect.top;

  for (let i = 0; i < cards.length; i++) {
    const r = cardRect(i);
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
      const info = document.getElementById("status");
      if (info) {
        info.textContent = "Aguardando jogada dos celulares...";
      }
      break;
    }
  }
});
