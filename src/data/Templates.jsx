// Character Sheet Templates
export const CHARACTER_TEMPLATES = {
  custom: {
    name: 'Custom',
    fields: [
      { name: 'name', label: 'Character Name', type: 'text', default: 'New Character' }
    ]
  },
  basic: {
    name: 'Basic RPG',
    fields: [
      { name: 'name', label: 'Character Name', type: 'text', default: 'New Character' },
      { name: 'level', label: 'Level', type: 'number', default: 1 },
      { name: 'health', label: 'Health', type: 'number', default: 10 },
      { name: 'maxHealth', label: 'Max Health', type: 'number', default: 10 },
      { name: 'strength', label: 'Strength', type: 'number', default: 10 },
      { name: 'dexterity', label: 'Dexterity', type: 'number', default: 10 },
      { name: 'intelligence', label: 'Intelligence', type: 'number', default: 10 },
      { name: 'armor', label: 'Armor Class', type: 'number', default: 10 }
    ]
  },
  dnd5e: {
    name: 'D&D 5e',
    fields: [
      { name: 'name', label: 'Character Name', type: 'text', default: 'New Character' },
      { name: 'class', label: 'Class', type: 'text', default: 'Fighter' },
      { name: 'level', label: 'Level', type: 'number', default: 1 },
      { name: 'ac', label: 'Armor Class', type: 'number', default: 10 },
      { name: 'hp', label: 'Hit Points', type: 'number', default: 8 },
      { name: 'maxHp', label: 'Max HP', type: 'number', default: 8 }
    ]
  }
};