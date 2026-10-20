// Guided character builder: one decision per step, each explained. Nothing is pre-ticked; recommendations are highlighted (D&D 2024, level 1).
import { html, useState, useMemo, Medal, Field, toast } from './ui.js';
import { ABILITIES, SKILLS, CLASSES, ALIGNMENTS, DICE_COLORS, SPECIES_EMOJI, CLASS_EMOJI, suggestedResources, mod, sgn } from './rules5e.js';
import { newId } from './data.js';
import { lookIn, itemIn, spellIn, featIn } from './world.js';
import { MI_LISTS, extrasFor, emptyExtras, extrasOk, extrasHint, applyExtras, ExtrasPicker, KITS, BG_KITS, LoadoutPicker, gearResult, toInventory } from './startkit.js';
import { WEAPONS } from './classperks.js';
import { Decide, PerkList, PerksPicker, emptyPerks, perksOk, perksHint, masteryOptions, extraCantrips, attacksFor, unarmed, perkLines, PERKS } from './classperks.js';
import { CLASS_INFO, DIFF, SPECIES_INFO, FEATS, BACKGROUNDS, ABILITY_DESC, SKILL_DESC, SPELLS, SPELL_ATTACKS, STANDARD_ARRAY, TRAITS, DIE_NOTE } from './builder-data.js';

const SK = Object.fromEntries(SKILLS.map(s => [s.key, s]));
const AB = Object.fromEntries(ABILITIES.map(a => [a.key, a]));
const abName = k => AB[k].name;

// recommendations (highlighted, never pre-ticked)
const recAssign = cls => Object.fromEntries(CLASS_INFO[cls].order.map((k, i) => [k, STANDARD_ARRAY[i]]));
function bonusFor(cls, bg) {
  const order = CLASS_INFO[cls]?.order || ABILITIES.map(a => a.key);
  const ranked = [...BACKGROUNDS[bg].abs].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return { mode: 'split', plus2: ranked[0], plus1: ranked[1] };
}
function pickSkills(cls, bg) {
  const [n, list] = CLASS_INFO[cls].skills; const fixed = bg ? BACKGROUNDS[bg].skills : [];
  return list.filter(k => !fixed.includes(k)).slice(0, n);
}

// rules: the rulebook name under a world name; lore: the world's one-line description
const Choice = ({ on, onClick, emoji, title, tag, rules, lore, children }) => html`<button type="button" class=${'choice' + (on ? ' on' : '')} aria-pressed=${!!on} onClick=${onClick}>
  <span class="ch-emo emo" aria-hidden="true">${emoji}</span><span class="ch-body"><span class="ch-title">${title}${tag && html` <span class="ch-tag">${tag}</span>`}</span>${rules && html`<span class="ch-rules">${rules}</span>`}${lore && on && html`<span class="ch-lore">${lore}</span>`}${children}</span></button>`;
const Intro = ({ children }) => html`<div class="wiz-intro">${children}</div>`;

