import React, { useContext } from 'react';
import { AppContext } from '../state/appState';
import { Plus, Minus, Trash2 } from 'lucide-react';
import { CHARACTER_TEMPLATES } from '../data/Templates';

// A simple utility to generate more unique IDs
const generateUniqueId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

const CharacterSheet = () => {
  const { state, dispatch } = useContext(AppContext);
  const { characters } = state;

  const updateCharacter = (id, field, value) => {
    dispatch({ type: 'UPDATE_CHARACTER', payload: { id, field, value } });
  };

  const removeCharacter = (id) => {
    dispatch({ type: 'SET_STATE', payload: { characters: characters.filter(char => char.id !== id) } });
  };

  const addCustomField = (charId) => {
    dispatch({ type: 'SET_STATE', payload: {
      characters: characters.map(char => {
        if (char.id === charId) {
          const newField = { id: generateUniqueId(), name: 'New Stat', value: 0 };
          const customFields = char.data.customFields || [];
          return { ...char, data: { ...char.data, customFields: [...customFields, newField] } };
        }
        return char;
      })
    }});
  };

  const updateCustomField = (charId, fieldId, fieldProp, value) => {
    dispatch({ type: 'SET_STATE', payload: {
      characters: characters.map(char => {
        if (char.id === charId) {
          const updatedFields = char.data.customFields.map(field => 
            field.id === fieldId ? { ...field, [fieldProp]: value } : field
          );
          return { ...char, data: { ...char.data, customFields: updatedFields } };
        }
        return char;
      })
    }});
  };

  const removeCustomField = (charId, fieldId) => {
    dispatch({ type: 'SET_STATE', payload: {
      characters: characters.map(char => {
        if (char.id === charId) {
          const updatedFields = char.data.customFields.filter(field => field.id !== fieldId);
          return { ...char, data: { ...char.data, customFields: updatedFields } };
        }
        return char;
      })
    }});
  };

  // Silently filter out duplicate characters to prevent crashes
  const uniqueCharacters = characters.filter((char, index, self) =>
    index === self.findIndex((c) => c.id === char.id)
  );

  return (
    <div>
      {uniqueCharacters.map(char => {
        const template = CHARACTER_TEMPLATES[char.template];
        return (
          <div key={char.id} className="mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <input
                type="text"
                value={char.data.name || 'Unnamed Character'}
                onChange={(e) => updateCharacter(char.id, 'name', e.target.value)}
                className="flex-1 p-2 border border-gray-200 rounded font-semibold mr-2"
              />
              <div className="flex items-center gap-1">
                <button
                  onClick={() => removeCharacter(char.id)}
                  className="text-red-500 hover:text-red-700 p-1"
                  title="Remove character"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            <div className="text-xs text-gray-500 mb-2">Template: {template.name}</div>

            <div className="grid grid-cols-2 gap-2">
              {template.fields.slice(1).map(field => (
                <div key={field.name} className="flex items-center justify-between">
                  <span className="text-xs font-medium">{field.label}:</span>
                  <input
                    type={field.type}
                    value={char.data[field.name] || field.default}
                    onChange={(e) => updateCharacter(char.id, field.name, field.type === 'number' ? parseInt(e.target.value) || 0 : e.target.value)}
                    className="w-16 p-1 border border-gray-200 rounded text-center text-xs"
                  />
                </div>
              ))}
            </div>
            {char.template === 'custom' && (
              <div className="mt-4">
                {char.data.customFields && char.data.customFields.map(field => (
                  <div key={field.id} className="flex items-center gap-2 mb-2">
                    <input
                      type="text"
                      value={field.name}
                      onChange={(e) => updateCustomField(char.id, field.id, 'name', e.target.value)}
                      className="flex-1 p-1 border border-gray-200 rounded text-xs"
                    />
                    <button onClick={() => updateCustomField(char.id, field.id, 'value', field.value - 1)} className="w-6 h-6 bg-red-500 text-white rounded hover:bg-red-600 flex items-center justify-center">
                      <Minus size={12} />
                    </button>
                    <input
                      type="number"
                      value={field.value}
                      onChange={(e) => updateCustomField(char.id, field.id, 'value', parseInt(e.target.value) || 0)}
                      className="w-12 p-1 border border-gray-200 rounded text-center text-xs"
                    />
                    <button onClick={() => updateCustomField(char.id, field.id, 'value', field.value + 1)} className="w-6 h-6 bg-green-500 text-white rounded hover:bg-green-600 flex items-center justify-center">
                      <Plus size={12} />
                    </button>
                    <button onClick={() => removeCustomField(char.id, field.id)} className="text-red-500 hover:text-red-700">
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
                <button onClick={() => addCustomField(char.id)} className="mt-2 flex items-center gap-1 px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600">
                  <Plus size={14} />
                  Add Stat
                </button>
              </div>
            )}
          </div>
        );
      })}

      {characters.length === 0 && (
        <p className="text-gray-500 text-center py-8">No characters created yet.</p>
      )}
    </div>
  );
};

export default CharacterSheet;