// Loot: the DM prepares items, shows them as a glowing pop-up (colour = rarity) on every screen,
// then decides who gets it. Given items go straight into that character's inventory.
// campaigns/{cid}/loot/{id}: { name, rarity, kind, desc, attune, qty, coin, public, status: 'prepared'|'shown'|'given',
//   shownAt, toCharId, toName, givenAt, createdAt }. Players only read public ones (shown or given).
import { html, useState, useEffect, Modal, Field, toast, failed, int } from './ui.js';
import { store, newId } from './data.js';
import { logEntry } from './log.js';

// D&D rarities with the colours most tables know (D&D Beyond)
export const RARITY = {
  common: { en: 'Common', de: 'Gewöhnlich', hex: '#A3A9B4' },
  uncommon: { en: 'Uncommon', de: 'Ungewöhnlich', hex: '#1FC219' },
  rare: { en: 'Rare', de: 'Selten', hex: '#4990E2' },
  veryrare: { en: 'Very Rare', de: 'Sehr selten', hex: '#9810E0' },
  legendary: { en: 'Legendary', de: 'Legendär', hex: '#FEA227' },
  artifact: { en: 'Artifact', de: 'Artefakt', hex: '#BE8972' },
};
export const rarityHex = r => RARITY[r]?.hex || RARITY.common.hex;
const KIND = { weapon: '⚔️ Waffe', armor: '🛡️ Rüstung', potion: '🧪 Trank', scroll: '📜 Schriftrolle', ring: '💍 Ring', wand: '🪄 Stab', wondrous: '✨ Wundersamer Gegenstand', gear: '🎒 Ausrüstung', gold: '💰 Münzen' };
const ICON = { weapon: '⚔️', armor: '🛡️', potion: '🧪', scroll: '📜', ring: '💍', wand: '🪄', wondrous: '✨', gear: '🎒', gold: '💰' };
const COIN = { gp: 'Gold (gp)', sp: 'Silber (sp)', cp: 'Kupfer (cp)', pp: 'Platin (pp)', ep: 'Elektrum (ep)' };

// a few magic items from the 2024 rules (SRD 5.2) that suit low levels
const PRESETS = [
  { name: 'Potion of Healing', rarity: 'common', kind: 'potion', desc: 'Trinken (Bonus Action): heilt 2d4 + 2 HP.' },
  { name: 'Potion of Greater Healing', rarity: 'uncommon', kind: 'potion', desc: 'Trinken (Bonus Action): heilt 4d4 + 4 HP.' },
  { name: 'Spell Scroll (Cantrip)', rarity: 'common', kind: 'scroll', desc: 'Enthält einen Cantrip. Wer ihn auf seiner Zauberliste hat, kann ihn einmal wirken, dann zerfällt die Rolle.' },
  { name: 'Spell Scroll (Level 1)', rarity: 'common', kind: 'scroll', desc: 'Enthält einen Zauber der Stufe 1. Einmal wirkbar, ohne Spell Slot.' },
  { name: 'Weapon, +1', rarity: 'uncommon', kind: 'weapon', desc: '+1 auf Angriffs- und Schadenswürfe mit dieser magischen Waffe.' },
  { name: 'Armor, +1', rarity: 'rare', kind: 'armor', desc: '+1 auf die Armor Class, während du sie trägst.' },
  { name: 'Cloak of Protection', rarity: 'uncommon', kind: 'wondrous', attune: true, desc: '+1 auf die Armor Class und auf alle Saving Throws.' },
  { name: 'Bag of Holding', rarity: 'uncommon', kind: 'wondrous', desc: 'Innen viel größer als außen: bis 500 Pfund, wiegt selbst immer 5 Pfund.' },
  { name: 'Goggles of Night', rarity: 'uncommon', kind: 'wondrous', desc: 'Darkvision 60 ft. Hast du schon Darkvision, +60 ft Reichweite.' },
  { name: 'Boots of Elvenkind', rarity: 'uncommon', kind: 'wondrous', desc: 'Deine Schritte machen keinen Laut. Advantage auf Dexterity (Stealth) Checks.' },
  { name: 'Driftglobe', rarity: 'uncommon', kind: 'wondrous', desc: 'Kleine Glaskugel, die auf Befehl leuchtet und dir schwebend folgt.' },
  { name: 'Immovable Rod', rarity: 'uncommon', kind: 'wand', desc: 'Knopf drücken: Der Stab bleibt in der Luft stehen und trägt bis zu 8.000 Pfund.' },
  { name: 'Wand of Magic Missiles', rarity: 'uncommon', kind: 'wand', desc: '7 Ladungen. Wirkt Magic Missile, mehr Ladungen für mehr Geschosse. Lädt sich täglich auf.' },
  { name: 'Pearl of Power', rarity: 'uncommon', kind: 'wondrous', attune: true, desc: 'Einmal am Tag: einen verbrauchten Spell Slot bis Stufe 3 zurückholen.' },
  { name: 'Ring of Protection', rarity: 'rare', kind: 'ring', attune: true, desc: '+1 auf die Armor Class und auf alle Saving Throws.' },
  { name: 'Flame Tongue', rarity: 'rare', kind: 'weapon', attune: true, desc: 'Auf Befehl lodert die Klinge: +2d6 Fire Schaden pro Treffer und Licht im Umkreis von 40 ft.' },
];

