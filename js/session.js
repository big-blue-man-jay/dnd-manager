// "Im Spiel": the one screen you keep open during a game night.
import { html, useState, useEffect, Medal, Empty, Spinner, HpBar, toast, failed, applyTheme, href, int } from './ui.js';
import { store, newId } from './data.js';
import { clsName } from './cards.js';
import { CharQuick } from './character.js';
import { useCampaign, RevealPopup } from './campaign.js';
import { TurnHelpButton } from './help.js';
import { FoeForm, FoeSheet } from './foes.js';
import { BattleMap } from './map.js';

const rnd = n => 1 + Math.floor(Math.random() * n);

/* ---------- initiative tracker (stored on the campaign, so everyone sees it live; only the DM changes it) ---------- */
function Initiative({ camp, cid, isDM, chars, user }) {
  const cb = camp.combat || null;
  const [sel, setSel] = useState(null); // foe sheet the DM opened by tapping a row
  const save = async combat => { try { await store.update(`campaigns/${cid}`, { combat }); } catch (x) { failed(x); } };
  const sorted = list => [...list].sort((a, b) => (int(b.init, -99)) - (int(a.init, -99)) || (a.name || '').localeCompare(b.name || ''));
  const keepTurn = list => { const curId = cb.list[cb.turn]?.id; return Math.max(0, list.findIndex(r => r.id === curId)); };
  const start = () => save({ round: 1, turn: 0, list: sorted(chars.map(c => ({ id: newId(), name: c.name, charId: c.id, kind: 'pc', init: '' }))) });
  const setRow = (id, patch) => { const list = cb.list.map(r => (r.id === id ? { ...r, ...patch } : r)); save({ ...cb, list }); };
  const sortNow = () => { const list = sorted(cb.list); save({ ...cb, list, turn: keepTurn(list) }); };
  const next = () => { const n = cb.turn + 1; setSel(null); save(n >= cb.list.length ? { ...cb, turn: 0, round: cb.round + 1 } : { ...cb, turn: n }); };
  const prev = () => { const n = cb.turn - 1; setSel(null); save(n < 0 ? { ...cb, turn: cb.list.length - 1, round: Math.max(1, cb.round - 1) } : { ...cb, turn: n }); };
  const remove = id => { const i = cb.list.findIndex(r => r.id === id); const list = cb.list.filter(r => r.id !== id); if (sel === id) setSel(null);
    save({ ...cb, list, turn: Math.min(i < cb.turn ? cb.turn - 1 : cb.turn, Math.max(0, list.length - 1)) }); };
  // several of the same kind get numbers: Goblin Warrior 1, 2, 3 (continuing if some are already in the fight)
  const addFoes = (n, base, init) => {
    const taken = cb.list.filter(r => r.kind === 'npc' && (r.name === base.name || r.name.startsWith(base.name + ' '))).length;
    const rows = Array.from({ length: n }, (_, i) => ({ id: newId(), kind: 'npc', name: n > 1 || taken ? `${base.name} ${taken + i + 1}` : base.name,
      init, initBonus: base.initBonus || 0, ac: base.ac, hp: base.hp, hpMax: base.hp, xp: base.xp || 0, attacks: base.attacks || [], note: base.note || '' }));
    const list = sorted([...cb.list, ...rows]); save({ ...cb, list, turn: keepTurn(list) }); toast(n > 1 ? `${n} Gegner hinzugefügt.` : `${rows[0].name} hinzugefügt.`); };
  const rollFoes = () => { const list = sorted(cb.list.map(r => (r.kind === 'npc' && r.init === '' ? { ...r, init: rnd(20) + (r.initBonus || 0) } : r))); save({ ...cb, list, turn: 0 }); toast('Initiative für Gegner gewürfelt.'); };
  const end = () => { setSel(null); save(null); };

  if (!cb) return html`<section class="panel box"><div class="box-head"><h2><span class="ico" aria-hidden="true">⚔️</span>Kampf</h2></div>
    ${isDM ? html`<p class="muted">Wenn es losgeht: Kampf starten. Alle Charaktere kommen automatisch in die Liste, Gegner fügst du dazu.</p><div><button class="btn primary" onClick=${start}>⚔️ Kampf starten</button></div>`
      : html`<p class="muted">Gerade kein Kampf. Sobald dein DM einen startet, siehst du hier die Reihenfolge.</p>`}</section>`;

  const cur = cb.list[cb.turn];
  const mineNow = cur?.kind === 'pc' && chars.find(c => c.id === cur.charId)?.ownerUid === user.uid;
  const foes = cb.list.filter(r => r.kind === 'npc'), pcs = cb.list.filter(r => r.kind !== 'npc');
  const xp = foes.reduce((t, r) => t + (r.xp || 0), 0);
  const sheet = isDM && (cb.list.find(r => r.id === sel && r.kind === 'npc') || (cur?.kind === 'npc' ? cur : null));
  return html`<section class="panel box combat">
    <div class="box-head"><h2><span class="ico" aria-hidden="true">⚔️</span>Kampf · Runde ${cb.round}</h2>${isDM && html`<button class="link quiet small" onClick=${end}>Kampf beenden</button>`}</div>
    <div class="sides"><span class="side pc">👥 Gruppe · ${pcs.length}</span><span class="side npc">👹 Feinde · ${foes.filter(r => (r.hp ?? 1) > 0).length}${foes.some(r => (r.hp ?? 1) <= 0) ? ` (${foes.filter(r => (r.hp ?? 1) <= 0).length} am Boden)` : ''}${isDM && xp ? ` · ${xp} XP` : ''}</span></div>
    ${mineNow && html`<div class="your-turn">🎯 Du bist dran! <${TurnHelpButton} cls="btn small"/></div>`}
    ${cur?.kind === 'npc' && !isDM && html`<div class="foe-turn">👹 ${cur.name} ist am Zug …</div>`}
    <ol class="init-list">${cb.list.map((r, i) => { const ch = r.charId && chars.find(c => c.id === r.charId); const now = i === cb.turn; const foe = r.kind === 'npc'; const down = foe && (r.hp ?? 1) <= 0;
      return html`<li class=${(now ? 'now ' : '') + (foe ? 'npc' : 'pc') + (down ? ' down' : '') + (foe && isDM ? ' tap' : '') + (sheet && sheet.id === r.id ? ' open' : '')} onClick=${foe && isDM ? () => setSel(sel === r.id ? null : r.id) : null}>
        <span class="i-init" onClick=${e => e.stopPropagation()}>${isDM ? html`<input type="number" aria-label="Initiative" value=${r.init} onChange=${e => setRow(r.id, { init: e.target.value === '' ? '' : int(e.target.value, 0) })} placeholder="?"/>` : html`<b class="num">${r.init === '' ? '–' : r.init}</b>`}</span>
        <span class="i-who">${ch ? html`<${Medal} cls=${ch.cls} species=${ch.species} size="md"/>` : html`<span class="foe-ico" aria-hidden="true">${down ? '💀' : '👹'}</span>`}
          <span><b>${r.name}</b>${ch ? html`<small>${ch.hp ?? 0} / ${ch.hpMax ?? 0} HP${(ch.conditions || []).length ? ' · ' + ch.conditions.join(', ') : ''}</small>`
            : html`<small>${down ? 'Am Boden' : 'Feind'}${isDM && r.ac ? ` · AC ${r.ac}` : ''}</small>`}</span></span>
        ${foe && r.hpMax ? html`<span class="i-hp"><span class="num"><b>${r.hp ?? r.hpMax}</b><small> / ${r.hpMax}</small></span><${HpBar} hp=${r.hp ?? r.hpMax} max=${r.hpMax}/></span>` : html`<span></span>`}
        ${isDM ? html`<button class="x" aria-label="Entfernen" onClick=${e => { e.stopPropagation(); remove(r.id); }}>×</button>` : html`<span></span>`}</li>`; })}</ol>
    ${sheet && html`<${FoeSheet} key=${sheet.id} r=${sheet} now=${sheet.id === cur?.id} onPatch=${patch => setRow(sheet.id, patch)} onClose=${sel ? () => setSel(null) : null}/>`}
    ${isDM && html`<div class="actions"><button class="btn" onClick=${prev}>◀</button><button class="btn primary" onClick=${next}>Nächster Zug ▶</button><button class="btn small" onClick=${sortNow}>Sortieren</button>${foes.some(r => r.init === '') && html`<button class="btn small" onClick=${rollFoes}>🎲 Gegner würfeln</button>`}</div>
      <${FoeForm} onAdd=${addFoes}/>
      <p class="muted small-note">Tippe auf einen Gegner, um seinen Bogen zu öffnen. Ist ein Gegner am Zug, öffnet sich sein Bogen von selbst. Alle sehen die HP der Gegner live, AC und Angriffe nur du. Initiative der Spieler: Sie tippen auf ⚡ Initiative in ihrem Bogen und sagen dir die Zahl.</p>`}
  </section>`;
}

