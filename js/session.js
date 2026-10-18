// "Spieltisch": the screen for a game night. Three views:
//  - DM (laptop): every number of every character, combat control, map, the action log
//  - players (phone): their own character, sorted for what is happening right now
//  - table screen (tablet, see table.js): what everyone at the table may see
// The page switches between "telling the story" and "fight" by itself (camp.combat).
import { html, useState, useEffect, Medal, Empty, Spinner, HpBar, toast, failed, applyTheme, href, go, int, useDoc } from './ui.js';
import { store, newId } from './data.js';
import { clsName } from './cards.js';
import { CharQuick } from './character.js';
import { useCampaign, RevealPopup, RevealModal, KINDS } from './campaign.js';
import { TurnHelpButton } from './help.js';
import { searchWiki } from './wiki.js';
import { FoeForm, FoeSheet } from './foes.js';
import { BattleMap } from './map.js';
import { ActionLog, logEntry } from './log.js';
import { ABILITIES, SKILLS, CLASSES, profBonus, mod, sgn, autoSlots, isPact, diceHex } from './rules5e.js';

const rnd = n => 1 + Math.floor(Math.random() * n);
const sorted = list => [...list].sort((a, b) => (int(b.init, -99)) - (int(a.init, -99)) || (a.name || '').localeCompare(b.name || ''));

/* ---------- combat control (stored on the campaign: everyone sees it live, only the DM changes it) ---------- */
function useCombat({ camp, cid, chars }) {
  const cb = camp.combat || null, session = camp.table?.session || 0;
  const save = async combat => { try { await store.update(`campaigns/${cid}`, { combat }); } catch (x) { failed(x); } };
  const keepTurn = list => { const curId = cb.list[cb.turn]?.id; return Math.max(0, list.findIndex(r => r.id === curId)); };
  return {
    cb,
    start: () => { save({ round: 1, turn: 0, list: sorted(chars.map(c => ({ id: newId(), name: c.name, charId: c.id, kind: 'pc', init: '' }))) }); logEntry(cid, { kind: 'combat', label: 'Kampf beginnt · Runde 1', session }); },
    end: () => { save(null); logEntry(cid, { kind: 'combat', label: `Kampf vorbei nach ${cb.round} ${cb.round === 1 ? 'Runde' : 'Runden'}`, session }); },
    setRow: (id, patch) => save({ ...cb, list: cb.list.map(r => (r.id === id ? { ...r, ...patch } : r)) }),
    sortNow: () => { const list = sorted(cb.list); save({ ...cb, list, turn: keepTurn(list) }); },
    next: () => { const n = cb.turn + 1; if (n >= cb.list.length) { save({ ...cb, turn: 0, round: cb.round + 1 }); logEntry(cid, { kind: 'round', label: `Runde ${cb.round + 1}`, session }); } else save({ ...cb, turn: n }); },
    prev: () => { const n = cb.turn - 1; save(n < 0 ? { ...cb, turn: cb.list.length - 1, round: Math.max(1, cb.round - 1) } : { ...cb, turn: n }); },
    remove: id => { const i = cb.list.findIndex(r => r.id === id); const list = cb.list.filter(r => r.id !== id); save({ ...cb, list, turn: Math.min(i < cb.turn ? cb.turn - 1 : cb.turn, Math.max(0, list.length - 1)) }); },
    // several of the same kind get numbers: Goblin Warrior 1, 2, 3 (continuing if some are already in the fight)
    addFoes: (n, base, init) => {
      const taken = cb.list.filter(r => r.kind === 'npc' && (r.name === base.name || r.name.startsWith(base.name + ' '))).length;
      const rows = Array.from({ length: n }, (_, i) => ({ id: newId(), kind: 'npc', name: n > 1 || taken ? `${base.name} ${taken + i + 1}` : base.name,
        init, initBonus: base.initBonus || 0, ac: base.ac, hp: base.hp, hpMax: base.hp, xp: base.xp || 0, attacks: base.attacks || [], note: base.note || '' }));
      const list = sorted([...cb.list, ...rows]); save({ ...cb, list, turn: keepTurn(list) }); toast(n > 1 ? `${n} Gegner hinzugefügt.` : `${rows[0].name} hinzugefügt.`); },
    rollFoes: () => { const list = sorted(cb.list.map(r => (r.kind === 'npc' && r.init === '' ? { ...r, init: rnd(20) + (r.initBonus || 0) } : r))); save({ ...cb, list, turn: 0 }); toast('Initiative für Gegner gewürfelt.'); },
  };
}

