const params = new URLSearchParams(location.search);
const player = parseInt(params.get("player"));
const room = params.get("room");

const infoEl = document.getElementById("info");
if (infoEl) infoEl.textContent = `Jogador ${player} — Sala ${room}`;

let scores = { 1: 0, 2: 0 };

let connState = "connecting";
let reconnectTimerId = null;
let pendingMove = null;
let moveTimeoutId = null;
let hasParamError = false;
let hasSeenBoard = false;

const buttons = [];
const connStatusEl = document.getElementById("conn-status");

function updateButtonsEnabled(enabled) {
  const finalEnabled = !!enabled && !hasParamError;
  buttons.forEach(btn => {
    if (btn.dataset.matched === "1") btn.disabled = true;
    else btn.disabled = !finalEnabled;
  });
}

function setConnState(state) {
  connState = state;
  if (connStatusEl) connStatusEl.textContent =
    state === "connecting" ? "Conectando…" :
    state === "connected" ? "Conectado" :
    state === "reconnecting" ? "Reconectando…" :
    "Sem conexão";

  updateButtonsEnabled(state === "connected" && !pendingMove);
}

function clearPendingMove() {
  if (moveTimeoutId) clearTimeout(moveTimeoutId);
  moveTimeoutId = null;
  pendingMove = null;
  updateButtonsEnabled(connState === "connected");
}

function applyMatched(matchedArr) {
  const set = new Set(matchedArr);
  buttons.forEach((btn, idx) => {
    if (set.has(idx)) {
      btn.dataset.matched = "1";
      btn.disabled = true;
      btn.style.visibility = "hidden";
    } else {
      btn.dataset.matched = "0";
      btn.style.visibility = "";
      btn.disabled = !(connState === "connected" && !pendingMove && !hasParamError);
    }
  });
}

// validação inicial dos parâmetros
if (!Number.isInteger(player) || !room || (player !== 1 && player !== 2)) {
  hasParamError = true;
  if (infoEl) infoEl.textContent = "Erro: link inválido. Leia o QR novamente.";
  setConnState("offline");
} else {
  setConnState("connecting");
}

const wsUrl = location.origin.replace("http", "ws") + "/ws/" + room;

/* ============================================================
   UPLOAD DE FOTOS PELO CELULAR → envia para TOTEM
   ============================================================ */
function handleImageUpload(files) {
  const readerPromises = Array.from(files).map(file => {
    return new Promise(res => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.readAsDataURL(file);
    });
  });

  Promise.all(readerPromises).then(images => {
    ws.send(JSON.stringify({ type: "uploadCards", player, images }));
    alert("Cartas personalizadas enviadas para o totem!");
  });
}

const uploadInput = document.getElementById("uploadCards");
if (uploadInput) uploadInput.onchange = e => handleImageUpload(e.target.files);

/* ============================================================
   WEBSOCKET RESILIENTE
   ============================================================ */
const ws = createResilientWebSocket(wsUrl, {
  onOpen() {
    if (hasParamError) return;
    ws.send(JSON.stringify({ type: "join", player }));
    if (reconnectTimerId) clearTimeout(reconnectTimerId);
    setConnState("connected");
  },

  onMessage(e) {
    const msg = JSON.parse(e.data);

    // reinício do jogo no TOTEM → recarregar controller
    if (msg.type === "board") {
      if (!hasSeenBoard) {
        hasSeenBoard = true;
        applyMatched([]);
      } else {
        location.reload();
      }
      return;
    }

    if (msg.type === "turn") {
      updateTurn(msg.turn);
      if (msg.scores) { scores = msg.scores; updateScoreMobile(); }
      if (msg.matched) applyMatched(msg.matched);
      clearPendingMove();
      return;
    }

    if (msg.type === "state") {
      updateTurn(msg.turn);
      if (msg.scores) { scores = msg.scores; updateScoreMobile(); }
      if (msg.matched) applyMatched(msg.matched);
      clearPendingMove();
      return;
    }

    if (msg.type === "end") {
      onEnd(msg);
      if (msg.matched) applyMatched(msg.matched);
      clearPendingMove();
      return;
    }
  },

  onClose() {
    if (hasParamError) return;
    setConnState("reconnecting");

    reconnectTimerId = setTimeout(() => {
      if (connState === "reconnecting") setConnState("offline");
    }, 10000);
  },

  onError(err) {
    console.error("WS Error:", err);
  }
});

/* ============================================================
   FUNÇÕES DE UI
   ============================================================ */

function updateTurn(turn) {
  const el = document.getElementById("turn");
  if (!el) return;
  el.textContent = turn === player ? "Sua vez" : "Aguardando...";
}

function updateScoreMobile() {
  const mine = scores[player] || 0;
  const other = scores[player === 1 ? 2 : 1] || 0;
  const el = document.getElementById("scoreMobile");
  if (el) el.textContent = `Placar – Você: ${mine} | Outro: ${other}`;
}

function onEnd(msg) {
  const el = document.getElementById("turn");
  if (!el) return;

  el.textContent =
    msg.winner === 0 ? "Empate" :
    msg.winner === player ? "Você venceu!" :
    "Você perdeu.";

  if (msg.scores) {
    scores = msg.scores;
    updateScoreMobile();
  }
}

function sendMove(i) {
  if (hasParamError || connState !== "connected" || pendingMove) return;

  const btn = buttons[i];
  if (!btn || btn.dataset.matched === "1") return;

  ws.send(JSON.stringify({ type: "move", player, cardIndex: i }));

  pendingMove = true;
  updateButtonsEnabled(false);

  moveTimeoutId = setTimeout(() => {
    pendingMove = null;
    updateButtonsEnabled(connState === "connected");
    const el = document.getElementById("turn");
    if (el) el.textContent = "Sem resposta do totem, tente novamente.";
  }, 3000);
}

const buttonsDiv = document.getElementById("buttons");
if (buttonsDiv) {
  for (let i = 0; i < 12; i++) {
    const b = document.createElement("button");
    b.textContent = i + 1;
    b.dataset.matched = "0";
    b.onclick = () => sendMove(i);
    buttonsDiv.appendChild(b);
    buttons.push(b);
  }

  updateButtonsEnabled(connState === "connected");
}
