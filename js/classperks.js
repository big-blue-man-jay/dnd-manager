// Level 1 class features in gameplay words (D&D 2024), the choices a class asks for at level 1
// (Fighting Style, Weapon Mastery, Divine Order, Primal Order, Eldritch Invocation), and the weapon table
// used to build attack lines from whatever gear the character starts with.
import { html, toast } from './ui.js';
import { mod, sgn } from './rules5e.js';
import { newId } from './data.js';

// [name, when / how often, what it does]
export const PERKS = {
  Barbarian: [['Rage', 'Bonus Action · 2× pro Long Rest (1 kommt bei Short Rest zurück)', '10 Minuten lang: +2 Schaden mit Stärke-Angriffen, nur halber Schaden durch Waffen (Hieb, Stich, Wucht), Advantage auf Stärke-Würfe. Kein Zaubern in Rage.'],
    ['Unarmored Defense', 'immer', 'Ohne Rüstung ist deine AC 10 + Dexterity + Constitution. Ein Schild ist erlaubt.'],
    ['Weapon Mastery', '2 Waffen, siehe unten', 'Mit diesen Waffen nutzt du einen Spezialeffekt bei jedem Angriff.']],
  Bard: [['Bardic Inspiration', 'Bonus Action · so oft wie dein Charisma-Modifier pro Long Rest', 'Gib einem Verbündeten einen d6. Misslingt ihm ein d20-Wurf, darf er den d6 dazuzählen.'],
    ['Spellcasting', '2 Spell Slots pro Long Rest', 'Du zauberst mit Charisma.']],
  Cleric: [['Spellcasting', '2 Spell Slots pro Long Rest', 'Du zauberst mit Wisdom. Deine vorbereiteten Zauber kannst du nach jeder Long Rest tauschen.'],
    ['Divine Order', 'einmal wählen, siehe unten', 'Entscheidet, ob du eher kämpfst oder eher zauberst.']],
  Druid: [['Spellcasting', '2 Spell Slots pro Long Rest', 'Du zauberst mit Wisdom. Vorbereitete Zauber tauschst du nach jeder Long Rest.'],
    ['Druidic', 'immer', 'Geheimsprache der Druiden. Speak with Animals ist immer vorbereitet.'],
    ['Primal Order', 'einmal wählen, siehe unten', 'Entscheidet, ob du eher kämpfst oder eher zauberst.']],
  Fighter: [['Fighting Style', 'einmal wählen, siehe unten', 'Ein fester Bonus für deine Art zu kämpfen.'],
    ['Second Wind', 'Bonus Action · 2× pro Long Rest (1 kommt bei Short Rest zurück)', 'Du heilst dich selbst um 1d10 + deine Stufe.'],
    ['Weapon Mastery', '3 Waffen, siehe unten', 'Mit diesen Waffen nutzt du einen Spezialeffekt bei jedem Angriff.']],
  Monk: [['Martial Arts', 'jeder Zug', 'Nach deinem Angriff darfst du als Bonus Action noch einen Faustschlag machen. Schläge machen 1d6 Schaden und nutzen Dexterity.'],
    ['Unarmored Defense', 'immer', 'Ohne Rüstung und Schild ist deine AC 10 + Dexterity + Wisdom.']],
  Paladin: [['Lay On Hands', 'Bonus Action · Topf mit 5 HP pro Long Rest', 'Per Berührung heilst du aus dem Topf beliebig viele HP oder entfernst Poisoned (kostet 5).'],
    ['Spellcasting', '2 Spell Slots pro Long Rest', 'Du zauberst mit Charisma.'],
    ['Weapon Mastery', '2 Waffen, siehe unten', 'Mit diesen Waffen nutzt du einen Spezialeffekt bei jedem Angriff.']],
  Ranger: [['Favored Enemy', '2× pro Long Rest ohne Spell Slot', "Hunter's Mark ist immer vorbereitet: Ein markiertes Ziel bekommt bei jedem deiner Treffer +1d6 Schaden."],
    ['Spellcasting', '2 Spell Slots pro Long Rest', 'Du zauberst mit Wisdom.'],
    ['Weapon Mastery', '2 Waffen, siehe unten', 'Mit diesen Waffen nutzt du einen Spezialeffekt bei jedem Angriff.']],
  Rogue: [['Sneak Attack', '1× pro Zug', '+1d6 Schaden, wenn du Advantage hast oder ein Verbündeter direkt neben dem Ziel steht. Nur mit Finesse- oder Fernkampfwaffen.'],
    ['Expertise', '2 Skills, siehe unten', 'In zwei Skills zählt dein Proficiency Bonus doppelt.'],
    ["Thieves' Cant", 'immer', 'Geheimsprache der Diebe: versteckte Botschaften in normalen Gesprächen.'],
    ['Weapon Mastery', '2 Waffen, siehe unten', 'Mit diesen Waffen nutzt du einen Spezialeffekt bei jedem Angriff.']],
  Sorcerer: [['Innate Sorcery', 'Bonus Action · 2× pro Long Rest', '1 Minute lang: Zauber-DC +1 und Advantage auf Zauberangriffe.'],
    ['Spellcasting', '2 Spell Slots pro Long Rest', 'Du zauberst mit Charisma.']],
  Warlock: [['Pact Magic', '1 Spell Slot, kommt schon bei einer Short Rest zurück', 'Du zauberst mit Charisma. Wenige Slots, aber oft wieder voll.'],
    ['Eldritch Invocation', '1 wählen, siehe unten', 'Eine dauerhafte Spezialkraft von deinem Patron.']],
  Wizard: [['Spellcasting', '2 Spell Slots pro Long Rest', 'Du zauberst mit Intelligence aus deinem Zauberbuch und bereitest nach jeder Long Rest neu vor.'],
    ['Ritual Adept', 'immer', 'Ritual-Zauber aus deinem Buch wirkst du ohne Slot, wenn du 10 Minuten länger brauchst.'],
    ['Arcane Recovery', '1× pro Tag bei einer Short Rest', 'Hol dir einen verbrauchten Spell Slot der 1. Stufe zurück.']],
};

