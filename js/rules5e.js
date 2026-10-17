// D&D 5e (2024) reference data used by the app.
// Game terms stay in English as in the rulebooks; explanations are short German paraphrases.

export const ABILITIES = [
  { key: 'str', short: 'STR', name: 'Strength' },
  { key: 'dex', short: 'DEX', name: 'Dexterity' },
  { key: 'con', short: 'CON', name: 'Constitution' },
  { key: 'int', short: 'INT', name: 'Intelligence' },
  { key: 'wis', short: 'WIS', name: 'Wisdom' },
  { key: 'cha', short: 'CHA', name: 'Charisma' },
];

export const SKILLS = [
  { key: 'acrobatics', name: 'Acrobatics', ab: 'dex' },
  { key: 'animal', name: 'Animal Handling', ab: 'wis' },
  { key: 'arcana', name: 'Arcana', ab: 'int' },
  { key: 'athletics', name: 'Athletics', ab: 'str' },
  { key: 'deception', name: 'Deception', ab: 'cha' },
  { key: 'history', name: 'History', ab: 'int' },
  { key: 'insight', name: 'Insight', ab: 'wis' },
  { key: 'intimidation', name: 'Intimidation', ab: 'cha' },
  { key: 'investigation', name: 'Investigation', ab: 'int' },
  { key: 'medicine', name: 'Medicine', ab: 'wis' },
  { key: 'nature', name: 'Nature', ab: 'int' },
  { key: 'perception', name: 'Perception', ab: 'wis' },
  { key: 'performance', name: 'Performance', ab: 'cha' },
  { key: 'persuasion', name: 'Persuasion', ab: 'cha' },
  { key: 'religion', name: 'Religion', ab: 'int' },
  { key: 'sleight', name: 'Sleight of Hand', ab: 'dex' },
  { key: 'stealth', name: 'Stealth', ab: 'dex' },
  { key: 'survival', name: 'Survival', ab: 'wis' },
];

// caster: 'full' | 'half' | 'pact' | null ; spell: spellcasting ability
export const CLASSES = {
  Barbarian: { die: 12, saves: ['str', 'con'], caster: null },
  Bard:      { die: 8,  saves: ['dex', 'cha'], caster: 'full', spell: 'cha' },
  Cleric:    { die: 8,  saves: ['wis', 'cha'], caster: 'full', spell: 'wis' },
  Druid:     { die: 8,  saves: ['int', 'wis'], caster: 'full', spell: 'wis' },
  Fighter:   { die: 10, saves: ['str', 'con'], caster: null },
  Monk:      { die: 8,  saves: ['str', 'dex'], caster: null },
  Paladin:   { die: 10, saves: ['wis', 'cha'], caster: 'half', spell: 'cha' },
  Ranger:    { die: 10, saves: ['str', 'dex'], caster: 'half', spell: 'wis' },
  Rogue:     { die: 8,  saves: ['dex', 'int'], caster: null },
  Sorcerer:  { die: 6,  saves: ['con', 'cha'], caster: 'full', spell: 'cha' },
  Warlock:   { die: 8,  saves: ['wis', 'cha'], caster: 'pact', spell: 'cha' },
  Wizard:    { die: 6,  saves: ['int', 'wis'], caster: 'full', spell: 'int' },
};
export const CLASS_NAMES = Object.keys(CLASSES);

export const SPECIES = ['Aasimar', 'Dragonborn', 'Dwarf', 'Elf', 'Gnome', 'Goliath', 'Halfling', 'Human', 'Orc', 'Tiefling'];
export const ALIGNMENTS = ['Lawful Good', 'Neutral Good', 'Chaotic Good', 'Lawful Neutral', 'Neutral', 'Chaotic Neutral', 'Lawful Evil', 'Neutral Evil', 'Chaotic Evil'];

// XP needed to reach each level (index = level)
export const XP_FOR = [0, 0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];
export const levelForXp = xp => { let l = 1; for (let i = 2; i <= 20; i++) if (xp >= XP_FOR[i]) l = i; return l; };
export const profBonus = level => Math.ceil(Math.max(1, level) / 4) + 1;
export const mod = score => Math.floor(((Number(score) || 10) - 10) / 2);
export const sgn = n => (n >= 0 ? '+' : '−') + Math.abs(n);

const FULL = [[], [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1]];
const HALF = [[], [2], [2], [3], [3], [4, 2], [4, 2], [4, 3], [4, 3], [4, 3, 2], [4, 3, 2], [4, 3, 3], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 1],
  [4, 3, 3, 2], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2]];
// Warlock Pact Magic: [number of slots, slot level]
const PACT = [[0, 0], [1, 1], [2, 1], [2, 2], [2, 2], [2, 3], [2, 3], [2, 4], [2, 4], [2, 5], [2, 5], [3, 5], [3, 5], [3, 5], [3, 5], [3, 5], [3, 5], [4, 5], [4, 5], [4, 5], [4, 5]];

