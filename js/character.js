import { html, useState, useEffect, useMemo, useRef, useDoc, useCol, usePreview, PreviewBar, Medal, Pill, Empty, Spinner, HpBar, Modal, Field, DeleteButton, toast, failed,
  applyTheme, go, href, int, requestRoll } from './ui.js';
import { store, newId } from './data.js';
import { ABILITIES, SKILLS, CLASSES, CLASS_NAMES, SPECIES, ALIGNMENTS, XP_FOR, levelForXp, profBonus, mod, sgn, autoSlots, isPact,
  suggestedResources, RESET_LABEL, SPECIES_EMOJI, CLASS_EMOJI, CONDITIONS, EXHAUSTION_DESC, DICE_COLORS, diceHex, D20 } from './rules5e.js';
import { roll, withBonus } from './dice.js';
import { throwDice, loadThree, canThrow, diceSettings } from './dice3d.js';

const accentHex = () => { try { return getComputedStyle(document.documentElement).getPropertyValue('--theme-accent').trim() || '#2B4790'; } catch (e) { return '#2B4790'; } };
import { clsName } from './cards.js';

const hitDie = c => (c.cls === 'Homebrew' ? int(c.hitDie, 8) : CLASSES[c.cls]?.die || 8);
const spellAb = (c, s) => s.spellAbility || CLASSES[c.cls]?.spell || '';
const blankSheet = () => ({ abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, saveProf: [], skills: {}, attacks: [], spells: [], slotsUsed: Array(9).fill(0), slotsOverride: null,
  resources: [], hitDiceUsed: 0, deathSaves: { ok: 0, fail: 0 }, inspiration: false, inventory: [], coins: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 }, background: '', alignment: '', languages: '', features: '', notes: '', spellAbility: '' });

/* ======================= character page ======================= */
export function CharacterPage({ user, cid, chId }) {
  const camp = useDoc(`campaigns/${cid}`);
  const card = useDoc(`campaigns/${cid}/characters/${chId}`);
  const [preview, setPreview] = usePreview(cid);
  const [asOther, setAsOther] = useState(false);
  const realDM = !!camp && camp.dmUid === user.uid, realOwner = !!card && card.ownerUid === user.uid;
  const hide = (realDM && preview) || asOther; // look at the character the way another player does
  const isDM = realDM && !hide, isOwner = realOwner && !hide;
  const sheet = useDoc(card && (isDM || isOwner) ? `campaigns/${cid}/characters/${chId}/sheet/main` : null);
  const all = useCol(camp ? `campaigns/${cid}/characters` : null);
  useEffect(() => { if (camp) applyTheme(camp.theme); }, [camp?.theme]);
  useEffect(() => { if (card?.diceColor) dispatchEvent(new CustomEvent('dndm-dicecolor', { detail: { hex: diceHex(card.diceColor), name: card.name } })); return () => dispatchEvent(new CustomEvent('dndm-dicecolor', { detail: null })); }, [card?.diceColor, card?.name]);
  const [edit, setEdit] = useState(false);
  if (camp === undefined || card === undefined) return html`<${Spinner}/>`;
  if (!camp || !card) return html`<main class="page"><${Empty} title="Charakter nicht gefunden" action=${html`<a class="btn" href=${href('c', cid)}>Zur Kampagne</a>`}>Vielleicht wurde er gelöscht.</${Empty}></main>`;
  const back = html`<a class="link crumb" href=${href('c', cid, 'gruppe')}>← ${camp.name}</a>`;
  if (!isDM && !isOwner) return html`<main class="page narrow">
    ${asOther ? html`<${PreviewBar} text="So sehen andere Spieler diesen Charakter." onExit=${() => setAsOther(false)}/>` : realDM && preview ? html`<${PreviewBar} text="So sehen Spieler diesen Charakter." onExit=${() => setPreview(false)}/>` : ''}
    ${back}<${PublicCard} c=${card}/></main>`;
  if (sheet === undefined) return html`<${Spinner}/>`;
  const s = { ...blankSheet(), ...(sheet || {}) };
  const coreOk = isDM || (isOwner && !card.locked);
  const ctx = { c: card, s, cid, chId, isDM, isOwner, coreOk, camp, user };
  return html`<main class="page charpage">${back}
    <${CharHeader} ...${ctx} onEdit=${() => setEdit(true)} onAsOther=${() => { setAsOther(true); window.scrollTo(0, 0); }}/>
    <${LevelUpBanner} ...${ctx}/>
    <div class="sheet-grid">
      <div class="col">
        <${Vitals} ...${ctx}/>
        <${Abilities} ...${ctx}/>
        <${Skills} ...${ctx}/>
      </div>
      <div class="col">
        <${Attacks} ...${ctx}/>
        <${Spellcasting} ...${ctx}/>
        <${Resources} ...${ctx}/>
        <${Conditions} ...${ctx}/>
        <${Inventory} ...${ctx}/>
        <${TextBlocks} ...${ctx}/>
      </div>
    </div>
    ${edit && html`<${Modal} wide title=${'Bogen bearbeiten: ' + card.name} eyebrow=${card.locked && !isDM ? 'Freigegeben' : 'Charakterbogen'} onClose=${() => setEdit(false)} lead=${html`<${Medal} cls=${card.cls} species=${card.species} size="lg"/>`}>
      <${CharForm} user=${user} cid=${cid} camp=${camp} card=${card} sheet=${s} others=${(all || []).filter(x => x.id !== chId)} isDM=${isDM} onDone=${() => setEdit(false)}/></${Modal}>`}
  </main>`;
}

function PublicCard({ c }) {
  const dc = DICE_COLORS.find(d => d.key === c.diceColor);
  return html`<article class="panel public-card">
    <div class="pc-head"><${Medal} cls=${c.cls} species=${c.species} size="lg"/>
      <div class="nc-id"><h1 class="h-name">${c.name}</h1><div class="sub">Stufe ${c.level || 1} · ${[c.species, clsName(c), c.subclass && `(${c.subclass})`].filter(Boolean).join(' ')}</div>
        <div class="sub">Gespielt von ${c.ownerName || '–'}${dc ? html` · Würfelfarbe <span class="dice-dot inline" style=${`--dc:${dc.hex}`}></span>${dc.name}` : ''}</div></div></div>
    <div class="pc-body">
      <div class="statline two"><div class="stat"><span class="label">Stufe</span><b class="num">${c.level || 1}</b></div>
        <div class="stat"><span class="label">Hit Points</span><b class="num">${c.hp ?? 0}<span class="sub"> / ${c.hpMax ?? 0}</span>${c.tempHp ? html` <span class="xp">+${c.tempHp}</span>` : ''}</b></div></div>
      <${HpBar} hp=${c.hp || 0} max=${c.hpMax || 0}/>
      ${(c.conditions?.length || c.exhaustion) ? html`<div><span class="label">Zustände</span><div class="chips" style="margin-top:6px">${(c.conditions || []).map(x => html`<span class="chip cond">${x}</span>`)}${c.exhaustion ? html`<span class="chip cond">Exhaustion ${c.exhaustion}</span>` : ''}</div></div>` : ''}
    </div>
    <p class="pc-foot">Werte, Zauber und Inventar sieht nur ${c.ownerName || 'der Spieler'} und der DM.</p></article>`;
}

