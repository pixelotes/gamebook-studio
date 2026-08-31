const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crc = require('crc');
const pako = require('pako');
const Redis = require('ioredis');
const { nanoid } = require('nanoid');
const { runWorkerTask } = require('./src/server/workerClient');
const { GameSession } = require('./src/server/GameSession');

// Full game-state snapshots (session create/join, and the full-resync
// fallback in request-missing-updates) can grow large with many drawn
// layers — compress them, unlike the much smaller per-change deltas.
const compressGameState = (gameState) => pako.deflate(JSON.stringify(gameState));

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST"]
  },
  maxHttpBufferSize: 50e6 // 50MB
});

// Redis Client (Optional)
const useRedis = process.env.USE_REDIS === 'true' || (process.env.REDIS_URL && process.env.USE_REDIS !== 'false');

let redis;
if (useRedis) {
  redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
} else {
  const memoryStore = new Map();
  redis = {
    async hgetall(key) { return memoryStore.get(key) || {}; },
    async hset(key, val) { 
        const existing = memoryStore.get(key) || {};
        memoryStore.set(key, { ...existing, ...val }); 
    },
    async expire(key, ttl) { /* no-op in memory mode */ },
    async keys(pattern) { 
        if (pattern.endsWith('*')) {
            const prefix = pattern.slice(0, -1);
            return Array.from(memoryStore.keys()).filter(k => k.startsWith(prefix));
        }
        return Array.from(memoryStore.keys()).filter(k => k === pattern);
    },
    async del(key) { memoryStore.delete(key); },
    status: 'memory'
  };
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Multer Disk Storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// Serve static files (for PDFs)
// app.use('/uploads', express.static('uploads')); // DISABLED direct access, served via endpoint for control if needed, or re-enable.
// User requirement: "endpoint to stream from the file system". We keep the endpoint logic.

// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// Validation Schema

// Game session class

// Session Helpers
async function getSession(sessionId) {
  const data = await redis.hgetall(`session:${sessionId}`);
  if (!data || !data.id) return null;
  
  return GameSession.fromJSON({
    id: data.id,
    hostSocketId: data.hostSocketId,
    clients: JSON.parse(data.clients || '[]'),
    gameState: JSON.parse(data.gameState || 'null'),
    stateVersion: parseInt(data.stateVersion || '0', 10),
    stateHistory: JSON.parse(data.stateHistory || '[]')
  });
}

async function saveSession(session) {
  const key = `session:${session.id}`;
  console.log("saveSession", session.id, session.hostSocketId); await redis.hset(key, {
    id: session.id,
    hostSocketId: session.hostSocketId,
    clients: JSON.stringify(Array.from(session.clients)),
    gameState: JSON.stringify(session.gameState),
    stateVersion: session.stateVersion,
    stateHistory: JSON.stringify(session.stateHistory)
  });
  await redis.expire(key, 86400); // 24h expiry
}

// Session Action Queue to prevent race conditions
class SessionQueue {
  constructor() {
    this.promise = Promise.resolve();
  }
  enqueue(task) {
    this.promise = this.promise.then(task).catch(console.error);
    return this.promise;
  }
}
const sessionQueues = new Map();

function getQueue(sessionId) {
  if (!sessionQueues.has(sessionId)) {
    sessionQueues.set(sessionId, new SessionQueue());
  }
  return sessionQueues.get(sessionId);
}

// API Routes
app.get('/api/sessions', async (req, res) => {
  const keys = await redis.keys('session:*');
  const sessions = [];
  for (const key of keys) {
      const data = await redis.hgetall(key);
      if (data && data.id) {
          const session = GameSession.fromJSON({
            id: data.id,
            hostSocketId: data.hostSocketId,
            clients: JSON.parse(data.clients || '[]'),
            gameState: JSON.parse(data.gameState || 'null'),
            stateVersion: parseInt(data.stateVersion || '0', 10),
            stateHistory: JSON.parse(data.stateHistory || '[]')
          });
          sessions.push(session.toJSON());
      }
  }
  res.json(sessions);
});

app.post('/api/sessions', async (req, res) => {
  const sessionId = nanoid(10).toUpperCase();
  const session = new GameSession(sessionId, null);
  await saveSession(session);
  res.json({ sessionId, message: 'Session created successfully' });
});

app.post('/api/sessions/:sessionId/upload-pdf', upload.single('pdf'), async (req, res) => {
  const { sessionId } = req.params;
  const session = await getSession(sessionId);
  
  if (!session) {
    if (req.file) fs.unlinkSync(req.file.path); // cleanup
    return res.status(404).json({ error: 'Session not found' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const pdfData = {
    // Reuse the client's own id (fileName-size) when it sends one, instead of
    // minting a different one here — the two IDs disagreeing was letting the
    // 'pdf-added' broadcast (server id) and the state-delta sync (client id,
    // via the uploader's own pageLayers/activePdfId updates) point joining
    // clients' activePdfId at an entry that didn't exist in their pdfs array.
    id: req.body.id || (Date.now() + '_' + req.file.filename),
    fileName: req.file.originalname,
    filePath: req.file.path, // Store path
    totalPages: parseInt(req.body.totalPages) || 1,
    currentPage: 1,
    scale: 1,
    pageLayers: {},
    bookmarks: JSON.parse(req.body.bookmarks || '[]')
  };

  session.addPdf(pdfData);
  await saveSession(session);
  
  io.to(sessionId).emit('pdf-added', pdfData);
  
  res.json({ success: true, pdfData });
});

app.get('/api/sessions/:sessionId/pdf/:pdfId', async (req, res) => {
  const { sessionId, pdfId } = req.params;
  const session = await getSession(sessionId);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const pdf = session.gameState.pdfs.find(p => p.id === pdfId);
  if (!pdf || !pdf.filePath) {
    return res.status(404).json({ error: 'PDF not found' });
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline');
  res.sendFile(path.resolve(pdf.filePath));
});

// Socket.IO
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-session', async (sessionId, playerName, callback) => {
    if (typeof playerName === 'function') {
      callback = playerName;
      playerName = 'Player';
    }
    playerName = playerName || 'Player';
    let session = await getSession(sessionId);
    
    if (!session) {
      session = new GameSession(sessionId, socket.id);
    }

    session.addClient(socket.id);
    await saveSession(session);

    socket.join(sessionId);
    socket.sessionId = sessionId;
    socket.playerName = playerName;


    console.log(`User ${socket.id} (${playerName}) joined session ${sessionId}`);

    callback({
      success: true,
      gameState: compressGameState(session.gameState),
      isHost: session.hostSocketId === socket.id,
      clientCount: session.clients.size,
      version: session.stateVersion,
      playerName: playerName
    });

    socket.to(sessionId).emit('player-joined', {
      socketId: socket.id,
      name: playerName,
      clientCount: session.clients.size
    });
  });

  socket.on('create-session', async (playerName, callback) => {
    if (typeof playerName === 'function') {
      callback = playerName;
      playerName = 'Player';
    }
    playerName = playerName || 'Player';
    const sessionId = nanoid(10).toUpperCase();
    const session = new GameSession(sessionId, socket.id);
    
    session.addClient(socket.id);
    await saveSession(session);

    socket.join(sessionId);
    socket.sessionId = sessionId;
    socket.playerName = playerName;


    console.log(`User ${socket.id} (${playerName}) created session ${sessionId}`);

    callback({
      success: true,
      sessionId,
      gameState: compressGameState(session.gameState),
      isHost: true,
      clientCount: 1,
      version: session.stateVersion,
      playerName: playerName
    });
  });

  socket.on('update-game-state', (updates) => {
    if (!socket.sessionId) return;

    getQueue(socket.sessionId).enqueue(async () => {
      const session = await getSession(socket.sessionId);
      if (!session) return;

      const result = await session.updateGameState(updates);
      
      if (result) {
          await saveSession(session); // Save changes

          const { delta, version } = result;
          const gameStateCrc = crc.crc32(JSON.stringify(session.gameState)).toString(16);
          console.log(`Game state updated version ${version} in session ${socket.sessionId} CRC: ${gameStateCrc}`);
          
          socket.to(socket.sessionId).emit('game-state-delta', {
              delta,
              version,
              fromVersion: version - 1,
              crc: gameStateCrc
          });
      }
    });
  });
  
  // New event for logging
  socket.on('log-event', async (eventData) => {
      if (!socket.sessionId) return;
      const session = await getSession(socket.sessionId);
      if (session) {
          const eventWithPlayer = { ...eventData, player: socket.playerName };
          session.addEvent(eventWithPlayer);
          await saveSession(session);
          io.to(socket.sessionId).emit('event-logged', eventWithPlayer);
      }
  });

  socket.on('request-missing-updates', async ({ fromVersion }, callback) => {
    const session = await getSession(socket.sessionId);
    if (!session) return callback({ error: 'Session not found' });

    const relevantUpdates = session.stateHistory.filter(h => h.version > fromVersion);
    
    if (relevantUpdates.length > 0 && relevantUpdates[0].version === fromVersion + 1) {
        callback({ success: true, deltas: relevantUpdates });
    } else {
        callback({ success: true, fullState: compressGameState(session.gameState), version: session.stateVersion });
    }
  });

  socket.on('ack-update', (data) => {
      // No-op for now
  });

  socket.on('navigate-page', async (data) => {
    if (!socket.sessionId) return;
    
    const session = await getSession(socket.sessionId);
    if (!session) return;

    const pdfIndex = session.gameState.pdfs.findIndex(p => p.id === data.pdfId);
    if (pdfIndex !== -1) {
      session.gameState.pdfs[pdfIndex].currentPage = data.currentPage;
      session.gameState.pdfs[pdfIndex].scale = data.scale;
      await saveSession(session);
    }

    socket.to(socket.sessionId).emit('page-navigated', data);
  });

  socket.on('update-layers', async (data) => {
    if (!socket.sessionId) return;
    
    const session = await getSession(socket.sessionId);
    if (!session) return;

    try {
        const decompressedData = await runWorkerTask('inflate', { data });
        
        if (!session.gameState.pageLayers[decompressedData.pdfId]) {
          session.gameState.pageLayers[decompressedData.pdfId] = {};
        }
        session.gameState.pageLayers[decompressedData.pdfId][decompressedData.pageNum] = decompressedData.layers;
        
        await saveSession(session);

        socket.to(socket.sessionId).emit('layers-updated', data);
    } catch (e) {
        console.error("Error updating layers", e, data);
    }
  });

  socket.on('pointer-event', (data) => {
    if (socket.sessionId) {
      socket.to(socket.sessionId).emit('pointer-event', data);
    }
  });

  socket.on('dice-roll', (rollData) => {
    if (!socket.sessionId) return;
    io.to(socket.sessionId).emit('dice-rolled', {
      ...rollData,
      rolledBy: socket.id,
      timestamp: Date.now()
    });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);

    if (socket.sessionId) {
      getQueue(socket.sessionId).enqueue(async () => {
        const session = await getSession(socket.sessionId);
        if (session) {
          const isEmpty = session.removeClient(socket.id);
          
          if (isEmpty) {
            await redis.del(`session:${socket.sessionId}`);
            sessionQueues.delete(socket.sessionId); // Cleanup queue
            console.log(`Session ${socket.sessionId} deleted (empty)`);
          } else {
              // Need to save the updated client list
              let hostChanged = false;
              if (session.hostSocketId === socket.id && session.clients.size > 0) {
                  session.hostSocketId = session.clients.values().next().value;
                  hostChanged = true;
              }
              
              await saveSession(session);

              if (hostChanged) {
                  socket.to(socket.sessionId).emit('host-changed', {
                      newHostId: session.hostSocketId
                  });
              }

              socket.to(socket.sessionId).emit('player-left', {
                  socketId: socket.id,
                  clientCount: session.clients.size
              });
          }
        }
      });
    }
  });
});

app.get('/health', async (req, res) => {
  let redisStatus = 'unknown';
  try {
      if (redis.status === 'memory') redisStatus = 'memory (optional mode)';
      else if (redis.status === 'ready') redisStatus = 'connected';
      else redisStatus = redis.status;
  } catch (e) {
      redisStatus = 'error';
  }

  res.json({ 
    status: 'ok', 
    redis: redisStatus,
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Multiplayer server running on port ${PORT}`);
});

module.exports = { app, server, io };