// Action log: who did what, in which situation. Every roll from a character sheet or a foe sheet is
// logged automatically; actions without a roll (Dash, a spell without attack, a potion) too.
// The DM can add own entries and mark rolls as success or failure.
// Entries live in campaigns/{cid}/log/{id}; `session` is the evening they belong to.
import { html, useState, useEffect, useRef, toast, failed, int } from './ui.js';
import { store, newId } from './data.js';
import { diceHex } from './rules5e.js';

/* ---------- who is rolling ----------
   A character card or foe sheet sets the actor in the capture phase of a click; the dice tray reads it
   right after, in the same click. Any click elsewhere clears it first (window capture runs before element capture). */
let actor = null, fallback = null;
export const setActor = a => { actor = a; };
export const setFallbackActor = a => { fallback = a; };            // free rolls in the tray count for this character
export const takeActor = free => { const a = actor || (free ? fallback : null); actor = null; return a; };
addEventListener('click', () => { actor = null; }, true);

export const breakdown = r => (r?.parts || []).map((p, i) => (p.flat !== undefined ? `${p.flat >= 0 ? '+' : '−'} ${Math.abs(p.flat)}` : `${p.sign < 0 ? '− ' : i ? '+ ' : ''}[${p.rolls.join(', ')}]`)).join(' ');

export function logEntry(cid, data) {
  if (!cid) return Promise.resolve();
  return store.set(`campaigns/${cid}/log/${newId()}`, { ts: Date.now(), session: 0, ...data }).catch(e => console.warn('log', e));
}
export function logRoll(a, label, r) {
  if (!a?.cid || !r) return;
  logEntry(a.cid, { kind: 'roll', uid: a.uid, who: a.who, charId: a.charId || null, foe: !!a.foe, session: a.session || 0, label: String(label || ''), expr: r.expr || '',
    total: r.total, nat: r.nat ?? null, mode: r.mode || 'normal', dropped: r.dropped ?? null, crit: !!r.crit, fumble: !!r.fumble, detail: breakdown(r) });
}
// an action without a roll, e.g. "Dash (Action)"
export function logAct(a, text) { if (a?.cid) logEntry(a.cid, { kind: 'act', uid: a.uid, who: a.who, charId: a.charId || null, session: a.session || 0, label: text }); }
// the actor for a character in a campaign (null for characters without a campaign)
export const charActor = (camp, c, cid, user) => (camp && !camp.library && c ? { cid, uid: user.uid, who: c.name, charId: c.id, session: camp.table?.session || 0 } : null);

const time = ts => new Date(ts).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
const MODE = { adv: '⬆️ Vorteil', dis: '⬇️ Nachteil' };