/* ---------- the strip everyone sees in a fight: round, order, who is up ---------- */
export function TurnStrip({ cb, chars, user, dm, big }) {
  if (!cb) return null;
  const cur = cb.list[cb.turn];
  const mine = cur?.kind === 'pc' && chars.find(c => c.id === cur.charId)?.ownerUid === user?.uid;
  return html`<div class=${'turnstrip' + (big ? ' big' : '')}>
    <span class="ts-round">Runde ${cb.round}</span>
    <ol class="ts-order">${cb.list.map((r, i) => { const foe = r.kind === 'npc', down = foe && (r.hp ?? 1) <= 0, ch = !foe && chars.find(c => c.id === r.charId);
      return html`<li class=${(foe ? 'npc' : 'pc') + (i === cb.turn ? ' now' : '') + (down ? ' down' : '') + (ch && ch.ownerUid === user?.uid ? ' me' : '')}>
        ${dm && html`<span class="ts-init num">${r.init === '' ? '?' : r.init}</span>`}${r.name}${foe && r.hpMax && !down ? html`<i class="ts-hp" style=${`--p:${Math.max(0, Math.min(100, (r.hp ?? r.hpMax) / r.hpMax * 100))}%`}></i>` : ''}</li>`; })}</ol>
    ${!dm && (mine ? html`<div class="your-turn">🎯 Du bist dran! <${TurnHelpButton} cls="btn small"/></div>`
      : cur ? html`<div class="ts-now">${cur.kind === 'npc' ? '👹' : '👉'} ${cur.name} ist dran</div>` : '')}
  </div>`;
}

/* ---------- DM: combat list with initiative, the foe sheet of whoever is up, adding enemies ---------- */
function CombatPanel({ camp, cid, chars, user, c }) {
  const { cb } = c; const [sel, setSel] = useState(null);
  const cur = cb.list[cb.turn];
  const sheet = cb.list.find(r => r.id === sel && r.kind === 'npc') || (cur?.kind === 'npc' ? cur : null);
  const foes = cb.list.filter(r => r.kind === 'npc'), xp = foes.reduce((t, r) => t + (r.xp || 0), 0);
  const actor = { cid, uid: user.uid, session: camp.table?.session || 0 };
  return html`<section class="panel box combat">
    <div class="box-head"><h2><span class="ico" aria-hidden="true">⚔️</span>Kampf</h2>
      <span class="sub">${foes.filter(r => (r.hp ?? 1) > 0).length} Feinde stehen${xp ? ` · ${xp} XP` : ''}</span>
      <span class="help-dot" tabindex="0" title="Tippe einen Gegner an, um seinen Bogen zu öffnen. Ist ein Gegner am Zug, öffnet sich sein Bogen von selbst. Spieler sagen dir ihre Initiative, du trägst sie links ein.">?</span></div>
    <ol class="init-list">${cb.list.map((r, i) => { const ch = r.charId && chars.find(x => x.id === r.charId); const now = i === cb.turn; const foe = r.kind === 'npc'; const down = foe && (r.hp ?? 1) <= 0;
      return html`<li class=${(now ? 'now ' : '') + (foe ? 'npc' : 'pc') + (down ? ' down' : '') + (foe ? ' tap' : '') + (sheet && sheet.id === r.id ? ' open' : '')} onClick=${foe ? () => setSel(sel === r.id ? null : r.id) : null}>
        <span class="i-init" onClick=${e => e.stopPropagation()}><input type="number" aria-label="Initiative" value=${r.init} onChange=${e => c.setRow(r.id, { init: e.target.value === '' ? '' : int(e.target.value, 0) })} placeholder="?"/></span>
        <span class="i-who">${ch ? html`<${Medal} cls=${ch.cls} species=${ch.species} size="md"/>` : html`<span class="foe-ico" aria-hidden="true">${down ? '💀' : '👹'}</span>`}
          <span><b>${r.name}</b>${ch ? html`<small>${ch.hp ?? 0} / ${ch.hpMax ?? 0} HP${ch.conc ? ` · 🧠 ${ch.conc}` : ''}${(ch.conditions || []).length ? ' · ' + ch.conditions.join(', ') : ''}</small>`
            : html`<small>${down ? 'Am Boden' : `AC ${r.ac ?? '–'}`}</small>`}</span></span>
        ${foe && r.hpMax ? html`<span class="i-hp"><span class="num"><b>${r.hp ?? r.hpMax}</b><small> / ${r.hpMax}</small></span><${HpBar} hp=${r.hp ?? r.hpMax} max=${r.hpMax}/></span>` : html`<span></span>`}
        <button class="x" aria-label="Entfernen" onClick=${e => { e.stopPropagation(); if (sel === r.id) setSel(null); c.remove(r.id); }}>×</button></li>`; })}</ol>
    ${sheet && html`<${FoeSheet} key=${sheet.id} r=${sheet} now=${sheet.id === cur?.id} actor=${actor} onPatch=${patch => c.setRow(sheet.id, patch)} onClose=${sel ? () => setSel(null) : null}/>`}
    <div class="actions"><button class="btn small" onClick=${c.sortNow}>Sortieren</button>${foes.some(r => r.init === '') && html`<button class="btn small" onClick=${c.rollFoes}>🎲 Gegner-Initiative</button>`}</div>
    <${FoeForm} onAdd=${c.addFoes}/>
  </section>`;
}

