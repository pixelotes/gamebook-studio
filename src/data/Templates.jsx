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
  },
  pathfinder2e: {
    name: 'Pathfinder 2e',
    fields: [
      { name: 'name', label: 'Character Name', type: 'text', default: 'New Character' },
      { name: 'level', label: 'Level', type: 'number', default: 1 },
      { name: 'ancestry', label: 'Ancestry', type: 'text', default: '' },
      { name: 'class', label: 'Class', type: 'text', default: '' },
      { name: 'ac', label: 'Armor Class', type: 'number', default: 10 },
      { name: 'hp', label: 'Hit Points', type: 'number', default: 10 },
      { name: 'maxHp', label: 'Max HP', type: 'number', default: 10 },
      { name: 'perception', label: 'Perception', type: 'number', default: 0 },
      { name: 'fortitude', label: 'Fortitude', type: 'number', default: 0 },
      { name: 'reflex', label: 'Reflex', type: 'number', default: 0 },
      { name: 'will', label: 'Will', type: 'number', default: 0 }
    ]
  },
  callOfCthulhu7e: {
    name: 'Call of Cthulhu 7e',
    fields: [
      { name: 'name', label: 'Investigator', type: 'text', default: 'New Investigator' },
      { name: 'occupation', label: 'Occupation', type: 'text', default: '' },
      { name: 'str', label: 'STR', type: 'number', default: 50 },
      { name: 'con', label: 'CON', type: 'number', default: 50 },
      { name: 'siz', label: 'SIZ', type: 'number', default: 50 },
      { name: 'dex', label: 'DEX', type: 'number', default: 50 },
      { name: 'app', label: 'APP', type: 'number', default: 50 },
      { name: 'edu', label: 'EDU', type: 'number', default: 50 },
      { name: 'int', label: 'INT', type: 'number', default: 50 },
      { name: 'pow', label: 'POW', type: 'number', default: 50 },
      { name: 'luck', label: 'Luck', type: 'number', default: 50 },
      { name: 'hp', label: 'Hit Points', type: 'number', default: 10 },
      { name: 'sanity', label: 'Sanity', type: 'number', default: 50 },
      { name: 'mp', label: 'Magic Points', type: 'number', default: 10 }
    ]
  },
  theOneRing2e: {
    name: 'The One Ring 2e',
    fields: [
      { name: 'name', label: 'Hero Name', type: 'text', default: 'New Hero' },
      { name: 'culture', label: 'Culture', type: 'text', default: '' },
      { name: 'calling', label: 'Calling', type: 'text', default: '' },
      { name: 'strength', label: 'Strength', type: 'number', default: 5 },
      { name: 'heart', label: 'Heart', type: 'number', default: 5 },
      { name: 'wits', label: 'Wits', type: 'number', default: 5 },
      { name: 'endurance', label: 'Endurance', type: 'number', default: 25 },
      { name: 'hope', label: 'Hope', type: 'number', default: 10 },
      { name: 'parry', label: 'Parry', type: 'number', default: 15 },
      { name: 'valour', label: 'Valour', type: 'number', default: 1 },
      { name: 'wisdom', label: 'Wisdom', type: 'number', default: 1 },
      { name: 'shadow', label: 'Shadow', type: 'number', default: 0 }
    ]
  },
  fateCore: {
    name: 'FATE Core',
    fields: [
      { name: 'name', label: 'Character Name', type: 'text', default: 'New Character' },
      { name: 'description', label: 'Description', type: 'text', default: '' },
      { name: 'highConcept', label: 'High Concept', type: 'text', default: '' },
      { name: 'trouble', label: 'Trouble', type: 'text', default: '' },
      { name: 'refresh', label: 'Refresh', type: 'number', default: 3 }
    ]
  }
};
