// Campaign backups: the DM downloads everything as one JSON file and can restore it later as a new campaign.
// Restoring keeps all IDs, so sessions, journal entries and characters still point at each other.
// Players rejoin the restored campaign with its new code and find their characters waiting.
import { store } from './data.js';
import { createCampaign } from './ops.js';
import { worldPath } from './world.js';

const COLS = ['characters', 'sessions', 'quests', 'npcs', 'journal', 'secrets', 'revelations', 'members', 'map', 'log', 'loot'];
const strip = d => { if (!d) return d; const { id, ...rest } = d; return rest; };

export async function exportCampaign(cid, user) {
  const camp = await store.get(`campaigns/${cid}`);
  const out = { app: 'dnd-manager', format: 1, exportedAt: new Date().toISOString(), campaign: strip(camp), collections: {}, notes: null };
  for (const k of COLS) out.collections[k] = await store.getCol(`campaigns/${cid}/${k}`);
  for (const ch of out.collections.characters) ch.sheet = strip(await store.get(`campaigns/${cid}/characters/${ch.id}/sheet/main`));
  out.notes = strip(await store.get(`users/${user.uid}/notes/${cid}`));
  out.scenes = strip(await store.get(`users/${user.uid}/notes/${cid}__scenes`));
  out.world = strip(await store.get(worldPath(user.uid, cid)));
  const day = new Date().toISOString().slice(0, 10);
  const name = `DnD-Manager_${(camp.name || 'Kampagne').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '')}_${day}.json`;
  const url = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return name;
}

export async function importCampaign(user, file) {
  let data;
  try { data = JSON.parse(await file.text()); } catch (e) { data = null; }
  if (!data || data.app !== 'dnd-manager' || !data.campaign?.name) throw Object.assign(new Error('Das ist keine Sicherung aus dem DnD Manager.'), { friendly: true });
  const { dmUid, dmName, joinCode, createdAt, ...rest } = data.campaign;
  const cid = await createCampaign(user, { ...rest, dmName: user.name });
  const base = `campaigns/${cid}`, ops = [], C = data.collections || {};
  for (const ch of C.characters || []) {
    const { id, sheet, campaignId, ...card } = ch;
    ops.push({ type: 'set', path: `${base}/characters/${id}`, data: card });
    if (sheet) ops.push({ type: 'set', path: `${base}/characters/${id}/sheet/main`, data: sheet });
  }
  for (const k of ['sessions', 'quests', 'npcs', 'journal', 'secrets', 'revelations', 'map', 'log', 'loot'])
    for (const d of C[k] || []) ops.push({ type: 'set', path: `${base}/${k}/${d.id}`, data: strip(d) });
  if (data.notes) ops.push({ type: 'set', path: `users/${user.uid}/notes/${cid}`, data: data.notes });
  if (data.scenes) ops.push({ type: 'set', path: `users/${user.uid}/notes/${cid}__scenes`, data: data.scenes });
  if (data.world) ops.push({ type: 'set', path: worldPath(user.uid, cid), data: data.world });
  for (let i = 0; i < ops.length; i += 400) await store.batch(ops.slice(i, i + 400));
  return cid;
}
