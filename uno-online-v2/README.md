# 🃏 UNO Online

A real-time multiplayer UNO game with room codes and invite links. Built with Node.js + Socket.io (server) and React (client).

---

## 🚀 Quick Start (Local Play)

### 1. Install dependencies

Open **two terminals** in VS Code and run:

**Terminal 1 — Server:**
```bash
cd server
npm install
npm run dev
```
Server starts on `http://localhost:3001`

**Terminal 2 — Client:**
```bash
cd client
npm install
npm start
```
Client opens at `http://localhost:3000`

---

## 🎮 How to Play

1. Open `http://localhost:3000` in your browser
2. Enter your name and click **Create Room**
3. Share the **6-character room code** or copy the **invite link** to friends
4. Friends open the link (or go to the site and enter the code)
5. Once 2–4 players have joined, the **host** clicks **Start Game**

### Game Rules
- Match the top card by **color** or **number/symbol**
- **Skip** (⊘) — skips the next player's turn
- **Reverse** (⇄) — reverses turn order
- **Draw 2** (+2) — next player draws 2 (stackable!)
- **Wild** (🌈) — play any time, choose new color
- **Wild Draw 4** (+4) — choose color AND next player draws 4 (stackable!)
- Click a card once to **select** it, click again to **play** it
- Can't play? Click **Draw** to draw from the deck

---

## 🌐 Deploy Online (Free)

To let friends join from anywhere:

### Option A: Railway (easiest)
1. Push this project to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Select the `server` folder as root
4. Add env var: `PORT=3001`
5. Copy your Railway URL (e.g. `https://uno-server.up.railway.app`)
6. In `client/package.json`, change the `proxy` to your Railway URL
7. Deploy client to [Vercel](https://vercel.com) or [Netlify](https://netlify.com)

### Option B: Render
Same as Railway but at [render.com](https://render.com) — also free tier available.

---

## 📁 Project Structure

```
uno-online/
├── server/
│   ├── index.js          ← Express + Socket.io server
│   ├── gameLogic.js      ← UNO rules engine
│   └── package.json
├── client/
│   ├── src/
│   │   ├── App.js        ← Socket connection & routing
│   │   ├── components/
│   │   │   ├── Lobby.js  ← Create/Join room screen
│   │   │   ├── Game.js   ← Waiting room + gameplay
│   │   │   ├── Card.js   ← UNO card component
│   │   │   └── ColorPicker.js ← Wild card color chooser
│   │   └── index.css     ← Global styles
│   └── package.json
└── README.md
```

---

## ✨ Features

- ✅ Real-time multiplayer via WebSockets
- ✅ Room codes + shareable invite links
- ✅ 2–4 players per room
- ✅ Full UNO deck: numbers, Skip, Reverse, Draw 2, Wild, Wild Draw 4
- ✅ Card stacking (chain Draw 2s and Wild Draw 4s)
- ✅ Disconnection handling with reconnect support
- ✅ Host controls game start
- ✅ Clean, modern dark UI