/* ---------- give an item to a character: it lands in their inventory (or purse) ---------- */
async function giveTo(cid, it, ch, qty, session) {
  const path = `campaigns/${cid}/characters/${ch.id}/sheet/main`;
  const sh = (await store.get(path)) || {};
  const data = it.kind === 'gold'
    ? { coins: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0, ...(sh.coins || {}), [it.coin || 'gp']: int((sh.coins || {})[it.coin || 'gp'], 0) + qty } }
    : { inventory: [...(sh.inventory || []), { id: newId(), name: it.name, qty: qty || 1, note: it.desc ? it.desc.slice(0, 140) : '', attuned: false, rarity: it.rarity || 'common', attune: !!it.attune }] };
  await store.merge(path, { ...data, updatedAt: Date.now() });
  logEntry(cid, { kind: 'loot', who: ch.name, charId: ch.id, session, label: it.kind === 'gold' ? `erhält ${qty} ${it.coin || 'gp'}` : `erhält ${qty > 1 ? qty + '× ' : ''}${it.name} (${RARITY[it.rarity]?.en || 'Common'})` });
}

/* ---------- the glowing card everyone sees ---------- */
export function LootCard({ it, chars, children, big }) {
  const r = RARITY[it.rarity] || RARITY.common;
  const to = it.status === 'given' ? (it.toName || chars?.find(c => c.id === it.toCharId)?.name) : null;
  return html`<div class=${'loot-card r-' + (it.rarity || 'common') + (big ? ' big' : '')} style=${`--rc:${r.hex}`}>
    <div class="lc-rays" aria-hidden="true"></div>
    <div class="lc-icon" aria-hidden="true">${ICON[it.kind] || '✨'}</div>
    <span class="lc-rarity">${it.kind === 'gold' ? 'Münzen' : `${r.en} · ${r.de}`}</span>
    <h2>${it.kind === 'gold' ? `${it.qty} ${it.coin || 'gp'}` : `${it.qty > 1 ? it.qty + '× ' : ''}${it.name}`}</h2>
    ${it.kind !== 'gold' && html`<span class="lc-kind">${KIND[it.kind] || ''}${it.attune ? ' · braucht Attunement' : ''}</span>`}
    ${it.desc && html`<p class="pre">${it.desc}</p>`}
    ${to ? html`<div class="lc-to">🎁 geht an <b>${to}</b></div>` : it.status === 'shown' && !children ? html`<div class="lc-wait">Der DM entscheidet, wer es bekommt …</div>` : ''}
    ${children}
  </div>`;
}