/* ---------- writes ---------- */
const cardPath = (cid, chId) => `campaigns/${cid}/characters/${chId}`;
const sheetPath = (cid, chId) => `campaigns/${cid}/characters/${chId}/sheet/main`;
async function patch({ cid, chId }, cardData, sheetData) {
  const ops = [];
  if (cardData) ops.push({ type: 'update', path: cardPath(cid, chId), data: { ...cardData, updatedAt: Date.now() } });
  if (sheetData) ops.push({ type: 'merge', path: sheetPath(cid, chId), data: { ...sheetData, updatedAt: Date.now() } });
  try { await store.batch(ops); } catch (e) { failed(e); }
}

/* ---------- header ---------- */
function CharHeader({ c, s, isDM, isOwner, coreOk, cid, chId, onEdit, onAsOther }) {
  const lvl = c.level || 1, next = lvl < 20 ? XP_FOR[lvl + 1] : null, prev = XP_FOR[lvl] || 0;
  const pct = next ? Math.max(0, Math.min(100, ((c.xp || 0) - prev) / (next - prev) * 100)) : 100;
  const toggleLock = async () => { try { await store.update(cardPath(cid, chId), { locked: !c.locked, updatedAt: Date.now() }); toast(c.locked ? 'Bogen wieder zum Bearbeiten geöffnet.' : 'Bogen freigegeben.'); } catch (e) { failed(e); } };
  return html`<section class="char-head panel">
    <div class="feat-name"><${Medal} cls=${c.cls} species=${c.species} size="lg"/><div class="nc-id">
      <div class="flag">${c.locked ? html`<${Pill} tone="active">Freigegeben</${Pill}>` : html`<${Pill} tone="warn">Entwurf</${Pill}>`}${s.inspiration && html`<${Pill} tone="gild">Heroic Inspiration</${Pill}>`}</div>
      <h1 class="h-name">${c.name}</h1>
      <div class="sub">Stufe ${lvl} · ${[c.species, clsName(c), c.subclass && `(${c.subclass})`].filter(Boolean).join(' ')}${s.background ? ' · ' + s.background : ''}${s.alignment ? ' · ' + s.alignment : ''}</div>
      <div class="sub">Gespielt von ${c.ownerName}${c.diceColor ? html` · <span class="dice-dot inline" style=${`--dc:${diceHex(c.diceColor)}`}></span> ${DICE_COLORS.find(d => d.key === c.diceColor)?.name}` : ''}</div></div></div>
    <div class="xpwrap"><div class="xprow"><span class="label">Experience</span><span class="num">${(c.xp || 0).toLocaleString('de-DE')}${next ? ' / ' + next.toLocaleString('de-DE') + ' XP bis Stufe ' + (lvl + 1) : ' XP'}</span></div><div class="xpbar"><i style=${`width:${pct}%`}></i></div></div>
    <div class="actions">
      ${coreOk && html`<button class="btn" onClick=${onEdit}>Bogen bearbeiten</button>`}
      <button class="btn" onClick=${onAsOther}>Als Mitspieler ansehen</button>
      ${isDM && html`<button class="btn" onClick=${toggleLock}>${c.locked ? 'Zum Bearbeiten öffnen' : 'Bogen freigeben'}</button>`}
      ${isOwner && !c.locked && !isDM && html`<span class="ro-note">Entwurf: Du kannst alles ändern, bis dein DM den Bogen freigibt.</span>`}
      ${isOwner && c.locked && !isDM && html`<span class="ro-note">Freigegeben: HP, Slots, Inventar & Co. änderst du selbst. Werte und Stufe ändert der DM.</span>`}
    </div></section>`;
}

/* ---------- level up ---------- */
function LevelUpBanner(ctx) {
  const { c, isDM, isOwner } = ctx; const lvl = c.level || 1;
  const [open, setOpen] = useState(false);
  if (lvl >= 20 || (c.xp || 0) < XP_FOR[lvl + 1] || !(isDM || isOwner)) return null;
  return html`<div class="levelup panel"><div><b>Stufenaufstieg!</b> ${c.name} hat genug XP für Stufe ${lvl + 1}.</div><button class="btn primary" onClick=${() => setOpen(true)}>Auf Stufe ${lvl + 1} aufsteigen</button>
    ${open && html`<${LevelUpModal} ...${ctx} onClose=${() => setOpen(false)}/>`}</div>`;
}
function LevelUpModal({ c, s, cid, chId, onClose }) {
  const die = hitDie(c), con = mod(s.abilities.con), avg = Math.floor(die / 2) + 1, lvl = (c.level || 1) + 1;
  const [rolled, setRolled] = useState(null);
  const apply = async gain => { const g = Math.max(1, gain + con);
    await patch({ cid, chId }, { level: lvl, hpMax: (c.hpMax || 0) + g, hp: (c.hp || 0) + g }); toast(`Stufe ${lvl}! +${g} max HP.`); onClose(); };
  const newRes = suggestedResources(c.cls, lvl, s.abilities);
  return html`<${Modal} title=${`Stufe ${lvl}`} eyebrow="Stufenaufstieg" onClose=${onClose} lead=${html`<${Medal} cls=${c.cls} species=${c.species} size="lg"/>`}>
    <div class="form"><div class="sec"><h3>1 · Hit Points</h3>
      <p>Du bekommst einen Hit Die (d${die}) dazu. Nimm den Durchschnitt oder würfle. Dein CON-Modifikator (${sgn(con)}) kommt dazu.</p>
      <div class="actions"><button class="btn primary" onClick=${() => apply(avg)}>Durchschnitt nehmen: ${avg} ${sgn(con)} = ${Math.max(1, avg + con)}</button>
        ${rolled === null ? html`<button class="btn" onClick=${() => { const r = roll('1d' + die); setRolled(r.total); requestRoll({ label: 'Hit Die (Stufenaufstieg)', result: r }); }}>d${die} würfeln</button>`
        : html`<button class="btn primary" onClick=${() => apply(rolled)}>Gewürfelt ${rolled} ${sgn(con)} = ${Math.max(1, rolled + con)} übernehmen</button>`}</div></div>
      <div class="sec"><h3>2 · Neue Fähigkeiten</h3><p class="muted">Schau im Player's Handbook nach, was ${clsName(c)} auf Stufe ${lvl} bekommt, und trag es unter „Features & Traits“ ein. ${profBonus(lvl) > profBonus(lvl - 1) ? `Dein Proficiency Bonus steigt auf ${sgn(profBonus(lvl))}.` : ''} ${[4, 8, 12, 16, 19].includes(lvl) ? 'Auf dieser Stufe bekommst du ein Feat (z. B. Ability Score Improvement). Frag deinen DM, er trägt die neuen Werte ein.' : ''}</p></div>
      ${CLASSES[c.cls]?.caster && html`<div class="sec"><h3>3 · Zauber</h3><p class="muted">Deine Spell Slots werden automatisch angepasst. Neue Zauber trägst du im Bereich Spellcasting ein.</p></div>`}
      ${newRes.length > 0 && html`<p class="ro-note">Tipp: Unter „Ressourcen“ kannst du die Werte für Stufe ${lvl} übernehmen (${newRes.map(r => `${r.name} ${r.max}`).join(', ')}).</p>`}
    </div></${Modal}>`;
}

