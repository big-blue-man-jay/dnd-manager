// What a level 1 character still has to pick beyond class, species and background (D&D 2024):
// Rogue Expertise, the Magic Initiate spells (Acolyte, Guide, Sage), the Skilled feat's three skills,
// plus the class starting equipment (option A of the Player's Handbook) and class tool proficiencies.
// Used by the guided builder and by the "Nachholen" box on characters made before this existed.
import { html, useState, Modal, toast, failed } from './ui.js';
import { SKILLS, ABILITIES, CLASSES, mod, sgn } from './rules5e.js';
import { newId, store } from './data.js';
import { SPELL_ATTACKS, BACKGROUNDS, SKILL_DESC } from './builder-data.js';
import { Decide, PerksPicker, CHOICES, MASTERY_N, emptyPerks, perksOk, perksHint, masteryOptions, perkLines, WEAPONS, MASTERY } from './classperks.js';

// starting equipment, option A (2024 Player's Handbook): [name, qty, note]
export const KITS = {
  Barbarian: { items: [['Greataxe', 1, 'slashing, heavy, two-handed'], ['Handaxe', 4, 'slashing, light, thrown 20/60 ft'], ["Explorer's Pack", 1, 'Rucksack, Schlafsack, Zunderkästchen, Fackeln, Rationen, Wasserschlauch, Seil']], gp: 15 },
  Bard: { items: [['Leather Armor', 1, 'AC 11 + Dex'], ['Dagger', 2, 'piercing, finesse, light, thrown 20/60 ft'], ['Musikinstrument nach Wahl', 1, ''], ["Entertainer's Pack", 1, 'Rucksack, Schlafsack, Kostüme, Kerzen, Rationen, Wasserschlauch']], gp: 19, tools: '3 Musikinstrumente nach Wahl' },
  Cleric: { items: [['Chain Shirt', 1, 'AC 13 + Dex (max 2)'], ['Shield', 1, '+2 AC'], ['Mace', 1, 'bludgeoning'], ['Holy Symbol', 1, 'Fokus für Zauber'], ["Priest's Pack", 1, 'Rucksack, Decke, Kerzen, Weihrauch, Rationen, Wasserschlauch']], gp: 7 },
  Druid: { items: [['Leather Armor', 1, 'AC 11 + Dex'], ['Shield', 1, '+2 AC'], ['Sickle', 1, 'slashing, light'], ['Quarterstaff', 1, 'Druidic Focus · bludgeoning, versatile'], ["Explorer's Pack", 1, 'Rucksack, Schlafsack, Zunderkästchen, Fackeln, Rationen, Wasserschlauch, Seil'], ['Herbalism Kit', 1, '']], gp: 9, tools: 'Herbalism Kit' },
  Fighter: { items: [['Chain Mail', 1, 'AC 16'], ['Greatsword', 1, 'slashing, heavy, two-handed'], ['Flail', 1, 'bludgeoning'], ['Javelin', 8, 'piercing, thrown 30/120 ft'], ["Dungeoneer's Pack", 1, 'Rucksack, Brecheisen, Fackeln, Seil, Rationen, Wasserschlauch']], gp: 4 },
  Monk: { items: [['Spear', 1, 'piercing, thrown 20/60 ft, versatile'], ['Dagger', 5, 'piercing, finesse, light, thrown 20/60 ft'], ['Handwerkszeug oder Musikinstrument nach Wahl', 1, ''], ["Explorer's Pack", 1, 'Rucksack, Schlafsack, Zunderkästchen, Fackeln, Rationen, Wasserschlauch, Seil']], gp: 11, tools: '1 Handwerkszeug oder Musikinstrument nach Wahl' },
  Paladin: { items: [['Chain Mail', 1, 'AC 16'], ['Shield', 1, '+2 AC'], ['Longsword', 1, 'slashing, versatile'], ['Javelin', 6, 'piercing, thrown 30/120 ft'], ['Holy Symbol', 1, 'Fokus für Zauber'], ["Priest's Pack", 1, 'Rucksack, Decke, Kerzen, Weihrauch, Rationen, Wasserschlauch']], gp: 9 },
  Ranger: { items: [['Studded Leather Armor', 1, 'AC 12 + Dex'], ['Scimitar', 1, 'slashing, finesse, light'], ['Shortsword', 1, 'piercing, finesse, light'], ['Longbow', 1, 'piercing, 150/600 ft'], ['Arrows', 20, ''], ['Quiver', 1, ''], ['Mistelzweig', 1, 'Druidic Focus'], ["Explorer's Pack", 1, 'Rucksack, Schlafsack, Zunderkästchen, Fackeln, Rationen, Wasserschlauch, Seil']], gp: 7 },
  Rogue: { items: [['Leather Armor', 1, 'AC 11 + Dex'], ['Dagger', 2, 'piercing, finesse, light, thrown 20/60 ft'], ['Shortsword', 1, 'piercing, finesse, light'], ['Shortbow', 1, 'piercing, 80/320 ft'], ['Arrows', 20, ''], ['Quiver', 1, ''], ["Thieves' Tools", 1, 'Schlösser knacken, Fallen entschärfen'], ["Burglar's Pack", 1, 'Rucksack, Kugellager, Glöckchen, Kerzen, Brecheisen, Laterne, Öl, Rationen, Seil']], gp: 8, tools: "Thieves' Tools" },
  Sorcerer: { items: [['Spear', 1, 'piercing, thrown 20/60 ft, versatile'], ['Dagger', 2, 'piercing, finesse, light, thrown 20/60 ft'], ['Kristall', 1, 'Arcane Focus'], ["Dungeoneer's Pack", 1, 'Rucksack, Brecheisen, Fackeln, Seil, Rationen, Wasserschlauch']], gp: 28 },
  Warlock: { items: [['Leather Armor', 1, 'AC 11 + Dex'], ['Sickle', 1, 'slashing, light'], ['Dagger', 2, 'piercing, finesse, light, thrown 20/60 ft'], ['Kugel', 1, 'Arcane Focus'], ['Buch über okkultes Wissen', 1, ''], ["Scholar's Pack", 1, 'Rucksack, Buch, Tinte, Feder, Pergament, Sand, Messer']], gp: 15 },
  Wizard: { items: [['Dagger', 2, 'piercing, finesse, light, thrown 20/60 ft'], ['Quarterstaff', 1, 'Arcane Focus · bludgeoning, versatile'], ['Robe', 1, ''], ['Spellbook', 1, 'dein Zauberbuch'], ["Scholar's Pack", 1, 'Rucksack, Buch, Tinte, Feder, Pergament, Sand, Messer']], gp: 5 },
};
export const kitInventory = cls => (KITS[cls]?.items || []).map(([name, qty, note]) => ({ id: newId(), name, qty, note, attuned: false }));
export const toInventory = items => items.map(([name, qty, note]) => ({ id: newId(), name, qty, note: note || '', attuned: false }));

