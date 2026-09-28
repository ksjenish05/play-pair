const path = require("path");
const express = require("express");
const { Server } = require("socket.io");

const app = express();
const port = process.env.PORT || 3000;
const server = app.listen(port, "0.0.0.0", () => {
  console.log(`Play Pair is running on port ${port}`);
});
const io = new Server(server);
const rooms = new Map();
const MAX_CRICKET_BALLS = 12;

app.use(express.static(path.join(__dirname, "public")));

function code() {
  let value;
  do value = Math.random().toString(36).slice(2, 7).toUpperCase(); while (rooms.has(value));
  return value;
}

function newCard() {
  return [...Array(25).keys()].map(n => n + 1).sort(() => Math.random() - 0.5);
}

function roomFor(socket) { return rooms.get(socket.data.roomCode); }
function playerIndex(room, socket) { return room.players.findIndex(p => p.id === socket.id); }
function publicRoom(room, socketId) {
  const viewer = room.players.findIndex(p => p.id === socketId);
  const cricket = room.cricket && { ...room.cricket, hasChosen: viewer >= 0 ? room.cricket.choices[viewer] !== null : false };
  if (cricket) delete cricket.choices;
  const base = {
    code: room.code, mode: room.mode, status: room.status,
    me: viewer,
    players: room.players.map((p, i) => ({ name: p.name, connected: p.connected, score: room.cricket?.scores[i] || 0, lines: room.bingo?.lines[i] || 0 })),
    cricket,
    bingo: room.bingo && {
      turn: room.bingo.turn, called: room.bingo.called, winner: room.bingo.winner,
      myCard: viewer >= 0 ? room.bingo.cards[viewer] : [],
      myMarked: viewer >= 0 ? room.bingo.marked[viewer] : []
    }
  };
  return base;
}
function emitRoom(room) {
  room.players.forEach(p => io.to(p.id).emit("room:update", publicRoom(room, p.id)));
}
function resetGame(room) {
  room.status = "playing";
  if (room.mode === "cricket") room.cricket = { innings: 0, batting: 0, balls: 0, scores: [0, 0], choices: [null, null], message: `${room.players[0].name} is batting` };
  if (room.mode === "bingo") room.bingo = { turn: 0, cards: [newCard(), newCard()], marked: [[], []], called: [], lines: [0, 0], winner: null };
}
function finishCricketInnings(room) {
  const c = room.cricket;
  if (c.innings === 0) {
    c.innings = 1; c.batting = 1; c.balls = 0;
    c.message = `${room.players[1].name} needs ${c.scores[0] + 1} runs`;
  } else {
    room.status = "finished";
    const [a, b] = c.scores;
    c.message = a === b ? "It is a tie!" : `${room.players[a > b ? 0 : 1].name} wins!`;
  }
}
function bingoLines(card, marked) {
  const set = new Set(marked);
  const patterns = [
    [0,1,2,3,4],[5,6,7,8,9],[10,11,12,13,14],[15,16,17,18,19],[20,21,22,23,24],
    [0,5,10,15,20],[1,6,11,16,21],[2,7,12,17,22],[3,8,13,18,23],[4,9,14,19,24],
    [0,6,12,18,24],[4,8,12,16,20]
  ];
  return patterns.filter(line => line.every(i => set.has(card[i]))).length;
}

io.on("connection", socket => {
  socket.on("room:create", ({ name, mode }) => {
    const cleanName = String(name || "Player 1").trim().slice(0, 18) || "Player 1";
    const room = { code: code(), mode: mode === "bingo" ? "bingo" : "cricket", status: "lobby", players: [{ id: socket.id, name: cleanName, connected: true }] };
    rooms.set(room.code, room); socket.data.roomCode = room.code; socket.join(room.code);
    socket.emit("room:joined", { code: room.code }); emitRoom(room);
  });
  socket.on("room:join", ({ name, code: raw }) => {
    const room = rooms.get(String(raw || "").trim().toUpperCase());
    if (!room) return socket.emit("app:error", "That room code does not exist.");
    if (room.players.length >= 2 || room.status !== "lobby") return socket.emit("app:error", "That room is already in a game.");
    const cleanName = String(name || "Player 2").trim().slice(0, 18) || "Player 2";
    room.players.push({ id: socket.id, name: cleanName, connected: true }); socket.data.roomCode = room.code; socket.join(room.code);
    socket.emit("room:joined", { code: room.code }); emitRoom(room);
  });
  socket.on("game:start", () => {
    const room = roomFor(socket);
    if (!room || room.players.length !== 2 || room.players[0].id !== socket.id) return;
    resetGame(room); emitRoom(room);
  });
  socket.on("cricket:play", number => {
    const room = roomFor(socket), n = Number(number), index = room && playerIndex(room, socket);
    if (!room || room.mode !== "cricket" || room.status !== "playing" || !Number.isInteger(n) || n < 1 || n > 6 || index < 0) return;
    const c = room.cricket; if (c.choices[index] !== null) return;
    c.choices[index] = n;
    if (c.choices.every(v => v !== null)) {
      const [first, second] = c.choices; const batterChoice = c.choices[c.batting];
      c.choices = [null, null]; c.balls += 1;
      if (first === second) { c.message = `OUT! Both chose ${first}.`; finishCricketInnings(room); }
      else { c.scores[c.batting] += batterChoice; c.message = `${room.players[c.batting].name} scores ${batterChoice}.`; if (c.innings === 1 && c.scores[1] > c.scores[0]) { room.status = "finished"; c.message = `${room.players[1].name} wins!`; } else if (c.balls >= MAX_CRICKET_BALLS) finishCricketInnings(room); }
    }
    emitRoom(room);
  });
  socket.on("bingo:call", number => {
    const room = roomFor(socket), n = Number(number), index = room && playerIndex(room, socket);
    if (!room || room.mode !== "bingo" || room.status !== "playing" || index !== room.bingo.turn || !Number.isInteger(n)) return;
    const b = room.bingo; if (b.called.includes(n) || !b.cards[index].includes(n)) return;
    b.called.push(n);
    b.cards.forEach((card, i) => { if (card.includes(n)) b.marked[i].push(n); b.lines[i] = bingoLines(card, b.marked[i]); });
    const winner = b.lines.findIndex(lines => lines >= 5);
    if (winner >= 0) { b.winner = winner; room.status = "finished"; } else b.turn = b.turn === 0 ? 1 : 0;
    emitRoom(room);
  });
  socket.on("game:rematch", () => { const room = roomFor(socket); if (room && room.players.length === 2) { resetGame(room); emitRoom(room); } });
  socket.on("disconnect", () => {
    const room = roomFor(socket); if (!room) return;
    const player = room.players.find(p => p.id === socket.id); if (player) player.connected = false;
    emitRoom(room);
    setTimeout(() => { const current = rooms.get(room.code); if (current && current.players.every(p => !p.connected)) rooms.delete(room.code); }, 60000);
  });
});