/* ---------- DM: every character with all the numbers that matter at the table ---------- */
function PartyBoard({ cid, chars, camp }) {
  const cur = camp.combat?.list?.[camp.combat.turn];
  return html`<section class="panel box party-board">
    <div class="box-head"><h2><span class="ico" aria-hidden="true">👥</span>Gruppe</h2><span class="sub">Alle Werte live</span></div>
    ${chars.length ? html`<div class="pb-list">${chars.map(c => html`<${PartyCard} key=${c.id} c=${c} cid=${cid} now=${cur?.charId === c.id}/>`)}</div>`
      : html`<p class="muted">Noch keine Charaktere. Deine Spieler treten mit dem Einladungscode bei und legen ihren Charakter an.</p>`}</section>`;
}
function PartyCard({ c, cid, now }) {
  const sheet = useDoc(`campaigns/${cid}/characters/${c.id}/sheet/main`);
  const [amt, setAmt] = useState(''); const [more, setMore] = useState(false);
  const s = { abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, skills: {}, saveProf: [], resources: [], ...(sheet || {}) };
  const lvl = c.level || 1, pb = profBonus(lvl), ab = k => mod(s.abilities[k]);
  const skill = key => { const k = SKILLS.find(x => x.key === key); return ab(k.ab) + (s.skills[key] || 0) * pb; };
  const spAb = s.spellAbility || CLASSES[c.cls]?.spell || '';
  const slots = (s.slotsOverride || autoSlots(c.cls, lvl)).map((n, i) => ({ lv: i + 1, n, left: n - ((s.slotsUsed || [])[i] || 0) })).filter(x => x.n);
  const hp = c.hp ?? 0, max = c.hpMax ?? 0, ds = s.deathSaves || { ok: 0, fail: 0 };
  const hit = async sign => { const n = int(amt, 0); if (!n) return toast('Zahl eingeben.');
    let h = hp, temp = c.tempHp || 0;
    if (sign < 0) { const fromTemp = Math.min(temp, n); temp -= fromTemp; h = Math.max(0, h - (n - fromTemp)); } else h = Math.min(max || h + n, h + n);
    try { await store.update(`campaigns/${cid}/characters/${c.id}`, { hp: h, tempHp: temp, updatedAt: Date.now() }); setAmt('');
      if (sign < 0 && c.conc && h > 0) toast(`${c.name} konzentriert sich auf ${c.conc}: CON Save, DC ${Math.max(10, Math.floor(n / 2))}.`); } catch (x) { failed(x); } };
  const K = (label, val, title) => html`<span class="kv" title=${title || ''}><small>${label}</small><b class="num">${val}</b></span>`;
  return html`<article class=${'pcard' + (now ? ' now' : '') + (hp <= 0 ? ' down' : '')} style=${c.diceColor ? `--lc:${diceHex(c.diceColor)}` : ''}>
    <div class="pc-top">
      <a class="pc-who" href=${href('c', cid, 'char', c.id)}><${Medal} cls=${c.cls} species=${c.species} size="md"/><span><b>${c.name}</b><small>${clsName(c)} ${lvl} · ${c.ownerName || ''}</small></span></a>
      <div class="pc-hp"><span class="num"><b>${hp}</b> / ${max}${c.tempHp ? html` <span class="xp">+${c.tempHp}</span>` : ''}</span><${HpBar} hp=${hp} max=${max}/></div>
      <div class="pc-dm"><input type="number" min="0" aria-label=${'Wert für ' + c.name} placeholder="±" value=${amt} onInput=${e => setAmt(e.target.value)} onKeyDown=${e => { if (e.key === 'Enter') hit(-1); }}/>
        <button class="btn small danger-soft" onClick=${() => hit(-1)} title="Schaden">💥</button><button class="btn small ok-soft" onClick=${() => hit(1)} title="Heilen">💚</button></div>
    </div>
    ${sheet === undefined ? html`<p class="muted small-note">Lädt…</p>` : html`
    <div class="pc-nums">
      ${K('AC', (s.ac ?? c.ac) || '–')}${K('Init', sgn(ab('dex')))}${K('Speed', c.speed || 30)}${K('PB', sgn(pb))}
      ${K('👁 Wahrn.', 10 + skill('perception'), 'Passive Perception')}${K('Einsicht', 10 + skill('insight'), 'Passive Insight')}${K('Unters.', 10 + skill('investigation'), 'Passive Investigation')}
      ${spAb && html`${K('Zauber-DC', 8 + pb + ab(spAb), 'Spell Save DC')}${K('Zauber-Atk', sgn(pb + ab(spAb)), 'Spell Attack')}`}
    </div>
    <div class="pc-saves">${ABILITIES.map(a => { const prof = (s.saveProf || []).includes(a.key); return html`<span class=${'sv' + (prof ? ' prof' : '')} title=${a.name + ' Save' + (prof ? ' (geübt)' : '')}>${a.short} <b class="num">${sgn(ab(a.key) + (prof ? pb : 0))}</b></span>`; })}</div>
    <div class="pc-state">
      ${slots.length ? html`<span class="st-slots">${isPact(c.cls) ? 'Pact' : 'Slots'} ${slots.map(x => html`<span title=${`Stufe ${x.lv}: ${x.left} von ${x.n} frei`}>${x.lv}: ${Array.from({ length: x.n }, (_, i) => html`<i class=${i < x.left ? 'on' : ''}></i>`)}</span>`)}</span>` : ''}
      ${(s.resources || []).map(r => html`<span class="st-res" title=${r.name}>${r.name} <b class="num">${Math.max(0, (r.max || 0) - (r.used || 0))}/${r.max}</b></span>`)}
      ${c.conc && html`<span class="chip conc">🧠 ${c.conc}</span>`}
      ${(c.conditions || []).map(x => html`<span class="chip cond">${x}</span>`)}${c.exhaustion ? html`<span class="chip cond">Exhaustion ${c.exhaustion}</span>` : ''}
      ${s.inspiration && html`<span class="chip insp">🌟 Inspiration</span>`}
      ${hp <= 0 && html`<span class="chip cond">💀 Death Saves ${ds.ok}✓ ${ds.fail}✗</span>`}
    </div>
    <button class="link quiet small pc-more" onClick=${() => setMore(!more)}>${more ? 'Weniger' : 'Alle Skills & Werte'}</button>
    ${more && html`<div class="pc-skills">${SKILLS.map(k => html`<span class=${'sk' + (s.skills[k.key] ? ' prof' : '')}>${k.name} <b class="num">${sgn(skill(k.key))}</b></span>`)}</div>
      <div class="pc-abil">${ABILITIES.map(a => html`<span>${a.short} <b class="num">${s.abilities[a.key]}</b> <small>${sgn(ab(a.key))}</small></span>`)}</div>`}`}
  </article>`;
}