/* ---------- vitals ---------- */
function Vitals(ctx) {
  const { c, s, cid, chId } = ctx;
  const [amt, setAmt] = useState('');
  const lvl = c.level || 1, pb = profBonus(lvl), dex = mod(s.abilities.dex), con = mod(s.abilities.con), die = hitDie(c);
  const n = Math.max(0, int(amt, 0));
  const hp = c.hp || 0, max = c.hpMax || 0, temp = c.tempHp || 0;
  const damage = () => { if (!n) return; const fromTemp = Math.min(temp, n); const left = Math.max(0, hp - (n - fromTemp)); patch(ctx, { hp: left, tempHp: temp - fromTemp }); setAmt(''); if (left === 0) toast(`${c.name} ist bei 0 HP. Death Saves!`); };
  const heal = () => { if (!n) return; patch(ctx, { hp: Math.min(max, hp + n) }, hp === 0 ? { deathSaves: { ok: 0, fail: 0 } } : null); setAmt(''); };
  const setTemp = () => { patch(ctx, { tempHp: n }); setAmt(''); };
  const ds = s.deathSaves || { ok: 0, fail: 0 };
  const deathRoll = () => { const r = roll('1d20'); requestRoll({ label: 'Death Save', result: r });
    if (r.nat === 20) { patch(ctx, { hp: 1 }, { deathSaves: { ok: 0, fail: 0 } }); toast('Natürliche 20! Wieder bei 1 HP.'); return; }
    const d2 = r.nat === 1 ? { ...ds, fail: Math.min(3, ds.fail + 2) } : r.total >= 10 ? { ...ds, ok: Math.min(3, ds.ok + 1) } : { ...ds, fail: Math.min(3, ds.fail + 1) };
    patch(ctx, null, { deathSaves: d2 }); if (d2.ok >= 3) toast('Stabilisiert.'); if (d2.fail >= 3) toast('Drei Fehlschläge…'); };
  const spendHD = () => { if (s.hitDiceUsed >= lvl) return; const r = roll(withBonus('1d' + die, con)); requestRoll({ label: 'Hit Die', result: r });
    patch(ctx, { hp: Math.min(max, hp + Math.max(0, r.total)) }, { hitDiceUsed: (s.hitDiceUsed || 0) + 1 }); };
  return html`<section class="panel box vitals">
    <div class="statline five">
      <div class="stat ac"><span class="label">AC</span><b class="num">${(s.ac ?? c.ac) || '–'}</b></div>
      <button class="stat roll" onClick=${() => requestRoll({ label: 'Initiative', expr: withBonus('1d20', dex) })}><span class="label">Initiative</span><b class="num">${sgn(dex)}</b></button>
      <div class="stat"><span class="label">Speed</span><b class="num">${c.speed || 30}</b></div>
      <div class="stat"><span class="label">Proficiency</span><b class="num">${sgn(pb)}</b></div>
      <div class="stat"><span class="label">Passive Perc.</span><b class="num">${10 + mod(s.abilities.wis) + (s.skills.perception ? pb * s.skills.perception : 0)}</b></div>
    </div>
    <div class="hpblock">
      <div class="hpnum"><span class="label">Hit Points</span><div><b class="big num">${hp}</b><span class="num"> / ${max}</span>${temp ? html` <span class="xp num">+${temp} temp</span>` : ''}</div><${HpBar} hp=${hp} max=${max}/></div>
      <div class="hpctl"><input id="hp-amt" type="number" min="0" inputmode="numeric" placeholder="Wert" value=${amt} onInput=${e => setAmt(e.target.value)} aria-label="HP-Wert"/>
        <button class="btn danger-soft" onClick=${damage}>Schaden</button><button class="btn ok-soft" onClick=${heal}>Heilen</button><button class="btn small" onClick=${setTemp}>Temp HP</button></div>
    </div>
    ${hp === 0 && html`<div class="deathsaves"><span class="label">Death Saves</span>
      <div class="pips ok">${[0, 1, 2].map(i => html`<button class=${i < ds.ok ? 'on' : ''} aria-label="Erfolg" onClick=${() => patch(ctx, null, { deathSaves: { ...ds, ok: i < ds.ok ? i : i + 1 } })}></button>`)}<span class="sub">Erfolge</span></div>
      <div class="pips fail">${[0, 1, 2].map(i => html`<button class=${i < ds.fail ? 'on' : ''} aria-label="Fehlschlag" onClick=${() => patch(ctx, null, { deathSaves: { ...ds, fail: i < ds.fail ? i : i + 1 } })}></button>`)}<span class="sub">Fehlschläge</span></div>
      <button class="btn small" onClick=${deathRoll}>Death Save würfeln</button></div>`}
    <div class="row-split">
      <div><span class="label">Hit Dice</span><div class="num">${lvl - (s.hitDiceUsed || 0)} / ${lvl} × d${die}</div><button class="btn small" disabled=${(s.hitDiceUsed || 0) >= lvl || hp >= max} onClick=${spendHD}>Hit Die ausgeben</button></div>
      <div><span class="label">Heroic Inspiration</span><div><button class=${'toggle' + (s.inspiration ? ' on' : '')} onClick=${() => patch(ctx, null, { inspiration: !s.inspiration })}>${s.inspiration ? 'Vorhanden' : 'Keine'}</button></div></div>
    </div>
    <${Rests} ...${ctx}/>
  </section>`;
}
function Rests(ctx) {
  const { c, s } = ctx; const [ask, setAsk] = useState(null);
  const slotsMax = s.slotsOverride || autoSlots(c.cls, c.level);
  const shortRest = () => { const res = (s.resources || []).map(r => r.reset === 'short' ? { ...r, used: 0 } : r.reset === 'shortOne' ? { ...r, used: Math.max(0, (r.used || 0) - 1) } : r);
    const sheet = { resources: res }; if (isPact(c.cls)) sheet.slotsUsed = Array(9).fill(0);
    patch(ctx, null, sheet); setAsk(null); toast('Short Rest: Ressourcen aufgefüllt. Hit Dice kannst du oben ausgeben.'); };
  const longRest = () => { patch(ctx, { hp: c.hpMax || 0, tempHp: 0, exhaustion: Math.max(0, (c.exhaustion || 0) - 1) },
    { resources: (s.resources || []).map(r => ({ ...r, used: 0 })), slotsUsed: Array(9).fill(0), hitDiceUsed: 0, deathSaves: { ok: 0, fail: 0 } }); setAsk(null); toast('Long Rest: alles aufgefüllt.'); };
  return html`<div class="rests">${ask ? html`<span class="confirm">${ask === 'short' ? 'Short Rest machen? Füllt Short-Rest-Ressourcen auf.' : 'Long Rest machen? HP, Slots, Ressourcen und Hit Dice voll, Exhaustion −1.'}
      <button class="btn primary small" onClick=${ask === 'short' ? shortRest : longRest}>Ja</button><button class="btn small" onClick=${() => setAsk(null)}>Abbrechen</button></span>`
    : html`<button class="btn" onClick=${() => setAsk('short')}>Short Rest</button><button class="btn" onClick=${() => setAsk('long')}>Long Rest</button>`}</div>`;
}

