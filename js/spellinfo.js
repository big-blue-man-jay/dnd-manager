// Tap a spell, weapon or class feature: what it costs, how far it reaches, what to roll and what happens (D&D 2024).
// German explanations in plain words. Numbers (DC, attack bonus, modifier) come from the character.
import { html, Modal } from './ui.js';
import { PERKS, WEAPONS, MASTERY } from './classperks.js';

// t: time (A = Action, B = Bonus Action, R = Reaction, M = 1 minute or longer), r: range, d: duration,
// c: concentration, roll: 'atk' | save ability | 'heal' | '' , dmg: dice, x: what happens
const S = (t, r, d, roll, dmg, x, c = false) => ({ t, r, d, roll, dmg, x, c });
export const SPELL_INFO = {
  // cantrips
  'Eldritch Blast': S('A', '120 ft', 'sofort', 'atk', '1d10 Force', 'Ein Strahl knisternder Energie. Dein Standard-Angriff als Warlock.'),
  'Fire Bolt': S('A', '120 ft', 'sofort', 'atk', '1d10 Fire', 'Ein Feuergeschoss. Brennbare Dinge, die niemand trägt, fangen Feuer.'),
  'Ray of Frost': S('A', '60 ft', 'sofort', 'atk', '1d8 Cold', 'Kältestrahl. Getroffen: Das Ziel ist bis zu deinem nächsten Zug 10 ft langsamer.'),
  'Produce Flame': S('B', 'selbst, Wurf 60 ft', '10 Minuten', 'atk', '1d8 Fire', 'Eine Flamme in deiner Hand gibt Licht (20 ft). Mit einer Action wirfst du sie auf ein Ziel.'),
  'Shocking Grasp': S('A', 'Berührung', 'sofort', 'atk', '1d8 Lightning', 'Blitz per Berührung. Getroffen: Das Ziel kann bis zu seinem nächsten Zug keine Opportunity Attacks machen. Gut zum Weglaufen.'),
  'Thorn Whip': S('A', '30 ft', 'sofort', 'atk', '1d6 Piercing', 'Dornenpeitsche. Getroffen: Du ziehst das Ziel bis zu 10 ft zu dir.'),
  'Starry Wisp': S('A', '60 ft', 'sofort', 'atk', '1d8 Radiant', 'Sternenlicht-Geschoss. Getroffen: Das Ziel leuchtet und kann nicht unsichtbar sein.'),
  'Sacred Flame': S('A', '60 ft', 'sofort', 'dex', '1d8 Radiant', 'Heiliges Feuer fällt auf das Ziel. Deckung hilft ihm nicht.'),
  'Toll the Dead': S('A', '60 ft', 'sofort', 'wis', '1d8 Necrotic (1d12, wenn verletzt)', 'Eine Totenglocke läutet. Fehlen dem Ziel schon HP, ist der Schaden höher.'),
  'Vicious Mockery': S('A', '60 ft', 'sofort', 'wis', '1d6 Psychic', 'Eine magische Beleidigung. Gescheitert: Schaden und Disadvantage auf seinen nächsten Angriff.'),
  Guidance: S('A', 'Berührung', '1 Minute', '', '', 'Wähle einen Skill. Ein Verbündeter darf einmal 1d4 auf einen Wurf mit diesem Skill addieren.', true),
  Resistance: S('A', 'Berührung', '1 Minute', '', '', 'Wähle eine Schadensart. Nimmt der Verbündete solchen Schaden, zieht er einmal pro Zug 1d4 ab.', true),
  Light: S('A', 'Berührung', '1 Stunde', '', '', 'Ein Gegenstand leuchtet wie eine Fackel: 20 ft hell, weitere 20 ft dämmrig.'),
  'Mage Hand': S('A', '30 ft', '1 Minute', '', '', 'Eine Geisterhand hebt bis zu 10 lb, öffnet Türen oder holt Dinge. Sie kann nicht angreifen.'),
  'Minor Illusion': S('A', '30 ft', '1 Minute', '', '', 'Ein Geräusch oder ein kleines Trugbild (bis 5 ft). Wer es untersucht, kann es durchschauen.'),
  Prestidigitation: S('A', '10 ft', 'bis zu 1 Stunde', '', '', 'Kleine Zaubertricks: säubern, wärmen, Funken, Geschmack ändern, ein kleines Zeichen.'),
  Thaumaturgy: S('A', '30 ft', 'bis zu 1 Minute', '', '', 'Kleine Wunder: donnernde Stimme, flackernde Flammen, Türen fliegen auf, Boden bebt leicht.'),
  Druidcraft: S('A', '30 ft', 'sofort', '', '', 'Kleine Naturtricks: Wetter vorhersagen, eine Blüte öffnen, ein Geruch, ein Funke.'),
  Shillelagh: S('B', 'selbst', '1 Minute', '', '1d8', 'Dein Stab oder deine Keule wird magisch: Treffer mit deinem Zauber-Attribut, Schaden 1d8.'),
  'Spare the Dying': S('A', '15 ft', 'sofort', '', '', 'Ein Verbündeter mit 0 HP ist sofort stabil und muss keine Death Saves mehr würfeln.'),
  Message: S('A', '120 ft', 'sofort', '', '', 'Du flüsterst jemandem eine Nachricht zu, nur er hört sie und kann flüsternd antworten.'),
  Mending: S('M', 'Berührung', 'sofort', '', '', 'Repariert einen Riss oder Bruch, z. B. eine Kette oder einen Schlüssel. Dauert 1 Minute.'),
  // level 1
  'Healing Word': S('B', '60 ft', 'sofort', 'heal', '2d4 + Modifier', 'Heilt einen Verbündeten auf Entfernung. Perfekt, um jemanden mit 0 HP wieder aufzurichten.'),
  'Cure Wounds': S('A', 'Berührung', 'sofort', 'heal', '2d8 + Modifier', 'Heilt per Berührung. Mehr als Healing Word, aber du musst daneben stehen.'),
  Bless: S('A', '30 ft', '1 Minute', '', '', 'Bis zu drei Verbündete würfeln 1d4 extra auf Angriffe und Saving Throws.', true),
  'Guiding Bolt': S('A', '120 ft', '1 Runde', 'atk', '4d6 Radiant', 'Lichtblitz mit viel Schaden. Der nächste Angriff gegen das Ziel hat Advantage.'),
  'Shield of Faith': S('B', '60 ft', '10 Minuten', '', '', 'Ein Verbündeter bekommt +2 AC.', true),
  Sanctuary: S('B', '30 ft', '1 Minute', '', '', 'Wer das Ziel angreifen will, muss erst einen Wisdom Save schaffen. Endet, wenn das Ziel selbst angreift.'),
  Command: S('A', '60 ft', 'sofort', 'wis', '', 'Ein Befehl in einem Wort: Komm! Lass fallen! Flieh! Hinlegen! Halt! Gescheitert: Das Ziel gehorcht in seinem nächsten Zug.'),
  'Dissonant Whispers': S('A', '60 ft', 'sofort', 'wis', '3d6 Psychic', 'Gescheitert: Schaden, und das Ziel rennt mit seiner Reaction so weit wie möglich von dir weg. Geschafft: halber Schaden.'),
  'Charm Person': S('A', '30 ft', '1 Stunde', 'wis', '', 'Ein Humanoider hält dich für einen Freund. Kämpft ihr gerade gegen ihn, hat er Advantage auf den Save.'),
  'Faerie Fire': S('A', '60 ft, Würfel 20 ft', '1 Minute', 'dex', '', 'Gegner im Bereich leuchten. Angriffe gegen sie haben Advantage, unsichtbar sein geht nicht.', true),
  Thunderwave: S('A', 'selbst, Würfel 15 ft', 'sofort', 'con', '2d8 Thunder', 'Donnerwelle um dich herum. Gescheitert: Schaden und 10 ft weggestoßen. Geschafft: halber Schaden. Man hört es weit.'),
  Entangle: S('A', '90 ft, Quadrat 20 ft', '1 Minute', 'str', '', 'Ranken wachsen. Gescheitert: Das Ziel ist Restrained (festgehalten). Mit einer Action kann es sich losreißen.', true),
  Goodberry: S('A', 'selbst', '24 Stunden', '', '', 'Zehn Beeren. Jede heilt 1 HP und ersetzt eine Mahlzeit. Essen kostet eine Bonus Action.'),
  'Speak with Animals': S('A', 'selbst', '10 Minuten', '', '', 'Du kannst mit Tieren sprechen. Sie wissen, was in der Gegend los war. Als Ritual ohne Slot.'),
  'Fog Cloud': S('A', '120 ft', '1 Stunde', '', '', 'Eine Nebelkugel mit 20 ft Radius. Darin sieht niemand etwas. Gut zum Fliehen oder Verstecken.', true),
  'Magic Missile': S('A', '120 ft', 'sofort', '', '3 × 1d4+1 Force', 'Drei Geschosse treffen immer, kein Wurf nötig. Du kannst sie auf verschiedene Ziele verteilen.'),
  Shield: S('R', 'selbst', 'bis zu deinem Zug', '', '', 'Wenn du getroffen wirst: +5 AC bis zu deinem nächsten Zug, auch gegen den Angriff, der dich gerade trifft.'),
  'Burning Hands': S('A', 'selbst, Kegel 15 ft', 'sofort', 'dex', '3d6 Fire', 'Flammenkegel vor dir. Geschafft: halber Schaden.'),
  Sleep: S('A', '60 ft, Radius 5 ft', '1 Minute', 'wis', '', 'Gescheitert: Die Ziele sind Incapacitated. Scheitern sie am Ende ihres nächsten Zugs nochmal, schlafen sie ein. Schaden weckt sie.', true),
  'Mage Armor': S('A', 'Berührung', '8 Stunden', '', '', 'Ohne Rüstung ist die AC 13 + Dexterity. Am Morgen wirken, dann hält es den ganzen Tag.'),
  'Detect Magic': S('A', 'selbst, 30 ft', '10 Minuten', '', '', 'Du spürst Magie in der Nähe und siehst, welche Gegenstände magisch sind. Als Ritual ohne Slot.', true),
  'Find Familiar': S('M', '10 ft', 'dauerhaft', '', '', 'Ein Geist in Tiergestalt (Katze, Eule, Rabe …) wird dein Gefährte. Er späht für dich und hilft beim Angreifen. Ritual, 1 Stunde.'),
  'Feather Fall': S('R', '60 ft', '1 Minute', '', '', 'Wenn jemand fällt: bis zu fünf Wesen sinken sanft und nehmen keinen Fallschaden.'),
  'Disguise Self': S('A', 'selbst', '1 Stunde', '', '', 'Du siehst aus wie jemand anderes, inklusive Kleidung. Wer dich untersucht, kann es durchschauen.'),
  Hex: S('B', '90 ft', '1 Stunde', '', '+1d6 Necrotic pro Treffer', 'Verflucht ein Ziel: Jeder deiner Treffer macht 1d6 extra. Fällt es um, kannst du den Fluch weitergeben.', true),
  'Armor of Agathys': S('B', 'selbst', '1 Stunde', '', '5 Cold an Angreifer', 'Du bekommst 5 Temp HP. Solange du sie hast, nimmt jeder, der dich im Nahkampf trifft, 5 Kälteschaden.'),
  "Hunter's Mark": S('B', '90 ft', '1 Stunde', '', '+1d6 Force pro Treffer', 'Markiert ein Ziel: Jeder deiner Treffer macht 1d6 extra, und du findest es leichter.', true),
  'Divine Smite': S('B', 'selbst', 'sofort', '', '+2d8 Radiant', 'Direkt nachdem du mit einer Nahkampfwaffe triffst: 2d8 Extra-Schaden, gegen Untote und Fiends 3d8.'),
  'Ensnaring Strike': S('B', 'selbst', '1 Minute', 'str', '1d6 Piercing pro Zug', 'Nach einem Treffer wachsen Dornenranken. Gescheitert: Das Ziel ist Restrained und nimmt jeden Zug Schaden.', true),
};
const TIME = { A: 'Action', B: 'Bonus Action', R: 'Reaction', M: '1 Minute oder länger' };
const AB = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };
const base = n => (n || '').replace(/\s*\(.*\)\s*$/, '').trim();
const perkOf = name => { const n = base(name).toLowerCase(); for (const list of Object.values(PERKS)) { const p = list.find(x => x[0].toLowerCase() === n); if (p) return p; } return null; };
export const hasInfo = name => !!(SPELL_INFO[base(name)] || WEAPONS[base(name)] || perkOf(name));

