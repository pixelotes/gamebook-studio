const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000", // React dev server
    methods: ["GET", "POST"]
  },
  maxHttpBufferSize: 50e6 // 50MB for PDF files
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Storage for game sessions
const gameSessions = new Map();

// Multer configuration for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Serve static files (for PDFs)
app.use('/uploads', express.static('uploads'));

// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// Game session class
class GameSession {
  constructor(sessionId, hostSocketId) {
    this.id = sessionId;
    this.hostSocketId = hostSocketId;
    this.clients = new Set();
    this.gameState = {
      pdfs: [],
      activePdfId: null,
      characters: [],
      notes: '',
      counters: [],
      pageLayers: {}
    };
    this.pdfFiles = new Map(); // Store actual PDF file data
    this.updateVersion = 0;
    this.latestUpdates = []; // Store the last few updates for context
  }

  addClient(socketId) {
    this.clients.add(socketId);
  }

  removeClient(socketId) {
    this.clients.delete(socketId);
    return this.clients.size === 0; // Return true if session is empty
  }

  updateGameState(updates) {
    this.updateVersion++;
    const updatePayload = {
      version: this.updateVersion,
      updates
    };
    
    // Naively merge state for now. This will be improved with differential updates.
    this.gameState = { ...this.gameState, ...updates };

    // Keep a log of the last 10 updates
    this.latestUpdates.push(updatePayload);
    if (this.latestUpdates.length > 10) {
      this.latestUpdates.shift();
    }
    
    return updatePayload;
  }

  addPdf(pdfData, fileBuffer) {
    this.gameState.pdfs.push(pdfData);
    this.pdfFiles.set(pdfData.id, fileBuffer);
  }

  toJSON() {
    return {
      id: this.id,
      hostSocketId: this.hostSocketId,
      clientCount: this.clients.size,
      gameState: this.gameState,
      version: this.updateVersion
    };
  }
}

// API Routes
app.get('/api/sessions', (req, res) => {
  const sessions = Array.from(gameSessions.values()).map(session => session.toJSON());
  res.json(sessions);
});

app.post('/api/sessions', (req, res) => {
  const sessionId = generateSessionId();
  const session = new GameSession(sessionId, null);
  gameSessions.set(sessionId, session);
  res.json({ sessionId, message: 'Session created successfully' });
});

// PDF upload endpoint
app.post('/api/sessions/:sessionId/upload-pdf', upload.single('pdf'), (req, res) => {
  const { sessionId } = req.params;
  const session = gameSessions.get(sessionId);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const pdfData = {
    id: Date.now() + req.file.originalname,
    fileName: req.file.originalname,
    totalPages: parseInt(req.body.totalPages) || 1,
    currentPage: 1,
    scale: 1,
    pageLayers: {},
    bookmarks: JSON.parse(req.body.bookmarks || '[]')
  };

  session.addPdf(pdfData, req.file.buffer);
  
  // Notify all clients about the new PDF
  io.to(sessionId).emit('pdf-added', pdfData);
  
  res.json({ success: true, pdfData });
});