/* ---------- abilities + skills ---------- */
function Abilities({ c, s }) {
  const pb = profBonus(c.level || 1);
  return html`<section class="panel box"><div class="box-head"><h2>Abilities</h2><span class="sub">Tippen zum Würfeln</span></div>
    <div class="abil">${ABILITIES.map(a => { const m = mod(s.abilities[a.key]); const prof = s.saveProf.includes(a.key); const save = m + (prof ? pb : 0);
      return html`<div class="ab"><span class="label" title=${a.name}>${a.short}</span>
        <button class="m num" onClick=${() => requestRoll({ label: `${a.name} Check`, expr: withBonus('1d20', m) })} title="Ability Check">${sgn(m)}</button>
        <span class="score num">${s.abilities[a.key]}</span>
        <button class=${'save' + (prof ? ' prof' : '')} onClick=${() => requestRoll({ label: `${a.name} Save`, expr: withBonus('1d20', save) })} title="Saving Throw">Save ${sgn(save)}</button></div>`; })}</div></section>`;
}
function Skills({ c, s }) {
  const pb = profBonus(c.level || 1);
  return html`<section class="panel box"><div class="box-head"><h2>Skills</h2><span class="sub">● geübt · ◆ Expertise</span></div>
    <div class="skills">${SKILLS.map(k => { const lvl = s.skills[k.key] || 0; const b = mod(s.abilities[k.ab]) + lvl * pb;
      return html`<button class="skill" onClick=${() => requestRoll({ label: k.name, expr: withBonus('1d20', b) })}><span class=${'mark m' + lvl}>${lvl === 2 ? '◆' : lvl ? '●' : '○'}</span><span class="nm">${k.name}</span><span class="ab-tag">${k.ab.toUpperCase()}</span><b class="num">${sgn(b)}</b></button>`; })}</div></section>`;
}

/* ---------- attacks ---------- */
function Attacks(ctx) {
  const { s } = ctx; const list = s.attacks || [];
  const [f, setF] = useState(null);
  const save = e => { e.preventDefault(); if (!f.name.trim()) return; const next = f.id ? list.map(a => a.id === f.id ? f : a) : [...list, { ...f, id: newId() }]; patch(ctx, null, { attacks: next }); setF(null); };
  return html`<section class="panel box"><div class="box-head"><h2>Angriffe</h2><button class="btn small" onClick=${() => setF({ name: '', bonus: 0, damage: '1d6', note: '' })}>Hinzufügen</button></div>
    ${list.length ? html`<div class="attacks">${list.map(a => html`<div class="atk">
      <div class="atk-name"><b>${a.name}</b>${a.note && html`<span class="sub">${a.note}</span>`}</div>
      <button class="btn small roll" onClick=${() => requestRoll({ label: `${a.name}: Angriff`, expr: withBonus('1d20', int(a.bonus)) })}>${sgn(int(a.bonus))}</button>
      <button class="btn small roll" onClick=${() => requestRoll({ label: `${a.name}: Schaden`, expr: a.damage })}>${a.damage}</button>
      <button class="link quiet small" onClick=${() => setF(a)}>Ändern</button></div>`)}</div>` : html`<p class="muted">Waffen und Angriffszauber mit Bonus und Schaden, z. B. Longsword +5, 1d8+3.</p>`}
    ${f && html`<form class="form inline-form" onSubmit=${save}>
      <${Field} label="Name"><input id="atk-name" value=${f.name} onInput=${e => setF(f => ({ ...f, name: e.target.value }))} placeholder="Longsword"/></${Field}>
      <${Field} label="Angriffsbonus"><input id="atk-bonus" type="number" value=${f.bonus} onInput=${e => setF(f => ({ ...f, bonus: e.target.value }))}/></${Field}>
      <${Field} label="Schaden"><input id="atk-dmg" value=${f.damage} onInput=${e => setF(f => ({ ...f, damage: e.target.value }))} placeholder="1d8+3"/></${Field}>
      <${Field} label="Notiz"><input id="atk-note" value=${f.note} onInput=${e => setF(f => ({ ...f, note: e.target.value }))} placeholder="slashing, versatile"/></${Field}>
      <div class="actions"><button class="btn primary small">Speichern</button><button type="button" class="btn small" onClick=${() => setF(null)}>Abbrechen</button>${f.id && html`<button type="button" class="btn danger small" onClick=${() => { patch(ctx, null, { attacks: list.filter(a => a.id !== f.id) }); setF(null); }}>Entfernen</button>`}</div></form>`}
  </section>`;
}

/* ---------- spellcasting ---------- */
function Spellcasting(ctx) {
  const { c, s } = ctx; const ab = spellAb(c, s);
  const [f, setF] = useState(null);
  const slotsMax = s.slotsOverride || autoSlots(c.cls, c.level);
  const spells = s.spells || [];
  if (!ab && !spells.length && !slotsMax.some(Boolean)) return null;
  const pb = profBonus(c.level || 1), m = ab ? mod(s.abilities[ab]) : 0;
  const used = s.slotsUsed || Array(9).fill(0);
  const tapSlot = (lv, i) => { const u = [...used]; u[lv] = i < (u[lv] || 0) ? i : i + 1; patch(ctx, null, { slotsUsed: u }); };
  const save = e => { e.preventDefault(); if (!f.name.trim()) return; const next = f.id ? spells.map(x => x.id === f.id ? f : x) : [...spells, { ...f, id: newId() }]; patch(ctx, null, { spells: next }); setF(null); };
  const byLevel = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(l => [l, spells.filter(x => int(x.level) === l)]).filter(([, l]) => l.length);
  return html`<section class="panel box"><div class="box-head"><h2>Spellcasting</h2><button class="btn small" onClick=${() => setF({ name: '', level: 1, prepared: true, note: '' })}>Zauber hinzufügen</button></div>
    ${ab && html`<div class="statline three"><div class="stat"><span class="label">Ability</span><b>${ab.toUpperCase()}</b></div><div class="stat"><span class="label">Spell Save DC</span><b class="num">${8 + pb + m}</b></div>
      <button class="stat roll" onClick=${() => requestRoll({ label: 'Spell Attack', expr: withBonus('1d20', pb + m) })}><span class="label">Spell Attack</span><b class="num">${sgn(pb + m)}</b></button></div>`}
    ${slotsMax.some(Boolean) && html`<div class="slots"><span class="label">${isPact(c.cls) ? 'Pact Magic Slots (Short Rest)' : 'Spell Slots'}</span>
      ${slotsMax.map((n, lv) => n ? html`<div class="slotrow"><span class="lv">${lv + 1}</span><div class="pips">${Array.from({ length: n }, (_, i) => html`<button class=${i < (used[lv] || 0) ? 'on' : ''} aria-label=${`Slot Stufe ${lv + 1}`} onClick=${() => tapSlot(lv, i)}></button>`)}</div><span class="sub">${n - Math.min(n, used[lv] || 0)} frei</span></div>` : null)}</div>`}
    ${byLevel.map(([l, list]) => html`<div class="spell-lv"><span class="label">${l === 0 ? 'Cantrips' : 'Stufe ' + l}</span>${list.map(x => html`<div class="spell">
      ${l > 0 && html`<button class=${'prep' + (x.prepared ? ' on' : '')} title="Vorbereitet" onClick=${() => patch(ctx, null, { spells: spells.map(y => y.id === x.id ? { ...y, prepared: !y.prepared } : y) })}>${x.prepared ? '●' : '○'}</button>`}
      <span class="nm">${x.name}${x.note && html` <span class="sub">${x.note}</span>`}</span><button class="link quiet small" onClick=${() => setF(x)}>Ändern</button></div>`)}</div>`)}
    ${f && html`<form class="form inline-form" onSubmit=${save}>
      <${Field} label="Zauber"><input id="sp-name" value=${f.name} onInput=${e => setF(f => ({ ...f, name: e.target.value }))} placeholder="Cure Wounds"/></${Field}>
      <${Field} label="Stufe"><select id="sp-lv" value=${f.level} onChange=${e => setF(f => ({ ...f, level: int(e.target.value) }))}>${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(l => html`<option value=${l}>${l === 0 ? 'Cantrip' : l}</option>`)}</select></${Field}>
      <${Field} label="Notiz"><input id="sp-note" value=${f.note} onInput=${e => setF(f => ({ ...f, note: e.target.value }))} placeholder="Concentration, 60 ft"/></${Field}>
      <div class="actions"><button class="btn primary small">Speichern</button><button type="button" class="btn small" onClick=${() => setF(null)}>Abbrechen</button>${f.id && html`<button type="button" class="btn danger small" onClick=${() => { patch(ctx, null, { spells: spells.filter(x => x.id !== f.id) }); setF(null); }}>Entfernen</button>`}</div></form>`}
  </section>`;
}

