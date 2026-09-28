# Play Pair

A real-time, two-player game site with **Hand Cricket** and **Bingo**. Create a room, share its five-character code, and play from two browsers.

## Run locally

```powershell
npm install
npm start
```

Then open `http://localhost:3000` in two browser windows. For two devices on the same Wi-Fi, share the computer's local IP address followed by `:3000`.

## Deploy

Deploy to any Node.js host (for example Render, Railway, or Fly.io). Set the host's start command to `npm start`; it will provide the `PORT` environment variable automatically.

## Rules

- Hand Cricket: both players choose 1–6. The batter adds their number unless both choices match; a match is a wicket. Each innings also has a 12-ball limit.
- Bingo: each player has a shuffled 5×5 card. On your turn, click a number from your card; it is marked on both cards. The first player to complete five rows, columns, or diagonals wins.
