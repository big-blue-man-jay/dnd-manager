// Session Zero: every player answers a few questions on their phone before the first real evening:
// what they enjoy, how serious it may get, how many rules they want, their lines & veils and a hook for their character.
// Answers live at campaigns/{cid}/zero/{uid}: the player sees their own, the DM sees all of them.
import { html, useState, useDoc, useCol, Modal, Field, toast, failed } from './ui.js';
import { store } from './data.js';

export const FUN = [['fight', '⚔️', 'Kämpfen'], ['puzzle', '🧩', 'Rätsel & Geheimnisse'], ['talk', '💬', 'Reden & Verhandeln'], ['explore', '🗺️', 'Erkunden'], ['drama', '🎭', 'Charakter-Momente'], ['loot', '💰', 'Beute & Ausrüstung']];
const TONE = [['light', 'Locker & lustig'], ['mixed', 'Gemischt'], ['dark', 'Ernst & düster']];
const RULES = [['few', 'So wenig wie möglich'], ['grow', 'Nach und nach'], ['all', 'Ich will alles wissen']];
const TOPICS = ['Spinnen', 'Insekten', 'Folter', 'Gewalt gegen Kinder', 'Tierquälerei', 'Body-Horror', 'Sexuelle Inhalte', 'Sucht & Drogen', 'Selbstverletzung', 'Diskriminierung', 'Enge Räume', 'Ertrinken'];
const zpath = (cid, uid) => `campaigns/${cid}/zero/${uid}`;
const blank = () => ({ fun: {}, tone: '', rules: '', lines: [], veils: [], linesText: '', veilsText: '', hook: '', bond: '', other: '' });

export function ZeroForm({ cid, user, me, onClose }) {
  const [f, setF] = useState({ ...blank(), ...(me || {}) }); const [busy, setBusy] = useState(false);
  const up = p => setF({ ...f, ...p });
  const cycle = t => { const inL = f.lines.includes(t), inV = f.veils.includes(t);
    up(inL ? { lines: f.lines.filter(x => x !== t), veils: [...f.veils, t] } : inV ? { veils: f.veils.filter(x => x !== t) } : { lines: [...f.lines, t] }); };
  const save = async e => { e.preventDefault(); setBusy(true);
    try { const { id, ...data } = f; await store.set(zpath(cid, user.uid), { ...data, uid: user.uid, name: user.name || '', updatedAt: Date.now() }); toast('Danke! Dein DM sieht deine Antworten.'); onClose(); }
    catch (x) { failed(x); } finally { setBusy(false); } };
  return html`<${Modal} title="Session Zero" eyebrow="2 Minuten, nur dein DM sieht das" wide onClose=${onClose}>
    <form class="form zero" onSubmit=${save}>
      <section><h3 class="wiz-h">1 · Was macht dir Spaß?</h3><p class="muted small-note">Damit dein DM weiß, wovon es mehr geben soll.</p>
        <div class="zero-fun">${FUN.map(([k, e, l]) => html`<div class="zf-row"><span><span aria-hidden="true">${e}</span> ${l}</span><span class="seg small">${[[0, 'egal'], [1, 'gern'], [2, 'sehr gern']].map(([v, t]) => html`<button type="button" aria-pressed=${(f.fun[k] ?? -1) === v} onClick=${() => up({ fun: { ...f.fun, [k]: v } })}>${t}</button>`)}</span></div>`)}</div></section>
      <section><h3 class="wiz-h">2 · Wie ernst darf es werden?</h3><span class="seg">${TONE.map(([k, l]) => html`<button type="button" aria-pressed=${f.tone === k} onClick=${() => up({ tone: k })}>${l}</button>`)}</span></section>
      <section><h3 class="wiz-h">3 · Wie viele Regeln willst du lernen?</h3><span class="seg">${RULES.map(([k, l]) => html`<button type="button" aria-pressed=${f.rules === k} onClick=${() => up({ rules: k })}>${l}</button>`)}</span></section>
      <section><h3 class="wiz-h">4 · Lines & Veils</h3>
        <p class="muted small-note"><b>Line</b> = kommt gar nicht vor. <b>Veil</b> = darf passieren, aber nur angedeutet, „hinter dem Vorhang“. Tippe ein Thema einmal für Line, zweimal für Veil, dreimal zum Entfernen.</p>
        <div class="zero-topics">${TOPICS.map(t => { const l = f.lines.includes(t), v = f.veils.includes(t); return html`<button type="button" class=${'chip-btn' + (l ? ' line' : v ? ' veil' : '')} onClick=${() => cycle(t)}>${l ? '🚫 ' : v ? '🌫️ ' : ''}${t}</button>`; })}</div>
        <${Field} label="Weitere Lines (gar nicht)"><input value=${f.linesText} onInput=${e => up({ linesText: e.target.value })} placeholder="optional"/></${Field}>
        <${Field} label="Weitere Veils (nur andeuten)"><input value=${f.veilsText} onInput=${e => up({ veilsText: e.target.value })} placeholder="optional"/></${Field}></section>
      <section><h3 class="wiz-h">5 · Dein Charakter</h3>
        <${Field} label="Was treibt deinen Charakter an? Wen sucht er, was schuldet er, wovor flieht er?"><input value=${f.hook} onInput=${e => up({ hook: e.target.value })} placeholder="Sucht seine verschwundene Schwester"/></${Field}>
        <${Field} label="Kennt er schon jemanden aus der Gruppe?"><input value=${f.bond} onInput=${e => up({ bond: e.target.value })} placeholder="Hat mit Mira mal in einer Taverne gearbeitet"/></${Field}></section>
      <${Field} label="Sonst noch was für deinen DM?"><textarea value=${f.other} onInput=${e => up({ other: e.target.value })} placeholder="z. B. lieber kein Handy am Tisch, ich spiele gern den Heiler …"></textarea></${Field}>
      <div class="foot"><button class="btn primary" disabled=${busy}>Abschicken</button><button type="button" class="btn" onClick=${onClose}>Später</button></div>
    </form></${Modal}>`;
}

