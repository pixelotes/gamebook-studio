import React, { useContext, useRef, useEffect } from 'react';
import { AppContext } from '../state/appState';
import { Plus, Minus, Trash2 } from 'lucide-react';
import eventLogService from '../services/EventLogService';

// A simple utility to generate more unique IDs
const generateUniqueId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

const Counters = () => {
  const { state, dispatch } = useContext(AppContext);
  const { counters } = state;
  
  // Store previous values and debounce timers
  const previousValuesRef = useRef({});
  const debounceTimersRef = useRef({});

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      Object.values(debounceTimersRef.current).forEach(timer => clearTimeout(timer));
    };
  }, []);

  const addCounter = () => {
    const newCounter = { 
      id: generateUniqueId(),
      name: `Counter ${counters.length + 1}`, 
      value: 0,
      color: '#3b82f6'
    };
    
    eventLogService.logCounterCreate(newCounter.name, newCounter.value);
    
    dispatch({ type: 'SET_STATE', payload: {
      counters: [...counters, newCounter]
    }});
  };

  const updateCounter = (id, field, value) => {
    const counter = counters.find(c => c.id === id);
    const key = `${id}-${field}`;
    
    if (counter && field === 'value') {
      // Store the old value on first change
      if (previousValuesRef.current[key] === undefined) {
        previousValuesRef.current[key] = counter.value;
      }
      
      // Clear existing timer
      if (debounceTimersRef.current[key]) {
        clearTimeout(debounceTimersRef.current[key]);
      }
      
      // Update the counter immediately
      dispatch({ type: 'SET_STATE', payload: {
        counters: counters.map(counter => 
          counter.id === id ? { ...counter, [field]: value } : counter
        )
      }});
      
      // Debounce the logging
      debounceTimersRef.current[key] = setTimeout(() => {
        if (previousValuesRef.current[key] !== undefined) {
          const oldValue = previousValuesRef.current[key];
          if (oldValue !== value) {
            eventLogService.logCounterChange(counter.name, oldValue, value);
          }
          delete previousValuesRef.current[key];
        }
      }, 500); // 500ms debounce for counter values
    } else {
      // For non-value fields (like name), update without debouncing
      dispatch({ type: 'SET_STATE', payload: {
        counters: counters.map(counter => 
          counter.id === id ? { ...counter, [field]: value } : counter
        )
      }});
    }
  };

  const removeCounter = (id) => {
    const counter = counters.find(c => c.id === id);
    
    if (counter) {
      eventLogService.logCounterDelete(counter.name);
    }
    
    dispatch({ type: 'SET_STATE', payload: {
      counters: counters.filter(counter => counter.id !== id)
    }});
  };

  // Silently filter out duplicate counters to prevent crashes
  const uniqueCounters = counters.filter((counter, index, self) =>
    index === self.findIndex((c) => c.id === counter.id)
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Counters</h3>
        <button
          onClick={addCounter}
          className="flex items-center gap-1 px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
        >
          <Plus size={14} />
          Add
        </button>
      </div>

      {uniqueCounters.map(counter => (
        <div key={counter.id} className="mb-3 p-3 bg-gray-50 rounded-lg dark:bg-gray-700">
          <div className="flex items-center justify-between mb-2">
            <input
              type="text"
              value={counter.name}
              onChange={(e) => updateCounter(counter.id, 'name', e.target.value)}
              className="flex-1 p-1 border border-gray-200 rounded text-sm font-medium mr-2 dark:bg-gray-600 dark:border-gray-500 dark:text-gray-200"
            />
            <button
              onClick={() => removeCounter(counter.id)}
              className="text-red-500 hover:text-red-700"
            >
              <Trash2 size={14} />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={() => updateCounter(counter.id, 'value', (counter.value || 0) - 1)}
              className="w-8 h-8 bg-red-500 text-white rounded hover:bg-red-600 flex items-center justify-center"
            >
              <Minus size={14} />
            </button>
            <span className="text-xl font-bold" style={{ color: counter.color }}>
              {counter.value}
            </span>
            <button
              onClick={() => updateCounter(counter.id, 'value', (counter.value || 0) + 1)}
              className="w-8 h-8 bg-green-500 text-white rounded hover:bg-green-600 flex items-center justify-center"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      ))}

      {counters.length === 0 && (
        <p className="text-gray-500 text-center py-8">No counters created yet.</p>
      )}
    </div>
  );
};

export default Counters;