// Spell slot maximums per spell level 1–9 for a class at a level.
export function autoSlots(cls, level) {
  const c = CLASSES[cls]; const l = Math.min(20, Math.max(1, level || 1));
  const out = Array(9).fill(0);
  if (!c || !c.caster) return out;
  if (c.caster === 'pact') { const [n, lv] = PACT[l]; if (n) out[lv - 1] = n; return out; }
  (c.caster === 'full' ? FULL : HALF)[l].forEach((n, i) => { out[i] = n; });
  return out;
}
export const isPact = cls => CLASSES[cls]?.caster === 'pact';

// reset: 'short' = refills on short rest, 'shortOne' = one use back on short rest (all on long), 'long' = only long rest
export function suggestedResources(cls, level, abilities = {}) {
  const l = level || 1; const out = [];
  const add = (name, max, reset) => { if (max > 0) out.push({ name, max, reset }); };
  if (cls === 'Barbarian') add('Rage', l >= 17 ? 6 : l >= 12 ? 5 : l >= 6 ? 4 : l >= 3 ? 3 : 2, 'shortOne');
  if (cls === 'Fighter') { add('Second Wind', l >= 10 ? 4 : l >= 4 ? 3 : 2, 'shortOne'); if (l >= 2) add('Action Surge', l >= 17 ? 2 : 1, 'short'); }
  if (cls === 'Bard') add('Bardic Inspiration', Math.max(1, mod(abilities.cha)), l >= 5 ? 'short' : 'long');
  if (cls === 'Cleric' && l >= 2) add('Channel Divinity', l >= 18 ? 4 : l >= 6 ? 3 : 2, 'shortOne');
  if (cls === 'Paladin') { add('Lay on Hands (HP)', 5 * l, 'long'); if (l >= 3) add('Channel Divinity', l >= 11 ? 3 : 2, 'shortOne'); }
  if (cls === 'Druid' && l >= 2) add('Wild Shape', l >= 17 ? 4 : l >= 6 ? 3 : 2, 'shortOne');
  if (cls === 'Monk' && l >= 2) add('Focus Points', l, 'short');
  if (cls === 'Sorcerer' && l >= 2) add('Sorcery Points', l, 'long');
  return out;
}
export const RESET_LABEL = { short: 'Short Rest', shortOne: '1 pro Short Rest, alle bei Long Rest', long: 'Long Rest' };

export const CONDITIONS = [
  { name: 'Blinded', desc: 'Sieht nichts. Angriffe gegen dich mit Vorteil, deine Angriffe mit Nachteil.' },
  { name: 'Charmed', desc: 'Kann den Bezauberer nicht angreifen; er hat Vorteil bei sozialen Würfen gegen dich.' },
  { name: 'Deafened', desc: 'Hört nichts; Proben, die Hören erfordern, scheitern automatisch.' },
  { name: 'Frightened', desc: 'Nachteil auf Proben und Angriffe, solange die Quelle der Angst sichtbar ist; kann sich nicht freiwillig nähern.' },
  { name: 'Grappled', desc: 'Speed 0. Nachteil auf Angriffe gegen alle außer den Greifenden.' },
  { name: 'Incapacitated', desc: 'Keine Actions, Bonus Actions oder Reactions; keine Konzentration; kann nicht sprechen.' },
  { name: 'Invisible', desc: 'Unsichtbar. Deine Angriffe mit Vorteil, Angriffe gegen dich mit Nachteil.' },
  { name: 'Paralyzed', desc: 'Incapacitated, Speed 0. STR- und DEX-Saves scheitern; Treffer aus 5 ft sind kritisch.' },
  { name: 'Petrified', desc: 'Zu Stein verwandelt: Incapacitated, Resistenz gegen allen Schaden.' },
  { name: 'Poisoned', desc: 'Nachteil auf Angriffe und Ability Checks.' },
  { name: 'Prone', desc: 'Liegt am Boden. Nur kriechen; Nahkampfangriffe gegen dich mit Vorteil.' },
  { name: 'Restrained', desc: 'Speed 0. Deine Angriffe und DEX-Saves mit Nachteil, Angriffe gegen dich mit Vorteil.' },
  { name: 'Stunned', desc: 'Incapacitated. STR- und DEX-Saves scheitern; Angriffe gegen dich mit Vorteil.' },
  { name: 'Unconscious', desc: 'Bewusstlos und Prone. Saves scheitern, Treffer aus 5 ft sind kritisch.' },
];
export const EXHAUSTION_DESC = 'Pro Stufe −2 auf alle d20-Würfe und −5 ft Speed. Stufe 6 = Tod. Ein Long Rest senkt die Stufe um 1.';

