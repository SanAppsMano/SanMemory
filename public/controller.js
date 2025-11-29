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

/* ============================================================
   HELPERS PARA IMAGENS (FILE -> BASE64 / REDUÇÃO)
   ============================================================ */

function fileToDataURL(file) {
  return new Promise(resolve => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.readAsDataURL(file);
  });
}

function maybeResizeBase64(base64, file) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;

      const maxDim = 600; // mais agressivo: máx 600px no maior lado
      const maxBytes = 1.5 * 1024 * 1024; // ~1.5MB de arquivo original
      const isBig =
        file.size > maxBytes ||
        w > maxDim ||
        h > maxDim;

      if (!isBig) {
        return resolve(base64);
      }

      const ok = confirm(
        `A imagem "${file.name}" é grande (${w}x${h}, ${(file.size / 1024).toFixed(0)} KB).\n` +
        `Deseja reduzir para caber melhor no jogo?`
      );

      if (!ok) {
        return resolve(base64);
      }

      const ratio = Math.min(maxDim / w, maxDim / h, 1);
      const newW = Math.round(w * ratio);
      const newH = Math.round(h * ratio);

      const canvas = document.createElement("canvas");
      canvas.width = newW;
      canvas.height = newH;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, newW, newH);

      // qualidade mais baixa pra reduzir bastante o payload
      const resized = canvas.toDataURL("image/jpeg", 0.75);
      resolve(resized);
    };
    img.onerror = () => resolve(base64);
    img.src = base64;
  });
}

/* ============================================================
   UPLOAD DE IMAGENS – APENAS JOGADOR 1 + CRÍTICA
   ============================================================ */

async function handleImageUpload(files) {
  if (player !== 1) {
    alert("Apenas o Jogador 1 pode enviar cartas personalizadas.");
    return;
  }
  if (!files || !files.length) return;

  const allowed = ["image/jpeg", "image/png", "image/webp"];

  const fileArray = Array.from(files);
  const validFiles = [];
  const invalidFiles = [];

  for (const f of fileArray) {
    let mime = f.type || "";

    if (!mime && f.name) {
      const lower = f.name.toLowerCase();
      if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) mime = "image/jpeg";
      else if (lower.endsWith(".png")) mime = "image/png";
      else if (lower.endsWith(".webp")) mime = "image/webp";
    }

    if (!mime || allowed.includes(mime)) {
      validFiles.push(f);
    } else {
      invalidFiles.push({ name: f.name, type: mime });
    }
  }

  if (invalidFiles.length > 0) {
    const nomes = invalidFiles
      .map(f => `${f.name} (${f.type || "tipo desconhecido"})`)
      .join("\n");
    alert(
      "Algumas imagens não são compatíveis e NÃO serão usadas.\n" +
      "Use apenas JPG, PNG ou WEBP.\n\n" +
      "Ignoradas:\n" + nomes
    );
  }

  if (!validFiles.length) {
    alert("Nenhuma imagem compatível foi selecionada. Use JPG, PNG ou WEBP.");
    return;
  }

  const images = [];
  for (const file of validFiles) {
    try {
      const base64 = await fileToDataURL(file);
      const processed = await maybeResizeBase64(base64, file);
      images.push(processed);
    } catch (e) {
      console.error("[CTRL] erro ao processar imagem", file.name, e);
    }
  }

  if (!images.length) {
    alert("Nenhuma imagem pôde ser processada.");
    return;
  }

  // garantir que há conexão ativa com o totem antes de enviar
  if (hasParamError || connState !== "connected" || ws.readyState !== WebSocket.OPEN) {
    alert("Sem conexão com o totem. Confira o QR/código da sala e tente novamente.");
    return;
  }

  // checar tamanho total do payload antes de enviar
  const totalChars = images.reduce((sum, b64) => sum + (b64 ? b64.length : 0), 0);
  // limite conservador: ~800k caracteres (~600KB de dados úteis)
  const maxChars = 800000;

  if (totalChars > maxChars) {
    alert(
      "As imagens ainda ficaram muito pesadas para enviar de uma vez.\n\n" +
      "Dicas:\n" +
      "- Use menos imagens, ou\n" +
      "- Escolha fotos menores (tirar print ou recortar), ou\n" +
      "- Comprimir as imagens antes.\n\n" +
      `Tamanho atual: ${(totalChars / 1024).toFixed(0)} KB (limite aproximado: ${(maxChars / 1024).toFixed(0)} KB).`
    );
    return;
  }

  try {
    console.log("[CTRL] enviando uploadCards, imagens =", images.length, "totalChars =", totalChars);
    const ok = ws.send(JSON.stringify({
      type: "uploadCards",
      player,
      images
    }));
    if (!ok) {
      alert("Não foi possível enviar as cartas. Verifique a conexão e tente novamente.");
      return;
    }
    alert("Cartas personalizadas enviadas para o totem!");
  } catch (e) {
    console.error("[CTRL] erro ao enviar cartas personalizadas", e);
  }
}

const uploadInput = document.getElementById("uploadCards");
if (uploadInput) {
  if (player !== 1) {
    const wrapper = uploadInput.closest("#custom-cards-area");
    if (wrapper) wrapper.remove();
  } else {
    uploadInput.addEventListener("change", e => {
      handleImageUpload(e.target.files);
      uploadInput.value = "";
    });
  }
}

/* ============================================================
   WEBSOCKET RESILIENTE
   ============================================================ */

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

    // eco do upload, o controle não precisa reagir
    if (msg.type === "uploadCards") {
      return;
    }

    // sempre que o totem começa um novo jogo, o DO manda "board"
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
