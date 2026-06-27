const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Worker } = require('worker_threads');
const jsondiffpatch = require('jsondiffpatch');
const pako = require('pako');
const crc = require('crc');
const Redis = require('ioredis');
const { nanoid } = require('nanoid');
const { z } = require('zod');


// Worker Thread Setup
const computeWorker = new Worker(path.join(__dirname, 'src/workers/serverWorker.js'));
const pendingTasks = new Map();
let taskIdCounter = 0;

computeWorker.on('message', ({ id, success, result, error }) => {
  const task = pendingTasks.get(id);
  if (task) {
    if (success) task.resolve(result);
    else task.reject(new Error(error));
    pendingTasks.delete(id);
  }
});

function runWorkerTask(type, payload) {
  return new Promise((resolve, reject) => {
    const id = taskIdCounter++;
    pendingTasks.set(id, { resolve, reject });
    computeWorker.postMessage({ id, type, payload });
  });
}

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST"]
  },
  maxHttpBufferSize: 50e6 // 50MB
});

// Redis Client
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

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
const gameStateSchema = z.object({
  notes: z.string().optional(),
  characters: z.array(z.any()).optional(),
  pdfs: z.array(z.any()).optional(),
  activePdfId: z.string().nullable().optional(),
  counters: z.array(z.any()).optional(),
  pageLayers: z.record(z.any()).optional()
}).passthrough();

// Game session class
class GameSession {
  constructor(sessionId, hostSocketId, gameState = null, stateVersion = 0, stateHistory = []) {
    this.id = sessionId;
    this.hostSocketId = hostSocketId;
    this.clients = new Set();
    this.gameState = gameState || {
      pdfs: [],
      activePdfId: null,
      characters: [],
      notes: '',
      counters: [],
      pageLayers: {},
      eventLog: [] // Add event log to game state
    };
    // this.pdfFiles = new Map(); // REMOVED: Stored on disk now
    this.stateVersion = stateVersion;
    this.stateHistory = stateHistory;
  }

  static fromJSON(json) {
    if (!json) return null;
    const session = new GameSession(
      json.id,
      json.hostSocketId,
      json.gameState,
      json.stateVersion,
      json.stateHistory
    );
    if (json.clients && Array.isArray(json.clients)) {
      json.clients.forEach(c => session.clients.add(c));
    }
    return session;
  }

  addClient(socketId) {
    const playerName = `Player ${this.nextPlayerNumber++}`;
    this.clients.set(socketId, { name: playerName });
    return playerName;
  }

  removeClient(socketId) {
    this.clients.delete(socketId);
    return this.clients.size === 0;
  }
  
  addEvent(event) {
    this.gameState.eventLog.push(event);
    if (this.gameState.eventLog.length > 100) { // Limit log size
        this.gameState.eventLog.shift();
    }
    // Broadcast the new event to all clients
    io.to(this.id).emit('event-logged', event);
  }

  async updateGameState(updates) {
    // Validate updates (partial)
    try {
        gameStateSchema.parse(updates);
    } catch (e) {
        console.error("Validation error:", e.errors);
        return null; // Or throw
    }

    const previousState = { ...this.gameState };
    this.gameState = { ...this.gameState, ...updates };
    
    const delta = await runWorkerTask('diff', { previousState, newState: this.gameState });
    
    if (delta) {
        this.stateVersion++;
        
        this.stateHistory.push({
            version: this.stateVersion,
            delta,
            timestamp: Date.now()
        });

        if (this.stateHistory.length > 500) { // Increased to 500
            this.stateHistory.shift();
        }

        return { delta, version: this.stateVersion };
    }
    return null;
  }

  addPdf(pdfData) {
    this.gameState.pdfs.push(pdfData);
    // Path is stored in pdfData usually or derived.
    // We'll ensure pdfData includes necessary info.
  }

  toJSON() {
    return {
      id: this.id,
      hostSocketId: this.hostSocketId,
      clients: Array.from(this.clients),
      gameState: this.gameState,
      stateVersion: this.stateVersion,
      stateHistory: this.stateHistory
    };
  }
}

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
  await redis.hset(key, {
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
    id: Date.now() + '_' + req.file.filename,
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

  socket.on('join-session', async (sessionId, callback) => {
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
      gameState: session.gameState,
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

  socket.on('create-session', async (callback) => {
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
      gameState: session.gameState,
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
  socket.on('log-event', (eventData) => {
      if (!socket.sessionId) return;
      const session = gameSessions.get(socket.sessionId);
      if (session) {
          // Assign the player name from the socket
          const eventWithPlayer = { ...eventData, player: socket.playerName };
          session.addEvent(eventWithPlayer);
      }
  });

  socket.on('request-missing-updates', async ({ fromVersion }, callback) => {
    const session = await getSession(socket.sessionId);
    if (!session) return callback({ error: 'Session not found' });

    const relevantUpdates = session.stateHistory.filter(h => h.version > fromVersion);
    
    if (relevantUpdates.length > 0 && relevantUpdates[0].version === fromVersion + 1) {
        callback({ success: true, deltas: relevantUpdates });
    } else {
        callback({ success: true, fullState: session.gameState, version: session.stateVersion });
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
        console.error("Error updating layers", e);
    }
  });

  socket.on('pointer-event', (data) => {
    if (socket.sessionId) {
      socket.to(socket.sessionId).emit('pointer-event', data);
    }
  });
  
  socket.on('real-time-update', (data) => {
    if (!socket.sessionId) return;
    socket.to(socket.sessionId).emit('real-time-update', {
      ...data,
      fromSocket: socket.id
    });
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
              if (session.hostSocketId === socket.id && session.clients.size > 0) {
                  session.hostSocketId = session.clients.values().next().value;
                  socket.to(socket.sessionId).emit('host-changed', {
                      newHostId: session.hostSocketId
                  });
              }
              await saveSession(session);

              socket.to(socket.sessionId).emit('player-left', {
                  socketId: socket.id,
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
      if (redis.status === 'ready') redisStatus = 'connected';
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