// option B of every class: gold only (the Fighter has a second equipment package and gold as option C)
export const CLASS_GOLD = { Barbarian: 75, Bard: 90, Cleric: 110, Druid: 50, Fighter: 155, Monk: 50, Paladin: 150, Ranger: 150, Rogue: 100, Sorcerer: 50, Warlock: 100, Wizard: 55 };
const FIGHTER_B = { items: [['Studded Leather Armor', 1, 'AC 12 + Dex'], ['Scimitar', 1, 'slashing, finesse, light'], ['Shortsword', 1, 'piercing, finesse, light'], ['Longbow', 1, 'piercing, 150/600 ft'],
  ['Arrows', 20, ''], ['Quiver', 1, ''], ["Dungeoneer's Pack", 1, 'Rucksack, Brecheisen, Fackeln, Seil, Rationen, Wasserschlauch']], gp: 11 };
const unarmoredAc = cls => (cls === 'Barbarian' ? m => 10 + m.dex + m.con : cls === 'Monk' ? m => 10 + m.dex + m.wis : m => 10 + m.dex);
// ac: null = the class default from the builder data
export function loadouts(cls) {
  const a = KITS[cls]; if (!a) return [];
  const list = [{ key: 'A', title: cls === 'Fighter' ? 'Paket A: schwer, Nahkampf' : 'Paket A: Startausrüstung', sub: 'Alles dabei, sofort spielbereit.', items: a.items, gp: a.gp, ac: null, armorName: null }];
  if (cls === 'Fighter') list.push({ key: 'B', title: 'Paket B: leicht, Fernkampf', sub: 'Bogen und leichte Klingen. Passt, wenn Dexterity dein höchster Wert ist.', items: FIGHTER_B.items, gp: FIGHTER_B.gp, ac: m => 12 + m.dex, armorName: 'Studded Leather' });
  list.push({ key: 'G', title: `Nur Gold: ${CLASS_GOLD[cls]} gp`, sub: 'Du kaufst deine Ausrüstung selbst, zusammen mit dem DM. Für Leute, die genau wissen, was sie wollen.',
    items: cls === 'Wizard' ? [['Spellbook', 1, 'dein Zauberbuch']] : [], gp: CLASS_GOLD[cls], ac: unarmoredAc(cls), armorName: 'noch keine Rüstung' });
  return list;
}