// the group's answers in one place
export function ZeroAnswers({ list, members, onClose }) {
  const n = list.length;
  const lines = [...new Set(list.flatMap(a => [...(a.lines || []), ...(a.linesText ? [a.linesText] : [])]))];
  const veils = [...new Set(list.flatMap(a => [...(a.veils || []), ...(a.veilsText ? [a.veilsText] : [])]))].filter(v => !lines.includes(v));
  const score = k => list.reduce((t, a) => t + (a.fun?.[k] || 0), 0);
  const name = a => a.name || members.find(m => m.id === a.uid || m.uid === a.uid)?.name || 'Spieler';
  return html`<${Modal} title="Session Zero" eyebrow=${`${n} ${n === 1 ? 'Antwort' : 'Antworten'}`} wide onClose=${onClose}>
    <section class="zero-sum">
      <span class="label">Was die Gruppe will</span>
      <div class="zero-bars">${FUN.map(([k, e, l]) => html`<div class="zb"><span>${e} ${l}</span><i style=${`--w:${n ? score(k) / (2 * n) * 100 : 0}%`}></i><b class="num">${score(k)}</b></div>`)}</div>
      ${(lines.length || veils.length) ? html`<div class="zero-lv"><div><span class="label">🚫 Lines: kommt nicht vor</span><p>${lines.join(' · ') || '–'}</p></div><div><span class="label">🌫️ Veils: nur andeuten</span><p>${veils.join(' · ') || '–'}</p></div></div>` : html`<p class="muted small-note">Keine Lines oder Veils genannt.</p>`}
    </section>
    ${list.map(a => html`<section class="panel box zero-one"><h3>${name(a)}</h3>
      <dl class="info-dl">
        <div><dt>Mag</dt><dd>${FUN.filter(([k]) => a.fun?.[k] === 2).map(([, e, l]) => `${e} ${l}`).join(', ') || '–'}${FUN.some(([k]) => a.fun?.[k] === 1) ? ` · gern: ${FUN.filter(([k]) => a.fun?.[k] === 1).map(([, , l]) => l).join(', ')}` : ''}</dd></div>
        <div><dt>Ton</dt><dd>${TONE.find(t => t[0] === a.tone)?.[1] || '–'}</dd></div><div><dt>Regeln</dt><dd>${RULES.find(t => t[0] === a.rules)?.[1] || '–'}</dd></div>
        ${a.hook && html`<div><dt>Antrieb</dt><dd>${a.hook}</dd></div>`}${a.bond && html`<div><dt>Verbindung</dt><dd>${a.bond}</dd></div>`}${a.other && html`<div><dt>Sonst</dt><dd>${a.other}</dd></div>`}
      </dl></section>`)}
    ${!n && html`<p class="muted">Noch hat niemand geantwortet. Deine Spieler sehen in der Kampagne die Karte „Session Zero“.</p>`}
  </${Modal}>`;
}