/* ---------- DM: what is happening now (place + mood, shown on the table screen) ---------- */
function SceneBar({ camp, cid, user }) {
  const t = camp.table || {};
  const [f, setF] = useState(null); const cur = f || { place: t.place || '', mood: t.mood || '' };
  const save = async e => { e?.preventDefault(); if (!f) return;
    try { await store.update(`campaigns/${cid}`, { table: { ...t, place: cur.place.trim(), mood: cur.mood.trim() } });
      if (cur.place.trim() && cur.place.trim() !== (t.place || '')) logEntry(cid, { kind: 'scene', label: cur.place.trim(), session: t.session || 0 });
      setF(null); toast('Szene aktualisiert.'); } catch (x) { failed(x); } };
  const show = async v => { try { await store.update(`campaigns/${cid}`, { table: { ...t, show: v } }); } catch (x) { failed(x); } };
  return html`<form class="panel scenebar" onSubmit=${save}>
    <span class="label">📍 Szene</span>
    <input class="sb-place" value=${cur.place} onInput=${e => setF({ ...cur, place: e.target.value })} placeholder="Ort, z. B. Die Moosfurt" aria-label="Ort"/>
    <input class="sb-mood" value=${cur.mood} onInput=${e => setF({ ...cur, mood: e.target.value })} placeholder="Stimmung fürs Tablet, z. B. Nebel liegt über dem Wasser" aria-label="Stimmung"/>
    ${f && html`<button class="btn small primary">Übernehmen</button>`}
    <span class="sb-show"><span class="label">Tablet zeigt</span><span class="seg small">${[['scene', 'Szene'], ['map', 'Karte']].map(([k, l]) => html`<button type="button" aria-pressed=${(camp.combat ? 'map' : t.show || 'scene') === k} disabled=${!!camp.combat} onClick=${() => show(k)}>${l}</button>`)}</span></span>
  </form>`;
}