// background equipment (option A) or 50 gp (option B), 2024 Player's Handbook
export const BG_KITS = {
  Acolyte: { items: [["Calligrapher's Supplies", 1], ['Book (Gebete)', 1], ['Holy Symbol', 1], ['Parchment', 10], ['Robe', 1]], gp: 8 },
  Artisan: { items: [["Artisan's Tools nach Wahl", 1], ['Pouch', 2], ["Traveler's Clothes", 1]], gp: 32 },
  Charlatan: { items: [['Forgery Kit', 1], ['Costume', 1], ['Fine Clothes', 1]], gp: 15 },
  Criminal: { items: [['Dagger', 2, 'piercing, finesse, light, thrown 20/60 ft'], ["Thieves' Tools", 1], ['Crowbar', 1], ['Pouch', 2], ["Traveler's Clothes", 1]], gp: 16 },
  Entertainer: { items: [['Musikinstrument nach Wahl', 1], ['Costume', 2], ['Mirror', 1], ['Perfume', 1], ["Traveler's Clothes", 1]], gp: 11 },
  Farmer: { items: [['Sickle', 1, 'slashing, light'], ["Carpenter's Tools", 1], ["Healer's Kit", 1], ['Iron Pot', 1], ['Shovel', 1], ["Traveler's Clothes", 1]], gp: 30 },
  Guard: { items: [['Spear', 1, 'piercing, thrown 20/60 ft, versatile'], ['Light Crossbow', 1, 'piercing, 80/320 ft, loading'], ['Bolts', 20], ['Spielset nach Wahl', 1], ['Hooded Lantern', 1], ['Manacles', 1], ['Quiver', 1], ["Traveler's Clothes", 1]], gp: 12 },
  Guide: { items: [['Shortbow', 1, 'piercing, 80/320 ft'], ['Arrows', 20], ["Cartographer's Tools", 1], ['Bedroll', 1], ['Quiver', 1], ['Tent', 1], ["Traveler's Clothes", 1]], gp: 3 },
  Hermit: { items: [['Quarterstaff', 1, 'bludgeoning, versatile'], ['Herbalism Kit', 1], ['Bedroll', 1], ['Book (Philosophie)', 1], ['Lamp', 1], ['Oil', 3], ["Traveler's Clothes", 1]], gp: 16 },
  Merchant: { items: [["Navigator's Tools", 1], ['Pouch', 2], ["Traveler's Clothes", 1]], gp: 22 },
  Noble: { items: [['Spielset nach Wahl', 1], ['Fine Clothes', 1], ['Perfume', 1]], gp: 29 },
  Sage: { items: [['Quarterstaff', 1, 'bludgeoning, versatile'], ["Calligrapher's Supplies", 1], ['Book (Geschichte)', 1], ['Parchment', 8], ['Robe', 1]], gp: 8 },
  Sailor: { items: [['Dagger', 1, 'piercing, finesse, light, thrown 20/60 ft'], ["Navigator's Tools", 1], ['Rope', 1], ["Traveler's Clothes", 1]], gp: 20 },
  Scribe: { items: [["Calligrapher's Supplies", 1], ['Fine Clothes', 1], ['Lamp', 1], ['Oil', 3], ['Parchment', 12]], gp: 23 },
  Soldier: { items: [['Spear', 1, 'piercing, thrown 20/60 ft, versatile'], ['Shortbow', 1, 'piercing, 80/320 ft'], ['Arrows', 20], ['Spielset nach Wahl', 1], ["Healer's Kit", 1], ['Quiver', 1], ["Traveler's Clothes", 1]], gp: 14 },
  Wayfarer: { items: [['Dagger', 2, 'piercing, finesse, light, thrown 20/60 ft'], ["Thieves' Tools", 1], ['Spielset nach Wahl', 1], ['Bedroll', 1], ['Pouch', 2], ["Traveler's Clothes", 1]], gp: 16 },
};
const listItems = items => items.map(([n, q]) => (q > 1 ? `${q}× ${n}` : n)).join(', ');

// merge two item lists: same name adds up the quantity (Arrows + Arrows = 40)
export function mergeItems(...lists) {
  const out = [];
  for (const [n, q, note] of lists.flat()) { const o = out.find(x => x[0] === n); if (o) o[1] += q; else out.push([n, q, note || '']); }
  return out;
}