/* ---------- party with quick HP for the DM ---------- */
function PartyLive({ chars, isDM, cid }) {
  const [amt, setAmt] = useState({});
  const hit = async (c, sign) => { const n = int(amt[c.id], 0); if (!n) return toast('Zahl eingeben.');
    let hp = c.hp ?? 0, temp = c.tempHp || 0;
    if (sign < 0) { const fromTemp = Math.min(temp, n); temp -= fromTemp; hp = Math.max(0, hp - (n - fromTemp)); } else hp = Math.min(c.hpMax || hp + n, hp + n);
    try { await store.update(`campaigns/${cid}/characters/${c.id}`, { hp, tempHp: temp, updatedAt: Date.now() }); setAmt({ ...amt, [c.id]: '' }); } catch (x) { failed(x); } };
  return html`<section class="panel box"><div class="box-head"><h2><span class="ico" aria-hidden="true">👥</span>Gruppe</h2></div>
    ${chars.length ? html`<div class="party-live">${chars.map(c => html`<div class="pl-row">
      <a class="pl-who" href=${href('c', cid, 'char', c.id)}><${Medal} cls=${c.cls} species=${c.species} size="md"/><span><b>${c.name}</b><small>${clsName(c)} ${c.level || 1} · ${c.ownerName || ''}</small></span></a>
      <div class="pl-hp"><span class="num"><b>${c.hp ?? 0}</b> / ${c.hpMax ?? 0}${c.tempHp ? html` <span class="xp">+${c.tempHp}</span>` : ''}</span><${HpBar} hp=${c.hp || 0} max=${c.hpMax || 0}/>
        ${(c.conditions || []).length ? html`<div class="chips">${c.conditions.map(x => html`<span class="chip cond">${x}</span>`)}</div>` : ''}</div>
      ${isDM && html`<div class="pl-dm"><input type="number" min="0" aria-label=${'Wert für ' + c.name} placeholder="±" value=${amt[c.id] || ''} onInput=${e => setAmt({ ...amt, [c.id]: e.target.value })}/><button class="btn small danger-soft" onClick=${() => hit(c, -1)} aria-label="Schaden">💥</button><button class="btn small ok-soft" onClick=${() => hit(c, 1)} aria-label="Heilen">💚</button></div>`}
    </div>`)}</div>` : html`<p class="muted">Noch keine Charaktere in dieser Kampagne.</p>`}</section>`;
}

