import React from 'react';
import { CHARACTER_TEMPLATES } from '../data/Templates';

export const AppContext = React.createContext();

export const initialState = {
  pdfs: [],
  activePdfId: null,
  activeTab: 'sheets',
  characters: [],
  selectedTemplate: 'custom',
  notes: '',
  counters: [],
  selectedTool: 'select',
  selectedColor: '#ff6b6b',
  selectedTokenShape: 'circle',
  selectedTokenColor: '#ff6b6b',
  tokenSize: 20,
  sessionToRestore: null,
  menuOpen: false,
  activeDropdown: null,
  isSidebarVisible: true,
  layerStateKey: 0,
  openSections: {
    session: true,
  },
};

export function reducer(state, action) {
  switch (action.type) {
    case 'SET_STATE':
      return { ...state, ...action.payload };
    case 'ADD_CHARACTER':
        const template = CHARACTER_TEMPLATES[state.selectedTemplate];
        const newChar = {
          id: Date.now(),
          template: state.selectedTemplate,
          data: {
            customFields: []
          }
        };
        template.fields.forEach(field => {
          newChar.data[field.name] = field.default;
        });
      return { ...state, characters: [...state.characters, newChar] };
    case 'UPDATE_CHARACTER':
        return {
            ...state,
            characters: state.characters.map(char =>
                char.id === action.payload.id ? {
                    ...char,
                    data: { ...char.data, [action.payload.field]: action.payload.value }
                } : char
            )
        };
    default:
      return state;
  }
}