/* ---------- DM: prepared for tonight ---------- */
function Tonight({ cid, last, notes, secrets, members }) {
  const [reveal, setReveal] = useState(null);
  const sealed = secrets.filter(s => !s.revealedAt);
  return html`<section class="panel box tonight">
    <div class="box-head"><h2><span class="ico" aria-hidden="true">🌙</span>Heute</h2><a class="link small" href=${href('c', cid, 'notizen')}>Notizen bearbeiten</a></div>
    ${last?.stop && html`<div><span class="label">Wo wir aufgehört haben</span><p class="pre">${last.stop}</p></div>`}
    ${notes?.prep ? html`<details class="fold" open><summary>📝 Vorbereitung</summary><p class="pre">${notes.prep}</p></details>` : html`<p class="muted small-note">Unter DM-Notizen → Vorbereitung kannst du dir den Abend aufschreiben. Er steht dann hier.</p>`}
    ${notes?.secrets && html`<details class="fold"><summary>🤫 Das große Ganze</summary><p class="pre">${notes.secrets}</p></details>`}
    <div><span class="label">Bereit zum Enthüllen · ${sealed.length}</span>
      ${sealed.length ? html`<ul class="seal-list">${sealed.map(s => html`<li><span><b>${s.title}</b><small>${KINDS[s.kind] || 'Geheimnis'}${s.condition ? ` · wenn: ${s.condition}` : ''}</small></span>
        <button class="btn small" onClick=${() => setReveal(s)}>${s.kind === 'quest' ? 'Freischalten' : 'Enthüllen'}</button></li>`)}</ul>`
        : html`<p class="muted small-note">Nichts vorbereitet.</p>`}</div>
    ${reveal && html`<${RevealModal} s=${reveal} cid=${cid} members=${members} onClose=${() => setReveal(null)}/>`}
  </section>`;
}