// Get PDF file
app.get('/api/sessions/:sessionId/pdf/:pdfId', (req, res) => {
  const { sessionId, pdfId } = req.params;
  const session = gameSessions.get(sessionId);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const pdfBuffer = session.pdfFiles.get(pdfId);
  if (!pdfBuffer) {
    return res.status(404).json({ error: 'PDF not found' });
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline');
  res.send(pdfBuffer);
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join a game session
  socket.on('join-session', (sessionId, callback) => {
    let session = gameSessions.get(sessionId);
    
    if (!session) {
      // Create new session if it doesn't exist
      session = new GameSession(sessionId, socket.id);
      gameSessions.set(sessionId, session);
    }

    session.addClient(socket.id);
    socket.join(sessionId);
    socket.sessionId = sessionId;

    console.log(`User ${socket.id} joined session ${sessionId}`);

    // Send current game state to the joining user
    callback({
      success: true,
      gameState: session.gameState,
      isHost: session.hostSocketId === socket.id,
      clientCount: session.clients.size,
      version: session.updateVersion
    });

    // Notify other clients about new player
    socket.to(sessionId).emit('player-joined', {
      socketId: socket.id,
      clientCount: session.clients.size
    });
  });

  // Create a new session
  socket.on('create-session', (callback) => {
    const sessionId = generateSessionId();
    const session = new GameSession(sessionId, socket.id);
    gameSessions.set(sessionId, session);
    
    session.addClient(socket.id);
    socket.join(sessionId);
    socket.sessionId = sessionId;

    console.log(`User ${socket.id} created session ${sessionId}`);

    callback({
      success: true,
      sessionId,
      gameState: session.gameState,
      isHost: true,
      clientCount: 1,
      version: session.updateVersion
    });
  });

  // Game state updates
  socket.on('update-game-state', (updates) => {
    if (!socket.sessionId) return;

    const session = gameSessions.get(socket.sessionId);
    if (!session) return;

    const updatePayload = session.updateGameState(updates);
    
    // Broadcast to all other clients in the session
    socket.to(socket.sessionId).emit('game-state-updated', updatePayload);
    
    console.log(`Game state updated in session ${socket.sessionId} to version ${updatePayload.version}`);
  });

  // Acknowledgment from client
  socket.on('ack-update', (data) => {
    if (socket.sessionId) {
      // In the future, this is where we'd clear the message from a retransmission queue
      console.log(`Client ${socket.id} acknowledged version ${data.version}`);
    }
  });


  // PDF page navigation
  socket.on('navigate-page', (data) => {
    if (!socket.sessionId) return;
    
    const session = gameSessions.get(socket.sessionId);
    if (!session) return;

    // Update the PDF state in the session
    const pdfIndex = session.gameState.pdfs.findIndex(p => p.id === data.pdfId);
    if (pdfIndex !== -1) {
      session.gameState.pdfs[pdfIndex].currentPage = data.currentPage;
      session.gameState.pdfs[pdfIndex].scale = data.scale;
    }

    // Broadcast to other clients
    socket.to(socket.sessionId).emit('page-navigated', data);
  });

  // Layer updates (drawings, tokens, etc.)
  socket.on('update-layers', (data) => {
    if (!socket.sessionId) return;
    
    const session = gameSessions.get(socket.sessionId);
    if (!session) return;

    // Update page layers in session
    if (!session.gameState.pageLayers[data.pdfId]) {
      session.gameState.pageLayers[data.pdfId] = {};
    }
    session.gameState.pageLayers[data.pdfId][data.pageNum] = data.layers;

    // Broadcast to other clients
    socket.to(socket.sessionId).emit('layers-updated', data);
  });

  // Real-time drawing/token placement
  socket.on('real-time-update', (data) => {
    if (!socket.sessionId) return;
    
    // Immediately broadcast to other clients without storing
    socket.to(socket.sessionId).emit('real-time-update', {
      ...data,
      fromSocket: socket.id
    });
  });

  // Dice roll
  socket.on('dice-roll', (rollData) => {
    if (!socket.sessionId) return;
    
    // Broadcast dice roll to all clients in session
    io.to(socket.sessionId).emit('dice-rolled', {
      ...rollData,
      rolledBy: socket.id,
      timestamp: Date.now()
    });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);

    if (socket.sessionId) {
      const session = gameSessions.get(socket.sessionId);
      if (session) {
        const isEmpty = session.removeClient(socket.id);
        
        if (isEmpty) {
          // Clean up empty session
          gameSessions.delete(socket.sessionId);
          console.log(`Session ${socket.sessionId} deleted (empty)`);
        } else {
          // Notify remaining clients
          socket.to(socket.sessionId).emit('player-left', {
            socketId: socket.id,
            clientCount: session.clients.size
          });

          // If the host left, assign a new host
          if (session.hostSocketId === socket.id && session.clients.size > 0) {
            session.hostSocketId = session.clients.values().next().value;
            socket.to(socket.sessionId).emit('host-changed', {
              newHostId: session.hostSocketId
            });
          }
        }
      }
    }
  });
});

// Utility function to generate session IDs
function generateSessionId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    sessions: gameSessions.size,
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Multiplayer server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

module.exports = { app, server, io };