/* ---------- resources ---------- */
function Resources(ctx) {
  const { c, s } = ctx; const list = s.resources || [];
  const [f, setF] = useState(null);
  const sugg = suggestedResources(c.cls, c.level, s.abilities);
  const tap = (r, i) => patch(ctx, null, { resources: list.map(x => x.id === r.id ? { ...x, used: i < (x.used || 0) ? i : i + 1 } : x) });
  const save = e => { e.preventDefault(); if (!f.name.trim()) return; const r = { ...f, max: Math.max(1, int(f.max, 1)) }; patch(ctx, null, { resources: f.id ? list.map(x => x.id === f.id ? r : x) : [...list, { ...r, id: newId(), used: 0 }] }); setF(null); };
  const takeSugg = () => { const byName = Object.fromEntries(list.map(r => [r.name, r])); const merged = [...list.map(r => { const g = sugg.find(x => x.name === r.name); return g ? { ...r, max: g.max, reset: g.reset } : r; }), ...sugg.filter(g => !byName[g.name]).map(g => ({ ...g, id: newId(), used: 0 }))]; patch(ctx, null, { resources: merged }); toast('Ressourcen übernommen.'); };
  const differs = sugg.some(g => { const r = list.find(x => x.name === g.name); return !r || r.max !== g.max; });
  return html`<section class="panel box"><div class="box-head"><h2>Ressourcen</h2><button class="btn small" onClick=${() => setF({ name: '', max: 1, reset: 'long' })}>Hinzufügen</button></div>
    ${list.map(r => html`<div class="res"><div class="res-name"><b>${r.name}</b><span class="sub">${RESET_LABEL[r.reset] || ''}</span></div>
      ${r.max <= 12 ? html`<div class="pips">${Array.from({ length: r.max }, (_, i) => html`<button class=${i < (r.used || 0) ? 'on' : ''} aria-label=${r.name} onClick=${() => tap(r, i)}></button>`)}</div>`
        : html`<div class="counter"><button class="btn small" onClick=${() => patch(ctx, null, { resources: list.map(x => x.id === r.id ? { ...x, used: Math.min(x.max, (x.used || 0) + 1) } : x) })}>−</button><span class="num">${r.max - (r.used || 0)} / ${r.max}</span><button class="btn small" onClick=${() => patch(ctx, null, { resources: list.map(x => x.id === r.id ? { ...x, used: Math.max(0, (x.used || 0) - 1) } : x) })}>+</button></div>`}
      <button class="link quiet small" onClick=${() => setF(r)}>Ändern</button></div>`)}
    ${!list.length && html`<p class="muted">Klassenfähigkeiten mit begrenzten Anwendungen, z. B. Rage oder Channel Divinity.</p>`}
    ${sugg.length > 0 && differs && html`<button class="link small" onClick=${takeSugg}>Werte für ${clsName(c)} Stufe ${c.level || 1} übernehmen (${sugg.map(g => `${g.name} ${g.max}`).join(', ')})</button>`}
    ${f && html`<form class="form inline-form" onSubmit=${save}>
      <${Field} label="Name"><input id="res-name" value=${f.name} onInput=${e => setF(f => ({ ...f, name: e.target.value }))}/></${Field}>
      <${Field} label="Anwendungen"><input id="res-max" type="number" min="1" value=${f.max} onInput=${e => setF(f => ({ ...f, max: e.target.value }))}/></${Field}>
      <${Field} label="Zurück bei"><select id="res-reset" value=${f.reset} onChange=${e => setF(f => ({ ...f, reset: e.target.value }))}>${Object.entries(RESET_LABEL).map(([k, v]) => html`<option value=${k}>${v}</option>`)}</select></${Field}>
      <div class="actions"><button class="btn primary small">Speichern</button><button type="button" class="btn small" onClick=${() => setF(null)}>Abbrechen</button>${f.id && html`<button type="button" class="btn danger small" onClick=${() => { patch(ctx, null, { resources: list.filter(x => x.id !== f.id) }); setF(null); }}>Entfernen</button>`}</div></form>`}
  </section>`;
}

/* ---------- conditions ---------- */
function Conditions(ctx) {
  const { c, camp } = ctx; const active = c.conditions || [];
  const [pick, setPick] = useState(false);
  const all = [...CONDITIONS, ...(camp.customConditions || []).map(x => ({ ...x, custom: true }))];
  const desc = n => all.find(x => x.name === n)?.desc || '';
  const toggle = n => patch(ctx, { conditions: active.includes(n) ? active.filter(x => x !== n) : [...active, n] });
  const ex = c.exhaustion || 0;
  return html`<section class="panel box"><div class="box-head"><h2>Zustände</h2><button class="btn small" onClick=${() => setPick(!pick)}>${pick ? 'Fertig' : 'Zustand hinzufügen'}</button></div>
    ${active.length ? html`<div class="conds">${active.map(n => html`<div class="cond-row"><b>${n}</b><span class="sub">${desc(n)}</span><button class="link quiet small" onClick=${() => toggle(n)}>Entfernen</button></div>`)}</div>` : html`<p class="muted">Keine Zustände aktiv.</p>`}
    <div class="exh"><span class="label">Exhaustion</span><div class="counter"><button class="btn small" disabled=${!ex} onClick=${() => patch(ctx, { exhaustion: ex - 1 })}>−</button><b class="num">${ex}</b><button class="btn small" disabled=${ex >= 6} onClick=${() => patch(ctx, { exhaustion: ex + 1 })}>+</button></div>
      ${ex > 0 && html`<span class="sub">−${ex * 2} auf d20-Würfe, −${ex * 5} ft Speed</span>`}</div><p class="ro-note">${EXHAUSTION_DESC}</p>
    ${pick && html`<div class="cond-pick">${all.map(x => html`<button class=${'chip-btn' + (active.includes(x.name) ? ' on' : '') + (x.custom ? ' custom' : '')} title=${x.desc} onClick=${() => toggle(x.name)}>${x.name}</button>`)}</div>`}
  </section>`;
}