/* ---------- quick lookup: NPCs and quests in one search ---------- */
function Lookup({ quests, npcs, cid, isDM }) {
  const [q, setQ] = useState(''); const [open, setOpen] = useState(null);
  const ql = q.trim().toLowerCase();
  const act = quests.filter(x => (x.status || 'active') === 'active');
  const hitN = npcs.filter(n => !ql || `${n.name} ${n.role || ''} ${n.location || ''} ${n.notes || ''}`.toLowerCase().includes(ql)).slice(0, ql ? 10 : 6);
  const hitQ = (ql ? quests.filter(x => `${x.title} ${x.location || ''} ${x.desc || x.description || ''}`.toLowerCase().includes(ql)) : act).slice(0, 6);
  const rules = searchWiki(q, ql ? 6 : 0);
  const Item = (id, title, sub, body) => html`<li class=${open === id ? 'open' : ''}><button onClick=${() => setOpen(open === id ? null : id)}><b>${title}</b>${sub && html`<small>${sub}</small>`}</button>${open === id && body && html`<p class="pre">${body}</p>`}</li>`;
  return html`<section class="panel box lookup">
    <div class="box-head"><h2><span class="ico" aria-hidden="true">🔎</span>Nachschlagen</h2><a class="link small" href=${href('c', cid, 'npcs')}>Alle NPCs</a></div>
    <input type="search" placeholder="NPC, Quest oder Regel, z. B. AC" value=${q} onInput=${e => setQ(e.target.value)} aria-label="NPCs, Quests und Regeln durchsuchen"/>
    ${!ql && html`<div class="lk-rules"><${TurnHelpButton} cls="btn small"/><a class="btn small" href="#/wiki">📖 Alle Begriffe & Regeln</a></div>`}
    ${rules.length > 0 && html`<span class="label">Regeln & Begriffe</span><ul class="lk-list">${rules.map(x => Item('w' + x.t, html`${x.t}${x.a ? html` <span class="w-abbr">${x.a}</span>` : ''}`, [x.de, x.icon + ' ' + x.sec].filter(Boolean).join(' · '), x.d + (x.x ? '\n\nBeispiel: ' + x.x : '')))}</ul>`}
    ${hitQ.length > 0 && html`<span class="label">${ql ? 'Quests' : 'Laufende Quests'}</span><ul class="lk-list">${hitQ.map(x => Item('q' + x.id, x.title, [x.giver && 'von ' + x.giver, x.location].filter(Boolean).join(' · '), [x.description, x.reward && 'Belohnung: ' + x.reward].filter(Boolean).join('\n\n')))}</ul>`}
    ${hitN.length > 0 && html`<span class="label">${ql ? 'NPCs' : 'Zuletzt getroffen'}</span><ul class="lk-list">${hitN.map(n => Item('n' + n.id, n.name, [n.role, n.location].filter(Boolean).join(' · '), n.notes))}</ul>`}
    ${ql && !hitQ.length && !hitN.length && !rules.length && html`<p class="muted small-note">Nichts gefunden.</p>`}
  </section>`;
}

/* ---------- players: the rest of the party in one line each ---------- */
function PartyMini({ chars, mine }) {
  const others = chars.filter(c => !mine.includes(c.id));
  if (!others.length) return null;
  return html`<section class="panel box party-mini"><div class="box-head"><h2><span class="ico" aria-hidden="true">👥</span>Deine Gruppe</h2></div>
    ${others.map(c => html`<div class="pm-row"><${Medal} cls=${c.cls} species=${c.species} size="md"/><span class="pm-name"><b>${c.name}</b>${(c.conditions || []).length || c.conc ? html`<small>${[c.conc && '🧠 ' + c.conc, ...(c.conditions || [])].filter(Boolean).join(' · ')}</small>` : ''}</span>
      <span class="pm-hp"><span class="num">${c.hp ?? 0}/${c.hpMax ?? 0}</span><${HpBar} hp=${c.hp || 0} max=${c.hpMax || 0}/></span></div>`)}</section>`;
}

/* ---------- page ---------- */
export function SessionPage({ user, cid }) {
  const d = useCampaign(cid, user);
  const { camp, isDM, chars, sessions, quests, npcs, revelations, secrets, notes, members } = d;
  useEffect(() => { if (camp) applyTheme(camp.theme); }, [camp?.theme]);
  const num = (sessions[0]?.num ? int(sessions[0].num) : 0) + 1;
  // the DM's screen tells everyone which evening it is, so rolls land in tonight's log
  useEffect(() => { if (camp && isDM && camp.table?.session !== num) store.update(`campaigns/${cid}`, { table: { ...(camp.table || {}), session: num } }).catch(() => {}); }, [camp?.table?.session, isDM, num]);
  if (camp === undefined) return html`<${Spinner}/>`;
  if (!camp) return html`<main class="page"><${Empty} title="Kampagne nicht gefunden">Wähle unter 🏰 Kampagnen eine aktive Kampagne.</${Empty}></main>`;
  return isDM ? html`<${DMView} ...${d} cid=${cid} user=${user} num=${num}/>` : html`<${PlayerView} ...${d} cid=${cid} user=${user} num=${num}/>`;
}

