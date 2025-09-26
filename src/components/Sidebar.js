import React, { useContext } from 'react';
import { AppContext } from '../state/appState';
import { Users, Tally5, StickyNote, Bookmark, ChevronUp, ChevronDown, Plus } from 'lucide-react';
import CharacterSheet from './CharacterSheet';
import Notes from './Notes';
import Counters from './Counters';
import Bookmarks from './Bookmarks';
import { CHARACTER_TEMPLATES } from '../data/Templates';

const CollapsibleSection = ({ title, children, isOpen, onToggle }) => (
  <div className="border-b border-gray-200">
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between p-4 text-left font-semibold"
    >
      {title}
      {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
    </button>
    {isOpen && <div className="p-4 pt-0">{children}</div>}
  </div>
);

const Sidebar = ({ children }) => {
  const { state, dispatch } = useContext(AppContext);
  const { activeTab, selectedTemplate, openSections } = state;

  const setActiveTab = (tabId) => {
    dispatch({ type: 'SET_STATE', payload: { activeTab: tabId } });
  };

  const setSelectedTemplate = (template) => {
    dispatch({ type: 'SET_STATE', payload: { selectedTemplate: template } });
  };

  const toggleSection = (section) => {
    dispatch({ type: 'SET_STATE', payload: { openSections: { ...openSections, [section]: !openSections[section] } } });
  };

  return (
    <div className="w-80 bg-white shadow-lg border-r border-gray-200 flex flex-col dark:bg-gray-800 dark:border-gray-700">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-xl font-bold text-gray-800 dark:text-gray-200">Gamebook Studio</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">Digital tabletop companion</p>
      </div>
      
      {children}

      <div className="flex-1 overflow-y-auto">
        <CollapsibleSection title="Game Session" isOpen={openSections.session} onToggle={() => toggleSection('session')}>
          <div className="flex border-b border-gray-200">
            {[
              { id: 'sheets', icon: Users, label: '' },
              { id: 'counters', icon: Tally5, label: '' },
              { id: 'notes', icon: StickyNote, label: '' },
              { id: 'bookmarks', icon: Bookmark, label: '' },             
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1 py-2 px-3 text-sm transition-colors ${
                  activeTab === tab.id 
                    ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-500' 
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                <tab.icon size={14} />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'sheets' && (
              <div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Character Template
                  </label>
                  <select
                    value={selectedTemplate}
                    onChange={(e) => setSelectedTemplate(e.target.value)}
                    className="w-full p-2 border border-gray-200 rounded-lg text-sm"
                  >
                    {Object.entries(CHARACTER_TEMPLATES).map(([key, template]) => (
                      <option key={key} value={key}>{template.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">Character Sheets</h3>
                  <button
                    onClick={() => dispatch({ type: 'ADD_CHARACTER' })}
                    className="flex items-center gap-1 px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
                  >
                    <Plus size={14} />
                    Add
                  </button>
                </div>
                <CharacterSheet />
              </div>
            )}
            {activeTab === 'notes' && <Notes />}
            {activeTab === 'counters' && (
              <Counters />
            )}
            {activeTab === 'bookmarks' && (
              <Bookmarks />
            )}
          </div>
        </CollapsibleSection>
      </div>
    </div>
  );
};

export default Sidebar;