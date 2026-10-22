// Prepared material for one or more evenings, imported from a JSON file into an existing campaign.
// Everything lands hidden: secrets, hidden quests and NPCs (DM-only secrets), loot (prepared), map scenes
// and places (DM's private notes), plus DM notes. Each entry carries a prepId, so importing twice adds nothing twice.
import { store, newId } from './data.js';
import { PRESETS } from './foes.js';
import { cleanWorld, worldPath } from './world.js';

const fail = msg => Object.assign(new Error(msg), { friendly: true });

// a foe in a pack: { preset: 'goblin-warrior', name?, ac?, hp?, note?, x, y } → a full combat row
function foeRow(f) {
  const p = PRESETS[f.preset] || {};
  const hp = f.hp ?? p.hp ?? 10;
  return { name: f.name || p.name || 'Gegner', ac: f.ac ?? p.ac ?? 12, hp, hpMax: hp, initBonus: f.initBonus ?? p.initBonus ?? 0, xp: f.xp ?? p.xp ?? 0,
    attacks: f.attacks || p.attacks || [], note: [f.note, p.note].filter(Boolean).join(' '), ...(Number.isInteger(f.x) ? { x: f.x, y: f.y } : {}) };
}
// terrain as rectangles: { t: 'water', x: 9, y: 0, w: 2, h: 14 } → { "9,0": "water", … }
function cells(list = []) {
  const out = {};
  for (const r of list) for (let i = 0; i < (r.w || 1); i++) for (let j = 0; j < (r.h || 1); j++) {
    const k = `${r.x + i},${r.y + j}`; if (r.t === 'clear') delete out[k]; else out[k] = r.t;
  }
  return out;
}

export async function importPrep(user, cid, file) {
  let pack;
  try { pack = JSON.parse(await file.text()); } catch (e) { pack = null; }
  if (!pack || pack.type !== 'dndm-prep') throw fail('Das ist keine Vorbereitungs-Datei für den DnD Manager.');
  const base = `campaigns/${cid}`, now = Date.now(), ops = [], n = { secrets: 0, loot: 0, scenes: 0, places: 0, world: '' };
  const [secrets, loot, notes, scDoc] = await Promise.all([store.getCol(`${base}/secrets`), store.getCol(`${base}/loot`),
    store.get(`users/${user.uid}/notes/${cid}`), store.get(`users/${user.uid}/notes/${cid}__scenes`)]);
  const has = (list, id) => list.some(x => x.prepId === id);

  (pack.secrets || []).forEach((s, i) => { const prepId = s.prepId || `${pack.id}-s${i}`; if (has(secrets, prepId)) return; n.secrets++;
    ops.push({ type: 'set', path: `${base}/secrets/${newId()}`, data: { kind: s.kind || 'secret', title: s.title, body: s.body || '', condition: s.condition || '',
      ...(s.quest ? { quest: { title: s.title, giver: '', location: '', reward: '', description: '', notes: '', ...s.quest } } : {}), ...(s.npc ? { npc: s.npc } : {}),
      revealedAt: 0, prepId, createdAt: now + i } }); });
  (pack.loot || []).forEach((l, i) => { const prepId = l.prepId || `${pack.id}-l${i}`; if (has(loot, prepId)) return; n.loot++;
    const gold = l.kind === 'gold';
    ops.push({ type: 'set', path: `${base}/loot/${newId()}`, data: { name: gold ? 'Münzen' : l.name, rarity: gold ? 'common' : (l.rarity || 'common'), kind: l.kind || 'gear', desc: l.desc || '',
      attune: !!l.attune, qty: Math.max(1, l.qty || 1), coin: l.coin || 'gp', note: l.note || '', status: 'prepared', public: false, shownAt: 0, toCharId: null, toName: null, prepId, createdAt: now - i } }); });

  // DM notes: add the pack's text below what is already there
  if (pack.notes) { const cur = notes || {}, add = {};
    for (const k of ['prep', 'secrets', 'ideas']) {
      const old = pack.notesReplace?.[k];
      // a newer version of the pack: swap the old text for the new one, keep everything the DM wrote around it
      if (old && pack.notes[k] && (cur[k] || '').includes(old)) { add[k] = cur[k].replace(old, pack.notes[k]); n.updated = true; continue; }
      if (pack.notes[k] && !(cur[k] || '').includes(pack.notes[k].slice(0, 40))) add[k] = cur[k] ? `${cur[k]}\n\n${pack.notes[k]}` : pack.notes[k];
    }
    if (Object.keys(add).length) ops.push({ type: 'merge', path: `users/${user.uid}/notes/${cid}`, data: { ...add, updatedAt: now } }); }

  // map scenes and places live in the DM's private scenes doc
  const sc = { scenes: [...(scDoc?.scenes || [])], places: [...(scDoc?.places || [])] };
  (pack.scenes || []).forEach((s, i) => { const prepId = s.prepId || `${pack.id}-m${i}`; if (sc.scenes.some(x => x.prepId === prepId)) return; n.scenes++;
    sc.scenes.push({ id: newId(), prepId, name: s.name, size: s.size || 'm', cells: cells(s.terrain), foes: (s.foes || []).map(foeRow),
      figs: (s.figs || []).map(g => ({ fig: { name: g.name, emoji: g.emoji || '', att: g.att || 'neutral' }, x: Number.isInteger(g.x) ? g.x : null, y: Number.isInteger(g.y) ? g.y : null })),
      party: {}, place: s.place || '', updatedAt: now - i }); });
  (pack.places || []).forEach(p => { if (sc.places.some(x => x.place === p.place)) return; n.places++; sc.places.push({ id: newId(), place: p.place, mood: p.mood || '' }); });
  if (n.scenes || n.places) ops.push({ type: 'set', path: `users/${user.uid}/notes/${cid}__scenes`, data: { ...sc, updatedAt: now } });

  // a world translation stays in the DM's private notes until it is revealed in the settings
  if (pack.world) { const world = cleanWorld(pack.world), cur = await store.get(worldPath(user.uid, cid)); n.world = world.name;
    ops.push({ type: 'set', path: worldPath(user.uid, cid), data: { world, chars: cur?.chars || {}, updatedAt: now } });
    if (cur?.world) { const camp = await store.get(base); if (camp?.worldRevealed) ops.push({ type: 'update', path: base, data: { world: { ...world, chars: camp.world?.chars || cur.chars || {} } } }); } }

  for (let i = 0; i < ops.length; i += 400) await store.batch(ops.slice(i, i + 400));
  return n;
}