export function LoadoutPicker({ cls, bg, gear, set, IT = n => n }) {
  const opts = loadouts(cls), bk = BG_KITS[bg];
  return html`<div class="extras">
    <section><${Decide} icon="🎒" title="Ausrüstung deiner Klasse" count=${gear.cls ? '1 / 1' : '0 / 1'} does="Was du am ersten Tag dabeihast: Rüstung, Waffen, Rucksack und etwas Gold."
        tip="Nimm Paket A. Dann musst du nichts einkaufen und kannst sofort losspielen."/>
      <div class="choice-grid one">${opts.map(o => html`<button type="button" class=${'choice' + (gear.cls === o.key ? ' on' : '')} aria-pressed=${gear.cls === o.key} onClick=${() => set({ ...gear, cls: o.key })}>
        <span class="ch-emo emo" aria-hidden="true">${o.key === 'G' ? '💰' : '🎒'}</span><span class="ch-body"><span class="ch-title">${o.title}${o.key === 'A' && html` <span class="ch-tag rec">Empfohlen</span>`}</span>
        <span class="ch-desc">${o.sub}</span>${o.items.length > 0 && html`<span class="ch-role">${listItems(o.items.map(([n, q]) => [IT(n), q]))}${o.key !== 'G' ? ` · ${o.gp} gp` : ''}</span>`}</span></button>`)}</div></section>
    ${bk && html`<section><${Decide} icon="📦" title="Ausrüstung deines Backgrounds" count=${gear.bg ? '1 / 1' : '0 / 1'} does=${`Dazu kommt noch ein kleines Paket aus deinem Leben als ${bg}.`} tip="Das Paket ist praktisch, die 50 gp sind flexibler. Beides ist gleich viel wert."/>
      <div class="choice-grid one">${[['A', `Paket von ${bg}`, `${listItems(bk.items.map(([n, q]) => [IT(n), q]))} · ${bk.gp} gp`], ['G', 'Stattdessen 50 gp', 'Mehr Gold zum Einkaufen, dafür keine Gegenstände.']].map(([k, t, d]) => html`<button type="button" class=${'choice' + (gear.bg === k ? ' on' : '')} aria-pressed=${gear.bg === k} onClick=${() => set({ ...gear, bg: k })}>
        <span class="ch-emo emo" aria-hidden="true">${k === 'G' ? '💰' : '📦'}</span><span class="ch-body"><span class="ch-title">${t}${k === 'A' && html` <span class="ch-tag rec">Empfohlen</span>`}</span><span class="ch-role">${d}</span></span></button>`)}</div></section>`}
  </div>`;
}

// what the gear choice adds up to: item list, gold, armor (ac null = class default) and the names of weapons
export function gearResult(cls, bg, gear) {
  const o = loadouts(cls).find(x => x.key === gear.cls) || loadouts(cls)[0], bk = BG_KITS[bg];
  const items = mergeItems(o ? o.items : [], gear.bg === 'A' && bk ? bk.items : []);
  const gp = (o?.gp || 0) + (bk ? (gear.bg === 'A' ? bk.gp : gear.bg === 'G' ? 50 : 0) : 0);
  return { items, gp, ac: o?.ac || null, armorName: o?.armorName || null, weapons: items.map(i => i[0]) };
}

