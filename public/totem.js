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

let ctx, W, H, cards = [], matched = [], revealed = [];
let startTime = null, timerInterval = null;
let totalCardsCurrent = 12;
let scoresCurrent = { 1: 0, 2: 0 };

let lastMatchedCount = 0;
let lastRevealedCount = 0;

// partículas e info de vencedor
let particles = [];
let winnerInfo = null;

const cardImages = {};

function getCardImage(value) {
  if (!cardImages[value]) {
    const img = new Image();
    img.src = "cards/" + value + ".jpg";
    img.onload = () => draw();
    cardImages[value] = img;
  }
  return cardImages[value];
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

      if (msg.type === "end") showWinner(msg);
    },
    onClose(ev) { console.log("[TOTEM] WS fechado", ev.code, ev.reason); },
    onError(err) { console.error("[TOTEM] WS erro", err); }
  });

  document.getElementById("status").textContent =
    "Sala " + room + " — " + mode;
}

// =============================================
//   HUD
// =============================================
function resetHUD() {
  document.getElementById("timer").textContent = "00:00";
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
  startTime = Date.now();
  timerInterval = setInterval(() => {
    if (!startTime) return;
    const sec = Math.floor((Date.now() - startTime) / 1000);
    const m = String(Math.floor(sec / 60)).padStart(2, "0");
    const s = String(sec % 60).padStart(2, "0");
    document.getElementById("timer").textContent = `${m}:${s}`;
  }, 1000);
}

// =============================================
//   QR CODE
// =============================================
function renderQRs() {
  const el1 = document.getElementById("qr1");
  const el2 = document.getElementById("qr2");
  const card2 = document.getElementById("qr2-card");

  el1.innerHTML = "";
  el2.innerHTML = "";

  new QRCode(el1, {
    text: location.origin + "/controller.html?player=1&room=" + room,
    width: 130, height: 130
  });

  if (modeSelected === "multi") {
    card2.style.display = "flex";
    new QRCode(el2, {
      text: location.origin + "/controller.html?player=2&room=" + room,
      width: 130, height: 130
    });
  } else {
    card2.style.display = "none";
  }
}

// =============================================
//   TABULEIRO
// =============================================
let cols = 4, rows = 3;

function setupBoard(arr, total) {
  const cv = document.getElementById("board");
  ctx = cv.getContext("2d");
  cv.width = 350;
  cv.height = 350;
  W = cv.width;
  H = cv.height;

  totalCardsCurrent = arr.length || total || 12;

  cards = [];
  let i = 0;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (i >= arr.length) break;
      cards.push({
        x, y,
        value: arr[i++],
        flip: 0,
        animFlip: 0,
        animShake: 0,
        animPulse: 0,
        animFade: 0,
        animGlow: 0
      });
    }
  }

  matched = [];
  revealed = [];
}

// =============================================
//   APLICAR ESTADO + DISPARAR ANIMAÇÕES
// =============================================
function applyState(msg) {
  const newMatchedCount = msg.matched.length;
  const newRevealedCount = msg.revealed.length;

  const hadNewMatch = newMatchedCount > lastMatchedCount;
  const isErrorClose =
    lastRevealedCount > 0 &&
    newRevealedCount === 0 &&
    !hadNewMatch;

  // som de acerto
  if (hadNewMatch) {
    sMatch.currentTime = 0;
    sMatch.play();
  }

  // som de erro
  if (isErrorClose) {
    sError.currentTime = 0;
    sError.play();
  }

  lastMatchedCount = newMatchedCount;
  lastRevealedCount = newRevealedCount;

  matched = msg.matched || [];
  revealed = msg.revealed || [];
  scoresCurrent = msg.scores || scoresCurrent;

  cards.forEach((c, i) => {
    // flip abrindo
    if (revealed.includes(i) && c.flip === 0) {
      c.flip = 1;
      c.animFlip = 1;
    }

    // flip fechando
    if (!revealed.includes(i) && c.flip === 1 && !matched.includes(i)) {
      c.flip = 0;
      c.animFlip = 1;
    }

    // matched - pulse, glow, fade, partículas
    if (matched.includes(i) && c.animFade === 0) {
      c.animPulse = 1;
      c.animGlow = 1;
      spawnParticles(i);
      c.animFade = 1;
    }

    // erro - shake
    if (isErrorClose && !matched.includes(i)) {
      c.animShake = 1;
    }
  });

  updateScores();
}

// =============================================
//   FUNÇÃO DE PARTÍCULAS (ACERTO POR CARTA)
// =============================================
function spawnParticles(cardIndex) {
  const c = cards[cardIndex];

  const pad = 6;
  const cw = (W - pad * (cols + 1)) / cols;
  const ch = (H - pad * (rows + 1)) / rows;

  const cx = pad + c.x * (cw + pad) + cw / 2;
  const cy = pad + c.y * (ch + pad) + ch / 2;

  for (let i = 0; i < 14; i++) {
    particles.push({
      x: cx,
      y: cy,
      vx: (Math.random() - 0.5) * 5,
      vy: (Math.random() - 0.5) * 5,
      life: 1,
      color: ["#ff0", "#fff", "#0f0"][Math.floor(Math.random() * 3)]
    });
  }
}

