import React from 'react';

// A simple, inline SVG component for the Meeple Icon
const MeepleIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 100 100"
    style={{ width: '1em', height: '1em', display: 'inline-block', verticalAlign: 'middle' }}
  >
    <path
      d="M50 10 C 40 10, 40 25, 50 25 C 60 25, 60 10, 50 10 z
         M 30 35 L 70 35 L 70 60 C 70 65, 65 65, 65 60
         L 60 60 L 60 85 L 75 90 L 75 95
         L 25 95 L 25 90 L 40 85 L 40 60
         L 35 60 C 35 65, 30 65, 30 60 z"
      fill="currentColor"
    />
  </svg>
);

// --- Render helper ---
export function renderIcon(shape) {
  if (!shape) return null;
  if (shape.type === 'text') {
    return <span>{shape.icon}</span>;
  }
  if (shape.type === 'component') {
    const Comp = shape.icon;
    return <Comp />;
  }
  if (shape.type === 'image') {
    return <img src={shape.icon} alt={shape.name} className="w-full h-full" />;
  }
  return null;
}

// --- Token Palette Data ---
export const TOKEN_SHAPES = {
  // --- Basic Shapes ---
  circle: { name: 'Circle', type: 'text', icon: '●' },
  square: { name: 'Square', type: 'text', icon: '■' },
  triangle: { name: 'Triangle', type: 'text', icon: '▲' },
  diamond: { name: 'Diamond', type: 'text', icon: '♦' },
  star: { name: 'Star', type: 'text', icon: '★' },
  heart: { name: 'Heart', type: 'text', icon: '♥' },

  // --- Game & Status Markers ---
  skull: { name: 'Skull', type: 'text', icon: '☠️' },
  poison: { name: 'Poison', type: 'text', icon: '☣️' },
  explosion: { name: 'Explosion', type: 'text', icon: '💥' },
  target: { name: 'Target', type: 'text', icon: '🎯' },
  shield: { name: 'Shield', type: 'text', icon: '🛡️' },
  swords: { name: 'Swords', type: 'text', icon: '⚔️' },
  check: { name: 'Check', type: 'text', icon: '✔' },
  cross: { name: 'Cross', type: 'text', icon: '✘' },
  monster: { name: 'Monster', type: 'text', icon: '🦇' },

  // --- Treasure & Items ---
  chest: { name: 'Treasure Chest', type: 'text', icon: '📦' },
  gold: { name: 'Gold', type: 'text', icon: '💰' },
  coin: { name: 'Coin', type: 'text', icon: '🪙' },
  gem: { name: 'Gem', type: 'text', icon: '💎' },
  key: { name: 'Key', type: 'text', icon: '🗝️' },
  potion: { name: 'Potion', type: 'text', icon: '🧪' },

  // --- Map & Location Markers ---
  door: { name: 'Door', type: 'text', icon: '🚪' },
  trap: { name: 'Trap', type: 'text', icon: '🕸️' },
  rubble: { name: 'Rubble', type: 'text', icon: '🧱' },
  house: { name: 'House', type: 'text', icon: '🏠' },
  castle: { name: 'Castle', type: 'text', icon: '🏰' },
  church: { name: 'Church', type: 'text', icon: '⛪' },
  tree: { name: 'Tree', type: 'text', icon: '🌲' },
  pin: { name: 'Pin', type: 'text', icon: '📍' },
  campfire: { name: 'Campfire', type: 'text', icon: '⛺' },

  // --- Elements ---
  fire: { name: 'Element Fire', type: 'text', icon: '🔥' },
  water: { name: 'Element Water', type: 'text', icon: '💧' },
  air: { name: 'Element Air', type: 'text', icon: '💨' },
  earth: { name: 'Element Earth', type: 'text', icon: '🌿' },
  ice: { name: 'Element Ice', type: 'text', icon: '❄️' },
  light: { name: 'Element Light', type: 'text', icon: '☀️' },
  dark: { name: 'Element Dark', type: 'text', icon: '🌙' },
  lightning: { name: 'Element Lightning', type: 'text', icon: '⚡' },

  // --- UI & Utility ---
  magnifier: { name: 'Magnifier', type: 'text', icon: '🔍' },
  question: { name: 'Question', type: 'text', icon: '❓' },
  exclamation: { name: 'Exclamation', type: 'text', icon: '❗️' },
  character: { name: 'Character', type: 'text', icon: '👤' },
  meeple: { name: 'Meeple', type: 'component', icon: <MeepleIcon /> },

  // --- Dice ---
  dice1: { name: 'Dice 1', type: 'text', icon: '⚀' },
  dice2: { name: 'Dice 2', type: 'text', icon: '⚁' },
  dice3: { name: 'Dice 3', type: 'text', icon: '⚂' },
  dice4: { name: 'Dice 4', type: 'text', icon: '⚃' },
  dice5: { name: 'Dice 5', type: 'text', icon: '⚄' },
  dice6: { name: 'Dice 6', type: 'text', icon: '⚅' },

  // --- Fantasy ---
  dragon: { name: 'Dragon', type: 'text', icon: '🐉' },
  orc: { name: 'Orc', type: 'text', icon: '👹' },
  wizard: { name: 'Wizard', type: 'text', icon: '🧙' },
  knight: { name: 'Knight', type: 'text', icon: '🛡️' },
  archer: { name: 'Archer', type: 'text', icon: '🏹' },
  dwarf: { name: 'Dwarf', type: 'text', icon: '🪓' },
  elf: { name: 'Elf', type: 'text', icon: '🏹' },
  scroll: { name: 'Scroll', type: 'text', icon: '📜' },
  ring: { name: 'Magic Ring', type: 'text', icon: '💍' },
  crown: { name: 'Crown', type: 'text', icon: '👑' },

  // --- Modern ---
  soldier: { name: 'Soldier', type: 'text', icon: '🪖' },
  gun: { name: 'Gun', type: 'text', icon: '🔫' },
  police: { name: 'Police', type: 'text', icon: '👮' },
  medkit: { name: 'Medkit', type: 'text', icon: '⛑️' },
  radio: { name: 'Radio', type: 'text', icon: '📻' },
  car: { name: 'Car', type: 'text', icon: '🚗' },
  helicopter: { name: 'Helicopter', type: 'text', icon: '🚁' },
  bomb: { name: 'Bomb', type: 'text', icon: '💣' },
  building: { name: 'Building', type: 'text', icon: '🏢' },
  computer: { name: 'Computer', type: 'text', icon: '💻' },

  // --- Sci-Fi ---
  alien: { name: 'Alien', type: 'text', icon: '👽' },
  robot: { name: 'Robot', type: 'text', icon: '🤖' },
  spaceship: { name: 'Spaceship', type: 'text', icon: '🛸' },
  satellite: { name: 'Satellite', type: 'text', icon: '🛰️' },
  raygun: { name: 'Ray Gun', type: 'text', icon: '🔫' },
  planet: { name: 'Planet', type: 'text', icon: '🪐' },
  moonbase: { name: 'Moon Base', type: 'text', icon: '🌌' },
  dna: { name: 'DNA', type: 'text', icon: '🧬' },
  hazmat: { name: 'Hazmat', type: 'text', icon: '☢️' },
  cyborg: { name: 'Cyborg', type: 'text', icon: '🦾' },

  // --- RPG Utility ---
  initiative: { name: 'Initiative', type: 'text', icon: '🎲' },
  map: { name: 'Map', type: 'text', icon: '🗺️' },
  torch: { name: 'Torch', type: 'text', icon: '🔥' },
  trapdoor: { name: 'Trapdoor', type: 'text', icon: '🕳️' },
  backpack: { name: 'Backpack', type: 'text', icon: '🎒' }
};