export function Builder({ user, others, onCreate, onExpert, world = null, forPlayer = false }) {
  const used = others.map(o => o.diceColor).filter(Boolean);
  const [st, setSt] = useState({ step: 0, cls: null, species: null, bg: null, assign: {}, bonus: null, skills: [], extra: [], cantrips: [], spells: [], x: emptyExtras(), perks: emptyPerks(), gear: { cls: '', bg: '' },
    name: '', alignment: '', dice: DICE_COLORS.find(d => !used.includes(d.key))?.key || '', origin: '', goal: '', quirk: '', forName: '' });
  const [busy, setBusy] = useState(false);
  const up = patch => setSt(s => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) }));

  const ci = st.cls && CLASS_INFO[st.cls], bgi = st.bg && BACKGROUNDS[st.bg], spi = st.species && SPECIES_INFO[st.species];
  // a campaign world renames classes, folks, backgrounds, gear and a few rules words; the rules stay the same
  const W = (map, k) => (k && world?.[map]?.[k]) || null, T = (k, fb) => world?.terms?.[k] || fb, IT = n => itemIn(world, n) || n;
  const SP = n => spellIn(world, n) || n, FT = n => featIn(world, n) || n;
  const clsN = W('classes', st.cls)?.name || st.cls, spN = W('species', st.species)?.name || st.species, bgN = W('backgrounds', st.bg)?.name || st.bg;
  const both = (n, k) => (n && n !== k ? `${n} (${k})` : k); // "Nailsage Disciple (Fighter)" in stored texts, so the rulebook stays findable
  const place = world ? world.setting || world.name : '';
  const spellInfo0 = st.cls && SPELLS[st.cls], plusC = st.cls ? extraCantrips(st.cls, st.perks) : 0;
  // class lists, widened with the Magic Initiate list of the same class, minus what Magic Initiate already took
  const wide = (a, b) => [...a, ...(b || []).filter(x => !a.some(y => y.name === x.name))];
  const spellInfo = spellInfo0 && [spellInfo0[0] + plusC, spellInfo0[1], wide(spellInfo0[2], MI_LISTS[st.cls]?.[0]).filter(x => !st.x.mi.c.includes(x.name)), wide(spellInfo0[3], MI_LISTS[st.cls]?.[1]).filter(x => x.name !== st.x.mi.s)];
  // Rogue Expertise, Magic Initiate spells, Skilled skills: picked in their own step
  const need = st.cls && st.bg ? extrasFor(st.cls, st.bg) : {}, hasExtras = !!(need.expertise || need.mi || need.skilled);
  const steps = [['klasse', 'Klasse'], ['species', world ? 'Volk' : 'Species'], ['background', world ? 'Herkunft' : 'Background'], ['werte', 'Attribute'], ['skills', 'Skills'],
    ['ausruestung', 'Ausrüstung'], ['faehig', 'Fähigkeiten'], ...(spellInfo ? [['zauber', 'Zauber']] : []), ['person', 'Persönlichkeit'], ['fertig', 'Übersicht']];
  const cur = steps[Math.min(st.step, steps.length - 1)][0];

  // derived character
  const scores = useMemo(() => {
    const out = {};
    for (const a of ABILITIES) {
      let v = st.assign[a.key] || 0;
      if (st.bonus && bgi) { if (st.bonus.mode === 'all') { if (bgi.abs.includes(a.key)) v += 1; } else { if (st.bonus.plus2 === a.key) v += 2; if (st.bonus.plus1 === a.key) v += 1; } }
      out[a.key] = v;
    }
    return out;
  }, [st.assign, st.bonus, st.bg]);
  const shown = k => (st.assign[k] ? scores[k] : null);
  const mods = Object.fromEntries(ABILITIES.map(a => [a.key, mod(scores[a.key])]));
  const die = st.cls ? CLASSES[st.cls].die : 8;
  const hp = Math.max(1, die + mods.con + (spi?.hpPerLevel || 0) + (bgi?.feat === 'Tough' ? 2 : 0));
  const gr = st.cls && st.bg ? gearResult(st.cls, st.bg, st.gear) : null;
  const mOpts = st.cls ? masteryOptions(st.cls, gr ? gr.weapons : []) : [];
  const armorName = gr?.armorName || ci?.armor.name || '';
  const ac = !ci ? 10 : Math.max((gr?.ac || ci.armor.ac)(mods) + (st.perks.style === 'Defense' && !/^ohne|^noch keine/.test(armorName) ? 1 : 0), st.perks.inv === 'Armor of Shadows' ? 13 + mods.dex : 0);
  const allSkills = [...new Set([...(bgi?.skills || []), ...st.skills, ...st.extra])];
  const skillN = ci ? ci.skills[0] : 0;

  const blankBonus = { mode: 'split', plus2: '', plus1: '' };
  const chooseClass = cls => up(s => s.cls === cls ? {} : ({ cls, assign: {}, bonus: blankBonus, skills: [], extra: [], cantrips: [], spells: [], x: emptyExtras(), perks: emptyPerks(), gear: { ...s.gear, cls: '' } }));
  const chooseBg = bg => up(s => s.bg === bg ? {} : ({ bg, bonus: blankBonus, x: emptyExtras(), gear: { ...s.gear, bg: '' }, perks: { ...s.perks, mastery: [] }, skills: s.skills.filter(k => !BACKGROUNDS[bg].skills.includes(k)), extra: s.extra.filter(k => !BACKGROUNDS[bg].skills.includes(k)) }));
  const setScore = (key, val) => up(s => { const a = { ...s.assign }; if (!val) { delete a[key]; return { assign: a }; }
    const other = Object.keys(a).find(k => a[k] === val && k !== key); if (other) { if (a[key]) a[other] = a[key]; else delete a[other]; } a[key] = val; return { assign: a }; });
  const takeRec = () => up(s => ({ assign: recAssign(s.cls), bonus: bonusFor(s.cls, s.bg) }));
  const rec = st.cls && st.bg ? { assign: recAssign(st.cls), bonus: bonusFor(st.cls, st.bg), skills: pickSkills(st.cls, st.bg),
    cantrips: spellInfo ? spellInfo[2].slice(0, spellInfo[0]).map(x => x.name) : [], spells: spellInfo ? spellInfo[3].slice(0, spellInfo[1]).map(x => x.name) : [] } : null;
  const assigned = ABILITIES.every(a => st.assign[a.key]);
  const bonusOk = st.bonus && (st.bonus.mode === 'all' || (st.bonus.plus2 && st.bonus.plus1 && st.bonus.plus2 !== st.bonus.plus1));
  const toggleIn = (field, k, max) => up(s => { const has = s[field].includes(k); if (!has && s[field].length >= max) { toast(`Höchstens ${max}. Nimm zuerst eins raus.`); return {}; } return { [field]: has ? s[field].filter(x => x !== k) : [...s[field], k] }; });

  const ok = {
    klasse: !!st.cls, species: !!st.species, background: !!st.bg, werte: assigned && bonusOk,
    skills: st.skills.length === skillN && (!spi?.extraSkill || st.extra.length === spi.extraSkill),
    zauber: !spellInfo || (st.cantrips.length === spellInfo[0] && st.spells.length === spellInfo[1]),
    ausruestung: !!st.gear.cls && (!BG_KITS[st.bg] || !!st.gear.bg),
    faehig: perksOk(st.cls, st.perks, mOpts) && (!hasExtras || extrasOk(need, st.x)),
    person: !!st.name.trim() && !!st.dice && !used.includes(st.dice), fertig: true,
  };
  const hint = { werte: !assigned ? 'Verteile alle sechs Werte (oder nimm die Empfehlung).' : 'Wähle, wohin die Background-Punkte gehen.', klasse: 'Wähle eine Klasse.', species: 'Wähle eine Species.', background: 'Wähle einen Background.', skills: `Wähle genau ${skillN} Skills${spi?.extraSkill ? ' und 1 Bonus-Skill (Human)' : ''}.`,
    zauber: spellInfo && `Wähle ${spellInfo[0] ? spellInfo[0] + ' Cantrips und ' : ''}${spellInfo[1]} Zauber.`, person: 'Gib deinem Charakter einen Namen und eine freie Würfelfarbe.', ausruestung: 'Wähle ein Ausrüstungspaket für Klasse und Background.',
    faehig: 'Wähle noch: ' + [perksHint(st.cls, st.perks, mOpts), hasExtras && !extrasOk(need, st.x) ? extrasHint(need) : ''].filter(Boolean).join(', ') + '.' };
  const go = d => { up(s => ({ step: Math.max(0, Math.min(steps.length - 1, s.step + d)) })); scrollTo(0, 0); };
  const next = () => { if (!ok[cur]) return toast(hint[cur]); go(1); };

  const create = async () => {
    setBusy(true);
    const pb = 2, atk = attacksFor(st.cls, gr.weapons, scores, st.perks);
    if (st.cls === 'Monk' || !atk.length) atk.unshift(unarmed(st.cls, scores));
    const spAb = CLASSES[st.cls].spell;
    for (const c of st.cantrips) if (SPELL_ATTACKS[c]) atk.push({ id: newId(), name: c, bonus: pb + mods[spAb], damage: SPELL_ATTACKS[c][0], note: SPELL_ATTACKS[c][1] + ' · Cantrip' });
    const all = spellInfo ? [...spellInfo[2], ...spellInfo[3]] : [];
    const spells = [...st.cantrips.map(n => ({ n, level: 0 })), ...st.spells.map(n => ({ n, level: 1 }))].map(({ n, level }) => ({ id: newId(), name: n, level, prepared: true, note: all.find(s => s.name === n)?.note || '' }));
    const skills0 = Object.fromEntries(allSkills.map(k => [k, 1]));
    const features = [`${both(clsN, st.cls)} (Stufe 1): ${ci.feats}`, ...(PERKS[st.cls] || []).map(([n, w, d]) => `• ${n} (${w}): ${d}`), ...perkLines(st.cls, st.perks), `${both(spN, st.species)}: ${spi.traits}`, `Origin Feat (${both(bgN, st.bg)}): ${both(featIn(world, bgi.feat), bgi.feat)}${bgi.featNote ? ' (' + bgi.featNote + ')' : ''} – ${FEATS[bgi.feat]}`,
      st.species === 'Human' ? 'Human Versatile: ein weiteres Origin Feat nach Wahl (mit dem DM klären)' : ''].filter(Boolean).join('\n');
    const notes = [st.origin && `Herkunft: ${st.origin}`, st.goal && `Ziel: ${st.goal}`, st.quirk && `Macke: ${st.quirk}`].filter(Boolean).join('\n');
    // starting equipment, option A of the Player's Handbook, plus the class gold
    const kit = KITS[st.cls], inventory = toInventory(gr.items);
    const card = { name: st.name.trim(), species: st.species, cls: st.cls, clsCustom: '', hitDie: die, subclass: '', level: 1, ac: null, speed: spi.speed, hpMax: hp, diceColor: st.dice,
      ...(forPlayer && st.forName.trim() ? { ownerName: st.forName.trim() } : {}) };
    const base = { skills: skills0, spells, attacks: atk, resources: suggestedResources(st.cls, 1, scores).map(r => ({ ...r, id: newId(), used: 0 })) };
    const extra = hasExtras ? applyExtras(base, { cls: st.cls, bg: st.bg, scores, x: st.x }) : {};
    const sheet = { ac, abilities: scores, saveProf: [...CLASSES[st.cls].saves], background: st.bg, alignment: st.alignment,
      languages: `Common + 2 Sprachen nach Wahl · Tool: ${bgi.tool}${kit?.tools ? ` · Klasse: ${kit.tools}` : ''}`, features, notes, inventory,
      coins: { pp: 0, gp: gr.gp, ep: 0, sp: 0, cp: 0 }, ...base, ...extra, startDone: { extras: true, kit: true, perks: true } };
    try { await onCreate(card, sheet); } finally { setBusy(false); }
  };


  const Rec = () => html` <span class="ch-tag rec">Empfohlen</span>`;
  const Facts = ({ rows }) => html`<dl class="ch-facts">${rows.filter(Boolean).map(([t, d]) => html`<div><dt>${t}</dt><dd>${d}</dd></div>`)}</dl>`;
  const body = {
    klasse: () => html`<${Decide} icon="🧭" title="Wähle deine Klasse" count=${st.cls ? '1 / 1' : '0 / 1'} does="Die Klasse bestimmt, was du in deinem Zug machst: zuschlagen, schießen, zaubern oder heilen. Tippe eine Karte an, dann siehst du ihre Fähigkeiten."
        tip="Zum ersten Mal dabei? Fighter, Barbarian oder Rogue sind sofort spielbar, ganz ohne Zauberliste."/>
      <div class="choice-grid">${Object.entries(CLASS_INFO).map(([k, c]) => html`<${Choice} on=${st.cls === k} onClick=${() => chooseClass(k)} emoji=${W('classes', k)?.emoji || CLASS_EMOJI[k]} title=${W('classes', k)?.name || k} tag=${DIFF[c.diff]} rules=${W('classes', k) ? k : ''} lore=${W('classes', k)?.note}>
        <span class="ch-role">${c.role}</span><span class="ch-desc">${c.play}</span>${st.cls === k && html`<span class="ch-more"><${Facts} rows=${[
          ['Hit Points', DIE_NOTE[CLASSES[k].die]], ['Wichtigstes Attribut', abName(c.order[0])]]}/>
          <span class="label perk-head">Das kannst du ab Stufe 1</span><${PerkList} cls=${k}/></span>`}</${Choice}>`)}</div>`,
    species: () => html`<${Decide} icon="🧬" title=${world ? 'Wähle dein Volk' : 'Wähle deine Species'} count=${st.species ? '1 / 1' : '0 / 1'} does="Dein Volk gibt dir ein paar feste Extras, die Traits, zum Beispiel im Dunkeln sehen oder eine 1 neu würfeln. Attributspunkte gibt es hier keine."
        tip="Wähle nach Geschmack, jedes Volk passt zu jeder Klasse. Halfling (Luck) und Human (ein Extra-Skill und -Feat) verzeihen Anfängern am meisten."/>
      <div class="choice-grid">${Object.entries(SPECIES_INFO).map(([k, s]) => html`<${Choice} on=${st.species === k} onClick=${() => up({ species: k, extra: [] })} emoji=${W('species', k)?.emoji || SPECIES_EMOJI[k]} title=${W('species', k)?.name || k} tag=${s.speed !== 30 ? `Speed ${s.speed}` : ''}
        rules=${W('species', k) ? [k, W('species', k).home].filter(Boolean).join(' · ') : ''} lore=${W('species', k)?.note}>
        <span class="ch-desc">${s.pitch}</span>${st.species === k && html`<span class="ch-more"><${Facts} rows=${TRAITS[k]}/></span>`}</${Choice}>`)}</div>`,
    background: () => html`<${Decide} icon="📜" title=${world ? 'Wähle deine Herkunft' : 'Wähle deinen Background'} count=${st.bg ? '1 / 1' : '0 / 1'} does="Der Background ist ein Werte-Paket: +3 Attributspunkte, ein Origin Feat (eine kleine Spezialfähigkeit), 2 Skills, 1 Werkzeug und etwas Ausrüstung."
        tip=${`Nimm einen mit ★: Der erhöht ${ci ? abName(ci.order[0]) : 'dein wichtigstes Attribut'}, das wichtigste Attribut deiner Klasse. Die Geschichte dazu darfst du frei erfinden.`}/>
      <div class="choice-grid">${Object.entries(BACKGROUNDS).map(([k, b]) => { const fit = b.abs.includes(ci.order[0]); return html`<${Choice} on=${st.bg === k} onClick=${() => chooseBg(k)} emoji=${fit ? '★' : '·'} title=${W('backgrounds', k)?.name || k} tag=${fit ? 'passt zu ' + clsN : ''} rules=${W('backgrounds', k) ? k : ''} lore=${W('backgrounds', k)?.note}>
        <span class="ch-desc">${b.pitch}</span><span class="ch-role">${b.abs.map(abName).join(', ')}</span>
        ${st.bg === k && html`<span class="ch-more"><${Facts} rows=${[['Attribute', `${b.abs.map(abName).join(', ')}: Diese drei bekommen zusammen +3. Die Verteilung wählst du im nächsten Schritt.`],
          ...(b.feat === 'Magic Initiate' || b.feat === 'Skilled' ? [['Wählst du später', b.feat === 'Skilled' ? '3 Skills nach Wahl' : '2 Cantrips und 1 Zauber']] : []), [`Feat: ${both(featIn(world, b.feat), b.feat)}${b.featNote ? ` (${W('classes', b.featNote)?.name || b.featNote})` : ''}`, FEATS[b.feat]], ...b.skills.map(x => [`Skill: ${SK[x].name}`, SKILL_DESC[x]]), ['Werkzeug', b.tool]]}/></span>`}</${Choice}>`; })}</div>`,
    werte: () => html`<${Decide} icon="💪" title="Verteile deine Attribute" count=${`${Object.keys(st.assign).length} / 6`} does="Verteile 15, 14, 13, 12, 10 und 8, jeden Wert genau einmal. Aus dem Wert wird ein Modifier, der bei jedem passenden Wurf dazukommt: 8 = −1 · 10 = 0 · 12 = +1 · 14 = +2 · 16 = +3."
        tip=${`Ein Klick auf „Empfehlung übernehmen“ reicht. Der höchste Wert gehört auf ${abName(ci.order[0])}.`}/>
      <div class="rec-bar"><button type="button" class="btn" onClick=${takeRec}>✨ Empfehlung für ${clsN} übernehmen</button>${(Object.keys(st.assign).length > 0) && html`<button type="button" class="link quiet" onClick=${() => up({ assign: {}, bonus: blankBonus })}>Zurücksetzen</button>`}</div>
      <div class="ab-list">${ABILITIES.map(a => { const prim = ci.order[0] === a.key, r = rec.assign[a.key], v = st.assign[a.key], b = v ? scores[a.key] - v : 0; return html`<div class=${'ab-row' + (prim ? ' prim' : '')}>
        <div class="ab-name"><b>${a.name}</b>${prim && html` <span class="ch-tag rec">wichtigstes Attribut</span>`}<small>${ABILITY_DESC[a.key]}</small><small class="rec-note">Empfohlen: ${r}${v && v !== r ? '' : ''}</small></div>
        <select aria-label=${a.name} value=${v || ''} onChange=${e => setScore(a.key, +e.target.value || 0)}><option value="">–</option>${STANDARD_ARRAY.map(x => html`<option value=${x}>${x}${Object.values(st.assign).includes(x) && v !== x ? ' (tauschen)' : ''}</option>`)}</select>
        <span class="ab-bonus num">${b ? '+' + b : ''}</span><span class="ab-total num">${v ? html`<b>${shown(a.key)}</b><small>${sgn(mods[a.key])}</small>` : html`<b class="muted">–</b>`}</span></div>`; })}</div>
      <div class="bonus-pick"><${Decide} icon="📜" title=${`+3 Punkte aus ${bgN}`} count=${bonusOk ? '✓' : ''} does=${`Erhöhe ${st.bonus.free ? 'beliebige Attribute' : bgi.abs.map(abName).join(', ')}: entweder +2 auf eins und +1 auf ein anderes, oder +1 auf alle drei.`} tip="+2 auf dein wichtigstes Attribut (★) bringt am meisten."/>
        <label class="checkline small"><input type="checkbox" checked=${!!st.bonus.free} onChange=${e => up(s => ({ bonus: { ...s.bonus, free: e.target.checked, plus2: '', plus1: '' } }))}/><span>Hausregel: Punkte auf beliebige Attribute (nur mit Okay vom DM)</span></label>
        <div class="seg small">${[['split', '+2 und +1'], ['all', '+1 auf alle drei']].map(([m, l]) => html`<button type="button" aria-pressed=${st.bonus.mode === m} onClick=${() => up(s => ({ bonus: { ...s.bonus, mode: m } }))}>${l}</button>`)}</div>
        ${st.bonus.mode === 'split' && html`<div class="bonus-sel">${[['plus2', '+2 auf'], ['plus1', '+1 auf']].map(([f, l]) => html`<label>${l} <select value=${st.bonus[f]} onChange=${e => up(s => ({ bonus: { ...s.bonus, [f]: e.target.value } }))}><option value="">–</option>${(st.bonus.free ? ABILITIES.map(a => a.key) : bgi.abs).map(x => html`<option value=${x}>${abName(x)}${(st.bonus.free ? { plus2: ci.order[0], plus1: ci.order[1] } : rec.bonus)[f] === x ? ' ★ empfohlen' : ''}</option>`)}</select></label>`)}</div>`}</div>
      <p class="muted small-note">Kein Stress: Die App rechnet alle Würfe automatisch mit den richtigen Modifiern.</p>`,
    skills: () => { const dx = mods.dex, ex = `Stealth = d20 ${sgn(dx)} (Dexterity) +2 (Proficiency)`; return html`<${Decide} icon="🎯" title=${`Wähle ${skillN} Skills${spi.extraSkill ? ' + 1 Bonus-Skill' : ''}`} count=${`${st.skills.length + st.extra.length} / ${skillN + (spi.extraSkill || 0)}`} does=${`Skills sind Dinge, in denen du geübt bist. Würfelst du darauf, bekommst du +2 extra, z. B. ${ex}. Zwei hast du schon aus ${bgN}.`}
        tip=${`Perception (Dinge bemerken) wird am häufigsten gewürfelt. „Empfohlen“ passt gut zu ${clsN}.`}/>
      <div class="sk-list">${SKILLS.map(s => { const fromBg = bgi.skills.includes(s.key), inClass = ci.skills[1].includes(s.key), on = st.skills.includes(s.key), xx = st.extra.includes(s.key);
        const can = !fromBg && inClass; const canExtra = !fromBg && !on && spi.extraSkill; const isRec = rec.skills.includes(s.key);
        return html`<div class=${'sk-row' + (fromBg || on || xx ? ' on' : '') + (isRec && !on && !fromBg ? ' rec' : '') + (!can && !fromBg && !canExtra ? ' off' : '')}>
          <label><input type="checkbox" checked=${fromBg || on || xx} disabled=${fromBg || (!can && !canExtra)} onChange=${() => can && !xx ? toggleIn('skills', s.key, skillN) : toggleIn('extra', s.key, spi.extraSkill || 0)}/>
          <span><b>${s.name}</b> <span class="ab-tag">${s.ab.toUpperCase()}</span>${fromBg ? html` <span class="ch-tag">aus Background</span>` : xx ? html` <span class="ch-tag">Human-Bonus</span>` : isRec ? html`<${Rec}/>` : ''}<small>${SKILL_DESC[s.key]}</small></span></label></div>`; })}</div>
      <p class="muted small-note">Gewählt: <b>${st.skills.length} / ${skillN}</b> über ${clsN}${spi.extraSkill ? html` · <b>${st.extra.length} / 1</b> Bonus-Skill` : ''}. Ausgegraute Skills gehören nicht zu deiner Klasse.</p>`; },
    zauber: () => html`${spellInfo[0] > 0 && html`<${Decide} icon="🔁" title=${`Wähle ${spellInfo[0]} Cantrips`} count=${`${st.cantrips.length} / ${spellInfo[0]}`} does="Cantrips sind kleine Zauber, die du so oft wirken kannst, wie du willst. Ein Angriffs-Cantrip ist dein Standard-Angriff."
          tip=${plusC ? 'Einer davon kommt aus deiner Divine/Primal Order.' : 'Nimm mindestens einen, der Schaden macht.'}/>
        <div class="sk-list">${spellInfo[2].map(x => { const on = st.cantrips.includes(x.name), r = rec.cantrips.includes(x.name); return html`<div class=${'sk-row' + (on ? ' on' : r ? ' rec' : '')}><label><input type="checkbox" checked=${on} onChange=${() => toggleIn('cantrips', x.name, spellInfo[0])}/><span><b>${SP(x.name)}</b>${r && html`<${Rec}/>`}${world && spellIn(world, x.name) && html` <span class="ch-tag">${x.name}</span>`}<small>${x.note}</small></span></label></div>`; })}</div>`}
      <${Decide} icon="✨" title=${`Wähle ${spellInfo[1]} Zauber der 1. Stufe`} count=${`${st.spells.length} / ${spellInfo[1]}`} does=${`Stärkere Zauber. Jeder kostet ${world ? 'ein' : 'einen'} ${T('spellSlot', 'Spell Slot')}: Davon hast du am Anfang 2${st.cls === 'Warlock' ? ' (Warlock: 1, kommt bei Short Rest zurück)' : ''}, sie kommen bei einer ${T('longRest', 'Long Rest')} zurück. Concentration heißt: nur einer davon gleichzeitig.`}
        tip="Ein Heilzauber oder ein Schutzzauber rettet in der ersten Sitzung oft den Tag. Tauschen kannst du später im Bogen."/>
      <div class="sk-list">${spellInfo[3].map(x => { const on = st.spells.includes(x.name), r = rec.spells.includes(x.name); return html`<div class=${'sk-row' + (on ? ' on' : r ? ' rec' : '')}><label><input type="checkbox" checked=${on} onChange=${() => toggleIn('spells', x.name, spellInfo[1])}/><span><b>${SP(x.name)}</b>${r && html`<${Rec}/>`}${world && spellIn(world, x.name) && html` <span class="ch-tag">${x.name}</span>`}<small>${x.note}</small></span></label></div>`; })}</div>
      <p class="muted small-note">Das ist eine Auswahl für den Einstieg. Die vollständige Zauberliste steht im Player's Handbook, dein DM hilft dir.</p>`,
    ausruestung: () => html`<${LoadoutPicker} cls=${st.cls} bg=${st.bg} gear=${st.gear} set=${gear => up(s => ({ gear, perks: { ...s.perks, mastery: [] } }))} IT=${IT}/>`,
    faehig: () => html`<div class="perk-box"><${Decide} icon="⚔️" title=${`Das kann dein ${clsN} ab Stufe 1`} does="Diese Fähigkeiten hast du automatisch. Sie stehen später auf deinem Bogen, die mit Zahl auch als Zähler."/><${PerkList} cls=${st.cls}/></div>
      <${PerksPicker} cls=${st.cls} p=${st.perks} set=${perks => up({ perks })} weaponNames=${gr.weapons}/>
      ${hasExtras && html`<${ExtrasPicker} cls=${st.cls} bg=${st.bg} scores=${scores} profSkills=${allSkills} classSpells=${[]} x=${st.x} set=${x => up({ x })} SP=${SP}/>`}`,
    person: () => html`<${Decide} icon="🪪" title="Name und ein bisschen Persönlichkeit" does="Pflicht sind nur Name und Würfelfarbe. Die drei kurzen Fragen sind freiwillig, daraus baut dein DM Momente für deinen Charakter."
        tip=${forPlayer ? `Ein Satz pro Frage reicht${place ? `, gern so, wie es in ${place} klingt` : ''}.` : 'Ein Satz pro Frage reicht völlig.'}/>
      <div class="form"><${Field} label="Name"><input id="wb-name" value=${st.name} onInput=${e => up({ name: e.target.value })} placeholder="z. B. Mira Sternfeuer" autocomplete="off"/></${Field}>
        ${forPlayer && html`<${Field} label="Für welchen Spieler? (optional)" hint="Sobald er der Kampagne beitritt, gibst du ihm den Charakter im Bogen unter „Gehört“."><input id="wb-for" value=${st.forName} onInput=${e => up({ forName: e.target.value })} placeholder="z. B. Marlon" autocomplete="off"/></${Field}>`}
        <${Field} label=${place ? `Woher in ${place} kommst du?` : 'Woher kommst du?'} hint="Ein Satz reicht"><input id="wb-origin" value=${st.origin} onInput=${e => up({ origin: e.target.value })} placeholder="Aus einem Fischerdorf, das es nicht mehr gibt"/></${Field}>
        <${Field} label="Was willst du erreichen?"><input id="wb-goal" value=${st.goal} onInput=${e => up({ goal: e.target.value })} placeholder="Den Mann finden, der meine Familie betrogen hat"/></${Field}>
        <${Field} label="Eine Macke oder Angewohnheit"><input id="wb-quirk" value=${st.quirk} onInput=${e => up({ quirk: e.target.value })} placeholder="Sammelt Knöpfe. Hat Angst vor Hühnern."/></${Field}>
        <${Field} label="Alignment (optional)" hint="Wie dein Charakter grob tickt: gut oder böse, ordentlich oder chaotisch"><select id="wb-al" value=${st.alignment} onChange=${e => up({ alignment: e.target.value })}><option value="">Egal</option>${ALIGNMENTS.map(a => html`<option>${a}</option>`)}</select></${Field}>
        <div class="f wide"><span>Deine Würfelfarbe</span><div class="swatches dice">${DICE_COLORS.map(d => { const taken = used.includes(d.key); return html`<label class=${'swatch' + (st.dice === d.key ? ' on' : '') + (taken ? ' taken' : '')} style=${`--sw:${d.hex}`} title=${taken ? 'Schon vergeben' : d.name}><input type="radio" name="wbdice" value=${d.key} disabled=${taken} checked=${st.dice === d.key} onChange=${() => up({ dice: d.key })}/><i></i>${d.name}</label>`; })}</div></div></div>`,
    fertig: () => html`<${Intro}><b>Fertig!</b> So sieht dein Charakter aus. Nach dem Erstellen kannst du alles im Bogen noch ändern, bis dein DM ihn freigibt. Deine Ausrüstung liegt schon im Rucksack, die Angriffe stehen fertig berechnet auf dem Bogen.</${Intro}>
      <div class="sum-head"><${Medal} cls=${st.cls} species=${st.species} look=${lookIn(world, { species: st.species, cls: st.cls }, st.bg)} size="lg"/><div><h2>${st.name || 'Unbenannt'}</h2><div class="sub">Stufe 1 · ${spN} · ${clsN} · ${bgN}${st.alignment ? ' · ' + st.alignment : ''}</div>${world && html`<div class="sub world-was">Regeln: ${st.species} ${st.cls} · ${st.bg}</div>`}${forPlayer && st.forName.trim() && html`<div class="sub">Für ${st.forName.trim()}</div>`}</div></div>
      <div class="statline five sum-stats"><div class="stat"><span class="label"><span class="ico" aria-hidden="true">❤️</span>Hit Points</span><b class="num">${hp}</b></div><div class="stat"><span class="label"><span class="ico" aria-hidden="true">🛡️</span>AC</span><b class="num">${ac}</b></div>
        <div class="stat"><span class="label"><span class="ico" aria-hidden="true">👟</span>Speed</span><b class="num">${spi.speed}</b></div><div class="stat"><span class="label"><span class="ico" aria-hidden="true">⚡</span>Initiative</span><b class="num">${sgn(mods.dex)}</b></div><div class="stat"><span class="label"><span class="ico" aria-hidden="true">🎓</span>Proficiency</span><b class="num">+2</b></div></div>
      <div class="sum-abs">${ABILITIES.map(a => html`<div><span class="label">${a.short}</span><b class="num">${scores[a.key]}</b><small class="num">${sgn(mods[a.key])}</small></div>`)}</div>
      <dl class="sum-dl"><div><dt>Rüstung</dt><dd>${IT(armorName)}</dd></div><div><dt>Waffen</dt><dd>${gr.weapons.filter(n => WEAPONS[n]).map(IT).join(', ') || 'noch keine (mit Gold kaufen)'}</dd></div>
        <div><dt>Saving Throws</dt><dd>${CLASSES[st.cls].saves.map(abName).join(', ')}</dd></div><div><dt>Skills</dt><dd>${allSkills.map(k => SK[k].name).join(', ')}</dd></div>
        <div><dt>Fähigkeiten</dt><dd>${ci.feats} · ${FT(bgi.feat)}</dd></div>${spellInfo && html`<div><dt>Zauber</dt><dd>${[...st.cantrips, ...st.spells].map(SP).join(', ')}</dd></div>`}
        ${st.x.exp.length > 0 && html`<div><dt>Expertise</dt><dd>${st.x.exp.map(k => SK[k].name).join(', ')}</dd></div>`}
        ${st.x.skilled.length > 0 && html`<div><dt>Skilled</dt><dd>${st.x.skilled.map(k => SK[k].name).join(', ')}</dd></div>`}
        ${need.mi && st.x.mi.s && html`<div><dt>Magic Initiate (${need.mi})</dt><dd>${[...st.x.mi.c, st.x.mi.s].map(SP).join(', ')}</dd></div>`}
        ${perkLines(st.cls, st.perks).map(l => { const i = l.indexOf(': '); return html`<div><dt>${l.slice(0, i)}</dt><dd>${l.slice(i + 2).split(' – ')[0]}</dd></div>`; })}
        <div><dt>Ausrüstung</dt><dd>${gr.items.map(([n, q]) => (q > 1 ? `${q}× ${IT(n)}` : IT(n))).join(', ') || '–'} · ${gr.gp} gp</dd></div></dl>`,
  };

  return html`<div class="wiz">
    <ol class="wiz-steps">${steps.map(([k, l], i) => html`<li class=${i === st.step ? 'cur' : i < st.step ? 'done' : ''}><button type="button" disabled=${i > st.step} onClick=${() => up({ step: i })}><span class="n">${i < st.step ? '✓' : i + 1}</span><span class="t">${l}</span></button></li>`)}</ol>
    <div class="wiz-body">${body[cur]()}</div>
    <div class="wiz-foot">${st.step > 0 ? html`<button type="button" class="btn" onClick=${() => go(-1)}>Zurück</button>` : html`<button type="button" class="link quiet" onClick=${onExpert}>Ich kenne mich aus: alles selbst eintragen</button>`}
      <span class="spacer"></span>
      ${cur === 'fertig' ? html`<button type="button" class="btn primary" disabled=${busy} onClick=${create}>${busy ? 'Wird erstellt …' : 'Charakter erstellen'}</button>`
        : html`<button type="button" class=${'btn primary' + (ok[cur] ? '' : ' soft')} onClick=${next}>Weiter</button>`}</div>
  </div>`;
}
