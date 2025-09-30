// This service manages event logging with a simple API

class EventLogService {
  constructor() {
    this.events = [];
    this.listeners = [];
    this.currentPlayer = localStorage.getItem('playerName') || 'Player 1';
  }

  setPlayerName(name) {
    this.currentPlayer = name;
    localStorage.setItem('playerName', name);
  }

  getPlayerName() {
    return this.currentPlayer;
  }

  addEvent(type, message, details = null, player = null) {
    const event = {
      id: Date.now() + Math.random(),
      timestamp: Date.now(),
      type,
      message,
      details,
      player: player || this.currentPlayer
    };

    this.events.push(event);
    this.notifyListeners();
    return event;
  }

  // Specific event methods for convenience
  logDiceRoll(diceType, results, total, player = null) {
    const resultsStr = Array.isArray(results) ? results.join(', ') : results;
    return this.addEvent(
      'dice_roll',
      `Rolled ${diceType}: ${total}`,
      `Individual rolls: ${resultsStr}`,
      player
    );
  }

  logCounterChange(counterName, oldValue, newValue, player = null) {
    const change = newValue - oldValue;
    const changeStr = change > 0 ? `+${change}` : `${change}`;
    return this.addEvent(
      'counter_change',
      `Counter "${counterName}" changed: ${oldValue} → ${newValue} (${changeStr})`,
      null,
      player
    );
  }

  logCounterCreate(counterName, initialValue, player = null) {
    return this.addEvent(
      'counter_create',
      `Created counter "${counterName}" with value ${initialValue}`,
      null,
      player
    );
  }

  logCounterDelete(counterName, player = null) {
    return this.addEvent(
      'counter_delete',
      `Deleted counter "${counterName}"`,
      null,
      player
    );
  }

  logCharacterCreate(characterName, template, player = null) {
    return this.addEvent(
      'character_create',
      `Created character sheet: ${characterName || 'Unnamed'}`,
      `Template: ${template}`,
      player
    );
  }

  logCharacterDelete(characterName, player = null) {
    return this.addEvent(
      'character_delete',
      `Deleted character sheet: ${characterName || 'Unnamed'}`,
      null,
      player
    );
  }

  logCharacterUpdate(characterName, field, oldValue, newValue, player = null) {
    return this.addEvent(
      'character_update',
      `Updated ${characterName || 'character'}: ${field}`,
      `${oldValue} → ${newValue}`,
      player
    );
  }

  logSessionNew(player = null) {
    return this.addEvent(
      'session_new',
      'Started new session',
      'All data has been reset',
      player
    );
  }

  logPdfOpen(fileName, player = null) {
    return this.addEvent(
      'pdf_open',
      `Opened PDF: ${fileName}`,
      null,
      player
    );
  }

  logPdfClose(fileName, player = null) {
    return this.addEvent(
      'pdf_close',
      `Closed PDF: ${fileName}`,
      null,
      player
    );
  }

  logMultiplayerStart(sessionId, player = null) {
    return this.addEvent(
      'multiplayer_start',
      `Started multiplayer session`,
      `Session ID: ${sessionId}`,
      player
    );
  }

  logMultiplayerStop(player = null) {
    return this.addEvent(
      'multiplayer_stop',
      'Disconnected from multiplayer session',
      null,
      player
    );
  }

  logPlayerJoin(playerName) {
    return this.addEvent(
      'player_join',
      `${playerName} joined the session`,
      null,
      'System'
    );
  }

  getEvents() {
    return [...this.events];
  }

  clearEvents() {
    this.events = [];
    this.notifyListeners();
  }

  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  notifyListeners() {
    this.listeners.forEach(listener => listener([...this.events]));
  }
}

// Export singleton instance
const eventLogService = new EventLogService();
export default eventLogService;