// choices per class: key, title, what it means in play, options [key, name, effect]
export const CHOICES = {
  Fighter: [{ key: 'style', title: 'Fighting Style', does: 'Ein fester Bonus, der immer gilt. Wähle passend zu deiner Ausrüstung.', opts: [
    ['Archery', 'Archery', '+2 auf Angriffe mit Fernkampfwaffen. Ideal mit Bogen.'],
    ['Defense', 'Defense', '+1 AC, solange du Rüstung trägst. Ideal für vorne in der Reihe.'],
    ['Great Weapon Fighting', 'Great Weapon Fighting', 'Mit Zweihandwaffen zählt jede gewürfelte 1 oder 2 beim Schaden als 3.'],
    ['Dueling', 'Dueling', '+2 Schaden mit einer Einhandwaffe, wenn die andere Hand frei ist oder einen Schild hält.'],
    ['Two-Weapon Fighting', 'Two-Weapon Fighting', 'Beim Angriff mit der zweiten leichten Waffe zählt dein Modifier auch zum Schaden.'],
    ['Protection', 'Protection', 'Reaction mit Schild: Ein Angriff gegen einen Verbündeten neben dir bekommt Disadvantage.']] }],
  Cleric: [{ key: 'order', title: 'Divine Order', does: 'Willst du lieber mitkämpfen oder mehr zaubern?', opts: [
    ['Protector', 'Protector (Kämpfer)', 'Du darfst schwere Rüstung tragen und Kriegswaffen wie Langschwert oder Streithammer benutzen.'],
    ['Thaumaturge', 'Thaumaturge (Zauberer)', 'Ein zusätzlicher Cantrip und dein Wisdom-Bonus zusätzlich auf Arcana und Religion.']] }],
  Druid: [{ key: 'order', title: 'Primal Order', does: 'Willst du lieber mitkämpfen oder mehr zaubern?', opts: [
    ['Warden', 'Warden (Kämpfer)', 'Du darfst mittlere Rüstung tragen und Kriegswaffen benutzen.'],
    ['Magician', 'Magician (Zauberer)', 'Ein zusätzlicher Cantrip und dein Wisdom-Bonus zusätzlich auf Arcana und Nature.']] }],
  Warlock: [{ key: 'inv', title: 'Eldritch Invocation', does: 'Eine dauerhafte Kraft von deinem Patron.', opts: [
    ['Armor of Shadows', 'Armor of Shadows', 'Mage Armor jederzeit ohne Slot: AC 13 + Dexterity. Besser als deine Lederrüstung.'],
    ['Pact of the Blade', 'Pact of the Blade', 'Beschwöre eine Paktwaffe und greife mit Charisma statt Stärke an.'],
    ['Pact of the Chain', 'Pact of the Chain', 'Find Familiar: ein kleiner Geistergefährte, z. B. Kobold oder Rabe, der für dich späht.'],
    ['Pact of the Tome', 'Pact of the Tome', 'Ein Buch mit drei zusätzlichen Cantrips und zwei Ritualen (mit dem DM eintragen).'],
    ['Eldritch Mind', 'Eldritch Mind', 'Advantage auf Saves, um Concentration zu halten.']] }],
};
export const MASTERY_N = { Barbarian: 2, Fighter: 3, Paladin: 2, Ranger: 2, Rogue: 2 };

