import React from 'react';
import { CHARACTER_TEMPLATES } from '../data/Templates';

export const AppContext = React.createContext();

// Helper to check system preference
const prefersDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

// A simple utility to generate more unique IDs
const generateUniqueId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

export const initialState = {
  pdfs: [],
  pdfViewState: {}, // Stores view-related state like scale, initialScaleSet, and currentPage
  activePdfId: null,
  secondaryPdfId: null,
  isDualPaneMode: false,
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
  lineWidth: 3,
  sessionToRestore: null,
  menuOpen: false,
  activeDropdown: null,
  theme: localStorage.getItem('theme') || (prefersDarkMode ? 'dark' : 'light'),
  isSidebarVisible: true,
  layerStateKey: 0,
  openSections: {
    session: true,
  },
  sidebarWidth: 320,
  primaryPaneWidth: null,
};

export function reducer(state, action) {
  switch (action.type) {
    case 'SET_STATE':
      return { ...state, ...action.payload };
    case 'TOGGLE_THEME':
      const newTheme = state.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem('theme', newTheme);
      return { ...state, theme: newTheme };
    case 'ADD_CHARACTER':
        const template = CHARACTER_TEMPLATES[state.selectedTemplate];
        const newChar = {
          id: generateUniqueId(),
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