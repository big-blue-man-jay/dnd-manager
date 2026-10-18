// Enemies in a fight: a temporary sheet per monster, stored in campaign.combat.list (kind 'npc').
// Everyone sees name and HP live; AC, attacks and notes are only shown to the DM.
import { html, useState, HpBar, toast, int, requestRoll } from './ui.js';
import { parse } from './dice.js';

export const FOE_HEX = '#B3343F'; // monster dice are always blood red, so the table knows who rolled

// 2024 Monster Manual / SRD 5.2 stat blocks for the starter adventure. More can be added here.
export const PRESETS = {
  'goblin-warrior': { name: 'Goblin Warrior', ac: 15, hp: 10, initBonus: 2, xp: 50, speed: '30 ft',
    attacks: [{ name: 'Scimitar', hit: 4, dmg: '1d6+2', type: 'Slashing', range: '5 ft' }, { name: 'Shortbow', hit: 4, dmg: '1d6+2', type: 'Piercing', range: '80/320 ft' }],
    note: 'Nimble Escape: Disengage oder Hide als Bonus Action. +1d4 Schaden, wenn der Angriff Advantage hatte. Stealth +6, Darkvision 60 ft.' },
  'goblin-minion': { name: 'Goblin Minion', ac: 12, hp: 7, initBonus: 2, xp: 25, speed: '30 ft',
    attacks: [{ name: 'Dagger', hit: 4, dmg: '1d4+2', type: 'Piercing', range: '5 ft oder 20/60 ft' }],
    note: 'Nimble Escape: Disengage oder Hide als Bonus Action. Stealth +6, Darkvision 60 ft.' },
  wolf: { name: 'Wolf', ac: 12, hp: 11, initBonus: 2, xp: 50, speed: '40 ft',
    attacks: [{ name: 'Bite', hit: 4, dmg: '1d6+2', type: 'Piercing', range: '5 ft', extra: 'Ziel (Medium oder kleiner) ist Prone' }],
    note: 'Pack Tactics: Advantage, wenn ein Verbündeter neben dem Ziel steht. Passive Perception 15, Darkvision 60 ft.' },
  'bugbear-warrior': { name: 'Bugbear Warrior', ac: 14, hp: 33, initBonus: 2, xp: 200, speed: '30 ft',
    attacks: [{ name: 'Grab', hit: 4, dmg: '2d6+2', type: 'Bludgeoning', range: '10 ft', extra: 'Ziel (Medium oder kleiner) ist Grappled, Escape DC 12' },
      { name: 'Light Hammer', hit: 4, dmg: '3d4+2', type: 'Bludgeoning', range: '10 ft oder 20/60 ft', extra: 'Advantage gegen ein Ziel, das er gepackt hat' }],
    note: 'Abduct: zieht ein gepacktes Ziel ohne zusätzliche Bewegung mit. Stealth +6, Darkvision 60 ft.' },
};

const sgn = n => (n >= 0 ? '+' : '') + n;
// Critical hit: roll all damage dice twice (2024 rules), the flat bonus once.
export const critExpr = expr => { const t = parse(expr); if (!t) return expr;
  return t.map((x, i) => { const s = (x.sign < 0 ? '-' : i ? '+' : ''); return x.kind === 'dice' ? `${s}${x.count * 2}d${x.sides}` : `${s}${x.value}`; }).join(''); };

