import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameSession } from './GameSession';
import * as workerClient from './workerClient';

// Mock the worker task to avoid actual thread creation during unit tests
vi.mock('./workerClient', () => ({
  runWorkerTask: vi.fn()
}));

describe('GameSession', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should initialize with default values', () => {
    const session = new GameSession('session-123', 'host-abc');
    expect(session.id).toBe('session-123');
    expect(session.hostSocketId).toBe('host-abc');
    expect(session.clients.size).toBe(0);
    expect(session.stateVersion).toBe(0);
    expect(session.gameState.pdfs).toEqual([]);
    expect(session.gameState.characters).toEqual([]);
  });

  it('should add and remove clients', () => {
    const session = new GameSession('session-123', 'host-abc');
    
    const p1 = session.addClient('socket-1');
    expect(p1).toBe('Player 1');
    expect(session.clients.has('socket-1')).toBe(true);

    const p2 = session.addClient('socket-2');
    expect(p2).toBe('Player 2');

    const isEmptyAfterOne = session.removeClient('socket-1');
    expect(isEmptyAfterOne).toBe(false);

    const isEmptyAfterTwo = session.removeClient('socket-2');
    expect(isEmptyAfterTwo).toBe(true);
  });

  it('should process valid state updates and increment version', async () => {
    const session = new GameSession('session-123', 'host-abc');
    
    // Mock the worker returning a mock delta
    workerClient.runWorkerTask.mockResolvedValue({ "notes": ["", "New note"] });

    const result = await session.updateGameState({ notes: "New note" });
    
    expect(result).not.toBeNull();
    expect(result.version).toBe(1);
    expect(result.delta).toBeDefined();
    
    expect(session.stateVersion).toBe(1);
    expect(session.gameState.notes).toBe("New note");
    expect(session.stateHistory.length).toBe(1);
  });

  it('should reject invalid state schemas', async () => {
    const session = new GameSession('session-123', 'host-abc');
    
    // Characters must be an array, passing a string should fail validation
    const result = await session.updateGameState({ characters: "Not an array" });
    
    expect(result).toBeNull();
    expect(session.stateVersion).toBe(0);
  });

  it('should truncate stateHistory at 500 entries', async () => {
    const session = new GameSession('session-123', 'host-abc');
    // Pre-fill history to 500
    for(let i=0; i<500; i++) {
        session.stateHistory.push({ version: i, delta: {}, timestamp: Date.now() });
    }
    
    workerClient.runWorkerTask.mockResolvedValue({ "notes": ["", "Update"] });

    await session.updateGameState({ notes: "Update" });
    
    // History should not exceed 500
    expect(session.stateHistory.length).toBe(500);
    // The first item should be evicted, so the last item is our new one
    expect(session.stateHistory[499].version).toBe(1); // Since session version started at 0
  });

  it('should limit eventLog size to 100 entries', () => {
    const session = new GameSession('session-123', 'host-abc');
    
    for(let i=0; i<105; i++) {
        session.addEvent({ type: 'roll', value: i });
    }
    
    expect(session.gameState.eventLog.length).toBe(100);
    // The oldest 5 should be gone, so the first remaining is value 5
    expect(session.gameState.eventLog[0].value).toBe(5);
  });

  it('should correctly serialize to and from JSON', () => {
    const session = new GameSession('session-123', 'host-abc');
    session.addClient('socket-1');
    session.gameState.notes = "Testing serialization";

    const jsonString = JSON.stringify(session.toJSON());
    const restoredSession = GameSession.fromJSON(JSON.parse(jsonString));

    expect(restoredSession.id).toBe('session-123');
    expect(restoredSession.hostSocketId).toBe('host-abc');
    expect(restoredSession.clients.has('socket-1')).toBe(true);
    expect(restoredSession.gameState.notes).toBe("Testing serialization");
  });
});