// Magic Initiate lists (2024): a beginner-friendly selection, long enough that a Cleric with Acolyte or a Wizard with Sage still has choices
const S = (name, note) => ({ name, note });
export const MI_LISTS = {
  Cleric: [[S('Guidance', '+1d4 auf einen Ability Check eines Verbündeten'), S('Sacred Flame', 'Heiliges Feuer von oben, Dexterity Save'), S('Light', 'Lässt einen Gegenstand hell leuchten'),
      S('Thaumaturgy', 'Kleine göttliche Wunder: Donnerstimme, flackernde Flammen'), S('Spare the Dying', 'Stabilisiert einen Sterbenden auf Entfernung'), S('Toll the Dead', 'Totenglocke: Necrotic Schaden, Wisdom Save'),
      S('Resistance', 'Ein Verbündeter nimmt 1d4 weniger Schaden einer gewählten Art'), S('Mending', 'Repariert einen kleinen Riss oder Bruch')],
    [S('Cure Wounds', 'Heilt per Berührung'), S('Healing Word', 'Heilt auf Entfernung, als Bonus Action'), S('Bless', 'Bis zu drei Verbündete: +1d4 auf Angriffe und Saves'), S('Guiding Bolt', 'Lichtblitz: Schaden, nächster Angriff mit Advantage'),
      S('Sanctuary', 'Gegner müssen einen Save schaffen, um das Ziel anzugreifen'), S('Shield of Faith', '+2 AC für ein Ziel, Concentration'), S('Command', 'Ein Wort als Befehl: Flieh! Fall! Halt!'), S('Detect Magic', 'Spürt Magie in der Nähe auf')]],
  Druid: [[S('Guidance', '+1d4 auf einen Ability Check eines Verbündeten'), S('Produce Flame', 'Flamme in der Hand: Licht oder Feuerwurf'), S('Druidcraft', 'Kleine Naturtricks: Wetter vorhersagen, Blüten öffnen'),
      S('Shillelagh', 'Dein Stab wird magisch und trifft härter'), S('Thorn Whip', 'Dornenpeitsche zieht ein Ziel 10 ft heran'), S('Starry Wisp', 'Sternenlicht-Geschoss, macht Unsichtbare sichtbar'),
      S('Resistance', 'Ein Verbündeter nimmt 1d4 weniger Schaden einer gewählten Art'), S('Message', 'Flüstert einer Person auf Entfernung eine Nachricht zu'), S('Mending', 'Repariert einen kleinen Riss oder Bruch')],
    [S('Healing Word', 'Heilt auf Entfernung, als Bonus Action'), S('Cure Wounds', 'Heilt per Berührung'), S('Goodberry', 'Zehn magische Beeren, die je 1 HP heilen'), S('Entangle', 'Ranken halten Gegner in einem Bereich fest'),
      S('Faerie Fire', 'Leuchtende Umrisse: Angriffe gegen die Ziele mit Advantage'), S('Speak with Animals', 'Mit Tieren sprechen, 10 Minuten lang'), S('Fog Cloud', 'Dichte Nebelkugel, perfekt zum Verstecken'), S('Thunderwave', 'Donnerwelle, stößt Gegner weg')]],
  Wizard: [[S('Fire Bolt', 'Feuergeschoss auf große Entfernung'), S('Mage Hand', 'Schwebende Geisterhand trägt kleine Dinge'), S('Light', 'Lässt einen Gegenstand hell leuchten'), S('Minor Illusion', 'Ein Geräusch oder kleines Trugbild erschaffen'),
      S('Prestidigitation', 'Kleine Zaubertricks: säubern, wärmen, Funken'), S('Ray of Frost', 'Kältestrahl, verlangsamt das Ziel um 10 ft'), S('Message', 'Flüstert einer Person auf Entfernung eine Nachricht zu'),
      S('Shocking Grasp', 'Blitz per Berührung, Ziel verliert seine Reaction'), S('Mending', 'Repariert einen kleinen Riss oder Bruch')],
    [S('Magic Missile', 'Drei Geschosse, die immer treffen'), S('Shield', 'Reaction: +5 Armor Class bis zu deinem nächsten Zug'), S('Sleep', 'Lässt Gegner einschlafen'), S('Mage Armor', 'Magische Rüstung: AC 13 + Dex für 8 Stunden'),
      S('Find Familiar', 'Ein kleiner Geistergefährte, der für dich späht'), S('Feather Fall', 'Reaction: bis zu fünf Fallende sinken sanft'), S('Disguise Self', 'Du siehst 1 Stunde lang aus wie jemand anderes'), S('Burning Hands', 'Flammenkegel vor dir')]],
};
const MI_ATTACKS = { ...SPELL_ATTACKS, 'Ray of Frost': ['1d8', 'cold, 60 ft'], 'Starry Wisp': ['1d8', 'radiant, 60 ft'], 'Thorn Whip': ['1d6', 'piercing, 30 ft, zieht 10 ft heran'] };

// what this class + background still asks for
export function extrasFor(cls, bg) {
  const b = BACKGROUNDS[bg] || {};
  return { expertise: cls === 'Rogue' ? 2 : 0, mi: b.feat === 'Magic Initiate' ? b.featNote : null, skilled: b.feat === 'Skilled' ? 3 : 0 };
}
export const emptyExtras = () => ({ exp: [], skilled: [], mi: { c: [], s: '', ab: '' } });
export function extrasOk(need, x) {
  return (!need.expertise || x.exp.length === need.expertise) && (!need.skilled || x.skilled.length === need.skilled)
    && (!need.mi || (x.mi.c.length === 2 && !!x.mi.s && !!x.mi.ab));
}
export const extrasHint = need => [need.expertise && `${need.expertise} Skills für Expertise`, need.skilled && `${need.skilled} Skills für Skilled`, need.mi && `2 Cantrips, 1 Zauber und das Zauberattribut für Magic Initiate`].filter(Boolean).join(', ');

