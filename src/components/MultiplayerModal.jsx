import React, { useState, useEffect } from 'react';
import { X, Users, Copy, Check, Wifi, WifiOff, Crown } from 'lucide-react';
import socketService from '../services/SocketService';

export const MultiplayerModal = ({ isOpen, onClose, onSessionCreated, onSessionJoined }) => {
  const [activeTab, setActiveTab] = useState('create');
  const [sessionId, setSessionId] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  useEffect(() => {
    if (isOpen) {
      setError('');
      checkConnection();
    }
  }, [isOpen]);

  const checkConnection = async () => {
    try {
      setConnectionStatus('connecting');
      await socketService.connect();
      setConnectionStatus('connected');
    } catch (error) {
      setConnectionStatus('error');
      setError('Failed to connect to multiplayer server. Please try again.');
    }
  };

  const handleCreateSession = async () => {
    setIsConnecting(true);
    setError('');

    try {
      const response = await socketService.createSession();
      onSessionCreated(response.sessionId);
      onClose();
    } catch (error) {
      setError(error.message);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleJoinSession = async () => {
    if (!sessionId.trim()) {
      setError('Please enter a session ID');
      return;
    }

    setIsConnecting(true);
    setError('');

    try {
      const response = await socketService.joinSession(sessionId.trim().toUpperCase());
      onSessionJoined(response);
      onClose();
    } catch (error) {
      setError(error.message);
    } finally {
      setIsConnecting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-96 max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Users size={20} />
            Multiplayer Session
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        {/* Connection Status */}
        <div className="p-4 border-b">
          <div className="flex items-center gap-2 text-sm">
            {connectionStatus === 'connecting' && (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span>Connecting to server...</span>
              </>
            )}
            {connectionStatus === 'connected' && (
              <>
                <Wifi size={16} className="text-green-600" />
                <span className="text-green-600">Connected to server</span>
              </>
            )}
            {connectionStatus === 'error' && (
              <>
                <WifiOff size={16} className="text-red-600" />
                <span className="text-red-600">Connection failed</span>
              </>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('create')}
            className={`flex-1 py-3 px-4 text-sm font-medium ${
              activeTab === 'create' 
                ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-500' 
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Create Session
          </button>
          <button
            onClick={() => setActiveTab('join')}
            className={`flex-1 py-3 px-4 text-sm font-medium ${
              activeTab === 'join' 
                ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-500' 
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Join Session
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-4">
          {activeTab === 'create' ? (
            <div className="space-y-4">
              <div className="text-sm text-gray-600">
                Create a new multiplayer session and invite others to join your game.
              </div>
              <button
                onClick={handleCreateSession}
                disabled={isConnecting || connectionStatus !== 'connected'}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isConnecting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Creating...
                  </>
                ) : (
                  'Create New Session'
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-sm text-gray-600">
                Enter the session ID provided by the host to join their game.
              </div>
              <input
                type="text"
                placeholder="Enter session ID (e.g., ABC123)"
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value.toUpperCase())}
                className="w-full p-3 border border-gray-300 rounded-lg text-center font-mono text-lg tracking-wider"
                maxLength={6}
              />
              <button
                onClick={handleJoinSession}
                disabled={isConnecting || connectionStatus !== 'connected' || !sessionId.trim()}
                className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isConnecting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Joining...
                  </>
                ) : (
                  'Join Session'
                )}
              </button>
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {connectionStatus === 'error' && (
            <button
              onClick={checkConnection}
              className="mt-2 w-full bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 text-sm"
            >
              Retry Connection
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export const MultiplayerStatus = ({ sessionId, isHost, connectedPlayers, onLeaveSession, onCopySessionId }) => {
  const [copied, setCopied] = useState(false);

  const handleCopySessionId = () => {
    navigator.clipboard.writeText(sessionId);
    setCopied(true);
    if (onCopySessionId) onCopySessionId();
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-blue-600" />
          <span className="text-sm font-medium text-blue-800">
            Multiplayer Active
          </span>
          {isHost && (
            <Crown size={14} className="text-yellow-600" title="You are the host" />
          )}
        </div>
        <button
          onClick={onLeaveSession}
          className="text-xs text-red-600 hover:text-red-700 underline"
        >
          Leave Session
        </button>
      </div>
      
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-blue-600 font-mono bg-white px-2 py-1 rounded border">
          {sessionId}
        </span>
        <button
          onClick={handleCopySessionId}
          className="text-blue-600 hover:text-blue-700 p-1"
          title="Copy session ID"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
      
      <div className="text-xs text-blue-600">
        {connectedPlayers} player{connectedPlayers !== 1 ? 's' : ''} connected
      </div>
      
      {isHost && (
        <div className="mt-2 text-xs text-blue-600">
          💡 Share the session ID with other players so they can join
        </div>
      )}
    </div>
  );
};

export const PlayerList = ({ players, currentSocketId, hostSocketId }) => {
  if (!players || players.length === 0) return null;

  return (
    <div className="bg-gray-50 rounded-lg p-3 mb-4">
      <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
        <Users size={14} />
        Players ({players.length})
      </h4>
      <div className="space-y-1">
        {players.map(player => (
          <div key={player.socketId} className="flex items-center gap-2 text-sm">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className={player.socketId === currentSocketId ? 'font-medium' : ''}>
              {player.socketId === currentSocketId ? 'You' : `Player ${player.socketId.substring(0, 6)}`}
            </span>
            {player.socketId === hostSocketId && (
              <Crown size={12} className="text-yellow-600" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export const MultiplayerNotifications = ({ notifications }) => {
  if (!notifications || notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-40 space-y-2">
      {notifications.map(notification => (
        <div
          key={notification.id}
          className={`p-3 rounded-lg shadow-lg max-w-sm animate-slide-in ${
            notification.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' :
            notification.type === 'error' ? 'bg-red-100 text-red-800 border border-red-200' :
            'bg-blue-100 text-blue-800 border border-blue-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <Users size={16} />
            <span className="text-sm font-medium">{notification.message}</span>
          </div>
          {notification.details && (
            <div className="text-xs mt-1 opacity-75">
              {notification.details}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}