// card for the campaign overview: players fill it in, the DM sees how many answered
export function ZeroCard({ cid, user, isDM, members, chars }) {
  const me = useDoc(!isDM ? zpath(cid, user.uid) : null);
  const all = useCol(isDM ? `campaigns/${cid}/zero` : null);
  const [open, setOpen] = useState(false);
  const players = (members || []).filter(m => (m.uid || m.id) !== user.uid).length || chars.length;
  if (isDM) return html`<div class="panel box zero-card"><div class="box-head"><h2><span class="ico" aria-hidden="true">📝</span>Session Zero</h2><span class="sub">${(all || []).length} von ${players} ausgefüllt</span></div>
    <p class="muted small-note">Was deine Spieler wollen, wie ernst es werden darf und ihre Lines & Veils. Die Spieler füllen es auf dem Handy aus.</p>
    <div class="actions"><button class="btn small" onClick=${() => setOpen(true)}>Antworten ansehen</button></div>
    ${open && html`<${ZeroAnswers} list=${all || []} members=${members || []} onClose=${() => setOpen(false)}/>`}</div>`;
  if (me === undefined) return null;
  return html`<div class=${'panel box zero-card' + (me ? '' : ' cta')}><div class="box-head"><h2><span class="ico" aria-hidden="true">📝</span>Session Zero</h2>${me && html`<span class="sub">✓ ausgefüllt</span>`}</div>
    <p class="muted small-note">${me ? 'Danke! Du kannst deine Antworten jederzeit ändern.' : 'Sag deinem DM in 2 Minuten, was dir Spaß macht und was im Spiel nicht vorkommen soll. Nur der DM sieht es.'}</p>
    <div class="actions"><button class=${'btn small' + (me ? '' : ' primary')} onClick=${() => setOpen(true)}>${me ? 'Antworten ändern' : 'Jetzt ausfüllen'}</button></div>
    ${open && html`<${ZeroForm} cid=${cid} user=${user} me=${me} onClose=${() => setOpen(false)}/>`}</div>`;
}

// for the DM at the table: lines & veils always in sight
export function LinesVeils({ cid }) {
  const all = useCol(`campaigns/${cid}/zero`) || [];
  const lines = [...new Set(all.flatMap(a => [...(a.lines || []), ...(a.linesText ? [a.linesText] : [])]))];
  const veils = [...new Set(all.flatMap(a => [...(a.veils || []), ...(a.veilsText ? [a.veilsText] : [])]))].filter(v => !lines.includes(v));
  if (!lines.length && !veils.length) return null;
  return html`<div class="lines-veils">${lines.length > 0 && html`<span><b>🚫 Lines</b> ${lines.join(' · ')}</span>`}${veils.length > 0 && html`<span><b>🌫️ Veils</b> ${veils.join(' · ')}</span>`}</div>`;
}

// players at the table: a reminder when they have not answered yet
export function ZeroNudge({ cid, user }) {
  const me = useDoc(zpath(cid, user.uid)); const [open, setOpen] = useState(false);
  if (me !== null) return null;
  return html`<div class="zero-nudge">📝 <span><b>Session Zero</b> fehlt noch: 2 Minuten, damit dein DM weiß, was dir Spaß macht.</span><button class="btn small primary" onClick=${() => setOpen(true)}>Ausfüllen</button>
    ${open && html`<${ZeroForm} cid=${cid} user=${user} me=${null} onClose=${() => setOpen(false)}/>`}</div>`;
}
