// Battle map: a shared grid (1 square = 5 ft). Everyone sees token positions live.
// The DM moves every token and paints terrain; players move their own character.
// Positions live in campaigns/{cid}/map/{tokenId}: tokenId = character id for heroes, combat row id for enemies, '_terrain' for terrain.
import { html, useState, useEffect, useRef, HpBar, toast, failed, int, initials } from './ui.js';
import { store } from './data.js';
import { SPECIES_EMOJI, diceHex } from './rules5e.js';

const SIZES = { s: [16, 10, 'Klein'], m: [20, 14, 'Mittel'], l: [28, 18, 'Groß'] };
const TERRAIN = { rock: ['🪨', 'Felsen'], tree: ['🌳', 'Baum'], water: ['💧', 'Wasser'], wall: ['⬛', 'Wand'], bush: ['🌿', 'Gebüsch'], fire: ['🔥', 'Feuer'] };
const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) * 5; // 2024: every square counts 5 ft, diagonals too

export function BattleMap({ cid, camp, chars, isDM, user }) {
  const docs = useCol(`campaigns/${cid}/map`);
  const [cols, rows] = SIZES[camp.mapSize || 'm'];
  const wrapRef = useRef(null), gridRef = useRef(null);
  const [cell, setCell] = useState(34);
  const [drag, setDrag] = useState(null);   // { id, from: {x,y}|null, cx, cy, moved }
  const [sel, setSel] = useState(null);
  const [brush, setBrush] = useState(null); // DM terrain painting
  const [paint, setPaint] = useState(null); // cells changed during one stroke
  const [open, setOpen] = useState(true);

  useEffect(() => { const el = wrapRef.current; if (!el) return;
    const fit = () => setCell(Math.max(14, Math.min(46, Math.floor((el.clientWidth - 2) / cols))));
    fit(); const ro = new ResizeObserver(fit); ro.observe(el); return () => ro.disconnect(); }, [cols, open]);

  const cb = camp.combat, list = cb?.list || [];
  const cur = list[cb?.turn ?? -1];
  const curId = cur ? (cur.kind === 'pc' ? cur.charId : cur.id) : null;
  const tokens = [
    ...chars.map(c => ({ id: c.id, kind: 'pc', name: c.name, short: initials(c.name), emoji: SPECIES_EMOJI[c.species], color: c.diceColor ? diceHex(c.diceColor) : null, mine: c.ownerUid === user.uid, hp: c.hp ?? 0, hpMax: c.hpMax ?? 0, speed: int(c.speed, 30) })),
    ...list.filter(r => r.kind === 'npc').map(r => ({ id: r.id, kind: 'npc', name: r.name, short: (r.name.match(/(\d+)\s*$/) || [])[1] || initials(r.name), hp: r.hp ?? r.hpMax ?? 0, hpMax: r.hpMax || 0, speed: 30 })),
  ];
  const pos = Object.fromEntries((docs || []).filter(d => d.id !== '_terrain').map(d => [d.id, { x: d.x, y: d.y }]));
  const terrain = { ...((docs || []).find(d => d.id === '_terrain')?.cells || {}), ...(paint || {}) };
  const canMove = t => isDM || (t.kind === 'pc' && t.mine);
  const placed = tokens.filter(t => pos[t.id] && pos[t.id].x < cols && pos[t.id].y < rows), bench = tokens.filter(t => !placed.includes(t));
  const at = (x, y) => placed.find(t => pos[t.id].x === x && pos[t.id].y === y);

  // the DM tidies up positions of enemies that left the fight
  useEffect(() => { if (!isDM || !docs) return; const ids = new Set(tokens.map(t => t.id));
    const orphans = docs.filter(d => d.id !== '_terrain' && !ids.has(d.id)); if (orphans.length) store.batch(orphans.map(d => ({ type: 'delete', path: `campaigns/${cid}/map/${d.id}` }))).catch(() => {}); }, [docs?.length, tokens.length]);

  const cellAt = (clientX, clientY) => { const r = gridRef.current?.getBoundingClientRect(); if (!r) return null;
    const x = Math.floor((clientX - r.left) / cell), y = Math.floor((clientY - r.top) / cell);
    return x >= 0 && y >= 0 && x < cols && y < rows ? { x, y } : null; };
  const write = async (id, p) => { try { p ? await store.set(`campaigns/${cid}/map/${id}`, { x: p.x, y: p.y, updatedAt: Date.now() }) : await store.remove(`campaigns/${cid}/map/${id}`); } catch (x) { failed(x); } };

  const down = (t, e) => { if (brush) return; e.preventDefault(); e.stopPropagation();
    if (!canMove(t)) { setSel(sel === t.id ? null : t.id); return; }
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDrag({ id: t.id, from: pos[t.id] || null, cx: e.clientX, cy: e.clientY, sx: e.clientX, sy: e.clientY, moved: false }); };
  const move = e => { if (!drag) return; const moved = drag.moved || Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 5; setDrag({ ...drag, cx: e.clientX, cy: e.clientY, moved }); };
  const up = e => { if (!drag) return; const d = drag; setDrag(null);
    if (!d.moved) { setSel(sel === d.id ? null : d.id); return; }
    const c = cellAt(e.clientX, e.clientY);
    if (!c) { if (d.from) { write(d.id, null); toast('Zurück in die Ablage.'); } return; }
    const other = at(c.x, c.y); if (other && other.id !== d.id) return toast(`Da steht schon ${other.name}.`);
    if (terrain[`${c.x},${c.y}`] === 'wall') return toast('Da ist eine Wand.');
    write(d.id, c); setSel(d.id); };

  // terrain painting (DM)
  const paintAt = (e) => { const c = cellAt(e.clientX, e.clientY); if (!c) return; const k = `${c.x},${c.y}`;
    setPaint(p => ({ ...(p || {}), [k]: brush === 'erase' ? null : brush })); };
  const gridDown = e => { if (!brush) { setSel(null); return; } e.preventDefault(); e.currentTarget.setPointerCapture?.(e.pointerId); setPaint({}); paintAt(e); };
  const gridMove = e => { if (brush && paint) paintAt(e); };
  const gridUp = async () => { if (!brush || !paint) return; const next = { ...((docs || []).find(d => d.id === '_terrain')?.cells || {}) };
    for (const [k, v] of Object.entries(paint)) { if (v) next[k] = v; else delete next[k]; }
    setPaint(null); try { await store.set(`campaigns/${cid}/map/_terrain`, { cells: next, updatedAt: Date.now() }); } catch (x) { failed(x); } };

  const autoPlace = async () => { const free = (x0, dir) => { for (let i = 0; i < cols * rows; i++) { const x = x0 + dir * Math.floor(i / rows), y = i % rows; if (x >= 0 && x < cols && !at(x, y) && !used.has(`${x},${y}`) && terrain[`${x},${y}`] !== 'wall') { used.add(`${x},${y}`); return { x, y }; } } return null; };
    const used = new Set(); const ops = [];
    for (const t of bench) { const p = t.kind === 'pc' ? free(1, 1) : free(cols - 2, -1); if (p) ops.push({ type: 'set', path: `campaigns/${cid}/map/${t.id}`, data: { ...p, updatedAt: Date.now() } }); }
    if (ops.length) try { await store.batch(ops); } catch (x) { failed(x); } };
  const clearTokens = async () => { try { await store.batch((docs || []).filter(d => d.id !== '_terrain').map(d => ({ type: 'delete', path: `campaigns/${cid}/map/${d.id}` }))); setSel(null); } catch (x) { failed(x); } };
  const clearTerrain = async () => { try { await store.remove(`campaigns/${cid}/map/_terrain`); } catch (x) { failed(x); } };
  const setSize = async k => { try { await store.update(`campaigns/${cid}`, { mapSize: k }); } catch (x) { failed(x); } };

  // movement preview while dragging a placed token
  const dt = drag?.moved && tokens.find(t => t.id === drag.id);
  const target = dt && cellAt(drag.cx, drag.cy);
  const ft = dt && drag.from && target ? dist(drag.from, target) : null;
  const range = dt && drag.from ? Math.floor(dt.speed / 5) : 0;
  const selT = sel && tokens.find(t => t.id === sel);

  const Tok = (t, style, extra = '') => html`<button type="button" class=${`tok ${t.kind}${t.id === curId ? ' now' : ''}${t.mine ? ' mine' : ''}${t.hpMax && t.hp <= 0 ? ' down' : ''}${sel === t.id ? ' sel' : ''}${canMove(t) ? ' movable' : ''} ${extra}`}
      style=${`${style}${t.color ? `--tc:${t.color};` : ''}`} title=${`${t.name}${t.hpMax ? ` · ${t.hp}/${t.hpMax} HP` : ''}`} aria-label=${t.name}
      onPointerDown=${e => down(t, e)} onPointerMove=${move} onPointerUp=${up} onPointerCancel=${() => setDrag(null)}>
    <span class="tk-face">${t.kind === 'npc' ? (t.hpMax && t.hp <= 0 ? '💀' : '👹') : (t.emoji || t.short)}</span><span class="tk-tag">${t.short}</span>
    ${t.hpMax ? html`<span class="tk-hp"><i style=${`width:${Math.max(0, Math.min(100, t.hp / t.hpMax * 100))}%`}></i></span>` : ''}</button>`;

  return html`<section class="panel box battlemap">
    <div class="box-head"><h2><span class="ico" aria-hidden="true">🗺️</span>Karte</h2>
      <span class="sub">1 Feld = 5 ft</span><button class="link quiet small" onClick=${() => setOpen(!open)}>${open ? 'Einklappen' : 'Ausklappen'}</button></div>
    ${open && html`
    ${isDM && html`<div class="bm-tools">
      <div class="seg small">${Object.entries(SIZES).map(([k, [, , l]]) => html`<button aria-pressed=${(camp.mapSize || 'm') === k} onClick=${() => setSize(k)}>${l}</button>`)}</div>
      <div class="bm-brushes" role="group" aria-label="Gelände malen"><span class="label">Gelände</span>${Object.entries(TERRAIN).map(([k, [e, l]]) => html`<button class=${'bm-brush' + (brush === k ? ' on' : '')} title=${l} aria-label=${l} onClick=${() => setBrush(brush === k ? null : k)}>${e}</button>`)}
        <button class=${'bm-brush' + (brush === 'erase' ? ' on' : '')} title="Radieren" onClick=${() => setBrush(brush === 'erase' ? null : 'erase')}>🧽</button></div>
      <button class="btn small" onClick=${autoPlace} disabled=${!bench.length}>Aufstellen</button>
      <button class="link quiet small" onClick=${clearTokens}>Figuren zurück</button><button class="link quiet small" onClick=${clearTerrain}>Gelände löschen</button></div>`}
    ${brush && html`<p class="muted small-note">Malmodus: Tippe oder ziehe über Felder. Zum Beenden das Symbol noch einmal antippen.</p>`}
    <div class="bm-wrap" ref=${wrapRef}>
      <div class=${'bm-grid' + (brush ? ' painting' : '')} ref=${gridRef} style=${`width:${cols * cell}px;height:${rows * cell}px;--cell:${cell}px`}
        onPointerDown=${gridDown} onPointerMove=${e => { gridMove(e); move(e); }} onPointerUp=${e => { gridUp(); up(e); }}>
        ${Object.entries(terrain).filter(([, v]) => v).map(([k, v]) => { const [x, y] = k.split(',').map(Number); if (x >= cols || y >= rows) return null;
          return html`<span class=${'terr ' + v} style=${`left:${x * cell}px;top:${y * cell}px`}>${TERRAIN[v]?.[0]}</span>`; })}
        ${dt && drag.from && Array.from({ length: (2 * range + 1) ** 2 }, (_, i) => { const x = drag.from.x - range + (i % (2 * range + 1)), y = drag.from.y - range + Math.floor(i / (2 * range + 1));
          return x >= 0 && y >= 0 && x < cols && y < rows ? html`<span class="reach" style=${`left:${x * cell}px;top:${y * cell}px`}></span>` : null; })}
        ${target && html`<span class=${'drop' + (ft != null && ft > dt.speed ? ' far' : '')} style=${`left:${target.x * cell}px;top:${target.y * cell}px`}></span>`}
        ${placed.map(t => Tok(t, `left:${pos[t.id].x * cell}px;top:${pos[t.id].y * cell}px;`, drag?.id === t.id && drag.moved ? 'lifted' : ''))}
      </div>
    </div>
    ${dt && html`<div class="bm-ghost" style=${`left:${drag.cx}px;top:${drag.cy}px;--cell:${cell}px`}>${Tok(dt, '', 'ghost')}
      ${ft != null && html`<span class=${'bm-ft' + (ft > dt.speed ? ' far' : '')}>${ft} ft${ft > dt.speed ? ' · zu weit' : ''}</span>`}</div>`}
    ${bench.length > 0 && html`<div class="bm-bench"><span class="label">Noch nicht auf der Karte</span>
      <div class="bm-bench-row">${bench.map(t => Tok(t, `--cell:${Math.min(cell, 38)}px;`, 'benched'))}</div>
      ${!isDM && bench.some(t => t.mine) && html`<span class="muted small-note">Zieh deine Figur auf die Karte.</span>`}</div>`}
    ${selT && html`<div class="bm-info"><b>${selT.name}</b>${selT.hpMax ? html`<span class="num">${selT.hp} / ${selT.hpMax} HP</span><${HpBar} hp=${selT.hp} max=${selT.hpMax}/>` : ''}
      ${pos[selT.id] && html`<div class="bm-dist"><span class="label">Abstand</span>${placed.filter(t => t.id !== selT.id).sort((a, b) => dist(pos[selT.id], pos[a.id]) - dist(pos[selT.id], pos[b.id])).map(t => html`<span class=${'dist-chip ' + t.kind}>${t.name}: <b>${dist(pos[selT.id], pos[t.id])} ft</b></span>`)}</div>`}</div>`}
    <p class="muted small-note">${isDM ? 'Ziehe Figuren auf Felder. Antippen zeigt Abstände. Raus aus der Karte ziehen legt sie zurück in die Ablage.' : 'Ziehe deine Figur. Beim Ziehen siehst du deine Reichweite und die Entfernung in ft. Antippen zeigt Abstände.'}</p>`}
  </section>`;
}
function useCol(path) { // local copy to keep this module self-contained
  const [d, setD] = useState(undefined);
  useEffect(() => { if (!path) { setD([]); return; } return store.watchCol(path, [], setD, () => setD([])); }, [path]);
  return d;
}
