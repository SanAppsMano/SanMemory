export class Room {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.clients = [];
    this.game = {
      mode: "multi",
      totalCards: 12,
      board: [],
      players: { 1: false, 2: false },
      turn: 1,
      revealed: [],
      matched: [],
      scores: { 1: 0, 2: 0 }
    };
  }

  async fetch(req) {
    const upgrade = req.headers.get("Upgrade");
    if (upgrade !== "websocket")
      return new Response("Expected WebSocket", { status: 400 });

    const [client, server] = Object.values(new WebSocketPair());
    this.handleSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  handleSocket(ws) {
    ws.accept();
    this.clients.push(ws);

    ws.addEventListener("close", () => {
      this.clients = this.clients.filter(c => c !== ws);
    });

    ws.addEventListener("message", evt => {
      let msg;
      try { msg = JSON.parse(evt.data); } catch { return; }
      this.onMessage(ws, msg);
    });
  }

  broadcast(obj) {
    const data = JSON.stringify(obj);
    for (const c of this.clients) {
      try { c.send(data); } catch {}
    }
  }

  onMessage(ws, msg) {
    if (msg.type === "join") {
      if (msg.player === 1 || msg.player === 2)
        this.game.players[msg.player] = true;

      this.broadcast({
        type: "players",
        players: this.game.players,
        mode: this.game.mode,
        scores: this.game.scores
      });
      return;
    }

    if (msg.type === "start") {
      const mode = msg.mode === "single" ? "single" : "multi";
      this.game.mode = mode;
      this.game.totalCards = Number(msg.totalCards) || 12;
      this.game.board = this.generateBoard(this.game.totalCards);
      this.game.turn = 1;
      this.game.revealed = [];
      this.game.matched = [];
      this.game.scores = { 1: 0, 2: 0 };

      this.broadcast({
        type: "board",
        board: this.game.board,
        mode: this.game.mode,
        totalCards: this.game.totalCards
      });

      this.broadcast({
        type: "turn",
        turn: this.game.turn,
        mode: this.game.mode,
        scores: this.game.scores
      });
      return;
    }

    if (msg.type === "move") {
      if (!Array.isArray(this.game.board) || this.game.board.length === 0)
        return;

      let player = msg.player;

      if (this.game.mode === "multi") {
        if (player !== this.game.turn) return;
        if (player !== 1 && player !== 2) return;
      } else {
        player = 1;
      }

      const idx = Number(msg.cardIndex);
      if (!Number.isInteger(idx)) return;
      if (idx < 0 || idx >= this.game.board.length) return;
      if (this.game.matched.includes(idx)) return;
      if (this.game.revealed.includes(idx)) return;

      this.game.revealed.push(idx);

      if (this.game.revealed.length === 2) {
        const [a, b] = this.game.revealed;
        if (a === b) {
          this.game.revealed = [];
        } else {
          if (this.game.board[a] === this.game.board[b]) {
            if (!this.game.matched.includes(a)) this.game.matched.push(a);
            if (!this.game.matched.includes(b)) this.game.matched.push(b);

            const currentScore = this.game.scores[player] || 0;
            this.game.scores[player] = currentScore + 1;
          } else {
            if (this.game.mode === "multi")
              this.game.turn = this.game.turn === 1 ? 2 : 1;
          }
          this.game.revealed = [];
        }
      }

      this.broadcast({
        type: "state",
        mode: this.game.mode,
        turn: this.game.turn,
        revealed: this.game.revealed,
        matched: this.game.matched,
        totalCards: this.game.totalCards,
        scores: this.game.scores
      });

      if (this.game.matched.length === this.game.board.length) {
        let winner = 1;
        if (this.game.mode === "multi") {
          const s1 = this.game.scores[1] || 0;
          const s2 = this.game.scores[2] || 0;
          if (s2 > s1) winner = 2;
          else if (s1 === s2) winner = 0;
        } else {
          winner = 1;
        }

        this.broadcast({
          type: "end",
          mode: this.game.mode,
          winner,
          scores: this.game.scores
        });
      }
      return;
    }
  }

  generateBoard(n) {
    const total = Number(n) || 12;
    const pairs = Math.max(1, Math.floor(total / 2));
    let arr = [];
    for (let i = 1; i <= pairs; i++) arr.push(i, i);
    arr = arr.slice(0, pairs * 2);
    arr.sort(() => Math.random() - 0.5);
    return arr;
  }
}