/* ---------- add one or more enemies ---------- */
const blankAtk = () => ({ name: '', hit: 4, dmg: '1d6+2', type: '', range: '' });
export function FoeForm({ onAdd }) {
  const empty = { preset: 'goblin-warrior', count: 1, name: '', ac: '', hp: '', initBonus: '', init: '', attacks: [], note: '' };
  const [f, setF] = useState(empty); const [open, setOpen] = useState(false);
  const p = PRESETS[f.preset];
  const custom = f.preset === 'custom';
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const atks = custom ? (f.attacks.length ? f.attacks : [blankAtk()]) : p.attacks;
  const setAtk = (i, k, v) => setF({ ...f, attacks: atks.map((a, j) => (j === i ? { ...a, [k]: k === 'hit' ? int(v, 0) : v } : a)) });
  const submit = e => { e.preventDefault();
    const base = custom ? { name: f.name.trim(), ac: int(f.ac, 10), hp: int(f.hp, 1), initBonus: int(f.initBonus, 0), xp: 0, attacks: atks.filter(a => a.name.trim() && parse(a.dmg)), note: f.note }
      : { ...p, name: f.name.trim() || p.name, ac: f.ac === '' ? p.ac : int(f.ac, p.ac), hp: f.hp === '' ? p.hp : int(f.hp, p.hp) };
    if (!base.name) return toast('Gib dem Gegner einen Namen.');
    if (custom && atks.some(a => a.name.trim() && !parse(a.dmg))) return toast('Schaden bitte als Würfel angeben, z. B. 1d8+3.');
    const n = Math.max(1, Math.min(12, int(f.count, 1)));
    onAdd(n, base, f.init === '' ? '' : int(f.init, 0)); setF({ ...empty, preset: f.preset }); setOpen(false); };
  if (!open) return html`<div><button class="btn" onClick=${() => setOpen(true)}>👹 Gegner hinzufügen</button></div>`;
  return html`<form class="foe-add panel" onSubmit=${submit}>
    <div class="fa-row"><label class="fld"><span class="label">Gegner</span><select value=${f.preset} onChange=${e => setF({ ...empty, preset: e.target.value })}>
        ${Object.entries(PRESETS).map(([k, v]) => html`<option value=${k}>${v.name} (AC ${v.ac}, ${v.hp} HP, ${v.xp} XP)</option>`)}<option value="custom">Eigener Gegner…</option></select></label>
      <label class="fld sm"><span class="label">Anzahl</span><input type="number" min="1" max="12" value=${f.count} onInput=${set('count')}/></label></div>
    <div class="fa-row four"><label class="fld"><span class="label">Name</span><input value=${f.name} onInput=${set('name')} placeholder=${custom ? 'Hruk Zweisack' : p.name}/></label>
      <label class="fld sm"><span class="label">AC</span><input type="number" value=${f.ac} onInput=${set('ac')} placeholder=${custom ? '12' : p.ac}/></label>
      <label class="fld sm"><span class="label">Max HP</span><input type="number" value=${f.hp} onInput=${set('hp')} placeholder=${custom ? '10' : p.hp}/></label>
      ${custom ? html`<label class="fld sm"><span class="label">Init-Bonus</span><input type="number" value=${f.initBonus} onInput=${set('initBonus')} placeholder="+0"/></label>`
        : html`<label class="fld sm"><span class="label">Initiative</span><input type="number" value=${f.init} onInput=${set('init')} placeholder="würfeln"/></label>`}</div>
    ${custom ? html`<div class="fa-atks"><span class="label">Angriffe</span>${atks.map((a, i) => html`<div class="fa-atk">
        <input aria-label="Angriff" placeholder="Claw" value=${a.name} onInput=${e => setAtk(i, 'name', e.target.value)}/>
        <input aria-label="Treffer-Bonus" type="number" placeholder="+4" value=${a.hit} onInput=${e => setAtk(i, 'hit', e.target.value)}/>
        <input aria-label="Schaden" placeholder="1d8+2" value=${a.dmg} onInput=${e => setAtk(i, 'dmg', e.target.value)}/>
        <input aria-label="Schadensart" placeholder="Slashing" value=${a.type} onInput=${e => setAtk(i, 'type', e.target.value)}/></div>`)}
        <button type="button" class="link small" onClick=${() => setF({ ...f, attacks: [...atks, blankAtk()] })}>+ weiterer Angriff</button>
        <label class="fld"><span class="label">Notizen (nur für dich)</span><textarea value=${f.note} onInput=${set('note')} placeholder="Besondere Fähigkeiten, Taktik"></textarea></label></div>`
      : html`<p class="muted small-note">${p.attacks.map(a => `${a.name} ${sgn(a.hit)}, ${a.dmg} ${a.type}`).join(' · ')}. ${p.note}</p>`}
    <div class="actions"><button class="btn primary">${int(f.count, 1) > 1 ? `${int(f.count, 1)} Gegner hinzufügen` : 'Gegner hinzufügen'}</button><button type="button" class="btn" onClick=${() => setOpen(false)}>Abbrechen</button></div>
    <p class="muted small-note">Initiative leer lassen: Sie wird mit „🎲 Gegner würfeln“ gewürfelt (d20 + Bonus). Mehrere gleiche Gegner bekommen Nummern.</p>
  </form>`;
}