/* ---------- DM: prepare, show and hand out ---------- */
export function useLoot(cid, isDM) {
  const [list, setList] = useState([]);
  useEffect(() => { if (!cid) return; return store.watchCol(`campaigns/${cid}/loot`, isDM ? [] : [['public', '==', true]], l => setList(l.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))), () => setList([])); }, [cid, isDM]);
  return list;
}

export function LootButton({ cid, loot }) {
  const [open, setOpen] = useState(false);
  const ready = loot.filter(x => x.status === 'prepared').length;
  return html`<button class="btn" onClick=${() => setOpen(true)}>🎁 Beute${ready ? html` <span class="count-dot">${ready}</span>` : ''}</button>
    ${open && html`<${LootManager} cid=${cid} loot=${loot} onClose=${() => setOpen(false)}/>`}`;
}

const show = (cid, it) => store.update(`campaigns/${cid}/loot/${it.id}`, { status: 'shown', public: true, shownAt: Date.now(), toCharId: null, toName: null }).catch(failed);

function LootManager({ cid, loot, onClose }) {
  const [edit, setEdit] = useState(null);
  const prepared = loot.filter(x => x.status === 'prepared'), given = loot.filter(x => x.status !== 'prepared');
  if (edit) return html`<${LootForm} cid=${cid} it=${edit === 'new' ? null : edit} onClose=${() => setEdit(null)} onShown=${onClose}/>`;
  return html`<${Modal} title="Beute" eyebrow="Gegenstände & Gold" onClose=${onClose}>
    <div class="loot-man">
      <div class="actions"><button class="btn primary" onClick=${() => setEdit('new')}>＋ Neue Beute</button></div>
      <span class="label">Vorbereitet · nur du siehst sie</span>
      ${prepared.length ? html`<ul class="loot-list">${prepared.map(it => html`<li style=${`--rc:${rarityHex(it.rarity)}`}><span class="ll-dot"></span>
          <span class="ll-name"><b>${it.kind === 'gold' ? `${it.qty} ${it.coin || 'gp'}` : it.name}</b><small>${it.kind === 'gold' ? 'Münzen' : RARITY[it.rarity]?.en}${it.note ? ' · ' + it.note : ''}</small></span>
          <button class="btn small primary" onClick=${() => { show(cid, it); onClose(); }}>✨ Zeigen</button><button class="link quiet small" onClick=${() => setEdit(it)}>Bearbeiten</button></li>`)}</ul>`
        : html`<p class="muted small-note">Noch nichts vorbereitet. Leg vor dem Abend fest, was die Gruppe finden kann, z. B. einen Heiltrank bei den Goblins und einen Brief bei Hruk.</p>`}
      ${given.length > 0 && html`<span class="label">Schon gezeigt</span><ul class="loot-list">${given.map(it => html`<li style=${`--rc:${rarityHex(it.rarity)}`}><span class="ll-dot"></span>
          <span class="ll-name"><b>${it.kind === 'gold' ? `${it.qty} ${it.coin || 'gp'}` : it.name}</b><small>${it.status === 'given' ? `bei ${it.toName}` : 'wartet auf Verteilung'}</small></span>
          ${it.status === 'shown' ? html`<button class="link quiet small" onClick=${() => store.update(`campaigns/${cid}/loot/${it.id}`, { status: 'prepared', public: false }).catch(failed)}>Zurücknehmen</button>`
            : html`<button class="link quiet small" onClick=${() => store.remove(`campaigns/${cid}/loot/${it.id}`).catch(failed)}>Aus der Liste</button>`}</li>`)}</ul>`}
    </div></${Modal}>`;
}

