import { io } from 'socket.io-client';
import pako from 'pako';

// Use different debounce times for different operations
const DEBOUNCE_TIMES = {
  drawing: 50,      // Near real-time for drawing
  tokens: 100,      // Quick for token movement
  text: 500,        // Moderate for text input
  characters: 300,  // Moderate for character updates
  notes: 1000       // Can be slower for notes
};

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.sessionId = null;
    this.isHost = false;
    this.listeners = new Map();
    this.serverUrl = import.meta.env.VITE_SOCKET_SERVER_URL || 'http://localhost:3001';
    this.debounceTimers = {};
    this.layerUpdateTimer = null; // Timer specifically for layer updates
  }

  // Connect to the multiplayer server
  connect() {
    if (this.socket && this.socket.connected) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      this.socket = io(this.serverUrl, {
        transports: ['websocket', 'polling'],
        timeout: 10000
      });

      this.socket.on('connect', () => {
        console.log('Connected to multiplayer server');
        this.isConnected = true;
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        console.error('Failed to connect to multiplayer server:', error);
        this.isConnected = false;
        reject(error);
      });

      this.socket.on('disconnect', () => {
        console.log('Disconnected from multiplayer server');
        this.isConnected = false;
        this.sessionId = null;
        this.isHost = false;
      });

      // Set up event listeners
      this.setupEventListeners();
    });
  }

  // Disconnect from the server
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.sessionId = null;
      this.isHost = false;
    }
  }

  // Create a new multiplayer session
  createSession() {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.isConnected) {
        reject(new Error('Not connected to server'));
        return;
      }

      this.socket.emit('create-session', (response) => {
        if (response.success) {
          this.sessionId = response.sessionId;
          this.isHost = response.isHost;
          console.log('Created session:', this.sessionId);
          resolve(response);
        } else {
          reject(new Error(response.error || 'Failed to create session'));
        }
      });
    });
  }

  // Join an existing multiplayer session
  joinSession(sessionId) {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.isConnected) {
        reject(new Error('Not connected to server'));
        return;
      }

      this.socket.emit('join-session', sessionId, (response) => {
        if (response.success) {
          this.sessionId = sessionId;
          this.isHost = response.isHost;
          console.log('Joined session:', sessionId);
          resolve(response);
        } else {
          reject(new Error(response.error || 'Failed to join session'));
        }
      });
    });
  }

  // Update game state (characters, counters, notes, etc.) with adaptive debouncing
  updateGameState(updates, urgency = 'characters') {
    if (this.socket && this.isConnected && this.sessionId) {
      // Clear any existing timer for this urgency type
      if (this.debounceTimers[urgency]) {
        clearTimeout(this.debounceTimers[urgency]);
      }

      // Set a new timer
      this.debounceTimers[urgency] = setTimeout(() => {
        this.socket.emit('update-game-state', updates);
      }, DEBOUNCE_TIMES[urgency] || 300);
    }
  }
  
  // Acknowledge a received update
  sendAcknowledgement(version) {
    if (this.socket && this.isConnected) {
      this.socket.emit('ack-update', { version });
    }
  }

  requestMissingUpdates(fromVersion) {
    return new Promise((resolve) => {
        if (!this.socket || !this.isConnected) return resolve({ error: 'Not connected' });

        this.socket.emit('request-missing-updates', { fromVersion }, (response) => {
            resolve(response);
        });
    });
  }

  // Navigate to a specific page
  navigatePage(pdfId, currentPage, scale) {
    if (this.socket && this.isConnected && this.sessionId) {
      this.socket.emit('navigate-page', { pdfId, currentPage, scale });
    }
  }

  // Update layers (drawings, tokens, annotations) with debouncing
  updateLayers(pdfId, pageNum, layers) {
    if (this.socket && this.isConnected && this.sessionId) {
      // Clear the previous timer to debounce
      if (this.layerUpdateTimer) {
        clearTimeout(this.layerUpdateTimer);
      }

      // Set a new timer to emit the correct event
      this.layerUpdateTimer = setTimeout(() => {
        const data = { pdfId, pageNum, layers };
        const compressedData = pako.deflate(JSON.stringify(data)); // Compress the data
        this.socket.emit('update-layers', compressedData);
      }, DEBOUNCE_TIMES.drawing);
    }
  }

  // Send real-time updates (while drawing/dragging)
  sendRealTimeUpdate(updateType, data) {
    if (this.socket && this.isConnected && this.sessionId) {
        const compressedData = pako.deflate(JSON.stringify({ type: updateType, data })); // Compress the data
        this.socket.emit('real-time-update', compressedData);
    }
  }

  // Add this new method to send pointer events
  sendPointer(data) {
    if (this.socket && this.isConnected && this.sessionId) {
      this.socket.emit('pointer-event', data);
    }
  }
  
  // Roll dice
  rollDice(expression, result) {
    if (this.socket && this.isConnected && this.sessionId) {
      this.socket.emit('dice-roll', { expression, result });
    }
  }

  // Upload PDF to session
  async uploadPdfToSession(file, pdfData) {
    if (!this.sessionId) {
      throw new Error('No active session');
    }

    const formData = new FormData();
    formData.append('pdf', file);
    formData.append('id', pdfData.id);
    formData.append('totalPages', pdfData.totalPages);
    formData.append('bookmarks', JSON.stringify(pdfData.bookmarks));
    formData.append('fileName', pdfData.fileName);

    const response = await fetch(`${this.serverUrl}/api/sessions/${this.sessionId}/upload-pdf`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error('Failed to upload PDF');
    }

    return response.json();
  }
  
  removePdf(pdfId) {
    if (this.socket && this.isConnected && this.sessionId) {
      this.socket.emit('remove-pdf', pdfId);
    }
  }

  // Get PDF file URL for a session
  getPdfUrl(pdfId) {
    if (!this.sessionId) return null;
    return `${this.serverUrl}/api/sessions/${this.sessionId}/pdf/${pdfId}`;
  }

  // Add event listener
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);

    // If socket is already connected, set up the listener
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  // Remove event listener
  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
      if (this.socket) {
        this.socket.off(event, callback);
      }
    }
  }

  // Set up all event listeners on the socket
  setupEventListeners() {
    if (!this.socket) return;

    // Decompress incoming real-time updates
    this.socket.on('real-time-update', (data) => {
        try {
            const decompressedData = JSON.parse(pako.inflate(data, { to: 'string' }));
            
            if (this.listeners.has('real-time-update')) {
                this.listeners.get('real-time-update').forEach(callback => callback(decompressedData));
            }
        } catch (error) {
            console.error('Error decompressing real-time update:', error);
        }
    });

    // Set up all stored listeners
    this.listeners.forEach((callbacks, event) => {
        if(event !== 'real-time-update') { // The real-time-update is handled already
            callbacks.forEach(callback => {
                this.socket.on(event, callback);
            });
        }
    });
  }

  // Get current session info
  getSessionInfo() {
    return {
      sessionId: this.sessionId,
      isConnected: this.isConnected,
      isHost: this.isHost
    };
  }

  // Check if multiplayer is active
  isMultiplayerActive() {
    return this.isConnected && this.sessionId !== null;
  }
}

// Create a singleton instance
const socketService = new SocketService();

export default socketService;