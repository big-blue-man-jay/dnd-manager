// Guided character builder: one decision per step, each explained, with sensible defaults (D&D 2024, level 1).
import { html, useState, useMemo, Medal, Field, toast } from './ui.js';
import { ABILITIES, SKILLS, CLASSES, ALIGNMENTS, DICE_COLORS, SPECIES_EMOJI, CLASS_EMOJI, suggestedResources, mod, sgn } from './rules5e.js';
import { newId } from './data.js';
import { CLASS_INFO, DIFF, SPECIES_INFO, FEATS, BACKGROUNDS, ABILITY_DESC, SKILL_DESC, SPELLS, SPELL_ATTACKS, STANDARD_ARRAY } from './builder-data.js';

const SK = Object.fromEntries(SKILLS.map(s => [s.key, s]));
const AB = Object.fromEntries(ABILITIES.map(a => [a.key, a]));
const abName = k => AB[k].name;

function defaultsForClass(cls) {
  const ci = CLASS_INFO[cls];
  const assign = Object.fromEntries(ci.order.map((k, i) => [k, STANDARD_ARRAY[i]]));
  const sp = SPELLS[cls];
  return { assign, cantrips: sp ? sp[2].slice(0, sp[0]).map(s => s.name) : [], spells: sp ? sp[3].slice(0, sp[1]).map(s => s.name) : [] };
}
function bonusFor(cls, bg) {
  const order = CLASS_INFO[cls]?.order || ABILITIES.map(a => a.key);
  const ranked = [...BACKGROUNDS[bg].abs].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return { mode: 'split', plus2: ranked[0], plus1: ranked[1] };
}
function pickSkills(cls, bg) {
  const [n, list] = CLASS_INFO[cls].skills; const fixed = bg ? BACKGROUNDS[bg].skills : [];
  return list.filter(k => !fixed.includes(k)).slice(0, n);
}

const Choice = ({ on, onClick, emoji, title, tag, children }) => html`<button type="button" class=${'choice' + (on ? ' on' : '')} aria-pressed=${!!on} onClick=${onClick}>
  <span class="ch-emo emo" aria-hidden="true">${emoji}</span><span class="ch-body"><span class="ch-title">${title}${tag && html` <span class="ch-tag">${tag}</span>`}</span>${children}</span></button>`;
const Intro = ({ children }) => html`<div class="wiz-intro">${children}</div>`;