export const MASTERY = {
  Cleave: 'Triffst du, darfst du einen zweiten Gegner direkt daneben angreifen (1× pro Zug).',
  Graze: 'Verfehlst du, macht der Angriff trotzdem Schaden in Höhe deines Modifiers.',
  Nick: 'Der Extra-Angriff mit einer zweiten leichten Waffe kostet keine Bonus Action.',
  Push: 'Triffst du, stößt du das Ziel 10 ft weg.',
  Sap: 'Triffst du, hat das Ziel Disadvantage auf seinen nächsten Angriff.',
  Slow: 'Triffst du, verliert das Ziel 10 ft Speed bis zu deinem nächsten Zug.',
  Topple: 'Triffst du, muss das Ziel einen Constitution Save schaffen oder fällt um (Prone).',
  Vex: 'Triffst du, hat dein nächster Angriff gegen dasselbe Ziel Advantage.',
};
// ab: 'str', 'dex' or 'fin' (the better of both); r: ranged; two: two-handed
export const WEAPONS = {
  Greataxe: { die: '1d12', ab: 'str', note: 'slashing, heavy, two-handed', m: 'Cleave', two: 1 },
  Handaxe: { die: '1d6', ab: 'str', note: 'slashing, light, thrown 20/60 ft', m: 'Vex' },
  Greatsword: { die: '2d6', ab: 'str', note: 'slashing, heavy, two-handed', m: 'Graze', two: 1 },
  Flail: { die: '1d8', ab: 'str', note: 'bludgeoning', m: 'Sap' },
  Javelin: { die: '1d6', ab: 'str', note: 'piercing, thrown 30/120 ft', m: 'Slow' },
  Longsword: { die: '1d8', ab: 'str', note: 'slashing, versatile (1d10)', m: 'Sap' },
  Mace: { die: '1d6', ab: 'str', note: 'bludgeoning', m: 'Sap' },
  Spear: { die: '1d6', ab: 'str', note: 'piercing, thrown 20/60 ft, versatile (1d8)', m: 'Sap' },
  Quarterstaff: { die: '1d6', ab: 'str', note: 'bludgeoning, versatile (1d8)', m: 'Topple' },
  Sickle: { die: '1d4', ab: 'str', note: 'slashing, light', m: 'Nick' },
  Dagger: { die: '1d4', ab: 'fin', note: 'piercing, finesse, light, thrown 20/60 ft', m: 'Nick' },
  Shortsword: { die: '1d6', ab: 'fin', note: 'piercing, finesse, light', m: 'Vex' },
  Scimitar: { die: '1d6', ab: 'fin', note: 'slashing, finesse, light', m: 'Nick' },
  Rapier: { die: '1d8', ab: 'fin', note: 'piercing, finesse', m: 'Vex' },
  Shortbow: { die: '1d6', ab: 'dex', note: 'piercing, 80/320 ft, two-handed', m: 'Vex', r: 1, two: 1 },
  Longbow: { die: '1d8', ab: 'dex', note: 'piercing, 150/600 ft, heavy, two-handed', m: 'Slow', r: 1, two: 1 },
  'Light Crossbow': { die: '1d8', ab: 'dex', note: 'piercing, 80/320 ft, loading, two-handed', m: 'Slow', r: 1, two: 1 },
};
export const emptyPerks = () => ({ style: '', order: '', inv: '', mastery: [] });
export const extraCantrips = (cls, p) => ((cls === 'Cleric' && p.order === 'Thaumaturge') || (cls === 'Druid' && p.order === 'Magician') ? 1 : 0);

// weapons a character could master: the ones in the starting gear, or a short list when they start with gold only
export function masteryOptions(cls, names) {
  const own = [...new Set(names)].filter(n => WEAPONS[n]);
  if (own.length >= (MASTERY_N[cls] || 0)) return own;
  const pool = cls === 'Rogue' ? ['Dagger', 'Shortsword', 'Rapier', 'Scimitar', 'Shortbow', 'Light Crossbow'] : Object.keys(WEAPONS);
  return [...new Set([...own, ...pool])];
}
export function perksOk(cls, p, opts) {
  const n = Math.min(MASTERY_N[cls] || 0, opts.length);
  return (CHOICES[cls] || []).every(c => !!p[c.key]) && p.mastery.length === n;
}
export function perksHint(cls, p, opts) {
  const miss = (CHOICES[cls] || []).filter(c => !p[c.key]).map(c => c.title), n = Math.min(MASTERY_N[cls] || 0, opts.length);
  if (p.mastery.length !== n) miss.push(`${n} Waffen für Weapon Mastery`);
  return miss.join(', ');
}