/* ---------- quick lookups ---------- */
function Lookup({ quests, npcs, cid }) {
  const [q, setQ] = useState('');
  const act = quests.filter(x => (x.status || 'active') === 'active');
  const found = npcs.filter(n => !q || `${n.name} ${n.role || ''} ${n.location || ''}`.toLowerCase().includes(q.toLowerCase())).slice(0, 8);
  return html`<section class="panel box"><div class="box-head"><h2><span class="ico" aria-hidden="true">🗺️</span>Laufende Quests</h2><a class="link small" href=${href('c', cid, 'quests')}>Alle</a></div>
      ${act.length ? html`<ul class="plain-list">${act.map(x => html`<li><b>${x.title}</b>${x.location && html`<small> · ${x.location}</small>`}</li>`)}</ul>` : html`<p class="muted">Keine offenen Quests.</p>`}
    <div class="box-head" style="margin-top:6px"><h2><span class="ico" aria-hidden="true">🎭</span>NPCs</h2><a class="link small" href=${href('c', cid, 'npcs')}>Alle</a></div>
      <input type="search" placeholder="Name, Rolle oder Ort suchen" value=${q} onInput=${e => setQ(e.target.value)} aria-label="NPC suchen"/>
      ${found.length ? html`<ul class="plain-list">${found.map(n => html`<li><b>${n.name}</b><small>${[n.role, n.location].filter(Boolean).join(' · ')}</small>${n.notes && html`<small class="clamp">${n.notes}</small>`}</li>`)}</ul>` : html`<p class="muted">Niemand gefunden.</p>`}</section>`;
}

