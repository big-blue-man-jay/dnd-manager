// Guided character builder: one decision per step, each explained. Nothing is pre-ticked; recommendations are highlighted (D&D 2024, level 1).
import { html, useState, useMemo, Medal, Field, toast } from './ui.js';
import { ABILITIES, SKILLS, CLASSES, ALIGNMENTS, DICE_COLORS, SPECIES_EMOJI, CLASS_EMOJI, suggestedResources, mod, sgn } from './rules5e.js';
import { newId } from './data.js';
import { lookIn, itemIn, spellIn, featIn } from './world.js';
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
  <span class="ch-emo emo" aria-hidden="true">${emoji}</span><span class="ch-body"><span class="ch-title">${title}${tag && html` <span class="ch-tag">${tag}</span>`}</span>${rules && html`<span class="ch-rules">${rules}</span>`}${lore && html`<span class="ch-lore">${lore}</span>`}${children}</span></button>`;
const Intro = ({ children }) => html`<div class="wiz-intro">${children}</div>`;

export function Builder({ user, others, onCreate, onExpert, world = null, forPlayer = false }) {
  const used = others.map(o => o.diceColor).filter(Boolean);
  const [st, setSt] = useState({ step: 0, cls: null, species: null, bg: null, assign: {}, bonus: null, skills: [], extra: [], cantrips: [], spells: [],
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
  const spellInfo = st.cls && SPELLS[st.cls];
  const steps = [['klasse', 'Klasse'], ['species', world ? 'Volk' : 'Species'], ['background', world ? 'Herkunft' : 'Background'], ['werte', 'Attribute'], ['skills', 'Skills'],
    ...(spellInfo ? [['zauber', 'Zauber']] : []), ['person', 'Persönlichkeit'], ['fertig', 'Übersicht']];
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
  const ac = ci ? ci.armor.ac(mods) : 10;
  const allSkills = [...new Set([...(bgi?.skills || []), ...st.skills, ...st.extra])];
  const skillN = ci ? ci.skills[0] : 0;

  const blankBonus = { mode: 'split', plus2: '', plus1: '' };
  const chooseClass = cls => up(s => s.cls === cls ? {} : ({ cls, assign: {}, bonus: blankBonus, skills: [], extra: [], cantrips: [], spells: [] }));
  const chooseBg = bg => up(s => s.bg === bg ? {} : ({ bg, bonus: blankBonus, skills: s.skills.filter(k => !BACKGROUNDS[bg].skills.includes(k)), extra: s.extra.filter(k => !BACKGROUNDS[bg].skills.includes(k)) }));
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
    person: !!st.name.trim() && !!st.dice && !used.includes(st.dice), fertig: true,
  };
  const hint = { werte: !assigned ? 'Verteile alle sechs Werte (oder nimm die Empfehlung).' : 'Wähle, wohin die Background-Punkte gehen.', klasse: 'Wähle eine Klasse.', species: 'Wähle eine Species.', background: 'Wähle einen Background.', skills: `Wähle genau ${skillN} Skills${spi?.extraSkill ? ' und 1 Bonus-Skill (Human)' : ''}.`,
    zauber: spellInfo && `Wähle ${spellInfo[0] ? spellInfo[0] + ' Cantrips und ' : ''}${spellInfo[1]} Zauber.`, person: 'Gib deinem Charakter einen Namen und eine freie Würfelfarbe.' };
  const go = d => { up(s => ({ step: Math.max(0, Math.min(steps.length - 1, s.step + d)) })); scrollTo(0, 0); };
  const next = () => { if (!ok[cur]) return toast(hint[cur]); go(1); };

  const create = async () => {
    setBusy(true);
    const pb = 2, atk = [];
    for (const w of ci.weapons) atk.push({ id: newId(), name: w.name, bonus: pb + mods[w.ab], damage: `${w.die}${sgn(mods[w.ab]).replace('−', '-').replace('+0', '')}`.replace(/\+$/, ''), note: w.note });
    const spAb = CLASSES[st.cls].spell;
    for (const c of st.cantrips) if (SPELL_ATTACKS[c]) atk.push({ id: newId(), name: c, bonus: pb + mods[spAb], damage: SPELL_ATTACKS[c][0], note: SPELL_ATTACKS[c][1] + ' · Cantrip' });
    const all = spellInfo ? [...spellInfo[2], ...spellInfo[3]] : [];
    const spells = [...st.cantrips.map(n => ({ n, level: 0 })), ...st.spells.map(n => ({ n, level: 1 }))].map(({ n, level }) => ({ id: newId(), name: n, level, prepared: true, note: all.find(s => s.name === n)?.note || '' }));
    const skills = Object.fromEntries(allSkills.map(k => [k, 1]));
    const features = [`${both(clsN, st.cls)} (Stufe 1): ${ci.feats}`, `${both(spN, st.species)}: ${spi.traits}`, `Origin Feat (${both(bgN, st.bg)}): ${both(featIn(world, bgi.feat), bgi.feat)}${bgi.featNote ? ' (' + bgi.featNote + ')' : ''} – ${FEATS[bgi.feat]}`,
      st.species === 'Human' ? 'Human Versatile: ein weiteres Origin Feat nach Wahl (mit dem DM klären)' : ''].filter(Boolean).join('\n');
    const notes = [st.origin && `Herkunft: ${st.origin}`, st.goal && `Ziel: ${st.goal}`, st.quirk && `Macke: ${st.quirk}`].filter(Boolean).join('\n');
    const inventory = [...ci.weapons.filter(w => w.name !== 'Unarmed Strike').map(w => ({ id: newId(), name: w.name, qty: 1, note: w.note, attuned: false })),
      ...(ci.armor.name.startsWith('ohne') ? [] : [{ id: newId(), name: ci.armor.name, qty: 1, note: `AC ${ac}`, attuned: false }])];
    const card = { name: st.name.trim(), species: st.species, cls: st.cls, clsCustom: '', hitDie: die, subclass: '', level: 1, ac: null, speed: spi.speed, hpMax: hp, diceColor: st.dice,
      ...(forPlayer && st.forName.trim() ? { ownerName: st.forName.trim() } : {}) };
    const sheet = { ac, abilities: scores, saveProf: [...CLASSES[st.cls].saves], skills, background: st.bg, alignment: st.alignment,
      languages: `Common + 2 Sprachen nach Wahl · Tool: ${bgi.tool}`, features, notes, attacks: atk, spells, inventory,
      resources: suggestedResources(st.cls, 1, scores).map(r => ({ ...r, id: newId(), used: 0 })) };
    try { await onCreate(card, sheet); } finally { setBusy(false); }
  };


  const Rec = () => html` <span class="ch-tag rec">Empfohlen</span>`;
  const Facts = ({ rows }) => html`<dl class="ch-facts">${rows.filter(Boolean).map(([t, d]) => html`<div><dt>${t}</dt><dd>${d}</dd></div>`)}</dl>`;
  const body = {
    klasse: () => html`<${Intro}><b>🧭 Die Klasse ist deine wichtigste Entscheidung.</b> Sie bestimmt, wie du kämpfst, wie viel du aushältst und welche Fähigkeiten du im Lauf des Abenteuers bekommst. Nimm, was sich nach Spaß anhört.
        <ul class="wiz-tips"><li><b>Einsteigerfreundlich</b>: wenig zu merken, sofort spielbar.</li><li><b>Etwas mehr zu merken</b>: ein paar Zauber oder Spezialfähigkeiten.</li><li><b>Für Tüftler</b>: viele Zauber, viele Möglichkeiten.</li></ul>
        Tippe eine Karte an, um mehr zu sehen.</${Intro}>
      <div class="choice-grid">${Object.entries(CLASS_INFO).map(([k, c]) => html`<${Choice} on=${st.cls === k} onClick=${() => chooseClass(k)} emoji=${W('classes', k)?.emoji || CLASS_EMOJI[k]} title=${W('classes', k)?.name || k} tag=${DIFF[c.diff]} rules=${W('classes', k) ? k : ''} lore=${W('classes', k)?.note}>
        <span class="ch-role">${c.role}</span><span class="ch-desc">${c.pitch}</span>${st.cls === k && html`<span class="ch-more"><${Facts} rows=${[
          ['So spielst du', c.play], ['Hit Points', DIE_NOTE[CLASSES[k].die]], ['Wichtigstes Attribut', `${abName(c.order[0])}: ${ABILITY_DESC[c.order[0]]}`],
          ['Rüstung', IT(c.armor.name)], ['Waffen', c.weapons.map(w => IT(w.name)).join(', ')], ['Saving Throws', CLASSES[k].saves.map(abName).join(' und ') + ' (darin bist du besonders widerstandsfähig)'], ['Skills', `${c.skills[0]} aus der Klassenliste`]]}/></span>`}</${Choice}>`)}</div>`,
    species: () => html`<${Intro}><b>🧬 Deine Species ist dein Volk.</b> Sie bestimmt dein Aussehen und gibt dir ein paar angeborene Fähigkeiten, die sogenannten <b>Traits</b>. Seit den Regeln von 2024 bringt sie <b>keine</b> Attributspunkte mit. Du kannst also frei nach Geschmack wählen, jede Species passt zu jeder Klasse.</${Intro}>
      <div class="choice-grid">${Object.entries(SPECIES_INFO).map(([k, s]) => html`<${Choice} on=${st.species === k} onClick=${() => up({ species: k, extra: [] })} emoji=${W('species', k)?.emoji || SPECIES_EMOJI[k]} title=${W('species', k)?.name || k} tag=${s.speed !== 30 ? `Speed ${s.speed}` : ''}
        rules=${W('species', k) ? [k, W('species', k).home].filter(Boolean).join(' · ') : ''} lore=${W('species', k)?.note}>
        <span class="ch-desc">${s.pitch}</span>${st.species === k && html`<span class="ch-more"><${Facts} rows=${TRAITS[k]}/></span>`}</${Choice}>`)}</div>`,
    background: () => html`<${Intro}><b>📜 Der Background ist, was du vor dem Abenteuer gemacht hast.</b> Er ist vor allem ein <b>Werte-Paket</b>:
        <ul class="wiz-tips"><li><b>+3 Attributspunkte</b> auf drei bestimmte Attribute. Am besten nimmst du einen, der dein wichtigstes Attribut enthält (mit ★ markiert).</li>
        <li><b>Ein Origin Feat</b>: eine kleine Spezialfähigkeit, die du von Anfang an hast.</li><li><b>2 Skills</b> und <b>1 Werkzeug</b>, mit denen du dich auskennst.</li></ul>
        Die Geschichte dazu darfst du frei erfinden: Mechanisch „Soldier“ kann in deiner Story auch ein Türsteher oder Leibwächter sein.</${Intro}>
      <div class="choice-grid">${Object.entries(BACKGROUNDS).map(([k, b]) => { const fit = b.abs.includes(ci.order[0]); return html`<${Choice} on=${st.bg === k} onClick=${() => chooseBg(k)} emoji=${fit ? '★' : '·'} title=${W('backgrounds', k)?.name || k} tag=${fit ? 'passt zu ' + clsN : ''} rules=${W('backgrounds', k) ? k : ''} lore=${W('backgrounds', k)?.note}>
        <span class="ch-desc">${b.pitch}</span><span class="ch-role">${b.abs.map(abName).join(', ')}</span>
        ${st.bg === k && html`<span class="ch-more"><${Facts} rows=${[['Attribute', `${b.abs.map(abName).join(', ')}: Diese drei bekommen zusammen +3. Die Verteilung wählst du im nächsten Schritt.`],
          [`Feat: ${both(featIn(world, b.feat), b.feat)}${b.featNote ? ` (${W('classes', b.featNote)?.name || b.featNote})` : ''}`, FEATS[b.feat]], ...b.skills.map(x => [`Skill: ${SK[x].name}`, SKILL_DESC[x]]), ['Werkzeug', b.tool]]}/></span>`}</${Choice}>`; })}</div>`,
    werte: () => html`<${Intro}><b>💪 Sechs Attribute beschreiben Körper und Geist.</b> Du verteilst die Werte <b>15, 14, 13, 12, 10 und 8</b>, jeden genau einmal. Hohe Werte gehören auf das, was deine Klasse braucht.
        <ul class="wiz-tips"><li>Aus jedem Wert ergibt sich ein <b>Modifier</b>, der bei Würfen dazugerechnet wird: 8–9 = −1 · 10–11 = 0 · 12–13 = +1 · 14–15 = +2 · 16–17 = +3.</li>
        <li>Dazu kommen die <b>+3 Punkte aus deinem Background (${bgN})</b>.</li><li>Die <b>Empfehlung</b> steht bei jedem Attribut. Du kannst sie mit einem Klick übernehmen.</li></ul></${Intro}>
      <div class="rec-bar"><button type="button" class="btn" onClick=${takeRec}>✨ Empfehlung für ${clsN} übernehmen</button>${(Object.keys(st.assign).length > 0) && html`<button type="button" class="link quiet" onClick=${() => up({ assign: {}, bonus: blankBonus })}>Zurücksetzen</button>`}</div>
      <div class="ab-list">${ABILITIES.map(a => { const prim = ci.order[0] === a.key, r = rec.assign[a.key], v = st.assign[a.key], b = v ? scores[a.key] - v : 0; return html`<div class=${'ab-row' + (prim ? ' prim' : '')}>
        <div class="ab-name"><b>${a.name}</b>${prim && html` <span class="ch-tag rec">wichtigstes Attribut</span>`}<small>${ABILITY_DESC[a.key]}</small><small class="rec-note">Empfohlen: ${r}${v && v !== r ? '' : ''}</small></div>
        <select aria-label=${a.name} value=${v || ''} onChange=${e => setScore(a.key, +e.target.value || 0)}><option value="">–</option>${STANDARD_ARRAY.map(x => html`<option value=${x}>${x}${Object.values(st.assign).includes(x) && v !== x ? ' (tauschen)' : ''}</option>`)}</select>
        <span class="ab-bonus num">${b ? '+' + b : ''}</span><span class="ab-total num">${v ? html`<b>${shown(a.key)}</b><small>${sgn(mods[a.key])}</small>` : html`<b class="muted">–</b>`}</span></div>`; })}</div>
      <div class="bonus-pick"><span class="label">📜 Punkte aus ${bgN}: ${st.bonus.free ? 'alle sechs Attribute (Hausregel)' : bgi.abs.map(abName).join(', ')}</span>
        <p class="muted small-note">Nach den Regeln von 2024 legt jeder Background drei Attribute fest, auf die seine Punkte gehen. ${st.bg} erlaubt ${bgi.abs.map(abName).join(', ')}. Passen die nicht zu deiner Klasse, wähle einen anderen Background oder frag deinen DM nach der Hausregel.</p>
        <label class="checkline small"><input type="checkbox" checked=${!!st.bonus.free} onChange=${e => up(s => ({ bonus: { ...s.bonus, free: e.target.checked, plus2: '', plus1: '' } }))}/><span>Hausregel: Punkte auf beliebige Attribute (nur mit Okay vom DM)</span></label>
        <div class="seg small">${[['split', '+2 und +1'], ['all', '+1 auf alle drei']].map(([m, l]) => html`<button type="button" aria-pressed=${st.bonus.mode === m} onClick=${() => up(s => ({ bonus: { ...s.bonus, mode: m } }))}>${l}</button>`)}</div>
        ${st.bonus.mode === 'split' && html`<div class="bonus-sel">${[['plus2', '+2 auf'], ['plus1', '+1 auf']].map(([f, l]) => html`<label>${l} <select value=${st.bonus[f]} onChange=${e => up(s => ({ bonus: { ...s.bonus, [f]: e.target.value } }))}><option value="">–</option>${(st.bonus.free ? ABILITIES.map(a => a.key) : bgi.abs).map(x => html`<option value=${x}>${abName(x)}${(st.bonus.free ? { plus2: ci.order[0], plus1: ci.order[1] } : rec.bonus)[f] === x ? ' ★ empfohlen' : ''}</option>`)}</select></label>`)}</div>`}</div>
      <p class="muted small-note">Kein Stress: Die App rechnet alle Würfe automatisch mit den richtigen Modifiern.</p>`,
    skills: () => { const dx = mods.dex, ex = `Stealth = d20 ${sgn(dx)} (Dexterity) +2 (Proficiency)`; return html`<${Intro}><b>🎯 Skills sind Dinge, in denen du geübt bist.</b> Bei diesen Würfen bekommst du deinen <b>Proficiency Bonus (+2)</b> zusätzlich zum Attribut-Modifier, z. B. ${ex}.
        <ul class="wiz-tips"><li>Zwei hast du schon aus deinem Background (${bgN}).</li><li><b>${skillN}</b> wählst du jetzt aus der Liste deiner Klasse. Die mit „Empfohlen“ passen besonders gut zu ${st.cls}.</li>${spi.extraSkill && html`<li>Als Human bekommst du <b>1 Bonus-Skill</b> aus allen 18.</li>`}</ul></${Intro}>
      <div class="sk-list">${SKILLS.map(s => { const fromBg = bgi.skills.includes(s.key), inClass = ci.skills[1].includes(s.key), on = st.skills.includes(s.key), xx = st.extra.includes(s.key);
        const can = !fromBg && inClass; const canExtra = !fromBg && !on && spi.extraSkill; const isRec = rec.skills.includes(s.key);
        return html`<div class=${'sk-row' + (fromBg || on || xx ? ' on' : '') + (isRec && !on && !fromBg ? ' rec' : '') + (!can && !fromBg && !canExtra ? ' off' : '')}>
          <label><input type="checkbox" checked=${fromBg || on || xx} disabled=${fromBg || (!can && !canExtra)} onChange=${() => can && !xx ? toggleIn('skills', s.key, skillN) : toggleIn('extra', s.key, spi.extraSkill || 0)}/>
          <span><b>${s.name}</b> <span class="ab-tag">${s.ab.toUpperCase()}</span>${fromBg ? html` <span class="ch-tag">aus Background</span>` : xx ? html` <span class="ch-tag">Human-Bonus</span>` : isRec ? html`<${Rec}/>` : ''}<small>${SKILL_DESC[s.key]}</small></span></label></div>`; })}</div>
      <p class="muted small-note">Gewählt: <b>${st.skills.length} / ${skillN}</b> über ${clsN}${spi.extraSkill ? html` · <b>${st.extra.length} / 1</b> Bonus-Skill` : ''}. Ausgegraute Skills gehören nicht zu deiner Klasse.</p>`; },
    zauber: () => html`<${Intro}><b>✨ Zauber.</b>
        <ul class="wiz-tips">${spellInfo[0] > 0 && html`<li><b>Cantrips</b> kannst du so oft wirken, wie du willst. Sie sind dein Standard-Werkzeug.</li>`}
        <li><b>Zauber der 1. Stufe</b> sind stärker, kosten aber ${world ? 'ein' : 'einen'} <b>${T('spellSlot', 'Spell Slot')}</b>${world ? ' (Spell Slot)' : ''}. Davon hast du am Anfang nur wenige, sie kommen bei einer ${T('longRest', 'Long Rest')} zurück.</li>
        <li>Steht bei einem Zauber <b>Concentration</b>, musst du dich darauf konzentrieren: Du kannst nur einen solchen Zauber gleichzeitig aufrechterhalten.</li>
        <li>„Empfohlen“ markiert bewährte Startzauber für ${clsN}. Tauschen kannst du später jederzeit im Bogen.</li></ul></${Intro}>
      ${spellInfo[0] > 0 && html`<h3 class="wiz-h">Cantrips <span class="muted">${st.cantrips.length} / ${spellInfo[0]}</span></h3>
        <div class="sk-list">${spellInfo[2].map(x => { const on = st.cantrips.includes(x.name), r = rec.cantrips.includes(x.name); return html`<div class=${'sk-row' + (on ? ' on' : r ? ' rec' : '')}><label><input type="checkbox" checked=${on} onChange=${() => toggleIn('cantrips', x.name, spellInfo[0])}/><span><b>${SP(x.name)}</b>${r && html`<${Rec}/>`}${world && spellIn(world, x.name) && html` <span class="ch-tag">${x.name}</span>`}<small>${x.note}</small></span></label></div>`; })}</div>`}
      <h3 class="wiz-h">Zauber der 1. Stufe <span class="muted">${st.spells.length} / ${spellInfo[1]}</span></h3>
      <div class="sk-list">${spellInfo[3].map(x => { const on = st.spells.includes(x.name), r = rec.spells.includes(x.name); return html`<div class=${'sk-row' + (on ? ' on' : r ? ' rec' : '')}><label><input type="checkbox" checked=${on} onChange=${() => toggleIn('spells', x.name, spellInfo[1])}/><span><b>${SP(x.name)}</b>${r && html`<${Rec}/>`}${world && spellIn(world, x.name) && html` <span class="ch-tag">${x.name}</span>`}<small>${x.note}</small></span></label></div>`; })}</div>
      <p class="muted small-note">Das ist eine Auswahl für den Einstieg. Die vollständige Zauberliste steht im Player's Handbook, dein DM hilft dir.</p>`,
    person: () => html`<${Intro}><b>Jetzt wird es persönlich.</b> ${forPlayer ? `Ein Name und drei kurze Antworten reichen. Wenn du für einen Spieler baust, schreib die Backstory so, wie sie${place ? ` in ${place}` : ''} klingt.` : 'Ein Name und drei kurze Antworten reichen. Daraus kann dein DM Geschichten für dich bauen.'}</${Intro}>
      <div class="form"><${Field} label="Name"><input id="wb-name" value=${st.name} onInput=${e => up({ name: e.target.value })} placeholder="z. B. Mira Sternfeuer" autocomplete="off"/></${Field}>
        ${forPlayer && html`<${Field} label="Für welchen Spieler? (optional)" hint="Sobald er der Kampagne beitritt, gibst du ihm den Charakter im Bogen unter „Gehört“."><input id="wb-for" value=${st.forName} onInput=${e => up({ forName: e.target.value })} placeholder="z. B. Marlon" autocomplete="off"/></${Field}>`}
        <${Field} label=${place ? `Woher in ${place} kommst du?` : 'Woher kommst du?'} hint="Ein Satz reicht"><input id="wb-origin" value=${st.origin} onInput=${e => up({ origin: e.target.value })} placeholder="Aus einem Fischerdorf, das es nicht mehr gibt"/></${Field}>
        <${Field} label="Was willst du erreichen?"><input id="wb-goal" value=${st.goal} onInput=${e => up({ goal: e.target.value })} placeholder="Den Mann finden, der meine Familie betrogen hat"/></${Field}>
        <${Field} label="Eine Macke oder Angewohnheit"><input id="wb-quirk" value=${st.quirk} onInput=${e => up({ quirk: e.target.value })} placeholder="Sammelt Knöpfe. Hat Angst vor Hühnern."/></${Field}>
        <${Field} label="Alignment (optional)" hint="Wie dein Charakter grob tickt: gut oder böse, ordentlich oder chaotisch"><select id="wb-al" value=${st.alignment} onChange=${e => up({ alignment: e.target.value })}><option value="">Egal</option>${ALIGNMENTS.map(a => html`<option>${a}</option>`)}</select></${Field}>
        <div class="f wide"><span>Deine Würfelfarbe</span><div class="swatches dice">${DICE_COLORS.map(d => { const taken = used.includes(d.key); return html`<label class=${'swatch' + (st.dice === d.key ? ' on' : '') + (taken ? ' taken' : '')} style=${`--sw:${d.hex}`} title=${taken ? 'Schon vergeben' : d.name}><input type="radio" name="wbdice" value=${d.key} disabled=${taken} checked=${st.dice === d.key} onChange=${() => up({ dice: d.key })}/><i></i>${d.name}</label>`; })}</div></div></div>`,
    fertig: () => html`<${Intro}><b>Fertig!</b> So sieht dein Charakter aus. Nach dem Erstellen kannst du alles im Bogen noch ändern, bis dein DM ihn freigibt. Startausrüstung und Gold klärst du mit deinem DM.</${Intro}>
      <div class="sum-head"><${Medal} cls=${st.cls} species=${st.species} look=${lookIn(world, { species: st.species, cls: st.cls }, st.bg)} size="lg"/><div><h2>${st.name || 'Unbenannt'}</h2><div class="sub">Stufe 1 · ${spN} · ${clsN} · ${bgN}${st.alignment ? ' · ' + st.alignment : ''}</div>${world && html`<div class="sub world-was">Regeln: ${st.species} ${st.cls} · ${st.bg}</div>`}${forPlayer && st.forName.trim() && html`<div class="sub">Für ${st.forName.trim()}</div>`}</div></div>
      <div class="statline five sum-stats"><div class="stat"><span class="label"><span class="ico" aria-hidden="true">❤️</span>Hit Points</span><b class="num">${hp}</b></div><div class="stat"><span class="label"><span class="ico" aria-hidden="true">🛡️</span>AC</span><b class="num">${ac}</b></div>
        <div class="stat"><span class="label"><span class="ico" aria-hidden="true">👟</span>Speed</span><b class="num">${spi.speed}</b></div><div class="stat"><span class="label"><span class="ico" aria-hidden="true">⚡</span>Initiative</span><b class="num">${sgn(mods.dex)}</b></div><div class="stat"><span class="label"><span class="ico" aria-hidden="true">🎓</span>Proficiency</span><b class="num">+2</b></div></div>
      <div class="sum-abs">${ABILITIES.map(a => html`<div><span class="label">${a.short}</span><b class="num">${scores[a.key]}</b><small class="num">${sgn(mods[a.key])}</small></div>`)}</div>
      <dl class="sum-dl"><div><dt>Rüstung</dt><dd>${IT(ci.armor.name)}</dd></div><div><dt>Waffen</dt><dd>${ci.weapons.map(w => IT(w.name)).join(', ')}</dd></div>
        <div><dt>Saving Throws</dt><dd>${CLASSES[st.cls].saves.map(abName).join(', ')}</dd></div><div><dt>Skills</dt><dd>${allSkills.map(k => SK[k].name).join(', ')}</dd></div>
        <div><dt>Fähigkeiten</dt><dd>${ci.feats} · ${FT(bgi.feat)}</dd></div>${spellInfo && html`<div><dt>Zauber</dt><dd>${[...st.cantrips, ...st.spells].map(SP).join(', ')}</dd></div>`}</dl>`,
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