// attack lines for the given weapons. Fighting style and mastery go into bonus, damage and note.
export function attacksFor(cls, names, scores, p = emptyPerks()) {
  const m = k => mod(scores[k] || 10), pb = 2, out = [];
  for (const n of [...new Set(names)]) {
    const w = WEAPONS[n]; if (!w) continue;
    const ab = w.ab === 'fin' || (cls === 'Monk' && !w.r && !w.two) ? (m('dex') > m('str') ? 'dex' : 'str') : w.ab;
    const dmgBonus = m(ab) + (p.style === 'Dueling' && !w.r && !w.two ? 2 : 0);
    const mastered = p.mastery.includes(n);
    out.push({ id: newId(), name: n, bonus: pb + m(ab) + (p.style === 'Archery' && w.r ? 2 : 0), damage: `${w.die}${dmgBonus ? sgn(dmgBonus).replace('−', '-') : ''}`,
      note: w.note + (mastered ? ` · Mastery ${w.m}: ${MASTERY[w.m]}` : '') });
  }
  return out;
}
export const unarmed = (cls, scores) => { const m = k => mod(scores[k] || 10);
  return cls === 'Monk' ? { id: newId(), name: 'Unarmed Strike', bonus: 2 + Math.max(m('dex'), m('str')), damage: `1d6${sgn(Math.max(m('dex'), m('str'))).replace('−', '-').replace('+0', '')}`, note: 'bludgeoning, Martial Arts' }
    : { id: newId(), name: 'Unarmed Strike', bonus: 2 + m('str'), damage: String(Math.max(1, 1 + m('str'))), note: 'bludgeoning' }; };

// lines for the features text: every level 1 feature plus what was chosen
export function perkLines(cls, p) {
  const pick = c => (c.opts.find(o => o[0] === p[c.key]) || []);
  const chosen = (CHOICES[cls] || []).filter(c => p[c.key]).map(c => { const o = pick(c); return `${c.title}: ${o[1]} – ${o[2]}`; });
  const mast = p.mastery.length ? [`Weapon Mastery: ${p.mastery.map(n => `${n} (${WEAPONS[n]?.m})`).join(', ')} – nach jeder Long Rest tauschbar`] : [];
  return [...chosen, ...mast];
}

/* ---------- the picker: one box per decision ---------- */
export function PerksPicker({ cls, p, set, weaponNames }) {
  const choices = CHOICES[cls] || [], n = MASTERY_N[cls] || 0, opts = masteryOptions(cls, weaponNames), need = Math.min(n, opts.length);
  const toggleM = k => { if (p.mastery.includes(k)) return set({ ...p, mastery: p.mastery.filter(x => x !== k) }); if (p.mastery.length >= need) return toast(`Höchstens ${need}. Nimm zuerst eine raus.`); set({ ...p, mastery: [...p.mastery, k] }); };
  return html`<div class="extras">
    ${choices.map(c => html`<section><${Decide} icon="⚖️" title=${c.title} count=${p[c.key] ? '1 / 1' : '0 / 1'} does=${c.does}/>
      <div class="sk-list">${c.opts.map(([k, name, eff]) => { const on = p[c.key] === k;
        return html`<div class=${'sk-row' + (on ? ' on' : '')}><label><input type="radio" name=${'perk-' + c.key} checked=${on} onChange=${() => set({ ...p, [c.key]: k })}/><span><b>${name}</b><small>${eff}</small></span></label></div>`; })}</div></section>`)}
    ${n > 0 && html`<section><${Decide} icon="🗡️" title="Weapon Mastery" count=${`${p.mastery.length} / ${need}`}
        does=${`Wähle ${need} Waffen. Bei jedem Angriff mit ihnen bekommst du ihren Spezialeffekt gratis dazu.`} tip="Nimm die Waffen, die du am häufigsten benutzt. Tauschen kannst du nach jeder Long Rest."/>
      <div class="sk-list">${opts.map(k => { const w = WEAPONS[k], on = p.mastery.includes(k);
        return html`<div class=${'sk-row' + (on ? ' on' : '')}><label><input type="checkbox" checked=${on} onChange=${() => toggleM(k)}/><span><b>${k}</b> <span class="ab-tag">${w.m}</span><small>${MASTERY[w.m]}</small></span></label></div>`; })}</div></section>`}
  </div>`;
}

// the decision box shown above every choice: what you pick, what it does in play, a tip
export const Decide = ({ icon = '🎯', title, count, does, tip }) => html`<div class="decide">
  <div class="decide-h"><span class="emo" aria-hidden="true">${icon}</span><b>${title}</b>${count && html`<span class="decide-n num">${count}</span>`}</div>
  ${does && html`<p>${does}</p>`}${tip && html`<p class="decide-tip"><b>Tipp:</b> ${tip}</p>`}</div>`;

export const PerkList = ({ cls }) => html`<dl class="perk-list">${(PERKS[cls] || []).map(([n, w, d]) => html`<div><dt>${n} <span class="perk-when">${w}</span></dt><dd>${d}</dd></div>`)}</dl>`;
