// SiteTalk backend
// - REST: /api/signup, /api/login  (email + password accounts, JWT)
// - WS:   ?room=<hostname>&name=<display name>&guestId=<uuid>&token=<jwt|"">
//
// Messages persist per-room (last N) to a JSON file so a restart doesn't
// wipe history. This is intentionally simple — swap `store.js` for a real
// database (Postgres/Mongo/Redis) before running this at real scale.

require("dotenv").config();
const http = require("http");
const express = require("express");
const cors = require("cors");
const { WebSocketServer } = require("ws");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const MAX_MESSAGES = Number(process.env.MAX_MESSAGES_PER_ROOM || 50);
const DATA_FILE = path.resolve(process.env.DATA_FILE || "./data.json");

// ---------------------------------------------------------------------
// Tiny JSON-file store (users + per-room message history)
// ---------------------------------------------------------------------
function loadData() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    } catch {
      /* fall through to fresh state */
    }
  }
  return { users: {}, rooms: {} };
}

const db = loadData();
let dirty = false;
setInterval(() => {
  if (dirty) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db));
    dirty = false;
  }
}, 5000).unref();

function roomHistory(room) {
  if (!db.rooms[room]) db.rooms[room] = [];
  return db.rooms[room];
}

function pushMessage(room, message) {
  const history = roomHistory(room);
  history.push(message);
  if (history.length > MAX_MESSAGES) history.splice(0, history.length - MAX_MESSAGES);
  dirty = true;
}

// ---------------------------------------------------------------------
// REST API (accounts are optional — anonymous mode never calls this)
// ---------------------------------------------------------------------
const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.post("/api/signup", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password || password.length < 8) {
    return res.status(400).json({ error: "Use a real email and a password of at least 8 characters." });
  }
  if (db.users[email]) {
    return res.status(409).json({ error: "An account with that email already exists." });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  db.users[email] = { id: crypto.randomUUID(), email, passwordHash, createdAt: Date.now() };
  dirty = true;
  const token = jwt.sign({ sub: db.users[email].id, email }, JWT_SECRET, { expiresIn: "30d" });
  res.json({ token });
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body || {};
  const user = db.users[email];
  if (!user || !(await bcrypt.compare(password || "", user.passwordHash))) {
    return res.status(401).json({ error: "That email and password don't match." });
  }
  const token = jwt.sign({ sub: user.id, email }, JWT_SECRET, { expiresIn: "30d" });
  res.json({ token });
});

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------
// WebSocket chat rooms — one room per site hostname
// ---------------------------------------------------------------------
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

/** @type {Map<string, Set<import('ws').WebSocket>>} */
const rooms = new Map();

function participantsIn(room) {
  return rooms.get(room)?.size || 0;
}

function broadcast(room, payload, exceptSocket = null) {
  const sockets = rooms.get(room);
  if (!sockets) return;
  const data = JSON.stringify(payload);
  for (const client of sockets) {
    if (client !== exceptSocket && client.readyState === client.OPEN) client.send(data);
  }
}

wss.on("connection", (socket, req) => {
  const url = new URL(req.url, "http://localhost");
  const room = (url.searchParams.get("room") || "unknown").toLowerCase();
  const guestId = url.searchParams.get("guestId") || crypto.randomUUID();
  const token = url.searchParams.get("token");
  let name = (url.searchParams.get("name") || "Guest").slice(0, 24);
  let verifiedEmail = null;

  if (token) {
    const decoded = verifyToken(token);
    if (decoded) verifiedEmail = decoded.email;
  }

  socket.siteTalk = { room, guestId, name };

  if (!rooms.has(room)) rooms.set(room, new Set());
  rooms.get(room).add(socket);

  socket.send(JSON.stringify({
    type: "history",
    messages: roomHistory(room),
    participants: participantsIn(room),
  }));

  broadcast(room, { type: "presence", participants: participantsIn(room) });
  broadcast(room, { type: "system", text: `${name} joined` }, socket);

  socket.on("message", (raw) => {
    let data;
    try {
      data = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (data.type === "message" && typeof data.text === "string" && data.text.trim()) {
      const message = {
        id: crypto.randomUUID(),
        type: "message",
        guestId,
        name: verifiedEmail || name,
        text: data.text.trim().slice(0, 500),
        ts: Date.now(),
        verified: !!verifiedEmail,
      };
      pushMessage(room, message);
      broadcast(room, message);
      return;
    }

    if (data.type === "voice" && typeof data.audio === "string") {
      // Voice clips are relayed live but intentionally NOT written to the
      // persisted history file, to keep data.json small.
      const message = {
        id: crypto.randomUUID(),
        type: "voice",
        guestId,
        name: verifiedEmail || name,
        audio: data.audio,
        seconds: Math.min(Number(data.seconds) || 0, 30),
        ts: Date.now(),
      };
      broadcast(room, message);
      return;
    }

    if (data.type === "rename" && typeof data.name === "string" && data.name.trim()) {
      name = data.name.trim().slice(0, 24);
      socket.siteTalk.name = name;
    }
  });

  socket.on("close", () => {
    rooms.get(room)?.delete(socket);
    broadcast(room, { type: "presence", participants: participantsIn(room) });
    broadcast(room, { type: "system", text: `${name} left` });
    if (participantsIn(room) === 0) rooms.delete(room);
  });
});

server.listen(PORT, () => {
  console.log(`SiteTalk server listening on :${PORT}`);
});