// nums: { dc, atk, mod } of the character, for the "what you roll" line
export function InfoModal({ name: full, level, nums = {}, onClose }) {
  const name = base(full), sp = SPELL_INFO[name], w = WEAPONS[name], pk = !sp && !w && perkOf(name);
  const rows = [];
  if (sp) {
    rows.push(['Kostet', sp.t === 'R' ? 'Reaction (auch im Zug anderer)' : TIME[sp.t]], ['Reichweite', sp.r], ['Dauer', sp.d + (sp.c ? ' · Concentration' : '')],
      ['Slot', level === 0 ? 'Cantrip: kostet keinen Slot, so oft du willst' : 'ein Spell Slot der 1. Stufe oder höher']);
    if (sp.roll === 'atk') rows.push(['Du würfelst', `d20 ${nums.atk != null ? (nums.atk >= 0 ? '+' : '') + nums.atk : '+ Spell Attack'} gegen die AC des Ziels. Treffer: ${sp.dmg}.`]);
    else if (AB[sp.roll]) rows.push(['Ziel würfelt', `${AB[sp.roll]} Save gegen deinen DC ${nums.dc ?? ''}.${sp.dmg ? ` Schaden: ${sp.dmg}.` : ''}`]);
    else if (sp.roll === 'heal') rows.push(['Heilung', `${sp.dmg}${nums.mod != null ? ` (dein Modifier: ${nums.mod >= 0 ? '+' : ''}${nums.mod})` : ''}`]);
    else if (sp.dmg) rows.push(['Schaden', sp.dmg]);
  } else if (w) {
    rows.push(['Schaden', w.die + (w.ab === 'fin' ? ' + Strength oder Dexterity' : w.ab === 'dex' ? ' + Dexterity' : ' + Strength')], ['Eigenschaften', w.note], ['Mastery: ' + w.m, MASTERY[w.m]]);
  } else if (pk) rows.push(['Wann', pk[1]]);
  const text = sp ? sp.x : pk ? pk[2] : '';
  return html`<${Modal} title=${full} eyebrow=${sp ? (level === 0 ? 'Cantrip' : 'Zauber') : w ? 'Waffe' : 'Fähigkeit'} onClose=${onClose}>
    ${text && html`<p class="info-what">${text}</p>`}
    <dl class="info-dl">${rows.map(([k, v]) => html`<div><dt>${k}</dt><dd>${v}</dd></div>`)}</dl>
    ${sp?.c && html`<p class="muted small-note">🧠 Concentration: Du kannst nur einen solchen Zauber gleichzeitig halten. Nimmst du Schaden, würfelst du einen Constitution Save (DC 10 oder halber Schaden), sonst endet er.</p>`}
    ${!sp && !w && !pk && html`<p class="muted">Dazu gibt es noch keine Erklärung in der App. Frag deinen DM oder schau im Wiki nach.</p>`}
  </${Modal}>`;
}