/* ---------- the log as the DM sees it ---------- */
export function ActionLog({ cid, camp, chars, user, compact }) {
  const session = camp.table?.session || 0;
  const [list, setList] = useState(undefined);
  useEffect(() => store.watchCol(`campaigns/${cid}/log`, [['session', '==', session]], l => setList(l.sort((a, b) => a.ts - b.ts)), () => setList([])), [cid, session]);
  const [who, setWho] = useState(''); const [text, setText] = useState(''); const [val, setVal] = useState('');
  const [filter, setFilter] = useState('all'); const [more, setMore] = useState(false);
  const foes = (camp.combat?.list || []).filter(r => r.kind === 'npc');
  const color = id => { const c = chars.find(x => x.id === id); return c?.diceColor ? diceHex(c.diceColor) : null; };
  const add = async e => { e.preventDefault(); if (!text.trim()) return toast('Was ist passiert?');
    const c = chars.find(x => x.id === who);
    await logEntry(cid, { kind: 'note', uid: user.uid, who: c ? c.name : who || 'DM', charId: c?.id || null, session, label: text.trim(), total: val === '' ? null : int(val, 0) });
    setText(''); setVal(''); };
  const mark = (x, outcome) => store.update(`campaigns/${cid}/log/${x.id}`, { outcome: x.outcome === outcome ? null : outcome }).catch(failed);
  const del = x => store.remove(`campaigns/${cid}/log/${x.id}`).catch(failed);
  const people = [...new Set((list || []).filter(x => x.who && (x.kind === 'roll' || x.kind === 'act' || x.kind === 'note')).map(x => x.who))];
  const shown = (list || []).filter(x => filter === 'all' || (filter === 'marks' ? ['scene', 'round', 'combat'].includes(x.kind) : x.who === filter || ['scene', 'round', 'combat'].includes(x.kind)));
  const cut = more ? shown : shown.slice(-(compact ? 14 : 40)); // oldest on top like a chat, the newest at the bottom
  const box = useRef(null);
  useEffect(() => { const el = box.current; if (el) el.scrollTop = el.scrollHeight; }, [list?.length, filter]);

  return html`<section class="panel box actlog">
    <div class="box-head"><h2><span class="ico" aria-hidden="true">📜</span>Aktions-Log</h2><span class="sub">Sitzung ${session || '–'} · ${(list || []).filter(x => x.kind === 'roll').length} Würfe</span></div>
    ${people.length > 1 && html`<div class="log-filter">${[['all', 'Alle'], ...people.map(p => [p, p])].map(([k, l]) => html`<button class=${'act-chip' + (filter === k ? ' on' : '')} onClick=${() => setFilter(k)}>${l}</button>`)}</div>`}
    ${list === undefined ? html`<p class="muted">Lädt…</p>` : !shown.length ? html`<p class="muted small-note">Noch nichts passiert. Jeder Wurf aus einem Bogen landet hier von selbst, mit Name, Wert und Uhrzeit.</p>`
      : html`${shown.length > cut.length && html`<button class="link small" onClick=${() => setMore(true)}>Ältere Einträge zeigen (${shown.length - cut.length})</button>`}<ol class="log-list" ref=${box}>${cut.map(x => (['scene', 'round', 'combat'].includes(x.kind)
        ? html`<li class=${'log-mark ' + x.kind}><span>${x.kind === 'scene' ? '📍' : x.kind === 'combat' ? '⚔️' : '🔁'} ${x.label}</span><small>${time(x.ts)}</small></li>`
        : html`<li class=${'log-row ' + x.kind + (x.foe ? ' foe' : '') + (x.outcome ? ' ' + x.outcome : '')} style=${color(x.charId) ? `--lc:${color(x.charId)}` : ''}>
            <span class="lg-time">${time(x.ts)}</span>
            <span class="lg-what"><b>${x.who}</b> <span>${x.kind === 'loot' ? '🎁 ' : x.kind === 'act' || x.kind === 'note' ? '· ' : ''}${x.label}</span>
              ${x.kind === 'roll' && html`<small>${x.detail}${x.mode && x.mode !== 'normal' ? ` · ${MODE[x.mode]} (${x.nat} statt ${x.dropped})` : ''}</small>`}</span>
            ${x.total != null ? html`<b class=${'lg-total num' + (x.crit ? ' crit' : x.fumble ? ' fumble' : '')} title=${x.crit ? 'Natürliche 20' : x.fumble ? 'Natürliche 1' : ''}>${x.total}</b>` : html`<span></span>`}
            <span class="lg-ctl">${x.kind !== 'act' && x.kind !== 'loot' && html`<button class=${'lg-ok' + (x.outcome === 'ok' ? ' on' : '')} title="Geschafft / getroffen" onClick=${() => mark(x, 'ok')}>✓</button><button class=${'lg-fail' + (x.outcome === 'fail' ? ' on' : '')} title="Nicht geschafft / daneben" onClick=${() => mark(x, 'fail')}>✗</button>`}
              <button class="lg-del" title="Eintrag löschen" aria-label="Eintrag löschen" onClick=${() => del(x)}>🗑</button></span></li>`))}</ol>
`}
    <form class="log-add" onSubmit=${add}>
      <select value=${who} onChange=${e => setWho(e.target.value)} aria-label="Wer"><option value="">DM / Erzählung</option>
        ${chars.map(c => html`<option value=${c.id}>${c.name}</option>`)}${foes.map(f => html`<option value=${f.name}>${f.name}</option>`)}<option value="Gruppe">Ganze Gruppe</option></select>
      <input value=${text} onInput=${e => setText(e.target.value)} placeholder="Was passiert? z. B. überredet die Wache, Tür aufgebrochen" aria-label="Was passiert"/>
      <input class="log-val" type="number" value=${val} onInput=${e => setVal(e.target.value)} placeholder="Wert" aria-label="Wert (optional)"/>
      <button class="btn small primary">Eintragen</button></form>
  </section>`;
}