function LootForm({ cid, it, onClose, onShown }) {
  const [f, setF] = useState({ name: '', rarity: 'common', kind: 'wondrous', desc: '', attune: false, qty: 1, coin: 'gp', note: '', ...(it || {}) });
  const set = k => e => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const preset = e => { const p = PRESETS[int(e.target.value, -1)]; if (p) setF({ ...f, attune: false, ...p }); };
  const save = async now => {
    const gold = f.kind === 'gold';
    if (!gold && !f.name.trim()) return toast('Wie heißt der Gegenstand?');
    const data = { name: gold ? 'Münzen' : f.name.trim(), rarity: gold ? 'common' : f.rarity, kind: f.kind, desc: f.desc.trim(), attune: !gold && !!f.attune, qty: Math.max(1, int(f.qty, 1)), coin: f.coin, note: f.note.trim(),
      status: now ? 'shown' : 'prepared', public: !!now, shownAt: now ? Date.now() : 0, toCharId: null, toName: null, createdAt: it?.createdAt || Date.now() };
    try { await store.set(`campaigns/${cid}/loot/${it?.id || newId()}`, data); toast(now ? 'Alle sehen es jetzt.' : 'Beute vorbereitet.'); now ? onShown() : onClose(); } catch (x) { failed(x); } };
  const del = async () => { try { await store.remove(`campaigns/${cid}/loot/${it.id}`); onClose(); } catch (x) { failed(x); } };
  return html`<${Modal} title=${it ? 'Beute bearbeiten' : 'Neue Beute'} eyebrow="Gegenstände & Gold" onClose=${onClose}>
    <div class="loot-form">
      ${!it && html`<${Field} label="Vorlage (optional)"><select onChange=${preset}><option value="">Eigener Gegenstand…</option>${PRESETS.map((p, i) => html`<option value=${i}>${p.name} · ${RARITY[p.rarity].en}</option>`)}</select></${Field}>`}
      <${Field} label="Art"><select value=${f.kind} onChange=${set('kind')}>${Object.entries(KIND).map(([k, l]) => html`<option value=${k}>${l}</option>`)}</select></${Field}>
      ${f.kind === 'gold' ? html`<div class="row2"><${Field} label="Menge"><input type="number" min="1" value=${f.qty} onInput=${set('qty')}/></${Field}>
          <${Field} label="Münze"><select value=${f.coin} onChange=${set('coin')}>${Object.entries(COIN).map(([k, l]) => html`<option value=${k}>${l}</option>`)}</select></${Field}></div>`
        : html`<${Field} label="Name"><input value=${f.name} onInput=${set('name')} placeholder="z. B. Odda's Messingkompass"/></${Field}>
        <${Field} label="Seltenheit"><div class="rarity-pick">${Object.entries(RARITY).map(([k, r]) => html`<button type="button" class=${'rp' + (f.rarity === k ? ' on' : '')} style=${`--rc:${r.hex}`} onClick=${() => setF({ ...f, rarity: k })}><i></i>${r.en}<small>${r.de}</small></button>`)}</div></${Field}>
        <div class="row2"><${Field} label="Anzahl"><input type="number" min="1" value=${f.qty} onInput=${set('qty')}/></${Field}>
          <label class="checkline"><input type="checkbox" checked=${f.attune} onChange=${set('attune')}/><span>Braucht Attunement</span></label></div>
        <${Field} label="Was es kann (sehen alle)"><textarea value=${f.desc} onInput=${set('desc')} placeholder="Wirkung, Aussehen, Ladungen"></textarea></${Field}>`}
      <${Field} label="Notiz für dich" hint="z. B. wo es liegt: bei Hruk, in der Truhe"><input value=${f.note} onInput=${set('note')}/></${Field}>
      ${f.kind !== 'gold' && html`<div class="lf-preview"><span class="label">So sieht es aus</span><${LootCard} it=${{ ...f, status: 'prepared' }}><span></span></${LootCard}></div>`}
      <div class="foot"><button class="btn primary" onClick=${() => save(true)}>✨ Jetzt zeigen</button><button class="btn" onClick=${() => save(false)}>Vorbereiten</button>
        <span class="spacer"></span>${it && html`<button class="link quiet small" onClick=${del}>Löschen</button>`}</div>
    </div></${Modal}>`;
}

