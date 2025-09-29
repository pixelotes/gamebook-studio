import React, { useState, useRef, useEffect } from 'react';
import { Clock, X, Trash2, Download } from 'lucide-react';

const EventLog = ({ events = [], onClear }) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const logEndRef = useRef(null);
  const logContainerRef = useRef(null);

  // Auto-scroll to bottom when new events are added
  useEffect(() => {
    if (autoScroll && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [events, autoScroll]);

  // Check if user has scrolled up manually
  const handleScroll = () => {
    if (logContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = logContainerRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      setAutoScroll(isAtBottom);
    }
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      hour12: false 
    });
  };

  const getEventIcon = (type) => {
    switch (type) {
      case 'dice_roll':
        return '🎲';
      case 'counter_change':
        return '📊';
      case 'counter_create':
        return '➕';
      case 'counter_delete':
        return '➖';
      case 'character_create':
        return '👤';
      case 'character_delete':
        return '💀';
      case 'character_update':
        return '✏️';
      case 'session_new':
        return '🆕';
      case 'pdf_open':
        return '📄';
      case 'pdf_close':
        return '🗑️';
      case 'multiplayer_start':
        return '🌐';
      case 'multiplayer_stop':
        return '🔌';
      case 'player_join':
        return '👋';
      default:
        return '📝';
    }
  };

  const getEventColor = (type) => {
    switch (type) {
      case 'dice_roll':
        return 'text-purple-600 dark:text-purple-400';
      case 'counter_change':
      case 'counter_create':
      case 'counter_delete':
        return 'text-blue-600 dark:text-blue-400';
      case 'character_create':
      case 'character_delete':
      case 'character_update':
        return 'text-green-600 dark:text-green-400';
      case 'session_new':
        return 'text-orange-600 dark:text-orange-400';
      case 'pdf_open':
      case 'pdf_close':
        return 'text-gray-600 dark:text-gray-400';
      case 'multiplayer_start':
      case 'multiplayer_stop':
      case 'player_join':
        return 'text-cyan-600 dark:text-cyan-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const exportLog = () => {
    const logText = events.map(event => 
      `[${formatTimestamp(event.timestamp)}] ${event.message}`
    ).join('\n');
    
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `event-log-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-gray-600 dark:text-gray-400" />
          <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">Event Log</h3>
          <span className="text-xs text-gray-500 dark:text-gray-400">({events.length})</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={exportLog}
            disabled={events.length === 0}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Export log"
          >
            <Download size={14} />
          </button>
          <button
            onClick={onClear}
            disabled={events.length === 0}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Clear log"
          >
            <Trash2 size={14} />
          </button>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            title={isMinimized ? "Expand" : "Minimize"}
          >
            {isMinimized ? '+' : '−'}
          </button>
        </div>
      </div>

      {/* Log Content */}
      {!isMinimized && (
        <>
          <div 
            ref={logContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto p-2 space-y-1 text-xs"
          >
            {events.length === 0 ? (
              <div className="text-center text-gray-400 dark:text-gray-500 py-8">
                No events yet
              </div>
            ) : (
              events.map((event, index) => (
                <div 
                  key={event.id || index}
                  className="flex items-start gap-2 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <span className="text-lg flex-shrink-0">{getEventIcon(event.type)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-gray-500 dark:text-gray-400 font-mono text-[10px]">
                        {formatTimestamp(event.timestamp)}
                      </span>
                      {event.player && (
                        <span className="text-gray-600 dark:text-gray-400 font-semibold">
                          [{event.player}]
                        </span>
                      )}
                    </div>
                    <div className={`${getEventColor(event.type)} break-words`}>
                      {event.message}
                    </div>
                    {event.details && (
                      <div className="text-gray-500 dark:text-gray-400 text-[10px] mt-0.5">
                        {event.details}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            <div ref={logEndRef} />
          </div>

          {/* Auto-scroll indicator */}
          {!autoScroll && (
            <div className="px-2 pb-2">
              <button
                onClick={() => {
                  setAutoScroll(true);
                  logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="w-full text-xs py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                ↓ Scroll to bottom
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default EventLog;