/* ---------- inventory ---------- */
function Inventory(ctx) {
  const { s } = ctx; const inv = s.inventory || []; const coins = { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0, ...(s.coins || {}) };
  const [name, setName] = useState(''); const [cn, setCn] = useState(null);
  const add = e => { e.preventDefault(); if (!name.trim()) return; patch(ctx, null, { inventory: [...inv, { id: newId(), name: name.trim(), qty: 1, note: '', attuned: false }] }); setName(''); };
  const upd = (id, d) => patch(ctx, null, { inventory: inv.map(x => x.id === id ? { ...x, ...d } : x) });
  const attunedN = inv.filter(x => x.attuned).length;
  const cur = cn || coins;
  return html`<section class="panel box"><div class="box-head"><h2>Inventar</h2><span class="sub">Attunement ${attunedN} / 3</span></div>
    ${inv.length ? html`<div class="inv">${inv.map(x => html`<div class="inv-row">
      <div class="counter"><button class="btn small" onClick=${() => upd(x.id, { qty: Math.max(0, (x.qty || 0) - 1) })}>−</button><b class="num">${x.qty ?? 1}</b><button class="btn small" onClick=${() => upd(x.id, { qty: (x.qty || 0) + 1 })}>+</button></div>
      <div class="inv-name"><b>${x.name}</b><input class="note-in" value=${x.note || ''} placeholder="Notiz" onChange=${e => upd(x.id, { note: e.target.value })} aria-label="Notiz"/></div>
      <label class="att" title="Attuned"><input type="checkbox" checked=${!!x.attuned} disabled=${!x.attuned && attunedN >= 3} onChange=${e => upd(x.id, { attuned: e.target.checked })}/> Attuned</label>
      <button class="rm" aria-label="Entfernen" onClick=${() => patch(ctx, null, { inventory: inv.filter(y => y.id !== x.id) })}>×</button></div>`)}</div>` : html`<p class="muted">Noch nichts im Rucksack.</p>`}
    <form class="inline-add" onSubmit=${add}><input id="inv-add" value=${name} onInput=${e => setName(e.target.value)} placeholder="Gegenstand hinzufügen, z. B. Rope (50 ft)"/><button class="btn small">Hinzufügen</button></form>
    <div class="coins">${['pp', 'gp', 'ep', 'sp', 'cp'].map(k => html`<label class="coin"><span>${k.toUpperCase()}</span><input id=${'coin-' + k} type="number" min="0" value=${cur[k]} onInput=${e => setCn({ ...cur, [k]: int(e.target.value, 0) })} onBlur=${() => { if (cn) { patch(ctx, null, { coins: cn }); setCn(null); } }}/></label>`)}</div>
  </section>`;
}

/* ---------- text blocks ---------- */
function TextBlocks(ctx) {
  const { s, coreOk } = ctx;
  const [notes, setNotes] = useState(null);
  return html`<section class="panel box"><div class="box-head"><h2>Features & Traits</h2></div>
    ${s.features ? html`<p class="pre">${s.features}</p>` : html`<p class="muted">${coreOk ? 'Über „Bogen bearbeiten“ eintragen: Klassen- und Species-Features, Feats.' : 'Noch nichts eingetragen.'}</p>`}
    ${s.languages && html`<div><span class="label">Sprachen & Proficiencies</span><p class="pre">${s.languages}</p></div>`}
    <${Field} label="Notizen zum Charakter"><textarea id="ch-notes" value=${notes ?? s.notes} onInput=${e => setNotes(e.target.value)} onBlur=${() => { if (notes !== null && notes !== s.notes) { patch(ctx, null, { notes }); } setNotes(null); }} placeholder="Persönlichkeit, Ziele, Beziehungen…"></textarea></${Field}>
    <p class="ro-note">Diesen Bogen sehen nur du und der DM.</p></section>`;
}

/* ======================= create / edit form ======================= */
export function NewCharacter({ user, cid }) {
  const camp = useDoc(`campaigns/${cid}`);
  const all = useCol(camp ? `campaigns/${cid}/characters` : null);
  useEffect(() => { if (camp) applyTheme(camp.theme); }, [camp?.theme]);
  if (camp === undefined || all === undefined) return html`<${Spinner}/>`;
  if (!camp) return html`<main class="page"><${Empty} title="Kampagne nicht gefunden">Tritt der Kampagne zuerst mit dem Code bei.</${Empty}></main>`;
  return html`<main class="page narrow"><a class="link crumb" href=${href('c', cid, 'gruppe')}>← ${camp.name}</a>
    <div class="greet"><span class="label">Neuer Charakter</span><h1>Erschaffe deinen Helden</h1><p class="muted">Du kannst alles ändern, bis dein DM den Bogen freigibt. Unsicher bei Werten? Frag deinen DM oder schau ins Player's Handbook.</p></div>
    <div class="panel box"><${CharForm} user=${user} cid=${cid} camp=${camp} others=${all} isDM=${camp.dmUid === user.uid} onDone=${id => go('c', cid, 'char', id)}/></div></main>`;
}