export function SessionPage({ user, cid }) {
  const d = useCampaign(cid, user);
  const { camp, isDM, chars, sessions, quests, npcs, revelations } = d;
  useEffect(() => { if (camp) applyTheme(camp.theme); }, [camp?.theme]);
  if (camp === undefined) return html`<${Spinner}/>`;
  if (!camp) return html`<main class="page"><${Empty} title="Kampagne nicht gefunden">Wähle unter 🏰 Kampagnen eine aktive Kampagne.</${Empty}></main>`;
  const mine = chars.filter(c => c.ownerUid === user.uid);
  const last = sessions[0];
  return html`<main class="page session">
    <section class="hero session-hero"><div class="flag"><span class="label"><span class="ico" aria-hidden="true">🎲</span>Im Spiel</span></div>
      <h1>${camp.name}</h1>
      <div class="actions"><span class="sub">Sitzung ${(last?.num || 0) + 1}</span><${TurnHelpButton} cls="btn small"/><a class="btn small" href=${href('c', cid)}>🏰 Kampagne</a>
        ${isDM && html`<a class="btn small" href=${href('c', cid, 'enthuellungen')}>🤯 Enthüllen</a><a class="btn small" href=${href('c', cid, 'notizen')}>📝 DM-Notizen</a><a class="btn small primary" href=${href('c', cid, 'sitzungen')}>📖 Sitzung eintragen</a>`}</div>
      ${last?.stop && html`<p class="stopbig"><span class="label"><span class="ico" aria-hidden="true">📍</span>Wo wir aufgehört haben</span><br/>${last.stop}</p>`}</section>
    <div class="play-top">
      <${BattleMap} cid=${cid} camp=${camp} chars=${chars} isDM=${isDM} user=${user}/>
      <${Initiative} camp=${camp} cid=${cid} isDM=${isDM} chars=${chars} user=${user}/>
    </div>
    ${mine.map(c => html`<${CharQuick} key=${c.id} user=${user} cid=${cid} chId=${c.id} camp=${camp}/>`)}
    ${!mine.length && !isDM && html`<${Empty} title="Noch kein Charakter in dieser Kampagne" action=${html`<a class="btn primary" href=${href('c', cid, 'neu')}>Charakter erstellen</a>`}>Ohne Charakter kannst du zuschauen, aber nicht würfeln.</${Empty}>`}
    <div class="ov">
      <div class="ov-col"><${PartyLive} chars=${chars} isDM=${isDM} cid=${cid}/></div>
      <div class="ov-col"><${Lookup} quests=${quests} npcs=${npcs} cid=${cid}/></div>
    </div>
    ${!isDM && html`<${RevealPopup} cid=${cid} items=${revelations}/>`}
  </main>`;
}