/* ---------- DM: the item that is on the table right now, and who gets it ---------- */
export function LootStage({ cid, loot, chars, session }) {
  const it = loot.find(x => x.status === 'shown');
  const [busy, setBusy] = useState(false);
  if (!it) return null;
  const done = async (ch, qty) => { await store.update(`campaigns/${cid}/loot/${it.id}`, { status: 'given', toCharId: ch.id, toName: ch.name, givenAt: Date.now() }); };
  const give = async ch => { setBusy(true); try { await giveTo(cid, it, ch, it.qty, session); await done(ch); toast(`${ch.name} bekommt es.`); } catch (x) { failed(x); } finally { setBusy(false); } };
  const split = async () => { setBusy(true); const n = chars.length, each = Math.floor(it.qty / n), rest = it.qty - each * n;
    try { for (const ch of chars) await giveTo(cid, it, ch, each, session);
      await store.update(`campaigns/${cid}/loot/${it.id}`, { status: 'given', toCharId: null, toName: `alle (je ${each} ${it.coin})`, givenAt: Date.now() });
      toast(rest ? `Je ${each} ${it.coin}. ${rest} ${it.coin} bleiben übrig, gebt sie jemandem.` : `Je ${each} ${it.coin} für alle.`); } catch (x) { failed(x); } finally { setBusy(false); } };
  return html`<section class="loot-stage">
    <${LootCard} it=${it} chars=${chars}>
      <div class="lc-give"><span class="label">Wer bekommt es?</span>
        <div class="lc-btns">${chars.map(ch => html`<button class="btn" disabled=${busy} onClick=${() => give(ch)}>${ch.name}</button>`)}
          ${it.kind === 'gold' && chars.length > 1 && html`<button class="btn primary" disabled=${busy} onClick=${split}>Gleich aufteilen</button>`}</div>
        <button class="link quiet small" onClick=${() => store.update(`campaigns/${cid}/loot/${it.id}`, { status: 'prepared', public: false }).catch(failed)}>Doch nicht zeigen</button></div>
    </${LootCard}></section>`;
}

/* ---------- players: pop-up when something is found, and when it is handed out ---------- */
export function LootPopup({ cid, loot, chars, user }) {
  const KEY = 'dndm-loot-seen-' + cid;
  const [seen, setSeen] = useState(() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } });
  const mark = (id, v) => { const n = { ...seen, [id]: v }; setSeen(n); try { localStorage.setItem(KEY, JSON.stringify(n)); } catch (e) {} };
  const fresh = Date.now() - 6 * 3600e3; // nothing older than a few hours pops up
  const it = loot.find(x => (x.shownAt || 0) > fresh && seen[x.id] !== (x.status === 'given' ? 'given' : 'shown') && seen[x.id] !== 'given');
  if (!it) return null;
  const mine = it.status === 'given' && chars.find(c => c.id === it.toCharId)?.ownerUid === user.uid;
  const close = () => mark(it.id, it.status === 'given' ? 'given' : 'shown');
  return html`<div class="scrim loot-scrim" onClick=${close}></div><div class="loot-pop" role="dialog" aria-modal="true" aria-label="Beute gefunden">
    <${LootCard} it=${it} chars=${chars}>
      ${it.status === 'given' ? (mine ? html`<small class="muted">🎒 Liegt jetzt in deinem Inventar.</small>` : '') : html`<div class="lc-wait">Der DM entscheidet, wer es bekommt …</div>`}
      <button class="btn primary" onClick=${close}>${it.status === 'given' ? 'Weiter' : 'Okay'}</button></${LootCard}></div>`;
}