// turn the picks into sheet data. sheet: the sheet so far (skills, spells, attacks, resources, spellAbility)
export function applyExtras(sheet, { cls, bg, scores, x }) {
  const need = extrasFor(cls, bg), pb = 2, out = { skills: { ...(sheet.skills || {}) } };
  for (const k of x.skilled) out.skills[k] = Math.max(1, out.skills[k] || 0);
  for (const k of x.exp) out.skills[k] = 2;
  if (need.mi) {
    const list = MI_LISTS[need.mi] || [[], []], all = [...list[0], ...list[1]], note = n => all.find(s => s.name === n)?.note || '';
    const ab = x.mi.ab, m = mod(scores[ab]), tag = `Magic Initiate (${need.mi}) · ${ABILITIES.find(a => a.key === ab)?.short || ''}`;
    const have = new Set((sheet.spells || []).map(s => s.name));
    out.spells = [...(sheet.spells || []),
      ...x.mi.c.filter(n => !have.has(n)).map(n => ({ id: newId(), name: n, level: 0, prepared: true, note: `${note(n)} · ${tag}` })),
      ...(x.mi.s && !have.has(x.mi.s) ? [{ id: newId(), name: x.mi.s, level: 1, prepared: true, note: `${note(x.mi.s)} · ${tag} · 1× pro Long Rest ohne Slot` }] : [])];
    out.attacks = [...(sheet.attacks || []), ...x.mi.c.filter(n => MI_ATTACKS[n] && !(sheet.attacks || []).some(a => a.name === n))
      .map(n => ({ id: newId(), name: n, bonus: pb + m, damage: MI_ATTACKS[n][0], note: `${MI_ATTACKS[n][1]} · Cantrip · Magic Initiate` }))];
    if (x.mi.s) out.resources = [...(sheet.resources || []), { id: newId(), name: `${x.mi.s} (Magic Initiate)`, max: 1, used: 0, reset: 'long' }];
    if (!CLASSES[cls]?.spell && !sheet.spellAbility) out.spellAbility = ab; // classes without own spellcasting use the feat's ability
  }
  return out;
}

/* ---------- the picker (builder step and "Nachholen") ---------- */
export function ExtrasPicker({ cls, bg, scores, profSkills, classSpells = [], x, set, SP = n => n }) {
  const need = extrasFor(cls, bg);
  const toggle = (field, k, max) => { const cur = x[field]; if (cur.includes(k)) return set({ ...x, [field]: cur.filter(y => y !== k) }); if (cur.length >= max) return toast(`Höchstens ${max}. Nimm zuerst eins raus.`); set({ ...x, [field]: [...cur, k] }); };
  const mi = need.mi && (MI_LISTS[need.mi] || [[], []]);
  const miBest = ['int', 'wis', 'cha'].sort((a, b) => (scores[b] || 0) - (scores[a] || 0))[0];
  const setMi = patch => set({ ...x, mi: { ...x.mi, ...patch } });
  const prof = [...new Set([...profSkills, ...x.skilled])];
  return html`<div class="extras">
    ${need.skilled > 0 && html`<section><${Decide} icon="🎓" title="Skilled (Origin Feat)" count=${`${x.skilled.length} / ${need.skilled}`} does=${`Dein Background ${bg} macht dich in drei weiteren Skills geübt, frei aus allen 18. Dort bekommst du +2 auf den Wurf.`} tip="Perception und Insight braucht man in fast jeder Sitzung."/>
      <div class="sk-list">${SKILLS.filter(s => !profSkills.includes(s.key)).map(s => { const on = x.skilled.includes(s.key);
        return html`<div class=${'sk-row' + (on ? ' on' : '')}><label><input type="checkbox" checked=${on} onChange=${() => toggle('skilled', s.key, need.skilled)}/><span><b>${s.name}</b> <span class="ab-tag">${s.ab.toUpperCase()}</span><small>${SKILL_DESC[s.key]}</small></span></label></div>`; })}</div></section>`}
    ${need.expertise > 0 && html`<section><${Decide} icon="⭐" title="Expertise (Rogue)" count=${`${x.exp.length} / ${need.expertise}`} does="Zwei deiner geübten Skills werden zu deiner Spezialität: Dort bekommst du +4 statt +2." tip="Stealth (Schleichen) und Perception (Bemerken) nutzt ein Rogue am häufigsten."/>
      <div class="sk-list">${SKILLS.filter(s => prof.includes(s.key)).map(s => { const on = x.exp.includes(s.key), r = ['stealth', 'perception'].includes(s.key);
        return html`<div class=${'sk-row' + (on ? ' on' : r ? ' rec' : '')}><label><input type="checkbox" checked=${on} onChange=${() => toggle('exp', s.key, need.expertise)}/><span><b>${s.name}</b> <span class="ab-tag">${s.ab.toUpperCase()}</span>${r && html` <span class="ch-tag rec">Empfohlen</span>`}<small>${SKILL_DESC[s.key]}</small></span></label></div>`; })}</div></section>`}
    ${mi && html`<section><${Decide} icon="✨" title=${`Magic Initiate (${need.mi}) · Origin Feat`} count=${`${x.mi.c.length + (x.mi.s ? 1 : 0) + (x.mi.ab ? 1 : 0)} / 4`} does=${`Dein Background ${bg} schenkt dir etwas Magie, egal welche Klasse du spielst: 2 Cantrips (so oft du willst) und 1 Zauber, den du 1× pro Long Rest gratis wirkst.`} tip="Wähle als Zauberattribut dein höchstes von Intelligence, Wisdom und Charisma (★). Guidance und ein Heilzauber helfen jeder Gruppe."/>
      <span class="label">Zauberattribut</span>
      <div class="seg small">${['int', 'wis', 'cha'].map(k => html`<button type="button" aria-pressed=${x.mi.ab === k} onClick=${() => setMi({ ab: k })}>${ABILITIES.find(a => a.key === k).name} ${sgn(mod(scores[k] || 10))}${k === miBest ? ' ★' : ''}</button>`)}</div>
      <h4 class="wiz-h small">Cantrips <span class="muted">${x.mi.c.length} / 2</span></h4>
      <div class="sk-list">${mi[0].filter(s => !classSpells.includes(s.name)).map(s => { const on = x.mi.c.includes(s.name);
        return html`<div class=${'sk-row' + (on ? ' on' : '')}><label><input type="checkbox" checked=${on} onChange=${() => { const c = x.mi.c; if (on) setMi({ c: c.filter(y => y !== s.name) }); else if (c.length >= 2) toast('Höchstens 2. Nimm zuerst einen raus.'); else setMi({ c: [...c, s.name] }); }}/><span><b>${SP(s.name)}</b><small>${s.note}</small></span></label></div>`; })}</div>
      <h4 class="wiz-h small">Zauber der 1. Stufe <span class="muted">${x.mi.s ? 1 : 0} / 1</span></h4>
      <div class="sk-list">${mi[1].filter(s => !classSpells.includes(s.name)).map(s => { const on = x.mi.s === s.name;
        return html`<div class=${'sk-row' + (on ? ' on' : '')}><label><input type="radio" name="mi-spell" checked=${on} onChange=${() => setMi({ s: s.name })}/><span><b>${SP(s.name)}</b><small>${s.note}</small></span></label></div>`; })}</div></section>`}
  </div>`;
}

