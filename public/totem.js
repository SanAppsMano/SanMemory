let ws, room, modeSelected = "multi";
let ctx, W, H, cards = [], matched = [], revealed = [];
let startTime = null, timerInterval = null;
let totalCardsCurrent = 12;
let scoresCurrent = { 1: 0, 2: 0 };

// cache de imagens das cartas
const cardImages = {};

function getCardImage(value) {
  if (!cardImages[value]) {
    const img = new Image();
    img.src = "cards/" + value + ".png";
    img.onload = () => {
      // quando carregar alguma imagem, redesenha o tabuleiro
      draw();
    };
    cardImages[value] = img;
  }
  return cardImages[value];
}

function startGame(mode) {
  modeSelected = mode;
  room = crypto.randomUUID().slice(0, 5);

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.close();
  }

  resetHUD();

  ws = new WebSocket(location.origin.replace("http", "ws") + "/ws/" + room);

  ws.onopen = () => {
    ws.send(JSON.stringify({
      type: "start",
      mode: modeSelected,
      totalCards: 12
    }));
    renderQRs();
    startTimer();
  };

  ws.onmessage = e => {
    const msg = JSON.parse(e.data);
    if (msg.type === "board") setupBoard(msg.board, msg.totalCards);
    if (msg.type === "state") applyState(msg);
    if (msg.type === "turn") showTurn(msg.turn, msg.scores);
    if (msg.type === "end") showWinner(msg);
  };

  document.getElementById("status").textContent = "Sala " + room + " — " + mode;
}

function resetHUD() {
  document.getElementById("timer").textContent = "00:00";
  document.getElementById("scoreP1").textContent = "0";
  document.getElementById("scoreP2").textContent = "0";
  document.getElementById("record").textContent = "";
  document.getElementById("scoreP2Wrapper").style.display =
    modeSelected === "multi" ? "inline" : "none";

  if (timerInterval) clearInterval(timerInterval);
  startTime = null;
  scoresCurrent = { 1: 0, 2: 0 };
}

function renderQRs() {
  new QRious({
    element: document.getElementById("qr1"),
    value: location.origin + "/controller.html?player=1&room=" + room,
    size: 130
  });

  if (modeSelected === "multi") {
    new QRious({
      element: document.getElementById("qr2"),
      value: location.origin + "/controller.html?player=2&room=" + room,
      size: 130
    });
  } else {
    document.getElementById("qr2").innerHTML = "";
  }
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

let cols = 4, rows = 3;

function setupBoard(arr, total) {
  const cv = document.getElementById("board");
  ctx = cv.getContext("2d");
  cv.width = 350;
  cv.height = 350;
  W = cv.width; H = cv.height;

  totalCardsCurrent = arr.length || total || 12;

  cards = [];
  let i = 0;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (i >= arr.length) break;
      cards.push({ x, y, value: arr[i++] });
    }
  }
  matched = [];
  revealed = [];
  draw();
}

function draw() {
  if (!ctx) return;
  ctx.clearRect(0, 0, W, H);
  const pad = 6;
  const cw = (W - pad * (cols + 1)) / cols;
  const ch = (H - pad * (rows + 1)) / rows;

  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    const x = pad + c.x * (cw + pad);
    const y = pad + c.y * (ch + pad);

    const isMatched = matched.includes(i);
    const isRevealed = revealed.includes(i);
    const faceUp = isMatched || isRevealed;

    if (isMatched) ctx.fillStyle = "#0a0";
    else if (isRevealed) ctx.fillStyle = "#777";
    else ctx.fillStyle = "#333";

    ctx.fillRect(x, y, cw, ch);
    ctx.strokeStyle = "#aaa";
    ctx.strokeRect(x, y, cw, ch);

    if (faceUp) {
      const img = getCardImage(c.value);
      if (img && img.complete) {
        ctx.drawImage(img, x, y, cw, ch);
      } else {
        // fallback: mostra o número enquanto a imagem não carregou
        ctx.fillStyle = "#fff";
        ctx.font = Math.floor(ch * 0.4) + "px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(c.value, x + cw / 2, y + ch / 2);
      }
    }
  }
}

function applyState(msg) {
  matched = msg.matched || [];
  revealed = msg.revealed || [];
  scoresCurrent = msg.scores || scoresCurrent;
  updateScores();
  draw();
}

function updateScores() {
  document.getElementById("scoreP1").textContent =
    (scoresCurrent[1] || 0).toString();

  const p2wrap = document.getElementById("scoreP2Wrapper");
  if (modeSelected === "multi") {
    p2wrap.style.display = "inline";
    document.getElementById("scoreP2").textContent =
      (scoresCurrent[2] || 0).toString();
  } else {
    p2wrap.style.display = "none";
  }
}

function showTurn(t, scores) {
  if (scores) {
    scoresCurrent = scores;
    updateScores();
  }
  document.getElementById("status").textContent =
    "Sala " + room + " — vez do jogador " + t;
}

function showWinner(msg) {
  if (timerInterval) clearInterval(timerInterval);
  const sec = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;
  const m = String(Math.floor(sec / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");

  let texto = `Fim do jogo — `;
  if (msg.winner === 0 && modeSelected === "multi") {
    texto += `Empate!`;
  } else {
    texto += `Vencedor: Jogador ${msg.winner || 1}`;
  }
  texto += ` · Tempo: ${m}:${s}`;

  document.getElementById("status").textContent = texto;

  registrarRecorde(sec);
}

function registrarRecorde(segundos) {
  const key = `sanmemory_record_${modeSelected}_${totalCardsCurrent}`;
  const antigo = parseInt(localStorage.getItem(key) || "0", 10);
  const el = document.getElementById("record");

  if (!antigo || segundos < antigo) {
    localStorage.setItem(key, String(segundos));
    const m = String(Math.floor(segundos / 60)).padStart(2, "0");
    const s = String(segundos % 60).padStart(2, "0");
    el.textContent =
      `Novo recorde (${modeSelected}/${totalCardsCurrent} cartas): ${m}:${s}`;
  } else {
    const m = String(Math.floor(antigo / 60)).padStart(2, "0");
    const s = String(antigo % 60).padStart(2, "0");
    el.textContent =
      `Recorde atual (${modeSelected}/${totalCardsCurrent} cartas): ${m}:${s}`;
  }
}