export function Builder({ user, others, onCreate, onExpert }) {
  const used = others.map(o => o.diceColor).filter(Boolean);
  const [st, setSt] = useState({ step: 0, cls: null, species: null, bg: null, assign: {}, bonus: null, skills: [], extra: [], cantrips: [], spells: [],
    name: '', alignment: '', dice: DICE_COLORS.find(d => !used.includes(d.key))?.key || '', origin: '', goal: '', quirk: '' });
  const [busy, setBusy] = useState(false);
  const up = patch => setSt(s => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) }));

  const ci = st.cls && CLASS_INFO[st.cls], bgi = st.bg && BACKGROUNDS[st.bg], spi = st.species && SPECIES_INFO[st.species];
  const spellInfo = st.cls && SPELLS[st.cls];
  const steps = [['klasse', 'Klasse'], ['species', 'Species'], ['background', 'Background'], ['werte', 'Attribute'], ['skills', 'Skills'],
    ...(spellInfo ? [['zauber', 'Zauber']] : []), ['person', 'Persönlichkeit'], ['fertig', 'Übersicht']];
  const cur = steps[Math.min(st.step, steps.length - 1)][0];

  // derived character
  const scores = useMemo(() => {
    const out = {};
    for (const a of ABILITIES) {
      let v = st.assign[a.key] ?? 10;
      if (st.bonus && bgi) { if (st.bonus.mode === 'all') { if (bgi.abs.includes(a.key)) v += 1; } else { if (st.bonus.plus2 === a.key) v += 2; if (st.bonus.plus1 === a.key) v += 1; } }
      out[a.key] = v;
    }
    return out;
  }, [st.assign, st.bonus, st.bg]);
  const mods = Object.fromEntries(ABILITIES.map(a => [a.key, mod(scores[a.key])]));
  const die = st.cls ? CLASSES[st.cls].die : 8;
  const hp = Math.max(1, die + mods.con + (spi?.hpPerLevel || 0) + (bgi?.feat === 'Tough' ? 2 : 0));
  const ac = ci ? ci.armor.ac(mods) : 10;
  const allSkills = [...new Set([...(bgi?.skills || []), ...st.skills, ...st.extra])];
  const skillN = ci ? ci.skills[0] : 0;

  const chooseClass = cls => up(s => ({ cls, ...defaultsForClass(cls), skills: pickSkills(cls, s.bg), extra: [], bonus: s.bg ? bonusFor(cls, s.bg) : null }));
  const chooseBg = bg => up(s => ({ bg, bonus: bonusFor(s.cls, bg), skills: pickSkills(s.cls, bg), extra: s.extra.filter(k => !BACKGROUNDS[bg].skills.includes(k)) }));
  const setScore = (key, val) => up(s => { const a = { ...s.assign }; const other = Object.keys(a).find(k => a[k] === val); if (other) a[other] = a[key]; a[key] = val; return { assign: a }; });
  const toggleIn = (field, k, max) => up(s => { const has = s[field].includes(k); if (!has && s[field].length >= max) { toast(`Höchstens ${max}. Nimm zuerst eins raus.`); return {}; } return { [field]: has ? s[field].filter(x => x !== k) : [...s[field], k] }; });

  const ok = {
    klasse: !!st.cls, species: !!st.species, background: !!st.bg, werte: true,
    skills: st.skills.length === skillN && (!spi?.extraSkill || st.extra.length === spi.extraSkill),
    zauber: !spellInfo || (st.cantrips.length === spellInfo[0] && st.spells.length === spellInfo[1]),
    person: !!st.name.trim() && !!st.dice && !used.includes(st.dice), fertig: true,
  };
  const hint = { klasse: 'Wähle eine Klasse.', species: 'Wähle eine Species.', background: 'Wähle einen Background.', skills: `Wähle genau ${skillN} Skills${spi?.extraSkill ? ' und 1 Bonus-Skill (Human)' : ''}.`,
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
    const features = [`${st.cls} (Stufe 1): ${ci.feats}`, `${st.species}: ${spi.traits}`, `Origin Feat (${st.bg}): ${bgi.feat}${bgi.featNote ? ' (' + bgi.featNote + ')' : ''} – ${FEATS[bgi.feat]}`,
      st.species === 'Human' ? 'Human Versatile: ein weiteres Origin Feat nach Wahl (mit dem DM klären)' : ''].filter(Boolean).join('\n');
    const notes = [st.origin && `Herkunft: ${st.origin}`, st.goal && `Ziel: ${st.goal}`, st.quirk && `Macke: ${st.quirk}`].filter(Boolean).join('\n');
    const inventory = [...ci.weapons.filter(w => w.name !== 'Unarmed Strike').map(w => ({ id: newId(), name: w.name, qty: 1, note: w.note, attuned: false })),
      ...(ci.armor.name.startsWith('ohne') ? [] : [{ id: newId(), name: ci.armor.name, qty: 1, note: `AC ${ac}`, attuned: false }])];
    const card = { name: st.name.trim(), species: st.species, cls: st.cls, clsCustom: '', hitDie: die, subclass: '', level: 1, ac: null, speed: spi.speed, hpMax: hp, diceColor: st.dice };
    const sheet = { ac, abilities: scores, saveProf: [...CLASSES[st.cls].saves], skills, background: st.bg, alignment: st.alignment,
      languages: `Common + 2 Sprachen nach Wahl · Tool: ${bgi.tool}`, features, notes, attacks: atk, spells, inventory,
      resources: suggestedResources(st.cls, 1, scores).map(r => ({ ...r, id: newId(), used: 0 })) };
    try { await onCreate(card, sheet); } finally { setBusy(false); }
  };


  const body = {
    klasse: () => html`<${Intro}><b>Deine Klasse ist dein Beruf als Abenteurer.</b> Sie bestimmt, wie du kämpfst und was du kannst. Fürs erste Mal sind die drei „Einsteigerfreundlich“-Klassen am leichtesten.</${Intro}>
      <div class="choice-grid">${Object.entries(CLASS_INFO).map(([k, c]) => html`<${Choice} on=${st.cls === k} onClick=${() => chooseClass(k)} emoji=${CLASS_EMOJI[k]} title=${k} tag=${DIFF[c.diff]}>
        <span class="ch-role">${c.role}</span><span class="ch-desc">${c.pitch}</span>${st.cls === k && html`<span class="ch-more"><b>So spielst du:</b> ${c.play}</span>`}</${Choice}>`)}</div>`,
    species: () => html`<${Intro}><b>Deine Species ist dein Volk.</b> Sie gibt dir ein paar besondere Fähigkeiten, aber keine Bonuswerte. Nimm einfach, was dir gefällt.</${Intro}>
      <div class="choice-grid">${Object.entries(SPECIES_INFO).map(([k, s]) => html`<${Choice} on=${st.species === k} onClick=${() => up({ species: k, extra: [] })} emoji=${SPECIES_EMOJI[k]} title=${k} tag=${s.speed !== 30 ? `Speed ${s.speed}` : ''}>
        <span class="ch-desc">${s.pitch}</span>${st.species === k && html`<span class="ch-more"><b>Traits:</b> ${s.traits}</span>`}</${Choice}>`)}</div>`,
    background: () => html`<${Intro}><b>Dein Background ist, was du vor dem Abenteuer gemacht hast.</b> Er gibt dir Punkte auf drei Attribute, zwei Skills, ein Werkzeug und ein Origin Feat (eine kleine Spezialfähigkeit). Passend zur Klasse sind die mit ★ markiert.</${Intro}>
      <div class="choice-grid">${Object.entries(BACKGROUNDS).map(([k, b]) => { const fit = b.abs.includes(ci.order[0]); return html`<${Choice} on=${st.bg === k} onClick=${() => chooseBg(k)} emoji=${fit ? '★' : '·'} title=${k} tag=${fit ? 'passt gut' : ''}>
        <span class="ch-desc">${b.pitch}</span><span class="ch-role">${b.abs.map(abName).join(', ')} · ${b.skills.map(s => SK[s].name).join(', ')}</span>
        ${st.bg === k && html`<span class="ch-more"><b>${b.feat}${b.featNote ? ` (${b.featNote})` : ''}:</b> ${FEATS[b.feat]}<br/><b>Werkzeug:</b> ${b.tool}</span>`}</${Choice}>`; })}</div>`,
    werte: () => html`<${Intro}><b>Sechs Attribute beschreiben deinen Körper und Geist.</b> Wir haben die Standardwerte 15, 14, 13, 12, 10 und 8 schon passend zu ${st.cls} verteilt. Du kannst tauschen: Wählst du bei einem Attribut einen anderen Wert, tauschen die beiden. Dazu kommen die Punkte aus deinem Background.</${Intro}>
      <div class="bonus-pick"><span class="label">Bonus aus ${st.bg}</span>
        <div class="seg small">${[['split', '+2 und +1'], ['all', '+1 auf alle drei']].map(([m, l]) => html`<button type="button" aria-pressed=${st.bonus.mode === m} onClick=${() => up(s => ({ bonus: { ...s.bonus, mode: m } }))}>${l}</button>`)}</div>
        ${st.bonus.mode === 'split' && html`<div class="bonus-sel"><label>+2 auf <select value=${st.bonus.plus2} onChange=${e => up(s => ({ bonus: { ...s.bonus, plus2: e.target.value, plus1: s.bonus.plus1 === e.target.value ? s.bonus.plus2 : s.bonus.plus1 } }))}>${bgi.abs.map(a => html`<option value=${a}>${abName(a)}</option>`)}</select></label>
          <label>+1 auf <select value=${st.bonus.plus1} onChange=${e => up(s => ({ bonus: { ...s.bonus, plus1: e.target.value, plus2: s.bonus.plus2 === e.target.value ? s.bonus.plus1 : s.bonus.plus2 } }))}>${bgi.abs.map(a => html`<option value=${a}>${abName(a)}</option>`)}</select></label></div>`}</div>
      <div class="ab-list">${ABILITIES.map(a => { const b = scores[a.key] - st.assign[a.key]; const prim = ci.order[0] === a.key; return html`<div class=${'ab-row' + (prim ? ' prim' : '')}>
        <div class="ab-name"><b>${a.name}</b>${prim && html` <span class="ch-tag">wichtigstes Attribut</span>`}<small>${ABILITY_DESC[a.key]}</small></div>
        <select aria-label=${a.name} value=${st.assign[a.key]} onChange=${e => setScore(a.key, +e.target.value)}>${STANDARD_ARRAY.map(v => html`<option value=${v}>${v}</option>`)}</select>
        <span class="ab-bonus num">${b ? '+' + b : ''}</span><span class="ab-total num"><b>${scores[a.key]}</b><small>${sgn(mods[a.key])}</small></span></div>`; })}</div>
      <p class="muted small-note">Die kleine Zahl (z. B. +2) ist der Modifier. Den rechnest du bei Würfen dazu. Die App macht das automatisch.</p>`,
    skills: () => html`<${Intro}><b>Skills sind Dinge, in denen du besonders gut bist.</b> Bei diesen Würfen bekommst du deinen Proficiency Bonus (+2) dazu. Zwei hast du schon aus deinem Background, ${skillN} wählst du über deine Klasse. Wir haben gute schon angehakt.</${Intro}>
      <div class="sk-list">${SKILLS.map(s => { const fromBg = bgi.skills.includes(s.key), inClass = ci.skills[1].includes(s.key), on = st.skills.includes(s.key), ex = st.extra.includes(s.key);
        const can = !fromBg && inClass; const canExtra = !fromBg && !on && spi.extraSkill;
        return html`<div class=${'sk-row' + (fromBg || on || ex ? ' on' : '') + (!can && !fromBg && !canExtra ? ' off' : '')}>
          <label><input type="checkbox" checked=${fromBg || on || ex} disabled=${fromBg || (!can && !canExtra)} onChange=${() => can && !ex ? toggleIn('skills', s.key, skillN) : toggleIn('extra', s.key, spi.extraSkill || 0)}/>
          <span><b>${s.name}</b> <span class="ab-tag">${s.ab.toUpperCase()}</span>${fromBg ? html` <span class="ch-tag">Background</span>` : ex ? html` <span class="ch-tag">Human-Bonus</span>` : ''}<small>${SKILL_DESC[s.key]}</small></span></label></div>`; })}</div>
      <p class="muted small-note">Gewählt: ${st.skills.length} / ${skillN} über ${st.cls}${spi.extraSkill ? html` · ${st.extra.length} / 1 Bonus-Skill (Human, jeder Skill erlaubt)` : ''}. Ausgegraute Skills gehören nicht zu deiner Klasse.</p>`,
    zauber: () => html`<${Intro}><b>Zauber.</b> ${spellInfo[0] ? 'Cantrips kannst du so oft wirken, wie du willst. ' : ''}Zauber ab Stufe 1 kosten Spell Slots, die sich bei einer Long Rest erholen. Wir haben bewährte Startzauber ausgewählt. Tauschen kannst du später jederzeit im Bogen.</${Intro}>
      ${spellInfo[0] > 0 && html`<h3 class="wiz-h">Cantrips <span class="muted">${st.cantrips.length} / ${spellInfo[0]}</span></h3>
        <div class="sk-list">${spellInfo[2].map(s => html`<div class=${'sk-row' + (st.cantrips.includes(s.name) ? ' on' : '')}><label><input type="checkbox" checked=${st.cantrips.includes(s.name)} onChange=${() => toggleIn('cantrips', s.name, spellInfo[0])}/><span><b>${s.name}</b><small>${s.note}</small></span></label></div>`)}</div>`}
      <h3 class="wiz-h">Zauber der 1. Stufe <span class="muted">${st.spells.length} / ${spellInfo[1]}</span></h3>
      <div class="sk-list">${spellInfo[3].map(s => html`<div class=${'sk-row' + (st.spells.includes(s.name) ? ' on' : '')}><label><input type="checkbox" checked=${st.spells.includes(s.name)} onChange=${() => toggleIn('spells', s.name, spellInfo[1])}/><span><b>${s.name}</b><small>${s.note}</small></span></label></div>`)}</div>
      <p class="muted small-note">Das ist eine Auswahl für den Einstieg. Die vollständige Zauberliste steht im Player's Handbook, dein DM hilft dir.</p>`,
    person: () => html`<${Intro}><b>Jetzt wird es persönlich.</b> Ein Name und drei kurze Antworten reichen. Daraus kann dein DM Geschichten für dich bauen.</${Intro}>
      <div class="form"><${Field} label="Name"><input id="wb-name" value=${st.name} onInput=${e => up({ name: e.target.value })} placeholder="z. B. Mira Sternfeuer" autocomplete="off"/></${Field}>
        <${Field} label="Woher kommst du?" hint="Ein Satz reicht"><input id="wb-origin" value=${st.origin} onInput=${e => up({ origin: e.target.value })} placeholder="Aus einem Fischerdorf, das es nicht mehr gibt"/></${Field}>
        <${Field} label="Was willst du erreichen?"><input id="wb-goal" value=${st.goal} onInput=${e => up({ goal: e.target.value })} placeholder="Den Mann finden, der meine Familie betrogen hat"/></${Field}>
        <${Field} label="Eine Macke oder Angewohnheit"><input id="wb-quirk" value=${st.quirk} onInput=${e => up({ quirk: e.target.value })} placeholder="Sammelt Knöpfe. Hat Angst vor Hühnern."/></${Field}>
        <${Field} label="Alignment (optional)" hint="Wie dein Charakter grob tickt: gut oder böse, ordentlich oder chaotisch"><select id="wb-al" value=${st.alignment} onChange=${e => up({ alignment: e.target.value })}><option value="">Egal</option>${ALIGNMENTS.map(a => html`<option>${a}</option>`)}</select></${Field}>
        <div class="f wide"><span>Deine Würfelfarbe</span><div class="swatches dice">${DICE_COLORS.map(d => { const taken = used.includes(d.key); return html`<label class=${'swatch' + (st.dice === d.key ? ' on' : '') + (taken ? ' taken' : '')} style=${`--sw:${d.hex}`} title=${taken ? 'Schon vergeben' : d.name}><input type="radio" name="wbdice" value=${d.key} disabled=${taken} checked=${st.dice === d.key} onChange=${() => up({ dice: d.key })}/><i></i>${d.name}</label>`; })}</div></div></div>`,
    fertig: () => html`<${Intro}><b>Fertig!</b> So sieht dein Charakter aus. Nach dem Erstellen kannst du alles im Bogen noch ändern, bis dein DM ihn freigibt. Startausrüstung und Gold klärst du mit deinem DM.</${Intro}>
      <div class="sum-head"><${Medal} cls=${st.cls} species=${st.species} size="lg"/><div><h2>${st.name || 'Unbenannt'}</h2><div class="sub">Stufe 1 · ${st.species} ${st.cls} · ${st.bg}${st.alignment ? ' · ' + st.alignment : ''}</div></div></div>
      <div class="statline five sum-stats"><div class="stat"><span class="label"><span class="ico" aria-hidden="true">❤️</span>Hit Points</span><b class="num">${hp}</b></div><div class="stat"><span class="label"><span class="ico" aria-hidden="true">🛡️</span>AC</span><b class="num">${ac}</b></div>
        <div class="stat"><span class="label"><span class="ico" aria-hidden="true">👟</span>Speed</span><b class="num">${spi.speed}</b></div><div class="stat"><span class="label"><span class="ico" aria-hidden="true">⚡</span>Initiative</span><b class="num">${sgn(mods.dex)}</b></div><div class="stat"><span class="label"><span class="ico" aria-hidden="true">🎓</span>Proficiency</span><b class="num">+2</b></div></div>
      <div class="sum-abs">${ABILITIES.map(a => html`<div><span class="label">${a.short}</span><b class="num">${scores[a.key]}</b><small class="num">${sgn(mods[a.key])}</small></div>`)}</div>
      <dl class="sum-dl"><div><dt>Rüstung</dt><dd>${ci.armor.name}</dd></div><div><dt>Waffen</dt><dd>${ci.weapons.map(w => w.name).join(', ')}</dd></div>
        <div><dt>Saving Throws</dt><dd>${CLASSES[st.cls].saves.map(abName).join(', ')}</dd></div><div><dt>Skills</dt><dd>${allSkills.map(k => SK[k].name).join(', ')}</dd></div>
        <div><dt>Fähigkeiten</dt><dd>${ci.feats} · ${bgi.feat}</dd></div>${spellInfo && html`<div><dt>Zauber</dt><dd>${[...st.cantrips, ...st.spells].join(', ')}</dd></div>`}</dl>`,
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