/* ---------- for characters made before: pick what is missing ---------- */
export function missingStart(c, s) {
  const need = extrasFor(c.cls, s.background), done = s.startDone || {};
  const vals = Object.values(s.skills || {});
  return {
    expertise: need.expertise && !done.extras && !vals.includes(2) ? need.expertise : 0,
    mi: need.mi && !done.extras && !(s.spells || []).some(x => /Magic Initiate/.test(x.note || '')) ? need.mi : null,
    skilled: need.skilled && !done.extras && vals.filter(Boolean).length < CLASSES_SKILLS(c.cls) + 2 + need.skilled ? need.skilled : 0,
    kit: !done.kit && KITS[c.cls] && !(s.inventory || []).some(i => /Pack$/.test(i.name)),
    perks: !done.perks && !!(CHOICES[c.cls] || MASTERY_N[c.cls]) && !/Weapon Mastery:|Fighting Style:|Divine Order:|Primal Order:|Eldritch Invocation:/.test(s.features || ''),
  };
}
const CLASSES_SKILLS = cls => ({ Bard: 3, Ranger: 3, Rogue: 4 })[cls] || 2;

export function CatchUp({ c, s, cid, chId, canEdit }) {
  const miss = missingStart(c, s); const [open, setOpen] = useState(false);
  const any = miss.expertise || miss.mi || miss.skilled || miss.kit || miss.perks;
  if (!any || !s.background) return null;
  const what = [miss.expertise && 'Expertise', miss.mi && `Magic Initiate (${miss.mi})`, miss.skilled && 'Skilled', miss.perks && 'Klassen-Fähigkeiten', miss.kit && 'Startausrüstung'].filter(Boolean).join(', ');
  return html`<div class="catchup panel"><div><b>🧩 Beim Erstellen fehlte noch:</b> ${what}</div>
    ${canEdit ? html`<button class="btn small primary" onClick=${() => setOpen(true)}>Jetzt nachholen</button>` : html`<span class="muted small-note">Dein DM kann das für dich nachtragen.</span>`}
    ${open && html`<${CatchUpModal} c=${c} s=${s} cid=${cid} chId=${chId} miss=${miss} onClose=${() => setOpen(false)}/>`}</div>`;
}