function DMView({ camp, chars, sessions, quests, npcs, secrets, notes, members, cid, user, num }) {
  const c = useCombat({ camp, cid, chars });
  const fight = !!c.cb, showMap = fight || camp.table?.show === 'map';
  const last = sessions[0];
  return html`<main class="page spieltisch dm">
    <header class="st-head">
      <div class="st-id"><span class="label">🎲 Spieltisch · Sitzung ${num}${camp.table?.place ? ` · 📍 ${camp.table.place}` : ''}</span><h1>${camp.name}</h1></div>
      <div class="st-act">
        <button class="btn" onClick=${() => go('tisch')} title="Auf dem Tablet öffnen: zeigt Szene oder Karte für alle">📺 Tischbildschirm</button>
        ${fight ? html`<button class="btn danger-soft" onClick=${c.end}>Kampf beenden</button>` : html`<button class="btn primary" onClick=${c.start}>⚔️ Kampf starten</button>`}
        <details class="st-menu"><summary class="btn" aria-label="Mehr">⋯</summary><div class="st-menu-pop">
          <a href=${href('c', cid)}>🏰 Kampagne</a><a href=${href('c', cid, 'enthuellungen')}>🤯 Enthüllungen</a><a href=${href('c', cid, 'notizen')}>📝 DM-Notizen</a>
          <a href=${href('c', cid, 'npcs')}>🎭 NPCs</a><a href=${href('c', cid, 'sitzungen')}>📖 Sitzung eintragen</a><a href="#/wiki">📚 Wiki: Begriffe & Regeln</a></div></details>
      </div>
    </header>
    <${SceneBar} camp=${camp} cid=${cid} user=${user}/>
    ${fight && html`<div class="st-turn"><button class="btn" onClick=${c.prev} aria-label="Zurück">◀</button><${TurnStrip} cb=${c.cb} chars=${chars} user=${user} dm/><button class="btn primary" onClick=${c.next}>Nächster Zug ▶</button></div>`}
    ${fight ? html`<div class="dm-grid fight">
        <div class="col"><${BattleMap} cid=${cid} camp=${camp} chars=${chars} isDM user=${user} npcs=${npcs}/><${PartyBoard} cid=${cid} chars=${chars} camp=${camp}/></div>
        <div class="col"><${CombatPanel} camp=${camp} cid=${cid} chars=${chars} user=${user} c=${c}/><${ActionLog} cid=${cid} camp=${camp} chars=${chars} user=${user} compact/></div>
      </div>`
      : html`${showMap && html`<${BattleMap} cid=${cid} camp=${camp} chars=${chars} isDM user=${user} npcs=${npcs}/>`}
      <div class="dm-grid calm">
        <div class="col"><${Tonight} cid=${cid} last=${last} notes=${notes} secrets=${secrets} members=${members}/><${Lookup} quests=${quests} npcs=${npcs} cid=${cid} isDM/></div>
        <div class="col"><${PartyBoard} cid=${cid} chars=${chars} camp=${camp}/></div>
        <div class="col"><${ActionLog} cid=${cid} camp=${camp} chars=${chars} user=${user}/></div>
      </div>`}
  </main>`;
}

function PlayerView({ camp, chars, sessions, quests, npcs, revelations, cid, user, num }) {
  const mine = chars.filter(c => c.ownerUid === user.uid);
  const last = sessions[0], fight = !!camp.combat;
  return html`<main class="page spieltisch player">
    <header class="st-head small">
      <div class="st-id"><span class="label">🎲 Spieltisch · Sitzung ${num}</span><h1>${camp.name}</h1>${camp.table?.place && html`<span class="st-place">📍 ${camp.table.place}</span>`}</div>
      <${TurnHelpButton} cls="btn small"/></header>
    ${fight ? html`<${TurnStrip} cb=${camp.combat} chars=${chars} user=${user}/>` : last?.stop && html`<details class="fold st-stop"><summary>📍 Wo wir aufgehört haben</summary><p class="pre">${last.stop}</p></details>`}
    ${mine.map(c => html`<${CharQuick} key=${c.id} user=${user} cid=${cid} chId=${c.id} camp=${camp}/>`)}
    ${!mine.length && html`<${Empty} title="Noch kein Charakter in dieser Kampagne" action=${html`<a class="btn primary" href=${href('c', cid, 'neu')}>Charakter erstellen</a>`}>Ohne Charakter kannst du zuschauen, aber nicht würfeln.</${Empty}>`}
    <div class="ov">
      <div class="ov-col"><${PartyMini} chars=${chars} mine=${mine.map(c => c.id)}/></div>
      <div class="ov-col"><${Lookup} quests=${quests} npcs=${npcs} cid=${cid}/></div>
    </div>
    <${RevealPopup} cid=${cid} items=${revelations}/>
  </main>`;
}
