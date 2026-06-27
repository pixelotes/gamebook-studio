const { z } = require('zod');
const { runWorkerTask } = require('./workerClient');

const gameStateSchema = z.object({
  notes: z.string().optional(),
  characters: z.array(z.any()).optional(),
  pdfs: z.array(z.any()).optional(),
  activePdfId: z.string().nullable().optional(),
  counters: z.array(z.any()).optional(),
  pageLayers: z.record(z.any()).optional()
}).passthrough();

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
      eventLog: []
    };
    this.stateVersion = stateVersion;
    this.stateHistory = stateHistory;
    this.nextPlayerNumber = 1;
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
    this.clients.add(socketId);
    return playerName;
  }

  removeClient(socketId) {
    this.clients.delete(socketId);
    return this.clients.size === 0;
  }
  
  addEvent(event) {
    this.gameState.eventLog.push(event);
    if (this.gameState.eventLog.length > 100) {
        this.gameState.eventLog.shift();
    }
    return event;
  }

  async updateGameState(updates) {
    try {
        gameStateSchema.parse(updates);
    } catch (e) {
        console.error("Validation error:", e.errors);
        return null;
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

        if (this.stateHistory.length > 500) {
            this.stateHistory.shift();
        }

        return { delta, version: this.stateVersion };
    }
    return null;
  }

  addPdf(pdfData) {
    this.gameState.pdfs.push(pdfData);
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

module.exports = { GameSession, gameStateSchema };
