const params = new URLSearchParams(location.search);
const player = parseInt(params.get("player"));
const room = params.get("room");

document.getElementById("info").textContent =
  "Jogador " + player + " — Sala " + room;

let scores = { 1: 0, 2: 0 };

// URL original do WS
const wsUrl = location.origin.replace("http", "ws") + "/ws/" + room;

// WebSocket resiliente com heartbeat + reconnect
const ws = createResilientWebSocket(wsUrl, {
  onOpen() {
    // Mesmo comportamento: enviar "join" quando conecta
    ws.send(JSON.stringify({ type: "join", player }));
  },
  onMessage(e) {
    const msg = JSON.parse(e.data);

    if (msg.type === "turn") {
      updateTurn(msg.turn);
      if (msg.scores) {
        scores = msg.scores;
        updateScoreMobile();
      }
    }

    if (msg.type === "state") {
      updateTurn(msg.turn);
      if (msg.scores) {
        scores = msg.scores;
        updateScoreMobile();
      }
    }

    if (msg.type === "end") {
      onEnd(msg);
    }
  },
  onClose(ev) {
    console.log("[CTRL] WS fechado", ev.code, ev.reason);
  },
  onError(err) {
    console.error("[CTRL] WS erro", err);
  }
});

function updateTurn(turn) {
  const el = document.getElementById("turn");
  el.textContent = (turn === player) ? "Sua vez" : "Aguardando...";
}

function updateScoreMobile() {
  const mine = scores[player] || 0;
  const other = scores[player === 1 ? 2 : 1] || 0;
  document.getElementById("scoreMobile").textContent =
    `Placar – Você: ${mine} | Outro: ${other}`;
}

function onEnd(msg) {
  let txt;
  if (msg.winner === 0) {
    txt = "Fim — Empate!";
  } else if (msg.winner === player) {
    txt = "Fim — Você venceu!";
  } else {
    txt = "Fim — Você perdeu.";
  }
  document.getElementById("turn").textContent = txt;
  if (msg.scores) {
    scores = msg.scores;
    updateScoreMobile();
  }
}

function sendMove(i) {
  ws.send(JSON.stringify({
    type: "move",
    player,
    cardIndex: i
  }));
}

const buttonsDiv = document.getElementById("buttons");
for (let i = 0; i < 12; i++) {
  const b = document.createElement("button");
  b.textContent = i + 1;
  b.onclick = () => sendMove(i);
  buttonsDiv.appendChild(b);
}