// =============================================
//   PARTÍCULAS DE VITÓRIA (CENTRO DO TABULEIRO)
// =============================================
function spawnWinBurst() {
  if (!ctx) return;
  const centerX = W / 2;
  const centerY = H / 2;

  for (let i = 0; i < 90; i++) {
    particles.push({
      x: centerX,
      y: centerY,
      vx: (Math.random() - 0.5) * 8,
      vy: (Math.random() - 0.5) * 8,
      life: 1,
      color: ["#ffd700", "#ff00ff", "#00ffff", "#ffffff"][Math.floor(Math.random() * 4)]
    });
  }
}

// =============================================
//   DESENHO + ANIMAÇÕES
// =============================================
function animate() {
  draw();
  requestAnimationFrame(animate);
}
animate();

function draw() {
  if (!ctx) return;

  ctx.clearRect(0, 0, W, H);

  const pad = 6;
  const cw = (W - pad * (cols + 1)) / cols;
  const ch = (H - pad * (rows + 1)) / rows;

  // ===============================
  // 1 — DESENHAR CARTAS
  // ===============================
  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];

    let x = pad + c.x * (cw + pad);
    let y = pad + c.y * (ch + pad);

    ctx.save();

    // ---- animação flip (3D) ----
    let flipX = 1;
    if (c.animFlip > 0) {
      flipX = Math.abs(Math.cos((1 - c.animFlip) * Math.PI));
      c.animFlip -= 0.08;
      if (c.animFlip < 0) c.animFlip = 0;
    }

    // ---- animação shake (erro) ----
    let shake = 0;
    if (c.animShake > 0) {
      shake = Math.sin(c.animShake * Math.PI * 6) * 5;
      c.animShake -= 0.06;
      if (c.animShake < 0) c.animShake = 0;
    }

    // ---- animação pulse (acerto) ----
    let pulse = 1;
    if (c.animPulse > 0) {
      pulse = 1 + Math.sin(c.animPulse * Math.PI) * 0.18;
      c.animPulse -= 0.04;
      if (c.animPulse < 0) c.animPulse = 0;
    }

    // ---- glow (acerto) ----
    if (c.animGlow > 0) {
      const g = c.animGlow;
      ctx.shadowColor = "rgba(255,255,100," + g + ")";
      ctx.shadowBlur = 30 * g;
      c.animGlow -= 0.03;
      if (c.animGlow < 0) c.animGlow = 0;
    }

    // ---- fade (desaparecer matched) ----
    let alpha = 1;
    if (c.animFade > 0 && matched.includes(i)) {
      alpha = c.animFade;
      c.animFade -= 0.02;
      if (c.animFade < 0) c.animFade = 0;
    }

    // aplicar transformações
    ctx.translate(x + cw / 2 + shake, y + ch / 2);
    ctx.scale(flipX * pulse, pulse);
    ctx.translate(-cw / 2, -ch / 2);
    ctx.globalAlpha = alpha;

    // desenhar carta
    const isMatched = matched.includes(i);
    const isRevealed = revealed.includes(i);

    ctx.fillStyle = isMatched ? "#0a0" : (isRevealed ? "#999" : "#222");
    ctx.fillRect(0, 0, cw, ch);

    ctx.strokeStyle = "#fff";
    ctx.strokeRect(0, 0, cw, ch);

    if (isMatched || isRevealed) {
      const img = getCardImage(c.value);
      if (img && img.complete) ctx.drawImage(img, 0, 0, cw, ch);
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // ======================================
  // 2 — DESENHAR PARTÍCULAS GAMER
  // ======================================
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life -= 0.03;

    ctx.fillStyle = p.color + Math.floor(p.life * 255).toString(16).padStart(2, "0");
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();

    if (p.life <= 0) particles.splice(i, 1);
  }

  // ======================================
  // 3 — BANNER DO VENCEDOR
  // ======================================
  if (winnerInfo && winnerInfo.anim > 0) {
    const alpha = Math.min(1, winnerInfo.anim);
    const bannerW = W * 0.85;
    const bannerH = 80;
    const x = (W - bannerW) / 2;
    const y = H / 2 - bannerH / 2;

    ctx.save();
    ctx.globalAlpha = alpha;

    const grd = ctx.createLinearGradient(x, y, x + bannerW, y + bannerH);
    grd.addColorStop(0, "#222");
    grd.addColorStop(0.3, "#444");
    grd.addColorStop(0.7, "#555");
    grd.addColorStop(1, "#222");

    ctx.fillStyle = grd;
    ctx.strokeStyle = "#ffd700";
    ctx.lineWidth = 3;

    ctx.fillRect(x, y, bannerW, bannerH);
    ctx.strokeRect(x, y, bannerW, bannerH);

    ctx.fillStyle = "#ffd700";
    ctx.font = "20px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(winnerInfo.text, W / 2, y + bannerH / 2 - 12);

    ctx.fillStyle = "#ffffff";
    ctx.font = "14px Arial";
    ctx.fillText("Tempo: " + winnerInfo.timeLabel, W / 2, y + bannerH / 2 + 14);

    ctx.restore();

    // diminui bem mais devagar para dar tempo de ler
    winnerInfo.anim -= 0.001;
    if (winnerInfo.anim < 0) winnerInfo.anim = 0;

  }
}

// =============================================
//   TURN / SCORES / END
// =============================================
function showTurn(t, scores) {
  if (scores) scoresCurrent = scores;
  updateScores();
  document.getElementById("status").textContent =
    "Sala " + room + " — vez do jogador " + t;
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
    anim: 1
  };

  spawnWinBurst();
}