function CharForm({ user, cid, camp, card, sheet, others, isDM, onDone }) {
  const isNew = !card;
  const s0 = { ...blankSheet(), ...(sheet || {}) };
  const usedColors = others.map(o => o.diceColor).filter(Boolean);
  const [f, setF] = useState({ name: '', species: 'Human', speciesCustom: '', cls: 'Fighter', clsCustom: '', hitDie: 8, subclass: '', level: 1, xp: 0, ac: 10, speed: 30, hpMax: '',
    diceColor: DICE_COLORS.find(d => !usedColors.includes(d.key))?.key || '', ...(card || {}),
    ac: s0.ac ?? card?.ac ?? 10, abilities: { ...s0.abilities }, saveProf: card ? [...s0.saveProf] : [...(CLASSES[(card || {}).cls || 'Fighter']?.saves || [])], skills: { ...s0.skills }, background: s0.background, alignment: s0.alignment, languages: s0.languages, features: s0.features, spellAbility: s0.spellAbility });
  const [busy, setBusy] = useState(false);
  const set = k => e => setF(f => ({ ...f, [k]: e.target.value }));
  const setAb = k => e => setF(f => ({ ...f, abilities: { ...f.abilities, [k]: int(e.target.value, 10) } }));
  const cls = f.cls; const die = cls === 'Homebrew' ? int(f.hitDie, 8) : CLASSES[cls]?.die || 8; const con = mod(f.abilities.con);
  const hpSuggest = die + con + (int(f.level, 1) - 1) * (Math.floor(die / 2) + 1 + con);
  const chooseClass = e => { const v = e.target.value; setF(f => ({ ...f, cls: v, saveProf: CLASSES[v] ? [...CLASSES[v].saves] : f.saveProf })); };
  const cycleSkill = k => { const v = ((f.skills[k] || 0) + 1) % 3; const sk = { ...f.skills }; if (v) sk[k] = v; else delete sk[k]; setF(f => ({ ...f, skills: sk })); };
  const submit = async e => { e.preventDefault();
    if (!f.name.trim()) return toast('Gib deinem Charakter einen Namen.');
    if (!f.diceColor) return toast('Wähle eine Würfelfarbe.');
    if (usedColors.includes(f.diceColor)) return toast('Diese Würfelfarbe hat schon jemand anderes.');
    setBusy(true);
    const hpMax = int(f.hpMax, 0) || Math.max(1, hpSuggest);
    const cardData = { name: f.name.trim(), species: f.species === 'Andere' ? f.speciesCustom.trim() || 'Andere' : f.species, cls, clsCustom: f.clsCustom.trim(), hitDie: die, subclass: f.subclass.trim(),
      level: Math.min(20, Math.max(1, int(f.level, 1))), ac: null, speed: int(f.speed, 30), hpMax, diceColor: f.diceColor, updatedAt: Date.now() };
    const sheetData = { ac: int(f.ac, 10), abilities: f.abilities, saveProf: f.saveProf, skills: f.skills, background: f.background.trim(), alignment: f.alignment, languages: f.languages, features: f.features, spellAbility: f.spellAbility, updatedAt: Date.now() };
    try {
      if (isNew) {
        const id = newId();
        await store.batch([
          { type: 'set', path: cardPath(cid, id), data: { ...cardData, ownerUid: user.uid, ownerName: user.name, xp: 0, hp: hpMax, tempHp: 0, conditions: [], exhaustion: 0, locked: false, createdAt: Date.now() } },
          { type: 'set', path: sheetPath(cid, id), data: { ...blankSheet(), ...sheetData, ownerUid: user.uid, resources: suggestedResources(cls, cardData.level, f.abilities).map(r => ({ ...r, id: newId(), used: 0 })) } },
        ]);
        toast(`${cardData.name} ist bereit für das Abenteuer.`); onDone(id);
      } else {
        const c2 = { ...cardData }; if (isDM) c2.xp = Math.max(0, int(f.xp, 0));
        if (hpMax !== card.hpMax) c2.hp = Math.min(card.hp ?? hpMax, hpMax);
        await store.batch([{ type: 'update', path: cardPath(cid, card.id), data: c2 }, { type: 'merge', path: sheetPath(cid, card.id), data: sheetData }]);
        toast('Gespeichert.'); onDone(card.id);
      }
    } catch (x) { failed(x); } finally { setBusy(false); }
  };
  const del = async () => { await store.batch([{ type: 'delete', path: sheetPath(cid, card.id) }, { type: 'delete', path: cardPath(cid, card.id) }]); toast('Charakter gelöscht.'); go('c', cid, 'gruppe'); };
  const xpLevel = levelForXp(int(f.xp, 0));
  return html`<form class="form" onSubmit=${submit}>
    <div class="sec"><h3>Wer ist dein Held</h3>${isNew && html`<div class="preview-med"><${Medal} cls=${cls} species=${SPECIES.includes(f.species) ? f.species : ''} size="lg"/><span class="sub">Großes Symbol: Species · kleines Symbol: Klasse</span></div>`}<div class="g g3">
      <${Field} label="Name"><input id="cf-name" value=${f.name} onInput=${set('name')} placeholder="Thorn Ashvale"/></${Field}>
      <${Field} label="Species"><select id="cf-species" value=${SPECIES.includes(f.species) ? f.species : 'Andere'} onChange=${set('species')}>${[...SPECIES, 'Andere'].map(x => html`<option value=${x}>${x === 'Andere' ? '🎲 Andere / Homebrew' : (SPECIES_EMOJI[x] || '') + ' ' + x}</option>`)}</select></${Field}>
      ${!SPECIES.includes(f.species) && html`<${Field} label="Species-Name"><input id="cf-species-c" value=${f.speciesCustom || (f.species !== 'Andere' ? f.species : '')} onInput=${set('speciesCustom')}/></${Field}>`}
      <${Field} label="Klasse"><select id="cf-class" value=${cls} onChange=${chooseClass}>${[...CLASS_NAMES, 'Homebrew'].map(x => html`<option value=${x}>${(CLASS_EMOJI[x] || '') + ' ' + x}</option>`)}</select></${Field}>
      ${cls === 'Homebrew' && html`<${Field} label="Klassenname"><input id="cf-cls-c" value=${f.clsCustom} onInput=${set('clsCustom')}/></${Field}><${Field} label="Hit Die"><select id="cf-hd" value=${f.hitDie} onChange=${set('hitDie')}>${[6, 8, 10, 12].map(d => html`<option value=${d}>d${d}</option>`)}</select></${Field}>`}
      <${Field} label="Subclass" hint="Meist ab Stufe 3"><input id="cf-sub" value=${f.subclass} onInput=${set('subclass')}/></${Field}>
      <${Field} label="Background"><input id="cf-bg" value=${f.background} onInput=${set('background')} placeholder="Soldier"/></${Field}>
      <${Field} label="Alignment"><select id="cf-al" value=${f.alignment} onChange=${set('alignment')}><option value="">–</option>${ALIGNMENTS.map(x => html`<option value=${x}>${x}</option>`)}</select></${Field}>
      <${Field} label="Stufe"><input id="cf-level" type="number" min="1" max="20" value=${f.level} onInput=${set('level')}/></${Field}>
      ${isDM && !isNew && html`<${Field} label="Experience Points" hint=${`Reicht für Stufe ${xpLevel}`}><input id="cf-xp" type="number" min="0" value=${f.xp} onInput=${set('xp')}/></${Field}>`}
    </div></div>
    <div class="sec"><h3>Ability Scores</h3><p class="ro-note">Typisch für Stufe 1: Standard Array 15, 14, 13, 12, 10, 8 auf die sechs Werte verteilen, dann die Boni aus dem Background addieren.</p>
      <div class="abil edit">${ABILITIES.map(a => html`<label class="ab"><span class="label">${a.short}</span><input id=${'cf-' + a.key} type="number" min="1" max="30" value=${f.abilities[a.key]} onInput=${setAb(a.key)}/><span class="m num">${sgn(mod(f.abilities[a.key]))}</span></label>`)}</div>
      <div class="label">Saving Throws (geübt)</div><div class="whoset">${ABILITIES.map(a => html`<label><input type="checkbox" checked=${f.saveProf.includes(a.key)} onChange=${e => setF(f => ({ ...f, saveProf: e.target.checked ? [...f.saveProf, a.key] : f.saveProf.filter(x => x !== a.key) }))}/> ${a.name}</label>`)}</div></div>
    <div class="sec"><h3>Skills</h3><p class="ro-note">Tippen wechselt: ○ ungeübt → ● geübt → ◆ Expertise.</p>
      <div class="skills edit">${SKILLS.map(k => { const v = f.skills[k.key] || 0; return html`<button type="button" class=${'skill' + (v ? ' on' : '')} onClick=${() => cycleSkill(k.key)}><span class=${'mark m' + v}>${v === 2 ? '◆' : v ? '●' : '○'}</span><span class="nm">${k.name}</span><span class="ab-tag">${k.ab.toUpperCase()}</span></button>`; })}</div></div>
    <div class="sec"><h3>Kampfwerte</h3><div class="g g5">
      <${Field} label="Armor Class"><input id="cf-ac" type="number" min="0" value=${f.ac} onInput=${set('ac')}/></${Field}>
      <${Field} label="Speed (ft)"><input id="cf-speed" type="number" min="0" step="5" value=${f.speed} onInput=${set('speed')}/></${Field}>
      <${Field} label="Max HP" hint=${`Vorschlag: ${Math.max(1, hpSuggest)}`}><input id="cf-hp" type="number" min="1" value=${f.hpMax} placeholder=${Math.max(1, hpSuggest)} onInput=${set('hpMax')}/></${Field}>
      ${(CLASSES[cls]?.caster || cls === 'Homebrew') && html`<${Field} label="Spellcasting Ability"><select id="cf-spab" value=${f.spellAbility} onChange=${set('spellAbility')}><option value="">${CLASSES[cls]?.spell ? 'Automatisch (' + CLASSES[cls].spell.toUpperCase() + ')' : 'Keine'}</option>${ABILITIES.map(a => html`<option value=${a.key}>${a.short}</option>`)}</select></${Field}>`}
    </div></div>
    <div class="sec"><h3>Würfelfarbe</h3><p class="ro-note">Jeder Charakter der Kampagne hat seine eigene Farbe, damit am Tisch klar ist, wer gewürfelt hat.</p>
      <div class="swatches dice">${DICE_COLORS.map(d => { const taken = usedColors.includes(d.key); return html`<label class=${'swatch' + (f.diceColor === d.key ? ' on' : '') + (taken ? ' taken' : '')} style=${`--sw:${d.hex}`} title=${taken ? 'Schon vergeben' : d.name}><input type="radio" name="dice" value=${d.key} disabled=${taken} checked=${f.diceColor === d.key} onChange=${set('diceColor')}/><i></i>${d.name}${taken ? ' (vergeben)' : ''}</label>`; })}</div></div>
    <div class="sec"><h3>Features & Sprachen</h3>
      <${Field} label="Features & Traits"><textarea id="cf-feat" value=${f.features} onInput=${set('features')} placeholder="Klassen-Features, Species-Traits, Feats"></textarea></${Field}>
      <${Field} label="Sprachen & weitere Proficiencies"><textarea id="cf-lang" value=${f.languages} onInput=${set('languages')} placeholder="Common, Elvish · Light Armor, Shields · Thieves' Tools"></textarea></${Field}></div>
    <div class="foot"><button class="btn primary" disabled=${busy}>${isNew ? 'Charakter erstellen' : 'Speichern'}</button>${!isNew && html`<button type="button" class="btn" onClick=${() => onDone(card.id)}>Abbrechen</button><span class="spacer"></span><${DeleteButton} question=${`${card.name} löschen?`} onConfirm=${del}/>`}</div>
  </form>`;
}