/* ---------- the temporary sheet the DM rolls from ---------- */
export function FoeSheet({ r, now, onPatch, onClose, actor }) {
  const [amt, setAmt] = useState('');
  const hp = r.hp ?? r.hpMax ?? 0, max = r.hpMax || 0;
  const roll = (label, expr) => requestRoll({ label: `${r.name}: ${label}`, logLabel: label, expr, hex: FOE_HEX, actor: actor && { ...actor, who: r.name, foe: true } });
  const change = sign => { const n = int(amt, 0); if (!n) return toast('Zahl eingeben.');
    onPatch({ hp: sign < 0 ? Math.max(0, hp - n) : Math.min(max || hp + n, hp + n) }); setAmt('');
    if (sign < 0 && hp - n <= 0) toast(`${r.name} ist am Boden.`); };
  return html`<div class=${'foe-sheet panel' + (now ? ' now' : '')}>
    <div class="fs-head"><span class="foe-ico" aria-hidden="true">👹</span><div><span class="label">${now ? 'Am Zug · Gegnerbogen' : 'Gegnerbogen'}</span><h3>${r.name}</h3></div>
      ${onClose && html`<button class="x" onClick=${onClose} aria-label="Schließen">×</button>`}</div>
    <div class="fs-stats"><div><span class="label">AC</span><b class="num">${r.ac ?? '–'}</b></div>
      <div class="fs-hp"><span class="label">Hit Points</span><b class="num">${hp} <small>/ ${max}</small></b><${HpBar} hp=${hp} max=${max}/></div>
      <div class="fs-dmg"><input type="number" min="0" aria-label="Schaden oder Heilung" placeholder="±" value=${amt} onInput=${e => setAmt(e.target.value)}/>
        <button class="btn small danger-soft" onClick=${() => change(-1)}>💥 Schaden</button><button class="btn small ok-soft" onClick=${() => change(1)}>💚 Heilen</button></div></div>
    ${(r.attacks || []).length ? html`<div class="fs-atks">${r.attacks.map(a => html`<div class="fs-atk">
        <div class="fs-an"><b>${a.name}</b><small>${[a.type, a.range].filter(Boolean).join(' · ')}${a.extra ? html`<br/>${a.extra}` : ''}</small></div>
        <button class="btn small" onClick=${() => roll(`${a.name} (Treffer)`, `1d20${sgn(a.hit || 0)}`)} title="Angriffswurf">🎯 ${sgn(a.hit || 0)}</button>
        <button class="btn small" onClick=${() => roll(`${a.name} (Schaden)`, a.dmg)} title="Schaden">💥 ${a.dmg}</button>
        <button class="btn small quiet" onClick=${() => roll(`${a.name} (Krit-Schaden)`, critExpr(a.dmg))} title="Kritischer Treffer: Schadenswürfel doppelt">Krit</button></div>`)}</div>`
      : html`<p class="muted small-note">Keine Angriffe hinterlegt. Würfle frei im Würfelfenster.</p>`}
    ${r.note && html`<p class="muted small-note">${r.note}</p>`}
    <p class="muted small-note">Vorteil oder Nachteil stellst du im Würfelfenster ein. Bei einer natürlichen 20 auf „Krit“ tippen.</p>
  </div>`;
}
