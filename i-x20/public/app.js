const socket = io();
let selectedMode = "cricket", room, myId;
const $ = s => document.querySelector(s);
socket.on("connect", () => myId = socket.id);
document.querySelectorAll(".mode").forEach(button => button.onclick = () => { selectedMode = button.dataset.mode; document.querySelectorAll(".mode").forEach(b => b.classList.toggle("selected", b === button)); });
$("#create").onclick = () => socket.emit("room:create", { name: $("#name").value, mode: selectedMode });
$("#join").onclick = () => socket.emit("room:join", { name: $("#name").value, code: $("#code").value });
$("#code").oninput = e => e.target.value = e.target.value.toUpperCase();
socket.on("app:error", message => $("#error").textContent = message);
socket.on("room:joined", ({ code }) => { $("#home").classList.add("hidden"); $("#game").classList.remove("hidden"); $("#roomCode").textContent = code; $("#waitingCode").textContent = code; });
$("#copy").onclick = async () => { await navigator.clipboard.writeText($("#roomCode").textContent); $("#copy").textContent = "Copied!"; setTimeout(() => $("#copy").textContent = "Copy code", 1200); };
socket.on("room:update", state => { room = state; render(); });
function render() {
  const ready = room.players.length === 2;
  $("#waiting").classList.toggle("hidden", ready); $("#play").classList.toggle("hidden", !ready);
  $("#status").textContent = room.status === "lobby" ? "Waiting for player" : room.status === "finished" ? "Game complete" : "Live game";
  if (!ready) return;
  const winner = room.mode === "cricket" ? room.cricket?.winner : room.bingo?.winner;
  room.players.forEach((p, i) => {
    const active = room.mode === "bingo" && room.bingo?.turn === i && room.status === "playing";
    const result = room.status === "finished" && winner !== null && winner !== undefined ? (i === winner ? '<em class="winner-label">Winner</em>' : '<em class="loser-label">Runner-up</em>') : "";
    $("#p"+i).className = `${active ? "active " : ""}${room.status === "finished" && winner === i ? "winner" : room.status === "finished" && winner !== null ? "loser" : ""}`;
    $("#p"+i).innerHTML = `<b>${escapeHtml(p.name)}</b><span class="score">${room.mode === "cricket" ? p.score : p.lines + " lines"}</span>${result}`;
  });
  $("#board").innerHTML = room.mode === "cricket" ? cricket() : bingo();
  if (room.status === "lobby") socket.emit("game:start");
}
function cricket() {
  const c = room.cricket; if (!c) return '<p class="message">Preparing match…</p>';
  const canPlay = room.status === "playing" && !c.hasChosen;
  return `<p class="message">${c.message}</p><p class="help">Ball ${c.balls + 1} · ${c.innings === 0 ? "First innings" : "Second innings"}</p><div class="numbers">${[1,2,3,4,5,6].map(n => `<button class="number" onclick="playCricket(${n})" ${canPlay ? "" : "disabled"}>${n}</button>`).join("")}</div>${room.status === "finished" ? rematch() : `<p class="help">Choose a number. If both players choose the same number, the batter is out.</p>`}`;
}
function bingo() {
  const b = room.bingo; if (!b) return '<p class="message">Shuffling cards…</p>';
  const me = room.me, myTurn = b.turn === me && room.status === "playing";
  const heading = room.status === "finished" ? `${room.players[b.winner].name} has BINGO!` : myTurn ? "Your turn — call a number" : `${room.players[b.turn].name}'s turn`;
  return `<p class="message">${heading}</p><p class="help">Complete any 5 rows, columns, or diagonals.</p><div class="bingo">${b.myCard.map(n => `<button class="cell ${b.myMarked.includes(n) ? "marked" : myTurn && !b.called.includes(n) ? "available" : ""}" ${myTurn && !b.called.includes(n) ? `onclick="callBingo(${n})"` : "disabled"}>${n}</button>`).join("")}</div><p class="called">Called: ${b.called.join(", ") || "None yet"}</p>${room.status === "finished" ? rematch() : ""}`;
}
function rematch(){ return '<div class="end-actions"><button class="primary" onclick="rematch()">Play again</button><button class="secondary" onclick="backToMenu()">Back to menu</button></div>'; }
function playCricket(n) { socket.emit("cricket:play", n); }
function callBingo(n) { socket.emit("bingo:call", n); }
function rematch() { socket.emit("game:rematch"); }
function backToMenu() {
  socket.emit("room:leave"); room = null;
  $("#game").classList.add("hidden"); $("#home").classList.remove("hidden");
  $("#code").value = ""; $("#error").textContent = "";
}
function escapeHtml(text) { const div = document.createElement("div"); div.textContent = text; return div.innerHTML; }