/* ======================= dice tray ======================= */
export function DiceTray() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('normal');
  const [expr, setExpr] = useState('');
  const [hist, setHist] = useState([]);
  const [color, setColor] = useState(null);
  const modeRef = useRef(mode); modeRef.current = mode;
  const colorRef = useRef(color); colorRef.current = color;
  const [opts, setOpts] = useState({ anim: diceSettings.anim, sound: diceSettings.sound });
  const toggle = k => { diceSettings[k] = !opts[k]; setOpts({ ...opts, [k]: !opts[k] }); };
  // the 3D dice fly first; the result lands in the tray once they settle (or the throw is skipped)
  const push = (label, r) => {
    if (!r) { toast('Das verstehe ich nicht. Beispiel: 2d6+3'); return; }
    const hex = colorRef.current?.hex, entry = { label, r, hex };
    const show = () => { setHist(h => [entry, ...h].slice(0, 25)); setOpen(true); };
    throwDice(r, hex || accentHex(), label).then(show, show);
  };
  useEffect(() => { // fetch the 3D engine in the background so the first throw is instant
    if (!canThrow()) return;
    const t = setTimeout(loadThree, 2500); return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    const onRoll = e => { const d = e.detail; push(d.label, d.result || roll(d.expr, modeRef.current)); };
    const onColor = e => setColor(e.detail);
    addEventListener('dndm-roll', onRoll); addEventListener('dndm-dicecolor', onColor);
    return () => { removeEventListener('dndm-roll', onRoll); removeEventListener('dndm-dicecolor', onColor); };
  }, []);
  const last = hist[0];
  const free = e => { e.preventDefault(); if (!expr.trim()) return; push(expr.trim(), roll(expr, mode)); };
  return html`<button class="dice-fab" style=${color ? `--dc:${color.hex}` : ''} onClick=${() => setOpen(!open)} aria-label="Würfel" aria-expanded=${open}><svg viewBox="0 0 24 24" dangerouslySetInnerHTML=${{ __html: D20 }}></svg></button>
    ${open && html`<aside class="dice-tray" role="dialog" aria-label="Würfel">
      <div class="tray-head"><b>Würfel</b>${color && html`<span class="sub"><span class="dice-dot inline" style=${`--dc:${color.hex}`}></span> ${color.name}</span>`}
        <span class="tray-opts"><button class="tray-opt" aria-pressed=${opts.anim} onClick=${() => toggle('anim')} title=${opts.anim ? '3D-Wurf ausschalten' : '3D-Wurf einschalten'}>3D</button><button class="tray-opt" aria-pressed=${opts.sound} onClick=${() => toggle('sound')} title=${opts.sound ? 'Ton ausschalten' : 'Ton einschalten'} aria-label="Ton">${opts.sound ? '🔊' : '🔇'}</button></span>
        <button class="x" onClick=${() => setOpen(false)} aria-label="Schließen">×</button></div>
      <div class="seg">${[['normal', 'Normal'], ['adv', 'Vorteil'], ['dis', 'Nachteil']].map(([k, l]) => html`<button aria-pressed=${mode === k} onClick=${() => setMode(k)}>${l}</button>`)}</div>
      ${last && html`<div class=${'result' + (last.r.crit ? ' crit' : '') + (last.r.fumble ? ' fumble' : '')} style=${`--dc:${last.hex || 'var(--accent)'}`}>
        <span class="label">${last.label}</span><b class="total num">${last.r.total}</b>
        <span class="breakdown">${last.r.parts.map(p => p.flat !== undefined ? (p.flat >= 0 ? ' + ' + p.flat : ' − ' + Math.abs(p.flat)) : html`${p.sign < 0 ? ' − ' : ''}<span class="die">${p.rolls.join(', ')}</span><span class="sub">d${p.sides}</span>`)}${last.r.dropped !== null ? html` <span class="sub">(${last.r.mode === 'adv' ? 'Vorteil' : 'Nachteil'}, verworfen ${last.r.dropped})</span>` : ''}</span>
        ${last.r.crit && html`<span class="flag-crit">Natürliche 20!</span>`}${last.r.fumble && html`<span class="flag-crit">Natürliche 1</span>`}</div>`}
      <div class="quick">${[4, 6, 8, 10, 12, 20, 100].map(d => html`<button class="btn small" onClick=${() => push('d' + d, roll('1d' + d, d === 20 ? mode : 'normal'))}>d${d}</button>`)}</div>
      <form class="inline-add" onSubmit=${free}><input id="dice-expr" value=${expr} onInput=${e => setExpr(e.target.value)} placeholder="z. B. 2d6+3" autocomplete="off"/><button class="btn primary small">Würfeln</button></form>
      ${hist.length > 1 && html`<div class="hist">${hist.slice(1, 8).map(h => html`<div class="h"><span class="dot" style=${`--dc:${h.hex || 'var(--accent)'}`}></span><span>${h.label}</span><b class="num">${h.r.total}</b></div>`)}</div>`}
    </aside>`}`;
}