function CatchUpModal({ c, s, cid, chId, miss, onClose }) {
  const [x, setX] = useState(emptyExtras()); const [kit, setKit] = useState(!!miss.kit); const [busy, setBusy] = useState(false); const [pk, setPk] = useState(emptyPerks());
  const wNames = [...(s.inventory || []).map(i => i.name), ...(kit && miss.kit ? KITS[c.cls].items.map(i => i[0]) : [])], mOpts = masteryOptions(c.cls, wNames);
  const need = { expertise: miss.expertise, mi: miss.mi, skilled: miss.skilled };
  const prof = Object.entries(s.skills || {}).filter(([, v]) => v).map(([k]) => k);
  const save = async () => {
    if ((need.expertise || need.mi || need.skilled) && !extrasOk(need, x)) return toast('Bitte wähle noch: ' + extrasHint(need));
    if (miss.perks && !perksOk(c.cls, pk, mOpts)) return toast('Bitte wähle noch: ' + perksHint(c.cls, pk, mOpts));
    setBusy(true);
    try {
      const patch = need.expertise || need.mi || need.skilled ? applyExtras(s, { cls: c.cls, bg: s.background, scores: s.abilities || {}, x }) : {};
      if (kit && miss.kit) { const k = KITS[c.cls]; const have = new Set((s.inventory || []).map(i => i.name));
        patch.inventory = [...(s.inventory || []), ...kitInventory(c.cls).filter(i => !have.has(i.name))];
        patch.coins = { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0, ...(s.coins || {}), gp: ((s.coins || {}).gp || 0) + k.gp };
        if (k.tools && !(s.languages || '').includes(k.tools)) patch.languages = `${s.languages || ''}${s.languages ? ' · ' : ''}Klasse: ${k.tools}`; }
      if (miss.perks) Object.assign(patch, applyPerksToSheet({ ...s, ...patch }, c.cls, pk));
      patch.startDone = { ...(s.startDone || {}), extras: true, kit: true, perks: true };
      await store.merge(`campaigns/${cid}/characters/${chId}/sheet/main`, { ...patch, updatedAt: Date.now() });
      toast('Nachgetragen.'); onClose(); } catch (e) { failed(e); } finally { setBusy(false); } };
  return html`<${Modal} title=${'Nachholen: ' + c.name} eyebrow="Fehlende Auswahl" wide onClose=${onClose}>
    <div class="form">${(need.expertise || need.mi || need.skilled) ? html`<${ExtrasPicker} cls=${c.cls} bg=${s.background} scores=${s.abilities || {}} profSkills=${prof} classSpells=${(s.spells || []).map(x => x.name)} x=${x} set=${setX}/>` : ''}
      ${miss.perks && html`<${PerksPicker} cls=${c.cls} p=${pk} set=${setPk} weaponNames=${wNames}/>`}
      ${miss.kit && html`<label class="checkline"><input type="checkbox" checked=${kit} onChange=${e => setKit(e.target.checked)}/><span><b>Startausrüstung ${c.cls} dazulegen:</b> ${KITS[c.cls].items.map(([n, q]) => (q > 1 ? `${q}× ${n}` : n)).join(', ')} und ${KITS[c.cls].gp} gp</span></label>`}
      <div class="foot"><button class="btn primary" disabled=${busy} onClick=${save}>Speichern</button><button class="btn" onClick=${onClose}>Abbrechen</button></div></div></${Modal}>`;
}

// for an existing sheet: write the chosen class options into features, attack notes and AC
const addDmg = (d, n) => { const m = /([+-]\d+)$/.exec(d); return m ? d.slice(0, m.index) + sgn(+m[1] + n).replace('−', '-') : `${d}+${n}`; };
export function applyPerksToSheet(s, cls, p) {
  const dex = mod((s.abilities || {}).dex || 10);
  const attacks = (s.attacks || []).map(a => { const w = WEAPONS[a.name]; if (!w) return a; let b = { ...a };
    if (p.style === 'Archery' && w.r) b.bonus = (b.bonus || 0) + 2;
    if (p.style === 'Dueling' && !w.r && !w.two) b.damage = addDmg(b.damage || w.die, 2);
    if (p.mastery.includes(a.name) && !/Mastery/.test(b.note || '')) b.note = `${b.note || w.note} · Mastery ${w.m}: ${MASTERY[w.m]}`;
    return b; });
  let ac = s.ac || 10; const armored = (s.inventory || []).some(i => /Armor|Mail|Shirt/.test(i.name));
  if (p.style === 'Defense' && armored) ac += 1;
  if (p.inv === 'Armor of Shadows') ac = Math.max(ac, 13 + dex);
  const lines = perkLines(cls, p); if ((cls === 'Cleric' && p.order === 'Thaumaturge') || (cls === 'Druid' && p.order === 'Magician')) lines.push('Zusätzlicher Cantrip aus Divine/Primal Order: im Bogen unter Zauber eintragen');
  return { attacks, ac, features: [s.features || '', ...lines].filter(Boolean).join('\n') };
}
