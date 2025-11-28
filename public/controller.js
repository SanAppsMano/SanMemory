const params = new URLSearchParams(location.search);
const player = parseInt(params.get("player"));
const room = params.get("room");

const infoEl = document.getElementById("info");
if (infoEl) {
  infoEl.textContent = "Jogador " + player + " — Sala " + room;
}

let scores = { 1: 0, 2: 0 };

let connState = "connecting";
let reconnectTimerId = null;
let pendingMove = null;
let moveTimeoutId = null;
let hasParamError = false;
const buttons = [];
const connStatusEl = document.getElementById("conn-status");

// usado para detectar reinício de jogo no totem
let hasSeenBoard = false;

function updateButtonsEnabled(enabled) {
  const finalEnabled = !!enabled && !hasParamError;
  for (let i = 0; i < buttons.length; i++) {
    const b = buttons[i];
    if (!b) continue;
    if (b.dataset.matched === "1") {
      b.disabled = true;
      continue;
    }
    b.disabled = !finalEnabled;
  }
}

function setConnState(state) {
  connState = state;
  if (connStatusEl) {
    if (state === "connecting") connStatusEl.textContent = "Conectando…";
    else if (state === "connected") connStatusEl.textContent = "Conectado";
    else if (state === "reconnecting") connStatusEl.textContent = "Reconectando…";
    else if (state === "offline") connStatusEl.textContent = "Sem conexão";
  }
  updateButtonsEnabled(state === "connected" && !pendingMove);
}

function clearPendingMove() {
  if (moveTimeoutId) {
    clearTimeout(moveTimeoutId);
    moveTimeoutId = null;
  }
  pendingMove = null;
  updateButtonsEnabled(connState === "connected");
}

function applyMatched(matchedArr) {
  if (!Array.isArray(matchedArr)) return;
  const set = new Set(matchedArr);
  for (let i = 0; i < buttons.length; i++) {
    const b = buttons[i];
    if (!b) continue;
    if (set.has(i)) {
      b.dataset.matched = "1";
      b.disabled = true;
      b.style.visibility = "hidden";
    } else {
      b.dataset.matched = "0";
      b.style.visibility = "";
      b.disabled = !(connState === "connected" && !pendingMove && !hasParamError);
    }
  }
}

// validação de parâmetros
if (!Number.isInteger(player) || (player !== 1 && player !== 2) || !room) {
  hasParamError = true;
  if (infoEl) {
    infoEl.textContent = "Erro: link inválido. Leia o QR novamente.";
  }
  setConnState("offline");
} else {
  setConnState("connecting");
}

const wsUrl = location.origin.replace("http", "ws") + "/ws/" + room;

const ws = createResilientWebSocket(wsUrl, {
  onOpen(ev) {
    console.log("[CTRL] WS aberto", ev);
    if (hasParamError) return;
    ws.send(JSON.stringify({ type: "join", player }));
    if (reconnectTimerId) {
      clearTimeout(reconnectTimerId);
      reconnectTimerId = null;
    }
    setConnState("connected");
  },
  onMessage(e) {
    const msg = JSON.parse(e.data);

    // sempre que o totem começa um novo jogo, o DO manda "board"
    if (msg.type === "board") {
      if (!hasSeenBoard) {
        hasSeenBoard = true;
        // primeira vez: só garante que todos os botões voltem
        applyMatched([]);
      } else {
        // novo "start" no totem: recarrega o controller (F5)
        location.reload();
      }
      return;
    }

    if (msg.type === "turn") {
      updateTurn(msg.turn);
      if (msg.scores) {
        scores = msg.scores;
        updateScoreMobile();
      }
      if (Array.isArray(msg.matched)) {
        applyMatched(msg.matched);
      }
      clearPendingMove();
    }

    if (msg.type === "state") {
      updateTurn(msg.turn);
      if (msg.scores) {
        scores = msg.scores;
        updateScoreMobile();
      }
      if (Array.isArray(msg.matched)) {
        applyMatched(msg.matched);
      }
      clearPendingMove();
    }

    if (msg.type === "end") {
      onEnd(msg);
      if (Array.isArray(msg.matched)) {
        applyMatched(msg.matched);
      }
      clearPendingMove();
    }
  },
  onClose(ev) {
    console.log("[CTRL] WS fechado", ev.code, ev.reason);
    if (hasParamError) return;
    setConnState("reconnecting");
    if (reconnectTimerId) {
      clearTimeout(reconnectTimerId);
    }
    reconnectTimerId = setTimeout(() => {
      if (connState === "reconnecting") {
        setConnState("offline");
      }
    }, 10000);
  },
  onError(err) {
    console.error("[CTRL] WS erro", err);
  }
});

function updateTurn(turn) {
  const el = document.getElementById("turn");
  if (!el) return;
  el.textContent = (turn === player) ? "Sua vez" : "Aguardando...";
}

function updateScoreMobile() {
  const mine = scores[player] || 0;
  const other = scores[player === 1 ? 2 : 1] || 0;
  const el = document.getElementById("scoreMobile");
  if (!el) return;
  el.textContent = `Placar – Você: ${mine} | Outro: ${other}`;
}

function onEnd(msg) {
  const el = document.getElementById("turn");
  if (!el) return;

  let txt;
  if (msg.winner === 0) {
    txt = "Fim — Empate!";
  } else if (msg.winner === player) {
    txt = "Fim — Você venceu!";
  } else {
    txt = "Fim — Você perdeu.";
  }
  el.textContent = txt;
  if (msg.scores) {
    scores = msg.scores;
    updateScoreMobile();
  }
}

function sendMove(i) {
  if (hasParamError) return;
  if (connState !== "connected") return;
  if (pendingMove) return;

  const btn = buttons[i];
  if (!btn) return;
  if (btn.dataset.matched === "1") return;

  const ok = ws.send(JSON.stringify({
    type: "move",
    player,
    cardIndex: i
  }));
  if (!ok) return;

  pendingMove = { cardIndex: i, timestamp: Date.now() };
  updateButtonsEnabled(false);
  moveTimeoutId = setTimeout(() => {
    pendingMove = null;
    updateButtonsEnabled(connState === "connected");
    const el = document.getElementById("turn");
    if (el && connState === "connected") {
      el.textContent = "Sem resposta do totem, tente novamente.";
    }
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
  updateButtonsEnabled(connState === "connected" && !pendingMove);
}