// Class + species glyphs (24-unit grid, round strokes)
export const ICONS = {
  Barbarian: '<path d="M12 2.5v19"/><path d="M12 7.5C9.5 7 7 5.5 4.5 4 3 7.5 3 12.5 4.5 16 7 14.5 9.5 13 12 12.5"/><path d="M12 7.5c2.5-.5 5-2 7.5-3.5 1.5 3.5 1.5 8.5 0 12-2.5-1.5-5-3-7.5-3.5"/>',
  Bard: '<ellipse cx="9" cy="15" rx="5" ry="5.5"/><circle cx="9" cy="15" r="1.4"/><path d="M12.2 10.8 18.5 4.5"/><path d="M17 3.5l3.5 3.5"/>',
  Cleric: '<circle cx="12" cy="12" r="3.5"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  Druid: '<path d="M5 19C5 10 11 4.5 19.5 5 20 13.5 14.5 19 5 19z"/><path d="M5 19l9-9M9.5 14.5h4M11.5 12.5V9"/>',
  Fighter: '<path d="M12 2.5l2 3V15h-4V5.5z"/><path d="M7 15h10M12 15v4.5"/><circle cx="12" cy="20.8" r="1"/>',
  Monk: '<path d="M18.4 7.2A7.8 7.8 0 1 0 19.6 13"/><circle cx="12" cy="12" r="1.6"/>',
  Paladin: '<path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6z"/><path d="M12 7.5v9M8.5 11h7"/>',
  Ranger: '<path d="M7 3c8 4 8 14 0 18"/><path d="M7 3v18"/><path d="M3.5 12H19"/><path d="M16 9l3 3-3 3"/>',
  Rogue: '<path d="M19.5 4.5l-7 8.5-2-2z"/><path d="M8.5 10.5l5 5M11 13.5l-4.5 4.5"/><circle cx="5.5" cy="19" r="1.2"/>',
  Sorcerer: '<path d="M12 3c1.5 4 6 5.5 6 11a6 6 0 0 1-12 0c0-3 1.7-4.8 3-6.5.6 2.5 1.6 3.6 3 4 0-3-.9-5.3 0-8.5z"/>',
  Warlock: '<path d="M2.5 12C6 6.5 18 6.5 21.5 12 18 17.5 6 17.5 2.5 12z"/><ellipse cx="12" cy="12" rx="1.6" ry="3.3"/>',
  Wizard: '<path d="M12 2.5 17.5 16h-11z"/><path d="M3.5 16.5c3 2.5 14 2.5 17 0"/><path d="M11 10.5l1 1.2 1-1.2"/>',
};
export const D20 = '<path d="M12 2.5l8.5 5v9L12 21.5l-8.5-5v-9z"/><path d="M12 7l5 8.5H7z"/><path d="M12 2.5V7M3.5 7.5 7 15.5M20.5 7.5 17 15.5M7 15.5l5 6 5-6"/>';
export const HUE = { Barbarian: 14, Bard: 320, Cleric: 44, Druid: 122, Fighter: 212, Monk: 28, Paladin: 196, Ranger: 88, Rogue: 255, Sorcerer: 350, Warlock: 282, Wizard: 232 };

// Dice colours: each character in a campaign picks a unique one.
export const DICE_COLORS = [
  { key: 'crimson', name: 'Karmesin', hex: '#C2303C' },
  { key: 'ember', name: 'Glut', hex: '#E0702A' },
  { key: 'gold', name: 'Gold', hex: '#D4A20F' },
  { key: 'moss', name: 'Moos', hex: '#4E9A3A' },
  { key: 'jade', name: 'Jade', hex: '#159A86' },
  { key: 'sky', name: 'Himmel', hex: '#2F8FD8' },
  { key: 'royal', name: 'Königsblau', hex: '#3B4FC4' },
  { key: 'violet', name: 'Violett', hex: '#7B45C9' },
  { key: 'rose', name: 'Rosé', hex: '#D0458F' },
  { key: 'bone', name: 'Knochen', hex: '#B8AE95' },
  { key: 'iron', name: 'Eisen', hex: '#6B7280' },
  { key: 'onyx', name: 'Onyx', hex: '#2A2D34' },
];
export const diceHex = key => DICE_COLORS.find(d => d.key === key)?.hex || '#6B7280';

// Campaign themes: the DM picks one and can switch when the party enters a new area.
export const THEMES = {
  standard:  { name: 'Standard', accent: '#2B4790', accentDark: '#8FA8EA', tint: '#E4E9F5', tintDark: '#1D2740' },
  wald:      { name: 'Wald', accent: '#2F6B3A', accentDark: '#7FC48C', tint: '#E2EFE3', tintDark: '#18291C' },
  unterreich:{ name: 'Unterreich', accent: '#6B3FA0', accentDark: '#B996E6', tint: '#ECE4F6', tintDark: '#261C35' },
  wueste:    { name: 'Wüste', accent: '#A8641A', accentDark: '#E2A35A', tint: '#F6EBDD', tintDark: '#2E2214' },
  frost:     { name: 'Frost', accent: '#1F7A99', accentDark: '#7CCAE6', tint: '#DFF0F6', tintDark: '#14262E' },
  hoelle:    { name: 'Höllenreich', accent: '#A8322A', accentDark: '#EE7B6E', tint: '#F7E2DF', tintDark: '#331816' },
  see:       { name: 'Küste', accent: '#1D5F8C', accentDark: '#6FB2E4', tint: '#DEEAF4', tintDark: '#132433' },
  stadt:     { name: 'Stadt', accent: '#5B5F6B', accentDark: '#B3B8C4', tint: '#E9EAED', tintDark: '#22252B' },
};
